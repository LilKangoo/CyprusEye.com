-- =====================================================
-- QUICK FIX - POIS RLS PERMISSIONS
-- Uruchom to w Supabase SQL Editor
-- =====================================================

-- KROK 1: Dodaj kolumnę is_admin jeśli nie istnieje
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- KROK 2: Ustaw siebie jako admina
-- =====================================================
-- Zamień 'twoj-email@example.com' na swój email z Supabase Auth
UPDATE profiles 
SET is_admin = true 
WHERE id = auth.uid();

-- Lub jeśli znasz swój email:
-- UPDATE profiles 
-- SET is_admin = true 
-- WHERE email = 'twoj-email@example.com';

-- KROK 3: Włącz RLS na tabeli pois
-- =====================================================
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- KROK 4: Usuń stare policy
-- =====================================================
DROP POLICY IF EXISTS "Admin users can do everything on pois" ON pois;
DROP POLICY IF EXISTS "Everyone can view published pois" ON pois;
DROP POLICY IF EXISTS "Public read access" ON pois;
DROP POLICY IF EXISTS "Admin full access to pois" ON pois;

-- KROK 5: Dodaj nowe policy
-- =====================================================

-- Policy 1: Wszyscy mogą czytać opublikowane POI
CREATE POLICY "Everyone can view published pois" 
ON pois 
FOR SELECT 
USING (
  status = 'published' 
  OR auth.role() = 'authenticated'
);

-- Policy 2: Admini mogą wszystko (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admin full access to pois" 
ON pois 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- KROK 6: Daj uprawnienia dla authenticated role
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON pois TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- WERYFIKACJA
-- =====================================================

-- Sprawdź czy jesteś adminem
SELECT 
  id, 
  email, 
  is_admin,
  created_at
FROM profiles 
WHERE id = auth.uid();

-- Sprawdź policies na tabeli pois
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'pois';

-- Sprawdź czy RLS jest włączone
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'pois';

-- =====================================================
-- GOTOWE!
-- =====================================================
-- Teraz odśwież admin panel i spróbuj edytować POI
