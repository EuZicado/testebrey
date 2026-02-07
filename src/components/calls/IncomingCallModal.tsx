import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCall } from "@/contexts/CallContext";
import { cn } from "@/lib/utils";

export const IncomingCallModal = () => {
  const { incomingCall, answerCall, declineCall, isConnecting } = useCall();
  
  if (!incomingCall) return null;

  const isVideoCall = incomingCall.session.call_type === 'video';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 overflow-hidden bg-zinc-950/80 backdrop-blur-xl"
      >
        {/* Background blur pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-emerald-500/20 blur-[120px]"
            animate={{ 
              x: [0, 50, 0],
              y: [0, 30, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-lg max-h-lg bg-zinc-900/50 blur-[100px] rounded-full"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-blue-500/20 blur-[120px]"
            animate={{ 
              x: [0, -30, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </div>

        {/* Caller Info */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative flex flex-col items-center z-10"
        >
          {/* Animated ring around avatar */}
          <div className="relative mb-8">
            {/* Multiple pulsing rings */}
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border border-emerald-500/30"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{
                  scale: [1, 1.5 + i * 0.2],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: "easeOut"
                }}
              />
            ))}
            
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"
              animate={{
                scale: [0.8, 1.2, 0.8],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            <div className="relative p-1 rounded-full bg-gradient-to-b from-emerald-500/50 to-transparent backdrop-blur-sm">
                <Avatar className="w-32 h-32 border-4 border-zinc-950 shadow-2xl">
                <AvatarImage src={incomingCall.caller.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="text-4xl bg-zinc-900 text-white font-bold">
                    {(incomingCall.caller.display_name || "U")[0].toUpperCase()}
                </AvatarFallback>
                </Avatar>
            </div>
            
            {/* Status Indicator */}
            <motion.div 
                className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-zinc-950 shadow-lg"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
          </div>

          <h2 className="text-3xl font-bold text-white text-center tracking-tight">
            {incomingCall.caller.display_name || incomingCall.caller.username}
          </h2>
          <div className="mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
            {isVideoCall ? (
                <Video className="w-4 h-4 text-emerald-400" />
            ) : (
                <Phone className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-sm font-medium text-white/90">
                {isVideoCall ? 'Videochamada recebida' : 'Chamada de voz recebida'}
            </span>
          </div>
        </motion.div>

        {/* Call Actions */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="relative z-10 mt-16 flex items-center gap-12"
        >
          {/* Decline */}
          <div className="flex flex-col items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
              onClick={declineCall}
              className="w-16 h-16 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 flex items-center justify-center shadow-lg transition-all duration-300 backdrop-blur-sm"
            >
              <PhoneOff className="w-7 h-7" />
            </motion.button>
            <span className="text-xs font-medium text-white/60 tracking-wide uppercase">Recusar</span>
          </div>

          {/* Answer */}
          <div className="flex flex-col items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={answerCall}
              disabled={isConnecting}
              className={cn(
                "w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transition-all duration-300 border-4 border-emerald-400/30",
                isConnecting && "opacity-50 cursor-not-allowed"
              )}
              animate={!isConnecting ? {
                boxShadow: [
                    "0 0 0 0 rgba(16, 185, 129, 0.4)",
                    "0 0 0 20px rgba(16, 185, 129, 0)",
                ]
              } : {}}
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
            >
              {isConnecting ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-white border-t-transparent rounded-full"
                  />
              ) : (
                  isVideoCall ? <Video className="w-8 h-8 text-white fill-current" /> : <Phone className="w-8 h-8 text-white fill-current" />
              )}
            </motion.button>
            <span className="text-xs font-medium text-white/60 tracking-wide uppercase">
              {isConnecting ? "Conectando..." : "Atender"}
            </span>
          </div>
        </motion.div>

      </motion.div>
    </AnimatePresence>
  );
};
