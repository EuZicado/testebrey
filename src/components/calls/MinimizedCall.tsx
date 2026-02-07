 import { motion } from "framer-motion";
import { PhoneOff, Maximize2, Wifi, WifiOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActiveCall } from "@/types/calls";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface MinimizedCallProps {
  activeCall: ActiveCall;
  callDuration: number;
  onExpand: () => void;
  onEndCall: () => void;
}

export const MinimizedCall = ({
  activeCall,
  callDuration,
  onExpand,
  onEndCall,
}: MinimizedCallProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideoCall = activeCall.session.call_type === 'video';
  const quality = activeCall.connectionQuality?.rating || 'good';

  useEffect(() => {
    if (videoRef.current && activeCall.remoteStream) {
      videoRef.current.srcObject = activeCall.remoteStream;
    }
  }, [activeCall.remoteStream]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 100 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 100 }}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      whileDrag={{ scale: 1.05 }}
      className="fixed bottom-24 right-4 z-50 cursor-grab active:cursor-grabbing"
    >
      <div className="relative group">
        {/* Main PiP window */}
        <motion.div 
          className={cn(
            "w-48 h-64 rounded-2xl overflow-hidden bg-zinc-900/90 border shadow-2xl transition-all duration-300 backdrop-blur-xl",
            quality === 'poor' || quality === 'fair' ? "border-yellow-500/50 shadow-yellow-500/10" :
            quality === 'bad' || quality === 'disconnected' ? "border-red-500/50 shadow-red-500/10" :
            "border-white/10 shadow-black/50"
          )}
          onClick={onExpand}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isVideoCall && activeCall.remoteStream ? (
            <div className="relative w-full h-full">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 relative overflow-hidden">
                {/* Dynamic Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
                <motion.div 
                    className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity }}
                />

              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2,
                  ease: "easeInOut"
                }}
                className="relative z-10"
              >
                <div className="p-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
                    <Avatar className="w-20 h-20 border-2 border-zinc-800 shadow-xl">
                    <AvatarImage src={activeCall.otherParticipant?.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-zinc-800 text-zinc-400 font-bold">
                        {(activeCall.otherParticipant?.display_name || "U")[0].toUpperCase()}
                    </AvatarFallback>
                    </Avatar>
                </div>
              </motion.div>
              <p className="text-sm font-semibold mt-3 text-white truncate max-w-[85%] relative z-10">
                {activeCall.otherParticipant?.display_name}
              </p>
            </div>
          )}

          {/* Duration badge */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-2 border border-white/5 shadow-lg">
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                quality === 'bad' || quality === 'disconnected' ? "bg-red-500" : "bg-emerald-500"
            )} />
            <span className="text-xs font-medium text-white tabular-nums tracking-wide">{formatDuration(callDuration)}</span>
          </div>

          {/* Connection Quality Indicator (if not good) */}
          {(quality !== 'excellent' && quality !== 'good') && (
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/5">
                {quality === 'disconnected' ? <WifiOff className="w-3 h-3 text-red-500" /> :
                 <Wifi className={cn("w-3 h-3", quality === 'bad' ? "text-red-500" : "text-yellow-500")} />
                }
            </div>
          )}

          {/* Expand hint */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[1px]">
            <div className="bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20 transform scale-75 group-hover:scale-100 transition-transform">
                <Maximize2 className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Audio indicator */}
          {!isVideoCall && activeCall.session.status === 'connected' && (
            <div className="absolute top-4 right-4 flex items-center gap-0.5">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-emerald-500/80 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  animate={{
                    height: [8, 16, 8],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
 
         {/* End call button */}
         <motion.button
           whileHover={{ scale: 1.1, rotate: 90 }}
           whileTap={{ scale: 0.9 }}
           onClick={(e) => {
             e.stopPropagation();
             onEndCall();
           }}
           className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20 border-2 border-zinc-900 transition-colors hover:bg-red-600 z-50"
         >
           <PhoneOff className="w-4 h-4 text-white" />
         </motion.button>
 
         {/* Muted indicators */}
         <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
           {!activeCall.isAudioEnabled && (
             <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg text-xs" title="Microfone desligado">
               🔇
             </div>
           )}
           {isVideoCall && !activeCall.isVideoEnabled && (
             <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg text-xs" title="Câmera desligada">
               📷
             </div>
           )}
         </div>
       </div>
     </motion.div>
  );
 };