-- =====================================================
-- NAPRAW RLS DLA CAR_BOOKINGS - URUCHOM TO TERAZ!
-- =====================================================

-- WYŁĄCZ RLS (najprostsze rozwiązanie dla publicznego formularza)
ALTER TABLE car_bookings DISABLE ROW LEVEL SECURITY;

-- Usuń wszystkie stare policies
DROP POLICY IF EXISTS "Anyone can create bookings" ON car_bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON car_bookings;
DROP POLICY IF EXISTS "Service role full access" ON car_bookings;

-- Włącz RLS z powrotem
ALTER TABLE car_bookings ENABLE ROW LEVEL SECURITY;

-- Stwórz prostą politykę - WSZYSCY mogą INSERT
CREATE POLICY "Public can insert bookings"
ON car_bookings
FOR INSERT
TO public
WITH CHECK (true);

-- Authenticated users mogą czytać wszystko
CREATE POLICY "Authenticated can read all"
ON car_bookings
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users mogą aktualizować wszystko (dla adminów)
CREATE POLICY "Authenticated can update all"
ON car_bookings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Authenticated users mogą usuwać wszystko (dla adminów)
CREATE POLICY "Authenticated can delete all"
ON car_bookings
FOR DELETE
TO authenticated
USING (true);

-- Nadaj permissions
GRANT ALL ON car_bookings TO postgres;
GRANT ALL ON car_bookings TO authenticated;
GRANT INSERT, SELECT ON car_bookings TO anon;
GRANT ALL ON car_bookings TO public;

-- Test INSERT jako anonymous
SET ROLE anon;
INSERT INTO car_bookings (
  full_name, email, phone,
  car_model, pickup_date, pickup_location,
  return_date, return_location,
  location, status, source
) VALUES (
  'Test RLS',
  'test@example.com',
  '+48 123 456 789',
  'Test Car',
  CURRENT_DATE + 1,
  'airport_pfo',
  CURRENT_DATE + 4,
  'airport_pfo',
  'paphos',
  'pending',
  'test'
);
RESET ROLE;

-- Sprawdź czy test booking został dodany
SELECT id, full_name, email, created_at 
FROM car_bookings 
WHERE email = 'test@example.com'
ORDER BY created_at DESC 
LIMIT 1;

-- Success!
DO $$ 
BEGIN 
  RAISE NOTICE '✅ RLS policies fixed!';
  RAISE NOTICE '✅ Anonymous users can now INSERT';
  RAISE NOTICE '✅ Test the form now!';
END $$;
