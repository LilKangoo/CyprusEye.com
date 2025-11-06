-- =====================================================
-- QUICK FIX - Usuń stare policies i utwórz nowe
-- =====================================================

-- KROK 1: Wyłącz RLS tymczasowo
ALTER TABLE car_bookings DISABLE ROW LEVEL SECURITY;

-- KROK 2: Drop wszystkie stare policies
DROP POLICY IF EXISTS "Anyone can create bookings" ON car_bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON car_bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON car_bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON car_bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON car_bookings;

-- KROK 3: Utwórz nowe policies
CREATE POLICY "Anyone can create bookings"
ON car_bookings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

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

-- KROK 4: Włącz RLS z powrotem
ALTER TABLE car_bookings ENABLE ROW LEVEL SECURITY;

-- KROK 5: Fix car_offers public access
DROP POLICY IF EXISTS "car_offers_public_select" ON car_offers;

CREATE POLICY "car_offers_public_select"
  ON car_offers FOR SELECT
  TO anon, authenticated
  USING (is_available = true);

ALTER TABLE car_offers ENABLE ROW LEVEL SECURITY;

-- KROK 6: Weryfikacja
SELECT 
  'car_bookings policies' as check_type,
  COUNT(*) as count
FROM pg_policies 
WHERE tablename = 'car_bookings'
UNION ALL
SELECT 
  'car_offers policies',
  COUNT(*)
FROM pg_policies 
WHERE tablename = 'car_offers';

-- Powinno zwrócić:
-- car_bookings policies: 4
-- car_offers policies: 1 (lub więcej)
