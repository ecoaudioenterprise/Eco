-- Asegurar que la columna avatar_url existe en la tabla profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Asegurar que la columna is_pro existe en la tabla profiles (para las suscripciones)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false;

-- Asegurar que las políticas de Storage permiten subir avatares
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Borrar políticas antiguas si existen para evitar conflictos (opcional, pero recomendado si da error de duplicado)
-- DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
-- DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
-- DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;

-- Crear políticas de seguridad para el bucket 'avatars'
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'Avatar images are publicly accessible' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
      CREATE POLICY "Avatar images are publicly accessible" 
      ON storage.objects FOR SELECT 
      USING ( bucket_id = 'avatars' );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload an avatar' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
      CREATE POLICY "Anyone can upload an avatar" 
      ON storage.objects FOR INSERT 
      WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update their own avatar' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
      CREATE POLICY "Anyone can update their own avatar" 
      ON storage.objects FOR UPDATE 
      USING ( bucket_id = 'avatars' AND auth.uid() = owner ) 
      WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );
    END IF;
  END
  $$;
COMMIT;
