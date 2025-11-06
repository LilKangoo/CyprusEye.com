-- =====================================================
-- ADD EXAMPLE CARS - Dodaj przykładowe auta
-- =====================================================
-- Uruchom TYLKO jeśli car_offers jest puste
-- =====================================================

-- Najpierw sprawdź ile aut jest
SELECT location, COUNT(*) as cars_count
FROM car_offers
GROUP BY location;

-- Jeśli Paphos ma 0 aut, uruchom poniższe INSERT:

INSERT INTO car_offers (
  location,
  car_type,
  car_model,
  transmission,
  fuel_type,
  seats,
  base_price,
  price_3_days,
  price_4_6_days,
  price_7_10_days,
  price_10plus_days,
  is_available,
  features,
  description
) VALUES 
(
  'paphos',
  'Economy',
  'Mitsubishi Mirage',
  'Automatic',
  'Petrol',
  4,
  35.00,
  35.00,
  32.00,
  30.00,
  28.00,
  true,
  '["Air Conditioning", "Bluetooth", "4 Doors", "ABS", "Airbags"]',
  'Perfect for city driving and exploring Cyprus'
),
(
  'paphos',
  'Compact',
  'Toyota Yaris',
  'Automatic',
  'Petrol',
  5,
  40.00,
  40.00,
  37.00,
  35.00,
  33.00,
  true,
  '["Air Conditioning", "Bluetooth", "5 Doors", "ABS", "Airbags", "USB Port"]',
  'Comfortable and economical for longer trips'
),
(
  'paphos',
  'SUV',
  'Nissan Qashqai',
  'Automatic',
  'Diesel',
  5,
  55.00,
  55.00,
  52.00,
  50.00,
  48.00,
  true,
  '["Air Conditioning", "Bluetooth", "5 Doors", "Navigation", "Cruise Control", "Parking Sensors"]',
  'Spacious SUV perfect for families'
)
ON CONFLICT DO NOTHING;

-- Weryfikacja
SELECT location, car_model, car_type, is_available
FROM car_offers
WHERE location = 'paphos'
ORDER BY base_price;
