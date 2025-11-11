-- =====================================================
-- FEATURES I18N MIGRATION
-- Change features from text[] to JSONB with i18n support
-- =====================================================

-- IMPORTANT: This builds on CARS_I18N_MIGRATION_V2.sql (already completed)

-- =====================================================
-- STEP 1: Add features_temp as JSONB
-- =====================================================

ALTER TABLE car_offers 
ADD COLUMN IF NOT EXISTS features_temp JSONB;

-- =====================================================
-- STEP 2: Migrate existing features (text[]) to JSONB
-- =====================================================

-- Migrate existing features array to JSONB with pl and en keys
UPDATE car_offers 
SET features_temp = jsonb_build_object(
  'pl', to_jsonb(features),
  'en', to_jsonb(features)
)
WHERE features IS NOT NULL AND array_length(features, 1) > 0;

-- For cars without features, set to empty object
UPDATE car_offers 
SET features_temp = '{}'::jsonb
WHERE features IS NULL OR array_length(features, 1) = 0;

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
--   data_type
-- FROM information_schema.columns
-- WHERE table_name = 'car_offers'
--   AND column_name = 'features';
-- 
-- -- Expected: features | jsonb
-- 
-- SELECT 
--   id,
--   car_model->>'pl' as car_name,
--   features
-- FROM car_offers
-- WHERE features IS NOT NULL AND features != '{}'::jsonb
-- LIMIT 3;

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
--         WHEN feature = 'Radio/USB' THEN 'Radio/USB'
--         WHEN feature LIKE '%Model' THEN REPLACE(feature, 'Model', 'Model')
--         WHEN feature = 'Bluetooth' THEN 'Bluetooth'
--         WHEN feature = 'GPS' THEN 'GPS/Nawigacja'
--         WHEN feature = 'Reversing Camera' THEN 'Kamera cofania'
--         WHEN feature = 'Cruise Control' THEN 'Tempomat'
--         WHEN feature = 'Parking Sensors' THEN 'Czujniki parkowania'
--         WHEN feature = 'ABS' THEN 'ABS'
--         WHEN feature = 'Airbags' THEN 'Poduszki powietrzne'
--         ELSE feature
--       END
--     )
--     FROM jsonb_array_elements_text(features->'en') AS feature
--   )
-- )
-- WHERE features IS NOT NULL AND features != '{}'::jsonb;
