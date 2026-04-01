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
    <div className="agent-phone">
      <div className="agent-phone-header">
        <h3>Agent Phone</h3>
        <span className={`agent-phone-status ${isReady ? 'agent-phone-status-ready' : 'agent-phone-status-offline'}`}>
          <span className="agent-phone-status-dot" />
          {isReady ? 'Ready' : 'Offline'}
        </span>
      </div>

      {!isRinging && !isOnCall && (
        <div className="agent-phone-idle">
          Waiting for calls...
        </div>
      )}

      {isRinging && (
        <div className="agent-phone-ringing">
          <div className="agent-phone-ring-indicator" />
          <div className="agent-phone-caller">
            <span className="agent-phone-caller-label">Incoming Call</span>
            <span className="agent-phone-caller-number">{callerNumber}</span>
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
            <span className="agent-phone-caller-number">{callerNumber}</span>
            <span className="agent-phone-duration">{formatDuration(callDuration)}</span>
          </div>
          <div className="agent-phone-actions">
            <button
              className={`agent-phone-btn agent-phone-btn-mute ${isMuted ? 'agent-phone-btn-mute-active' : ''}`}
              onClick={toggleMute}
            >
              {isMuted ? 'Unmute' : 'Mute'}
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
