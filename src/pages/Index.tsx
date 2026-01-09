import { useState, useEffect, Suspense, lazy } from "react";
import { OfflineAlert } from "@/components/common/OfflineAlert";
import { BottomNav } from "@/components/layout/BottomNav";
import { toast } from "@/hooks/use-toast";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveAudioToDB, getAudiosFromDB, updateAudioMetadataInDB, AudioData } from "@/utils/audioStorage";
import { fetchSupabaseAudios, uploadAudioToSupabase, toggleSupabaseLike } from "@/utils/supabaseAudioUtils";

const OnboardingScreen = lazy(() =>
  import("@/components/onboarding/OnboardingScreen").then((m) => ({
    default: m.OnboardingScreen || m.default,
  })),
);

const LoginScreen = lazy(() =>
  import("@/components/auth/LoginScreen").then((m) => ({
    default: m.LoginScreen || m.default,
  })),
);

const ProfileSetupScreen = lazy(() =>
  import("@/components/auth/ProfileSetupScreen").then((m) => ({
    default: m.ProfileSetupScreen || m.default,
  })),
);

const MapView = lazy(() =>
  import("@/components/map/MapView").then((m) => ({
    default: m.MapView || m.default,
  })),
);

const ListView = lazy(() =>
  import("@/components/views/ListView").then((m) => ({
    default: m.ListView || m.default,
  })),
);

const ProfileView = lazy(() =>
  import("@/components/views/ProfileView").then((m) => ({
    default: m.ProfileView || m.default,
  })),
);

const SearchView = lazy(() =>
  import("@/components/views/SearchView").then((m) => ({
    default: m.SearchView || m.default,
  })),
);

const RecordingSheet = lazy(() =>
  import("@/components/audio/RecordingSheet").then((m) => ({
    default: m.RecordingSheet || m.default,
  })),
);

const PlayerSheet = lazy(() =>
  import("@/components/audio/PlayerSheet").then((m) => ({
    default: m.PlayerSheet || m.default,
  })),
);

const CommentsSheet = lazy(() =>
  import("@/components/audio/CommentsSheet").then((m) => ({
    default: m.CommentsSheet || m.default,
  })),
);

const LeaderboardSheet = lazy(() =>
  import("@/components/gamification/LeaderboardSheet").then((m) => ({
    default: m.LeaderboardSheet || m.default,
  })),
);

const Index = () => {
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("soundspot_onboarding"));
  const [showLogin, setShowLogin] = useState(false);
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<"map" | "list" | "record" | "search" | "profile">("map");
  const [showRecording, setShowRecording] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedAudioIdForComments, setSelectedAudioIdForComments] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<AudioData | null>(null);
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    // Load audios from Supabase and Local DB
    const loadAudios = async () => {
      try {
        setLoadingProgress(10);

        // Callback for instant cache load
        const handleCacheLoaded = (cachedData: AudioData[]) => {
            getAudiosFromDB().then(localAudios => {
                 const allAudios = [...cachedData];
                 localAudios.forEach(local => {
                    if (!allAudios.some(sa => sa.id === local.id)) {
                        allAudios.push(local);
                    }
                 });
                 setAudios(allAudios.sort((a, b) => b.timestamp - a.timestamp));
            });
        };

        const [supabaseAudios, localAudios] = await Promise.all([
            fetchSupabaseAudios({ 
                onProgress: setLoadingProgress,
                onCacheLoaded: handleCacheLoaded
            }),
            getAudiosFromDB()
        ]);
        
        // Merge and deduplicate by ID
        const allAudios = [...supabaseAudios];
        localAudios.forEach(local => {
            if (!allAudios.some(sa => sa.id === local.id)) {
                allAudios.push(local);
            }
        });
        
        setAudios(allAudios.sort((a, b) => b.timestamp - a.timestamp));
        setLoadingProgress(100);
      } catch (error) {
        console.error("Failed to load audios:", error);
        setLoadingProgress(100); // Ensure it finishes even on error
      }
    };
    loadAudios();

    // Realtime subscriptions
    const channel = supabase
      .channel('public:audios_interactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audios' }, () => {
        loadAudios(); // Reload all audios on any audio change (insert/update)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
        // Optimally we should just update the specific audio's like count, but reloading is safer for consistency
        loadAudios(); 
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => {
        loadAudios();
      })
      .subscribe();

    // User Presence / Last Seen Update
    const updatePresence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from('profiles')
          .update({ 
            last_seen: new Date().toISOString(),
            is_online: true 
          })
          .eq('id', session.user.id);
      }
    };

    // Update immediately and then every 5 minutes
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 5 * 60 * 1000);

    // Set offline on unload/hide (optional/best effort)
    const handleVisibilityChange = () => {
       if (document.visibilityState === 'hidden') {
          // We can't easily await here, but we can try to fire
          // Ideally use navigator.sendBeacon but Supabase doesn't support it directly easily for this
       } else {
          updatePresence();
       }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Capacitor App State Handling (Background/Foreground)
    let appStateListener: any;
    const setupAppStateListener = async () => {
        appStateListener = await CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                console.log("App state changed. Active:", isActive);
                await supabase
                    .from('profiles')
                    .update({ 
                        is_online: isActive,
                        last_seen: new Date().toISOString()
                    })
                    .eq('id', session.user.id);
            }
        });
    };
    setupAppStateListener();

    // Check if session needs to be checked (if onboarding is already done)
    if (!showOnboarding) {
      checkSession();
    }

    return () => {
      supabase.removeChannel(channel);
      clearInterval(presenceInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (appStateListener) {
          appStateListener.remove();
      }
      
      // Attempt to set offline on unmount (only works if navigation within app)
      // For full close, we rely on "last_seen" timestamp logic on backend/viewer side
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          supabase.from('profiles').update({ is_online: false }).eq('id', session.user.id);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`profile_ban:${currentUser.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles', 
        filter: `id=eq.${currentUser.id}` 
      }, async (payload: any) => {
        if (payload.new?.banned) {
             await supabase.auth.signOut();
             setCurrentUser(null);
             setShowLogin(false);
             setShowOnboarding(true);
             localStorage.removeItem("soundspot_onboarding");
             
             toast({
               title: "Cuenta suspendida",
               description: "Has sido baneado de la aplicación.",
               variant: "destructive"
             });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setShowLogin(true);
    } else {
      // Check for email verification
      if (session.user.email && !session.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setShowLogin(true);
        toast({
          title: "Verificación requerida",
          description: "Por favor, verifica tu correo electrónico para acceder a la aplicación.",
          variant: "destructive",
          duration: 5000
        });
        return;
      }

      // Check for ban status
      const { data: profile } = await supabase
        .from('profiles')
        .select('banned, is_pro')
        .eq('id', session.user.id)
        .maybeSingle();

      // Sync PRO status
      if (profile) {
        localStorage.setItem("soundspot_is_pro", profile.is_pro ? "true" : "false");
      }

      if (profile?.banned) {
        await supabase.auth.signOut();
        setShowLogin(false);
        setShowOnboarding(true);
        localStorage.removeItem("soundspot_onboarding");
        
        toast({
          title: "Cuenta suspendida",
          description: "Tu cuenta ha sido suspendida. No puedes acceder a la aplicación.",
          variant: "destructive",
          duration: 5000
        });
        return;
      }

      setShowLogin(false);
      setCurrentUser(session.user);
      checkUsername(session.user);
    }
  };

  const checkUsername = async (user: any, fromLogin = false) => {
    // 1. Si NO venimos de login, podemos confiar en localStorage para agilizar
    if (!fromLogin) {
        const storedName = localStorage.getItem("soundspot_username");
        if (storedName) return;
    }

    // 2. Check if user metadata already has username (from Supabase)
    if (user?.user_metadata?.username) {
        // Sync local storage with remote data
        localStorage.setItem("soundspot_username", user.user_metadata.username);
        
        // Si venimos de login y ya tiene username, todo ok, no mostramos setup
        return;
    }

    // 2.5 Doble verificación: Consultar tabla profiles por si la metadata está desactualizada
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();
            
        if (profile?.username) {
            localStorage.setItem("soundspot_username", profile.username);
            return;
        }
    }

    // 3. If neither, show setup
    setShowUsernameSetup(true);
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem("soundspot_onboarding", "true");
    setShowOnboarding(false);
    checkSession(); // Re-check session which will trigger login if needed
  };

  const handleLoginComplete = () => {
    setShowLogin(false);
    // Refresh session to get user details for potential username pre-fill
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            // Check for email verification
            if (session.user.email && !session.user.email_confirmed_at) {
                 supabase.auth.signOut();
                 setShowLogin(true);
                 toast({
                   title: "Verificación requerida",
                   description: "Por favor, verifica tu correo electrónico para acceder a la aplicación.",
                   variant: "destructive",
                   duration: 5000
                 });
                 return;
            }

            setCurrentUser(session.user);
            // Pasamos true para indicar que venimos de un login explícito
            checkUsername(session.user, true);
        } else {
             // Anonymous login
             checkUsername(null, true);
        }
    });
  };

  const handleUsernameComplete = (username: string) => {
    localStorage.setItem("soundspot_username", username);
    setShowUsernameSetup(false);
  };

  const handleTabChange = (tab: typeof activeTab) => {
    if (tab === "record") {
      setShowRecording(true);
    } else {
      setActiveTab(tab);
      if (tab === "profile") {
        setSelectedProfileId(null);
      }
    }
  };

  const handleAudioSelect = (id: string, audioData?: any) => {
    // Test Sentry Error Button Logic (Temporary)
    if (id === 'sentry-test-error') {
       throw new Error('This is your first error!');
    }

    const audio = audioData || audios.find(a => a.id === id);
    if (audio) {
      setSelectedAudio(audio);
      setShowPlayer(true);
    }
  };

  const handleLike = async (id: string) => {
    const audioIndex = audios.findIndex(a => a.id === id);
    if (audioIndex === -1) return;

    const audio = audios[audioIndex];
    const isLiked = !audio.isLiked;
    const newLikes = isLiked ? (audio.likes || 0) + 1 : Math.max(0, (audio.likes || 0) - 1);

    // Update local state immediately for UI responsiveness
    const updatedAudio = { ...audio, isLiked, likes: newLikes };
    const newAudios = [...audios];
    newAudios[audioIndex] = updatedAudio;
    setAudios(newAudios);
    
    // Update selectedAudio if it's the one being liked
    if (selectedAudio?.id === id) {
      setSelectedAudio(updatedAudio);
    }

    // Persist to DB (Supabase)
    try {
      // await updateAudioMetadataInDB(id, { isLiked, likes: newLikes });
      await toggleSupabaseLike(id, !isLiked);
      console.log(`Audio ${id} like updated: ${isLiked}, count: ${newLikes}`);
    } catch (error: any) {
      console.error("Failed to update like in DB:", error);
      
      const errorMessage = error.message === "Must be logged in" 
        ? "Necesitas iniciar sesión para dar me gusta."
        : error.message || "No se pudo guardar el 'me gusta'. Inténtalo de nuevo.";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });

      // Revert UI
      const revertedAudio = { ...audio, isLiked: !isLiked, likes: audio.likes || 0 };
      newAudios[audioIndex] = revertedAudio;
      setAudios(newAudios);
      
      // Update selectedAudio if it's the one being liked
      if (selectedAudio?.id === id) {
        setSelectedAudio(revertedAudio);
      }
    }
  };

  const handleSaveRecording = async (data: any) => {
    // Priority: Local Storage Name > User Metadata Username > "Usuario"
    // We prioritize username over full_name as requested
    const storedName = localStorage.getItem("soundspot_username");
    const userName = storedName || currentUser?.user_metadata?.username || "Usuario";
    const userAvatar = currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture;

    const newAudio: AudioData = {
      id: Date.now().toString(),
      title: data.title,
      author: userName,
      authorUsername: currentUser?.user_metadata?.username ? `@${currentUser.user_metadata.username}` : undefined,
      authorId: currentUser?.id,
      authorAvatar: userAvatar,
      distance: "0m",
      duration: data.duration,
      likes: 0,
      comments: 0,
      category: "ambient", // Could be inferred from tags
      color: data.color,
      audioUrl: data.audioUrl,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: Date.now()
    };
    
    setAudios(prev => [newAudio, ...prev]);

    // Persist to DB (Supabase)
    try {
        let blobToUpload = data.blob;
        if (!blobToUpload && data.audioUrl) {
             const response = await fetch(data.audioUrl);
             blobToUpload = await response.blob();
        }

        if (blobToUpload) {
            // Upload to Supabase
            const uploadedAudio = await uploadAudioToSupabase(blobToUpload, {
                title: data.title,
                description: "",
                category: data.tags && data.tags.length > 0 ? data.tags[0] : "General",
                tags: data.tags,
                color: data.color,
                duration: parseFloat(data.duration),
                latitude: data.latitude,
                longitude: data.longitude
            });

            // Update local list with the real ID from Supabase
            // (We initially added a temp one, now we replace or reload)
            // For simplicity, let's just reload from Supabase to ensure consistency
            const supabaseAudios = await fetchSupabaseAudios();
            setAudios(supabaseAudios);

            console.log("Audio saved to Supabase successfully", uploadedAudio);
        }
    } catch (e: any) {
        console.error("Error saving to DB", e);
        toast({
            title: "Error al subir",
            description: e.message || "No se pudo subir el eco a la nube. Comprueba tu conexión.",
            variant: "destructive"
        });
        // Remove from UI if failed?
        setAudios(prev => prev.filter(a => a.id !== newAudio.id));
        return; 
    }

    toast({
      title: "¡Eco publicado! 🎉",
      description: `"${data.title}" ya está disponible y guardado en tu dispositivo.`,
    });
  };

  const handleProfileClick = (authorId: string) => {
    setShowPlayer(false);
    setSelectedProfileId(authorId);
    setActiveTab("profile");
  };

  const handleOpenComments = (id: string) => {
    setSelectedAudioIdForComments(id);
    setShowComments(true);
  };

  const handleCommentAdded = async () => {
    if (selectedAudioIdForComments) {
      const audioIndex = audios.findIndex(a => a.id === selectedAudioIdForComments);
      if (audioIndex !== -1) {
        const audio = audios[audioIndex];
        const newComments = (audio.comments || 0) + 1;
        
        // Update local state
        const updatedAudio = { ...audio, comments: newComments };
        const newAudios = [...audios];
        newAudios[audioIndex] = updatedAudio;
        setAudios(newAudios);
        
        if (selectedAudio?.id === selectedAudioIdForComments) {
          setSelectedAudio(updatedAudio);
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
        await GoogleAuth.signOut();
    } catch (e) {
        console.log("Google sign out failed or not needed", e);
    }
    await supabase.auth.signOut();
    localStorage.removeItem("soundspot_username");
    
    setCurrentUser(null);
    setShowLogin(true);
    setSelectedProfileId(null);
    setActiveTab("map");
    
    toast({
        title: "Sesión cerrada",
        description: "Esperamos verte pronto."
    });
  };

  if (showOnboarding) {
    return (
      <Suspense
        fallback={
          <div className="flex h-screen w-full items-center justify-center">
            Cargando...
          </div>
        }
      >
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  if (showLogin) {
    return (
      <Suspense
        fallback={
          <div className="flex h-screen w-full items-center justify-center">
            Cargando...
          </div>
        }
      >
        <LoginScreen onLogin={handleLoginComplete} />
      </Suspense>
    );
  }

  if (showUsernameSetup) {
    const initialName =
      currentUser?.user_metadata?.username ||
      currentUser?.user_metadata?.full_name ||
      currentUser?.user_metadata?.name ||
      "";
    return (
      <Suspense
        fallback={
          <div className="flex h-screen w-full items-center justify-center">
            Cargando...
          </div>
        }
      >
        <ProfileSetupScreen onComplete={handleUsernameComplete} initialName={initialName} />
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center">
          Cargando...
        </div>
      }
    >
      <div className="h-screen w-full overflow-hidden bg-background">
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Eco" />
        <link rel="apple-touch-icon" href="/pwa-192x192.png" />
        <OfflineAlert allowMapAccess={activeTab === "map"} />
        <main className="h-full">
          <div className={activeTab === "map" ? "h-full w-full block relative" : "hidden"}>
            <MapView
              onPinClick={handleAudioSelect}
              audios={audios}
              selectedId={showPlayer ? selectedAudio?.id : null}
              onClusterClick={() => setActiveTab("list")}
              onOpenLeaderboard={() => setShowLeaderboard(true)}
            />
          </div>
          {activeTab === "list" && (
            <ListView
              onAudioSelect={handleAudioSelect}
              audios={audios}
              onLike={handleLike}
              onComment={handleOpenComments}
              loadingProgress={loadingProgress}
            />
          )}
          {activeTab === "search" && (
            <SearchView
              onProfileClick={handleProfileClick}
              onAudioSelect={handleAudioSelect}
              currentUserId={currentUser?.id}
              onLike={handleLike}
              onComment={handleOpenComments}
              onLogout={handleLogout}
            />
          )}
          {activeTab === "profile" && (
            <ProfileView
              userId={selectedProfileId}
              onBack={() => setActiveTab("map")}
              onAudioSelect={handleAudioSelect}
              onLike={handleLike}
              onComment={handleOpenComments}
              onProfileSelect={handleProfileClick}
              onLogout={handleLogout}
            />
          )}
        </main>
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        <RecordingSheet
          isOpen={showRecording}
          onClose={() => setShowRecording(false)}
          onSave={handleSaveRecording}
        />
        <PlayerSheet
          isOpen={showPlayer}
          onClose={() => setShowPlayer(false)}
          onProfileClick={handleProfileClick}
          audio={selectedAudio}
          onLike={() => selectedAudio && handleLike(selectedAudio.id)}
          onComment={() => selectedAudio && handleOpenComments(selectedAudio.id)}
        />
        <CommentsSheet
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          audioId={selectedAudioIdForComments || ""}
          onCommentAdded={handleCommentAdded}
        />
        <LeaderboardSheet
          isOpen={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
        />
      </div>
    </Suspense>
  );
};

export default Index;
