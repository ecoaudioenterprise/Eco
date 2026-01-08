-- Function to delete a user and all their data (Admin only)
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if the executor is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Only admins can delete users.';
  END IF;

  -- Delete related data from tables
  -- Note: We rely on standard deletes. If you have foreign keys with CASCADE, some of this might be redundant but safe.
  
  -- 1. Audios (The storage files should be handled by triggers or manually if needed, but DB records are deleted here)
  DELETE FROM audios WHERE user_id = target_user_id;
  
  -- 2. Comments made by the user
  DELETE FROM comments WHERE user_id = target_user_id;
  
  -- 3. Likes made by the user
  DELETE FROM likes WHERE user_id = target_user_id;
  
  -- 4. Follows (User as follower OR following)
  DELETE FROM follows WHERE follower_id = target_user_id OR following_id = target_user_id;
  
  -- 5. Notifications (User as recipient OR actor)
  DELETE FROM notifications WHERE user_id = target_user_id OR actor_id = target_user_id;
  
  -- 6. Profile (This effectively removes them from the app's view)
  DELETE FROM profiles WHERE id = target_user_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
