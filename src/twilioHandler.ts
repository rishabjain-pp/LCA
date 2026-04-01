import type WebSocket from 'ws';
import { LCAClient } from './lcaClient.js';
import { TranscribeSession } from './transcribeSession.js';
import { convertTwilioAudio } from './audioConverter.js';
import type { TwilioMessage } from './types/twilio.js';
import type { TranscriptSegment, CallInfo } from './types/transcribe.js';

/**
 * Handles a single Twilio Media Streams WebSocket connection.
 *
 * Registers message, close, and error handlers on the Twilio-side WebSocket.
 * Creates a TranscribeSession on the 'start' event, converts mulaw audio to
 * PCM16 16kHz on 'media' events, and pushes it into the transcription pipeline.
 *
 * When ENABLE_LCA_FORWARD is set, also creates an LCAClient for backward
 * compatibility and forwards raw mulaw buffers to the LCA endpoint.
 */
export function handleTwilioConnection(
  ws: WebSocket,
  sessions: Map<string, TranscribeSession>,
  onTranscript: (callSid: string, segment: TranscriptSegment) => void,
  onCallStarted: (call: CallInfo) => void,
  onCallEnded: (callSid: string) => void,
): void {
  let streamSid: string | undefined;
  let callSid: string | undefined;
  let session: TranscribeSession | undefined;
  let lcaClient: LCAClient | undefined;

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString()) as TwilioMessage;

      switch (msg.event) {
        case 'connected': {
          console.log(
            `[Twilio] WebSocket connected — protocol: ${msg.protocol}, version: ${msg.version}`,
          );
          break;
        }

        case 'start': {
          streamSid = msg.streamSid;
          callSid = msg.start.callSid;
          const customParams = msg.start.customParameters;

          console.log(
            `[Twilio] Stream started — streamSid: ${streamSid}, callSid: ${callSid}`,
          );

          // Create TranscribeSession for real-time transcription
          session = new TranscribeSession({
            callSid,
            streamSid,
            callerNumber: customParams.callerNumber ?? '',
            calledNumber: customParams.calledNumber ?? '',
          });

          sessions.set(streamSid, session);

          session.on('transcript', (segment: TranscriptSegment) => {
            onTranscript(callSid!, segment);
          });

          // Prevent unhandled 'error' event from crashing the process
          session.on('error', (err: unknown) => {
            console.error(`[Twilio] TranscribeSession error for streamSid=${streamSid}:`, err);
          });

          onCallStarted(session.callInfo);

          // Backward compatibility: also forward to LCA if enabled
          if (process.env.ENABLE_LCA_FORWARD) {
            lcaClient = new LCAClient({
              lcaEndpoint: process.env.LCA_ENDPOINT ?? '',
              organizationId: process.env.LCA_ORG_ID ?? '',
              callSid,
              callerNumber: customParams.callerNumber ?? '',
              calledNumber: customParams.calledNumber ?? '',
            });
            lcaClient.connect().catch((err: unknown) => {
              console.error(
                `[Twilio] LCAClient connect failed for streamSid=${streamSid}:`,
                err,
              );
            });
          }
          break;
        }

        case 'media': {
          if (!session) {
            break;
          }

          // ─── AUDIO TRANSFORMATION BLOCK ──────────────────────────────────────────────
          // INPUT:  msg.media.payload  — Base64 string
          //         Audio format: 8000 Hz, 8-bit μ-law (G.711), mono, from Twilio
          //
          // OUTPUT: pcm                — Node.js Buffer (PCM16 16kHz linear)
          //         Pushed into the TranscribeSession for real-time transcription
          //
          // PIPELINE:
          //   1. Decode Base64 → raw mulaw Buffer
          //   2. convertTwilioAudio: mulaw 8kHz → PCM16 8kHz → PCM16 16kHz (upsample)
          //   3. session.pushAudio(pcm) → AWS Transcribe streaming
          //
          // BACKWARD COMPAT (ENABLE_LCA_FORWARD):
          //   Also sends raw mulaw buffer to LCA endpoint via LCAClient.
          // ─────────────────────────────────────────────────────────────────────────────
          const rawBuffer = Buffer.from(msg.media.payload, 'base64');
          const pcm = convertTwilioAudio(rawBuffer);

          session.pushAudio(pcm);

          // Backward compatibility: also forward raw mulaw to LCA
          if (lcaClient) {
            lcaClient.updatePosition(parseInt(msg.media.timestamp, 10));
            lcaClient.sendAudio(rawBuffer);
          }
          break;
        }

        case 'stop': {
          console.log(`[Twilio] Stream stopped — streamSid: ${msg.streamSid}`);

          if (session) {
            session.close().catch((err: unknown) => {
              console.error(
                `[Twilio] TranscribeSession close failed for streamSid=${streamSid}:`,
                err,
              );
            });
          }

          if (callSid) {
            onCallEnded(callSid);
          }

          if (lcaClient) {
            lcaClient.close().catch((err: unknown) => {
              console.error(
                `[Twilio] LCAClient close failed for streamSid=${streamSid}:`,
                err,
              );
            });
          }

          if (streamSid) {
            sessions.delete(streamSid);
          }
          break;
        }

        default: {
          // Exhaustive check not possible here since the msg could have an
          // unknown event type from future Twilio protocol versions.
          console.log(
            `[Twilio] Unknown event type: ${(msg as Record<string, unknown>).event}`,
          );
          break;
        }
      }
    } catch (err: unknown) {
      console.error('[Twilio] Failed to parse WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[Twilio] WebSocket closed — streamSid: ${streamSid ?? 'unknown'}`);

    // Cleanup if Twilio side disconnects without sending a 'stop' event
    if (session) {
      session.close().catch((err: unknown) => {
        console.error(
          `[Twilio] TranscribeSession close failed during cleanup for streamSid=${streamSid}:`,
          err,
        );
      });
    }

    if (callSid) {
      onCallEnded(callSid);
    }

    if (lcaClient) {
      lcaClient.close().catch((err: unknown) => {
        console.error(
          `[Twilio] LCAClient close failed during cleanup for streamSid=${streamSid}:`,
          err,
        );
      });
    }

    if (streamSid) {
      sessions.delete(streamSid);
    }
  });

  ws.on('error', (err: Error) => {
    console.error(
      `[Twilio] WebSocket error — streamSid: ${streamSid ?? 'unknown'}:`,
      err,
    );
  });
}
