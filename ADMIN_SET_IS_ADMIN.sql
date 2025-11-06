-- ===================================================
-- ADMIN PANEL - Set is_admin flag for admin user
-- ===================================================
-- Run this ONCE in Supabase SQL Editor

-- 1. Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'is_admin'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Set is_admin = TRUE for the admin user
-- Using email to find the user
UPDATE profiles
SET is_admin = TRUE
WHERE email = 'lilkangoomedia@gmail.com';

-- 3. Verify it worked
SELECT 
    id,
    email,
    username,
    is_admin,
    created_at
FROM profiles
WHERE email = 'lilkangoomedia@gmail.com';

-- Expected result:
-- You should see is_admin = true for lilkangoomedia@gmail.com

-- If the above doesn't work, try using auth.users to get the ID:
-- SELECT id FROM auth.users WHERE email = 'lilkangoomedia@gmail.com';
-- Then update by ID:
-- UPDATE profiles SET is_admin = TRUE WHERE id = '[your-user-id]';
