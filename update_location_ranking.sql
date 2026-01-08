-- Add location columns to profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'country') THEN
        ALTER TABLE profiles ADD COLUMN country TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'region') THEN
        ALTER TABLE profiles ADD COLUMN region TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'city') THEN
        ALTER TABLE profiles ADD COLUMN city TEXT;
    END IF;
END $$;

-- Weekly Top Contributors with Scope
CREATE OR REPLACE FUNCTION get_weekly_top_contributors(
  limit_count INT DEFAULT 10,
  scope TEXT DEFAULT 'national',
  viewer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  score BIGINT
) AS $$
DECLARE
  v_country TEXT;
  v_region TEXT;
  v_city TEXT;
BEGIN
  -- Get viewer's location if needed
  IF scope IN ('national', 'regional', 'local') AND viewer_id IS NOT NULL THEN
    SELECT country, region, city INTO v_country, v_region, v_city
    FROM profiles WHERE id = viewer_id;
  END IF;

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
    AND (
      (scope = 'national' AND p.country = v_country) OR
      (scope = 'regional' AND p.country = v_country AND p.region = v_region) OR
      (scope = 'local' AND p.country = v_country AND p.city = v_city) OR
      -- Fallback for safety if needed, though UI won't send 'global'
      (scope = 'global') 
    )
  GROUP BY a.user_id, p.username, p.full_name, p.avatar_url
  ORDER BY score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Weekly Popular Creators with Scope
CREATE OR REPLACE FUNCTION get_weekly_popular_creators(
  limit_count INT DEFAULT 10,
  scope TEXT DEFAULT 'national',
  viewer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  score BIGINT
) AS $$
DECLARE
  v_country TEXT;
  v_region TEXT;
  v_city TEXT;
BEGIN
  -- Get viewer's location if needed
  IF scope IN ('national', 'regional', 'local') AND viewer_id IS NOT NULL THEN
    SELECT country, region, city INTO v_country, v_region, v_city
    FROM profiles WHERE id = viewer_id;
  END IF;

  RETURN QUERY
  SELECT 
    a.user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    COALESCE(SUM(a.likes), 0) + COALESCE(SUM(a.comments), 0) as score
  FROM audios a
  JOIN profiles p ON a.user_id = p.id
  WHERE a.created_at >= (NOW() - INTERVAL '7 days')
    AND (
      (scope = 'national' AND p.country = v_country) OR
      (scope = 'regional' AND p.country = v_country AND p.region = v_region) OR
      (scope = 'local' AND p.country = v_country AND p.city = v_city) OR
      (scope = 'global')
    )
  GROUP BY a.user_id, p.username, p.full_name, p.avatar_url
  ORDER BY score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin_list_users to include location data
-- DROP FUNCTION FIRST to avoid return type change error
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  provider text,
  phone text,
  username text,
  full_name text,
  avatar_url text,
  is_admin boolean,
  is_pro boolean,
  verified boolean,
  banned boolean,
  birth_date date,
  gender text,
  last_seen timestamptz,
  is_online boolean,
  country text,
  region text,
  city text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Only admins can view users.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.raw_app_meta_data->>'provider',
    u.phone,
    p.username,
    p.full_name,
    p.avatar_url,
    COALESCE(p.is_admin, false),
    COALESCE(p.is_pro, false),
    COALESCE(p.verified, false),
    COALESCE(p.banned, false),
    p.birth_date,
    p.gender,
    p.last_seen,
    p.is_online,
    p.country,
    p.region,
    p.city
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Function to generate weekly rewards (to be called by cron)
CREATE OR REPLACE FUNCTION generate_weekly_rewards()
RETURNS void AS $$
DECLARE
  top_contributor RECORD;
  top_popular RECORD;
BEGIN
  -- Logic to award badges or notifications would go here
  -- For now, we just log it or you could insert into a 'rewards' table
  
  -- Example: Insert notification for top contributor (NATIONAL default)
  FOR top_contributor IN 
    SELECT * FROM get_weekly_top_contributors(1, 'national', NULL)
  LOOP
    INSERT INTO notifications (user_id, type, actor_id, read, created_at)
    VALUES (top_contributor.user_id, 'system_alert', NULL, false, NOW());
  END LOOP;
  
  -- Example: Insert notification for top popular (NATIONAL default)
  FOR top_popular IN 
    SELECT * FROM get_weekly_popular_creators(1, 'national', NULL)
  LOOP
     INSERT INTO notifications (user_id, type, actor_id, read, created_at)
    VALUES (top_popular.user_id, 'system_alert', NULL, false, NOW());
  END LOOP;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable pg_cron if not already enabled (requires superuser or dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cron job (Every Sunday at midnight UTC)
-- Note: This usually needs to be run in the SQL Editor of Supabase directly as postgres user
-- SELECT cron.schedule(
--   'weekly-rewards', -- name of the cron job
--   '0 0 * * 0',      -- Sunday at 00:00
--   'SELECT generate_weekly_rewards()'
-- );
