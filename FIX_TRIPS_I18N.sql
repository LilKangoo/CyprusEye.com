-- =====================================================
-- FIX TRIPS I18N - UNIVERSAL MIGRATION
-- Naprawia trips niezależnie od obecnego stanu
-- =====================================================

-- IMPORTANT: Run CHECK_TRIPS_STRUCTURE.sql FIRST to see current state!

-- =====================================================
-- SCENARIO 1: title_i18n exists, title is TEXT or doesn't exist
-- ACTION: Rename title_i18n → title (to match Hotels)
-- =====================================================

DO $$
BEGIN
  -- Check if title_i18n exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'title_i18n'
  ) THEN
    RAISE NOTICE '✅ Found title_i18n column';
    
    -- Backup old title if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'trips' AND column_name = 'title'
    ) THEN
      ALTER TABLE trips RENAME COLUMN title TO title_old_backup;
      RAISE NOTICE '📦 Renamed old title to title_old_backup';
    END IF;
    
    -- Rename title_i18n to title
    ALTER TABLE trips RENAME COLUMN title_i18n TO title;
    RAISE NOTICE '✅ Renamed title_i18n → title';
    
  ELSE
    RAISE NOTICE 'ℹ️ title_i18n does not exist, checking title...';
  END IF;
  
  -- Check if description_i18n exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'description_i18n'
  ) THEN
    RAISE NOTICE '✅ Found description_i18n column';
    
    -- Backup old description if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'trips' AND column_name = 'description'
    ) THEN
      ALTER TABLE trips RENAME COLUMN description TO description_old_backup;
      RAISE NOTICE '📦 Renamed old description to description_old_backup';
    END IF;
    
    -- Rename description_i18n to description
    ALTER TABLE trips RENAME COLUMN description_i18n TO description;
    RAISE NOTICE '✅ Renamed description_i18n → description';
    
  ELSE
    RAISE NOTICE 'ℹ️ description_i18n does not exist, checking description...';
  END IF;
  
END $$;

-- =====================================================
-- SCENARIO 2: title exists as TEXT
-- ACTION: Convert TEXT → JSONB
-- =====================================================

DO $$
DECLARE
  title_type TEXT;
  desc_type TEXT;
BEGIN
  -- Check title type
  SELECT data_type INTO title_type
  FROM information_schema.columns 
  WHERE table_name = 'trips' AND column_name = 'title';
  
  IF title_type = 'text' THEN
    RAISE NOTICE '⚠️ title is TEXT, converting to JSONB...';
    
    -- Add temporary JSONB column
    ALTER TABLE trips ADD COLUMN title_temp JSONB;
    
    -- Migrate data (TEXT → JSONB with pl and en)
    UPDATE trips 
    SET title_temp = jsonb_build_object(
      'pl', COALESCE(title, ''),
      'en', COALESCE(title, '')
    );
    
    -- Drop old TEXT column
    ALTER TABLE trips DROP COLUMN title;
    
    -- Rename temp to title
    ALTER TABLE trips RENAME COLUMN title_temp TO title;
    
    RAISE NOTICE '✅ Converted title: TEXT → JSONB';
  ELSIF title_type = 'jsonb' THEN
    RAISE NOTICE '✅ title is already JSONB';
  ELSE
    RAISE NOTICE '⚠️ title type is: %', title_type;
  END IF;
  
  -- Check description type
  SELECT data_type INTO desc_type
  FROM information_schema.columns 
  WHERE table_name = 'trips' AND column_name = 'description';
  
  IF desc_type = 'text' THEN
    RAISE NOTICE '⚠️ description is TEXT, converting to JSONB...';
    
    -- Add temporary JSONB column
    ALTER TABLE trips ADD COLUMN description_temp JSONB;
    
    -- Migrate data (TEXT → JSONB with pl and en)
    UPDATE trips 
    SET description_temp = jsonb_build_object(
      'pl', COALESCE(description, ''),
      'en', COALESCE(description, '')
    );
    
    -- Drop old TEXT column
    ALTER TABLE trips DROP COLUMN description;
    
    -- Rename temp to description
    ALTER TABLE trips RENAME COLUMN description_temp TO description;
    
    RAISE NOTICE '✅ Converted description: TEXT → JSONB';
  ELSIF desc_type = 'jsonb' THEN
    RAISE NOTICE '✅ description is already JSONB';
  ELSE
    RAISE NOTICE '⚠️ description type is: %', desc_type;
  END IF;
  
END $$;

-- =====================================================
-- FINAL: Create indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_trips_title ON trips USING GIN (title);
CREATE INDEX IF NOT EXISTS idx_trips_description ON trips USING GIN (description);

-- =====================================================
-- VERIFY
-- =====================================================

SELECT 
  column_name, 
  data_type,
  CASE 
    WHEN column_name = 'title' AND data_type = 'jsonb' THEN '✅ CORRECT'
    WHEN column_name = 'description' AND data_type = 'jsonb' THEN '✅ CORRECT'
    WHEN column_name LIKE '%_old_backup' THEN '📦 BACKUP'
    ELSE 'ℹ️ OTHER'
  END as status
FROM information_schema.columns 
WHERE table_name = 'trips' 
AND (
  column_name IN ('title', 'description')
  OR column_name LIKE '%title%'
  OR column_name LIKE '%description%'
)
ORDER BY column_name;

-- Show sample data
SELECT 
  id,
  slug,
  title,
  LEFT(CAST(description AS TEXT), 100) as description_preview
FROM trips 
LIMIT 3;

-- =====================================================
-- CLEANUP (optional, run after testing)
-- =====================================================

-- Uncomment after confirming everything works:
-- ALTER TABLE trips DROP COLUMN IF EXISTS title_old_backup;
-- ALTER TABLE trips DROP COLUMN IF EXISTS description_old_backup;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ TRIPS I18N MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Fix admin/admin.js:';
  RAISE NOTICE '   - Change trip.title_i18n → trip.title';
  RAISE NOTICE '   - Change trip.description_i18n → trip.description';
  RAISE NOTICE '';
  RAISE NOTICE '2. Frontend already works (getTripName reads trip.title)';
  RAISE NOTICE '';
  RAISE NOTICE '3. Test in admin panel';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
