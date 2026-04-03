import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Set test env before importing server
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // random port
process.env.WS_URL = 'wss://test.example.com/ws';

import { app, server, wss, dashboardWss, sessions } from '../src/index';

let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  wss.close();
  dashboardWss.close();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('Server', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('POST /twiml returns XML with Stream element', async () => {
    const res = await fetch(`${baseUrl}/twiml`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/xml');
    const body = await res.text();
    expect(body).toContain('<Stream');
    expect(body).toContain('<Response>');
    expect(body).toContain('wss://test.example.com/ws');
  });

  it('GET /twiml returns 404', async () => {
    const res = await fetch(`${baseUrl}/twiml`);
    expect(res.status).toBe(404);
  });

  it('GET /api/sessions returns sessions list with count', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('sessions');
    expect(body).toHaveProperty('count');
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.count).toBe(0);
  });

  it('GET /api/calls/:callSid/transcript returns 404 for unknown call', async () => {
    const res = await fetch(`${baseUrl}/api/calls/UNKNOWN/transcript`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Call not found');
  });
});
