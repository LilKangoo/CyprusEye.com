-- ========================================
-- QUESTS I18N MIGRATION
-- Adds multilingual support for quest title and description
-- ========================================

-- Migration Date: 2025-11-12
-- Author: System Migration
-- Purpose: Enable i18n for quests/tasks with JSONB fields

BEGIN;

-- ========================================
-- STEP 1: BACKUP CURRENT DATA
-- ========================================

-- Create backup table with timestamp
CREATE TABLE IF NOT EXISTS tasks_backup_quests_i18n AS 
SELECT * FROM tasks WHERE category = 'quest';

-- Verify backup
DO $$
DECLARE
  backup_count INTEGER;
  original_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backup_count FROM tasks_backup_quests_i18n;
  SELECT COUNT(*) INTO original_count FROM tasks WHERE category = 'quest';
  
  RAISE NOTICE 'Backup created: % quests backed up (original: %)', backup_count, original_count;
  
  IF backup_count != original_count THEN
    RAISE EXCEPTION 'Backup count mismatch! Aborting migration.';
  END IF;
END $$;

-- ========================================
-- STEP 2: ADD I18N COLUMNS
-- ========================================

-- Add title_i18n (JSONB for multilingual titles)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS title_i18n JSONB;

-- Add description_i18n (JSONB for multilingual descriptions)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS description_i18n JSONB;

-- Log progress
DO $$ BEGIN
  RAISE NOTICE 'Added i18n columns: title_i18n, description_i18n';
END $$;

-- ========================================
-- STEP 3: MIGRATE EXISTING DATA
-- ========================================

-- Migrate the one quest with a title ("sunrise-challenge")
-- Assume it's in Polish since most content is PL
UPDATE tasks
SET title_i18n = jsonb_build_object('pl', title)
WHERE category = 'quest' 
  AND title IS NOT NULL
  AND title != '';

-- Check migration result
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count 
  FROM tasks 
  WHERE category = 'quest' AND title_i18n IS NOT NULL;
  
  RAISE NOTICE 'Migrated % quest titles to i18n format', migrated_count;
END $$;

-- ========================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- GIN index on title_i18n for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_tasks_title_i18n 
ON tasks USING gin(title_i18n);

-- GIN index on description_i18n
CREATE INDEX IF NOT EXISTS idx_tasks_description_i18n 
ON tasks USING gin(description_i18n);

-- Log progress
DO $$ BEGIN
  RAISE NOTICE 'Created GIN indexes on i18n columns';
END $$;

-- ========================================
-- STEP 5: VERIFY MIGRATION
-- ========================================

-- Show migration results
SELECT 
  'Migration Summary' as info,
  COUNT(*) as total_quests,
  COUNT(title_i18n) as has_title_i18n,
  COUNT(description_i18n) as has_description_i18n,
  COUNT(CASE WHEN title IS NOT NULL THEN 1 END) as has_legacy_title,
  COUNT(CASE WHEN description IS NOT NULL THEN 1 END) as has_legacy_description
FROM tasks
WHERE category = 'quest';

-- Show sample migrated data
SELECT 
  id,
  title as old_title,
  title_i18n,
  description as old_description,
  description_i18n,
  xp
FROM tasks
WHERE category = 'quest'
  AND (title_i18n IS NOT NULL OR description_i18n IS NOT NULL)
LIMIT 5;

-- ========================================
-- STEP 6: IMPORTANT NOTES
-- ========================================

-- NOTE: Legacy columns (title, description) are kept for backward compatibility
-- They will be deprecated after frontend is updated and tested
-- To remove them later, run:
--   ALTER TABLE tasks DROP COLUMN title;
--   ALTER TABLE tasks DROP COLUMN description;

-- NOTE: XP system is NOT affected
-- The 'xp' column remains unchanged and functional
-- Functions like award_task, award_xp continue to work

-- NOTE: RLS policies remain unchanged
-- Public can still read tasks
-- Only admins can insert/update/delete

COMMIT;

-- Final success message
DO $$ BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Quest i18n migration completed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '  1. Update admin panel to use i18n inputs';
  RAISE NOTICE '  2. Update frontend (js/tasks.js) to use title_i18n/description_i18n';
  RAISE NOTICE '  3. Test quest display and language switching';
  RAISE NOTICE '  4. After 1 week of testing, remove legacy columns';
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- ROLLBACK PLAN (if needed)
-- ========================================

-- If migration fails, run:
-- 
-- BEGIN;
-- DELETE FROM tasks WHERE category = 'quest';
-- INSERT INTO tasks SELECT * FROM tasks_backup_quests_i18n;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS title_i18n;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS description_i18n;
-- DROP TABLE IF EXISTS tasks_backup_quests_i18n;
-- COMMIT;
