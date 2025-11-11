-- Check features column structure
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'car_offers'
  AND column_name = 'features';

-- Sample features data
SELECT 
  id,
  location,
  car_model,
  features
FROM car_offers
WHERE features IS NOT NULL
LIMIT 3;
