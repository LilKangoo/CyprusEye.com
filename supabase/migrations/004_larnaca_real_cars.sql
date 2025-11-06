-- =====================================================
-- REAL CAR OFFERS FOR LARNACA - Based on actual pricing
-- =====================================================
-- Based on the calculator pricing system
-- All cars with specific models, years, and actual prices
-- =====================================================

-- 1. Clear old sample data for Larnaca
DELETE FROM car_offers WHERE location = 'larnaca';

-- 2. Insert REAL Larnaca car fleet
-- =====================================================
-- ECONOMY CLASS (€30-35/day)
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage, 
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES
-- Toyota Yaris (2023) - €35/day
(
  'larnaca', 'Economy', 'Toyota Yaris (2023)', 35.00, 'EUR',
  '["Air Conditioning", "Manual", "5 Seats", "Radio/USB", "2023 Model"]'::jsonb,
  'manual', 'petrol',
  'Brand new 2023 Toyota Yaris. Perfect for city driving and exploring Cyprus. Fuel efficient and reliable.',
  5, 2,
  17.00, 200.00,
  true, 1, 1
),

-- Nissan Note (2020) - €35/day
(
  'larnaca', 'Economy', 'Nissan Note (2020)', 35.00, 'EUR',
  '["Air Conditioning", "Manual", "5 Seats", "Radio/USB", "Spacious Interior"]'::jsonb,
  'manual', 'petrol',
  'Comfortable Nissan Note 2020. Great for families with extra interior space.',
  5, 2,
  17.00, 200.00,
  true, 1, 2
),

-- Kia Rio (2019) - €35/day
(
  'larnaca', 'Economy', 'Kia Rio (2019)', 35.00, 'EUR',
  '["Air Conditioning", "Manual", "5 Seats", "Radio/USB", "Modern Design"]'::jsonb,
  'manual', 'petrol',
  'Stylish Kia Rio 2019. Economical and comfortable for your Cyprus adventure.',
  5, 2,
  17.00, 200.00,
  true, 1, 3
);

-- =====================================================
-- HYBRID ECONOMY CLASS (€40/day)
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES
-- Toyota Yaris Hybrid (2023) - €40/day
(
  'larnaca', 'Hybrid Economy', 'Toyota Yaris Hybrid (2023)', 40.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Hybrid Technology", "Eco Mode"]'::jsonb,
  'automatic', 'hybrid',
  'Brand new 2023 Toyota Yaris Hybrid. Excellent fuel economy with automatic transmission. Perfect for eco-conscious travelers.',
  5, 2,
  17.00, 250.00,
  true, 1, 10
),

-- Toyota Aqua Hybrid (2022) - €40/day
(
  'larnaca', 'Hybrid Economy', 'Toyota Aqua Hybrid (2022)', 40.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Hybrid Technology", "Eco Mode"]'::jsonb,
  'automatic', 'hybrid',
  'Toyota Aqua Hybrid 2022. Ultra-efficient hybrid with smooth automatic transmission.',
  5, 2,
  17.00, 250.00,
  true, 1, 11
),

-- Honda Fit (2022) - €40/day
(
  'larnaca', 'Compact', 'Honda Fit (2022)', 40.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Magic Seats", "USB Charging"]'::jsonb,
  'automatic', 'petrol',
  'Honda Fit 2022 with famous Magic Seats. Versatile interior space with automatic transmission.',
  5, 3,
  17.00, 250.00,
  true, 1, 12
),

-- Honda Fit Hybrid (2019) - €40/day
(
  'larnaca', 'Hybrid Compact', 'Honda Fit Hybrid (2019)', 40.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Hybrid Technology", "Magic Seats"]'::jsonb,
  'automatic', 'hybrid',
  'Honda Fit Hybrid 2019. Combines hybrid efficiency with practical Magic Seats system.',
  5, 3,
  17.00, 250.00,
  true, 1, 13
),

-- Honda Fit Hybrid (2022) - €40/day
(
  'larnaca', 'Hybrid Compact', 'Honda Fit Hybrid (2022)', 40.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Hybrid Technology", "Magic Seats", "Modern Design"]'::jsonb,
  'automatic', 'hybrid',
  'Newer Honda Fit Hybrid 2022. Latest model with improved fuel economy and comfort.',
  5, 3,
  17.00, 250.00,
  true, 1, 14
),

-- Nissan Note Hybrid (2023) - €40/day
(
  'larnaca', 'Hybrid Compact', 'Nissan Note Hybrid (2023)', 40.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Hybrid Technology", "E-Power System"]'::jsonb,
  'automatic', 'hybrid',
  'Brand new 2023 Nissan Note e-POWER Hybrid. Advanced hybrid system with spacious interior.',
  5, 3,
  17.00, 250.00,
  true, 1, 15
),

-- Mazda 2 (2023) - €40/day
(
  'larnaca', 'Compact', 'Mazda 2 (2023)', 40.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Modern Design", "Premium Interior"]'::jsonb,
  'automatic', 'petrol',
  'Brand new 2023 Mazda 2. Stylish design with premium interior finish and fun driving experience.',
  5, 2,
  17.00, 250.00,
  true, 1, 16
);

-- =====================================================
-- STANDARD/SEDAN CLASS (€55/day)
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES
-- Toyota Corolla (2021) - €55/day
(
  'larnaca', 'Standard Sedan', 'Toyota Corolla (2021)', 55.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Large Trunk", "Cruise Control"]'::jsonb,
  'automatic', 'petrol',
  'Toyota Corolla 2021. Reliable mid-size sedan with spacious trunk and comfortable ride.',
  5, 4,
  17.00, 300.00,
  true, 1, 20
);

-- =====================================================
-- COMFORT/LARGE SEDAN CLASS (€65/day)
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES
-- Mazda Atenza (2019) - €65/day
(
  'larnaca', 'Comfort Sedan', 'Mazda Atenza (2019)', 65.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Premium Sound", "Leather Seats", "Cruise Control"]'::jsonb,
  'automatic', 'petrol',
  'Mazda Atenza (Mazda6) 2019. Premium sedan with leather interior and advanced features.',
  5, 4,
  17.00, 300.00,
  true, 1, 30
),

-- Mazda Premacy (2018) - €65/day
(
  'larnaca', 'Minivan', 'Mazda Premacy (2018)', 65.00, 'EUR',
  '["Air Conditioning", "Automatic", "7 Seats", "Bluetooth", "Sliding Doors", "Family Friendly"]'::jsonb,
  'automatic', 'petrol',
  'Mazda Premacy 2018. Compact MPV with 7 seats and sliding doors. Perfect for families.',
  7, 4,
  17.00, 300.00,
  true, 1, 31
);

-- =====================================================
-- MPV/FAMILY CLASS (€70/day)
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES
-- Toyota Sienta (2022) - €70/day
(
  'larnaca', 'Family MPV', 'Toyota Sienta (2022)', 70.00, 'EUR',
  '["Air Conditioning", "Automatic", "7 Seats", "Bluetooth", "Sliding Doors", "Modern Design", "USB Charging"]'::jsonb,
  'automatic', 'hybrid',
  'Toyota Sienta 2022. Modern 7-seater MPV with hybrid engine. Perfect for larger families.',
  7, 5,
  17.00, 350.00,
  true, 1, 40
),

-- Nissan Serena Hybrid (2016) - €70/day
(
  'larnaca', 'Family MPV', 'Nissan Serena Hybrid (2016)', 70.00, 'EUR',
  '["Air Conditioning", "Automatic", "8 Seats", "Bluetooth", "Sliding Doors", "Hybrid Technology", "Spacious Interior"]'::jsonb,
  'automatic', 'hybrid',
  'Nissan Serena e-POWER Hybrid 2016. Spacious 8-seater with excellent fuel economy.',
  8, 5,
  17.00, 350.00,
  true, 1, 41
);

-- =====================================================
-- SPORT/PREMIUM CLASS (€80/day)
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES
-- Mazda Axela (2022) - €80/day
(
  'larnaca', 'Sport Sedan', 'Mazda Axela (2022)', 80.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Bluetooth", "Sport Suspension", "Premium Sound", "Leather Seats"]'::jsonb,
  'automatic', 'petrol',
  'Mazda Axela (Mazda3) 2022. Sporty sedan with premium features and dynamic driving.',
  5, 4,
  17.00, 350.00,
  true, 1, 50
);

-- =====================================================
-- PREMIUM MPV CLASS (€95/day)
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES
-- Nissan Serena Hybrid (2022) - €95/day
(
  'larnaca', 'Premium MPV', 'Nissan Serena Hybrid (2022)', 95.00, 'EUR',
  '["Air Conditioning", "Automatic", "8 Seats", "Bluetooth", "Sliding Doors", "Hybrid Technology", "ProPILOT Assist", "Around View Monitor"]'::jsonb,
  'automatic', 'hybrid',
  'Newest Nissan Serena e-POWER Hybrid 2022. Top-spec 8-seater with ProPILOT and advanced safety.',
  8, 5,
  17.00, 400.00,
  true, 1, 60
);

-- =====================================================
-- LUXURY CLASS (€150-180/day)
-- =====================================================

INSERT INTO car_offers (
  location, car_type, car_model, price_per_day, currency,
  features, transmission, fuel_type, description,
  max_passengers, max_luggage,
  insurance_per_day, deposit_amount,
  is_available, stock_count, sort_order
) VALUES
-- Mercedes S-class (2017) - €150/day
(
  'larnaca', 'Luxury Sedan', 'Mercedes S-class (2017)', 150.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Premium Sound", "Leather Seats", "Massage Seats", "Panoramic Roof", "Navigation"]'::jsonb,
  'automatic', 'diesel',
  'Mercedes-Benz S-Class 2017. Ultimate luxury sedan with massage seats and premium amenities.',
  5, 4,
  17.00, 500.00,
  true, 1, 100
),

-- Mercedes C-class (2020) - €180/day
(
  'larnaca', 'Premium Luxury', 'Mercedes C-class (2020)', 180.00, 'EUR',
  '["Air Conditioning", "Automatic", "5 Seats", "Premium Sound", "Leather Seats", "Navigation", "LED Headlights", "Digital Cockpit"]'::jsonb,
  'automatic', 'diesel',
  'Mercedes-Benz C-Class 2020. Latest model with digital cockpit and modern luxury features.',
  5, 3,
  17.00, 500.00,
  true, 1, 101
);

-- =====================================================
-- 3. Create location fees table
-- =====================================================

CREATE TABLE IF NOT EXISTS car_location_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name text UNIQUE NOT NULL,
  pickup_fee numeric(10,2) DEFAULT 0,
  return_fee numeric(10,2) DEFAULT 0,
  description text,
  is_active boolean DEFAULT true
);

-- Insert location fees
INSERT INTO car_location_fees (location_name, pickup_fee, return_fee, description) VALUES
('Larnaca', 0, 0, 'Main location - no additional fees'),
('Nicosia', 15, 15, 'Capital city - €15 each way'),
('Ayia Napa', 15, 15, 'Beach resort - €15 each way'),
('Protaras', 20, 20, 'Beach resort - €20 each way'),
('Limassol', 20, 20, 'Coastal city - €20 each way'),
('Paphos', 40, 40, 'Paphos Airport/City - €40 each way')
ON CONFLICT (location_name) DO UPDATE
SET 
  pickup_fee = EXCLUDED.pickup_fee,
  return_fee = EXCLUDED.return_fee,
  description = EXCLUDED.description;

-- =====================================================
-- 4. Create pricing rules table
-- =====================================================

CREATE TABLE IF NOT EXISTS car_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text UNIQUE NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('addon', 'discount', 'requirement')),
  price_per_day numeric(10,2),
  flat_fee numeric(10,2),
  description text,
  is_active boolean DEFAULT true
);

-- Insert pricing rules
INSERT INTO car_pricing_rules (rule_name, rule_type, price_per_day, flat_fee, description) VALUES
('Full Insurance', 'addon', 17.00, 0, 'Comprehensive AC insurance - €17 per day'),
('Young Driver Fee', 'addon', 10.00, 0, 'Additional fee for drivers under 25 - €10 per day'),
('Minimum Rental', 'requirement', 0, 0, 'Minimum rental period: 3 days (49 hours)')
ON CONFLICT (rule_name) DO UPDATE
SET 
  price_per_day = EXCLUDED.price_per_day,
  flat_fee = EXCLUDED.flat_fee,
  description = EXCLUDED.description;

-- =====================================================
-- 5. Update car_bookings to include extras
-- =====================================================

ALTER TABLE car_bookings 
ADD COLUMN IF NOT EXISTS young_driver_fee boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS young_driver_cost numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pickup_location_fee numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_location_fee numeric(10,2) DEFAULT 0;

-- =====================================================
-- DONE! 19 real cars added for Larnaca location
-- =====================================================

-- Summary query
SELECT 
  car_type,
  car_model,
  price_per_day,
  transmission,
  fuel_type,
  max_passengers
FROM car_offers 
WHERE location = 'larnaca'
ORDER BY sort_order;
