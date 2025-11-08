-- =====================================================
-- FIX POI COLUMNS - Update admin functions
-- =====================================================
-- Problem: Functions use 'latitude/longitude' but table has 'lat/lng'
-- This file fixes the admin_create_poi and admin_update_poi functions
-- =====================================================

-- Drop and recreate admin_create_poi with correct column names
DROP FUNCTION IF EXISTS admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSON);
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
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Generate slug from name if not in poi_data
  new_poi_id := COALESCE(
    poi_data->>'slug',
    LOWER(REGEXP_REPLACE(poi_name, '[^a-zA-Z0-9]+', '-', 'g'))
  );
  
  -- Insert new POI with correct column names (lat, lng, xp, status, radius)
  -- Note: 'category' stored in badge field, no created_by or data columns
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
    radius
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
    COALESCE((poi_data->>'radius')::INT, 150)
  );
  
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
      'category', poi_category,
      'xp', poi_xp
    )
  );
  
  RETURN json_build_object('success', true, 'poi_id', new_poi_id);
END;
$$;


-- Drop and recreate admin_update_poi with latitude/longitude/xp support
DROP FUNCTION IF EXISTS admin_update_poi(UUID, TEXT, TEXT, TEXT, JSON);
DROP FUNCTION IF EXISTS admin_update_poi(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSON);

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
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  UPDATE pois
  SET 
    name = COALESCE(poi_name, name),
    description = COALESCE(poi_description, description),
    lat = COALESCE(poi_latitude, lat),
    lng = COALESCE(poi_longitude, lng),
    badge = COALESCE(poi_category, badge),
    xp = COALESCE(poi_xp, xp),
    status = COALESCE((poi_data->>'status')::TEXT, status),
    radius = COALESCE((poi_data->>'radius')::INT, radius)
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


-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_poi(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON) TO authenticated;


-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify functions were updated
SELECT 
  'admin_create_poi' as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'admin_create_poi'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT 
  'admin_update_poi' as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'admin_update_poi'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
