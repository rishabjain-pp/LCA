import { useState, useEffect } from 'react';
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
              <h3 className="font-headline font-bold text-lg text-primary">{call.callId}</h3>
              <p className="text-xs text-on-surface-variant">{call.startTime} · {call.duration} duration · {call.subCategory}</p>
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
                    <div className={line.speaker === 'agent' ? 'transcript-bubble-agent' : 'transcript-bubble-customer'}>{line.text}</div>
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
                    <span className={`badge-${call.priority === 'critical' ? 'critical' : call.priority === 'high' || call.priority === 'medium' ? 'medium' : 'normal'}`}>
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
                      <p className="text-xs text-on-surface-variant">{call.subCategory} · {call.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge-${call.priority === 'critical' ? 'critical' : call.priority === 'high' || call.priority === 'medium' ? 'medium' : 'normal'}`}>{call.priority}</span>
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

// ─── Sentiment Donut ─────────────────────────────────────────────────────────
const SENTIMENT_DATA = [
  { name: 'Positive', value: 48, color: '#4ebe42' },
  { name: 'Neutral', value: 24, color: '#b4c5ff' },
  { name: 'Negative', value: 16, color: '#ba1a1a' },
  { name: 'Frustrated', value: 12, color: '#fe6b00' },
];

// ─── Interactive Category Explorer ────────────────────────────────────────────
function CategoryExplorer({
  onSubCategoryClick,
}: {
  onSubCategoryClick: (cat: CategoryData, sub: SubCategoryData) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalCalls = categoryTree.reduce((sum, c) => sum + c.totalCount, 0);

  return (
    <div className="xl:col-span-8 bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-surface-container">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-primary font-headline">Call Categories</h2>
            <p className="text-on-surface-variant text-sm mt-0.5">
              {totalCalls.toLocaleString()} total contacts · Click a category to drill down, click count to view contacts
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container live-dot"></span>
            <span className="text-[10px] font-black text-on-tertiary-fixed-variant uppercase tracking-widest">Today</span>
          </div>
        </div>
      </div>

      {/* Category Rows */}
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-surface-container">
        {categoryTree.map(cat => {
          const isOpen = expandedId === cat.id;
          const pct = Math.round((cat.totalCount / totalCalls) * 100);
          const resolvedPct = Math.round((cat.resolved / cat.totalCount) * 100);

          return (
            <div key={cat.id}>
              {/* Category Row */}
              <button
                onClick={() => setExpandedId(isOpen ? null : cat.id)}
                className="w-full px-8 py-5 flex items-center gap-4 hover:bg-surface-container-low transition-colors group text-left"
              >
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ backgroundColor: `${cat.bgColor}18` }}>
                  <span className="material-symbols-outlined text-[22px]" style={{ color: cat.bgColor }}>{cat.icon}</span>
                </div>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-primary">{cat.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-on-tertiary-container">{resolvedPct}% resolved</span>
                      <span className="text-[10px] font-bold text-on-surface-variant">{pct}% of total</span>
                    </div>
                  </div>
                  {/* Progress bar — two-layer: resolved over total */}
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full rounded-full relative" style={{ width: `${pct}%`, backgroundColor: `${cat.bgColor}30` }}>
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${resolvedPct}%`, backgroundColor: cat.bgColor }} />
                    </div>
                  </div>
                </div>

                {/* Count badge */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-black font-headline" style={{ color: cat.bgColor }}>{cat.totalCount.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">contacts</p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px] transition-transform duration-200"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    chevron_right
                  </span>
                </div>
              </button>

              {/* Sub-category Drill-down */}
              {isOpen && (
                <div className="bg-surface-container-low border-t border-surface-container animate-fade-in">
                  {/* Sub-header */}
                  <div className="px-8 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">subdirectory_arrow_right</span>
                    <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Sub-categories — click count to view contacts</span>
                  </div>

                  <div className="px-8 pb-5 space-y-2">
                    {cat.subCategories.map(sub => {
                      const subPct = Math.round((sub.count / cat.totalCount) * 100);
                      const subResPct = Math.round((sub.resolved / sub.count) * 100);
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center gap-4 px-5 py-3.5 bg-surface-container-lowest rounded-2xl hover:bg-white transition-colors"
                        >
                          {/* Sub icon */}
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${cat.bgColor}12` }}>
                            <span className="material-symbols-outlined text-[16px]" style={{ color: cat.bgColor }}>subdirectory_arrow_right</span>
                          </div>

                          {/* Name + bar */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-on-surface">{sub.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-on-surface-variant">avg {sub.avgDuration}</span>
                                <span className="text-[10px] font-bold text-on-tertiary-container">{subResPct}% resolved</span>
                              </div>
                            </div>
                            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${subPct}%`, backgroundColor: `${cat.bgColor}50` }}>
                                <div className="h-full rounded-full" style={{ width: `${subResPct}%`, backgroundColor: cat.bgColor }} />
                              </div>
                            </div>
                          </div>

                          {/* Count — clickable button */}
                          <button
                            onClick={() => onSubCategoryClick(cat, sub)}
                            className="flex flex-col items-center px-4 py-2 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0 border-2"
                            style={{ borderColor: `${cat.bgColor}30`, backgroundColor: `${cat.bgColor}08` }}
                            title={`View ${sub.count} contacts in ${sub.name}`}
                          >
                            <span className="text-xl font-black font-headline" style={{ color: cat.bgColor }}>{sub.count}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: cat.bgColor }}>contacts ↗</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
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
            return {
              id: c['id'] as string,
              callId: ((c['callSid'] as string) || c['id'] as string).slice(0, 12),
              callSid: c['callSid'] as string,
              duration: `${Math.floor(dur / 60).toString().padStart(2, '0')}:${(dur % 60).toString().padStart(2, '0')}`,
              durationSeconds: dur,
              category: (a['category'] as CallSummary['category']) || 'support',
              subCategory: (a['subCategory'] as string) || 'Account Management',
              agentName: (a['agentName'] as string) || 'AI Agent',
              agentId: 'ai1',
              customerName: (a['customerName'] as string) || 'Caller',
              customerNumber: (a['customerNumber'] as string) || (c['callerNumber'] as string) || 'Unknown',
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
        title="The Command Horizon"
        subtitle="Call Center Intelligence Dashboard"
        rightContent={
          <button className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Report
          </button>
        }
      />

      <main className="p-8 space-y-6 flex-1">

        {/* ── Hero Metric Cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {dashboardMetrics.map(metric => (
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
          <CategoryExplorer onSubCategoryClick={handleSubCategoryClick} />

          {/* ── Sentiment Donut (4 cols) ── */}
          <div className="xl:col-span-4 bg-surface-container-lowest rounded-2xl p-8 shadow-card flex flex-col">
            <h2 className="text-xl font-black text-primary font-headline mb-1">Customer Sentiment</h2>
            <p className="text-on-surface-variant text-sm mb-6">AI-driven aggregate mood index</p>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={SENTIMENT_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                      paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                      {SENTIMENT_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v}%`, '']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-4xl font-black text-primary font-headline">72%</p>
                  <p className="text-[10px] font-black text-on-tertiary-container uppercase tracking-widest">Positive</p>
                </div>
              </div>
              <div className="w-full space-y-3 mt-4">
                {SENTIMENT_DATA.map(s => (
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
                  <span className={`badge-${call.priority === 'critical' ? 'critical' : call.priority === 'high' || call.priority === 'medium' ? 'medium' : 'normal'}`}>{call.priority}</span>
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
