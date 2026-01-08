import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, User, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const profileSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  username: z
    .string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(20, "El usuario no puede tener más de 20 caracteres")
    .regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guiones bajos"),
  description: z.string().max(160, "La descripción no puede tener más de 160 caracteres").optional(),
  dob: z.date({
    required_error: "La fecha de nacimiento es obligatoria",
  }).refine((date) => differenceInYears(new Date(), date) >= 13, {
    message: "Debes tener al menos 13 años para usar la aplicación",
  }),
  gender: z.enum(["male", "female", "non-binary", "other", "prefer-not-to-say"], {
    required_error: "Por favor selecciona una opción",
  }).optional(),
  country: z.string().min(2, "País requerido"),
  region: z.string().min(2, "Región/Comunidad requerida"),
  city: z.string().min(2, "Ciudad requerida"),
});

interface ProfileSetupScreenProps {
  onComplete: (username: string) => void;
  initialName?: string;
}

export const ProfileSetupScreen = ({ onComplete, initialName = "" }: ProfileSetupScreenProps) => {
  const [isChecking, setIsChecking] = useState(false);

  // Format initial name: remove spaces
  const cleanName = initialName.replace(/\s/g, "").replace(/@/g, "");
  const defaultUsername = cleanName ? cleanName : "";

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      username: defaultUsername,
      dob: undefined,
      gender: undefined,
      country: "",
      region: "",
      city: "",
    },
  });

  const checkUsernameUnique = async (username: string) => {
    try {
      // Check against 'profiles' table if it exists
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();
      
      if (error) {
          // If table doesn't exist (Postgres code 42P01), we can't enforce uniqueness server-side
          // without it. We'll proceed to allow the user to continue.
          if (error.code === '42P01') return true;
          console.error("Error checking username:", error);
          return true; // Fail open
      }
      return !data; // If data exists, username is taken
    } catch (e) {
      console.error("Exception checking username:", e);
      return true;
    }
  };

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    setIsChecking(true);
    try {
      const isUnique = await checkUsernameUnique(values.username);
      if (!isUnique) {
        form.setError("username", {
          type: "manual",
          message: "Este nombre de usuario ya está en uso",
        });
        setIsChecking(false);
        return;
      }

      // 1. Update Supabase Auth Metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
            username: values.username,
            full_name: values.name,
            description: values.description,
            dob: values.dob.toISOString(),
            country: values.country,
            region: values.region,
            city: values.city,
        }
      });

      if (updateError) throw updateError;

      // 2. Try to update 'profiles' table (best effort)
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              const { error: upsertError } = await supabase.from('profiles').upsert({
                  id: user.id,
                  username: values.username,
                  full_name: values.name,
                  description: values.description,
                  birth_date: values.dob.toISOString(),
                  country: values.country,
                  region: values.region,
                  city: values.city,
                  updated_at: new Date().toISOString(),
              });
              
              if (upsertError) {
                console.error("Profile upsert error details:", upsertError);
                throw upsertError;
              }
          }
      } catch (e: any) {
          // Check for unique constraint violation
          if (e.code === '23505') { 
              throw new Error("El nombre de usuario ya está en uso.");
          }
          // Ignore other errors (e.g. if table doesn't exist yet)
          console.error("Profile upsert error:", e);
      }

      onComplete(values.username);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el perfil",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto animate-in fade-in duration-300">
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-start py-6 px-4 sm:px-6 sm:py-10 pb-24">
        <div className="w-full max-w-[400px] space-y-8">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center shadow-sm">
            <User className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configura tu perfil</h1>
            <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
              Necesitamos algunos datos antes de empezar.
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Cuéntanos un poco sobre ti..." 
                      className="resize-none min-h-[100px] bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Se mostrará en tu perfil público.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Nombre completo</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Tu nombre" 
                      {...field} 
                      className="h-12 bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Nombre de usuario</FormLabel>
                  <FormControl>
                    <div className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">@</span>
                      <Input 
                        placeholder="usuario" 
                        {...field} 
                        onChange={(e) => {
                          let val = e.target.value;
                          // Normalize: lowercase, remove spaces, remove accents, remove @
                          val = val.toLowerCase().replace(/\s/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/@/g, "");
                          
                          field.onChange(val);
                        }}
                        className="pl-8 h-12 bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Mínimo 4 caracteres. Debe ser único.
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
                  <FormLabel className="text-white">Fecha de nacimiento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white",
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
                  <FormDescription className="text-white/60">
                    Tu fecha de nacimiento no será pública.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Género (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">País</FormLabel>
                    <FormControl>
                      <Input placeholder="España" {...field} className="bg-white/10 border-white/20 text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Comunidad/Región</FormLabel>
                    <FormControl>
                      <Input placeholder="Madrid" {...field} className="bg-white/10 border-white/20 text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Ciudad/Localidad</FormLabel>
                  <FormControl>
                    <Input placeholder="Madrid" {...field} className="bg-white/10 border-white/20 text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold"
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Continuar"
              )}
            </Button>
            <div className="h-8 w-full" /> 
          </form>
        </Form>
        </div>
      </div>
    </div>
  );
};
