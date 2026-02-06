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
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 overflow-hidden bg-black/80 backdrop-blur-sm"
      >
        {/* Background blur pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-green-500/10 blur-3xl"
            animate={{ 
              x: [0, 50, 0],
              y: [0, 30, 0],
            }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-blue-500/10 blur-3xl"
            animate={{ 
              x: [0, -30, 0],
              y: [0, -50, 0],
            }}
            transition={{ duration: 10, repeat: Infinity }}
          />
        </div>

        {/* Caller Info */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative flex flex-col items-center z-10"
        >
          {/* Animated ring around avatar */}
          <div className="relative">
            {/* Multiple pulsing rings */}
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border-2 border-green-500/40"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{
                  scale: [1, 1.3 + i * 0.15],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeOut"
                }}
              />
            ))}
            
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 bg-green-500/30 blur-2xl rounded-full"
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
            />
            
            <Avatar className="relative w-36 h-36 border-4 border-green-500/40 shadow-2xl">
              <AvatarImage src={incomingCall.caller.avatar_url || undefined} />
              <AvatarFallback className="text-5xl bg-zinc-800 text-white">
                {(incomingCall.caller.display_name || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <h2 className="mt-8 text-3xl font-bold text-white">
            {incomingCall.caller.display_name || incomingCall.caller.username}
          </h2>
          <p className="text-zinc-400 mt-2 flex items-center gap-2 text-lg">
            {isVideoCall ? (
              <>
                <Video className="w-5 h-5" />
                Videochamada recebida
              </>
            ) : (
              <>
                <Phone className="w-5 h-5" />
                Chamada de voz recebida
              </>
            )}
          </p>
        </motion.div>

        {/* Call Actions */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 mt-20 flex items-center gap-16"
        >
          {/* Decline */}
          <motion.div 
            className="flex flex-col items-center gap-3"
            whileHover={{ scale: 1.05 }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={declineCall}
              className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors"
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </motion.button>
            <span className="text-sm font-medium text-white/80">Recusar</span>
          </motion.div>

          {/* Answer */}
          <motion.div 
            className="flex flex-col items-center gap-3"
            whileHover={{ scale: 1.05 }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={answerCall}
              disabled={isConnecting}
              className={cn(
                "w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg transition-colors",
                isConnecting && "opacity-50 cursor-not-allowed"
              )}
              animate={!isConnecting ? {
                scale: [1, 1.05, 1],
              } : {}}
              transition={{
                duration: 1,
                repeat: Infinity,
              }}
            >
              {isVideoCall ? <Video className="w-8 h-8 text-white" /> : <Phone className="w-8 h-8 text-white" />}
            </motion.button>
            <span className="text-sm font-medium text-white/80">
              {isConnecting ? "Conectando..." : "Atender"}
            </span>
          </motion.div>
        </motion.div>

      </motion.div>
    </AnimatePresence>
  );
};
