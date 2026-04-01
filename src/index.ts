import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { handleTwilioConnection } from './twilioHandler.js';
import { generateAccessToken } from './twilioToken.js';
import type { TranscribeSession } from './transcribeSession.js';
import type { DashboardMessage } from './types/transcribe.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_URL = process.env.WS_URL || 'wss://localhost/ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const dashboardWss = new WebSocketServer({ noServer: true });
const sessions = new Map<string, TranscribeSession>();

// CORS for development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Twilio access token — returns a token for the browser-based agent softphone
app.get('/api/token', (_req, res) => {
  const token = generateAccessToken('agent');
  res.json({ token, identity: 'agent' });
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

// Voice webhook — Twilio calls this when an incoming call arrives.
// Starts a media stream (both tracks) and dials the browser-based agent.
app.post('/voice', (_req, res) => {
  const wsUrl = process.env.WS_URL || 'wss://localhost/ws';
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}" track="both_tracks" />
  </Start>
  <Dial>
    <Client>agent</Client>
  </Dial>
</Response>`);
});

// Session status API — returns active call sessions with rich metadata
app.get('/api/sessions', (_req, res) => {
  const sessionList = Array.from(sessions.values()).map(s => s.callInfo);
  res.json({ sessions: sessionList, count: sessionList.length });
});

// Transcript API — returns transcript segments for a specific call
app.get('/api/calls/:callSid/transcript', (req, res) => {
  const session = Array.from(sessions.values()).find(s => s.callSid === req.params.callSid);
  if (!session) { res.status(404).json({ error: 'Call not found' }); return; }
  res.json({ callSid: session.callSid, transcripts: session.transcripts });
});

// Serve React client (production build)
app.use(express.static(path.join(__dirname, '../client/dist')));

/** Broadcast a dashboard message to all connected dashboard WebSocket clients. */
function broadcastToDashboard(message: DashboardMessage): void {
  const payload = JSON.stringify(message);
  for (const client of dashboardWss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Dashboard WebSocket — send current calls list on connection
dashboardWss.on('connection', (ws) => {
  const calls = Array.from(sessions.values()).map(s => s.callInfo);
  ws.send(JSON.stringify({ type: 'calls.list', calls }));
});

// WebSocket upgrade handler
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/dashboard-ws') {
    dashboardWss.handleUpgrade(request, socket, head, (ws) => {
      dashboardWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle new Twilio WebSocket connections
wss.on('connection', (ws) => {
  handleTwilioConnection(ws, sessions,
    (callSid, segment) => broadcastToDashboard({ type: 'transcript', callSid, segment }),
    (call) => broadcastToDashboard({ type: 'call.started', call }),
    (callSid) => broadcastToDashboard({ type: 'call.ended', callSid }),
  );
});

// Export for testing
export { app, server, wss, dashboardWss, sessions };

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
    for (const [streamSid, session] of sessions) {
      session.close().catch(() => {});
      sessions.delete(streamSid);
    }
    wss.close();
    dashboardWss.close();
    server.close();
  });
}
