 import { motion } from "framer-motion";
 import { 
   Mic, 
   MicOff, 
   Video, 
   VideoOff, 
   PhoneOff, 
   Monitor,
   Camera,
   MoreVertical,
   Volume2,
   VolumeX
 } from "lucide-react";
 import { cn } from "@/lib/utils";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
 
 interface CallControlsProps {
   isAudioEnabled: boolean;
   isVideoEnabled: boolean;
   isScreenSharing: boolean;
   isVideoCall: boolean;
   isSpeakerOn?: boolean;
   onToggleAudio: () => void;
   onToggleVideo: () => void;
   onToggleScreenShare: () => void;
   onEndCall: () => void;
   onToggleSpeaker?: () => void;
   onSwitchCamera?: () => void;
 }
 
 export const CallControls = ({
   isAudioEnabled,
   isVideoEnabled,
   isScreenSharing,
   isVideoCall,
   isSpeakerOn = true,
   onToggleAudio,
   onToggleVideo,
   onToggleScreenShare,
   onEndCall,
   onToggleSpeaker,
   onSwitchCamera,
 }: CallControlsProps) => {
   return (
     <motion.div 
       initial={{ y: 50, opacity: 0 }}
       animate={{ y: 0, opacity: 1 }}
       className="flex items-center justify-center gap-3"
     >
       {/* Audio Toggle */}
       <motion.button
         whileHover={{ scale: 1.05 }}
         whileTap={{ scale: 0.95 }}
         onClick={onToggleAudio}
         className={cn(
           "call-button transition-all duration-300",
           isAudioEnabled 
             ? "bg-muted/50 hover:bg-muted text-foreground" 
             : "bg-destructive/20 text-destructive glow-destructive"
         )}
       >
         {isAudioEnabled ? (
           <Mic className="w-6 h-6" />
         ) : (
           <MicOff className="w-6 h-6" />
         )}
       </motion.button>
 
       {/* Video Toggle (only for video calls) */}
       {isVideoCall && (
         <motion.button
           whileHover={{ scale: 1.05 }}
           whileTap={{ scale: 0.95 }}
           onClick={onToggleVideo}
           className={cn(
             "call-button transition-all duration-300",
             isVideoEnabled 
               ? "bg-muted/50 hover:bg-muted text-foreground" 
               : "bg-destructive/20 text-destructive glow-destructive"
           )}
         >
           {isVideoEnabled ? (
             <Video className="w-6 h-6" />
           ) : (
             <VideoOff className="w-6 h-6" />
           )}
         </motion.button>
       )}
 
       {/* End Call Button */}
       <motion.button
         whileHover={{ scale: 1.05 }}
         whileTap={{ scale: 0.95 }}
         onClick={onEndCall}
         className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center glow-destructive"
       >
         <PhoneOff className="w-7 h-7 text-destructive-foreground" />
       </motion.button>
 
       {/* Screen Share */}
       <motion.button
         whileHover={{ scale: 1.05 }}
         whileTap={{ scale: 0.95 }}
         onClick={onToggleScreenShare}
         className={cn(
           "call-button transition-all duration-300",
           isScreenSharing 
             ? "bg-primary/20 text-primary glow-primary" 
             : "bg-muted/50 hover:bg-muted text-foreground"
         )}
       >
         <Monitor className="w-6 h-6" />
       </motion.button>
 
       {/* More Options */}
       <DropdownMenu>
         <DropdownMenuTrigger asChild>
           <motion.button
             whileHover={{ scale: 1.05 }}
             whileTap={{ scale: 0.95 }}
             className="call-button bg-muted/50 hover:bg-muted text-foreground"
           >
             <MoreVertical className="w-6 h-6" />
           </motion.button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="center" className="ios-blur border-white/10">
           {onToggleSpeaker && (
             <DropdownMenuItem onClick={onToggleSpeaker}>
               {isSpeakerOn ? (
                 <>
                   <Volume2 className="w-4 h-4 mr-2" />
                   Desligar alto-falante
                 </>
               ) : (
                 <>
                   <VolumeX className="w-4 h-4 mr-2" />
                   Ligar alto-falante
                 </>
               )}
             </DropdownMenuItem>
           )}
           {isVideoCall && onSwitchCamera && (
             <DropdownMenuItem onClick={onSwitchCamera}>
               <Camera className="w-4 h-4 mr-2" />
               Alternar câmera
             </DropdownMenuItem>
           )}
         </DropdownMenuContent>
       </DropdownMenu>
     </motion.div>
   );
 };