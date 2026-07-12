-- Transport Price 4.0B RPC ambiguity hotfix preflight.
-- Read-only. Do not run the base 4.0B SQL again.

with fn as (
  select
    p.oid,
    p.proowner::regrole::text as owner_name,
    p.prosecdef,
    coalesce(array_to_string(p.proconfig, ','), '') as proconfig_text,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as normalized_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.oid = to_regprocedure('public.admin_adjust_transport_booking_price(uuid,numeric,text,text,integer,uuid)')
),
acl as (
  select
    coalesce(string_agg(r.rolname || ':' || e.privilege_type, ', ' order by r.rolname, e.privilege_type), '') as execute_grants
  from fn
  cross join aclexplode(coalesce((select p.proacl from pg_proc p where p.oid = fn.oid), acldefault('f', (select p.proowner from pg_proc p where p.oid = fn.oid)))) e
  left join pg_roles r on r.oid = e.grantee
  where e.privilege_type = 'EXECUTE'
),
checks as (
  select
    (select count(*) = 1 from fn) as exact_signature_exists,
    coalesce((select owner_name = 'postgres' from fn), false) as owner_postgres,
    coalesce((select prosecdef from fn), false) as security_definer,
    coalesce((select proconfig_text like '%search_path=pg_catalog, public%' from fn), false) as safe_search_path,
    coalesce((select normalized_source like '%select * into v_booking from public.transport_bookings where id = p_booking_id for update%' from fn), false) as current_source_loaded,
    coalesce((select normalized_source like '%price_revision = coalesce(price_revision, 0) + 1%' from fn), false) as ambiguous_update_pattern_present,
    coalesce((select normalized_source like '%price_revision = v_new_price_revision%' from fn), false) as already_fixed_pattern_present,
    coalesce((select normalized_source like '%for update%' from fn), false) as select_for_update_present,
    coalesce((select normalized_source like '%idempotency_key = p_idempotency_key%' from fn), false) as idempotency_present,
    coalesce((select normalized_source like '%p_expected_revision%' from fn and normalized_source like '%price_revision_mismatch%' from fn), false) as optimistic_revision_present,
    coalesce((select execute_grants like '%authenticated:EXECUTE%' from acl), false) as authenticated_execute_present,
    coalesce((select execute_grants not like '%anon:EXECUTE%' from acl), false) as anon_execute_absent
)
select
  exact_signature_exists,
  owner_postgres,
  security_definer,
  safe_search_path,
  current_source_loaded,
  ambiguous_update_pattern_present,
  already_fixed_pattern_present,
  select_for_update_present,
  idempotency_present,
  optimistic_revision_present,
  authenticated_execute_present,
  anon_execute_absent,
  (
    exact_signature_exists
    and owner_postgres
    and security_definer
    and safe_search_path
    and select_for_update_present
    and idempotency_present
    and optimistic_revision_present
    and authenticated_execute_present
    and anon_execute_absent
    and (ambiguous_update_pattern_present or already_fixed_pattern_present)
  ) as preflight_safe_to_continue,
  (select execute_grants from acl) as current_execute_grants;
