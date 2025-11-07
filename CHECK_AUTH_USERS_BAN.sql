-- =====================================================
-- 🔍 SPRAWDŹ CZY NIE JESTEŚ ZBANOWANY W AUTH.USERS
-- =====================================================
-- Problem może być że auth.users.banned_until ma wartość
-- To NADAL blokuje dostęp mimo że profiles.is_admin = TRUE
-- =====================================================

-- KROK 1: Sprawdź auth.users
SELECT 
  id,
  email,
  banned_until,
  created_at,
  last_sign_in_at,
  confirmed_at
FROM auth.users
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Expected: banned_until powinno być NULL
-- Jeśli ma wartość = jesteś zbanowany!


-- KROK 2: Usuń ban z auth.users (jeśli jest)
UPDATE auth.users
SET banned_until = NULL
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb'
AND banned_until IS NOT NULL;


-- KROK 3: Sprawdź profiles
SELECT 
  id,
  email,
  username,
  is_admin,
  ban_permanent,
  banned_until,
  require_password_change,
  require_email_update
FROM profiles
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Expected:
-- is_admin = TRUE
-- ban_permanent = FALSE
-- banned_until = NULL
-- require_password_change = FALSE
-- require_email_update = FALSE


-- KROK 4: Napraw profiles (jeśli trzeba)
UPDATE profiles
SET 
  is_admin = TRUE,
  ban_permanent = FALSE,
  banned_until = NULL,
  require_password_change = FALSE,
  require_email_update = FALSE,
  is_moderator = FALSE
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';


-- =====================================================
-- ✅ PO URUCHOMIENIU:
-- =====================================================
-- 1. Wyloguj się z admin panelu
-- 2. Zaloguj się ponownie
-- 3. Session będzie miała nowe dane (bez bana)
-- 4. Admin funkcje powinny działać
-- =====================================================
