import { useState, useEffect } from "react";
import { ArrowLeft, LogOut, Moon, Bell, Shield, HelpCircle, ChevronRight, User, FileText, ShieldAlert, Map as MapIcon, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LegalModal } from "@/components/common/LegalDocs";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

import { PrivacySettingsView } from "./PrivacySettingsView";
import { AdminView } from "./AdminView";
import { SubscriptionModal } from "../subscription/SubscriptionModal";
import { Star } from "lucide-react";

interface SettingsViewProps {
  onBack: () => void;
  onEditProfile?: () => void;
  isAdmin?: boolean;
  onLogout: () => void;
}

export const SettingsView = ({ onBack, onEditProfile, isAdmin = false, onLogout }: SettingsViewProps) => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [isPro, setIsPro] = useState(() => {
    return localStorage.getItem("soundspot_is_pro") === "true";
  });
  
  // Persistent settings
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem("settings_notifications");
    if (saved !== null) return saved === "true";
    return true;
  });
  
  const [darkMode, setDarkMode] = useState(() => {
    // Check local storage or system preference
    const saved = localStorage.getItem("settings_dark_mode");
    if (saved !== null) return saved === "true";
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [mapType, setMapType] = useState<'standard' | 'satellite'>(() => {
    return (localStorage.getItem("settings_map_type") as 'standard' | 'satellite') || 'standard';
  });

  useEffect(() => {
    localStorage.setItem("settings_notifications", String(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("settings_map_type", mapType);
    window.dispatchEvent(new Event('mapSettingsChanged'));
  }, [mapType]);

  useEffect(() => {
    localStorage.setItem("settings_dark_mode", String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSupport = () => {
    window.location.href = "mailto:soporte@soundspot.app?subject=Ayuda y Soporte SoundSpot";
  };
  
  const handleLogoutClick = async () => {
      onLogout();
  };

  if (showPrivacySettings) {
    return <PrivacySettingsView onBack={() => setShowPrivacySettings(false)} />;
  }

  if (showAdmin) {
    return <AdminView onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-border">
        <div className="px-4 py-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold">Ajustes</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        
        {/* Subscription Section */}
        <section className="space-y-3">
          <div 
            className="bg-gradient-to-r from-primary/10 to-purple-600/10 rounded-2xl overflow-hidden border border-border/50 p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowSubscription(true)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/15 rounded-lg">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">{isPro ? "Eres PRO" : "Pásate a PRO"}</span>
                <span className="text-sm text-muted-foreground">{isPro ? "Gracias por apoyar" : "Desbloquea funciones premium"}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </section>
        
        {/* Admin Section */}
        {isAdmin && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Administración</h2>
            <div className="bg-muted/30 rounded-2xl overflow-hidden border border-border/50">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setShowAdmin(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                  </div>
                  <span className="font-medium text-red-500">Panel de Control</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </section>
        )}

        {/* Account Section */}
        <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Cuenta</h2>
            <div className="bg-muted/30 rounded-2xl overflow-hidden border border-border/50">
                <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={onEditProfile}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <User className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium">Editar Perfil</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="h-px bg-border/50" />
                 <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setShowPrivacySettings(true)}
                 >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Shield className="w-5 h-5 text-blue-500" />
                        </div>
                        <span className="font-medium">Privacidad</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="h-px bg-border/50" />
                 <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setShowPrivacy(true)}
                 >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-500/10 rounded-lg">
                            <FileText className="w-5 h-5 text-gray-500" />
                        </div>
                        <span className="font-medium">Política de Privacidad</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="h-px bg-border/50" />
                 <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setShowTerms(true)}
                 >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <FileText className="w-5 h-5 text-indigo-500" />
                        </div>
                        <span className="font-medium">Términos y Condiciones</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
            </div>
        </section>

        {/* Preferences Section */}
        <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Preferencias</h2>
            <div className="bg-muted/30 rounded-2xl overflow-hidden border border-border/50">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <Bell className="w-5 h-5 text-purple-500" />
                        </div>
                        <span className="font-medium">Notificaciones</span>
                    </div>
                    <Switch 
                        checked={notifications} 
                        onCheckedChange={setNotifications}
                    />
                </div>
                <div className="h-px bg-border/50" />
                 <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Moon className="w-5 h-5 text-amber-500" />
                        </div>
                        <span className="font-medium">Modo Oscuro</span>
                    </div>
                    <Switch 
                        checked={darkMode} 
                        onCheckedChange={setDarkMode}
                    />
                </div>
                <div className="h-px bg-border/50" />
                <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                        if (!isPro && mapType === 'standard') {
                            setShowSubscription(true);
                            return;
                        }
                        setMapType(prev => prev === 'standard' ? 'satellite' : 'standard');
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            {mapType === 'standard' ? <MapIcon className="w-5 h-5 text-blue-500" /> : <Globe className="w-5 h-5 text-blue-500" />}
                        </div>
                        <div className="flex flex-col">
                             <span className="font-medium">Tipo de Mapa</span>
                             <span className="text-xs text-muted-foreground">{mapType === 'standard' ? 'Estándar' : 'Satélite (PRO)'}</span>
                        </div>
                    </div>
                    <div 
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {!isPro && <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">PRO</span>}
                        <Switch 
                            checked={mapType === 'satellite'} 
                            onCheckedChange={(checked) => {
                                if (!isPro && checked) {
                                    setShowSubscription(true);
                                    return;
                                }
                                setMapType(checked ? 'satellite' : 'standard');
                            }}
                        />
                    </div>
                </div>
            </div>
        </section>

         {/* Support Section */}
         <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Ayuda</h2>
            <div className="bg-muted/30 rounded-2xl overflow-hidden border border-border/50">
                <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={handleSupport}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <HelpCircle className="w-5 h-5 text-emerald-500" />
                        </div>
                        <span className="font-medium">Ayuda y Soporte</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
            </div>
        </section>

        {/* Logout Button */}
        <div className="pt-4">
            <Button 
                variant="destructive" 
                className="w-full h-12 rounded-xl text-lg font-medium shadow-lg shadow-destructive/20"
                onClick={handleLogoutClick}
            >
                <LogOut className="w-5 h-5 mr-2" />
                Cerrar Sesión
            </Button>
             <p className="text-center text-xs text-muted-foreground mt-4">
                SoundMap v1.0.0
            </p>
        </div>

      </div>

      <LegalModal type="privacy" open={showPrivacy} onOpenChange={setShowPrivacy} />
      <LegalModal type="terms" open={showTerms} onOpenChange={setShowTerms} />
      <SubscriptionModal 
        open={showSubscription} 
        onOpenChange={setShowSubscription}
        onSuccess={() => setIsPro(true)}
      />
    </div>
  );
};
