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
