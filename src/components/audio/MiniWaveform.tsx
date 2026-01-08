import { cn } from "@/lib/utils";

interface MiniWaveformProps {
  className?: string;
  color?: "primary" | "lime" | "white";
}

export const MiniWaveform = ({ className, color = "primary" }: MiniWaveformProps) => {
  const bars = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8];
  
  const colorClasses = {
    primary: "bg-primary",
    lime: "bg-accent",
    white: "bg-primary-foreground",
  };

  return (
    <div className={cn("flex items-center gap-[2px] h-4", className)}>
      {bars.map((height, i) => (
        <div
          key={i}
          className={cn("w-[2px] rounded-full", colorClasses[color])}
          style={{ height: `${height * 100}%` }}
        />
      ))}
    </div>
  );
};
