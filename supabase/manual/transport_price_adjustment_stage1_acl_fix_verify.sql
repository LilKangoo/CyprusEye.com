-- Transport Price 4.0B ACL fix verify.
-- Read-only. Returns one row with booleans and overall_pass.

with fn as (
  select
    p.oid,
    p.proowner,
    r.rolname as owner_name,
    p.proacl,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    md5(pg_get_functiondef(p.oid)) as function_definition_md5
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname = 'get_service_deposit_status'
    and pg_get_function_identity_arguments(p.oid) = 'p_id uuid'
),
acl as (
  select
    a.grantee,
    coalesce(r.rolname, 'PUBLIC') as grantee_name,
    a.privilege_type
  from fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a
  left join pg_roles r on r.oid = a.grantee
),
checks as (
  select
    exists(select 1 from fn) as function_exists,
    (select count(*) = 1 from fn) as exact_signature_uuid,
    coalesce((select owner_name = 'postgres' from fn), false) as owner_postgres,
    not exists(select 1 from acl where grantee = 0 and privilege_type = 'EXECUTE') as public_execute_absent,
    exists(select 1 from acl where grantee_name = 'anon' and privilege_type = 'EXECUTE') as anon_execute_present,
    exists(select 1 from acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE') as authenticated_execute_present,
    exists(select 1 from acl where grantee_name = 'service_role' and privilege_type = 'EXECUTE') as service_role_execute_present,
    coalesce((select function_definition_md5 is not null from fn), false) as function_definition_readable,
    coalesce((
      select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type)
      from acl
    ), 'no ACL rows') as acl_details,
    coalesce((select result_type from fn), 'function not found') as result_type_details,
    coalesce((select function_definition_md5 from fn), 'function not found') as function_definition_md5
)
select
  function_exists,
  exact_signature_uuid,
  owner_postgres,
  public_execute_absent,
  anon_execute_present,
  authenticated_execute_present,
  service_role_execute_present,
  function_definition_readable,
  acl_details,
  result_type_details,
  function_definition_md5,
  (
    function_exists
    and exact_signature_uuid
    and owner_postgres
    and public_execute_absent
    and anon_execute_present
    and authenticated_execute_present
    and service_role_execute_present
    and function_definition_readable
  ) as overall_pass
from checks;
