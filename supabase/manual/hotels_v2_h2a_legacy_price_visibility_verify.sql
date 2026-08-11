-- Hotels 2.0 H2A legacy-price visibility verification (READ ONLY).
-- Run after 20260811220000_hotels_v2_h2a_legacy_price_visibility.sql.

with
expected_property_ids(id) as (
  values
    ('9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
    ('f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid)
),
function_state as (
  select
    procedure_info.oid,
    procedure_info.prosecdef,
    procedure_info.provolatile,
    procedure_info.proconfig,
    pg_get_functiondef(procedure_info.oid) as definition
  from pg_proc procedure_info
  where procedure_info.oid = to_regprocedure(
    'public.hotel_v2_admin_get_property_list()'
  )
),
function_contract as (
  select
    count(*) = 1 as exact_signature,
    bool_and(prosecdef) as security_definer,
    bool_and(provolatile = 's') as stable,
    bool_and(
      'search_path=pg_catalog, public, auth'
      = any(coalesce(proconfig, '{}'::text[]))
    ) as safe_search_path,
    bool_and(position('''legacy_configuration''' in definition) > 0)
      as legacy_configuration_present,
    bool_and(position('when hotel.architecture_version = ''legacy''' in definition) > 0)
      as legacy_only,
    bool_and(position('''pricing_model'', hotel.pricing_model' in definition) > 0)
      as pricing_model_present,
    bool_and(position('''pricing_tiers'', coalesce' in definition) > 0)
      as pricing_tiers_present,
    bool_and(position('''room_types'', coalesce' in definition) > 0)
      as legacy_room_types_present,
    bool_and(position('''pricing_extras'', coalesce' in definition) > 0)
      as pricing_extras_present,
    bool_and(position('''max_persons'', hotel.max_persons' in definition) > 0)
      as max_persons_present,
    bool_and(position('''price_from''' in definition) > 0)
      and bool_and(position('public.hotel_room_rates' in definition) > 0)
      as normalized_price_from_preserved,
    bool_and(position('assignment.is_active' in definition) = 0)
      and bool_and(position('assignment.resource_type = ''hotels''' in definition) > 0)
      and bool_and(position('assignment.resource_id = hotel.id' in definition) > 0)
      as partner_row_existence_preserved,
    has_function_privilege(
      'authenticated',
      'public.hotel_v2_admin_get_property_list()',
      'EXECUTE'
    )
      and not has_function_privilege(
        'anon',
        'public.hotel_v2_admin_get_property_list()',
        'EXECUTE'
      )
      and not has_function_privilege(
        'service_role',
        'public.hotel_v2_admin_get_property_list()',
        'EXECUTE'
      ) as exact_grants
  from function_state
),
property_state as (
  select
    count(*)::integer as property_count,
    count(*) filter (where architecture_version = 'legacy')::integer as legacy_count,
    count(*) filter (where architecture_version = 'rooms_v2')::integer as rooms_v2_count,
    coalesce(array_agg(id order by id), '{}'::uuid[]) as property_ids,
    md5(coalesce(string_agg(
      (
        to_jsonb(hotel)
        - 'architecture_version'
        - 'timezone'
        - 'currency'
        - 'booking_mode'
        - 'check_in_from'
        - 'check_out_until'
      )::text,
      '|' order by id
    ), '')) as protected_fingerprint
  from public.hotels hotel
),
legacy_pricing_state as (
  select
    count(*) filter (
      where hotel.id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and hotel.pricing_model = 'tiered_by_nights'
        and jsonb_array_length(coalesce(hotel.pricing_tiers->'rules', '[]'::jsonb)) = 63
        and md5(hotel.pricing_tiers::text) = '7208ab4ecc0e47abd64d87ca1ac53a03'
        and jsonb_array_length(coalesce(hotel.room_types, '[]'::jsonb)) = 0
        and hotel.max_persons = 8
    ) = 1 as seven_arches_contract,
    count(*) filter (
      where hotel.id = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid
        and hotel.pricing_model = 'flat_per_night'
        and jsonb_array_length(coalesce(hotel.pricing_tiers->'rules', '[]'::jsonb)) = 1
        and md5(hotel.pricing_tiers::text) = 'e272ec40b78069a1e2e49ac6b0956f11'
        and jsonb_array_length(coalesce(hotel.room_types, '[]'::jsonb)) = 0
        and hotel.max_persons = 2
    ) = 1 as rgb_cabins_contract,
    coalesce(jsonb_object_agg(
      hotel.id::text,
      jsonb_build_object(
        'pricing_model', hotel.pricing_model,
        'pricing_rule_count', jsonb_array_length(
          coalesce(hotel.pricing_tiers->'rules', '[]'::jsonb)
        ),
        'legacy_room_count', jsonb_array_length(
          coalesce(hotel.room_types, '[]'::jsonb)
        ),
        'currency', coalesce(hotel.pricing_tiers->>'currency', hotel.currency)
      )
    ), '{}'::jsonb) as exact_legacy_pricing
  from public.hotels hotel
  where hotel.id in (select id from expected_property_ids)
),
normalized_state as (
  select
    (select count(*)::integer from public.hotel_room_types) as room_types,
    (select count(*)::integer from public.hotel_units) as units,
    (select count(*)::integer from public.hotel_rate_plans) as rate_plans,
    (select count(*)::integer from public.hotel_room_rates) as room_rates,
    (select count(*)::integer from public.hotel_rate_rules) as rate_rules,
    (select count(*)::integer from public.hotel_daily_inventory) as daily_inventory,
    (select count(*)::integer from public.hotel_daily_rates) as daily_rates
),
flag_state as (
  select
    count(*) = 1
      and count(*) filter (
        where id = 1
          and not hotel_rooms_v2_enabled
          and not hotel_external_sync_enabled
          and not hotel_instant_booking_enabled
          and not hotel_stripe_connect_enabled
      ) = 1 as all_off
  from public.site_settings
),
booking_state as (
  select
    count(*)::integer as booking_count,
    md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), ''))
      as fingerprint
  from public.hotel_bookings booking
),
fulfillment_state as (
  select
    count(*)::integer as fulfillment_count,
    md5(coalesce(string_agg(to_jsonb(fulfillment)::text, '|' order by fulfillment.id), ''))
      as fingerprint
  from public.partner_service_fulfillments fulfillment
  where fulfillment.resource_type = 'hotels'
),
summary as (
  select
    functions.*,
    properties.property_count,
    properties.legacy_count,
    properties.rooms_v2_count,
    properties.property_ids,
    properties.protected_fingerprint,
    pricing.seven_arches_contract,
    pricing.rgb_cabins_contract,
    pricing.exact_legacy_pricing,
    normalized.room_types as normalized_room_types,
    normalized.units as normalized_units,
    normalized.rate_plans as normalized_rate_plans,
    normalized.room_rates as normalized_room_rates,
    normalized.rate_rules as normalized_rate_rules,
    normalized.daily_inventory as normalized_daily_inventory,
    normalized.daily_rates as normalized_daily_rates,
    flags.all_off as hotels_v2_flags_off,
    bookings.booking_count,
    bookings.fingerprint as booking_fingerprint,
    fulfillments.fulfillment_count,
    fulfillments.fingerprint as fulfillment_fingerprint
  from function_contract functions
  cross join property_state properties
  cross join legacy_pricing_state pricing
  cross join normalized_state normalized
  cross join flag_state flags
  cross join booking_state bookings
  cross join fulfillment_state fulfillments
)
select
  summary.*,
  (
    exact_signature
    and security_definer
    and stable
    and safe_search_path
    and legacy_configuration_present
    and legacy_only
    and pricing_model_present
    and pricing_tiers_present
    and legacy_room_types_present
    and pricing_extras_present
    and max_persons_present
    and normalized_price_from_preserved
    and partner_row_existence_preserved
    and exact_grants
    and property_count = 2
    and legacy_count = 2
    and rooms_v2_count = 0
    and property_ids = array(
      select id from expected_property_ids order by id
    )
    and protected_fingerprint = 'b3e3a9c5bda72a83e49d3095d175ab9c'
    and seven_arches_contract
    and rgb_cabins_contract
    and normalized_room_types = 0
    and normalized_units = 0
    and normalized_rate_plans = 0
    and normalized_room_rates = 0
    and normalized_rate_rules = 0
    and normalized_daily_inventory = 0
    and normalized_daily_rates = 0
    and hotels_v2_flags_off
    and booking_count = 3
    and booking_fingerprint = 'fb5a4c508b0df32afbffe5b1594c7a50'
    and fulfillment_count = 5
    and fulfillment_fingerprint = '1e01541853d87d26adccb8172074934b'
  ) as hotels_v2_h2a_legacy_price_visibility_safe
from summary;
