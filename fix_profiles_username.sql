-- 1. Asegurar políticas de UPDATE en profiles
DROP POLICY IF EXISTS "Los usuarios pueden editar su propio perfil" ON public.profiles;
CREATE POLICY "Los usuarios pueden editar su propio perfil"
ON public.profiles FOR UPDATE
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

DROP POLICY IF EXISTS "Los usuarios pueden insertar su propio perfil" ON public.profiles;
CREATE POLICY "Los usuarios pueden insertar su propio perfil"
ON public.profiles FOR INSERT
WITH CHECK ( auth.uid() = id );


-- 2. Actualizar el trigger handle_new_user para incluir username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, username)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username' -- Incluir username si existe
  );
  RETURN new;
END;
$$;


-- 3. Script de reparación para usuarios existentes sin username en profiles
-- Copia el username desde auth.users metadata a profiles
UPDATE public.profiles p
SET username = u.raw_user_meta_data->>'username'
FROM auth.users u
WHERE p.id = u.id
AND p.username IS NULL
AND u.raw_user_meta_data->>'username' IS NOT NULL;

-- 4. Asegurar que admin view no muestre 'sin_usuario' si hay datos
-- (Esto ya se arregla con el update anterior, pero es bueno confirmar)
