-- =====================================================
-- VERIFY AND FIX CAR BOOKINGS TABLE COLUMNS
-- =====================================================
-- Ensures all required columns exist in car_bookings
-- =====================================================

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  -- Check and add child_seats if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'car_bookings' AND column_name = 'child_seats'
  ) THEN
    ALTER TABLE car_bookings ADD COLUMN child_seats INTEGER DEFAULT 0;
    RAISE NOTICE 'Added child_seats column';
  END IF;
  
  -- Check and add num_passengers if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'car_bookings' AND column_name = 'num_passengers'
  ) THEN
    ALTER TABLE car_bookings ADD COLUMN num_passengers INTEGER DEFAULT 1;
    RAISE NOTICE 'Added num_passengers column';
  END IF;
  
  -- Check and add full_insurance if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'car_bookings' AND column_name = 'full_insurance'
  ) THEN
    ALTER TABLE car_bookings ADD COLUMN full_insurance BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added full_insurance column';
  END IF;
  
  -- Check and add flight_number if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'car_bookings' AND column_name = 'flight_number'
  ) THEN
    ALTER TABLE car_bookings ADD COLUMN flight_number TEXT;
    RAISE NOTICE 'Added flight_number column';
  END IF;
  
  -- Check and add special_requests if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'car_bookings' AND column_name = 'special_requests'
  ) THEN
    ALTER TABLE car_bookings ADD COLUMN special_requests TEXT;
    RAISE NOTICE 'Added special_requests column';
  END IF;
  
  -- Check and add pickup_address if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'car_bookings' AND column_name = 'pickup_address'
  ) THEN
    ALTER TABLE car_bookings ADD COLUMN pickup_address TEXT;
    RAISE NOTICE 'Added pickup_address column';
  END IF;
  
  -- Check and add return_address if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'car_bookings' AND column_name = 'return_address'
  ) THEN
    ALTER TABLE car_bookings ADD COLUMN return_address TEXT;
    RAISE NOTICE 'Added return_address column';
  END IF;
  
  RAISE NOTICE 'All car_bookings columns verified!';
END $$;

-- Verify columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'car_bookings'
ORDER BY ordinal_position;
