-- =====================================================
-- FIX: Enable anonymous hotel bookings
-- Run this in Supabase SQL Editor
-- =====================================================

-- Check current policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'hotel_bookings';

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can create hotel bookings" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Anonymous can create hotel bookings" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Public can create hotel bookings" ON public.hotel_bookings;

-- Create new policy for INSERT that allows anonymous AND authenticated users
CREATE POLICY "Public can create hotel bookings"
  ON public.hotel_bookings 
  FOR INSERT
  WITH CHECK (true);

-- Grant necessary permissions to anon role
GRANT INSERT ON public.hotel_bookings TO anon;
GRANT INSERT ON public.hotel_bookings TO authenticated;

-- Verify the fix
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  roles,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'hotel_bookings' 
  AND cmd = 'INSERT';

-- Test insert as anonymous (should work)
-- SET ROLE anon;
-- INSERT INTO public.hotel_bookings (
--   hotel_id, hotel_slug, customer_name, customer_email, 
--   arrival_date, departure_date, nights, total_price, status
-- ) VALUES (
--   1, 'test-hotel', 'Test User', 'test@example.com',
--   '2025-01-01', '2025-01-05', 4, 500.00, 'pending'
-- );
-- RESET ROLE;
