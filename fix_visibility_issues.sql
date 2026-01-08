-- Habilitar RLS en audios y profiles por si acaso
ALTER TABLE public.audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para AUDIOS
-- Eliminar políticas de lectura existentes para evitar conflictos
DROP POLICY IF EXISTS "Cualquiera puede escuchar los audios" ON public.audios;
DROP POLICY IF EXISTS "Audio files are publicly accessible" ON public.audios;
DROP POLICY IF EXISTS "Public audios are viewable by everyone" ON public.audios;
DROP POLICY IF EXISTS "Admins can view all audios" ON public.audios;

-- Crear política de lectura pública GLOBAL (para todos los audios)
-- Esta política permite ver TODOS los audios. El filtrado de privacidad (privado/oculto)
-- se hace en el cliente o mediante una vista segura si fuera necesario más seguridad.
CREATE POLICY "Public audios are viewable by everyone" 
ON public.audios FOR SELECT 
USING (true);


-- 2. Políticas para PROFILES
-- Eliminar políticas de lectura existentes
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Crear política de lectura pública GLOBAL
-- Necesaria para ver el nombre y avatar del autor del audio
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);


-- 3. Asegurar columna privacy
ALTER TABLE public.audios 
ADD COLUMN IF NOT EXISTS privacy TEXT DEFAULT 'public';

-- Actualizar nulos a public
UPDATE public.audios 
SET privacy = 'public' 
WHERE privacy IS NULL;
