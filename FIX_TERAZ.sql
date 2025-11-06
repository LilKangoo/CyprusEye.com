-- =====================================================
-- NATYCHMIASTOWA NAPRAWA - Dodaj POI do bazy
-- =====================================================
-- Otwórz: https://supabase.com/dashboard/project/daoohnbnnowmmcizgvrq/editor
-- Skopiuj i uruchom całość (Cmd+Enter)
-- =====================================================

-- KROK 1: Sprawdź czy są POI
SELECT 
  'Aktualne POI:' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'published') as published,
  COUNT(*) FILTER (WHERE status = 'draft') as draft
FROM pois;

-- KROK 2: Jeśli są POI ale są DRAFT - ustaw jako PUBLISHED
UPDATE pois SET status = 'published';

-- KROK 3: Jeśli BRAK POI - dodaj przykładowe (3 markery):
INSERT INTO pois (id, name, description, lat, lng, badge, xp, required_level, status, google_maps_url)
VALUES 
  (
    'nicosia-old-town',
    'Nikozja - Stare Miasto',
    'Historyczne centrum stolicy Cypru z murami weneckimi',
    35.185566,
    33.382275,
    'Explorer',
    200,
    1,
    'published',
    'https://maps.google.com/?q=35.185566,33.382275'
  ),
  (
    'larnaca-beach',
    'Larnaka - Plaża Finikoudes',
    'Popularna plaża miejska z palmami i promenadą',
    34.917499,
    33.636414,
    'Beach Bum',
    150,
    1,
    'published',
    'https://maps.google.com/?q=34.917499,33.636414'
  ),
  (
    'limassol-marina',
    'Limassol - Marina',
    'Nowoczesna przystań z restauracjami i klubami',
    34.707409,
    33.022358,
    'City Explorer',
    180,
    1,
    'published',
    'https://maps.google.com/?q=34.707409,33.022358'
  )
ON CONFLICT (id) DO NOTHING;

-- KROK 4: Sprawdź rezultat
SELECT 
  '✅ GOTOWE! Masz teraz:' as status,
  COUNT(*) as total_poi,
  COUNT(*) FILTER (WHERE status = 'published') as published_poi
FROM pois;

-- KROK 5: Zobacz szczegóły POI
SELECT 
  id,
  name,
  lat,
  lng,
  status,
  xp,
  badge
FROM pois
WHERE status = 'published'
ORDER BY created_at DESC;

-- =====================================================
-- WYNIK:
-- Powinno pokazać 3 POI z statusem 'published'
-- =====================================================
