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
  Search, 
  Plus, 
  Settings2, 
  X,
  MessageSquarePlus,
  Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const Messages = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { conversations, isLoading: messagesLoading } = useMessages();
  const { onlineUsers } = usePresence();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleConversationCreated = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowNewConversation(false);
  };

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    
    let result = [...conversations];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(conv => 
        conv.otherUser?.display_name?.toLowerCase().includes(query) ||
        conv.otherUser?.username?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => {
      // Priority: Unread first, then date
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      const dateA = new Date(a.lastMessage?.created_at || a.updated_at).getTime();
      const dateB = new Date(b.lastMessage?.created_at || b.updated_at).getTime();
      return dateB - dateA;
    });
  }, [conversations, searchQuery]);

  const stats = useMemo(() => {
    if (!conversations) return { total: 0, unread: 0, online: 0 };
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const onlineCount = conversations.filter(c => 
      c.otherUser && onlineUsers.includes(c.otherUser.id)
    ).length;
    
    return { total: conversations.length, unread: totalUnread, online: onlineCount };
  }, [conversations, onlineUsers]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="relative flex flex-col h-[100dvh] bg-black overflow-hidden">
        
        {/* Full Screen Chat Overlay */}
        <AnimatePresence mode="wait">
          {selectedConversationId && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
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

        {/* Header */}
        <header className="shrink-0 pt-safe px-4 py-3 bg-black/80 backdrop-blur-xl border-b border-white/5 z-40 sticky top-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Mensagens</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <Badge variant="secondary" className="bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 border-none text-[10px] h-5 px-2 font-mono">
                  {stats.total} CHATS
                </Badge>
                {stats.unread > 0 && (
                  <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 text-[10px] h-5 px-2 font-mono">
                    {stats.unread} NEW
                  </Badge>
                )}
                 {stats.online > 0 && (
                  <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20 text-[10px] h-5 px-2 font-mono flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {stats.online} ON
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
              <Settings2 className="w-5 h-5" />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conversas..."
              className="pl-10 pr-10 rounded-xl bg-zinc-900/50 border-white/5 text-white placeholder:text-zinc-600 h-11 focus-visible:ring-1 focus-visible:ring-emerald-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </header>

        {/* Conversation List */}
        <ScrollArea className="flex-1 bg-black">
          <div className="px-2 pt-2 pb-32 space-y-1">
            {messagesLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
                <p className="text-sm text-zinc-500 font-medium animate-pulse">Sincronizando...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-24 text-center px-6"
              >
                <div className="w-20 h-20 rounded-3xl bg-zinc-900/50 flex items-center justify-center mb-6 border border-zinc-800/50">
                  <MessageSquarePlus className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-semibold text-white">Caixa de entrada vazia</h3>
                <p className="text-sm text-zinc-500 mt-2 mb-8 max-w-[250px]">
                  {searchQuery ? "Nenhuma conversa encontrada para sua busca." : "Conecte-se com pessoas incríveis e comece a conversar!"}
                </p>
                {!searchQuery && (
                  <Button 
                    onClick={() => setShowNewConversation(true)} 
                    className="rounded-full px-8 bg-white text-black hover:bg-zinc-200 font-medium transition-transform active:scale-95"
                  >
                    Iniciar Chat
                  </Button>
                )}
              </motion.div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredConversations.map((conversation, index) => (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
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
            )}
          </div>
        </ScrollArea>

        {/* Floating Action Button */}
        <AnimatePresence>
          {!selectedConversationId && (
            <motion.button
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNewConversation(true)}
              className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-white text-black shadow-lg shadow-white/10 flex items-center justify-center z-40 border border-zinc-200"
            >
              <Plus className="w-6 h-6" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>

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
