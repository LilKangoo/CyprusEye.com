-- =====================================================
-- CARS I18N MIGRATION V2 - OPCJA B (SPÓJNE NAZWY)
-- Zmiana na spójne nazwy z Trips: car_type, car_model, description (JSONB)
-- =====================================================

-- IMPORTANT: Run CARS_BACKUP.sql FIRST!

-- =====================================================
-- STEP 1: Add car_model as JSONB (nowa kolumna)
-- =====================================================

ALTER TABLE car_offers 
ADD COLUMN IF NOT EXISTS car_model_temp JSONB;

-- Migrate car_model (TEXT) → car_model_temp (JSONB)
-- Zakładam że obecne wartości są po angielsku
UPDATE car_offers 
SET car_model_temp = jsonb_build_object(
  'pl', car_model,
  'en', car_model
)
WHERE car_model IS NOT NULL AND car_model != '';

-- Handle NULL car_model
UPDATE car_offers 
SET car_model_temp = jsonb_build_object('pl', 'Unknown Car', 'en', 'Unknown Car')
WHERE car_model IS NULL OR car_model = '';

-- =====================================================
-- STEP 2: Verify car_model migration
-- =====================================================

SELECT 
  id,
  location,
  car_model as old_car_model_text,
  car_model_temp as new_car_model_jsonb
FROM car_offers
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- STEP 3: Rename existing i18n columns to temp names
-- =====================================================

-- Rename car_type_i18n → car_type_temp (już jest JSONB)
ALTER TABLE car_offers 
RENAME COLUMN car_type_i18n TO car_type_temp;

-- Rename description_i18n → description_temp (już jest JSONB)
ALTER TABLE car_offers 
RENAME COLUMN description_i18n TO description_temp;

-- =====================================================
-- STEP 4: Verify temp columns exist
-- =====================================================

SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'car_offers'
  AND column_name IN ('car_type_temp', 'description_temp', 'car_model_temp');

-- Expected:
-- car_type_temp | jsonb
-- description_temp | jsonb
-- car_model_temp | jsonb

-- =====================================================
-- ⚠️ STOP HERE AND VERIFY! ⚠️
-- =====================================================
-- If temp columns look good, continue with STEP 5
-- =====================================================

-- =====================================================
-- STEP 5: Drop old TEXT columns
-- =====================================================
-- ⚠️ UNCOMMENT ONLY AFTER VERIFICATION ⚠️

-- ALTER TABLE car_offers 
-- DROP COLUMN IF EXISTS car_type,
-- DROP COLUMN IF EXISTS car_model,
-- DROP COLUMN IF EXISTS description;

-- =====================================================
-- STEP 6: Rename temp columns to final names
-- =====================================================
-- ⚠️ UNCOMMENT ONLY AFTER STEP 5 ⚠️

-- ALTER TABLE car_offers 
-- RENAME COLUMN car_type_temp TO car_type;

-- ALTER TABLE car_offers 
-- RENAME COLUMN car_model_temp TO car_model;

-- ALTER TABLE car_offers 
-- RENAME COLUMN description_temp TO description;

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
--   AND column_name IN ('car_type', 'car_model', 'description')
-- ORDER BY column_name;
-- 
-- -- Expected output:
-- -- car_model   | jsonb
-- -- car_type    | jsonb
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
-- LIMIT 5;

-- =====================================================
-- STEP 8: Update car_type with Polish translations
-- =====================================================
-- ⚠️ RUN AFTER STEP 7 ⚠️
-- This updates car_type JSONB to include all 4 languages

-- UPDATE car_offers 
-- SET car_type = CASE 
--   WHEN car_type->>'en' = 'Economy' THEN 
--     jsonb_build_object('pl', 'Ekonomiczny', 'en', 'Economy', 'el', 'Οικονομικό', 'he', 'חסכוני')
--   WHEN car_type->>'en' = 'Compact' THEN 
--     jsonb_build_object('pl', 'Kompakt', 'en', 'Compact', 'el', 'Συμπαγής', 'he', 'קומפקטי')
--   WHEN car_type->>'en' = 'Hybrid Economy' THEN 
--     jsonb_build_object('pl', 'Ekonomiczny Hybrydowy', 'en', 'Hybrid Economy', 'el', 'Υβριδικό Οικονομικό', 'he', 'חסכוני היברידי')
--   WHEN car_type->>'en' = 'Standard Sedan' OR car_type->>'en' = 'Comfort Sedan' THEN 
--     jsonb_build_object('pl', 'Sedan Standard', 'en', 'Standard Sedan', 'el', 'Βασικό Sedan', 'he', 'סדאן סטנדרטי')
--   WHEN car_type->>'en' = 'SUV' THEN 
--     jsonb_build_object('pl', 'SUV', 'en', 'SUV', 'el', 'SUV', 'he', 'SUV')
--   WHEN car_type->>'en' = 'Premium SUV' THEN 
--     jsonb_build_object('pl', 'SUV Premium', 'en', 'Premium SUV', 'el', 'Premium SUV', 'he', 'SUV פרימיום')
--   WHEN car_type->>'en' = 'MPV' OR car_type->>'en' = 'Large MPV' THEN 
--     jsonb_build_object('pl', 'Minivan', 'en', 'MPV', 'el', 'MPV', 'he', 'מיניוואן')
--   WHEN car_type->>'en' = 'Luxury' THEN 
--     jsonb_build_object('pl', 'Luksusowy', 'en', 'Luxury', 'el', 'Πολυτελές', 'he', 'יוקרתי')
--   WHEN car_type->>'en' = 'Premium' THEN 
--     jsonb_build_object('pl', 'Premium', 'en', 'Premium', 'el', 'Premium', 'he', 'פרימיום')
--   ELSE 
--     jsonb_build_object(
--       'pl', COALESCE(car_type->>'pl', car_type->>'en', 'Inne'),
--       'en', COALESCE(car_type->>'en', car_type->>'pl', 'Other'),
--       'el', COALESCE(car_type->>'el', 'Άλλο'),
--       'he', COALESCE(car_type->>'he', 'אחר')
--     )
-- END
-- WHERE car_type IS NOT NULL;

-- =====================================================
-- ✅ MIGRATION COMPLETE!
-- =====================================================
-- Final structure:
-- car_type: JSONB {"pl":"Ekonomiczny", "en":"Economy", ...}
-- car_model: JSONB {"pl":"Toyota Yaris", "en":"Toyota Yaris"}
-- description: JSONB {"pl":"...", "en":"..."}
-- =====================================================
