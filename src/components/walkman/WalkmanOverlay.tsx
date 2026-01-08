import { useState, useEffect, useRef } from "react";
import { X, Play, Pause, SkipForward, Radio, Headphones, Waves, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AudioData } from "@/utils/audioStorage";
import { calculateDistance } from "@/utils/mapUtils";
import { toast } from "@/hooks/use-toast";

interface WalkmanOverlayProps {
  audios: AudioData[];
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
}

export const WalkmanOverlay = ({ audios, userLocation, onClose }: WalkmanOverlayProps) => {
  const [currentAudio, setCurrentAudio] = useState<AudioData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scannedAudios, setScannedAudios] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef(false);

  // Auto-scan logic
  useEffect(() => {
    if (!userLocation || currentAudio || processingRef.current) return;

    const WALKMAN_RADIUS = 30; // meters

    // Find closest unseen audio
    let closest: AudioData | null = null;
    let minDist = Infinity;

    audios.forEach(audio => {
        if (audio.latitude && audio.longitude && !scannedAudios.has(audio.id)) {
            const dist = calculateDistance(
                userLocation.latitude, 
                userLocation.longitude, 
                audio.latitude, 
                audio.longitude
            );
            
            if (dist < WALKMAN_RADIUS && dist < minDist) {
                minDist = dist;
                closest = audio;
            }
        }
    });

    if (closest) {
        playAudio(closest);
    }

  }, [userLocation, audios, scannedAudios, currentAudio]);

  const playAudio = (audio: AudioData) => {
    if (processingRef.current) return;
    processingRef.current = true;

    // Stop previous
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
    }

    setCurrentAudio(audio);
    setScannedAudios(prev => new Set(prev).add(audio.id));
    setIsPlaying(true);

    const newAudio = new Audio(audio.audioUrl);
    audioRef.current = newAudio;

    newAudio.onended = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        processingRef.current = false;
        toast({ title: "Eco terminado", description: "Buscando siguiente..." });
    };

    newAudio.onerror = (e) => {
        console.error("Audio error", e);
        toast({ title: "Error", description: "No se pudo reproducir el eco.", variant: "destructive" });
        setIsPlaying(false);
        setCurrentAudio(null);
        processingRef.current = false;
    };

    newAudio.play().catch(e => {
        console.error("Play failed", e);
        setIsPlaying(false);
        processingRef.current = false;
    });
    
    // Slight delay to reset processing flag if play is immediate, 
    // but we handled it in callbacks. 
    // Actually, we want to block scanning while playing.
    // currentAudio state blocks scanning.
    // processingRef blocks double-trigger.
    setTimeout(() => { processingRef.current = false; }, 1000);
  };

  const handleSkip = () => {
    if (audioRef.current) {
        audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentAudio(null);
    toast({ description: "Saltando eco..." });
  };

  const togglePlay = () => {
    if (audioRef.current) {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[2000] bg-background/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-500">
      {/* Header */}
      <div className="relative flex items-center justify-center p-6 pt-14">
        <div className="bg-background/80 backdrop-blur-md border border-primary/20 rounded-full px-6 py-2 flex items-center gap-3 shadow-lg shadow-primary/5 animate-in fade-in zoom-in duration-500">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <Headphones className="w-3 h-3 text-primary" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">Walkman Mode</span>
        </div>
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="absolute right-6 top-14 rounded-full hover:bg-muted"
        >
            <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-6">
        
        {/* Background Ambient Effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] transition-all duration-1000", isPlaying ? "scale-150 opacity-20" : "scale-100 opacity-10")} />
        </div>

        {currentAudio ? (
            // Playing State
            <div className="flex flex-col items-center gap-8 z-10 w-full max-w-sm animate-in zoom-in-95 duration-500">
                {/* Album Art / Visualizer */}
                <div className="relative w-64 h-64">
                    {/* Ripple */}
                    <div className={cn("absolute inset-0 rounded-full border-2 border-primary/20", isPlaying && "animate-ping")} />
                    <div className={cn("absolute inset-4 rounded-full border border-primary/20", isPlaying && "animate-pulse")} />
                    
                    {/* Main Circle */}
                    <div 
                        className="absolute inset-8 rounded-full shadow-2xl flex items-center justify-center border-4 border-background"
                        style={{ backgroundColor: currentAudio.color || "#f97316" }}
                    >
                        <Waves className="w-20 h-20 text-white/90 drop-shadow-lg" />
                    </div>
                </div>

                {/* Meta */}
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold leading-tight">{currentAudio.title}</h2>
                    <p className="text-muted-foreground font-medium flex items-center justify-center gap-2">
                        <span>{currentAudio.author}</span>
                        {currentAudio.distance && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {currentAudio.distance}
                            </span>
                        )}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-8 w-full">
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="w-16 h-16 rounded-full hover:bg-muted/50 transition-all"
                        onClick={handleSkip}
                    >
                        <SkipForward className="w-8 h-8 text-muted-foreground" />
                    </Button>

                    <Button 
                        size="icon" 
                        className="w-20 h-20 rounded-full shadow-xl hover:scale-105 transition-all bg-primary text-primary-foreground"
                        onClick={togglePlay}
                    >
                        {isPlaying ? (
                            <Pause className="w-10 h-10 fill-current" />
                        ) : (
                            <Play className="w-10 h-10 fill-current ml-1" />
                        )}
                    </Button>
                </div>
            </div>
        ) : (
            // Scanning State
            <div className="flex flex-col items-center gap-6 z-10 animate-in fade-in duration-1000">
                <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-muted flex items-center justify-center">
                        <Radio className="w-12 h-12 text-muted-foreground" />
                    </div>
                    {/* Radar rings */}
                    <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping duration-[3000ms]" />
                    <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping delay-700 duration-[3000ms]" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-xl font-semibold">Buscando ecos cercanos...</h3>
                    <p className="text-sm text-muted-foreground">Camina para descubrir historias</p>
                </div>
            </div>
        )}
      </div>

      {/* Footer Stat */}
      <div className="p-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
            {scannedAudios.size} ecos escuchados hoy
        </p>
      </div>
    </div>
  );
};
