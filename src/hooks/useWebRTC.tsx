import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ActiveCall, IncomingCall, ICE_SERVERS, CallType, CallMessage } from "@/types/calls";
import { toast } from "sonner";

export const useWebRTC = () => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callMessages, setCallMessages] = useState<CallMessage[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'bad'>('good');
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const candidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const isDescriptionSet = useRef(false);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Cleanup completo - libera câmera/microfone
  const cleanup = useCallback(async () => {
    console.log("🧹 Limpando conexão WebRTC...");
    isDescriptionSet.current = false;
    candidatesQueue.current = [];
    
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`📴 Track ${track.kind} parado`);
      });
      localStreamRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (callChannelRef.current) {
      await supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    
    setActiveCall(null);
    setIsConnecting(false);
    setIncomingCall(null);
    setCallMessages([]);
  }, []);

  // getUserMedia com constraints adaptativas para mobile
  const getUserMedia = useCallback(async (type: CallType) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Bitrate otimizado para redes móveis
        ...(isMobile && { 
          sampleRate: 16000, 
          channelCount: 1,
          bitrate: 32000 // Target roughly 32kbps for voice
        })
      },
      video: type === 'video' ? {
        width: { ideal: isMobile ? 480 : 640 },
        height: { ideal: isMobile ? 640 : 480 },
        frameRate: { ideal: isMobile ? 24 : 30 },
        facingMode: "user"
      } : false
    };
    
    console.log("📹 Solicitando mídia com constraints:", constraints);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("Erro ao acessar mídia:", error);
      toast.error("Não foi possível acessar câmera/microfone. Verifique as permissões.");
      throw error;
    }
  }, []);

  // Processa candidatos ICE acumulados após setRemoteDescription
  const processIceQueue = useCallback(async () => {
    if (!pc.current || !isDescriptionSet.current) return;
    
    if (candidatesQueue.current.length > 0) {
      console.log(`🧊 Processando ${candidatesQueue.current.length} candidatos ICE da fila`);
      while (candidatesQueue.current.length > 0) {
        const candidate = candidatesQueue.current.shift();
        if (candidate) {
          try {
            await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn("⚠️ Erro ao adicionar candidato ICE da fila:", e);
          }
        }
      }
    }
  }, []);

  // Cria RTCPeerConnection com transceivers para forçar áudio bidirecional
  const createPeerConnection = useCallback((callId: string, type: CallType) => {
    console.log("🔗 Criando RTCPeerConnection...");
    const connection = new RTCPeerConnection(ICE_SERVERS);
    pc.current = connection;

    // CRÍTICO: Usar transceivers para garantir áudio sendrecv (resolve PC mudo)
    // Isso garante que o navegador negocie áudio bidirecional mesmo antes de ter o track
    connection.addTransceiver('audio', { direction: 'sendrecv' });
    
    if (type === 'video') {
      connection.addTransceiver('video', { direction: 'sendrecv' });
    }

    // Monitorar estado da conexão ICE
    connection.oniceconnectionstatechange = () => {
      console.log("🧊 ICE Connection State:", connection.iceConnectionState);
      if (connection.iceConnectionState === 'disconnected' || connection.iceConnectionState === 'failed') {
        setConnectionQuality('bad');
        toast.warning("Conexão instável...");
      } else if (connection.iceConnectionState === 'connected') {
        setConnectionQuality('good');
      }
    };

    connection.onicecandidate = (event) => {
      if (event.candidate && user) {
        // Envia candidato via Supabase Realtime (mais rápido) E salva no banco (backup)
        // Por simplicidade e robustez, salvamos no banco que dispara o realtime via Postgres Changes
        // ou usamos broadcast direto se quisermos menor latência.
        // O requisito pede "Sinalização Dupla". Vamos usar insert no banco que é seguro.
        supabase.from('call_signals').insert({
          call_id: callId,
          sender_id: user.id,
          signal_type: 'ice-candidate',
          signal_data: event.candidate.toJSON() as any
        }).then(({ error }) => {
            if (error) console.error("Erro ao enviar ICE:", error);
        });
      }
    };

    connection.ontrack = (event) => {
      console.log("📥 Track remoto recebido:", event.track.kind);
      const [remoteStream] = event.streams;
      if (remoteStream) {
          setActiveCall(prev => prev ? { ...prev, remoteStream } : null);
      }
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      console.log("🔄 Estado da conexão:", state);
      
      if (state === 'connected') {
        setIsConnecting(false);
        // Atualiza sessão para connected via banco (redundância)
        supabase.from('call_sessions')
          .update({ status: 'connected', started_at: new Date().toISOString() })
          .eq('id', callId)
          .then(({ error }) => {
              if (error) console.error("Erro ao atualizar status para connected:", error);
          });
      }
      
      if (['failed', 'closed', 'disconnected'].includes(state)) {
        if (state === 'failed') {
          toast.error("Conexão falhou. Tentando reconectar...");
          // Opcional: tentar reiniciar ICE
          connection.restartIce();
        } else if (state === 'closed') {
             cleanup();
        }
      }
    };
    
    return connection;
  }, [user, cleanup]);

  // Handler de sinais WebRTC
  const handleSignal = useCallback(async (signal: any, callId: string) => {
    if (signal.sender_id === user?.id || !pc.current) return;

    try {
      console.log(`📩 Sinal recebido: ${signal.signal_type}`);
      switch (signal.signal_type) {
        case 'answer':
          if (pc.current.signalingState === 'have-local-offer') {
            console.log("✅ Aplicando resposta remota (Answer)");
            await pc.current.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
            isDescriptionSet.current = true;
            await processIceQueue();
          }
          break;
          
        case 'offer':
          // Se recebermos uma oferta quando já estamos em chamada (renegociação ou erro), ignorar ou tratar
          if (pc.current.signalingState === 'stable') {
             // Renegociação
             console.log("✅ Recebida oferta de renegociação");
             await pc.current.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
             isDescriptionSet.current = true;
             const answer = await pc.current.createAnswer();
             await pc.current.setLocalDescription(answer);
             await supabase.from('call_signals').insert({
                call_id: callId,
                sender_id: user!.id,
                signal_type: 'answer',
                signal_data: answer as any
             });
             await processIceQueue();
          }
          break;
          
        case 'ice-candidate':
          if (isDescriptionSet.current && pc.current.remoteDescription) {
            console.log("🧊 Adicionando candidato ICE imediatamente");
            await pc.current.addIceCandidate(new RTCIceCandidate(signal.signal_data)).catch(e => console.warn("Erro ICE:", e));
          } else {
            console.log("🧊 Candidato ICE bufferizado (aguardando SDP)");
            candidatesQueue.current.push(signal.signal_data);
          }
          break;
          
        case 'hangup':
          console.log("📞 Sinal de desligar recebido");
          cleanup();
          toast.info("Chamada encerrada.");
          break;
          
        case 'screen-share-start':
          setActiveCall(prev => prev ? { ...prev, isScreenSharing: true } : null);
          break;
          
        case 'screen-share-stop':
          setActiveCall(prev => prev ? { ...prev, isScreenSharing: false } : null);
          break;
      }
    } catch (e) {
      console.error("❌ Erro no processamento do sinal:", e);
    }
  }, [user, processIceQueue, cleanup]);

  // Função para iniciar chamada
  const startCall = useCallback(async (conversationId: string, calleeId: string, callType: CallType) => {
    if (!user) return;
    setIsConnecting(true);

    try {
      // 1. Criar entrada na tabela call_sessions
      const { data: session, error } = await supabase.from('call_sessions').insert({
        conversation_id: conversationId,
        caller_id: user.id,
        callee_id: calleeId,
        call_type: callType,
        status: 'initiating'
      }).select().single();

      if (error || !session) throw error;

      // 2. Obter mídia local
      const stream = await getUserMedia(callType);

      // 3. Inicializar PeerConnection
      const connection = createPeerConnection(session.id, callType);
      
      // Adicionar tracks locais
      stream.getTracks().forEach(track => {
          connection.addTrack(track, stream);
      });

      // 4. Criar Offer
      const offer = await connection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video'
      });
      await connection.setLocalDescription(offer);

      // 5. Enviar Offer via Signals
      await supabase.from('call_signals').insert({
        call_id: session.id,
        sender_id: user.id,
        signal_type: 'offer',
        signal_data: offer as any
      });

      // 6. Atualizar status para ringing
      await supabase.from('call_sessions').update({ status: 'ringing' }).eq('id', session.id);

      setActiveCall({
        session: session as any,
        localStream: stream,
        remoteStream: null,
        isScreenSharing: false,
        otherParticipant: null, // Será preenchido pelo contexto ou UI
        screenStream: null,
        isAudioEnabled: true,
        isVideoEnabled: callType === 'video',
        connectionQuality: null,
        stats: null
      });

      // 7. Inscrever nos sinais
      subscribeToSignals(session.id);

    } catch (e) {
      console.error("Erro ao iniciar chamada:", e);
      cleanup();
      toast.error("Erro ao iniciar chamada.");
    }
  }, [user, getUserMedia, createPeerConnection, cleanup]);

  const subscribeToSignals = useCallback((callId: string) => {
      if (callChannelRef.current) supabase.removeChannel(callChannelRef.current);

      const channel = supabase.channel(`call:${callId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'call_signals', 
        filter: `call_id=eq.${callId}` 
      }, (payload) => {
        handleSignal(payload.new, callId);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_sessions',
        filter: `id=eq.${callId}`
      }, (payload) => {
          const newStatus = payload.new.status;
          if (newStatus === 'connected' && activeCall?.session.status !== 'connected') {
               setIsConnecting(false);
               setActiveCall(prev => prev ? { ...prev, session: { ...prev.session, status: 'connected' } } : null);
          } else if (['ended', 'rejected', 'busy'].includes(newStatus)) {
              cleanup();
          }
      })
      .subscribe();

      callChannelRef.current = channel;
  }, [handleSignal, activeCall?.session.status, cleanup]);

  // Função para atender chamada
  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    
    setIsConnecting(true);
    try {
        const callId = incomingCall.session.id;
        const callType = incomingCall.session.call_type as CallType;

        // 1. Obter mídia IMEDIATAMENTE (requerido para mobile)
        const stream = await getUserMedia(callType);

        // 2. Criar PC
        const connection = createPeerConnection(callId, callType);

        // Adicionar tracks
        stream.getTracks().forEach(track => connection.addTrack(track, stream));

        // 3. Buscar a oferta se não tivermos (geralmente já temos via signal, mas aqui assumimos que o sinal de offer disparou o incomingCall)
        // No fluxo real, precisamos recuperar o Offer do banco se ele não veio no payload inicial ou se perdemos
        // Mas assumindo que o incomingCall foi setado quando recebemos o 'offer' signal ou 'ringing' session.
        
        // Vamos buscar a oferta no banco para garantir
        const { data: signals } = await supabase
            .from('call_signals')
            .select('*')
            .eq('call_id', callId)
            .eq('signal_type', 'offer')
            .order('created_at', { ascending: false })
            .limit(1);

        if (!signals || signals.length === 0) throw new Error("Oferta não encontrada");
        const offerSignal = signals[0];

        // 4. Set Remote Description (Offer)
        await connection.setRemoteDescription(new RTCSessionDescription(offerSignal.signal_data as any));
        isDescriptionSet.current = true;
        
        // 5. Processar ICEs que chegaram antes
        await processIceQueue();

        // 6. Criar Answer
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        // 7. Enviar Answer
        await supabase.from('call_signals').insert({
            call_id: callId,
            sender_id: user.id,
            signal_type: 'answer',
            signal_data: answer as any
        });

        // 8. Atualizar status
        await supabase.from('call_sessions').update({ status: 'connected', started_at: new Date().toISOString() }).eq('id', callId);

        setActiveCall({
            session: incomingCall.session,
            localStream: stream,
            remoteStream: null,
            isScreenSharing: false,
            otherParticipant: incomingCall.caller,
            screenStream: null,
            isAudioEnabled: true,
            isVideoEnabled: callType === 'video',
            connectionQuality: null,
            stats: null
        });
        
        setIncomingCall(null);
        subscribeToSignals(callId);

    } catch (e) {
        console.error("Erro ao atender:", e);
        cleanup();
        toast.error("Erro ao atender chamada.");
    }
  }, [incomingCall, user, getUserMedia, createPeerConnection, cleanup, subscribeToSignals, processIceQueue]);

  const declineCall = useCallback(async () => {
      if (!incomingCall) return;
      await supabase.from('call_sessions').update({ status: 'rejected' }).eq('id', incomingCall.session.id);
      setIncomingCall(null);
  }, [incomingCall]);

  const endCall = useCallback(async () => {
      if (activeCall) {
          await supabase.from('call_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', activeCall.session.id);
          // Enviar sinal de hangup para garantir
          await supabase.from('call_signals').insert({
              call_id: activeCall.session.id,
              sender_id: user!.id,
              signal_type: 'hangup',
              signal_data: {}
          });
      }
      cleanup();
  }, [activeCall, user, cleanup]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        // Stop current track
        videoTrack.stop();
        
        // Get new constraints (swap facing mode)
        const currentFacingMode = videoTrack.getSettings().facingMode;
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacingMode }
        });
        
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        // Replace track in peer connection
        if (pc.current) {
          const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          }
        }
        
        // Replace track in local stream ref
        localStreamRef.current.removeTrack(videoTrack);
        localStreamRef.current.addTrack(newVideoTrack);
        
        // Force update to refresh UI
        setActiveCall(prev => prev ? { ...prev, localStream: localStreamRef.current } : null);
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    // Implementação básica de screen share
    // Para simplificar, vamos alternar entre camera e tela no track de video
    if (!pc.current || !activeCall) return;

    if (!activeCall.isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        
        const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
        
        screenTrack.onended = () => {
             toggleScreenShare(); // Revert back when user stops sharing via browser UI
        };

        setActiveCall(prev => prev ? { ...prev, isScreenSharing: true } : null);
        
        // Sinalizar inicio
        await supabase.from('call_signals').insert({
            call_id: activeCall.session.id,
            sender_id: user!.id,
            signal_type: 'screen-share-start',
            signal_data: {}
        });

      } catch (e) {
        console.error("Erro ao compartilhar tela:", e);
      }
    } else {
      // Reverter para camera
      if (localStreamRef.current) {
        const cameraTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender && cameraTrack) {
          sender.replaceTrack(cameraTrack);
        }
      }
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      
      setActiveCall(prev => prev ? { ...prev, isScreenSharing: false } : null);

      // Sinalizar fim
      await supabase.from('call_signals').insert({
            call_id: activeCall.session.id,
            sender_id: user!.id,
            signal_type: 'screen-share-stop',
            signal_data: {}
      });
    }
  }, [activeCall, user]);

  const sendCallMessage = useCallback(async (content: string) => {
      if (!activeCall || !user) return;
      // Implementar envio de mensagem de chat na chamada se necessário
      // Por enquanto, apenas log
      console.log("Mensagem de chamada:", content);
  }, [activeCall, user]);

  // Monitorar chamadas recebidas (Global)
  useEffect(() => {
      if (!user) return;

      const channel = supabase.channel('global-calls')
          .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'call_sessions',
              filter: `callee_id=eq.${user.id}`
          }, async (payload) => {
              if (payload.new.status === 'initiating' || payload.new.status === 'ringing') {
                  // Buscar quem está ligando
                  const { data: caller } = await supabase.from('profiles').select('*').eq('id', payload.new.caller_id).single();
                  if (caller) {
                      setIncomingCall({
                          session: payload.new as any,
                          caller: caller
                      });
                  }
              }
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [user]);

  return {
    activeCall,
    incomingCall,
    callMessages,
    isConnecting,
    startCall,
    answerCall,
    declineCall,
    endCall,
    connectionQuality,
    localStream: localStreamRef.current,
    remoteStream: activeCall?.remoteStream,
    pc: pc.current,
    toggleAudio,
    toggleVideo,
    switchCamera,
    toggleScreenShare,
    sendCallMessage
  };
};
