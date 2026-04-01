/**
 * Per-call transcription session manager.
 * Bridges Twilio audio buffers to the TranscribeService and emits
 * typed events: 'transcript', 'ended', 'error'.
 */

import { EventEmitter } from 'events';
import { TranscribeService } from './transcribeService.js';
import type { TranscriptSegment, CallInfo } from './types/transcribe.js';

export interface TranscribeSessionConfig {
  callSid: string;
  streamSid: string;
  callerNumber: string;
  calledNumber: string;
}

export class TranscribeSession extends EventEmitter {
  readonly callSid: string;
  readonly streamSid: string;
  readonly startTime: string;
  readonly transcripts: TranscriptSegment[] = [];

  private audioQueue: Buffer[] = [];
  private audioResolve: (() => void) | null = null;
  private audioEnded = false;
  private config: TranscribeSessionConfig;

  constructor(config: TranscribeSessionConfig) {
    super();
    this.config = config;
    this.callSid = config.callSid;
    this.streamSid = config.streamSid;
    this.startTime = new Date().toISOString();
    this.startTranscription();
  }

  /** Returns the current call metadata. */
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

  /**
   * Enqueues a PCM16 audio buffer for transcription.
   * No-ops if the session has already been closed.
   */
  pushAudio(pcmBuffer: Buffer): void {
    if (this.audioEnded) return;
    this.audioQueue.push(pcmBuffer);
    if (this.audioResolve) {
      this.audioResolve();
      this.audioResolve = null;
    }
  }

  /**
   * Signals the end of the audio stream and waits briefly
   * for any remaining transcription results to arrive.
   */
  async close(): Promise<void> {
    this.audioEnded = true;
    if (this.audioResolve) {
      this.audioResolve();
      this.audioResolve = null;
    }
    // Give a short delay for remaining results
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    this.emit('ended');
  }

  /**
   * Yields queued audio buffers one at a time, blocking when the
   * queue is empty until new audio arrives or the session closes.
   */
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
    // Drain remaining
    while (this.audioQueue.length > 0) {
      yield this.audioQueue.shift()!;
    }
  }

  /** Spins up the TranscribeService and starts piping audio into it. */
  private startTranscription(): void {
    const mode = (process.env['TRANSCRIBE_MODE'] || 'standard') as 'standard' | 'analytics';
    console.log(`[TranscribeSession] Starting transcription for call ${this.callSid} (mode: ${mode})`);

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

  /** Consumes transcription results and builds the transcript list. */
  private async processResults(service: TranscribeService): Promise<void> {
    for await (const result of service.transcribe(this.audioGenerator())) {
      const segment: TranscriptSegment = {
        resultId: result.resultId,
        channel: result.participantRole === 'AGENT' ? 'AGENT' : 'CALLER',
        text: result.text,
        isPartial: result.isPartial,
        startTime: result.startTime,
        endTime: result.endTime,
        sentiment: result.sentiment,
        issueDetected: result.issuesDetected,
      };

      // Replace partial results with same ID, or append new
      if (!result.isPartial) {
        const existingIdx = this.transcripts.findIndex(
          t => t.resultId === result.resultId,
        );
        if (existingIdx >= 0) {
          this.transcripts[existingIdx] = segment;
        } else {
          this.transcripts.push(segment);
        }
      }

      this.emit('transcript', segment);
    }
  }
}
