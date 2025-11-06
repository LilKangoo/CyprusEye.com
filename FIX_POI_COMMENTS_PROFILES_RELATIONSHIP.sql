-- =====================================================
-- FIX: POI_COMMENTS TO PROFILES RELATIONSHIP
-- =====================================================
-- This script fixes the relationship error:
-- "Could not find a relationship between 'poi_comments' and 'profiles'"
-- 
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Check if poi_comments table exists
-- =====================================================
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'poi_comments'
) as poi_comments_exists;


-- STEP 2: Create poi_comments table if it doesn't exist
-- =====================================================
CREATE TABLE IF NOT EXISTS poi_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  parent_comment_id UUID REFERENCES poi_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT false
);


-- STEP 3: Drop existing foreign key if it exists (to recreate it properly)
-- =====================================================
DO $$
BEGIN
  -- Drop constraint if it references auth.users
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'poi_comments' 
      AND constraint_name = 'poi_comments_user_id_fkey'
  ) THEN
    ALTER TABLE poi_comments DROP CONSTRAINT poi_comments_user_id_fkey;
    RAISE NOTICE 'Dropped existing poi_comments_user_id_fkey constraint';
  END IF;
END $$;


-- STEP 4: Add foreign key to profiles table
-- =====================================================
-- This is critical for Supabase to understand the relationship
ALTER TABLE poi_comments
  ADD CONSTRAINT poi_comments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- IMPORTANT: This foreign key must point to profiles, not auth.users!


-- STEP 5: Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_poi_comments_poi_id ON poi_comments(poi_id);
CREATE INDEX IF NOT EXISTS idx_poi_comments_user_id ON poi_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_poi_comments_parent_comment_id ON poi_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_poi_comments_created_at ON poi_comments(created_at DESC);


-- STEP 6: Enable RLS on poi_comments
-- =====================================================
ALTER TABLE poi_comments ENABLE ROW LEVEL SECURITY;


-- STEP 7: Create RLS policies for poi_comments
-- =====================================================

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Anyone can view comments" ON poi_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON poi_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON poi_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON poi_comments;

-- Allow everyone to read comments
CREATE POLICY "Anyone can view comments"
  ON poi_comments
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert comments
CREATE POLICY "Authenticated users can insert comments"
  ON poi_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own comments
CREATE POLICY "Users can update their own comments"
  ON poi_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON poi_comments
  FOR DELETE
  USING (auth.uid() = user_id);


-- STEP 8: Ensure profiles table has public SELECT policy
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  USING (true);


-- STEP 9: Verify the relationship
-- =====================================================
-- Check foreign keys on poi_comments
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
  AND tc.constraint_type = 'FOREIGN KEY';

-- Expected result should show:
-- poi_comments | user_id | profiles | id


-- STEP 10: Test the JOIN query
-- =====================================================
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

-- This should work without errors now!


-- =====================================================
-- VERIFICATION COMPLETE
-- =====================================================
-- After running this script:
-- ✅ poi_comments.user_id → profiles.id foreign key created
-- ✅ RLS policies configured correctly
-- ✅ Public can view comments and profiles
-- ✅ Supabase client can now join poi_comments with profiles
-- =====================================================

-- You can now use this query in your JavaScript:
-- supabase.from('poi_comments').select('*, profiles(username, name, avatar_url)')
