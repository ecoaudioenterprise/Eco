import { useState, useEffect } from "react";
import { ArrowLeft, Bell, UserPlus, Heart, MessageCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NotificationsViewProps {
  onBack: () => void;
}

export const NotificationsView = ({ onBack }: NotificationsViewProps) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    markAsRead();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log("Fetching notifications for user:", user.id);

      // Intento 1: Fetch con Join optimizado
      // Nota: Si la FK cambia de nombre, esto fallará y usaremos el fallback
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_profiles_fkey(username, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        console.log("Notifications fetched with join:", data.length);
        setNotifications(data);
        return;
      }

      console.warn("Join fetch failed, falling back to manual fetch. Error:", error);

      // Intento 2: Fetch simple + Fetch de perfiles manual
      const { data: rawNotifications, error: simpleError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (simpleError) {
          console.error("Simple fetch also failed:", simpleError);
          throw simpleError;
      }
      
      if (!rawNotifications || rawNotifications.length === 0) {
          console.log("No notifications found (raw)");
          setNotifications([]);
          return;
      }

      console.log("Raw notifications fetched:", rawNotifications.length);

      // Obtener IDs de actores únicos para enriquecer los datos manualmente
      const actorIds = [...new Set(rawNotifications.map(n => n.actor_id).filter(Boolean))];
      
      let enrichedNotifications = rawNotifications;

      if (actorIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', actorIds);
            
          if (!profilesError && profiles) {
              const profilesMap = profiles.reduce((acc: any, profile: any) => {
                  acc[profile.id] = profile;
                  return acc;
              }, {});
              
              enrichedNotifications = rawNotifications.map(n => ({
                  ...n,
                  actor: profilesMap[n.actor_id] || { username: 'Usuario' }
              }));
          }
      }
      
      setNotifications(enrichedNotifications);

    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
  };

  const handleAcceptRequest = async (notification: any) => {
      try {
          const { error } = await supabase
              .from('follows')
              .update({ status: 'accepted' })
              .eq('follower_id', notification.actor_id)
              .eq('following_id', notification.user_id);
            
          if (error) throw error;
          
          // Remove from list or update UI
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
          
      } catch (error) {
          console.error("Error accepting request:", error);
      }
  };

  const getIcon = (type: string) => {
      switch (type) {
          case 'follow': return <UserPlus className="w-4 h-4 text-blue-500" />;
          case 'request': return <Shield className="w-4 h-4 text-orange-500" />;
          case 'like': return <Heart className="w-4 h-4 text-red-500" />;
          case 'comment': return <MessageCircle className="w-4 h-4 text-green-500" />;
          default: return <Bell className="w-4 h-4 text-gray-500" />;
      }
    };
  
  // Need to import Lock locally or just use Bell for now if lazy, but better to import
  // Let's assume Lucide imports above need update if we use Lock
  
  return (
    <div className="fixed inset-0 bg-background z-[20000] flex flex-col animate-in slide-in-from-right duration-500 ease-fluid">
      <div className="flex items-center justify-center relative px-4 pb-4 pt-12 border-b border-border bg-background sticky top-0 z-10 shadow-sm">
        <Button variant="ghost" size="icon" onClick={onBack} className="absolute left-4 bottom-3 rounded-full hover:bg-muted">
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </Button>
        <h2 className="text-xl font-bold text-foreground">Notificaciones</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
            <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        ) : notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No tienes notificaciones</p>
            </div>
        ) : (
            notifications.map((notification) => (
                <div key={notification.id} className={`flex items-start gap-3 p-3 rounded-lg border ${notification.read ? 'bg-card/50 border-border/50' : 'bg-primary/5 border-primary/20'}`}>
                    <Avatar className="w-10 h-10 border border-border/50">
                        <AvatarImage src={notification.actor?.avatar_url} />
                        <AvatarFallback>{notification.actor?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                        <p className="text-sm">
                            <span className="font-semibold">{notification.actor?.username || "Usuario"}</span>
                            {" "}
                            {notification.type === 'follow' && "te ha comenzado a seguir."}
                            {notification.type === 'request' && "quiere seguirte."}
                            {notification.type === 'like' && "le gustó tu eco."}
                            {notification.type === 'comment' && "comentó en tu eco."}
                            {notification.type === 'proximity' && "publicó un eco cerca de ti."}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
                        </p>
                        
                        {notification.type === 'request' && (
                            <div className="flex gap-2 mt-2">
                                <Button size="sm" onClick={() => handleAcceptRequest(notification)}>
                                    Aceptar
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                    // Handle reject (delete follow)
                                }}>
                                    Rechazar
                                </Button>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-1">
                        {getIcon(notification.type)}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};
