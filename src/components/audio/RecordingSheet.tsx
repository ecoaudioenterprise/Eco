import { useState, useEffect, useRef } from "react";
import { X, Mic, Square, Check, MapPin, Tag, Play, Pause, Wand2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Waveform } from "./Waveform";
import { Geolocation } from '@capacitor/geolocation';
import { useToast } from "@/hooks/use-toast";

// Audio Filter Definitions
type AudioFilterType = 'normal' | 'studio' | 'echo' | 'robot';

interface AudioFilter {
    id: AudioFilterType;
    label: string;
    description: string;
    isPro: boolean;
}

const AUDIO_FILTERS: AudioFilter[] = [
    { id: 'normal', label: 'Normal', description: 'Sonido original', isPro: false },
    { id: 'studio', label: 'Estudio', description: 'Voz profesional', isPro: true },
    { id: 'robot', label: 'Robot', description: 'Voz metálica divertida', isPro: true },
    { id: 'echo', label: 'Eco', description: 'Ambiente espacial', isPro: true },
];

interface RecordingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: { 
    title: string; 
    tags: string[]; 
    visibility: string; 
    audioUrl: string; 
    latitude: number; 
    longitude: number; 
    duration: string;
    blob?: Blob;
    color?: string;
  }) => void;
}

export const RecordingSheet = ({ isOpen, onClose, onSave }: RecordingSheetProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [title, setTitle] = useState("");
  // Tags selection removed as per user request
  const [selectedColor, setSelectedColor] = useState("#f97316"); // Default brand orange
  const [visibility, setVisibility] = useState("public");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [waveformPoints, setWaveformPoints] = useState<number[]>([]);
  
  // Filters
  const [selectedFilter, setSelectedFilter] = useState<AudioFilterType>('normal');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  const latestBlobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  
  const isPro = localStorage.getItem("soundspot_is_pro") === "true";
  
  // Audio visualization refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();
  const rawAudioDataRef = useRef<number[]>([]);

  // const tags = ["Ambiente", "Historia", "Guía", "Música", "Entrevista", "Otro"]; // Removed
  const visibilityOptions = [
    { id: "public", label: "Público", icon: "🌍" },
    { id: "hidden", label: "Oculto", icon: "🔒" },
    { id: "private", label: "Privado", icon: "👤" },
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    // Immediate UI feedback
    setIsRecording(true);
    setRecordingTime(0);
    setPlaybackProgress(0);

    try {
      let stream = streamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }
      
      // Setup Audio Context for visualization if missing
      if (!audioContextRef.current) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 256;
        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(analyser);
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      rawAudioDataRef.current = [];
      const analyser = analyserRef.current!;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const collectData = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Normalize to 0-1 range
        const normalized = Math.min(average / 128, 1);
        rawAudioDataRef.current.push(normalized);
        
        animationFrameRef.current = requestAnimationFrame(collectData);
      };

      collectData();

      // Check for supported mime types
      const mimeTypes = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg",
        ""
      ];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      mimeTypeRef.current = mimeType || "";
      
      console.log("Using mimeType:", mimeTypeRef.current);

      const isPro = localStorage.getItem("soundspot_is_pro") === "true";
      const options = mimeType ? { 
          mimeType,
          audioBitsPerSecond: isPro ? 256000 : 128000 // 256kbps for Pro, 128kbps for Free
      } : undefined;
      
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const type = mimeTypeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        latestBlobRef.current = blob;
        console.log("Recording stopped. Blob size:", blob.size, "Type:", type);
        
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        } else {
          console.error("Recording failed: Empty blob");
        }
        
        // Do NOT stop tracks here to allow instant re-recording
      };

      // Start recording with 100ms timeslice to ensure data is collected periodically
      mediaRecorder.start(100);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      // Revert state on error
      setIsRecording(false);
      toast({
        title: "Error",
        description: "No se pudo acceder al micrófono.",
        variant: "destructive"
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setHasRecording(true);

      // Stop visualization capture
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Process waveform data
      const rawData = rawAudioDataRef.current;
      const samples = 40; // Target bars
      const blockSize = Math.floor(rawData.length / samples);
      const processedData = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        const start = i * blockSize;
        const end = start + blockSize;
        
        if (blockSize === 0) {
            processedData.push(0.15); // Default min height
            continue;
        }
        
        for (let j = start; j < end; j++) {
          sum += rawData[j];
        }
        // Add minimum height (0.15) and scale
        processedData.push(Math.min((sum / blockSize) + 0.15, 1));
      }
      setWaveformPoints(processedData);
      
      // Cleanup AudioContext
      audioContextRef.current?.close();
    }
  };

  useEffect(() => {
    // Reset audio player when audioUrl changes (e.g. applying filters)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setPlaybackProgress(0);
    }
  }, [audioUrl]);

  const handlePlayRecording = () => {
    if (!audioRef.current && audioUrl) {
      audioRef.current = new Audio(audioUrl);
      
      // Update progress
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setPlaybackProgress(progress || 0);
        }
      });
      
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setPlaybackProgress(100);
      });
      
      audioRef.current.addEventListener('error', (e) => {
        console.error("Audio playback error:", e);
        setIsPlaying(false);
      });
    }

    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(e => console.error("Playback failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  const applyAudioFilter = async (blob: Blob, filterType: AudioFilterType): Promise<Blob> => {
    if (filterType === 'normal') return blob;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Add tail for time-based effects
    let extraSamples = 0;
    if (filterType === 'echo') {
        extraSamples = audioBuffer.sampleRate * 1.0; // 1 second tail
    }

    const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length + extraSamples,
        audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    let currentNode: AudioNode = source;

    // Apply effects based on filter
    if (filterType === 'studio') {
        // Highpass Filter (Remove rumble)
        const highpass = offlineContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 80;
        
        // Compressor (More aggressive for broadcast sound)
        const compressor = offlineContext.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 10;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.15;
        
        // Presence Boost
        const presence = offlineContext.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 4000;
        presence.Q.value = 1;
        presence.gain.value = 3;

        currentNode.connect(highpass);
        highpass.connect(compressor);
        compressor.connect(presence);
        currentNode = presence;
    } else if (filterType === 'robot') {
         // Ring Modulator Effect
         const oscillator = offlineContext.createOscillator();
         oscillator.type = 'sine';
         oscillator.frequency.value = 50; // 50Hz robotic buzz
         
         const ringMod = offlineContext.createGain();
         ringMod.gain.value = 0; 
         
         // Modulate gain with oscillator
         oscillator.connect(ringMod.gain);
         oscillator.start();
         
         // Connect signal to ring mod
         currentNode.connect(ringMod);
         currentNode = ringMod;
         
         // Add compression to even out levels
         const compressor = offlineContext.createDynamicsCompressor();
         currentNode.connect(compressor);
         currentNode = compressor;
    } else if (filterType === 'echo') {
         const delay = offlineContext.createDelay();
         delay.delayTime.value = 0.2;
         
         const feedback = offlineContext.createGain();
         feedback.gain.value = 0.3;
         
         const dryGain = offlineContext.createGain();
         const wetGain = offlineContext.createGain();
         wetGain.gain.value = 0.4;

         currentNode.connect(dryGain);
         
         // Delay Loop
         currentNode.connect(delay);
         delay.connect(feedback);
         feedback.connect(delay);
         delay.connect(wetGain);
         
         // Merge
         const merger = offlineContext.createChannelMerger(1); // Simplified merge
         dryGain.connect(offlineContext.destination);
         wetGain.connect(offlineContext.destination);
         // Note: For offline context we usually connect to destination.
         // Since we split paths, we need to reconnect them.
         // Actually, let's simplify:
         // Source -> Delay -> Gain -> Destination
         // Source -> Destination
         
         // Re-implementing simplified graph for offline context
         currentNode.connect(offlineContext.destination); // Dry signal
         
         const echoDelay = offlineContext.createDelay();
         echoDelay.delayTime.value = 0.25;
         const echoGain = offlineContext.createGain();
         echoGain.gain.value = 0.4;
         
         currentNode.connect(echoDelay);
         echoDelay.connect(echoGain);
         echoGain.connect(offlineContext.destination);
         
         // Stop main flow here as we connected manually
         currentNode = null as any; 
    }

    if (currentNode) {
        currentNode.connect(offlineContext.destination);
    }

    source.start();
    const renderedBuffer = await offlineContext.startRendering();

    // Convert AudioBuffer to WAV Blob
    return bufferToWave(renderedBuffer, renderedBuffer.length);
  };

  // Helper to convert AudioBuffer to WAV
  const bufferToWave = (abuffer: AudioBuffer, len: number) => {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;
  
    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"
  
    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this example)
  
    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length
  
    // write interleaved data
    for(i = 0; i < abuffer.numberOfChannels; i++)
      channels.push(abuffer.getChannelData(i));
  
    while(pos < len) {
      for(i = 0; i < numOfChan; i++) {             // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
        view.setInt16(44 + offset, sample, true);          // write 16-bit sample
        offset += 2;
      }
      pos++;
    }
  
    return new Blob([buffer], {type: "audio/wav"});
  
    function setUint16(data: any) {
      view.setUint16(pos, data, true);
      pos += 2;
    }
  
    function setUint32(data: any) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  };

  const handleSave = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      setIsProcessing(true);
      
      // Check permissions first
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
             throw new Error("Permiso de ubicación denegado");
          }
      }

      const coordinates = await Geolocation.getCurrentPosition({ 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
      });

      // Apply Filter if needed
      let finalBlob = latestBlobRef.current;
      if (finalBlob && selectedFilter !== 'normal') {
          try {
             finalBlob = await applyAudioFilter(finalBlob, selectedFilter);
             console.log("Filter applied:", selectedFilter, "New size:", finalBlob.size);
          } catch (e) {
             console.error("Error applying filter:", e);
             toast({ title: "Error al aplicar filtro", description: "Se guardará el audio original.", variant: "destructive" });
          }
      }
      
      onSave?.({ 
        title, 
        tags: [], 
        visibility,
        audioUrl: audioUrl || "",
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
        duration: formatTime(recordingTime),
        blob: finalBlob || undefined,
        color: selectedColor
      });

      // Do not revoke the URL when saving, so it can be played in the list/map
      handleReset(false);
      onClose();

    } catch (error) {
      console.error("Error getting location:", error);
      toast({
        title: "Error de ubicación",
        description: "No se pudo obtener tu ubicación actual. Asegúrate de tener el GPS activado.",
        variant: "destructive",
      });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleFilterSelect = (filterId: AudioFilterType, isPro: boolean) => {
    const userIsPro = localStorage.getItem("soundspot_is_pro") === "true";
    
    if (isPro && !userIsPro) {
        toast({
            title: "Función Premium 💎",
            description: "Actualiza a PRO para usar filtros de audio avanzados.",
            variant: "destructive"
        });
        return;
    }
    
    setSelectedFilter(filterId);
    // Optional: Preview filter immediately? 
    // Complexity: Requires reprocessing audio on every click. 
    // Better: Just set state, apply on save. 
    // Or: Reprocess audioUrl for preview.
    // Let's implement preview if possible.
    if (latestBlobRef.current) {
        setIsProcessing(true);
        applyAudioFilter(latestBlobRef.current, filterId).then(newBlob => {
            const newUrl = URL.createObjectURL(newBlob);
            setAudioUrl(newUrl); // Update preview
            // Note: We don't update latestBlobRef here, only when saving. 
            // Actually, we should only update preview. But wait, handleSave uses latestBlobRef.
            // If we want the filter to be applied, we should rely on selectedFilter state in handleSave.
            // But for previewing, we need to hear it.
            // So: update audioUrl, but keep latestBlobRef as original.
            setIsProcessing(false);
        });
    }
  };

  const handleReset = (shouldRevoke = true) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Stop recording if active
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    // Stop visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    // Audio context cleanup is now handled by cleanupAudio/useEffect
    
    setIsRecording(false);
    setIsPlaying(false);
    setRecordingTime(0);
    setPlaybackProgress(0);
    setHasRecording(false);
    setTitle("");
    // setSelectedTags([]); // Removed
    setVisibility("public");
    setWaveformPoints([]);
    
    // Revoke object URL to avoid memory leaks
    if (shouldRevoke && audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
  };

  // toggleTag removed

  const initializeAudio = async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);
      
      rawAudioDataRef.current = [];
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const cleanupAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    sourceRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      initializeAudio();
    } else {
      cleanupAudio();
      // Only reset UI state if closing. handleReset is safe to call multiple times.
      handleReset(false); 
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10003]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 glass rounded-t-3xl animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Handle */}
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-6" />

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-foreground">Grabar Eco</h2>
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Recording area */}
          <div className="flex flex-col items-center mb-8">
            {/* Waveform */}
            <div className="w-full mb-6">
              <Waveform
                isRecording={isRecording}
                isPlaying={isPlaying}
                progress={hasRecording ? playbackProgress : 0}
                bars={40}
                size="lg"
                data={waveformPoints.length > 0 ? waveformPoints : undefined}
              />
            </div>

            {/* Timer */}
            <p
              className={cn(
                "text-4xl font-bold mb-6 tabular-nums",
                isRecording ? "text-destructive" : "text-foreground"
              )}
            >
              {formatTime(recordingTime)}
            </p>

            {/* Record button */}
            {!hasRecording ? (
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200",
                  isRecording
                    ? "bg-destructive/10 border-4 border-destructive"
                    : "gradient-recording shadow-lg"
                )}
              >
                {isRecording ? (
                  <Square className="w-10 h-10 text-destructive fill-destructive" />
                ) : (
                  <>
                    <div className="absolute w-24 h-24 rounded-full gradient-recording opacity-50 animate-pulse-ring" />
                    <Mic className="w-10 h-10 text-primary-foreground" />
                  </>
                )}
              </button>
            ) : (
              <div className="flex gap-4 items-center">
                <button
                  onClick={handlePlayRecording}
                  className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-primary-foreground fill-current" />
                  ) : (
                    <Play className="w-8 h-8 text-primary-foreground fill-current ml-1" />
                  )}
                </button>
                <Button variant="outline" size="lg" onClick={() => handleReset()}>
                  Volver a grabar
                </Button>
              </div>
            )}
          </div>

          {/* Form fields (only show after recording) */}
          {hasRecording && (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Título
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dale un nombre a tu audio..."
                  className="w-full px-4 py-3 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {/* Tags section removed */}

              {/* Audio Filters (PRO) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Wand2 className="w-4 h-4 text-purple-500" />
                    Filtros de Audio
                    {!isPro && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">PRO</span>}
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {AUDIO_FILTERS.filter(f => !f.isPro || isPro).map((filter) => (
                        <button
                            key={filter.id}
                            onClick={() => handleFilterSelect(filter.id, filter.isPro)}
                            className={cn(
                                "relative p-3 rounded-xl border text-left transition-all",
                                selectedFilter === filter.id 
                                    ? "border-primary bg-primary/5 ring-1 ring-primary" 
                                    : "border-border hover:border-primary/50 hover:bg-muted/50",
                                (filter.isPro && !isPro) && "opacity-70 grayscale"
                            )}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{filter.label}</span>
                                {filter.isPro && !isPro && <Lock className="w-3 h-3 text-muted-foreground" />}
                            </div>
                            <p className="text-xs text-muted-foreground">{filter.description}</p>
                        </button>
                    ))}
                </div>
              </div>
              
              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Color del Eco
                </label>
                <div className="flex flex-wrap gap-3">
                  {[
                    "#f97316", // Orange
                    "#3b82f6", // Blue
                    "#10b981", // Emerald
                    "#8b5cf6", // Violet
                    "#ef4444", // Red
                    "#ec4899", // Pink
                    "#06b6d4", // Cyan
                    "#eab308", // Yellow
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all hover:scale-110",
                        selectedColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:ring-2 hover:ring-offset-1 hover:ring-muted"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  
                  {/* Custom Color Input */}
                  <div className="relative">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer z-10"
                    />
                    <div className={cn(
                        "w-8 h-8 rounded-full bg-gradient-to-br from-white to-black border border-border flex items-center justify-center transition-all hover:scale-110",
                         ![
                            "#f97316", "#3b82f6", "#10b981", "#8b5cf6", 
                            "#ef4444", "#ec4899", "#06b6d4", "#eab308"
                         ].includes(selectedColor) ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                    )}>
                        {![
                            "#f97316", "#3b82f6", "#10b981", "#8b5cf6", 
                            "#ef4444", "#ec4899", "#06b6d4", "#eab308"
                        ].includes(selectedColor) ? (
                            <div className="w-full h-full rounded-full" style={{ backgroundColor: selectedColor }} />
                        ) : (
                            <span className="text-xs font-bold text-gray-500">+</span>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <MapPin className="w-4 h-4" />
                  Visibilidad
                </label>
                <div className="flex gap-2">
                  {visibilityOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setVisibility(option.id)}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2",
                        visibility === option.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <Button
                variant="lime"
                size="xl"
                className="w-full"
                onClick={handleSave}
                disabled={!title.trim() || isProcessing}
              >
                {isProcessing ? (
                  "Procesando..."
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Publicar Eco
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
