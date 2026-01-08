import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, Play, Pause, Search, ShieldAlert, Music, Users, BadgeCheck, Ban, AlertTriangle, Eye, X, MapPin, Calendar, Clock, Heart, MessageCircle, FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AudioData } from "@/utils/audioStorage";
import { fetchSupabaseAudios } from "@/utils/supabaseAudioUtils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

interface AdminViewProps {
  onBack: () => void;
}

interface UserProfile {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  provider?: string | null;
  phone?: string | null;
  username: string;
  full_name: string;
  avatar_url: string;
  is_admin: boolean;
  verified: boolean;
  banned?: boolean;
  is_online?: boolean;
  last_seen?: string;
  birth_date?: string;
  gender?: string;
  is_pro?: boolean;
  country?: string;
  region?: string;
  city?: string;
}

export const AdminView = ({ onBack }: AdminViewProps) => {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [viewMode, setViewMode] = useState<'audios' | 'users'>('audios');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<AudioData | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (viewMode === 'audios') {
      loadAudios();
    } else {
      loadUsers();
    }
    
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [viewMode]);

  const loadAudios = async () => {
    setLoading(true);
    try {
      const data = await fetchSupabaseAudios({ includeAll: true });
      setAudios(data);
    } catch (error) {
      console.error("Error loading audios for admin:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los audios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_users');
      if (!error) {
        setUsers((((data ?? []) as unknown) as UserProfile[]) || []);
        return;
      }

      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('*');

        if (fallbackError) throw fallbackError;
        setUsers((((fallbackData ?? []) as unknown) as UserProfile[]) || []);
        return;
      }

      throw error;
    } catch (error: any) {
      console.error("Error loading users for admin:", error);
      toast({
        title: "Error",
        description: `Error: ${error.message || "No se pudieron cargar los usuarios"}. Ejecuta admin_list_users.sql en Supabase.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerify = async (userId: string, currentStatus: boolean, username: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ verified: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: currentStatus ? "Usuario desverificado" : "Usuario verificado",
        description: `Se ha ${currentStatus ? "quitado" : "añadido"} la verificación a ${username || "el usuario"}.`,
      });

      loadUsers();
    } catch (error) {
      console.error("Error toggling verification:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de verificación.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el eco "${title}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('audios')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Eco eliminado",
        description: "El eco ha sido eliminado correctamente.",
      });

      // Refresh list
      loadAudios();
    } catch (error) {
      console.error("Error deleting audio:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el eco.",
        variant: "destructive",
      });
    }
  };

  const handleBanUser = async (userId: string, username: string, currentBannedStatus: boolean = false) => {
    const action = currentBannedStatus ? "desbanear" : "banear";
    if (!confirm(`¿Estás seguro de que quieres ${action} al usuario "${username}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ banned: !currentBannedStatus })
        .eq('id', userId);

      if (error) throw error;

      if (!currentBannedStatus) {
          // Send notification if banning
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              await supabase.from('notifications').insert({
                  user_id: userId,
                  actor_id: user.id,
                  type: 'admin_msg',
                  read: false
              });
          }
      }

      toast({
        title: currentBannedStatus ? "Usuario desbaneado" : "Usuario baneado",
        description: `El usuario ${username} ha sido ${currentBannedStatus ? "desbaneado" : "baneado"} correctamente.`,
      });

      loadUsers();
    } catch (error) {
      console.error("Error banning user:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del usuario.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${username}"? Esta acción eliminará su perfil y acceso de toda la app.`)) {
      return;
    }

    try {
      // Use the RPC function to delete everything safely and bypassing RLS for related tables
      const { error } = await supabase.rpc('admin_delete_user', {
        target_user_id: userId
      });

      if (error) {
        console.error("RPC Error:", error);
        // Fallback for when the function is not yet created in DB
        if (error.message?.includes('function') && error.message?.includes('does not exist')) {
            console.log("Fallback to manual deletion");
            // Clean up user data first (best effort)
            await supabase.from('audios').delete().eq('user_id', userId);
            await supabase.from('comments').delete().eq('user_id', userId);
            await supabase.from('likes').delete().eq('user_id', userId);
            await supabase.from('follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
            await supabase.from('notifications').delete().or(`user_id.eq.${userId},actor_id.eq.${userId}`);
            const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
            if (profileError) throw profileError;
        } else {
            throw error;
        }
      }

      toast({
        title: "Usuario eliminado",
        description: `El usuario ${username} ha sido eliminado correctamente de toda la app.`,
      });

      loadUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario. Asegúrate de ejecutar el script admin_delete_user.sql",
        variant: "destructive",
      });
    }
  };

  const handlePlay = (audio: AudioData) => {
    if (playingId === audio.id) {
      audioElement?.pause();
      setPlayingId(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      const newAudio = new Audio(audio.audioUrl);
      newAudio.onended = () => setPlayingId(null);
      newAudio.play();
      setAudioElement(newAudio);
      setPlayingId(audio.id);
    }
  };

  const filteredAudios = audios.filter(audio => {
    const title = audio.title || "";
    const author = audio.author || "";
    const username = audio.authorUsername || "";
    
    const hash = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0).toString().slice(0, 4);
    
    const term = searchTerm.toLowerCase();
    
    return (
      title.toLowerCase().includes(term) ||
      author.toLowerCase().includes(term) ||
      username.toLowerCase().includes(term) ||
      hash.includes(term)
    );
  });

  const filteredUsers = users.filter(user => 
    (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAge = (dateString?: string) => {
    if (!dateString) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getLastSeen = (dateString?: string, isOnline?: boolean) => {
    if (isOnline) return "En línea";
    if (!dateString) return "Nunca";
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: es });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-right duration-500 ease-fluid overflow-hidden">
      {/* Header */}
      <div className="flex-none glass border-b border-border pt-8">
        <div className="px-4 py-6 flex items-center justify-center relative">
          <Button variant="ghost" size="icon" onClick={onBack} className="absolute left-4">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            <h1 className="text-xl font-bold">Panel de Administración</h1>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setViewMode('audios')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              viewMode === 'audios' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Music className="w-4 h-4" />
            Ecos
          </button>
          <button
            onClick={() => setViewMode('users')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              viewMode === 'users' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            Usuarios
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border border-border/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'audios' ? "Buscar por título, usuario..." : "Buscar usuarios..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-1"
          />
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                {viewMode === 'audios' ? (
                  <>
                    <TableHead>Eco</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última vez</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Género</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : viewMode === 'audios' ? (
                 filteredAudios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No se encontraron ecos.
                      </TableCell>
                    </TableRow>
                 ) : (
                    filteredAudios.map((audio) => (
                      <TableRow key={audio.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span>{audio.title}</span>
                              {(audio as any).moderation_status === 'flagged' && (
                                <div className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Detectado</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{audio.duration}</span>
                            {(audio as any).moderation_reason && (
                              <span className="text-xs text-red-400">Motivo: {(audio as any).moderation_reason}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{audio.author}</span>
                            {audio.authorUsername && (
                              <span className="text-xs text-muted-foreground">{audio.authorUsername}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(audio.timestamp, { addSuffix: true, locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedAudio(audio)}
                              className="h-8 w-8 text-blue-500 hover:text-blue-600"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePlay(audio)}
                              className="h-8 w-8"
                            >
                              {playingId === audio.id ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(audio.id, audio.title)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                 )
              ) : (
                 filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No se encontraron usuarios.
                      </TableCell>
                    </TableRow>
                 ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                             {user.avatar_url && (
                               <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                             )}
                           <div className="flex flex-col">
                               <span>@{user.username || "sin_usuario"}</span>
                               <span className="text-xs text-muted-foreground">{user.full_name}</span>
                               {user.email && (
                                 <span className="text-xs text-muted-foreground">{user.email}</span>
                               )}
                             </div>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col gap-1">
                             {user.is_online ? (
                               <span className="text-green-500 text-xs flex items-center gap-1">
                                 <span className="w-2 h-2 rounded-full bg-green-500"></span> Online
                               </span>
                             ) : (
                               <span className="text-muted-foreground text-xs">Offline</span>
                             )}
                             {user.is_admin && (
                               <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 w-fit">
                                 Admin
                               </span>
                             )}
                             {user.banned && (
                               <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 w-fit">
                                 Baneado
                               </span>
                             )}
                           </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getLastSeen(user.last_seen, user.is_online)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.city ? (
                            <div className="flex flex-col">
                              <span>{user.city}</span>
                              <span className="text-[10px] text-muted-foreground">{user.country}</span>
                            </div>
                          ) : (
                            <span className="italic">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getAge(user.birth_date)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                           {user.gender || "N/A"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.city ? (
                            <div className="flex flex-col">
                              <span>{user.city}</span>
                              <span className="text-[10px] text-muted-foreground">{user.country}</span>
                            </div>
                          ) : (
                            <span className="italic">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedUser(user)}
                                className="h-8 w-8 text-blue-500 hover:text-blue-600"
                                title="Ver detalles"
                            >
                                <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={user.verified ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleToggleVerify(user.id, user.verified, user.username)}
                                className={user.verified ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
                            >
                                {user.verified ? (
                                    <>
                                        <BadgeCheck className="w-4 h-4 mr-1" />
                                        Verificado
                                    </>
                                ) : (
                                    "Verificar"
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleBanUser(user.id, user.username, user.banned)}
                                className={`h-8 w-8 ${user.banned ? "text-orange-500" : "text-destructive"}`}
                                title={user.banned ? "Desbanear" : "Banear"}
                            >
                                <Ban className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                 )
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Audio Detail Modal */}
      {selectedAudio && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background w-full max-w-2xl max-h-[60vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-primary" />
                Detalles del Eco
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAudio(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Main Info */}
              <div className="flex flex-col gap-2">
                 <h3 className="text-2xl font-bold">{selectedAudio.title}</h3>
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <span>ID: {selectedAudio.id}</span>
                 </div>
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Metadata */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Autor</label>
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                {selectedAudio.authorAvatar ? (
                                    <img src={selectedAudio.authorAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-lg">👤</span>
                                )}
                            </div>
                            <div>
                                <p className="font-medium">{selectedAudio.author}</p>
                                <p className="text-xs text-muted-foreground">{selectedAudio.authorUsername || "Sin usuario"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Estadísticas</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                                <Heart className="w-4 h-4 text-red-500" />
                                <span className="font-medium">{selectedAudio.likes || 0}</span>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-blue-500" />
                                <span className="font-medium">{selectedAudio.comments || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Categoría</label>
                        <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                            <span className="capitalize">{selectedAudio.category}</span>
                        </div>
                    </div>
                </div>

                {/* Column 2: Tech Info */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Ubicación</label>
                        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-primary" />
                                <span className="text-sm">
                                    {selectedAudio.latitude.toFixed(6)}, {selectedAudio.longitude.toFixed(6)}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${selectedAudio.latitude},${selectedAudio.longitude}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Ver en Google Maps
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Fechas</label>
                        <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>{format(selectedAudio.timestamp, "PPP", { locale: es })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span>{format(selectedAudio.timestamp, "p", { locale: es })}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(selectedAudio.timestamp, { addSuffix: true, locale: es })}
                            </div>
                        </div>
                    </div>
                </div>
              </div>

              {/* Moderation Section */}
              <div className="space-y-2 border-t border-border pt-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Estado de Moderación</label>
                <div className={`p-4 rounded-lg border ${
                    selectedAudio.moderation_status === 'flagged' 
                        ? 'bg-red-500/10 border-red-500/20' 
                        : selectedAudio.moderation_status === 'safe'
                            ? 'bg-green-500/10 border-green-500/20'
                            : 'bg-muted/50 border-border'
                }`}>
                    <div className="flex items-center gap-2 mb-2">
                        {selectedAudio.moderation_status === 'flagged' ? (
                            <ShieldAlert className="w-5 h-5 text-red-500" />
                        ) : selectedAudio.moderation_status === 'safe' ? (
                            <BadgeCheck className="w-5 h-5 text-green-500" />
                        ) : (
                            <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span className="font-bold capitalize">
                            {selectedAudio.moderation_status === 'flagged' ? 'Detectado (Flagged)' : 
                             selectedAudio.moderation_status === 'safe' ? 'Seguro (Safe)' : 'Pendiente / Desconocido'}
                        </span>
                    </div>
                    {selectedAudio.moderation_reason && (
                        <p className="text-sm text-muted-foreground">
                            <span className="font-semibold">Razón:</span> {selectedAudio.moderation_reason}
                        </p>
                    )}
                </div>
              </div>
              
              {/* Raw Data (for debugging/advanced admin) */}
              <div className="space-y-2 pt-4">
                 <details className="text-xs text-muted-foreground cursor-pointer">
                    <summary className="hover:text-foreground transition-colors">Ver datos crudos (JSON)</summary>
                    <pre className="mt-2 p-4 bg-muted rounded-lg overflow-x-auto">
                        {JSON.stringify(selectedAudio, null, 2)}
                    </pre>
                 </details>
              </div>

            </div>
            
            {/* Footer Actions */}
            <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedAudio(null)}>
                    Cerrar
                </Button>
                <Button 
                    variant="destructive" 
                    onClick={() => {
                        handleDelete(selectedAudio.id, selectedAudio.title);
                        setSelectedAudio(null);
                    }}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar Eco
                </Button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background w-full max-w-2xl max-h-[60vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Detalles del Usuario
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Usuario</div>
                  <div className="font-medium">@{selectedUser.username || "sin_usuario"}</div>
                  <div className="text-xs text-muted-foreground">{selectedUser.full_name || "-"}</div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Rol</div>
                  <div className="font-medium">
                    {selectedUser.is_admin ? "Eco alcalde (Admin)" : "Usuario"}
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-medium break-all">{selectedUser.email || "No disponible"}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedUser.provider ? `Proveedor: ${selectedUser.provider}` : ""}
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Teléfono</div>
                  <div className="font-medium break-all">{selectedUser.phone || "No disponible"}</div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Alta</div>
                  <div className="font-medium">
                    {selectedUser.created_at ? format(new Date(selectedUser.created_at), "PPP p", { locale: es }) : "No disponible"}
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Último login</div>
                  <div className="font-medium">
                    {selectedUser.last_sign_in_at ? format(new Date(selectedUser.last_sign_in_at), "PPP p", { locale: es }) : "No disponible"}
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Actividad (app)</div>
                  <div className="font-medium">
                    {selectedUser.is_online ? "En línea" : (selectedUser.last_seen ? formatDistanceToNow(new Date(selectedUser.last_seen), { addSuffix: true, locale: es }) : "Nunca")}
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Edad / Género</div>
                  <div className="font-medium">
                    {getAge(selectedUser.birth_date)} / {selectedUser.gender || "N/A"}
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Estado</div>
                  <div className="font-medium">
                    {selectedUser.banned ? "Baneado" : "Activo"}{selectedUser.verified ? " · Verificado" : ""}{selectedUser.is_pro ? " · PRO" : ""}
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg sm:col-span-2">
                  <div className="text-xs text-muted-foreground">ID</div>
                  <div className="font-medium break-all">{selectedUser.id}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
