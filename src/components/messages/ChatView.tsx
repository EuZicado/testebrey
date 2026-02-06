import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Phone, Video, Minimize2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConversationMessages, useOtherParticipant } from "@/hooks/messages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { usePresence } from "@/hooks/usePresence";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { useCall } from "@/contexts/CallContext";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatViewProps {
  conversationId: string;
  onBack: () => void;
}

export const ChatView = ({ conversationId, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, sendAudioMessage, markAsRead } =
    useConversationMessages(conversationId);
  const { otherUser } = useOtherParticipant(conversationId);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversationId);
  const { onlineUsers } = usePresence();
  const { toggleReaction, getReactionCounts } = useMessageReactions(conversationId);
  const { activeCall, startCall } = useCall();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const isInCallWithUser = activeCall?.session.conversation_id === conversationId;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // Mark messages as read
  useEffect(() => {
    markAsRead();
  }, [messages, markAsRead]);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 100);
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, stickerUrl?: string) => {
      const result = await sendMessage(content, stickerUrl);
      if (!result.success) {
        toast.error(result.error || "Erro ao enviar mensagem");
        throw new Error(result.error);
      }
    },
    [sendMessage]
  );

  const handleSendAudio = useCallback(
    async (audioBlob: Blob, duration: number) => {
      const result = await sendAudioMessage(audioBlob, duration);
      if (!result.success) {
        toast.error(result.error || "Erro ao enviar áudio");
        throw new Error(result.error);
      }
    },
    [sendAudioMessage]
  );

  const isOtherUserTyping = otherUser ? typingUsers.includes(otherUser.id) : false;
  const isOtherUserOnline = otherUser ? onlineUsers.includes(otherUser.id) : false;

  const renderDateSeparator = (currentMessage: any, previousMessage: any) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.created_at);
    const previousDate = new Date(previousMessage.created_at);
    
    return !isSameDay(currentDate, previousDate);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando conversa...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="fixed inset-0 bg-background z-[50] flex flex-col"
    >
      <ChatHeader
        conversationId={conversationId}
        otherUserId={otherUser?.id || ""}
        displayName={otherUser?.display_name || null}
        username={otherUser?.username || null}
        avatarUrl={otherUser?.avatar_url || null}
        isOnline={isOtherUserOnline}
        isTyping={isOtherUserTyping}
        onBack={onBack}
      />

      {/* In-Call Banner (Sticky) */}
      <AnimatePresence>
        {isInCallWithUser && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-emerald-400 tracking-tight">Chamada ativa</span>
            </div>
            <div className="flex items-center gap-2">
               {/* Controls could go here, but Overlay handles it. Maybe a 'Return to Call' button? */}
               {/* The overlay is already visible or minimized. This is just an indicator. */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-zinc-950 to-black scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 opacity-60">
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="w-24 h-24 rounded-full bg-zinc-900/50 flex items-center justify-center mb-6 border border-zinc-800"
            >
              <span className="text-4xl">👋</span>
            </motion.div>
            <p className="text-zinc-400 font-medium text-lg">Nenhuma mensagem ainda</p>
            <p className="text-sm text-zinc-600 mt-2 max-w-[200px]">
              Diga oi para {otherUser?.display_name || "este usuário"} e comece uma nova conexão!
            </p>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {messages.map((message, index) => {
              const previousMessage = messages[index - 1];
              const showDateSeparator = renderDateSeparator(message, previousMessage);
              
              const isOwn = message.sender_id === user?.id;
              const showAvatar =
                !isOwn &&
                (index === messages.length - 1 ||
                  messages[index + 1]?.sender_id !== message.sender_id);

              const reactions = getReactionCounts(message.id);

              return (
                <motion.div 
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                  {showDateSeparator && (
                    <div className="flex justify-center my-6">
                      <span className="bg-zinc-900/80 backdrop-blur-md text-zinc-500 text-[10px] font-medium px-3 py-1 rounded-full uppercase tracking-wider border border-zinc-800 shadow-sm">
                        {format(new Date(message.created_at), "d 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  
                  <MessageBubble
                    messageId={message.id}
                    content={message.content}
                    stickerUrl={message.sticker_url}
                    audioUrl={message.audio_url}
                    audioDuration={message.audio_duration_seconds}
                    isOwn={isOwn}
                    isRead={message.is_read}
                    timestamp={message.created_at}
                    showAvatar={showAvatar}
                    avatarUrl={!isOwn ? otherUser?.avatar_url : undefined}
                    reactions={reactions}
                    onToggleReaction={toggleReaction}
                  />
                </motion.div>
              );
            })}

            {/* Typing indicator */}
            {isOtherUserTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-2 mt-2 ml-2"
              >
                {otherUser?.avatar_url && (
                  <img
                    src={otherUser.avatar_url}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-background"
                  />
                )}
                <div className="bg-zinc-900 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-zinc-800">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-2 bg-background/80 backdrop-blur-md border-t border-border/50">
        <MessageInput
          onSend={handleSendMessage}
          onSendAudio={handleSendAudio}
          onTypingStart={startTyping}
          onTypingStop={stopTyping}
        />
      </div>
    </motion.div>
  );
};
