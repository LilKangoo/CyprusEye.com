-- SpeedBikes catalogue: remove five confirmed Admin-test Protaras rows.
-- MANUAL PRODUCTION SCRIPT. Review first. Do not combine with pilot activation.
-- HISTORICAL EXACT-FIVE CLEANUP — NOT REUSABLE FOR A DIFFERENT ROW SET.
-- It deliberately fails before DELETE unless all five original composite rows,
-- timestamps and the original draft/flag counts still match. A newly created
-- single Protaras row requires a separate read-only audit and exact-row plan.
--
-- Provenance evidence:
--   * the deterministic catalogue seed created the 22 Ayia Napa rows together;
--   * these five rows were later created by five separate successful PostgREST
--     POST requests from the production Admin browser;
--   * the table has no created_by column, so the individual actor cannot be
--     cryptographically attributed.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.site_settings in share mode;
lock table public.car_offers in share mode;
lock table public.car_offer_daily_rate_tiers in share mode;
lock table public.service_deposit_overrides in share mode;
lock table public.car_offer_city_availability in share row exclusive mode;

do $speedbikes_cleanup$
declare
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
  ayia_napa_id constant uuid := 'ca200001-0000-4000-8000-000000000003';
  protaras_id constant uuid := 'ca200001-0000-4000-8000-000000000004';
  matched_count integer;
  deleted_count integer;
begin
  if (select count(*) from public.site_settings) <> 1
     or exists (
       select 1
       from public.site_settings
       where car_multi_city_mapped_enabled
          or car_threshold_daily_rates_enabled
     ) then
    raise exception 'SpeedBikes cleanup stopped: both global flags must be false on the single settings row';
  end if;

  if (
    select count(*)
    from public.car_offers offer
    where offer.id = any(speedbikes_ids)
      and offer.pricing_strategy = 'threshold_daily_rate'
      and offer.availability_mode = 'legacy'
      and not offer.is_published
      and not offer.is_available
      and offer.submission_status = 'draft'
  ) <> 22 then
    raise exception 'SpeedBikes cleanup stopped: expected 22 inert deterministic drafts';
  end if;

  if (
    select count(*)
    from public.car_offers offer
    where offer.id <> all(speedbikes_ids)
      and offer.pricing_strategy = 'legacy_compat'
      and offer.availability_mode = 'legacy'
  ) <> 27 then
    raise exception 'SpeedBikes cleanup stopped: existing 27 legacy offers changed';
  end if;

  if (
    select count(*)
    from public.car_offer_city_availability availability
    where availability.offer_id <> all(speedbikes_ids)
  ) <> 12 then
    raise exception 'SpeedBikes cleanup stopped: existing 12 legacy availability rows changed';
  end if;

  if (
    select count(*)
    from public.car_offer_daily_rate_tiers tier
    where tier.offer_id = any(speedbikes_ids)
  ) <> 145 then
    raise exception 'SpeedBikes cleanup stopped: expected 145 catalogue tiers';
  end if;

  if (
    select count(*)
    from public.service_deposit_overrides override_row
    where override_row.resource_type = 'cars'
      and override_row.resource_id = any(speedbikes_ids)
      and override_row.mode = 'percent_total'
      and override_row.amount = 15
      and override_row.enabled
  ) <> 22 then
    raise exception 'SpeedBikes cleanup stopped: exact 15 percent overrides changed';
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
    raise exception 'SpeedBikes cleanup stopped: the 22 Ayia Napa rows are not intact';
  end if;

  if (
    select count(*)
    from public.car_offer_city_availability availability
    where availability.offer_id = any(speedbikes_ids)
      and availability.city_id <> ayia_napa_id
  ) <> 5 then
    raise exception 'SpeedBikes cleanup stopped: unexpected-city count is no longer exactly five';
  end if;

  with expected_extra (
    offer_id,
    pickup_enabled,
    return_enabled,
    is_active,
    created_at
  ) as (
    values
      ('afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid, true,  true,  true,  '2026-08-09 23:18:45.413760+00'::timestamptz),
      ('2817e6de-25ba-5237-b721-dbc0460a7de4'::uuid, true,  true,  true,  '2026-08-09 23:20:52.107887+00'::timestamptz),
      ('ef800460-cfef-57c1-b3cd-7269f366b00c'::uuid, true,  true,  true,  '2026-08-09 23:21:16.525360+00'::timestamptz),
      ('d78cee10-c980-5445-b59b-a7006f2f8718'::uuid, false, false, false, '2026-08-09 23:21:34.567351+00'::timestamptz),
      ('670f9df5-f9ac-5e38-821a-ac21847ff16d'::uuid, true,  true,  true,  '2026-08-09 23:21:52.895617+00'::timestamptz)
  )
  select count(*)
  into matched_count
  from expected_extra expected
  join public.car_offer_city_availability availability
    on availability.offer_id = expected.offer_id
   and availability.city_id = protaras_id
   and availability.pickup_enabled = expected.pickup_enabled
   and availability.return_enabled = expected.return_enabled
   and availability.is_active = expected.is_active
   and availability.fee_mode = 'override'
   and availability.fee_per_direction = 0
   and availability.fee_note is null
   and availability.created_at = expected.created_at
   and availability.updated_at = expected.created_at;

  if matched_count <> 5 then
    raise exception 'SpeedBikes cleanup stopped: the five Protaras rows no longer match the audited records';
  end if;

  with expected_extra (offer_id, created_at) as (
    values
      ('afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid, '2026-08-09 23:18:45.413760+00'::timestamptz),
      ('2817e6de-25ba-5237-b721-dbc0460a7de4'::uuid, '2026-08-09 23:20:52.107887+00'::timestamptz),
      ('ef800460-cfef-57c1-b3cd-7269f366b00c'::uuid, '2026-08-09 23:21:16.525360+00'::timestamptz),
      ('d78cee10-c980-5445-b59b-a7006f2f8718'::uuid, '2026-08-09 23:21:34.567351+00'::timestamptz),
      ('670f9df5-f9ac-5e38-821a-ac21847ff16d'::uuid, '2026-08-09 23:21:52.895617+00'::timestamptz)
  )
  delete from public.car_offer_city_availability availability
  using expected_extra expected
  where availability.offer_id = expected.offer_id
    and availability.city_id = protaras_id
    and availability.created_at = expected.created_at
    and availability.updated_at = expected.created_at;

  get diagnostics deleted_count = row_count;
  if deleted_count <> 5 then
    raise exception 'SpeedBikes cleanup rolled back: deleted %, expected 5', deleted_count;
  end if;

  if exists (
    select 1
    from public.car_offer_city_availability availability
    where availability.offer_id = any(speedbikes_ids)
      and availability.city_id <> ayia_napa_id
  ) then
    raise exception 'SpeedBikes cleanup rolled back: unexpected city rows remain';
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
    raise exception 'SpeedBikes cleanup rolled back: Ayia Napa rows changed';
  end if;

  if (
    select count(*)
    from public.car_offer_city_availability availability
    where availability.offer_id <> all(speedbikes_ids)
  ) <> 12 then
    raise exception 'SpeedBikes cleanup rolled back: legacy availability changed';
  end if;
end
$speedbikes_cleanup$;

commit;

select
  5::integer as deleted_unexpected_protaras_rows,
  22::integer as preserved_speedbikes_ayia_napa_rows,
  12::integer as preserved_legacy_availability_rows,
  false as car_multi_city_mapped_enabled,
  false as car_threshold_daily_rates_enabled;
