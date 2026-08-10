-- Read-only verification for 20260810170000_car_booking_public_reference.sql.
-- Expected final row: car_booking_public_reference_safe = true.

with column_contract as (
  select
    count(*) filter (
      where attribute.attname = 'booking_reference'
        and format_type(attribute.atttypid, attribute.atttypmod) = 'text'
        and attribute.attnotnull
    ) = 1 as reference_column_ok,
    count(*) filter (
      where attribute.attname = 'public_submission_key'
        and format_type(attribute.atttypid, attribute.atttypmod) = 'uuid'
        and not attribute.attnotnull
    ) = 1 as submission_key_column_ok
  from pg_attribute attribute
  where attribute.attrelid = to_regclass('public.car_bookings')
    and attribute.attname in ('booking_reference', 'public_submission_key')
    and attribute.attnum > 0
    and not attribute.attisdropped
),
constraint_contract as (
  select
    count(*) filter (where constraint_state.conname = 'car_bookings_booking_reference_format_check') = 1
      as format_constraint_ok,
    count(*) filter (where constraint_state.conname = 'car_bookings_booking_reference_key' and constraint_state.contype = 'u') = 1
      as unique_constraint_ok
  from pg_constraint constraint_state
  where constraint_state.conrelid = to_regclass('public.car_bookings')
),
index_contract as (
  select count(*) = 1 as submission_key_unique_ok
  from pg_indexes index_state
  where index_state.schemaname = 'public'
    and index_state.tablename = 'car_bookings'
    and index_state.indexname = 'car_bookings_public_submission_key_key'
    and index_state.indexdef ilike 'create unique index%'
),
function_contract as (
  select
    to_regprocedure('public.car_bookings_assign_public_reference()') is not null as reference_function_ok,
    to_regprocedure('public.submit_car_booking_request(uuid,jsonb)') is not null as submit_function_ok,
    not has_function_privilege('public', 'public.submit_car_booking_request(uuid,jsonb)', 'execute')
      as public_execute_revoked,
    has_function_privilege('anon', 'public.submit_car_booking_request(uuid,jsonb)', 'execute')
      as anon_execute_ok,
    has_function_privilege('authenticated', 'public.submit_car_booking_request(uuid,jsonb)', 'execute')
      as authenticated_execute_ok,
    position('''pending''' in coalesce(pg_get_functiondef(to_regprocedure('public.submit_car_booking_request(uuid,jsonb)')), '')) > 0
      and position('''unpaid''' in coalesce(pg_get_functiondef(to_regprocedure('public.submit_car_booking_request(uuid,jsonb)')), '')) > 0
      and position('on conflict (public_submission_key)' in lower(coalesce(pg_get_functiondef(to_regprocedure('public.submit_car_booking_request(uuid,jsonb)')), ''))) > 0
      as pending_unpaid_idempotency_ok,
    position('booking_reference' in coalesce(pg_get_function_result(to_regprocedure('public.submit_car_booking_request(uuid,jsonb)')), '')) > 0
      and position('full_name' in coalesce(pg_get_function_result(to_regprocedure('public.submit_car_booking_request(uuid,jsonb)')), '')) = 0
      and position('email' in coalesce(pg_get_function_result(to_regprocedure('public.submit_car_booking_request(uuid,jsonb)')), '')) = 0
      and position('phone' in coalesce(pg_get_function_result(to_regprocedure('public.submit_car_booking_request(uuid,jsonb)')), '')) = 0
      as narrow_return_contract_ok
),
trigger_contract as (
  select count(*) = 1 as immutable_reference_trigger_ok
  from pg_trigger trigger_state
  where trigger_state.tgrelid = to_regclass('public.car_bookings')
    and trigger_state.tgname = 'car_bookings_00_assign_public_reference'
    and not trigger_state.tgisinternal
    and trigger_state.tgenabled = 'O'
    and pg_get_triggerdef(trigger_state.oid) ilike '%before insert or update of id, booking_reference, public_submission_key%'
),
data_contract as (
  select
    count(*)::integer as booking_count,
    count(*) filter (
      where booking.booking_reference is null
         or booking.booking_reference !~ '^CAR-[0-9a-f]{8}$'
         or booking.booking_reference <> 'CAR-' || substr(replace(booking.id::text, '-', ''), 1, 8)
    )::integer as invalid_reference_count,
    (
      select count(*)::integer
      from (
        select grouped.booking_reference
        from public.car_bookings grouped
        group by grouped.booking_reference
        having count(*) > 1
      ) duplicate_reference
    ) as duplicate_reference_count,
    count(*) filter (where booking.status not in ('pending','message_sent','confirmed','active','completed','cancelled'))::integer
      as invalid_status_count,
    count(*) filter (where booking.payment_status not in ('unpaid','partial','paid','refunded'))::integer
      as invalid_payment_status_count
  from public.car_bookings booking
),
fulfillment_contract as (
  select count(*)::integer as fulfillment_reference_mismatch_count
  from public.partner_service_fulfillments fulfillment
  join public.car_bookings booking
    on booking.id = fulfillment.booking_id
  where fulfillment.resource_type = 'cars'
    and fulfillment.reference is distinct from booking.booking_reference
)
select
  column_contract.reference_column_ok,
  column_contract.submission_key_column_ok,
  constraint_contract.format_constraint_ok,
  constraint_contract.unique_constraint_ok,
  index_contract.submission_key_unique_ok,
  function_contract.reference_function_ok,
  function_contract.submit_function_ok,
  function_contract.public_execute_revoked,
  function_contract.anon_execute_ok,
  function_contract.authenticated_execute_ok,
  function_contract.pending_unpaid_idempotency_ok,
  function_contract.narrow_return_contract_ok,
  trigger_contract.immutable_reference_trigger_ok,
  data_contract.booking_count,
  data_contract.invalid_reference_count,
  data_contract.duplicate_reference_count,
  data_contract.invalid_status_count,
  data_contract.invalid_payment_status_count,
  fulfillment_contract.fulfillment_reference_mismatch_count,
  (
    column_contract.reference_column_ok
    and column_contract.submission_key_column_ok
    and constraint_contract.format_constraint_ok
    and constraint_contract.unique_constraint_ok
    and index_contract.submission_key_unique_ok
    and function_contract.reference_function_ok
    and function_contract.submit_function_ok
    and function_contract.public_execute_revoked
    and function_contract.anon_execute_ok
    and function_contract.authenticated_execute_ok
    and function_contract.pending_unpaid_idempotency_ok
    and function_contract.narrow_return_contract_ok
    and trigger_contract.immutable_reference_trigger_ok
    and data_contract.invalid_reference_count = 0
    and data_contract.duplicate_reference_count = 0
    and data_contract.invalid_status_count = 0
    and data_contract.invalid_payment_status_count = 0
    and fulfillment_contract.fulfillment_reference_mismatch_count = 0
  ) as car_booking_public_reference_safe
from column_contract
cross join constraint_contract
cross join index_contract
cross join function_contract
cross join trigger_contract
cross join data_contract
cross join fulfillment_contract;
