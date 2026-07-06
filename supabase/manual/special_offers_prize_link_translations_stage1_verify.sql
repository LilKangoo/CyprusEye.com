-- Special Offers 3B.3A verify draft.
-- Read-only checks for prize/link translation tables before Lefkara seed.

select
  'required trigger function' as check_name,
  to_regprocedure('public.special_offers_set_updated_at()') is not null as pass;

select
  'required admin helper' as check_name,
  to_regprocedure('public.is_current_user_admin()') is not null as pass;

select
  'tables exist' as check_name,
  to_regclass('public.special_offer_prize_translations') is not null as prize_translations_table_exists,
  to_regclass('public.special_offer_link_translations') is not null as link_translations_table_exists;

select
  'rls enabled' as check_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('special_offer_prize_translations', 'special_offer_link_translations')
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
  and tablename in ('special_offer_prize_translations', 'special_offer_link_translations')
order by tablename, policyname;

select
  'grants' as check_name,
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_prize_translations', 'special_offer_link_translations')
  and grantee in ('authenticated', 'anon', 'service_role', 'PUBLIC')
order by table_name, grantee, privilege_type;

select
  'indexes' as check_name,
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('special_offer_prize_translations', 'special_offer_link_translations')
order by tablename, indexname;

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
  and tc.table_name in ('special_offer_prize_translations', 'special_offer_link_translations')
  and tc.constraint_type = 'UNIQUE'
group by tc.table_name, tc.constraint_name
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
  and event_object_table in ('special_offer_prize_translations', 'special_offer_link_translations')
  and trigger_name in (
    'trg_special_offer_prize_translations_set_updated_at',
    'trg_special_offer_link_translations_set_updated_at'
  )
order by event_object_table, trigger_name;

select
  'pre-seed row counts' as check_name,
  (select count(*) from public.special_offer_prize_translations) as prize_translation_rows,
  (select count(*) from public.special_offer_link_translations) as link_translation_rows;

select
  'public and anon should have no direct grants' as check_name,
  table_name,
  grantee,
  count(*) as direct_grant_count
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_prize_translations', 'special_offer_link_translations')
  and grantee in ('anon', 'PUBLIC')
group by table_name, grantee
order by table_name, grantee;
