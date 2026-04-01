/**
 * AWS Transcribe Streaming service wrapper.
 * Accepts an async iterable of PCM16 audio buffers and yields
 * transcription results as they arrive from the service.
 */

import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  type AudioStream,
  type LanguageCode,
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
}

export class TranscribeService {
  private client: TranscribeStreamingClient;

  constructor(private config: TranscribeConfig) {
    this.client = new TranscribeStreamingClient({ region: config.region });
  }

  /**
   * Starts a streaming transcription session.
   * Feeds audio chunks from `audioStream` into AWS Transcribe and yields
   * each transcript result as it becomes available.
   */
  async *transcribe(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<TranscribeResult> {
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: this.config.languageCode as LanguageCode,
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: this.config.sampleRate,
      AudioStream: this.createAudioStream(audioStream),
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
            };
          }
        }
      }
    }
  }

  /**
   * Wraps raw PCM buffers into the AudioStream event shape expected
   * by the Transcribe Streaming SDK.
   */
  private async *createAudioStream(
    audioStream: AsyncIterable<Buffer>,
  ): AsyncGenerator<AudioStream> {
    for await (const chunk of audioStream) {
      yield { AudioEvent: { AudioChunk: new Uint8Array(chunk) } };
    }
  }
}
