-- car-rental-flexible-pricing-stage3cd-verify-v1
-- READ ONLY. Run only after the Stage 3A/3B and Stage 3C/3D migrations.
-- Returns exactly one summary row and does not inspect booking/customer data.

with expected_booking_columns(column_name) as (
  values
    ('currency'::text),
    ('pickup_location_fee'::text),
    ('return_location_fee'::text),
    ('insurance_added'::text),
    ('insurance_cost'::text),
    ('young_driver_fee'::text),
    ('young_driver_cost'::text),
    ('pickup_city_code'::text),
    ('return_city_code'::text),
    ('pricing_snapshot'::text),
    ('pricing_validated_at'::text)
),
booking_column_contract as (
  select
    count(*) filter (where column_contract.column_name is not null)::integer as present_count,
    jsonb_object_agg(
      expected.column_name,
      jsonb_build_object(
        'type', format_type(attribute.atttypid, attribute.atttypmod),
        'nullable', not attribute.attnotnull
      ) order by expected.column_name
    ) filter (where attribute.attname is not null) as contract
  from expected_booking_columns expected
  left join information_schema.columns column_contract
    on column_contract.table_schema = 'public'
   and column_contract.table_name = 'car_bookings'
   and column_contract.column_name = expected.column_name
  left join pg_attribute attribute
    on attribute.attrelid = to_regclass('public.car_bookings')
   and attribute.attname = expected.column_name
   and attribute.attnum > 0
   and not attribute.attisdropped
),
required_constraints(constraint_name) as (
  values
    ('car_bookings_pickup_city_code_check'::text),
    ('car_bookings_return_city_code_check'::text),
    ('car_bookings_pricing_snapshot_check'::text),
    ('car_bookings_pickup_location_fee_check'::text),
    ('car_bookings_return_location_fee_check'::text),
    ('car_bookings_insurance_cost_check'::text),
    ('car_bookings_young_driver_cost_check'::text)
),
constraint_contract as (
  select
    count(constraint_record.oid)::integer as present_count,
    coalesce(jsonb_agg(constraint_record.conname order by constraint_record.conname)
      filter (where constraint_record.oid is not null), '[]'::jsonb) as names
  from required_constraints expected
  left join pg_constraint constraint_record
    on constraint_record.conrelid = to_regclass('public.car_bookings')
   and constraint_record.conname = expected.constraint_name
   and constraint_record.contype = 'c'
),
function_contract as (
  select
    to_regprocedure('public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)') is not null
      as authoritative_quote_present,
    to_regprocedure('public.car_validate_threshold_booking_financials()') is not null
      as booking_validator_present,
    to_regprocedure('public.car_rental_local_duration_days_24h(date,time without time zone,date,time without time zone)') is not null
      as local_duration_present,
    to_regprocedure('public.car_threshold_standard_directional_fee(text)') is not null
      as standard_fee_present,
    has_function_privilege('anon', 'public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)', 'execute')
      as anon_quote_execute,
    not has_function_privilege('anon', 'public.car_validate_threshold_booking_financials()', 'execute')
      as anon_validator_execute_revoked
),
trigger_contract as (
  select exists (
    select 1
    from pg_trigger trigger_record
    where trigger_record.tgrelid = to_regclass('public.car_bookings')
      and trigger_record.tgname = 'car_bookings_validate_threshold_financials'
      and not trigger_record.tgisinternal
      and (trigger_record.tgtype & 2) = 2
      and (trigger_record.tgtype & 4) = 4
  ) as threshold_financial_trigger_present
),
flags as (
  select
    coalesce(bool_or(car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings
),
offer_state as (
  select
    count(*)::integer as offer_count,
    count(*) filter (where availability_mode = 'legacy')::integer as legacy_offers,
    count(*) filter (where availability_mode = 'mapped')::integer as mapped_offers,
    count(*) filter (where pricing_strategy = 'legacy_compat')::integer as legacy_pricing_offers,
    count(*) filter (where pricing_strategy = 'threshold_daily_rate')::integer as threshold_pricing_offers
  from public.car_offers
),
tier_state as (
  select count(*)::integer as tier_rows
  from public.car_offer_daily_rate_tiers
),
publication_contract as (
  select
    coalesce(bool_and(
      pg_get_expr(policy_record.polqual, policy_record.polrelid) ilike '%is_available%'
      and pg_get_expr(policy_record.polqual, policy_record.polrelid) ilike '%is_published%'
    ), false) as public_policies_require_available_and_published
  from pg_policy policy_record
  where policy_record.polrelid = to_regclass('public.car_offers')
    and (
      'anon'::regrole = any(policy_record.polroles)
      or 'authenticated'::regrole = any(policy_record.polroles)
    )
    and policy_record.polcmd = 'r'
),
partner_payment_separation as (
  select
    position('set payment_status = v_payment_status' in lower(prosrc)) > 0
      and split_part(lower(prosrc), '-- transport semantics', 1)
        !~ '(^|[^_[:alnum:]])status[[:space:]]*='
      as cars_payment_state_only
  from pg_proc
  where oid = to_regprocedure('public.sync_car_booking_status_from_deposit_paid()')
),
kind_state as (
  select
    count(*) filter (where code in ('car', 'quad', 'buggy', 'scooter', 'bicycle'))::integer as expected_kinds,
    coalesce(array_agg(code order by sort_order) filter (
      where code in ('car', 'quad', 'buggy', 'scooter', 'bicycle')
    ), '{}'::text[]) as kind_codes
  from public.car_vehicle_kinds
)
select
  'car-rental-flexible-pricing-stage3cd-verify-v1'::text as verify_version,
  now() as inspected_at,
  columns.present_count = 11 as booking_snapshot_columns_present,
  columns.contract as booking_snapshot_column_contract,
  constraints.present_count = 7 as booking_snapshot_constraints_present,
  constraints.names as booking_snapshot_constraints,
  functions.authoritative_quote_present,
  functions.booking_validator_present,
  functions.local_duration_present,
  functions.standard_fee_present,
  functions.anon_quote_execute,
  functions.anon_validator_execute_revoked,
  triggers.threshold_financial_trigger_present,
  publication.public_policies_require_available_and_published,
  payment.cars_payment_state_only as payment_status_separate_from_partner_confirmation,
  kinds.expected_kinds,
  kinds.kind_codes,
  state.offer_count,
  state.legacy_offers,
  state.mapped_offers,
  state.legacy_pricing_offers,
  state.threshold_pricing_offers,
  tiers.tier_rows,
  flags.mapped_enabled,
  flags.threshold_enabled,
  (
    columns.present_count = 11
    and constraints.present_count = 7
    and functions.authoritative_quote_present
    and functions.booking_validator_present
    and functions.local_duration_present
    and functions.standard_fee_present
    and functions.anon_quote_execute
    and functions.anon_validator_execute_revoked
    and triggers.threshold_financial_trigger_present
    and publication.public_policies_require_available_and_published
    and payment.cars_payment_state_only
    and kinds.expected_kinds = 5
    and state.mapped_offers = 0
    and state.threshold_pricing_offers = 0
    and tiers.tier_rows = 0
    and flags.mapped_enabled is false
    and flags.threshold_enabled is false
  ) as stage3cd_runtime_foundation_safe
from booking_column_contract columns
cross join constraint_contract constraints
cross join function_contract functions
cross join trigger_contract triggers
cross join flags
cross join offer_state state
cross join tier_state tiers
cross join publication_contract publication
cross join partner_payment_separation payment
cross join kind_state kinds;
