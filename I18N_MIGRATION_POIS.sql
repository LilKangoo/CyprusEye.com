-- =====================================================
-- I18N MIGRATION FOR POIS TABLE
-- Safe migration with rollback support
-- Author: AI Assistant
-- Date: 2025-01-11
-- =====================================================

-- STEP 1: Create backup table
-- =====================================================
CREATE TABLE IF NOT EXISTS pois_backup_i18n_20250111 AS 
SELECT * FROM pois;

-- Verify backup
DO $$
DECLARE
  backup_count INTEGER;
  original_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backup_count FROM pois_backup_i18n_20250111;
  SELECT COUNT(*) INTO original_count FROM pois;
  
  RAISE NOTICE '✅ Backup created: % rows (original: % rows)', backup_count, original_count;
END $$;


-- STEP 2: Add new JSONB columns
-- =====================================================
DO $$
BEGIN
  ALTER TABLE pois 
    ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS badge_i18n JSONB DEFAULT NULL;
  
  RAISE NOTICE '✅ JSONB columns added';
END $$;


-- STEP 3: Migrate existing data to JSONB
-- =====================================================
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
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
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Data migrated to JSONB format: % rows updated', updated_count;
END $$;


-- STEP 4: Add database-level validation constraints
-- =====================================================
DO $$
BEGIN
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
  
  RAISE NOTICE '✅ Validation constraints added';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ Constraints already exist, skipping...';
END $$;


-- STEP 5: Create GIN indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_pois_name_i18n 
  ON pois USING GIN (name_i18n);

CREATE INDEX IF NOT EXISTS idx_pois_description_i18n 
  ON pois USING GIN (description_i18n);

CREATE INDEX IF NOT EXISTS idx_pois_badge_i18n 
  ON pois USING GIN (badge_i18n);

DO $$
BEGIN
  RAISE NOTICE '✅ GIN indexes created';
END $$;


-- STEP 6: Verify migration success
-- =====================================================
DO $$
DECLARE
  total_pois INTEGER;
  migrated_pois INTEGER;
  missing_pois INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_pois FROM pois;
  
  SELECT COUNT(*) INTO migrated_pois FROM pois 
    WHERE name_i18n IS NOT NULL 
      AND name_i18n ? 'pl' 
      AND name_i18n ? 'en';
  
  missing_pois := total_pois - migrated_pois;
  
  IF missing_pois > 0 THEN
    RAISE WARNING '⚠️ Migration incomplete: % POIs missing i18n data', missing_pois;
  ELSE
    RAISE NOTICE '✅ Migration successful: % / % POIs migrated', migrated_pois, total_pois;
  END IF;
  
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '   Total POIs: %', total_pois;
  RAISE NOTICE '   Migrated: %', migrated_pois;
  RAISE NOTICE '   Missing: %', missing_pois;
END $$;


-- STEP 7: Show sample data
-- =====================================================
DO $$
DECLARE
  sample_poi RECORD;
BEGIN
  SELECT * INTO sample_poi FROM pois LIMIT 1;
  
  RAISE NOTICE '📝 Sample POI data:';
  RAISE NOTICE '   ID: %', sample_poi.id;
  RAISE NOTICE '   name (old): %', sample_poi.name;
  RAISE NOTICE '   name_i18n (new): %', sample_poi.name_i18n;
  RAISE NOTICE '   description_i18n: %', LEFT(sample_poi.description_i18n::text, 100);
END $$;


-- =====================================================
-- MIGRATION COMPLETE ✅
-- =====================================================
-- 
-- Next steps:
-- 1. Verify the migration worked correctly
-- 2. Update admin panel forms
-- 3. Update frontend loaders
-- 
-- ROLLBACK (if needed):
-- DROP TABLE IF EXISTS pois;
-- ALTER TABLE pois_backup_i18n_20250111 RENAME TO pois;
-- =====================================================
