-- =====================================================
-- CHECK CAR_OFFERS TABLE STRUCTURE
-- Sprawdź dokładną strukturę tabeli car_offers
-- =====================================================

-- 1. Wszystkie kolumny w car_offers
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'car_offers' 
ORDER BY ordinal_position;

-- 2. Ile jest samochodów w bazie?
SELECT COUNT(*) as total_cars FROM car_offers;

-- 3. Przykładowe dane (pierwsze 3 samochody)
SELECT 
  id,
  car_type,
  car_model,
  description,
  location,
  price_per_day,
  created_at
FROM car_offers
ORDER BY created_at DESC
LIMIT 3;

-- 4. Sprawdź czy są jakieś NULL wartości
SELECT 
  COUNT(*) as total,
  COUNT(car_model) as has_model,
  COUNT(description) as has_description,
  COUNT(*) - COUNT(car_model) as null_models,
  COUNT(*) - COUNT(description) as null_descriptions
FROM car_offers;

-- 5. Przykłady różnych car_type (jakie typy mamy)
SELECT DISTINCT car_type 
FROM car_offers 
ORDER BY car_type;

-- 6. Przykłady car_model dla każdego typu
SELECT 
  car_type,
  car_model,
  LEFT(description, 50) as description_preview
FROM car_offers
GROUP BY car_type, car_model, description
ORDER BY car_type
LIMIT 10;
