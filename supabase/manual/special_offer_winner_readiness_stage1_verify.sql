-- Special Offers 3C.6F-1
-- Read-only verify for public.special_offer_winner_workflow_readiness(uuid).
-- Does not execute RPCs and does not modify data.

with fn as (
  select
    p.oid,
    n.nspname,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_userbyid(p.proowner) as owner_name,
    p.prosecdef,
    p.proconfig,
    p.proacl,
    p.proowner,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'special_offer_winner_workflow_readiness'
    and pg_get_function_identity_arguments(p.oid) = 'p_offer_id uuid'
),
role_oids as (
  select
    to_regrole('anon')::oid as anon_oid,
    to_regrole('authenticated')::oid as authenticated_oid,
    to_regrole('service_role')::oid as service_role_oid
),
acl as (
  select
    privileges.grantee,
    privileges.privilege_type
  from fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) privileges
),
checks as (
  select
    exists(select 1 from fn) as rpc_exists,
    coalesce((select identity_arguments = 'p_offer_id uuid' from fn), false) as rpc_signature_ok,
    coalesce((select prosecdef from fn), false) as rpc_security_definer,
    coalesce((select owner_name = 'postgres' from fn), false) as rpc_owner_ok,
    coalesce((select proconfig @> array['search_path=pg_catalog, public'] from fn), false) as rpc_safe_search_path,
    coalesce(not exists(select 1 from acl where grantee = 0 and privilege_type = 'EXECUTE'), false) as public_execute_absent,
    coalesce(not exists(select 1 from acl, role_oids where grantee = anon_oid and privilege_type = 'EXECUTE'), false) as anon_execute_absent,
    coalesce(exists(select 1 from acl, role_oids where grantee = authenticated_oid and privilege_type = 'EXECUTE'), false) as authenticated_execute_present,
    coalesce(not exists(select 1 from acl, role_oids where grantee = service_role_oid and privilege_type = 'EXECUTE'), false) as service_role_execute_absent,
    coalesce((select source like '%auth.uid()%' from fn), false) as auth_uid_present,
    coalesce((select source like '%public.is_current_user_admin()%' from fn), false) as admin_check_present,
    coalesce((select source like '%from public.special_offer_entries e where e.offer_id = v_offer.id%' from fn), false) as entries_offer_id_qualified,
    coalesce((select source like '%from public.special_offer_entry_activities a where a.offer_id = v_offer.id%' from fn), false) as activities_offer_id_qualified,
    coalesce((select source like '%count(*) filter (where e.status = ''approved'')%' from fn), false) as entries_status_qualified,
    coalesce((select source like '%count(*) filter (where a.status = ''pending'')%' from fn), false) as activities_status_qualified,
    coalesce((select source not like '%from public.special_offer_entries where offer_id = v_offer.id%' from fn), false) as no_ambiguous_entries_offer_id,
    coalesce((select source not like '%from public.special_offer_entry_activities where offer_id = v_offer.id%' from fn), false) as no_ambiguous_activities_offer_id,
    coalesce((select source !~ '(insert|update|delete|truncate|merge)[[:space:]]+(into[[:space:]]+)?public\\.' from fn), false) as no_data_modification
)
select
  rpc_exists,
  rpc_signature_ok,
  rpc_security_definer,
  rpc_owner_ok,
  rpc_safe_search_path,
  public_execute_absent,
  anon_execute_absent,
  authenticated_execute_present,
  service_role_execute_absent,
  auth_uid_present,
  admin_check_present,
  entries_offer_id_qualified,
  activities_offer_id_qualified,
  entries_status_qualified,
  activities_status_qualified,
  no_ambiguous_entries_offer_id,
  no_ambiguous_activities_offer_id,
  no_data_modification,
  (
    rpc_exists
    and rpc_signature_ok
    and rpc_security_definer
    and rpc_owner_ok
    and rpc_safe_search_path
    and public_execute_absent
    and anon_execute_absent
    and authenticated_execute_present
    and service_role_execute_absent
    and auth_uid_present
    and admin_check_present
    and entries_offer_id_qualified
    and activities_offer_id_qualified
    and entries_status_qualified
    and activities_status_qualified
    and no_ambiguous_entries_offer_id
    and no_ambiguous_activities_offer_id
    and no_data_modification
  ) as overall_pass
from checks;

