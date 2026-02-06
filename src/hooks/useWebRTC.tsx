import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ActiveCall, IncomingCall, ICE_SERVERS, CallType, CallMessage, CallStats, ConnectionQuality } from "@/types/calls";
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
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup completo - libera câmera/microfone
  const cleanup = useCallback(async () => {
    console.log("🧹 Limpando conexão WebRTC...");
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
        })
      },
      video: type === 'video' ? {
        width: { ideal: isMobile ? 480 : 1280 },
        height: { ideal: isMobile ? 640 : 720 },
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

  // Monitoramento de Qualidade e Stats
  const startStatsMonitoring = useCallback(() => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

      statsIntervalRef.current = setInterval(async () => {
          if (!pc.current || pc.current.connectionState !== 'connected') return;

          try {
              const stats = await pc.current.getStats();
              let packetLoss = 0;
              let roundTripTime = 0;
              let bitrate = 0;

              stats.forEach(report => {
                  if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                      roundTripTime = report.currentRoundTripTime * 1000; // ms
                  }
                  if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                      packetLoss = report.packetsLost;
                  }
              });

              // Atualiza UI com qualidade
              let quality: 'good' | 'poor' | 'bad' = 'good';
              if (packetLoss > 5 || roundTripTime > 500) quality = 'bad';
              else if (packetLoss > 2 || roundTripTime > 200) quality = 'poor';
              
              setConnectionQuality(quality);
              
              setActiveCall(prev => prev ? {
                  ...prev,
                  connectionQuality: {
                      rating: quality === 'good' ? 'excellent' : quality === 'poor' ? 'fair' : 'poor',
                      bitrate,
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

  // Cria RTCPeerConnection com transceivers para forçar áudio bidirecional
  const createPeerConnection = useCallback((callId: string, type: CallType) => {
    console.log("🔗 Criando RTCPeerConnection (Advanced)...");
    const connection = new RTCPeerConnection(ICE_SERVERS);
    pc.current = connection;

    // CRÍTICO: Usar transceivers para garantir áudio sendrecv (resolve PC mudo)
    connection.addTransceiver('audio', { direction: 'sendrecv' });
    
    if (type === 'video') {
      connection.addTransceiver('video', { direction: 'sendrecv' });
    }

    // Monitorar estado da conexão ICE
    connection.oniceconnectionstatechange = () => {
      console.log("🧊 ICE State:", connection.iceConnectionState);
      if (connection.iceConnectionState === 'disconnected') {
        toast.warning("Reconectando...", { duration: 2000 });
        // Auto-reconnect (ICE Restart) could be triggered here if needed
        // connection.restartIce(); // Usually handled via negotiation
      } else if (connection.iceConnectionState === 'failed') {
        setConnectionQuality('bad');
        toast.error("Conexão instável.");
      }
    };

    connection.onicecandidate = (event) => {
      if (event.candidate && user) {
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
        startStatsMonitoring();

        // Atualiza sessão para connected via banco (redundância)
        supabase.from('call_sessions')
          .update({ status: 'connected', started_at: new Date().toISOString() })
          .eq('id', callId)
          .then(({ error }) => {
              if (error) console.error("Erro ao atualizar status para connected:", error);
          });
      }
      
      if (state === 'failed') {
          // Tentar reiniciar ICE
          console.log("⚠️ Conexão falhou. Tentando restart ICE...");
          connection.restartIce();
      }
      
      if (state === 'closed') {
           cleanup();
      }
    };
    
    return connection;
  }, [user, cleanup, startStatsMonitoring]);

  // Handler de sinais WebRTC
  const handleSignal = useCallback(async (signal: any, callId: string) => {
    if (signal.sender_id === user?.id || !pc.current) return;

    try {
      // console.log(`📩 Sinal recebido: ${signal.signal_type}`);
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
                signal_data: answer as any
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
          } else if (['ended', 'declined', 'busy', 'missed'].includes(newStatus)) {
              cleanup();
          }
      })
      .subscribe();

      callChannelRef.current = channel;
  }, [handleSignal, activeCall?.session.status, cleanup]);

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
        otherParticipant: null,
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
  }, [user, getUserMedia, createPeerConnection, cleanup, subscribeToSignals]);

  // Função para atender chamada
  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    
    setIsConnecting(true);
    try {
        const callId = incomingCall.session.id;
        const callType = incomingCall.session.call_type as CallType;

        // 1. Obter mídia
        const stream = await getUserMedia(callType);

        // 2. Criar PC
        const connection = createPeerConnection(callId, callType);
        stream.getTracks().forEach(track => connection.addTrack(track, stream));

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

        // 4. Set Remote Description
        await connection.setRemoteDescription(new RTCSessionDescription(offerSignal.signal_data as any));
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
            signal_data: answer as any
        });

        // 7. Atualizar status
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
      if (!incomingCall || !user) return;
      
      const conversationId = incomingCall.session.conversation_id;
      
      await supabase.from('call_sessions').update({ status: 'declined' }).eq('id', incomingCall.session.id);
      
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: "📞 Chamada recusada"
      });

      setIncomingCall(null);
  }, [incomingCall, user]);

  const endCall = useCallback(async () => {
      if (activeCall && user) {
          let status = 'ended';
          if (activeCall.session.status === 'initiating' || activeCall.session.status === 'ringing') {
             status = 'missed';
          }

          await supabase.from('call_sessions').update({ status: status as any, ended_at: new Date().toISOString() }).eq('id', activeCall.session.id);
          
          if (status === 'missed') {
             await supabase.from('messages').insert({
                conversation_id: activeCall.session.conversation_id,
                sender_id: user.id,
                content: "📞 Chamada perdida"
             });
          }

          await supabase.from('call_signals').insert({
              call_id: activeCall.session.id,
              sender_id: user.id,
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
      setActiveCall(prev => prev ? { ...prev, isAudioEnabled: !prev.isAudioEnabled } : null);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setActiveCall(prev => prev ? { ...prev, isVideoEnabled: !prev.isVideoEnabled } : null);
    }
  }, []);

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
            const newVideoTrack = newStream.getVideoTracks()[0];
            
            if (pc.current) {
              const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
              if (sender) sender.replaceTrack(newVideoTrack);
            }
            
            localStreamRef.current.removeTrack(videoTrack);
            localStreamRef.current.addTrack(newVideoTrack);
            
            setActiveCall(prev => prev ? { ...prev, localStream: localStreamRef.current } : null);
        } catch (e) {
            console.error("Erro ao trocar câmera:", e);
            toast.error("Erro ao acessar a outra câmera");
        }
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!pc.current || !activeCall || !user) return;

    if (!activeCall.isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        
        const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
        
        screenTrack.onended = () => toggleScreenShare();

        setActiveCall(prev => prev ? { ...prev, isScreenSharing: true } : null);
        
        await supabase.from('call_signals').insert({
            call_id: activeCall.session.id,
            sender_id: user.id,
            signal_type: 'screen-share-start',
            signal_data: {}
        });

      } catch (e) {
        console.error("Erro ao compartilhar tela:", e);
      }
    } else {
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

      await supabase.from('call_signals').insert({
            call_id: activeCall.session.id,
            sender_id: user.id,
            signal_type: 'screen-share-stop',
            signal_data: {}
      });
    }
  }, [activeCall, user]);

  return {
    activeCall,
    incomingCall,
    callMessages,
    isConnecting,
    connectionQuality,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    switchCamera,
    sendCallMessage: async (content: string) => {
        // Implement chat logic inside call if needed
    },
    setIncomingCall // Exported to be used by global listener if needed
  };
};
