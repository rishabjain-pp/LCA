/**
 * JSON file-based call record store.
 * Persists all call records + transcripts to data/calls.json.
 * Simple file I/O — no database needed for demo.
 */

import fs from 'fs';
import path from 'path';
import type { TranscriptSegment, CallInfo } from './types/transcribe.js';

export interface SentimentSummary {
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  total: number;
}

export interface CallRecord {
  id: string;
  callSid: string;
  roomName: string;
  callerNumber: string;
  calledNumber: string;
  startTime: string;
  endTime: string | null;
  status: 'active' | 'ended';
  duration: number;
  transcripts: TranscriptSegment[];
  sentimentSummary: SentimentSummary;
  issueCount: number;
  agentName: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'calls.json');

export class CallStore {
  private calls: CallRecord[] = [];
  private saving = false;

  constructor() {
    this.load();
  }

  /** Load calls from JSON file */
  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        this.calls = JSON.parse(data) as CallRecord[];
        // Mark any previously "active" calls as ended (server restarted)
        for (const call of this.calls) {
          if (call.status === 'active') {
            call.status = 'ended';
            call.endTime = call.endTime ?? new Date().toISOString();
          }
        }
        this.save();
        console.log(`[CallStore] Loaded ${this.calls.length} call records`);
      } else {
        this.calls = [];
        this.save();
        console.log('[CallStore] Created new call store');
      }
    } catch (err) {
      console.error('[CallStore] Error loading calls:', err);
      this.calls = [];
    }
  }

  /** Save calls to JSON file (debounced) */
  private save(): void {
    if (this.saving) return;
    this.saving = true;
    setImmediate(() => {
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(this.calls, null, 2), 'utf-8');
      } catch (err) {
        console.error('[CallStore] Error saving calls:', err);
      }
      this.saving = false;
    });
  }

  /** Create a new call record */
  createCall(call: CallInfo): CallRecord {
    const record: CallRecord = {
      id: `CALL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      callSid: call.callSid,
      roomName: call.streamSid || call.callSid,
      callerNumber: call.callerNumber || 'Unknown',
      calledNumber: call.calledNumber || 'Acme Services',
      startTime: call.startTime || new Date().toISOString(),
      endTime: null,
      status: 'active',
      duration: 0,
      transcripts: [],
      sentimentSummary: { positive: 0, negative: 0, neutral: 0, mixed: 0, total: 0 },
      issueCount: 0,
      agentName: 'Orchestrator',
    };
    this.calls.push(record);
    this.save();
    console.log(`[CallStore] Call created: ${record.id} (${record.callerNumber})`);
    return record;
  }

  /** Add a transcript segment to a call */
  addTranscript(callSid: string, segment: TranscriptSegment): void {
    const call = this.calls.find(c => c.callSid === callSid);
    if (!call) return;

    // Replace partial with same resultId, or append
    if (!segment.isPartial) {
      const existingIdx = call.transcripts.findIndex(t => t.resultId === segment.resultId);
      if (existingIdx >= 0) {
        call.transcripts[existingIdx] = segment;
      } else {
        call.transcripts.push(segment);
      }

      // Update sentiment summary
      if (segment.sentiment) {
        const key = segment.sentiment.toLowerCase() as keyof SentimentSummary;
        if (key in call.sentimentSummary && key !== 'total') {
          (call.sentimentSummary[key] as number)++;
        }
        call.sentimentSummary.total++;
      }

      // Update issue count
      if (segment.issueDetected) {
        call.issueCount++;
      }
    }

    this.save();
  }

  /** Mark a call as ended */
  endCall(callSid: string): void {
    const call = this.calls.find(c => c.callSid === callSid);
    if (!call) return;

    call.status = 'ended';
    call.endTime = new Date().toISOString();
    call.duration = Math.round(
      (new Date(call.endTime).getTime() - new Date(call.startTime).getTime()) / 1000
    );
    this.save();
    console.log(`[CallStore] Call ended: ${call.id} (${call.duration}s, ${call.transcripts.length} segments)`);
  }

  /** Get all calls (newest first) */
  getAllCalls(): CallRecord[] {
    return [...this.calls].reverse();
  }

  /** Get a specific call by ID or callSid */
  getCall(id: string): CallRecord | undefined {
    return this.calls.find(c => c.id === id || c.callSid === id);
  }

  /** Get only active calls */
  getActiveCalls(): CallRecord[] {
    return this.calls.filter(c => c.status === 'active');
  }

  /** Get summary stats */
  getStats(): {
    totalCalls: number;
    activeCalls: number;
    avgDuration: number;
    totalTranscripts: number;
    sentimentOverall: SentimentSummary;
  } {
    const ended = this.calls.filter(c => c.status === 'ended');
    const avgDuration = ended.length > 0
      ? Math.round(ended.reduce((sum, c) => sum + c.duration, 0) / ended.length)
      : 0;

    const sentimentOverall: SentimentSummary = { positive: 0, negative: 0, neutral: 0, mixed: 0, total: 0 };
    for (const call of this.calls) {
      sentimentOverall.positive += call.sentimentSummary.positive;
      sentimentOverall.negative += call.sentimentSummary.negative;
      sentimentOverall.neutral += call.sentimentSummary.neutral;
      sentimentOverall.mixed += call.sentimentSummary.mixed;
      sentimentOverall.total += call.sentimentSummary.total;
    }

    return {
      totalCalls: this.calls.length,
      activeCalls: this.calls.filter(c => c.status === 'active').length,
      avgDuration,
      totalTranscripts: this.calls.reduce((sum, c) => sum + c.transcripts.length, 0),
      sentimentOverall,
    };
  }
}
