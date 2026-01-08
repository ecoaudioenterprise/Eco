-- Tabla de Perfiles (Profiles)
-- Se vincula automáticamente con la tabla de usuarios de Supabase (auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  description text,
  avatar_url text,
  website text,
  username_last_changed timestamp with time zone,
  
  constraint username_length check (char_length(username) >= 3)
);

-- Habilitar seguridad (RLS)
alter table public.profiles enable row level security;

-- Políticas de seguridad para perfiles
create policy "Los perfiles son públicos"
  on profiles for select
  using ( true );

create policy "Los usuarios pueden crear su propio perfil"
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Los usuarios pueden editar su propio perfil"
  on profiles for update
  using ( auth.uid() = id );

-- Tabla de Audios
create table public.audios (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text,
  file_url text not null, -- URL del archivo en Supabase Storage
  duration float, -- Duración en segundos
  latitude float not null,
  longitude float not null,
  user_id uuid references public.profiles(id) not null
);

-- Habilitar seguridad (RLS)
alter table public.audios enable row level security;

-- Políticas de seguridad para audios
create policy "Cualquiera puede escuchar los audios"
  on public.audios for select
  using ( true );

create policy "Usuarios autenticados pueden subir audios"
  on public.audios for insert
  with check ( auth.uid() = user_id );

create policy "Usuarios pueden editar sus propios audios"
  on public.audios for update
  using ( auth.uid() = user_id );

create policy "Usuarios pueden borrar sus propios audios"
  on public.audios for delete
  using ( auth.uid() = user_id );

-- Tabla de Comentarios
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content text not null,
  audio_id text not null, -- Puede ser UUID (Supabase) o timestamp string (Local)
  user_id uuid references public.profiles(id) not null
);

-- Habilitar seguridad (RLS) para comentarios
alter table public.comments enable row level security;

-- Políticas de seguridad para comentarios
create policy "Los comentarios son públicos"
  on public.comments for select
  using ( true );

create policy "Usuarios autenticados pueden comentar"
  on public.comments for insert
  with check ( auth.uid() = user_id );

create policy "Usuarios pueden borrar sus propios comentarios"
  on public.comments for delete
  using ( auth.uid() = user_id );

-- Tabla de Me Gusta (Likes)
create table public.likes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  audio_id text not null, -- Puede ser UUID (Supabase) o timestamp string (Local)
  user_id uuid references public.profiles(id) not null,
  
  -- Asegurar que un usuario solo pueda dar like una vez por audio
  unique(audio_id, user_id)
);

-- Habilitar seguridad (RLS) para likes
alter table public.likes enable row level security;

-- Políticas de seguridad para likes
create policy "Los likes son públicos"
  on public.likes for select
  using ( true );

create policy "Usuarios autenticados pueden dar like"
  on public.likes for insert
  with check ( auth.uid() = user_id );

create policy "Usuarios pueden quitar su like"
  on public.likes for delete
  using ( auth.uid() = user_id );

-- Trigger para crear perfil automáticamente al registrarse
-- Esto asegura que cada vez que alguien se registre, tenga una entrada en 'profiles'
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Función y Trigger para restringir el cambio de nombre de usuario cada 30 días
create or replace function public.check_username_change()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Si el nombre de usuario está cambiando
  if new.username is distinct from old.username then
    -- Verificar si ha cambiado en los últimos 30 días
    -- MODIFICADO: Reducido a 1 minuto para facilitar pruebas. 
    -- Para producción, cambiar '1 minute' por '30 days'.
    if old.username_last_changed is not null and 
       old.username_last_changed > (now() - interval '1 minute') then
      raise exception 'Debes esperar un poco antes de cambiar tu nombre de nuevo.';
    end if;
    
    -- Actualizar la fecha del último cambio
    new.username_last_changed := now();
  end if;
  return new;
end;
$$;

create trigger on_profile_username_change
  before update on public.profiles
  for each row
  execute procedure public.check_username_change();

-- NOTA: Recuerda crear un Bucket en Storage llamado 'audios' y 'avatars' y hacerlos públicos.

-- Políticas de Storage (Añadido para referencia)
-- Para aplicarlas, ejecuta el contenido de fix_storage_rls.sql o copia lo siguiente:

-- Buckets
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('audios', 'audios', true) on conflict do nothing;

-- Policies Avatars
create policy "Avatar images are publicly accessible" on storage.objects for select using ( bucket_id = 'avatars' );
create policy "Anyone can upload an avatar" on storage.objects for insert with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );
create policy "Anyone can update their own avatar" on storage.objects for update using ( bucket_id = 'avatars' and auth.uid() = owner );

-- Policies Audios
create policy "Audio files are publicly accessible" on storage.objects for select using ( bucket_id = 'audios' );
create policy "Authenticated users can upload audio" on storage.objects for insert with check ( bucket_id = 'audios' and auth.role() = 'authenticated' );
create policy "Users can update their own audio" on storage.objects for update using ( bucket_id = 'audios' and auth.uid() = owner );
create policy "Users can delete their own audio" on storage.objects for delete using ( bucket_id = 'audios' and auth.uid() = owner );
