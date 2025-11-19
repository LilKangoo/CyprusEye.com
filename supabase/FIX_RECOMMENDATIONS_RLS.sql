-- ============================================================================
-- FIX RECOMMENDATIONS RLS - Napraw dostęp do kategorii przez JOIN
-- ============================================================================

-- Problem: Użytkownicy anonimowi nie mogą czytać recommendation_categories przez JOIN
-- Rozwiązanie: Dodaj prostą politykę SELECT dla wszystkich

-- Usuń istniejącą restrykcyjną politykę
DROP POLICY IF EXISTS recommendation_categories_select_public ON public.recommendation_categories;

-- Dodaj nową prostą politykę - wszyscy mogą czytać wszystkie kategorie (nie tylko active)
-- Bo admin też musi widzieć nieaktywne kategorie
CREATE POLICY recommendation_categories_select_all 
  ON public.recommendation_categories 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

-- Upewnij się że recommendation_categories ma włączone RLS
ALTER TABLE public.recommendation_categories ENABLE ROW LEVEL SECURITY;

-- Sprawdź czy recommendations ma dobrą politykę SELECT
DROP POLICY IF EXISTS recommendations_select_public ON public.recommendations;

CREATE POLICY recommendations_select_all
  ON public.recommendations 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

-- Upewnij się że recommendations ma włączone RLS  
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Test query - powinno zwrócić rekomendacje z kategoriami
SELECT 
  r.id,
  r.title_pl,
  r.title_en,
  r.active,
  c.name_pl as category_name_pl,
  c.name_en as category_name_en,
  c.icon as category_icon,
  c.color as category_color
FROM public.recommendations r
LEFT JOIN public.recommendation_categories c ON r.category_id = c.id
WHERE r.active = true
ORDER BY r.display_order ASC
LIMIT 5;
