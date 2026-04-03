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
  const durationIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        const apiBase = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/token`);
        const { token } = await res.json() as { token: string };

        if (destroyed) return;

        const device = new Device(token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          logLevel: 1,
        });

        device.on('registered', () => setIsReady(true));
        device.on('unregistered', () => setIsReady(false));

        device.on('incoming', (call: Call) => {
          setIncomingCall(call);
          setCallerNumber(call.parameters.From || 'Unknown');

          call.on('accept', () => {
            setActiveCall(call);
            setIncomingCall(null);
            const start = Date.now();
            durationIntervalRef.current = window.setInterval(() => {
              setCallDuration(Math.floor((Date.now() - start) / 1000));
            }, 1000);
          });

          call.on('disconnect', () => {
            setActiveCall(null);
            setIncomingCall(null);
            setCallDuration(0);
            setIsMuted(false);
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
          });

          call.on('cancel', () => setIncomingCall(null));
        });

        await device.register();
        deviceRef.current = device;
      } catch (err) {
        console.error('Failed to initialize Twilio Device:', err);
      }
    }

    void init();

    return () => {
      destroyed = true;
      deviceRef.current?.destroy();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  const acceptCall = useCallback(() => { incomingCall?.accept(); }, [incomingCall]);
  const rejectCall = useCallback(() => { incomingCall?.reject(); setIncomingCall(null); }, [incomingCall]);
  const hangUp = useCallback(() => {
    activeCall?.disconnect();
    setActiveCall(null);
    setCallDuration(0);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
  }, [activeCall]);
  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [activeCall, isMuted]);

  return { isReady, incomingCall, activeCall, acceptCall, rejectCall, hangUp, toggleMute, isMuted, callerNumber, callDuration };
}
