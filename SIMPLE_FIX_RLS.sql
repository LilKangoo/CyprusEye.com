-- ============================================
-- SIMPLE FIX: Hotels RLS (bez \echo - działa w Supabase)
-- ============================================

-- 1. WŁĄCZ RLS
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;

-- 2. USUŃ STARE POLICIES (jeśli istnieją)
DROP POLICY IF EXISTS "Public can read published hotels" ON public.hotels;
DROP POLICY IF EXISTS "Public can create hotel bookings" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Allow public insert to hotel_bookings" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Enable insert for anon users" ON public.hotel_bookings;

-- 3. STWÓRZ POLICY: Hotels SELECT
CREATE POLICY "Public can read published hotels"
ON public.hotels
FOR SELECT
USING (is_published = true);

-- 4. STWÓRZ POLICY: Hotel Bookings INSERT
CREATE POLICY "Public can create hotel bookings"
ON public.hotel_bookings
FOR INSERT
WITH CHECK (true);

-- 5. GRANTY
GRANT SELECT ON public.hotels TO anon;
GRANT SELECT ON public.hotels TO authenticated;

GRANT INSERT ON public.hotel_bookings TO anon;
GRANT INSERT ON public.hotel_bookings TO authenticated;

-- 6. SEQUENCES
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 7. WERYFIKACJA - Sprawdź czy działa
SELECT 
  tablename,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename IN ('hotels', 'hotel_bookings')
ORDER BY tablename;

SELECT 
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('hotels', 'hotel_bookings')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;
