-- Transport Price 4.0B RPC ambiguity hotfix verify.
-- Read-only. Returns a vertical table: check_name, pass, details.

with fn as (
  select
    p.oid,
    p.proowner::regrole::text as owner_name,
    p.prosecdef,
    coalesce(array_to_string(p.proconfig, ','), '') as proconfig_text,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as normalized_source,
    pg_get_functiondef(p.oid) as function_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.oid = to_regprocedure('public.admin_adjust_transport_booking_price(uuid,numeric,text,text,integer,uuid)')
),
acl as (
  select
    coalesce(string_agg(coalesce(r.rolname, 'PUBLIC') || ':' || e.privilege_type, ', ' order by coalesce(r.rolname, 'PUBLIC'), e.privilege_type), '') as grants,
    bool_or(e.grantee = 0 and e.privilege_type = 'EXECUTE') as public_execute,
    bool_or(r.rolname = 'anon' and e.privilege_type = 'EXECUTE') as anon_execute,
    bool_or(r.rolname = 'authenticated' and e.privilege_type = 'EXECUTE') as authenticated_execute
  from fn
  cross join aclexplode(coalesce((select p.proacl from pg_proc p where p.oid = fn.oid), acldefault('f', (select p.proowner from pg_proc p where p.oid = fn.oid)))) e
  left join pg_roles r on r.oid = e.grantee
),
checks as (
  select 'rpc_exact_signature'::text as check_name,
    (select count(*) = 1 from fn) as pass,
    'public.admin_adjust_transport_booking_price(uuid,numeric,text,text,integer,uuid)'::text as details
  union all select 'rpc_owner_postgres',
    coalesce((select owner_name = 'postgres' from fn), false),
    coalesce((select owner_name from fn), '<missing>')
  union all select 'rpc_security_definer',
    coalesce((select prosecdef from fn), false),
    coalesce((select prosecdef::text from fn), '<missing>')
  union all select 'rpc_safe_search_path',
    coalesce((select proconfig_text like '%search_path=pg_catalog, public%' from fn), false),
    coalesce((select proconfig_text from fn), '<missing>')
  union all select 'public_execute_absent',
    coalesce((select not public_execute from acl), false),
    coalesce((select grants from acl), '<missing>')
  union all select 'anon_execute_absent',
    coalesce((select not anon_execute from acl), false),
    coalesce((select grants from acl), '<missing>')
  union all select 'authenticated_execute_present',
    coalesce((select authenticated_execute from acl), false),
    coalesce((select grants from acl), '<missing>')
  union all select 'select_for_update_present',
    coalesce((select normalized_source like '%for update%' from fn), false),
    'SELECT FOR UPDATE guard must remain present'
  union all select 'idempotency_present',
    coalesce((select normalized_source like '%idempotency_key = p_idempotency_key%' from fn and normalized_source like '%idempotency_key_conflict%' from fn), false),
    'idempotency lookup and conflict guard must remain present'
  union all select 'optimistic_revision_present',
    coalesce((select normalized_source like '%p_expected_revision%' from fn and normalized_source like '%price_revision_mismatch%' from fn), false),
    'expected revision guard must remain present'
  union all select 'qualified_booking_select',
    coalesce((select normalized_source like '%select tb.* into v_booking from public.transport_bookings tb where tb.id = p_booking_id for update%' from fn), false),
    'booking row must be selected with table alias tb'
  union all select 'qualified_booking_update',
    coalesce((select normalized_source like '%update public.transport_bookings tb set%' from fn and normalized_source like '%where tb.id = v_booking.id%' from fn), false),
    'booking update must use table alias tb'
  union all select 'local_revision_variables_present',
    coalesce((select normalized_source like '%v_current_price_revision%' from fn and normalized_source like '%v_new_price_revision%' from fn), false),
    'revision values must use explicit local variable names'
  union all select 'ambiguous_update_removed',
    coalesce((select normalized_source not like '%price_revision = coalesce(price_revision, 0) + 1%' from fn), false),
    'old unqualified price_revision update pattern must be absent'
  union all select 'qualified_or_variable_revision_update',
    coalesce((select normalized_source like '%price_revision = v_new_price_revision%' from fn), false),
    'update must assign price_revision from v_new_price_revision'
  union all select 'payment_mutation_absent',
    coalesce((select normalized_source not like '%service_deposit_requests%' and normalized_source not like '%stripe_%' from fn), false),
    'function must not mutate/read payment, Stripe or refund rows'
  union all select 'commission_payout_mutation_absent',
    coalesce((select normalized_source not like '%affiliate_commission_events%' and normalized_source not like '%affiliate_payouts%' from fn), false),
    'function must not mutate commission or payout rows'
  union all select 'fulfillment_total_mutation_absent',
    coalesce((select normalized_source not like '%partner_service_fulfillments%' from fn), false),
    'function must not mutate fulfillment total snapshots'
),
overall as (
  select 'overall_pass'::text as check_name,
    bool_and(pass) as pass,
    'all visible checks must pass'::text as details
  from checks
)
select check_name, pass, details
from (
  select * from checks
  union all
  select * from overall
) out
order by
  case when check_name = 'overall_pass' then 2 when pass is false or pass is null then 0 else 1 end,
  check_name;
