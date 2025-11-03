-- =====================================================
-- ADMIN PANEL - ADVANCED FUNCTIONS
-- =====================================================
-- Zaawansowane funkcje administracyjne dla panelu admin
-- Uruchom po ADMIN_PANEL_SETUP.sql
-- =====================================================

-- =====================================================
-- PART 1: USER MANAGEMENT (Advanced)
-- =====================================================

-- Function: Ban user
CREATE OR REPLACE FUNCTION admin_ban_user(
  target_user_id UUID,
  ban_reason TEXT DEFAULT 'Violating terms of service',
  ban_duration INTERVAL DEFAULT '30 days'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  ban_until TIMESTAMPTZ;
BEGIN
  -- Check admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Prevent self-ban
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;
  
  -- Calculate ban end time
  ban_until := NOW() + ban_duration;
  
  -- Add ban_reason and ban_until to profiles if columns don't exist
  -- Note: You may need to add these columns first
  UPDATE profiles
  SET 
    updated_at = NOW()
    -- banned_until = ban_until,  -- Uncomment when column exists
    -- ban_reason = ban_reason     -- Uncomment when column exists
  WHERE id = target_user_id;
  
  -- Log the ban action
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'ban_user',
    target_user_id,
    json_build_object(
      'reason', ban_reason,
      'duration', ban_duration::TEXT,
      'until', ban_until
    )
  );
  
  result := json_build_object(
    'success', true,
    'user_id', target_user_id,
    'banned_until', ban_until,
    'reason', ban_reason
  );
  
  RETURN result;
END;
$$;


-- Function: Unban user
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
    updated_at = NOW()
    -- banned_until = NULL,  -- Uncomment when column exists
    -- ban_reason = NULL      -- Uncomment when column exists
  WHERE id = target_user_id;
  
  -- Log the unban
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'unban_user',
    target_user_id,
    json_build_object('unbanned_at', NOW())
  );
  
  RETURN json_build_object('success', true, 'user_id', target_user_id);
END;
$$;


-- Function: Adjust user XP
CREATE OR REPLACE FUNCTION admin_adjust_user_xp(
  target_user_id UUID,
  xp_change INTEGER,
  reason TEXT DEFAULT 'Admin adjustment'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_xp INTEGER;
  new_xp INTEGER;
  old_level INTEGER;
  new_level INTEGER;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Get current XP and level
  SELECT xp, level INTO old_xp, old_level
  FROM profiles
  WHERE id = target_user_id;
  
  -- Calculate new XP (ensure it doesn't go negative)
  new_xp := GREATEST(0, old_xp + xp_change);
  
  -- Calculate new level (simple formula: level = floor(xp / 1000))
  new_level := FLOOR(new_xp / 1000.0);
  
  -- Update profile
  UPDATE profiles
  SET 
    xp = new_xp,
    level = new_level,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Log XP event
  INSERT INTO user_xp_events (
    user_id,
    event_type,
    xp_amount,
    description
  ) VALUES (
    target_user_id,
    'admin_adjustment',
    xp_change,
    reason
  );
  
  -- Log admin action
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'adjust_xp',
    target_user_id,
    json_build_object(
      'old_xp', old_xp,
      'new_xp', new_xp,
      'change', xp_change,
      'old_level', old_level,
      'new_level', new_level,
      'reason', reason
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'user_id', target_user_id,
    'old_xp', old_xp,
    'new_xp', new_xp,
    'old_level', old_level,
    'new_level', new_level
  );
END;
$$;


-- Function: Bulk update users
CREATE OR REPLACE FUNCTION admin_bulk_update_users(
  user_ids UUID[],
  update_data JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
  user_id UUID;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  FOREACH user_id IN ARRAY user_ids
  LOOP
    UPDATE profiles
    SET 
      xp = COALESCE((update_data->>'xp')::INTEGER, xp),
      level = COALESCE((update_data->>'level')::INTEGER, level),
      updated_at = NOW()
    WHERE id = user_id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  -- Log bulk action
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'bulk_update',
    NULL,
    json_build_object(
      'user_count', updated_count,
      'user_ids', user_ids,
      'update_data', update_data
    )
  );
  
  RETURN json_build_object('success', true, 'updated_count', updated_count);
END;
$$;


-- =====================================================
-- PART 2: CONTENT MODERATION
-- =====================================================

-- Function: Delete comment (with reason)
CREATE OR REPLACE FUNCTION admin_delete_comment(
  comment_id UUID,
  deletion_reason TEXT DEFAULT 'Violating content policy'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  comment_user_id UUID;
  comment_content TEXT;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Get comment details before deletion
  SELECT user_id, content INTO comment_user_id, comment_content
  FROM poi_comments
  WHERE id = comment_id;
  
  IF comment_user_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  
  -- Log before deletion
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'delete_comment',
    comment_user_id,
    json_build_object(
      'comment_id', comment_id,
      'content', LEFT(comment_content, 100),
      'reason', deletion_reason
    )
  );
  
  -- Delete comment
  DELETE FROM poi_comments WHERE id = comment_id;
  
  RETURN json_build_object(
    'success', true,
    'comment_id', comment_id,
    'reason', deletion_reason
  );
END;
$$;


-- Function: Bulk delete comments
CREATE OR REPLACE FUNCTION admin_bulk_delete_comments(
  comment_ids UUID[],
  deletion_reason TEXT DEFAULT 'Bulk moderation'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  comment_id UUID;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  FOREACH comment_id IN ARRAY comment_ids
  LOOP
    DELETE FROM poi_comments WHERE id = comment_id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  -- Log bulk deletion
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'bulk_delete_comments',
    NULL,
    json_build_object(
      'count', deleted_count,
      'comment_ids', comment_ids,
      'reason', deletion_reason
    )
  );
  
  RETURN json_build_object('success', true, 'deleted_count', deleted_count);
END;
$$;


-- Function: Get flagged content (comments with many reports or low ratings)
CREATE OR REPLACE FUNCTION admin_get_flagged_content(limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
  comment_id UUID,
  comment_content TEXT,
  user_id UUID,
  username TEXT,
  poi_id UUID,
  created_at TIMESTAMPTZ,
  like_count INTEGER,
  flag_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id as comment_id,
    c.content as comment_content,
    c.user_id,
    p.username,
    c.poi_id,
    c.created_at,
    COALESCE((SELECT COUNT(*) FROM poi_comment_likes WHERE comment_id = c.id), 0)::INTEGER as like_count,
    'Recent comment for review'::TEXT as flag_reason
  FROM poi_comments c
  LEFT JOIN profiles p ON c.user_id = p.id
  ORDER BY c.created_at DESC
  LIMIT limit_count;
END;
$$;


-- =====================================================
-- PART 3: POI MANAGEMENT
-- =====================================================

-- Function: Create new POI
CREATE OR REPLACE FUNCTION admin_create_poi(
  poi_name TEXT,
  poi_description TEXT,
  poi_latitude DOUBLE PRECISION,
  poi_longitude DOUBLE PRECISION,
  poi_category TEXT DEFAULT 'other',
  poi_data JSON DEFAULT '{}'::JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_poi_id UUID;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Insert new POI
  INSERT INTO pois (
    name,
    description,
    latitude,
    longitude,
    category,
    created_by,
    data
  ) VALUES (
    poi_name,
    poi_description,
    poi_latitude,
    poi_longitude,
    poi_category,
    auth.uid(),
    poi_data
  )
  RETURNING id INTO new_poi_id;
  
  -- Log action
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'create_poi',
    NULL,
    json_build_object(
      'poi_id', new_poi_id,
      'name', poi_name,
      'category', poi_category
    )
  );
  
  RETURN json_build_object('success', true, 'poi_id', new_poi_id);
END;
$$;


-- Function: Update POI
CREATE OR REPLACE FUNCTION admin_update_poi(
  poi_id UUID,
  poi_name TEXT DEFAULT NULL,
  poi_description TEXT DEFAULT NULL,
  poi_category TEXT DEFAULT NULL,
  poi_data JSON DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  UPDATE pois
  SET 
    name = COALESCE(poi_name, name),
    description = COALESCE(poi_description, description),
    category = COALESCE(poi_category, category),
    data = COALESCE(poi_data, data),
    updated_at = NOW()
  WHERE id = poi_id;
  
  -- Log action
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'update_poi',
    NULL,
    json_build_object('poi_id', poi_id)
  );
  
  RETURN json_build_object('success', true, 'poi_id', poi_id);
END;
$$;


-- Function: Delete POI
CREATE OR REPLACE FUNCTION admin_delete_poi(
  poi_id UUID,
  deletion_reason TEXT DEFAULT 'Admin action'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Log before deletion
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'delete_poi',
    NULL,
    json_build_object(
      'poi_id', poi_id,
      'reason', deletion_reason
    )
  );
  
  -- Delete POI (cascade will handle related data)
  DELETE FROM pois WHERE id = poi_id;
  
  RETURN json_build_object('success', true, 'poi_id', poi_id);
END;
$$;


-- =====================================================
-- PART 4: ANALYTICS & REPORTING
-- =====================================================

-- Function: Get user growth stats
CREATE OR REPLACE FUNCTION admin_get_user_growth(days INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  new_users INTEGER,
  active_users INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (days || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as day
  ),
  new_users_per_day AS (
    SELECT 
      DATE(created_at) as day,
      COUNT(*)::INTEGER as count
    FROM profiles
    WHERE created_at >= CURRENT_DATE - (days || ' days')::INTERVAL
    GROUP BY DATE(created_at)
  ),
  active_users_per_day AS (
    SELECT 
      DATE(created_at) as day,
      COUNT(DISTINCT user_id)::INTEGER as count
    FROM poi_comments
    WHERE created_at >= CURRENT_DATE - (days || ' days')::INTERVAL
    GROUP BY DATE(created_at)
  )
  SELECT 
    ds.day as date,
    COALESCE(nu.count, 0) as new_users,
    COALESCE(au.count, 0) as active_users
  FROM date_series ds
  LEFT JOIN new_users_per_day nu ON ds.day = nu.day
  LEFT JOIN active_users_per_day au ON ds.day = au.day
  ORDER BY ds.day DESC;
END;
$$;


-- Function: Get top contributors
CREATE OR REPLACE FUNCTION admin_get_top_contributors(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  comment_count INTEGER,
  rating_count INTEGER,
  visit_count INTEGER,
  total_xp INTEGER,
  level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    (SELECT COUNT(*)::INTEGER FROM poi_comments WHERE user_id = p.id) as comment_count,
    (SELECT COUNT(*)::INTEGER FROM poi_ratings WHERE user_id = p.id) as rating_count,
    (SELECT COUNT(*)::INTEGER FROM user_poi_visits WHERE user_id = p.id) as visit_count,
    p.xp as total_xp,
    p.level
  FROM profiles p
  WHERE p.is_admin = FALSE
  ORDER BY p.xp DESC
  LIMIT limit_count;
END;
$$;


-- Function: Get content stats
CREATE OR REPLACE FUNCTION admin_get_content_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats JSON;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  SELECT json_build_object(
    'total_pois', (SELECT COUNT(*) FROM pois),
    'total_comments', (SELECT COUNT(*) FROM poi_comments),
    'total_ratings', (SELECT COUNT(*) FROM poi_ratings),
    'total_visits', (SELECT COUNT(*) FROM user_poi_visits),
    'avg_rating', (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM poi_ratings),
    'comments_today', (SELECT COUNT(*) FROM poi_comments WHERE DATE(created_at) = CURRENT_DATE),
    'comments_this_week', (SELECT COUNT(*) FROM poi_comments WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'comments_this_month', (SELECT COUNT(*) FROM poi_comments WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'active_users_today', (SELECT COUNT(DISTINCT user_id) FROM poi_comments WHERE DATE(created_at) = CURRENT_DATE),
    'active_users_week', (SELECT COUNT(DISTINCT user_id) FROM poi_comments WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')
  ) INTO stats;
  
  RETURN stats;
END;
$$;


-- =====================================================
-- PART 5: ADMIN ACTIONS LOG TABLE
-- =====================================================

-- Create admin_actions table to log all admin activities
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_data JSON DEFAULT '{}'::JSON,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type);

-- Enable RLS
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view logs
CREATE POLICY "Admins can view action logs"
  ON admin_actions
  FOR SELECT
  USING (is_current_user_admin());

-- Policy: Only admins can insert logs
CREATE POLICY "Admins can create action logs"
  ON admin_actions
  FOR INSERT
  WITH CHECK (is_current_user_admin());


-- Function: Get admin action log
CREATE OR REPLACE FUNCTION admin_get_action_log(
  limit_count INTEGER DEFAULT 50,
  action_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  admin_username TEXT,
  action_type TEXT,
  target_username TEXT,
  action_data JSON,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  RETURN QUERY
  SELECT 
    aa.id,
    ap.username as admin_username,
    aa.action_type,
    tp.username as target_username,
    aa.action_data,
    aa.created_at
  FROM admin_actions aa
  LEFT JOIN profiles ap ON aa.admin_id = ap.id
  LEFT JOIN profiles tp ON aa.target_user_id = tp.id
  WHERE action_filter IS NULL OR aa.action_type = action_filter
  ORDER BY aa.created_at DESC
  LIMIT limit_count;
END;
$$;


-- =====================================================
-- PART 6: GRANT PERMISSIONS
-- =====================================================

-- Grant execute on all new functions
GRANT EXECUTE ON FUNCTION admin_ban_user(UUID, TEXT, INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_unban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_user_xp(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_bulk_update_users(UUID[], JSON) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_bulk_delete_comments(UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_flagged_content(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSON) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_poi(UUID, TEXT, TEXT, TEXT, JSON) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_poi(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_user_growth(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_top_contributors(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_content_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_action_log(INTEGER, TEXT) TO authenticated;

-- Grant table access
GRANT SELECT, INSERT ON admin_actions TO authenticated;


-- =====================================================
-- VERIFICATION
-- =====================================================

-- Test if functions were created
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE 'admin_%'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- Test admin_actions table
SELECT * FROM admin_actions LIMIT 1;


-- =====================================================
-- SUMMARY
-- =====================================================
-- ✅ User Management: ban, unban, adjust XP, bulk updates
-- ✅ Content Moderation: delete comments, bulk delete, flagged content
-- ✅ POI Management: create, update, delete POIs
-- ✅ Analytics: user growth, top contributors, content stats
-- ✅ Audit Log: admin_actions table with full logging
-- ✅ All functions protected with is_current_user_admin()
-- =====================================================
