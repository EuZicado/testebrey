import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Search, Loader2, Lock, BadgeCheck, MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserSearch, useConversationActions } from "@/hooks/messages";
import { toast } from "sonner";
import type { SearchableUser } from "@/types/messages";

interface NewConversationSheetProps {
  open: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

export const NewConversationSheet = ({ 
  open, 
  onClose, 
  onConversationCreated 
}: NewConversationSheetProps) => {
  const { query, setQuery, results, isSearching, clearSearch } = useUserSearch();
  const { createConversation } = useConversationActions();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      clearSearch();
      setSelectedUserId(null);
    }
  }, [open, clearSearch]);

  const handleSelectUser = async (selectedUser: SearchableUser) => {
    if (!selectedUser.can_message) {
      toast.error("Este usuário não aceita mensagens de você");
      return;
    }

    setSelectedUserId(selectedUser.id);

    try {
      const result = await createConversation(selectedUser.id);
      
      if (result.success && result.conversationId) {
        onConversationCreated(result.conversationId);
        onClose();
      } else {
        toast.error(result.error || "Erro ao iniciar conversa");
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Erro ao iniciar conversa");
    } finally {
      setSelectedUserId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-zinc-900 border-t border-zinc-700 shadow-2xl shadow-black">
        <SheetHeader className="pb-4">
          <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between px-2">
            <SheetTitle className="text-2xl font-bold text-white tracking-tight">Nova Mensagem</SheetTitle>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white border border-transparent hover:border-zinc-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </SheetHeader>

        {/* Search Input */}
        <div className="relative mb-6 px-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou username..."
            className="pl-12 bg-zinc-950/50 border-zinc-800 rounded-2xl h-14 text-white placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50 text-base shadow-inner"
            autoFocus
          />
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto space-y-2 -mx-2 px-4 pb-8">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
              <p className="text-sm text-zinc-400 font-medium">Buscando usuários...</p>
            </div>
          ) : !query ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-80">
              <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center mb-6 border border-zinc-700/30">
                <MessageCircle className="w-12 h-12 text-zinc-500" />
              </div>
              <p className="text-zinc-300 font-semibold text-lg">Comece uma conversa</p>
              <p className="text-sm text-zinc-500 mt-2 max-w-[200px]">
                Busque por amigos, colegas ou contatos recentes
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800/30 flex items-center justify-center mb-4">
                 <Search className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-300 font-medium">Nenhum usuário encontrado</p>
              <p className="text-sm text-zinc-500 mt-1">
                Verifique a ortografia ou tente outro termo
              </p>
            </div>
          ) : (
            results.map((u, index) => (
              <motion.button
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: "spring", damping: 20, stiffness: 300 }}
                onClick={() => handleSelectUser(u)}
                disabled={selectedUserId !== null || !u.can_message}
                className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all border border-transparent ${
                  u.can_message 
                    ? "hover:bg-zinc-800 hover:border-zinc-700/50 active:scale-[0.99] bg-zinc-900/50" 
                    : "opacity-50 cursor-not-allowed bg-zinc-900/20"
                }`}
              >
                <Avatar className="w-14 h-14 ring-2 ring-zinc-800 shadow-lg">
                  <AvatarImage src={u.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-zinc-300 text-lg font-bold">
                    {(u.display_name || u.username || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-bold flex items-center gap-1.5 text-zinc-100 text-base truncate">
                    {u.display_name || u.username || "Usuário"}
                    {u.is_verified && (
                      <BadgeCheck className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
                    )}
                  </p>
                  <p className="text-sm text-zinc-500 font-medium truncate">
                    @{u.username || "usuario"}
                  </p>
                </div>
                {!u.can_message ? (
                  <div className="flex items-center gap-1.5 text-red-500/70 bg-red-500/10 px-3 py-1 rounded-full">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Bloqueado</span>
                  </div>
                ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageCircle className="w-4 h-4" />
                    </div>
                )}
                {selectedUserId === u.id && (
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500 absolute right-4" />
                )}
              </motion.button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
