-- =====================================================
-- QUICK SETUP: Dodaj kolumny XP do profiles
-- Skopiuj i uruchom w Supabase SQL Editor
-- =====================================================

-- 1. Dodaj kolumny (jeśli nie istnieją)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS visited_places TEXT[] DEFAULT '{}';

-- 2. Sprawdź czy się udało
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('xp', 'level', 'visited_places')
ORDER BY column_name;

-- Powinieneś zobaczyć 3 wiersze:
-- level           | integer  | 1
-- visited_places  | ARRAY    | '{}'
-- xp              | integer  | 0

-- =====================================================
-- GOTOWE! Odśwież stronę i wszystko powinno działać.
-- =====================================================
