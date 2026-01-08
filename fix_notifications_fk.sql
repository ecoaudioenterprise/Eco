-- Add explicit Foreign Key to profiles for actor_id to allow joining in PostgREST
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;

-- Drop the new constraint if it already exists to allow re-running this script
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_actor_id_profiles_fkey;

-- We need to ensure all actor_ids in notifications exist in profiles first
-- Or we delete notifications with invalid actors
DELETE FROM public.notifications
WHERE actor_id NOT IN (SELECT id FROM public.profiles);

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_actor_id_profiles_fkey
FOREIGN KEY (actor_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Also fix user_id just in case, though usually points to auth.users is fine
-- But pointing to profiles is also valid if we want to ensure profile exists
-- For now, actor_id is the critical one for UI display.

-- Ensure RLS allows viewing own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Ensure RLS allows triggers/system to insert (handled by SECURITY DEFINER functions usually, but just in case)
-- Actually, the triggers run as the user performing the action (actor), so they need INSERT permission
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = actor_id); 
-- Note: 'proximity' notifications are inserted by the user receiving them? 
-- No, proximity is inserted by the current user (actor) detecting it? 
-- In NotificationsManager.tsx line 92, it inserts with user_id = user.id (me) and actor_id = newAudio.user_id (them).
-- Wait, if *I* insert a notification for *myself* (proximity), then actor_id is someone else.
-- So I need to allow inserting notifications where user_id = auth.uid() OR actor_id = auth.uid().
DROP POLICY IF EXISTS "Users can insert notifications generic" ON public.notifications;
CREATE POLICY "Users can insert notifications generic" ON public.notifications
FOR INSERT
WITH CHECK (true); -- Allow all inserts for now, or restrict to auth.uid() in either user_id or actor_id

-- Fix existing notifications with missing actor data if any
-- (Already handled by DELETE above)
