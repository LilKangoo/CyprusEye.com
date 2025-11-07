-- =====================================================
-- 🚀 CYPRUSEYE ADMIN PANEL - COMPLETE DEPLOYMENT
-- =====================================================
-- Run this ENTIRE file in Supabase SQL Editor
-- This will create all views, functions, and policies needed for admin panel
-- Admin user: lilkangoomedia@gmail.com (ID: 15f3d442-092d-4eb8-9627-db90da0283eb)
-- =====================================================

-- =====================================================
-- STEP 1: Ensure profiles table has required columns
-- =====================================================

-- Add is_admin column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add moderation columns
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS ban_permanent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_moderator boolean DEFAULT false;

-- Set the admin user (create profile if it doesn't exist)
INSERT INTO profiles (id, is_admin, email, username)
SELECT 
  id,
  true as is_admin,
  email,
  COALESCE(raw_user_meta_data->>'username', email) as username
FROM auth.users
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb'
ON CONFLICT (id) DO UPDATE
SET is_admin = true;

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
-- STEP 3: Admin-only views for dashboard
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

-- Grant access to admin view
GRANT SELECT ON admin_users_overview TO authenticated;


-- View: System diagnostics for dashboard
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
FROM poi_comments;

-- Grant access to diagnostics view
GRANT SELECT ON admin_system_diagnostics TO authenticated;


-- =====================================================
-- STEP 4: RPC function to get user details
-- =====================================================

-- Drop old version first (may have different return type)
DROP FUNCTION IF EXISTS admin_get_user_details(UUID);

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
      'completed_tasks', (SELECT COUNT(*) FROM completed_tasks WHERE user_id = target_user_id)
    )
  ) INTO result
  FROM profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE p.id = target_user_id;
  
  RETURN result;
END;
$$;


-- =====================================================
-- STEP 5: RPC function to get activity log
-- =====================================================

-- Drop old version first (may have different return type)
DROP FUNCTION IF EXISTS admin_get_activity_log(INTEGER);

CREATE OR REPLACE FUNCTION admin_get_activity_log(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  activity_type TEXT,
  username TEXT,
  details TEXT,
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
  SELECT 
    'comment'::TEXT as activity_type,
    p.username,
    SUBSTRING(c.content, 1, 100) as details,
    c.created_at
  FROM poi_comments c
  JOIN profiles p ON c.user_id = p.id
  ORDER BY c.created_at DESC
  LIMIT limit_count;
END;
$$;


-- =====================================================
-- STEP 6: RPC functions for user management
-- =====================================================

-- Ban user
CREATE OR REPLACE FUNCTION admin_ban_user(
  target_user_id UUID,
  ban_until TIMESTAMPTZ,
  reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Cannot ban yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;
  
  -- Update user
  UPDATE profiles
  SET 
    banned_until = ban_until,
    ban_reason = reason
  WHERE id = target_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Unban user
CREATE OR REPLACE FUNCTION admin_unban_user(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Update user
  UPDATE profiles
  SET 
    banned_until = NULL,
    ban_reason = NULL,
    ban_permanent = FALSE
  WHERE id = target_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Toggle admin status
CREATE OR REPLACE FUNCTION admin_toggle_admin(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_status BOOLEAN;
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Cannot remove your own admin status
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove your own admin status';
  END IF;
  
  -- Toggle admin status
  UPDATE profiles
  SET is_admin = NOT is_admin
  WHERE id = target_user_id
  RETURNING is_admin INTO new_status;
  
  RETURN json_build_object('success', true, 'is_admin', new_status);
END;
$$;

-- Delete user
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Cannot delete yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;
  
  -- Delete from auth.users (CASCADE will handle profiles)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;


-- =====================================================
-- STEP 7: Row Level Security Policies
-- =====================================================

-- Enable RLS on admin views (they use the helper functions internally)
-- Views inherit permissions from underlying tables

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION admin_get_user_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_activity_log(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_ban_user(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_unban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;


-- =====================================================
-- VERIFICATION QUERIES (run these AFTER deployment to verify)
-- =====================================================
-- NOTE: Don't run these in the same query as the deployment!
-- Run them separately to verify everything works.

-- Test 1: Check if admin user is set correctly
-- SELECT id, email, username, is_admin 
-- FROM profiles 
-- WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Test 2: Check system diagnostics view
-- SELECT * FROM admin_system_diagnostics;

-- Test 3: Check users overview
-- SELECT id, username, email, is_admin, comment_count 
-- FROM admin_users_overview 
-- LIMIT 5;

-- NOTE: To test RPC functions, you must be logged in as admin user in the app
-- They will fail in SQL Editor because auth.uid() is NULL

-- =====================================================
-- DEPLOYMENT COMPLETE! 🎉
-- =====================================================
-- After running this script:
-- 1. Refresh your admin panel at https://cypruseye.com/admin
-- 2. Dashboard stats should load automatically
-- 3. Users → View button should work
-- 4. All admin functions should be operational
-- =====================================================
