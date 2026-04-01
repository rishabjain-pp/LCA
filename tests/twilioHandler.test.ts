import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { handleTwilioConnection } from '../src/twilioHandler';
import type { TranscribeSession } from '../src/transcribeSession';
import type { TranscriptSegment, CallInfo } from '../src/types/transcribe';

// Mock TranscribeSession
vi.mock('../src/transcribeSession', () => ({
  TranscribeSession: vi.fn().mockImplementation(function (this: EventEmitter & Record<string, unknown>, config: Record<string, string>) {
    EventEmitter.call(this);
    Object.assign(this, EventEmitter.prototype);
    this.callSid = config.callSid;
    this.streamSid = config.streamSid;
    this.transcripts = [];
    this.callInfo = {
      callSid: config.callSid,
      streamSid: config.streamSid,
      callerNumber: config.callerNumber ?? '',
      calledNumber: config.calledNumber ?? '',
      startTime: new Date().toISOString(),
      status: 'active',
    } satisfies CallInfo;
    this.pushAudio = vi.fn();
    this.close = vi.fn().mockResolvedValue(undefined);
    this.on = EventEmitter.prototype.on;
    this.emit = EventEmitter.prototype.emit;
  }),
}));

// Mock audioConverter
vi.mock('../src/audioConverter', () => ({
  convertTwilioAudio: vi.fn().mockImplementation((buf: Buffer) => {
    // Return a predictable buffer: 4x input length (mulaw -> PCM16 16kHz)
    return Buffer.alloc(buf.length * 4, 0x42);
  }),
}));

// Mock lcaClient so the import doesn't fail
vi.mock('../src/lcaClient', () => ({
  LCAClient: vi.fn().mockImplementation(function () {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      updatePosition: vi.fn(),
    };
  }),
}));

import { convertTwilioAudio } from '../src/audioConverter';

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
  let sessions: Map<string, TranscribeSession>;
  let onTranscript: ReturnType<typeof vi.fn>;
  let onCallStarted: ReturnType<typeof vi.fn>;
  let onCallEnded: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeWs = createFakeTwilioWs();
    sessions = new Map();
    onTranscript = vi.fn();
    onCallStarted = vi.fn();
    onCallEnded = vi.fn();
  });

  function callHandler() {
    handleTwilioConnection(fakeWs as any, sessions, onTranscript, onCallStarted, onCallEnded);
  }

  function emitStart() {
    fakeWs.emit('message', JSON.stringify({
      event: 'start', sequenceNumber: '1', streamSid: 'MZ123',
      start: {
        accountSid: 'AC123', streamSid: 'MZ123', callSid: 'CA123',
        tracks: ['inbound'], mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        customParameters: {},
      },
    }));
  }

  it('handles connected event without error', () => {
    callHandler();
    fakeWs.emit('message', JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' }));
    expect(sessions.size).toBe(0);
  });

  it('creates TranscribeSession on start event and adds to sessions', () => {
    callHandler();
    emitStart();
    expect(sessions.has('MZ123')).toBe(true);
  });

  it('calls onCallStarted on start event', () => {
    callHandler();
    emitStart();
    expect(onCallStarted).toHaveBeenCalledTimes(1);
    const callInfo = onCallStarted.mock.calls[0][0] as CallInfo;
    expect(callInfo.callSid).toBe('CA123');
    expect(callInfo.streamSid).toBe('MZ123');
  });

  it('converts audio and calls pushAudio on media event', () => {
    callHandler();
    emitStart();

    const testPayload = Buffer.from([0x80, 0x7f, 0x01]).toString('base64');
    fakeWs.emit('message', JSON.stringify({
      event: 'media', sequenceNumber: '2', streamSid: 'MZ123',
      media: { track: 'inbound', chunk: '2', timestamp: '100', payload: testPayload },
    }));

    // convertTwilioAudio should have been called with the raw mulaw buffer
    expect(convertTwilioAudio).toHaveBeenCalledTimes(1);
    const rawArg = (convertTwilioAudio as ReturnType<typeof vi.fn>).mock.calls[0][0] as Buffer;
    expect(Buffer.compare(rawArg, Buffer.from([0x80, 0x7f, 0x01]))).toBe(0);

    // pushAudio should have been called with the converted PCM buffer
    const session = sessions.get('MZ123')! as unknown as { pushAudio: ReturnType<typeof vi.fn> };
    expect(session.pushAudio).toHaveBeenCalledTimes(1);
  });

  it('calls onCallEnded and cleans up on stop event', () => {
    callHandler();
    emitStart();

    fakeWs.emit('message', JSON.stringify({
      event: 'stop', sequenceNumber: '10', streamSid: 'MZ123',
      stop: { accountSid: 'AC123', callSid: 'CA123' },
    }));

    expect(onCallEnded).toHaveBeenCalledWith('CA123');
    expect(sessions.has('MZ123')).toBe(false);
  });

  it('does not crash on malformed JSON', () => {
    callHandler();
    expect(() => {
      fakeWs.emit('message', 'not valid json {{{');
    }).not.toThrow();
  });

  it('cleans up on WebSocket close without stop event', () => {
    callHandler();
    emitStart();

    fakeWs.emit('close');

    expect(onCallEnded).toHaveBeenCalledWith('CA123');
    expect(sessions.has('MZ123')).toBe(false);
  });
});
