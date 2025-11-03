-- ===================================================
-- Check which admin functions are installed
-- ===================================================
-- Run this in Supabase SQL Editor to verify setup

-- 1. Check admin-related functions
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE 'admin_%'
ORDER BY proname;

-- Expected functions (19 total):
-- admin_adjust_user_xp
-- admin_ban_user
-- admin_bulk_delete_comments
-- admin_bulk_update_users
-- admin_create_poi
-- admin_delete_comment
-- admin_delete_poi
-- admin_get_action_log
-- admin_get_activity_log
-- admin_get_content_stats
-- admin_get_flagged_content
-- admin_get_top_contributors
-- admin_get_user_details
-- admin_get_user_growth
-- admin_unban_user
-- admin_update_poi
-- is_current_user_admin
-- is_user_admin

-- 2. Check admin views
SELECT 
    schemaname,
    viewname
FROM pg_views
WHERE viewname LIKE 'admin_%'
ORDER BY viewname;

-- Expected views:
-- admin_system_diagnostics
-- admin_users_overview

-- 3. Check admin_actions table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'admin_actions'
) as admin_actions_table_exists;

-- 4. Check profiles has is_admin column
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
) as is_admin_column_exists;

-- 5. Count how many admins exist
SELECT COUNT(*) as admin_count
FROM profiles
WHERE is_admin = TRUE;

-- Should return 1 (lilkangoomedia@gmail.com)
