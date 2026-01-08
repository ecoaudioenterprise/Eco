import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { LegalModal } from "@/components/common/LegalDocs";
import { toast } from "@/hooks/use-toast";
import { Mail, Lock, ArrowRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { Capacitor } from "@capacitor/core";

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    const initGoogleAuth = async () => {
      if (Capacitor.getPlatform() === 'web') {
        await GoogleAuth.initialize({
          clientId: '110719598768-724clecd5u9e25o30ase5thouc1t5ptg.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: false,
        }); 
      } else {
        await GoogleAuth.initialize({
          clientId: '110719598768-724clecd5u9e25o30ase5thouc1t5ptg.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: false,
        });
      }
      console.log('Google Auth Initialized. Platform:', Capacitor.getPlatform());
    };
    initGoogleAuth();
  }, []);

  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (!email) {
       toast({
         title: "Email requerido",
         description: "Introduce tu email para reenviar la confirmación.",
         variant: "destructive"
       });
       return;
    }
    
    if (resendCooldown > 0) return;

    try {
       const { error } = await supabase.auth.resend({
         type: 'signup',
         email: email,
         options: {
           emailRedirectTo: 'soundmaps://login-callback'
         }
       });

       if (error) throw error;

       setResendCooldown(60);
       toast({
         title: "Correo enviado",
         description: "Se ha enviado un nuevo enlace de confirmación a tu correo.",
       });

    } catch (error: any) {
       toast({
         title: "Error",
         description: error.message || "No se pudo enviar el correo.",
         variant: "destructive"
       });
    }
  };

  const handleAnonymousLogin = async () => {
    if (!acceptedTerms) {
      toast({
        title: "Atención",
        description: "Debes aceptar los términos y condiciones para continuar.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      
      if (error) throw error;

      toast({
        title: "¡Bienvenido invitado!",
        description: "Has entrado en modo anónimo.",
      });
      onLogin();
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "No se pudo entrar como invitado. Asegúrate de habilitar 'Anonymous Sign-ins' en Supabase.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!acceptedTerms) {
      toast({
        title: "Atención",
        description: "Debes aceptar los términos y condiciones para continuar.",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await GoogleAuth.signIn();
      const { authentication } = response;
      const { idToken } = authentication;
      
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      
      if (error) throw error;
      
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión con Google correctamente.",
      });
      onLogin();
    } catch (error: any) {
      console.error("Google Login Error Object:", error);
      
      let errorMessage = error.message || "Algo salió mal";
      
      // Intentar extraer mensaje de error anidado
      if (error.error) {
        errorMessage = error.error.message || JSON.stringify(error.error);
      } else if (!error.message) {
        errorMessage = JSON.stringify(error);
      }

      // Detectar errores específicos
      if (JSON.stringify(error) === '{}' || JSON.stringify(error) === '{"error":{}}') {
        errorMessage = "Error de Conexión con Google. \n\nPOSIBLE CAUSA: Como acabas de configurar 'localhost:8080' en Google Cloud, los servidores de Google aún no han propagado el cambio (Error 500 en consola). \n\nSOLUCIÓN: Espera 30-60 minutos y vuelve a intentar. Si persiste, verifica bloqueadores de popups.";
      }

      if (errorMessage.includes("IdentityCredentialError") || JSON.stringify(error).includes("IdentityCredentialError")) {
        errorMessage = "Error 500 de Google (Propagación): Los servidores de Google aún no han validado tu cambio en 'localhost:8080'. Esto es normal y suele tardar de 30 min a 1 hora. Por favor, espera y reintenta más tarde.";
      }

      if (errorMessage.includes("NetworkError") || JSON.stringify(error).includes("NetworkError")) {
         errorMessage = "Error de Configuración o Red. \n\nVERIFICA EN GOOGLE CLOUD:\n1. Que 'Orígenes autorizados de JavaScript' incluya exactamente 'http://localhost:8080' (sin barra al final).\n2. Si estás en Incógnito, habilita cookies de terceros.\n3. Si acabas de editar la credencial, espera unos minutos.";
      }

      toast({
        title: "Error de Google",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast({
        title: "Atención",
        description: "Debes aceptar los términos y condiciones para continuar.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      if (isLogin) {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "¡Bienvenido de nuevo!",
          description: "Has iniciado sesión correctamente.",
        });
        onLogin();
      } else {
        // Sign Up
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'soundmaps://login-callback',
          },
        });

        if (error) throw error;

        toast({
          title: "¡Cuenta creada!",
          description: "Por favor, revisa tu email y confirma tu cuenta para poder acceder.",
          duration: 6000,
        });
        
        // Switch to login view so they can sign in after verifying
        setIsLogin(true);
        setPassword(""); 
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px]" />

      <div className="w-full max-w-[380px] z-10 animate-fade-in flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-2">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center shadow-glow transform rotate-3 mb-4">
            <span className="text-4xl">🎧</span>
          </div>
          <h1 className="text-3xl font-bold">SoundSpot</h1>
          <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
            {isLogin
              ? "Bienvenido de nuevo a tu mapa sonoro"
              : "Únete y descubre los ecos de tu ciudad"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="email"
                placeholder="Email"
                className="pl-10 h-12 bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all duration-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="password"
                placeholder="Contraseña"
                className="pl-10 h-12 bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all duration-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-start gap-3 py-2">
            <Checkbox 
              id="terms" 
              checked={acceptedTerms} 
              onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)} 
              className="mt-0.5"
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="terms"
                className="text-sm leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
              >
                He leído y acepto los{" "}
                <span 
                  className="text-primary hover:underline cursor-pointer font-medium" 
                  onClick={() => setShowTerms(true)}
                >
                  Términos y Condiciones
                </span>
                {" "}y la{" "}
                <span 
                  className="text-primary hover:underline cursor-pointer font-medium" 
                  onClick={() => setShowPrivacy(true)}
                >
                  Política de Privacidad
                </span>
              </label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-lg font-medium bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 text-muted-foreground font-medium">
                O continúa con
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 border-border hover:bg-muted/50 transition-colors"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
              <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            Google
          </Button>

          {isLogin && (
            <div className="text-center mt-6">
               <button
                 type="button"
                 onClick={handleResendEmail}
                 disabled={resendCooldown > 0}
                 className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 underline decoration-dotted underline-offset-4"
               >
                 {resendCooldown > 0 
                   ? `Reenviar correo de confirmación (${resendCooldown}s)` 
                   : "¿No recibiste el correo? Reenviar confirmación"}
               </button>
            </div>
          )}
        </form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-primary font-semibold hover:underline focus:outline-none"
            >
              {isLogin ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </div>
      
      <LegalModal type="privacy" open={showPrivacy} onOpenChange={setShowPrivacy} />
      <LegalModal type="terms" open={showTerms} onOpenChange={setShowTerms} />
    </div>
  );
};
