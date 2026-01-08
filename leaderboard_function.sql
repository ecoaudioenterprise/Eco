CREATE OR REPLACE FUNCTION get_top_contributors(limit_count INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  audio_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    COUNT(a.id) as audio_count
  FROM audios a
  JOIN profiles p ON a.user_id = p.id
  GROUP BY a.user_id, p.username, p.full_name, p.avatar_url
  ORDER BY audio_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
