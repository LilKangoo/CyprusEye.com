-- Car Rental Multi-City Stage 2B foundation verify.
-- Run in the same isolated database session as the foundation migration.
-- The migration captures the baseline fingerprint and exact offer IDs in session settings.

with expected_cities(code) as (
  values
    ('larnaca'::text),
    ('nicosia'::text),
    ('ayia-napa'::text),
    ('protaras'::text),
    ('limassol'::text),
    ('paphos'::text)
),
expected_profiles(code, calculator_key, legacy_booking_location) as (
  values
    ('larnaca'::text, 'larnaca'::text, 'larnaca'::text),
    ('paphos'::text, 'paphos'::text, 'paphos'::text)
),
expected_vehicle_kinds(code) as (
  values
    ('car'::text),
    ('quad'::text),
    ('buggy'::text),
    ('scooter'::text),
    ('bicycle'::text)
),
expected_profile_cities(profile_code, city_code, legacy_key) as (
  values
    ('larnaca'::text, 'larnaca'::text, 'larnaca'::text),
    ('larnaca'::text, 'nicosia'::text, 'nicosia'::text),
    ('larnaca'::text, 'ayia-napa'::text, 'ayia-napa'::text),
    ('larnaca'::text, 'protaras'::text, 'protaras'::text),
    ('larnaca'::text, 'limassol'::text, 'limassol'::text),
    ('larnaca'::text, 'paphos'::text, 'paphos'::text),
    ('paphos'::text, 'paphos'::text, 'paphos'::text)
),
expected_constraints(name) as (
  values
    ('car_rental_cities_pkey'::text),
    ('car_rental_cities_code_key'::text),
    ('car_rental_cities_code_format_check'::text),
    ('car_rental_cities_name_i18n_check'::text),
    ('car_rental_cities_sort_order_check'::text),
    ('car_pricing_profiles_pkey'::text),
    ('car_pricing_profiles_code_key'::text),
    ('car_pricing_profiles_code_format_check'::text),
    ('car_pricing_profiles_calculator_key_check'::text),
    ('car_pricing_profiles_legacy_location_check'::text),
    ('car_pricing_profiles_calculator_location_check'::text),
    ('car_vehicle_kinds_pkey'::text),
    ('car_vehicle_kinds_code_key'::text),
    ('car_vehicle_kinds_code_format_check'::text),
    ('car_vehicle_kinds_name_i18n_check'::text),
    ('car_vehicle_kinds_sort_order_check'::text),
    ('car_pricing_profile_cities_pkey'::text),
    ('car_pricing_profile_cities_profile_fkey'::text),
    ('car_pricing_profile_cities_city_fkey'::text),
    ('car_pricing_profile_cities_profile_key_unique'::text),
    ('car_pricing_profile_cities_legacy_key_check'::text),
    ('car_pricing_profile_cities_active_support_check'::text),
    ('car_offer_city_availability_pkey'::text),
    ('car_offer_city_availability_offer_fkey'::text),
    ('car_offer_city_availability_city_fkey'::text),
    ('car_offer_city_availability_active_direction_check'::text),
    ('car_offers_pricing_profile_id_fkey'::text),
    ('car_offers_vehicle_kind_id_fkey'::text),
    ('car_offers_availability_mode_check'::text)
),
expected_indexes(name) as (
  values
    ('car_rental_cities_active_sort_idx'::text),
    ('car_pricing_profiles_active_code_idx'::text),
    ('car_pricing_profiles_legacy_location_idx'::text),
    ('car_vehicle_kinds_active_sort_idx'::text),
    ('car_pricing_profile_cities_city_active_idx'::text),
    ('car_pricing_profile_cities_profile_active_idx'::text),
    ('car_offer_city_availability_city_active_idx'::text),
    ('car_offer_city_availability_offer_active_idx'::text),
    ('car_offers_pricing_profile_idx'::text),
    ('car_offers_availability_mode_idx'::text),
    ('car_offers_vehicle_kind_idx'::text)
),
expected_triggers(name) as (
  values
    ('car_rental_cities_set_updated_at'::text),
    ('car_pricing_profiles_set_updated_at'::text),
    ('car_pricing_profile_cities_set_updated_at'::text),
    ('car_offer_city_availability_set_updated_at'::text),
    ('car_vehicle_kinds_set_updated_at'::text),
    ('car_offers_multicity_validate'::text),
    ('car_pricing_profile_cities_validate'::text),
    ('car_pricing_profile_cities_protect'::text),
    ('car_offer_city_availability_validate'::text),
    ('car_offer_city_availability_complete'::text),
    ('car_pricing_profiles_protect'::text),
    ('car_rental_cities_protect'::text)
),
expected_policies(table_name, policy_name) as (
  values
    ('car_rental_cities'::text, 'car_rental_cities_public_read'::text),
    ('car_rental_cities'::text, 'car_rental_cities_admin_all'::text),
    ('car_pricing_profiles'::text, 'car_pricing_profiles_public_read'::text),
    ('car_pricing_profiles'::text, 'car_pricing_profiles_admin_all'::text),
    ('car_pricing_profile_cities'::text, 'car_pricing_profile_cities_public_read'::text),
    ('car_pricing_profile_cities'::text, 'car_pricing_profile_cities_admin_all'::text),
    ('car_offer_city_availability'::text, 'car_offer_city_availability_public_read'::text),
    ('car_offer_city_availability'::text, 'car_offer_city_availability_admin_all'::text),
    ('car_vehicle_kinds'::text, 'car_vehicle_kinds_public_read'::text),
    ('car_vehicle_kinds'::text, 'car_vehicle_kinds_admin_all'::text)
),
expected_functions(name) as (
  values
    ('car_multicity_set_updated_at'::text),
    ('car_multicity_validate_offer'::text),
    ('car_multicity_validate_profile_city'::text),
    ('car_multicity_protect_profile_city'::text),
    ('car_multicity_validate_availability'::text),
    ('car_multicity_assert_offer_availability_complete'::text),
    ('car_multicity_protect_profile'::text),
    ('car_multicity_protect_city'::text)
),
expected_added_columns(table_name, column_name, data_type, is_nullable, default_fragment) as (
  values
    ('car_offers'::text, 'pricing_profile_id'::text, 'uuid'::text, 'YES'::text, null::text),
    ('car_offers'::text, 'availability_mode'::text, 'text'::text, 'NO'::text, '''legacy'''::text),
    ('car_offers'::text, 'vehicle_kind_id'::text, 'uuid'::text, 'NO'::text, 'ca220001-0000-4000-8000-000000000001'::text),
    ('site_settings'::text, 'car_multi_city_mapped_enabled'::text, 'boolean'::text, 'NO'::text, 'false'::text),
    ('car_rental_cities'::text, 'name_i18n'::text, 'jsonb'::text, 'NO'::text, null::text),
    ('car_vehicle_kinds'::text, 'name_i18n'::text, 'jsonb'::text, 'NO'::text, null::text)
),
city_state as (
  select
    count(*)::integer as actual_count,
    count(*) filter (where city.is_active)::integer as active_count,
    count(*) filter (where expected.code is null)::integer as unexpected_count,
    count(*) filter (where jsonb_typeof(city.name_i18n) <> 'object')::integer as invalid_name_count
  from public.car_rental_cities city
  left join expected_cities expected on expected.code = city.code
),
profile_state as (
  select
    count(*)::integer as actual_count,
    count(*) filter (where profile.is_active)::integer as active_count,
    count(*) filter (
      where expected.code is null
         or profile.calculator_key <> expected.calculator_key
         or profile.legacy_booking_location <> expected.legacy_booking_location
    )::integer as invalid_count
  from public.car_pricing_profiles profile
  left join expected_profiles expected on expected.code = profile.code
),
vehicle_kind_state as (
  select
    count(*)::integer as actual_count,
    count(*) filter (where kind.is_active)::integer as active_count,
    count(*) filter (where expected.code is null)::integer as unexpected_count
  from public.car_vehicle_kinds kind
  left join expected_vehicle_kinds expected on expected.code = kind.code
),
profile_city_state as (
  select
    count(*)::integer as actual_count,
    count(*) filter (
      where expected.profile_code is null
         or mapping.pickup_supported is not true
         or mapping.return_supported is not true
         or mapping.is_active is not true
    )::integer as invalid_count,
    count(*) filter (
      where profile.code = 'paphos'
        and (city.code <> 'paphos' or mapping.legacy_pricing_city_key <> 'paphos')
    )::integer as paphos_cross_city_count
  from public.car_pricing_profile_cities mapping
  join public.car_pricing_profiles profile on profile.id = mapping.pricing_profile_id
  join public.car_rental_cities city on city.id = mapping.city_id
  left join expected_profile_cities expected
    on expected.profile_code = profile.code
   and expected.city_code = city.code
   and expected.legacy_key = mapping.legacy_pricing_city_key
),
offer_state as (
  select
    count(*)::bigint as actual_count,
    count(*) filter (where offer.availability_mode = 'legacy')::bigint as legacy_count,
    count(*) filter (where offer.availability_mode = 'mapped')::bigint as mapped_count,
    count(*) filter (
      where offer.pricing_profile_id is null
         or profile.legacy_booking_location <> lower(btrim(offer.location))
    )::bigint as profile_mismatch_count,
    count(*) filter (where kind.code <> 'car')::bigint as non_car_kind_count,
    coalesce(string_agg(offer.id::text, ',' order by offer.id), '') as current_offer_ids,
    md5(coalesce(
      string_agg(
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
      ),
      ''
    )) as current_fingerprint
  from public.car_offers offer
  left join public.car_pricing_profiles profile on profile.id = offer.pricing_profile_id
  left join public.car_vehicle_kinds kind on kind.id = offer.vehicle_kind_id
),
availability_state as (
  select
    count(*)::bigint as actual_count,
    count(*) filter (where availability.is_active)::bigint as active_count,
    count(*) filter (
      where availability.is_active
        and (
          profile.id is null
          or profile.is_active is not true
          or city.is_active is not true
          or mapping.is_active is not true
          or (availability.pickup_enabled and mapping.pickup_supported is not true)
          or (availability.return_enabled and mapping.return_supported is not true)
        )
    )::bigint as unsupported_active_count
  from public.car_offer_city_availability availability
  join public.car_offers offer on offer.id = availability.offer_id
  left join public.car_pricing_profiles profile on profile.id = offer.pricing_profile_id
  left join public.car_rental_cities city on city.id = availability.city_id
  left join public.car_pricing_profile_cities mapping
    on mapping.pricing_profile_id = offer.pricing_profile_id
   and mapping.city_id = availability.city_id
),
mapped_completeness as (
  select count(*)::bigint as incomplete_count
  from public.car_offers offer
  where offer.availability_mode = 'mapped'
    and (
      not exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_pricing_profile_cities mapping
          on mapping.pricing_profile_id = offer.pricing_profile_id
         and mapping.city_id = availability.city_id
         and mapping.is_active
         and mapping.pickup_supported
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.is_active
        where availability.offer_id = offer.id
          and availability.is_active
          and availability.pickup_enabled
      )
      or not exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_pricing_profile_cities mapping
          on mapping.pricing_profile_id = offer.pricing_profile_id
         and mapping.city_id = availability.city_id
         and mapping.is_active
         and mapping.return_supported
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.is_active
        where availability.offer_id = offer.id
          and availability.is_active
          and availability.return_enabled
      )
    )
),
feature_flag_state as (
  select
    count(*) filter (
      where settings.id = 1
        and settings.car_multi_city_mapped_enabled is false
    )::integer as disabled_primary_row_count,
    count(*) filter (
      where settings.car_multi_city_mapped_enabled is true
    )::integer as enabled_row_count
  from public.site_settings settings
),
added_column_state as (
  select
    count(*)::integer as expected_count,
    count(*) filter (
      where column_row.column_name is not null
        and column_row.data_type = expected.data_type
        and column_row.is_nullable = expected.is_nullable
        and (
          expected.default_fragment is null
          or coalesce(column_row.column_default, '') like '%' || expected.default_fragment || '%'
        )
    )::integer as valid_count,
    coalesce(
      jsonb_agg(
        expected.table_name || '.' || expected.column_name
        order by expected.table_name, expected.column_name
      ) filter (
        where column_row.column_name is null
           or column_row.data_type <> expected.data_type
           or column_row.is_nullable <> expected.is_nullable
           or (
             expected.default_fragment is not null
             and coalesce(column_row.column_default, '') not like '%' || expected.default_fragment || '%'
           )
      ),
      '[]'::jsonb
    ) as invalid_or_missing
  from expected_added_columns expected
  left join information_schema.columns column_row
    on column_row.table_schema = 'public'
   and column_row.table_name = expected.table_name
   and column_row.column_name = expected.column_name
),
rls_state as (
  select
    count(*)::integer as table_count,
    count(*) filter (where class.relrowsecurity)::integer as enabled_count
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname in (
      'car_rental_cities',
      'car_pricing_profiles',
      'car_pricing_profile_cities',
      'car_offer_city_availability',
      'car_vehicle_kinds'
    )
),
constraint_state as (
  select
    count(*)::integer as expected_count,
    count(*) filter (where constraint_row.oid is not null)::integer as present_count,
    coalesce(
      jsonb_agg(expected.name order by expected.name) filter (where constraint_row.oid is null),
      '[]'::jsonb
    ) as missing
  from expected_constraints expected
  left join pg_constraint constraint_row
    on constraint_row.conname = expected.name
   and constraint_row.connamespace = 'public'::regnamespace
),
index_state as (
  select
    count(*)::integer as expected_count,
    count(*) filter (where namespace.oid is not null)::integer as present_count,
    coalesce(
      jsonb_agg(expected.name order by expected.name) filter (where namespace.oid is null),
      '[]'::jsonb
    ) as missing
  from expected_indexes expected
  left join pg_class index_class
    on index_class.relname = expected.name
   and index_class.relkind = 'i'
  left join pg_namespace namespace
    on namespace.oid = index_class.relnamespace
   and namespace.nspname = 'public'
),
trigger_state as (
  select
    count(*)::integer as expected_count,
    count(*) filter (where trigger_namespace.oid is not null)::integer as present_count,
    coalesce(
      jsonb_agg(expected.name order by expected.name) filter (where trigger_namespace.oid is null),
      '[]'::jsonb
    ) as missing
  from expected_triggers expected
  left join pg_trigger trigger_row
    on trigger_row.tgname = expected.name
   and not trigger_row.tgisinternal
  left join pg_class trigger_table
    on trigger_table.oid = trigger_row.tgrelid
  left join pg_namespace trigger_namespace
    on trigger_namespace.oid = trigger_table.relnamespace
   and trigger_namespace.nspname = 'public'
),
policy_state as (
  select
    count(*)::integer as expected_count,
    count(*) filter (where policy.policyname is not null)::integer as present_count,
    count(*) filter (
      where expected.policy_name like '%_admin_all'
        and coalesce(policy.qual, '') not like '%is_current_user_admin%'
    )::integer as unsafe_admin_policy_count,
    coalesce(
      jsonb_agg(expected.policy_name order by expected.policy_name) filter (where policy.policyname is null),
      '[]'::jsonb
    ) as missing
  from expected_policies expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
),
function_rows as (
  select
    expected.name,
    procedure.oid,
    procedure.prosecdef,
    procedure.proconfig,
    procedure.proacl,
    procedure.proowner
  from expected_functions expected
  left join pg_proc procedure
    on procedure.proname = expected.name
   and procedure.pronamespace = 'public'::regnamespace
   and pg_get_function_identity_arguments(procedure.oid) = ''
),
function_state as (
  select
    count(*)::integer as expected_count,
    count(*) filter (where function_rows.oid is not null)::integer as present_count,
    count(*) filter (where function_rows.oid is not null and function_rows.prosecdef)::integer as security_definer_count,
    count(*) filter (
      where function_rows.oid is not null
        and array_to_string(function_rows.proconfig, ',') like '%search_path=pg_catalog, public%'
    )::integer as safe_search_path_count,
    count(*) filter (
      where function_rows.oid is not null
        and exists (
          select 1
          from aclexplode(coalesce(function_rows.proacl, acldefault('f', function_rows.proowner))) acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
    )::integer as public_execute_count,
    count(*) filter (
      where function_rows.oid is not null
        and (
          has_function_privilege('anon', function_rows.oid, 'EXECUTE')
          or has_function_privilege('authenticated', function_rows.oid, 'EXECUTE')
        )
    )::integer as client_execute_count,
    count(*) filter (
      where function_rows.oid is not null
        and has_function_privilege('service_role', function_rows.oid, 'EXECUTE')
    )::integer as service_execute_count
  from function_rows
),
table_privilege_state as (
  select
    count(*)::integer as table_count,
    count(*) filter (
      where has_table_privilege('anon', class.oid, 'SELECT')
        and has_table_privilege('authenticated', class.oid, 'SELECT')
        and has_table_privilege('authenticated', class.oid, 'INSERT')
        and has_table_privilege('authenticated', class.oid, 'UPDATE')
        and has_table_privilege('authenticated', class.oid, 'DELETE')
        and has_table_privilege('service_role', class.oid, 'SELECT')
        and has_table_privilege('service_role', class.oid, 'INSERT')
        and has_table_privilege('service_role', class.oid, 'UPDATE')
        and has_table_privilege('service_role', class.oid, 'DELETE')
    )::integer as expected_privilege_count
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname in (
      'car_rental_cities',
      'car_pricing_profiles',
      'car_pricing_profile_cities',
      'car_offer_city_availability',
      'car_vehicle_kinds'
    )
),
baseline as (
  select
    nullif(current_setting('cypruseye.car_multicity_stage2b_baseline_fingerprint', true), '') as fingerprint,
    nullif(current_setting('cypruseye.car_multicity_stage2b_baseline_offer_ids', true), '') as offer_ids,
    nullif(
      current_setting('cypruseye.car_multicity_stage2b_baseline_offer_count', true),
      ''
    )::bigint as offer_count
),
summary as (
  select
    city.actual_count = 6
      and city.active_count = 6
      and city.unexpected_count = 0
      and city.invalid_name_count = 0 as cities_ok,
    profile.actual_count = 2
      and profile.active_count = 2
      and profile.invalid_count = 0 as profiles_ok,
    profile_city.actual_count = 7
      and profile_city.invalid_count = 0 as profile_cities_ok,
    profile_city.paphos_cross_city_count = 0 as paphos_profile_local_only,
    kind.actual_count = 5
      and kind.active_count = 5
      and kind.unexpected_count = 0 as vehicle_kinds_ok,
    offers.mapped_count = 0 as no_mapped_offers,
    offers.actual_count = offers.legacy_count as all_existing_offers_legacy,
    offers.profile_mismatch_count = 0 as all_offer_profiles_match_location,
    offers.non_car_kind_count = 0 as all_existing_offers_are_car_kind,
    availability.actual_count = 0 as no_seeded_offer_availability,
    availability.unsupported_active_count = 0 as no_active_unsupported_availability,
    mapped.incomplete_count = 0 as no_incomplete_mapped_offers,
    flag.disabled_primary_row_count = 1
      and flag.enabled_row_count = 0 as global_feature_flag_false,
    columns.valid_count = columns.expected_count as added_columns_ok,
    rls.table_count = 5 and rls.enabled_count = 5 as rls_enabled,
    constraints.present_count = constraints.expected_count as expected_constraints_present,
    indexes.present_count = indexes.expected_count as expected_indexes_present,
    triggers.present_count = triggers.expected_count as expected_triggers_present,
    policies.present_count = policies.expected_count
      and policies.unsafe_admin_policy_count = 0 as expected_policies_present,
    functions.present_count = functions.expected_count
      and functions.security_definer_count = functions.expected_count
      and functions.safe_search_path_count = functions.expected_count
      and functions.public_execute_count = 0
      and functions.client_execute_count = 0
      and functions.service_execute_count = functions.expected_count as validator_security_ok,
    privileges.table_count = 5
      and privileges.expected_privilege_count = 5 as table_privileges_ok,
    baseline.fingerprint is not null
      and baseline.fingerprint = offers.current_fingerprint as protected_fingerprint_unchanged,
    baseline.offer_ids is not null
      and baseline.offer_ids = offers.current_offer_ids
      and baseline.offer_count = offers.actual_count as exact_offer_ids_unchanged,
    baseline.fingerprint as protected_fingerprint_before,
    offers.current_fingerprint as protected_fingerprint_after,
    baseline.offer_count as offer_count_before,
    offers.actual_count as offer_count_after,
    baseline.offer_ids as exact_offer_ids_before,
    offers.current_offer_ids as exact_offer_ids_after,
    constraints.missing as missing_constraints,
    indexes.missing as missing_indexes,
    triggers.missing as missing_triggers,
    policies.missing as missing_policies,
    columns.invalid_or_missing as invalid_or_missing_columns
  from city_state city
  cross join profile_state profile
  cross join profile_city_state profile_city
  cross join vehicle_kind_state kind
  cross join offer_state offers
  cross join availability_state availability
  cross join mapped_completeness mapped
  cross join feature_flag_state flag
  cross join added_column_state columns
  cross join rls_state rls
  cross join constraint_state constraints
  cross join index_state indexes
  cross join trigger_state triggers
  cross join policy_state policies
  cross join function_state functions
  cross join table_privilege_state privileges
  cross join baseline
)
select
  'car-rental-multicity-stage2b-foundation-verify-v1'::text as verify_version,
  now() as verified_at,
  summary.*,
  (
    summary.cities_ok
    and summary.profiles_ok
    and summary.profile_cities_ok
    and summary.paphos_profile_local_only
    and summary.vehicle_kinds_ok
    and summary.no_mapped_offers
    and summary.all_existing_offers_legacy
    and summary.all_offer_profiles_match_location
    and summary.all_existing_offers_are_car_kind
    and summary.no_seeded_offer_availability
    and summary.no_active_unsupported_availability
    and summary.no_incomplete_mapped_offers
    and summary.global_feature_flag_false
    and summary.added_columns_ok
    and summary.rls_enabled
    and summary.expected_constraints_present
    and summary.expected_indexes_present
    and summary.expected_triggers_present
    and summary.expected_policies_present
    and summary.validator_security_ok
    and summary.table_privileges_ok
    and summary.protected_fingerprint_unchanged
    and summary.exact_offer_ids_unchanged
  ) as stage2b_foundation_safe
from summary;
