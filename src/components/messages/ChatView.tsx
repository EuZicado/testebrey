import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowDown, Phone, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConversationMessages, useOtherParticipant } from "@/hooks/messages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { usePresence } from "@/hooks/usePresence";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { useCall } from "@/contexts/CallContext";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const isInCallWithUser = activeCall?.session.conversation_id === conversationId;
  const isOtherUserTyping = otherUser ? typingUsers.includes(otherUser.id) : false;
  const isOtherUserOnline = otherUser ? onlineUsers.includes(otherUser.id) : false;

  // Auto-scroll logic
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Initial scroll
  useEffect(() => {
    if (!isLoading && isFirstLoad && messages.length > 0) {
      scrollToBottom("auto");
      setIsFirstLoad(false);
    }
  }, [messages, isLoading, isFirstLoad]);

  // Scroll on new messages if near bottom
  useEffect(() => {
    if (messages.length > 0 && !isFirstLoad) {
      const container = containerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        
        // If user sent the last message or was already near bottom, scroll
        const lastMessage = messages[messages.length - 1];
        const isOwn = lastMessage.sender_id === user?.id;
        
        if (isOwn || isNearBottom) {
          scrollToBottom();
        }
      }
    }
  }, [messages, user?.id, isFirstLoad]);

  // Mark as read
  useEffect(() => {
    if (messages.length > 0 && document.hasFocus()) {
      markAsRead();
    }
  }, [messages, markAsRead]);

  // Scroll handler for "Scroll to Bottom" button
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollBottom(distanceFromBottom > 200);
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, stickerUrl?: string) => {
      const result = await sendMessage(content, stickerUrl);
      if (!result.success) {
        toast.error(result.error || "Erro ao enviar mensagem");
      } else {
        scrollToBottom();
      }
    },
    [sendMessage]
  );

  const handleSendAudio = useCallback(
    async (audioBlob: Blob, duration: number) => {
      const result = await sendAudioMessage(audioBlob, duration);
      if (!result.success) {
        toast.error(result.error || "Erro ao enviar áudio");
      } else {
        scrollToBottom();
      }
    },
    [sendAudioMessage]
  );

  const renderDateSeparator = (current: any, previous: any) => {
    if (!previous) return true;
    const currentDate = new Date(current.created_at);
    const previousDate = new Date(previous.created_at);
    return !isSameDay(currentDate, previousDate);
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando conversa...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background w-full">
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
            className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between backdrop-blur-sm z-10"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-emerald-400 tracking-tight">Chamada em andamento</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-zinc-950 to-black">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto px-4 py-4 scroll-smooth"
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
                  <div key={message.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-6 sticky top-2 z-10">
                        <span className="bg-zinc-900/80 backdrop-blur-md text-zinc-500 text-[10px] font-medium px-3 py-1 rounded-full uppercase tracking-wider border border-zinc-800 shadow-sm">
                          {format(new Date(message.created_at), "d 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.2 }}
                    >
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
                  </div>
                );
              })}
              
              {/* Typing Indicator */}
              {isOtherUserTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-2 ml-2"
                >
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 flex gap-1">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                      className="w-1.5 h-1.5 bg-zinc-500 rounded-full"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                      className="w-1.5 h-1.5 bg-zinc-500 rounded-full"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                      className="w-1.5 h-1.5 bg-zinc-500 rounded-full"
                    />
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBottom && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute bottom-4 right-4 z-20"
            >
              <Button
                size="icon"
                className="rounded-full bg-primary/90 hover:bg-primary shadow-lg"
                onClick={() => scrollToBottom()}
              >
                <ArrowDown className="w-5 h-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MessageInput
        onSendMessage={handleSendMessage}
        onSendAudio={handleSendAudio}
        onStartTyping={startTyping}
        onStopTyping={stopTyping}
        isLoading={false}
      />
    </div>
  );
};