import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Medal, Trophy, Star, Mic, Heart, Globe, Map } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardUser {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  score: number;
}

interface LeaderboardSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

type Scope = 'global' | 'national' | 'regional' | 'local';

export const LeaderboardSheet = ({ isOpen, onClose }: LeaderboardSheetProps) => {
  const [activeTab, setActiveTab] = useState<"contributors" | "popular">("contributors");
  const [scope, setScope] = useState<Scope>('national');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserLocation, setCurrentUserLocation] = useState<{city?: string, region?: string, country?: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchUserLocation();
      fetchLeaderboard();
    }
  }, [isOpen, activeTab, scope]);

  const fetchUserLocation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('city, region, country').eq('id', user.id).single();
      if (data) setCurrentUserLocation(data);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const rpcName = activeTab === "contributors" 
        ? 'get_weekly_top_contributors' 
        : 'get_weekly_popular_creators';

      const { data, error } = await supabase.rpc(rpcName, {
        limit_count: 10,
        scope: scope,
        viewer_id: user?.id || null
      });
      
      if (error) throw error;
      
      if (data) {
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-6 h-6 text-yellow-500 fill-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400 fill-gray-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-amber-700 fill-amber-700" />;
      default:
        return <span className="font-bold text-muted-foreground w-5 text-center">{index + 1}</span>;
    }
  };

  const getScopeLabel = () => {
    switch(scope) {
        case 'global': return "Global";
        case 'national': return currentUserLocation?.country || "Nacional";
        case 'regional': return currentUserLocation?.region || "Regional";
        case 'local': return currentUserLocation?.city || "Local";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-[20px] p-0 bg-background/95 backdrop-blur-xl border-t-0">
        <div className="p-6 h-full flex flex-col">
          <SheetHeader className="mb-6 text-center relative">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <SheetTitle className="text-2xl font-bold">Ranking Semanal</SheetTitle>
            
            <div className="flex justify-center mt-2">
                <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                    <SelectTrigger className="w-[180px] h-8 bg-muted border-none">
                        <SelectValue placeholder="Alcance" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="national">🇪🇸 Nacional</SelectItem>
                        <SelectItem value="regional">🏛️ Regional</SelectItem>
                        <SelectItem value="local">📍 Local</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando: {getScopeLabel()}
            </p>
          </SheetHeader>

          <Tabs defaultValue="contributors" className="w-full flex-1 flex flex-col" onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="contributors" className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Más Activos
              </TabsTrigger>
              <TabsTrigger value="popular" className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Más Populares
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-6">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No hay datos esta semana en {getScopeLabel()}.
                    <br />
                    ¡Sé el primero en participar!
                  </div>
                ) : (
                  users.map((user, index) => (
                    <div
                      key={user.user_id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl transition-all",
                        index === 0 ? "bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20" : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center justify-center w-8">
                        {getRankIcon(index)}
                      </div>
                      
                      <Avatar className={cn("h-12 w-12 border-2", index === 0 ? "border-yellow-500" : "border-transparent")}>
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback>{user.username?.substring(0, 2).toUpperCase() || "??"}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">
                            {user.username || "Usuario"}
                          </p>
                          {index === 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-yellow-500/20 text-yellow-600 rounded-full">
                              ALCALDE
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {user.score} {activeTab === "contributors" ? "ecos subidos" : "interacciones"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
