import type { Call } from '@twilio/voice-sdk';

interface AgentPhoneProps {
  isReady: boolean;
  incomingCall: Call | null;
  activeCall: Call | null;
  acceptCall: () => void;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  isMuted: boolean;
  callerNumber: string;
  callDuration: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AgentPhone({
  isReady,
  incomingCall,
  activeCall,
  acceptCall,
  rejectCall,
  hangUp,
  toggleMute,
  isMuted,
  callerNumber,
  callDuration,
}: AgentPhoneProps) {
  const isRinging = incomingCall !== null && activeCall === null;
  const isOnCall = activeCall !== null;

  return (
    <div className={`agent-phone ${isRinging ? 'agent-phone-ringing-state' : ''} ${isOnCall ? 'agent-phone-active-state' : ''}`}>
      <div className="agent-phone-header">
        <h3>Agent Phone</h3>
        <span className={`agent-phone-status ${isReady ? 'agent-phone-status-ready' : 'agent-phone-status-offline'}`}>
          <span className="agent-phone-status-dot" />
          {isReady ? 'Ready' : 'Offline'}
        </span>
      </div>

      {!isRinging && !isOnCall && (
        <div className="agent-phone-idle">
          <div className="agent-phone-idle-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="19" stroke="#d1d5db" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M15 17c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2h-6a2 2 0 01-2-2v-6z" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
              <path d="M18 20h4M20 18v4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="agent-phone-idle-text">Waiting for incoming calls</span>
          <span className="agent-phone-idle-hint">Calls will ring here automatically</span>
        </div>
      )}

      {isRinging && (
        <div className="agent-phone-ringing">
          <div className="agent-phone-ring-indicator" />
          <div className="agent-phone-caller">
            <span className="agent-phone-caller-label">Incoming Call</span>
            <span className="agent-phone-caller-number">{callerNumber || 'Unknown Number'}</span>
          </div>
          <div className="agent-phone-actions">
            <button className="agent-phone-btn agent-phone-btn-accept" onClick={acceptCall}>
              Accept
            </button>
            <button className="agent-phone-btn agent-phone-btn-reject" onClick={rejectCall}>
              Reject
            </button>
          </div>
        </div>
      )}

      {isOnCall && (
        <div className="agent-phone-active">
          <div className="agent-phone-active-indicator">
            <span className="agent-phone-active-dot" />
            <span className="agent-phone-active-label">Active Call</span>
          </div>
          <div className="agent-phone-caller">
            <span className="agent-phone-caller-number">{callerNumber || 'Unknown Number'}</span>
            <span className="agent-phone-duration">{formatDuration(callDuration)}</span>
          </div>
          <div className="agent-phone-actions agent-phone-actions-active">
            <button
              className={`agent-phone-btn agent-phone-btn-mute ${isMuted ? 'agent-phone-btn-mute-active' : ''}`}
              onClick={toggleMute}
            >
              {isMuted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
            <button className="agent-phone-btn agent-phone-btn-hangup" onClick={hangUp}>
              Hang Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
