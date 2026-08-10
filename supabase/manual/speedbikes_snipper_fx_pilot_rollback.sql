-- speedbikes-snipper-fx-pilot-rollback-v4
-- MANUAL PRODUCTION-WRITE SCRIPT. Exact Snipper public unpublish only.
--
-- The global capability kill switch is a separate emergency operation. This
-- exact-offer rollback deliberately preserves both site_settings flags and
-- every operational offer field except is_published. Stock, mapped mode,
-- approval, availability, tiers, image, owner, city configuration, deposit
-- override, bookings and fulfillments are preserved.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.site_settings in share mode;
lock table public.car_offers in share row exclusive mode;
lock table public.car_offer_daily_rate_tiers in share mode;
lock table public.car_offer_city_availability in share mode;
lock table public.service_deposit_overrides in share mode;

do $snipper_rollback$
declare
  snipper_id constant uuid := 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1';
  speed_bikes_partner_id constant uuid := '583ee90b-d77c-47ff-97a4-76657a87809f';
  affected_count integer;
  v_exact_identity_match boolean;
  v_tiers_before text;
  v_tiers_after text;
  v_availability_before text;
  v_availability_after text;
  v_deposits_before text;
  v_deposits_after text;
  v_mapped_flag_before boolean;
  v_threshold_flag_before boolean;
  v_offer_contract_before text;
  v_offer_contract_after text;
begin
  if (select count(*) from public.site_settings) <> 1
     or not exists (select 1 from public.site_settings where id = 1) then
    raise exception 'Snipper rollback stopped: expected exactly one settings row with id=1';
  end if;

  select
    setting.car_multi_city_mapped_enabled,
    setting.car_threshold_daily_rates_enabled
  into v_mapped_flag_before, v_threshold_flag_before
  from public.site_settings setting
  where setting.id = 1;

  select exists (
    select 1
    from public.car_offers offer
    where offer.id = snipper_id
      and offer.pricing_strategy = 'threshold_daily_rate'
      and offer.owner_partner_id = speed_bikes_partner_id
  )
  into v_exact_identity_match;

  select md5((to_jsonb(offer) - 'is_published' - 'updated_at')::text)
  into v_offer_contract_before
  from public.car_offers offer
  where offer.id = snipper_id;

  select md5(coalesce(string_agg(to_jsonb(tier)::text, E'\n' order by tier.offer_id, tier.threshold_days), ''))
  into v_tiers_before
  from public.car_offer_daily_rate_tiers tier;

  select md5(coalesce(string_agg(to_jsonb(availability)::text, E'\n' order by availability.offer_id, availability.city_id), ''))
  into v_availability_before
  from public.car_offer_city_availability availability;

  select md5(coalesce(string_agg(to_jsonb(override_row)::text, E'\n' order by override_row.id), ''))
  into v_deposits_before
  from public.service_deposit_overrides override_row;

  if v_exact_identity_match then
    update public.car_offers
    set is_published = false
    where id = snipper_id
      and pricing_strategy = 'threshold_daily_rate'
      and owner_partner_id = speed_bikes_partner_id
      and is_published is true;

    get diagnostics affected_count = row_count;
    if affected_count not in (0, 1) then
      raise exception 'Snipper rollback rolled back: exact offer update affected % rows', affected_count;
    end if;
  end if;

  select md5((to_jsonb(offer) - 'is_published' - 'updated_at')::text)
  into v_offer_contract_after
  from public.car_offers offer
  where offer.id = snipper_id;

  if v_offer_contract_after is distinct from v_offer_contract_before then
    raise exception 'Snipper rollback rolled back: a non-publication offer field changed';
  end if;

  if not exists (
    select 1 from public.site_settings setting
    where setting.id = 1
      and setting.car_multi_city_mapped_enabled is not distinct from v_mapped_flag_before
      and setting.car_threshold_daily_rates_enabled is not distinct from v_threshold_flag_before
  ) then
    raise exception 'Snipper rollback rolled back: a capability flag changed';
  end if;

  select md5(coalesce(string_agg(to_jsonb(tier)::text, E'\n' order by tier.offer_id, tier.threshold_days), ''))
  into v_tiers_after
  from public.car_offer_daily_rate_tiers tier;

  select md5(coalesce(string_agg(to_jsonb(availability)::text, E'\n' order by availability.offer_id, availability.city_id), ''))
  into v_availability_after
  from public.car_offer_city_availability availability;

  select md5(coalesce(string_agg(to_jsonb(override_row)::text, E'\n' order by override_row.id), ''))
  into v_deposits_after
  from public.service_deposit_overrides override_row;

  if v_tiers_after is distinct from v_tiers_before
     or v_availability_after is distinct from v_availability_before
     or v_deposits_after is distinct from v_deposits_before then
    raise exception 'Snipper rollback rolled back: a protected configuration table changed';
  end if;
end
$snipper_rollback$;

commit;

select
  setting.car_multi_city_mapped_enabled,
  setting.car_threshold_daily_rates_enabled,
  offer.id as exact_offer_id,
  offer.stock_count as preserved_stock_count,
  offer.is_published,
  offer.is_available,
  offer.availability_mode,
  offer.submission_status,
  (
    offer.id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
    and offer.pricing_strategy = 'threshold_daily_rate'
    and offer.owner_partner_id = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
    and offer.is_published is false
  ) as exact_offer_unpublished,
  (
    offer.id is null
    or offer.pricing_strategy is distinct from 'threshold_daily_rate'
    or offer.owner_partner_id is distinct from '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
  ) as manual_offer_review_required,
  (
    select count(*)::integer
    from public.car_offers other_offer
    where other_offer.pricing_strategy = 'threshold_daily_rate'
      and other_offer.availability_mode = 'mapped'
      and other_offer.id <> 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
  ) as other_mapped_threshold_offers_preserved
from public.site_settings setting
left join public.car_offers offer
  on offer.id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
where setting.id = 1;
