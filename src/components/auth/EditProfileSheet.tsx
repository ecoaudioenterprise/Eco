import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, X, AlertCircle, Camera, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ImageCropper } from "@/components/common/ImageCropper";

const editProfileSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  username: z.string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guiones bajos"),
  description: z.string().max(160, "La descripción no puede tener más de 160 caracteres").optional(),
  dob: z.date({
    required_error: "La fecha de nacimiento es obligatoria",
  }).refine((date) => differenceInYears(new Date(), date) >= 13, {
    message: "Debes tener al menos 13 años para usar la aplicación",
  }).optional(),
  gender: z.enum(["male", "female", "non-binary", "other", "prefer-not-to-say"]).optional(),
});

interface EditProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentUsername: string;
  currentDescription: string;
  currentAvatarUrl?: string | null;
  currentDob?: string | null;
  currentGender?: string | null;
  usernameLastChanged?: string | null;
  onUpdate: () => void;
}

export const EditProfileSheet = ({ 
  isOpen, 
  onClose, 
  currentName, 
  currentUsername,
  currentDescription,
  currentAvatarUrl,
  currentDob,
  currentGender,
  usernameLastChanged,
  onUpdate 
}: EditProfileSheetProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);

  // Calculate cooldown
  const lastChangedDate = usernameLastChanged ? new Date(usernameLastChanged) : null;
  // FOR DEVELOPMENT: Reduced to 1 minute to allow testing. Uncomment line below for production (30 days)
  // const nextChangeDate = lastChangedDate ? new Date(lastChangedDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const nextChangeDate = lastChangedDate ? new Date(lastChangedDate.getTime() + 60 * 1000) : null;
  const now = new Date();
  const canEditUsername = !nextChangeDate || now >= nextChangeDate;
  
  const daysRemaining = nextChangeDate && !canEditUsername 
    ? Math.ceil((nextChangeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) 
    : 0;

  const form = useForm<z.infer<typeof editProfileSchema>>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: currentName,
      username: currentUsername,
      description: currentDescription,
    },
  });

  const handleCropComplete = (blob: Blob) => {
    if (blob.size === 0) {
      toast({
        title: "Error",
        description: "Error al recortar la imagen. Inténtalo de nuevo.",
        variant: "destructive",
      });
      return;
    }
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(blob));
    setShowCropper(false);
    setTempImageSrc(null);
  };

  const onSubmit = async (values: z.infer<typeof editProfileSchema>) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión para editar tu perfil.");

      // Normalize username to lowercase
      const normalizedUsername = values.username.toLowerCase();
      
      // Check if username changed and if it's allowed
      const usernameChanged = normalizedUsername !== currentUsername;
      
      if (usernameChanged && !canEditUsername) {
        toast({
          title: "Acción no permitida",
          description: `Debes esperar un poco más para cambiar tu nombre de usuario.`,
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      // 1. Upload avatar if changed
      let avatarUrl = null;
      if (avatarFile) {
        try {
          const fileExt = "jpg";
          // Use user ID for safer filename and RLS compliance
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarFile, {
              upsert: true,
              contentType: 'image/jpeg'
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            if (uploadError.message.includes('row-level security')) {
              throw new Error('Error de permisos en Storage (RLS). Revisa las políticas del bucket "avatars".');
            }
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
            
          avatarUrl = publicUrl;
        } catch (e: any) {
          throw new Error(`Error al subir imagen: ${e.message}`);
        }
      }

      // 2. Prepare updates
      const profileUpdates: any = {
          full_name: values.name,
          description: values.description,
          updated_at: new Date().toISOString(),
      };
      
      const metadataUpdates: any = {
          full_name: values.name,
          description: values.description,
      };

      if (avatarUrl) {
          profileUpdates.avatar_url = avatarUrl;
          metadataUpdates.avatar_url = avatarUrl;
          metadataUpdates.picture = avatarUrl; // Standard claim
      }

      if (usernameChanged) {
        // Pre-check: Verify if username is already taken
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', normalizedUsername)
          .maybeSingle();

        if (existingUser) {
          throw new Error("El nombre de usuario ya está en uso por otra persona.");
        }

        const newTimestamp = new Date().toISOString();
        profileUpdates.username = normalizedUsername;
        profileUpdates.username_last_changed = newTimestamp;
        
        metadataUpdates.username = normalizedUsername;
        metadataUpdates.username_last_changed = newTimestamp;
      }

      // 2. Update Supabase Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: metadataUpdates
      });

      if (authError) throw authError;

      // 3. Update 'profiles' table
      try {
        // user is already fetched at top of function
        if (user) {
          const { error, count } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              ...profileUpdates,
              username: profileUpdates.username || currentUsername || user.email?.split('@')[0],
            }, { onConflict: 'id' })
            .select();
            
          if (error) {
            console.error('Profile error:', error);
            // Check for unique constraint violation
            if (error.code === '23505') { // Postgres unique violation code
              throw new Error("El nombre de usuario ya está en uso.");
            }
            if (error.message.includes('row-level security')) {
              throw new Error('Error de permisos en Perfil (RLS). Revisa las políticas de la tabla "profiles".');
            }
            throw error;
          }
        }
      } catch (e: any) {
        if (e.message === "El nombre de usuario ya está en uso.") throw e;
        throw new Error(`Error al actualizar perfil: ${e.message}`);
      }

      toast({
        title: "Perfil actualizado",
        description: "Los cambios se han guardado correctamente.",
      });
      
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar los cambios.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-background border sm:border rounded-3xl sm:rounded-xl shadow-2xl p-6 h-auto max-h-[80vh] sm:h-auto overflow-y-auto animate-in slide-in-from-bottom duration-300 mb-24 sm:mb-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Editar Perfil</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-border">
                   {avatarPreview || currentAvatarUrl ? (
                      <img src={avatarPreview || currentAvatarUrl || ""} alt="Avatar preview" className="w-full h-full object-cover" />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-2xl">
                         {currentName.charAt(0).toUpperCase()}
                      </div>
                   )}
                </div>
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
                >
                  <Camera className="w-8 h-8 text-white" />
                </label>
                <input 
                  id="avatar-upload"
                  type="file" 
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.addEventListener("load", () => {
                        setTempImageSrc(reader.result?.toString() || "");
                        setShowCropper(true);
                      });
                      reader.readAsDataURL(file);
                      e.target.value = ""; // Reset input
                    }
                  }}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de usuario</FormLabel>
                  <FormControl>
                    <Input 
                        placeholder="usuario123" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                        disabled={!canEditUsername}
                    />
                  </FormControl>
                  <FormDescription>
                    {canEditUsername 
                        ? "Este es tu identificador único. Podrás cambiarlo nuevamente en 30 días."
                        : `Podrás cambiar tu nombre de usuario en ${daysRemaining} días.`
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!canEditUsername && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-semibold">Cambio restringido</AlertTitle>
                    <AlertDescription className="text-xs">
                        Has cambiado tu nombre de usuario recientemente. Por seguridad, solo se permite un cambio cada 30 días.
                    </AlertDescription>
                </Alert>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Cuéntanos sobre ti..." 
                      className="resize-none min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Breve descripción que aparecerá en tu perfil.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dob"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de nacimiento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Selecciona una fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={1900}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Género</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tu género" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Femenino</SelectItem>
                      <SelectItem value="non-binary">No binario</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefiero no decirlo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-12 text-lg" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </form>
        </Form>
      </div>

      <ImageCropper
        imageSrc={tempImageSrc}
        open={showCropper}
        onClose={() => {
          setShowCropper(false);
          setTempImageSrc(null);
        }}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};
