-- Add is_admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Update RLS policies for audios
-- Policy for admins to select all audios
DROP POLICY IF EXISTS "Admins can view all audios" ON audios;
CREATE POLICY "Admins can view all audios" ON audios
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
        )
    );

-- Policy for admins to delete any audio
DROP POLICY IF EXISTS "Admins can delete any audio" ON audios;
CREATE POLICY "Admins can delete any audio" ON audios
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
        )
    );

-- Update RLS policies for profiles (so admin can see all users if needed)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
        )
    );
