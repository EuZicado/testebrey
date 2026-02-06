import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  Search, 
  Plus, 
  MessageSquarePlus,
  MoreVertical,
  Check,
  CheckCheck,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useConversationList } from "@/hooks/messages/useConversationList";
import { ChatView } from "@/components/messages/ChatView";
import { NewConversationSheet } from "@/components/messages/NewConversationSheet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";

export default function MessagesPage() {
  const { user } = useAuth();
  const { conversations, isLoading, error, refetch } = useConversationList();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => 
    conv.otherUser?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Derived stats
  const unreadTotal = conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);

  // Handle back button on mobile/desktop
  const handleBack = () => setSelectedConversationId(null);

  return (
    <AppLayout>
      <div className="flex h-screen bg-background overflow-hidden relative">
        {/* Main List View */}
        <div className="flex-1 flex flex-col w-full max-w-md mx-auto md:max-w-none md:border-r border-zinc-800">
          
          {/* Header */}
          <header className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Mensagens</h1>
                <p className="text-xs text-zinc-400 font-medium mt-1">
                  {conversations.length} conversas • {unreadTotal > 0 ? `${unreadTotal} não lidas` : 'Todas lidas'}
                </p>
              </div>
              <Button 
                onClick={() => setIsNewConversationOpen(true)}
                size="icon" 
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            {/* Search Bar */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Buscar conversas..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 focus:bg-zinc-900 transition-all rounded-xl h-10"
              />
            </div>
          </header>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-zinc-500">Sincronizando conversas...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                  <MoreVertical className="w-6 h-6 text-red-500" />
                </div>
                <p className="text-sm text-zinc-400">{error}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-2 border border-zinc-800">
                  <MessageSquarePlus className="w-8 h-8 text-zinc-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Nenhuma conversa</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {searchQuery ? "Nenhum resultado encontrado para sua busca." : "Comece uma nova conversa agora!"}
                  </p>
                </div>
                {!searchQuery && (
                  <Button onClick={() => setIsNewConversationOpen(true)} className="mt-2">
                    Nova Conversa
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-2 px-2 space-y-1">
                {filteredConversations.map((conv) => (
                  <ConversationItem 
                    key={conv.id} 
                    conversation={conv} 
                    isSelected={selectedConversationId === conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                  />
                ))}
                {/* Padding for bottom nav */}
                <div className="h-24" />
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat View Overlay (Mobile) or Side Panel (Desktop - future) */}
        <AnimatePresence>
          {selectedConversationId && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-50 bg-background md:relative md:inset-auto md:flex-1 md:translate-x-0"
            >
              <ChatView
                conversationId={selectedConversationId}
                onBack={handleBack}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <NewConversationSheet 
          open={isNewConversationOpen} 
          onOpenChange={setIsNewConversationOpen}
          onConversationCreated={(id) => {
            setSelectedConversationId(id);
            setIsNewConversationOpen(false);
          }}
        />
      </div>
    </AppLayout>
  );
}

// Sub-component for individual list items to keep main clear
function ConversationItem({ conversation: conv, isSelected, onClick }: { conversation: any, isSelected: boolean, onClick: () => void }) {
  const lastMsg = conv.lastMessage;
  const isUnread = (conv.unreadCount || 0) > 0;
  
  // Format time logic
  const getTimeDisplay = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    return isToday ? format(date, "HH:mm") : format(date, "dd/MM", { locale: ptBR });
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group",
        isSelected ? "bg-primary/10" : "hover:bg-zinc-900/50 active:bg-zinc-900"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="w-12 h-12 border border-zinc-800 shadow-sm group-hover:border-zinc-700 transition-colors">
          <AvatarImage src={conv.otherUser?.avatar_url || undefined} className="object-cover" />
          <AvatarFallback className="bg-zinc-800 text-zinc-400 font-medium">
            {(conv.otherUser?.display_name || "U")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {/* Online indicator could go here if we had that data handy in the list */}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={cn("font-medium truncate text-sm", isUnread ? "text-white" : "text-zinc-300")}>
            {conv.otherUser?.display_name || "Usuário desconhecido"}
          </span>
          <span className={cn("text-[10px]", isUnread ? "text-primary font-bold" : "text-zinc-500")}>
            {getTimeDisplay(lastMsg?.created_at)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <p className={cn("text-xs truncate max-w-[85%]", isUnread ? "text-zinc-100 font-medium" : "text-zinc-500")}>
            {lastMsg ? (
              <>
                {lastMsg.sender_id === conv.otherUser?.id ? "" : "Você: "}
                {lastMsg.content || (lastMsg.audio_url ? "🎤 Áudio" : lastMsg.sticker_url ? "🖼️ Sticker" : "Conteúdo não suportado")}
              </>
            ) : (
              <span className="italic opacity-70">Nova conversa</span>
            )}
          </p>
          
          {isUnread && (
            <Badge className="h-5 min-w-[1.25rem] px-1 bg-primary hover:bg-primary text-[10px] flex items-center justify-center rounded-full shadow-sm shadow-primary/20">
              {conv.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}