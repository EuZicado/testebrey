import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ActiveCall, IncomingCall, ICE_SERVERS, CallType, CallMessage, CallStats, ConnectionQuality, CallSession, CallParticipant, CallSignal } from "@/types/calls";
import { toast } from "sonner";
import { useCallSounds } from "./useCallSounds";

export const useWebRTC = () => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callMessages, setCallMessages] = useState<CallMessage[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'bad'>('good');
  
  const { playRingtone, playConnecting, playBusy, playEnded, stopAllSounds } = useCallSounds();

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const candidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const isDescriptionSet = useRef(false);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup completo - libera câmera/microfone e para sons
  const cleanup = useCallback(async () => {
    console.log("🧹 Limpando conexão WebRTC e sons...");
    stopAllSounds();
    isDescriptionSet.current = false;
    candidatesQueue.current = [];
    
    if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
    }

    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => track.stop());
        remoteStreamRef.current = null;
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
  }, [stopAllSounds]);

  // Handle page unload to close active calls
  useEffect(() => {
    const handleBeforeUnload = async () => {
        if (activeCall) {
            // Attempt to send hangup signal before leaving
            // Note: This is best-effort as async fetch might be cancelled
            const { error } = await supabase.from('call_sessions')
                .update({ status: 'ended', ended_at: new Date().toISOString() })
                .eq('id', activeCall.session.id);
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeCall]);


  // Escutar chamadas recebidas
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('incoming_calls')
      .on('postgres_changes', {
        event: '*', // Listen to ALL events (INSERT and UPDATE)
        schema: 'public',
        table: 'call_sessions',
        filter: `callee_id=eq.${user.id}`
      }, async (payload) => {
        const session = payload.new as CallSession;
        
        // Se status for 'pending' (novo padrão) ou 'ringing', mostramos a chamada
        if (session.status === 'ringing' || session.status === 'pending') {
          // Se já estamos em uma chamada, rejeita a nova como ocupado
          if (activeCall) {
             console.log("🚫 Usuário já em chamada. Rejeitando nova chamada como ocupado.");
             
             // Enviar status de ocupado
             await supabase.from('call_sessions')
                 .update({ status: 'busy', ended_at: new Date().toISOString() })
                 .eq('id', session.id);
                 
             // Enviar sinal explícito (redundância)
             await supabase.from('call_signals').insert({
                 call_id: session.id,
                 sender_id: user.id,
                 signal_type: 'busy',
                 signal_data: {}
             });
             return;
          }

          // Check if we already have this call
          setIncomingCall(prev => {
             if (prev && prev.session.id === session.id) return prev;
             return prev;
          });

          // Buscar dados do chamador
          const { data: caller } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', session.caller_id)
            .single();

          if (caller) {
            setIncomingCall({
              session,
              caller: caller as CallParticipant
            });
            
            playRingtone();
          }
        } else if (['ended', 'missed', 'declined', 'rejected', 'busy'].includes(session.status)) {
             setIncomingCall(prev => {
                 if (prev && prev.session.id === session.id) {
                     stopAllSounds();
                     return null;
                 }
                 return prev;
             });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeCall, playRingtone, stopAllSounds]);

  // Monitorar status da chamada recebida (cancelar se o chamador desligar)
  useEffect(() => {
    if (!incomingCall) return;

    const channel = supabase.channel(`incoming_status:${incomingCall.session.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_sessions',
        filter: `id=eq.${incomingCall.session.id}`
      }, (payload) => {
        const newStatus = payload.new.status;
        if (['ended', 'missed', 'declined', 'rejected', 'busy'].includes(newStatus)) {
           console.log("Chamada cancelada remotamente:", newStatus);
           setIncomingCall(null);
           stopAllSounds();
           if (newStatus === 'missed') toast.info("Chamada perdida.");
           else toast.info("Chamada encerrada.");
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incomingCall, stopAllSounds]);


  // getUserMedia com constraints adaptativas e fallback
  const getUserMedia = useCallback(async (type: CallType) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Tentativa 1: Qualidade Ideal
    const idealConstraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(isMobile && { sampleRate: 16000, channelCount: 1 })
      },
      video: type === 'video' ? {
        width: { ideal: isMobile ? 480 : 1280 },
        height: { ideal: isMobile ? 640 : 720 },
        frameRate: { ideal: isMobile ? 24 : 30 },
        facingMode: "user"
      } : false
    };

    // Tentativa 2: Fallback (Baixa qualidade ou Sem Vídeo se falhar)
    const fallbackConstraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? {
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 15 },
            facingMode: "user"
        } : false
    };
    
    console.log("📹 Solicitando mídia...");

    try {
      try {
         const stream = await navigator.mediaDevices.getUserMedia(idealConstraints);
         localStreamRef.current = stream;
         return stream;
      } catch (err) {
         console.warn("⚠️ Falha ao obter mídia com qualidade ideal:", err);
         
         // Tentativa 2: Fallback com qualidade reduzida
         try {
             console.log("🔄 Tentando fallback com qualidade reduzida...");
             const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
             localStreamRef.current = stream;
             return stream;
         } catch (fallbackErr) {
             console.warn("⚠️ Falha no fallback de vídeo:", fallbackErr);
             
             // Tentativa 3: Audio Only (se era vídeo)
             if (type === 'video') {
                 console.log("🔄 Tentando fallback para Áudio Apenas...");
                 try {
                     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                     localStreamRef.current = stream;
                     toast.warning("Não foi possível acessar a câmera. Iniciando apenas com áudio.");
                     return stream;
                 } catch (audioErr) {
                     throw audioErr; // Se nem áudio funcionar, desiste
                 }
             }
             throw fallbackErr;
         }
      }
    } catch (error) {
      console.error("Erro fatal ao acessar mídia:", error);
      
      const err = error as Error;
      if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          toast.error("Câmera/Microfone indisponíveis. Verifique se outro app está usando.");
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          toast.error("Permissão negada. Ative o acesso à câmera/microfone.");
      } else if (err.name === 'NotFoundError') {
          toast.error("Dispositivo não encontrado.");
      } else {
          toast.error("Erro ao acessar dispositivos de mídia.");
      }
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

  const prevBytesRef = useRef<number>(0);
  const prevTimestampRef = useRef<number>(0);

  // Monitoramento de Qualidade e Stats
  const startStatsMonitoring = useCallback(() => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

      statsIntervalRef.current = setInterval(async () => {
          if (!pc.current || pc.current.connectionState !== 'connected') return;

          try {
              const stats = await pc.current.getStats();
              let packetLoss = 0;
              let roundTripTime = 0;
              let currentBytes = 0;
              let bitrate = 0;

              stats.forEach(report => {
                  if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                      roundTripTime = report.currentRoundTripTime * 1000; // ms
                  }
                  if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                      packetLoss = report.packetsLost;
                      currentBytes = report.bytesReceived;
                  }
              });

              // Calculate bitrate
              const now = Date.now();
              if (prevTimestampRef.current > 0) {
                  const timeDiff = now - prevTimestampRef.current;
                  if (timeDiff > 0) {
                      const bytesDiff = currentBytes - prevBytesRef.current;
                      bitrate = (bytesDiff * 8) / (timeDiff / 1000); // bits per second
                  }
              }
              prevBytesRef.current = currentBytes;
              prevTimestampRef.current = now;

              // Atualiza UI com qualidade
              let quality: 'good' | 'poor' | 'bad' = 'good';
              if (packetLoss > 5 || roundTripTime > 500) quality = 'bad';
              else if (packetLoss > 2 || roundTripTime > 200) quality = 'poor';
              
              setConnectionQuality(quality);
              
              setActiveCall(prev => prev ? {
                  ...prev,
                  connectionQuality: {
                      rating: quality === 'good' ? 'excellent' : quality === 'poor' ? 'fair' : 'poor',
                      bitrate: Math.round(bitrate),
                      packetLoss,
                      latency: roundTripTime,
                      jitter: 0
                  } as ConnectionQuality
              } : null);

          } catch (e) {
              console.error("Erro ao coletar stats:", e);
          }
      }, 2000);
  }, []);

  // Cria RTCPeerConnection (Transceivers removidos para evitar conflito com addTrack)
  const createPeerConnection = useCallback((callId: string, type: CallType) => {
    console.log("🔗 Criando RTCPeerConnection...");
    const connection = new RTCPeerConnection(ICE_SERVERS);
    pc.current = connection;

    // Monitorar estado da conexão ICE
    connection.oniceconnectionstatechange = () => {
      console.log("🧊 ICE State:", connection.iceConnectionState);
      if (connection.iceConnectionState === 'disconnected') {
        console.warn("ICE Disconnected - attempting recovery implicitly via negotiation or restart");
      } else if (connection.iceConnectionState === 'failed') {
        setConnectionQuality('bad');
        console.error("ICE Failed - Connection unstable");
      }
    };

    connection.onicecandidate = (event) => {
      if (event.candidate && user) {
        supabase.from('call_signals').insert({
          call_id: callId,
          sender_id: user.id,
          signal_type: 'ice-candidate',
          signal_data: event.candidate.toJSON()
        }).then(({ error }) => {
            if (error) console.error("Erro ao enviar ICE:", error);
        });
      }
    };

    connection.ontrack = (event) => {
      console.log(`📥 Track remoto recebido: ${event.track.kind}, ID: ${event.track.id}`);
      event.track.onunmute = () => console.log(`🔊 Track ${event.track.kind} unmuted`);
      
      const [remoteStream] = event.streams;
      if (remoteStream) {
          console.log("🌊 Stream remoto detectado com tracks:", remoteStream.getTracks().map(t => t.kind));
          remoteStreamRef.current = remoteStream;
          setActiveCall(prev => prev ? { ...prev, remoteStream } : null);
      }
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      console.log("🔄 Estado da conexão:", state);
      
      if (state === 'connected') {
        setIsConnecting(false);
        stopAllSounds(); // Stop connecting sound
        startStatsMonitoring();

        // Atualiza sessão para connected via banco (redundância)
        const now = new Date().toISOString();
        supabase.from('call_sessions')
          .update({ status: 'connected', started_at: now })
          .eq('id', callId)
          .then(({ error }) => {
              if (error) console.error("Erro ao atualizar status para connected:", error);
          });
          
        // Atualiza estado local com started_at para o timer funcionar
        setActiveCall(prev => prev ? { 
            ...prev, 
            session: { ...prev.session, status: 'connected', started_at: now } 
        } : null);
      }
      
      if (state === 'failed') {
          // Tentar reiniciar ICE corretamente com renegociação
          console.log("⚠️ Conexão falhou. Iniciando ICE Restart...");
          if (pc.current && user) {
             // ICE Restart requer criar uma nova oferta com iceRestart: true
             pc.current.createOffer({ iceRestart: true })
               .then(async (offer) => {
                 if (!pc.current) return;
                 await pc.current.setLocalDescription(offer);
                 
                 // Enviar nova oferta
                 await supabase.from('call_signals').insert({
                    call_id: callId,
                    sender_id: user.id,
                    signal_type: 'offer',
                    signal_data: offer as unknown as Record<string, unknown>
                 });
               })
               .catch(e => console.error("Erro ao reiniciar ICE:", e));
          }
      }
      
      if (state === 'closed') {
           cleanup();
      }
    };
    
    return connection;
  }, [user, cleanup, startStatsMonitoring, stopAllSounds]);

  // Handler de sinais WebRTC
  const handleSignal = useCallback(async (signal: any, callId: string) => {
    if (signal.sender_id === user?.id || !pc.current) return;

    try {
      switch (signal.signal_type) {
        case 'answer':
          if (pc.current.signalingState === 'have-local-offer') {
            await pc.current.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
            isDescriptionSet.current = true;
            await processIceQueue();
          }
          break;
          
        case 'offer':
          // Suporte a Renegociação
          if (pc.current.signalingState === 'stable' || pc.current.signalingState === 'have-remote-offer') {
             console.log("✅ Processando oferta (Renegociação ou Inicial)");
             await pc.current.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
             isDescriptionSet.current = true;
             
             // Criar resposta
             const answer = await pc.current.createAnswer();
             await pc.current.setLocalDescription(answer);
             
             await supabase.from('call_signals').insert({
                call_id: callId,
                sender_id: user!.id,
                signal_type: 'answer',
                signal_data: answer as unknown as Record<string, unknown>
             });
             await processIceQueue();
          }
          break;
          
        case 'ice-candidate':
          if (isDescriptionSet.current && pc.current.remoteDescription) {
            await pc.current.addIceCandidate(new RTCIceCandidate(signal.signal_data)).catch(e => console.warn("Erro ICE:", e));
          } else {
            candidatesQueue.current.push(signal.signal_data);
          }
          break;
          
        case 'hangup':
          cleanup();
          playEnded();
          toast.info("Chamada encerrada.");
          break;

        case 'busy':
            cleanup();
            playBusy();
            toast.info("Usuário ocupado.");
            break;

        case 'audio-state-change':
          // Update remote participant state if needed
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
  }, [user, processIceQueue, cleanup, playEnded, playBusy]);

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
               stopAllSounds();
               setActiveCall(prev => prev ? { ...prev, session: { ...prev.session, status: 'connected' } } : null);
          } else if (['ended', 'declined', 'missed'].includes(newStatus)) {
              cleanup();
              playEnded();
          } else if (newStatus === 'busy') {
              cleanup();
              playBusy();
          }
      })
      .subscribe();

      callChannelRef.current = channel;
  }, [handleSignal, activeCall?.session.status, cleanup, stopAllSounds, playEnded, playBusy]);

  // Função para verificar permissões antes de iniciar
  const checkPermissions = useCallback(async (type: CallType) => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: type === 'video'
          });
          // Libera logo em seguida, só para testar
          stream.getTracks().forEach(t => t.stop());
          return true;
      } catch (e) {
          console.error("Erro de permissão:", e);
          return false;
      }
  }, []);

  // Função para iniciar chamada
  const startCall = useCallback(async (conversationId: string, calleeId: string, callType: CallType, calleeInfo?: { displayName: string, username: string, avatarUrl: string }) => {
    if (!user) {
        toast.error("Você precisa estar logado para fazer chamadas.");
        return;
    }
    
    if (!conversationId || !calleeId) {
        toast.error("Erro interno: ID da conversa ou usuário inválido.");
        return;
    }

    if (!await checkPermissions(callType)) {
        toast.error("Permissão de câmera/microfone necessária.");
        return;
    }

    setIsConnecting(true);
    playConnecting();

    try {
      // 1. Criar entrada na tabela call_sessions
      const { data: session, error } = await supabase.from('call_sessions').insert({
        conversation_id: conversationId,
        caller_id: user.id,
        callee_id: calleeId,
        call_type: callType,
        status: 'pending' // Changed from initiating to pending
      }).select().single();

      if (error || !session) throw error;

      console.log("📞 Sessão criada:", session.id);

      // 2. Setar estado local de chamada ativa
      setActiveCall({
        session: session as CallSession,
        localStream: null,
        remoteStream: null,
        screenStream: null,
        isAudioEnabled: true,
        isVideoEnabled: callType === 'video',
        isScreenSharing: false,
        otherParticipant: calleeInfo ? { id: calleeId, display_name: calleeInfo.displayName, username: calleeInfo.username, avatar_url: calleeInfo.avatarUrl } : null,
        connectionQuality: null,
        stats: null
      });

      // 3. Obter mídia
      const stream = await getUserMedia(callType);
      
      // 4. Criar PeerConnection
      const connection = createPeerConnection(session.id, callType);
      
      // 5. Adicionar tracks locais
      stream.getTracks().forEach(track => {
          connection.addTrack(track, stream);
      });

      // 6. Criar Offer
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      // 7. Enviar Offer (Sinal)
      await supabase.from('call_signals').insert({
        call_id: session.id,
        sender_id: user.id,
        signal_type: 'offer',
        signal_data: offer as unknown as Record<string, unknown>
      });

      // 8. Atualizar status para ringing (agora que temos Offer)
      await supabase.from('call_sessions').update({ status: 'ringing' }).eq('id', session.id);

      // 9. Atualizar status local para ringing
      setActiveCall(prev => prev ? { 
          ...prev, 
          session: { ...prev.session, status: 'ringing' } 
      } : null);

      // 10. Inscrever nos sinais
      subscribeToSignals(session.id);
      
      // Reset flags for new call
      stream.getAudioTracks().forEach(t => t.enabled = true);

      // Timeout de segurança: Se não conectar em 45s, encerra
      setTimeout(async () => {
          if (pc.current && pc.current.connectionState !== 'connected' && pc.current.connectionState !== 'connecting') {
              console.warn("⚠️ Call timeout - no connection established.");
              // Apenas limpa se ainda estiver tentando conectar (status pending ou ringing)
              const { data } = await supabase.from('call_sessions').select('status').eq('id', session.id).single();
              if (data && (data.status === 'pending' || data.status === 'ringing')) {
                   toast.error("Não foi possível estabelecer conexão com o usuário.");
                   cleanup();
                   playBusy(); // Or play timeout sound
                   await supabase.from('call_sessions').update({ status: 'missed' }).eq('id', session.id);
              }
          }
      }, 45000);

    } catch (e) {
      console.error("Erro ao iniciar chamada:", e);
      cleanup();
      stopAllSounds();
      
      const error = e as any;
      if (error?.code === 'PGRST116') {
         toast.error("Erro de permissão ou dados inválidos ao criar chamada.");
      } else if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
         toast.error("Permissão de câmera/microfone negada.");
      } else if (error?.name === 'NotFoundError') {
         toast.error("Dispositivo de câmera/microfone não encontrado.");
      } else {
         toast.error(`Erro ao iniciar chamada: ${error.message || 'Erro desconhecido'}`);
      }
    }
  }, [user, getUserMedia, createPeerConnection, cleanup, subscribeToSignals, checkPermissions, playConnecting, playBusy, stopAllSounds]);

  // Função para atender chamada
  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    
    stopAllSounds(); // Stop ringtone
    setIsConnecting(true);
    playConnecting();

    try {
        const callId = incomingCall.session.id;
        const callType = incomingCall.session.call_type as CallType;

        // 1. Obter mídia
        const stream = await getUserMedia(callType);

        // 2. Criar PC
        const connection = createPeerConnection(callId, callType);
        
        console.log("📤 Adicionando tracks locais ao PC de resposta...");
        stream.getTracks().forEach(track => {
            connection.addTrack(track, stream);
        });
        
        // 3. Buscar Offer
        const { data: signals } = await supabase
            .from('call_signals')
            .select('*')
            .eq('call_id', callId)
            .eq('signal_type', 'offer')
            .order('created_at', { ascending: false })
            .limit(1);

        if (!signals || signals.length === 0) throw new Error("Oferta não encontrada");
        const offerSignal = signals[0];

        // 4. Set Remote Description (Processa Offer)
        await connection.setRemoteDescription(new RTCSessionDescription(offerSignal.signal_data as RTCSessionDescriptionInit));
        isDescriptionSet.current = true;
        await processIceQueue();

        // 5. Criar Answer
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        // 6. Enviar Answer
        await supabase.from('call_signals').insert({
            call_id: callId,
            sender_id: user.id,
            signal_type: 'answer',
            signal_data: answer as unknown as Record<string, unknown>
        });

        // 7. Atualizar status
        const now = new Date().toISOString();
        await supabase.from('call_sessions').update({ status: 'connected', started_at: now }).eq('id', callId);

        // 8. Setar estado local
        setActiveCall({
            session: { ...incomingCall.session, status: 'connected', started_at: now },
            localStream: stream,
            remoteStream: null,
            screenStream: null,
            isAudioEnabled: true,
            isVideoEnabled: callType === 'video',
            isScreenSharing: false,
            otherParticipant: incomingCall.caller,
            connectionQuality: null,
            stats: null
        });

        setIncomingCall(null);
        subscribeToSignals(callId);

    } catch (e) {
        console.error("Erro ao atender chamada:", e);
        toast.error("Erro ao conectar chamada.");
        cleanup();
        stopAllSounds();
    }
  }, [incomingCall, user, getUserMedia, createPeerConnection, subscribeToSignals, processIceQueue, cleanup, playConnecting, stopAllSounds]);

  const declineCall = useCallback(async () => {
      if (!incomingCall || !user) return;
      
      stopAllSounds(); // Stop ringtone
      
      try {
          await supabase.from('call_sessions').update({ 
              status: 'declined',
              ended_at: new Date().toISOString()
          }).eq('id', incomingCall.session.id);
          
          await supabase.from('call_signals').insert({
              call_id: incomingCall.session.id,
              sender_id: user.id,
              signal_type: 'hangup', // ou declined
              signal_data: {}
          });
      } catch (e) {
          console.error("Erro ao recusar chamada:", e);
      }
      
      setIncomingCall(null);
  }, [incomingCall, user, stopAllSounds]);

  const endCall = useCallback(async () => {
      if (activeCall && user) {
          let status = 'ended';
          
          const isConnected = activeCall.session.status === 'connected';
          const hasDuration = activeCall.session.started_at && (Date.now() - new Date(activeCall.session.started_at).getTime() > 0);

          if (!isConnected && !hasDuration && (activeCall.session.status === 'pending' || activeCall.session.status === 'ringing')) {
             status = 'missed';
          }

          await supabase.from('call_sessions').update({ status: status, ended_at: new Date().toISOString() }).eq('id', activeCall.session.id);
          
          if (status === 'missed') {
             await supabase.from('messages').insert({
                conversation_id: activeCall.session.conversation_id,
                sender_id: user.id,
                content: "📞 Chamada perdida"
             });
          } else if (status === 'ended') {
              const durationMsg = hasDuration ? ` (${Math.floor((Date.now() - new Date(activeCall.session.started_at!).getTime())/1000)}s)` : '';
              await supabase.from('messages').insert({
                conversation_id: activeCall.session.conversation_id,
                sender_id: user.id,
                content: `📞 Chamada encerrada${durationMsg}`
             });
          }

          await supabase.from('call_signals').insert({
              call_id: activeCall.session.id,
              sender_id: user.id,
              signal_type: 'hangup',
              signal_data: {}
          });
          
          playEnded();
      }
      cleanup();
  }, [activeCall, user, cleanup, playEnded]);

  // Função para silenciar áudio
  const toggleAudio = useCallback(async () => {
    if (!localStreamRef.current || !activeCall) return;
    
    const audioTracks = localStreamRef.current.getAudioTracks();
    const newEnabled = !activeCall.isAudioEnabled;
    
    audioTracks.forEach(track => {
      track.enabled = newEnabled;
    });
    
    setActiveCall(prev => prev ? { ...prev, isAudioEnabled: newEnabled } : null);
    
    // Enviar sinal de mudança de estado (agora seguro com a nova migration)
    if (user) {
      await supabase.from('call_signals').insert({
        call_id: activeCall.session.id,
        sender_id: user.id,
        signal_type: 'audio-state-change',
        signal_data: { muted: !newEnabled }
      });
    }
  }, [activeCall, user]);

  // Função para silenciar vídeo
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current || !activeCall) return;
    
    const videoTracks = localStreamRef.current.getVideoTracks();
    const newEnabled = !activeCall.isVideoEnabled;
    
    videoTracks.forEach(track => {
      track.enabled = newEnabled;
    });
    
    setActiveCall(prev => prev ? { ...prev, isVideoEnabled: newEnabled } : null);

    // Enviar sinal de mudança de estado
    if (user) {
      await supabase.from('call_signals').insert({
        call_id: activeCall.session.id,
        sender_id: user.id,
        signal_type: 'video-state-change',
        signal_data: { disabled: !newEnabled }
      });
    }
  }, [activeCall, user]);

  const switchCamera = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        const currentFacingMode = videoTrack.getSettings().facingMode;
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode }
            });
            const newTrack = newStream.getVideoTracks()[0];
            
            if (pc.current) {
                const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newTrack);
                }
            }
            
            // Re-add to local stream
            localStreamRef.current.removeTrack(videoTrack);
            localStreamRef.current.addTrack(newTrack);
        } catch (e) {
            console.error("Erro ao trocar câmera:", e);
            toast.error("Não foi possível trocar a câmera");
        }
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!activeCall || !pc.current || !user) return;

    try {
        if (activeCall.isScreenSharing) {
            // Stop Screen Share
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
            }

            // Revert to camera video if available
            if (activeCall.session.call_type === 'video' && localStreamRef.current) {
                const videoTrack = localStreamRef.current.getVideoTracks()[0];
                if (videoTrack) {
                    const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) await sender.replaceTrack(videoTrack);
                }
            }

            setActiveCall(prev => prev ? { ...prev, isScreenSharing: false } : null);
            
            await supabase.from('call_signals').insert({
                call_id: activeCall.session.id,
                sender_id: user.id,
                signal_type: 'screen-share-stop',
                signal_data: {}
            });

        } else {
            // Start Screen Share
            // @ts-ignore - getDisplayMedia exists
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            screenStreamRef.current = stream;
            
            const screenTrack = stream.getVideoTracks()[0];
            
            // Handle user stopping via browser UI
            screenTrack.onended = () => {
                // If we are still sharing in state, toggle off
                if (screenStreamRef.current) toggleScreenShare();
            };

            // Replace video track
            const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                await sender.replaceTrack(screenTrack);
            } else {
                if (activeCall.session.call_type !== 'video') {
                    toast.error("Compartilhamento de tela disponível apenas em chamadas de vídeo.");
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
            }

            setActiveCall(prev => prev ? { ...prev, isScreenSharing: true } : null);
            
            await supabase.from('call_signals').insert({
                call_id: activeCall.session.id,
                sender_id: user.id,
                signal_type: 'screen-share-start',
                signal_data: {}
            });
        }
    } catch (e) {
        console.error("Erro ao compartilhar tela:", e);
        toast.error("Erro ao compartilhar tela.");
    }
  }, [activeCall, user]);

  const sendCallMessage = useCallback(async (content: string) => {
      if (!activeCall || !user) return;
      
      const { error } = await supabase.from('call_messages').insert({
          call_id: activeCall.session.id,
          sender_id: user.id,
          content
      });
      
      if (error) {
          toast.error("Erro ao enviar mensagem.");
          console.error(error);
      }
  }, [activeCall, user]);

  return {
    startCall,
    endCall,
    answerCall,
    declineCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    switchCamera,
    sendCallMessage,
    activeCall,
    incomingCall,
    isConnecting,
    connectionQuality,
    callMessages
  };
};