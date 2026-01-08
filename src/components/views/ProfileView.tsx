import { Settings, MapPin, Headphones, Heart, Users, LogOut, ArrowLeft, X, UserPlus, UserCheck, Lock, BadgeCheck, Trash2, Bug, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { fetchSupabaseAudios } from "@/utils/supabaseAudioUtils";
import { AudioData, getAudiosFromDB } from "@/utils/audioStorage";
import { AudioCard } from "@/components/audio/AudioCard";
import { cn } from "@/lib/utils";
import { SettingsView } from "./SettingsView";
import { EditProfileSheet } from "@/components/auth/EditProfileSheet";
import { EditAudioSheet } from "@/components/audio/EditAudioSheet";

interface ProfileViewProps {
  userId?: string | null;
  onBack?: () => void;
  onAudioSelect?: (id: string, audioData?: any) => void;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onProfileSelect?: (id: string) => void;
  onLogout: () => void;
}

export const ProfileView = ({ userId, onBack, onAudioSelect, onLike, onComment, onProfileSelect, onLogout }: ProfileViewProps) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userAudios, setUserAudios] = useState<AudioData[]>([]);
  const [savedAudios, setSavedAudios] = useState<AudioData[]>([]);
  const [contentTab, setContentTab] = useState<"created" | "saved">("created");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  
  // Edit Audio
  const [editingAudio, setEditingAudio] = useState<AudioData | null>(null);
  const [showEditAudio, setShowEditAudio] = useState(false);
  
  // Follow System
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [isMutualFollow, setIsMutualFollow] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getProfile();
  }, [userId]);
  
  // Realtime subscription for followers count
  useEffect(() => {
      if (!user?.id) return;
      
      const channel = supabase
          .channel('public:follows')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${user.id}` }, (payload) => {
              // If the change was triggered by the current user (optimistic update already handled), skip refetch
              if (currentUser && (payload.new as any)?.follower_id === currentUser.id) return;
              if (currentUser && (payload.old as any)?.follower_id === currentUser.id) return;
              
              // Reload followers count for other users' actions
              fetchFollowersCount(user.id);
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [user?.id, currentUser?.id]);

  const fetchFollowersCount = async (targetId?: string) => {
      const idToUse = targetId || user?.id;
      if (!idToUse) return;
      
      try {
        const { count, error } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', idToUse)
            .eq('status', 'accepted'); // Only count accepted
        
        if (error) {
            console.error('Error fetching followers count:', error);
            return;
        }
        
        setFollowersCount(count || 0);
      } catch (err) {
        console.error('Exception fetching followers count:', err);
      }
  };

  const getProfile = async () => {
    setLoading(true);
    try {
      // 1. Get current session first
      const { data: { session } } = await supabase.auth.getSession();
      const current = session?.user;
      setCurrentUser(current);

      if (current) {
          const { data: adminData } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', current.id)
            .maybeSingle();
          setIsAdmin(!!adminData?.is_admin);
      }

      // 2. Determine which user to show
      let targetUser = null;

      if (userId && current?.id !== userId) {
        // Fetching another user
        // Try to get from Supabase 'profiles' table
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (profile) {
            // Sync PRO status locally
            if (profile.is_pro) {
                localStorage.setItem("soundspot_is_pro", "true");
            } else {
                localStorage.removeItem("soundspot_is_pro");
            }

            targetUser = {
                id: profile.id,
                verified: profile.verified,
                is_pro: profile.is_pro,
                privacy_settings: typeof profile.privacy_settings === 'string' ? JSON.parse(profile.privacy_settings) : profile.privacy_settings,
                user_metadata: {
                    full_name: profile.full_name,
                    username: profile.username,
                    description: profile.description,
                    avatar_url: profile.avatar_url // if we had this column
                }
            };
        } else {
             // Fallback: Check if we have any audio from this user locally to grab metadata
             const allAudios = await getAudiosFromDB();
             const authorAudio = allAudios.find(a => a.authorId === userId);
             if (authorAudio) {
                 targetUser = {
                     id: userId,
                     user_metadata: {
                         full_name: authorAudio.author, // We stored author name here
                         avatar_url: authorAudio.authorAvatar
                     }
                 };
             }
        }
      } else {
        // Current user
        targetUser = current;
        
        // Try to fetch profile description if not in metadata
        // Also fetch username_last_changed for edit restrictions
        const { data: profile } = await supabase
          .from('profiles')
          .select('description, username, username_last_changed, avatar_url, updated_at, privacy_settings, verified, is_pro, birth_date, gender')
          .eq('id', targetUser?.id)
          .maybeSingle();
        
        if (profile) {
            targetUser = {
                ...targetUser,
                verified: profile.verified,
                updated_at: profile.updated_at,
                is_pro: profile.is_pro,
                birth_date: profile.birth_date,
                gender: profile.gender,
                privacy_settings: typeof profile.privacy_settings === 'string' ? JSON.parse(profile.privacy_settings) : profile.privacy_settings,
                user_metadata: {
                    ...targetUser.user_metadata,
                    description: profile.description || targetUser.user_metadata?.description,
                    username: profile.username || targetUser.user_metadata?.username,
                    username_last_changed: profile.username_last_changed,
                    avatar_url: profile.avatar_url || targetUser.user_metadata?.avatar_url
                }
            };
        }
      }

      setUser(targetUser);

      // 3. Fetch Follow Data
      if (targetUser?.id) {
          // Get followers count
          await fetchFollowersCount(targetUser.id);

          // Check if I am following
          if (current && current.id !== targetUser.id) {
              const { data: followData } = await supabase
                  .from('follows')
                  .select('status')
                  .eq('follower_id', current.id)
                  .eq('following_id', targetUser.id)
                  .maybeSingle();
              
              setIsFollowing(!!followData && followData.status === 'accepted');
              setIsRequested(followData?.status === 'pending');

              // Check mutual follow (friendship)
              const { data: reverseFollow } = await supabase
                  .from('follows')
                  .select('status')
                  .eq('follower_id', targetUser.id)
                  .eq('following_id', current.id)
                  .eq('status', 'accepted')
                  .maybeSingle();
            
              setIsMutualFollow(!!reverseFollow && followData?.status === 'accepted');
          } else {
              setIsFollowing(false);
              setIsRequested(false);
              setIsMutualFollow(false);
          }
      }

      // 4. Fetch Audios
      const [supabaseAudios, localAudios] = await Promise.all([
          fetchSupabaseAudios(),
          getAudiosFromDB()
      ]);
      
      // Merge
      const allAudios = [...supabaseAudios];
      localAudios.forEach(local => {
          if (!allAudios.some(sa => sa.id === local.id)) {
              allAudios.push(local);
          }
      });
      
      // My Sounds: Audios where authorId matches the displayed profile's ID
      const myAudios = allAudios.filter(a => a.authorId === (targetUser?.id || userId));
      setUserAudios(myAudios.sort((a, b) => b.timestamp - a.timestamp));

      // Saved Sounds: Only relevant if viewing OWN profile
      // Audios in local DB that are NOT authored by me
      if (!userId || (current && userId === current.id)) {
          const saved = allAudios.filter(a => a.authorId !== current?.id);
          setSavedAudios(saved.sort((a, b) => b.timestamp - a.timestamp));
      }

    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
      if (!currentUser || !user) {
          toast({ title: "Error", description: "Debes iniciar sesión para seguir a usuarios.", variant: "destructive" });
          return;
      }

      // Ensure profile exists for currentUser to avoid FK violation in notifications trigger
      try {
          const { data: profile } = await supabase.from('profiles').select('id').eq('id', currentUser.id).maybeSingle();
          if (!profile) {
              console.log("Creating missing profile for current user...");
              await supabase.from('profiles').insert({
                  id: currentUser.id,
                  username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || `user_${currentUser.id.slice(0,8)}`,
                  full_name: currentUser.user_metadata?.full_name || 'User',
                  avatar_url: currentUser.user_metadata?.avatar_url
              });
          }
      } catch (err) {
          console.error("Error ensuring profile:", err);
      }

      // Check if user is private
      const isPrivate = user.privacy_settings?.is_private || false;
      const willBeRequested = isPrivate && !isFollowing && !isRequested;

      // Optimistic update
        const wasFollowing = isFollowing;
        const wasRequested = isRequested;

        if (isFollowing || isRequested) {
            // Unfollow / Cancel request
            setIsFollowing(false);
            setIsRequested(false);
            if (wasFollowing) setFollowersCount(prev => Math.max(0, prev - 1));
        } else {
            // Follow
          if (isPrivate) {
              setIsRequested(true);
              toast({ title: "Solicitud enviada", description: "Este usuario es privado. Debe aceptar tu solicitud." });
          } else {
              setIsFollowing(true);
              setFollowersCount(prev => prev + 1);
          }
      }

      try {
          if (!wasFollowing && !wasRequested) {
              // Create follow
              const { error } = await supabase
                  .from('follows')
                  .insert({ 
                      follower_id: currentUser.id, 
                      following_id: user.id,
                      status: isPrivate ? 'pending' : 'accepted'
                  });
              
              if (error) throw error;
              
              // Notification is handled by Database Trigger (on_follow_added)

          } else {
              // Delete follow
              const { error } = await supabase
                  .from('follows')
                  .delete()
                  .eq('follower_id', currentUser.id)
                  .eq('following_id', user.id);
              
              if (error) throw error;
          }
      } catch (error: any) {
          console.error("Error toggling follow:", error);
          // Revert
          setIsFollowing(wasFollowing);
          setIsRequested(wasRequested);
          if (wasFollowing) setFollowersCount(prev => prev + 1);
          else if (!wasRequested && !isPrivate) setFollowersCount(prev => Math.max(0, prev - 1));
          
          toast({ title: "Error", description: error.message || "No se pudo actualizar el seguimiento.", variant: "destructive" });
      }
  };

  const fetchFollowersList = async () => {
      if (!user) return;
      
      // If we know there are no followers, don't fetch
      if (followersCount === 0) {
          setFollowersList([]);
          return;
      }

      setLoadingFollowers(true);
      try {
          // 1. Get follower IDs first (avoids relationship issues)
          const { data: followsData, error: followsError } = await supabase
              .from('follows')
              .select('follower_id')
              .eq('following_id', user.id)
              .eq('status', 'accepted');

          if (followsError) throw followsError;

          const followerIds = (followsData || [])
              .map(f => f.follower_id)
              .filter(Boolean);

          if (followerIds.length === 0) {
              setFollowersList([]);
              setLoadingFollowers(false);
              return;
          }

          // 2. Get profiles for these IDs (batched to avoid URL length limits)
          const BATCH_SIZE = 50;
          const allProfiles: any[] = [];
          
          for (let i = 0; i < followerIds.length; i += BATCH_SIZE) {
              const batch = followerIds.slice(i, i + BATCH_SIZE);
              const { data: profilesData, error: profilesError } = await supabase
                  .from('profiles')
                  .select('id, username, full_name, avatar_url')
                  .in('id', batch);

              if (profilesError) throw profilesError;
              if (profilesData) allProfiles.push(...profilesData);
          }

          setFollowersList(allProfiles);

      } catch (error: any) {
          console.error("Error fetching followers:", error);
          toast({ 
              title: "Error", 
              description: error.message || "No se pudieron cargar los seguidores.", 
              variant: "destructive" 
          });
      } finally {
          setLoadingFollowers(false);
      }
  };

  const isOwnProfile = !userId || (currentUser && userId === currentUser.id);

  const handleDeleteAudio = async (audioId: string) => {
      if (!confirm("¿Estás seguro de que quieres eliminar este eco? Esta acción no se puede deshacer.")) return;

      try {
          const { error } = await supabase.from('audios').delete().eq('id', audioId);
          if (error) throw error;
          
          toast({ title: "Eco eliminado", description: "El eco se ha eliminado correctamente." });
          
          // Update local state
          setUserAudios(prev => prev.filter(a => a.id !== audioId));
          setSavedAudios(prev => prev.filter(a => a.id !== audioId));
          
          // Update stats
          setLoading(true); // Trigger a refresh indirectly or just rely on local state update
          getProfile();
      } catch (error) {
          console.error("Error deleting audio:", error);
          toast({ title: "Error", description: "No se pudo eliminar el eco.", variant: "destructive" });
      }
  };

  const handleLikeLocal = (id: string) => {
    // Call prop
    if (onLike) onLike(id);
    
    // Update local state optimistically
    const updateAudioLike = (list: AudioData[]) => {
      return list.map(a => {
        if (a.id === id) {
            const isLiked = !a.isLiked;
            return { 
                ...a, 
                isLiked, 
                likes: isLiked ? (a.likes || 0) + 1 : Math.max(0, (a.likes || 0) - 1)
            };
        }
        return a;
      });
    };

    setUserAudios(prev => updateAudioLike(prev));
    setSavedAudios(prev => updateAudioLike(prev));
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );
  }

  if (showSettings) {
    return (
        <SettingsView 
            onBack={() => setShowSettings(false)}
            onEditProfile={() => {
                setShowSettings(false);
                setShowEditProfile(true);
            }}
            isAdmin={isAdmin}
            onLogout={() => {
                setShowSettings(false);
                onLogout();
            }}
        />
    );
  }

  // Display Name logic
  // Priority: DB Profile Username > Metadata Username > Metadata Full Name > LocalStorage (if own profile) > "Usuario"
  let displayName = "Usuario";
  let displayHandle = "@usuario";
  let displayAvatar = null;
  let displayDescription = "";
  let displayIsPro = false;

  if (user) {
      displayDescription = user.user_metadata?.description || "";
      if (isOwnProfile) {
          const storedName = localStorage.getItem("soundspot_username");
          displayName = user.user_metadata?.full_name || user.user_metadata?.name || storedName || "Usuario";
          displayHandle = user.user_metadata?.username ? `@${user.user_metadata.username}` : (storedName ? `@${storedName}` : "@usuario");
          displayAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
          displayIsPro = !!user?.is_pro || localStorage.getItem("soundspot_is_pro") === "true";
      } else {
          displayName = user.user_metadata?.full_name || user.user_metadata?.name || "Usuario Desconocido";
          displayHandle = user.user_metadata?.username ? `@${user.user_metadata.username}` : "";
          displayAvatar = user.user_metadata?.avatar_url;
          displayIsPro = !!user?.is_pro;
      }
  }
  
  // Clean handle
  if (!displayHandle.startsWith("@") && displayHandle.length > 0) displayHandle = `@${displayHandle}`;

  const currentUsername = user?.user_metadata?.username || "";
  const usernameLastChanged = user?.user_metadata?.username_last_changed || null;
  
  // Privacy check
  const isProfilePhotoPublic = user?.privacy_settings?.profile_photo_public !== false;
  const canViewAvatar = isOwnProfile || isProfilePhotoPublic || isMutualFollow;

  const showFollowersPrivacy = user?.privacy_settings?.show_followers !== false;
  const canViewFollowers = isOwnProfile || showFollowersPrivacy || isMutualFollow;

  // Cache busting for avatar
  // Use a stable fallback if updated_at is missing to avoid infinite re-renders/flickering
  const cacheKey = user?.updated_at 
    ? new Date(user.updated_at).getTime() 
    : (user?.id ? user.id : 'default');

  const avatarWithCache = (canViewAvatar && displayAvatar)
    ? (displayAvatar.includes('?') 
        ? `${displayAvatar}&v=${cacheKey}`
        : `${displayAvatar}?v=${cacheKey}`)
    : null;

  const currentAudios = contentTab === "created" ? userAudios : savedAudios;

  const mockStats = {
      audios: userAudios.length,
      followers: followersCount,
      likes: userAudios.reduce((acc, curr) => acc + (curr.likes || 0), 0)
  };

  return (
    <div className="h-full overflow-y-auto bg-background pb-24">
      {/* Edit Profile Sheet */}
      {isOwnProfile && (
        <EditProfileSheet 
            isOpen={showEditProfile} 
            onClose={() => setShowEditProfile(false)}
            currentName={displayName}
            currentUsername={currentUsername}
            currentDescription={displayDescription}
            currentAvatarUrl={displayAvatar}
            currentDob={user?.birth_date}
            currentGender={user?.gender}
            usernameLastChanged={usernameLastChanged}
            onUpdate={getProfile}
        />
      )}

      {isOwnProfile && (
        <EditAudioSheet
          isOpen={showEditAudio}
          onClose={() => {
            setShowEditAudio(false);
            setEditingAudio(null);
          }}
          audio={editingAudio}
          onUpdate={getProfile}
        />
      )}

      {/* Avatar Modal */}
      {showAvatarModal && avatarWithCache && (
        <div 
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setShowAvatarModal(false)}
        >
            <div className="relative max-w-full max-h-[80vh] flex items-center justify-center">
                <img 
                    src={avatarWithCache} 
                    alt="Avatar Completo" 
                    className="max-w-full max-h-[80vh] object-contain rounded-3xl" 
                />
                <button 
                    onClick={() => setShowAvatarModal(false)}
                    className="absolute -top-12 right-0 text-white/70 hover:text-white p-2"
                >
                    <X className="w-8 h-8" />
                </button>
            </div>
        </div>
      )}

      {/* Followers Sheet/Modal */}
      {showFollowersList && (
        <div 
            className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-500 ease-fluid"
            onClick={() => setShowFollowersList(false)}
        >
            <div 
                className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-500 ease-fluid"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-bold text-lg">Seguidores</h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowFollowersList(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    {!canViewFollowers ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <Lock className="w-12 h-12 mb-4 opacity-20" />
                            <p>Esta lista es privada.</p>
                        </div>
                    ) : loadingFollowers ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : followersList.length > 0 ? (
                        <div className="space-y-4">
                            {followersList.map((follower) => (
                                <div 
                                    key={follower.id} 
                                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                                    onClick={() => {
                                        if (onProfileSelect) {
                                            setShowFollowersList(false);
                                            onProfileSelect(follower.id);
                                        }
                                    }}
                                >
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                        {follower.avatar_url ? (
                                            <img src={follower.avatar_url} alt={follower.username} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-lg">👤</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium truncate">{follower.full_name || follower.username}</h4>
                                        <p className="text-xs text-muted-foreground truncate">@{follower.username}</p>
                                    </div>
                                    {/* Can add follow back button here later */}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Aún no hay seguidores.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Header with gradient cover */}
      <div className="relative">
        {/* Cover Image */}
        <div className="h-32 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-fuchsia-500/20" />
        
        {/* Navbar overlay */}
        <div className="absolute top-0 left-0 right-0 z-10">
            <div className="px-4 pt-12 pb-4 flex items-center justify-between">
            {onBack && !isOwnProfile ? (
                <Button variant="ghost" size="icon" onClick={onBack} className="bg-background/20 backdrop-blur-md hover:bg-background/40 text-foreground">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            ) : (
                 <div /> // Empty div to balance spacing if needed, or remove if not
            )}
            
            {isOwnProfile && (
                <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="bg-background/20 backdrop-blur-md hover:bg-background/40 text-foreground ml-auto">
                    <Settings className="w-5 h-5" />
                </Button>
            )}
            </div>
        </div>
        
        {/* Avatar - Centered and overlapping */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
             <div 
                className={cn(
                    "w-24 h-24 rounded-3xl gradient-hero flex items-center justify-center shadow-2xl border-4 border-background overflow-hidden transition-transform",
                    canViewAvatar && "cursor-pointer active:scale-95"
                )}
                onClick={() => canViewAvatar && setShowAvatarModal(true)}
             >
              {avatarWithCache ? (
                <img 
                    src={avatarWithCache} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        console.error("Error loading avatar:", avatarWithCache);
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.classList.add('bg-muted');
                        e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<span class="text-4xl">👤</span>');
                    }}
                />
              ) : (
                <span className="text-4xl">👤</span>
              )}
            </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="mt-14 px-6 mb-6 flex flex-col items-center text-center">
        <h2 className="text-2xl font-bold text-foreground leading-tight flex items-center justify-center gap-1">
            {displayName}
            {user?.verified && <BadgeCheck className="w-5 h-5 text-white fill-blue-500" />}
            {displayIsPro && (
                <div className="bg-gradient-to-r from-primary to-purple-600 text-[10px] text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Shield className="w-3 h-3 fill-white" />
                    <span className="font-bold tracking-wider">PRO</span>
                </div>
            )}
        </h2>
        <p className="text-muted-foreground font-medium">{displayHandle}</p>
        
        {!isOwnProfile && (
            <Button 
                onClick={handleFollow}
                className={cn(
                    "rounded-full px-8 mt-4 transition-all duration-300",
                    isFollowing 
                        ? "bg-muted text-foreground hover:bg-muted/80" 
                        : isRequested
                            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            : "bg-primary text-primary-foreground"
                )}
            >
                {isFollowing ? (
                    <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        <span>Siguiendo</span>
                    </div>
                ) : isRequested ? (
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        <span>Solicitado</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        <span>Seguir</span>
                    </div>
                )}
            </Button>
        )}
        
        {/* Bio */}
        <p className="mt-4 text-sm text-muted-foreground/80 leading-relaxed max-w-md">
            {displayDescription}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 w-full max-w-sm mx-auto mt-6 mb-2">
            <div className="flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                <span className="text-2xl font-bold text-foreground">{mockStats.audios}</span>
                <span className="text-sm text-muted-foreground">Ecos</span>
            </div>
            <div 
                className="flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                    setShowFollowersList(true);
                    if (canViewFollowers) fetchFollowersList();
                }}
            >
                <span className="text-2xl font-bold text-foreground">{mockStats.followers}</span>
                <span className="text-sm text-muted-foreground">Seguidores</span>
            </div>
             <div className="flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                <span className="text-2xl font-bold text-foreground">{mockStats.likes}</span>
                <span className="text-sm text-muted-foreground">Me gustas</span>
            </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="flex flex-col">
         <div className="flex items-center justify-center gap-12 px-6 border-b border-border">
             <button 
                onClick={() => setContentTab("created")}
                className={cn(
                    "pb-3 text-sm font-medium transition-colors relative",
                    contentTab === "created" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                    )}
             >
                {isOwnProfile ? "Mis Ecos" : "Ecos"}
                {contentTab === "created" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
             </button>
             {isOwnProfile && (
                <button 
                    onClick={() => setContentTab("saved")}
                    className={cn(
                        "pb-3 text-sm font-medium transition-colors relative",
                        contentTab === "saved" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                    )}
                >
                    Guardados
                    {contentTab === "saved" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                </button>
             )}
         </div>

         {/* View Toggle & Content */}
         <div className="p-4">
             {/* Removed Toggle Buttons - Forced List View */}
             
             {currentAudios.length > 0 ? (
                 <div className="grid gap-4 grid-cols-1">
                     {currentAudios.map((audio) => (
                         <AudioCard
                           key={audio.id}
                           {...audio}
                           category={audio.category as any}
                           showCategory={false}
                           onDelete={isOwnProfile && audio.authorId === currentUser?.id ? () => handleDeleteAudio(audio.id) : undefined}
                            onPlay={() => onAudioSelect?.(audio.id, audio)}
                            onLike={() => handleLikeLocal(audio.id)}
                            onComment={() => onComment?.(audio.id)}
                            onEdit={isOwnProfile && audio.authorId === currentUser?.id ? () => { setEditingAudio(audio); setShowEditAudio(true); } : undefined}
                            privacy={audio.privacy}
                            className=""
                         />
                     ))}
                 </div>
             ) : (
                 <div className="flex flex-col items-center justify-center py-12 text-center">
                     <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                         <Headphones className="w-8 h-8 opacity-50" />
                     </div>
                     <p className="text-lg font-medium">
                        {contentTab === "created" ? "Aún no hay ecos" : "No hay ecos guardados"}
                     </p>
                     <p className="text-sm text-muted-foreground">
                        {contentTab === "created" 
                            ? (isOwnProfile ? "¡Graba tu primer eco!" : "") 
                            : "Los ecos que guardes aparecerán aquí."}
                     </p>
                 </div>
             )}
         </div>
      </div>
    </div>
  );
};
