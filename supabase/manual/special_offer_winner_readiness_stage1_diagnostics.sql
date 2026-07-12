-- Special Offers 3C.6F-1
-- Read-only diagnostics for public.special_offer_winner_workflow_readiness(uuid).
-- Safe to run in Supabase SQL editor. Does not execute RPCs and does not modify data.

with target_function as (
  select
    p.oid,
    n.nspname as schema_name,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_userbyid(p.proowner) as owner_name,
    p.prosecdef,
    p.proconfig,
    p.proacl,
    p.proowner,
    p.prosrc,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as normalized_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'special_offer_winner_workflow_readiness'
    and pg_get_function_identity_arguments(p.oid) = 'p_offer_id uuid'
),
acl as (
  select
    tf.oid,
    privileges.grantee,
    privileges.privilege_type
  from target_function tf
  cross join lateral aclexplode(coalesce(tf.proacl, acldefault('f', tf.proowner))) privileges
),
role_oids as (
  select
    to_regrole('anon')::oid as anon_oid,
    to_regrole('authenticated')::oid as authenticated_oid,
    to_regrole('service_role')::oid as service_role_oid
),
source_checks as (
  select
    tf.*,
    tf.normalized_source like '%from public.special_offer_entries e where e.offer_id = v_offer.id%' as entries_offer_id_qualified,
    tf.normalized_source like '%count(*) filter (where e.status = ''approved'')%' as entries_status_qualified,
    tf.normalized_source like '%from public.special_offer_entry_activities a where a.offer_id = v_offer.id%' as activities_offer_id_qualified,
    tf.normalized_source like '%count(*) filter (where a.status = ''pending'')%' as activities_status_qualified,
    tf.normalized_source not like '%from public.special_offer_entries where offer_id = v_offer.id%' as no_unqualified_entries_offer_id,
    tf.normalized_source not like '%from public.special_offer_entry_activities where offer_id = v_offer.id%' as no_unqualified_activities_offer_id,
    tf.normalized_source not like '%filter (where status =%' as no_unqualified_status_filters,
    tf.normalized_source like '%auth.uid()%' as auth_uid_present,
    tf.normalized_source like '%public.is_current_user_admin()%' as admin_check_present
  from target_function tf
)
select *
from (
  select
    'rpc_found'::text as check_name,
    exists(select 1 from target_function) as pass,
    jsonb_build_object(
      'schema', coalesce((select schema_name from target_function), 'missing'),
      'function', 'special_offer_winner_workflow_readiness',
      'signature', coalesce((select identity_arguments from target_function), 'missing')
    ) as details
  union all
  select
    'security_and_owner',
    coalesce((select prosecdef and owner_name = 'postgres' and proconfig @> array['search_path=pg_catalog, public'] from source_checks), false),
    jsonb_build_object(
      'owner', coalesce((select owner_name from target_function), 'missing'),
      'security_definer', coalesce((select prosecdef from target_function), false),
      'proconfig', coalesce((select to_jsonb(proconfig) from target_function), 'null'::jsonb)
    )
  union all
  select
    'acl_model',
    coalesce((
      select
        not exists(select 1 from acl where grantee = 0 and privilege_type = 'EXECUTE')
        and not exists(select 1 from acl, role_oids where grantee = anon_oid and privilege_type = 'EXECUTE')
        and exists(select 1 from acl, role_oids where grantee = authenticated_oid and privilege_type = 'EXECUTE')
        and not exists(select 1 from acl, role_oids where grantee = service_role_oid and privilege_type = 'EXECUTE')
    ), false),
    jsonb_build_object(
      'public_execute', coalesce((select exists(select 1 from acl where grantee = 0 and privilege_type = 'EXECUTE')), false),
      'anon_execute', coalesce((select exists(select 1 from acl, role_oids where grantee = anon_oid and privilege_type = 'EXECUTE')), false),
      'authenticated_execute', coalesce((select exists(select 1 from acl, role_oids where grantee = authenticated_oid and privilege_type = 'EXECUTE')), false),
      'service_role_execute', coalesce((select exists(select 1 from acl, role_oids where grantee = service_role_oid and privilege_type = 'EXECUTE')), false)
    )
  union all
  select
    'ambiguous_offer_id_risk',
    coalesce((select no_unqualified_entries_offer_id and no_unqualified_activities_offer_id from source_checks), false),
    jsonb_build_object(
      'entries_offer_id_qualified', coalesce((select entries_offer_id_qualified from source_checks), false),
      'activities_offer_id_qualified', coalesce((select activities_offer_id_qualified from source_checks), false),
      'unqualified_entries_offer_id_absent', coalesce((select no_unqualified_entries_offer_id from source_checks), false),
      'unqualified_activities_offer_id_absent', coalesce((select no_unqualified_activities_offer_id from source_checks), false)
    )
  union all
  select
    'status_filter_qualification',
    coalesce((select entries_status_qualified and activities_status_qualified and no_unqualified_status_filters from source_checks), false),
    jsonb_build_object(
      'entries_status_qualified', coalesce((select entries_status_qualified from source_checks), false),
      'activities_status_qualified', coalesce((select activities_status_qualified from source_checks), false),
      'unqualified_status_filters_absent', coalesce((select no_unqualified_status_filters from source_checks), false)
    )
  union all
  select
    'auth_and_admin_guard',
    coalesce((select auth_uid_present and admin_check_present from source_checks), false),
    jsonb_build_object(
      'auth_uid_present', coalesce((select auth_uid_present from source_checks), false),
      'admin_check_present', coalesce((select admin_check_present from source_checks), false)
    )
) diagnostics
order by check_name;

