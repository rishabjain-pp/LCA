// ─── AudioHook Protocol v2 Types ─────────────────────────────────────────────
// The LCA audiohook endpoint implements the Genesys AudioHook Protocol v2.
// Protocol flow: Client sends `open` → Server replies `opened` → Binary audio → `close`/`closed`
// Reference: lca-genesys-audiohook-stack/source/app/src/audiohook/message.ts
// ─────────────────────────────────────────────────────────────────────────────

export type MediaFormat = 'PCMU' | 'L16';
export type MediaChannel = 'external' | 'internal'; // external = caller, internal = agent
export type MediaRate = 8000;

export interface MediaParameter {
  type: 'audio';
  format: MediaFormat;
  channels: MediaChannel[];
  rate: MediaRate;
}

export interface Participant {
  id: string;
  ani: string;      // caller number
  aniName: string;   // caller display name
  dnis: string;      // called number
}

/** Base fields shared by all AudioHook messages */
interface MessageBase {
  version: '2';
  id: string;        // UUID for this message
  type: string;
  seq: number;       // incrementing sequence number
}

/** Messages sent from client to server */
interface ClientMessageBase extends MessageBase {
  serverseq: number; // last seq received from server
  position: string;  // stream position, e.g. "PT0S", "PT1.5S"
}

/** Messages sent from server to client */
interface ServerMessageBase extends MessageBase {
  clientseq: number; // last seq received from client
}

// ─── Client → Server Messages ────────────────────────────────────────────────

export interface OpenMessage extends ClientMessageBase {
  type: 'open';
  parameters: {
    organizationId: string;
    conversationId: string;
    participant: Participant;
    media: MediaParameter[];
  };
}

export interface CloseMessage extends ClientMessageBase {
  type: 'close';
  parameters: {
    reason: 'end' | 'error';
  };
}

export interface PingMessage extends ClientMessageBase {
  type: 'ping';
  parameters: Record<string, never>;
}

// ─── Server → Client Messages ────────────────────────────────────────────────

export interface OpenedMessage extends ServerMessageBase {
  type: 'opened';
  parameters: Record<string, unknown>;
}

export interface ClosedMessage extends ServerMessageBase {
  type: 'closed';
  parameters: Record<string, unknown>;
}

export interface PongMessage extends ServerMessageBase {
  type: 'pong';
  parameters: Record<string, unknown>;
}

export interface DisconnectMessage extends ServerMessageBase {
  type: 'disconnect';
  parameters: {
    reason: 'completed' | 'unauthorized' | 'error' | 'uri';
  };
}

/** All server message types */
export type ServerMessage = OpenedMessage | ClosedMessage | PongMessage | DisconnectMessage;

/** Session states for LCAClient state machine */
export type AudioHookSessionState =
  | 'CONNECTING'
  | 'OPENING'
  | 'ACTIVE'
  | 'CLOSING'
  | 'CLOSED'
  | 'ERROR';
