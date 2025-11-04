-- =====================================================
-- ADMIN MODERATION SETUP (idempotent)
-- Creates a simple moderation pipeline for reported comments
-- Functions required by admin panel:
--  - admin_get_reported_content(search_query, limit_count, offset_count)
--  - admin_approve_report(report_id)
--  - admin_delete_reported_comment(comment_id, deletion_reason)
--
-- Assumptions:
--  - Comments are stored in table: poi_comments (id uuid/text, user_id uuid, poi_id text, content text, created_at timestamptz, updated_at timestamptz)
--  - Profiles table: profiles (id uuid, username text, email text, level int, xp int)
--  - POIs table: pois (id text, name text)
-- Adjust names if different in your DB.
-- =====================================================

-- 1) Reports table (if you already have a similar table, skip)
CREATE TABLE IF NOT EXISTS reported_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NULL,
  reporter_id uuid NULL,
  reason text NULL,
  details jsonb NULL,
  status text NOT NULL DEFAULT 'open', -- open|approved|deleted
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  resolved_by uuid NULL
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_reported_content_status_created ON reported_content(status, created_at DESC);

-- 2) Helper: ensure only admins can use admin_* functions
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
  );
$$;

-- 3) View for joined reported comments
CREATE OR REPLACE VIEW admin_reported_comments AS
SELECT 
  r.id AS report_id,
  r.comment_id,
  r.reason,
  r.status,
  r.created_at,
  c.content,
  c.created_at AS comment_created_at,
  u.username,
  u.email,
  u.level AS user_level,
  u.xp AS user_xp,
  p.name AS poi_name
FROM reported_content r
LEFT JOIN poi_comments c ON c.id = r.comment_id
LEFT JOIN profiles u ON u.id = c.user_id
LEFT JOIN pois p ON p.id = c.poi_id
WHERE r.status = 'open'
ORDER BY r.created_at DESC;

-- 4) RPC: get reported content
CREATE OR REPLACE FUNCTION admin_get_reported_content(
  search_query text DEFAULT NULL,
  limit_count int DEFAULT 20,
  offset_count int DEFAULT 0
)
RETURNS TABLE (
  report_id uuid,
  comment_id uuid,
  type text,
  username text,
  user_level int,
  poi_name text,
  content text,
  reason text,
  created_at timestamptz
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
    arc.report_id,
    arc.comment_id,
    'comment'::text AS type,
    arc.username,
    arc.user_level,
    arc.poi_name,
    arc.content,
    arc.reason,
    arc.created_at
  FROM admin_reported_comments arc
  WHERE (
    search_query IS NULL OR
    arc.username ILIKE '%'||search_query||'%' OR
    arc.poi_name ILIKE '%'||search_query||'%' OR
    arc.content ILIKE '%'||search_query||'%'
  )
  ORDER BY arc.created_at DESC
  LIMIT COALESCE(limit_count, 20)
  OFFSET COALESCE(offset_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_reported_content(text,int,int) TO authenticated;

-- 5) RPC: approve (dismiss) a report
CREATE OR REPLACE FUNCTION admin_approve_report(
  report_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  UPDATE reported_content
  SET status = 'approved', resolved_at = now(), resolved_by = auth.uid()
  WHERE id = report_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_approve_report(uuid) TO authenticated;

-- 6) RPC: delete reported comment (and resolve report)
CREATE OR REPLACE FUNCTION admin_delete_reported_comment(
  comment_id uuid,
  deletion_reason text DEFAULT 'Moderation'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  -- delete the comment
  DELETE FROM poi_comments WHERE id = comment_id;

  -- resolve related open reports
  UPDATE reported_content
  SET status = 'deleted', resolved_at = now(), resolved_by = auth.uid()
  WHERE comment_id = comment_id AND status = 'open';

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_reported_comment(uuid, text) TO authenticated;

-- 7) Dashboard metric: active users last 7d (if missing in diagnostics)
-- Add row into a metrics materialized view or create a function if you prefer.
-- Here: simple view to aggregate; you can adapt your existing diagnostics pipeline.
CREATE OR REPLACE VIEW admin_active_users_7d AS
SELECT COUNT(DISTINCT user_id) AS value
FROM poi_comments
WHERE created_at >= now() - interval '7 days';

-- Note: wire this into your admin_system_diagnostics feeder if needed.
