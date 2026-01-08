-- FIX COMPLETO PARA PANEL DE ADMINISTRACIÓN (V2 - Con Casting Explícito)
-- Ejecuta todo este script en el Editor SQL de Supabase

-- 1. Asegurar que existe la función is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asegurar columnas en profiles (por si acaso)
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
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_admin') THEN
        ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Asegurar que admin_list_users tiene los tipos EXACTOS
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
  -- Verificar si es admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Only admins can view users.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    (u.raw_app_meta_data->>'provider')::text,
    u.phone::text,
    p.username::text,
    p.full_name::text,
    p.avatar_url::text,
    COALESCE(p.is_admin, false),
    COALESCE(p.is_pro, false),
    COALESCE(p.verified, false),
    COALESCE(p.banned, false),
    p.birth_date,
    p.gender::text,
    p.last_seen,
    p.is_online,
    p.country::text,
    p.region::text,
    p.city::text
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- 4. Otorgar permisos
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
