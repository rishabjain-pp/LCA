import { useState, useEffect, useMemo } from 'react';
import { useDashboardWs } from './hooks/useDashboardWs';
import { SessionList } from './components/SessionList';
import { CallHeader } from './components/CallHeader';
import { SentimentAnalysis } from './components/SentimentAnalysis';
import { CallTranscript } from './components/CallTranscript';
import { AgentAssist } from './components/AgentAssist';

function App() {
  const { calls, transcripts, connected } = useDashboardWs();
  const [selectedCallSid, setSelectedCallSid] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showAgentTranscripts, setShowAgentTranscripts] = useState(true);
  const [durations, setDurations] = useState<Map<string, number>>(new Map());

  const callList = useMemo(() => Array.from(calls.values()), [calls]);

  // Auto-select newest active call when calls change
  useEffect(() => {
    if (selectedCallSid && calls.has(selectedCallSid)) return;
    const activeCalls = callList.filter(c => c.status === 'active');
    if (activeCalls.length > 0) {
      setSelectedCallSid(activeCalls[activeCalls.length - 1].callSid);
    } else if (callList.length > 0) {
      setSelectedCallSid(callList[callList.length - 1].callSid);
    }
  }, [callList, selectedCallSid, calls]);

  // Duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setDurations(() => {
        const next = new Map<string, number>();
        const now = Date.now();
        for (const call of calls.values()) {
          const start = new Date(call.startTime).getTime();
          next.set(call.callSid, (now - start) / 1000);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [calls]);

  const selectedCall = selectedCallSid ? calls.get(selectedCallSid) ?? null : null;
  const selectedTranscripts = selectedCallSid ? transcripts.get(selectedCallSid) ?? [] : [];
  const selectedDuration = selectedCallSid ? durations.get(selectedCallSid) ?? 0 : 0;

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-title-group">
            <h1 className="header-title">Live Call Analytics</h1>
            <span className="header-subtitle">with Agent Assist</span>
          </div>
          <div className="header-right">
            <span className={`header-status ${connected ? 'header-status-connected' : 'header-status-disconnected'}`}>
              <span className="header-status-dot" />
              {connected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <SessionList
            calls={callList}
            selectedCallSid={selectedCallSid}
            onSelectCall={setSelectedCallSid}
            durations={durations}
          />
        </aside>

        <main className="content">
          <CallHeader
            call={selectedCall}
            duration={selectedDuration}
            connected={connected}
          />
          <SentimentAnalysis segments={selectedTranscripts} />

          <div className="transcript-controls">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              <span className="toggle-slider" />
              <span className="toggle-label">Auto Scroll</span>
            </label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showAgentTranscripts}
                onChange={(e) => setShowAgentTranscripts(e.target.checked)}
              />
              <span className="toggle-slider" />
              <span className="toggle-label">Show Agent Transcripts?</span>
            </label>
          </div>

          <CallTranscript
            segments={selectedTranscripts}
            autoScroll={autoScroll}
            showAgentTranscripts={showAgentTranscripts}
          />
        </main>

        <aside className="agent-assist-panel">
          <AgentAssist />
        </aside>
      </div>
    </div>
  );
}

export default App;
