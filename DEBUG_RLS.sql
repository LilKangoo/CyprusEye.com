-- ============================================
-- DEBUG: Sprawdź co blokuje INSERT
-- ============================================

-- 1. Sprawdź DOKŁADNIE policy INSERT
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
  AND cmd = 'INSERT';

-- 2. Sprawdź constraints (NOT NULL, CHECK, etc)
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.hotel_bookings'::regclass
ORDER BY contype;

-- 3. Sprawdź kolumny - które są NOT NULL?
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'hotel_bookings'
ORDER BY ordinal_position;

-- 4. Sprawdź czy RLS jest włączony
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'hotel_bookings';

-- 5. TEST INSERT jako anon (symulacja frontendu)
-- To pokaże DOKŁADNY błąd
SET ROLE anon;

-- Test insert
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
  total_price,
  status
) VALUES (
  (SELECT id FROM public.hotels WHERE is_published = true LIMIT 1),
  'test-hotel',
  'Test User',
  'test@example.com',
  '+48123456789',
  CURRENT_DATE + 7,
  CURRENT_DATE + 12,
  2,
  0,
  5,
  500.00,
  'pending'
);

-- Wróć do normalnej roli
RESET ROLE;
