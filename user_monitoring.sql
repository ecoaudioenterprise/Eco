-- Add user monitoring columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Create an index on last_seen for better query performance if we want to sort users by activity
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen);
