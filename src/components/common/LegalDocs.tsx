import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export const PrivacyPolicyContent = () => (
  <div className="space-y-4 text-sm text-muted-foreground">
    <p>
      <strong>Última actualización: {new Date().toLocaleDateString()}</strong>
    </p>
    <p>
      En SoundSpot, valoramos y respetamos su privacidad. Esta Política de Privacidad describe cómo recopilamos, utilizamos y protegemos su información personal.
    </p>
    
    <h3 className="text-foreground font-semibold">1. Información que recopilamos</h3>
    <p>
      Recopilamos información que usted nos proporciona directamente, como su nombre, dirección de correo electrónico, fecha de nacimiento, género, <strong>ubicación (país, región y ciudad)</strong> y foto de perfil al registrarse. También recopilamos datos de geolocalización de sus grabaciones, grabaciones de audio y monitoreamos su actividad (estado en línea, última conexión) para mejorar la experiencia social.
    </p>

    <h3 className="text-foreground font-semibold">2. Uso de la información</h3>
    <p>
      Utilizamos su información para proporcionar, mantener y mejorar nuestros servicios, personalizar su experiencia y comunicarnos con usted. Su ubicación general (ciudad/país) se utiliza para ofrecer rankings locales y regionales. Su edad y estado de actividad pueden ser visibles para administradores y otros usuarios según la configuración de privacidad. Sus grabaciones de audio y ubicación exacta asociada a ellas son públicas.
    </p>

    <h3 className="text-foreground font-semibold">3. Compartir información</h3>
    <p>
      No vendemos su información personal a terceros. Compartimos información solo cuando es necesario para ofrecer nuestros servicios, cumplir con la ley o proteger nuestros derechos.
    </p>

    <h3 className="text-foreground font-semibold">4. Seguridad</h3>
    <p>
      Tomamos medidas razonables para proteger su información personal contra pérdida, robo, uso indebido y acceso no autorizado.
    </p>

    <h3 className="text-foreground font-semibold">5. Sus derechos</h3>
    <p>
      Usted tiene derecho a acceder, corregir o eliminar su información personal. Puede hacerlo directamente desde la configuración de su perfil en la aplicación.
    </p>
  </div>
);

export const TermsOfServiceContent = () => (
  <div className="space-y-4 text-sm text-muted-foreground">
    <p>
      <strong>Última actualización: {new Date().toLocaleDateString()}</strong>
    </p>
    <p>
      Bienvenido a SoundSpot. Al acceder o utilizar nuestra aplicación, usted acepta estar sujeto a estos Términos y Condiciones.
    </p>

    <h3 className="text-foreground font-semibold">1. Uso de la aplicación</h3>
    <p>
      Usted se compromete a utilizar SoundSpot solo para fines legales y de acuerdo con estos términos. No debe usar la aplicación para transmitir contenido ilegal, ofensivo o que infrinja los derechos de otros.
    </p>

    <h3 className="text-foreground font-semibold">2. Contenido del usuario</h3>
    <p>
      Usted conserva los derechos sobre el contenido que publica (audios, comentarios), pero otorga a SoundSpot una licencia mundial, no exclusiva y libre de regalías para usar, reproducir y mostrar dicho contenido en relación con el servicio.
    </p>

    <h3 className="text-foreground font-semibold">3. Conducta prohibida</h3>
    <p>
      Queda prohibido acosar a otros usuarios, publicar información falsa, intentar acceder a cuentas de otros usuarios o interferir con el funcionamiento de la aplicación.
    </p>

    <h3 className="text-foreground font-semibold">4. Terminación</h3>
    <p>
      Podemos suspender o cancelar su acceso a SoundSpot si viola estos términos o si decidimos discontinuar el servicio.
    </p>

    <h3 className="text-foreground font-semibold">5. Limitación de responsabilidad</h3>
    <p>
      SoundSpot se proporciona "tal cual". No garantizamos que la aplicación esté libre de errores o que funcione ininterrumpidamente.
    </p>
  </div>
);

interface LegalModalProps {
  type: "privacy" | "terms";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LegalModal = ({ type, open, onOpenChange }: LegalModalProps) => {
  const title = type === "privacy" ? "Política de Privacidad" : "Términos y Condiciones";
  const Content = type === "privacy" ? PrivacyPolicyContent : TermsOfServiceContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Por favor lee atentamente el siguiente documento.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 pb-6">
          <Content />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
