-- Fix trip_bookings table structure to match our requirements

-- 1. Change num_days and num_hours from text to integer
ALTER TABLE trip_bookings 
  ALTER COLUMN num_days TYPE integer USING COALESCE(num_days::integer, 1),
  ALTER COLUMN num_days SET DEFAULT 1;

ALTER TABLE trip_bookings 
  ALTER COLUMN num_hours TYPE integer USING COALESCE(num_hours::integer, 1),
  ALTER COLUMN num_hours SET DEFAULT 1;

-- 2. Change arrival_date and departure_date from timestamp to date and make NOT NULL
ALTER TABLE trip_bookings 
  ALTER COLUMN arrival_date TYPE date USING arrival_date::date;

ALTER TABLE trip_bookings 
  ALTER COLUMN departure_date TYPE date USING departure_date::date;

-- For existing rows, set default dates if null
UPDATE trip_bookings 
SET arrival_date = CURRENT_DATE 
WHERE arrival_date IS NULL;

UPDATE trip_bookings 
SET departure_date = CURRENT_DATE + INTERVAL '7 days' 
WHERE departure_date IS NULL;

-- Now make them NOT NULL
ALTER TABLE trip_bookings 
  ALTER COLUMN arrival_date SET NOT NULL,
  ALTER COLUMN departure_date SET NOT NULL;

-- 3. Change trip_date from timestamp to date
ALTER TABLE trip_bookings 
  ALTER COLUMN trip_date TYPE date USING trip_date::date;

-- 4. Remove old start_date column if it exists (we use trip_date now)
ALTER TABLE trip_bookings 
  DROP COLUMN IF EXISTS start_date;

-- 5. Add status check constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trip_bookings_status_check'
  ) THEN
    ALTER TABLE trip_bookings 
    ADD CONSTRAINT trip_bookings_status_check 
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'));
  END IF;
END $$;

COMMENT ON TABLE trip_bookings IS 'Customer bookings for trips/excursions - updated structure';
