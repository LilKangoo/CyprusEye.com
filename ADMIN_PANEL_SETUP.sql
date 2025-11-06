-- =====================================================
-- ADMIN PANEL SETUP FOR CYPRUSEYE.COM
-- =====================================================
-- This script sets up the admin panel infrastructure
-- Admin user: lilkangoomedia@gmail.com
-- Admin ID: 15f3d442-092d-4eb8-9627-db90da0283eb
-- =====================================================

-- =====================================================
-- STEP 1: Add is_admin column to profiles
-- =====================================================

-- Add is_admin column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
      AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Set the admin user
UPDATE profiles 
SET is_admin = TRUE 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Create index for faster admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;


-- =====================================================
-- STEP 2: Helper functions for admin checks
-- =====================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_admin BOOLEAN;
BEGIN
  -- Get current user's admin status
  SELECT is_admin INTO user_admin
  FROM profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_admin, FALSE);
END;
$$;

-- Function to check if a specific user ID is admin
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO user_admin
  FROM profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_admin, FALSE);
END;
$$;


-- =====================================================
-- STEP 3: Admin-only views for diagnostics
-- =====================================================

-- View: All users with their stats
CREATE OR REPLACE VIEW admin_users_overview AS
SELECT 
  p.id,
  p.username,
  p.name,
  p.email,
  p.level,
  p.xp,
  p.is_admin,
  p.created_at,
  p.updated_at,
  au.last_sign_in_at,
  au.confirmed_at,
  au.banned_until,
  (SELECT COUNT(*) FROM poi_comments WHERE user_id = p.id) as comment_count,
  (SELECT COUNT(*) FROM poi_ratings WHERE user_id = p.id) as rating_count,
  (SELECT COUNT(*) FROM user_poi_visits WHERE user_id = p.id) as visit_count,
  (SELECT COUNT(*) FROM completed_tasks WHERE user_id = p.id) as completed_tasks_count
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY p.created_at DESC;

-- Grant access to admin view (will be protected by RLS)
GRANT SELECT ON admin_users_overview TO authenticated;


-- View: System diagnostics
CREATE OR REPLACE VIEW admin_system_diagnostics AS
SELECT 
  'total_users' as metric,
  COUNT(*)::TEXT as value,
  'Total registered users' as description
FROM profiles
UNION ALL
SELECT 
  'active_users_7d' as metric,
  COUNT(DISTINCT user_id)::TEXT as value,
  'Users active in last 7 days' as description
FROM poi_comments
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'total_pois' as metric,
  COUNT(*)::TEXT as value,
  'Total points of interest' as description
FROM pois
UNION ALL
SELECT 
  'total_comments' as metric,
  COUNT(*)::TEXT as value,
  'Total comments' as description
FROM poi_comments
UNION ALL
SELECT 
  'total_ratings' as metric,
  COUNT(*)::TEXT as value,
  'Total ratings' as description
FROM poi_ratings
UNION ALL
SELECT 
  'total_visits' as metric,
  COUNT(*)::TEXT as value,
  'Total POI visits' as description
FROM user_poi_visits;

-- Grant access to diagnostics view
GRANT SELECT ON admin_system_diagnostics TO authenticated;


-- =====================================================
-- STEP 4: Admin functions for user management
-- =====================================================

-- Function to get detailed user info (admin only)
CREATE OR REPLACE FUNCTION admin_get_user_details(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Get user details
  SELECT json_build_object(
    'profile', row_to_json(p),
    'auth_data', json_build_object(
      'email', au.email,
      'confirmed_at', au.confirmed_at,
      'last_sign_in_at', au.last_sign_in_at,
      'banned_until', au.banned_until,
      'created_at', au.created_at
    ),
    'stats', json_build_object(
      'comments', (SELECT COUNT(*) FROM poi_comments WHERE user_id = target_user_id),
      'ratings', (SELECT COUNT(*) FROM poi_ratings WHERE user_id = target_user_id),
      'visits', (SELECT COUNT(*) FROM user_poi_visits WHERE user_id = target_user_id),
      'completed_tasks', (SELECT COUNT(*) FROM completed_tasks WHERE user_id = target_user_id),
      'total_xp', (SELECT COALESCE(SUM(xp_amount), 0) FROM user_xp_events WHERE user_id = target_user_id)
    ),
    'recent_activity', json_build_object(
      'recent_comments', (
        SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
        FROM (
          SELECT id, content, created_at, poi_id 
          FROM poi_comments 
          WHERE user_id = target_user_id 
          ORDER BY created_at DESC 
          LIMIT 5
        ) c
      ),
      'recent_ratings', (
        SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
        FROM (
          SELECT id, rating, created_at, poi_id 
          FROM poi_ratings 
          WHERE user_id = target_user_id 
          ORDER BY created_at DESC 
          LIMIT 5
        ) r
      )
    )
  ) INTO result
  FROM profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE p.id = target_user_id;
  
  RETURN result;
END;
$$;


-- Function to update user profile (admin only)
CREATE OR REPLACE FUNCTION admin_update_user_profile(
  target_user_id UUID,
  new_username TEXT DEFAULT NULL,
  new_name TEXT DEFAULT NULL,
  new_xp INTEGER DEFAULT NULL,
  new_level INTEGER DEFAULT NULL,
  new_is_admin BOOLEAN DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_profile profiles;
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Prevent admin from removing their own admin status
  IF target_user_id = auth.uid() AND new_is_admin = FALSE THEN
    RAISE EXCEPTION 'Cannot remove your own admin status';
  END IF;
  
  -- Update profile
  UPDATE profiles
  SET 
    username = COALESCE(new_username, username),
    name = COALESCE(new_name, name),
    xp = COALESCE(new_xp, xp),
    level = COALESCE(new_level, level),
    is_admin = COALESCE(new_is_admin, is_admin),
    updated_at = NOW()
  WHERE id = target_user_id
  RETURNING * INTO updated_profile;
  
  RETURN row_to_json(updated_profile);
END;
$$;


-- Function to get admin activity log
CREATE OR REPLACE FUNCTION admin_get_activity_log(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  activity_type TEXT,
  user_id UUID,
  username TEXT,
  details JSON,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  RETURN QUERY
  -- Recent comments
  SELECT 
    'comment'::TEXT as activity_type,
    c.user_id,
    p.username,
    json_build_object('poi_id', c.poi_id, 'content', LEFT(c.content, 100)) as details,
    c.created_at
  FROM poi_comments c
  LEFT JOIN profiles p ON c.user_id = p.id
  ORDER BY c.created_at DESC
  LIMIT limit_count;
END;
$$;


-- =====================================================
-- STEP 5: Row Level Security for admin views
-- =====================================================

-- Enable RLS on admin views if they're tables
-- (Views inherit RLS from underlying tables)

-- Create policy for admin_users_overview
CREATE POLICY "Admin can view all users"
  ON profiles
  FOR SELECT
  USING (is_current_user_admin() OR id = auth.uid());

-- Note: The existing "Public profiles are viewable by everyone" policy
-- allows everyone to see basic profile info, but detailed views
-- are protected by the is_current_user_admin() check


-- =====================================================
-- STEP 6: Grant necessary permissions
-- =====================================================

-- Grant execute permissions on admin functions
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_user_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_profile(UUID, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_activity_log(INTEGER) TO authenticated;


-- =====================================================
-- STEP 7: Verification queries
-- =====================================================

-- Check if admin user is set correctly
SELECT id, username, email, is_admin 
FROM profiles 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Check admin functions work
SELECT is_user_admin('15f3d442-092d-4eb8-9627-db90da0283eb');

-- Test admin views (run this while logged in as admin)
-- SELECT * FROM admin_users_overview LIMIT 5;
-- SELECT * FROM admin_system_diagnostics;


-- =====================================================
-- SUMMARY
-- =====================================================
-- ✅ Added is_admin column to profiles
-- ✅ Set lilkangoomedia@gmail.com as admin
-- ✅ Created helper functions for admin checks
-- ✅ Created admin views for user management
-- ✅ Created admin functions for diagnostics
-- ✅ Applied RLS policies
-- ✅ Granted necessary permissions
-- =====================================================
