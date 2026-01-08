import { Map, List, Mic, User, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: "map" | "list" | "record" | "search" | "profile";
  onTabChange: (tab: "map" | "list" | "record" | "search" | "profile") => void;
}

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const tabs = [
    { id: "map" as const, icon: Map, label: "Mapa" },
    { id: "list" as const, icon: List, label: "Cerca" },
    { id: "record" as const, icon: Mic, label: "Grabar" },
    { id: "search" as const, icon: Search, label: "Buscar" },
    { id: "profile" as const, icon: User, label: "Perfil" },
  ];

  return (
    <nav className="bottom-nav z-50 md:w-[400px] md:left-1/2 md:-translate-x-1/2 md:bottom-6 md:px-8 shadow-2xl">
      {tabs.map((tab) => {
        const isRecord = tab.id === "record";
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "nav-item",
              isActive && !isRecord && "active",
              isRecord && "relative -mt-8"
            )}
          >
            {isRecord ? (
              <div className="w-16 h-16 rounded-full gradient-recording shadow-lg flex items-center justify-center">
                <Mic className="w-7 h-7 text-primary-foreground" />
              </div>
            ) : (
              <>
                <tab.icon className={cn("w-6 h-6", isActive && "text-primary")} />
                <span className={cn("text-xs", isActive && "text-primary font-medium")}>
                  {tab.label}
                </span>
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
};
