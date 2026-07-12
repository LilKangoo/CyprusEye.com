-- Transport Price 4.0E-1 email summary verify.
-- Read-only. Returns one row with booleans and overall_pass.

with wrapper as (
  select
    p.oid,
    p.proowner,
    r.rolname as owner_name,
    p.prosecdef,
    p.proconfig,
    p.proacl,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname = 'service_get_transport_booking_financial_summary'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid'
),
public_summary as (
  select
    p.oid,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_transport_booking_financial_summary'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid'
),
acl as (
  select
    a.grantee,
    coalesce(r.rolname, 'PUBLIC') as grantee_name,
    a.privilege_type
  from wrapper w
  cross join lateral aclexplode(coalesce(w.proacl, acldefault('f', w.proowner))) a
  left join pg_roles r on r.oid = a.grantee
),
checks as (
  select
    exists(select 1 from wrapper) as wrapper_exists,
    (select count(*) = 1 from wrapper) as exact_signature,
    coalesce((select result_type = 'TABLE(booking_id uuid, effective_total numeric, currency text, confirmed_paid_gross numeric, balance_due numeric, derived_payment_state text)' from wrapper), false) as return_type_ok,
    coalesce((select prosecdef from wrapper), false) as security_definer,
    coalesce((select owner_name = 'postgres' from wrapper), false) as owner_postgres,
    coalesce((select proconfig::text like '%search_path=pg_catalog, public%' from wrapper), false) as safe_search_path,
    coalesce((select source like '%transport_booking_financial_summary_core(p_booking_id)%' from wrapper), false) as uses_core_summary,
    coalesce((select source like '%s.effective_total%' and source like '%s.confirmed_paid_gross%' and source like '%s.balance_due%' from wrapper), false) as minimal_payload,
    coalesce((select source not like '%internal_reason%' and source not like '%customer_note%' and source not like '%adjusted_by%' and source not like '%idempotency_key%' from wrapper), false) as no_adjustment_private_fields,
    coalesce((select source not like '%stripe_%' and source not like '%customer_email%' and source not like '%customer_phone%' and source not like '%partner_id%' from wrapper), false) as no_private_payment_or_pii_fields,
    coalesce((select source not like '%insert %' and source not like '%update %' and source not like '%delete %' and source not like '%merge %' from wrapper), false) as read_only_source,
    not exists(select 1 from acl where grantee = 0 and privilege_type = 'EXECUTE') as public_execute_absent,
    not exists(select 1 from acl where grantee_name = 'anon' and privilege_type = 'EXECUTE') as anon_execute_absent,
    not exists(select 1 from acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE') as authenticated_execute_absent,
    exists(select 1 from acl where grantee_name = 'service_role' and privilege_type = 'EXECUTE') as service_role_execute_present,
    exists(select 1 from public_summary where source like '%auth.uid()%' and source like '%not_authenticated%' and source like '%not_authorized%') as public_summary_still_role_safe,
    not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'service_get_transport_booking_financial_summary'
        and pg_get_function_identity_arguments(p.oid) <> 'p_booking_id uuid'
    ) as no_conflicting_overloads,
    coalesce((
      select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type)
      from acl
    ), 'no ACL rows') as acl_details
)
select
  wrapper_exists,
  exact_signature,
  return_type_ok,
  security_definer,
  owner_postgres,
  safe_search_path,
  uses_core_summary,
  minimal_payload,
  no_adjustment_private_fields,
  no_private_payment_or_pii_fields,
  read_only_source,
  public_execute_absent,
  anon_execute_absent,
  authenticated_execute_absent,
  service_role_execute_present,
  public_summary_still_role_safe,
  no_conflicting_overloads,
  acl_details,
  (
    wrapper_exists
    and exact_signature
    and return_type_ok
    and security_definer
    and owner_postgres
    and safe_search_path
    and uses_core_summary
    and minimal_payload
    and no_adjustment_private_fields
    and no_private_payment_or_pii_fields
    and read_only_source
    and public_execute_absent
    and anon_execute_absent
    and authenticated_execute_absent
    and service_role_execute_present
    and public_summary_still_role_safe
    and no_conflicting_overloads
  ) as overall_pass
from checks;
