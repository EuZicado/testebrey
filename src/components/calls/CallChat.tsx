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
          className="absolute right-0 top-0 bottom-0 w-full sm:w-80 md:w-96 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-[150] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-white" />
              <h3 className="font-semibold text-white">Chat da Chamada</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white hover:bg-white/10">
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
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-xs mt-1 opacity-60">
                      As mensagens enviadas aqui aparecem na conversa principal
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isOwn = msg.sender_id === user?.id;
                    const isSystem = msg.content.startsWith("📞");

                    if (isSystem) {
                         return (
                            <div key={msg.id || index} className="flex justify-center my-2">
                                <span className="text-[10px] text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-full">
                                    {msg.content} • {formatTime(msg.created_at)}
                                </span>
                            </div>
                         );
                    }

                    return (
                      <div
                        key={msg.id || index}
                        className={cn(
                          "flex flex-col max-w-[85%]",
                          isOwn ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "px-4 py-2 rounded-2xl text-sm shadow-sm",
                            isOwn
                              ? "bg-blue-600 text-white rounded-tr-none"
                              : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700"
                          )}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1 px-1">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 bg-black/20 border-t border-white/10">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-blue-500"
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!message.trim() || isSending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
