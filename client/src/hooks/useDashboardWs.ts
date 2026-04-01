import { useState, useEffect, useRef, useCallback } from 'react';
import type { CallInfo, TranscriptSegment, DashboardMessage } from '../types';

interface UseDashboardWsReturn {
  calls: Map<string, CallInfo>;
  transcripts: Map<string, TranscriptSegment[]>;
  connected: boolean;
}

export function useDashboardWs(): UseDashboardWsReturn {
  const [calls, setCalls] = useState<Map<string, CallInfo>>(new Map());
  const [transcripts, setTranscripts] = useState<Map<string, TranscriptSegment[]>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/dashboard-ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      const msg: DashboardMessage = JSON.parse(event.data as string);
      switch (msg.type) {
        case 'calls.list':
          setCalls(new Map(msg.calls.map(c => [c.callSid, c])));
          break;
        case 'call.started':
          setCalls(prev => new Map(prev).set(msg.call.callSid, msg.call));
          break;
        case 'call.ended':
          setCalls(prev => {
            const next = new Map(prev);
            const call = next.get(msg.callSid);
            if (call) next.set(msg.callSid, { ...call, status: 'ended' });
            return next;
          });
          break;
        case 'transcript':
          setTranscripts(prev => {
            const next = new Map(prev);
            const segments = [...(next.get(msg.callSid) || [])];
            const existingIdx = segments.findIndex(s => s.resultId === msg.segment.resultId);
            if (existingIdx >= 0) {
              segments[existingIdx] = msg.segment;
            } else {
              segments.push(msg.segment);
            }
            next.set(msg.callSid, segments);
            return next;
          });
          break;
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { calls, transcripts, connected };
}
