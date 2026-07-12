-- Transport Price 4.0E-1 email summary preflight.
-- Read-only. Safe to run before installing the server-only email summary RPC.

with required_functions as (
  select
    to_regprocedure('public.transport_booking_financial_summary_core(uuid)') is not null as core_exists,
    to_regprocedure('public.get_transport_booking_financial_summary(uuid)') is not null as role_safe_summary_exists
),
core_fn as (
  select
    p.oid,
    r.rolname as owner_name,
    p.prosecdef,
    p.proconfig,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname = 'transport_booking_financial_summary_core'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid'
),
public_summary_fn as (
  select
    p.oid,
    r.rolname as owner_name,
    p.prosecdef,
    p.proconfig,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname = 'get_transport_booking_financial_summary'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid'
),
existing_wrapper as (
  select
    p.oid,
    r.rolname as owner_name,
    p.prosecdef,
    p.proconfig,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source,
    p.proacl,
    p.proowner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname = 'service_get_transport_booking_financial_summary'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid'
),
wrapper_acl as (
  select
    a.grantee,
    coalesce(r.rolname, 'PUBLIC') as grantee_name,
    a.privilege_type
  from existing_wrapper ew
  cross join lateral aclexplode(coalesce(ew.proacl, acldefault('f', ew.proowner))) a
  left join pg_roles r on r.oid = a.grantee
),
checks as (
  select
    (select core_exists from required_functions) as core_exists,
    (select role_safe_summary_exists from required_functions) as role_safe_summary_exists,
    exists(select 1 from core_fn where owner_name = 'postgres') as core_owner_postgres,
    exists(select 1 from core_fn where prosecdef) as core_security_definer,
    exists(select 1 from core_fn where proconfig::text like '%search_path=pg_catalog, public%') as core_safe_search_path,
    exists(select 1 from core_fn where source like '%coalesce(tb.adjusted_total_price, tb.total_price%' and source like '%confirmed_paid_gross%') as core_effective_total_source_ok,
    exists(select 1 from public_summary_fn where source like '%auth.uid()%' and source like '%not_authenticated%' and source like '%not_authorized%') as public_summary_requires_user_context,
    exists(select 1 from pg_roles where rolname = 'service_role') as service_role_exists,
    (select count(*) from existing_wrapper) > 0 as wrapper_exists,
    (select count(*) from existing_wrapper) = 0
      or (
        exists(select 1 from existing_wrapper where owner_name = 'postgres')
        and exists(select 1 from existing_wrapper where prosecdef)
        and exists(select 1 from existing_wrapper where proconfig::text like '%search_path=pg_catalog, public%')
        and exists(select 1 from existing_wrapper where result_type = 'TABLE(booking_id uuid, effective_total numeric, currency text, confirmed_paid_gross numeric, balance_due numeric, derived_payment_state text)')
        and exists(select 1 from existing_wrapper where source like '%transport_booking_financial_summary_core(p_booking_id)%')
        and not exists(select 1 from wrapper_acl where grantee = 0 and privilege_type = 'EXECUTE')
        and not exists(select 1 from wrapper_acl where grantee_name = 'anon' and privilege_type = 'EXECUTE')
        and not exists(select 1 from wrapper_acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE')
        and exists(select 1 from wrapper_acl where grantee_name = 'service_role' and privilege_type = 'EXECUTE')
      ) as wrapper_absent_or_compatible,
    not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'service_get_transport_booking_financial_summary'
        and pg_get_function_identity_arguments(p.oid) <> 'p_booking_id uuid'
    ) as no_conflicting_wrapper_overloads
)
select
  core_exists,
  role_safe_summary_exists,
  core_owner_postgres,
  core_security_definer,
  core_safe_search_path,
  core_effective_total_source_ok,
  public_summary_requires_user_context,
  service_role_exists,
  wrapper_exists,
  wrapper_absent_or_compatible,
  no_conflicting_wrapper_overloads,
  (
    core_exists
    and role_safe_summary_exists
    and core_owner_postgres
    and core_security_definer
    and core_safe_search_path
    and core_effective_total_source_ok
    and public_summary_requires_user_context
    and service_role_exists
    and wrapper_absent_or_compatible
    and no_conflicting_wrapper_overloads
  ) as preflight_safe_to_continue
from checks;
