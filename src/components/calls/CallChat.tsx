 import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useConversationMessages } from "@/hooks/messages";
import { useAuth } from "@/hooks/useAuth";

interface CallChatProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CallChat = ({
  conversationId,
  isOpen,
  onClose,
}: CallChatProps) => {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage } = useConversationMessages(conversationId);
  
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      const result = await sendMessage(message.trim());
      if (result.success) {
        setMessage("");
      }
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-background/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Chat</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 text-primary/60" />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Nenhuma mensagem ainda
                    </p>
                    <p className="text-muted-foreground/60 text-xs mt-1">
                      As mensagens enviadas aqui aparecem na conversa principal
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isOwn = msg.sender_id === user?.id;
                    const showTime = index === 0 || 
                      new Date(msg.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 60000;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={cn(
                          "max-w-[85%]",
                          isOwn ? "ml-auto" : "mr-auto"
                        )}
                      >
                        <div
                          className={cn(
                            "px-4 py-2.5 rounded-2xl",
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                        {showTime && (
                          <p className={cn(
                            "text-xs text-muted-foreground mt-1",
                            isOwn ? "text-right" : "text-left"
                          )}>
                            {formatTime(msg.created_at)}
                          </p>
                        )}
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-muted/50 border-white/10"
                disabled={isSending || isLoading}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!message.trim() || isSending || isLoading}
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};