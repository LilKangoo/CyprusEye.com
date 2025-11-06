-- =====================================================
-- DIAGNOZA CONTENT MANAGEMENT
-- =====================================================
-- Uruchom ten plik aby sprawdzić co jest źle
-- Skopiuj wyniki i napraw problemy
-- =====================================================

-- Test 1: Sprawdź czy jesteś zalogowany
SELECT 
  'Test 1: Current User' as test,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NOT LOGGED IN'
    ELSE '✅ Logged in as ' || auth.uid()::TEXT
  END as result;

-- Test 2: Sprawdź swój profil
SELECT 
  'Test 2: Your Profile' as test,
  CASE
    WHEN email IS NULL THEN '❌ Profile not found'
    WHEN is_admin = TRUE THEN '✅ You are admin: ' || email
    ELSE '❌ NOT ADMIN: ' || email || ' (is_admin = FALSE)'
  END as result
FROM profiles
WHERE id = auth.uid();

-- Test 3: Sprawdź funkcję is_current_user_admin
SELECT 
  'Test 3: is_current_user_admin function' as test,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_current_user_admin')
    THEN '✅ Function exists'
    ELSE '❌ Function MISSING - run ADMIN_CONTENT_COMPLETE_INSTALL.sql'
  END as result;

-- Test 4: Sprawdź czy funkcja działa
DO $$
BEGIN
  IF is_current_user_admin() THEN
    RAISE NOTICE 'Test 4: is_current_user_admin() returns: ✅ TRUE - You have admin access';
  ELSE
    RAISE NOTICE 'Test 4: is_current_user_admin() returns: ❌ FALSE - Set is_admin = TRUE in profiles';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Test 4: is_current_user_admin() ERROR: ❌ %', SQLERRM;
END $$;

-- Test 5: Sprawdź admin_actions table
SELECT 
  'Test 5: admin_actions table' as test,
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'admin_actions'
    )
    THEN '✅ Table exists'
    ELSE '❌ Table MISSING - run ADMIN_CONTENT_COMPLETE_INSTALL.sql'
  END as result;

-- Test 6: Lista wszystkich funkcji admin
SELECT 
  'Test 6: Admin Functions Count' as test,
  COUNT(*)::TEXT || ' functions found (need 9)' as result
FROM pg_proc
WHERE proname IN (
  'is_current_user_admin',
  'admin_get_all_comments',
  'admin_get_comment_details',
  'admin_update_comment',
  'admin_delete_comment_photo',
  'admin_delete_comment',
  'admin_get_all_photos',
  'admin_get_detailed_content_stats',
  'admin_bulk_comment_operation'
);

-- Test 7: Lista brakujących funkcji
SELECT 
  'Test 7: Missing Functions' as test,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = fname)
    THEN '❌ MISSING: ' || fname
    ELSE '✅ OK: ' || fname
  END as result
FROM (
  VALUES 
    ('is_current_user_admin'),
    ('admin_get_all_comments'),
    ('admin_get_comment_details'),
    ('admin_update_comment'),
    ('admin_delete_comment_photo'),
    ('admin_delete_comment'),
    ('admin_get_all_photos'),
    ('admin_get_detailed_content_stats'),
    ('admin_bulk_comment_operation')
) AS required_functions(fname);

-- Test 8: Sprawdź czy są jakieś komentarze
SELECT 
  'Test 8: Comments Data' as test,
  CASE
    WHEN COUNT(*) = 0 THEN '⚠️  No comments in database (OK if fresh install)'
    ELSE '✅ ' || COUNT(*)::TEXT || ' comments found'
  END as result
FROM poi_comments;

-- Test 9: Sprawdź RLS na admin_actions
SELECT 
  'Test 9: admin_actions RLS' as test,
  CASE
    WHEN relrowsecurity = TRUE THEN '✅ RLS enabled'
    ELSE '⚠️  RLS disabled'
  END as result
FROM pg_class
WHERE relname = 'admin_actions';

-- Test 10: Sprawdź permissions
SELECT 
  'Test 10: Function Permissions' as test,
  CASE
    WHEN has_function_privilege('authenticated', fname || signature, 'EXECUTE')
    THEN '✅ Permission OK: ' || fname
    ELSE '❌ NO PERMISSION: ' || fname
  END as result
FROM (
  VALUES 
    ('admin_get_all_comments', '(text,uuid,uuid,timestamp with time zone,timestamp with time zone,integer,integer)'),
    ('admin_get_comment_details', '(uuid)'),
    ('admin_get_detailed_content_stats', '()')
) AS funcs(fname, signature);

-- =====================================================
-- PODSUMOWANIE
-- =====================================================

DO $$
DECLARE
  admin_ok BOOLEAN;
  func_count INTEGER;
  table_ok BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'DIAGNOZA ZAKOŃCZONA';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  
  -- Check admin
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  ) INTO admin_ok;
  
  -- Check functions
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname IN (
    'is_current_user_admin',
    'admin_get_all_comments',
    'admin_get_comment_details',
    'admin_update_comment',
    'admin_delete_comment_photo',
    'admin_delete_comment',
    'admin_get_all_photos',
    'admin_get_detailed_content_stats',
    'admin_bulk_comment_operation'
  );
  
  -- Check table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'admin_actions'
  ) INTO table_ok;
  
  -- Report
  IF NOT admin_ok THEN
    RAISE NOTICE '❌ PROBLEM: You are NOT an admin';
    RAISE NOTICE 'FIX: Run this SQL:';
    RAISE NOTICE '  UPDATE profiles SET is_admin = TRUE WHERE email = ''lilkangoomedia@gmail.com'';';
    RAISE NOTICE '';
  END IF;
  
  IF func_count < 9 THEN
    RAISE NOTICE '❌ PROBLEM: Missing % functions (have %, need 9)', 9 - func_count, func_count;
    RAISE NOTICE 'FIX: Run ADMIN_CONTENT_COMPLETE_INSTALL.sql in SQL Editor';
    RAISE NOTICE '';
  END IF;
  
  IF NOT table_ok THEN
    RAISE NOTICE '❌ PROBLEM: admin_actions table missing';
    RAISE NOTICE 'FIX: Run ADMIN_CONTENT_COMPLETE_INSTALL.sql in SQL Editor';
    RAISE NOTICE '';
  END IF;
  
  IF admin_ok AND func_count = 9 AND table_ok THEN
    RAISE NOTICE '✅✅✅ ALL CHECKS PASSED!';
    RAISE NOTICE '';
    RAISE NOTICE 'Content Management should work now.';
    RAISE NOTICE 'If panel still shows errors:';
    RAISE NOTICE '  1. Clear browser cache (Ctrl+Shift+Delete)';
    RAISE NOTICE '  2. Logout and login again';
    RAISE NOTICE '  3. Open https://cypruseye.com/admin';
    RAISE NOTICE '  4. Click Content tab';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '  1. Fix problems listed above';
    RAISE NOTICE '  2. Run this diagnostic again';
    RAISE NOTICE '  3. When all tests pass, reload admin panel';
  END IF;
  
  RAISE NOTICE '=====================================================';
END $$;
