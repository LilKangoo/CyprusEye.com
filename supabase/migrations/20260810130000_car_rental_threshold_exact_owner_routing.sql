-- car-rental-threshold-exact-owner-routing-v1
-- Decouples exact-offer partner routing from the legacy Larnaca/Paphos
-- location bucket for threshold-priced offers only. Legacy routing is captured
-- and asserted byte-for-byte equivalent inside this transaction.

begin;

do $$
begin
  if to_regprocedure('public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)') is null then
    raise exception using
      errcode = '42883',
      message = 'car_threshold_exact_owner_required_resolver_missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'car_offers'
      and column_info.column_name = 'pricing_strategy'
  ) or not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'car_offers'
      and column_info.column_name = 'owner_partner_id'
  ) then
    raise exception using
      errcode = '42703',
      message = 'car_threshold_exact_owner_required_offer_columns_missing';
  end if;

  if exists (
    select 1
    from public.site_settings setting
    where setting.car_threshold_daily_rates_enabled is true
       or setting.car_multi_city_mapped_enabled is true
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_exact_owner_routing_requires_inert_flags';
  end if;
end
$$;

-- Freeze every input used by the before/after oracle. A concurrent Admin
-- write must time out the migration rather than make its parity proof race.
lock table public.car_offers in share mode;
lock table public.partners in share mode;
lock table public.partner_resources in share mode;
lock table public.site_settings in share mode;

create temporary table _car_threshold_legacy_partner_routing_before on commit drop as
select
  offer.id as offer_id,
  public.partner_service_fulfillment_partner_id_for_car_booking(offer.id, offer.location) as partner_id
from public.car_offers offer
where offer.pricing_strategy = 'legacy_compat';

create or replace function public.partner_service_fulfillment_partner_id_for_car_booking(
  p_offer_id uuid,
  p_location text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  loc text;
  has_resource_fn boolean;
  has_loc_fn boolean;
  ids uuid[];
  v_exact_owner_id uuid;
  v_pricing_strategy text;
begin
  loc := lower(nullif(trim(coalesce(p_location, '')), ''));

  if loc in ('airport_pfo','pfo','paphos_airport') then
    loc := 'paphos';
  elsif loc in ('airport_lca','lca','larnaca_airport') then
    loc := 'larnaca';
  end if;

  if p_offer_id is not null then
    begin
      select
        lower(nullif(trim(coalesce(offer.location, '')), '')),
        offer.owner_partner_id,
        offer.pricing_strategy
      into loc, v_exact_owner_id, v_pricing_strategy
      from public.car_offers offer
      where offer.id = p_offer_id
      limit 1;
    exception when others then
      loc := loc;
      v_exact_owner_id := null;
      v_pricing_strategy := null;
    end;
  end if;

  -- Threshold pricing and configured availability are independent of the
  -- legacy location compatibility key. For this strategy, an explicit exact
  -- owner is authoritative when that partner remains active for Cars.
  if p_offer_id is not null
     and v_pricing_strategy = 'threshold_daily_rate'
     and v_exact_owner_id is not null then
    select partner.id
    into pid
    from public.partners partner
    where partner.id = v_exact_owner_id
      and partner.status = 'active'
      and partner.can_manage_cars = true
    limit 1;

    if pid is not null then
      return pid;
    end if;
  end if;

  if loc is null then
    return null;
  end if;

  if loc not in ('paphos','larnaca','all-cyprus') then
    return null;
  end if;

  has_resource_fn := (to_regprocedure('public.partner_service_fulfillment_partner_id_for_resource(text,uuid)') is not null);
  has_loc_fn := (to_regprocedure('public.partner_service_fulfillment_partner_id_for_car_location(text)') is not null);

  pid := null;
  if p_offer_id is not null and has_resource_fn then
    pid := public.partner_service_fulfillment_partner_id_for_resource('cars', p_offer_id);
  end if;

  if pid is not null then
    select partner.id
    into pid
    from public.partners partner
    where partner.id = pid
      and partner.status = 'active'
      and partner.can_manage_cars = true
      and (
        (loc in ('paphos','larnaca') and partner.cars_locations @> array[loc]::text[])
        or (loc = 'all-cyprus' and array_length(partner.cars_locations, 1) is not null)
      )
    limit 1;
  end if;

  if pid is null then
    if has_loc_fn then
      pid := public.partner_service_fulfillment_partner_id_for_car_location(loc);
    else
      ids := null;
      select array_agg(candidate.id)
      into ids
      from (
        select partner.id
        from public.partners partner
        where partner.status = 'active'
          and partner.can_manage_cars = true
          and (
            (loc in ('paphos','larnaca') and partner.cars_locations @> array[loc]::text[])
            or (loc = 'all-cyprus' and array_length(partner.cars_locations, 1) is not null)
          )
        order by partner.created_at asc
        limit 2
      ) candidate;

      if ids is not null and array_length(ids, 1) = 1 then
        pid := ids[1];
      end if;
    end if;
  end if;

  return pid;
end;
$$;

comment on function public.partner_service_fulfillment_partner_id_for_car_booking(uuid, text) is
  'Routes threshold_daily_rate bookings to the active exact offer owner without legacy location coupling; preserves legacy_compat location routing.';

do $$
declare
  v_source text;
begin
  if exists (
    select 1
    from _car_threshold_legacy_partner_routing_before before_state
    where public.partner_service_fulfillment_partner_id_for_car_booking(
      before_state.offer_id,
      (select offer.location from public.car_offers offer where offer.id = before_state.offer_id)
    ) is distinct from before_state.partner_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_exact_owner_legacy_routing_changed';
  end if;

  select procedure.prosrc
  into v_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure(
    'public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)'
  );

  if position('v_pricing_strategy = ''threshold_daily_rate''' in coalesce(v_source, '')) = 0
     or position('partner.id = v_exact_owner_id' in coalesce(v_source, '')) = 0 then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_exact_owner_routing_contract_missing';
  end if;

  if exists (
    select 1
    from public.site_settings setting
    where setting.car_threshold_daily_rates_enabled is true
       or setting.car_multi_city_mapped_enabled is true
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_exact_owner_routing_changed_feature_flags';
  end if;
end
$$;

commit;
