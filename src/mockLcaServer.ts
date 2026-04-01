import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const PORT = parseInt(process.env.MOCK_LCA_PORT || '8081', 10);

const wss = new WebSocketServer({ port: PORT });

console.log(`[Mock LCA] AudioHook server listening on ws://localhost:${PORT}`);
console.log(`[Mock LCA] Set LCA_ENDPOINT=ws://localhost:${PORT} in .env to use`);

let serverSeq = 0;

wss.on('connection', (ws: WebSocket, req: import('http').IncomingMessage) => {
  const sessionId = req.headers['audiohook-session-id'] || 'unknown';
  console.log(`[Mock LCA] New connection — session: ${sessionId}`);

  let audioPackets = 0;
  let totalBytes = 0;
  serverSeq = 0;

  ws.on('message', (data: Buffer | string, isBinary: boolean) => {
    if (isBinary) {
      // Binary = audio data
      const buffer = data as Buffer;
      audioPackets++;
      totalBytes += buffer.length;

      if (audioPackets % 50 === 0) {
        const durationSec = (totalBytes / 8000).toFixed(1);
        console.log(`[Mock LCA] Audio: ${audioPackets} packets, ${totalBytes} bytes, ~${durationSec}s`);
      }
    } else {
      // Text = JSON control message
      try {
        const msg = JSON.parse(data.toString()) as {
          type: string;
          seq: number;
          version?: string;
          parameters?: Record<string, unknown>;
        };

        switch (msg.type) {
          case 'open': {
            const params = msg.parameters as {
              organizationId?: string;
              conversationId?: string;
              media?: unknown;
            } | undefined;
            console.log(`[Mock LCA] Open — org: ${params?.organizationId}, call: ${params?.conversationId}`);
            console.log(`[Mock LCA] Media: ${JSON.stringify(params?.media)}`);

            const response = {
              version: '2',
              id: randomUUID(),
              type: 'opened',
              seq: ++serverSeq,
              clientseq: msg.seq,
              parameters: {},
            };
            ws.send(JSON.stringify(response));
            console.log(`[Mock LCA] Sent 'opened' response`);
            break;
          }

          case 'close': {
            const params = msg.parameters as { reason?: string } | undefined;
            console.log(`[Mock LCA] Close requested — reason: ${params?.reason}`);

            const response = {
              version: '2',
              id: randomUUID(),
              type: 'closed',
              seq: ++serverSeq,
              clientseq: msg.seq,
              parameters: {},
            };
            ws.send(JSON.stringify(response));

            const duration = (totalBytes / 8000).toFixed(1);
            console.log(`[Mock LCA] Session ended — audio: ~${duration}s, packets: ${audioPackets}, bytes: ${totalBytes}`);
            break;
          }

          case 'ping': {
            const response = {
              version: '2',
              id: randomUUID(),
              type: 'pong',
              seq: ++serverSeq,
              clientseq: msg.seq,
              parameters: {},
            };
            ws.send(JSON.stringify(response));
            break;
          }

          default:
            console.log(`[Mock LCA] Unknown message type: ${msg.type}`);
        }
      } catch (err) {
        console.error('[Mock LCA] Failed to parse message:', err);
      }
    }
  });

  ws.on('close', () => {
    if (audioPackets > 0) {
      const duration = (totalBytes / 8000).toFixed(1);
      console.log(`[Mock LCA] Connection closed — audio: ~${duration}s, packets: ${audioPackets}, bytes: ${totalBytes}`);
    } else {
      console.log(`[Mock LCA] Connection closed (no audio received)`);
    }
  });

  ws.on('error', (err: Error) => {
    console.error(`[Mock LCA] WebSocket error:`, err);
  });
});
