import { ArrowLeft, MoreVertical, Phone, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TypingIndicator } from "./TypingIndicator";
import { useCall } from "@/contexts/CallContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ChatHeaderProps {
  conversationId: string;
  otherUserId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  isTyping: boolean;
  onBack: () => void;
}

export const ChatHeader = ({
  conversationId,
  otherUserId,
  displayName,
  username,
  avatarUrl,
  isOnline,
  isTyping,
  onBack,
}: ChatHeaderProps) => {
  const { startCall, activeCall } = useCall();
  const isInCallWithUser = activeCall?.session.conversation_id === conversationId;

  const handleVoiceCall = async () => {
    if (activeCall) {
      if (isInCallWithUser) {
        // Optionally expand call if minimized (requires access to CallOverlay state, 
        // but here we just show a toast or nothing as the overlay is global)
        toast.info("Você já está em uma chamada com este usuário");
      } else {
        toast.error("Você já está em outra chamada");
      }
      return;
    }
    await startCall(conversationId, otherUserId, "audio", {
      displayName: displayName || "Usuário",
      username: username || "usuario",
      avatarUrl: avatarUrl || ""
    });
  };

  const handleVideoCall = async () => {
    if (activeCall) {
       if (isInCallWithUser) {
        toast.info("Você já está em uma chamada com este usuário");
      } else {
        toast.error("Você já está em outra chamada");
      }
      return;
    }
    await startCall(conversationId, otherUserId, "video", {
      displayName: displayName || "Usuário",
      username: username || "usuario",
      avatarUrl: avatarUrl || ""
    });
  };

  return (
    <header className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-4 py-3 safe-top">
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        
        <div className="relative">
          <Avatar className="w-10 h-10 ring-2 ring-zinc-950">
            <AvatarImage src={avatarUrl || undefined} className="object-cover" />
            <AvatarFallback className="bg-zinc-800 text-zinc-400 font-bold">
              {(displayName || "U")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950"
            />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate text-zinc-100">{displayName || username || "Usuário"}</p>
          {isInCallWithUser ? (
             <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-xs text-emerald-500 font-medium">Em chamada</p>
             </div>
          ) : isTyping ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-emerald-500 font-medium">Digitando</span>
              <TypingIndicator className="scale-75 origin-left" />
            </div>
          ) : isOnline ? (
            <p className="text-xs text-emerald-500 font-medium">Online agora</p>
          ) : (
            <p className="text-xs text-zinc-500">@{username || "unknown"}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleVoiceCall}
            className={cn(
              "p-2 rounded-full transition-colors",
              isInCallWithUser ? "bg-emerald-500/20 text-emerald-500" : "hover:bg-zinc-800 text-zinc-400 hover:text-emerald-500",
              activeCall && !isInCallWithUser && "opacity-30 cursor-not-allowed"
            )}
            disabled={!!activeCall && !isInCallWithUser}
          >
            <Phone className="w-5 h-5" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleVideoCall}
            className={cn(
              "p-2 rounded-full transition-colors",
              isInCallWithUser ? "bg-emerald-500/20 text-emerald-500" : "hover:bg-zinc-800 text-zinc-400 hover:text-emerald-500",
               activeCall && !isInCallWithUser && "opacity-30 cursor-not-allowed"
            )}
             disabled={!!activeCall && !isInCallWithUser}
          >
            <Video className="w-5 h-5" />
          </motion.button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800 text-zinc-200">
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-white cursor-pointer">Ver perfil</DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-white cursor-pointer">Silenciar notificações</DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-white cursor-pointer">Buscar na conversa</DropdownMenuItem>
              <DropdownMenuItem className="text-red-400 focus:bg-red-900/20 focus:text-red-300 cursor-pointer">Bloquear usuário</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
