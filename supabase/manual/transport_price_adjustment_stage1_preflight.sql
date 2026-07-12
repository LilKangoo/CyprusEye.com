-- Transport Price 4.0A - read-only production preflight.
-- Purpose: verify the deployed transport financial model before any price
-- adjustment implementation is prepared.
--
-- READ-ONLY ONLY. This file intentionally contains no DDL, DML, GRANT/REVOKE,
-- mutating RPC calls, Stripe calls, or Edge Function calls.

-- ---------------------------------------------------------------------------
-- 1. High-level readiness and object inventory.
-- ---------------------------------------------------------------------------
with required_tables as (
  select
    to_regclass('public.transport_bookings') is not null as transport_bookings_exists,
    to_regclass('public.partner_service_fulfillments') is not null as partner_service_fulfillments_exists,
    to_regclass('public.service_deposit_requests') is not null as service_deposit_requests_exists,
    to_regclass('public.affiliate_commission_events') is not null as affiliate_commission_events_exists,
    to_regclass('public.affiliate_payouts') is not null as affiliate_payouts_exists
),
required_functions as (
  select
    to_regprocedure('public.get_service_deposit_status(uuid)') is not null as get_service_deposit_status_exists,
    (
      exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'trg_apply_service_coupon_transport_booking',
          'trg_partner_service_fulfillment_from_transport_booking',
          'update_transport_updated_at'
        )
      group by n.nspname
      having count(distinct p.proname) = 3
      )
      and exists (
        select 1
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_proc p on p.oid = t.tgfoid
        where n.nspname = 'public'
          and c.relname = 'service_deposit_requests'
          and t.tgname = 'trg_affiliate_on_service_deposit_paid'
          and p.proname = 'affiliate_handle_service_deposit_paid'
          and not t.tgisinternal
      )
    ) as critical_trigger_functions_exist
),
existing_adjustment_model as (
  select
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'original_total_price') > 0 as original_total_price_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'adjusted_total_price') > 0 as adjusted_total_price_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('amount_paid', 'paid_amount', 'paid_total')) > 0 as paid_total_like_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('refund_amount', 'refunded_amount', 'refunded_total')) > 0 as refund_total_like_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('balance_due', 'remaining_due', 'remaining_amount')) > 0 as balance_due_like_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('price_revision', 'pricing_revision')) > 0 as price_revision_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name like '%price_adjust%reason%') > 0 as price_adjustment_reason_exists
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'transport_bookings'
),
core_counts as (
  select
    (select count(*)::bigint from public.transport_bookings) as transport_booking_count,
    (select count(*)::bigint from public.transport_bookings where coalesce(trip_type, 'one_way') = 'round_trip') as round_trip_booking_count,
    (select count(*)::bigint from public.partner_service_fulfillments where resource_type in ('transport', 'transports', 'transfer', 'transfers')) as transport_fulfillment_count,
    (select count(*)::bigint from public.service_deposit_requests where resource_type in ('transport', 'transports', 'transfer', 'transfers')) as transport_deposit_request_count,
    (select count(*)::bigint from public.service_deposit_requests where resource_type in ('transport', 'transports', 'transfer', 'transfers') and status = 'paid') as paid_transport_deposit_request_count
),
deposit_cardinality as (
  select
    count(*) filter (where request_count = 0)::bigint as bookings_with_zero_deposit_requests,
    count(*) filter (where request_count = 1)::bigint as bookings_with_one_deposit_request,
    count(*) filter (where request_count > 1)::bigint as bookings_with_more_than_one_deposit_request
  from (
    select tb.id, count(r.id) as request_count
    from public.transport_bookings tb
    left join public.service_deposit_requests r
      on r.booking_id = tb.id
     and r.resource_type in ('transport', 'transports', 'transfer', 'transfers')
    group by tb.id
  ) x
),
fulfillment_cardinality as (
  select count(*)::bigint as fulfillments_with_more_than_one_deposit_request
  from (
    select fulfillment_id, count(*) as request_count
    from public.service_deposit_requests
    where fulfillment_id is not null
      and resource_type in ('transport', 'transports', 'transfer', 'transfers')
    group by fulfillment_id
    having count(*) > 1
  ) x
),
stripe_duplicates as (
  select
    (select count(*)::bigint from (
      select stripe_checkout_session_id
      from public.service_deposit_requests
      where nullif(stripe_checkout_session_id, '') is not null
      group by stripe_checkout_session_id
      having count(*) > 1
    ) dup) as duplicate_non_null_stripe_checkout_session_ids,
    (select count(*)::bigint from (
      select stripe_payment_intent_id
      from public.service_deposit_requests
      where nullif(stripe_payment_intent_id, '') is not null
      group by stripe_payment_intent_id
      having count(*) > 1
    ) dup) as duplicate_non_null_stripe_payment_intent_ids
),
payment_consistency as (
  select
    count(*) filter (
      where resource_type in ('transport', 'transports', 'transfer', 'transfers')
        and status = 'paid'
        and paid_at is null
    )::bigint as paid_requests_with_null_paid_at,
    count(*) filter (
      where resource_type in ('transport', 'transports', 'transfer', 'transfers')
        and status <> 'paid'
        and paid_at is not null
    )::bigint as unpaid_requests_with_non_null_paid_at
  from public.service_deposit_requests
),
refund_inventory as (
  select
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name ~* '(service|transport|deposit).*refund|refund.*(service|transport|deposit)'
    ) as transport_or_service_refund_table_exists,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (p.proname ~* 'refund' or lower(coalesce(p.prosrc, '')) ~ 'transport.*refund|service.*refund|deposit.*refund')
    ) as transport_or_service_refund_function_exists
),
round_trip_sources as (
  select
    coalesce(string_agg(kind || ':' || object_name, ' | ' order by kind, object_name), '') as sources_matching_total_plus_return_total_price
  from (
    select
      'function' as kind,
      p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) ~ 'total_price.{0,220}\+.{0,220}return_total_price'
        or lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) ~ 'return_total_price.{0,220}\+.{0,220}total_price'
      )
    union all
    select
      'view' as kind,
      c.relname as object_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('v', 'm')
      and (
        lower(regexp_replace(coalesce(pg_get_viewdef(c.oid, true), ''), '[[:space:]]+', ' ', 'g')) ~ 'total_price.{0,220}\+.{0,220}return_total_price'
        or lower(regexp_replace(coalesce(pg_get_viewdef(c.oid, true), ''), '[[:space:]]+', ' ', 'g')) ~ 'return_total_price.{0,220}\+.{0,220}total_price'
      )
  ) matches
),
commission_counts as (
  select
    count(*) filter (where resource_type in ('transport', 'transports', 'transfer', 'transfers'))::bigint as transport_related_commission_events,
    count(*) filter (where resource_type in ('transport', 'transports', 'transfer', 'transfers') and payout_id is not null)::bigint as transport_commission_events_with_payout_id,
    count(*) filter (
      where e.resource_type in ('transport', 'transports', 'transfer', 'transfers')
        and e.payout_id is not null
        and coalesce(p.status, '') in ('paid', 'completed', 'finalized', 'processed')
    )::bigint as transport_commission_events_connected_to_paid_or_finalized_payouts
  from public.affiliate_commission_events e
  left join public.affiliate_payouts p on p.id = e.payout_id
)
select
  rt.transport_bookings_exists,
  rt.partner_service_fulfillments_exists,
  rt.service_deposit_requests_exists,
  rt.affiliate_commission_events_exists,
  rt.affiliate_payouts_exists,
  rf.get_service_deposit_status_exists,
  rf.critical_trigger_functions_exist,
  eam.original_total_price_exists,
  eam.adjusted_total_price_exists,
  eam.paid_total_like_exists,
  eam.refund_total_like_exists,
  eam.balance_due_like_exists,
  eam.price_revision_exists,
  eam.price_adjustment_reason_exists,
  cc.transport_booking_count,
  cc.round_trip_booking_count,
  cc.transport_fulfillment_count,
  cc.transport_deposit_request_count,
  cc.paid_transport_deposit_request_count,
  dc.bookings_with_zero_deposit_requests,
  dc.bookings_with_one_deposit_request,
  dc.bookings_with_more_than_one_deposit_request,
  fc.fulfillments_with_more_than_one_deposit_request,
  pc.paid_requests_with_null_paid_at,
  pc.unpaid_requests_with_non_null_paid_at,
  sd.duplicate_non_null_stripe_checkout_session_ids,
  sd.duplicate_non_null_stripe_payment_intent_ids,
  ri.transport_or_service_refund_table_exists,
  ri.transport_or_service_refund_function_exists,
  (rts.sources_matching_total_plus_return_total_price <> '') as round_trip_double_count_risk,
  rts.sources_matching_total_plus_return_total_price as round_trip_double_count_sources,
  cm.transport_related_commission_events,
  cm.transport_commission_events_with_payout_id,
  cm.transport_commission_events_connected_to_paid_or_finalized_payouts,
  (
    rt.transport_bookings_exists
    and rt.partner_service_fulfillments_exists
    and rt.service_deposit_requests_exists
    and rt.affiliate_commission_events_exists
    and rt.affiliate_payouts_exists
    and rf.get_service_deposit_status_exists
    and rf.critical_trigger_functions_exist
  ) as preflight_complete
from required_tables rt
cross join required_functions rf
cross join existing_adjustment_model eam
cross join core_counts cc
cross join deposit_cardinality dc
cross join fulfillment_cardinality fc
cross join stripe_duplicates sd
cross join payment_consistency pc
cross join refund_inventory ri
cross join round_trip_sources rts
cross join commission_counts cm;

-- ---------------------------------------------------------------------------
-- 2. Exact deployed columns for financial review.
-- ---------------------------------------------------------------------------
select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.is_generated,
  c.generation_expression
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'transport_bookings',
    'partner_service_fulfillments',
    'service_deposit_requests',
    'affiliate_commission_events',
    'affiliate_payouts'
  )
  and (
    c.table_name <> 'transport_bookings'
    or c.column_name in (
      'id',
      'trip_type',
      'base_price',
      'extras_price',
      'total_price',
      'return_base_price',
      'return_extras_price',
      'return_total_price',
      'coupon_discount_amount',
      'deposit_amount',
      'deposit_currency',
      'currency',
      'payment_status',
      'paid_at',
      'deposit_paid_at',
      'status',
      'assigned_partner_id',
      'referral_code',
      'referral_source',
      'referral_captured_at',
      'referrer_user_id',
      'referrer_partner_id',
      'coupon_partner_id',
      'created_at',
      'updated_at'
    )
    or c.column_name ~* '(price|amount|paid|refund|balance|currency|status|payout|commission|stripe|fulfillment|booking|resource|revision|adjust)'
  )
order by c.table_name, c.ordinal_position;

-- ---------------------------------------------------------------------------
-- 3. Constraints and indexes relevant to payment cardinality and integrity.
-- ---------------------------------------------------------------------------
select
  'constraint' as object_type,
  n.nspname as schema_name,
  rel.relname as table_name,
  con.conname as object_name,
  con.contype::text as constraint_type,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public'
  and rel.relname in ('transport_bookings', 'service_deposit_requests', 'partner_service_fulfillments')
union all
select
  'index' as object_type,
  schemaname as schema_name,
  tablename as table_name,
  indexname as object_name,
  null as constraint_type,
  indexdef as definition
from pg_indexes
where schemaname = 'public'
  and tablename in ('transport_bookings', 'service_deposit_requests', 'partner_service_fulfillments')
order by table_name, object_type, object_name;

-- ---------------------------------------------------------------------------
-- 4. Trigger inventory with exact definitions and normalized function source.
-- ---------------------------------------------------------------------------
select
  c.relname as table_name,
  t.tgname as trigger_name,
  case when (t.tgtype & 2) <> 0 then 'BEFORE' when (t.tgtype & 64) <> 0 then 'INSTEAD OF' else 'AFTER' end as timing,
  concat_ws(',',
    case when (t.tgtype & 4) <> 0 then 'INSERT' end,
    case when (t.tgtype & 8) <> 0 then 'DELETE' end,
    case when (t.tgtype & 16) <> 0 then 'UPDATE' end,
    case when (t.tgtype & 32) <> 0 then 'TRUNCATE' end
  ) as events,
  p.proname as function_name,
  pg_get_triggerdef(t.oid, true) as trigger_definition,
  lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as normalized_function_source
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  and c.relname in (
    'transport_bookings',
    'service_deposit_requests',
    'partner_service_fulfillments',
    'affiliate_commission_events'
  )
  and not t.tgisinternal
order by c.relname, t.tgname;

-- ---------------------------------------------------------------------------
-- 5. Functions/views likely to read or derive transport financial values.
-- ---------------------------------------------------------------------------
select
  'function' as object_type,
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object_name,
  pg_get_function_result(p.oid) as return_type,
  r.rolname as owner_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as normalized_source
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and (
    p.proname in (
      'get_service_deposit_status',
      'partner_get_service_deposit_amounts',
      'partner_get_referral_attributed_orders',
      'admin_backfill_partner_service_fulfillments_for_resource',
      'upsert_partner_service_fulfillment_from_booking_with_partner'
    )
    or lower(coalesce(p.prosrc, '')) ~ '(transport_bookings|service_deposit_requests|partner_service_fulfillments|affiliate_commission_events)'
  )
order by object_name;

select
  'view' as object_type,
  c.relname as object_name,
  null as return_type,
  r.rolname as owner_name,
  null::boolean as security_definer,
  null::text[] as function_config,
  lower(regexp_replace(coalesce(pg_get_viewdef(c.oid, true), ''), '[[:space:]]+', ' ', 'g')) as normalized_source
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_roles r on r.oid = c.relowner
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
  and lower(coalesce(pg_get_viewdef(c.oid, true), '')) ~ '(transport_bookings|service_deposit_requests|partner_service_fulfillments|affiliate_commission_events)'
order by object_name;

-- ---------------------------------------------------------------------------
-- 6. RLS, policies, table privileges and function EXECUTE grants.
-- ---------------------------------------------------------------------------
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'transport_bookings',
    'partner_service_fulfillments',
    'service_deposit_requests',
    'affiliate_commission_events',
    'affiliate_payouts'
  )
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'transport_bookings',
    'partner_service_fulfillments',
    'service_deposit_requests',
    'affiliate_commission_events',
    'affiliate_payouts'
  )
order by tablename, policyname;

select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'transport_bookings',
    'partner_service_fulfillments',
    'service_deposit_requests',
    'affiliate_commission_events',
    'affiliate_payouts'
  )
order by table_name, grantee, privilege_type;

select
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as function_signature,
  coalesce(grantee_role.rolname, 'PUBLIC') as grantee,
  acl.privilege_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
left join pg_roles grantee_role on grantee_role.oid = acl.grantee
where n.nspname = 'public'
  and (
    p.proname in (
      'get_service_deposit_status',
      'partner_get_service_deposit_amounts',
      'partner_get_referral_attributed_orders',
      'upsert_partner_service_fulfillment_from_booking_with_partner'
    )
    or lower(coalesce(p.prosrc, '')) ~ '(transport_bookings|service_deposit_requests|partner_service_fulfillments|affiliate_commission_events)'
  )
order by function_signature, grantee, acl.privilege_type;
