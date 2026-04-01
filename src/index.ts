import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { handleTwilioConnection } from './twilioHandler.js';
import type { LCAClient } from './lcaClient.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_URL = process.env.WS_URL || 'wss://localhost/ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const sessions = new Map<string, LCAClient>();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// TwiML endpoint — Twilio calls this to get streaming instructions
app.post('/twiml', (_req, res) => {
  const wsUrl = process.env.WS_URL || 'wss://localhost/ws';
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}" />
  </Start>
  <Say>Call is being recorded and transcribed.</Say>
  <Pause length="3600" />
</Response>`);
});

// WebSocket upgrade handler
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle new Twilio WebSocket connections
wss.on('connection', (ws) => {
  handleTwilioConnection(ws, sessions);
});

// Export for testing
export { app, server, wss, sessions };

// Only start listening when run directly (not when imported by tests)
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`LCA Relay Server listening on port ${PORT}`);
    console.log(`WebSocket endpoint: ${WS_URL}`);
    console.log(`TwiML endpoint: POST http://localhost:${PORT}/twiml`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    for (const [streamSid, client] of sessions) {
      client.close().catch(() => {});
      sessions.delete(streamSid);
    }
    wss.close();
    server.close();
  });
}
