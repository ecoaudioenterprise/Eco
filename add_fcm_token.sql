ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fcm_token text;

-- Create a function to update the token (optional, but good for security/logic)
-- Or just allow users to update their own profile (already covered by RLS usually)
