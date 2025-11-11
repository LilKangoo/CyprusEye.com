-- =====================================================
-- TEMPORARY FIX - DISABLE RLS (TYLKO DO TESTÓW!)
-- ⚠️ NIE UŻYWAJ NA PRODUKCJI BEZ RLS!
-- =====================================================

-- Wyłącz RLS na tabeli pois
ALTER TABLE pois DISABLE ROW LEVEL SECURITY;

-- Daj pełne uprawnienia
GRANT ALL ON pois TO authenticated;
GRANT ALL ON pois TO anon;

-- Weryfikacja
SELECT 
  tablename,
  rowsecurity as "RLS enabled?"
FROM pg_tables 
WHERE tablename = 'pois';

-- =====================================================
-- ODŚWIEŻ ADMIN PANEL I TESTUJ
-- =====================================================

-- ⚠️ UWAGA: 
-- Po skończonych testach WŁĄCZ RLS z powrotem:
-- 
-- ALTER TABLE pois ENABLE ROW LEVEL SECURITY;
-- 
-- I dodaj właściwe policy dla adminów!
-- =====================================================
