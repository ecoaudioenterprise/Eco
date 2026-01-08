import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Globe, EyeOff, Lock } from "lucide-react";
import { AudioData } from "@/utils/audioStorage";

interface EditAudioSheetProps {
  isOpen: boolean;
  onClose: () => void;
  audio: AudioData | null;
  onUpdate: () => void;
}

export const EditAudioSheet = ({ isOpen, onClose, audio, onUpdate }: EditAudioSheetProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); // We might need to fetch this or add it to AudioData
  const [privacy, setPrivacy] = useState<"public" | "hidden" | "private">("public");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && audio) {
      setTitle(audio.title || "");
      setPrivacy((audio as any).privacy || "public");
      // Fetch description if needed, or assume it's not in AudioData yet
      fetchAudioDetails();
    }
  }, [isOpen, audio]);

  const fetchAudioDetails = async () => {
      if (!audio) return;
      const { data } = await supabase
          .from('audios')
          .select('description')
          .eq('id', audio.id)
          .single();
      if (data) {
          setDescription(data.description || "");
      }
  };

  const handleSave = async () => {
    if (!audio) return;
    if (!title.trim()) {
        toast({ title: "Error", description: "El título no puede estar vacío", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
        const { error } = await supabase
            .from('audios')
            .update({ 
                title: title.trim(),
                description: description.trim(),
                privacy: privacy
            })
            .eq('id', audio.id);

        if (error) throw error;

        toast({ title: "Eco actualizado", description: "Los cambios se han guardado correctamente." });
        onUpdate();
        onClose();
    } catch (error) {
        console.error("Error updating audio:", error);
        toast({ title: "Error", description: "No se pudo actualizar el eco.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] sm:h-auto rounded-t-3xl px-6 z-[100]">
        <SheetHeader className="mb-6">
          <SheetTitle>Editar Eco</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input 
                id="title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Dale un nombre a tu eco..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea 
                id="description" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Describe lo que se escucha..."
                className="resize-none h-24"
            />
          </div>

          <div className="space-y-2">
            <Label>Privacidad</Label>
            <Select value={privacy} onValueChange={(val: any) => setPrivacy(val)}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona la privacidad" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                    <SelectItem value="public">
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-primary" />
                            <div className="flex flex-col text-left">
                                <span>Público</span>
                                <span className="text-xs text-muted-foreground">Visible para todos, aparece en el mapa</span>
                            </div>
                        </div>
                    </SelectItem>
                    <SelectItem value="hidden">
                        <div className="flex items-center gap-2">
                            <EyeOff className="w-4 h-4 text-orange-500" />
                            <div className="flex flex-col text-left">
                                <span>Oculto</span>
                                <span className="text-xs text-muted-foreground">Solo accesible mediante enlace</span>
                            </div>
                        </div>
                    </SelectItem>
                    <SelectItem value="private">
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-red-500" />
                            <div className="flex flex-col text-left">
                                <span>Privado</span>
                                <span className="text-xs text-muted-foreground">Solo tú puedes verlo</span>
                            </div>
                        </div>
                    </SelectItem>
                </SelectContent>
            </Select>
          </div>

          <SheetFooter className="pt-4">
            <Button onClick={handleSave} disabled={loading} className="w-full rounded-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Guardar Cambios
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
};
