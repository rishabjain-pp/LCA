import type { CallInfo } from '../types';

interface SessionListProps {
  calls: CallInfo[];
  selectedCallSid: string | null;
  onSelectCall: (callSid: string) => void;
  durations: Map<string, number>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatPhoneNumber(num: string): string {
  const match = num.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
  return num || 'Unknown Caller';
}

export function SessionList({ calls, selectedCallSid, onSelectCall, durations }: SessionListProps) {
  const activeCalls = calls.filter(c => c.status === 'active');
  const endedCalls = calls.filter(c => c.status === 'ended');

  return (
    <div className="session-list">
      <div className="session-list-header">
        <h2>Call List</h2>
        <span className="call-count">{activeCalls.length} active</span>
      </div>

      {calls.length === 0 && (
        <div className="session-list-empty">
          No calls yet. Waiting for incoming calls...
        </div>
      )}

      {activeCalls.length > 0 && (
        <div className="session-group">
          <div className="session-group-label">Active Calls</div>
          {activeCalls.map(call => (
            <CallCard
              key={call.callSid}
              call={call}
              selected={call.callSid === selectedCallSid}
              duration={durations.get(call.callSid) ?? 0}
              onClick={() => onSelectCall(call.callSid)}
            />
          ))}
        </div>
      )}

      {endedCalls.length > 0 && (
        <div className="session-group">
          <div className="session-group-label">Ended Calls</div>
          {endedCalls.map(call => (
            <CallCard
              key={call.callSid}
              call={call}
              selected={call.callSid === selectedCallSid}
              duration={durations.get(call.callSid) ?? 0}
              onClick={() => onSelectCall(call.callSid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CallCard({ call, selected, duration, onClick }: {
  call: CallInfo;
  selected: boolean;
  duration: number;
  onClick: () => void;
}) {
  return (
    <div
      className={`call-card ${selected ? 'call-card-selected' : ''} ${call.status === 'active' ? 'call-card-active' : ''}`}
      onClick={onClick}
    >
      <div className="call-card-top">
        <span className="call-card-number">
          {call.status === 'active' && <span className="call-card-phone-icon">{'\uD83D\uDCDE'}</span>}
          {formatPhoneNumber(call.callerNumber)}
        </span>
        <span className={`status-badge status-${call.status}`}>
          {call.status === 'active' ? 'Active' : 'Ended'}
        </span>
      </div>
      <div className="call-card-bottom">
        <span className="call-card-id">{call.callSid.slice(0, 12)}...</span>
        <span className="call-card-duration">{formatDuration(duration)}</span>
      </div>
    </div>
  );
}
