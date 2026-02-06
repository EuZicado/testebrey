import { createContext, useContext, ReactNode, useEffect } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useCallSounds } from "@/hooks/useCallSounds";
import { useAuth } from "@/hooks/useAuth";
import { ActiveCall, IncomingCall, CallMessage, CallType } from "@/types/calls";

interface CallContextType {
  activeCall: ActiveCall | null;
  incomingCall: IncomingCall | null;
  callMessages: CallMessage[];
  isConnecting: boolean;
  connectionQuality: 'good' | 'poor' | 'bad';
  startCall: (conversationId: string, calleeId: string, callType: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  sendCallMessage: (content: string) => Promise<void>;
  switchCamera: () => Promise<void>;
}

const CallContext = createContext<CallContextType | null>(null);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const webRTC = useWebRTC();
  const { user } = useAuth();
  const { 
    playConnecting, 
    playConnected, 
    playEnded, 
    playRingtone,
    stopAllSounds,
    vibrateShort 
  } = useCallSounds();

  const { activeCall, incomingCall } = webRTC;

  // Gerenciamento Centralizado de Sons
  useEffect(() => {
    // 1. Chamada Recebida (Ringing)
    if (incomingCall) {
      playRingtone();
      vibrateShort();
    } 
    // 2. Chamada Ativa (Status change)
    else if (activeCall) {
      const status = activeCall.session.status;
      
      if (status === 'ringing' || status === 'initiating') {
        // Se eu sou o caller, toca som de chamando
        if (activeCall.session.caller_id === user?.id) {
           playConnecting();
        }
      } else if (status === 'connected') {
        stopAllSounds();
        playConnected(); // Beep de conectado
        vibrateShort();
      } else if (status === 'ended' || status === 'rejected') {
        playEnded();
        setTimeout(stopAllSounds, 1000);
      }
    } 
    // 3. Sem chamada
    else {
      stopAllSounds();
    }

    return () => {
       // Cleanup sounds on unmount or state change if needed
       // Mas cuidado para não parar o som prematuramente se o state mudar rápido
    };
  }, [incomingCall, activeCall?.session.status, activeCall?.session.caller_id, user?.id, playRingtone, playConnecting, playConnected, playEnded, stopAllSounds, vibrateShort]);

  // Efeito para parar sons quando a chamada termina e activeCall vira null
  useEffect(() => {
     if (!activeCall && !incomingCall) {
         stopAllSounds();
     }
  }, [activeCall, incomingCall, stopAllSounds]);

  return (
    <CallContext.Provider value={webRTC}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
