-- =====================================================
-- I18N MIGRATION - ALL ENTITIES
-- Adds multilingual support to all content types
-- =====================================================

-- =====================================================
-- 1. CAR OFFERS
-- =====================================================

-- Add i18n columns
ALTER TABLE car_offers ADD COLUMN IF NOT EXISTS car_type_i18n JSONB;
ALTER TABLE car_offers ADD COLUMN IF NOT EXISTS car_model_i18n JSONB;
ALTER TABLE car_offers ADD COLUMN IF NOT EXISTS description_i18n JSONB;

-- Migrate existing data
UPDATE car_offers 
SET 
  car_type_i18n = jsonb_build_object(
    'pl', COALESCE(car_type, 'Economy'),
    'en', COALESCE(car_type, 'Economy')
  ),
  car_model_i18n = jsonb_build_object(
    'pl', COALESCE(car_model, ''),
    'en', COALESCE(car_model, '')
  ),
  description_i18n = jsonb_build_object(
    'pl', COALESCE(description, ''),
    'en', COALESCE(description, '')
  )
WHERE car_type_i18n IS NULL OR car_model_i18n IS NULL OR description_i18n IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_car_offers_car_type_i18n ON car_offers USING GIN (car_type_i18n);
CREATE INDEX IF NOT EXISTS idx_car_offers_description_i18n ON car_offers USING GIN (description_i18n);

-- =====================================================
-- 2. TRIPS
-- =====================================================

-- Add i18n columns (if not exist - some may already have JSONB)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS title_i18n JSONB;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS description_i18n JSONB;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS short_description_i18n JSONB;

-- Migrate existing data
-- Check if 'title' column exists first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'title'
  ) THEN
    -- If title is text, migrate it
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'trips' AND column_name = 'title') = 'text' THEN
      UPDATE trips 
      SET title_i18n = jsonb_build_object(
        'pl', COALESCE(title, ''),
        'en', COALESCE(title, '')
      )
      WHERE title_i18n IS NULL;
    ELSE
      -- If title is already JSONB, copy it to title_i18n
      UPDATE trips 
      SET title_i18n = COALESCE(title, '{}'::jsonb)
      WHERE title_i18n IS NULL;
    END IF;
  END IF;
  
  -- Same for description
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'description'
  ) THEN
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'trips' AND column_name = 'description') = 'text' THEN
      UPDATE trips 
      SET description_i18n = jsonb_build_object(
        'pl', COALESCE(description, ''),
        'en', COALESCE(description, '')
      )
      WHERE description_i18n IS NULL;
    ELSE
      UPDATE trips 
      SET description_i18n = COALESCE(description, '{}'::jsonb)
      WHERE description_i18n IS NULL;
    END IF;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trips_title_i18n ON trips USING GIN (title_i18n);
CREATE INDEX IF NOT EXISTS idx_trips_description_i18n ON trips USING GIN (description_i18n);

-- =====================================================
-- 3. HOTELS
-- =====================================================

-- Add i18n columns
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS title_i18n JSONB;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS description_i18n JSONB;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS short_description_i18n JSONB;

-- Migrate existing data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hotels' AND column_name = 'title'
  ) THEN
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'hotels' AND column_name = 'title') = 'text' THEN
      UPDATE hotels 
      SET title_i18n = jsonb_build_object(
        'pl', COALESCE(title, ''),
        'en', COALESCE(title, '')
      )
      WHERE title_i18n IS NULL;
    ELSE
      UPDATE hotels 
      SET title_i18n = COALESCE(title, '{}'::jsonb)
      WHERE title_i18n IS NULL;
    END IF;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hotels' AND column_name = 'description'
  ) THEN
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'hotels' AND column_name = 'description') = 'text' THEN
      UPDATE hotels 
      SET description_i18n = jsonb_build_object(
        'pl', COALESCE(description, ''),
        'en', COALESCE(description, '')
      )
      WHERE description_i18n IS NULL;
    ELSE
      UPDATE hotels 
      SET description_i18n = COALESCE(description, '{}'::jsonb)
      WHERE description_i18n IS NULL;
    END IF;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hotels_title_i18n ON hotels USING GIN (title_i18n);
CREATE INDEX IF NOT EXISTS idx_hotels_description_i18n ON hotels USING GIN (description_i18n);

-- =====================================================
-- 4. TASKS/QUESTS
-- =====================================================

-- Add i18n columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS name_i18n JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description_i18n JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hint_i18n JSONB;

-- Migrate existing data
UPDATE tasks 
SET 
  name_i18n = jsonb_build_object(
    'pl', COALESCE(name, 'Unnamed Quest'),
    'en', COALESCE(name, 'Unnamed Quest')
  ),
  description_i18n = jsonb_build_object(
    'pl', COALESCE(description, ''),
    'en', COALESCE(description, '')
  ),
  hint_i18n = jsonb_build_object(
    'pl', COALESCE(hint, ''),
    'en', COALESCE(hint, '')
  )
WHERE name_i18n IS NULL OR description_i18n IS NULL OR hint_i18n IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_name_i18n ON tasks USING GIN (name_i18n);
CREATE INDEX IF NOT EXISTS idx_tasks_description_i18n ON tasks USING GIN (description_i18n);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check car_offers
SELECT 
  'car_offers' as table_name,
  COUNT(*) as total_rows,
  COUNT(car_type_i18n) as with_type_i18n,
  COUNT(description_i18n) as with_desc_i18n
FROM car_offers;

-- Check trips
SELECT 
  'trips' as table_name,
  COUNT(*) as total_rows,
  COUNT(title_i18n) as with_title_i18n,
  COUNT(description_i18n) as with_desc_i18n
FROM trips;

-- Check hotels
SELECT 
  'hotels' as table_name,
  COUNT(*) as total_rows,
  COUNT(title_i18n) as with_title_i18n,
  COUNT(description_i18n) as with_desc_i18n
FROM hotels;

-- Check tasks
SELECT 
  'tasks' as table_name,
  COUNT(*) as total_rows,
  COUNT(name_i18n) as with_name_i18n,
  COUNT(description_i18n) as with_desc_i18n
FROM tasks;
