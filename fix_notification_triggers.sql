-- Fix for "operator does not exist: uuid = text" error
-- This ensures we only attempt to join with audios table if the audio_id is a valid UUID

-- Function and Trigger for Likes
CREATE OR REPLACE FUNCTION handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
    audio_author_id UUID;
BEGIN
    -- Check if audio_id is a valid UUID before casting using regex
    IF NEW.audio_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        -- Get author of the audio
        SELECT user_id INTO audio_author_id FROM audios WHERE id = NEW.audio_id::uuid;
        
        -- Notify if author exists and is not the liker
        IF audio_author_id IS NOT NULL AND audio_author_id != NEW.user_id THEN
            INSERT INTO notifications (user_id, actor_id, type, entity_id, created_at)
            VALUES (audio_author_id, NEW.user_id, 'like', NEW.audio_id, NOW());
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function and Trigger for Comments
CREATE OR REPLACE FUNCTION handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    audio_author_id UUID;
BEGIN
    -- Check if audio_id is a valid UUID before casting using regex
    IF NEW.audio_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        -- Get author of the audio
        SELECT user_id INTO audio_author_id FROM audios WHERE id = NEW.audio_id::uuid;
        
        -- Notify if author exists and is not the commenter
        IF audio_author_id IS NOT NULL AND audio_author_id != NEW.user_id THEN
            INSERT INTO notifications (user_id, actor_id, type, entity_id, created_at)
            VALUES (audio_author_id, NEW.user_id, 'comment', NEW.audio_id, NOW());
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
