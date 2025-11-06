-- =====================================================
-- TEST POI SYSTEM - Quick diagnostic queries
-- =====================================================
-- Uruchom te query żeby sprawdzić czy wszystko działa
-- =====================================================

-- TEST 1: Sprawdź czy kolumna status istnieje
SELECT 
  '✅ Test 1: Status column' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'pois' AND column_name = 'status'
    ) 
    THEN '✅ Status column exists'
    ELSE '❌ Status column MISSING - run ADD_POI_STATUS_COLUMN.sql'
  END as result;

-- TEST 2: Sprawdź strukturę tabeli pois
SELECT 
  '✅ Test 2: Table structure' as test,
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'pois'
ORDER BY ordinal_position;

-- TEST 3: Sprawdź POI według statusu
SELECT 
  '✅ Test 3: POIs by status' as test,
  status,
  COUNT(*) as count
FROM pois
GROUP BY status;

-- TEST 4: Pokaż przykładowe POI
SELECT 
  '✅ Test 4: Sample POIs' as test,
  id,
  name,
  status,
  xp,
  lat,
  lng
FROM pois
ORDER BY created_at DESC
LIMIT 5;

-- TEST 5: Sprawdź funkcje admin
SELECT 
  '✅ Test 5: Admin functions' as test,
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('admin_create_poi', 'admin_update_poi')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- TEST 6: Sprawdź czy jesteś adminem
SELECT 
  '✅ Test 6: Your admin status' as test,
  CASE
    WHEN is_current_user_admin() THEN '✅ You are ADMIN'
    ELSE '❌ You are NOT admin - cannot manage POIs'
  END as result;

-- TEST 7: Pokaż ostatnie admin actions
SELECT 
  '✅ Test 7: Recent admin actions' as test,
  created_at,
  action_type,
  action_data
FROM admin_actions
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- QUICK FIXES - Jeśli coś nie działa
-- =====================================================

-- FIX 1: Ustaw wszystkie POI na 'published' (jeśli wszystkie są draft)
-- UPDATE pois SET status = 'published' WHERE status = 'draft';

-- FIX 2: Dodaj status column jeśli nie istnieje
-- ALTER TABLE pois ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';

-- FIX 3: Ustaw siebie jako admina (zmień email!)
-- UPDATE profiles SET is_admin = TRUE WHERE email = 'twoj@email.com';

-- FIX 4: Sprawdź czy POI ma wszystkie wymagane kolumny
-- SELECT * FROM pois WHERE lat IS NULL OR lng IS NULL OR xp IS NULL;

-- =====================================================
-- VERIFICATION SUMMARY
-- =====================================================

DO $$
DECLARE
  has_status BOOLEAN;
  total_pois INTEGER;
  published_pois INTEGER;
  is_admin BOOLEAN;
BEGIN
  -- Check status column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pois' AND column_name = 'status'
  ) INTO has_status;
  
  -- Count POIs
  SELECT COUNT(*) INTO total_pois FROM pois;
  SELECT COUNT(*) INTO published_pois FROM pois WHERE status = 'published';
  
  -- Check if current user is admin
  SELECT is_current_user_admin() INTO is_admin;
  
  -- Report
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'POI SYSTEM STATUS';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  
  IF has_status THEN
    RAISE NOTICE '✅ Status column: EXISTS';
  ELSE
    RAISE NOTICE '❌ Status column: MISSING';
    RAISE NOTICE '   → Run ADD_POI_STATUS_COLUMN.sql';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 POI Statistics:';
  RAISE NOTICE '   Total POIs: %', total_pois;
  RAISE NOTICE '   Published: %', published_pois;
  RAISE NOTICE '   Draft/Hidden: %', total_pois - published_pois;
  
  RAISE NOTICE '';
  IF is_admin THEN
    RAISE NOTICE '✅ Admin access: YES';
  ELSE
    RAISE NOTICE '❌ Admin access: NO';
    RAISE NOTICE '   → Set is_admin = TRUE in profiles table';
  END IF;
  
  RAISE NOTICE '';
  IF has_status AND total_pois > 0 AND is_admin THEN
    RAISE NOTICE '✅ POI system is ready!';
  ELSE
    RAISE NOTICE '⚠️  POI system needs configuration';
    IF NOT has_status THEN
      RAISE NOTICE '   1. Run ADD_POI_STATUS_COLUMN.sql';
    END IF;
    IF total_pois = 0 THEN
      RAISE NOTICE '   2. Add some POIs through admin panel';
    END IF;
    IF NOT is_admin THEN
      RAISE NOTICE '   3. Set your profile as admin';
    END IF;
  END IF;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
END $$;
