-- =====================================================
-- TRIP BOOKINGS TABLE
-- =====================================================

-- Drop and recreate if exists
DROP TABLE IF EXISTS trip_bookings CASCADE;

CREATE TABLE trip_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trip reference
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  trip_slug text,
  
  -- Customer information
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  
  -- Booking details
  start_date date,
  num_adults integer DEFAULT 1,
  num_children integer DEFAULT 0,
  num_hours integer DEFAULT 1,
  num_days integer DEFAULT 1,
  notes text,
  
  -- Pricing
  total_price numeric(10,2),
  
  -- Status
  status text DEFAULT 'pending' CHECK (status IN (
    'pending',
    'confirmed',
    'completed',
    'cancelled'
  )),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_bookings_email ON trip_bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_trip_id ON trip_bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_created ON trip_bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_status ON trip_bookings(status);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_trip_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_trip_bookings_updated_at ON trip_bookings;
CREATE TRIGGER set_trip_bookings_updated_at
  BEFORE UPDATE ON trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_trip_bookings_updated_at();

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE trip_bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can create bookings
CREATE POLICY "Anyone can create trip bookings"
  ON trip_bookings FOR INSERT
  WITH CHECK (true);

-- Users can view their own bookings
CREATE POLICY "Users can view own trip bookings"
  ON trip_bookings FOR SELECT
  TO authenticated
  USING (customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Admins can view all bookings
CREATE POLICY "Admins can view all trip bookings"
  ON trip_bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can update bookings
CREATE POLICY "Admins can update trip bookings"
  ON trip_bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can delete bookings
CREATE POLICY "Admins can delete trip bookings"
  ON trip_bookings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON trip_bookings TO authenticated;
GRANT INSERT ON trip_bookings TO authenticated;
GRANT INSERT ON trip_bookings TO anon;

COMMENT ON TABLE trip_bookings IS 'Customer bookings for trips/excursions';
