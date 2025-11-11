-- =====================================================
-- FEATURES I18N MIGRATION V2 (FIXED)
-- Change features from JSONB array to JSONB object with i18n support
-- =====================================================

-- IMPORTANT: This builds on CARS_I18N_MIGRATION_V2.sql (already completed)

-- Current: features is JSONB array: ["Air Conditioning", "Automatic", "5 Seats"]
-- Target: features is JSONB object: {"pl": ["..."], "en": ["..."]}

-- =====================================================
-- STEP 1: Add features_temp as JSONB
-- =====================================================

ALTER TABLE car_offers 
ADD COLUMN IF NOT EXISTS features_temp JSONB;

-- =====================================================
-- STEP 2: Migrate existing features (JSONB array) to JSONB object
-- =====================================================

-- Migrate existing features JSONB array to JSONB object with pl and en keys
UPDATE car_offers 
SET features_temp = jsonb_build_object(
  'pl', features,
  'en', features
)
WHERE features IS NOT NULL 
  AND jsonb_typeof(features) = 'array' 
  AND jsonb_array_length(features) > 0;

-- For cars without features or empty arrays
UPDATE car_offers 
SET features_temp = '{}'::jsonb
WHERE features IS NULL 
  OR jsonb_typeof(features) != 'array'
  OR jsonb_array_length(features) = 0;

-- =====================================================
-- STEP 3: Verify migration
-- =====================================================

SELECT 
  id,
  location,
  car_model->>'en' as car_name,
  features as old_features,
  features_temp as new_features
FROM car_offers
WHERE features IS NOT NULL
LIMIT 5;

-- Expected output:
-- old_features: ["Air Conditioning", "Manual", "5 Seats"]
-- new_features: {"pl": ["Air Conditioning", "Manual", "5 Seats"], "en": ["Air Conditioning", "Manual", "5 Seats"]}

-- =====================================================
-- STEP 4: Drop old features column (AFTER VERIFICATION!)
-- =====================================================

-- ⚠️ UNCOMMENT ONLY AFTER VERIFYING STEP 3!
-- ALTER TABLE car_offers 
-- DROP COLUMN IF EXISTS features;

-- =====================================================
-- STEP 5: Rename features_temp to features
-- =====================================================

-- ⚠️ UNCOMMENT ONLY AFTER STEP 4!
-- ALTER TABLE car_offers 
-- RENAME COLUMN features_temp TO features;

-- =====================================================
-- STEP 6: Final verification
-- =====================================================

-- ⚠️ UNCOMMENT ONLY AFTER STEP 5!
-- SELECT 
--   column_name,
--   data_type,
--   udt_name
-- FROM information_schema.columns
-- WHERE table_name = 'car_offers'
--   AND column_name = 'features';
-- 
-- -- Expected: features | jsonb | jsonb
-- 
-- SELECT 
--   id,
--   car_model->>'pl' as car_name,
--   features,
--   pg_typeof(features) as features_type
-- FROM car_offers
-- WHERE features IS NOT NULL AND features != '{}'::jsonb
-- LIMIT 3;

-- Expected features structure:
-- {"pl": ["Klimatyzacja", "Bluetooth"], "en": ["Air Conditioning", "Bluetooth"]}

-- =====================================================
-- STEP 7: Add Polish translations for common features (OPTIONAL)
-- =====================================================

-- ⚠️ UNCOMMENT ONLY AFTER STEP 6!
-- This will translate common English features to Polish
-- UPDATE car_offers 
-- SET features = jsonb_set(
--   features,
--   '{pl}',
--   (
--     SELECT jsonb_agg(
--       CASE 
--         WHEN feature = 'Air Conditioning' THEN 'Klimatyzacja'
--         WHEN feature = 'Manual' THEN 'Manualna skrzynia biegów'
--         WHEN feature = 'Automatic' THEN 'Automatyczna skrzynia biegów'
--         WHEN feature LIKE '%Seats' THEN REPLACE(feature, 'Seats', 'Miejsc')
--         WHEN feature LIKE '%seats' THEN REPLACE(feature, 'seats', 'miejsc')
--         WHEN feature LIKE '% Seats' THEN REPLACE(feature, ' Seats', ' Miejsc')
--         WHEN feature = 'Radio/USB' OR feature = 'Radio' THEN 'Radio/USB'
--         WHEN feature LIKE '%Model' THEN REPLACE(feature, 'Model', 'Model')
--         WHEN feature = 'Bluetooth' THEN 'Bluetooth'
--         WHEN feature = 'GPS' OR feature = 'GPS Navigation' THEN 'GPS/Nawigacja'
--         WHEN feature = 'Reversing Camera' OR feature = 'Rear Camera' THEN 'Kamera cofania'
--         WHEN feature = 'Cruise Control' THEN 'Tempomat'
--         WHEN feature = 'Parking Sensors' THEN 'Czujniki parkowania'
--         WHEN feature = 'ABS' THEN 'ABS'
--         WHEN feature = 'Airbags' THEN 'Poduszki powietrzne'
--         WHEN feature = 'Premium Sound' THEN 'Premium dźwięk'
--         WHEN feature LIKE 'Leather%' THEN REPLACE(feature, 'Leather', 'Skórzane')
--         WHEN feature = 'USB' THEN 'USB'
--         WHEN feature LIKE 'Hybrid%' THEN 'Technologia hybrydowa'
--         ELSE feature
--       END
--     )
--     FROM jsonb_array_elements_text(features->'en') AS feature
--   )
-- )
-- WHERE features IS NOT NULL 
--   AND features != '{}'::jsonb
--   AND features ? 'en';

-- Verify translations
-- SELECT 
--   id,
--   car_model->>'en' as car_name,
--   features->'pl' as features_pl,
--   features->'en' as features_en
-- FROM car_offers
-- WHERE features IS NOT NULL AND features != '{}'::jsonb
-- LIMIT 5;
