-- Read-only verification for:
--   20260810150000_car_partner_fulfillment_operational_details.sql
-- This script performs no writes and returns one PASS/FAIL row.

with function_contract as (
  select
    procedure_row.oid is not null as function_exists,
    coalesce(procedure_row.prosecdef, false) as security_definer,
    lower(coalesce(pg_get_functiondef(procedure_row.oid), '')) as source,
    coalesce(procedure_row.proconfig, '{}'::text[]) as config
  from (values (to_regprocedure(
    'public.trg_partner_service_fulfillment_from_car_booking()'
  ))) expected(oid)
  left join pg_proc procedure_row on procedure_row.oid = expected.oid
),
trigger_contract as (
  select
    count(*) filter (
      where trigger_row.tgname = 'trg_partner_service_fulfillment_from_car_booking_ins'
        and (trigger_row.tgtype & 4) = 4
    ) = 1 as insert_trigger_safe,
    count(*) filter (
      where trigger_row.tgname = 'trg_partner_service_fulfillment_from_car_booking_upd'
        and (trigger_row.tgtype & 16) = 16
    ) = 1 as update_trigger_safe
  from pg_trigger trigger_row
  where trigger_row.tgrelid = to_regclass('public.car_bookings')
    and trigger_row.tgfoid = to_regprocedure(
      'public.trg_partner_service_fulfillment_from_car_booking()'
    )
    and not trigger_row.tgisinternal
),
policy_contract as (
  select
    exists (
      select 1
      from pg_policies policy_row
      where policy_row.schemaname = 'public'
        and policy_row.tablename = 'partner_service_fulfillments'
        and policy_row.policyname = 'partner_service_fulfillments_partner_read'
        and lower(coalesce(policy_row.qual, '')) like '%is_partner_user(partner_id)%'
    ) as exact_partner_read_safe,
    exists (
      select 1
      from pg_policies policy_row
      where policy_row.schemaname = 'public'
        and policy_row.tablename = 'partner_service_fulfillment_contacts'
        and lower(coalesce(policy_row.qual, '')) like '%contact_revealed_at is not null%'
    ) as contact_gate_safe,
    exists (
      select 1
      from pg_policies policy_row
      where policy_row.schemaname = 'public'
        and policy_row.tablename = 'partner_service_fulfillment_form_snapshots'
        and lower(coalesce(policy_row.qual, '')) like '%contact_revealed_at is not null%'
    ) as form_snapshot_gate_safe
),
pending_contract as (
  select
    count(*) filter (
      where fulfillment.details->>'pickup_date' is distinct from booking.pickup_date::text
         or fulfillment.details->>'pickup_time' is distinct from booking.pickup_time::text
         or fulfillment.details->>'return_date' is distinct from booking.return_date::text
         or fulfillment.details->>'return_time' is distinct from booking.return_time::text
    )::integer as pending_operational_detail_mismatch_count,
    count(*) filter (
      where coalesce(fulfillment.details, '{}'::jsonb) ?| array[
        'full_name', 'customer_name', 'email', 'customer_email',
        'phone', 'customer_phone', 'country', 'pickup_address',
        'return_address', 'flight_number', 'special_requests'
      ]
    )::integer as pending_details_pii_key_count
  from public.partner_service_fulfillments fulfillment
  join public.car_bookings booking
    on booking.id = fulfillment.booking_id
  where fulfillment.resource_type = 'cars'
    and fulfillment.status = 'pending_acceptance'
    and booking.status in ('pending', 'message_sent')
),
exact_owner_contract as (
  select count(*)::integer as threshold_exact_owner_mismatch_count
  from public.partner_service_fulfillments fulfillment
  join public.car_offers offer
    on offer.id = fulfillment.resource_id
  where fulfillment.resource_type = 'cars'
    and offer.pricing_strategy = 'threshold_daily_rate'
    and fulfillment.partner_id is distinct from offer.owner_partner_id
),
duplicate_contract as (
  select count(*)::integer as duplicate_cars_fulfillment_count
  from (
    select fulfillment.booking_id
    from public.partner_service_fulfillments fulfillment
    where fulfillment.resource_type = 'cars'
    group by fulfillment.booking_id
    having count(*) <> 1
  ) duplicate_row
),
summary as (
  select
    function_contract.function_exists,
    function_contract.security_definer,
    ('search_path=public' = any(function_contract.config)) as function_search_path_safe,
    position('''pickup_date'', new.pickup_date' in function_contract.source) > 0
      and position('''pickup_time'', new.pickup_time' in function_contract.source) > 0
      and position('''return_date'', new.return_date' in function_contract.source) > 0
      and position('''return_time'', new.return_time' in function_contract.source) > 0
      as operational_timing_contract_safe,
    position('partner_service_fulfillment_partner_id_for_car_booking' in function_contract.source) > 0
      and position('upsert_partner_service_fulfillment_from_booking_with_partner' in function_contract.source) > 0
      and position('partner_service_fulfillment_form_snapshots' in function_contract.source) > 0
      as existing_fulfillment_contract_preserved,
    trigger_contract.insert_trigger_safe,
    trigger_contract.update_trigger_safe,
    policy_contract.exact_partner_read_safe,
    policy_contract.contact_gate_safe,
    policy_contract.form_snapshot_gate_safe,
    pending_contract.pending_operational_detail_mismatch_count,
    pending_contract.pending_details_pii_key_count,
    exact_owner_contract.threshold_exact_owner_mismatch_count,
    duplicate_contract.duplicate_cars_fulfillment_count
  from function_contract
  cross join trigger_contract
  cross join policy_contract
  cross join pending_contract
  cross join exact_owner_contract
  cross join duplicate_contract
)
select
  summary.*,
  (
    summary.function_exists
    and summary.security_definer
    and summary.function_search_path_safe
    and summary.operational_timing_contract_safe
    and summary.existing_fulfillment_contract_preserved
    and summary.insert_trigger_safe
    and summary.update_trigger_safe
    and summary.exact_partner_read_safe
    and summary.contact_gate_safe
    and summary.form_snapshot_gate_safe
    and summary.pending_operational_detail_mismatch_count = 0
    and summary.pending_details_pii_key_count = 0
    and summary.threshold_exact_owner_mismatch_count = 0
    and summary.duplicate_cars_fulfillment_count = 0
  ) as car_partner_fulfillment_operational_details_safe
from summary;
