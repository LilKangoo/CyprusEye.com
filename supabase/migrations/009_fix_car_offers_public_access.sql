-- =====================================================
-- FIX CAR OFFERS PUBLIC ACCESS
-- =====================================================
-- Allow anonymous users to view available cars
-- =====================================================

-- Drop old policy
DROP POLICY IF EXISTS "car_offers_public_select" ON car_offers;

-- Create new policy with explicit TO anon
CREATE POLICY "car_offers_public_select"
  ON car_offers FOR SELECT
  TO anon, authenticated
  USING (is_available = true);

-- Verify RLS is enabled
ALTER TABLE car_offers ENABLE ROW LEVEL SECURITY;

-- Test query
DO $$ 
BEGIN 
  RAISE NOTICE 'car_offers public access policy updated!';
  RAISE NOTICE 'Anonymous users can now SELECT available cars';
END $$;
