-- Create a function to check if a user is an admin
-- SECURITY DEFINER allows this function to run with the privileges of the creator (postgres/admin), 
-- bypassing RLS on the profiles table to avoid infinite recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the policy for profiles to use the function
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT
    USING (
        public.is_admin()
    );

-- Update the policy for audios to use the function (for consistency and safety)
DROP POLICY IF EXISTS "Admins can view all audios" ON audios;
CREATE POLICY "Admins can view all audios" ON audios
    FOR SELECT
    USING (
        public.is_admin()
    );

DROP POLICY IF EXISTS "Admins can delete any audio" ON audios;
CREATE POLICY "Admins can delete any audio" ON audios
    FOR DELETE
    USING (
        public.is_admin()
    );
