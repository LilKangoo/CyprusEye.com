-- =====================================================
-- Special Offers base tables - Stage 1 verify draft
-- =====================================================
-- Prepared only. Do not run until reviewed.
--
-- This verification script is read-only. It checks catalogs,
-- policy names, RLS flags, constraints, indexes, triggers,
-- and confirms the base tables are empty after creation.
-- =====================================================

WITH expected_tables(table_name) AS (
  VALUES
    ('special_offers'),
    ('special_offer_translations'),
    ('special_offer_prizes'),
    ('special_offer_links'),
    ('special_offer_audit_log')
)
SELECT
  e.table_name,
  CASE WHEN c.relname IS NOT NULL THEN 'exists' ELSE 'missing' END AS table_status,
  COALESCE(c.relrowsecurity, false) AS rls_enabled
FROM expected_tables e
LEFT JOIN pg_class c
  ON c.relname = e.table_name
 AND c.relnamespace = 'public'::regnamespace
 AND c.relkind = 'r'
ORDER BY e.table_name;

WITH expected_policies(table_name, policy_name) AS (
  VALUES
    ('special_offers', 'special_offers_admin_all'),
    ('special_offer_translations', 'special_offer_translations_admin_all'),
    ('special_offer_prizes', 'special_offer_prizes_admin_all'),
    ('special_offer_links', 'special_offer_links_admin_all'),
    ('special_offer_audit_log', 'special_offer_audit_log_admin_select'),
    ('special_offer_audit_log', 'special_offer_audit_log_admin_insert')
)
SELECT
  e.table_name,
  e.policy_name,
  CASE WHEN p.policyname IS NOT NULL THEN 'exists' ELSE 'missing' END AS policy_status,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check
FROM expected_policies e
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = e.table_name
 AND p.policyname = e.policy_name
ORDER BY e.table_name, e.policy_name;

WITH expected_tables(table_name) AS (
  VALUES
    ('special_offers'),
    ('special_offer_translations'),
    ('special_offer_prizes'),
    ('special_offer_links'),
    ('special_offer_audit_log')
),
expected_privileges(privilege_type) AS (
  VALUES
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE')
),
expected_role_privileges AS (
  SELECT
    'anon' AS grantee,
    t.table_name,
    p.privilege_type,
    false AS expected_has_privilege
  FROM expected_tables t
  CROSS JOIN expected_privileges p
  UNION ALL
  SELECT
    'service_role' AS grantee,
    t.table_name,
    p.privilege_type,
    true AS expected_has_privilege
  FROM expected_tables t
  CROSS JOIN expected_privileges p
  UNION ALL
  SELECT
    'authenticated' AS grantee,
    t.table_name,
    p.privilege_type,
    CASE
      WHEN t.table_name = 'special_offer_audit_log' THEN p.privilege_type IN ('SELECT', 'INSERT')
      ELSE true
    END AS expected_has_privilege
  FROM expected_tables t
  CROSS JOIN expected_privileges p
)
SELECT
  grantee,
  table_name,
  privilege_type,
  expected_has_privilege,
  has_table_privilege(grantee::name, format('public.%I', table_name), privilege_type) AS actual_has_privilege,
  CASE
    WHEN has_table_privilege(grantee::name, format('public.%I', table_name), privilege_type) = expected_has_privilege THEN 'ok'
    ELSE 'mismatch'
  END AS privilege_status
FROM expected_role_privileges
ORDER BY grantee, table_name, privilege_type;

WITH expected_indexes(index_name) AS (
  VALUES
    ('special_offers_pkey'),
    ('special_offers_slug_key'),
    ('idx_special_offers_status'),
    ('idx_special_offers_type'),
    ('idx_special_offers_dates'),
    ('special_offer_translations_pkey'),
    ('special_offer_translations_offer_id_lang_key'),
    ('idx_special_offer_translations_offer_lang'),
    ('special_offer_prizes_pkey'),
    ('idx_special_offer_prizes_offer'),
    ('special_offer_links_pkey'),
    ('idx_special_offer_links_offer'),
    ('idx_special_offer_links_type_resource'),
    ('special_offer_audit_log_pkey'),
    ('idx_special_offer_audit_log_offer_created')
)
SELECT
  e.index_name,
  CASE WHEN i.indexname IS NOT NULL THEN 'exists' ELSE 'missing' END AS index_status
FROM expected_indexes e
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.indexname = e.index_name
ORDER BY e.index_name;

WITH expected_constraints(table_name, constraint_name) AS (
  VALUES
    ('special_offers', 'special_offers_slug_not_blank'),
    ('special_offers', 'special_offers_slug_format'),
    ('special_offers', 'special_offers_type_check'),
    ('special_offers', 'special_offers_winner_selection_mode_check'),
    ('special_offers', 'special_offers_status_check'),
    ('special_offers', 'special_offers_visibility_check'),
    ('special_offers', 'special_offers_dates_check'),
    ('special_offers', 'special_offers_winner_announce_check'),
    ('special_offers', 'special_offers_max_entries_check'),
    ('special_offers', 'special_offers_response_deadline_days_check'),
    ('special_offers', 'special_offers_settings_json_object_check'),
    ('special_offer_translations', 'special_offer_translations_lang_check'),
    ('special_offer_translations', 'special_offer_translations_faq_json_array_check'),
    ('special_offer_prizes', 'special_offer_prizes_name_not_blank'),
    ('special_offer_prizes', 'special_offer_prizes_quantity_check'),
    ('special_offer_prizes', 'special_offer_prizes_value_estimate_check'),
    ('special_offer_prizes', 'special_offer_prizes_currency_check'),
    ('special_offer_links', 'special_offer_links_type_check'),
    ('special_offer_links', 'special_offer_links_target_check'),
    ('special_offer_links', 'special_offer_links_url_protocol_check'),
    ('special_offer_audit_log', 'special_offer_audit_log_action_not_blank'),
    ('special_offer_audit_log', 'special_offer_audit_log_old_value_object_check'),
    ('special_offer_audit_log', 'special_offer_audit_log_new_value_object_check'),
    ('special_offer_audit_log', 'special_offer_audit_log_metadata_object_check')
)
SELECT
  e.table_name,
  e.constraint_name,
  CASE WHEN tc.constraint_name IS NOT NULL THEN 'exists' ELSE 'missing' END AS constraint_status,
  tc.constraint_type
FROM expected_constraints e
LEFT JOIN information_schema.table_constraints tc
  ON tc.table_schema = 'public'
 AND tc.table_name = e.table_name
 AND tc.constraint_name = e.constraint_name
ORDER BY e.table_name, e.constraint_name;

WITH expected_triggers(table_name, trigger_name) AS (
  VALUES
    ('special_offers', 'trg_special_offers_set_updated_at'),
    ('special_offer_translations', 'trg_special_offer_translations_set_updated_at'),
    ('special_offer_prizes', 'trg_special_offer_prizes_set_updated_at'),
    ('special_offer_links', 'trg_special_offer_links_set_updated_at')
)
SELECT
  e.table_name,
  e.trigger_name,
  CASE WHEN t.trigger_name IS NOT NULL THEN 'exists' ELSE 'missing' END AS trigger_status
FROM expected_triggers e
LEFT JOIN information_schema.triggers t
  ON t.event_object_schema = 'public'
 AND t.event_object_table = e.table_name
 AND t.trigger_name = e.trigger_name
ORDER BY e.table_name, e.trigger_name;

SELECT
  to_regprocedure('public.is_current_user_admin()') IS NOT NULL AS has_admin_helper,
  to_regprocedure('public.special_offers_set_updated_at()') IS NOT NULL AS has_special_offers_updated_at_function;

SELECT 'special_offers' AS table_name, count(*)::integer AS row_count FROM public.special_offers
UNION ALL
SELECT 'special_offer_translations', count(*)::integer FROM public.special_offer_translations
UNION ALL
SELECT 'special_offer_prizes', count(*)::integer FROM public.special_offer_prizes
UNION ALL
SELECT 'special_offer_links', count(*)::integer FROM public.special_offer_links
UNION ALL
SELECT 'special_offer_audit_log', count(*)::integer FROM public.special_offer_audit_log
ORDER BY table_name;

-- Expected after first run:
-- - all table_status/policy_status/index_status/constraint_status/trigger_status values are "exists"
-- - all rls_enabled values are true
-- - all privilege_status values are "ok"
-- - has_admin_helper and has_special_offers_updated_at_function are true
-- - every row_count is 0
