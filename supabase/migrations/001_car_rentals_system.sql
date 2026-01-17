-- =====================================================
-- CAR RENTALS SYSTEM FOR CYPRUSEYE.COM
-- =====================================================
-- This migration creates tables for car rental management
-- with support for multiple locations (Paphos, Larnaca)
-- =====================================================

-- =====================================================
-- 1. CAR OFFERS TABLE (Admin-managed offers)
-- =====================================================

CREATE TABLE IF NOT EXISTS car_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL CHECK (location IN ('paphos', 'larnaca')),
  car_type text NOT NULL, -- e.g., 'Economy', 'SUV', 'Luxury'
  car_model text, -- e.g., 'Toyota Yaris', 'Nissan Qashqai'
  price_per_day numeric(10,2) NOT NULL CHECK (price_per_day >= 0),
  currency text DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'GBP')),
  features jsonb DEFAULT '[]'::jsonb, -- Array of features like ['AC', 'GPS', 'Automatic']
  image_url text,
  description text,
  max_passengers integer DEFAULT 5,
  max_luggage integer DEFAULT 2,
  transmission text CHECK (transmission IN ('manual', 'automatic')),
  fuel_type text CHECK (fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid')),
  is_available boolean DEFAULT true,
  stock_count integer DEFAULT 1 CHECK (stock_count >= 0),
  min_rental_days integer DEFAULT 1,
  max_rental_days integer DEFAULT 30,
  deposit_amount numeric(10,2) DEFAULT 0,
  insurance_per_day numeric(10,2) DEFAULT 0,
  sort_order integer DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster queries by location
CREATE INDEX IF NOT EXISTS idx_car_offers_location ON car_offers(location);
CREATE INDEX IF NOT EXISTS idx_car_offers_available ON car_offers(is_available);

COMMENT ON TABLE car_offers IS 'Car rental offers managed by admin for Paphos and Larnaca locations';
COMMENT ON COLUMN car_offers.location IS 'Pickup location: paphos or larnaca';
COMMENT ON COLUMN car_offers.features IS 'JSON array of car features';
COMMENT ON COLUMN car_offers.stock_count IS 'Number of available cars of this type';

-- =====================================================
-- 2. CAR BOOKINGS TABLE (Customer reservations)
-- =====================================================

CREATE TABLE IF NOT EXISTS car_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Car Offer Reference
  offer_id uuid REFERENCES car_offers(id) ON DELETE SET NULL,
  
  -- Customer Information
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  customer_country text,
  
  -- Booking Details
  pickup_location text NOT NULL CHECK (pickup_location IN ('paphos', 'larnaca')),
  return_location text NOT NULL CHECK (return_location IN ('paphos', 'larnaca')),
  pickup_date date NOT NULL,
  pickup_time time,
  return_date date NOT NULL,
  return_time time,
  
  -- Pricing
  car_type text NOT NULL, -- Stored even if offer is deleted
  car_model text,
  days_count integer NOT NULL CHECK (days_count > 0),
  price_per_day numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  deposit_paid numeric(10,2) DEFAULT 0,
  insurance_added boolean DEFAULT false,
  insurance_cost numeric(10,2) DEFAULT 0,
  
  -- Additional Info
  special_requests text,
  flight_number text,
  driver_license_number text,
  driver_age integer,
  
  -- Status Management
  status text DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting confirmation
    'confirmed',    -- Booking confirmed
    'active',       -- Currently renting
    'completed',    -- Rental completed
    'cancelled',    -- Cancelled by customer or admin
    'no_show'       -- Customer didn't show up
  )),
  
  -- Payment Info
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN (
    'unpaid',
    'partial',
    'paid',
    'refunded'
  )),
  payment_method text, -- e.g., 'credit_card', 'cash', 'bank_transfer'
  payment_reference text,
  
  -- Admin Notes
  admin_notes text,
  internal_notes text,
  
  -- Stripe Integration (optional)
  stripe_session_id text,
  stripe_payment_intent_id text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (return_date >= pickup_date),
  CONSTRAINT valid_locations CHECK (pickup_location IS NOT NULL AND return_location IS NOT NULL)
);

-- Indexes for performance
DO $$
BEGIN
  ALTER TABLE public.car_bookings
  ADD COLUMN IF NOT EXISTS customer_email text;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'car_bookings'
      AND column_name = 'customer_email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_car_bookings_customer_email ON public.car_bookings(customer_email)';
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_car_bookings_status ON car_bookings(status);
CREATE INDEX IF NOT EXISTS idx_car_bookings_pickup_date ON car_bookings(pickup_date);
CREATE INDEX IF NOT EXISTS idx_car_bookings_location ON car_bookings(pickup_location, return_location);
CREATE INDEX IF NOT EXISTS idx_car_bookings_offer ON car_bookings(offer_id);
CREATE INDEX IF NOT EXISTS idx_car_bookings_created ON car_bookings(created_at DESC);

COMMENT ON TABLE car_bookings IS 'Customer car rental bookings';
COMMENT ON COLUMN car_bookings.status IS 'Booking workflow status';
COMMENT ON COLUMN car_bookings.payment_status IS 'Payment state tracking';

-- =====================================================
-- 3. AUTO-UPDATE TIMESTAMPS
-- =====================================================

CREATE OR REPLACE FUNCTION update_car_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to car_offers
DROP TRIGGER IF EXISTS set_car_offers_updated_at ON car_offers;
CREATE TRIGGER set_car_offers_updated_at
  BEFORE UPDATE ON car_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_car_updated_at();

-- Apply to car_bookings
DROP TRIGGER IF EXISTS set_car_bookings_updated_at ON car_bookings;
CREATE TRIGGER set_car_bookings_updated_at
  BEFORE UPDATE ON car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_car_updated_at();

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE car_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_bookings ENABLE ROW LEVEL SECURITY;

-- Car Offers Policies
-- Public can view available offers
CREATE POLICY "Anyone can view available car offers"
  ON car_offers FOR SELECT
  USING (is_available = true);

-- Authenticated users can view all offers
CREATE POLICY "Authenticated users can view all offers"
  ON car_offers FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify offers
CREATE POLICY "Admins can manage car offers"
  ON car_offers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Car Bookings Policies
-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON car_bookings FOR SELECT
  TO authenticated
  USING (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can view all bookings
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

-- Anyone can create bookings (including anonymous)
CREATE POLICY "Anyone can create bookings"
  ON car_bookings FOR INSERT
  WITH CHECK (true);

-- Only admins can update bookings
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

-- Only admins can delete bookings
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

-- =====================================================
-- 5. SAMPLE DATA - Initial Offers
-- =====================================================

-- Paphos Offers
INSERT INTO car_offers (location, car_type, car_model, price_per_day, features, transmission, fuel_type, description, max_passengers, max_luggage, deposit_amount, insurance_per_day, sort_order)
VALUES
  ('paphos', 'Economy', 'Toyota Yaris or similar', 25.00, '["Air Conditioning", "Manual", "5 Seats", "Radio/USB"]'::jsonb, 'manual', 'petrol', 'Perfect for city driving and short trips. Fuel efficient and easy to park.', 5, 2, 200.00, 10.00, 1),
  ('paphos', 'Compact', 'Nissan Micra or similar', 30.00, '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth"]'::jsonb, 'automatic', 'petrol', 'Comfortable compact car with automatic transmission.', 5, 2, 200.00, 12.00, 2),
  ('paphos', 'SUV', 'Nissan Qashqai or similar', 55.00, '["Air Conditioning", "Automatic", "5 Seats", "GPS", "Parking Sensors"]'::jsonb, 'automatic', 'diesel', 'Spacious SUV perfect for families and longer trips around Cyprus.', 5, 4, 300.00, 15.00, 3),
  ('paphos', 'Luxury', 'Mercedes C-Class or similar', 85.00, '["Air Conditioning", "Automatic", "Premium Sound", "GPS", "Leather Seats", "Parking Sensors"]'::jsonb, 'automatic', 'diesel', 'Premium sedan for a comfortable and stylish experience.', 5, 3, 500.00, 20.00, 4);

-- Larnaca Offers
INSERT INTO car_offers (location, car_type, car_model, price_per_day, features, transmission, fuel_type, description, max_passengers, max_luggage, deposit_amount, insurance_per_day, sort_order)
VALUES
  ('larnaca', 'Economy', 'Hyundai i10 or similar', 23.00, '["Air Conditioning", "Manual", "4 Seats", "Radio/USB"]'::jsonb, 'manual', 'petrol', 'Great value economy car for exploring Cyprus.', 4, 1, 200.00, 10.00, 1),
  ('larnaca', 'Compact', 'Peugeot 208 or similar', 28.00, '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth"]'::jsonb, 'automatic', 'petrol', 'Modern compact with great fuel economy.', 5, 2, 200.00, 12.00, 2),
  ('larnaca', 'SUV', 'Toyota RAV4 or similar', 60.00, '["Air Conditioning", "Automatic", "5 Seats", "GPS", "Parking Sensors", "Cruise Control"]'::jsonb, 'automatic', 'hybrid', 'Eco-friendly hybrid SUV with plenty of space.', 5, 4, 300.00, 15.00, 3),
  ('larnaca', 'Minivan', 'Opel Zafira or similar', 65.00, '["Air Conditioning", "Automatic", "7 Seats", "GPS", "Parking Sensors"]'::jsonb, 'automatic', 'diesel', 'Perfect for larger groups and families.', 7, 5, 350.00, 18.00, 4);

-- =====================================================
-- 6. ADMIN FUNCTIONS
-- =====================================================

-- Function to get booking statistics
CREATE OR REPLACE FUNCTION admin_get_car_booking_stats()
RETURNS TABLE (
  total_bookings bigint,
  active_rentals bigint,
  pending_bookings bigint,
  total_revenue numeric,
  bookings_today bigint,
  bookings_this_week bigint,
  bookings_this_month bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_bookings,
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'active'))::bigint as active_rentals,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_bookings,
    COALESCE(SUM(total_price) FILTER (WHERE payment_status IN ('paid', 'partial')), 0) as total_revenue,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::bigint as bookings_today,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::bigint as bookings_this_week,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')::bigint as bookings_this_month
  FROM car_bookings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update booking status
CREATE OR REPLACE FUNCTION admin_update_booking_status(
  booking_id uuid,
  new_status text,
  notes text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE car_bookings
  SET
    status = new_status,
    admin_notes = COALESCE(notes, admin_notes),
    confirmed_at = CASE WHEN new_status = 'confirmed' THEN now() ELSE confirmed_at END,
    cancelled_at = CASE WHEN new_status = 'cancelled' THEN now() ELSE cancelled_at END
  WHERE id = booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check car availability
CREATE OR REPLACE FUNCTION check_car_availability(
  p_offer_id uuid,
  p_pickup_date date,
  p_return_date date
)
RETURNS boolean AS $$
DECLARE
  v_stock integer;
  v_booked integer;
BEGIN
  -- Get stock count
  SELECT stock_count INTO v_stock
  FROM car_offers
  WHERE id = p_offer_id AND is_available = true;
  
  IF v_stock IS NULL THEN
    RETURN false;
  END IF;
  
  -- Count overlapping bookings
  SELECT COUNT(*) INTO v_booked
  FROM car_bookings
  WHERE offer_id = p_offer_id
    AND status IN ('confirmed', 'active')
    AND NOT (return_date < p_pickup_date OR pickup_date > p_return_date);
  
  RETURN v_booked < v_stock;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT ON car_offers TO authenticated;
GRANT SELECT ON car_bookings TO authenticated;
GRANT INSERT ON car_bookings TO authenticated;

-- Grant access to anonymous users (for public booking form)
GRANT SELECT ON car_offers TO anon;
GRANT INSERT ON car_bookings TO anon;

-- Admins get full access via RLS policies

-- =====================================================
-- END OF MIGRATION
-- =====================================================

-- Summary comment
COMMENT ON SCHEMA public IS 'Car rental system with offers for Paphos and Larnaca locations';
