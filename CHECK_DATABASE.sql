-- =====================================================
-- SPRAWDZENIE BAZY DANYCH POI
-- =====================================================
-- Uruchom to w Supabase SQL Editor
-- =====================================================

-- 1. Sprawdź czy tabela pois istnieje
SELECT 
  'Tabela pois istnieje' as status,
  COUNT(*) as total_rows
FROM pois;

-- 2. Sprawdź strukturę tabeli (kolumny)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'pois'
ORDER BY ordinal_position;

-- 3. Sprawdź wszystkie POI z ich statusem
SELECT 
  id,
  name,
  lat,
  lng,
  status,
  badge,
  xp,
  required_level,
  created_at
FROM pois
ORDER BY created_at DESC;

-- 4. Sprawdź ile POI jest Published
SELECT 
  status,
  COUNT(*) as count
FROM pois
GROUP BY status;

-- 5. Sprawdź czy są POI bez współrzędnych
SELECT 
  id,
  name,
  lat,
  lng,
  status,
  CASE 
    WHEN lat IS NULL OR lng IS NULL THEN '❌ BRAK WSPÓŁRZĘDNYCH'
    ELSE '✅ OK'
  END as coords_status
FROM pois
WHERE lat IS NULL OR lng IS NULL OR status = 'published';

-- 6. Sprawdź przykładowy POI (pierwszy published)
SELECT 
  id,
  name,
  description,
  lat,
  lng,
  badge,
  xp,
  required_level,
  status,
  google_maps_url,
  created_at,
  updated_at
FROM pois
WHERE status = 'published'
LIMIT 1;

-- =====================================================
-- TESTY I NAPRAWA
-- =====================================================

-- Jeśli BRAK POI lub wszystkie są DRAFT:
-- Ustaw wszystkie POI jako Published:
-- UPDATE pois SET status = 'published';

-- Jeśli POI nie mają współrzędnych:
-- Musisz dodać je ręcznie lub przez admin panel

-- Jeśli tabela nie istnieje:
-- Trzeba ją utworzyć (użyj FIX_POI_COLUMNS.sql)

-- =====================================================
-- WYNIK DO SKOPIOWANIA
-- =====================================================
-- Skopiuj wyniki wszystkich query i prześlij
