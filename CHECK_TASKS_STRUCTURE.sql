-- CHECK TASKS TABLE STRUCTURE
-- Verify current schema before i18n migration

-- 1. Check if i18n columns already exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check current quest data
SELECT 
  id,
  category,
  title,
  description,
  xp,
  is_active,
  sort_order
FROM tasks
WHERE category = 'quest'
ORDER BY sort_order
LIMIT 10;

-- 3. Check for any triggers on tasks table (important for XP system)
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'tasks'
  AND event_object_schema = 'public';

-- 4. Check completed_tasks structure (XP tracking)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'completed_tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check if there are any foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name = 'tasks' OR ccu.table_name = 'tasks');

-- 6. Check for RLS policies on tasks table
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
WHERE tablename = 'tasks';
