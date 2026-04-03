import { useState } from 'react';
import { createPortal } from 'react-dom';
import TopBar from '../components/TopBar';
import { useLcaData } from '../hooks/useLcaData';
import type { ActiveCall, TranscriptLine } from '../types';

// ─── Live Analysis Sidebar ────────────────────────────────────────────────────
function LiveAnalysisSidebar({
  call,
  liveTranscript,
  onClose,
}: {
  call: ActiveCall;
  liveTranscript: TranscriptLine[];
  onClose: () => void;
}) {
  const fmtDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const sentimentColor: Record<string, string> = {
    positive: '#4ebe42', neutral: '#747683', negative: '#ba1a1a', frustrated: '#fe6b00',
  };
  const sentimentEmoji: Record<string, string> = {
    positive: '😊', neutral: '😐', negative: '😟', frustrated: '😠',
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-1/2 flex flex-col bg-surface-container-lowest shadow-2xl animate-slide-in-right">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-surface-container bg-surface-container-low">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[20px]">person</span>
          </div>
          <div>
            <p className="font-headline font-bold text-sm text-primary">{call.customerName}</p>
            <p className="text-[11px] text-on-surface-variant font-mono">{call.customerNumber}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Live Duration + Sentiment Banner */}
      <div className="px-6 py-4 bg-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 items-end h-5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="wave-bar w-1 bg-secondary-container rounded-full" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <span className="text-xl font-black font-mono text-secondary">{fmtDuration(call.durationSeconds)}</span>
          <span className="w-2 h-2 rounded-full bg-secondary live-dot"></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{sentimentEmoji[call.sentiment]}</span>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase">Sentiment</p>
            <p className="text-sm font-bold capitalize" style={{ color: sentimentColor[call.sentiment] }}>{call.sentiment}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Sentiment Score Bar */}
        <div className="px-6 py-5 border-b border-surface-container">
          <div className="flex justify-between mb-2">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Sentiment Score</p>
            <span className="text-sm font-bold text-primary">{call.sentimentScore}%</span>
          </div>
          <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${call.sentimentScore}%`,
                backgroundColor: call.sentimentScore > 60 ? '#4ebe42' : call.sentimentScore > 35 ? '#fe6b00' : '#ba1a1a',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-error font-bold">Frustrated</span>
            <span className="text-[9px] text-on-tertiary-container font-bold">Delighted</span>
          </div>
        </div>

        {/* Live Transcript */}
        <div className="px-6 py-5 border-b border-surface-container">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-[18px]">forum</span>
            <h4 className="font-headline font-bold text-sm text-primary">Live Transcript</h4>

          </div>
          <div className="space-y-3 max-h-56 overflow-y-auto scrollbar-thin pr-1">
            {liveTranscript.map((line) => (
              <div key={line.id} className={`flex flex-col gap-1 ${line.speaker === 'agent' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">
                  <span>{line.speakerName}</span>
                  <span className="text-outline">{line.timestamp}</span>
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
                }>
                  {line.text}
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* Issue Detection */}
        <div className="px-6 py-5 border-b border-surface-container">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-error text-[18px]">warning</span>
            <h4 className="font-headline font-bold text-sm text-primary">Issues Detected</h4>
          </div>
          <div className="space-y-2">
            {call.issues.length > 0 ? (
              call.issues.map((issue, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-error-container/20 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0"></span>
                  <span className="text-sm text-on-error-container font-medium">{issue}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container flex-shrink-0"></span>
                <span className="text-sm text-on-surface-variant italic">No immediate issues detected...</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="px-6 py-5 border-b border-surface-container">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary-container text-[18px] material-symbols-filled">psychology</span>
            <h4 className="font-headline font-bold text-sm text-primary">AI Smart Suggestions</h4>
          </div>
          <div className="space-y-2">
            {(call.category === 'billing' ? [
                { label: 'Recommended', title: 'Late Fee Waiver', desc: 'Customer may be eligible for a courtesy credit.', border: 'border-secondary' },
                { label: 'Applicable', title: 'Plan Review', desc: 'Check for cheaper loyalty-based pricing models.', border: 'border-primary-container' },
                { label: 'Action', title: 'Payment Verification', desc: 'Validate last transaction status in billing portal.', border: 'border-outline-variant' },
              ] : call.category === 'technical' ? [
                { label: 'Recommended', title: 'Remote Device Reset', desc: 'Initiate ONT power cycle via admin portal.', border: 'border-secondary' },
                { label: 'Diagnostic', title: 'Signal Level Check', desc: 'Pull 24hr RX/TX data from service node.', border: 'border-primary-container' },
                { label: 'Tool', title: 'Speed Test Injector', desc: 'Run synthetic load test to the customer ONT.', border: 'border-outline-variant' },
              ] : [
                { label: 'Recommended', title: 'Account Verification', desc: 'Confirm security pin before proceeding.', border: 'border-secondary' },
                { label: 'Applicable', title: 'Loyalty Tagging', desc: 'Customer exceeds 5yr tenure; mark for loyalty.', border: 'border-primary-container' },
                { label: 'Action', title: 'Email Follow-up', desc: 'Send summary of today\'s inquiry.', border: 'border-outline-variant' },
              ]).map(s => (
                <div key={s.title} className={`p-3 rounded-xl bg-surface-container-low border-l-4 ${s.border} hover:translate-x-1 transition-transform cursor-pointer`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-black text-secondary uppercase tracking-tighter">{s.label}</span>
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">open_in_new</span>
                  </div>
                  <p className="text-sm font-bold text-primary">{s.title}</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{s.desc}</p>
                </div>
              ))}
          </div>
        </div>

        {/* Customer Context */}
        <div className="px-6 py-5">
          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-3">Customer Context</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Category', value: call.subCategory },
              { label: 'Priority', value: call.priority.toUpperCase() },
              { label: 'Agent', value: call.agentName === 'AI Agent' ? 'LCA AI' : call.agentName.split(' ')[0] },
            ].map(c => (
              <div key={c.label} className="bg-surface-container rounded-xl p-3 text-center">
                <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">{c.label}</p>
                <p className="text-xs font-bold text-primary truncate">{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>,
    document.body
  );
}

// ─── Active Calls Page ────────────────────────────────────────────────────────
export default function ActiveCallsPage() {
  const { activeCalls, transcripts, connected } = useLcaData();
  const [selectedCall, setSelectedCall] = useState<ActiveCall | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'hold'>('all');

  const fmtDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const sentimentEmoji: Record<string, string> = {
    positive: '😊', neutral: '😐', negative: '😟', frustrated: '😠',
  };

  const filtered = activeCalls.filter(c => {
    if (filter === 'critical') return c.priority === 'critical';
    if (filter === 'hold') return c.isOnHold;
    return true;
  });

  const totalDurationSeconds = activeCalls.reduce((a, b) => a + b.durationSeconds, 0);
  const avgDuration = activeCalls.length > 0
    ? fmtDuration(Math.round(totalDurationSeconds / activeCalls.length))
    : '00:00';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Active Calls Monitor"
        subtitle={`Monitoring ${activeCalls.length} ongoing connections in real-time${connected ? '' : ' · Connecting...'}`}
        rightContent={
          <div className="flex gap-2">

          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-8">
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Active', value: activeCalls.length, icon: 'headset_mic', color: '#002265' },
                { label: 'Critical', value: activeCalls.filter(c => c.priority === 'critical').length, icon: 'warning', color: '#ba1a1a' },
                { label: 'On Hold', value: activeCalls.filter(c => c.isOnHold).length, icon: 'pause_circle', color: '#fe6b00' },
                { label: 'Avg Duration', value: avgDuration, icon: 'schedule', color: '#004802' },
              ].map(s => (
                <div key={s.label} className="metric-card flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                    <span className="material-symbols-outlined text-[22px]" style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{s.label}</p>
                    <p className="text-xl font-black font-headline" style={{ color: s.color }}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-bold text-on-surface-variant">Filter:</span>
              {(['all', 'critical', 'hold'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all capitalize ${filter === f ? 'gradient-primary text-white' : 'bg-surface-container-high text-on-surface-variant hover:text-primary'}`}
                >
                  {f === 'all' ? 'All Calls' : f === 'critical' ? 'Critical' : 'On Hold'}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low">
                  <tr>
                    {['Agent', 'Customer Number', 'Category', 'Duration', 'Sentiment', 'Priority', 'Status', 'Actions'].map(col => (
                      <th key={col} className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((call, idx) => (
                    <tr
                      key={call.id}
                      className={`hover:bg-surface-container-low/60 transition-colors group border-t ${idx === 0 ? 'border-0' : 'border-surface-container'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold font-headline flex-shrink-0">
                            {call.agentName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary">{call.agentName}</p>
                            <p className="text-[11px] text-on-surface-variant">{call.agentId === 'a1' ? 'Tier 2 Support' : call.agentId === 'a2' ? 'Billing' : call.agentId === 'a3' ? 'General' : call.agentId === 'a4' ? 'Outbound' : 'Technical'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-on-surface-variant">{call.customerNumber}</span>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">{call.customerName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-on-surface capitalize">{call.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${call.status === 'active' ? 'bg-secondary live-dot' : 'bg-on-tertiary-container'}`}></span>
                          <span className={`text-sm font-bold font-mono ${call.status === 'active' ? 'text-secondary' : 'text-on-surface'}`}>
                            {call.duration}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-2xl" title={call.sentiment}>{sentimentEmoji[call.sentiment]}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={call.priority === 'critical' ? 'badge-critical' : call.priority === 'high' || call.priority === 'medium' ? 'badge-medium' : 'badge-normal'}>
                          {call.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {call.isOnHold ? (
                          <span className="badge-medium">On Hold</span>
                        ) : call.isMuted ? (
                          <span className="badge-normal">Muted</span>
                        ) : call.status === 'completed' ? (
                          <span className="badge-ended">Ended</span>
                        ) : (
                          <span className="badge-success">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedCall(call)}
                          className="px-4 py-2 gradient-primary text-white text-xs font-bold rounded-full hover:shadow-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          Live View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>
        </div>

        {selectedCall && (
          <LiveAnalysisSidebar
            call={selectedCall}
            liveTranscript={transcripts.get(selectedCall.callSid || '') || selectedCall.transcript || []}
            onClose={() => setSelectedCall(null)}
          />
        )}
      </div>
    </div>
  );
}
