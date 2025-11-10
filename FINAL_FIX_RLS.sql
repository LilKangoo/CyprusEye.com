-- ============================================
-- FINAL FIX: Hotel Bookings RLS - PEWNY SPOSÓB
-- ============================================

-- KROK 1: WYŁĄCZ RLS tymczasowo (dla pewności)
ALTER TABLE public.hotel_bookings DISABLE ROW LEVEL SECURITY;

-- KROK 2: USUŃ WSZYSTKIE POLICIES
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'hotel_bookings') 
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.hotel_bookings';
  END LOOP;
END $$;

-- KROK 3: WŁĄCZ RLS
ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;

-- KROK 4: STWÓRZ JEDNĄ PROSTĄ POLICY - INSERT dla WSZYSTKICH
CREATE POLICY "allow_all_insert"
ON public.hotel_bookings
FOR INSERT
TO public
WITH CHECK (true);

-- KROK 5: GRANTY (na pewno)
GRANT INSERT ON public.hotel_bookings TO anon;
GRANT INSERT ON public.hotel_bookings TO authenticated;
GRANT INSERT ON public.hotel_bookings TO postgres;

-- KROK 6: WERYFIKACJA - MUSI pokazać policy
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'hotel_bookings';

-- KROK 7: TEST INSERT (powinien zadziałać)
INSERT INTO public.hotel_bookings (
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
  'test-hotel',
  'Test User FIX',
  'test@example.com',
  '+48123456789',
  CURRENT_DATE + 7,
  CURRENT_DATE + 12,
  2,
  0,
  5,
  500.00,
  'pending'
) RETURNING id, customer_name, status, created_at;

-- KROK 8: Sprawdź czy rekord się zapisał
SELECT 
  id,
  hotel_slug,
  customer_name,
  customer_email,
  arrival_date,
  departure_date,
  status,
  created_at
FROM public.hotel_bookings
ORDER BY created_at DESC
LIMIT 3;
