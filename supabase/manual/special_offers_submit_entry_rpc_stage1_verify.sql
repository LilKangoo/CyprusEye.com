-- Special Offers 3C.4A verify only.
-- Read-only checks for submit_special_offer_entry RPC.
-- Run after special_offers_entries_stage1.sql and
-- special_offers_submit_entry_rpc_stage1.sql have been reviewed and applied.

select
  'required_tables_exist' as check_name,
  bool_and(to_regclass(table_name) is not null) as ok,
  jsonb_object_agg(table_name, to_regclass(table_name) is not null order by table_name) as details
from (
  values
    ('public.special_offers'),
    ('public.special_offer_form_fields'),
    ('public.special_offer_form_field_translations'),
    ('public.special_offer_entries'),
    ('public.special_offer_entry_answers'),
    ('public.profiles'),
    ('public.partners'),
    ('public.partner_users')
) as required(table_name);

select
  'submit_rpc_exists' as check_name,
  to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)') is not null as ok,
  to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)')::text as details;

select
  'submit_rpc_security' as check_name,
  p.prosecdef as security_definer,
  l.lanname as language,
  p.provolatile as volatility,
  coalesce(array_to_string(p.proconfig, ','), '') as settings,
  coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=public%' as has_public_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname = 'submit_special_offer_entry'
  and pg_get_function_identity_arguments(p.oid) = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid';

select
  'submit_rpc_execute_grants' as check_name,
  r.rolname as role_name,
  has_function_privilege(r.rolname, 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as has_execute
from pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role')
order by r.rolname;

select
  'submit_rpc_public_execute_absent' as check_name,
  not exists (
    select 1
    from information_schema.routine_privileges rp
    where rp.specific_schema = 'public'
      and rp.routine_name = 'submit_special_offer_entry'
      and rp.grantee = 'PUBLIC'
      and rp.privilege_type = 'EXECUTE'
  ) as ok,
  exists (
    select 1
    from information_schema.routine_privileges rp
    where rp.specific_schema = 'public'
      and rp.routine_name = 'submit_special_offer_entry'
      and rp.grantee = 'PUBLIC'
      and rp.privilege_type = 'EXECUTE'
  ) as public_has_execute;

select
  'entries_answers_rls_enabled' as check_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('special_offer_entries', 'special_offer_entry_answers')
order by c.relname;

select
  'direct_public_writes_absent' as check_name,
  grantee,
  table_name,
  privilege_type,
  count(*) as grant_count
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege_type in ('INSERT', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
group by grantee, table_name, privilege_type
order by table_name, grantee, privilege_type;

select
  'table_read_update_grants' as check_name,
  grantee,
  table_name,
  privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select
  'entry_tables_row_count' as check_name,
  'special_offer_entries' as table_name,
  count(*) as row_count
from public.special_offer_entries
union all
select
  'entry_tables_row_count' as check_name,
  'special_offer_entry_answers' as table_name,
  count(*) as row_count
from public.special_offer_entry_answers
order by table_name;

select
  'future_workflow_tables_absent' as check_name,
  table_name,
  to_regclass('public.' || table_name) is null as absent
from (
  values
    ('special_offer_tasks'),
    ('special_offer_entry_tasks'),
    ('special_offer_draws'),
    ('special_offer_draw_entries'),
    ('special_offer_winners')
) as future(table_name)
order by table_name;

select
  'existing_campaigns_not_modified_by_verify' as check_name,
  slug,
  status,
  visibility,
  requires_form,
  requires_login,
  allow_multiple_entries,
  max_entries_per_user
from public.special_offers
where slug = 'lefkara-giveaway-2026';
