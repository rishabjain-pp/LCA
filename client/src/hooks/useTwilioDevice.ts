import { useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';

interface UseTwilioDeviceReturn {
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

export function useTwilioDevice(): UseTwilioDeviceReturn {
  const [isReady, setIsReady] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callerNumber, setCallerNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const deviceRef = useRef<Device | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        const res = await fetch('/api/token');
        const data: { token: string } = await res.json();

        if (destroyed) return;

        const device = new Device(data.token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          logLevel: 'warn',
        });

        device.on('registered', () => {
          if (!destroyed) setIsReady(true);
        });

        device.on('unregistered', () => {
          if (!destroyed) setIsReady(false);
        });

        device.on('incoming', (call: Call) => {
          if (destroyed) return;

          setIncomingCall(call);
          setCallerNumber(call.parameters['From'] || 'Unknown');

          call.on('accept', () => {
            if (destroyed) return;
            setActiveCall(call);
            setIncomingCall(null);
            const start = Date.now();
            durationIntervalRef.current = setInterval(() => {
              setCallDuration(Math.floor((Date.now() - start) / 1000));
            }, 1000);
          });

          call.on('disconnect', () => {
            if (destroyed) return;
            setActiveCall(null);
            setIncomingCall(null);
            setCallDuration(0);
            setIsMuted(false);
            if (durationIntervalRef.current) {
              clearInterval(durationIntervalRef.current);
              durationIntervalRef.current = null;
            }
          });

          call.on('cancel', () => {
            if (destroyed) return;
            setIncomingCall(null);
          });
        });

        await device.register();
        deviceRef.current = device;
      } catch (err) {
        console.error('Failed to initialize Twilio Device:', err);
      }
    }

    init();

    return () => {
      destroyed = true;
      deviceRef.current?.destroy();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  const acceptCall = useCallback(() => {
    incomingCall?.accept();
  }, [incomingCall]);

  const rejectCall = useCallback(() => {
    incomingCall?.reject();
    setIncomingCall(null);
  }, [incomingCall]);

  const hangUp = useCallback(() => {
    activeCall?.disconnect();
    setActiveCall(null);
    setCallDuration(0);
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [activeCall, isMuted]);

  return {
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
  };
}
