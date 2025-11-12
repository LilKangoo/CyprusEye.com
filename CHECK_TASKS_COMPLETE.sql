-- COMPLETE TASKS STRUCTURE CHECK
-- Get full details before i18n migration

-- ============================================
-- PART 1: TASKS TABLE FULL STRUCTURE
-- ============================================

-- Get all columns with details
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- PART 2: CURRENT QUEST DATA
-- ============================================

-- Check what data exists in title/description
SELECT 
  id,
  category,
  title,
  description,
  xp,
  is_active,
  sort_order,
  required_level,
  created_at
FROM tasks
WHERE category = 'quest'
ORDER BY sort_order
LIMIT 5;

-- ============================================
-- PART 3: QUEST_TASKS TABLE (if different from tasks)
-- ============================================

-- Check if quest_tasks is a separate table or view
SELECT 
  table_type,
  table_name
FROM information_schema.tables
WHERE table_name IN ('tasks', 'quest_tasks')
  AND table_schema = 'public';

-- If quest_tasks exists, show its structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'quest_tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- PART 4: XP TRACKING SYSTEM
-- ============================================

-- Check completed_tasks structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'completed_tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check user_task_completions structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_task_completions'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Sample XP tracking data
SELECT 
  ct.user_id,
  ct.task_id,
  t.xp,
  ct.completed_at
FROM completed_tasks ct
LEFT JOIN tasks t ON ct.task_id = t.id
WHERE t.category = 'quest'
LIMIT 3;

-- ============================================
-- PART 5: CONSTRAINTS & INDEXES
-- ============================================

-- Check primary key and unique constraints
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'tasks'
  AND tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE');

-- Check indexes on tasks table
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'tasks'
  AND schemaname = 'public';

-- ============================================
-- PART 6: FUNCTIONS/TRIGGERS AFFECTING XP
-- ============================================

-- Check for functions that handle XP
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%xp%' 
    OR routine_name LIKE '%task%'
    OR routine_name LIKE '%quest%'
  )
ORDER BY routine_name;
