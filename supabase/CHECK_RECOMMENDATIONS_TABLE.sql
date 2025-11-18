-- ============================================================================
-- SPRAWDZENIE STRUKTURY TABELI RECOMMENDATIONS
-- Uruchom to w Supabase SQL Editor żeby sprawdzić czy tabela istnieje
-- ============================================================================

-- Sprawdź czy tabela istnieje
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'recommendations'
) AS recommendations_table_exists;

-- Sprawdź kolumny tabeli recommendations
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recommendations'
ORDER BY ordinal_position;

-- Sprawdź czy tabela recommendation_categories istnieje
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'recommendation_categories'
) AS categories_table_exists;

-- Policz kategorie
SELECT COUNT(*) as categories_count 
FROM public.recommendation_categories;

-- Pokaż wszystkie kategorie
SELECT 
  id,
  name_pl,
  name_en,
  icon,
  color,
  display_order,
  active
FROM public.recommendation_categories
ORDER BY display_order;

-- Sprawdź polityki RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('recommendations', 'recommendation_categories')
ORDER BY tablename, policyname;
