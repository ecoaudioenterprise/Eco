-- Add banned column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE;

-- Allow admins to update the banned status
-- We need to ensure the RLS policy allows this.
-- Existing policy "Admins can view all profiles" is for SELECT.
-- We need an UPDATE policy for admins.

DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles" ON profiles
    FOR UPDATE
    USING (
        public.is_admin()
    );

-- Also ensure the notification type 'admin_msg' is valid
-- We might need to alter the check constraint on notifications.type if it doesn't support 'admin_msg'
-- The user provided list was ('follow', 'request', 'like', 'comment', 'admin_msg') in previous context, so it should be fine.
-- But let's verify or update just in case.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('follow', 'request', 'like', 'comment', 'admin_msg', 'proximity'));
