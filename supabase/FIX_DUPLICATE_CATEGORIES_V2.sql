-- ============================================================================
-- FIX DUPLICATE CATEGORIES - POPRAWIONA KOLEJNOŚĆ
-- Uruchom to w Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- KROK 1: Zobacz duplikaty (opcjonalne - do sprawdzenia)
-- ============================================================================
SELECT 
  name_en,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at DESC) as ids,
  array_agg(icon ORDER BY created_at DESC) as icons,
  array_agg(created_at ORDER BY created_at DESC) as dates
FROM public.recommendation_categories
GROUP BY name_en
HAVING COUNT(*) > 1
ORDER BY name_en;

-- ============================================================================
-- KROK 2: ⚠️ NAJPIERW usuń duplikaty (zostaw najnowsze)
-- ============================================================================
DELETE FROM public.recommendation_categories
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY name_en 
        ORDER BY created_at DESC, id DESC
      ) as rn
    FROM public.recommendation_categories
  ) t
  WHERE rn > 1
);

-- Sprawdź ile usunięto
-- Powinno pokazać: DELETE X (gdzie X to liczba usuniętych duplikatów)

-- ============================================================================
-- KROK 3: POTEM dodaj UNIQUE constraint
-- ============================================================================
DO $$ 
BEGIN
  -- Usuń stary constraint jeśli istnieje (na wypadek ponownego uruchomienia)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'recommendation_categories_name_en_key'
  ) THEN
    ALTER TABLE public.recommendation_categories 
    DROP CONSTRAINT recommendation_categories_name_en_key;
    RAISE NOTICE 'Dropped existing UNIQUE constraint';
  END IF;
  
  -- Dodaj nowy constraint
  ALTER TABLE public.recommendation_categories 
  ADD CONSTRAINT recommendation_categories_name_en_key UNIQUE (name_en);
  RAISE NOTICE 'Added UNIQUE constraint on name_en';
END $$;

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

-- Sprawdź ile zaktualizowano
-- Powinno pokazać: UPDATE X

-- ============================================================================
-- KROK 5: Sprawdź wynik - BEZ duplikatów!
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
ORDER BY display_order, name_en;

-- Powinno być 8 kategorii (lub 9 jeśli dodałeś "Sklep / Shop"):
-- 1. Zakwaterowanie / Accommodation 🏨
-- 2. Restauracje / Restaurants 🍽️
-- 3. Wynajem Aut / Car Rentals 🚗
-- 4. Plaże / Beaches 🏖️
-- 5. Aktywności / Activities 🎯
-- 6. Zakupy / Shopping 🛍️
-- 7. Życie Nocne / Nightlife 🎉
-- 8. Usługi / Services 🔧

-- ============================================================================
-- KROK 6: Sprawdź czy są duplikaty (powinno być 0 wyników)
-- ============================================================================
SELECT 
  name_en,
  COUNT(*) as count
FROM public.recommendation_categories
GROUP BY name_en
HAVING COUNT(*) > 1;

-- Powinno pokazać: (0 rows) ✅

-- ============================================================================
-- GOTOWE! Kategorie bez duplikatów z emoji ikonami
-- ============================================================================
