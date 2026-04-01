/**
 * Per-call transcription session manager.
 * Bridges Twilio audio buffers to the TranscribeService and emits
 * typed events: 'transcript', 'ended', 'error'.
 *
 * Uses Amazon Comprehend for real AI-powered sentiment analysis on
 * each finalized transcript segment.
 */

import { EventEmitter } from 'events';
import {
  ComprehendClient,
  DetectSentimentCommand,
  type LanguageCode as ComprehendLanguageCode,
} from '@aws-sdk/client-comprehend';
import { TranscribeService } from './transcribeService.js';
import type { TranscriptSegment, CallInfo } from './types/transcribe.js';

export interface TranscribeSessionConfig {
  callSid: string;
  streamSid: string;
  callerNumber: string;
  calledNumber: string;
  role: 'CALLER' | 'AGENT';
}

export class TranscribeSession extends EventEmitter {
  readonly callSid: string;
  readonly streamSid: string;
  readonly startTime: string;
  readonly transcripts: TranscriptSegment[] = [];

  private audioQueue: Buffer[] = [];
  private audioResolve: (() => void) | null = null;
  private audioEnded = false;
  private audioChunkCount = 0;
  private config: TranscribeSessionConfig;
  private comprehend: ComprehendClient;

  constructor(config: TranscribeSessionConfig) {
    super();
    this.config = config;
    this.callSid = config.callSid;
    this.streamSid = config.streamSid;
    this.startTime = new Date().toISOString();
    this.comprehend = new ComprehendClient({
      region: process.env['AWS_REGION'] || 'us-east-1',
    });
    this.startTranscription();
  }

  get callInfo(): CallInfo {
    return {
      callSid: this.callSid,
      streamSid: this.streamSid,
      callerNumber: this.config.callerNumber,
      calledNumber: this.config.calledNumber,
      startTime: this.startTime,
      status: this.audioEnded ? 'ended' : 'active',
    };
  }

  pushAudio(pcmBuffer: Buffer): void {
    if (this.audioEnded) return;
    this.audioQueue.push(pcmBuffer);
    this.audioChunkCount++;
    if (this.audioChunkCount % 100 === 1) {
      console.log(`[TranscribeSession] Audio chunk #${this.audioChunkCount}, queue: ${this.audioQueue.length}, bytes: ${pcmBuffer.length}`);
    }
    if (this.audioResolve) {
      this.audioResolve();
      this.audioResolve = null;
    }
  }

  async close(): Promise<void> {
    this.audioEnded = true;
    if (this.audioResolve) {
      this.audioResolve();
      this.audioResolve = null;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    this.emit('ended');
  }

  private async *audioGenerator(): AsyncGenerator<Buffer> {
    while (!this.audioEnded) {
      if (this.audioQueue.length > 0) {
        yield this.audioQueue.shift()!;
      } else {
        await new Promise<void>(resolve => {
          this.audioResolve = resolve;
        });
      }
    }
    while (this.audioQueue.length > 0) {
      yield this.audioQueue.shift()!;
    }
  }

  private startTranscription(): void {
    const mode = (process.env['TRANSCRIBE_MODE'] || 'standard') as 'standard' | 'analytics';
    console.log(`[TranscribeSession] Starting transcription for call ${this.callSid} (mode: ${mode}, role: ${this.config.role})`);

    const service = new TranscribeService({
      region: process.env['AWS_REGION'] || 'us-east-1',
      languageCode: process.env['TRANSCRIBE_LANGUAGE_CODE'] || 'en-US',
      sampleRate: parseInt(process.env['TRANSCRIBE_SAMPLE_RATE'] || '16000', 10),
      mode,
    });

    this.processResults(service).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const awsMsg = (err as Record<string, unknown>)?.['Message'] ?? '';
      console.error(`[TranscribeSession] Error for call ${this.callSid}: ${msg}`);
      if (awsMsg) console.error(`[TranscribeSession] AWS detail: ${String(awsMsg)}`);
      this.emit('error', err);
    });
  }

  /**
   * Analyze sentiment using Amazon Comprehend AI.
   * Returns POSITIVE/NEGATIVE/NEUTRAL/MIXED based on actual NLP analysis.
   */
  private async analyzeSentiment(text: string): Promise<{
    sentiment: TranscriptSegment['sentiment'];
    issueDetected: boolean;
  }> {
    try {
      const langCode = ((process.env['TRANSCRIBE_LANGUAGE_CODE'] || 'en-US').split('-')[0] || 'en') as ComprehendLanguageCode;
      const result = await this.comprehend.send(new DetectSentimentCommand({
        Text: text,
        LanguageCode: langCode,
      }));
      const sentiment = (result.Sentiment as TranscriptSegment['sentiment']) ?? 'NEUTRAL';
      // Issue detected if sentiment is NEGATIVE or MIXED with high negative score
      const negScore = result.SentimentScore?.Negative ?? 0;
      const issueDetected = sentiment === 'NEGATIVE' || (sentiment === 'MIXED' && negScore > 0.4);
      return { sentiment, issueDetected };
    } catch (err) {
      console.error('[TranscribeSession] Comprehend error:', err instanceof Error ? err.message : err);
      return { sentiment: 'NEUTRAL', issueDetected: false };
    }
  }

  private async processResults(service: TranscribeService): Promise<void> {
    for await (const result of service.transcribe(this.audioGenerator())) {
      const channel = this.config.role;

      // For partial results, emit immediately without sentiment (low latency)
      if (result.isPartial) {
        const segment: TranscriptSegment = {
          resultId: `${channel}-${result.resultId}`,
          channel,
          text: result.text,
          isPartial: true,
          startTime: result.startTime,
          endTime: result.endTime,
          sentiment: undefined,
          issueDetected: false,
        };
        this.emit('transcript', segment);
        continue;
      }

      // For finalized results, run Comprehend AI for real sentiment
      const { sentiment, issueDetected } = result.sentiment
        ? { sentiment: result.sentiment, issueDetected: result.issuesDetected }
        : await this.analyzeSentiment(result.text);

      const segment: TranscriptSegment = {
        resultId: `${channel}-${result.resultId}`,
        channel,
        text: result.text,
        isPartial: false,
        startTime: result.startTime,
        endTime: result.endTime,
        sentiment,
        issueDetected,
      };

      console.log(`[TranscribeSession] Transcript: [${segment.channel}] "${segment.text}" (${String(sentiment)}${issueDetected ? ', ISSUE' : ''})`);

      const existingIdx = this.transcripts.findIndex(
        t => t.resultId === result.resultId,
      );
      if (existingIdx >= 0) {
        this.transcripts[existingIdx] = segment;
      } else {
        this.transcripts.push(segment);
      }

      this.emit('transcript', segment);
    }
  }
}
