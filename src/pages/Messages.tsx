import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChatPreview } from "@/components/messages/ChatPreview";
import { ChatView } from "@/components/messages/ChatView";
import { NewConversationSheet } from "@/components/messages/NewConversationSheet";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { usePresence } from "@/hooks/usePresence";
import { 
  Loader2, 
  MessageCircle, 
  Search, 
  Plus, 
  Settings2, 
  X,
  MessageSquarePlus,
  Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const Messages = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { conversations, isLoading: messagesLoading } = useMessages();
  const { onlineUsers } = usePresence();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Redireciona se não estiver logado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleConversationCreated = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowNewConversation(false);
  };

  // Filtragem inteligente de conversas
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(conv => 
        conv.otherUser?.display_name?.toLowerCase().includes(query) ||
        conv.otherUser?.username?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => {
      // Prioridade: Não lidas primeiro, depois data
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [conversations, searchQuery]);

  const stats = useMemo(() => {
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    const onlineCount = conversations.filter(c => 
      c.otherUser && onlineUsers.includes(c.otherUser.id)
    ).length;
    
    return { total: conversations.length, unread: totalUnread, online: onlineCount };
  }, [conversations, onlineUsers]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="relative flex flex-col h-screen bg-black overflow-hidden font-sans">
        
        {/* ChatView Overlay - Resolve o problema do BottomNav */}
        <AnimatePresence>
          {selectedConversationId && (
            <motion.div 
              initial={{ x: "100%", opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
              className="fixed inset-0 z-[60] bg-black"
            >
              <ChatView
                conversationId={selectedConversationId}
                onBack={() => setSelectedConversationId(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Principal */}
        <header className="shrink-0 pt-safe bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 z-40 sticky top-0">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <motion.h1 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold tracking-tighter text-white"
                >
                  Mensagens
                </motion.h1>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2 mt-1.5">
                  <Badge variant="secondary" className="bg-zinc-800/50 text-zinc-400 border-zinc-700/50 text-[10px] h-5 px-2 hover:bg-zinc-800 transition-colors">
                    {stats.total} CONVERSAS
                  </Badge>
                  {stats.unread > 0 && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] h-5 px-2">
                      {stats.unread} NOVAS
                    </Badge>
                  )}
                </motion.div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all duration-300">
                <Settings2 className="w-5 h-5" />
              </Button>
            </div>

            {/* Barra de Busca */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <Input
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 rounded-2xl bg-zinc-900/50 border-zinc-800/50 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50 transition-all duration-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Online Users Horizontal Scroll (Stories style) */}
          {stats.online > 0 && !searchQuery && (
            <div className="pb-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <ScrollArea className="w-full whitespace-nowrap px-6">
                <div className="flex gap-4 pb-2">
                  <motion.button 
                    onClick={() => setShowNewConversation(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-2 group"
                  >
                     <div className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 group-hover:border-emerald-500 group-hover:text-emerald-500 transition-colors">
                        <Plus className="w-6 h-6" />
                     </div>
                     <span className="text-[10px] font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">Novo</span>
                  </motion.button>
                  
                  {conversations
                    .filter(c => c.otherUser && onlineUsers.includes(c.otherUser.id))
                    .map((conv, i) => (
                      <motion.button
                        key={conv.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => setSelectedConversationId(conv.id)}
                        className="flex flex-col items-center gap-2 group relative"
                      >
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                          <div className="relative w-14 h-14 rounded-full bg-zinc-900 overflow-hidden border-2 border-zinc-950 ring-2 ring-emerald-500/50 group-hover:ring-emerald-400 transition-all">
                            {conv.otherUser?.avatar_url ? (
                              <img src={conv.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 font-bold text-lg">
                                {conv.otherUser?.display_name?.[0]}
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-black z-10" />
                        </div>
                        <span className="text-[10px] font-medium text-zinc-400 max-w-[64px] truncate group-hover:text-white transition-colors">
                          {conv.otherUser?.display_name?.split(" ")[0]}
                        </span>
                      </motion.button>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </header>

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          <div className="px-3 pt-2 pb-32"> {/* pb-32 garante que o último item não fique atrás do nav */}
            {messagesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
                <p className="text-sm text-zinc-500">Carregando conversas...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center px-6"
              >
                <div className="w-24 h-24 rounded-3xl bg-zinc-900/50 flex items-center justify-center mb-6 border border-zinc-800">
                  <MessageSquarePlus className="w-10 h-10 text-zinc-600" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-200">Nenhuma conversa encontrada</h3>
                <p className="text-sm text-zinc-500 mt-2 mb-8 max-w-[200px]">
                  {searchQuery ? "Tente buscar por um termo diferente." : "Comece a interagir! Suas conversas aparecerão aqui."}
                </p>
                {!searchQuery && (
                  <Button 
                    onClick={() => setShowNewConversation(true)} 
                    className="rounded-full px-8 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
                  >
                    Iniciar Chat
                  </Button>
                )}
              </motion.div>
            ) : (
              <div className="space-y-1">
                <AnimatePresence mode="popLayout">
                  {filteredConversations.map((conversation, index) => (
                    <motion.div
                      key={conversation.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "rounded-2xl transition-all duration-300 border border-transparent",
                        conversation.unreadCount > 0 
                          ? "bg-zinc-900/60 border-zinc-800/50" 
                          : "hover:bg-zinc-900/30"
                      )}
                    >
                      <ChatPreview
                        id={conversation.id}
                        displayName={conversation.otherUser?.display_name || "Usuário"}
                        username={conversation.otherUser?.username || ""}
                        avatarUrl={conversation.otherUser?.avatar_url}
                        lastMessage={conversation.lastMessage?.content}
                        lastMessageTime={conversation.lastMessage?.created_at || conversation.updated_at}
                        unreadCount={conversation.unreadCount}
                        isOnline={onlineUsers.includes(conversation.otherUser?.id || "")}
                        isVerified={conversation.otherUser?.is_verified}
                        isAudioMessage={!!conversation.lastMessage?.audio_url}
                        isStickerMessage={!!conversation.lastMessage?.sticker_url}
                        onClick={() => setSelectedConversationId(conversation.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Botão Flutuante (FAB) */}
        {!selectedConversationId && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowNewConversation(true)}
            className="fixed bottom-24 right-6 w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-2xl shadow-emerald-900/40 flex items-center justify-center z-40 border border-emerald-500/20"
          >
            <Plus className="w-7 h-7" strokeWidth={2.5} />
          </motion.button>
        )}

        <NewConversationSheet
          open={showNewConversation}
          onClose={() => setShowNewConversation(false)}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </AppLayout>
  );
};

export default Messages;
