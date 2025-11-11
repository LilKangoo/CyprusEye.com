-- =====================================================
-- TEST TRIPS - CURRENT STATE
-- Sprawdź aktualny stan Trips w bazie
-- =====================================================

-- 1. Struktura kolumn
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'trips' 
  AND column_name IN ('id', 'slug', 'title', 'description', 'start_city', 'is_published')
ORDER BY ordinal_position;

-- 2. Przykładowe dane (ostatnie 3 trips)
SELECT 
  id,
  slug,
  title,
  description,
  start_city,
  is_published,
  created_at
FROM trips
ORDER BY created_at DESC
LIMIT 3;

-- 3. Sprawdź jakie języki są używane
SELECT 
  slug,
  jsonb_object_keys(title) as title_languages,
  jsonb_object_keys(description) as description_languages
FROM trips
WHERE title IS NOT NULL
LIMIT 5;

-- 4. Przykładowy trip z pełną strukturą
SELECT 
  slug,
  title,
  description
FROM trips
WHERE slug = 'test-5-pl' OR slug LIKE 'test%'
LIMIT 1;
