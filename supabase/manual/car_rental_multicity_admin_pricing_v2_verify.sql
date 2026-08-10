-- car-rental-multicity-admin-pricing-v2-verify-v1
-- READ ONLY: one summary row. Intended for manual verification after the V2 fee migration.
with
expected_columns(name, data_type, nullable, default_fragment) as (
  values
    ('fee_mode'::text, 'text'::text, false, '''inherit'''),
    ('fee_per_direction', 'numeric', true, null),
    ('fee_note', 'text', true, null)
),
column_checks as (
  select
    expected.name,
    exists (
      select 1
      from information_schema.columns column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'car_offer_city_availability'
        and column_info.column_name = expected.name
        and column_info.data_type = expected.data_type
        and (column_info.is_nullable = 'YES') = expected.nullable
        and (
          expected.default_fragment is null
          or coalesce(column_info.column_default, '') like '%' || expected.default_fragment || '%'
        )
    ) as pass
  from expected_columns expected
),
constraint_checks as (
  select count(*) filter (where constraint_name in (
    'car_offer_city_availability_fee_mode_check',
    'car_offer_city_availability_fee_contract_check',
    'car_offer_city_availability_fee_note_check',
    'car_pricing_profile_cities_legacy_key_check'
  )) = 4 as pass
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name in ('car_offer_city_availability', 'car_pricing_profile_cities')
),
offer_contract as (
  select
    count(*)::bigint as offer_count,
    count(*) filter (where availability_mode = 'mapped')::bigint as mapped_offers,
    md5(coalesce(string_agg(
      jsonb_build_array(
        co.id,
        co.price_per_day,
        co.price_3days,
        co.price_4_6days,
        co.price_7_10days,
        co.price_10plus_days,
        co.currency,
        co.location,
        co.owner_partner_id,
        co.deposit_amount,
        co.insurance_per_day,
        co.young_driver_fee,
        co.young_driver_cost,
        co.stock_count,
        co.north_allowed,
        co.is_available,
        co.is_published,
        co.submission_status
      )::text,
      E'\n' order by co.id
    ), '')) as protected_fingerprint
  from public.car_offers co
),
availability_contract as (
  select
    count(*)::bigint as availability_rows,
    count(*) filter (where pickup_enabled and return_enabled and is_active)::bigint as paired_active_rows,
    count(*) filter (where fee_mode = 'inherit' and fee_per_direction is null)::bigint as inherited_rows,
    count(*) filter (where fee_mode = 'override')::bigint as override_rows
  from public.car_offer_city_availability
),
runtime_contract as (
  select coalesce(bool_or(car_multi_city_mapped_enabled), false) as mapped_flag
  from public.site_settings
),
city_default_contract as (
  select coalesce(column_default, '') in ('false', 'false::boolean') as new_city_defaults_inactive
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'car_rental_cities'
    and column_name = 'is_active'
),
profile_contract as (
  select
    count(*) filter (where profile.code = 'paphos') = 1
    and count(*) filter (where profile.code = 'paphos' and city.code = 'paphos' and mapping.legacy_pricing_city_key = 'paphos') = 1
    as paphos_local_only
  from public.car_pricing_profile_cities mapping
  join public.car_pricing_profiles profile on profile.id = mapping.pricing_profile_id
  join public.car_rental_cities city on city.id = mapping.city_id
  where profile.code = 'paphos'
)
select
  'car-rental-multicity-admin-pricing-v2-verify-v1'::text as verify_version,
  now() as verified_at,
  offer.offer_count,
  offer.mapped_offers,
  offer.protected_fingerprint,
  availability.availability_rows,
  availability.paired_active_rows,
  availability.inherited_rows,
  availability.override_rows,
  runtime.mapped_flag as car_multi_city_mapped_enabled,
  city_default.new_city_defaults_inactive,
  profile.paphos_local_only,
  (select bool_and(pass) from column_checks) as columns_valid,
  constraints.pass as constraints_valid,
  (
    offer.offer_count = 27
    and offer.mapped_offers = 0
    and offer.protected_fingerprint = 'ec3e29a35f249c92279d7b15f400ef0f'
    and availability.availability_rows = 12
    and availability.paired_active_rows = 12
    and availability.inherited_rows = 12
    and availability.override_rows = 0
    and runtime.mapped_flag is false
    and city_default.new_city_defaults_inactive
    and profile.paphos_local_only
    and (select bool_and(pass) from column_checks)
    and constraints.pass
  ) as admin_pricing_v2_safe
from offer_contract offer
cross join availability_contract availability
cross join runtime_contract runtime
cross join city_default_contract city_default
cross join profile_contract profile
cross join constraint_checks constraints;
