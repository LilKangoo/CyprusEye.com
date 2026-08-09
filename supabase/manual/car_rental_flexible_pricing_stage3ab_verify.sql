-- car-rental-flexible-pricing-stage3ab-verify-v1
-- READ ONLY: returns exactly one summary row after the three Stage 3A/3B migrations.
with
required_offer_columns(column_name, data_type, is_nullable, default_fragment) as (
  values
    ('pricing_strategy'::text, 'text'::text, 'NO'::text, '''legacy_compat'''::text),
    ('engine_capacity_cc', 'integer', 'YES', null),
    ('required_licence_category', 'text', 'YES', null),
    ('minimum_driver_age', 'integer', 'YES', null),
    ('insurance_mode', 'text', 'NO', '''legacy_optional_daily'''),
    ('min_rental_days', 'integer', 'NO', null),
    ('max_rental_days', 'integer', 'YES', null)
),
required_tier_columns(column_name, data_type, is_nullable, default_fragment) as (
  values
    ('id'::text, 'uuid'::text, 'NO'::text, 'gen_random_uuid'),
    ('offer_id', 'uuid', 'NO', null),
    ('threshold_days', 'integer', 'NO', null),
    ('daily_rate', 'numeric', 'NO', null),
    ('is_active', 'boolean', 'NO', 'true'),
    ('created_at', 'timestamp with time zone', 'NO', 'now'),
    ('updated_at', 'timestamp with time zone', 'NO', 'now')
),
column_state as (
  select
    not exists (
      select 1
      from required_offer_columns expected
      where not exists (
        select 1
        from information_schema.columns actual
        where actual.table_schema = 'public'
          and actual.table_name = 'car_offers'
          and actual.column_name = expected.column_name
          and actual.data_type = expected.data_type
          and actual.is_nullable = expected.is_nullable
          and (
            expected.default_fragment is null
            or coalesce(actual.column_default, '') like '%' || expected.default_fragment || '%'
          )
      )
    ) as offer_columns_valid,
    not exists (
      select 1
      from required_tier_columns expected
      where not exists (
        select 1
        from information_schema.columns actual
        where actual.table_schema = 'public'
          and actual.table_name = 'car_offer_daily_rate_tiers'
          and actual.column_name = expected.column_name
          and actual.data_type = expected.data_type
          and actual.is_nullable = expected.is_nullable
          and (
            expected.default_fragment is null
            or coalesce(actual.column_default, '') like '%' || expected.default_fragment || '%'
          )
      )
    ) as tier_columns_valid,
    exists (
      select 1 from information_schema.columns actual
      where actual.table_schema = 'public'
        and actual.table_name = 'site_settings'
        and actual.column_name = 'car_threshold_daily_rates_enabled'
        and actual.data_type = 'boolean'
        and actual.is_nullable = 'NO'
        and coalesce(actual.column_default, '') like '%false%'
    ) as threshold_flag_column_valid,
    exists (
      select 1 from information_schema.columns actual
      where actual.table_schema = 'public'
        and actual.table_name = 'car_offers'
        and actual.column_name = 'max_rental_days'
        and actual.is_nullable = 'YES'
        and actual.column_default is null
    ) as max_rental_contract_valid
),
required_constraints(name) as (
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
    ('car_offer_daily_rate_tiers_daily_rate_check')
),
constraint_state as (
  select not exists (
    select 1 from required_constraints expected
    where not exists (
      select 1 from pg_constraint actual where actual.conname = expected.name
    )
  ) as constraints_valid
),
required_triggers(name) as (
  values
    ('car_offer_daily_rate_tiers_set_updated_at'::text),
    ('car_offer_daily_rate_tiers_validate_identity'),
    ('car_offer_daily_rate_tiers_sync_min'),
    ('car_offers_multicity_validate'),
    ('car_offer_city_availability_validate'),
    ('car_offer_city_availability_complete'),
    ('car_pricing_profile_cities_protect'),
    ('car_pricing_profiles_protect'),
    ('trg_sync_car_booking_status_from_deposit_paid')
),
trigger_state as (
  select not exists (
    select 1 from required_triggers expected
    where not exists (
      select 1 from pg_trigger actual
      where actual.tgname = expected.name and not actual.tgisinternal
    )
  ) as triggers_valid
),
function_state as (
  select
    to_regprocedure('public.car_validate_daily_rate_tier_identity()') is not null
    and to_regprocedure('public.car_sync_daily_rate_tier_min_days()') is not null
    and to_regprocedure('public.car_rental_duration_days_24h(timestamp with time zone,timestamp with time zone)') is not null
    and to_regprocedure('public.resolve_car_threshold_daily_rate_quote(uuid,timestamp with time zone,timestamp with time zone,numeric)') is not null
    and to_regprocedure('public.sync_car_booking_status_from_deposit_paid()') is not null
      as functions_valid
),
policy_state as (
  select
    exists (
      select 1 from pg_policy policy
      where policy.polrelid = 'public.car_offers'::regclass
        and policy.polname = 'car_offers_public_select'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%is_available%'
        and pg_get_expr(policy.polqual, policy.polrelid) ilike '%is_published%'
    )
    and not exists (
      select 1 from pg_policy policy
      where policy.polrelid = 'public.car_offers'::regclass
        and policy.polname in ('Anyone can view available car offers', 'Authenticated users can view all offers')
    )
    and not exists (
      select 1
      from pg_policy policy
      where policy.polrelid = 'public.car_offers'::regclass
        and policy.polcmd in ('r', '*')
        and (
          0::oid = any(policy.polroles)
          or (select role.oid from pg_roles role where role.rolname = 'anon') = any(policy.polroles)
        )
        and (
          coalesce(pg_get_expr(policy.polqual, policy.polrelid), '') not ilike '%is_available%'
          or coalesce(pg_get_expr(policy.polqual, policy.polrelid), '') not ilike '%is_published%'
        )
    ) as publication_policy_valid,
    exists (
      select 1 from pg_class relation
      where relation.oid = 'public.car_offer_daily_rate_tiers'::regclass
        and relation.relrowsecurity
    ) as tier_rls_enabled,
    count(*) filter (
      where policy.polrelid = 'public.car_offer_daily_rate_tiers'::regclass
        and policy.polname in ('car_offer_daily_rate_tiers_public_read', 'car_offer_daily_rate_tiers_admin_all')
    ) = 2 as tier_policies_valid
  from pg_policy policy
),
kind_state as (
  select
    count(*) filter (where code in ('car', 'quad', 'buggy', 'scooter', 'bicycle')) as required_kind_count,
    bool_and(is_active) filter (where code in ('car', 'quad', 'buggy', 'scooter', 'bicycle')) as required_kinds_active
  from public.car_vehicle_kinds
),
offer_state as (
  select
    count(*)::bigint as offer_count,
    count(*) filter (where pricing_strategy = 'legacy_compat')::bigint as legacy_strategy_count,
    count(*) filter (where pricing_strategy = 'threshold_daily_rate')::bigint as threshold_strategy_count,
    count(*) filter (where availability_mode = 'mapped')::bigint as mapped_offer_count,
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
),
tier_state as (
  select count(*)::bigint as tier_count
  from public.car_offer_daily_rate_tiers
),
availability_state as (
  select
    count(*)::bigint as availability_count,
    md5(coalesce(string_agg(
      jsonb_build_array(
        availability.offer_id,
        availability.city_id,
        availability.pickup_enabled,
        availability.return_enabled,
        availability.is_active,
        availability.fee_mode,
        availability.fee_per_direction,
        availability.fee_note
      )::text,
      E'\n' order by availability.offer_id, availability.city_id
    ), '')) as availability_fingerprint
  from public.car_offer_city_availability availability
),
flag_state as (
  select
    coalesce(bool_or(car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings
),
payment_function_state as (
  select
    pg_get_functiondef('public.sync_car_booking_status_from_deposit_paid()'::regprocedure) ilike '%payment_status = v_payment_status%'
    and pg_get_functiondef('public.sync_car_booking_status_from_deposit_paid()'::regprocedure) ilike '%then ''partial''%'
      as partial_payment_contract_valid
)
select
  'car-rental-flexible-pricing-stage3ab-verify-v1'::text as verify_version,
  now() as verified_at,
  offer.offer_count,
  offer.legacy_strategy_count,
  offer.threshold_strategy_count,
  offer.mapped_offer_count,
  offer.protected_fingerprint,
  offer.exact_offer_ids,
  tier.tier_count,
  availability.availability_count,
  availability.availability_fingerprint,
  kinds.required_kind_count,
  kinds.required_kinds_active,
  flags.mapped_enabled as car_multi_city_mapped_enabled,
  flags.threshold_enabled as car_threshold_daily_rates_enabled,
  columns.offer_columns_valid,
  columns.tier_columns_valid,
  columns.threshold_flag_column_valid,
  columns.max_rental_contract_valid,
  constraints.constraints_valid,
  triggers.triggers_valid,
  functions.functions_valid,
  policies.publication_policy_valid,
  policies.tier_rls_enabled,
  policies.tier_policies_valid,
  payment.partial_payment_contract_valid,
  (
    columns.offer_columns_valid
    and columns.tier_columns_valid
    and columns.threshold_flag_column_valid
    and columns.max_rental_contract_valid
    and constraints.constraints_valid
    and triggers.triggers_valid
    and functions.functions_valid
    and policies.publication_policy_valid
    and policies.tier_rls_enabled
    and policies.tier_policies_valid
    and payment.partial_payment_contract_valid
    and kinds.required_kind_count = 5
    and kinds.required_kinds_active
    and offer.legacy_strategy_count = offer.offer_count
    and offer.threshold_strategy_count = 0
    and offer.mapped_offer_count = 0
    and tier.tier_count = 0
    and flags.mapped_enabled is false
    and flags.threshold_enabled is false
  ) as stage3ab_foundation_safe
from offer_state offer
cross join tier_state tier
cross join availability_state availability
cross join flag_state flags
cross join kind_state kinds
cross join column_state columns
cross join constraint_state constraints
cross join trigger_state triggers
cross join function_state functions
cross join policy_state policies
cross join payment_function_state payment;
