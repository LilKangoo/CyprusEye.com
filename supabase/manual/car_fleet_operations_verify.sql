-- READ-ONLY verification for 20260811120000_car_fleet_operations.sql.
-- Expected final row: car_fleet_operations_safe = true.

with function_contract as (
  select
    to_regprocedure(
      'public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)'
    ) is not null as bulk_rpc_present,
    to_regprocedure(
      'public.car_mapped_legacy_offer_route_is_booking_eligible(uuid,text,text)'
    ) is not null as mapped_legacy_booking_guard_present,
    to_regprocedure(
      'public.car_multicity_directional_availability_is_valid(text,text,uuid,uuid,text,boolean,text,numeric)'
    ) is not null as directional_validator_present,
    to_regprocedure(
      'public.car_fleet_apply_reviewed_operations_internal(jsonb)'
    ) is not null as internal_helper_present
), source_contract as (
  select
    position(
      'car_mapped_legacy_offer_route_is_booking_eligible'
      in coalesce(pg_get_functiondef(
        to_regprocedure('public.car_threshold_booking_public_eligibility_guard()')
      ), '')
    ) > 0 as booking_guard_routes_mapped_legacy,
    position(
      'mapping.pickup_supported'
      in coalesce(pg_get_functiondef(to_regprocedure(
        'public.car_multicity_directional_availability_is_valid(text,text,uuid,uuid,text,boolean,text,numeric)'
      )), '')
    ) = 0 as profile_pickup_flag_decoupled,
    position(
      'mapping.return_supported'
      in coalesce(pg_get_functiondef(to_regprocedure(
        'public.car_multicity_directional_availability_is_valid(text,text,uuid,uuid,text,boolean,text,numeric)'
      )), '')
    ) = 0 as profile_return_flag_decoupled,
    position(
      'new.pickup_supported'
      in coalesce(pg_get_functiondef(
        to_regprocedure('public.car_multicity_protect_profile_city()')
      ), '')
    ) = 0 as profile_protector_pickup_decoupled,
    position(
      'new.return_supported'
      in coalesce(pg_get_functiondef(
        to_regprocedure('public.car_multicity_protect_profile_city()')
      ), '')
    ) = 0 as profile_protector_return_decoupled
), grant_contract as (
  select
    not has_function_privilege(
      'anon',
      'public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)',
      'EXECUTE'
    ) as anon_bulk_denied,
    has_function_privilege(
      'authenticated',
      'public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)',
      'EXECUTE'
    ) as authenticated_bulk_granted,
    has_function_privilege(
      'service_role',
      'public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)',
      'EXECUTE'
    ) as service_bulk_granted,
    not has_function_privilege(
      'authenticated',
      'public.car_fleet_apply_reviewed_operations_internal(jsonb)',
      'EXECUTE'
    ) as internal_helper_not_exposed
), trigger_contract as (
  select exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.car_bookings'::regclass
      and trigger_row.tgname = 'car_bookings_00_threshold_public_eligibility'
      and not trigger_row.tgisinternal
  ) as booking_guard_trigger_present
), data_contract as (
  select
    (select count(*) from public.car_offers) as offer_count,
    (select count(*) from public.car_offers
      where pricing_strategy = 'legacy_compat' and availability_mode = 'legacy'
    ) as legacy_pricing_legacy_availability_count,
    (select count(*) from public.car_offers
      where pricing_strategy = 'legacy_compat' and availability_mode = 'mapped'
    ) as legacy_pricing_mapped_availability_count,
    (select count(*) from public.car_offers
      where pricing_strategy = 'threshold_daily_rate' and availability_mode = 'mapped'
    ) as threshold_pricing_mapped_availability_count,
    (select count(*) from public.car_offer_city_availability) as availability_row_count,
    (select count(*) from public.car_offer_city_availability availability
      where availability.is_active is distinct from (
        availability.pickup_enabled or availability.return_enabled
      )
    ) as malformed_directional_row_count,
    (select count(*)
      from public.car_offers offer
      where offer.availability_mode = 'mapped'
        and (
          not exists (
            select 1
            from public.car_offer_city_availability availability
            where availability.offer_id = offer.id
              and availability.is_active
              and availability.pickup_enabled
              and public.car_multicity_directional_availability_is_valid(
                offer.pricing_strategy, 'mapped', offer.pricing_profile_id,
                availability.city_id, 'pickup', true,
                availability.fee_mode, availability.fee_per_direction
              )
          )
          or not exists (
            select 1
            from public.car_offer_city_availability availability
            where availability.offer_id = offer.id
              and availability.is_active
              and availability.return_enabled
              and public.car_multicity_directional_availability_is_valid(
                offer.pricing_strategy, 'mapped', offer.pricing_profile_id,
                availability.city_id, 'return', true,
                availability.fee_mode, availability.fee_per_direction
              )
          )
        )
    ) as invalid_mapped_configuration_count,
    (select count(*)
      from public.car_offers offer
      left join public.car_pricing_profiles profile
        on profile.id = offer.pricing_profile_id
      where offer.pricing_strategy = 'legacy_compat'
        and offer.availability_mode = 'mapped'
        and (
          profile.id is null
          or profile.is_active is not true
          or profile.legacy_booking_location <> lower(btrim(offer.location))
        )
    ) as invalid_mapped_legacy_profile_count,
    (select count(*)
      from public.car_offers offer
      where offer.availability_mode = 'mapped'
        and public.partner_service_fulfillment_partner_id_for_car_booking(
          offer.id,
          offer.location
        ) is null
    ) as mapped_partner_route_missing_count,
    (select car_multi_city_mapped_enabled from public.site_settings where id = 1)
      as mapped_capability_enabled,
    (select car_threshold_daily_rates_enabled from public.site_settings where id = 1)
      as threshold_capability_enabled
)
select
  function_contract.*,
  source_contract.*,
  grant_contract.*,
  trigger_contract.*,
  data_contract.*,
  (
    function_contract.bulk_rpc_present
    and function_contract.mapped_legacy_booking_guard_present
    and function_contract.directional_validator_present
    and function_contract.internal_helper_present
    and source_contract.booking_guard_routes_mapped_legacy
    and source_contract.profile_pickup_flag_decoupled
    and source_contract.profile_return_flag_decoupled
    and source_contract.profile_protector_pickup_decoupled
    and source_contract.profile_protector_return_decoupled
    and grant_contract.anon_bulk_denied
    and grant_contract.authenticated_bulk_granted
    and grant_contract.service_bulk_granted
    and grant_contract.internal_helper_not_exposed
    and trigger_contract.booking_guard_trigger_present
    and data_contract.malformed_directional_row_count = 0
    and data_contract.invalid_mapped_configuration_count = 0
    and data_contract.invalid_mapped_legacy_profile_count = 0
    and data_contract.mapped_partner_route_missing_count = 0
  ) as car_fleet_operations_safe
from function_contract
cross join source_contract
cross join grant_contract
cross join trigger_contract
cross join data_contract;
