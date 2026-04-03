import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import TopBar from '../components/TopBar';
import { dashboardMetrics, mockCallSummaries, categoryTree } from '../data/mockData';
import type { CallSummary, DashboardMetric, CategoryData, SubCategoryData } from '../types';

// ─── Sentiment Config ─────────────────────────────────────────────────────────
const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-on-tertiary-container', neutral: 'text-on-surface-variant',
  negative: 'text-error', frustrated: 'text-secondary',
};
const SENTIMENT_EMOJI: Record<string, string> = {
  positive: '😊', neutral: '😐', negative: '😟', frustrated: '😠',
};

// ─── Call Detail Modal ────────────────────────────────────────────────────────
function CallDetailModal({ call, onClose }: { call: CallSummary; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-3xl shadow-ambient w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]">call</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-primary">{call.customerName}</h3>
              <p className="text-xs text-on-surface-variant">{call.customerNumber} · {call.duration} duration · {call.subCategory}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Key Stats Row */}
          <div className="grid grid-cols-4 gap-px bg-surface-container">
            {[
              { label: 'Customer', value: call.customerName },
              { label: 'Agent', value: call.agentName },
              { label: 'Duration', value: call.duration },
              { label: 'Sentiment', value: `${SENTIMENT_EMOJI[call.sentiment]} ${call.sentiment}` },
            ].map(m => (
              <div key={m.label} className="bg-surface-container-lowest px-6 py-4">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">{m.label}</p>
                <p className={`text-sm font-bold font-headline capitalize ${m.label === 'Sentiment' ? SENTIMENT_COLOR[call.sentiment] : 'text-primary'}`}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="p-8 space-y-6">
            {/* AI Summary */}
            <div className="bg-primary/5 rounded-2xl p-5 border-l-4 border-primary">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-[20px]">psychology</span>
                <h4 className="font-headline font-bold text-sm text-primary uppercase tracking-wider">AI Call Summary</h4>
              </div>
              <p className="text-sm text-on-surface leading-relaxed">{call.aiSummary}</p>
            </div>

            {/* Issues & Resolution */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-error-container/30 rounded-2xl p-5">
                <h4 className="font-headline font-bold text-sm text-on-error-container uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span> Issues Detected
                </h4>
                <ul className="space-y-2">
                  {call.issues.map(issue => (
                    <li key={issue} className="flex items-center gap-2 text-sm text-on-surface">
                      <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0"></span>{issue}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-tertiary/5 rounded-2xl p-5">
                <h4 className="font-headline font-bold text-sm text-on-tertiary-fixed-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span> Resolution
                </h4>
                <p className="text-sm text-on-surface leading-relaxed">{call.resolution || 'Pending.'}</p>
                {call.npsScore && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">NPS</span>
                    <span className="text-lg font-black text-primary font-headline">{call.npsScore}</span>
                    <span className="material-symbols-outlined text-secondary text-sm material-symbols-filled">star</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {call.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[11px] font-bold rounded-full uppercase tracking-wider">#{tag}</span>
              ))}
            </div>

            {/* Transcript */}
            <div>
              <h4 className="font-headline font-bold text-sm text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">forum</span> Call Transcript
              </h4>
              <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin pr-2">
                {call.transcript.map(line => (
                  <div key={line.id} className={`flex flex-col ${line.speaker === 'agent' ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">{line.speakerName}</span>
                      <span className="text-[9px] text-outline">{line.timestamp}</span>
                      <span className={`text-[9px] font-bold capitalize ${SENTIMENT_COLOR[line.sentiment]}`}>{SENTIMENT_EMOJI[line.sentiment]}</span>
                    </div>
                    <div className={line.speaker === 'agent' 
                      ? 'max-w-[85%] p-3 bg-primary text-white rounded-tl-xl rounded-br-xl rounded-bl-xl text-xs leading-relaxed shadow-sm' 
                      : `max-w-[85%] p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl text-xs leading-relaxed bg-surface-container-low text-on-surface border-l-[12px] ${
                          line.issueDetected || line.sentiment === 'negative' || line.sentiment === 'frustrated'
                            ? 'border-error/40 border-l-error shadow-[0_4px_15px_-5px_rgba(186,26,26,0.3)]'
                            : line.sentiment === 'positive'
                            ? 'border-tertiary-fixed/40 border-l-tertiary-fixed shadow-[0_4px_15px_-5px_rgba(78,190,66,0.3)]'
                            : 'border-primary-container/30 border-l-primary-container shadow-[0_4px_15px_-5px_rgba(0,35,148,0.1)]'
                        } border`
                    }>{line.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-category Call List Modal ─────────────────────────────────────────────
function SubCategoryCallsModal({
  category,
  subCategory,
  onSelectCall,
  onClose,
}: {
  category: CategoryData;
  subCategory: SubCategoryData;
  onSelectCall: (call: CallSummary) => void;
  onClose: () => void;
}) {
  const resolvedPct = Math.round((subCategory.resolved / subCategory.count) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-3xl shadow-ambient w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${category.bgColor}20` }}>
              <span className="material-symbols-outlined text-[22px]" style={{ color: category.bgColor }}>{category.icon}</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-primary">{subCategory.name}</h3>
              <p className="text-xs text-on-surface-variant">{category.name} · {subCategory.count} contacts · {resolvedPct}% resolved</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-px bg-surface-container-low border-b border-surface-container">
          {[
            { label: 'Total Contacts', value: subCategory.count, icon: 'call' },
            { label: 'Resolved', value: subCategory.resolved, icon: 'check_circle' },
            { label: 'Pending', value: subCategory.count - subCategory.resolved, icon: 'schedule' },
            { label: 'Avg Duration', value: subCategory.avgDuration, icon: 'timer' },
          ].map(s => (
            <div key={s.label} className="bg-surface-container-lowest px-5 py-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]" style={{ color: category.bgColor }}>{s.icon}</span>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{s.label}</p>
                <p className="text-lg font-black font-headline" style={{ color: category.bgColor }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Resolution bar */}
        <div className="px-8 py-3 bg-surface-container-low border-b border-surface-container flex items-center gap-3">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest w-24">Resolution</span>
          <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-on-tertiary-container transition-all" style={{ width: `${resolvedPct}%` }} />
          </div>
          <span className="text-sm font-bold text-on-tertiary-container">{resolvedPct}%</span>
        </div>

        {/* Call list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-8 py-4">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
              Contact Records — click to view full details & transcript
            </p>
            <div className="space-y-2">
              {subCategory.calls.map(call => (
                <button
                  key={call.id}
                  onClick={() => onSelectCall(call)}
                  className="w-full flex items-center gap-4 px-5 py-4 bg-surface-container-low hover:bg-surface-container rounded-2xl transition-colors text-left group"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold font-headline flex-shrink-0">
                    {call.customerName.split(' ').map(n => n[0]).join('')}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primary">{call.customerName}</p>
                    <p className="text-[11px] text-on-surface-variant">{call.customerNumber} · {call.agentName}</p>
                  </div>
                  {/* Meta */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-mono text-on-surface-variant">{call.duration}</span>
                    <span className="text-lg">{SENTIMENT_EMOJI[call.sentiment]}</span>
                    <span className={call.priority === 'critical' ? 'badge-critical' : call.priority === 'high' || call.priority === 'medium' ? 'badge-medium' : 'badge-normal'}>
                      {call.priority}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-outline opacity-0 group-hover:opacity-100 transition-opacity text-[18px]">chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Metric Modal ────────────────────────────────────────────────────────
function SubMetricModal({ metric, calls, onClose }: { metric: DashboardMetric; calls: CallSummary[]; onClose: () => void }) {
  const relatedCalls = calls.filter(c => c.category === metric.category);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-3xl shadow-ambient w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-8 py-5 border-b border-surface-container">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px]" style={{ color: metric.color }}>{metric.icon}</span>
            <div>
              <h3 className="font-headline font-bold text-lg text-primary">{metric.label}</h3>
              <p className="text-xs text-on-surface-variant capitalize">{metric.category} category breakdown</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-8 space-y-6">
          {metric.subMetrics && (
            <div className="grid grid-cols-3 gap-3">
              {metric.subMetrics.map(sm => (
                <div key={sm.label} className="bg-surface-container-low rounded-2xl p-4 text-center">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">{sm.label}</p>
                  <p className="text-2xl font-black font-headline" style={{ color: metric.color }}>{sm.value}</p>
                </div>
              ))}
            </div>
          )}
          <div>
            <h4 className="font-headline font-bold text-sm text-primary uppercase tracking-wider mb-3">Recent {metric.label}</h4>
            <div className="space-y-2">
              {relatedCalls.map(call => (
                <div key={call.id} className="flex items-center justify-between px-4 py-3 bg-surface-container-low rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-[16px]">call</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">{call.customerName}</p>
                      <p className="text-xs text-on-surface-variant">{call.customerNumber} · {call.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={call.priority === 'critical' ? 'badge-critical' : call.priority === 'high' || call.priority === 'medium' ? 'badge-medium' : 'badge-normal'}>{call.priority}</span>
                    <span className="text-lg">{SENTIMENT_EMOJI[call.sentiment]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Interactive Category Explorer ────────────────────────────────────────────
function CategoryExplorer({ 
  categories,
  onSubCategoryClick 
}: { 
  categories: CategoryData[];
  onSubCategoryClick: (cat: CategoryData, sub: SubCategoryData) => void;
}) {
  const [expandedCat, setExpandedCat] = useState<string>(categories[0]?.id || '');

  return (
    <div className="xl:col-span-8 bg-surface-container-lowest rounded-2xl p-8 shadow-card flex flex-col">
      <h2 className="text-xl font-black text-primary font-headline mb-1">Issue Categories</h2>
      <p className="text-on-surface-variant text-sm mb-6">Real-time taxonomy breakdown directly from Dashboard API</p>
      
      <div className="flex-1 space-y-4">
        {categories.map(cat => {
          const isOpen = expandedCat === cat.id;
          return (
            <div key={cat.id} className="border border-surface-container rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedCat(isOpen ? '' : cat.id)}
                className="w-full px-6 py-4 flex items-center justify-between bg-surface-container-low hover:bg-surface-container transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined" style={{ color: cat.color }}>{cat.icon}</span>
                  <span className="font-bold text-primary">{cat.name}</span>
                </div>
                <span className="text-sm font-black text-primary">{cat.totalCount}</span>
              </button>
              {isOpen && (
                <div className="p-4 space-y-2">
                  {cat.subCategories.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => onSubCategoryClick(cat, sub)}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-surface-container text-sm"
                    >
                      <span className="text-on-surface-variant">{sub.name}</span>
                      <span className="font-bold text-primary">{sub.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [selectedCall, setSelectedCall] = useState<CallSummary | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<DashboardMetric | null>(null);
  const [subCategoryModal, setSubCategoryModal] = useState<{ cat: CategoryData; sub: SubCategoryData } | null>(null);
  const [realCalls, setRealCalls] = useState<CallSummary[]>([]);
  const apiBase = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || '';

  useEffect(() => {
    fetch(`${apiBase}/api/calls`)
      .then(r => r.json())
      .then((data: { calls: unknown[] }) => {
        const sentimentMap: Record<string, 'positive'|'neutral'|'negative'|'frustrated'> = {
          POSITIVE: 'positive', NEUTRAL: 'neutral', NEGATIVE: 'negative', MIXED: 'frustrated',
          positive: 'positive', neutral: 'neutral', negative: 'negative', frustrated: 'frustrated',
        };
        const adapted = (data.calls as Record<string, unknown>[])
          .filter(c => c['status'] === 'ended')
          .map(c => {
            const a = (c['analysis'] as Record<string, unknown>) || {};
            const dur = (c['duration'] as number) || 0;
            const rawTranscripts = (c['transcripts'] as Record<string, unknown>[]) || [];
            const sid = (c['callSid'] as string) || (c['id'] as string) || '';
            const match = sid.match(/_\+?(\d{10,15})_/);
            const num = match ? `+${match[1]}` : (a['customerNumber'] as string) || (c['callerNumber'] as string) || 'External';

            return {
              id: c['id'] as string,
              callId: sid.slice(0, 12),
              callSid: sid,
              duration: `${Math.floor(dur / 60).toString().padStart(2, '0')}:${(dur % 60).toString().padStart(2, '0')}`,
              durationSeconds: dur,
              category: (a['category'] as CallSummary['category']) || 'support',
              subCategory: (a['subCategory'] as string) || 'Account Management',
              agentName: (a['agentName'] as string) || 'AI Agent',
              agentId: 'ai1',
              customerName: (a['customerName'] as string) || 'Caller',
              customerNumber: num,
              customerId: (a['customerId'] as string) || 'CUST-0000',
              priority: (a['priority'] as CallSummary['priority']) || 'normal',
              sentiment: sentimentMap[(a['sentiment'] as string) || ''] || 'neutral',
              sentimentScore: (a['sentimentScore'] as number) || 50,
              startTime: c['startTime'] ? new Date(c['startTime'] as string).toLocaleTimeString() : '',
              endTime: c['endTime'] ? new Date(c['endTime'] as string).toLocaleTimeString() : '',
              status: 'completed' as const,
              issues: (a['issues'] as string[]) || [],
              resolution: (a['resolution'] as string) || '',
              transcript: (a['transcript'] as unknown[]) ||
                rawTranscripts.filter(t => !t['isPartial']).map((t, i) => ({
                  id: (t['resultId'] as string) || `t${i}`,
                  speaker: (t['channel'] === 'AGENT' ? 'agent' : 'customer') as 'agent' | 'customer',
                  speakerName: t['channel'] === 'AGENT' ? 'AI Agent' : 'Caller',
                  text: t['text'] as string,
                  timestamp: `${Math.floor((t['startTime'] as number) / 60).toString().padStart(2, '0')}:${Math.floor((t['startTime'] as number) % 60).toString().padStart(2, '0')}`,
                  sentiment: sentimentMap[(t['sentiment'] as string) || ''] || 'neutral',
                  keywords: [] as string[],
                  issueDetected: (t['issueDetected'] as boolean) || false,
                })),
              aiSummary: (a['aiSummary'] as string) || '',
              tags: (a['tags'] as string[]) || [],
            } as CallSummary;
          });
        setRealCalls(adapted.length > 0 ? adapted : mockCallSummaries);
      })
      .catch(() => setRealCalls(mockCallSummaries));
  }, [apiBase]);

  const callSummaries = realCalls.length > 0 ? realCalls : mockCallSummaries;

  // 1. Dynamic Sentiment Data
  const dynamicSentimentData: { name: string, value: number, color: string }[] = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0, frustrated: 0 };
    callSummaries.forEach(call => {
      const s = call.sentiment?.toLowerCase() || 'neutral';
      if (s in counts) {
        counts[s as keyof typeof counts]++;
      } else {
        counts.neutral++;
      }
    });
    const total = callSummaries.length || 1;
    return [
      { name: 'Positive', value: Math.round((counts.positive / total) * 100) || 0, color: '#4ebe42' },
      { name: 'Neutral', value: Math.round((counts.neutral / total) * 100) || 0, color: '#b4c5ff' },
      { name: 'Negative', value: Math.round((counts.negative / total) * 100) || 0, color: '#ba1a1a' },
      { name: 'Frustrated', value: Math.round((counts.frustrated / total) * 100) || 0, color: '#fe6b00' },
    ];
  }, [callSummaries]);

  const positivePct = dynamicSentimentData.find(d => d.name === 'Positive')?.value || 0;

  // 2. Dynamic Top Metrics
  const dynamicMetrics = useMemo(() => {
    let support = 0, billing = 0, technical = 0, churnRisk = 0;
    let supportRes = 0, billingRes = 0, techRes = 0;
    
    callSummaries.forEach(c => {
      if (c.category === 'support') { support++; if (c.status === 'completed') supportRes++; }
      if (c.category === 'billing') { billing++; if (c.status === 'completed') billingRes++; }
      if (c.category === 'technical') { technical++; if (c.status === 'completed') techRes++; }
      if (c.sentiment === 'frustrated') churnRisk++;
    });

    return [
      { id: 'm1', label: 'Support Queries', value: support, change: Math.round((supportRes / (support || 1)) * 100), changeDirection: 'up', category: 'support', icon: 'headset_mic', color: '#002265' },
      { id: 'm2', label: 'Billing Disputes', value: billing, change: Math.round((billingRes / (billing || 1)) * 100), changeDirection: 'up', category: 'billing', icon: 'credit_card_off', color: '#fe6b00' },
      { id: 'm3', label: 'Technical Issues', value: technical, change: Math.round((techRes / (technical || 1)) * 100), changeDirection: 'down', category: 'technical', icon: 'router', color: '#4ebe42' },
      { id: 'm4', label: 'Churn Risk', value: churnRisk, change: 0, changeDirection: 'up', category: 'outbound', icon: 'person_cancel', color: '#a04100' },
    ];
  }, [callSummaries]);

  // 3. Dynamic Category Explorer Tree
  const dynamicCategoryTree = useMemo(() => {
    const cats: Record<string, any> = {
      support: { id: 'support', name: 'General Support', icon: 'headset_mic', color: '#002265', bgColor: '#dbe1ff', totalCount: 0, resolved: 0, subCategories: {} },
      billing: { id: 'billing', name: 'Billing', icon: 'credit_card_off', color: '#fe6b00', bgColor: '#ffdbcc', totalCount: 0, resolved: 0, subCategories: {} },
      technical: { id: 'technical', name: 'Technical', icon: 'router', color: '#002f01', bgColor: '#8afc77', totalCount: 0, resolved: 0, subCategories: {} }
    };
    
    callSummaries.forEach(c => {
      const catId = c.category in cats ? c.category : 'support';
      const root = cats[catId];
      root.totalCount++;
      if (c.status === 'completed') root.resolved++;
      
      const subName = c.subCategory || 'General';
      if (!root.subCategories[subName]) {
        root.subCategories[subName] = { id: subName, name: subName, count: 0, resolved: 0, avgDuration: '00:00', totalSecs: 0, calls: [] };
      }
      
      const sub = root.subCategories[subName];
      sub.count++;
      sub.calls.push(c);
      sub.totalSecs += c.durationSeconds || 0;
      if (c.status === 'completed') sub.resolved++;
      
      const avgSecs = Math.round(sub.totalSecs / sub.count);
      sub.avgDuration = `${String(Math.floor(avgSecs / 60)).padStart(2, '0')}:${String(avgSecs % 60).padStart(2, '0')}`;
    });

    return Object.values(cats).map(c => ({
      ...c,
      subCategories: Object.values(c.subCategories).sort((a: any, b: any) => b.count - a.count)
    }));
  }, [callSummaries]);

  const metricBorderColors: Record<string, string> = {
    'm1': 'border-primary', 'm2': 'border-secondary-container',
    'm3': 'border-on-tertiary-container', 'm4': 'border-secondary',
  };

  const handleSubCategoryClick = (cat: CategoryData, sub: SubCategoryData) => {
    setSubCategoryModal({ cat, sub });
  };

  const handleSelectCallFromSubCat = (call: CallSummary) => {
    setSubCategoryModal(null);
    setSelectedCall(call);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="WowWay"
        subtitle="Call Center Intelligence Dashboard"
        rightContent={null}
      />

      <main className="p-8 space-y-6 flex-1">

        {/* ── Hero Metric Cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {dynamicMetrics.map((metric: any) => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric)}
              className={`metric-card border-b-4 ${metricBorderColors[metric.id]} text-left hover:shadow-float hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">{metric.label}</p>
                  <h3 className="text-4xl font-black font-headline" style={{ color: metric.color }}>{metric.value.toLocaleString()}</h3>
                </div>
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${metric.color}10` }}>
                  <span className="material-symbols-outlined text-[24px]" style={{ color: metric.color }}>{metric.icon}</span>
                </div>
              </div>
              <div className={`flex items-center gap-2 text-sm font-bold ${metric.changeDirection === 'up' && metric.category === 'billing' ? 'text-error' : 'text-on-tertiary-container'}`}>
                <span className="material-symbols-outlined text-[16px]">{metric.changeDirection === 'up' ? 'trending_up' : 'trending_down'}</span>
                <span>{metric.change}% {metric.changeDirection === 'up' ? 'vs Last Week' : 'Resolved'}</span>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2 font-medium">Click to view breakdown →</p>
              <div className="absolute bottom-0 left-0 w-full h-10 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 400 40" preserveAspectRatio="none">
                  <path d="M0,30 Q100,10 200,25 T400,8" fill="none" stroke={metric.color} strokeWidth="3" />
                </svg>
              </div>
            </button>
          ))}
        </section>

        {/* ── Main Grid: Categories Explorer (8) + Sentiment (4) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <CategoryExplorer 
            categories={dynamicCategoryTree} 
            onSubCategoryClick={handleSubCategoryClick} 
          />

          {/* ── Sentiment Donut (4 cols) ── */}
          <div className="xl:col-span-4 bg-surface-container-lowest rounded-2xl p-8 shadow-card flex flex-col">
            <h2 className="text-xl font-black text-primary font-headline mb-1">Customer Sentiment</h2>
            <p className="text-on-surface-variant text-sm mb-6">AI-driven aggregate mood index</p>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={dynamicSentimentData} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                      paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                      {dynamicSentimentData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v}%`, '']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-4xl font-black text-primary font-headline">{positivePct}%</p>
                  <p className="text-[10px] font-black text-on-tertiary-container uppercase tracking-widest">Positive</p>
                </div>
              </div>
              <div className="w-full space-y-3 mt-4">
                {dynamicSentimentData.map(s => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></span>
                        <span className="text-sm text-on-surface-variant font-medium">{s.name}</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{s.value}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick summary stats */}
            <div className="mt-6 pt-5 border-t border-surface-container grid grid-cols-2 gap-3">
              {[
                { label: 'Avg Handle Time', value: '05:48', icon: 'timer' },
                { label: 'First Call Res.', value: '84%', icon: 'task_alt' },
                { label: 'Queue Wait', value: '01:22', icon: 'hourglass_top' },
                { label: 'CSAT Score', value: '4.6/5', icon: 'star' },
              ].map(s => (
                <div key={s.label} className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">{s.icon}</span>
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">{s.label}</p>
                    <p className="text-sm font-black text-primary font-headline">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Call Records ── */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-8 py-5 border-b border-surface-container">
            <div>
              <h2 className="text-xl font-black text-primary font-headline">Recent Call Records</h2>
              <p className="text-on-surface-variant text-sm mt-0.5">Click any row to view full details & transcript</p>
            </div>
            <button className="btn-secondary text-sm px-4 py-2">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Filter
            </button>
          </div>
          <div className="divide-y divide-surface-container">
            {callSummaries.slice(0, 5).map(call => (
              <button
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className="w-full flex items-center gap-4 px-8 py-4 hover:bg-surface-container-low transition-colors text-left group"
              >
                <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-white text-[18px]">call</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-primary truncate">{call.customerName}</p>
                  <p className="text-xs text-on-surface-variant">{call.subCategory} · {call.agentName}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-mono text-on-surface-variant">{call.duration}</span>
                  <span className="text-xl">{SENTIMENT_EMOJI[call.sentiment]}</span>
                  <span className={call.priority === 'critical' ? 'badge-critical' : call.priority === 'high' || call.priority === 'medium' ? 'badge-medium' : 'badge-normal'}>{call.priority}</span>
                </div>
                <span className="material-symbols-outlined text-outline opacity-0 group-hover:opacity-100 transition-opacity text-[18px]">chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      {selectedCall && (
        <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}
      {selectedMetric && (
        <SubMetricModal metric={selectedMetric} calls={callSummaries} onClose={() => setSelectedMetric(null)} />
      )}
      {subCategoryModal && (
        <SubCategoryCallsModal
          category={subCategoryModal.cat}
          subCategory={subCategoryModal.sub}
          onSelectCall={handleSelectCallFromSubCat}
          onClose={() => setSubCategoryModal(null)}
        />
      )}
    </div>
  );
}
