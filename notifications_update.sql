-- Create Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Who receives the notification
    actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Who triggered it
    type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'request')),
    entity_id TEXT, -- ID of audio, or other entity (optional)
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors on re-run
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can insert notifications (e.g. via triggers or client logic)
CREATE POLICY "Users can insert notifications" ON notifications
    FOR INSERT WITH CHECK (auth.uid() = actor_id OR auth.uid() = user_id); 
    -- Allow actor to create (e.g. I liked your post -> I create notif)
    -- OR recipient (not usual, but safe enough if RLS checks match)

-- Update Follows table to support status
ALTER TABLE follows ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted' CHECK (status IN ('accepted', 'pending'));

-- Function to handle follow requests notification
CREATE OR REPLACE FUNCTION handle_new_follow()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is pending, send 'request' notification
    IF NEW.status = 'pending' THEN
        INSERT INTO notifications (user_id, actor_id, type, created_at)
        VALUES (NEW.following_id, NEW.follower_id, 'request', NOW());
    -- If status is accepted, send 'follow' notification
    ELSIF NEW.status = 'accepted' THEN
        INSERT INTO notifications (user_id, actor_id, type, created_at)
        VALUES (NEW.following_id, NEW.follower_id, 'follow', NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for follow notifications
DROP TRIGGER IF EXISTS on_new_follow ON follows;
CREATE TRIGGER on_new_follow
    AFTER INSERT ON follows
    FOR EACH ROW EXECUTE FUNCTION handle_new_follow();

-- Trigger for updates (accepting request)
CREATE OR REPLACE FUNCTION handle_follow_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed from pending to accepted
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
        INSERT INTO notifications (user_id, actor_id, type, created_at)
        VALUES (NEW.following_id, NEW.follower_id, 'follow', NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_update ON follows;
CREATE TRIGGER on_follow_update
    AFTER UPDATE ON follows
    FOR EACH ROW EXECUTE FUNCTION handle_follow_update();

-- Function and Trigger for Likes
CREATE OR REPLACE FUNCTION handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
    audio_author_id UUID;
BEGIN
    -- Get author of the audio
    SELECT user_id INTO audio_author_id FROM audios WHERE id = NEW.audio_id;
    
    -- Notify if author exists and is not the liker
    IF audio_author_id IS NOT NULL AND audio_author_id != NEW.user_id THEN
        INSERT INTO notifications (user_id, actor_id, type, entity_id, created_at)
        VALUES (audio_author_id, NEW.user_id, 'like', NEW.audio_id, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_like ON likes;
CREATE TRIGGER on_new_like
    AFTER INSERT ON likes
    FOR EACH ROW EXECUTE FUNCTION handle_new_like();

-- Function and Trigger for Comments
CREATE OR REPLACE FUNCTION handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    audio_author_id UUID;
BEGIN
    -- Get author of the audio
    SELECT user_id INTO audio_author_id FROM audios WHERE id = NEW.audio_id;
    
    -- Notify if author exists and is not the commenter
    IF audio_author_id IS NOT NULL AND audio_author_id != NEW.user_id THEN
        INSERT INTO notifications (user_id, actor_id, type, entity_id, created_at)
        VALUES (audio_author_id, NEW.user_id, 'comment', NEW.audio_id, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_comment ON comments;
CREATE TRIGGER on_new_comment
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION handle_new_comment();
