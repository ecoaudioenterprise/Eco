
-- Add privacy_settings column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"profile_photo_public": true, "show_location": true}';

-- Update existing profiles to have default privacy settings if null
UPDATE profiles 
SET privacy_settings = '{"profile_photo_public": true, "show_location": true}' 
WHERE privacy_settings IS NULL;
