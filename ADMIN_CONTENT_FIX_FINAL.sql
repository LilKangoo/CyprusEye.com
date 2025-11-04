-- Dodaj to NA POCZĄTKU pliku ADMIN_CONTENT_FIX_FINAL.sql
-- (przed CREATE OR REPLACE FUNCTION admin_get_all_comments)

DROP FUNCTION IF EXISTS admin_get_all_comments(TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS admin_get_comment_details(UUID);
DROP FUNCTION IF EXISTS admin_update_comment(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_delete_comment_photo(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_delete_comment(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_get_all_photos(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS admin_get_detailed_content_stats();
DROP FUNCTION IF EXISTS admin_bulk_comment_operation(UUID[], TEXT, JSON);
-- =====================================================
-- ADMIN CONTENT MANAGEMENT - NAPRAWIONA WERSJA
-- =====================================================
-- Ten plik używa PRAWIDŁOWYCH nazw kolumn
-- Uruchom TYLKO ten plik w Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: CORE DEPENDENCIES
-- =====================================================

-- Function: Check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND is_admin = TRUE
  );
END;
$$;

-- Grant permission
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;


-- =====================================================
-- PART 2: ADMIN ACTIONS TABLE
-- =====================================================

-- Create admin_actions table if not exists
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_data JSON DEFAULT '{}'::JSON,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type);

-- Enable RLS
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Admins can view action logs" ON admin_actions;
DROP POLICY IF EXISTS "Admins can create action logs" ON admin_actions;

-- Create policies
CREATE POLICY "Admins can view action logs"
  ON admin_actions
  FOR SELECT
  USING (is_current_user_admin());

CREATE POLICY "Admins can create action logs"
  ON admin_actions
  FOR INSERT
  WITH CHECK (is_current_user_admin());

-- Grant table access
GRANT SELECT, INSERT ON admin_actions TO authenticated;


-- =====================================================
-- PART 3: CONTENT MANAGEMENT FUNCTIONS (FIXED)
-- =====================================================

-- Function: Get all comments with full details
CREATE OR REPLACE FUNCTION admin_get_all_comments(
  search_query TEXT DEFAULT NULL,
  poi_filter UUID DEFAULT NULL,
  user_filter UUID DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  comment_id UUID,
  comment_content TEXT,
  user_id UUID,
  username TEXT,
  user_email TEXT,
  poi_id TEXT,
  poi_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  like_count INTEGER,
  photo_count INTEGER,
  user_level INTEGER,
  is_edited BOOLEAN
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
    COALESCE(p.username, 'Anonymous') as username,
    p.email as user_email,
    c.poi_id,
    poi.name as poi_name,
    c.created_at,
    c.updated_at,
    COALESCE((SELECT COUNT(*)::INTEGER FROM poi_comment_likes WHERE comment_id = c.id), 0) as like_count,
    COALESCE((SELECT COUNT(*)::INTEGER FROM poi_comment_photos WHERE comment_id = c.id), 0) as photo_count,
    COALESCE(p.level, 0) as user_level,
    COALESCE(c.is_edited::BOOLEAN, FALSE) as is_edited
  FROM poi_comments c
  LEFT JOIN profiles p ON c.user_id = p.id
  LEFT JOIN pois poi ON c.poi_id = poi.id
  WHERE 
    (search_query IS NULL OR c.content ILIKE '%' || search_query || '%' OR p.username ILIKE '%' || search_query || '%' OR poi.name ILIKE '%' || search_query || '%')
    AND (poi_filter IS NULL OR c.poi_id::TEXT = poi_filter::TEXT)
    AND (user_filter IS NULL OR c.user_id = user_filter)
    AND (date_from IS NULL OR c.created_at >= date_from)
    AND (date_to IS NULL OR c.created_at <= date_to)
  ORDER BY c.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;


-- Function: Get comment details with photos (FIXED)
CREATE OR REPLACE FUNCTION admin_get_comment_details(comment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  SELECT json_build_object(
    'comment', (
      SELECT json_build_object(
        'id', c.id,
        'content', c.content,
        'created_at', c.created_at,
        'updated_at', c.updated_at,
        'poi_id', c.poi_id,
        'poi_name', poi.name,
        'user_id', c.user_id,
        'username', p.username,
        'user_email', p.email,
        'user_level', p.level,
        'user_xp', p.xp
      )
      FROM poi_comments c
      LEFT JOIN profiles p ON c.user_id = p.id
      LEFT JOIN pois poi ON c.poi_id = poi.id
      WHERE c.id = comment_id
    ),
    'photos', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', cp.id,
          'photo_url', cp.photo_url,
          'uploaded_at', cp.uploaded_at
        )
        ORDER BY cp.uploaded_at
      ), '[]'::json)
      FROM poi_comment_photos cp
      WHERE cp.comment_id = comment_id
    ),
    'likes', (
      SELECT json_build_object(
        'count', COUNT(*),
        'users', COALESCE(json_agg(
          json_build_object(
            'user_id', l.user_id,
            'username', p.username,
            'liked_at', l.created_at
          )
          ORDER BY l.created_at DESC
        ), '[]'::json)
      )
      FROM poi_comment_likes l
      LEFT JOIN profiles p ON l.user_id = p.id
      WHERE l.comment_id = comment_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$;


-- Function: Update comment content
CREATE OR REPLACE FUNCTION admin_update_comment(
  comment_id UUID,
  new_content TEXT,
  edit_reason TEXT DEFAULT 'Admin edit'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_content TEXT;
  comment_user_id UUID;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Get old content for logging
  SELECT content, user_id INTO old_content, comment_user_id
  FROM poi_comments
  WHERE id = comment_id;
  
  IF old_content IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  
  -- Update comment
  UPDATE poi_comments
  SET 
    content = new_content,
    updated_at = NOW(),
    is_edited = TRUE
  WHERE id = comment_id;
  
  -- Log action
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'edit_comment',
    comment_user_id,
    json_build_object(
      'comment_id', comment_id,
      'old_content', LEFT(old_content, 100),
      'new_content', LEFT(new_content, 100),
      'reason', edit_reason
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'comment_id', comment_id,
    'old_content', old_content,
    'new_content', new_content
  );
END;
$$;


-- Function: Delete comment photo
CREATE OR REPLACE FUNCTION admin_delete_comment_photo(
  photo_id UUID,
  deletion_reason TEXT DEFAULT 'Admin action'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  photo_url TEXT;
  comment_id UUID;
  comment_user_id UUID;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Get photo details
  SELECT cp.photo_url, cp.comment_id, c.user_id 
  INTO photo_url, comment_id, comment_user_id
  FROM poi_comment_photos cp
  JOIN poi_comments c ON cp.comment_id = c.id
  WHERE cp.id = photo_id;
  
  IF photo_url IS NULL THEN
    RAISE EXCEPTION 'Photo not found';
  END IF;
  
  -- Delete photo record
  DELETE FROM poi_comment_photos WHERE id = photo_id;
  
  -- Log action
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'delete_comment_photo',
    comment_user_id,
    json_build_object(
      'photo_id', photo_id,
      'comment_id', comment_id,
      'photo_url', photo_url,
      'reason', deletion_reason
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'photo_id', photo_id,
    'photo_url', photo_url
  );
END;
$$;


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
  
  -- Delete comment (cascade will handle photos and likes)
  DELETE FROM poi_comments WHERE id = comment_id;
  
  RETURN json_build_object(
    'success', true,
    'comment_id', comment_id,
    'reason', deletion_reason
  );
END;
$$;


-- Function: Get all photos (FIXED)
CREATE OR REPLACE FUNCTION admin_get_all_photos(
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  photo_id UUID,
  photo_url TEXT,
  comment_id UUID,
  comment_content TEXT,
  user_id UUID,
  username TEXT,
  poi_name TEXT,
  uploaded_at TIMESTAMPTZ
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
    cp.id as photo_id,
    cp.photo_url,
    cp.comment_id,
    LEFT(c.content, 100) as comment_content,
    c.user_id,
    p.username,
    poi.name as poi_name,
    cp.uploaded_at
  FROM poi_comment_photos cp
  JOIN poi_comments c ON cp.comment_id = c.id
  LEFT JOIN profiles p ON c.user_id = p.id
  LEFT JOIN pois poi ON c.poi_id = poi.id
  ORDER BY cp.uploaded_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;


-- Function: Get detailed content statistics (FIXED)
CREATE OR REPLACE FUNCTION admin_get_detailed_content_stats()
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
    'comments', json_build_object(
      'total', (SELECT COUNT(*) FROM poi_comments),
      'today', (SELECT COUNT(*) FROM poi_comments WHERE DATE(created_at) = CURRENT_DATE),
      'this_week', (SELECT COUNT(*) FROM poi_comments WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
      'this_month', (SELECT COUNT(*) FROM poi_comments WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
      'with_photos', (SELECT COUNT(DISTINCT comment_id) FROM poi_comment_photos),
      'edited', (SELECT COUNT(*) FROM poi_comments WHERE is_edited = TRUE)
    ),
    'photos', json_build_object(
      'total', (SELECT COUNT(*) FROM poi_comment_photos),
      'today', (SELECT COUNT(*) FROM poi_comment_photos WHERE DATE(uploaded_at) = CURRENT_DATE),
      'this_week', (SELECT COUNT(*) FROM poi_comment_photos WHERE uploaded_at >= CURRENT_DATE - INTERVAL '7 days'),
      'avg_per_comment', (
        SELECT COALESCE(ROUND(AVG(photo_count), 2), 0)
        FROM (
          SELECT COUNT(*) as photo_count
          FROM poi_comment_photos
          GROUP BY comment_id
        ) sub
      )
    ),
    'likes', json_build_object(
      'total', (SELECT COUNT(*) FROM poi_comment_likes),
      'today', (SELECT COUNT(*) FROM poi_comment_likes WHERE DATE(created_at) = CURRENT_DATE),
      'most_liked_comment', (
        SELECT COALESCE(json_build_object(
          'comment_id', comment_id,
          'like_count', COUNT(*)
        ), '{}'::json)
        FROM poi_comment_likes
        GROUP BY comment_id
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
    ),
    'pois', json_build_object(
      'total', (SELECT COUNT(*) FROM pois),
      'with_comments', (SELECT COUNT(DISTINCT poi_id) FROM poi_comments),
      'most_commented', (
        SELECT COALESCE(json_build_object(
          'poi_id', c.poi_id,
          'poi_name', p.name,
          'comment_count', COUNT(*)
        ), '{}'::json)
        FROM poi_comments c
        JOIN pois p ON c.poi_id = p.id
        GROUP BY c.poi_id, p.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
    ),
    'engagement', json_build_object(
      'active_commenters_today', (SELECT COUNT(DISTINCT user_id) FROM poi_comments WHERE DATE(created_at) = CURRENT_DATE),
      'active_commenters_week', (SELECT COUNT(DISTINCT user_id) FROM poi_comments WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
      'avg_comment_length', (SELECT COALESCE(ROUND(AVG(LENGTH(content)), 0), 0) FROM poi_comments)
    )
  ) INTO stats;
  
  RETURN stats;
END;
$$;


-- Function: Bulk operations on comments
CREATE OR REPLACE FUNCTION admin_bulk_comment_operation(
  comment_ids UUID[],
  operation TEXT,
  operation_data JSON DEFAULT '{}'::JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER := 0;
  comment_id UUID;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  CASE operation
    WHEN 'delete' THEN
      FOREACH comment_id IN ARRAY comment_ids
      LOOP
        DELETE FROM poi_comments WHERE id = comment_id;
        affected_count := affected_count + 1;
      END LOOP;
      
    ELSE
      RAISE EXCEPTION 'Unknown operation: %', operation;
  END CASE;
  
  -- Log bulk operation
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'bulk_comment_' || operation,
    NULL,
    json_build_object(
      'comment_ids', comment_ids,
      'count', affected_count,
      'operation_data', operation_data
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'operation', operation,
    'affected_count', affected_count
  );
END;
$$;


-- =====================================================
-- PART 4: GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION admin_get_all_comments(TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_comment_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_comment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_comment_photo(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_photos(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_detailed_content_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_bulk_comment_operation(UUID[], TEXT, JSON) TO authenticated;


-- =====================================================
-- PART 5: VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '✅ INSTALLATION COMPLETE!';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'Created/Updated:';
  RAISE NOTICE '  ✅ is_current_user_admin() function';
  RAISE NOTICE '  ✅ admin_actions table with RLS';
  RAISE NOTICE '  ✅ 8 content management functions (FIXED)';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed issues:';
  RAISE NOTICE '  ✅ poi_comment_photos uses uploaded_at (not created_at)';
  RAISE NOTICE '  ✅ Removed order_index column (does not exist)';
  RAISE NOTICE '  ✅ poi_id is TEXT (not UUID)';
  RAISE NOTICE '  ✅ is_edited is BOOLEAN type';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Reload admin panel: https://cypruseye.com/admin';
  RAISE NOTICE '  2. Press Ctrl+Shift+R to force refresh';
  RAISE NOTICE '  3. Go to Content tab';
  RAISE NOTICE '  4. Everything should work now!';
  RAISE NOTICE '=====================================================';
END $$;
