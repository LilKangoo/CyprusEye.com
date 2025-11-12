-- FINAL TASKS STRUCTURE CHECK (FIXED)
-- Corrected version - required_level is in quest_tasks, not tasks

-- ============================================
-- PART 1: TASKS TABLE FULL STRUCTURE
-- ============================================

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
-- PART 2: CURRENT QUEST DATA IN TASKS
-- ============================================

SELECT 
  id,
  category,
  title,
  description,
  xp,
  is_active,
  sort_order,
  created_at,
  updated_at
FROM tasks
WHERE category = 'quest'
ORDER BY sort_order
LIMIT 5;

-- ============================================
-- PART 3: QUEST_TASKS VS TASKS COMPARISON
-- ============================================

-- Show quest_tasks structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'quest_tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Compare quest_tasks with tasks (by id)
SELECT 
  qt.id,
  qt.xp as qt_xp,
  qt.required_level,
  t.xp as t_xp,
  t.title,
  t.description,
  t.is_active,
  t.category
FROM quest_tasks qt
LEFT JOIN tasks t ON qt.id = t.id
LIMIT 5;

-- ============================================
-- PART 4: XP TRACKING - WHICH TABLE IS USED?
-- ============================================

-- Check completed_tasks - which table does it reference?
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'completed_tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Sample completed tasks
SELECT 
  ct.user_id,
  ct.task_id,
  ct.completed_at,
  t.title as from_tasks_table,
  qt.xp as from_quest_tasks
FROM completed_tasks ct
LEFT JOIN tasks t ON ct.task_id = t.id
LEFT JOIN quest_tasks qt ON ct.task_id = qt.id
WHERE ct.task_id IN (SELECT id FROM quest_tasks)
LIMIT 3;

-- ============================================
-- PART 5: CHECK IF TITLE/DESCRIPTION ARE NULL
-- ============================================

-- Count quests with NULL vs non-NULL title/description
SELECT 
  COUNT(*) as total_quests,
  COUNT(title) as has_title,
  COUNT(description) as has_description,
  COUNT(CASE WHEN title IS NULL THEN 1 END) as null_title,
  COUNT(CASE WHEN description IS NULL THEN 1 END) as null_description
FROM tasks
WHERE category = 'quest';

-- Show sample of title/description content
SELECT 
  id,
  title,
  description,
  xp
FROM tasks
WHERE category = 'quest'
  AND (title IS NOT NULL OR description IS NOT NULL)
LIMIT 5;

-- ============================================
-- PART 6: FUNCTIONS THAT AWARD XP
-- ============================================

-- Find XP-related functions
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%xp%' 
    OR routine_name LIKE '%task%'
    OR routine_name LIKE '%quest%'
    OR routine_name LIKE '%complete%'
  )
ORDER BY routine_name;
