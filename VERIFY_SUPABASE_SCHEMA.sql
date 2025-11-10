-- ============================================
-- SUPABASE VERIFICATION SCRIPT
-- Sprawdź czy wszystko jest gotowe dla hotels booking
-- ============================================

-- =============================================
-- 1. SPRAWDŹ TABELĘ hotels
-- =============================================
\echo '1. Sprawdzam tabelę hotels...'

-- Czy tabela istnieje?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'hotels'
) AS hotels_table_exists;

-- Struktura kolumn
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'hotels'
ORDER BY ordinal_position;

-- Ile jest hoteli published?
SELECT 
  COUNT(*) as total_hotels,
  COUNT(*) FILTER (WHERE is_published = true) as published_hotels,
  COUNT(*) FILTER (WHERE is_published = false OR is_published IS NULL) as unpublished_hotels
FROM public.hotels;

-- Pokaż kilka przykładowych hoteli
SELECT 
  id,
  slug,
  title,
  city,
  is_published,
  created_at
FROM public.hotels
ORDER BY created_at DESC
LIMIT 5;

-- =============================================
-- 2. SPRAWDŹ TABELĘ hotel_bookings
-- =============================================
\echo '2. Sprawdzam tabelę hotel_bookings...'

-- Czy tabela istnieje?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'hotel_bookings'
) AS hotel_bookings_table_exists;

-- Struktura kolumn (wymagane dla formularza)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'hotel_bookings'
ORDER BY ordinal_position;

-- Ile jest rezerwacji?
SELECT 
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
FROM public.hotel_bookings;

-- Ostatnie rezerwacje
SELECT 
  id,
  hotel_slug,
  customer_name,
  customer_email,
  arrival_date,
  departure_date,
  nights,
  total_price,
  status,
  created_at
FROM public.hotel_bookings
ORDER BY created_at DESC
LIMIT 5;

-- =============================================
-- 3. SPRAWDŹ RLS POLICIES
-- =============================================
\echo '3. Sprawdzam RLS policies...'

-- RLS dla hotels (SELECT)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'hotels'
ORDER BY policyname;

-- RLS dla hotel_bookings (INSERT)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'hotel_bookings'
ORDER BY policyname;

-- =============================================
-- 4. SPRAWDŹ GRANTY (uprawnienia)
-- =============================================
\echo '4. Sprawdzam granty...'

-- Uprawnienia dla hotels
SELECT 
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'hotels'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

-- Uprawnienia dla hotel_bookings
SELECT 
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'hotel_bookings'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

-- =============================================
-- 5. SPRAWDŹ FOREIGN KEYS
-- =============================================
\echo '5. Sprawdzam foreign keys...'

SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('hotel_bookings', 'hotels');

-- =============================================
-- 6. TEST INSERT (dry run - nie zapisuje)
-- =============================================
\echo '6. Test struktury payloadu...'

-- Sprawdź czy można wstawić testowy rekord (używając ROLLBACK)
BEGIN;

-- Test insert
INSERT INTO public.hotel_bookings (
  hotel_id,
  hotel_slug,
  category_id,
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
  'test-hotel',
  NULL,
  'Test User',
  'test@example.com',
  '+48123456789',
  CURRENT_DATE + 7,
  CURRENT_DATE + 12,
  2,
  0,
  5,
  'Test booking',
  500.00,
  'pending'
) RETURNING *;

-- Rollback (nie zapisujemy testowego rekordu)
ROLLBACK;

\echo 'Test insert zakończony (rollback) - sprawdź czy powyżej pokazał się rekord'

-- =============================================
-- 7. PODSUMOWANIE I REKOMENDACJE
-- =============================================
\echo ''
\echo '============================================'
\echo 'PODSUMOWANIE:'
\echo '============================================'

-- Wymagane policies
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'hotels' 
      AND cmd = 'SELECT'
    ) THEN '✅ Hotels: SELECT policy exists'
    ELSE '❌ Hotels: Missing SELECT policy - run FIX below'
  END AS hotels_select_policy;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'hotel_bookings' 
      AND cmd = 'INSERT'
    ) THEN '✅ hotel_bookings: INSERT policy exists'
    ELSE '❌ hotel_bookings: Missing INSERT policy - run FIX below'
  END AS bookings_insert_policy;

-- Wymagane granty
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_privileges
      WHERE table_name = 'hotels'
      AND grantee = 'anon'
      AND privilege_type = 'SELECT'
    ) THEN '✅ hotels: anon can SELECT'
    ELSE '❌ hotels: anon cannot SELECT - run FIX below'
  END AS hotels_anon_select;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_privileges
      WHERE table_name = 'hotel_bookings'
      AND grantee = 'anon'
      AND privilege_type = 'INSERT'
    ) THEN '✅ hotel_bookings: anon can INSERT'
    ELSE '❌ hotel_bookings: anon cannot INSERT - run FIX below'
  END AS bookings_anon_insert;

\echo ''
\echo '============================================'
\echo 'JEŚLI WIDZISZ ❌ URUCHOM TEN FIX:'
\echo '============================================'
