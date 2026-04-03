import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActiveCall, TranscriptLine } from '../types';

interface LcaCallInfo {
  callSid: string;
  streamSid: string;
  callerNumber: string;
  calledNumber: string;
  customerName?: string;
  customerNumber?: string;
  startTime: string;
  status: 'active' | 'ended';
}

interface LcaTranscriptSegment {
  resultId: string;
  channel: 'CALLER' | 'AGENT';
  text: string;
  isPartial: boolean;
  startTime: number;
  endTime: number;
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  issueDetected?: boolean;
}

type LcaDashboardMessage =
  | { type: 'calls.list'; calls: LcaCallInfo[] }
  | { type: 'call.started'; call: LcaCallInfo }
  | { type: 'call.ended'; callSid: string }
  | { type: 'transcript'; callSid: string; segment: LcaTranscriptSegment };

function adaptSentiment(s?: string): 'positive' | 'neutral' | 'negative' | 'frustrated' {
  if (!s) return 'neutral';
  const map: Record<string, 'positive' | 'neutral' | 'negative' | 'frustrated'> = {
    POSITIVE: 'positive', NEUTRAL: 'neutral', NEGATIVE: 'negative', MIXED: 'frustrated',
  };
  return map[s] ?? 'neutral';
}

function extractNumber(sid: string, fallback: string): string {
  const match = sid.match(/_\+?(\d{10,15})_/);
  return match ? `+${match[1]}` : fallback;
}

function callInfoToActiveCall(call: LcaCallInfo): ActiveCall {
  const num = extractNumber(call.callSid, call.customerNumber || call.callerNumber || 'External');
  return {
    id: call.callSid,
    callId: call.callSid.slice(0, 12),
    callSid: call.callSid,
    duration: '00:00',
    durationSeconds: 0,
    category: 'support',
    subCategory: 'Account Management',
    agentName: 'AI Agent',
    agentId: 'ai1',
    customerName: call.customerName || 'Caller',
    customerNumber: num,
    customerId: call.callSid.slice(0, 8),
    priority: 'normal',
    sentiment: 'neutral',
    sentimentScore: 50,
    startTime: new Date(call.startTime).toLocaleTimeString(),
    status: call.status === 'active' ? 'active' : 'completed',
    issues: [],
    transcript: [],
    aiSummary: '',
    tags: [],
    isOnHold: false,
    isMuted: false,
  };
}

function segmentToTranscriptLine(seg: LcaTranscriptSegment): TranscriptLine {
  return {
    id: seg.resultId,
    speaker: seg.channel === 'AGENT' ? 'agent' : 'customer',
    speakerName: seg.channel === 'AGENT' ? 'AI Agent' : 'Caller',
    text: seg.text,
    timestamp: `${Math.floor(seg.startTime / 60).toString().padStart(2, '0')}:${Math.floor(seg.startTime % 60).toString().padStart(2, '0')}`,
    sentiment: adaptSentiment(seg.sentiment),
    keywords: [],
    issueDetected: seg.issueDetected,
  };
}

interface UseLcaDataReturn {
  activeCalls: ActiveCall[];
  transcripts: Map<string, TranscriptLine[]>;
  connected: boolean;
  loading: boolean;
}

export function useLcaData(): UseLcaDataReturn {
  const [calls, setCalls] = useState<Map<string, ActiveCall>>(new Map());
  const [transcripts, setTranscripts] = useState<Map<string, TranscriptLine[]>>(new Map());
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const durationsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const startDurationTimer = useCallback((callSid: string, startTime: string) => {
    const start = new Date(startTime).getTime();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      setCalls(prev => {
        const next = new Map(prev);
        const call = next.get(callSid);
        if (call) next.set(callSid, { ...call, duration: `${m}:${s}`, durationSeconds: elapsed });
        return next;
      });
    }, 1000);
    durationsRef.current.set(callSid, timer);
  }, []);

  const stopDurationTimer = useCallback((callSid: string) => {
    const timer = durationsRef.current.get(callSid);
    if (timer) { clearInterval(timer); durationsRef.current.delete(callSid); }
  }, []);

  const connect = useCallback(() => {
    const wsBase = (import.meta as { env?: { VITE_WS_BASE?: string } }).env?.VITE_WS_BASE;
    const wsUrl = wsBase
      ? `${wsBase}/dashboard-ws`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/dashboard-ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); setLoading(false); };
    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = window.setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as LcaDashboardMessage;
      switch (msg.type) {
        case 'calls.list':
          setCalls(new Map(msg.calls.map(c => [c.callSid, callInfoToActiveCall(c)])));
          msg.calls.filter(c => c.status === 'active').forEach(c => startDurationTimer(c.callSid, c.startTime));
          setLoading(false);
          break;
        case 'call.started':
          setCalls(prev => new Map(prev).set(msg.call.callSid, callInfoToActiveCall(msg.call)));
          startDurationTimer(msg.call.callSid, msg.call.startTime);
          break;
        case 'call.ended':
          stopDurationTimer(msg.callSid);
          setCalls(prev => {
            const next = new Map(prev);
            const call = next.get(msg.callSid);
            if (call) next.set(msg.callSid, { ...call, status: 'completed' });
            return next;
          });
          break;
        case 'transcript': {
          if (msg.segment.isPartial) break;
          const line = segmentToTranscriptLine(msg.segment);
          setTranscripts(prev => {
            const next = new Map(prev);
            const segs = [...(next.get(msg.callSid) || [])];
            const idx = segs.findIndex(s => s.id === msg.segment.resultId);
            if (idx >= 0) segs[idx] = line; else segs.push(line);
            next.set(msg.callSid, segs);
            return next;
          });
          if (msg.segment.sentiment) {
            const sentiment = adaptSentiment(msg.segment.sentiment);
            setCalls(prev => {
              const next = new Map(prev);
              const call = next.get(msg.callSid);
              if (call) next.set(msg.callSid, { ...call, sentiment });
              return next;
            });
          }
          break;
        }
      }
    };
  }, [startDurationTimer, stopDurationTimer]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      durationsRef.current.forEach(t => clearInterval(t));
    };
  }, [connect]);

  return {
    activeCalls: Array.from(calls.values()),
    transcripts,
    connected,
    loading,
  };
}
