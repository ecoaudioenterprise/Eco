
-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(follower_id, following_id)
);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read follows (to count followers/following)
CREATE POLICY "Follows are viewable by everyone" 
ON follows FOR SELECT 
USING (true);

-- Authenticated users can follow others
CREATE POLICY "Users can follow others" 
ON follows FOR INSERT 
WITH CHECK (auth.uid() = follower_id);

-- Authenticated users can unfollow
CREATE POLICY "Users can unfollow" 
ON follows FOR DELETE 
USING (auth.uid() = follower_id);

-- Update privacy settings default for existing profiles to include show_followers
UPDATE profiles 
SET privacy_settings = privacy_settings || '{"show_followers": true}'::jsonb 
WHERE NOT (privacy_settings ? 'show_followers');
