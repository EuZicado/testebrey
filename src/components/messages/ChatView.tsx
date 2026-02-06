import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
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
  const { activeCall } = useCall();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

  const isInCallWithUser = activeCall?.session.conversation_id === conversationId;
  const isOtherUserTyping = otherUser ? typingUsers.includes(otherUser.id) : false;
  const isOtherUserOnline = otherUser ? onlineUsers.includes(otherUser.id) : false;

  // Initial Scroll
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [isLoading, conversationId]);

  // Smart Scroll on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    const isOwnMessage = lastMessage.sender_id === user?.id;
    
    if (isOwnMessage || isAtBottom) {
       messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom, user?.id]);

  // Mark messages as read
  useEffect(() => {
    if (messages.length > 0 && isAtBottom) {
      markAsRead();
    }
  }, [messages, isAtBottom, markAsRead]);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      setIsAtBottom(distanceToBottom < 100);
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, stickerUrl?: string) => {
      try {
        const result = await sendMessage(content, stickerUrl);
        if (!result.success) throw new Error(result.error);
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch (error) {
        toast.error("Erro ao enviar mensagem");
        console.error(error);
      }
    },
    [sendMessage]
  );

  const handleSendAudio = useCallback(
    async (audioBlob: Blob, duration: number) => {
      try {
        const result = await sendAudioMessage(audioBlob, duration);
        if (!result.success) throw new Error(result.error);
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch (error) {
        toast.error("Erro ao enviar áudio");
        console.error(error);
      }
    },
    [sendAudioMessage]
  );

  const renderDateSeparator = (currentMessage: any, previousMessage: any) => {
    if (!previousMessage) return true;
    const currentDate = new Date(currentMessage.created_at);
    const previousDate = new Date(previousMessage.created_at);
    return !isSameDay(currentDate, previousDate);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-zinc-950 z-[50] flex flex-col font-sans"
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

      {/* In-Call Banner */}
      <AnimatePresence>
        {isInCallWithUser && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-950/30 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-center backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-emerald-400 tracking-wide uppercase">Chamada em andamento</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 bg-gradient-to-b from-zinc-950 to-black scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 opacity-80">
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="w-24 h-24 rounded-full bg-zinc-900/50 flex items-center justify-center mb-6 border border-zinc-800"
            >
              <span className="text-4xl">👋</span>
            </motion.div>
            <p className="text-zinc-300 font-semibold text-xl">Diga Olá!</p>
            <p className="text-sm text-zinc-500 mt-2 max-w-[240px]">
              Comece a conversa com {otherUser?.display_name || "este usuário"}.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pb-4 max-w-3xl mx-auto w-full">
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
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-8 sticky top-2 z-10">
                      <span className="bg-zinc-900/90 backdrop-blur-md text-zinc-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-zinc-800/50 shadow-sm">
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
                </div>
              );
            })}

            {/* Typing indicator */}
            {isOtherUserTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-2 mt-2"
              >
                {otherUser?.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-zinc-950"
                  />
                ) : (
                   <div className="w-6 h-6 rounded-full bg-zinc-800 ring-2 ring-zinc-950" />
                )}
                <div className="bg-zinc-900 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-zinc-800">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}
      </div>

      <div className="p-2 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 max-w-full">
        <div className="max-w-3xl mx-auto w-full">
            <MessageInput
            onSend={handleSendMessage}
            onSendAudio={handleSendAudio}
            onTypingStart={startTyping}
            onTypingStop={stopTyping}
            />
        </div>
      </div>
    </motion.div>
  );
};
