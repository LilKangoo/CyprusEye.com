-- speedbikes-snipper-fx-pilot-verify-v1
-- READ ONLY. Exact one-offer live/pilot gate for Snipper FX.
-- Returns one summary row and reads no customer PII.
-- A valid price/configuration never represents partner acceptance.

with
constants as (
  select
    'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid as snipper_id,
    '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid as partner_id,
    'ca200001-0000-4000-8000-000000000003'::uuid as ayia_napa_id
),
speedbikes_ids(offer_id) as (
  values
    ('afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid),
    ('2817e6de-25ba-5237-b721-dbc0460a7de4'::uuid),
    ('ef800460-cfef-57c1-b3cd-7269f366b00c'::uuid),
    ('d78cee10-c980-5445-b59b-a7006f2f8718'::uuid),
    ('670f9df5-f9ac-5e38-821a-ac21847ff16d'::uuid),
    ('fee6c0e3-f213-53cb-9a94-bb7ed129ff58'::uuid),
    ('f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e'::uuid),
    ('cb127f3f-60ab-5375-a443-ac7bfb7804ce'::uuid),
    ('81dd11d2-68cf-57e7-831c-ec076c3e6a8b'::uuid),
    ('7496b0a4-aee0-58bc-a440-2d478514fec3'::uuid),
    ('e217a068-afb5-5352-be8b-ab2f8b9313d9'::uuid),
    ('23192ab2-24ae-5bae-8123-54039c805560'::uuid),
    ('f1c56415-b0bd-5738-a8fa-114abd92adae'::uuid),
    ('34dfca00-59b2-5c78-9600-f24f5a21cbea'::uuid),
    ('a0ba9599-7194-594f-930e-fa48911a6c6d'::uuid),
    ('8df639ad-c4dc-5a04-b06e-c7f93313df05'::uuid),
    ('bacb158c-0bfb-5735-bd70-bafa5e589882'::uuid),
    ('4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e'::uuid),
    ('9dc40c8c-0096-5405-aaf0-495ef479af74'::uuid),
    ('d54382fd-4761-5d49-92b5-81d83eda5fb9'::uuid),
    ('1860d043-132c-519b-bf97-c5eddc464087'::uuid),
    ('ecc945e9-eff8-5b7d-a478-b69689380dbd'::uuid)
),
expected_tiers(threshold_days, daily_rate) as (
  values
    (1, 110.000000::numeric),
    (2,  95.000000::numeric),
    (3,  90.000000::numeric),
    (4,  85.000000::numeric),
    (5,  80.000000::numeric),
    (6,  75.000000::numeric),
    (7,  70.000000::numeric)
),
expected_prices(rental_days, expected_total) as (
  values
    (1, 110.00::numeric),
    (2, 190.00::numeric),
    (3, 270.00::numeric),
    (4, 340.00::numeric),
    (5, 400.00::numeric),
    (6, 450.00::numeric),
    (7, 490.00::numeric),
    (8, 560.00::numeric),
    (9, 630.00::numeric),
    (10, 700.00::numeric),
    (11, 770.00::numeric),
    (12, 840.00::numeric),
    (13, 910.00::numeric),
    (14, 980.00::numeric)
),
offer_state as (
  select
    count(offer.id)::integer as matching_offer_count,
    count(*) filter (
      where offer.pricing_strategy = 'threshold_daily_rate'
        and offer.availability_mode = 'mapped'
        and offer.is_published
        and offer.is_available
        and offer.submission_status = 'approved'
        and offer.stock_count > 0
        and offer.min_rental_days = 1
        and offer.max_rental_days is null
        and offer.pricing_profile_id is null
        and offer.location = 'larnaca'
        and offer.owner_partner_id = constants.partner_id
        and offer.image_url = '/assets/images/cars/speedbikes/speedbikes-snipper-fx-400.webp'
        and offer.young_driver_fee is false
        and coalesce(offer.young_driver_cost, 0) = 0
        and offer.insurance_mode = 'included'
        and coalesce(offer.insurance_per_day, 0) = 0
    )::integer as exact_live_contract_count,
    max(offer.stock_count)::integer as stock_count
  from constants
  left join public.car_offers offer on offer.id = constants.snipper_id
),
other_speedbikes_state as (
  select
    count(offer.id)::integer as offer_count,
    count(*) filter (
      where offer.pricing_strategy = 'threshold_daily_rate'
        and offer.availability_mode = 'legacy'
        and offer.is_published is false
        and offer.is_available is false
        and offer.submission_status = 'draft'
    )::integer as inert_draft_count
  from speedbikes_ids expected
  cross join constants
  left join public.car_offers offer on offer.id = expected.offer_id
  where expected.offer_id <> constants.snipper_id
),
active_threshold_state as (
  select
    count(*)::integer as active_mapped_public_count,
    count(*) filter (where offer.id = constants.snipper_id)::integer as exact_snipper_count
  from public.car_offers offer
  cross join constants
  where offer.pricing_strategy = 'threshold_daily_rate'
    and offer.availability_mode = 'mapped'
    and offer.is_published
    and offer.is_available
),
tier_state as (
  select
    (select count(*)::integer
     from public.car_offer_daily_rate_tiers tier, constants
     where tier.offer_id = constants.snipper_id) as total_tier_count,
    (select count(*)::integer
     from public.car_offer_daily_rate_tiers tier, constants
     where tier.offer_id = constants.snipper_id and tier.is_active) as active_tier_count,
    count(*) filter (
      where tier.id is null
         or tier.is_active is not true
         or tier.daily_rate <> expected.daily_rate
    )::integer as schedule_mismatch_count
  from expected_tiers expected
  cross join constants
  left join public.car_offer_daily_rate_tiers tier
    on tier.offer_id = constants.snipper_id
   and tier.threshold_days = expected.threshold_days
),
price_state as (
  select
    count(*)::integer as case_count,
    count(*) filter (where quote.total is distinct from expected.expected_total)::integer as mismatch_count
  from expected_prices expected
  cross join constants
  left join lateral (
    select round(tier.daily_rate * expected.rental_days, 2) as total
    from public.car_offer_daily_rate_tiers tier
    where tier.offer_id = constants.snipper_id
      and tier.is_active
      and tier.threshold_days <= expected.rental_days
    order by tier.threshold_days desc
    limit 1
  ) quote on true
),
availability_state as (
  select
    count(availability.offer_id)::integer as total_row_count,
    count(*) filter (
      where availability.city_id = constants.ayia_napa_id
        and city.code = 'ayia-napa'
        and city.is_active
        and availability.pickup_enabled
        and availability.return_enabled
        and availability.is_active
        and availability.fee_mode = 'override'
        and availability.fee_per_direction = 0
    )::integer as exact_ayia_napa_count
  from constants
  left join public.car_offer_city_availability availability
    on availability.offer_id = constants.snipper_id
  left join public.car_rental_cities city on city.id = availability.city_id
),
route_state as (
  select public.car_threshold_offer_route_is_public_eligible(
    constants.snipper_id,
    'ayia-napa',
    'ayia-napa'
  ) as exact_ayia_napa_route_eligible
  from constants
),
deposit_state as (
  select count(*) filter (
    where override_row.resource_type = 'cars'
      and override_row.resource_id = constants.snipper_id
      and override_row.mode = 'percent_total'
      and override_row.amount = 15
      and override_row.currency = 'EUR'
      and override_row.enabled
  )::integer as valid_override_count
  from constants
  left join public.service_deposit_overrides override_row
    on override_row.resource_type = 'cars'
   and override_row.resource_id = constants.snipper_id
),
partner_state as (
  select
    count(*) filter (
      where partner.id = constants.partner_id
        and lower(partner.status) = 'active'
        and partner.can_manage_cars
    )::integer as valid_partner_count,
    (
      public.partner_service_fulfillment_partner_id_for_car_booking(
        constants.snipper_id,
        'ayia-napa'
      ) = constants.partner_id
    ) as exact_owner_routing
  from constants
  left join public.partners partner on partner.id = constants.partner_id
  group by constants.snipper_id, constants.partner_id
),
flag_state as (
  select
    count(*)::integer as settings_row_count,
    count(*) filter (
      where setting.id = 1
        and setting.car_multi_city_mapped_enabled
        and setting.car_threshold_daily_rates_enabled
    )::integer as both_flags_on_count,
    coalesce(bool_or(setting.car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(setting.car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings setting
),
legacy_state as (
  select
    count(*)::integer as offer_count,
    count(*) filter (
      where offer.pricing_strategy = 'legacy_compat'
        and offer.availability_mode = 'legacy'
    )::integer as legacy_compat_mode_count
  from public.car_offers offer
  where offer.id not in (select offer_id from speedbikes_ids)
),
partner_workflow_state as (
  select
    count(booking.id)::integer as booking_count,
    (
      select count(*)::integer
      from public.partner_service_fulfillments fulfillment
      where fulfillment.resource_type = 'cars'
        and fulfillment.resource_id = constants.snipper_id
    ) as fulfillment_count,
    count(booking.id) filter (
      where booking.status in ('confirmed', 'completed', 'active')
        and not exists (
          select 1
          from public.partner_service_fulfillments accepted_fulfillment
          where accepted_fulfillment.booking_id = booking.id
            and accepted_fulfillment.resource_type = 'cars'
            and accepted_fulfillment.resource_id = constants.snipper_id
            and accepted_fulfillment.partner_id = constants.partner_id
            and accepted_fulfillment.status = 'accepted'
        )
    )::integer as booking_advanced_without_partner_acceptance,
    count(booking.id) filter (
      where booking.payment_status in ('partial', 'paid')
        and not exists (
          select 1
          from public.partner_service_fulfillments accepted_fulfillment
          where accepted_fulfillment.booking_id = booking.id
            and accepted_fulfillment.resource_type = 'cars'
            and accepted_fulfillment.resource_id = constants.snipper_id
            and accepted_fulfillment.partner_id = constants.partner_id
            and accepted_fulfillment.status = 'accepted'
        )
        and (
          booking.status is distinct from 'pending'
          or not exists (
            select 1
            from public.partner_service_fulfillments pending_fulfillment
            where pending_fulfillment.booking_id = booking.id
              and pending_fulfillment.resource_type = 'cars'
              and pending_fulfillment.resource_id = constants.snipper_id
              and pending_fulfillment.partner_id = constants.partner_id
              and pending_fulfillment.status = 'pending_acceptance'
          )
        )
    )::integer as paid_booking_not_pending_partner_acceptance,
    (
      select count(*)::integer
      from public.partner_service_fulfillments fulfillment
      where fulfillment.resource_type = 'cars'
        and fulfillment.resource_id = constants.snipper_id
        and fulfillment.partner_id is distinct from constants.partner_id
    ) as fulfillment_routing_mismatch
  from constants
  left join public.car_bookings booking on booking.offer_id = constants.snipper_id
  group by constants.snipper_id, constants.partner_id
)
select
  now() as inspected_at,
  constants.snipper_id as exact_offer_id,
  offers.stock_count,
  flags.mapped_enabled as car_multi_city_mapped_enabled,
  flags.threshold_enabled as car_threshold_daily_rates_enabled,
  tiers.total_tier_count,
  tiers.active_tier_count,
  tiers.schedule_mismatch_count,
  prices.case_count as price_case_count,
  prices.mismatch_count as price_mismatch_count,
  availability.total_row_count as availability_row_count,
  availability.exact_ayia_napa_count,
  route.exact_ayia_napa_route_eligible,
  deposits.valid_override_count as valid_15_percent_override_count,
  partner.valid_partner_count,
  partner.exact_owner_routing,
  other_offers.offer_count as other_speedbikes_offer_count,
  other_offers.inert_draft_count as other_speedbikes_inert_draft_count,
  active_threshold.active_mapped_public_count,
  workflow.booking_count,
  workflow.fulfillment_count,
  workflow.booking_advanced_without_partner_acceptance,
  workflow.paid_booking_not_pending_partner_acceptance,
  workflow.fulfillment_routing_mismatch,
  false as availability_automatically_accepts_booking,
  (
    offers.matching_offer_count = 1
    and offers.exact_live_contract_count = 1
    and other_offers.offer_count = 21
    and other_offers.inert_draft_count = 21
    and active_threshold.active_mapped_public_count = 1
    and active_threshold.exact_snipper_count = 1
    and tiers.total_tier_count = 7
    and tiers.active_tier_count = 7
    and tiers.schedule_mismatch_count = 0
    and prices.case_count = 14
    and prices.mismatch_count = 0
    and availability.exact_ayia_napa_count = 1
    and route.exact_ayia_napa_route_eligible
    and deposits.valid_override_count = 1
    and partner.valid_partner_count = 1
    and partner.exact_owner_routing
    and flags.settings_row_count = 1
    and flags.both_flags_on_count = 1
    and legacy.offer_count = 27
    and legacy.legacy_compat_mode_count = 27
    and workflow.booking_advanced_without_partner_acceptance = 0
    and workflow.paid_booking_not_pending_partner_acceptance = 0
    and workflow.fulfillment_routing_mismatch = 0
  ) as snipper_fx_pilot_live_safe
from constants
cross join offer_state offers
cross join other_speedbikes_state other_offers
cross join active_threshold_state active_threshold
cross join tier_state tiers
cross join price_state prices
cross join availability_state availability
cross join route_state route
cross join deposit_state deposits
cross join partner_state partner
cross join flag_state flags
cross join legacy_state legacy
cross join partner_workflow_state workflow;
