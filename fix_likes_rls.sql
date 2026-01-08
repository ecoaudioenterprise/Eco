-- Enable RLS on likes table
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to insert their own likes
CREATE POLICY "Users can insert their own likes" ON likes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to delete their own likes
CREATE POLICY "Users can delete their own likes" ON likes
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Policy to allow everyone to view likes (needed for counting/checking status)
CREATE POLICY "Everyone can view likes" ON likes
FOR SELECT TO public
USING (true);
