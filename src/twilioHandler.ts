import type WebSocket from 'ws';
import { LCAClient } from './lcaClient.js';
import type { TwilioMessage } from './types/twilio.js';

/**
 * Handles a single Twilio Media Streams WebSocket connection.
 *
 * Registers message, close, and error handlers on the Twilio-side WebSocket.
 * Creates an LCAClient on the 'start' event and forwards decoded audio on 'media' events.
 */
export function handleTwilioConnection(
  ws: WebSocket,
  sessions: Map<string, LCAClient>,
): void {
  let streamSid: string | undefined;
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
          const callSid = msg.start.callSid;
          const customParams = msg.start.customParameters;

          console.log(
            `[Twilio] Stream started — streamSid: ${streamSid}, callSid: ${callSid}`,
          );

          lcaClient = new LCAClient({
            lcaEndpoint: process.env.LCA_ENDPOINT ?? '',
            organizationId: process.env.LCA_ORG_ID ?? '',
            callSid,
            callerNumber: customParams.callerNumber ?? '',
            calledNumber: customParams.calledNumber ?? '',
          });

          sessions.set(streamSid, lcaClient);

          lcaClient.connect().catch((err: unknown) => {
            console.error(
              `[Twilio] LCAClient connect failed for streamSid=${streamSid}:`,
              err,
            );
          });
          break;
        }

        case 'media': {
          if (!lcaClient) {
            break;
          }

          // ─── AUDIO TRANSFORMATION BLOCK ──────────────────────────────────────────────
          // INPUT:  msg.media.payload  — Base64 string
          //         Audio format: 8000 Hz, 8-bit μ-law (G.711), mono, from Twilio
          //
          // OUTPUT: rawBuffer          — Node.js Buffer (raw binary μ-law PCM)
          //         Forwarded as a binary WebSocket frame to the LCA ingestion endpoint
          //
          // CURRENT BEHAVIOR:
          //   Decode Base64 → raw Buffer → send binary frame directly to LCA WS.
          //   LCA accepts 8kHz PCMU when the open message specifies:
          //     { format: "PCMU", rate: 8000 }
          //
          // TO ADD RESAMPLING (if LCA requires 16kHz linear PCM):
          //   1. npm install alawmulaw
          //   2. Decode μ-law bytes: const pcm16 = mulaw.decode(rawBuffer)
          //   3. Upsample 8kHz → 16kHz (duplicate samples or use resampling lib)
          //   4. Forward the upsampled Buffer instead
          // ─────────────────────────────────────────────────────────────────────────────
          const rawBuffer = Buffer.from(msg.media.payload, 'base64');

          lcaClient.updatePosition(parseInt(msg.media.timestamp, 10));
          lcaClient.sendAudio(rawBuffer);
          break;
        }

        case 'stop': {
          console.log(`[Twilio] Stream stopped — streamSid: ${msg.streamSid}`);

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
