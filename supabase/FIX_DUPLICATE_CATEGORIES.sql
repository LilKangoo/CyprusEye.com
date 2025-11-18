-- ============================================================================
-- FIX DUPLICATE CATEGORIES
-- Uruchom to w Supabase SQL Editor żeby usunąć duplikaty
-- ============================================================================

-- KROK 1: Zobacz duplikaty
SELECT 
  name_en,
  COUNT(*) as count,
  array_agg(id) as ids,
  array_agg(icon) as icons
FROM public.recommendation_categories
GROUP BY name_en
HAVING COUNT(*) > 1
ORDER BY name_en;

-- ============================================================================
-- KROK 2: Dodaj UNIQUE constraint na name_en (jeśli jeszcze nie ma)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'recommendation_categories_name_en_key'
  ) THEN
    ALTER TABLE public.recommendation_categories 
    ADD CONSTRAINT recommendation_categories_name_en_key UNIQUE (name_en);
    RAISE NOTICE 'Added UNIQUE constraint on name_en';
  ELSE
    RAISE NOTICE 'UNIQUE constraint already exists';
  END IF;
END $$;

-- ============================================================================
-- KROK 3: Usuń duplikaty - zostaw tylko najnowszy (ostatni created_at)
-- ============================================================================
DELETE FROM public.recommendation_categories
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY name_en 
        ORDER BY created_at DESC
      ) as rn
    FROM public.recommendation_categories
  ) t
  WHERE rn > 1
);

-- ============================================================================
-- KROK 4: Zaktualizuj ikony z Material Icons na emoji
-- ============================================================================
UPDATE public.recommendation_categories
SET icon = CASE 
  WHEN icon = 'hotel' THEN '🏨'
  WHEN icon = 'restaurant' THEN '🍽️'
  WHEN icon = 'directions_car' THEN '🚗'
  WHEN icon = 'beach_access' THEN '🏖️'
  WHEN icon = 'local_activity' THEN '🎯'
  WHEN icon = 'shopping_bag' THEN '🛍️'
  WHEN icon = 'nightlife' THEN '🎉'
  WHEN icon = 'miscellaneous_services' THEN '🔧'
  ELSE icon
END
WHERE icon IN ('hotel', 'restaurant', 'directions_car', 'beach_access', 'local_activity', 'shopping_bag', 'nightlife', 'miscellaneous_services');

-- ============================================================================
-- KROK 5: Sprawdź wynik
-- ============================================================================
SELECT 
  id,
  name_pl,
  name_en,
  icon,
  color,
  display_order,
  active,
  created_at
FROM public.recommendation_categories
ORDER BY display_order, created_at;

-- ============================================================================
-- GOTOWE! Kategorie bez duplikatów z emoji ikonami
-- ============================================================================
