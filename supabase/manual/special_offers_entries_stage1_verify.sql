-- Special Offers 3C.4A entries verify draft.
-- Read-only checks for entry storage tables before submit RPC stage.

select
  'required parent tables/helpers' as check_name,
  to_regclass('public.special_offers') is not null as has_special_offers,
  to_regclass('public.special_offer_form_fields') is not null as has_form_fields,
  to_regclass('public.special_offer_form_field_translations') is not null as has_form_field_translations,
  to_regprocedure('public.special_offers_set_updated_at()') is not null as has_updated_at_helper,
  to_regprocedure('public.is_current_user_admin()') is not null as has_admin_helper;

select
  'tables exist' as check_name,
  to_regclass('public.special_offer_entries') is not null as entries_table_exists,
  to_regclass('public.special_offer_entry_answers') is not null as entry_answers_table_exists;

select
  'rls enabled' as check_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('special_offer_entries', 'special_offer_entry_answers')
order by c.relname;

select
  'policies exist' as check_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('special_offer_entries', 'special_offer_entry_answers')
order by tablename, policyname;

select
  'policy command counts' as check_name,
  tablename,
  count(*) filter (where cmd = 'SELECT') as select_policy_count,
  count(*) filter (where cmd = 'UPDATE') as update_policy_count,
  count(*) filter (where cmd = 'INSERT') as insert_policy_count,
  count(*) filter (where cmd = 'DELETE') as delete_policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('special_offer_entries', 'special_offer_entry_answers')
group by tablename
order by tablename;

select
  'grants' as check_name,
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and grantee in ('authenticated', 'anon', 'service_role', 'PUBLIC')
order by table_name, grantee, privilege_type;

select
  'direct public writes should be absent' as check_name,
  table_name,
  grantee,
  count(*) as direct_write_grant_count
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
  and privilege_type in ('INSERT', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
group by table_name, grantee
order by table_name, grantee;

select
  'indexes' as check_name,
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('special_offer_entries', 'special_offer_entry_answers')
order by tablename, indexname;

select
  'foreign keys' as check_name,
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns,
  ccu.table_schema as foreign_table_schema,
  ccu.table_name as foreign_table_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_schema = tc.constraint_schema
 and ccu.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and tc.constraint_type = 'FOREIGN KEY'
group by tc.table_name, tc.constraint_name, ccu.table_schema, ccu.table_name
order by tc.table_name, tc.constraint_name;

select
  'unique constraints' as check_name,
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
where tc.table_schema = 'public'
  and tc.table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and tc.constraint_type = 'UNIQUE'
group by tc.table_name, tc.constraint_name
order by tc.table_name, tc.constraint_name;

select
  'check constraints' as check_name,
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
from information_schema.table_constraints tc
join information_schema.check_constraints cc
  on cc.constraint_schema = tc.constraint_schema
 and cc.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and tc.constraint_type = 'CHECK'
  and tc.constraint_name in (
    'special_offer_entries_status_check',
    'special_offer_entries_submitted_lang_check',
    'special_offer_entries_normalized_email_not_blank',
    'special_offer_entries_normalized_email_format',
    'special_offer_entries_phone_format',
    'special_offer_entries_answers_json_object_check',
    'special_offer_entries_form_snapshot_json_object_check',
    'special_offer_entries_reference_not_blank',
    'special_offer_entry_answers_field_key_not_blank',
    'special_offer_entry_answers_field_key_format',
    'special_offer_entry_answers_field_snapshot_json_object_check'
  )
order by tc.table_name, tc.constraint_name;

select
  'updated_at triggers' as check_name,
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'special_offer_entries'
  and trigger_name = 'trg_special_offer_entries_set_updated_at'
order by event_object_table, trigger_name;

select
  'row counts should be zero after table creation' as check_name,
  (select count(*) from public.special_offer_entries) as entry_rows,
  (select count(*) from public.special_offer_entry_answers) as answer_rows;

select
  'future workflow tables should not exist yet' as check_name,
  to_regclass('public.special_offer_tasks') is null as no_special_offer_tasks,
  to_regclass('public.special_offer_entry_tasks') is null as no_special_offer_entry_tasks,
  to_regclass('public.special_offer_draws') is null as no_special_offer_draws,
  to_regclass('public.special_offer_draw_entries') is null as no_special_offer_draw_entries,
  to_regclass('public.special_offer_winners') is null as no_special_offer_winners;
