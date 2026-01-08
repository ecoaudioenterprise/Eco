-- Add privacy column to audios table if it doesn't exist
ALTER TABLE public.audios 
ADD COLUMN IF NOT EXISTS privacy TEXT DEFAULT 'public';

-- Update existing rows to have 'public' privacy
UPDATE public.audios 
SET privacy = 'public' 
WHERE privacy IS NULL;
