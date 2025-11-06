-- =====================================================
-- REAL CAR OFFERS FOR PAPHOS - Tiered Pricing System
-- =====================================================
-- Based on actual Paphos pricing calculator
-- Different pricing tiers based on rental duration
-- =====================================================

-- 1. Clear old sample data for Paphos
DELETE FROM car_offers WHERE location = 'paphos';

-- 2. Add tiered pricing columns to car_offers
ALTER TABLE car_offers 
ADD COLUMN IF NOT EXISTS price_3days numeric(10,2),
ADD COLUMN IF NOT EXISTS price_4_6days numeric(10,2),
ADD COLUMN IF NOT EXISTS price_7_10days numeric(10,2),
ADD COLUMN IF NOT EXISTS price_10plus_days numeric(10,2);

COMMENT ON COLUMN car_offers.price_3days IS 'Fixed price for exactly 3-day rental';
COMMENT ON COLUMN car_offers.price_4_6days IS 'Daily rate for 4-6 day rentals';
COMMENT ON COLUMN car_offers.price_7_10days IS 'Daily rate for 7-10 day rentals';
COMMENT ON COLUMN car_offers.price_10plus_days IS 'Daily rate for 10+ day rentals';

-- 3. Insert REAL Paphos car fleet with tiered pricing
-- =====================================================
-- ECONOMY CLASS
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, 
  price_3days, price_4_6days, price_7_10days, price_10plus_days,
  price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES

-- Mitsubishi Mirage - €130 (3d) / €34-32-30/day
(
  'paphos', 'Economy', 'Mitsubishi Mirage',
  130.00, 34.00, 32.00, 30.00,
  34.00, 'EUR',
  '["Air Conditioning", "Manual", "5 Seats", "Radio/USB", "Fuel Efficient"]'::jsonb,
  'manual', 'petrol',
  'Mitsubishi Mirage - perfect economy car for exploring Paphos and surrounding areas. Great fuel economy.',
  5, 2,
  17.00, 200.00,
  true, 1, 1
),

-- Toyota Vitz - €130 (3d) / €36-34-32/day
(
  'paphos', 'Economy', 'Toyota Vitz',
  130.00, 36.00, 34.00, 32.00,
  36.00, 'EUR',
  '["Air Conditioning", "Manual", "5 Seats", "Radio/USB", "Reliable Toyota"]'::jsonb,
  'manual', 'petrol',
  'Toyota Vitz (Yaris) - reliable and comfortable economy car from Toyota. Perfect for city and coastal drives.',
  5, 2,
  17.00, 200.00,
  true, 1, 2
),

-- Toyota Aygo - €130 (3d) / €36-34-32/day
(
  'paphos', 'Economy', 'Toyota Aygo',
  130.00, 36.00, 34.00, 32.00,
  36.00, 'EUR',
  '["Air Conditioning", "Manual", "4 Seats", "Radio/USB", "Compact Size"]'::jsonb,
  'manual', 'petrol',
  'Toyota Aygo - ultra-compact and easy to park. Perfect for couples exploring Paphos old town and beaches.',
  4, 2,
  17.00, 200.00,
  true, 1, 3
);

-- =====================================================
-- COMPACT CLASS
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model,
  price_3days, price_4_6days, price_7_10days, price_10plus_days,
  price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES

-- Honda Fit - €130 (3d) / €38-36-34/day
(
  'paphos', 'Compact', 'Honda Fit',
  130.00, 38.00, 36.00, 34.00,
  38.00, 'EUR',
  '["Air Conditioning", "Manual", "5 Seats", "Radio/USB", "Magic Seats", "Spacious Interior"]'::jsonb,
  'manual', 'petrol',
  'Honda Fit with famous Magic Seats system. Surprisingly spacious interior with flexible seating arrangements.',
  5, 3,
  17.00, 250.00,
  true, 1, 10
);

-- =====================================================
-- MPV/MINIVAN CLASS
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model,
  price_3days, price_4_6days, price_7_10days, price_10plus_days,
  price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES

-- Mazda Premacy - €180 (3d) / €55-50-45/day
(
  'paphos', 'MPV', 'Mazda Premacy',
  180.00, 55.00, 50.00, 45.00,
  55.00, 'EUR',
  '["Air Conditioning", "Automatic", "7 Seats", "Sliding Doors", "Family Friendly", "Spacious"]'::jsonb,
  'automatic', 'petrol',
  'Mazda Premacy - comfortable 7-seater MPV with sliding doors. Perfect for families visiting Paphos attractions.',
  7, 4,
  17.00, 300.00,
  true, 1, 20
),

-- Nissan Serena - €225 (3d) / €70-65-60/day
(
  'paphos', 'Large MPV', 'Nissan Serena',
  225.00, 70.00, 65.00, 60.00,
  70.00, 'EUR',
  '["Air Conditioning", "Automatic", "8 Seats", "Sliding Doors", "Premium Features", "Extra Spacious"]'::jsonb,
  'automatic', 'petrol',
  'Nissan Serena - spacious 8-seater MPV. Ideal for large families or groups exploring Cyprus from Paphos.',
  8, 5,
  17.00, 350.00,
  true, 1, 21
);

-- =====================================================
-- SUV CLASS
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model,
  price_3days, price_4_6days, price_7_10days, price_10plus_days,
  price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES

-- Mitsubishi Outlander - €210 (3d) / €65-60-55/day
(
  'paphos', 'SUV', 'Mitsubishi Outlander',
  210.00, 65.00, 60.00, 55.00,
  65.00, 'EUR',
  '["Air Conditioning", "Automatic", "7 Seats", "4WD", "High Clearance", "Comfortable Ride"]'::jsonb,
  'automatic', 'petrol',
  'Mitsubishi Outlander - reliable 7-seater SUV with 4WD capability. Perfect for mountain trips around Troodos.',
  7, 4,
  17.00, 350.00,
  true, 1, 30
),

-- Mazda CX5 - €225 (3d) / €65-60-55/day
(
  'paphos', 'Premium SUV', 'Mazda CX5',
  225.00, 65.00, 60.00, 55.00,
  65.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Premium Interior", "Navigation", "Leather Seats", "Panoramic Roof"]'::jsonb,
  'automatic', 'diesel',
  'Mazda CX-5 - premium SUV with modern design and luxury features. Comfortable for long trips around Cyprus.',
  5, 4,
  17.00, 350.00,
  true, 1, 31
);

-- =====================================================
-- 4. Create function to calculate Paphos pricing
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_paphos_price(
  p_offer_id uuid,
  p_days integer,
  p_airport_pickup boolean DEFAULT false,
  p_airport_return boolean DEFAULT false,
  p_full_insurance boolean DEFAULT false
)
RETURNS TABLE (
  car_model text,
  days integer,
  base_price numeric,
  daily_rate numeric,
  airport_pickup_fee numeric,
  airport_return_fee numeric,
  insurance_cost numeric,
  total_price numeric
) AS $$
DECLARE
  v_offer car_offers%ROWTYPE;
  v_daily_rate numeric;
  v_base_price numeric;
  v_pickup_fee numeric := 0;
  v_return_fee numeric := 0;
  v_insurance numeric := 0;
BEGIN
  -- Get offer details
  SELECT * INTO v_offer FROM car_offers WHERE id = p_offer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Car offer not found';
  END IF;
  
  -- Determine daily rate based on rental duration (Paphos tiered pricing)
  IF p_days = 3 THEN
    v_base_price := v_offer.price_3days;
    v_daily_rate := v_offer.price_3days / 3.0;
  ELSIF p_days >= 4 AND p_days <= 6 THEN
    v_daily_rate := v_offer.price_4_6days;
    v_base_price := v_daily_rate * p_days;
  ELSIF p_days >= 7 AND p_days <= 10 THEN
    v_daily_rate := v_offer.price_7_10days;
    v_base_price := v_daily_rate * p_days;
  ELSIF p_days > 10 THEN
    v_daily_rate := v_offer.price_10plus_days;
    v_base_price := v_daily_rate * p_days;
  ELSE
    RAISE EXCEPTION 'Invalid rental duration. Minimum 3 days required.';
  END IF;
  
  -- Calculate extras
  IF p_airport_pickup THEN
    v_pickup_fee := 10;
  END IF;
  
  IF p_airport_return THEN
    v_return_fee := 10;
  END IF;
  
  IF p_full_insurance THEN
    v_insurance := 17 * p_days;
  END IF;
  
  -- Return result
  RETURN QUERY SELECT
    v_offer.car_model,
    p_days,
    v_base_price,
    v_daily_rate,
    v_pickup_fee,
    v_return_fee,
    v_insurance,
    v_base_price + v_pickup_fee + v_return_fee + v_insurance;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Update location fees for Paphos
-- =====================================================

-- Update Paphos location to note it's airport-based
UPDATE car_location_fees 
SET description = 'Paphos Airport - base location (no extra fees within Paphos city)'
WHERE location_name = 'Paphos';

-- Add Paphos-specific airport fees
INSERT INTO car_location_fees (location_name, pickup_fee, return_fee, description, is_active) VALUES
('Paphos Airport', 10, 10, 'Airport pickup/return - €10 each way', true)
ON CONFLICT (location_name) DO UPDATE
SET 
  pickup_fee = EXCLUDED.pickup_fee,
  return_fee = EXCLUDED.return_fee,
  description = EXCLUDED.description;

-- =====================================================
-- 6. Add Paphos booking columns
-- =====================================================

ALTER TABLE car_bookings
ADD COLUMN IF NOT EXISTS airport_pickup boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS airport_return boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS airport_pickup_fee numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS airport_return_fee numeric(10,2) DEFAULT 0;

-- =====================================================
-- DONE! 8 cars added for Paphos with tiered pricing
-- =====================================================

-- Summary query
SELECT 
  car_type,
  car_model,
  price_3days as "3 days",
  price_4_6days as "4-6 days/day",
  price_7_10days as "7-10 days/day",
  price_10plus_days as "10+ days/day",
  transmission,
  max_passengers as seats
FROM car_offers 
WHERE location = 'paphos'
ORDER BY sort_order;

-- Example price calculation
SELECT * FROM calculate_paphos_price(
  (SELECT id FROM car_offers WHERE location = 'paphos' AND car_model = 'Mazda CX5' LIMIT 1),
  7, -- 7 days
  true, -- airport pickup
  true, -- airport return
  true  -- full insurance
);
