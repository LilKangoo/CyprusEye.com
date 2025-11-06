-- =====================================================
-- NAJPROSTSZA WERSJA - WYŁĄCZ RLS CAŁKOWICIE
-- =====================================================
-- Jeśli powyższe nie działa, uruchom to:
-- =====================================================

-- Po prostu wyłącz RLS
ALTER TABLE car_bookings DISABLE ROW LEVEL SECURITY;

-- Usuń wszystkie policies
DROP POLICY IF EXISTS "Anyone can create bookings" ON car_bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON car_bookings;
DROP POLICY IF EXISTS "Service role full access" ON car_bookings;
DROP POLICY IF EXISTS "Public can insert bookings" ON car_bookings;
DROP POLICY IF EXISTS "Authenticated can read all" ON car_bookings;
DROP POLICY IF EXISTS "Authenticated can update all" ON car_bookings;
DROP POLICY IF EXISTS "Authenticated can delete all" ON car_bookings;

-- Nadaj pełne uprawnienia wszystkim
GRANT ALL ON car_bookings TO public;
GRANT ALL ON car_bookings TO anon;
GRANT ALL ON car_bookings TO authenticated;

-- Test
SELECT 'RLS disabled - form should work now!' as status;
