import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import type {
  AudioHookSessionState,
  OpenMessage,
  CloseMessage,
  ServerMessage,
} from './types/audiohook.js';

export interface LCAClientConfig {
  lcaEndpoint: string;
  organizationId: string;
  callSid: string;
  callerNumber: string;
  calledNumber: string;
}

export class LCAClient {
  private ws: WebSocket | null = null;
  private state: AudioHookSessionState = 'CLOSED';
  private clientSeq = 0;
  private serverSeq = 0;
  private sessionId: string;
  private positionMs = 0;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;
  private closeResolve: (() => void) | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private config: LCAClientConfig) {
    this.sessionId = randomUUID();
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.state = 'CONNECTING';

      const url = `${this.config.lcaEndpoint}/api/v1/audiohook/ws`;
      this.ws = new WebSocket(url, {
        headers: {
          'audiohook-session-id': this.sessionId,
        },
      });

      this.ws.on('open', () => {
        this.state = 'OPENING';
        this.sendOpenMessage();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (err: Error) => {
        this.state = 'ERROR';
        if (this.connectReject) {
          this.connectReject(err);
          this.connectResolve = null;
          this.connectReject = null;
        }
      });

      this.ws.on('close', () => {
        this.state = 'CLOSED';
      });
    });
  }

  sendAudio(buffer: Buffer): void {
    if (this.state !== 'ACTIVE' || !this.ws || this.ws.readyState !== 1) {
      return;
    }
    this.ws.send(buffer, { binary: true });
  }

  async close(): Promise<void> {
    if (this.state !== 'ACTIVE' || !this.ws) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.closeResolve = resolve;
      this.state = 'CLOSING';

      const seq = this.nextSeq();
      const closeMsg: CloseMessage = {
        version: '2',
        id: randomUUID(),
        type: 'close',
        seq,
        serverseq: this.serverSeq,
        position: this.formatPosition(),
        parameters: {
          reason: 'end',
        },
      };

      this.ws!.send(JSON.stringify(closeMsg));

      // 5 second timeout for close response
      this.closeTimer = setTimeout(() => {
        this.state = 'CLOSED';
        this.ws?.close();
        if (this.closeResolve) {
          this.closeResolve();
          this.closeResolve = null;
        }
      }, 5000);
    });
  }

  updatePosition(timestampMs: number): void {
    this.positionMs = timestampMs;
  }

  private formatPosition(): string {
    return `PT${(this.positionMs / 1000).toFixed(1)}S`;
  }

  private nextSeq(): number {
    return ++this.clientSeq;
  }

  private sendOpenMessage(): void {
    const seq = this.nextSeq();
    const openMsg: OpenMessage = {
      version: '2',
      id: randomUUID(),
      type: 'open',
      seq,
      serverseq: this.serverSeq,
      position: this.formatPosition(),
      parameters: {
        organizationId: this.config.organizationId,
        conversationId: this.config.callSid,
        participant: {
          id: this.config.callSid,
          ani: this.config.callerNumber,
          aniName: this.config.callerNumber,
          dnis: this.config.calledNumber,
        },
        media: [
          {
            type: 'audio',
            format: 'PCMU',
            channels: ['external'],
            rate: 8000,
          },
        ],
      },
    };

    this.ws!.send(JSON.stringify(openMsg));
  }

  private handleMessage(data: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(data) as ServerMessage;
    } catch {
      return;
    }

    this.serverSeq = message.seq;

    switch (message.type) {
      case 'opened':
        this.state = 'ACTIVE';
        if (this.connectResolve) {
          this.connectResolve();
          this.connectResolve = null;
          this.connectReject = null;
        }
        break;

      case 'closed':
        this.state = 'CLOSED';
        if (this.closeTimer) {
          clearTimeout(this.closeTimer);
          this.closeTimer = null;
        }
        if (this.closeResolve) {
          this.closeResolve();
          this.closeResolve = null;
        }
        this.ws?.close();
        break;

      case 'disconnect':
        this.state = 'CLOSED';
        this.ws?.close();
        break;

      case 'pong':
        // No-op for now; ping/pong keep-alive handled in future phases
        break;
    }
  }
}
