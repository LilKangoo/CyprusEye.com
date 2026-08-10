-- speedbikes-catalogue-draft-state-verify-v1
-- READ ONLY. Optional strict gate for the untouched post-import draft state.
-- Run speedbikes_catalogue_verify.sql first for durable catalogue integrity.
-- This file intentionally fails after an administrator deliberately changes
-- stock/publication/submission/mode, adds another configured city, or enables
-- either capability flag.

with
constants as (
  select 'ca200001-0000-4000-8000-000000000003'::uuid as ayia_napa_id
),
expected_ids(offer_id) as (
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
offer_state as (
  select
    count(offer.id)::integer as offer_count,
    count(*) filter (where offer.pricing_strategy = 'threshold_daily_rate')::integer as threshold_count,
    count(*) filter (where offer.availability_mode = 'legacy')::integer as legacy_mode_count,
    count(*) filter (where offer.is_published is false)::integer as unpublished_count,
    count(*) filter (where offer.is_available is false)::integer as unavailable_count,
    count(*) filter (where offer.submission_status = 'draft')::integer as draft_count,
    count(*) filter (where offer.stock_count = 0)::integer as zero_stock_count,
    count(*) filter (where offer.min_rental_days = 1)::integer as min_one_count,
    count(*) filter (where offer.max_rental_days is null)::integer as unlimited_max_count
  from expected_ids expected
  left join public.car_offers offer on offer.id = expected.offer_id
),
flag_state as (
  select
    count(*)::integer as settings_row_count,
    count(*) filter (
      where setting.id = 1
        and setting.car_multi_city_mapped_enabled is false
        and setting.car_threshold_daily_rates_enabled is false
    )::integer as both_flags_off_count,
    coalesce(bool_or(setting.car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(setting.car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings setting
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
    )::integer as exact_ayia_napa_count,
    count(*) filter (
      where availability.offer_id is not null
        and availability.city_id is distinct from constants.ayia_napa_id
    )::integer as additional_configured_city_count
  from expected_ids expected
  cross join constants
  left join public.car_offer_city_availability availability
    on availability.offer_id = expected.offer_id
  left join public.car_rental_cities city on city.id = availability.city_id
),
booking_state as (
  select count(*)::integer as booking_count
  from public.car_bookings booking
  where booking.offer_id in (select offer_id from expected_ids)
),
fulfillment_state as (
  select count(*)::integer as fulfillment_count
  from public.partner_service_fulfillments fulfillment
  where fulfillment.resource_type = 'cars'
    and fulfillment.resource_id in (select offer_id from expected_ids)
),
legacy_state as (
  select
    count(*)::integer as offer_count,
    count(*) filter (
      where offer.pricing_strategy = 'legacy_compat'
        and offer.availability_mode = 'legacy'
    )::integer as legacy_compat_mode_count,
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
    ), '')) as protected_fingerprint
  from public.car_offers offer
  where offer.id not in (select offer_id from expected_ids)
)
select
  now() as inspected_at,
  offers.offer_count,
  offers.threshold_count,
  offers.legacy_mode_count,
  offers.unpublished_count,
  offers.unavailable_count,
  offers.draft_count,
  offers.zero_stock_count,
  offers.min_one_count,
  offers.unlimited_max_count,
  flags.mapped_enabled as car_multi_city_mapped_enabled,
  flags.threshold_enabled as car_threshold_daily_rates_enabled,
  availability.total_row_count as speedbikes_availability_row_count,
  availability.exact_ayia_napa_count,
  availability.additional_configured_city_count,
  bookings.booking_count as speedbikes_booking_count,
  fulfillments.fulfillment_count as speedbikes_fulfillment_count,
  legacy.offer_count as existing_legacy_offer_count,
  legacy.legacy_compat_mode_count as existing_legacy_compat_mode_count,
  legacy.protected_fingerprint as existing_legacy_protected_fingerprint,
  (
    offers.offer_count = 22
    and offers.threshold_count = 22
    and offers.legacy_mode_count = 22
    and offers.unpublished_count = 22
    and offers.unavailable_count = 22
    and offers.draft_count = 22
    and offers.zero_stock_count = 22
    and offers.min_one_count = 22
    and offers.unlimited_max_count = 22
    and flags.settings_row_count = 1
    and flags.both_flags_off_count = 1
    and availability.total_row_count = 22
    and availability.exact_ayia_napa_count = 22
    and availability.additional_configured_city_count = 0
    and bookings.booking_count = 0
    and fulfillments.fulfillment_count = 0
    and legacy.offer_count = 27
    and legacy.legacy_compat_mode_count = 27
    and legacy.protected_fingerprint = 'ec3e29a35f249c92279d7b15f400ef0f'
  ) as speedbikes_draft_state_safe
from offer_state offers
cross join flag_state flags
cross join availability_state availability
cross join booking_state bookings
cross join fulfillment_state fulfillments
cross join legacy_state legacy;
