-- SQL para arreglar los permisos de almacenamiento (Storage RLS)

-- 1. Asegurarnos de que los buckets existen y son públicos
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('audios', 'audios', true)
on conflict (id) do update set public = true;

-- 2. Eliminar políticas antiguas para evitar conflictos (opcional, pero recomendado si hay basura)
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Anyone can upload an avatar" on storage.objects;
drop policy if exists "Anyone can update their own avatar" on storage.objects;
drop policy if exists "Audio files are publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload audio" on storage.objects;
drop policy if exists "Users can update their own audio" on storage.objects;
drop policy if exists "Users can delete their own audio" on storage.objects;

-- 3. Crear nuevas políticas para 'avatars'
-- Permitir ver avatares a todo el mundo (público)
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Permitir subir avatares a usuarios autenticados
create policy "Anyone can upload an avatar"
  on storage.objects for insert
  with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- Permitir actualizar su propio avatar
create policy "Anyone can update their own avatar"
  on storage.objects for update
  using ( bucket_id = 'avatars' and auth.uid() = owner )
  with check ( bucket_id = 'avatars' and auth.uid() = owner );

-- 4. Crear nuevas políticas para 'audios'
-- Permitir escuchar audios a todo el mundo
create policy "Audio files are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'audios' );

-- Permitir subir audios a usuarios autenticados
create policy "Authenticated users can upload audio"
  on storage.objects for insert
  with check ( bucket_id = 'audios' and auth.role() = 'authenticated' );

-- Permitir actualizar sus propios audios
create policy "Users can update their own audio"
  on storage.objects for update
  using ( bucket_id = 'audios' and auth.uid() = owner )
  with check ( bucket_id = 'audios' and auth.uid() = owner );

-- Permitir borrar sus propios audios
create policy "Users can delete their own audio"
  on storage.objects for delete
  using ( bucket_id = 'audios' and auth.uid() = owner );
