-- =====================================================
-- I18N MIGRATION FOR POIS - FIXED VERSION
-- Safe migration with correct order
-- =====================================================

-- STEP 1: Create backup
-- =====================================================
CREATE TABLE IF NOT EXISTS pois_backup_i18n_20250111 AS 
SELECT * FROM pois;

-- STEP 2: Add JSONB columns
-- =====================================================
ALTER TABLE pois 
  ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS badge_i18n JSONB DEFAULT NULL;

-- STEP 3: Migrate data FIRST (before constraints!)
-- =====================================================
UPDATE pois 
SET 
  name_i18n = jsonb_build_object(
    'pl', COALESCE(name, 'Unnamed'),
    'en', COALESCE(name, 'Unnamed')
  ),
  description_i18n = jsonb_build_object(
    'pl', COALESCE(description, 'No description'),
    'en', COALESCE(description, 'No description')
  ),
  badge_i18n = jsonb_build_object(
    'pl', COALESCE(badge, 'Explorer'),
    'en', COALESCE(badge, 'Explorer')
  )
WHERE name_i18n IS NULL;

-- STEP 4: NOW add constraints (after data is migrated)
-- =====================================================
ALTER TABLE pois
  DROP CONSTRAINT IF EXISTS check_name_i18n_has_pl_and_en;

ALTER TABLE pois
  DROP CONSTRAINT IF EXISTS check_description_i18n_has_pl_and_en;

ALTER TABLE pois
  ADD CONSTRAINT check_name_i18n_has_pl_and_en
    CHECK (
      (name_i18n IS NULL) OR 
      (
        name_i18n ? 'pl' AND 
        name_i18n ? 'en' AND
        LENGTH(TRIM(name_i18n->>'pl')) > 0 AND
        LENGTH(TRIM(name_i18n->>'en')) > 0
      )
    );

ALTER TABLE pois
  ADD CONSTRAINT check_description_i18n_has_pl_and_en
    CHECK (
      (description_i18n IS NULL) OR 
      (
        description_i18n ? 'pl' AND 
        description_i18n ? 'en' AND
        LENGTH(TRIM(description_i18n->>'pl')) > 0 AND
        LENGTH(TRIM(description_i18n->>'en')) > 0
      )
    );

-- STEP 5: Create indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_pois_name_i18n 
  ON pois USING GIN (name_i18n);

CREATE INDEX IF NOT EXISTS idx_pois_description_i18n 
  ON pois USING GIN (description_i18n);

CREATE INDEX IF NOT EXISTS idx_pois_badge_i18n 
  ON pois USING GIN (badge_i18n);

-- STEP 6: Verify
-- =====================================================
DO $$
DECLARE
  total_pois INTEGER;
  migrated_pois INTEGER;
  sample_poi RECORD;
BEGIN
  SELECT COUNT(*) INTO total_pois FROM pois;
  
  SELECT COUNT(*) INTO migrated_pois FROM pois 
    WHERE name_i18n IS NOT NULL 
      AND name_i18n ? 'pl' 
      AND name_i18n ? 'en';
  
  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Total POIs: %', total_pois;
  RAISE NOTICE 'Migrated: %', migrated_pois;
  RAISE NOTICE 'Success rate: %%%', ROUND((migrated_pois::NUMERIC / total_pois * 100), 2);
  RAISE NOTICE '====================================';
  
  -- Show sample
  SELECT * INTO sample_poi FROM pois LIMIT 1;
  RAISE NOTICE 'Sample POI:';
  RAISE NOTICE '  ID: %', sample_poi.id;
  RAISE NOTICE '  Old name: %', sample_poi.name;
  RAISE NOTICE '  New name_i18n: %', sample_poi.name_i18n;
  RAISE NOTICE '====================================';
END $$;
