-- ============================================
-- FIX: Hotels & Hotel Bookings RLS
-- Uruchom TYLKO jeśli verification script pokazał ❌
-- ============================================

-- =============================================
-- 1. WŁĄCZ RLS (jeśli wyłączony)
-- =============================================
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. DROP ISTNIEJĄCE POLICIES (safe, jeśli nie ma - ignore error)
-- =============================================
DROP POLICY IF EXISTS "Public can read published hotels" ON public.hotels;
DROP POLICY IF EXISTS "Public can create hotel bookings" ON public.hotel_bookings;

-- =============================================
-- 3. CREATE POLICY: Hotels SELECT
-- =============================================
CREATE POLICY "Public can read published hotels"
ON public.hotels
FOR SELECT
USING (is_published = true);

-- =============================================
-- 4. CREATE POLICY: Hotel Bookings INSERT
-- =============================================
CREATE POLICY "Public can create hotel bookings"
ON public.hotel_bookings
FOR INSERT
WITH CHECK (true);

-- =============================================
-- 5. GRANT PERMISSIONS
-- =============================================

-- Hotels: SELECT dla anon i authenticated
GRANT SELECT ON public.hotels TO anon;
GRANT SELECT ON public.hotels TO authenticated;
GRANT SELECT ON public.hotels TO service_role;

-- Hotel Bookings: INSERT dla anon i authenticated
GRANT INSERT ON public.hotel_bookings TO anon;
GRANT INSERT ON public.hotel_bookings TO authenticated;
GRANT ALL ON public.hotel_bookings TO service_role;

-- Hotel Bookings: SELECT dla service_role (do czytania rezerwacji w admin)
GRANT SELECT ON public.hotel_bookings TO service_role;

-- =============================================
-- 6. SEQUENCES (uprawnienia do auto-increment)
-- =============================================
-- Jeśli używasz sequences dla ID (zwykle Supabase zarządza automatycznie)
-- Ale dla pewności:
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================
-- 7. WERYFIKACJA
-- =============================================
-- Sprawdź czy policies zostały utworzone
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('hotels', 'hotel_bookings')
ORDER BY tablename, policyname;

-- Sprawdź granty
SELECT 
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('hotels', 'hotel_bookings')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- =============================================
-- 8. TEST INSERT (sprawdź czy działa)
-- =============================================
-- Test jako anonymous user (symulacja frontend)
BEGIN;

-- Wybierz istniejący hotel
SELECT id, slug, title FROM public.hotels WHERE is_published = true LIMIT 1;

-- Test insert (podmień hotel_id na prawdziwy z powyższego SELECT)
INSERT INTO public.hotel_bookings (
  hotel_id,
  hotel_slug,
  customer_name,
  customer_email,
  customer_phone,
  arrival_date,
  departure_date,
  num_adults,
  num_children,
  nights,
  notes,
  total_price,
  status
) VALUES (
  (SELECT id FROM public.hotels WHERE is_published = true LIMIT 1),
  (SELECT slug FROM public.hotels WHERE is_published = true LIMIT 1),
  'Test User',
  'test@example.com',
  '+48123456789',
  CURRENT_DATE + 7,
  CURRENT_DATE + 12,
  2,
  0,
  5,
  'Test booking from RLS fix',
  500.00,
  'pending'
) RETURNING 
  id,
  hotel_slug,
  customer_name,
  arrival_date,
  departure_date,
  status,
  created_at;

-- Rollback (nie zapisujemy testowego rekordu)
-- ZAKOMENTUJ tę linię jeśli chcesz zachować test booking
ROLLBACK;
-- Albo użyj COMMIT; jeśli chcesz zachować

-- =============================================
-- 9. OPCJONALNE: Ustaw kilka hoteli na published
-- =============================================
-- Jeśli nie masz żadnych published hoteli, uruchom to:
-- UPDATE public.hotels 
-- SET is_published = true 
-- WHERE id IN (
--   SELECT id FROM public.hotels LIMIT 5
-- );

-- =============================================
-- 10. OPCJONALNE: Zobacz strukturę tabeli
-- =============================================
-- Wyświetl kolumny hotel_bookings
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'hotel_bookings'
ORDER BY ordinal_position;

-- =============================================
-- GOTOWE!
-- =============================================
\echo ''
\echo '✅ RLS policies i granty zostały ustawione.'
\echo ''
\echo 'Sprawdź powyżej:'
\echo '1. Czy policies się pojawiły (hotels: SELECT, hotel_bookings: INSERT)'
\echo '2. Czy granty są poprawne (anon: SELECT na hotels, INSERT na hotel_bookings)'
\echo '3. Czy test insert pokazał rekord (został rollback, ale powinien działać)'
\echo ''
\echo 'Jeśli wszystko OK, możesz testować formularz w przeglądarce!'
