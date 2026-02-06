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
  Signal
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCall } from "@/contexts/CallContext";
import { cn } from "@/lib/utils";
import { CallChat } from "./CallChat";
import { MinimizedCall } from "./MinimizedCall";

export const CallOverlay = () => {
  const { 
    activeCall, 
    endCall, 
    toggleAudio, 
    toggleVideo, 
    toggleScreenShare,
    switchCamera,
    isConnecting,
    connectionQuality
  } = useCall();
  
  const [showChat, setShowChat] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Update video refs when streams change
  useEffect(() => {
    if (localVideoRef.current && activeCall?.localStream) {
      localVideoRef.current.srcObject = activeCall.localStream;
    }
  }, [activeCall?.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && activeCall?.remoteStream) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
    }
  }, [activeCall?.remoteStream]);

  // Call duration timer - starts only after connected
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
        className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
      >
        {/* Main Content Area */}
        <div className="relative flex-1 w-full overflow-hidden">
          
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
               {/* Pulsing Effect for Ringing */}
              {(isRinging || isConnecting) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute w-40 h-40 rounded-full border border-green-500/30"
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
              
              <div className="mt-6 text-center z-10">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  {activeCall.otherParticipant?.display_name || "Usuário"}
                </h2>
                <p className="text-zinc-400 text-lg animate-pulse">
                  {isRinging ? "Chamando..." : isConnecting ? "Conectando..." : formatDuration(callDuration)}
                </p>
              </div>
            </div>
          )}

          {/* Local Video (PiP) */}
          {isVideoCall && activeCall.localStream && (
             <motion.div 
               drag
               dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
               className="absolute top-4 right-4 w-32 h-48 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 shadow-xl z-20 cursor-move"
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

          {/* Connection Quality Indicator */}
          {isConnected && (
             <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full z-20">
                <Signal className={cn(
                  "w-4 h-4",
                  connectionQuality === 'good' ? "text-green-500" : 
                  connectionQuality === 'poor' ? "text-yellow-500" : "text-red-500"
                )} />
                <span className="text-xs text-white/80">
                  {connectionQuality === 'good' ? "Boa conexão" : "Instável"}
                </span>
             </div>
          )}
        </div>

        {/* Control Bar */}
        <div className="relative z-30 bg-zinc-900/90 backdrop-blur-lg border-t border-white/10 p-6 pb-8">
           <div className="flex items-center justify-center gap-6 max-w-md mx-auto">
              
              {/* Mute Toggle */}
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "w-14 h-14 rounded-full border-0 transition-all duration-200",
                  isAudioEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-white text-black hover:bg-zinc-200"
                )}
                onClick={handleToggleAudio}
              >
                {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </Button>

              {/* Video Toggle */}
              {isVideoCall && (
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "w-14 h-14 rounded-full border-0 transition-all duration-200",
                    isVideoEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-white text-black hover:bg-zinc-200"
                  )}
                  onClick={handleToggleVideo}
                >
                  {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </Button>
              )}

              {/* End Call (Center, Large) */}
              <Button
                variant="destructive"
                size="icon"
                className="w-20 h-20 rounded-full shadow-lg bg-red-500 hover:bg-red-600 border-4 border-zinc-900"
                onClick={endCall}
              >
                <PhoneOff className="w-10 h-10 text-white" />
              </Button>

              {/* Switch Camera */}
              {isVideoCall && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border-0"
                  onClick={switchCamera}
                >
                  <SwitchCamera className="w-6 h-6" />
                </Button>
              )}

              {/* Chat Toggle */}
              <Button
                 variant="ghost"
                 size="icon"
                 className={cn(
                   "w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border-0",
                   showChat && "bg-blue-600 text-white hover:bg-blue-700"
                 )}
                 onClick={() => setShowChat(!showChat)}
              >
                 <MessageSquare className="w-6 h-6" />
              </Button>
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
