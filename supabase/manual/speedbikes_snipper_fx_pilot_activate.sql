-- SpeedBikes pilot activation: Snipper FX only (FALLBACK ONLY).
-- MANUAL PRODUCTION SCRIPT. DO NOT RUN until:
--   1) catalogue integrity verify confirms all 22 required Ayia Napa rows;
--      the historical exact-five Protaras cleanup is not a reusable cleanup;
--      additional Admin-reviewed directional rows are legitimate and this
--      script preserves them;
--   2) an administrator has reviewed the offer and set stock_count > 0;
--   3) the image URL returns HTTP 200;
--   4) a separate explicit activation approval has been given.
--
-- Primary path: first run the separately approved flags-only
-- speedbikes_capabilities_enable.sql, then activate the exact offer through
-- reviewed Admin writes. This fallback also requires both capabilities already
-- ON and changes only the exact Snipper offer; it never changes global flags.
--
-- This script does not create a booking and cannot accept one. A customer
-- request remains pending and its fulfillment remains pending_acceptance until
-- the Speed Bikes partner acts in the existing partner application.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.site_settings in share mode;
lock table public.car_offers in share row exclusive mode;
lock table public.car_offer_daily_rate_tiers in share mode;
lock table public.car_offer_city_availability in share mode;
lock table public.service_deposit_overrides in share mode;
lock table public.partners in share mode;

do $snipper_activate$
declare
  snipper_id constant uuid := 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1';
  speed_bikes_partner_id constant uuid := '583ee90b-d77c-47ff-97a4-76657a87809f';
  ayia_napa_id constant uuid := 'ca200001-0000-4000-8000-000000000003';
  speedbikes_ids constant uuid[] := array[
    'afd191d3-bbbf-5c7a-a8a1-12bde793ace1',
    '2817e6de-25ba-5237-b721-dbc0460a7de4',
    'ef800460-cfef-57c1-b3cd-7269f366b00c',
    'd78cee10-c980-5445-b59b-a7006f2f8718',
    '670f9df5-f9ac-5e38-821a-ac21847ff16d',
    'fee6c0e3-f213-53cb-9a94-bb7ed129ff58',
    'f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e',
    'cb127f3f-60ab-5375-a443-ac7bfb7804ce',
    '81dd11d2-68cf-57e7-831c-ec076c3e6a8b',
    '7496b0a4-aee0-58bc-a440-2d478514fec3',
    'e217a068-afb5-5352-be8b-ab2f8b9313d9',
    '23192ab2-24ae-5bae-8123-54039c805560',
    'f1c56415-b0bd-5738-a8fa-114abd92adae',
    '34dfca00-59b2-5c78-9600-f24f5a21cbea',
    'a0ba9599-7194-594f-930e-fa48911a6c6d',
    '8df639ad-c4dc-5a04-b06e-c7f93313df05',
    'bacb158c-0bfb-5735-bd70-bafa5e589882',
    '4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e',
    '9dc40c8c-0096-5405-aaf0-495ef479af74',
    'd54382fd-4761-5d49-92b5-81d83eda5fb9',
    '1860d043-132c-519b-bf97-c5eddc464087',
    'ecc945e9-eff8-5b7d-a478-b69689380dbd'
  ]::uuid[];
  affected_count integer;
  price_mismatch_count integer;
begin
  if (select count(*) from public.site_settings) <> 1
     or exists (
       select 1
       from public.site_settings
       where id <> 1
          or car_multi_city_mapped_enabled is not true
          or car_threshold_daily_rates_enabled is not true
     ) then
    raise exception 'Snipper activation stopped: run the separately approved capability enable first';
  end if;

  if (
    select count(*)
    from public.car_offers offer
    where offer.id <> all(speedbikes_ids)
      and offer.pricing_strategy = 'legacy_compat'
      and offer.availability_mode = 'legacy'
  ) <> 27 then
    raise exception 'Snipper activation stopped: existing 27 legacy offers changed';
  end if;

  if exists (
    select 1
    from public.car_offers
    where availability_mode = 'mapped'
  ) then
    raise exception 'Snipper activation stopped: a mapped offer already exists';
  end if;

  if (
    select count(*)
    from public.car_offers offer
    where offer.id = snipper_id
      and offer.pricing_strategy = 'threshold_daily_rate'
      and offer.availability_mode = 'legacy'
      and not offer.is_published
      and offer.submission_status = 'draft'
      and offer.min_rental_days = 1
      and offer.max_rental_days is null
      and offer.pricing_profile_id is null
      and offer.location = 'larnaca'
      and offer.owner_partner_id = speed_bikes_partner_id
      and offer.stock_count > 0
      and offer.image_url = '/assets/images/cars/speedbikes/speedbikes-snipper-fx-400.webp'
      and not offer.young_driver_fee
      and coalesce(offer.young_driver_cost, 0) = 0
      and offer.insurance_mode = 'included'
      and coalesce(offer.insurance_per_day, 0) = 0
  ) <> 1 then
    raise exception 'Snipper activation stopped: exact draft contract failed or stock_count is not positive';
  end if;

  if (
    select count(*)
    from public.car_offers offer
    where offer.id = any(speedbikes_ids)
      and offer.id <> snipper_id
      and offer.pricing_strategy = 'threshold_daily_rate'
      and offer.availability_mode = 'legacy'
      and not offer.is_published
      and not offer.is_available
      and offer.submission_status = 'draft'
  ) <> 21 then
    raise exception 'Snipper activation stopped: another SpeedBikes draft changed activation state';
  end if;

  if (
    select count(*)
    from public.car_offer_city_availability availability
    where availability.offer_id = any(speedbikes_ids)
      and availability.city_id = ayia_napa_id
      and availability.pickup_enabled
      and availability.return_enabled
      and availability.is_active
      and availability.fee_mode = 'override'
      and availability.fee_per_direction = 0
  ) <> 22 then
    raise exception 'Snipper activation stopped: all 22 exact Ayia Napa request routes are required';
  end if;

  if (
    select count(*)
    from public.car_offer_daily_rate_tiers tier
    where tier.offer_id = snipper_id
      and tier.is_active
  ) <> 7
  or exists (
    select 1
    from (
      values
        (1, 110.000000::numeric),
        (2,  95.000000::numeric),
        (3,  90.000000::numeric),
        (4,  85.000000::numeric),
        (5,  80.000000::numeric),
        (6,  75.000000::numeric),
        (7,  70.000000::numeric)
    ) expected(threshold_days, daily_rate)
    left join public.car_offer_daily_rate_tiers tier
      on tier.offer_id = snipper_id
     and tier.threshold_days = expected.threshold_days
     and tier.daily_rate = expected.daily_rate
     and tier.is_active
    where tier.id is null
  ) then
    raise exception 'Snipper activation stopped: exact seven-tier schedule changed';
  end if;

  with expected_case (rental_days, expected_total) as (
    values
      (1, 110.00::numeric),
      (2, 190.00::numeric),
      (3, 270.00::numeric),
      (4, 340.00::numeric),
      (5, 400.00::numeric),
      (6, 450.00::numeric),
      (7, 490.00::numeric),
      (8, 560.00::numeric),
      (10, 700.00::numeric),
      (14, 980.00::numeric)
  )
  select count(*)
  into price_mismatch_count
  from expected_case expected
  left join lateral (
    select round(tier.daily_rate * expected.rental_days, 2) as total
    from public.car_offer_daily_rate_tiers tier
    where tier.offer_id = snipper_id
      and tier.is_active
      and tier.threshold_days <= expected.rental_days
    order by tier.threshold_days desc
    limit 1
  ) quote on true
  where quote.total is distinct from expected.expected_total;

  if price_mismatch_count <> 0 then
    raise exception 'Snipper activation stopped: % pilot price cases differ', price_mismatch_count;
  end if;

  if (
    select count(*)
    from public.partners partner
    where partner.id = speed_bikes_partner_id
      and partner.status = 'active'
      and partner.can_manage_cars
  ) <> 1
  or public.partner_service_fulfillment_partner_id_for_car_booking(snipper_id, 'ayia-napa')
       is distinct from speed_bikes_partner_id then
    raise exception 'Snipper activation stopped: exact Speed Bikes partner routing failed';
  end if;

  if (
    select count(*)
    from public.service_deposit_overrides override_row
    where override_row.resource_type = 'cars'
      and override_row.resource_id = snipper_id
      and override_row.mode = 'percent_total'
      and override_row.amount = 15
      and override_row.currency = 'EUR'
      and override_row.enabled
  ) <> 1 then
    raise exception 'Snipper activation stopped: exact 15 percent part-payment override failed';
  end if;

  update public.car_offers
  set availability_mode = 'mapped',
      submission_status = 'approved',
      is_available = true,
      is_published = true
  where id = snipper_id
    and availability_mode = 'legacy'
    and submission_status = 'draft'
    and not is_published;

  get diagnostics affected_count = row_count;
  if affected_count <> 1 then
    raise exception 'Snipper activation rolled back: exact offer update affected % rows', affected_count;
  end if;

  if (
    select count(*)
    from public.car_offers offer
    where offer.id = snipper_id
      and offer.pricing_strategy = 'threshold_daily_rate'
      and offer.availability_mode = 'mapped'
      and offer.is_published
      and offer.is_available
      and offer.submission_status = 'approved'
      and offer.stock_count > 0
  ) <> 1
  or (
    select count(*)
    from public.car_offers offer
    where offer.pricing_strategy = 'threshold_daily_rate'
      and offer.availability_mode = 'mapped'
      and offer.is_published
      and offer.is_available
  ) <> 1
  or exists (
    select 1
    from public.car_offers offer
    where offer.pricing_strategy = 'threshold_daily_rate'
      and offer.availability_mode = 'mapped'
      and offer.is_published
      and offer.is_available
      and offer.id <> snipper_id
  ) then
    raise exception 'Snipper activation rolled back: exact one-offer postcondition failed';
  end if;

  if not exists (
    select 1
    from public.site_settings
    where id = 1
      and car_multi_city_mapped_enabled
      and car_threshold_daily_rates_enabled
  ) then
    raise exception 'Snipper activation rolled back: both flags are not true';
  end if;

  if not public.car_threshold_offer_route_is_public_eligible(
    snipper_id,
    'ayia-napa',
    'ayia-napa'
  ) then
    raise exception 'Snipper activation rolled back: exact Ayia Napa route is not publicly eligible';
  end if;
end
$snipper_activate$;

commit;

select
  offer.id as activated_offer_id,
  offer.stock_count,
  offer.is_published,
  offer.is_available,
  offer.availability_mode,
  offer.pricing_strategy,
  setting.car_multi_city_mapped_enabled,
  setting.car_threshold_daily_rates_enabled
from public.car_offers offer
cross join public.site_settings setting
where offer.id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
  and setting.id = 1;
