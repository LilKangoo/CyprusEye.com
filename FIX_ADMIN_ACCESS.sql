-- =====================================================
-- 🔧 FIX ADMIN ACCESS - Diagnose and Fix
-- =====================================================
-- Run this in Supabase SQL Editor to fix "Access denied: Admin only" errors
-- =====================================================

-- STEP 1: Check if admin profile exists and has is_admin flag
-- =====================================================
SELECT 
  id,
  email,
  username,
  is_admin,
  created_at
FROM profiles 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Expected: Should show 1 row with is_admin = true
-- If is_admin is NULL or false, we need to fix it


-- STEP 2: Force create/update admin profile
-- =====================================================
-- This will INSERT if not exists, or UPDATE if exists
INSERT INTO profiles (
  id, 
  is_admin, 
  email, 
  username,
  level,
  xp
)
SELECT 
  id,
  true as is_admin,
  email,
  COALESCE(raw_user_meta_data->>'username', 'Admin') as username,
  2 as level,
  1000 as xp
FROM auth.users
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb'
ON CONFLICT (id) DO UPDATE
SET 
  is_admin = true,
  email = EXCLUDED.email,
  username = COALESCE(EXCLUDED.username, profiles.username),
  updated_at = NOW();


-- STEP 3: Verify the fix worked
-- =====================================================
SELECT 
  id,
  email,
  username,
  is_admin,
  level,
  xp
FROM profiles 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Expected: is_admin should be TRUE now


-- STEP 4: Test admin check function
-- =====================================================
-- NOTE: This will work ONLY when you're logged in as admin in the app
-- It will fail in SQL Editor because auth.uid() is NULL in editor

-- Run this in browser console while logged in:
/*
const { data, error } = await supabase.rpc('is_current_user_admin');
console.log('Is admin:', data, error);
*/


-- STEP 5: Check if all required columns exist
-- =====================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles'
  AND column_name IN ('is_admin', 'is_moderator', 'banned_until', 'ban_reason')
ORDER BY column_name;

-- Expected: All 4 columns should exist


-- =====================================================
-- 🎯 SUMMARY
-- =====================================================
-- After running this SQL:
-- 1. Admin profile should exist with is_admin = TRUE
-- 2. All required columns should be present
-- 3. Admin panel should work after refresh
-- 
-- If still not working, check browser console for auth errors
-- Make sure you're logged in as lilkangoomedia@gmail.com
-- =====================================================
