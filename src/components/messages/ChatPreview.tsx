import { BadgeCheck, Mic, Sticker } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatPreviewProps {
  id: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  lastMessage?: string | null;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  isVerified?: boolean;
  verificationBadge?: "blue" | "gold" | "staff" | "none" | null;
  isAudioMessage?: boolean;
  isStickerMessage?: boolean;
  onClick: () => void;
  index?: number;
  // Legacy props for backward compatibility
  avatar?: string;
  timestamp?: string;
}

export const ChatPreview = ({
  displayName,
  avatarUrl,
  avatar,
  lastMessage,
  lastMessageTime,
  timestamp,
  unreadCount = 0,
  isOnline,
  isVerified,
  verificationBadge = "blue",
  isAudioMessage = false,
  isStickerMessage = false,
  onClick,
  index = 0,
}: ChatPreviewProps) => {
  const getBadgeColor = () => {
    switch (verificationBadge) {
      case "gold":
        return "text-amber-500";
      case "staff":
        return "text-purple-500";
      default:
        return "text-blue-500";
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Ontem";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("pt-BR", { weekday: "short" });
    } else {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }
  };

  const finalAvatar = avatarUrl || avatar;
  const finalTimestamp = timestamp || formatTime(lastMessageTime);
  const finalDisplayName = displayName || "Usuário";

  // Check if it's an audio message from the message content (legacy support)
  const isAudio = isAudioMessage || (lastMessage?.includes("🎤"));

  const getMessagePreview = () => {
    if (isStickerMessage) {
      return "Sticker";
    }
    if (isAudio) {
      return "Mensagem de áudio";
    }
    return lastMessage || "Nenhuma mensagem";
  };

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors"
    >
      <div className="relative">
        <div className={cn(
          "w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-300",
          unreadCount > 0 ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-zinc-800"
        )}>
          {finalAvatar ? (
            <img 
              src={finalAvatar} 
              alt={finalDisplayName} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <span className="text-lg font-bold text-zinc-400">
                {finalDisplayName[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>
        {isOnline && (
          <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-black rounded-full z-10" />
        )}
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn(
            "font-semibold text-base truncate",
            unreadCount > 0 ? "text-white" : "text-zinc-300"
          )}>
            {finalDisplayName}
          </span>
          {isVerified && (
            <BadgeCheck className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
          )}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-zinc-500">
          {isStickerMessage && <Sticker className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />}
          {isAudio && !isStickerMessage && <Mic className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />}
          <p className={cn(
            "truncate transition-colors",
            unreadCount > 0 ? "text-zinc-200 font-medium" : "text-zinc-500"
          )}>
            {getMessagePreview()}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pl-2">
        {finalTimestamp && (
          <span className={cn(
            "text-[10px] font-medium",
            unreadCount > 0 ? "text-emerald-400" : "text-zinc-600"
          )}>
            {finalTimestamp}
          </span>
        )}
        {unreadCount > 0 && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-900/50"
          >
            <span className="text-[10px] font-bold text-black">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </motion.div>
        )}
      </div>
    </motion.button>
  );
};
