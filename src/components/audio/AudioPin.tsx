import { cn } from "@/lib/utils";
import { Disc3, Radio, Waves, Zap } from "lucide-react";

interface AudioPinProps {
  title: string;
  distance: string;
  category?: "ambient" | "story" | "guide" | "music" | "interview" | "alert";
  color?: string;
  isPlaying?: boolean;
  showTooltip?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}

export const AudioPin = ({
  title,
  distance,
  category = "story",
  color,
  isPlaying = false,
  showTooltip = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
}: AudioPinProps) => {
  // Determine icon based on category
  const getIcon = () => {
    switch (category) {
      case "music": return <Disc3 className="w-4 h-4 text-white animate-spin-slow" />;
      case "alert": return <Zap className="w-4 h-4 text-white fill-white" />;
      case "guide": return <Radio className="w-4 h-4 text-white" />;
      default: return <Waves className="w-5 h-5 text-white" />;
    }
  };

  const mainColor = color || "#f97316";

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "group relative flex items-center justify-center",
        "transition-all duration-500 ease-out hover:scale-110 hover:-translate-y-2",
        "z-10", // Base z-index
        (showTooltip || isPlaying) && "z-[100]", // Bring to front when active
        className
      )}
    >
      {/* 1. Ambient Glow / Pulse (Behind) */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full opacity-40 blur-md transition-all duration-500",
          (isPlaying || showTooltip) ? "animate-pulse scale-150 opacity-60" : "group-hover:scale-125 group-hover:opacity-60"
        )}
        style={{ backgroundColor: mainColor }}
      />
      
      {/* 2. Expanding Ring (Sonar Effect) */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full border-2 opacity-0",
          "transition-all duration-1000",
          (isPlaying || showTooltip) && "animate-ping opacity-50"
        )}
        style={{ borderColor: mainColor }}
      />

      {/* 3. Main Orb Container */}
      <div
        className={cn(
          "relative w-9 h-9 rounded-full", // Smaller size
          "flex items-center justify-center",
          "shadow-[0_4px_15px_rgba(0,0,0,0.3)]",
          "border-2 border-white", // Thinner border
          "transition-all duration-300",
          "overflow-hidden",
          isPlaying && "ring-4 ring-white/30 scale-105"
        )}
        style={{ 
          background: `linear-gradient(135deg, ${mainColor}, ${adjustColor(mainColor, -20)})`,
        }}
      >
        {/* Shine Effect */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent opacity-80" />
        
        {/* Icon */}
        <div className={cn(
          "relative z-10 drop-shadow-md transition-transform duration-300",
          (isPlaying || showTooltip) ? "scale-110" : "group-hover:scale-110"
        )}>
          {getIcon()}
        </div>

        {/* Bottom Shadow inside orb */}
        <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* 4. Anchor Point (The little triangle pointing down) */}
      <div 
        className={cn(
            "absolute -bottom-1 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px]",
            "drop-shadow-sm transition-all duration-300",
            (isPlaying || showTooltip) ? "translate-y-0.5" : "group-hover:translate-y-0.5"
        )}
        style={{ borderTopColor: mainColor }} // Match orb color
      />

      {/* Modern Tooltip - Floating above */}
      <div
        className={cn(
          "absolute -top-14 left-1/2 -translate-x-1/2",
          "bg-gray-900/90 backdrop-blur-xl text-white px-3 py-1.5 rounded-2xl",
          "border border-white/20 shadow-2xl",
          "opacity-0 transition-all duration-300 transform translate-y-4 scale-90",
          (showTooltip || isPlaying) ? "opacity-100 translate-y-0 scale-100" : "group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100",
          "whitespace-nowrap flex flex-col items-center gap-0.5",
          "pointer-events-none z-[200]" // Very high z-index
        )}
      >
        <span className="text-xs font-bold tracking-wide">{title}</span>
        <div className="flex items-center gap-1">
             <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: mainColor }} />
             <span className="text-[10px] font-medium opacity-80">{distance}</span>
        </div>
      </div>
    </button>
  );
};

// Helper to darken/lighten color (simple version)
function adjustColor(color: string, amount: number) {
    return color; // For now return same, as hex manipulation is complex without lib. 
    // The CSS gradient will handle the depth with opacity overlays.
}
