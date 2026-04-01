import { describe, it, expect } from 'vitest';
import type { TwilioMessage } from '../src/types/twilio';
import type { OpenMessage, OpenedMessage, AudioHookSessionState } from '../src/types/audiohook';

describe('Twilio types', () => {
  it('narrows connected event', () => {
    const msg: TwilioMessage = { event: 'connected', protocol: 'Call', version: '1.0.0' };
    if (msg.event === 'connected') {
      expect(msg.protocol).toBe('Call');
    }
  });

  it('narrows start event with all required fields', () => {
    const msg: TwilioMessage = {
      event: 'start',
      sequenceNumber: '1',
      streamSid: 'MZ123',
      start: {
        accountSid: 'AC123',
        streamSid: 'MZ123',
        callSid: 'CA123',
        tracks: ['inbound'],
        mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        customParameters: {},
      },
    };
    if (msg.event === 'start') {
      expect(msg.start.callSid).toBe('CA123');
      expect(msg.start.mediaFormat.sampleRate).toBe(8000);
    }
  });

  it('narrows media event with payload', () => {
    const msg: TwilioMessage = {
      event: 'media',
      sequenceNumber: '5',
      streamSid: 'MZ123',
      media: { track: 'inbound', chunk: '5', timestamp: '100', payload: 'dGVzdA==' },
    };
    if (msg.event === 'media') {
      expect(msg.media.payload).toBe('dGVzdA==');
      expect(msg.media.track).toBe('inbound');
    }
  });

  it('narrows stop event', () => {
    const msg: TwilioMessage = {
      event: 'stop',
      sequenceNumber: '10',
      streamSid: 'MZ123',
      stop: { accountSid: 'AC123', callSid: 'CA123' },
    };
    if (msg.event === 'stop') {
      expect(msg.stop.callSid).toBe('CA123');
    }
  });
});

describe('AudioHook types', () => {
  it('creates valid open message', () => {
    const msg: OpenMessage = {
      version: '2',
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'open',
      seq: 1,
      serverseq: 0,
      position: 'PT0S',
      parameters: {
        organizationId: 'org-123',
        conversationId: 'conv-456',
        participant: { id: 'p-1', ani: '+15551234567', aniName: 'Caller', dnis: '+15559876543' },
        media: [{ type: 'audio', format: 'PCMU', channels: ['external'], rate: 8000 }],
      },
    };
    expect(msg.type).toBe('open');
    expect(msg.parameters.media[0].format).toBe('PCMU');
  });

  it('creates valid opened response', () => {
    const msg: OpenedMessage = {
      version: '2',
      id: '660e8400-e29b-41d4-a716-446655440000',
      type: 'opened',
      seq: 1,
      clientseq: 1,
      parameters: {},
    };
    expect(msg.type).toBe('opened');
  });

  it('tracks session state', () => {
    const state: AudioHookSessionState = 'ACTIVE';
    expect(state).toBe('ACTIVE');
  });
});
