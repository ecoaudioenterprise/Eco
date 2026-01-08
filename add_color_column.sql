-- Add color column to audios table
ALTER TABLE public.audios 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#f97316';

-- Update existing rows to have the default orange color
UPDATE public.audios 
SET color = '#f97316' 
WHERE color IS NULL;
