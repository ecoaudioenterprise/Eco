import { useState, useEffect, useRef } from "react";
import { X, Play, Pause, Heart, MessageCircle, Flag, Share2, SkipBack, SkipForward, User, Lock, Bookmark, MapPin } from "lucide-react";
import { Share } from '@capacitor/share';
import { Geolocation } from '@capacitor/geolocation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Waveform } from "./Waveform";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PlayerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileClick?: (authorId: string) => void;
  onLike?: () => void;
  onComment?: () => void;
  audio?: {
    id: string;
    title: string;
    author: string;
    authorUsername?: string;
    authorId?: string;
    authorAvatar?: string;
    duration: string;
    distance: string;
    likes: number;
    comments: number;
    category: string;
    audioUrl?: string;
    latitude?: number;
    longitude?: number;
    timestamp?: number;
    isLiked?: boolean;
  };
}

export const PlayerSheet = ({ isOpen, onClose, onProfileClick, audio, onLike, onComment }: PlayerSheetProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Check if audio is already saved
    if (audio?.id) {
        const saved = localStorage.getItem(`saved_audio_${audio.id}`);
        setIsSaved(!!saved);
    }
  }, [audio?.id]);

  useEffect(() => {
    const checkProximity = async () => {
        // Unlock if user is the author
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id && audio?.authorId === session.user.id) {
                console.log("User is author, unlocking audio");
                setIsLocked(false);
                return;
            }
        } catch (e) {
            console.error("Error checking auth for proximity bypass:", e);
        }

        if (isOpen && audio?.latitude && audio?.longitude) {
            try {
                // If it's my own audio, don't lock it (optional, but good UX)
                // For now, strict 100m rule as requested
                
                const position = await Geolocation.getCurrentPosition({ 
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                // Haversine formula for distance in meters
                const R = 6371e3; // metres
                const φ1 = userLat * Math.PI/180; // φ, λ in radians
                const φ2 = audio.latitude * Math.PI/180;
                const Δφ = (audio.latitude - userLat) * Math.PI/180;
                const Δλ = (audio.longitude - userLng) * Math.PI/180;

                const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                          Math.cos(φ1) * Math.cos(φ2) *
                          Math.sin(Δλ/2) * Math.sin(Δλ/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const d = R * c; // in metres

                console.log(`Distance to audio: ${d}m`);
                setIsLocked(d > 100); // Lock if > 100m
            } catch (error) {
                console.error("Error checking proximity:", error);
                // If location fails, we might default to locked or unlocked. 
                // Safety first: locked if we can't verify location? 
                // Or unlocked to avoid frustration? 
                // Let's assume unlocked for error cases to be nice, or locked to be strict.
                // User said "haz que por mas que un audio se envie por url, no pueda escucharlo... si no esta cerca"
                // So strict mode:
                setIsLocked(true); 
            }
        } else if (isOpen && (!audio?.latitude || !audio?.longitude)) {
            // If audio has no coordinates (e.g. legacy), unlock it? or lock it?
            // Let's unlock legacy audios or assume they are test audios
            setIsLocked(false);
        }
    };
    
    checkProximity();
  }, [isOpen, audio]);

  useEffect(() => {
    if (isOpen && audio?.audioUrl && !isLocked) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      try {
        audioRef.current = new Audio(audio.audioUrl);
        
        // Setup progress tracking
        audioRef.current.addEventListener('timeupdate', updateProgress);
        audioRef.current.addEventListener('ended', () => {
            setIsPlaying(false);
            setProgress(100);
        });
        
        // Auto play when opening if not locked
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => setIsPlaying(true))
                .catch(e => {
                    console.error("Playback error:", e);
                    // toast({ title: "Error de reproducción", description: "No se pudo reproducir el audio automáticamente.", variant: "destructive" });
                    setIsPlaying(false);
                });
        }
      } catch (e) {
        console.error("Audio initialization error:", e);
      }
    } else if (isLocked && audioRef.current) {
        // Stop if locked
        audioRef.current.pause();
        audioRef.current = null;
        setIsPlaying(false);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setProgress(0);
      setShowReportDialog(false);
    };
  }, [isOpen, audio?.audioUrl, isLocked]);

  const handleSaveForLater = () => {
    if (audio?.id) {
        if (isSaved) {
            localStorage.removeItem(`saved_audio_${audio.id}`);
            setIsSaved(false);
            toast({ title: "Eco eliminado de guardados" });
        } else {
            localStorage.setItem(`saved_audio_${audio.id}`, JSON.stringify({
                id: audio.id,
                title: audio.title,
                savedAt: Date.now()
            }));
            setIsSaved(true);
            toast({ title: "Eco guardado para escuchar luego" });
        }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const updateProgress = () => {
    if (audioRef.current && audioRef.current.duration) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleShare = async () => {
    if (!audio) return;
    
    // Privacy check
    if (audio.privacy === "private") {
        toast({
            title: "No se puede compartir",
            description: "Este eco es privado y no tiene un enlace para compartir.",
            variant: "destructive"
        });
        return;
    }

    try {
      await Share.share({
        title: `Escucha "${audio.title}" en Eco 🎵`,
        text: `¡He encontrado este eco increíble en Eco! 🎧\n\n"${audio.title}" por ${audio.author} 📍 ${audio.distance}\n\nEscúchalo aquí:`,
        url: `https://sound-maps-main.vercel.app/listen/${audio.id}`,
        dialogTitle: 'Compartir eco',
      });
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback for web/desktop if plugin fails (though capacitor/share handles web too usually)
      if (navigator.clipboard) {
         try {
             await navigator.clipboard.writeText(`https://sound-maps-main.vercel.app/listen/${audio.id}`);
             toast({
                title: "Enlace copiado",
                description: "El enlace se ha copiado al portapapeles",
             });
         } catch (e) {
             console.error('Clipboard error', e);
         }
      }
    }
  };

  const handleReport = () => {
    if (!reportReason) {
      toast({
        title: "Selecciona una razón",
        description: "Por favor, selecciona una razón para reportar este eco",
        variant: "destructive"
      });
      return;
    }

    const subject = `Reporte de Eco: ${audio?.title} (ID: ${audio?.id})`;
    const body = `
      He encontrado un problema con el eco "${audio?.title}" publicado por ${audio?.author}.
      
      Razón del reporte: ${reportReason}
      
      Detalles adicionales:
      
      --------------------------------
      ID del Eco: ${audio?.id}
      ID del Autor: ${audio?.authorId || 'Desconocido'}
      Fecha: ${new Date().toISOString()}
    `;

    const mailtoLink = `mailto:ecoenterprise@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    
    setShowReportDialog(false);
    setReportReason("");
    
    toast({
      title: "Reporte iniciado",
      description: "Se abrirá tu cliente de correo para finalizar el reporte.",
    });
  };

  if (!isOpen || !audio) return null;

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const nextSpeed = () => {
    const currentIndex = speeds.indexOf(playbackSpeed);
    setPlaybackSpeed(speeds[(currentIndex + 1) % speeds.length]);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[10001]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold mb-4">Reportar Eco</h3>
            <div className="space-y-3 mb-6">
              {[
                "Contenido inapropiado",
                "Spam o publicidad",
                "Mala calidad del eco",
                "Derechos de autor",
                "Otro"
              ].map((reason) => (
                <div key={reason} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={reason}
                    name="reportReason"
                    value={reason}
                    checked={reportReason === reason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-4 h-4 accent-primary"
                  />
                  <label htmlFor={reason} className="text-sm cursor-pointer select-none" onClick={() => setReportReason(reason)}>
                    {reason}
                  </label>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowReportDialog(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleReport}>
                Enviar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 glass rounded-t-[2.5rem] animate-slide-up border-t border-white/10 shadow-2xl">
        <div className="flex flex-col p-6 pb-8">
          {/* Handle */}
          <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mb-6" />

          {/* Header Actions */}
          <div className="absolute top-6 right-6 z-10">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors backdrop-blur-md"
            >
              <X className="w-4 h-4 text-foreground/70" />
            </button>
          </div>

          {/* Main Visual & Info */}
          <div className="flex flex-col items-center text-center mb-8">
            <div 
              className={cn(
                "relative w-24 h-24 rounded-3xl mb-5 shadow-2xl transition-transform duration-700",
                isPlaying && "scale-105"
              )}
              onClick={() => onProfileClick?.(audio.authorId || "")}
            >
              <div className={cn(
                "absolute inset-0 rounded-3xl opacity-50 blur-xl transition-colors duration-500",
                isPlaying ? "bg-primary" : "bg-muted"
              )} />
              
              <div className="relative w-full h-full rounded-3xl overflow-hidden bg-background border-2 border-white/10">
                {audio.authorAvatar ? (
                  <img src={audio.authorAvatar} alt={audio.author} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                    <span className="text-4xl">🎵</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 max-w-[85%]">
              <h2 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
                {audio.title}
              </h2>
              <div 
                className="flex items-center justify-center flex-wrap gap-2 text-sm text-muted-foreground"
                onClick={() => onProfileClick?.(audio.authorId || "")}
              >
                <span className="font-medium text-foreground hover:underline cursor-pointer">
                    {audio.author}
                    {audio.authorUsername && <span className="text-muted-foreground font-normal ml-1.5">{audio.authorUsername}</span>}
                </span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {audio.distance}
                </span>
                <span>•</span>
                <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                    #{audio.title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0).toString().slice(0, 4)}
                </span>
                {audio.timestamp && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                    <span>{formatDistanceToNow(audio.timestamp, { addSuffix: true, locale: es })}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Waveform Area */}
          <div className="mb-6 px-2">
            {isLocked ? (
                <div className="h-24 flex flex-col items-center justify-center bg-muted/30 rounded-2xl border border-white/5 backdrop-blur-sm px-6">
                    <div className="flex items-center gap-2 mb-1">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Estás demasiado lejos</span>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mb-3">
                        Acércate a menos de 100m
                    </p>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs gap-1.5 bg-background/50 border-white/10 hover:bg-background/80"
                        onClick={handleSaveForLater}
                    >
                        <Bookmark className={cn("w-3 h-3", isSaved && "fill-current")} />
                        {isSaved ? "Guardado" : "Guardar"}
                    </Button>
                </div>
            ) : (
                <div className="relative">
                    <div className="h-24 flex items-center justify-center">
                        <Waveform
                            isPlaying={isPlaying}
                            progress={progress}
                            bars={45}
                            size="lg"
                            audioUrl={audio.audioUrl}
                        />
                    </div>
                    {/* Time Indicators */}
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground/70 mt-2 px-1">
                        <span>{formatTime((progress / 100) * (audioRef.current?.duration || 0))}</span>
                        <span>{audio.duration}</span>
                    </div>
                </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-6 mb-8">
            <div className="flex items-center gap-8">
                <button 
                    className="p-3 rounded-full text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-all disabled:opacity-30"
                    disabled={isLocked}
                >
                  <SkipBack className="w-6 h-6" />
                </button>
                
                <Button
                  variant="hero"
                  size="iconLg"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-16 h-16 rounded-full shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLocked}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 fill-current ml-1" />
                  )}
                </Button>
                
                <button 
                    className="p-3 rounded-full text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-all disabled:opacity-30"
                    disabled={isLocked}
                >
                  <SkipForward className="w-6 h-6" />
                </button>
            </div>

            {!isLocked && (
                 <button
                    onClick={nextSpeed}
                    className="px-3 py-1 rounded-full bg-muted/50 text-[10px] font-bold tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground transition-colors uppercase"
                 >
                    {playbackSpeed}x SPEED
                 </button>
            )}
          </div>

          {/* Footer Actions */}
          <div className="grid grid-cols-4 gap-4 pt-6 border-t border-border/50">
            <button
              onClick={() => onLike?.()}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className={cn(
                "p-3 rounded-2xl transition-all duration-300 group-active:scale-95",
                audio?.isLiked ? "bg-red-500/10 text-red-500" : "bg-muted/30 text-muted-foreground group-hover:bg-muted/50 group-hover:text-foreground"
              )}>
                <Heart className={cn("w-5 h-5", audio?.isLiked && "fill-current")} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{audio?.likes || 0}</span>
            </button>
            
            <button 
              onClick={() => onComment?.()}
              className="flex flex-col items-center gap-1.5 group"
            >
               <div className="p-3 rounded-2xl bg-muted/30 text-muted-foreground transition-all duration-300 group-hover:bg-muted/50 group-hover:text-foreground group-active:scale-95">
                 <MessageCircle className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-medium text-muted-foreground">{audio.comments}</span>
            </button>
            
            <button 
              className="flex flex-col items-center gap-1.5 group"
              onClick={handleShare}
            >
               <div className="p-3 rounded-2xl bg-muted/30 text-muted-foreground transition-all duration-300 group-hover:bg-muted/50 group-hover:text-foreground group-active:scale-95">
                  <Share2 className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-medium text-muted-foreground">Compartir</span>
            </button>
            
            <button 
              className="flex flex-col items-center gap-1.5 group"
              onClick={() => setShowReportDialog(true)}
            >
               <div className="p-3 rounded-2xl bg-muted/30 text-muted-foreground transition-all duration-300 group-hover:bg-red-500/10 group-hover:text-red-500 group-active:scale-95">
                  <Flag className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-medium text-muted-foreground">Reportar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
