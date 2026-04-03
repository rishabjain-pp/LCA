// ─── Twilio Media Streams WebSocket Message Types ────────────────────────────
// Reference: https://www.twilio.com/docs/voice/media-streams/websocket-messages
// All types are discriminated on the `event` field.
// ─────────────────────────────────────────────────────────────────────────────

export interface TwilioConnectedMessage {
  event: 'connected';
  protocol: string;
  version: string;
}

export interface TwilioMediaFormat {
  encoding: 'audio/x-mulaw';
  sampleRate: 8000;
  channels: 1;
}

export interface TwilioStartMessage {
  event: 'start';
  sequenceNumber: string;
  streamSid: string;
  start: {
    accountSid: string;
    streamSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: TwilioMediaFormat;
    customParameters: Record<string, string>;
  };
}

export interface TwilioMediaMessage {
  event: 'media';
  sequenceNumber: string;
  streamSid: string;
  media: {
    track: 'inbound' | 'outbound';
    chunk: string;
    timestamp: string;
    payload: string; // Base64-encoded μ-law audio
  };
}

export interface TwilioStopMessage {
  event: 'stop';
  sequenceNumber: string;
  streamSid: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
}

/** Discriminated union of all Twilio WebSocket message types */
export type TwilioMessage =
  | TwilioConnectedMessage
  | TwilioStartMessage
  | TwilioMediaMessage
  | TwilioStopMessage;
