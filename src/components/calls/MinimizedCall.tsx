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

  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && activeCall.remoteStream) {
      node.srcObject = activeCall.remoteStream;
    }
  };

  const setAudioRef = (node: HTMLAudioElement | null) => {
    if (node && activeCall.remoteStream) {
      node.srcObject = activeCall.remoteStream;
    }
  };

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
            "w-36 h-48 rounded-2xl overflow-hidden bg-card border-2 shadow-2xl transition-colors duration-300",
            quality === 'poor' || quality === 'fair' ? "border-yellow-500/50" :
            quality === 'bad' || quality === 'disconnected' ? "border-destructive/50" :
            "border-white/20"
          )}
          onClick={onExpand}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isVideoCall && activeCall.remoteStream ? (
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-card to-muted/30">
               {/* Hidden Audio for Voice Calls */}
               {activeCall.remoteStream && (
                 <audio 
                    ref={setAudioRef} 
                    autoPlay 
                    playsInline 
                    controls={false} 
                    className="hidden" 
                 />
               )}
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2,
                  ease: "easeInOut"
                }}
              >
                <Avatar className="w-16 h-16 border-2 border-primary/30">
                  <AvatarImage src={activeCall.otherParticipant?.avatar_url || undefined} />
                  <AvatarFallback className="text-xl bg-primary/20">
                    {(activeCall.otherParticipant?.display_name || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              <p className="text-xs font-medium mt-2 text-foreground/80 truncate max-w-[90%]">
                {activeCall.otherParticipant?.display_name}
              </p>
            </div>
          )}

          {/* Duration badge */}
          <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1.5">
            <span className="text-xs font-medium tabular-nums">{formatDuration(callDuration)}</span>
            {/* Small Quality Indicator */}
             {quality !== 'excellent' && quality !== 'good' && (
                quality === 'disconnected' ? <WifiOff className="w-3 h-3 text-destructive" /> :
                <Wifi className={cn("w-3 h-3", quality === 'bad' ? "text-destructive" : "text-yellow-500")} />
             )}
          </div>

          {/* Expand hint */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="w-6 h-6 text-white" />
          </div>

          {/* Audio indicator */}
          {!isVideoCall && activeCall.session.status === 'connected' && (
            <div className="absolute top-2 left-2 flex items-center gap-0.5">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-primary rounded-full"
                  animate={{
                    height: [6, 14, 6],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
 
         {/* End call button */}
         <motion.button
           whileHover={{ scale: 1.1 }}
           whileTap={{ scale: 0.9 }}
           onClick={(e) => {
             e.stopPropagation();
             onEndCall();
           }}
           className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive flex items-center justify-center shadow-lg glow-destructive"
         >
           <PhoneOff className="w-4 h-4 text-destructive-foreground" />
         </motion.button>
 
         {/* Muted indicators */}
         <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
           {!activeCall.isAudioEnabled && (
             <div className="w-5 h-5 rounded-full bg-destructive/90 flex items-center justify-center text-[10px]">
               🔇
             </div>
           )}
           {isVideoCall && !activeCall.isVideoEnabled && (
             <div className="w-5 h-5 rounded-full bg-destructive/90 flex items-center justify-center text-[10px]">
               📵
             </div>
           )}
         </div>
       </div>
     </motion.div>
   );
 };