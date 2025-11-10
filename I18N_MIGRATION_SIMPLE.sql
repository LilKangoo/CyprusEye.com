-- =====================================================
-- I18N MIGRATION - SIMPLE & WORKING
-- NO constraints, just data migration
-- =====================================================

-- STEP 1: Remove any existing constraints (cleanup)
-- =====================================================
ALTER TABLE pois DROP CONSTRAINT IF EXISTS check_name_i18n_has_pl_and_en;
ALTER TABLE pois DROP CONSTRAINT IF EXISTS check_description_i18n_has_pl_and_en;

-- STEP 2: Create backup
-- =====================================================
DROP TABLE IF EXISTS pois_backup_i18n_final;
CREATE TABLE pois_backup_i18n_final AS SELECT * FROM pois;

-- STEP 3: Add columns if not exist
-- =====================================================
ALTER TABLE pois ADD COLUMN IF NOT EXISTS name_i18n JSONB;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS description_i18n JSONB;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS badge_i18n JSONB;

-- STEP 4: Migrate data
-- =====================================================
UPDATE pois 
SET 
  name_i18n = jsonb_build_object(
    'pl', COALESCE(name, 'Unnamed'),
    'en', COALESCE(name, 'Unnamed')
  ),
  description_i18n = jsonb_build_object(
    'pl', COALESCE(description, ''),
    'en', COALESCE(description, '')
  ),
  badge_i18n = jsonb_build_object(
    'pl', COALESCE(badge, 'Explorer'),
    'en', COALESCE(badge, 'Explorer')
  )
WHERE name_i18n IS NULL OR description_i18n IS NULL OR badge_i18n IS NULL;

-- STEP 5: Create indexes
-- =====================================================
DROP INDEX IF EXISTS idx_pois_name_i18n;
DROP INDEX IF EXISTS idx_pois_description_i18n;
DROP INDEX IF EXISTS idx_pois_badge_i18n;

CREATE INDEX idx_pois_name_i18n ON pois USING GIN (name_i18n);
CREATE INDEX idx_pois_description_i18n ON pois USING GIN (description_i18n);
CREATE INDEX idx_pois_badge_i18n ON pois USING GIN (badge_i18n);

-- STEP 6: Verify
-- =====================================================
SELECT 
  COUNT(*) as total_pois,
  COUNT(name_i18n) as with_name_i18n,
  COUNT(description_i18n) as with_desc_i18n,
  COUNT(badge_i18n) as with_badge_i18n
FROM pois;

-- Show sample
SELECT 
  id,
  name as old_name,
  name_i18n as new_name_i18n,
  description_i18n as new_desc_i18n
FROM pois 
LIMIT 3;
