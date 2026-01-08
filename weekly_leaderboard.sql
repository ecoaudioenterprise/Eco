-- 1. Update Notifications constraint to allow 'weekly_rank'
DO $$ 
BEGIN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('follow', 'like', 'comment', 'request', 'proximity', 'admin_msg', 'weekly_rank'));
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 2. Function: Weekly Top Contributors (Most Audios Uploaded in last 7 days)
CREATE OR REPLACE FUNCTION get_weekly_top_contributors(limit_count INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  score BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    COUNT(a.id) as score
  FROM audios a
  JOIN profiles p ON a.user_id = p.id
  WHERE a.created_at >= (NOW() - INTERVAL '7 days')
  GROUP BY a.user_id, p.username, p.full_name, p.avatar_url
  ORDER BY score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function: Weekly Popular Creators (Most Likes + Comments received in last 7 days)
CREATE OR REPLACE FUNCTION get_weekly_popular_creators(limit_count INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  score BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_scores AS (
    -- Count likes received on user's audios in the last 7 days
    SELECT 
        a.user_id, 
        COUNT(l.id) as interaction_count
    FROM audios a
    JOIN likes l ON a.id = l.audio_id
    WHERE l.created_at >= (NOW() - INTERVAL '7 days')
    GROUP BY a.user_id
    
    UNION ALL
    
    -- Count comments received on user's audios in the last 7 days
    SELECT 
        a.user_id, 
        COUNT(c.id) as interaction_count
    FROM audios a
    JOIN comments c ON a.id = c.audio_id
    WHERE c.created_at >= (NOW() - INTERVAL '7 days')
    GROUP BY a.user_id
  )
  SELECT 
    us.user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    SUM(us.interaction_count)::BIGINT as score
  FROM user_scores us
  JOIN profiles p ON us.user_id = p.id
  GROUP BY us.user_id, p.username, p.full_name, p.avatar_url
  ORDER BY score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to generate weekly notifications
-- This should be run by a scheduler (pg_cron) or manually every Sunday night
CREATE OR REPLACE FUNCTION generate_weekly_rewards()
RETURNS void AS $$
DECLARE
    contributor RECORD;
    popular RECORD;
    rank INT;
BEGIN
    -- Process Top Contributors
    rank := 1;
    FOR contributor IN (SELECT * FROM get_weekly_top_contributors(10)) LOOP
        INSERT INTO notifications (user_id, actor_id, type, created_at, metadata)
        VALUES (
            contributor.user_id, 
            contributor.user_id, -- Self-referencing as actor since it's a system message
            'weekly_rank', 
            NOW(),
            jsonb_build_object(
                'rank', rank,
                'category', 'contributor',
                'score', contributor.score
            )
        );
        rank := rank + 1;
    END LOOP;

    -- Process Popular Creators
    rank := 1;
    FOR popular IN (SELECT * FROM get_weekly_popular_creators(10)) LOOP
        -- Avoid duplicate notification if they won both categories? 
        -- Or send both? Let's send both for now.
        INSERT INTO notifications (user_id, actor_id, type, created_at, metadata)
        VALUES (
            popular.user_id, 
            popular.user_id, 
            'weekly_rank', 
            NOW(),
            jsonb_build_object(
                'rank', rank,
                'category', 'popular',
                'score', popular.score
            )
        );
        rank := rank + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
