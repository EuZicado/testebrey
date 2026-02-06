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
      <div className="relative flex flex-col h-screen bg-background overflow-hidden">
        
        {/* ChatView Overlay - Resolve o problema do BottomNav */}
        <AnimatePresence>
          {selectedConversationId && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-[60] bg-background"
            >
              <ChatView
                conversationId={selectedConversationId}
                onBack={() => setSelectedConversationId(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Principal */}
        <header className="shrink-0 pt-safe bg-background/80 backdrop-blur-md border-b z-40">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] h-5">
                    {stats.total} CONVERSAS
                  </Badge>
                  {stats.unread > 0 && (
                    <Badge className="bg-primary text-primary-foreground border-none text-[10px] h-5">
                      {stats.unread} NOVAS
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full bg-muted/50">
                <Settings2 className="w-5 h-5" />
              </Button>
            </div>

            {/* Barra de Busca */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pessoas ou mensagens..."
                className="pl-10 pr-10 rounded-2xl bg-muted/50 border-none h-11 focus-visible:ring-1 focus-visible:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Usuários Online (Stories Style) */}
          {stats.online > 0 && (
            <div className="pb-4">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 px-4">
                  {conversations
                    .filter(c => c.otherUser && onlineUsers.includes(c.otherUser.id))
                    .map(conv => (
                      <button
                        key={`online-${conv.id}`}
                        onClick={() => setSelectedConversationId(conv.id)}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="relative p-0.5 rounded-full border-2 border-green-500">
                          <div className="w-12 h-12 rounded-full bg-muted overflow-hidden border-2 border-background">
                            {conv.otherUser?.avatar_url ? (
                              <img src={conv.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                                {conv.otherUser?.display_name?.[0]}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-medium max-w-[56px] truncate">
                          {conv.otherUser?.display_name?.split(" ")[0]}
                        </span>
                      </button>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </header>

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          <div className="px-2 pt-2 pb-32"> {/* pb-32 garante que o último item não fique atrás do nav */}
            {messagesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
                <p className="text-sm text-muted-foreground">Carregando conversas...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center px-6"
              >
                <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-6">
                  <MessageSquarePlus className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold italic">Nenhuma conversa encontrada</h3>
                <p className="text-sm text-muted-foreground mt-2 mb-8">
                  {searchQuery ? "Tente buscar por um termo diferente." : "Comece a interagir! Suas conversas aparecerão aqui."}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowNewConversation(true)} className="rounded-full px-8 shadow-lg shadow-primary/20">
                    Iniciar Chat
                  </Button>
                )}
              </motion.div>
            ) : (
              <div className="space-y-0.5">
                {filteredConversations.map((conversation, index) => (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "rounded-2xl transition-colors active:bg-muted/50",
                      conversation.unreadCount > 0 ? "bg-primary/5" : "bg-transparent"
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
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Botão Flutuante (FAB) - Ajustado para ficar acima do BottomNav */}
        {!selectedConversationId && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowNewConversation(true)}
            className="fixed bottom-20 right-6 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center z-40"
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
