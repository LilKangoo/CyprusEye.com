-- Special Offers 3C.1 verify draft.
-- Read-only checks for form builder configuration tables before Lefkara seed.

select
  'required parent table' as check_name,
  to_regclass('public.special_offers') is not null as pass;

select
  'required trigger function' as check_name,
  to_regprocedure('public.special_offers_set_updated_at()') is not null as pass;

select
  'required admin helper' as check_name,
  to_regprocedure('public.is_current_user_admin()') is not null as pass;

select
  'tables exist' as check_name,
  to_regclass('public.special_offer_form_fields') is not null as fields_table_exists,
  to_regclass('public.special_offer_form_field_translations') is not null as field_translations_table_exists;

select
  'rls enabled' as check_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('special_offer_form_fields', 'special_offer_form_field_translations')
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
  and tablename in ('special_offer_form_fields', 'special_offer_form_field_translations')
order by tablename, policyname;

select
  'expected policy counts' as check_name,
  tablename,
  count(*) filter (where policyname like 'Admins can %') as admin_policy_count,
  count(*) filter (where policyname like 'Public can select active %') as public_select_policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('special_offer_form_fields', 'special_offer_form_field_translations')
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
  and table_name in ('special_offer_form_fields', 'special_offer_form_field_translations')
  and grantee in ('authenticated', 'anon', 'service_role', 'PUBLIC')
order by table_name, grantee, privilege_type;

select
  'public write grants should be absent' as check_name,
  table_name,
  grantee,
  count(*) as direct_write_grant_count
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_form_fields', 'special_offer_form_field_translations')
  and grantee in ('anon', 'PUBLIC')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
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
  and tablename in ('special_offer_form_fields', 'special_offer_form_field_translations')
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
  and tc.table_name in ('special_offer_form_fields', 'special_offer_form_field_translations')
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
  and tc.table_name in ('special_offer_form_fields', 'special_offer_form_field_translations')
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
  and tc.table_name in ('special_offer_form_fields', 'special_offer_form_field_translations')
  and tc.constraint_type = 'CHECK'
  and tc.constraint_name in (
    'special_offer_form_fields_field_key_not_blank',
    'special_offer_form_fields_field_key_format',
    'special_offer_form_fields_field_type_check',
    'special_offer_form_fields_validation_json_object_check',
    'special_offer_form_field_translations_lang_check',
    'special_offer_form_field_translations_options_json_array_check'
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
  and event_object_table in ('special_offer_form_fields', 'special_offer_form_field_translations')
  and trigger_name in (
    'trg_special_offer_form_fields_set_updated_at',
    'trg_special_offer_form_field_translations_set_updated_at'
  )
order by event_object_table, trigger_name;

select
  'pre-seed row counts' as check_name,
  (select count(*) from public.special_offer_form_fields) as field_rows,
  (select count(*) from public.special_offer_form_field_translations) as field_translation_rows;
