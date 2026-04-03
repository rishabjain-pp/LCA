// Dashboard WebSocket protocol types for real-time transcription events

export interface TranscriptSegment {
  resultId: string;
  channel: 'CALLER' | 'AGENT';
  text: string;
  isPartial: boolean;
  startTime: number;   // seconds from start of call
  endTime: number;
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  issueDetected?: boolean;
}

export interface CallInfo {
  callSid: string;
  streamSid: string;
  callerNumber: string;
  calledNumber: string;
  startTime: string;       // ISO 8601
  status: 'active' | 'ended';
}

/** Discriminated union of dashboard WebSocket messages */
export type DashboardMessage =
  | { type: 'call.started'; call: CallInfo }
  | { type: 'call.ended'; callSid: string }
  | { type: 'transcript'; callSid: string; segment: TranscriptSegment }
  | { type: 'calls.list'; calls: CallInfo[] };
