import { useState, useEffect } from "react";
import { X, Check, Star, Zap, Map, Shield } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Purchases, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const SubscriptionModal = ({ open, onOpenChange, onSuccess }: SubscriptionModalProps) => {
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<any>(null);

  useEffect(() => {
    const initRevenueCat = async () => {
      if (!Capacitor.isNativePlatform()) return;
      
      try {
        const apiKey = Capacitor.getPlatform() === 'ios' 
            ? import.meta.env.VITE_REVENUECAT_API_KEY_IOS 
            : import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID;
            
        if (apiKey && !apiKey.includes("PLACEHOLDER")) {
            await Purchases.configure({ apiKey });
            const offerings = await Purchases.getOfferings();
            setOfferings(offerings.current);
        }
      } catch (error) {
        console.error("Error initializing RevenueCat:", error);
      }
    };
    
    if (open) {
        initRevenueCat();
    }
  }, [open]);

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    try {
      setLoading(true);
      
      if (!Capacitor.isNativePlatform()) {
          // Web simulation
          setTimeout(async () => {
              localStorage.setItem("soundspot_is_pro", "true");
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.id) {
                  await supabase.from('profiles').update({ is_pro: true }).eq('id', session.user.id);
                }
              } catch { }
              
              setLoading(false);
              onOpenChange(false);
              toast({
                title: "Modo Simulación (Web)",
                description: "Suscripción activada en entorno web.",
              });
              if (onSuccess) onSuccess();
          }, 1500);
          return;
      }

      const apiKey = Capacitor.getPlatform() === 'ios' 
            ? import.meta.env.VITE_REVENUECAT_API_KEY_IOS 
            : import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID;

      if (!apiKey || apiKey.includes("PLACEHOLDER")) {
          throw new Error("Configuración de pagos no encontrada (API Key).");
      }

      let pkg: PurchasesPackage | undefined;
      
      if (offerings) {
          if (plan === 'monthly') {
              pkg = offerings.monthly;
          } else {
              pkg = offerings.annual;
          }
      }

      if (!pkg) {
          throw new Error("No se encontró el paquete de suscripción.");
      }

      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      
      if (customerInfo.entitlements.active['pro'] || customerInfo.entitlements.active['premium']) {
          localStorage.setItem("soundspot_is_pro", "true");
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
              await supabase.from('profiles').update({ is_pro: true }).eq('id', session.user.id);
            }
          } catch { }
          
          onOpenChange(false);
          toast({
            title: "¡Bienvenido a Eco PRO!",
          description: "Suscripción activada correctamente.",
            duration: 5000,
          });
          if (onSuccess) onSuccess();
      } else {
        // User cancelled or failed
      }
    } catch (e: any) {
      if (e.userCancelled) return;
      
      toast({
        title: "Error de pago",
        description: e?.message || "No se pudo procesar el pago.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Map, text: "Mapas Offline ilimitados" },
    { icon: Zap, text: "Subidas de audio de alta calidad" },
    { icon: Shield, text: "Insignia PRO verificada" },
    { icon: Star, text: "Apoya el desarrollo de la app" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-b from-background to-muted/20 border-border z-[2000]">
        <div className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4 cursor-pointer" onClick={() => onOpenChange(false)} />
        </div>
        
        <DialogHeader className="pt-6 text-center">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <Star className="w-8 h-8 text-primary fill-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
            Eco PRO
          </DialogTitle>
          <p className="text-muted-foreground mt-2">
            Lleva tu experiencia sonora al siguiente nivel.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {features.map((feature, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="bg-primary/10 p-2 rounded-full">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="font-medium text-sm">{feature.text}</span>
              <Check className="w-4 h-4 text-green-500 ml-auto" />
            </div>
          ))}
        </div>

        <div className="grid gap-3 pt-4">
          <Button 
            size="lg" 
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20"
            onClick={() => handlePurchase('monthly')}
            disabled={loading}
          >
            {loading ? "Procesando..." : "Suscribirse - 2.99€ / mes"}
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="w-full border-primary/20 hover:bg-primary/5"
            onClick={() => handlePurchase('yearly')}
            disabled={loading}
          >
            {loading ? "Procesando..." : "Anual - 29.99€ / año (Ahorra 20%)"}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Cancelación gratuita en cualquier momento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
