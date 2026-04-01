import type WebSocket from 'ws';
import { LCAClient } from './lcaClient.js';
import { TranscribeSession } from './transcribeSession.js';
import { convertTwilioAudio } from './audioConverter.js';
import type { TwilioMessage } from './types/twilio.js';
import type { TranscriptSegment, CallInfo } from './types/transcribe.js';

/**
 * Handles a single Twilio Media Streams WebSocket connection.
 *
 * Creates TWO TranscribeSessions per call — one for caller (inbound track)
 * and one for agent (outbound track) — so both sides get transcribed
 * with proper CALLER/AGENT labels.
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
  let callerSession: TranscribeSession | undefined;
  let agentSession: TranscribeSession | undefined;
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
            `[Twilio] Stream started — streamSid: ${streamSid}, callSid: ${callSid}, tracks: ${msg.start.tracks.join(',')}`,
          );

          // Create CALLER session (inbound track)
          callerSession = new TranscribeSession({
            callSid,
            streamSid,
            callerNumber: customParams.callerNumber ?? '',
            calledNumber: customParams.calledNumber ?? '',
            role: 'CALLER',
          });

          sessions.set(streamSid, callerSession);

          callerSession.on('transcript', (segment: TranscriptSegment) => {
            onTranscript(callSid!, segment);
          });

          callerSession.on('error', (err: unknown) => {
            console.error(`[Twilio] Caller TranscribeSession error for streamSid=${streamSid}:`, err);
          });

          // Create AGENT session (outbound track)
          agentSession = new TranscribeSession({
            callSid,
            streamSid: `${streamSid}-agent`,
            callerNumber: customParams.callerNumber ?? '',
            calledNumber: customParams.calledNumber ?? '',
            role: 'AGENT',
          });

          agentSession.on('transcript', (segment: TranscriptSegment) => {
            onTranscript(callSid!, segment);
          });

          agentSession.on('error', (err: unknown) => {
            console.error(`[Twilio] Agent TranscribeSession error for streamSid=${streamSid}:`, err);
          });

          onCallStarted(callerSession.callInfo);

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
          // ─── AUDIO TRANSFORMATION BLOCK ──────────────────────────────────────────────
          // INPUT:  msg.media.payload  — Base64 string
          //         msg.media.track    — 'inbound' (caller) or 'outbound' (agent)
          //         Audio format: 8000 Hz, 8-bit μ-law (G.711), mono, from Twilio
          //
          // OUTPUT: pcm                — Node.js Buffer (PCM16 16kHz linear)
          //         Routed to the correct TranscribeSession based on track:
          //           inbound  → callerSession (labeled CALLER)
          //           outbound → agentSession  (labeled AGENT)
          // ─────────────────────────────────────────────────────────────────────────────
          const rawBuffer = Buffer.from(msg.media.payload, 'base64');
          const pcm = convertTwilioAudio(rawBuffer);

          if (msg.media.track === 'outbound' && agentSession) {
            agentSession.pushAudio(pcm);
          } else if (callerSession) {
            callerSession.pushAudio(pcm);
          }

          // Backward compatibility: also forward raw mulaw to LCA
          if (lcaClient) {
            lcaClient.updatePosition(parseInt(msg.media.timestamp, 10));
            lcaClient.sendAudio(rawBuffer);
          }
          break;
        }

        case 'stop': {
          console.log(`[Twilio] Stream stopped — streamSid: ${msg.streamSid}`);

          if (callerSession) {
            callerSession.close().catch((err: unknown) => {
              console.error(`[Twilio] Caller session close failed for streamSid=${streamSid}:`, err);
            });
          }

          if (agentSession) {
            agentSession.close().catch((err: unknown) => {
              console.error(`[Twilio] Agent session close failed for streamSid=${streamSid}:`, err);
            });
          }

          if (callSid) {
            onCallEnded(callSid);
          }

          if (lcaClient) {
            lcaClient.close().catch((err: unknown) => {
              console.error(`[Twilio] LCAClient close failed for streamSid=${streamSid}:`, err);
            });
          }

          if (streamSid) {
            sessions.delete(streamSid);
          }
          break;
        }

        default: {
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

    if (callerSession) {
      callerSession.close().catch(() => {});
    }
    if (agentSession) {
      agentSession.close().catch(() => {});
    }
    if (callSid) {
      onCallEnded(callSid);
    }
    if (lcaClient) {
      lcaClient.close().catch(() => {});
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
