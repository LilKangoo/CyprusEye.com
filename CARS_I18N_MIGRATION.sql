-- =====================================================
-- CARS I18N MIGRATION - STEP 2
-- Migracja car_type, car_model, description → JSONB
-- =====================================================

-- IMPORTANT: Run CARS_BACKUP.sql FIRST!

-- =====================================================
-- STEP 1: Add new JSONB columns
-- =====================================================

ALTER TABLE car_offers 
ADD COLUMN IF NOT EXISTS car_type_new JSONB,
ADD COLUMN IF NOT EXISTS car_model_new JSONB,
ADD COLUMN IF NOT EXISTS description_new JSONB;

-- =====================================================
-- STEP 2: Migrate car_model (zakładam że obecne są po polsku)
-- =====================================================

UPDATE car_offers 
SET car_model_new = jsonb_build_object(
  'pl', car_model,
  'en', car_model  -- Initially same as Polish, admin will translate
)
WHERE car_model IS NOT NULL AND car_model != '';

-- Handle NULL or empty car_model
UPDATE car_offers 
SET car_model_new = jsonb_build_object('pl', 'Unknown Car', 'en', 'Unknown Car')
WHERE car_model IS NULL OR car_model = '';

-- =====================================================
-- STEP 3: Migrate description (zakładam że obecne są po polsku)
-- =====================================================

UPDATE car_offers 
SET description_new = jsonb_build_object(
  'pl', COALESCE(description, ''),
  'en', COALESCE(description, '')  -- Initially same as Polish
)
WHERE description IS NOT NULL AND description != '';

-- Handle NULL or empty description
UPDATE car_offers 
SET description_new = jsonb_build_object('pl', '', 'en', '')
WHERE description IS NULL OR description = '';

-- =====================================================
-- STEP 4: Migrate car_type with translations
-- =====================================================

-- Update car_type with proper Polish translations
UPDATE car_offers 
SET car_type_new = CASE 
  WHEN car_type = 'Economy' THEN 
    jsonb_build_object('pl', 'Ekonomiczny', 'en', 'Economy', 'el', 'Οικονομικό', 'he', 'חסכוני')
  WHEN car_type = 'Compact' THEN 
    jsonb_build_object('pl', 'Kompakt', 'en', 'Compact', 'el', 'Συμπαγής', 'he', 'קומפקטי')
  WHEN car_type = 'Hybrid Economy' THEN 
    jsonb_build_object('pl', 'Ekonomiczny Hybrydowy', 'en', 'Hybrid Economy', 'el', 'Υβριδικό Οικονομικό', 'he', 'חסכוני היברידי')
  WHEN car_type = 'Standard Sedan' THEN 
    jsonb_build_object('pl', 'Sedan Standard', 'en', 'Standard Sedan', 'el', 'Βασικό Sedan', 'he', 'סדאן סטנדרטי')
  WHEN car_type = 'SUV' THEN 
    jsonb_build_object('pl', 'SUV', 'en', 'SUV', 'el', 'SUV', 'he', 'SUV')
  WHEN car_type = 'MPV' OR car_type = 'MPV / Minivan' THEN 
    jsonb_build_object('pl', 'Minivan', 'en', 'MPV', 'el', 'MPV', 'he', 'מיניוואן')
  WHEN car_type = 'Luxury' THEN 
    jsonb_build_object('pl', 'Luksusowy', 'en', 'Luxury', 'el', 'Πολυτελές', 'he', 'יוקרתי')
  WHEN car_type = 'Premium' THEN 
    jsonb_build_object('pl', 'Premium', 'en', 'Premium', 'el', 'Premium', 'he', 'פרימיום')
  ELSE 
    jsonb_build_object('pl', car_type, 'en', car_type, 'el', car_type, 'he', car_type)
END
WHERE car_type IS NOT NULL;

-- Handle NULL car_type
UPDATE car_offers 
SET car_type_new = jsonb_build_object('pl', 'Inne', 'en', 'Other', 'el', 'Άλλο', 'he', 'אחר')
WHERE car_type IS NULL;

-- =====================================================
-- STEP 5: Verify migration BEFORE dropping old columns
-- =====================================================

-- Check migration results
SELECT 
  'car_type' as field,
  COUNT(*) as total,
  COUNT(car_type_new) as migrated,
  COUNT(*) - COUNT(car_type_new) as not_migrated
FROM car_offers
UNION ALL
SELECT 
  'car_model',
  COUNT(*),
  COUNT(car_model_new),
  COUNT(*) - COUNT(car_model_new)
FROM car_offers
UNION ALL
SELECT 
  'description',
  COUNT(*),
  COUNT(description_new),
  COUNT(*) - COUNT(description_new)
FROM car_offers;

-- Show sample migrated data
SELECT 
  id,
  location,
  
  -- Old values
  car_type as old_type,
  car_model as old_model,
  LEFT(description, 30) as old_desc,
  
  -- New JSONB values
  car_type_new as new_type,
  car_model_new as new_model,
  description_new as new_desc
  
FROM car_offers
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- ⚠️ STOP HERE AND VERIFY! ⚠️
-- =====================================================
-- If everything looks good, continue with STEP 6
-- If NOT, run: DROP COLUMN car_type_new, car_model_new, description_new
-- =====================================================

-- =====================================================
-- STEP 6: Drop old columns and rename new ones
-- =====================================================
-- ⚠️ UNCOMMENT ONLY AFTER VERIFICATION ⚠️

-- -- Drop old columns
-- ALTER TABLE car_offers 
-- DROP COLUMN car_type,
-- DROP COLUMN car_model,
-- DROP COLUMN description;

-- -- Rename new columns
-- ALTER TABLE car_offers 
-- RENAME COLUMN car_type_new TO car_type;

-- ALTER TABLE car_offers 
-- RENAME COLUMN car_model_new TO car_model;

-- ALTER TABLE car_offers 
-- RENAME COLUMN description_new TO description;

-- =====================================================
-- STEP 7: Final verification
-- =====================================================
-- ⚠️ RUN AFTER STEP 6 ⚠️

-- -- Check column types
-- SELECT 
--   column_name,
--   data_type
-- FROM information_schema.columns
-- WHERE table_name = 'car_offers'
--   AND column_name IN ('car_type', 'car_model', 'description');
-- 
-- -- Expected output:
-- -- car_type    | jsonb
-- -- car_model   | jsonb
-- -- description | jsonb

-- -- Show sample final data
-- SELECT 
--   id,
--   location,
--   car_type,
--   car_model,
--   description
-- FROM car_offers
-- ORDER BY created_at DESC
-- LIMIT 3;

-- =====================================================
-- ✅ MIGRATION COMPLETE!
-- =====================================================
