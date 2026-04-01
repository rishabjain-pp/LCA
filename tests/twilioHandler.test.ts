import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { handleTwilioConnection } from '../src/twilioHandler';
import type { LCAClient } from '../src/lcaClient';

// Mock LCAClient
vi.mock('../src/lcaClient', () => ({
  LCAClient: vi.fn().mockImplementation(function() {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      updatePosition: vi.fn(),
    };
  }),
}));

function createFakeTwilioWs() {
  const ws = new EventEmitter() as EventEmitter & {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  ws.send = vi.fn();
  ws.close = vi.fn();
  return ws;
}

describe('twilioHandler', () => {
  let fakeWs: ReturnType<typeof createFakeTwilioWs>;
  let sessions: Map<string, LCAClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeWs = createFakeTwilioWs();
    sessions = new Map();
  });

  it('handles connected event without error', () => {
    handleTwilioConnection(fakeWs as any, sessions);
    fakeWs.emit('message', JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' }));
    expect(sessions.size).toBe(0);
  });

  it('creates LCAClient on start event and adds to sessions', () => {
    handleTwilioConnection(fakeWs as any, sessions);
    fakeWs.emit('message', JSON.stringify({
      event: 'start', sequenceNumber: '1', streamSid: 'MZ123',
      start: {
        accountSid: 'AC123', streamSid: 'MZ123', callSid: 'CA123',
        tracks: ['inbound'], mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        customParameters: {},
      },
    }));
    expect(sessions.has('MZ123')).toBe(true);
  });

  it('decodes Base64 audio on media event and forwards to LCAClient', () => {
    handleTwilioConnection(fakeWs as any, sessions);
    fakeWs.emit('message', JSON.stringify({
      event: 'start', sequenceNumber: '1', streamSid: 'MZ123',
      start: {
        accountSid: 'AC123', streamSid: 'MZ123', callSid: 'CA123',
        tracks: ['inbound'], mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        customParameters: {},
      },
    }));

    const testPayload = Buffer.from([0x80, 0x7f, 0x01]).toString('base64');
    fakeWs.emit('message', JSON.stringify({
      event: 'media', sequenceNumber: '2', streamSid: 'MZ123',
      media: { track: 'inbound', chunk: '2', timestamp: '100', payload: testPayload },
    }));

    const client = sessions.get('MZ123')!;
    expect(client.sendAudio).toHaveBeenCalledTimes(1);
    const sentBuffer = (client.sendAudio as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(Buffer.compare(sentBuffer, Buffer.from([0x80, 0x7f, 0x01]))).toBe(0);
  });

  it('cleans up on stop event', () => {
    handleTwilioConnection(fakeWs as any, sessions);
    fakeWs.emit('message', JSON.stringify({
      event: 'start', sequenceNumber: '1', streamSid: 'MZ123',
      start: {
        accountSid: 'AC123', streamSid: 'MZ123', callSid: 'CA123',
        tracks: ['inbound'], mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        customParameters: {},
      },
    }));

    fakeWs.emit('message', JSON.stringify({
      event: 'stop', sequenceNumber: '10', streamSid: 'MZ123',
      stop: { accountSid: 'AC123', callSid: 'CA123' },
    }));
  });

  it('does not crash on malformed JSON', () => {
    handleTwilioConnection(fakeWs as any, sessions);
    expect(() => {
      fakeWs.emit('message', 'not valid json {{{');
    }).not.toThrow();
  });

  it('cleans up on WebSocket close without stop event', () => {
    handleTwilioConnection(fakeWs as any, sessions);
    fakeWs.emit('message', JSON.stringify({
      event: 'start', sequenceNumber: '1', streamSid: 'MZ123',
      start: {
        accountSid: 'AC123', streamSid: 'MZ123', callSid: 'CA123',
        tracks: ['inbound'], mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        customParameters: {},
      },
    }));

    fakeWs.emit('close');
  });
});
