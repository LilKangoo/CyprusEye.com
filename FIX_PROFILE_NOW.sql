-- =====================================================
-- 🔧 NATYCHMIASTOWA NAPRAWA PROFILU ADMINA
-- =====================================================
-- Twój profil ma is_admin = TRUE ale też ma:
-- - ban_permanent = TRUE (jesteś zbanowany!)
-- - require_password_change = TRUE
-- - require_email_update = TRUE
-- - is_moderator = TRUE (powinno być FALSE, admin to wyższy poziom)
--
-- To może blokować dostęp! Naprawiamy WSZYSTKO:
-- =====================================================

-- KROK 1: Napraw profil - usuń wszystkie blokady
UPDATE profiles
SET 
  is_admin = TRUE,
  is_moderator = FALSE,
  ban_permanent = FALSE,
  banned_until = NULL,
  ban_reason = NULL,
  require_password_change = FALSE,
  require_email_update = FALSE,
  updated_at = NOW()
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Sprawdź czy się naprawiło
SELECT 
  id,
  email,
  username,
  is_admin,
  is_moderator,
  ban_permanent,
  banned_until,
  require_password_change,
  require_email_update
FROM profiles
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Expected output:
-- is_admin: TRUE
-- is_moderator: FALSE  
-- ban_permanent: FALSE
-- banned_until: NULL
-- require_password_change: FALSE
-- require_email_update: FALSE


-- =====================================================
-- KROK 2: Sprawdź RLS policies na profiles
-- =====================================================
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
WHERE tablename = 'profiles'
ORDER BY policyname;


-- =====================================================
-- KROK 3: Dodaj brakujące policies jeśli trzeba
-- =====================================================

-- Policy: Admin może czytać wszystkie profile
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
CREATE POLICY "Admin can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Admin może widzieć wszystkie profile
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = TRUE
    )
    OR 
    -- Każdy może widzieć swój profil
    id = auth.uid()
  );

-- Policy: Admin może aktualizować wszystkie profile
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
CREATE POLICY "Admin can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin może aktualizować wszystkie profile
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = TRUE
    )
    OR 
    -- Każdy może aktualizować swój profil
    id = auth.uid()
  );


-- =====================================================
-- KROK 4: Test funkcji is_current_user_admin
-- =====================================================
-- NOTE: To NIE ZADZIAŁA w SQL Editor (auth.uid() = NULL)
-- Musisz to przetestować w konsoli przeglądarki po zalogowaniu

-- W konsoli uruchom:
-- const { data } = await supabase.rpc('is_current_user_admin');
-- console.log('Is admin:', data); // powinno być TRUE


-- =====================================================
-- KROK 5: Sprawdź czy POIs są dostępne
-- =====================================================
SELECT COUNT(*) as total_pois FROM pois;

-- Sprawdź czy są jakieś POIs z statusem draft
SELECT 
  id,
  name,
  status,
  category,
  created_at
FROM pois
ORDER BY created_at DESC
LIMIT 10;


-- =====================================================
-- ✅ PO URUCHOMIENIU TEGO SQL:
-- =====================================================
-- 1. Profil admina będzie czysty (bez banów i blokad)
-- 2. RLS policies pozwolą adminowi czytać/pisać profile
-- 3. Funkcje admin powinny działać
-- 4. Wyloguj się i zaloguj ponownie dla pewności
-- 5. Sprawdź admin panel
-- =====================================================
