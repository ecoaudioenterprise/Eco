import { useState, useEffect } from "react";
import { ArrowLeft, Eye, EyeOff, Users, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PrivacySettingsViewProps {
  onBack: () => void;
}

export const PrivacySettingsView = ({ onBack }: PrivacySettingsViewProps) => {
  const [loading, setLoading] = useState(true);
  const [profilePhotoPublic, setProfilePhotoPublic] = useState(true);
  const [showFollowers, setShowFollowers] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('privacy_settings')
        .eq('id', user.id)
        .single();

      if (error) {
          console.error("Error loading privacy settings:", error);
          return;
      }

      if (data?.privacy_settings) {
        const settings = typeof data.privacy_settings === 'string' 
            ? JSON.parse(data.privacy_settings) 
            : data.privacy_settings;
            
        if (settings.profile_photo_public !== undefined) setProfilePhotoPublic(settings.profile_photo_public);
        if (settings.show_followers !== undefined) setShowFollowers(settings.show_followers);
        if (settings.is_private !== undefined) setIsPrivate(settings.is_private);
      }
    } catch (error) {
      console.error("Error loading privacy settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePrivacySetting = async (key: string, value: boolean) => {
    try {
        // Optimistic update
        if (key === 'profile_photo_public') setProfilePhotoPublic(value);
        if (key === 'show_followers') setShowFollowers(value);
        if (key === 'is_private') setIsPrivate(value);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: current } = await supabase.from('profiles').select('privacy_settings').eq('id', user.id).single();
        const currentSettings = current?.privacy_settings 
            ? (typeof current.privacy_settings === 'string' ? JSON.parse(current.privacy_settings) : current.privacy_settings)
            : {};
        
        const newSettings = {
            ...currentSettings,
            [key]: value
        };

        const { error } = await supabase
            .from('profiles')
            .update({ privacy_settings: newSettings })
            .eq('id', user.id);

        if (error) throw error;
        
        toast({
            title: "Ajustes actualizados",
            description: "Tus preferencias de privacidad se han guardado.",
        });

    } catch (error) {
        console.error("Error updating privacy:", error);
        toast({
            title: "Error",
            description: "No se pudieron guardar los cambios.",
            variant: "destructive"
        });
        // Revert optimistic update
        if (key === 'profile_photo_public') setProfilePhotoPublic(!value);
        if (key === 'show_followers') setShowFollowers(!value);
        if (key === 'is_private') setIsPrivate(!value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-border">
        <div className="px-4 py-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold">Privacidad</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <div className="bg-muted/30 rounded-2xl overflow-hidden border border-border/50 p-4 space-y-6">
            
            {/* Profile Photo Privacy */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {profilePhotoPublic ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-medium">Foto de perfil pública</span>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                        Si se desactiva, solo tú podrás ver tu foto de perfil. Los demás verán un avatar por defecto.
                    </p>
                </div>
                <Switch 
                    checked={profilePhotoPublic}
                    onCheckedChange={(checked) => updatePrivacySetting('profile_photo_public', checked)}
                    disabled={loading}
                />
            </div>

            {/* Private Account */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {isPrivate ? <Lock className="w-4 h-4 text-primary" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-medium">Cuenta Privada</span>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                        Si se activa, los usuarios deberán solicitar seguirte.
                    </p>
                </div>
                <Switch 
                    checked={isPrivate}
                    onCheckedChange={(checked) => updatePrivacySetting('is_private', checked)}
                    disabled={loading}
                />
            </div>

            {/* Followers List Privacy */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {showFollowers ? <Users className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-medium">Lista de seguidores pública</span>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                        Si se desactiva, solo tú podrás ver quién te sigue.
                    </p>
                </div>
                <Switch 
                    checked={showFollowers}
                    onCheckedChange={(checked) => updatePrivacySetting('show_followers', checked)}
                    disabled={loading}
                />
            </div>
        </div>
        
        <div className="px-2 text-xs text-muted-foreground text-center">
            Más opciones de privacidad estarán disponibles próximamente.
        </div>
      </div>
    </div>
  );
};
