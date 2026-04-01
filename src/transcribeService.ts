/**
 * AWS Transcribe streaming service wrapper.
 * Supports two modes:
 *   - 'standard': Basic transcription (StartStreamTranscriptionCommand) — always works
 *   - 'analytics': Call Analytics (StartCallAnalyticsStreamTranscriptionCommand) — AI sentiment + issues
 *
 * Default: 'standard'. Set TRANSCRIBE_MODE=analytics in .env to use Call Analytics
 * (requires IAM permission: transcribe:StartCallAnalyticsStreamTranscription).
 */

import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  StartCallAnalyticsStreamTranscriptionCommand,
  type AudioStream,
  type LanguageCode,
  type CallAnalyticsLanguageCode,
} from '@aws-sdk/client-transcribe-streaming';

export interface TranscribeConfig {
  region: string;
  languageCode: string;
  sampleRate: number;
  mode: 'standard' | 'analytics';
}

export interface TranscribeResult {
  resultId: string;
  text: string;
  isPartial: boolean;
  startTime: number;
  endTime: number;
  participantRole: 'CUSTOMER' | 'AGENT';
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  issuesDetected: boolean;
}

export class TranscribeService {
  private client: TranscribeStreamingClient;

  constructor(private config: TranscribeConfig) {
    this.client = new TranscribeStreamingClient({ region: config.region });
  }

  /**
   * Starts a streaming transcription session.
   * Delegates to standard or analytics mode based on config.
   */
  async *transcribe(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<TranscribeResult> {
    if (this.config.mode === 'analytics') {
      yield* this.transcribeAnalytics(audioStream);
    } else {
      yield* this.transcribeStandard(audioStream);
    }
  }

  /**
   * Standard mode: StartStreamTranscriptionCommand.
   * Provides transcription only (no AI sentiment or issue detection).
   */
  private async *transcribeStandard(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<TranscribeResult> {
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: this.config.languageCode as LanguageCode,
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: this.config.sampleRate,
      AudioStream: this.createStandardAudioStream(audioStream),
      EnablePartialResultsStabilization: true,
      PartialResultsStability: 'low',
    });

    const response = await this.client.send(command);

    if (!response.TranscriptResultStream) {
      return;
    }

    for await (const event of response.TranscriptResultStream) {
      if (event.TranscriptEvent?.Transcript?.Results) {
        for (const result of event.TranscriptEvent.Transcript.Results) {
          const transcript = result.Alternatives?.[0]?.Transcript;
          if (transcript && result.ResultId) {
            yield {
              resultId: result.ResultId,
              text: transcript,
              isPartial: result.IsPartial ?? false,
              startTime: result.StartTime ?? 0,
              endTime: result.EndTime ?? 0,
              participantRole: 'CUSTOMER',
              sentiment: undefined,
              issuesDetected: false,
            };
          }
        }
      }
    }
  }

  /**
   * Analytics mode: StartCallAnalyticsStreamTranscriptionCommand.
   * Provides transcription + AI sentiment + issue detection + participant role.
   */
  private async *transcribeAnalytics(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<TranscribeResult> {
    const command = new StartCallAnalyticsStreamTranscriptionCommand({
      LanguageCode: this.config.languageCode as CallAnalyticsLanguageCode,
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: this.config.sampleRate,
      AudioStream: this.createAnalyticsAudioStream(audioStream),
      EnablePartialResultsStabilization: true,
      PartialResultsStability: 'low',
    });

    const response = await this.client.send(command);

    if (!response.CallAnalyticsTranscriptResultStream) {
      return;
    }

    for await (const event of response.CallAnalyticsTranscriptResultStream) {
      if (event.CategoryEvent) {
        console.log('[Transcribe] Categories:', event.CategoryEvent.MatchedCategories);
      }

      if (event.UtteranceEvent) {
        const u = event.UtteranceEvent;
        if (u.Transcript && u.UtteranceId) {
          yield {
            resultId: u.UtteranceId,
            text: u.Transcript,
            isPartial: u.IsPartial ?? false,
            startTime: (u.BeginOffsetMillis ?? 0) / 1000,
            endTime: (u.EndOffsetMillis ?? 0) / 1000,
            participantRole: u.ParticipantRole === 'AGENT' ? 'AGENT' : 'CUSTOMER',
            sentiment: u.Sentiment as TranscribeResult['sentiment'],
            issuesDetected: (u.IssuesDetected?.length ?? 0) > 0,
          };
        }
      }
    }
  }

  /** Standard mode audio stream — just AudioEvent chunks */
  private async *createStandardAudioStream(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<AudioStream> {
    for await (const chunk of audioStream) {
      yield { AudioEvent: { AudioChunk: new Uint8Array(chunk) } };
    }
  }

  /** Analytics mode audio stream — ConfigurationEvent first, then AudioEvent chunks */
  private async *createAnalyticsAudioStream(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<AudioStream> {
    yield {
      ConfigurationEvent: {
        ChannelDefinitions: [
          { ChannelId: 0, ParticipantRole: 'CUSTOMER' },
          { ChannelId: 1, ParticipantRole: 'AGENT' },
        ],
      },
    };

    for await (const chunk of audioStream) {
      yield { AudioEvent: { AudioChunk: new Uint8Array(chunk) } };
    }
  }
}
