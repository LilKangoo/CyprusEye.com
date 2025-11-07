-- =====================================================
-- 🔧 KOMPLETNA KONFIGURACJA PANELU ADMINA
-- =====================================================
-- Uruchom CAŁY ten plik w Supabase SQL Editor
-- To utworzy WSZYSTKIE potrzebne funkcje i views
-- =====================================================

-- =====================================================
-- KROK 1: Napraw profil admina
-- =====================================================

UPDATE profiles
SET 
  is_admin = TRUE,
  is_moderator = FALSE,
  ban_permanent = FALSE,
  banned_until = NULL,
  ban_reason = NULL,
  require_password_change = FALSE,
  require_email_update = FALSE,
  updated_at = NOW()
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';


-- =====================================================
-- KROK 2: Funkcje pomocnicze (is_admin checks)
-- =====================================================

-- Funkcja: Czy aktualny użytkownik jest adminem
CREATE OR REPLACE FUNCTION is_current_user_admin()
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
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_admin, FALSE);
END;
$$;

-- Funkcja: Czy dany user ID jest adminem
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
-- KROK 3: Views dla admina
-- =====================================================

-- View: Lista wszystkich użytkowników
DROP VIEW IF EXISTS admin_users_overview CASCADE;
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
  p.banned_until,
  (SELECT COUNT(*) FROM poi_comments WHERE user_id = p.id) as comment_count,
  (SELECT COUNT(*) FROM poi_ratings WHERE user_id = p.id) as rating_count,
  (SELECT COUNT(*) FROM user_poi_visits WHERE user_id = p.id) as visit_count,
  (SELECT COUNT(*) FROM completed_tasks WHERE user_id = p.id) as completed_tasks_count
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY p.created_at DESC;

-- Grant access
GRANT SELECT ON admin_users_overview TO authenticated;


-- View: Diagnostyka systemu
DROP VIEW IF EXISTS admin_system_diagnostics CASCADE;
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

-- Grant access
GRANT SELECT ON admin_system_diagnostics TO authenticated;


-- =====================================================
-- KROK 4: RPC Functions
-- =====================================================

-- Function: Get user details
DROP FUNCTION IF EXISTS admin_get_user_details(UUID);
CREATE OR REPLACE FUNCTION admin_get_user_details(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Get data
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


-- Function: Get activity log
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
  -- Check admin
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


-- Function: Ban user
DROP FUNCTION IF EXISTS admin_ban_user(UUID, TIMESTAMPTZ, TEXT);
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
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;
  
  UPDATE profiles
  SET 
    banned_until = ban_until,
    ban_reason = reason
  WHERE id = target_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;


-- Function: Unban user
DROP FUNCTION IF EXISTS admin_unban_user(UUID);
CREATE OR REPLACE FUNCTION admin_unban_user(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  UPDATE profiles
  SET 
    banned_until = NULL,
    ban_reason = NULL,
    ban_permanent = FALSE
  WHERE id = target_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;


-- Function: Toggle admin status
DROP FUNCTION IF EXISTS admin_toggle_admin(UUID);
CREATE OR REPLACE FUNCTION admin_toggle_admin(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_status BOOLEAN;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own admin status';
  END IF;
  
  UPDATE profiles
  SET is_admin = NOT is_admin
  WHERE id = target_user_id
  RETURNING is_admin INTO new_status;
  
  RETURN json_build_object('success', true, 'is_admin', new_status);
END;
$$;


-- Function: Delete user
DROP FUNCTION IF EXISTS admin_delete_user(UUID);
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;
  
  DELETE FROM auth.users WHERE id = target_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;


-- Function: Update POI
DROP FUNCTION IF EXISTS admin_update_poi(UUID, JSONB);
CREATE OR REPLACE FUNCTION admin_update_poi(
  poi_id UUID,
  updates JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Update POI (only allowed fields)
  UPDATE pois
  SET
    name = COALESCE(updates->>'name', name),
    description = COALESCE(updates->>'description', description),
    latitude = COALESCE((updates->>'latitude')::FLOAT, latitude),
    longitude = COALESCE((updates->>'longitude')::FLOAT, longitude),
    status = COALESCE(updates->>'status', status),
    updated_at = NOW()
  WHERE id = poi_id;
  
  RETURN json_build_object('success', true);
END;
$$;


-- =====================================================
-- KROK 5: RLS Policies
-- =====================================================

-- Enable RLS on profiles if not enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Policy: View profiles
CREATE POLICY "Users can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can see all
    is_current_user_admin()
    OR 
    -- User can see own profile
    id = auth.uid()
    OR
    -- Anyone can see public profiles
    TRUE
  );

-- Policy: Update profiles  
CREATE POLICY "Users can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update all
    is_current_user_admin()
    OR 
    -- User can update own
    id = auth.uid()
  );


-- =====================================================
-- KROK 6: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_user_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_activity_log(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_ban_user(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_unban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_poi(UUID, JSONB) TO authenticated;


-- =====================================================
-- KROK 7: Weryfikacja
-- =====================================================

-- Sprawdź profil admina
SELECT 
  id,
  email,
  username,
  is_admin,
  ban_permanent,
  require_password_change
FROM profiles
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Sprawdź POIs
SELECT COUNT(*) as total_pois FROM pois;

-- Sprawdź views
SELECT * FROM admin_system_diagnostics;


-- =====================================================
-- ✅ DEPLOYMENT COMPLETE!
-- =====================================================
-- Po uruchomieniu:
-- 1. Wyloguj się z admin panelu
-- 2. Zaloguj się ponownie
-- 3. Otwórz: https://cypruseye.com/admin
-- 4. Wszystko powinno działać!
-- =====================================================
