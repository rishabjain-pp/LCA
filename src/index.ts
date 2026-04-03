import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { handleTwilioConnection } from './twilioHandler.js';
import { generateAccessToken } from './twilioToken.js';
import { CallStore } from './callStore.js';
import type { TranscribeSession } from './transcribeSession.js';
import type { DashboardMessage } from './types/transcribe.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_URL = process.env.WS_URL || 'wss://localhost/ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const dashboardWss = new WebSocketServer({ noServer: true });
const sessions = new Map<string, TranscribeSession>();
const callStore = new CallStore();

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

// Twilio access token
app.get('/api/token', (_req, res) => {
  const token = generateAccessToken('agent');
  res.json({ token, identity: 'agent' });
});

// TwiML endpoint — legacy
app.post('/twiml', (_req, res) => {
  const wsUrl = process.env.WS_URL || 'wss://localhost/ws';
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}" track="both_tracks" />
  </Start>
  <Say>Call is being recorded and transcribed.</Say>
  <Pause length="3600" />
</Response>`);
});

// Parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Voice webhook — Twilio calls this when an incoming call arrives.
app.post('/voice', (req, res) => {
  const wsUrl = process.env.WS_URL || 'wss://localhost/ws';
  const from = (req.body?.From as string) || '';
  const to = (req.body?.To as string) || '';
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}" track="both_tracks">
      <Parameter name="callerNumber" value="${from}" />
      <Parameter name="calledNumber" value="${to}" />
    </Stream>
  </Start>
  <Dial>
    <Client>agent</Client>
  </Dial>
</Response>`);
});

// ─── Call Records API ────────────────────────────────────────────────────────

// Get all calls (newest first)
app.get('/api/calls', (_req, res) => {
  res.json({ calls: callStore.getAllCalls() });
});

// Get call stats
app.get('/api/stats', (_req, res) => {
  res.json(callStore.getStats());
});

// Get active calls only
app.get('/api/calls/active', (_req, res) => {
  res.json({ calls: callStore.getActiveCalls() });
});

// Get a specific call by ID or callSid
app.get('/api/calls/:id', (req, res) => {
  const call = callStore.getCall(req.params.id);
  if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
  res.json(call);
});

// Get transcript for a specific call (legacy compatibility)
app.get('/api/calls/:callSid/transcript', (req, res) => {
  const call = callStore.getCall(req.params.callSid);
  if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
  res.json({ callSid: call.callSid, transcripts: call.transcripts });
});

// Session status API (legacy — returns active TranscribeSessions)
app.get('/api/sessions', (_req, res) => {
  const sessionList = Array.from(sessions.values()).map(s => s.callInfo);
  res.json({ sessions: sessionList, count: sessionList.length });
});

// Agent transcript API — receives events from the Python LiveKit agent
// Broadcasts to dashboard AND persists to JSON store
app.post('/api/agent-transcript', (req, res) => {
  const msg = req.body as DashboardMessage;
  if (!msg || !msg.type) {
    res.status(400).json({ error: 'Invalid message' });
    return;
  }

  // Broadcast to live dashboard clients
  broadcastToDashboard(msg);

  // Persist to JSON store
  switch (msg.type) {
    case 'call.started':
      callStore.createCall(msg.call);
      break;
    case 'transcript':
      callStore.addTranscript(msg.callSid, msg.segment);
      break;
    case 'call.ended':
      callStore.endCall(msg.callSid);
      break;
  }

  res.json({ ok: true });
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

// Dashboard WebSocket — send full call history on connection
dashboardWss.on('connection', (ws) => {
  // Send all historical calls (not just active sessions)
  const allCalls = callStore.getAllCalls();
  const callInfos = allCalls.map(c => ({
    callSid: c.callSid,
    streamSid: c.roomName,
    callerNumber: c.callerNumber,
    calledNumber: c.calledNumber,
    startTime: c.startTime,
    status: c.status,
  }));
  ws.send(JSON.stringify({ type: 'calls.list', calls: callInfos }));

  // Also send transcripts for recent calls (last 5)
  for (const call of allCalls.slice(0, 5)) {
    for (const segment of call.transcripts) {
      ws.send(JSON.stringify({ type: 'transcript', callSid: call.callSid, segment }));
    }
  }
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
export { app, server, wss, dashboardWss, sessions, callStore };

// Only start listening when run directly
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`LCA Relay Server listening on port ${PORT}`);
    console.log(`WebSocket endpoint: ${WS_URL}`);
    console.log(`Call store: ${callStore.getAllCalls().length} records loaded`);
  });

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
