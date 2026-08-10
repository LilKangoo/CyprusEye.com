-- speedbikes-capabilities-enable-v2
-- MANUAL PRODUCTION-WRITE SCRIPT. DO NOT RUN WITHOUT SEPARATE APPROVAL.
--
-- This is deliberately catalogue-agnostic and changes only the two global
-- capability flags. It does not depend on Snipper, Ayia Napa, SpeedBikes row
-- counts, images, tiers or partner data. No offer may already combine mapped
-- mode with publication before it runs. Exact offer activation remains a
-- separate Admin review; an unpublished legacy-mode draft may already be
-- operationally marked available without becoming public.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.site_settings in share row exclusive mode;
lock table public.car_offers in share mode;

do $enable_car_capabilities$
declare
  v_affected integer;
  v_offer_fingerprint_before text;
  v_offer_fingerprint_after text;
begin
  if (select count(*) from public.site_settings) <> 1
     or not exists (
       select 1
       from public.site_settings setting
       where setting.id = 1
         and setting.car_multi_city_mapped_enabled is false
         and setting.car_threshold_daily_rates_enabled is false
     ) then
    raise exception 'Capability enable stopped: expected exactly one id=1 settings row with both flags false';
  end if;

  if exists (
    select 1
    from public.car_offers offer
    where offer.availability_mode = 'mapped'
      and offer.is_published
  ) then
    raise exception 'Capability enable stopped: a published mapped offer could become public when flags change';
  end if;

  select md5(coalesce(string_agg(to_jsonb(offer)::text, E'\n' order by offer.id), ''))
  into v_offer_fingerprint_before
  from public.car_offers offer;

  update public.site_settings
  set car_multi_city_mapped_enabled = true,
      car_threshold_daily_rates_enabled = true
  where id = 1
    and car_multi_city_mapped_enabled is false
    and car_threshold_daily_rates_enabled is false;

  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception 'Capability enable rolled back: settings update affected % rows', v_affected;
  end if;

  select md5(coalesce(string_agg(to_jsonb(offer)::text, E'\n' order by offer.id), ''))
  into v_offer_fingerprint_after
  from public.car_offers offer;

  if v_offer_fingerprint_after is distinct from v_offer_fingerprint_before then
    raise exception 'Capability enable rolled back: a car offer changed';
  end if;

  if not exists (
    select 1
    from public.site_settings setting
    where setting.id = 1
      and setting.car_multi_city_mapped_enabled
      and setting.car_threshold_daily_rates_enabled
  ) then
    raise exception 'Capability enable rolled back: both flags are not true';
  end if;
end
$enable_car_capabilities$;

commit;

select
  setting.id as site_settings_id,
  setting.car_multi_city_mapped_enabled,
  setting.car_threshold_daily_rates_enabled,
  false as offer_activation_performed,
  true as exact_admin_activation_may_now_be_reviewed,
  false as booking_automatically_accepted
from public.site_settings setting
where setting.id = 1;
