-- 1. Crear perfiles faltantes con nombres de usuario únicos garantizados
-- Usamos un sufijo aleatorio para evitar el error de "username already exists"
INSERT INTO public.profiles (id, full_name, avatar_url, username)
SELECT 
    au.id, 
    au.raw_user_meta_data->>'full_name', 
    au.raw_user_meta_data->>'avatar_url',
    -- Si el usuario es 'javii_jg', se guardará como 'javii_jg_a1b2c3' para asegurar que sea único
    COALESCE(au.raw_user_meta_data->>'username', 'user') || '_' || substr(md5(au.id::text || clock_timestamp()::text), 1, 6)
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.profiles);

-- 2. Corregir Políticas de RLS para Likes
DROP POLICY IF EXISTS "Usuarios autenticados pueden dar like" ON public.likes;
CREATE POLICY "Usuarios autenticados pueden dar like"
  ON public.likes FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Usuarios pueden quitar su like" ON public.likes;
CREATE POLICY "Usuarios pueden quitar su like"
  ON public.likes FOR DELETE
  USING ( auth.uid() = user_id );

-- 3. Corregir Políticas de RLS para Comentarios
DROP POLICY IF EXISTS "Usuarios autenticados pueden comentar" ON public.comments;
CREATE POLICY "Usuarios autenticados pueden comentar"
  ON public.comments FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Usuarios pueden borrar sus propios comentarios" ON public.comments;
CREATE POLICY "Usuarios pueden borrar sus propios comentarios"
  ON public.comments FOR DELETE
  USING ( auth.uid() = user_id );

-- 4. Asegurar permisos
GRANT ALL ON public.likes TO authenticated;
GRANT ALL ON public.comments TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
