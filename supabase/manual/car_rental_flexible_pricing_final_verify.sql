-- car-rental-flexible-pricing-final-verify-v1
-- READ ONLY. Run after all four Stage 3 migrations. Returns exactly one row,
-- reads no booking/customer rows and verifies that production remains inert.

with
required_offer_columns(column_name, formatted_type, nullable, default_fragment) as (
  values
    ('pricing_strategy'::text, 'text'::text, false, '''legacy_compat'''::text),
    ('engine_capacity_cc', 'integer', true, null),
    ('required_licence_category', 'text', true, null),
    ('minimum_driver_age', 'integer', true, null),
    ('insurance_mode', 'text', false, '''legacy_optional_daily'''),
    ('min_rental_days', 'integer', false, null),
    ('max_rental_days', 'integer', true, null)
),
required_booking_columns(column_name, formatted_type) as (
  values
    ('currency'::text, 'text'::text),
    ('pickup_location_fee', 'numeric(12,2)'),
    ('return_location_fee', 'numeric(12,2)'),
    ('insurance_added', 'boolean'),
    ('insurance_cost', 'numeric(12,2)'),
    ('young_driver_fee', 'boolean'),
    ('young_driver_cost', 'numeric(12,2)'),
    ('pickup_city_code', 'text'),
    ('return_city_code', 'text'),
    ('pricing_snapshot', 'jsonb'),
    ('pricing_validated_at', 'timestamp with time zone')
),
column_state as (
  select
    not exists (
      select 1
      from required_offer_columns expected
      where not exists (
        select 1
        from pg_attribute attribute
        left join pg_attrdef attribute_default
          on attribute_default.adrelid = attribute.attrelid
         and attribute_default.adnum = attribute.attnum
        where attribute.attrelid = to_regclass('public.car_offers')
          and attribute.attname = expected.column_name
          and attribute.attnum > 0
          and not attribute.attisdropped
          and format_type(attribute.atttypid, attribute.atttypmod) = expected.formatted_type
          and (not attribute.attnotnull) = expected.nullable
          and (
            expected.default_fragment is null
            or coalesce(pg_get_expr(attribute_default.adbin, attribute_default.adrelid), '')
              like '%' || expected.default_fragment || '%'
          )
      )
    ) as offer_columns_valid,
    not exists (
      select 1
      from required_booking_columns expected
      where not exists (
        select 1
        from pg_attribute attribute
        where attribute.attrelid = to_regclass('public.car_bookings')
          and attribute.attname = expected.column_name
          and attribute.attnum > 0
          and not attribute.attisdropped
          and format_type(attribute.atttypid, attribute.atttypmod) = expected.formatted_type
      )
    ) as booking_columns_valid,
    exists (
      select 1
      from pg_attribute attribute
      left join pg_attrdef attribute_default
        on attribute_default.adrelid = attribute.attrelid
       and attribute_default.adnum = attribute.attnum
      where attribute.attrelid = to_regclass('public.site_settings')
        and attribute.attname = 'car_threshold_daily_rates_enabled'
        and attribute.attnotnull
        and pg_get_expr(attribute_default.adbin, attribute_default.adrelid) = 'false'
    ) as threshold_flag_valid
),
tier_column_state as (
  select
    to_regclass('public.car_offer_daily_rate_tiers') is not null as table_present,
    count(*) filter (
      where attribute.attname in (
        'id', 'offer_id', 'threshold_days', 'daily_rate',
        'is_active', 'created_at', 'updated_at'
      )
    )::integer = 7 as columns_present,
    bool_or(attribute.attname = 'daily_rate'
      and format_type(attribute.atttypid, attribute.atttypmod) = 'numeric(12,6)') as daily_rate_precision_valid
  from pg_attribute attribute
  where attribute.attrelid = to_regclass('public.car_offer_daily_rate_tiers')
    and attribute.attnum > 0
    and not attribute.attisdropped
),
required_constraints(constraint_name) as (
  values
    ('car_offers_pricing_strategy_check'::text),
    ('car_offers_engine_capacity_cc_check'),
    ('car_offers_required_licence_category_check'),
    ('car_offers_minimum_driver_age_check'),
    ('car_offers_insurance_mode_check'),
    ('car_offers_rental_days_contract_check'),
    ('car_offer_daily_rate_tiers_pkey'),
    ('car_offer_daily_rate_tiers_offer_fkey'),
    ('car_offer_daily_rate_tiers_offer_threshold_key'),
    ('car_offer_daily_rate_tiers_threshold_check'),
    ('car_offer_daily_rate_tiers_daily_rate_check'),
    ('car_bookings_pickup_city_code_check'),
    ('car_bookings_return_city_code_check'),
    ('car_bookings_pricing_snapshot_check'),
    ('car_bookings_pickup_location_fee_check'),
    ('car_bookings_return_location_fee_check'),
    ('car_bookings_insurance_cost_check'),
    ('car_bookings_young_driver_cost_check')
),
constraint_state as (
  select
    count(*)::integer as expected_count,
    count(actual.oid)::integer as present_count,
    coalesce(array_agg(expected.constraint_name order by expected.constraint_name)
      filter (where actual.oid is null), '{}'::text[]) as missing_constraints
  from required_constraints expected
  left join pg_constraint actual on actual.conname = expected.constraint_name
),
required_triggers(table_name, trigger_name) as (
  values
    ('car_offers'::text, 'car_offers_multicity_validate'::text),
    ('car_offer_city_availability', 'car_offer_city_availability_validate'),
    ('car_offer_city_availability', 'car_offer_city_availability_complete'),
    ('car_offer_daily_rate_tiers', 'car_offer_daily_rate_tiers_set_updated_at'),
    ('car_offer_daily_rate_tiers', 'car_offer_daily_rate_tiers_validate_identity'),
    ('car_offer_daily_rate_tiers', 'car_offer_daily_rate_tiers_sync_min'),
    ('car_bookings', 'car_bookings_validate_threshold_financials'),
    ('service_deposit_requests', 'trg_sync_car_booking_status_from_deposit_paid')
),
trigger_state as (
  select
    count(*)::integer as expected_count,
    count(actual.oid)::integer as present_count,
    coalesce(array_agg(expected.table_name || '.' || expected.trigger_name
      order by expected.table_name, expected.trigger_name)
      filter (where actual.oid is null), '{}'::text[]) as missing_triggers
  from required_triggers expected
  left join pg_trigger actual
    on actual.tgrelid = to_regclass('public.' || expected.table_name)
   and actual.tgname = expected.trigger_name
   and not actual.tgisinternal
),
function_state as (
  select
    to_regprocedure('public.car_rental_duration_days_24h(timestamptz,timestamptz)') is not null
      as instant_duration_present,
    to_regprocedure('public.car_rental_local_duration_days_24h(date,time without time zone,date,time without time zone)') is not null
      as local_duration_present,
    to_regprocedure('public.resolve_car_threshold_daily_rate_quote(uuid,timestamptz,timestamptz,numeric)') is not null
      as base_quote_present,
    to_regprocedure(
      'public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)'
    ) is not null as authoritative_quote_present,
    to_regprocedure('public.car_validate_threshold_booking_financials()') is not null
      as booking_validator_present,
    to_regprocedure('public.sync_car_booking_status_from_deposit_paid()') is not null
      as payment_sync_present
),
function_security as (
  select
    has_function_privilege(
      'anon',
      'public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)',
      'execute'
    ) as anon_can_quote,
    not has_function_privilege('anon', 'public.car_validate_threshold_booking_financials()', 'execute')
      as anon_validator_revoked,
    not has_function_privilege('authenticated', 'public.car_validate_threshold_booking_financials()', 'execute')
      as authenticated_validator_revoked,
    not has_function_privilege('anon', 'public.resolve_car_threshold_daily_rate_quote(uuid,timestamptz,timestamptz,numeric)', 'execute')
      as preliminary_quote_not_public
),
function_source as (
  select
    coalesce((
      select position('threshold_booking_must_enter_partner_workflow_pending' in validator.prosrc) > 0
        and position('threshold_booking_must_enter_payment_workflow_unpaid' in validator.prosrc) > 0
        and position('threshold_booking_financial_tamper_detected' in validator.prosrc) > 0
        and position('car_booking_public_insert_requires_exact_offer' in validator.prosrc) > 0
        and position('coalesce(new.full_insurance, false) is distinct from v_quote.insurance_selected' in validator.prosrc) > 0
      from pg_proc validator
      where validator.oid = to_regprocedure('public.car_validate_threshold_booking_financials()')
    ), false) as validator_fail_closed,
    coalesce((
      select position('exact timezone round trip' in duration.prosrc) > 0
        and position('at time zone ''Europe/Nicosia''' in duration.prosrc) > 0
      from pg_proc duration
      where duration.oid = to_regprocedure(
        'public.car_rental_local_duration_days_24h(date,time without time zone,date,time without time zone)'
      )
    ), false) as local_duration_dst_fail_closed,
    coalesce((
      select position('v_authenticated_user_id is null and p_user_id is not null' in quote.prosrc) > 0
        and position('p_user_id is distinct from v_authenticated_user_id' in quote.prosrc) > 0
        and position('v_effective_user_id := v_authenticated_user_id' in quote.prosrc) > 0
        and position('auth.jwt()' in quote.prosrc) > 0
      from pg_proc quote
      where quote.oid = to_regprocedure(
        'public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)'
      )
    ), false) as quote_identity_bound,
    coalesce((
      select position('set payment_status = v_payment_status' in lower(payment.prosrc)) > 0
        and split_part(lower(payment.prosrc), '-- transport semantics', 1)
          !~ '(^|[^_[:alnum:]])status[[:space:]]*='
      from pg_proc payment
      where payment.oid = to_regprocedure('public.sync_car_booking_status_from_deposit_paid()')
    ), false) as cars_payment_does_not_confirm_booking
),
policy_state as (
  select
    exists (
      select 1
      from pg_class relation
      where relation.oid = to_regclass('public.car_offer_daily_rate_tiers')
        and relation.relrowsecurity
    ) as tier_rls_enabled,
    exists (
      select 1
      from pg_policy policy
      where policy.polrelid = to_regclass('public.car_offer_daily_rate_tiers')
        and policy.polname = 'car_offer_daily_rate_tiers_public_read'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%car_multi_city_mapped_enabled%'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%car_threshold_daily_rates_enabled%'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%is_published%'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%is_available%'
    ) as tier_public_policy_valid,
    exists (
      select 1
      from pg_policy policy
      where policy.polrelid = to_regclass('public.car_offer_daily_rate_tiers')
        and policy.polname = 'car_offer_daily_rate_tiers_admin_all'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%is_current_user_admin%'
    ) as tier_admin_policy_valid,
    exists (
      select 1
      from pg_policy policy
      where policy.polrelid = to_regclass('public.car_offers')
        and policy.polname = 'car_offers_public_select'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%is_available%'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%is_published%'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%pricing_strategy%'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%car_threshold_daily_rates_enabled%'
    ) as offer_public_policy_valid,
    not exists (
      select 1
      from pg_policy policy
      where policy.polrelid = to_regclass('public.car_offers')
        and policy.polcmd in ('r', '*')
        and (
          0::oid = any(policy.polroles)
          or 'anon'::regrole = any(policy.polroles)
        )
        and (
          coalesce(pg_get_expr(policy.polqual, policy.polrelid), '') not ilike '%is_available%'
          or coalesce(pg_get_expr(policy.polqual, policy.polrelid), '') not ilike '%is_published%'
        )
    ) as no_unsafe_anon_offer_policy
),
grant_state as (
  select
    has_table_privilege('anon', 'public.car_offer_daily_rate_tiers', 'select') as anon_tier_read_granted,
    not has_table_privilege('anon', 'public.car_offer_daily_rate_tiers', 'insert')
      and not has_table_privilege('anon', 'public.car_offer_daily_rate_tiers', 'update')
      and not has_table_privilege('anon', 'public.car_offer_daily_rate_tiers', 'delete') as anon_tier_write_revoked,
    has_table_privilege('authenticated', 'public.car_offer_daily_rate_tiers', 'select')
      and has_table_privilege('authenticated', 'public.car_offer_daily_rate_tiers', 'insert')
      and has_table_privilege('authenticated', 'public.car_offer_daily_rate_tiers', 'update')
      and has_table_privilege('authenticated', 'public.car_offer_daily_rate_tiers', 'delete')
      as authenticated_tier_crud_granted,
    has_table_privilege('service_role', 'public.car_offer_daily_rate_tiers', 'select')
      and has_table_privilege('service_role', 'public.car_offer_daily_rate_tiers', 'insert')
      and has_table_privilege('service_role', 'public.car_offer_daily_rate_tiers', 'update')
      and has_table_privilege('service_role', 'public.car_offer_daily_rate_tiers', 'delete')
      as service_tier_crud_granted
),
offer_state as (
  select
    count(*)::integer as offer_count,
    count(*) filter (where lower(btrim(location)) = 'larnaca')::integer as larnaca_count,
    count(*) filter (where lower(btrim(location)) = 'paphos')::integer as paphos_count,
    count(*) filter (where is_available and is_published)::integer as public_offer_count,
    count(*) filter (where availability_mode = 'legacy')::integer as legacy_offer_count,
    count(*) filter (where availability_mode = 'mapped')::integer as mapped_offer_count,
    count(*) filter (where pricing_strategy = 'legacy_compat')::integer as legacy_pricing_count,
    count(*) filter (where pricing_strategy = 'threshold_daily_rate')::integer as threshold_pricing_count,
    count(*) filter (where insurance_mode = 'legacy_optional_daily')::integer as legacy_insurance_count,
    count(*) filter (
      where engine_capacity_cc is not null
         or required_licence_category is not null
         or minimum_driver_age is not null
    )::integer as existing_structured_field_changes,
    count(*) filter (
      where pricing_profile_id is null
         or profile.id is null
         or profile.legacy_booking_location <> lower(btrim(location))
    )::integer as incompatible_profile_count,
    md5(coalesce(string_agg(
      jsonb_build_array(
        offer.id,
        offer.price_per_day,
        offer.price_3days,
        offer.price_4_6days,
        offer.price_7_10days,
        offer.price_10plus_days,
        offer.currency,
        offer.location,
        offer.owner_partner_id,
        offer.deposit_amount,
        offer.insurance_per_day,
        offer.young_driver_fee,
        offer.young_driver_cost,
        offer.stock_count,
        offer.north_allowed,
        offer.is_available,
        offer.is_published,
        offer.submission_status
      )::text,
      E'\n' order by offer.id
    ), '')) as protected_fingerprint,
    array_agg(offer.id order by offer.id) as exact_offer_ids
  from public.car_offers offer
  left join public.car_pricing_profiles profile on profile.id = offer.pricing_profile_id
),
availability_state as (
  select
    count(*)::integer as row_count,
    count(*) filter (where is_active)::integer as active_count,
    count(*) filter (where fee_mode = 'inherit')::integer as inherit_count,
    count(*) filter (where fee_mode = 'override')::integer as override_count,
    count(*) filter (where fee_per_direction is not null)::integer as explicit_fee_count
  from public.car_offer_city_availability
),
tier_state as (
  select count(*)::integer as row_count
  from public.car_offer_daily_rate_tiers
),
kind_state as (
  select
    count(*) filter (where code in ('car', 'buggy', 'quad', 'scooter', 'bicycle'))::integer as expected_kind_count,
    count(*) filter (
      where code in ('car', 'buggy', 'quad', 'scooter', 'bicycle') and is_active
    )::integer as active_expected_kind_count,
    array_agg(code order by sort_order) filter (
      where code in ('car', 'buggy', 'quad', 'scooter', 'bicycle')
    ) as kind_codes
  from public.car_vehicle_kinds
),
flag_state as (
  select
    count(*) filter (where id = 1)::integer as canonical_setting_count,
    coalesce(bool_or(car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings
)
select
  'car-rental-flexible-pricing-final-verify-v1'::text as verify_version,
  now() as verified_at,
  offers.offer_count,
  offers.larnaca_count,
  offers.paphos_count,
  offers.public_offer_count,
  offers.legacy_offer_count,
  offers.mapped_offer_count,
  offers.legacy_pricing_count,
  offers.threshold_pricing_count,
  offers.protected_fingerprint,
  offers.exact_offer_ids,
  availability.row_count as availability_rows,
  availability.active_count as active_availability_rows,
  availability.inherit_count as inherit_fee_rows,
  availability.override_count as override_fee_rows,
  tiers.row_count as daily_rate_tier_rows,
  kinds.kind_codes,
  flags.mapped_enabled as car_multi_city_mapped_enabled,
  flags.threshold_enabled as car_threshold_daily_rates_enabled,
  columns.offer_columns_valid,
  columns.booking_columns_valid,
  columns.threshold_flag_valid,
  tier_columns.table_present as tier_table_present,
  tier_columns.columns_present as tier_columns_present,
  tier_columns.daily_rate_precision_valid,
  constraints.missing_constraints,
  triggers.missing_triggers,
  functions.authoritative_quote_present,
  security.anon_can_quote,
  security.anon_validator_revoked,
  source.validator_fail_closed,
  source.local_duration_dst_fail_closed,
  source.quote_identity_bound,
  source.cars_payment_does_not_confirm_booking,
  policies.tier_rls_enabled,
  policies.tier_public_policy_valid,
  policies.offer_public_policy_valid,
  (
    columns.offer_columns_valid
    and columns.booking_columns_valid
    and columns.threshold_flag_valid
    and tier_columns.table_present
    and tier_columns.columns_present
    and tier_columns.daily_rate_precision_valid
    and constraints.present_count = constraints.expected_count
    and triggers.present_count = triggers.expected_count
    and functions.instant_duration_present
    and functions.local_duration_present
    and functions.base_quote_present
    and functions.authoritative_quote_present
    and functions.booking_validator_present
    and functions.payment_sync_present
    and security.anon_can_quote
    and security.anon_validator_revoked
    and security.authenticated_validator_revoked
    and security.preliminary_quote_not_public
    and source.validator_fail_closed
    and source.local_duration_dst_fail_closed
    and source.quote_identity_bound
    and source.cars_payment_does_not_confirm_booking
    and policies.tier_rls_enabled
    and policies.tier_public_policy_valid
    and policies.tier_admin_policy_valid
    and policies.offer_public_policy_valid
    and policies.no_unsafe_anon_offer_policy
    and grants.anon_tier_read_granted
    and grants.anon_tier_write_revoked
    and grants.authenticated_tier_crud_granted
    and grants.service_tier_crud_granted
    and offers.offer_count = 27
    and offers.larnaca_count = 18
    and offers.paphos_count = 9
    and offers.public_offer_count = 26
    and offers.legacy_offer_count = 27
    and offers.mapped_offer_count = 0
    and offers.legacy_pricing_count = 27
    and offers.threshold_pricing_count = 0
    and offers.legacy_insurance_count = 27
    and offers.existing_structured_field_changes = 0
    and offers.incompatible_profile_count = 0
    and offers.protected_fingerprint = 'ec3e29a35f249c92279d7b15f400ef0f'
    and availability.row_count = 12
    and availability.active_count = 12
    and availability.inherit_count = 12
    and availability.override_count = 0
    and availability.explicit_fee_count = 0
    and tiers.row_count = 0
    and kinds.expected_kind_count = 5
    and kinds.active_expected_kind_count = 5
    and flags.canonical_setting_count = 1
    and flags.mapped_enabled is false
    and flags.threshold_enabled is false
  ) as stage3_final_production_safe
from column_state columns
cross join tier_column_state tier_columns
cross join constraint_state constraints
cross join trigger_state triggers
cross join function_state functions
cross join function_security security
cross join function_source source
cross join policy_state policies
cross join grant_state grants
cross join offer_state offers
cross join availability_state availability
cross join tier_state tiers
cross join kind_state kinds
cross join flag_state flags;
