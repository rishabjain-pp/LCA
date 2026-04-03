import { useState, useEffect, useRef } from 'react';
import TopBar from '../components/TopBar';
import { knowledgeArticles } from '../data/mockData';
import { useLcaData } from '../hooks/useLcaData';
import { useTwilioDevice } from '../hooks/useTwilioDevice';
import type { SentimentLevel } from '../types';

// ─── Incoming Call Notification ───────────────────────────────────────────────
function IncomingCallNotification({
  callerNumber,
  callerName,
  onAnswer,
  onDecline,
}: {
  callerNumber: string;
  callerName: string;
  onAnswer: () => void;
  onDecline: () => void;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCount(c => c + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/30 backdrop-blur-sm animate-fade-in">
      {/* Ripple rings */}
      <div className="absolute w-64 h-64 rounded-full border-4 border-on-tertiary-container/20 animate-ping" />
      <div className="absolute w-48 h-48 rounded-full border-4 border-on-tertiary-container/30 animate-ping" style={{ animationDelay: '0.5s' }} />

      <div className="relative bg-surface-container-lowest rounded-3xl shadow-ambient p-10 flex flex-col items-center gap-6 animate-slide-up max-w-sm w-full mx-4">
        {/* Caller Avatar */}
        <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <span className="material-symbols-outlined text-white text-[48px]">person</span>
        </div>

        <div className="text-center">
          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Incoming Call · {count}s</p>
          <h2 className="text-2xl font-black font-headline text-primary">
            {callerName || 'Unknown Caller'}
          </h2>
          <p className="text-on-surface-variant font-mono mt-1">{callerNumber}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="badge-normal">normal priority</span>
            <span className="badge-normal capitalize">support</span>
          </div>
        </div>

        {/* Queue Time */}
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">timer</span>
          <span className="text-sm text-on-surface-variant font-medium">Wait time: 00:00</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-8 items-center">
          <button
            onClick={onDecline}
            className="w-16 h-16 rounded-full bg-error flex items-center justify-center shadow-lg hover:bg-error/90 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-white text-[28px]">call_end</span>
          </button>
          <button
            onClick={onAnswer}
            className="w-20 h-20 rounded-full bg-on-tertiary-container flex items-center justify-center shadow-xl shadow-on-tertiary-container/40 hover:scale-105 active:scale-95 transition-all animate-pulse"
          >
            <span className="material-symbols-outlined text-white text-[32px] material-symbols-filled">call</span>
          </button>
        </div>
        <p className="text-xs text-on-surface-variant">Tap the green button to answer</p>
      </div>
    </div>
  );
}

// ─── Transcript Message ───────────────────────────────────────────────────────
const sentimentColor: Record<SentimentLevel, string> = {
  positive: 'text-on-tertiary-container',
  neutral: 'text-on-surface-variant',
  negative: 'text-error',
  frustrated: 'text-secondary',
};
const sentimentEmoji: Record<SentimentLevel, string> = {
  positive: '😊', neutral: '😐', negative: '😟', frustrated: '😠',
};

// ─── Call Panel Page ──────────────────────────────────────────────────────────
export default function CallPanelPage() {
  const { activeCalls, transcripts } = useLcaData();
  const twilioDevice = useTwilioDevice();

  const isRinging = twilioDevice.incomingCall !== null && twilioDevice.activeCall === null;
  const isActive = twilioDevice.activeCall !== null;
  const callState = isRinging ? 'incoming' : isActive ? 'active' : 'waiting';

  const [isOnHold, setIsOnHold] = useState(false);
  const [agentInput, setAgentInput] = useState('');
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  const [activeKnowledge, setActiveKnowledge] = useState<string | null>(null);
  const [showEnded, setShowEnded] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const incomingInfo = {
    callId: twilioDevice.callerNumber || 'Unknown',
    callerNumber: twilioDevice.callerNumber || 'Unknown',
    callerName: 'Incoming Call',
    category: 'support' as const,
    queueTime: '00:00',
    priority: 'normal' as const,
  };

  const activeCallData = activeCalls.find(c => c.status === 'active') ?? null;
  const liveTranscript = activeCallData?.callSid
    ? (transcripts.get(activeCallData.callSid) || [])
    : [];

  const duration = twilioDevice.callDuration;
  const isMuted = twilioDevice.isMuted;

  const handleAccept = () => twilioDevice.acceptCall();
  const handleReject = () => twilioDevice.rejectCall();
  const handleEndCall = () => {
    twilioDevice.hangUp();
    setShowEnded(true);
    setTimeout(() => setShowEnded(false), 4000);
  };
  const handleToggleMute = () => twilioDevice.toggleMute();

  // Show AI suggestion after 3 transcript lines
  useEffect(() => {
    if (liveTranscript.length >= 3) {
      setShowAiSuggestion(true);
    }
  }, [liveTranscript.length]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript]);

  const fmtDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <TopBar
        title="Call Panel"
        subtitle={callState === 'active' ? `Live Call · ${fmtDuration(duration)}` : 'Agent Workspace'}
        rightContent={
          callState === 'active' ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary/10 rounded-full">
                <div className="flex gap-0.5 items-end h-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="wave-bar w-0.5 bg-secondary rounded-full" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <span className="text-sm font-bold font-mono text-secondary">{fmtDuration(duration)}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary font-headline">{incomingInfo.callerName}</p>
                <p className="text-[10px] font-mono text-on-surface-variant">{incomingInfo.callerNumber}</p>
              </div>
            </div>
          ) : undefined
        }
      />

      {/* Incoming call overlay */}
      {callState === 'incoming' && (
        <IncomingCallNotification
          callerNumber={incomingInfo.callerNumber}
          callerName={incomingInfo.callerName}
          onAnswer={handleAccept}
          onDecline={handleReject}
        />
      )}

      {/* Ended overlay */}
      {showEnded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-3xl p-10 text-center shadow-ambient animate-slide-up max-w-sm">
            <div className="w-16 h-16 rounded-full bg-on-tertiary-container/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-on-tertiary-container text-[32px] material-symbols-filled">check_circle</span>
            </div>
            <h3 className="text-xl font-black font-headline text-primary mb-2">Call Ended</h3>
            <p className="text-on-surface-variant text-sm">Duration: {fmtDuration(duration)} · Summary being generated...</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {callState === 'waiting' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-on-surface-variant text-[48px]">headset_mic</span>
              </div>
              <h3 className="text-2xl font-black font-headline text-primary mb-3">Ready for Calls</h3>
              <p className="text-on-surface-variant mb-8">Your station is active and ready. Incoming calls will appear here automatically.</p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { icon: 'forum', label: 'Live Transcript', desc: 'Real-time speech-to-text' },
                  { icon: 'psychology', label: 'AI Assistance', desc: 'Context-aware suggestions' },
                  { icon: 'sentiment_satisfied', label: 'Sentiment', desc: 'Live emotion analysis' },
                ].map(f => (
                  <div key={f.label} className="bg-surface-container-low rounded-2xl p-4 text-center">
                    <span className="material-symbols-outlined text-primary text-2xl">{f.icon}</span>
                    <p className="text-xs font-bold text-primary mt-2 font-headline">{f.label}</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">{f.desc}</p>
                  </div>
                ))}
              </div>
              <div className="text-sm text-on-surface-variant">
                {twilioDevice.isReady ? (
                  <span className="text-on-tertiary-container font-bold">Device Ready · Waiting for incoming call...</span>
                ) : (
                  <span className="text-outline">Initializing Twilio device...</span>
                )}
              </div>
            </div>
          </div>
        )}

        {callState === 'active' && (
          <section className="flex flex-1 overflow-hidden p-6 gap-5">
            {/* ── LEFT: Live Transcript (65%) ── */}
            <div className="flex-[7] flex flex-col bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden">
              {/* Transcript Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary-container text-[22px]">forum</span>
                  <h3 className="font-headline font-bold text-lg text-primary">Live Transcript</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-on-tertiary-container live-dot"></span>
                  <span className="text-[10px] font-black text-on-tertiary-fixed-variant uppercase tracking-widest">AI Verified · Live</span>
                </div>
              </div>

              {/* Transcript Body */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-5 bg-surface-container-low/20">
                {liveTranscript.map(line => (
                  <div
                    key={line.id}
                    className={`flex flex-col animate-slide-up ${line.speaker === 'agent' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">{line.speakerName}</span>
                      <span className="text-[9px] text-outline">{line.timestamp}</span>
                      <span className={`text-[9px] font-bold capitalize flex items-center gap-0.5 ${sentimentColor[line.sentiment]}`}>
                        {sentimentEmoji[line.sentiment]} {line.sentiment}
                      </span>
                    </div>
                    <div className={line.speaker === 'agent' ? 'transcript-bubble-agent' : 'transcript-bubble-customer'}>
                      {line.keywords?.length ? (
                        <span>
                          {line.text.split(new RegExp(`(${line.keywords.join('|')})`, 'gi')).map((part, i) =>
                            line.keywords?.some(k => k.toLowerCase() === part.toLowerCase())
                              ? <mark key={i} className="bg-secondary-container/30 text-secondary font-bold px-0.5 rounded not-italic">{part}</mark>
                              : part
                          )}
                        </span>
                      ) : line.text}
                    </div>
                  </div>
                ))}

                {/* AI Suggestion Marker */}
                {showAiSuggestion && (
                  <div className="flex justify-center py-2 animate-fade-in">
                    <div className="gradient-primary text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm animate-pulse">psychology</span>
                      AI Suggestion: Initiate Remote ONT Reset
                    </div>
                  </div>
                )}

                <div ref={transcriptEndRef} />
              </div>

              {/* Agent Input */}
              <div className="p-4 bg-surface-container-low/50 border-t border-surface-container">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={agentInput}
                      onChange={e => setAgentInput(e.target.value)}
                      placeholder="Type a response or use '/' for macros..."
                      className="w-full bg-surface-container-lowest border-none rounded-full px-5 py-3 text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-card"
                    />
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">bolt</span>
                    </button>
                  </div>
                  <button className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-md hover:shadow-lg transition-all">
                    <span className="material-symbols-outlined text-white text-[20px]">send</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── RIGHT: AI Assistance Panel (35%) ── */}
            <div className="flex-[3] flex flex-col gap-4 overflow-y-auto scrollbar-thin min-h-0">
              {/* Sentiment Gauge */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-card p-5">
                <h4 className="font-headline font-bold text-sm text-primary mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">mood</span>
                  Live Sentiment
                </h4>
                <div className="space-y-2">
                  {(['positive', 'neutral', 'negative', 'frustrated'] as SentimentLevel[]).map(s => {
                    const pct = s === 'frustrated' ? 45 : s === 'neutral' ? 30 : s === 'negative' ? 15 : 10;
                    const clr = s === 'positive' ? '#4ebe42' : s === 'neutral' ? '#747683' : s === 'negative' ? '#ba1a1a' : '#fe6b00';
                    return (
                      <div key={s}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] font-medium capitalize text-on-surface-variant">{sentimentEmoji[s]} {s}</span>
                          <span className="text-[11px] font-bold" style={{ color: clr }}>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: clr }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Issue Detection */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-card p-5">
                <h4 className="font-headline font-bold text-sm text-primary mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[18px]">warning</span>
                  Issues Detected
                </h4>
                <div className="space-y-2">
                  {(activeCallData?.issues.length
                    ? activeCallData.issues
                    : ['Internet Connectivity Loss', 'Billing Late Fee Dispute']
                  ).map(issue => (
                    <div key={issue} className="flex items-center gap-2 px-3 py-2 bg-error-container/20 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0"></span>
                      <span className="text-xs text-on-error-container font-medium">{issue}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smart Knowledge Base */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden flex flex-col flex-1 min-h-[320px]">
                <div className="p-5 gradient-primary text-white">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-headline font-bold text-sm uppercase tracking-widest">Smart Knowledge</h4>
                    <span className="material-symbols-outlined text-lg material-symbols-filled">lightbulb</span>
                  </div>
                  <p className="text-[10px] text-white/70">Updating based on live transcript...</p>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto scrollbar-thin flex-1 min-h-0">
                  {knowledgeArticles.map(article => (
                    <button
                      key={article.id}
                      onClick={() => setActiveKnowledge(activeKnowledge === article.id ? null : article.id)}
                      className={`w-full text-left p-4 rounded-xl border-l-4 transition-all hover:translate-x-1 ${
                        article.relevanceScore >= 90
                          ? 'bg-surface-container-high border-secondary'
                          : article.relevanceScore >= 80
                          ? 'bg-surface-container border-primary-container'
                          : 'bg-surface-container border-outline-variant'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] font-black text-secondary uppercase tracking-tighter">
                          {article.relevanceScore >= 90 ? 'Recommended' : article.relevanceScore >= 80 ? 'Applicable' : 'Related'} · {article.relevanceScore}%
                        </span>
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                          {activeKnowledge === article.id ? 'expand_less' : 'open_in_new'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-primary">{article.title}</p>
                      {activeKnowledge === article.id && (
                        <p className="text-[11px] text-on-surface-variant leading-relaxed mt-2 animate-fade-in">{article.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Context */}
              <div className="bg-surface-container-high rounded-2xl p-5">
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-3">Customer Context</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Customer', value: incomingInfo.callerName || 'Unknown' },
                    { label: 'Call ID', value: incomingInfo.callId },
                    { label: 'Priority', value: incomingInfo.priority.toUpperCase() },
                    { label: 'Queue Time', value: incomingInfo.queueTime },
                  ].map(c => (
                    <div key={c.label} className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-card">
                      <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">{c.label}</p>
                      <p className="text-xs font-bold text-primary truncate">{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Call Controls Footer ── */}
        {callState === 'active' && (
          <footer className="h-24 bg-surface-container-lowest border-t border-surface-container flex items-center justify-between px-10 flex-shrink-0">
            {/* Left controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleMute}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${isMuted ? 'bg-error/10 text-error' : 'hover:bg-surface-container text-on-surface-variant hover:text-primary'}`}
              >
                <span className="material-symbols-outlined text-[24px]">{isMuted ? 'mic_off' : 'mic'}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button
                onClick={() => setIsOnHold(!isOnHold)}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${isOnHold ? 'bg-secondary/10 text-secondary' : 'hover:bg-surface-container text-on-surface-variant hover:text-primary'}`}
              >
                <span className="material-symbols-outlined text-[24px]">{isOnHold ? 'play_circle' : 'pause_circle'}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">{isOnHold ? 'Resume' : 'Hold'}</span>
              </button>
              <button className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-surface-container text-on-surface-variant hover:text-primary transition-all">
                <span className="material-symbols-outlined text-[24px]">transfer_within_a_station</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Transfer</span>
              </button>
              <button className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-surface-container text-on-surface-variant hover:text-primary transition-all">
                <span className="material-symbols-outlined text-[24px]">record_voice_over</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Conference</span>
              </button>
            </div>

            {/* Center: Live indicator */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5 items-end h-6">
                  {[1, 2, 3, 4, 5, 4, 3].map((_h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-secondary rounded-full wave-bar"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
                <span className="text-2xl font-black font-mono text-secondary">{fmtDuration(duration)}</span>
                <div className="flex gap-0.5 items-end h-6">
                  {[3, 4, 5, 4, 3, 2, 1].map((_h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-secondary rounded-full wave-bar"
                      style={{ animationDelay: `${(i + 4) * 0.1}s` }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Live Call Active</p>
            </div>

            {/* Right: End Call */}
            <div className="flex items-center gap-3">
              <button className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-surface-container text-on-surface-variant hover:text-primary transition-all">
                <span className="material-symbols-outlined text-[24px]">dialpad</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Keypad</span>
              </button>
              <button className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-surface-container text-on-surface-variant hover:text-primary transition-all">
                <span className="material-symbols-outlined text-[24px]">note_add</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Note</span>
              </button>
              <button
                onClick={handleEndCall}
                className="flex items-center gap-2 px-6 py-3 bg-error text-white rounded-full font-bold font-headline hover:bg-error/90 hover:shadow-lg transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[22px]">call_end</span>
                End Call
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
