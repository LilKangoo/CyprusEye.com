-- =====================================================
-- TRIPS TABLE RLS POLICIES (matching car_bookings pattern)
-- =====================================================

-- Enable RLS on trips table if not already enabled
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view published trips" ON trips;
DROP POLICY IF EXISTS "Admins can view all trips" ON trips;
DROP POLICY IF EXISTS "Admins can insert trips" ON trips;
DROP POLICY IF EXISTS "Admins can update trips" ON trips;
DROP POLICY IF EXISTS "Admins can delete trips" ON trips;

-- =====================================================
-- SELECT POLICIES
-- =====================================================

-- Public/anon users can view published trips
CREATE POLICY "Anyone can view published trips"
  ON trips FOR SELECT
  USING (is_published = true);

-- Authenticated users can view all trips (for admin panel)
CREATE POLICY "Authenticated users can view all trips"
  ON trips FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- INSERT POLICY (CRITICAL - like car_bookings)
-- =====================================================

-- Admins can insert trips (authenticated users with is_admin=true)
CREATE POLICY "Admins can insert trips"
  ON trips FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- =====================================================
-- UPDATE POLICY
-- =====================================================

-- Only admins can update trips
CREATE POLICY "Admins can update trips"
  ON trips FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- =====================================================
-- DELETE POLICY
-- =====================================================

-- Only admins can delete trips
CREATE POLICY "Admins can delete trips"
  ON trips FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant SELECT to authenticated users (for admin dashboard)
GRANT SELECT ON trips TO authenticated;

-- Grant INSERT/UPDATE/DELETE to authenticated (RLS will enforce admin check)
GRANT INSERT ON trips TO authenticated;
GRANT UPDATE ON trips TO authenticated;
GRANT DELETE ON trips TO authenticated;

-- Grant SELECT to anonymous users (for public trips page)
GRANT SELECT ON trips TO anon;

-- =====================================================
-- COMMENT
-- =====================================================

COMMENT ON TABLE trips IS 'Trips/excursions with RLS policies matching car_bookings pattern';
