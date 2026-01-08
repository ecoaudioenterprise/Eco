import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const OfflineAlert = ({ allowMapAccess = false }: { allowMapAccess?: boolean }) => {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            const status = await Network.getStatus();
            setIsOffline(!status.connected);
        };

        checkStatus();

        const handler = Network.addListener("networkStatusChange", (status) => {
            setIsOffline(!status.connected);
        });

        return () => {
            handler.then((h) => h.remove());
        };
    }, []);

    if (!isOffline) return null;

    const isPro = localStorage.getItem("soundspot_is_pro") === "true";
    const hasOfflineMaps = localStorage.getItem("has_offline_maps") === "true";

    // If user is PRO and has downloaded maps, allow access (don't show alert)
    if (allowMapAccess && isPro && hasOfflineMaps) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-4">
            <div className="flex flex-col items-center max-w-md text-center space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-destructive/10 p-4 rounded-full">
                    <WifiOff className="w-12 h-12 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                    {isPro && !hasOfflineMaps ? "Sin Mapas Descargados" : "Sin conexión a Internet"}
                </h2>
                <p className="text-muted-foreground">
                    {isPro && !hasOfflineMaps 
                        ? "Eres usuario PRO, pero no tienes mapas descargados. Conéctate a internet para descargar zonas y usarlas sin conexión."
                        : "Para usar Sound Maps, necesitas una conexión a Internet activa. Por favor, verifica tu conexión e inténtalo de nuevo."
                    }
                </p>
                <Button 
                    onClick={async () => {
                        const status = await Network.getStatus();
                        setIsOffline(!status.connected);
                    }}
                    variant="outline"
                    className="mt-4"
                >
                    Reintentar conexión
                </Button>
            </div>
        </div>
    );
};
