import { useState, useEffect, useMemo } from 'react';
import { useDashboardWs } from './hooks/useDashboardWs';
import { useTwilioDevice } from './hooks/useTwilioDevice';
import { SessionList } from './components/SessionList';
import { CallHeader } from './components/CallHeader';
import { SentimentAnalysis } from './components/SentimentAnalysis';
import { CallTranscript } from './components/CallTranscript';
import { AgentAssist } from './components/AgentAssist';
import { AgentPhone } from './components/AgentPhone';

function App() {
  const { calls, transcripts, connected } = useDashboardWs();
  const twilioDevice = useTwilioDevice();
  const [selectedCallSid, setSelectedCallSid] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showAgentTranscripts, setShowAgentTranscripts] = useState(true);
  const [enableTranslation, setEnableTranslation] = useState(false);
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

  // Suppress unused variable warning — enableTranslation is UI-only state for now
  void enableTranslation;

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
              <span className="toggle-label">Auto Scroll</span>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
            <label className="toggle-switch">
              <span className="toggle-label">Show Agent Transcripts?</span>
              <input
                type="checkbox"
                checked={showAgentTranscripts}
                onChange={(e) => setShowAgentTranscripts(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
            <label className="toggle-switch">
              <span className="toggle-label">Enable Translation</span>
              <input
                type="checkbox"
                checked={enableTranslation}
                onChange={(e) => setEnableTranslation(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <CallTranscript
            segments={selectedTranscripts}
            autoScroll={autoScroll}
            showAgentTranscripts={showAgentTranscripts}
          />
        </main>

        <aside className="agent-assist-panel">
          <AgentPhone
            isReady={twilioDevice.isReady}
            incomingCall={twilioDevice.incomingCall}
            activeCall={twilioDevice.activeCall}
            acceptCall={twilioDevice.acceptCall}
            rejectCall={twilioDevice.rejectCall}
            hangUp={twilioDevice.hangUp}
            toggleMute={twilioDevice.toggleMute}
            isMuted={twilioDevice.isMuted}
            callerNumber={twilioDevice.callerNumber}
            callDuration={twilioDevice.callDuration}
          />
          <AgentAssist />
        </aside>
      </div>
    </div>
  );
}

export default App;
