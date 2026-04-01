import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock the 'ws' module before importing LCAClient
vi.mock('ws', () => {
  return {
    default: vi.fn(),
    WebSocket: vi.fn(),
  };
});

import { LCAClient } from '../src/lcaClient';
import WebSocket from 'ws';

// Helper: create a fake WebSocket that's an EventEmitter with send/close
function createFakeWs() {
  const ws = new EventEmitter() as EventEmitter & {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    readyState: number;
  };
  ws.send = vi.fn();
  ws.close = vi.fn();
  ws.readyState = 1; // WebSocket.OPEN
  return ws;
}

describe('LCAClient', () => {
  let fakeWs: ReturnType<typeof createFakeWs>;
  let client: LCAClient;

  beforeEach(() => {
    fakeWs = createFakeWs();
    (WebSocket as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () { return fakeWs; });

    client = new LCAClient({
      lcaEndpoint: 'wss://test.cloudfront.net',
      organizationId: 'org-123',
      callSid: 'CA123',
      callerNumber: '+15551234567',
      calledNumber: '+15559876543',
    });
  });

  describe('connect()', () => {
    it('opens WebSocket to correct URL with session header', () => {
      const connectPromise = client.connect();
      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('wss://test.cloudfront.net/api/v1/audiohook/ws'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'audiohook-session-id': expect.any(String),
          }),
        })
      );
      fakeWs.emit('open');
      const openMsg = JSON.parse(fakeWs.send.mock.calls[0][0]);
      fakeWs.emit('message', JSON.stringify({
        version: '2', id: 'srv-1', type: 'opened', seq: 1,
        clientseq: openMsg.seq, parameters: {},
      }));
      return connectPromise;
    });

    it('sends open message with correct media parameters', async () => {
      const connectPromise = client.connect();
      fakeWs.emit('open');

      expect(fakeWs.send).toHaveBeenCalledTimes(1);
      const openMsg = JSON.parse(fakeWs.send.mock.calls[0][0]);
      expect(openMsg.type).toBe('open');
      expect(openMsg.version).toBe('2');
      expect(openMsg.parameters.media[0]).toEqual({
        type: 'audio', format: 'PCMU', channels: ['external'], rate: 8000,
      });
      expect(openMsg.parameters.organizationId).toBe('org-123');

      fakeWs.emit('message', JSON.stringify({
        version: '2', id: 'srv-1', type: 'opened', seq: 1,
        clientseq: openMsg.seq, parameters: {},
      }));
      await connectPromise;
    });

    it('rejects on WebSocket error', async () => {
      const connectPromise = client.connect();
      fakeWs.emit('error', new Error('Connection refused'));
      await expect(connectPromise).rejects.toThrow('Connection refused');
    });
  });

  describe('sendAudio()', () => {
    it('sends binary frame when ACTIVE', async () => {
      const connectPromise = client.connect();
      fakeWs.emit('open');
      const openMsg = JSON.parse(fakeWs.send.mock.calls[0][0]);
      fakeWs.emit('message', JSON.stringify({
        version: '2', id: 'srv-1', type: 'opened', seq: 1,
        clientseq: openMsg.seq, parameters: {},
      }));
      await connectPromise;

      const audioBuffer = Buffer.from([0x80, 0x7f, 0x01]);
      client.sendAudio(audioBuffer);

      expect(fakeWs.send).toHaveBeenCalledTimes(2);
      expect(fakeWs.send).toHaveBeenLastCalledWith(audioBuffer, { binary: true });
    });

    it('is a no-op before connection is active', () => {
      const audioBuffer = Buffer.from([0x80]);
      client.sendAudio(audioBuffer);
      expect(fakeWs.send).not.toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    it('sends close message and resolves on closed response', async () => {
      const connectPromise = client.connect();
      fakeWs.emit('open');
      const openMsg = JSON.parse(fakeWs.send.mock.calls[0][0]);
      fakeWs.emit('message', JSON.stringify({
        version: '2', id: 'srv-1', type: 'opened', seq: 1,
        clientseq: openMsg.seq, parameters: {},
      }));
      await connectPromise;

      const closePromise = client.close();

      const closeMsg = JSON.parse(fakeWs.send.mock.calls[fakeWs.send.mock.calls.length - 1][0]);
      expect(closeMsg.type).toBe('close');
      expect(closeMsg.parameters.reason).toBe('end');

      fakeWs.emit('message', JSON.stringify({
        version: '2', id: 'srv-2', type: 'closed', seq: 2,
        clientseq: closeMsg.seq, parameters: {},
      }));

      await closePromise;
    });
  });

  describe('server disconnect', () => {
    it('handles server disconnect message', async () => {
      const connectPromise = client.connect();
      fakeWs.emit('open');
      const openMsg = JSON.parse(fakeWs.send.mock.calls[0][0]);
      fakeWs.emit('message', JSON.stringify({
        version: '2', id: 'srv-1', type: 'opened', seq: 1,
        clientseq: openMsg.seq, parameters: {},
      }));
      await connectPromise;

      fakeWs.emit('message', JSON.stringify({
        version: '2', id: 'srv-3', type: 'disconnect', seq: 2,
        clientseq: 1, parameters: { reason: 'completed' },
      }));

      client.sendAudio(Buffer.from([0x80]));
      const binarySends = fakeWs.send.mock.calls.filter(
        (call: unknown[]) => call[1]?.binary === true
      );
      expect(binarySends).toHaveLength(0);
    });
  });
});
