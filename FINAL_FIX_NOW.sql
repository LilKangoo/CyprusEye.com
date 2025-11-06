-- =====================================================
-- DODAJ BRAKUJĄCĄ KOLUMNĘ COUNTRY
-- =====================================================
-- Uruchom to w Supabase SQL Editor
-- =====================================================

ALTER TABLE car_bookings 
ADD COLUMN IF NOT EXISTS country TEXT;

-- Sprawdź czy kolumna została dodana
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'car_bookings' 
  AND column_name = 'country';

-- Jeśli zwraca wynik, kolumna istnieje ✅
