-- ============================================
-- DISABLE RLS COMPLETELY - Najpewniejszy sposób
-- ============================================

-- 1. WYŁĄCZ RLS (bez żadnych policies)
ALTER TABLE public.hotel_bookings DISABLE ROW LEVEL SECURITY;

-- 2. SPRAWDŹ czy RLS jest disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'hotel_bookings';

-- Powinno pokazać: rls_enabled = false

-- 3. USUŃ WSZYSTKIE POLICIES (dla pewności)
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'hotel_bookings') 
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.hotel_bookings';
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

-- 4. SPRAWDŹ czy są jakieś policies (powinno być 0)
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'hotel_bookings';

-- 5. GRANTY (dla pewności)
GRANT ALL ON public.hotel_bookings TO anon;
GRANT ALL ON public.hotel_bookings TO authenticated;
GRANT ALL ON public.hotel_bookings TO postgres;

-- 6. TEST INSERT
INSERT INTO public.hotel_bookings (
  hotel_slug,
  customer_name,
  customer_email,
  arrival_date,
  departure_date,
  num_adults,
  num_children,
  nights,
  total_price,
  status
) VALUES (
  'test-no-rls',
  'Test NO RLS',
  'norls@test.com',
  CURRENT_DATE + 7,
  CURRENT_DATE + 12,
  2,
  0,
  5,
  500.00,
  'pending'
) RETURNING id, customer_name, status, created_at;

-- 7. FINAL CHECK
SELECT 
  'RLS Status: ' || CASE WHEN rowsecurity THEN 'ENABLED ❌' ELSE 'DISABLED ✅' END as status
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'hotel_bookings';

SELECT 
  'Policies Count: ' || COUNT(*)::text as policies
FROM pg_policies
WHERE tablename = 'hotel_bookings';
