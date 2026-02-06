import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Monitor, 
  MessageSquare,
  Minimize2,
  SwitchCamera,
  Signal,
  Wifi,
  WifiOff,
  Activity,
  Info
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCall } from "@/contexts/CallContext";
import { cn } from "@/lib/utils";
import { CallChat } from "./CallChat";
import { MinimizedCall } from "./MinimizedCall";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const CallOverlay = () => {
  const { 
    activeCall, 
    endCall, 
    toggleAudio, 
    toggleVideo, 
    toggleScreenShare,
    switchCamera,
    isConnecting,
    connectionQuality: simpleQuality
  } = useCall();
  
  const [showChat, setShowChat] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAdminSpyMode, setIsAdminSpyMode] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Audio Visualization
  const { audioLevel } = useAudioAnalyzer(activeCall?.remoteStream || null);

  // Subscribe to signals for Mute state
  useEffect(() => {
    if (!activeCall) return;

    // Reset states on new call
    setRemoteMuted(false);
    setIsAdminSpyMode(false);
    setIsAudioEnabled(activeCall.isAudioEnabled);
    setIsVideoEnabled(activeCall.isVideoEnabled);

    const channel = supabase.channel(`call_signals:${activeCall.session.id}`)
      .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `call_id=eq.${activeCall.session.id}`
      }, (payload) => {
          const signal = payload.new;
          if (signal.sender_id !== activeCall.session.caller_id && signal.sender_id !== activeCall.session.callee_id) return; // ignore unknown?
          if (signal.sender_id === activeCall.otherParticipant?.id) {
             if (signal.signal_type === 'audio-state-change') {
                setRemoteMuted(signal.signal_data.muted);
             }
          }
      })
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [activeCall?.session.id]); // Re-run only on call ID change

  // Handle Mute logic on remote elements
  useEffect(() => {
      // If remote is muted, we mute the element UNLESS we are in Spy Mode
      const shouldMute = remoteMuted && !isAdminSpyMode;
      
      if (remoteVideoRef.current) remoteVideoRef.current.muted = shouldMute;
      if (remoteAudioRef.current) remoteAudioRef.current.muted = shouldMute;
      
  }, [remoteMuted, isAdminSpyMode, activeCall?.remoteStream]);

  // Update video refs when streams change
  useEffect(() => {
    if (localVideoRef.current && activeCall?.localStream) {
      localVideoRef.current.srcObject = activeCall.localStream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(e => console.log("Error playing local video:", e));
    }
  }, [activeCall?.localStream, isMinimized]); 

  useEffect(() => {
    if (remoteVideoRef.current && activeCall?.remoteStream) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
      remoteVideoRef.current.play().catch(e => console.log("Error playing remote video:", e));
    }
    
    if (remoteAudioRef.current && activeCall?.remoteStream) {
      remoteAudioRef.current.srcObject = activeCall.remoteStream;
      remoteAudioRef.current.play().catch(e => console.log("Error playing remote audio:", e));
    }
  }, [activeCall?.remoteStream, isMinimized]);


  // Call duration timer
  useEffect(() => {
    if (activeCall?.session.status === 'connected') {
      const interval = setInterval(() => {
        if (activeCall.session.started_at) {
          const started = new Date(activeCall.session.started_at).getTime();
          const now = Date.now();
          setCallDuration(Math.floor((now - started) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeCall?.session.status, activeCall?.session.started_at]);

  const handleToggleAudio = () => {
    toggleAudio();
    setIsAudioEnabled(!isAudioEnabled);
  };

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoEnabled(!isVideoEnabled);
  };

  if (!activeCall) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isVideoCall = activeCall.session.call_type === 'video';
  const isConnected = activeCall.session.status === 'connected';
  const isRinging = activeCall.session.status === 'ringing' || activeCall.session.status === 'initiating';

  if (isMinimized) {
    return (
      <MinimizedCall
        activeCall={activeCall}
        callDuration={callDuration}
        onExpand={() => setIsMinimized(false)}
        onEndCall={endCall}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col font-sans"
      >
        {/* Main Content Area */}
        <div className="relative flex-1 w-full overflow-hidden">
          
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80 z-10 pointer-events-none" />

          {/* Remote Video (Full Screen) */}
          {isVideoCall && activeCall.remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
             // Avatar Display when no video
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
               {/* Hidden Audio Element for Voice Calls */}
               {activeCall.remoteStream && (
                 <audio 
                    ref={remoteAudioRef} 
                    autoPlay 
                    playsInline 
                    controls={false} 
                    className="hidden" 
                 />
               )}

               {/* Pulsing Effect based on Audio Level */}
               {isConnected && (
                  <motion.div
                    className="absolute w-48 h-48 rounded-full bg-green-500/20 blur-xl"
                    animate={{
                      scale: 1 + (audioLevel / 50),
                      opacity: 0.3 + (audioLevel / 200)
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
               )}

               {/* Ringing Animation */}
              {(isRinging || isConnecting) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute w-40 h-40 rounded-full border border-primary/30"
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={{ 
                        scale: [0.8, 2 + i * 0.5], 
                        opacity: [0.5, 0] 
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        delay: i * 0.6,
                        ease: "easeOut"
                      }}
                    />
                  ))}
                </div>
              )}

              <Avatar className="w-32 h-32 border-4 border-zinc-800 shadow-2xl z-10">
                <AvatarImage src={activeCall.otherParticipant?.avatar_url || undefined} />
                <AvatarFallback className="text-4xl bg-zinc-800 text-white">
                  {(activeCall.otherParticipant?.display_name || "U")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="mt-8 text-center z-10">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                  {activeCall.otherParticipant?.display_name || "Usuário"}
                </h2>
                <div className="flex items-center justify-center gap-2">
                    {isRinging ? (
                         <span className="text-zinc-400 text-lg animate-pulse">Chamando...</span>
                    ) : isConnecting ? (
                         <span className="text-zinc-400 text-lg animate-pulse">Conectando...</span>
                    ) : (
                        <Badge variant="outline" className="bg-zinc-800/50 border-zinc-700 text-zinc-300 px-3 py-1 text-sm font-mono">
                            {formatDuration(callDuration)}
                        </Badge>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* Local Video (PiP) */}
          {isVideoCall && activeCall.localStream && (
             <motion.div 
               drag
               dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               className="absolute top-4 right-4 w-32 h-48 bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-700/50 shadow-2xl z-20 cursor-move"
             >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
             </motion.div>
          )}

          {/* Top Bar (Quality & Minimize) */}
          <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
             <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full bg-black/20 backdrop-blur border-white/10 text-white hover:bg-black/40"
                onClick={() => setIsMinimized(true)}
             >
                <Minimize2 className="w-5 h-5" />
             </Button>

             {isConnected && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" className="h-10 px-3 rounded-full bg-black/20 backdrop-blur border border-white/10 text-white hover:bg-black/40 gap-2">
                             {simpleQuality === 'good' ? (
                                 <Wifi className="w-4 h-4 text-green-500" />
                             ) : simpleQuality === 'poor' ? (
                                 <Wifi className="w-4 h-4 text-yellow-500" />
                             ) : (
                                 <WifiOff className="w-4 h-4 text-red-500" />
                             )}
                             <span className="text-xs font-medium">
                                {simpleQuality === 'good' ? 'Estável' : 'Instável'}
                             </span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 bg-zinc-900/95 border-zinc-800 text-zinc-200 backdrop-blur-xl p-4" align="start">
                        <div className="space-y-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Estatísticas da Rede
                            </h4>
                            
                            {/* Admin Spy Toggle */}
                            <div className="flex items-center justify-between bg-red-900/20 p-2 rounded border border-red-900/50">
                                <span className="text-xs font-mono text-red-400">MODO ESCUTA (ADMIN)</span>
                                <Button 
                                    size="sm" 
                                    variant={isAdminSpyMode ? "destructive" : "outline"}
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => setIsAdminSpyMode(!isAdminSpyMode)}
                                >
                                    {isAdminSpyMode ? "ATIVADO" : "DESATIVADO"}
                                </Button>
                            </div>

                            {activeCall.connectionQuality ? (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-black/40 p-2 rounded">
                                        <div className="text-zinc-500 mb-1">Ping</div>
                                        <div className="font-mono text-green-400">{activeCall.connectionQuality.latency.toFixed(0)}ms</div>
                                    </div>
                                    <div className="bg-black/40 p-2 rounded">
                                        <div className="text-zinc-500 mb-1">Perda</div>
                                        <div className="font-mono text-blue-400">{activeCall.connectionQuality.packetLoss.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-black/40 p-2 rounded col-span-2">
                                        <div className="text-zinc-500 mb-1">Status ICE</div>
                                        <div className="font-mono capitalize">{activeCall.connectionQuality.rating}</div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-500">Coletando dados...</p>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
             )}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="relative z-30 bg-zinc-900/80 backdrop-blur-2xl border-t border-white/5 p-6 pb-8 safe-area-pb">
           <div className="flex items-center justify-center gap-4 sm:gap-8 max-w-lg mx-auto">
              
              {/* Mute Toggle */}
              <div className="flex flex-col items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                    "w-14 h-14 rounded-full border-0 transition-all duration-300 shadow-lg",
                    isAudioEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-white text-black hover:bg-zinc-200 scale-110"
                    )}
                    onClick={handleToggleAudio}
                >
                    {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </Button>
                <span className="text-[10px] text-zinc-400 font-medium">Mute</span>
              </div>

              {/* Video Toggle */}
              {isVideoCall && (
                <div className="flex flex-col items-center gap-1">
                    <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                        "w-14 h-14 rounded-full border-0 transition-all duration-300 shadow-lg",
                        isVideoEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-white text-black hover:bg-zinc-200 scale-110"
                    )}
                    onClick={handleToggleVideo}
                    >
                    {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    </Button>
                    <span className="text-[10px] text-zinc-400 font-medium">Camera</span>
                </div>
              )}

              {/* End Call (Center, Large) */}
              <div className="flex flex-col items-center gap-1 mx-2">
                <Button
                    variant="destructive"
                    size="icon"
                    className="w-20 h-20 rounded-full shadow-red-900/20 shadow-xl bg-red-500 hover:bg-red-600 border-4 border-zinc-900 transition-transform hover:scale-105 active:scale-95"
                    onClick={endCall}
                >
                    <PhoneOff className="w-9 h-9 text-white fill-current" />
                </Button>
              </div>

              {/* Switch Camera */}
              {isVideoCall && (
                <div className="flex flex-col items-center gap-1">
                    <Button
                    variant="ghost"
                    size="icon"
                    className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border-0 transition-all duration-300 shadow-lg"
                    onClick={switchCamera}
                    >
                    <SwitchCamera className="w-6 h-6" />
                    </Button>
                    <span className="text-[10px] text-zinc-400 font-medium">Virar</span>
                </div>
              )}

              {/* Chat Toggle */}
              <div className="flex flex-col items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                    "w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border-0 transition-all duration-300 shadow-lg",
                    showChat && "bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-400/50"
                    )}
                    onClick={() => setShowChat(!showChat)}
                >
                    <MessageSquare className="w-6 h-6" />
                </Button>
                <span className="text-[10px] text-zinc-400 font-medium">Chat</span>
              </div>
           </div>
        </div>

        {/* Chat Drawer/Overlay */}
          <CallChat 
            conversationId={activeCall.session.conversation_id}
            isOpen={showChat}
            onClose={() => setShowChat(false)}
          />

      </motion.div>
    </AnimatePresence>
  );
};
