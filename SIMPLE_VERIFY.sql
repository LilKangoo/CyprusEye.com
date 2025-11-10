-- ============================================
-- SIMPLE VERIFICATION (bez \echo - działa w Supabase)
-- ============================================

-- 1. Sprawdź czy tabele istnieją
SELECT 
  'hotels' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'hotels'
  ) AS exists;

SELECT 
  'hotel_bookings' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'hotel_bookings'
  ) AS exists;

-- 2. Ile jest hoteli published?
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_published = true) as published
FROM public.hotels;

-- 3. Sprawdź RLS policies
SELECT 
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN ('hotels', 'hotel_bookings')
ORDER BY tablename, cmd;

-- 4. Sprawdź granty
SELECT 
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('hotels', 'hotel_bookings')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 5. Pokaż ostatnie bookings
SELECT 
  id,
  hotel_slug,
  customer_name,
  arrival_date,
  departure_date,
  status,
  created_at
FROM public.hotel_bookings
ORDER BY created_at DESC
LIMIT 5;
