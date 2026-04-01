import { useState, useEffect, useCallback } from 'react';

interface Session {
  streamSid: string;
  status: string;
}

interface ServerHealth {
  status: string;
}

interface SessionsResponse {
  sessions: Session[];
  count: number;
}

function App() {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/health');
      const data: ServerHealth = await res.json();
      setHealth(data);
      setError(null);
    } catch {
      setHealth(null);
      setError('Cannot reach server');
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      const data: SessionsResponse = await res.json();
      setSessions(data.sessions);
      setSessionCount(data.count);
      setLastUpdated(new Date());
    } catch {
      // Server might be down
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchSessions();
    const healthInterval = setInterval(fetchHealth, 5000);
    const sessionsInterval = setInterval(fetchSessions, 2000);
    return () => {
      clearInterval(healthInterval);
      clearInterval(sessionsInterval);
    };
  }, [fetchHealth, fetchSessions]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
          LCA Relay Dashboard
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Twilio Media Streams to AWS Live Call Analytics
        </p>
      </header>

      {/* Server Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <StatusCard
          title="Server Status"
          value={health?.status === 'ok' ? 'Online' : 'Offline'}
          color={health?.status === 'ok' ? '#10b981' : '#ef4444'}
        />
        <StatusCard
          title="Active Calls"
          value={String(sessionCount)}
          color="#3b82f6"
        />
        <StatusCard
          title="Last Updated"
          value={lastUpdated ? lastUpdated.toLocaleTimeString() : '--'}
          color="#6b7280"
        />
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Architecture Diagram */}
      <section style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        padding: '20px',
        marginBottom: '24px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Call Flow
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          fontSize: '13px',
          fontFamily: 'monospace',
        }}>
          <FlowStep label="Phone Call" active={sessionCount > 0} />
          <Arrow />
          <FlowStep label="Twilio" active={sessionCount > 0} />
          <Arrow />
          <FlowStep label="Relay Server" active={health?.status === 'ok'} />
          <Arrow />
          <FlowStep label="AWS LCA" active={sessionCount > 0} />
          <Arrow />
          <FlowStep label="Dashboard" active={sessionCount > 0} />
        </div>
      </section>

      {/* Active Sessions */}
      <section style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        padding: '20px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Active Sessions
        </h2>
        {sessions.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
            No active calls. Call your Twilio number to see sessions appear here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sessions.map((session) => (
              <div
                key={session.streamSid}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  {session.streamSid}
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#16a34a',
                  textTransform: 'uppercase',
                }}>
                  {session.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Setup Instructions */}
      <section style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        padding: '20px',
        marginTop: '24px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          Quick Start
        </h2>
        <ol style={{ paddingLeft: '20px', fontSize: '14px', color: '#374151', lineHeight: 2 }}>
          <li>Configure <code>.env</code> with your LCA endpoint and Twilio settings</li>
          <li>Start the server: <code>npm run dev</code></li>
          <li>Run ngrok: <code>ngrok http 8080</code></li>
          <li>Set Twilio webhook to <code>POST https://&lt;ngrok-id&gt;.ngrok.io/twiml</code></li>
          <li>Call your Twilio number — sessions will appear above</li>
        </ol>
      </section>
    </div>
  );
}

function StatusCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      padding: '16px',
    }}>
      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function FlowStep({ label, active }: { label: string; active?: boolean }) {
  return (
    <div style={{
      padding: '8px 14px',
      borderRadius: '6px',
      backgroundColor: active ? '#dbeafe' : '#f3f4f6',
      border: `1px solid ${active ? '#93c5fd' : '#d1d5db'}`,
      color: active ? '#1d4ed8' : '#6b7280',
      fontWeight: active ? 600 : 400,
    }}>
      {label}
    </div>
  );
}

function Arrow() {
  return <span style={{ color: '#9ca3af' }}>{'\u2192'}</span>;
}

export default App;
