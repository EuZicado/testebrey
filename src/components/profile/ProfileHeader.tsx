import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Settings, Share2, Grid3X3, Bookmark, Heart, Camera, LogOut, MessageCircle, Edit2, UserPlus, UserMinus, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFollow } from "@/hooks/useFollow";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { useUserSettings } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FollowersSheet } from "@/components/profile/FollowersSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileHeaderProps {
  userId?: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified?: boolean;
  verificationBadge?: "none" | "blue" | "gold" | "staff";
  isOwnProfile?: boolean;
  walletBalance?: number;
  activeTab?: "posts" | "saved" | "liked";
  onTabChange?: (tab: "posts" | "saved" | "liked") => void;
}

export const ProfileHeader = ({
  userId,
  username,
  displayName,
  avatarUrl,
  bannerUrl,
  bio,
  followersCount,
  followingCount,
  postsCount,
  isVerified,
  verificationBadge = "blue",
  isOwnProfile = true,
  walletBalance = 0,
  activeTab: propActiveTab,
  onTabChange,
}: ProfileHeaderProps) => {
  const navigate = useNavigate();
  const { user, profile: currentProfile, refreshProfile } = useAuth();
  const { isFollowing, toggleFollow, isLoading: followLoading, followersCount: liveFollowers } = useFollow(userId);
  const { createConversation } = useMessages();
  const { canSendMessage } = useUserSettings();
  
  const [internalActiveTab, setInternalActiveTab] = useState<"posts" | "saved" | "liked">("posts");
  const activeTab = propActiveTab || internalActiveTab;
  
  const [editOpen, setEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(displayName);
  const [editBio, setEditBio] = useState(bio || "");
  const [editUsername, setEditUsername] = useState(username);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [followersSheetOpen, setFollowersSheetOpen] = useState(false);
  const [followersSheetTab, setFollowersSheetTab] = useState<"followers" | "following">("followers");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const actualFollowers = isOwnProfile ? followersCount : (liveFollowers || followersCount);

  // Reset state when profile changes
  useEffect(() => {
    setEditDisplayName(displayName);
    setEditBio(bio || "");
    setEditUsername(username);
  }, [displayName, bio, username]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getBadgeColor = () => {
    switch (verificationBadge) {
      case "gold":
        return "text-yellow-500 fill-yellow-500";
      case "staff":
        return "text-purple-500 fill-purple-500";
      default:
        return "text-blue-500 fill-blue-500";
    }
  };

  const handleTabClick = (tab: "posts" | "saved" | "liked") => {
    if (!propActiveTab) {
      setInternalActiveTab(tab);
    }
    onTabChange?.(tab);
  };

  const handleFollow = async () => {
    await toggleFollow();
    toast.success(isFollowing ? "Deixou de seguir" : "Seguindo!");
  };

  const handleMessage = async () => {
    if (!userId) return;
    
    setIsSendingMessage(true);
    
    // Check if can message
    const canMessage = await canSendMessage(userId);
    if (!canMessage) {
      toast.error("Este usuário não aceita mensagens de você");
      setIsSendingMessage(false);
      return;
    }
    
    const conversationId = await createConversation(userId);
    if (conversationId) {
      navigate("/messages");
    } else {
      toast.error("Erro ao iniciar conversa");
    }
    setIsSendingMessage(false);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/user/${userId || user?.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `@${username} no BRΞYK`,
          text: `Confira o perfil de ${displayName} no BRΞYK!`,
          url: shareUrl,
        });
      } catch {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copiado!");
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado!");
    }
  };

  const openFollowersSheet = (tab: "followers" | "following") => {
    setFollowersSheetTab(tab);
    setFollowersSheetOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Até logo!");
    navigate("/auth");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      let newAvatarUrl = avatarUrl;
      let newBannerUrl = bannerUrl;

      // Upload avatar
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);
          
        newAvatarUrl = publicUrl;
      }

      // Upload banner
      if (bannerFile) {
        const fileExt = bannerFile.name.split(".").pop();
        const filePath = `${user.id}/banner-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("banners")
          .upload(filePath, bannerFile, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from("banners")
          .getPublicUrl(filePath);
          
        newBannerUrl = publicUrl;
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: editDisplayName,
          username: editUsername,
          bio: editBio,
          avatar_url: newAvatarUrl,
          banner_url: newBannerUrl,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Perfil atualizado!");
      setEditOpen(false);
      refreshProfile?.();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: "posts", icon: Grid3X3, label: "Posts" },
    { id: "saved", icon: Bookmark, label: "Salvos" },
    { id: "liked", icon: Heart, label: "Curtidos" },
  ] as const;

  return (
    <>
      <div className="relative pb-4 bg-background">
        {/* Banner with Parallax-like feel */}
        <div className="relative h-48 md:h-64 bg-muted overflow-hidden group">
          {bannerUrl ? (
            <motion.img
              initial={{ scale: 1.05 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              src={bannerUrl}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-900/50 via-purple-900/50 to-background/50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          
          {/* Top Actions */}
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            <Button 
              variant="secondary" 
              size="icon" 
              className="rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-black/40 text-white shadow-lg"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
            </Button>
            
            {isOwnProfile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-black/40 text-white shadow-lg"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white">
                  <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
                    <Edit2 className="w-4 h-4 mr-2" /> Editar Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400 cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="px-5 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative self-start"
            >
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[6px] border-background bg-zinc-900 shadow-xl overflow-hidden group">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground bg-zinc-800">
                    {displayName[0]?.toUpperCase()}
                  </div>
                )}
                
                {isOwnProfile && (
                  <div 
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    onClick={() => setEditOpen(true)}
                  >
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>
              
              {isVerified && (
                <div className="absolute bottom-2 right-2 bg-background rounded-full p-1 shadow-sm">
                   <BadgeCheck className={cn("w-6 h-6", getBadgeColor())} />
                </div>
              )}
            </motion.div>
            
            {/* Info & Stats */}
            <div className="flex-1 pb-2 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight flex items-center gap-2">
                    {displayName}
                  </h1>
                  <p className="text-muted-foreground font-medium">@{username}</p>
                </div>

                {/* Desktop Actions */}
                <div className="flex gap-2">
                  {!isOwnProfile && (
                    <>
                      <Button 
                        variant={isFollowing ? "outline" : "default"} 
                        className={cn(
                          "min-w-[120px] transition-all",
                          !isFollowing && "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-md hover:shadow-lg"
                        )}
                        onClick={handleFollow}
                        disabled={followLoading}
                      >
                        {isFollowing ? (
                          <>
                            <UserMinus className="w-4 h-4 mr-2" /> Seguindo
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" /> Seguir
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={handleMessage}
                        disabled={isSendingMessage}
                        className="rounded-full"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {isOwnProfile && (
                    <Button 
                        variant="outline" 
                        onClick={() => setEditOpen(true)}
                        className="rounded-full hidden md:flex"
                    >
                        <Edit2 className="w-4 h-4 mr-2" /> Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Bio */}
              {bio && (
                <p className="text-foreground/90 text-sm md:text-base leading-relaxed max-w-2xl">
                    {bio}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 md:gap-8 pt-2">
                 <button onClick={() => openFollowersSheet("followers")} className="group flex flex-col md:flex-row items-center md:items-baseline gap-1 tap-highlight-none">
                   <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{formatNumber(actualFollowers)}</span>
                   <span className="text-xs md:text-sm text-muted-foreground">Seguidores</span>
                 </button>
                 <button onClick={() => openFollowersSheet("following")} className="group flex flex-col md:flex-row items-center md:items-baseline gap-1 tap-highlight-none">
                   <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{formatNumber(followingCount)}</span>
                   <span className="text-xs md:text-sm text-muted-foreground">Seguindo</span>
                 </button>
                 <div className="flex flex-col md:flex-row items-center md:items-baseline gap-1">
                   <span className="text-lg font-bold text-foreground">{formatNumber(postsCount)}</span>
                   <span className="text-xs md:text-sm text-muted-foreground">Posts</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="mt-6 flex gap-2 md:hidden">
            {isOwnProfile ? (
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditOpen(true)}>
                Editar Perfil
              </Button>
            ) : (
                // Mobile buttons are already handled in the main flow if needed, but here is a fallback
                null
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex mt-8 border-b border-white/5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 relative transition-all duration-300 tap-highlight-none",
                  activeTab === tab.id 
                    ? "text-primary font-medium" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    activeTab === tab.id ? "bg-primary/10" : "bg-transparent"
                )}>
                    <tab.icon className={cn("w-5 h-5", activeTab === tab.id && "fill-primary/20")} />
                </div>
                <span className="text-sm hidden sm:inline">{tab.label}</span>
                
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="profile-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_-2px_10px_rgba(var(--primary-rgb),0.5)]"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            
            {/* Avatar & Banner Edit */}
            <div className="space-y-4">
                <div className="relative h-24 rounded-lg bg-muted overflow-hidden group cursor-pointer border border-white/10">
                    <img 
                        src={bannerFile ? URL.createObjectURL(bannerFile) : (bannerUrl || "")} 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                        alt="Banner Preview"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                         <Camera className="w-6 h-6 text-white/80" />
                    </div>
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                    />
                </div>

                <div className="flex justify-center -mt-12 relative z-10">
                    <div className="relative w-24 h-24 rounded-full bg-zinc-800 border-4 border-zinc-900 overflow-hidden group cursor-pointer">
                         <img 
                            src={avatarFile ? URL.createObjectURL(avatarFile) : (avatarUrl || "")}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-50 transition-opacity"
                            alt="Avatar Preview"
                         />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <Camera className="w-6 h-6 text-white/80" />
                         </div>
                         <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                         />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="displayName">Nome de Exibição</Label>
                <Input 
                    id="displayName" 
                    value={editDisplayName} 
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="bg-zinc-800/50 border-white/10 focus:border-primary/50"
                />
                </div>

                <div className="space-y-2">
                <Label htmlFor="username">Nome de Usuário</Label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input 
                        id="username" 
                        value={editUsername} 
                        onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        className="pl-8 bg-zinc-800/50 border-white/10 focus:border-primary/50"
                    />
                </div>
                </div>

                <div className="space-y-2">
                <Label htmlFor="bio">Biografia</Label>
                <Textarea 
                    id="bio" 
                    value={editBio} 
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    className="bg-zinc-800/50 border-white/10 focus:border-primary/50 resize-none"
                    maxLength={160}
                />
                <div className="text-xs text-right text-muted-foreground">
                    {editBio.length}/160
                </div>
                </div>
            </div>

            <Button 
              className="w-full bg-primary hover:bg-primary/90 text-white font-medium" 
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Followers Sheet */}
      <FollowersSheet
        open={followersSheetOpen}
        onOpenChange={setFollowersSheetOpen}
        userId={userId || user?.id || ""}
        username={username}
        initialTab={followersSheetTab}
      />
    </>
  );
};

