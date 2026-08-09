-- car-rental-threshold-exact-owner-routing-verify-v1
-- READ ONLY. Run after 20260810130000_car_rental_threshold_exact_owner_routing.sql.
-- Returns exactly one summary row.

with
function_state as (
  select
    to_regprocedure(
      'public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)'
    ) is not null as resolver_present,
    coalesce((
      select
        position('v_pricing_strategy = ''threshold_daily_rate''' in procedure.prosrc) > 0
        and position('partner.id = v_exact_owner_id' in procedure.prosrc) > 0
        and position('partner.status = ''active''' in procedure.prosrc) > 0
        and position('partner.can_manage_cars = true' in procedure.prosrc) > 0
      from pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)'
      )
    ), false) as exact_threshold_owner_contract
),
flag_state as (
  select
    count(*)::integer as canonical_setting_count,
    coalesce(bool_or(car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings
),
legacy_state as (
  select
    count(*)::integer as legacy_offer_count,
    count(*) filter (
      where offer.owner_partner_id is not null
        and public.partner_service_fulfillment_partner_id_for_car_booking(offer.id, offer.location) is null
    )::integer as legacy_owner_without_resolved_partner_count
  from public.car_offers offer
  where offer.pricing_strategy = 'legacy_compat'
)
select
  functions.resolver_present,
  functions.exact_threshold_owner_contract,
  flags.canonical_setting_count,
  flags.mapped_enabled as car_multi_city_mapped_enabled,
  flags.threshold_enabled as car_threshold_daily_rates_enabled,
  legacy.legacy_offer_count,
  legacy.legacy_owner_without_resolved_partner_count,
  (
    functions.resolver_present
    and functions.exact_threshold_owner_contract
    and flags.canonical_setting_count = 1
    and flags.mapped_enabled is false
    and flags.threshold_enabled is false
  ) as threshold_exact_owner_routing_safe
from function_state functions
cross join flag_state flags
cross join legacy_state legacy;
