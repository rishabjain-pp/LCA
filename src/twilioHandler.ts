import type WebSocket from 'ws';
import { LCAClient } from './lcaClient.js';
import { TranscribeSession } from './transcribeSession.js';
import { StereoMixer } from './stereoMixer.js';
import { convertTwilioAudio } from './audioConverter.js';
import type { TwilioMessage } from './types/twilio.js';
import type { TranscriptSegment, CallInfo } from './types/transcribe.js';

/**
 * Handles a single Twilio Media Streams WebSocket connection.
 *
 * When TRANSCRIBE_MODE=analytics: Uses a StereoMixer to combine caller (inbound)
 * and agent (outbound) audio into a stereo stream, then sends to a single
 * Call Analytics session which provides AI sentiment + issue detection + speaker labels.
 *
 * When TRANSCRIBE_MODE=standard: Uses two separate TranscribeSessions (one per track)
 * with Comprehend for sentiment analysis.
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
  // Standard mode: two sessions
  let callerSession: TranscribeSession | undefined;
  let agentSession: TranscribeSession | undefined;
  // Analytics mode: one session + stereo mixer
  let stereoSession: TranscribeSession | undefined;
  let mixer: StereoMixer | undefined;
  let lcaClient: LCAClient | undefined;

  const mode = process.env['TRANSCRIBE_MODE'] || 'standard';

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
            `[Twilio] Stream started — streamSid: ${streamSid}, callSid: ${callSid}, tracks: ${msg.start.tracks.join(',')}, mode: ${mode}`,
          );

          if (mode === 'analytics') {
            // Analytics mode: stereo mixer → single Call Analytics session
            mixer = new StereoMixer();
            stereoSession = new TranscribeSession({
              callSid,
              streamSid,
              callerNumber: customParams.callerNumber ?? '',
              calledNumber: customParams.calledNumber ?? '',
              role: 'CALLER', // Call Analytics will set the real role per utterance
              stereoStream: mixer.stream(),
            });

            sessions.set(streamSid, stereoSession);

            stereoSession.on('transcript', (segment: TranscriptSegment) => {
              onTranscript(callSid!, segment);
            });
            stereoSession.on('error', (err: unknown) => {
              console.error(`[Twilio] TranscribeSession error for streamSid=${streamSid}:`, err);
            });

            onCallStarted(stereoSession.callInfo);
          } else {
            // Standard mode: two separate sessions
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
              console.error(`[Twilio] Caller session error for streamSid=${streamSid}:`, err);
            });

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
              console.error(`[Twilio] Agent session error for streamSid=${streamSid}:`, err);
            });

            onCallStarted(callerSession.callInfo);
          }

          // Backward compatibility: LCA forwarding
          if (process.env.ENABLE_LCA_FORWARD) {
            lcaClient = new LCAClient({
              lcaEndpoint: process.env.LCA_ENDPOINT ?? '',
              organizationId: process.env.LCA_ORG_ID ?? '',
              callSid,
              callerNumber: customParams.callerNumber ?? '',
              calledNumber: customParams.calledNumber ?? '',
            });
            lcaClient.connect().catch((err: unknown) => {
              console.error(`[Twilio] LCAClient connect failed:`, err);
            });
          }
          break;
        }

        case 'media': {
          const rawBuffer = Buffer.from(msg.media.payload, 'base64');
          const pcm = convertTwilioAudio(rawBuffer);

          if (mode === 'analytics' && mixer) {
            // Analytics mode: feed stereo mixer
            if (msg.media.track === 'outbound') {
              mixer.pushAgent(pcm);
            } else {
              mixer.pushCaller(pcm);
            }
          } else {
            // Standard mode: route to correct session
            if (msg.media.track === 'outbound' && agentSession) {
              agentSession.pushAudio(pcm);
            } else if (callerSession) {
              callerSession.pushAudio(pcm);
            }
          }

          if (lcaClient) {
            lcaClient.updatePosition(parseInt(msg.media.timestamp, 10));
            lcaClient.sendAudio(rawBuffer);
          }
          break;
        }

        case 'stop': {
          console.log(`[Twilio] Stream stopped — streamSid: ${msg.streamSid}`);

          if (mixer) mixer.close();
          if (stereoSession) stereoSession.close().catch(() => {});
          if (callerSession) callerSession.close().catch(() => {});
          if (agentSession) agentSession.close().catch(() => {});
          if (callSid) onCallEnded(callSid);
          if (lcaClient) lcaClient.close().catch(() => {});
          if (streamSid) sessions.delete(streamSid);
          break;
        }

        default: {
          console.log(`[Twilio] Unknown event type: ${(msg as Record<string, unknown>).event}`);
          break;
        }
      }
    } catch (err: unknown) {
      console.error('[Twilio] Failed to parse WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[Twilio] WebSocket closed — streamSid: ${streamSid ?? 'unknown'}`);
    if (mixer) mixer.close();
    if (stereoSession) stereoSession.close().catch(() => {});
    if (callerSession) callerSession.close().catch(() => {});
    if (agentSession) agentSession.close().catch(() => {});
    if (callSid) onCallEnded(callSid);
    if (lcaClient) lcaClient.close().catch(() => {});
    if (streamSid) sessions.delete(streamSid);
  });

  ws.on('error', (err: Error) => {
    console.error(`[Twilio] WebSocket error — streamSid: ${streamSid ?? 'unknown'}:`, err);
  });
}
