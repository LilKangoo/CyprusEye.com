-- Transport Price 4.0B - read-only production preflight.
--
-- This file must end with exactly one SELECT returning exactly one summary row.
-- Raw inventories belong in transport_price_adjustment_stage1_diagnostics.sql.
--
-- READ-ONLY ONLY. No DDL, DML, GRANT/REVOKE, mutating RPC calls, Stripe calls
-- or Edge Function calls.

with required_tables as (
  select
    to_regclass('public.transport_bookings') is not null as transport_bookings_exists,
    to_regclass('public.partner_service_fulfillments') is not null as partner_service_fulfillments_exists,
    to_regclass('public.service_deposit_requests') is not null as service_deposit_requests_exists,
    to_regclass('public.affiliate_commission_events') is not null as affiliate_commission_events_exists,
    to_regclass('public.affiliate_payouts') is not null as affiliate_payouts_exists
),
deposit_status_fn as (
  select
    p.oid,
    p.proowner,
    p.proacl,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_service_deposit_status'
    and pg_get_function_identity_arguments(p.oid) = 'p_id uuid'
  limit 1
),
deposit_status_overloads as (
  select
    count(*)::integer as overload_count,
    count(*) filter (where pg_get_function_identity_arguments(p.oid) = 'p_id uuid')::integer as exact_overload_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_service_deposit_status'
),
deposit_status_acl as (
  select acl.grantee, coalesce(r.rolname, 'PUBLIC') as grantee_name, acl.privilege_type
  from deposit_status_fn fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) acl
  left join pg_roles r on r.oid = acl.grantee
),
deposit_status_state as (
  select
    exists (select 1 from deposit_status_fn) as get_service_deposit_status_exists,
    (select exact_overload_count = 1 from deposit_status_overloads) as get_service_deposit_status_exact_overload,
    coalesce((
      select result_type = 'TABLE(id uuid, status text, paid_at timestamp with time zone, amount numeric, currency text, fulfillment_reference text, fulfillment_summary text, resource_type text, booking_id uuid, stripe_checkout_session_id text, stripe_payment_intent_id text, fulfillment_id uuid, fulfillment_total_price numeric, booking_total_price numeric, trip_title_en text, trip_title_pl text)'
      from deposit_status_fn
    ), false) as get_service_deposit_status_return_type_captured,
    exists (select 1 from deposit_status_acl) as get_service_deposit_status_acl_captured,
    exists (select 1 from deposit_status_acl where grantee_name = 'anon' and privilege_type = 'EXECUTE') as deposit_status_anon_execute_present,
    exists (select 1 from deposit_status_acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE') as deposit_status_authenticated_execute_present,
    exists (select 1 from deposit_status_acl where grantee_name = 'service_role' and privilege_type = 'EXECUTE') as deposit_status_service_role_execute_present,
    exists (select 1 from deposit_status_fn) as deposit_status_public_acl_state_known,
    coalesce((
      select
        source ~ 'total_price.{0,220}\+.{0,220}return_total_price'
        or source ~ 'return_total_price.{0,220}\+.{0,220}total_price'
      from deposit_status_fn
    ), false) as round_trip_old_double_count_pattern_present,
    coalesce((
      select source like '%transport_booking_financial_summary_core%' and source like '%effective_total%'
      from deposit_status_fn
    ), false) as round_trip_already_fixed
),
trigger_sources as (
  select
    c.relname as table_name,
    t.tgname as trigger_name,
    p.proname as function_name,
    pg_get_triggerdef(t.oid, true) as trigger_definition,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'public'
    and c.relname in ('transport_bookings', 'service_deposit_requests')
    and not t.tgisinternal
),
trigger_state as (
  select
    exists (
      select 1 from trigger_sources
      where table_name = 'transport_bookings'
        and function_name = 'trg_apply_service_coupon_transport_booking'
    ) as coupon_trigger_exists,
    exists (
      select 1 from trigger_sources
      where table_name = 'transport_bookings'
        and function_name = 'trg_apply_service_coupon_transport_booking'
        and source like '%new.total_price%'
        and source like '%new.deposit_amount%'
    ) as coupon_trigger_source_identified,
    exists (
      select 1 from trigger_sources
      where table_name = 'transport_bookings'
        and function_name = 'trg_apply_service_coupon_transport_booking'
        and source like '%tg_op%'
        and source like '%new.total_price%'
        and source like '%new.coupon_discount_amount%'
    ) as coupon_trigger_can_be_safely_guarded,
    exists (
      select 1 from trigger_sources
      where table_name = 'transport_bookings'
        and function_name = 'trg_partner_service_fulfillment_from_transport_booking'
    ) as fulfillment_sync_trigger_exists,
    exists (
      select 1 from trigger_sources
      where table_name = 'transport_bookings'
        and function_name = 'trg_partner_service_fulfillment_from_transport_booking'
        and source like '%partner_service_fulfillments%'
        and source like '%new.total_price%'
    ) as fulfillment_sync_source_identified,
    exists (
      select 1 from trigger_sources
      where table_name = 'transport_bookings'
        and function_name = 'trg_partner_service_fulfillment_from_transport_booking'
        and trigger_definition ilike '%update of%'
        and trigger_definition ilike '%total_price%'
        and trigger_definition not ilike '%adjusted_total_price%'
    ) as fulfillment_total_snapshot_model_confirmed
),
adjustment_columns as (
  select
    count(*) filter (where column_name = 'adjusted_total_price' and data_type = 'numeric') > 0 as adjusted_total_price_ok,
    count(*) filter (where column_name = 'price_revision' and data_type = 'integer') > 0 as price_revision_ok,
    count(*) filter (where column_name = 'price_adjusted_at' and data_type = 'timestamp with time zone') > 0 as price_adjusted_at_ok,
    count(*) filter (where column_name in ('adjusted_total_price', 'price_revision', 'price_adjusted_at'))::integer as existing_adjustment_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'transport_bookings'
),
adjustment_history_columns as (
  select
    to_regclass('public.transport_booking_price_adjustments') is not null as table_exists,
    count(*) filter (where column_name = 'booking_id' and data_type = 'uuid') > 0 as booking_id_ok,
    count(*) filter (where column_name = 'original_total_price' and data_type = 'numeric') > 0 as original_total_ok,
    count(*) filter (where column_name = 'previous_effective_total' and data_type = 'numeric') > 0 as previous_total_ok,
    count(*) filter (where column_name = 'new_effective_total' and data_type = 'numeric') > 0 as new_total_ok,
    count(*) filter (where column_name = 'idempotency_key' and data_type = 'uuid') > 0 as idempotency_key_ok,
    count(*)::integer as column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'transport_booking_price_adjustments'
),
function_state as (
  select
    count(*) filter (
      where proname = 'admin_adjust_transport_booking_price'
        and identity_args = 'p_booking_id uuid, p_new_total numeric, p_reason text, p_customer_note text, p_expected_revision integer, p_idempotency_key uuid'
    )::integer as admin_adjust_exact_count,
    count(*) filter (
      where proname = 'admin_adjust_transport_booking_price'
        and identity_args <> 'p_booking_id uuid, p_new_total numeric, p_reason text, p_customer_note text, p_expected_revision integer, p_idempotency_key uuid'
    )::integer as admin_adjust_conflicting_overload_count,
    count(*) filter (
      where proname = 'get_transport_booking_financial_summary'
        and identity_args = 'p_booking_id uuid'
    )::integer as public_summary_exact_count,
    count(*) filter (
      where proname = 'transport_booking_financial_summary_core'
        and identity_args = 'p_booking_id uuid'
    )::integer as core_summary_exact_count,
    count(*) filter (
      where proname in ('get_transport_booking_financial_summary', 'transport_booking_financial_summary_core')
    )::integer as summary_function_count
  from (
    select p.proname, pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_adjust_transport_booking_price',
        'get_transport_booking_financial_summary',
        'transport_booking_financial_summary_core'
      )
  ) f
),
payment_cardinality as (
  select
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
refund_inventory as (
  select
    not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name ~* '(service|transport|deposit).*refund|refund.*(service|transport|deposit)'
    ) as refund_ledger_absent_confirmed
),
paid_source as (
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'service_deposit_requests'
        and column_name in ('amount', 'status', 'paid_at', 'currency')
      group by table_name
      having count(distinct column_name) = 4
    ) as paid_source_confirmed
),
commission_source as (
  select
    exists (
      select 1
      from trigger_sources
      where table_name = 'service_deposit_requests'
        and trigger_name = 'trg_affiliate_on_service_deposit_paid'
        and function_name = 'affiliate_handle_service_deposit_paid'
    )
    and exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'affiliate_insert_commission_events_for_deposit'
        and lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) like '%from public.service_deposit_requests%'
        and lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) like '%insert into public.affiliate_commission_events%'
        and lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) like '%dep.amount%'
    ) as commission_source_confirmed
),
compatibility as (
  select
    (
      ac.existing_adjustment_column_count = 0
      or (
        ac.existing_adjustment_column_count = 3
        and ac.adjusted_total_price_ok
        and ac.price_revision_ok
        and ac.price_adjusted_at_ok
      )
    ) as adjustment_columns_absent_or_compatible,
    (
      ah.table_exists is false
      or (
        ah.booking_id_ok
        and ah.original_total_ok
        and ah.previous_total_ok
        and ah.new_total_ok
        and ah.idempotency_key_ok
      )
    ) as adjustment_history_table_absent_or_compatible,
    (
      fs.admin_adjust_exact_count = 0
      or fs.admin_adjust_exact_count = 1
    ) as adjustment_rpc_absent_or_compatible,
    (
      fs.summary_function_count = 0
      or (fs.public_summary_exact_count = 1 and fs.core_summary_exact_count = 1)
    ) as financial_summary_functions_absent_or_compatible,
    (
      fs.admin_adjust_conflicting_overload_count = 0
      and (select overload_count = exact_overload_count from deposit_status_overloads)
    ) as no_conflicting_overloads,
    (
      ac.existing_adjustment_column_count > 0
      or ah.table_exists
      or fs.admin_adjust_exact_count > 0
      or fs.summary_function_count > 0
    ) as partial_install_detected,
    (
      (
        ac.existing_adjustment_column_count = 0
        or (
          ac.existing_adjustment_column_count = 3
          and ac.adjusted_total_price_ok
          and ac.price_revision_ok
          and ac.price_adjusted_at_ok
        )
      )
      and (
        ah.table_exists is false
        or (
          ah.booking_id_ok
          and ah.original_total_ok
          and ah.previous_total_ok
          and ah.new_total_ok
          and ah.idempotency_key_ok
        )
      )
      and (fs.admin_adjust_exact_count = 0 or fs.admin_adjust_exact_count = 1)
      and (
        fs.summary_function_count = 0
        or (fs.public_summary_exact_count = 1 and fs.core_summary_exact_count = 1)
      )
      and fs.admin_adjust_conflicting_overload_count = 0
    ) as partial_install_compatible
  from adjustment_columns ac
  cross join adjustment_history_columns ah
  cross join function_state fs
)
select
  rt.transport_bookings_exists,
  rt.partner_service_fulfillments_exists,
  rt.service_deposit_requests_exists,
  rt.affiliate_commission_events_exists,
  rt.affiliate_payouts_exists,
  ds.get_service_deposit_status_exists,
  ds.get_service_deposit_status_exact_overload,
  ds.get_service_deposit_status_return_type_captured,
  ds.get_service_deposit_status_acl_captured,
  ds.deposit_status_anon_execute_present,
  ds.deposit_status_authenticated_execute_present,
  ds.deposit_status_service_role_execute_present,
  ds.deposit_status_public_acl_state_known,
  ds.round_trip_old_double_count_pattern_present,
  ds.round_trip_already_fixed,
  (ds.round_trip_old_double_count_pattern_present or ds.round_trip_already_fixed) as round_trip_source_state_recognized,
  ts.coupon_trigger_exists,
  ts.coupon_trigger_source_identified,
  ts.coupon_trigger_can_be_safely_guarded,
  ts.fulfillment_sync_trigger_exists,
  ts.fulfillment_sync_source_identified,
  ts.fulfillment_total_snapshot_model_confirmed,
  c.adjustment_columns_absent_or_compatible,
  c.adjustment_history_table_absent_or_compatible,
  c.adjustment_rpc_absent_or_compatible,
  c.financial_summary_functions_absent_or_compatible,
  c.no_conflicting_overloads,
  c.partial_install_detected,
  c.partial_install_compatible,
  c.partial_install_compatible as no_incompatible_partial_install,
  ri.refund_ledger_absent_confirmed,
  ps.paid_source_confirmed,
  cs.commission_source_confirmed,
  (pc.bookings_with_more_than_one_deposit_request = 0) as payment_cardinality_supported_for_stage1,
  (
    rt.transport_bookings_exists
    and rt.partner_service_fulfillments_exists
    and rt.service_deposit_requests_exists
    and rt.affiliate_commission_events_exists
    and rt.affiliate_payouts_exists
    and ds.get_service_deposit_status_exists
    and ds.get_service_deposit_status_exact_overload
    and ds.get_service_deposit_status_return_type_captured
    and ds.get_service_deposit_status_acl_captured
    and ds.deposit_status_anon_execute_present
    and ds.deposit_status_authenticated_execute_present
    and ds.deposit_status_service_role_execute_present
    and ds.deposit_status_public_acl_state_known
    and (ds.round_trip_old_double_count_pattern_present or ds.round_trip_already_fixed)
    and ts.coupon_trigger_exists
    and ts.coupon_trigger_source_identified
    and ts.coupon_trigger_can_be_safely_guarded
    and ts.fulfillment_sync_trigger_exists
    and ts.fulfillment_sync_source_identified
    and ts.fulfillment_total_snapshot_model_confirmed
    and c.adjustment_columns_absent_or_compatible
    and c.adjustment_history_table_absent_or_compatible
    and c.adjustment_rpc_absent_or_compatible
    and c.financial_summary_functions_absent_or_compatible
    and c.no_conflicting_overloads
    and c.partial_install_compatible
    and ri.refund_ledger_absent_confirmed
    and ps.paid_source_confirmed
    and cs.commission_source_confirmed
    and pc.bookings_with_more_than_one_deposit_request = 0
  ) as preflight_safe_to_continue
from required_tables rt
cross join deposit_status_state ds
cross join trigger_state ts
cross join compatibility c
cross join refund_inventory ri
cross join paid_source ps
cross join commission_source cs
cross join payment_cardinality pc;
