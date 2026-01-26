-- =====================================================
-- COMPLETE CAR RENTAL SYSTEM SETUP
-- =====================================================
-- Run this if you want to reset everything and start fresh
-- =====================================================

-- 1. DISABLE RLS temporarily
ALTER TABLE IF EXISTS car_offers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS car_bookings DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', ' ')
    FROM pg_policies 
    WHERE tablename IN ('car_offers', 'car_bookings')
  );
END $$;

-- 3. Grant basic access
GRANT SELECT ON car_offers TO authenticated;
GRANT SELECT ON car_offers TO anon;
GRANT ALL ON car_offers TO authenticated;

GRANT SELECT ON car_bookings TO authenticated;
GRANT INSERT ON car_bookings TO authenticated;
GRANT ALL ON car_bookings TO authenticated;

-- 4. Show all cars (test query)
SELECT 
  location,
  car_model,
  car_type,
  CASE 
    WHEN location = 'larnaca' THEN price_per_day::text || '€/day'
    WHEN location = 'paphos' THEN price_3days::text || '€/3d'
  END as price,
  is_available
FROM car_offers
ORDER BY location, sort_order;

-- Done! RLS is OFF for testing
-- All authenticated users have full access
-- All anonymous users can view cars
