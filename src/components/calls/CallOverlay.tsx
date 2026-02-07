import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Minimize2,
  Wifi,
  WifiOff,
  Activity,
  PhoneOutgoing
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCall } from "@/contexts/CallContext";
import { cn } from "@/lib/utils";
import { MinimizedCall } from "./MinimizedCall";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

// Stable Video Component to ensure stream binding
const VideoElement = ({ 
  stream, 
  isLocal, 
  className, 
  onLoadedMetadata,
  ...props 
}: { 
  stream: MediaStream | null, 
  isLocal: boolean, 
  className?: string,
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        if (isLocal) {
          video.muted = true;
          video.volume = 0;
        }
        video.play().catch(e => console.warn("Video play error:", e));
      }
    } else {
      if (video.srcObject) {
        video.srcObject = null;
      }
    }
  }, [stream, isLocal]);

  return (
    <video
      ref={videoRef}
      className={className}
      playsInline
      autoPlay
      muted={isLocal}
      onLoadedMetadata={(e) => {
        if (isLocal) {
            e.currentTarget.muted = true;
            e.currentTarget.volume = 0;
        }
        e.currentTarget.play().catch(console.warn);
        onLoadedMetadata?.(e);
      }}
      {...props}
    />
  );
};

export const CallOverlay = () => {
  const { 
    activeCall, 
    endCall, 
    toggleAudio, 
    toggleVideo, 
    isConnecting,
    connectionQuality: simpleQuality
  } = useCall();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAdminSpyMode, setIsAdminSpyMode] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Audio Visualization - Analyze Remote if available, otherwise Local (for user feedback)
  const visualizationStream = activeCall?.remoteStream || activeCall?.localStream || null;
  const { audioLevel } = useAudioAnalyzer(visualizationStream);

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
          if (signal.sender_id !== activeCall.session.caller_id && signal.sender_id !== activeCall.session.callee_id) return;
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
  }, [activeCall?.session.id]);

  // Handle Mute logic on remote elements
  useEffect(() => {
      const shouldMute = remoteMuted && !isAdminSpyMode;
      if (remoteAudioRef.current) remoteAudioRef.current.muted = shouldMute;
  }, [remoteMuted, isAdminSpyMode, activeCall?.remoteStream]);

  // Attach Remote Audio
  useEffect(() => {
    if (remoteAudioRef.current && activeCall?.remoteStream) {
        if (remoteAudioRef.current.srcObject !== activeCall.remoteStream) {
            remoteAudioRef.current.srcObject = activeCall.remoteStream;
            remoteAudioRef.current.play().catch(console.warn);
        }
    }
  }, [activeCall?.remoteStream]);

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
  
  const hasRemoteVideo = isVideoCall && !!activeCall.remoteStream && activeCall.remoteStream.getVideoTracks().length > 0;
  const hasLocalVideo = isVideoCall && !!activeCall.localStream && activeCall.localStream.getVideoTracks().length > 0;
  
  const showVideoBackground = hasRemoteVideo || hasLocalVideo;

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
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col font-sans overflow-hidden">
        {/* Main Content Area */}
        <div className="relative flex-1 w-full h-full flex flex-col">
          
          {/* LAYER 0: Video Background */}
          <div className="absolute inset-0 z-0">
             {hasRemoteVideo ? (
               <VideoElement 
                 stream={activeCall.remoteStream} 
                 isLocal={false} 
                 className="w-full h-full object-cover"
               />
             ) : hasLocalVideo ? (
               <VideoElement 
                 stream={activeCall.localStream} 
                 isLocal={true} 
                 className="w-full h-full object-cover transform -scale-x-100"
               />
             ) : (
                // Modern Dynamic Background for Audio Calls
                <div className="w-full h-full bg-zinc-900 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950" />
                    
                    {/* Animated Blobs */}
                    <motion.div 
                        className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]"
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.5, 0.3],
                            x: [0, 50, 0]
                        }}
                        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div 
                        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"
                        animate={{ 
                            scale: [1.2, 1, 1.2],
                            opacity: [0.3, 0.5, 0.3],
                            y: [0, -50, 0]
                        }}
                        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    />
                </div>
             )}
          </div>

          {/* LAYER 1: Gradient Overlay */}
          <div className={cn(
             "absolute inset-0 pointer-events-none transition-colors duration-500 z-1",
             showVideoBackground ? "bg-gradient-to-b from-black/60 via-transparent to-black/80" : "bg-black/20"
          )} />

          {/* LAYER 2: Avatar & Status Info */}
          {(!showVideoBackground || !isConnected) && (
             <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4">
                
                {/* Audio Visualization Ring */}
                {isConnected && !hasRemoteVideo && (
                  <motion.div
                    className="absolute w-64 h-64 rounded-full bg-primary/20 blur-3xl"
                    animate={{
                      scale: 1 + (audioLevel / 50),
                      opacity: 0.3 + (audioLevel / 200)
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                )}

                {/* Ringing Ripples */}
                {isRinging && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="absolute w-48 h-48 rounded-full border border-primary/20"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ 
                          scale: [0.8, 2.5], 
                          opacity: [0.5, 0] 
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.6,
                          ease: "easeOut"
                        }}
                      />
                    ))}
                  </div>
                )}

                <Avatar className={cn(
                    "border-4 border-zinc-800 shadow-2xl z-20 transition-all duration-500 ring-4 ring-black/20",
                    showVideoBackground ? "w-24 h-24 mb-4" : "w-36 h-36 mb-8"
                )}>
                  <AvatarImage src={activeCall.otherParticipant?.avatar_url || undefined} />
                  <AvatarFallback className="text-4xl bg-zinc-800 text-white font-light">
                    {(activeCall.otherParticipant?.display_name || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center z-20 space-y-2">
                  <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">
                    {activeCall.otherParticipant?.display_name || "Usuário"}
                  </h2>
                  <div className="flex items-center justify-center gap-2 min-h-[24px]">
                      {isRinging ? (
                           <span className="text-zinc-200 text-base font-medium animate-pulse flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
                             <PhoneOutgoing className="w-4 h-4" /> Chamando...
                           </span>
                      ) : isConnecting ? (
                           <span className="text-zinc-200 text-base font-medium animate-pulse flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
                             <Activity className="w-4 h-4" /> Conectando...
                           </span>
                      ) : (
                          <Badge variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/10 backdrop-blur-md px-4 py-1.5 text-sm font-mono tracking-widest shadow-lg">
                              {formatDuration(callDuration)}
                          </Badge>
                      )}
                  </div>
                </div>
             </div>
          )}

          {/* LAYER 3: PiP Local Video */}
          {hasRemoteVideo && hasLocalVideo && (
             <motion.div 
               drag
               dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               className="absolute top-6 right-6 w-36 h-56 bg-zinc-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-30 cursor-move ring-1 ring-black/50"
             >
                <VideoElement 
                  stream={activeCall.localStream} 
                  isLocal={true} 
                  className="w-full h-full object-cover transform -scale-x-100"
                />
             </motion.div>
          )}
          
          {/* Hidden Remote Audio Element - Render only if VideoElement is NOT handling audio */}
          {activeCall.remoteStream && !hasRemoteVideo && (
             <audio 
                ref={remoteAudioRef} 
                autoPlay 
                playsInline 
                controls={false} 
                className="hidden" 
             />
          )}

          {/* Top Bar Controls */}
          <div className="absolute top-6 left-6 flex items-center gap-3 z-30">
             <Button 
                variant="ghost" 
                size="icon" 
                className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:bg-black/40 transition-colors"
                onClick={() => setIsMinimized(true)}
             >
                <Minimize2 className="w-5 h-5" />
             </Button>

             {isConnected && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" className="h-10 px-4 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:bg-black/40 gap-2 transition-colors">
                             {simpleQuality === 'good' ? (
                                 <Wifi className="w-4 h-4 text-emerald-400" />
                             ) : simpleQuality === 'poor' ? (
                                 <Wifi className="w-4 h-4 text-amber-400" />
                             ) : (
                                 <WifiOff className="w-4 h-4 text-rose-500" />
                             )}
                             <span className="text-xs font-medium opacity-80 hidden sm:inline-block">
                                {simpleQuality === 'good' ? 'Boa conexão' : 'Instável'}
                             </span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 bg-zinc-950/90 border-zinc-800 text-zinc-200 backdrop-blur-2xl p-4 shadow-2xl rounded-2xl" align="start">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 text-white">
                                <Activity className="w-4 h-4 text-primary" /> Estatísticas da Rede
                            </h4>
                            
                            <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="text-xs font-medium text-zinc-400">MODO ESCUTA</span>
                                <Button 
                                    size="sm" 
                                    variant={isAdminSpyMode ? "destructive" : "secondary"}
                                    className="h-6 text-[10px] px-3 rounded-full"
                                    onClick={() => setIsAdminSpyMode(!isAdminSpyMode)}
                                >
                                    {isAdminSpyMode ? "ATIVADO" : "DESATIVADO"}
                                </Button>
                            </div>

                            {activeCall.connectionQuality && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                        <div className="text-xs text-zinc-500 mb-1">Ping</div>
                                        <div className="font-mono text-emerald-400 text-lg">{activeCall.connectionQuality.latency.toFixed(0)}<span className="text-xs ml-1 text-zinc-600">ms</span></div>
                                    </div>
                                    <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                        <div className="text-xs text-zinc-500 mb-1">Perda</div>
                                        <div className="font-mono text-blue-400 text-lg">{activeCall.connectionQuality.packetLoss.toFixed(1)}<span className="text-xs ml-1 text-zinc-600">%</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
             )}
          </div>
        </div>

        {/* Bottom Control Bar - Floating Island Design */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md px-4">
           <div className="bg-zinc-950/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center justify-between gap-4">
              
              {/* Audio Toggle */}
              <div className="flex flex-col items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                    "w-12 h-12 rounded-full border-0 transition-all duration-300 shadow-lg",
                    isAudioEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-white text-black hover:bg-zinc-200"
                    )}
                    onClick={handleToggleAudio}
                >
                    {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <span className="text-[10px] text-zinc-500 font-medium">Mic</span>
              </div>

              {/* Video Toggle (Conditional) */}
              {isVideoCall && (
                <div className="flex flex-col items-center gap-1">
                    <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                        "w-12 h-12 rounded-full border-0 transition-all duration-300 shadow-lg",
                        isVideoEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-white text-black hover:bg-zinc-200"
                    )}
                    onClick={handleToggleVideo}
                    >
                    {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </Button>
                    <span className="text-[10px] text-zinc-500 font-medium">Câmera</span>
                </div>
              )}

              {/* End Call (Center & Large) */}
              <div className="flex flex-col items-center gap-1">
                <Button
                    variant="destructive"
                    size="icon"
                    className="w-16 h-16 rounded-full shadow-red-500/20 shadow-xl bg-red-500 hover:bg-red-600 border-4 border-zinc-900/50 transition-all hover:scale-105 active:scale-95"
                    onClick={endCall}
                >
                    <PhoneOff className="w-8 h-8 text-white fill-current" />
                </Button>
              </div>
           </div>
        </div>
    </div>
  );
};
