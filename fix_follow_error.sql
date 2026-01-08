-- 1. Arreglar tabla follows
-- Añadir columna status si no existe
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted';

-- Actualizar constraint de status en follows
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_status_check;
ALTER TABLE public.follows ADD CONSTRAINT follows_status_check CHECK (status IN ('pending', 'accepted'));

-- 2. Arreglar tabla notifications
-- Actualizar constraint de type en notifications para incluir 'proximity'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('follow', 'request', 'like', 'comment', 'admin_msg', 'proximity'));

-- 3. Arreglar Políticas RLS para follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see follows" ON public.follows;
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Users can see follows" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can update follow status" ON public.follows;
CREATE POLICY "Users can update follow status" ON public.follows FOR UPDATE USING (auth.uid() = following_id);

-- 4. Arreglar Trigger de Notificaciones para Follows
CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo insertar notificación si no existe una reciente (deduplicación básica)
    IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = NEW.following_id 
        AND actor_id = NEW.follower_id 
        AND type = 'follow'
    ) THEN
        INSERT INTO public.notifications (user_id, actor_id, type)
        VALUES (NEW.following_id, NEW.follower_id, 'follow');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_added ON public.follows;
CREATE TRIGGER on_follow_added
    AFTER INSERT ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_follow();

-- 5. Asegurar permisos para notifications (para que el trigger no falle si RLS está activo y el usuario no es dueño)
-- Nota: Como el trigger es SECURITY DEFINER, esto debería estar bien, pero aseguramos políticas permisivas para INSERT desde triggers
DROP POLICY IF EXISTS "System/Triggers can insert notifications" ON public.notifications;
CREATE POLICY "System/Triggers can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- 6. Política para actualizar notificaciones (marcar como leídas)
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);
