-- =====================================================
-- CAR BOOKINGS TABLE
-- =====================================================
-- Stores customer car rental reservations from website
-- =====================================================

-- Create car_bookings table
CREATE TABLE IF NOT EXISTS car_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT,
  
  -- Rental details
  car_model TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'paphos', -- paphos or larnaca
  
  pickup_date DATE NOT NULL,
  pickup_time TIME NOT NULL DEFAULT '10:00',
  pickup_location TEXT NOT NULL, -- airport_pfo, hotel, other
  pickup_address TEXT,
  
  return_date DATE NOT NULL,
  return_time TIME NOT NULL DEFAULT '10:00',
  return_location TEXT NOT NULL, -- airport_pfo, hotel, other
  return_address TEXT,
  
  -- Additional options
  num_passengers INTEGER DEFAULT 1,
  child_seats INTEGER DEFAULT 0,
  full_insurance BOOLEAN DEFAULT false,
  flight_number TEXT,
  special_requests TEXT,
  
  -- Booking metadata
  status TEXT DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  source TEXT DEFAULT 'website', -- website_autopfo, website_autolca, admin, other
  
  -- Admin notes
  admin_notes TEXT,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  
  -- Pricing (to be filled by admin)
  quoted_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (return_date >= pickup_date),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  CONSTRAINT valid_location CHECK (location IN ('paphos', 'larnaca', 'all-cyprus'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_car_bookings_status ON car_bookings(status);
CREATE INDEX IF NOT EXISTS idx_car_bookings_location ON car_bookings(location);
CREATE INDEX IF NOT EXISTS idx_car_bookings_pickup_date ON car_bookings(pickup_date);
CREATE INDEX IF NOT EXISTS idx_car_bookings_created_at ON car_bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_bookings_email ON car_bookings(email);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_car_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS car_bookings_updated_at_trigger ON car_bookings;
CREATE TRIGGER car_bookings_updated_at_trigger
  BEFORE UPDATE ON car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_car_bookings_updated_at();

-- RLS Policies (TEMPORARILY DISABLED - enable after testing)
-- For now, allow all operations for testing
ALTER TABLE car_bookings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert bookings (customer reservations)
CREATE POLICY "Anyone can create bookings"
ON car_bookings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow users to view their own bookings
CREATE POLICY "Users can view own bookings"
ON car_bookings FOR SELECT
TO authenticated
USING (email = auth.email());

-- Allow admins to view all bookings
CREATE POLICY "Admins can view all bookings"
ON car_bookings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Allow admins to update bookings
CREATE POLICY "Admins can update bookings"
ON car_bookings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Allow admins to delete bookings
CREATE POLICY "Admins can delete bookings"
ON car_bookings FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Create view for admin dashboard
CREATE OR REPLACE VIEW car_bookings_summary AS
SELECT 
  id,
  full_name,
  email,
  phone,
  car_model,
  location,
  pickup_date,
  return_date,
  status,
  quoted_price,
  final_price,
  created_at,
  (return_date - pickup_date) as rental_days
FROM car_bookings
ORDER BY created_at DESC;

-- Add comments
COMMENT ON TABLE car_bookings IS 'Customer car rental reservations from website forms';
COMMENT ON COLUMN car_bookings.status IS 'pending: new booking | confirmed: admin confirmed | completed: rental finished | cancelled: booking cancelled';
COMMENT ON COLUMN car_bookings.source IS 'Where the booking came from (website_autopfo, website_autolca, admin, etc)';
COMMENT ON COLUMN car_bookings.pickup_location IS 'airport_pfo, hotel, city_center, other';

-- Grant permissions to authenticated users
GRANT SELECT ON car_bookings_summary TO authenticated;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'car_bookings table created successfully!';
  RAISE NOTICE 'RLS policies enabled - anonymous users can insert, admins can manage all';
END $$;
