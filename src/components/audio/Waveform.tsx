import { cn } from "@/lib/utils";
import { useMemo, useEffect, useState } from "react";

interface WaveformProps {
  isPlaying?: boolean;
  isRecording?: boolean;
  progress?: number;
  bars?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  data?: number[];
  audioUrl?: string;
}

export const Waveform = ({
  isPlaying = false,
  isRecording = false,
  progress = 0,
  bars = 20,
  className,
  size = "md",
  data,
  audioUrl
}: WaveformProps) => {
  const [audioData, setAudioData] = useState<number[]>([]);
  
  // Analizar audio real si se proporciona URL
  useEffect(() => {
    if (audioUrl && !data) {
      const analyzeAudio = async () => {
        try {
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          const rawData = audioBuffer.getChannelData(0);
          const samples = bars;
          const blockSize = Math.floor(rawData.length / samples);
          const processedData = [];

          for (let i = 0; i < samples; i++) {
            let sum = 0;
            const start = i * blockSize;
            const end = start + blockSize;
            
            for (let j = start; j < end; j++) {
              sum += Math.abs(rawData[j]);
            }
            // Normalize and scale
            processedData.push(Math.min((sum / blockSize) * 5 + 0.1, 1));
          }
          setAudioData(processedData);
        } catch (e) {
          console.error("Error analyzing audio waveform", e);
        }
      };
      
      analyzeAudio();
    }
  }, [audioUrl, bars]);

  const randomHeights = useMemo(() => Array.from({ length: bars }, () => 
    Math.random() * 0.7 + 0.3
  ), [bars]);

  const heights = data || (audioData.length > 0 ? audioData : randomHeights);

  const sizeClasses = {
    sm: "h-6 gap-[2px]",
    md: "h-10 gap-1",
    lg: "h-16 gap-1",
  };

  const barWidths = {
    sm: "w-[2px]",
    md: "w-1",
    lg: "w-1.5",
  };

  return (
    <div className={cn("flex items-center justify-center", sizeClasses[size], className)}>
      {heights.map((height, i) => {
        const isActive = progress > 0 && (i / bars) * 100 <= progress;
        const delay = i * 0.05;

        return (
          <div
            key={i}
            className={cn(
              "waveform-bar",
              barWidths[size],
              isRecording && "animate-waveform",
              isActive || isRecording
                ? isRecording
                  ? "bg-destructive"
                  : "bg-primary"
                : "bg-primary/30"
            )}
            style={{
              height: `${height * 100}%`,
              animationDelay: isRecording ? `${delay}s` : undefined,
              transition: "background-color 0.15s ease",
            }}
          />
        );
      })}
    </div>
  );
};
