import { useState, useEffect } from "react";
import { Send, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_metadata: {
    full_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

interface CommentsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  audioId: string;
  onCommentAdded?: () => void;
}

export const CommentsSheet = ({ isOpen, onClose, audioId, onCommentAdded }: CommentsSheetProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (isOpen && audioId) {
      fetchComments();
      getCurrentUser();
    }
  }, [isOpen, audioId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      // Fetch comments
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id
        `)
        .eq('audio_id', audioId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles for these comments
      // Note: In a real app with proper foreign keys, we could join.
      // Here we'll manually fetch profiles or use a simplified approach
      const commentsWithUsers = await Promise.all((commentsData || []).map(async (comment) => {
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', comment.user_id)
            .single();
            
        return {
            ...comment,
            user_metadata: profile ? {
                full_name: profile.full_name,
                username: profile.username,
                avatar_url: profile.avatar_url // Assuming avatar_url exists or using metadata
            } : {
                full_name: "Usuario"
            }
        };
      }));

      setComments(commentsWithUsers);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          audio_id: audioId,
          user_id: currentUser.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment("");
      fetchComments(); // Reload comments
      onCommentAdded?.();
      
    } catch (error) {
      console.error("Error posting comment:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar el comentario.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10002] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-background border-t sm:border rounded-t-3xl sm:rounded-xl shadow-2xl h-[80vh] sm:h-[600px] flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">Comentarios</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Comments List */}
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.user_metadata.avatar_url} />
                    <AvatarFallback>
                        <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {comment.user_metadata.full_name || "Usuario"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted-foreground">
              <p>No hay comentarios aún.</p>
              <p className="text-sm">¡Sé el primero en opinar!</p>
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t bg-background/50 backdrop-blur-md pb-8 sm:pb-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario..."
              className="flex-1"
              disabled={isSending}
            />
            <Button type="submit" size="icon" disabled={!newComment.trim() || isSending}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
