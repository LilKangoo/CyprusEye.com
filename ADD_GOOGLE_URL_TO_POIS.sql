-- =====================================================
-- ADD GOOGLE_URL TO POIS AND UPDATE ADMIN FUNCTIONS
-- =====================================================
-- This migration adds an optional google_url column to pois and
-- updates admin_create_poi/admin_update_poi to read it from poi_data.
-- Safe to run multiple times.
-- =====================================================

-- 1) Add column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pois'
      AND column_name = 'google_url'
  ) THEN
    ALTER TABLE pois ADD COLUMN google_url TEXT;
  END IF;
END $$;

-- 2) Recreate admin_create_poi to set google_url from poi_data
DROP FUNCTION IF EXISTS admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON);
CREATE OR REPLACE FUNCTION admin_create_poi(
  poi_name TEXT,
  poi_description TEXT,
  poi_latitude DOUBLE PRECISION,
  poi_longitude DOUBLE PRECISION,
  poi_category TEXT DEFAULT 'other',
  poi_xp INTEGER DEFAULT 100,
  poi_data JSON DEFAULT '{}'::JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_poi_id TEXT;
  new_google_url TEXT;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  new_poi_id := COALESCE(
    poi_data->>'slug',
    LOWER(REGEXP_REPLACE(poi_name, '[^a-zA-Z0-9]+', '-', 'g'))
  );

  new_google_url := NULLIF(TRIM(poi_data->>'google_url'), '');

  INSERT INTO pois (
    id,
    name,
    description,
    lat,
    lng,
    xp,
    badge,
    required_level,
    status,
    google_url
  ) VALUES (
    new_poi_id,
    poi_name,
    poi_description,
    poi_latitude,
    poi_longitude,
    COALESCE(poi_xp, 100),
    poi_category,
    1,
    COALESCE((poi_data->>'status')::TEXT, 'published'),
    new_google_url
  );

  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_user_id,
    action_data
  ) VALUES (
    auth.uid(),
    'create_poi',
    NULL,
    json_build_object('poi_id', new_poi_id)
  );

  RETURN json_build_object('success', true, 'poi_id', new_poi_id);
END;
$$;

-- 3) Recreate admin_update_poi to update google_url when provided
DROP FUNCTION IF EXISTS admin_update_poi(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON);
CREATE OR REPLACE FUNCTION admin_update_poi(
  poi_id TEXT,
  poi_name TEXT DEFAULT NULL,
  poi_description TEXT DEFAULT NULL,
  poi_latitude DOUBLE PRECISION DEFAULT NULL,
  poi_longitude DOUBLE PRECISION DEFAULT NULL,
  poi_category TEXT DEFAULT NULL,
  poi_xp INTEGER DEFAULT NULL,
  poi_data JSON DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_google_url TEXT;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  new_google_url := NULLIF(TRIM(COALESCE(poi_data->>'google_url', NULL)), '');

  UPDATE pois
  SET 
    name = COALESCE(poi_name, name),
    description = COALESCE(poi_description, description),
    lat = COALESCE(poi_latitude, lat),
    lng = COALESCE(poi_longitude, lng),
    badge = COALESCE(poi_category, badge),
    xp = COALESCE(poi_xp, xp),
    status = COALESCE((poi_data->>'status')::TEXT, status),
    google_url = COALESCE(new_google_url, google_url)
  WHERE id = poi_id;

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

GRANT EXECUTE ON FUNCTION admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_poi(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON) TO authenticated;
