-- =====================================================
-- UPDATE CAR RENTAL SYSTEM - Safe Migration
-- =====================================================
-- This migration updates existing car rental structure
-- or creates new one if it doesn't exist
-- =====================================================

-- =====================================================
-- 1. DROP OLD POLICIES (if they exist)
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.car_offers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view available car offers" ON public.car_offers';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view all offers" ON public.car_offers';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage car offers" ON public.car_offers';
  END IF;

  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own bookings" ON public.car_bookings';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all bookings" ON public.car_bookings';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can create bookings" ON public.car_bookings';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update bookings" ON public.car_bookings';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete bookings" ON public.car_bookings';
  END IF;
END;
$$;

-- =====================================================
-- 2. CREATE OR UPDATE car_offers TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS car_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL CHECK (location IN ('paphos', 'larnaca')),
  car_type text NOT NULL,
  car_model text,
  price_per_day numeric(10,2) NOT NULL CHECK (price_per_day >= 0),
  currency text DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'GBP')),
  features jsonb DEFAULT '[]'::jsonb,
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_car_offers_location ON car_offers(location);
CREATE INDEX IF NOT EXISTS idx_car_offers_available ON car_offers(is_available);

-- =====================================================
-- 3. CREATE OR UPDATE car_bookings TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS car_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES car_offers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  customer_country text,
  pickup_location text NOT NULL CHECK (pickup_location IN ('paphos', 'larnaca')),
  return_location text NOT NULL CHECK (return_location IN ('paphos', 'larnaca')),
  pickup_date date NOT NULL,
  pickup_time time,
  return_date date NOT NULL,
  return_time time,
  car_type text NOT NULL,
  car_model text,
  days_count integer NOT NULL CHECK (days_count > 0),
  price_per_day numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  deposit_paid numeric(10,2) DEFAULT 0,
  insurance_added boolean DEFAULT false,
  insurance_cost numeric(10,2) DEFAULT 0,
  special_requests text,
  flight_number text,
  driver_license_number text,
  driver_age integer,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'no_show')),
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  payment_method text,
  payment_reference text,
  admin_notes text,
  internal_notes text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT valid_dates CHECK (return_date >= pickup_date)
);

DO $$
BEGIN
  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    ALTER TABLE public.car_bookings ADD COLUMN IF NOT EXISTS offer_id uuid;
    ALTER TABLE public.car_bookings ADD COLUMN IF NOT EXISTS customer_email text;
    ALTER TABLE public.car_bookings ADD COLUMN IF NOT EXISTS total_price numeric(10,2);
    ALTER TABLE public.car_bookings ADD COLUMN IF NOT EXISTS payment_status text;
    ALTER TABLE public.car_bookings ALTER COLUMN payment_status SET DEFAULT 'unpaid';
    UPDATE public.car_bookings SET payment_status = COALESCE(payment_status, 'unpaid') WHERE payment_status IS NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.car_bookings'::regclass
        AND conname = 'car_bookings_payment_status_check'
    ) THEN
      ALTER TABLE public.car_bookings
      ADD CONSTRAINT car_bookings_payment_status_check
      CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_bookings'
        AND column_name = 'email'
    ) THEN
      EXECUTE 'UPDATE public.car_bookings SET customer_email = COALESCE(customer_email, email) WHERE customer_email IS NULL';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_bookings'
        AND column_name = 'quoted_price'
    ) THEN
      EXECUTE 'UPDATE public.car_bookings SET total_price = COALESCE(total_price, final_price, quoted_price) WHERE total_price IS NULL';
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    ALTER TABLE public.car_bookings
      ADD COLUMN IF NOT EXISTS offer_id uuid;

    ALTER TABLE public.car_bookings
      ADD COLUMN IF NOT EXISTS customer_email text;

    ALTER TABLE public.car_bookings
      ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid'
      CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded'));

    ALTER TABLE public.car_bookings
      ADD COLUMN IF NOT EXISTS total_price numeric(10,2);

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_bookings'
        AND column_name = 'email'
    ) THEN
      EXECUTE 'UPDATE public.car_bookings SET customer_email = COALESCE(customer_email, email) WHERE customer_email IS NULL';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_bookings'
        AND column_name = 'quoted_price'
    ) THEN
      EXECUTE 'UPDATE public.car_bookings SET total_price = COALESCE(total_price, final_price, quoted_price) WHERE total_price IS NULL';
    END IF;

    UPDATE public.car_bookings
    SET payment_status = COALESCE(payment_status, 'unpaid')
    WHERE payment_status IS NULL;
  END IF;
END;
$$;

-- Create indexes
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

-- =====================================================
-- 4. AUTO-UPDATE TIMESTAMPS
-- =====================================================

CREATE OR REPLACE FUNCTION update_car_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_car_offers_updated_at ON car_offers;
CREATE TRIGGER set_car_offers_updated_at
  BEFORE UPDATE ON car_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_car_updated_at();

DROP TRIGGER IF EXISTS set_car_bookings_updated_at ON car_bookings;
CREATE TRIGGER set_car_bookings_updated_at
  BEFORE UPDATE ON car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_car_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE car_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_bookings ENABLE ROW LEVEL SECURITY;

-- Car Offers Policies
DROP POLICY IF EXISTS "car_offers_public_select" ON car_offers;
DROP POLICY IF EXISTS "car_offers_authenticated_select" ON car_offers;
DROP POLICY IF EXISTS "car_offers_admin_all" ON car_offers;

CREATE POLICY "car_offers_public_select"
  ON car_offers FOR SELECT
  USING (is_available = true);

CREATE POLICY "car_offers_authenticated_select"
  ON car_offers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "car_offers_admin_all"
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
DROP POLICY IF EXISTS "car_bookings_own_select" ON car_bookings;
DROP POLICY IF EXISTS "car_bookings_admin_select" ON car_bookings;
DROP POLICY IF EXISTS "car_bookings_anon_insert" ON car_bookings;
DROP POLICY IF EXISTS "car_bookings_admin_update" ON car_bookings;
DROP POLICY IF EXISTS "car_bookings_admin_delete" ON car_bookings;

CREATE POLICY "car_bookings_own_select"
  ON car_bookings FOR SELECT
  TO authenticated
  USING (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "car_bookings_admin_select"
  ON car_bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "car_bookings_anon_insert"
  ON car_bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "car_bookings_admin_update"
  ON car_bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "car_bookings_admin_delete"
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
-- 6. INSERT SAMPLE DATA (only if table is empty)
-- =====================================================

DO $$
BEGIN
  -- Check if car_offers is empty
  IF NOT EXISTS (SELECT 1 FROM car_offers LIMIT 1) THEN
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
  END IF;
END $$;

-- =====================================================
-- 7. ADMIN FUNCTIONS
-- =====================================================

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

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON car_offers TO authenticated;
GRANT SELECT ON car_bookings TO authenticated;
GRANT INSERT ON car_bookings TO authenticated;
GRANT SELECT ON car_offers TO anon;
GRANT INSERT ON car_bookings TO anon;

-- =====================================================
-- DONE!
-- =====================================================
