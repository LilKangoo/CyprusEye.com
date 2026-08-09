-- speedbikes-catalogue-activation-checklist-v1
-- READ ONLY. This file intentionally performs NO activation.
--
-- Required controlled process after speedbikes_catalogue_verify.sql PASS:
--   1. Admin reviews each exact offer, content, image, tiers and partner.
--   2. Admin confirms real stock and sets is_available deliberately.
--   3. Admin explicitly reviews submission_status before publication.
--   4. Admin reviews exact Ayia Napa pickup+return configuration and fee EUR 0.
--   5. Admin verifies exact 15% percent_total override in Deposit Settings.
--   6. An approved exact-offer list is moved legacy -> mapped (one reviewed write).
--   7. Each approved offer is published explicitly; no bulk implicit publication.
--   8. Only after all exact-offer checks PASS, enable both global flags in a
--      separate approved change and perform customer quote/partner-flow smoke.
--   9. Availability means requestable only. Booking remains pending and
--      fulfillment remains pending_acceptance until the partner acts.
--
-- Kill switch: set either global flag false. Do not delete drafts, tiers,
-- availability, deposit overrides or the additive foundation.

with expected_ids(offer_id) as (
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
readiness as (
  select
    expected.offer_id,
    coalesce(offer.car_model ->> 'en', offer.car_model #>> '{}') as model,
    kind.code as vehicle_kind,
    offer.owner_partner_id,
    partner.name as partner_name,
    partner.status as partner_status,
    partner.can_manage_cars,
    public.partner_service_fulfillment_partner_id_for_car_booking(
      expected.offer_id,
      'ayia-napa'
    ) as resolved_fulfillment_partner_id,
    offer.pricing_strategy,
    offer.min_rental_days,
    offer.max_rental_days,
    offer.availability_mode,
    offer.is_available,
    offer.is_published,
    offer.submission_status,
    (offer.submission_status = 'draft') as submission_status_review_required,
    offer.stock_count,
    count(distinct tier.id) filter (where tier.is_active) as active_tier_count,
    min(tier.threshold_days) filter (where tier.is_active) as first_active_threshold,
    count(distinct availability.city_id) filter (
      where city.code = 'ayia-napa'
        and availability.is_active
        and availability.pickup_enabled
        and availability.return_enabled
        and availability.fee_mode = 'override'
        and availability.fee_per_direction = 0
    ) as valid_ayia_napa_configuration,
    count(distinct override_row.id) filter (
      where override_row.mode = 'percent_total'
        and override_row.amount = 15
        and override_row.enabled
    ) as valid_15_percent_override,
    (
      offer.pricing_strategy = 'threshold_daily_rate'
      and offer.min_rental_days = 1
      and offer.max_rental_days is null
      and offer.owner_partner_id = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
      and lower(partner.status) = 'active'
      and partner.can_manage_cars
      and public.partner_service_fulfillment_partner_id_for_car_booking(
        expected.offer_id,
        'ayia-napa'
      ) = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
      and count(distinct tier.id) filter (where tier.is_active) >= 1
      and min(tier.threshold_days) filter (where tier.is_active) = 1
      and count(distinct availability.city_id) filter (
        where city.code = 'ayia-napa'
          and availability.is_active
          and availability.pickup_enabled
          and availability.return_enabled
          and availability.fee_mode = 'override'
          and availability.fee_per_direction = 0
      ) = 1
      and count(distinct override_row.id) filter (
        where override_row.mode = 'percent_total'
          and override_row.amount = 15
          and override_row.enabled
      ) = 1
    ) as configuration_ready_for_separate_review
  from expected_ids expected
  left join public.car_offers offer on offer.id = expected.offer_id
  left join public.car_vehicle_kinds kind on kind.id = offer.vehicle_kind_id
  left join public.partners partner on partner.id = offer.owner_partner_id
  left join public.car_offer_daily_rate_tiers tier on tier.offer_id = expected.offer_id
  left join public.car_offer_city_availability availability on availability.offer_id = expected.offer_id
  left join public.car_rental_cities city on city.id = availability.city_id
  left join public.service_deposit_overrides override_row
    on override_row.resource_type = 'cars'
   and override_row.resource_id = expected.offer_id
  group by expected.offer_id, offer.id, kind.code, partner.id
)
select
  readiness.*,
  flags.car_multi_city_mapped_enabled,
  flags.car_threshold_daily_rates_enabled,
  false as booking_automatically_accepted
from readiness
cross join lateral (
  select
    coalesce(bool_or(setting.car_multi_city_mapped_enabled), false) as car_multi_city_mapped_enabled,
    coalesce(bool_or(setting.car_threshold_daily_rates_enabled), false) as car_threshold_daily_rates_enabled
  from public.site_settings setting
) flags
order by readiness.vehicle_kind, readiness.model, readiness.offer_id;
