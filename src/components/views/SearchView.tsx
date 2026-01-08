import { useState, useEffect } from "react";
import { Search, TrendingUp, Clock, X, User, Music } from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { cn } from "@/lib/utils";
import { AudioCard } from "@/components/audio/AudioCard";
import { supabase } from "@/integrations/supabase/client";
import { ProfileView } from "@/components/views/ProfileView";

const recentSearches: string[] = [];
const trendingTags: string[] = [];

interface SearchViewProps {
  onProfileClick?: (userId: string) => void;
  onAudioSelect?: (audioId: string) => void;
  currentUserId?: string;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onLogout: () => void;
}

export const SearchView = ({ onProfileClick, onAudioSelect, currentUserId, onLike, onComment, onLogout }: SearchViewProps) => {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundProfiles, setFoundProfiles] = useState<any[]>([]);
  const [foundAudios, setFoundAudios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentProfiles, setRecentProfiles] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<'user' | 'audio'>('user');

  useEffect(() => {
    const getLocation = async () => {
      try {
        const position = await Geolocation.getCurrentPosition({ 
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
        setUserLocation(position.coords);
      } catch (error) {
        console.error("Error getting location:", error);
      }
    };
    getLocation();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("soundspot_search_history");
    if (stored) {
        try {
            setRecentProfiles(JSON.parse(stored));
        } catch (e) {
            console.error("Error parsing search history", e);
        }
    }
  }, []);

  const addToHistory = (user: any) => {
      const newHistory = [user, ...recentProfiles.filter(p => p.id !== user.id)].slice(0, 10);
      setRecentProfiles(newHistory);
      localStorage.setItem("soundspot_search_history", JSON.stringify(newHistory));
  };

  const removeFromHistory = (userId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newHistory = recentProfiles.filter(p => p.id !== userId);
      setRecentProfiles(newHistory);
      localStorage.setItem("soundspot_search_history", JSON.stringify(newHistory));
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setLoading(true);
    
    try {
        console.log("Searching for:", query);
        
        // Search profiles
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .ilike('username', `%${query}%`)
            .limit(20);

        // Search audios by title or ID
        let foundAudioResults: any[] = [];
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

        if (isUUID) {
             const { data } = await supabase
                .from('audios')
                .select('*, profiles:user_id(username, full_name, avatar_url)')
                .eq('id', query);
             if (data) foundAudioResults = data;
        } else if (!isNaN(Number(query))) {
             // Search by Legacy Hash (Number) AND Title
             const { data: titleMatches } = await supabase
                .from('audios')
                .select('*, profiles:user_id(username, full_name, avatar_url)')
                .ilike('title', `%${query}%`)
                .limit(50);
             
             // Fetch all titles to compute hash (limit 2000 for performance)
             const { data: allTitles } = await supabase
                .from('audios')
                .select('id, title')
                .limit(2000);
             
             const matchedIds = (allTitles || []).filter(a => {
                 const hash = a.title.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0).toString().slice(0, 4);
                 return hash === query;
             }).map(a => a.id);

             let hashMatches: any[] = [];
             if (matchedIds.length > 0) {
                 const { data } = await supabase
                    .from('audios')
                    .select('*, profiles:user_id(username, full_name, avatar_url)')
                    .in('id', matchedIds);
                 if (data) hashMatches = data;
             }
             
             foundAudioResults = [...(titleMatches || []), ...hashMatches];
        } else {
             const { data } = await supabase
                .from('audios')
                .select('*, profiles:user_id(username, full_name, avatar_url)')
                .ilike('title', `%${query}%`)
                .limit(50);
             if (data) foundAudioResults = data;
        }

        if (profileError) console.error("Error searching profiles:", profileError);

        const filteredProfiles = currentUserId 
            ? (profiles || []).filter(user => user.id !== currentUserId)
            : (profiles || []);

        setFoundProfiles(filteredProfiles);

        // Map profiles to flat structure for display
        let combinedAudios = foundAudioResults.map(a => ({
            ...a,
            author: a.profiles?.full_name || a.profiles?.username || "Desconocido",
            username: a.profiles?.username,
            avatar_url: a.profiles?.avatar_url
        }));
        
        // Remove duplicates by ID
        combinedAudios = Array.from(new Map(combinedAudios.map(item => [item.id, item])).values());

        // Calculate distance and sort if location is available
        if (userLocation) {
            combinedAudios = combinedAudios.map(a => {
                if (a.latitude && a.longitude) {
                    const dist = getDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
                    return { ...a, distanceVal: dist };
                }
                return { ...a, distanceVal: Infinity };
            });
            combinedAudios.sort((a, b) => a.distanceVal - b.distanceVal);
        }

        setFoundAudios(combinedAudios);
        
    } catch (err) {
        console.error("Exception searching:", err);
        setFoundProfiles([]);
        setFoundAudios([]);
    } finally {
        setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
        if (query.trim()) {
            handleSearch();
        } else {
            setIsSearching(false);
            setFoundProfiles([]);
            setFoundAudios([]);
        }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  if (selectedProfileId) {
    return (
      <ProfileView 
        userId={selectedProfileId}
        onBack={() => setSelectedProfileId(null)}
        onAudioSelect={onAudioSelect}
        onLike={onLike}
        onComment={onComment}
        onLogout={onLogout}
      />
    );
  }

  const resultsToDisplay = searchFilter === 'user' ? foundProfiles : foundAudios;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with search */}
      <div className="sticky top-0 z-10 glass border-b border-border">
        <div className="px-4 pt-12 pb-4 flex flex-col items-center text-center">
          <h1 className="text-xl font-bold mb-4">Buscar</h1>
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!e.target.value) {
                      setIsSearching(false);
                      setFoundProfiles([]);
                      setFoundAudios([]);
                  }
                }}
                placeholder={searchFilter === 'user' ? "Buscar usuarios..." : "Buscar ecos por nombre o ID..."}
                className="w-full pl-12 pr-10 py-3 rounded-2xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setIsSearching(false);
                    setFoundProfiles([]);
                    setFoundAudios([]);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
          </form>

          {/* Filter Tabs */}
          <div className="flex w-full mt-4 p-1 bg-muted rounded-xl">
            <button
              onClick={() => setSearchFilter('user')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                searchFilter === 'user' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Usuarios
            </button>
            <button
              onClick={() => setSearchFilter('audio')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                searchFilter === 'audio' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Ecos
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-4xl mx-auto w-full">
          {!isSearching ? (
            <div className="px-4 py-6">
              {searchFilter === 'user' && recentProfiles.length > 0 ? (
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                          <h2 className="text-sm font-semibold text-muted-foreground">Recientes</h2>
                          <button 
                            onClick={() => {
                                setRecentProfiles([]);
                                localStorage.removeItem("soundspot_search_history");
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                              Borrar todo
                          </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                          {recentProfiles.map((user) => (
                              <div 
                                  key={user.id} 
                                  className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer group"
                                  onClick={() => setSelectedProfileId(user.id)}
                              >
                                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                      {user.avatar_url ? (
                                          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                                      ) : (
                                          <User className="w-5 h-5 text-muted-foreground" />
                                      )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <h3 className="font-medium text-foreground truncate text-sm">{user.full_name || user.username}</h3>
                                      <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                                  </div>
                                  <button 
                                      onClick={(e) => removeFromHistory(user.id, e)}
                                      className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                      <X className="w-4 h-4" />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>
                        {searchFilter === 'user' 
                            ? "Tus búsquedas recientes aparecerán aquí" 
                            : "Busca ecos cercanos o por nombre"}
                    </p>
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-6">
              <p className="text-sm text-muted-foreground mb-4">
                Resultados para "{query}"
              </p>
              
              {loading ? (
                   <div className="text-center py-10 text-muted-foreground">
                    <p>Buscando...</p>
                  </div>
              ) : resultsToDisplay.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {resultsToDisplay.map((item) => {
                    const isAudio = !!item.title;
                    return (
                    <div 
                        key={item.id} 
                        className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                            if (isAudio) {
                                onAudioSelect?.(item.id);
                            } else {
                                addToHistory(item);
                                setSelectedProfileId(item.id);
                            }
                        }}
                    >
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {isAudio ? (
                                <div className="bg-primary/10 w-full h-full flex items-center justify-center text-primary">
                                    <Music className="w-6 h-6" />
                                </div>
                            ) : (
                                item.avatar_url ? (
                                    <img src={item.avatar_url} alt={item.username} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-6 h-6 text-muted-foreground" />
                                )
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate">{isAudio ? item.title : (item.full_name || item.username)}</h3>
                            <p className="text-sm text-muted-foreground truncate">
                                {isAudio ? `Eco de ${item.author || 'Desconocido'}` : `@${item.username}`}
                            </p>
                            {isAudio && item.id && (
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    #{item.title.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0).toString().slice(0, 4)}
                                </p>
                            )}
                        </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <p>No se encontraron resultados</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


