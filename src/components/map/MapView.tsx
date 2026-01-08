import { useState, useEffect, useRef } from "react";
import Map, { Marker, NavigationControl, ScaleControl, GeolocateControl, MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Geolocation } from "@capacitor/geolocation";
import { Network } from "@capacitor/network";
import { AudioPin } from "@/components/audio/AudioPin";
import { WalkmanOverlay } from "@/components/walkman/WalkmanOverlay";
import { LocateFixed, Bell, Layers, Download, Loader2, Headphones, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsView } from "@/components/views/NotificationsView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import useSupercluster from "use-supercluster";
import { downloadTilesInBounds } from "@/utils/offlineMapUtils";
import { AudioData } from "@/utils/audioStorage";
import { SubscriptionModal } from "../subscription/SubscriptionModal";

interface MapViewProps {
  onPinClick?: (id: string) => void;
  audios: AudioData[];
  selectedId: string | null;
  onClusterClick?: () => void;
  onOpenLeaderboard?: () => void;
}

export const MapView = ({ onPinClick, audios, selectedId, onClusterClick, onOpenLeaderboard }: MapViewProps) => {
  const mapRef = useRef<MapRef>(null);
  const [userLocation, setUserLocation] = useState<{ longitude: number; latitude: number } | null>(null);
  const [showRecenter, setShowRecenter] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const hasCenteredRef = useRef(false); // Ref to track if we have already centered once
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Walkman Mode
  const [isWalkmanMode, setIsWalkmanMode] = useState(false);
  const lastPlayedAudioRef = useRef<string | null>(null);
  const playedAudiosSessionRef = useRef<Set<string>>(new Set());

  // Offline Map State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showSubscription, setShowSubscription] = useState(false);

  // Clustering state
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [zoom, setZoom] = useState(15);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Register custom protocol for offline tiles
    try {
        // @ts-ignore - maplibregl types mismatch
        maplibregl.addProtocol('offline-carto', async (params, callback: any) => {
            try {
                const httpsUrl = params.url.replace('offline-carto://', 'https://');
                
                if ('caches' in window) {
                    const cache = await caches.open('offline-map-tiles');
                    const match = await cache.match(httpsUrl);
                    if (match) {
                        const buffer = await match.arrayBuffer();
                        if (typeof callback === 'function') {
                            callback(null, buffer, null, null);
                        }
                        return { data: buffer };
                    }
                }
                if (typeof callback === 'function') {
                    callback(new Error('Tile not found in offline cache'));
                }
                throw new Error('Tile not found');
            } catch (e) {
                if (typeof callback === 'function') {
                    callback(e as Error);
                }
                throw e;
            }
        });
    } catch (e) {
        // Ignore if already registered
    }

    // Monitor network status
    Network.getStatus().then(status => setIsOffline(!status.connected));
    
    let networkListener: any;
    const setupListener = async () => {
        networkListener = await Network.addListener('networkStatusChange', status => {
            setIsOffline(!status.connected);
            if (!status.connected) {
                const isPro = localStorage.getItem("soundspot_is_pro") === "true";
                if (isPro) {
                    toast({
                        title: "Modo Offline",
                        description: "Usando mapas descargados.",
                    });
                }
            }
        });
    };
    setupListener();

    return () => {
        if (networkListener) {
            networkListener.remove();
        }
    };
  }, []);

  useEffect(() => {
    checkUnreadNotifications();
    
    // Subscribe to realtime notifications
    const channel = supabase
        .channel('public:notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
            checkUnreadNotifications();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, []);

  const checkUnreadNotifications = async () => {
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          const { count } = await supabase
              .from('notifications')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('read', false);
              
          setUnreadNotifications(count || 0);
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
    // Start watching position
    let watchId: string;

    const startWatching = async () => {
        try {
            watchId = await Geolocation.watchPosition({
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }, (position, err) => {
                if (position) {
                    const { latitude, longitude } = position.coords;
                    setUserLocation({ latitude, longitude });
                    setInitialLoad(false);
                    
                    // Solo centrar en la primera carga usando la referencia
                    if (!hasCenteredRef.current && mapRef.current) {
                         mapRef.current.flyTo({
                            center: [longitude, latitude],
                            zoom: 15,
                            essential: true
                        });
                        hasCenteredRef.current = true;
                    }
                }
            });
        } catch (error) {
            console.error("Error watching position:", error);
        }
    };

    startWatching();

    return () => {
        if (watchId) Geolocation.clearWatch({ id: watchId });
    };
  }, []);

  const getCurrentPosition = async () => {
    try {
      const permission = await Geolocation.checkPermissions();
      
      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') return;
      }

      // Fallback to getCurrentPosition if watch hasn't fired yet or for immediate update
      const position = await Geolocation.getCurrentPosition({ 
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
      });
      const { latitude, longitude } = position.coords;
      
      setUserLocation({ latitude, longitude });
      setInitialLoad(false);

      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 15,
          essential: true
        });
      }
    } catch (error) {
      // Suppress annoying location errors in development or if permission denied
      // console.error("Error getting location:", error);
    }
  };

  const handleMove = () => {
    if (mapRef.current) {
      const b = mapRef.current.getBounds();
      setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      setZoom(mapRef.current.getZoom());
    }

    if (!userLocation || !mapRef.current) return;
    
    const center = mapRef.current.getCenter();
    const dist = Math.sqrt(
      Math.pow(center.lng - userLocation.longitude, 2) + 
      Math.pow(center.lat - userLocation.latitude, 2)
    );
    
    // Show recenter button if map center is far from user location (> 0.002 degrees approx 200m)
    setShowRecenter(dist > 0.002);
  };

  const handleRecenter = () => {
    // Use current state immediately for instant feedback
    if (userLocation && mapRef.current) {
        mapRef.current.flyTo({
            center: [userLocation.longitude, userLocation.latitude],
            zoom: 15,
            essential: true,
            duration: 1000 // Snappy animation
        });
        setShowRecenter(false);
    } else {
        // Fallback only if we somehow don't have location
        getCurrentPosition();
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

  const getDistanceString = (d: number) => {
    if (d < 1000) return `${Math.round(d)}m`;
    return `${(d/1000).toFixed(1)}km`;
  };

  // Convert audios to GeoJSON points for supercluster
  const points = audios.map(audio => ({
    type: "Feature" as const,
    properties: { cluster: false, audioId: audio.id, ...audio },
    geometry: {
      type: "Point" as const,
      coordinates: [audio.longitude, audio.latitude]
    }
  }));

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom,
    options: { radius: 75, maxZoom: 20 }
  });

  const handlePinClick = (id: string, lat: number, lng: number) => {
      if (!userLocation) {
          onPinClick?.(id);
          return;
      }

      const dist = calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng);
      
      if (dist <= 100) {
          onPinClick?.(id);
      } else {
          toast({
              title: "Estás lejos",
              description: "Debes estar a menos de 100m para interactuar con este eco.",
              variant: "destructive"
          });
      }
  };

  // Determine day/night based on local hour
  const [mapTheme, setMapTheme] = useState<'light' | 'dark'>('light');
  // Check local storage for map type preference
  const [mapTypePreference, setMapTypePreference] = useState<'standard' | 'satellite'>(() => {
    return (localStorage.getItem("settings_map_type") as 'standard' | 'satellite') || 'standard';
  });

  useEffect(() => {
    const checkTime = () => {
        const hour = new Date().getHours();
        // Day: 6 AM to 8 PM (20:00)
        const isDay = hour >= 6 && hour < 20;
        setMapTheme(isDay ? 'light' : 'dark');
    };
    
    // Also check for map type updates
    const checkMapType = () => {
        const savedType = localStorage.getItem("settings_map_type") as 'standard' | 'satellite';
        if (savedType && savedType !== mapTypePreference) {
            setMapTypePreference(savedType);
        }
    };
    
    checkTime();
    checkMapType();

    // Listen for custom event from SettingsView
    window.addEventListener('mapSettingsChanged', checkMapType);

    // Check every minute just in case
    const interval = setInterval(() => {
        checkTime();
        checkMapType();
    }, 1000); // Check more frequently for immediate settings updates
    return () => {
      clearInterval(interval);
      window.removeEventListener('mapSettingsChanged', checkMapType);
    };
  }, [mapTypePreference]);

  // Estilo minimalista y limpio usando Carto Voyager (Light) o Dark Matter (Dark)
  // O Satélite si está seleccionado (Esri World Imagery)
  const isPro = localStorage.getItem("soundspot_is_pro") === "true";
  const useOfflineTiles = isOffline && isPro;

  const processTileUrl = (url: string) => {
      return useOfflineTiles ? url.replace('https://', 'offline-carto://') : url;
  };

  const sourceId = mapTypePreference === 'satellite' ? "satellite-source" : "carto-raster";
  const layerId = mapTypePreference === 'satellite' ? "satellite-layer" : "carto-raster-layer";

  const mapStyle = {
    version: 8,
    sources: {
      [sourceId]: {
        type: "raster",
        tiles: mapTypePreference === 'satellite' ? [
            processTileUrl("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}")
        ] : (mapTheme === 'light' ? [
          processTileUrl("https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"),
          processTileUrl("https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"),
          processTileUrl("https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"),
          processTileUrl("https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png")
        ] : [
          processTileUrl("https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png"),
          processTileUrl("https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png"),
          processTileUrl("https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png"),
          processTileUrl("https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png")
        ]),
        tileSize: 256,
        attribution: mapTypePreference === 'satellite' 
            ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    },
    layers: [
      {
        id: layerId,
        type: "raster",
        source: sourceId,
        minzoom: 0,
        maxzoom: 22
      }
    ]
  };

  const handleDownloadMap = async () => {
    const isPro = localStorage.getItem("soundspot_is_pro") === "true";
    if (!isPro) {
      setShowSubscription(true);
      return;
    }

    if (!bounds || isDownloading) return;

    // Check zoom level to prevent massive downloads
    if (zoom < 13) {
      toast({
        title: "Zona demasiado grande",
        description: "Acércate más para descargar el mapa (Zoom nivel 13+).",
        variant: "destructive"
      });
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    
    toast({
        title: "Iniciando descarga...",
        description: "Guardando mapa para uso sin conexión.",
    });

    try {
        const downloadType = mapTypePreference === 'satellite' ? 'satellite' : mapTheme;
        const count = await downloadTilesInBounds(bounds, Math.round(zoom), downloadType, (progress) => {
            setDownloadProgress(progress);
        });
        
        toast({
            title: "Mapa descargado",
            description: `Se han guardado ${count} secciones del mapa correctamente.`,
        });
        localStorage.setItem("has_offline_maps", "true");
    } catch (e) {
        toast({
            title: "Error",
            description: "No se pudo guardar el mapa offline.",
            variant: "destructive"
        });
    } finally {
        setIsDownloading(false);
        setDownloadProgress(0);
    }
  };

  if (initialLoad && !userLocation) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const toggleWalkmanMode = () => {
    const newState = !isWalkmanMode;
    setIsWalkmanMode(newState);
    if (newState) {
        toast({
            title: "Modo Walkman activado 🎧",
            description: "Camina y los ecos se reproducirán automáticamente.",
        });
    } else {
        toast({
            title: "Modo Walkman desactivado",
            description: "Reproducción automática detenida.",
        });
    }
  };

  return (
    <div className="relative w-full h-full bg-muted">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex flex-col pointer-events-none">
         <div className="h-8 bg-gradient-to-b from-black/50 to-transparent" /> {/* Status bar area */}
         <div className="flex items-center justify-center p-4 pt-2 pointer-events-auto relative">
             {/* Offline Download Button (Top Left) */}
             <Button
                size="icon"
                variant="ghost"
                className="absolute left-4 bg-background/50 backdrop-blur-md hover:bg-background/80 rounded-full shadow-sm border border-white/10"
                onClick={handleDownloadMap}
                disabled={isDownloading}
             >
                {isDownloading ? (
                    <div className="relative flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="absolute text-[8px] font-bold">{Math.round(downloadProgress)}%</span>
                    </div>
                ) : (
                    <Download className="w-5 h-5 text-blue-500" />
                )}
             </Button>

             {/* Leaderboard Button */}
             <Button
                size="icon"
                variant="ghost"
                className="absolute left-16 bg-background/50 backdrop-blur-md hover:bg-background/80 rounded-full shadow-sm border border-white/10"
                onClick={onOpenLeaderboard}
             >
                <Trophy className="w-5 h-5 text-yellow-500" />
             </Button>

             <h1 className="text-xl font-bold text-foreground drop-shadow-md bg-background/50 backdrop-blur-md px-4 py-1 rounded-full border border-white/10">SoundSpot</h1>
             
             <Button
                size="icon"
                variant={isWalkmanMode ? "default" : "ghost"}
                className={cn(
                    "absolute right-16 bg-background/50 backdrop-blur-md hover:bg-background/80 rounded-full shadow-sm border border-white/10 transition-all duration-300",
                    isWalkmanMode && "bg-primary text-primary-foreground hover:bg-primary/90 animate-pulse ring-2 ring-primary ring-offset-2"
                )}
                onClick={toggleWalkmanMode}
             >
                <Headphones className={cn("w-5 h-5", isWalkmanMode ? "text-primary-foreground" : "text-violet-500")} />
             </Button>

             <Button
                 variant="ghost"
                 size="icon"
                 className="absolute right-4 bg-background/50 backdrop-blur-md hover:bg-background/80 rounded-full shadow-sm border border-white/10"
                 onClick={() => setShowNotifications(true)}
             >
                 <Bell className="w-5 h-5 text-orange-500" />
                 {unreadNotifications > 0 && (
                     <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background" />
                 )}
             </Button>
         </div>
      </div>

      <Map
        key={mapTypePreference}
        ref={mapRef}
        initialViewState={{
          longitude: userLocation?.longitude || -3.70379,
          latitude: userLocation?.latitude || 40.416775,
          zoom: 15
        }}
        onLoad={(e) => {
          const b = e.target.getBounds();
          setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
          setZoom(e.target.getZoom());
        }}
        onMove={handleMove}
        mapLib={maplibregl}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle as any}
        minZoom={3}
        maxZoom={20}
      >
        <ScaleControl />

        {userLocation && (
          <Marker 
            longitude={userLocation.longitude} 
            latitude={userLocation.latitude} 
            anchor="center"
            style={{ zIndex: 900 }}
          >
            <div className="relative">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
            </div>
          </Marker>
        )}

        {clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } = cluster.properties as any;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${cluster.id}`}
                longitude={longitude}
                latitude={latitude}
                style={{ zIndex: 500 }}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  // User requested: "si clicas en ese icono, te lleva a la sección de cerca de mi"
                  onClusterClick?.();
                }}
              >
                <div 
                  className="flex items-center justify-center w-10 h-10 bg-orange-500 text-white rounded-full shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-bold">{pointCount}</span>
                  </div>
                </div>
              </Marker>
            );
          }

          const audio = cluster.properties as any;
          return (
            <Marker
              key={audio.audioId}
              longitude={longitude}
              latitude={latitude}
              anchor="center"
              style={{ zIndex: (hoveredId === audio.audioId || selectedId === audio.audioId) ? 800 : 10 }} // Bring hovered/selected pin to front but below sheet (z-1001)
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handlePinClick(audio.audioId, latitude, longitude);
              }}
            >
              <div className={cn("transition-opacity duration-200", (selectedId === audio.audioId) ? "opacity-100 scale-110" : "opacity-100")}>
                   <AudioPin
                  title={audio.title}
                  distance={userLocation ? getDistanceString(calculateDistance(userLocation.latitude, userLocation.longitude, latitude, longitude)) : audio.distance}
                  category={audio.category}
                  color={audio.color}
                  showTooltip={selectedId === audio.audioId || hoveredId === audio.audioId}
                  onClick={() => handlePinClick(audio.audioId, latitude, longitude)}
                  onMouseEnter={() => setHoveredId(audio.audioId)}
                  onMouseLeave={() => setHoveredId(null)}
                  />
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Recenter button */}
      {showRecenter && (
        <div className="absolute bottom-24 right-4 z-10 animate-in fade-in zoom-in duration-500 ease-fluid">
          <Button
            size="icon"
            className="rounded-full shadow-lg bg-background text-foreground hover:bg-muted"
            onClick={handleRecenter}
          >
            <LocateFixed className="w-5 h-5 text-primary" />
          </Button>
        </div>
      )}

      {/* Notifications View */}
      {showNotifications && (
        <NotificationsView onBack={() => setShowNotifications(false)} />
      )}



      <SubscriptionModal 
        open={showSubscription} 
        onOpenChange={setShowSubscription}
      />

      {isWalkmanMode && (
        <WalkmanOverlay 
            audios={audios}
            userLocation={userLocation}
            onClose={toggleWalkmanMode}
        />
      )}
    </div>
  );
};
