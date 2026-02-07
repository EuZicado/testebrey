import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
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
        // console.log(`🎥 [VideoElement] Attaching ${isLocal ? 'local' : 'remote'} stream (ID: ${stream.id})`);
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
  
  // Determine what to show as the main background
  // 1. If we have remote video -> Show Remote
  // 2. If no remote video, but we have local video (waiting/ringing) -> Show Local (mirrored)
  // 3. Otherwise -> Show dark background
  const hasRemoteVideo = isVideoCall && !!activeCall.remoteStream && activeCall.remoteStream.getVideoTracks().length > 0;
  const hasLocalVideo = isVideoCall && !!activeCall.localStream && activeCall.localStream.getVideoTracks().length > 0;
  
  // If we are showing local video as background (during ring), we don't need the avatar overlay to be opaque
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
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col font-sans">
        {/* Main Content Area */}
        <div className="relative flex-1 w-full overflow-hidden flex flex-col">
          
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
                // Fallback for Audio Calls or Missing Video
                <div className="w-full h-full bg-zinc-900" />
             )}
          </div>

          {/* LAYER 1: Gradient Overlay (visibility depends on context) */}
          <div className={cn(
             "absolute inset-0 pointer-events-none transition-colors duration-500",
             showVideoBackground ? "bg-black/20" : "bg-zinc-900" // Use lighter overlay if video is showing
          )} />

          {/* LAYER 2: Avatar & Status Info */}
          {/* Only show full avatar overlay if:
              1. It's an Audio Call
              2. OR We are waiting for connection AND we don't have local video to show (e.g. permission issue)
              3. OR We are connected but remote has no video (handled by hasRemoteVideo check above)
           */}
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
                    "border-4 border-zinc-800 shadow-2xl z-20 transition-all duration-500",
                    showVideoBackground ? "w-24 h-24 mb-4" : "w-32 h-32 mb-6" // Shrink avatar if video is background (e.g. local preview)
                )}>
                  <AvatarImage src={activeCall.otherParticipant?.avatar_url || undefined} />
                  <AvatarFallback className="text-3xl bg-zinc-800 text-white">
                    {(activeCall.otherParticipant?.display_name || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center z-20">
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight drop-shadow-md">
                    {activeCall.otherParticipant?.display_name || "Usuário"}
                  </h2>
                  <div className="flex items-center justify-center gap-2 min-h-[24px]">
                      {isRinging ? (
                           <span className="text-zinc-200 text-base font-medium animate-pulse flex items-center gap-2">
                             <PhoneOutgoing className="w-4 h-4" /> Chamando...
                           </span>
                      ) : isConnecting ? (
                           <span className="text-zinc-200 text-base font-medium animate-pulse flex items-center gap-2">
                             <Activity className="w-4 h-4" /> Conectando...
                           </span>
                      ) : (
                          <Badge variant="secondary" className="bg-black/40 hover:bg-black/60 text-white border-white/10 backdrop-blur-md px-3 py-1 font-mono">
                              {formatDuration(callDuration)}
                          </Badge>
                      )}
                  </div>
                </div>
             </div>
          )}

          {/* LAYER 3: PiP Local Video (Only when connected and remote video is active) */}
          {hasRemoteVideo && hasLocalVideo && (
             <motion.div 
               drag
               dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               className="absolute top-4 right-4 w-32 h-48 bg-zinc-900 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl z-30 cursor-move"
             >
                <VideoElement 
                  stream={activeCall.localStream} 
                  isLocal={true} 
                  className="w-full h-full object-cover transform -scale-x-100"
                />
             </motion.div>
          )}
          
          {/* Hidden Remote Audio Element */}
          {activeCall.remoteStream && (
             <audio 
                ref={remoteAudioRef} 
                autoPlay 
                playsInline 
                controls={false} 
                className="hidden" 
             />
          )}

          {/* Top Bar (Quality & Minimize) */}
          <div className="absolute top-6 left-6 flex items-center gap-3 z-30">
             <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-black/40"
                onClick={() => setIsMinimized(true)}
             >
                <Minimize2 className="w-5 h-5" />
             </Button>

             {isConnected && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" className="h-10 px-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-black/40 gap-2">
                             {simpleQuality === 'good' ? (
                                 <Wifi className="w-4 h-4 text-green-500" />
                             ) : simpleQuality === 'poor' ? (
                                 <Wifi className="w-4 h-4 text-yellow-500" />
                             ) : (
                                 <WifiOff className="w-4 h-4 text-red-500" />
                             )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 bg-zinc-900/95 border-zinc-800 text-zinc-200 backdrop-blur-xl p-4" align="start">
                        <div className="space-y-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Estatísticas da Rede
                            </h4>
                            
                            <div className="flex items-center justify-between bg-red-900/20 p-2 rounded border border-red-900/50">
                                <span className="text-xs font-mono text-red-400">MODO ESCUTA</span>
                                <Button 
                                    size="sm" 
                                    variant={isAdminSpyMode ? "destructive" : "outline"}
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => setIsAdminSpyMode(!isAdminSpyMode)}
                                >
                                    {isAdminSpyMode ? "ON" : "OFF"}
                                </Button>
                            </div>

                            {activeCall.connectionQuality && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-black/40 p-2 rounded">
                                        <div className="text-zinc-500 mb-1">Ping</div>
                                        <div className="font-mono text-green-400">{activeCall.connectionQuality.latency.toFixed(0)}ms</div>
                                    </div>
                                    <div className="bg-black/40 p-2 rounded">
                                        <div className="text-zinc-500 mb-1">Perda</div>
                                        <div className="font-mono text-blue-400">{activeCall.connectionQuality.packetLoss.toFixed(1)}%</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
             )}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="relative z-40 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 p-6 pb-8 safe-area-pb">
           <div className="flex items-center justify-center gap-6 sm:gap-10 max-w-lg mx-auto">
              
              <div className="flex flex-col items-center gap-2">
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
                <span className="text-[10px] text-zinc-400 font-medium">Microfone</span>
              </div>

              {isVideoCall && (
                <div className="flex flex-col items-center gap-2">
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
                    <span className="text-[10px] text-zinc-400 font-medium">Câmera</span>
                </div>
              )}

              <div className="flex flex-col items-center gap-2 mx-2">
                <Button
                    variant="destructive"
                    size="icon"
                    className="w-20 h-20 rounded-full shadow-red-900/20 shadow-xl bg-red-500 hover:bg-red-600 border-4 border-zinc-950 transition-transform hover:scale-105 active:scale-95"
                    onClick={endCall}
                >
                    <PhoneOff className="w-9 h-9 text-white fill-current" />
                </Button>
              </div>
           </div>
        </div>
    </div>
  );
};
