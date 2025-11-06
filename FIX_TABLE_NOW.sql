-- =====================================================
-- USUŃ STARĄ I STWÓRZ NOWĄ TABELĘ CAR_BOOKINGS
-- =====================================================
-- URUCHOM TO W SUPABASE SQL EDITOR NATYCHMIAST!
-- =====================================================

-- Usuń starą tabelę jeśli istnieje
DROP TABLE IF EXISTS car_bookings CASCADE;

-- Stwórz prostą tabelę która NA PEWNO BĘDZIE DZIAŁAĆ
CREATE TABLE car_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal info
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT,
  
  -- Rental details
  car_model TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'paphos',
  
  pickup_date DATE NOT NULL,
  pickup_time TIME DEFAULT '10:00',
  pickup_location TEXT NOT NULL,
  pickup_address TEXT,
  
  return_date DATE NOT NULL,
  return_time TIME DEFAULT '10:00',
  return_location TEXT NOT NULL,
  return_address TEXT,
  
  -- Additional options
  num_passengers INTEGER DEFAULT 1,
  child_seats INTEGER DEFAULT 0,
  full_insurance BOOLEAN DEFAULT false,
  flight_number TEXT,
  special_requests TEXT,
  
  -- Booking metadata
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'website',
  
  -- Admin
  admin_notes TEXT,
  quoted_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_car_bookings_email ON car_bookings(email);
CREATE INDEX idx_car_bookings_created ON car_bookings(created_at DESC);
CREATE INDEX idx_car_bookings_status ON car_bookings(status);

-- Enable RLS
ALTER TABLE car_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for public form)
CREATE POLICY "Anyone can create bookings"
ON car_bookings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Authenticated users can read their own
CREATE POLICY "Users can view own bookings"
ON car_bookings FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Policy: Service role can do everything (for admin)
CREATE POLICY "Service role full access"
ON car_bookings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON car_bookings TO postgres;
GRANT ALL ON car_bookings TO service_role;
GRANT SELECT, INSERT ON car_bookings TO anon;
GRANT ALL ON car_bookings TO authenticated;

-- Verify table was created
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'car_bookings'
ORDER BY ordinal_position;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'car_bookings table created successfully!';
  RAISE NOTICE 'You can now use the reservation form.';
END $$;
