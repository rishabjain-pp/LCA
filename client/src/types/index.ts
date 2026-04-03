export type SentimentLevel = 'positive' | 'neutral' | 'negative' | 'frustrated';
export type CallPriority = 'critical' | 'high' | 'medium' | 'normal';
export type CallCategory = 'support' | 'billing' | 'technical' | 'outbound' | 'general';
export type AgentStatus = 'available' | 'on-call' | 'break' | 'offline';
export type CallStatus = 'active' | 'hold' | 'transferred' | 'completed';

export interface TranscriptLine {
  id: string;
  speaker: 'agent' | 'customer';
  speakerName: string;
  text: string;
  timestamp: string;
  sentiment: SentimentLevel;
  keywords?: string[];
  issueDetected?: boolean;
}

export interface CallSummary {
  id: string;
  callId: string;
  callSid?: string;
  duration: string; // e.g. "08:42"
  durationSeconds: number;
  category: CallCategory;
  subCategory: string;
  agentName: string;
  agentId: string;
  agentAvatar?: string;
  customerName: string;
  customerNumber: string;
  customerId: string;
  priority: CallPriority;
  sentiment: SentimentLevel;
  sentimentScore: number; // 0-100
  startTime: string;
  endTime?: string;
  status: CallStatus;
  issues: string[];
  resolution?: string;
  transcript: TranscriptLine[];
  aiSummary: string;
  npsScore?: number;
  tags: string[];
}

export interface ActiveCall extends CallSummary {
  callSid?: string;
  waitTime?: string;
  queuePosition?: number;
  isOnHold: boolean;
  isMuted: boolean;
  supervisorListening?: boolean;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  description: string;
  relevanceScore: number;
  category: string;
  tags: string[];
  url?: string;
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: number;
  change: number; // percentage
  changeDirection: 'up' | 'down';
  category: CallCategory;
  icon: string;
  color: string;
  subMetrics?: { label: string; value: number; category: string }[];
}

export interface ChartDataPoint {
  time: string;
  inbound: number;
  outbound: number;
  resolved: number;
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  frustrated: number;
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  status: AgentStatus;
  role: string;
  extension: string;
  currentCallId?: string;
  callsHandledToday: number;
  avgHandleTime: string;
}

export interface IncomingCall {
  callId: string;
  callerNumber: string;
  callerName?: string;
  category: CallCategory;
  queueTime: string;
  priority: CallPriority;
}

export interface SubCategoryData {
  id: string;
  name: string;
  count: number;
  resolved: number;
  avgDuration: string;
  calls: CallSummary[];
}

export interface CategoryData {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  totalCount: number;
  resolved: number;
  subCategories: SubCategoryData[];
}
