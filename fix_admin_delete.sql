-- FIX COMPLETO PARA ELIMINACIÓN DE USUARIOS (ADMIN)
-- Ejecuta todo este script en el Editor SQL de Supabase

-- 1. Crear función para eliminar usuarios
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verificar si el ejecutor es admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Only admins can delete users.';
  END IF;

  -- Eliminar usuario de auth.users (esto debería desencadenar borrado en cascada en profiles y otras tablas si están bien configuradas)
  -- Nota: Para que esto funcione, necesitamos permisos especiales o bypass RLS, que SECURITY DEFINER proporciona.
  
  -- Primero eliminamos datos relacionados manualmente por si acaso el cascade falla o no está configurado
  DELETE FROM public.audios WHERE user_id = target_user_id;
  DELETE FROM public.comments WHERE user_id = target_user_id;
  DELETE FROM public.likes WHERE user_id = target_user_id;
  DELETE FROM public.follows WHERE follower_id = target_user_id OR following_id = target_user_id;
  DELETE FROM public.notifications WHERE user_id = target_user_id OR actor_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Intentar eliminar de auth.users
  -- Esto solo funcionará si el rol de base de datos que ejecuta la función tiene permisos sobre auth.users.
  -- En Supabase, las funciones SECURITY DEFINER se ejecutan como el dueño (postgres), que tiene permisos.
  DELETE FROM auth.users WHERE id = target_user_id;
  
END;
$$;

-- 2. Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
