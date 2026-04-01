/**
 * AWS Transcribe Call Analytics streaming service wrapper.
 * Accepts an async iterable of PCM16 audio buffers and yields
 * transcription results with AI-powered sentiment, issue detection,
 * and participant role identification.
 */

import {
  TranscribeStreamingClient,
  StartCallAnalyticsStreamTranscriptionCommand,
  type AudioStream,
  type CallAnalyticsLanguageCode,
} from '@aws-sdk/client-transcribe-streaming';

export interface TranscribeConfig {
  region: string;
  languageCode: string;
  sampleRate: number;
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
   * Starts a Call Analytics streaming transcription session.
   * Feeds audio chunks from `audioStream` into AWS Transcribe and yields
   * each transcript result (with sentiment, issues, and participant role)
   * as it becomes available.
   */
  async *transcribe(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<TranscribeResult> {
    const command = new StartCallAnalyticsStreamTranscriptionCommand({
      LanguageCode: this.config.languageCode as CallAnalyticsLanguageCode,
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: this.config.sampleRate,
      AudioStream: this.createAudioStream(audioStream),
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

  /**
   * Wraps raw PCM buffers into the AudioStream event shape expected
   * by the Transcribe Call Analytics Streaming SDK.
   * Sends a ConfigurationEvent first, then AudioEvent chunks.
   */
  private async *createAudioStream(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<AudioStream> {
    yield {
      ConfigurationEvent: {
        ChannelDefinitions: [
          { ChannelId: 0, ParticipantRole: 'CUSTOMER' },
        ],
      },
    };

    for await (const chunk of audioStream) {
      yield { AudioEvent: { AudioChunk: new Uint8Array(chunk) } };
    }
  }
}
