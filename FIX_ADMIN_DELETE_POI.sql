-- =====================================================
-- FIX: admin_delete_poi - Support TEXT id (slug)
-- =====================================================
-- POIs use TEXT id (slug) not UUID
-- This fixes the delete function
-- =====================================================

-- Drop old function with UUID parameter
DROP FUNCTION IF EXISTS admin_delete_poi(UUID, TEXT);

-- Create new function with TEXT id parameter
CREATE OR REPLACE FUNCTION admin_delete_poi(
  poi_id TEXT,  -- Changed from UUID to TEXT
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
  
  -- Check if POI exists
  IF NOT EXISTS (SELECT 1 FROM pois WHERE id = poi_id) THEN
    RAISE EXCEPTION 'POI not found: %', poi_id;
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
      'reason', deletion_reason,
      'timestamp', NOW()
    )
  );
  
  -- Delete the POI (CASCADE will delete related comments, photos, etc.)
  DELETE FROM pois WHERE id = poi_id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'poi_id', poi_id,
    'deleted_at', NOW()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete POI: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_delete_poi(TEXT, TEXT) TO authenticated;

-- Test query (commented out - uncomment to test)
-- SELECT admin_delete_poi('test-poi-id', 'Test deletion');

-- Verify function exists
SELECT 
  '✅ admin_delete_poi function created' as status,
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'admin_delete_poi'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
