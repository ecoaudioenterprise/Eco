import { Heart, MessageCircle, MapPin, Play, Pause, Lock, BadgeCheck, Trash2, Globe, EyeOff, Pencil, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Waveform } from "./Waveform";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

interface AudioCardProps {
  title: string;
  author: string;
  authorUsername?: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  distance: string;
  duration: string;
  likes: number;
  comments: number;
  category?: "ambient" | "story" | "guide" | "music" | "interview" | "alert";
  privacy?: "public" | "hidden" | "private";
  isPlaying?: boolean;
  progress?: number;
  onPlay?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  isLiked?: boolean;
  className?: string;
  onClick?: () => void;
  timestamp?: number;
  isInteractable?: boolean;
  showCategory?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  audioUrl?: string;
}

const categoryLabels = {
  ambient: "Ambiente",
  story: "Historia",
  guide: "Guía",
  music: "Música",
  interview: "Entrevista",
  alert: "Alerta",
};

const categoryColors = {
  ambient: "bg-emerald-500/10 text-emerald-600",
  story: "bg-purple-500/10 text-purple-600",
  guide: "bg-amber-500/10 text-amber-600",
  music: "bg-pink-500/10 text-pink-600",
  interview: "bg-blue-500/10 text-blue-600",
  alert: "bg-red-500/10 text-red-600",
};

export const AudioCard = ({
  title,
  author,
  authorUsername,
  authorAvatar,
  authorVerified,
  distance,
  duration,
  likes,
  comments,
  category = "story",
  isPlaying = false,
  progress = 0,
  onPlay,
  onLike,
  onComment,
  isLiked = false,
  className,
  onClick,
  timestamp,
  isInteractable = true,
  showCategory = true,
  onDelete,
  onEdit,
  privacy = "public",
  ...props
}: AudioCardProps) => {
  const [timeAgo, setTimeAgo] = useState(() => 
    timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: es }) : ""
  );

  const getPrivacyIcon = () => {
      switch (privacy) {
          case "private": return <Lock className="w-3 h-3 text-red-500" />;
          case "hidden": return <EyeOff className="w-3 h-3 text-orange-500" />;
          default: return null;
      }
  };

  const handleInteraction = (action: () => void) => {
      if (isInteractable) {
          action();
      } else {
          toast({
              title: "Demasiado lejos",
              description: "Acércate a menos de 100m para interactuar con este eco.",
              variant: "destructive",
          });
      }
  };

  useEffect(() => {
    if (!timestamp) return;

    const updateTime = () => {
      setTimeAgo(formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: es }));
    };

    // Initial update in case of stale state or timestamp change
    updateTime();
    
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div 
      onClick={onClick}
      className={cn(
        "glass rounded-xl p-4 transition-all duration-500 ease-fluid",
        "border border-white/20 shadow-sm hover:shadow-md",
        "relative overflow-hidden group cursor-pointer",
        className
      )}
    >
      {/* Background decoration */}
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -z-10 opacity-20 transition-colors duration-500",
        categoryColors[category].split(" ")[0].replace("/10", "/30")
      )} />

      <div className="flex gap-4">
        {/* Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isInteractable) {
                onPlay?.();
            } else {
                handleInteraction(() => {});
            }
          }}
          className={cn(
            "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center",
            "transition-all duration-500 ease-fluid shadow-sm",
            isPlaying 
              ? "bg-primary text-primary-foreground shadow-glow scale-105" 
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            !isInteractable && "opacity-50 cursor-not-allowed"
          )}
        >
          {!isInteractable ? (
              <Lock className="w-5 h-5" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex gap-2 items-start min-w-0">
                <div className="min-w-0">
                    <h3 className="font-semibold text-lg leading-tight truncate pr-2">
                        {title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span className="font-medium text-primary truncate flex items-center gap-1">
                        {author}
                        {authorVerified && <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-500 text-white" />}
                        </span>
                        {authorUsername && <span className="text-xs opacity-70 truncate">{authorUsername}</span>}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {distance}
                        </span>
                        {getPrivacyIcon() && (
                            <>
                                <span>•</span>
                                {getPrivacyIcon()}
                            </>
                        )}
                        <span>•</span>
                        <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                            #{title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0).toString().slice(0, 4)}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 mr-2">
                {showCategory && (
                    <span className={cn(
                    "text-[10px] px-2 py-1 rounded-full font-medium uppercase tracking-wider",
                    categoryColors[category]
                    )}>
                    {categoryLabels[category]}
                    </span>
                )}
                {(onEdit || onDelete) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-transparent"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {onEdit && (
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit();
                                }}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {onDelete && (
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }} className="text-destructive focus:text-destructive">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Eliminar
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
          </div>

          {/* Waveform */}
          <div className="mb-2 h-8 flex items-center">
            <Waveform
              isPlaying={isPlaying}
              progress={progress}
              bars={24}
              size="sm"
              className="h-full"
              // @ts-ignore
              audioUrl={props.audioUrl} 
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{distance}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-1.5 text-xs hover:bg-transparent",
                  isLiked && "text-red-500 hover:text-red-600",
                  !isInteractable && "opacity-50"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleInteraction(() => onLike?.());
                }}
              >
                <Heart className={cn("w-3.5 h-3.5 mr-1", isLiked && "fill-current")} />
                {likes}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 px-1.5 text-xs text-muted-foreground hover:bg-transparent", !isInteractable && "opacity-50")}
                onClick={(e) => {
                  e.stopPropagation();
                  handleInteraction(() => onComment?.());
                }}
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1" />
                {comments}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
