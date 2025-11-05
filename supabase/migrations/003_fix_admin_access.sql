-- =====================================================
-- FIX ADMIN ACCESS - Set admin permissions
-- =====================================================

-- 1. Check if profiles table exists, create if not
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  name text,
  email text,
  is_admin boolean DEFAULT false,
  is_banned boolean DEFAULT false,
  banned_until timestamptz,
  level integer DEFAULT 1,
  xp integer DEFAULT 0,
  total_xp integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Set admin by User ID (15f3d442-092d-4eb8-9627-db90da0283eb)
-- Update existing profile
UPDATE profiles 
SET is_admin = true 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid;

-- If profile doesn't exist, create it from auth.users
INSERT INTO profiles (id, email, is_admin, username)
SELECT 
  id,
  email,
  true as is_admin,
  COALESCE(raw_user_meta_data->>'username', email) as username
FROM auth.users
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid
ON CONFLICT (id) DO UPDATE
SET is_admin = true;

-- 3. Alternative: Use simpler policies that don't require profiles table
-- Drop existing policies
DROP POLICY IF EXISTS "car_offers_admin_all" ON car_offers;
DROP POLICY IF EXISTS "car_bookings_admin_select" ON car_bookings;
DROP POLICY IF EXISTS "car_bookings_admin_update" ON car_bookings;
DROP POLICY IF EXISTS "car_bookings_admin_delete" ON car_bookings;

-- Create new policies using user_metadata directly
CREATE POLICY "car_offers_admin_all"
  ON car_offers FOR ALL
  TO authenticated
  USING (
    auth.uid() = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid
    OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "car_bookings_admin_select"
  ON car_bookings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid
    OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "car_bookings_admin_update"
  ON car_bookings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid
    OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "car_bookings_admin_delete"
  ON car_bookings FOR DELETE
  TO authenticated
  USING (
    auth.uid() = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid
    OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

-- 4. Check current user
SELECT 
  auth.uid() as your_user_id,
  auth.jwt() -> 'email' as your_email,
  auth.jwt() -> 'user_metadata' ->> 'is_admin' as is_admin_from_jwt;
