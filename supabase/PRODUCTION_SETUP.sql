-- =====================================================
-- PRODUCTION SETUP - CAR RENTALS
-- =====================================================
-- Uruchom ten plik JEDNORAZOWO w Supabase SQL Editor
-- aby skonfigurować system rezerwacji samochodów
-- =====================================================

-- KROK 1: Sprawdź czy tabele już istnieją
DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'car_bookings') THEN
    RAISE NOTICE '✅ car_bookings table already exists - skipping creation';
  ELSE
    RAISE NOTICE '⚠️  car_bookings table does not exist - will create';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'car_offers') THEN
    RAISE NOTICE '✅ car_offers table already exists';
  ELSE
    RAISE NOTICE '⚠️  car_offers table does not exist - you need to run migration 002_update_car_system.sql first!';
  END IF;
END $$;

-- =====================================================
-- KROK 2: Utwórz tabelę car_bookings (jeśli nie istnieje)
-- =====================================================

CREATE TABLE IF NOT EXISTS car_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT,
  
  -- Rental Details
  car_model TEXT NOT NULL,
  location TEXT NOT NULL CHECK (location IN ('paphos', 'larnaca')),
  
  -- Pickup
  pickup_date DATE NOT NULL,
  pickup_time TIME DEFAULT '10:00',
  pickup_location TEXT NOT NULL,
  pickup_address TEXT,
  
  -- Return
  return_date DATE NOT NULL,
  return_time TIME DEFAULT '10:00',
  return_location TEXT NOT NULL,
  return_address TEXT,
  
  -- Additional Options
  num_passengers INTEGER DEFAULT 1 CHECK (num_passengers >= 1 AND num_passengers <= 8),
  child_seats INTEGER DEFAULT 0 CHECK (child_seats >= 0 AND child_seats <= 3),
  full_insurance BOOLEAN DEFAULT false,
  flight_number TEXT,
  special_requests TEXT,
  
  -- Pricing
  quoted_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  
  -- Status & Admin
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  admin_notes TEXT,
  confirmed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (return_date >= pickup_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_car_bookings_email ON car_bookings(email);
CREATE INDEX IF NOT EXISTS idx_car_bookings_location ON car_bookings(location);
CREATE INDEX IF NOT EXISTS idx_car_bookings_status ON car_bookings(status);
CREATE INDEX IF NOT EXISTS idx_car_bookings_pickup_date ON car_bookings(pickup_date);
CREATE INDEX IF NOT EXISTS idx_car_bookings_created_at ON car_bookings(created_at DESC);

-- =====================================================
-- KROK 3: Trigger dla updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_car_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_car_bookings_updated_at_trigger ON car_bookings;

CREATE TRIGGER update_car_bookings_updated_at_trigger
  BEFORE UPDATE ON car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_car_bookings_updated_at();

-- =====================================================
-- KROK 4: RLS Policies - KRYTYCZNE!
-- =====================================================

-- Enable RLS
ALTER TABLE car_bookings ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Anyone can create bookings" ON car_bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON car_bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON car_bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON car_bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON car_bookings;

-- Allow anonymous users to INSERT bookings (customer reservations)
CREATE POLICY "Anyone can create bookings"
ON car_bookings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow admins to view all bookings
CREATE POLICY "Admins can view all bookings"
ON car_bookings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Allow admins to update bookings
CREATE POLICY "Admins can update bookings"
ON car_bookings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Allow admins to delete bookings
CREATE POLICY "Admins can delete bookings"
ON car_bookings FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- =====================================================
-- KROK 5: Fix car_offers public access - KRYTYCZNE!
-- =====================================================

-- Drop old policy
DROP POLICY IF EXISTS "car_offers_public_select" ON car_offers;

-- Create new policy with explicit TO anon
CREATE POLICY "car_offers_public_select"
  ON car_offers FOR SELECT
  TO anon, authenticated
  USING (is_available = true);

-- Verify RLS is enabled
ALTER TABLE car_offers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- KROK 6: Admin booking statistics function
-- =====================================================

CREATE OR REPLACE FUNCTION admin_get_car_booking_stats()
RETURNS TABLE (
  total_bookings BIGINT,
  active_rentals BIGINT,
  pending_bookings BIGINT,
  total_revenue DECIMAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_bookings,
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'active'))::BIGINT as active_rentals,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_bookings,
    COALESCE(SUM(final_price) FILTER (WHERE payment_status IN ('paid', 'partial')), 0) as total_revenue
  FROM car_bookings;
END;
$$;

-- =====================================================
-- KROK 7: Insert example car (only if car_offers is empty)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM car_offers WHERE location = 'paphos' LIMIT 1) THEN
    INSERT INTO car_offers (
      location,
      car_type,
      car_model,
      transmission,
      fuel_type,
      seats,
      base_price,
      price_3_days,
      price_4_6_days,
      price_7_10_days,
      price_10plus_days,
      is_available,
      features,
      description
    ) VALUES 
    (
      'paphos',
      'Economy',
      'Mitsubishi Mirage',
      'Automatic',
      'Petrol',
      4,
      35.00,
      35.00,
      32.00,
      30.00,
      28.00,
      true,
      '["Air Conditioning", "Bluetooth", "4 Doors", "ABS", "Airbags"]',
      'Perfect for city driving and exploring Cyprus'
    ),
    (
      'paphos',
      'Compact',
      'Toyota Yaris',
      'Automatic',
      'Petrol',
      5,
      40.00,
      40.00,
      37.00,
      35.00,
      33.00,
      true,
      '["Air Conditioning", "Bluetooth", "5 Doors", "ABS", "Airbags", "USB Port"]',
      'Comfortable and economical for longer trips'
    ),
    (
      'paphos',
      'SUV',
      'Nissan Qashqai',
      'Automatic',
      'Diesel',
      5,
      55.00,
      55.00,
      52.00,
      50.00,
      48.00,
      true,
      '["Air Conditioning", "Bluetooth", "5 Doors", "Navigation", "Cruise Control", "Parking Sensors"]',
      'Spacious SUV perfect for families'
    );
    
    RAISE NOTICE '✅ Example cars inserted for Paphos';
  ELSE
    RAISE NOTICE '✅ Cars already exist in car_offers - skipping insert';
  END IF;
END $$;

-- =====================================================
-- KROK 8: Verification
-- =====================================================

DO $$ 
DECLARE
  bookings_count INTEGER;
  offers_count INTEGER;
  policies_count INTEGER;
BEGIN 
  -- Count tables
  SELECT COUNT(*) INTO bookings_count FROM car_bookings;
  SELECT COUNT(*) INTO offers_count FROM car_offers WHERE location = 'paphos';
  SELECT COUNT(*) INTO policies_count FROM pg_policies WHERE tablename = 'car_bookings';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PRODUCTION SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables:';
  RAISE NOTICE '  - car_bookings: % rows', bookings_count;
  RAISE NOTICE '  - car_offers (paphos): % rows', offers_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Security:';
  RAISE NOTICE '  - car_bookings RLS policies: %', policies_count;
  RAISE NOTICE '  - car_offers public access: ENABLED';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions:';
  RAISE NOTICE '  - admin_get_car_booking_stats(): CREATED';
  RAISE NOTICE '';
  
  IF offers_count = 0 THEN
    RAISE WARNING '⚠️  No cars in car_offers! Add some cars or run migration 002_update_car_system.sql';
  END IF;
  
  IF policies_count < 4 THEN
    RAISE WARNING '⚠️  Missing some RLS policies! Expected 4, got %', policies_count;
  END IF;
  
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Check car_offers has cars: SELECT * FROM car_offers WHERE location = ''paphos'';';
  RAISE NOTICE '2. Test anonymous insert: should work without authentication';
  RAISE NOTICE '3. Deploy frontend code with npm run build && git push';
  RAISE NOTICE '4. Test on production: https://cypruseye.com/autopfo.html';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
