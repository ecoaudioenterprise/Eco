import { useState, useEffect } from "react";
import { Filter, Music, MapPin, Radio } from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { cn } from "@/lib/utils";
import { AudioCard } from "@/components/audio/AudioCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ListViewProps {
  onAudioSelect?: (id: string) => void;
  audios?: any[];
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  loadingProgress?: number;
}

const categories = [
  { id: "all", label: "Todos", emoji: "🎧" },
  { id: "ambient", label: "Ambiente", emoji: "🌿" },
  { id: "story", label: "Historia", emoji: "📖" },
  { id: "guide", label: "Guía", emoji: "🗺️" },
  { id: "music", label: "Música", emoji: "🎵" },
  { id: "interview", label: "Entrevista", emoji: "🎤" },
];

export const ListView = ({ onAudioSelect, audios = [], onLike, onComment, loadingProgress = 100 }: ListViewProps) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const [displayProgress, setDisplayProgress] = useState(0);

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
      } finally {
        setLocationLoading(false);
      }
    };
    getLocation();
  }, []);

  useEffect(() => {
    // Use loadingProgress directly as the base
    let targetProgress = loadingProgress;

    // If data is fully loaded (100%) but we are still waiting for location,
    // hold visual progress at 95% to indicate we are almost there but waiting for the final piece.
    // This avoids the progress bar getting stuck at 80% which feels too low.
    if (loadingProgress >= 100 && locationLoading) {
        targetProgress = 95;
    }

    // Smooth animation for progress
    if (displayProgress < targetProgress) {
        const diff = targetProgress - displayProgress;
        const step = Math.max(1, diff / 10); // Animate 10% of the difference per frame
        
        const timer = setTimeout(() => {
            setDisplayProgress(prev => Math.min(targetProgress, prev + step));
        }, 50);
        return () => clearTimeout(timer);
    } else if (displayProgress > targetProgress && targetProgress < 100) {
        // Reset if target drops (e.g. retry)
        setDisplayProgress(targetProgress);
    } else if (!locationLoading && loadingProgress >= 100 && displayProgress < 100) {
        // Ensure we hit 100% when everything is truly done
        setDisplayProgress(100);
    }
  }, [loadingProgress, locationLoading, displayProgress]);

  const isLoading = (displayProgress < 100 && audios.length === 0) || locationLoading;

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

  const processedAudios = audios
    .map((audio) => {
      if (!userLocation || !audio.latitude || !audio.longitude) {
        return { ...audio, distanceVal: Infinity };
      }
      const d = getDistance(
        userLocation.latitude,
        userLocation.longitude,
        audio.latitude,
        audio.longitude
      );
      return {
        ...audio,
        distanceVal: d,
        distance: d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`,
      };
    })
    .filter((audio) => !userLocation || audio.distanceVal <= 1000) // 1km filter
    .sort((a, b) => {
        if (!userLocation) return 0;
        return a.distanceVal - b.distanceVal;
    });

  const listenAudios = processedAudios.filter(audio => audio.distanceVal <= 100);
  const nearbyAudios = processedAudios.filter(audio => audio.distanceVal > 100);

  const togglePlay = (id: string) => {
    setPlayingId(playingId === id ? null : id);
    onAudioSelect?.(id);
  };

  return (
    <Tabs defaultValue="listen" className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-border mb-2 pt-8 pb-4">
        <div className="px-6 flex flex-col gap-3 items-center text-center">
          <div className="flex flex-col gap-1">
             <h1 className="text-2xl font-bold text-foreground tracking-tight">Cerca de ti</h1>
             <p className="text-sm text-muted-foreground">Explora los ecos a tu alrededor</p>
          </div>
        </div>
        
        <div className="px-4 mt-6">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="listen" className="flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Escuchar
                </TabsTrigger>
                <TabsTrigger value="nearby" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Cerca
                </TabsTrigger>
            </TabsList>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-6">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                        {Math.round(displayProgress)}%
                    </div>
                </div>
                <p className="text-muted-foreground animate-pulse">
                    {locationLoading ? "Obteniendo ubicación..." : "Buscando ecos cercanos..."}
                </p>
            </div>
          ) : (
            <>
              <TabsContent value="listen" className="space-y-3 mt-4">
                  {listenAudios.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground space-y-4">
                      <div className="p-4 bg-muted rounded-full">
                        <Music className="w-8 h-8 opacity-50" />
                      </div>
                      <p>No hay ecos para escuchar.<br />Acércate a una ubicación.</p>
                    </div>
                  ) : (
                    listenAudios.map((audio) => (
                      <AudioCard
                        key={audio.id}
                        {...audio}
                        isPlaying={playingId === audio.id}
                        onPlay={() => togglePlay(audio.id)}
                        onLike={() => onLike?.(audio.id)}
                        onComment={() => onComment?.(audio.id)}
                        isInteractable={true}
                        showCategory={false}
                      />
                    ))
                  )}
              </TabsContent>
              
              <TabsContent value="nearby" className="space-y-3 mt-4">
                  {nearbyAudios.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground space-y-4">
                      <div className="p-4 bg-muted rounded-full">
                        <MapPin className="w-8 h-8 opacity-50" />
                      </div>
                      <p>No hay ecos cercanos.<br />¡Sé el primero en publicar uno!</p>
                    </div>
                  ) : (
                    nearbyAudios.map((audio) => (
                      <AudioCard
                        key={audio.id}
                        {...audio}
                        isPlaying={playingId === audio.id}
                        onPlay={() => togglePlay(audio.id)}
                        onLike={() => onLike?.(audio.id)}
                        onComment={() => onComment?.(audio.id)}
                        isInteractable={audio.distanceVal <= 100} 
                        showCategory={false}
                      />
                    ))
                  )}
              </TabsContent>
            </>
          )}
      </div>
    </Tabs>
  );
};
