-- ============================================
-- WŁĄCZ RLS z powrotem (po teście)
-- Uruchom TYLKO jeśli formularz działa z RLS disabled
-- ============================================

-- 1. WŁĄCZ RLS
ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;

-- 2. STWÓRZ POLICY - INSERT dla wszystkich (public)
CREATE POLICY "allow_all_insert"
ON public.hotel_bookings
FOR INSERT
TO public
WITH CHECK (true);

-- 3. GRANTY
GRANT INSERT ON public.hotel_bookings TO anon;
GRANT INSERT ON public.hotel_bookings TO authenticated;

-- 4. WERYFIKACJA
SELECT 
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies
WHERE tablename = 'hotel_bookings';

-- 5. TEST INSERT (powinien działać z RLS enabled)
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
  'test-rls-enabled',
  'Test RLS Enabled',
  'rls@test.com',
  CURRENT_DATE + 7,
  CURRENT_DATE + 12,
  2,
  0,
  5,
  500.00,
  'pending'
) RETURNING id, customer_name, status, created_at;
