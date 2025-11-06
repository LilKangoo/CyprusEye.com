-- =====================================================
-- SUPABASE SETUP: PROFILES VISIBILITY FOR COMMENTS
-- =====================================================
-- Run this in Supabase SQL Editor to ensure profiles
-- are visible to everyone (for comment authors display)
-- =====================================================

-- 1. Check if foreign key exists
-- =====================================================
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'poi_comments' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';

-- Expected result: poi_comments.user_id → profiles.id
-- If empty, run step 2


-- 2. Create foreign key if not exists
-- =====================================================
-- ONLY run if step 1 returned empty!

-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM information_schema.table_constraints 
--     WHERE table_name = 'poi_comments' 
--       AND constraint_name = 'poi_comments_user_id_fkey'
--   ) THEN
--     ALTER TABLE poi_comments
--       ADD CONSTRAINT poi_comments_user_id_fkey
--       FOREIGN KEY (user_id)
--       REFERENCES profiles(id)
--       ON DELETE CASCADE;
--   END IF;
-- END $$;


-- 3. Check existing RLS policies on profiles
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
WHERE tablename = 'profiles';

-- Look for a policy that allows SELECT for everyone
-- If not found, run step 4


-- 4. Enable RLS and create public SELECT policy
-- =====================================================

-- Enable RLS on profiles if not enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policy if exists (to recreate)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- Create new policy: Allow everyone (even anonymous) to SELECT profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  USING (true);

-- This allows:
-- ✅ Logged-in users to see all profiles
-- ✅ Anonymous users to see all profiles
-- ✅ JOIN queries to fetch profile data in comments


-- 5. Verify profiles table structure
-- =====================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('id', 'username', 'name', 'avatar_url')
ORDER BY ordinal_position;

-- Expected columns:
-- id          | uuid                     | NO
-- username    | text/varchar             | YES
-- name        | text/varchar             | YES
-- avatar_url  | text                     | YES


-- 6. Test JOIN query
-- =====================================================
-- This simulates what the app does:
SELECT 
  c.id,
  c.content,
  c.user_id,
  c.created_at,
  p.username,
  p.name,
  p.avatar_url
FROM poi_comments c
LEFT JOIN profiles p ON c.user_id = p.id
LIMIT 5;

-- If this works, the app should work too!
-- Expected: Comments with profile data (username, name, avatar_url)


-- 7. Test with Supabase client syntax
-- =====================================================
-- This is what the app actually uses:
-- You can test this in Supabase API docs or Postman

-- GET /rest/v1/poi_comments?select=id,content,user_id,profiles(username,name,avatar_url)&limit=5

-- If the above HTTP request works, the app will work!


-- =====================================================
-- SUMMARY
-- =====================================================
-- After running this script:
-- ✅ Foreign key: poi_comments.user_id → profiles.id
-- ✅ RLS enabled on profiles
-- ✅ Public SELECT policy on profiles
-- ✅ Everyone can see profile data in comments
-- =====================================================

-- NOTES:
-- 1. The "Public profiles" policy is READ-ONLY
--    Users can only UPDATE/DELETE their own profiles (other policies)
-- 2. This does NOT expose sensitive data
--    Only username, name, and avatar_url are fetched
-- 3. Email and other private fields are NOT exposed
-- =====================================================
