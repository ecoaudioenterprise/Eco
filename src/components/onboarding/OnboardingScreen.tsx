import { useState, useEffect } from "react";
import { MapPin, Mic, Globe, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MiniWaveform } from "@/components/audio/MiniWaveform";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

interface OnboardingScreenProps {
  onComplete: () => void;
}

const slides = [
  {
    icon: MapPin,
    emoji: "🗺️",
    title: "El mapa cobra vida",
    description: "Explora un mundo de sonidos ocultos a tu alrededor. Encuentra música, historias y mensajes dejados por otros en lugares reales.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Mic,
    emoji: "🎙️",
    title: "Deja tu huella sonora",
    description: "Graba tu voz, tu música o el ambiente. Ancla tus recuerdos en el mapa para que otros los descubran y revivan el momento.",
    color: "from-rose-500 to-pink-500",
  },
  {
    icon: Globe,
    emoji: "🌍",
    title: "Conecta con tu entorno",
    description: "Sigue a creadores, comparte momentos y redescubre tu ciudad a través del sonido. Únete a una comunidad que escucha el mundo.",
    color: "from-emerald-500 to-teal-500",
  },
];

export const OnboardingScreen = ({ onComplete }: OnboardingScreenProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!api) return;

    api.on("select", () => {
      setCurrentSlide(api.selectedScrollSnap());
    });
  }, [api]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      api?.scrollNext();
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const scrollTo = (index: number) => {
    api?.scrollTo(index);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Skip button */}
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          Saltar
        </button>
      </div>

      {/* Carousel Content */}
      <div className="flex-1 flex flex-col justify-center">
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {slides.map((slide, index) => (
              <CarouselItem key={index} className="flex flex-col items-center justify-center px-8 pb-10">
                {/* Animated icon */}
                <div
                  className={cn(
                    "w-32 h-32 rounded-3xl bg-gradient-to-br mb-8 flex items-center justify-center animate-float shadow-xl",
                    slide.color
                  )}
                >
                  <span className="text-6xl select-none">{slide.emoji}</span>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-foreground text-center mb-4">
                  {slide.title}
                </h1>

                {/* Description */}
                <p className="text-muted-foreground text-center text-lg max-w-xs leading-relaxed">
                  {slide.description}
                </p>

                {/* Waveform decoration */}
                <div className="mt-8 opacity-50">
                  <MiniWaveform color="primary" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Bottom section */}
      <div className="p-8 pb-12">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index === currentSlide
                  ? "w-8 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>

        {/* Next button */}
        <Button
          variant="hero"
          size="xl"
          className="w-full shadow-lg shadow-primary/20"
          onClick={handleNext}
        >
          {currentSlide === slides.length - 1 ? (
            "Empezar a explorar"
          ) : (
            <>
              Siguiente
              <ChevronRight className="w-5 h-5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
