-- =====================================================
-- FIX POIS PERMISSIONS
-- Grant admin users full access to pois table
-- =====================================================

-- OPTION 1: Grant direct permissions to authenticated users
-- (Use this if you want all authenticated users to edit POIs)
GRANT SELECT, INSERT, UPDATE, DELETE ON pois TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- OPTION 2: Create RLS policies for admin users
-- (Use this if you want only admin users to edit POIs)

-- First, make sure RLS is enabled
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin users can do everything on pois" ON pois;
DROP POLICY IF EXISTS "Everyone can view published pois" ON pois;
DROP POLICY IF EXISTS "Admin full access to pois" ON pois;

-- Policy 1: Everyone can read published POIs
CREATE POLICY "Everyone can view published pois" 
ON pois 
FOR SELECT 
USING (status = 'published' OR auth.role() = 'authenticated');

-- Policy 2: Admin users can do everything
CREATE POLICY "Admin users can do everything on pois" 
ON pois 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);

-- OPTION 3: Temporary - Disable RLS completely (NOT RECOMMENDED for production)
-- Only use this for testing!
-- ALTER TABLE pois DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFY
-- =====================================================

-- Check current policies
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
WHERE tablename = 'pois';

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'pois';

-- Check grants
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'pois';
