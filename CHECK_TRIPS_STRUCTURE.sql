-- =====================================================
-- CHECK TRIPS TABLE STRUCTURE
-- Sprawdź strukturę tabeli trips w bazie
-- =====================================================

-- 1. Sprawdź wszystkie kolumny tabeli trips
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'trips' 
ORDER BY ordinal_position;

-- 2. Sprawdź czy istnieją kolumny i18n
SELECT 
  column_name, 
  data_type,
  CASE 
    WHEN column_name LIKE '%_i18n' THEN '✅ i18n column'
    WHEN column_name IN ('title', 'description') AND data_type = 'jsonb' THEN '✅ JSONB (like Hotels)'
    WHEN column_name IN ('title', 'description') AND data_type = 'text' THEN '⚠️ TEXT (needs migration)'
    ELSE 'ℹ️ Other'
  END as status
FROM information_schema.columns 
WHERE table_name = 'trips' 
AND (
  column_name LIKE '%title%' 
  OR column_name LIKE '%description%'
  OR column_name LIKE '%_i18n'
)
ORDER BY column_name;

-- 3. Sprawdź przykładowe dane z tabeli
SELECT 
  id,
  slug,
  CASE 
    WHEN pg_typeof(title) = 'jsonb'::regtype THEN 'JSONB'
    WHEN pg_typeof(title) = 'text'::regtype THEN 'TEXT'
    ELSE pg_typeof(title)::text
  END as title_type,
  title,
  CASE 
    WHEN pg_typeof(description) = 'jsonb'::regtype THEN 'JSONB'
    WHEN pg_typeof(description) = 'text'::regtype THEN 'TEXT'
    ELSE pg_typeof(description)::text
  END as description_type,
  LEFT(CAST(description AS TEXT), 50) as description_preview
FROM trips 
LIMIT 3;

-- 4. Sprawdź czy są jakiekolwiek kolumny title_i18n lub description_i18n
DO $$
DECLARE
  has_title_i18n BOOLEAN;
  has_description_i18n BOOLEAN;
  has_title BOOLEAN;
  has_description BOOLEAN;
  title_type TEXT;
  desc_type TEXT;
BEGIN
  -- Check for title columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'title_i18n'
  ) INTO has_title_i18n;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'title'
  ) INTO has_title;
  
  IF has_title THEN
    SELECT data_type INTO title_type
    FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'title';
  END IF;
  
  -- Check for description columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'description_i18n'
  ) INTO has_description_i18n;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'description'
  ) INTO has_description;
  
  IF has_description THEN
    SELECT data_type INTO desc_type
    FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'description';
  END IF;
  
  -- Report results
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRIPS TABLE STRUCTURE REPORT';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Title columns:';
  RAISE NOTICE '  title_i18n exists: %', has_title_i18n;
  RAISE NOTICE '  title exists: %', has_title;
  IF has_title THEN
    RAISE NOTICE '  title type: %', title_type;
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE 'Description columns:';
  RAISE NOTICE '  description_i18n exists: %', has_description_i18n;
  RAISE NOTICE '  description exists: %', has_description;
  IF has_description THEN
    RAISE NOTICE '  description type: %', desc_type;
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  
  -- Recommendation
  RAISE NOTICE 'RECOMMENDATION:';
  IF has_title_i18n AND has_title THEN
    RAISE NOTICE '  ⚠️ Both title and title_i18n exist - CONFLICT!';
    RAISE NOTICE '  → Need to decide which one to use';
  ELSIF has_title_i18n AND NOT has_title THEN
    RAISE NOTICE '  ℹ️ Only title_i18n exists';
    RAISE NOTICE '  → Rename title_i18n to title (to match Hotels)';
  ELSIF has_title AND title_type = 'jsonb' THEN
    RAISE NOTICE '  ✅ title is JSONB - CORRECT (like Hotels)';
    RAISE NOTICE '  → Admin.js needs to use "title" not "title_i18n"';
  ELSIF has_title AND title_type = 'text' THEN
    RAISE NOTICE '  ⚠️ title is TEXT - needs migration';
    RAISE NOTICE '  → Convert TEXT to JSONB';
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
