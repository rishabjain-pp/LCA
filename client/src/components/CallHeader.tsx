import type { CallInfo } from '../types';

interface CallHeaderProps {
  call: CallInfo | null;
  duration: number;
  connected: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallHeader({ call, duration, connected }: CallHeaderProps) {
  if (!call) {
    return (
      <div className="call-header call-header-empty">
        <span className="call-header-placeholder">Select a call to view details</span>
      </div>
    );
  }

  const callerDisplay = call.callerNumber || 'Unknown Caller';
  const calledDisplay = call.calledNumber || 'Support Line';

  return (
    <div className="call-header">
      <div className="call-header-info">
        <div className="call-header-numbers">
          <span className="call-header-caller">{callerDisplay}</span>
          <span className="call-header-arrow">&rarr;</span>
          <span className="call-header-called">{calledDisplay}</span>
        </div>
        <hr className="call-header-divider" />
        <div className="call-header-meta">
          <span className={`status-badge status-${call.status}`}>
            {call.status === 'active' ? 'Active' : 'Ended'}
          </span>
          <span className="call-header-duration">{formatDuration(duration)}</span>
          <span className="call-header-sid">SID: {call.callSid}</span>
        </div>
      </div>
      <div className="connection-status">
        <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
        <span className="connection-label">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </div>
  );
}
