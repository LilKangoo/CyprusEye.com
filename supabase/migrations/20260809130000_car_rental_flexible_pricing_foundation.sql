begin;

-- Stage 3A/3B: additive flexible Cars pricing foundation.
-- Runtime activation remains impossible by default:
--   * every existing offer remains pricing_strategy=legacy_compat
--   * no tier rows are generated
--   * car_threshold_daily_rates_enabled remains false
--   * car_multi_city_mapped_enabled remains false

do $$
declare
  v_missing text[];
begin
  select coalesce(array_agg(name order by name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.car_offers',
    'public.car_offer_city_availability',
    'public.car_pricing_profiles',
    'public.car_pricing_profile_cities',
    'public.car_rental_cities',
    'public.car_vehicle_kinds',
    'public.site_settings'
  ]::text[]) required(name)
  where to_regclass(name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'car_flexible_pricing_required_object_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null
     or to_regprocedure('public.car_multicity_set_updated_at()') is null then
    raise exception using
      errcode = '42883',
      message = 'car_flexible_pricing_required_helper_missing';
  end if;

  if exists (
    select 1 from public.site_settings
    where car_multi_city_mapped_enabled is true
  ) or exists (
    select 1 from public.car_offers
    where availability_mode <> 'legacy'
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_flexible_pricing_requires_inert_multicity_runtime';
  end if;

  if exists (
    select 1 from public.car_offers
    where min_rental_days is null
  ) then
    raise exception using
      errcode = '23502',
      message = 'car_flexible_pricing_min_rental_days_null';
  end if;
end
$$;

alter table public.car_offers
  add column if not exists pricing_strategy text not null default 'legacy_compat',
  add column if not exists engine_capacity_cc integer,
  add column if not exists required_licence_category text,
  add column if not exists minimum_driver_age integer,
  add column if not exists insurance_mode text not null default 'legacy_optional_daily';

alter table public.site_settings
  add column if not exists car_threshold_daily_rates_enabled boolean not null default false;

-- A threshold offer must never leak through the legacy public reader. Admins
-- and owning partners retain operational access; public visibility requires
-- both activation flags and mapped mode for the exact offer.
drop policy if exists car_offers_public_select on public.car_offers;
drop policy if exists car_offers_authenticated_select on public.car_offers;

create policy car_offers_public_select
on public.car_offers
for select
to anon
using (
  is_available is true
  and is_published is true
  and (
    pricing_strategy = 'legacy_compat'
    or (
      pricing_strategy = 'threshold_daily_rate'
      and availability_mode = 'mapped'
      and exists (
        select 1 from public.site_settings setting
        where setting.car_multi_city_mapped_enabled is true
          and setting.car_threshold_daily_rates_enabled is true
      )
    )
  )
);

create policy car_offers_authenticated_select
on public.car_offers
for select
to authenticated
using (
  public.is_current_user_admin()
  or (owner_partner_id is not null and public.is_partner_user(owner_partner_id))
  or (
    is_available is true
    and is_published is true
    and (
      pricing_strategy = 'legacy_compat'
      or (
        pricing_strategy = 'threshold_daily_rate'
        and availability_mode = 'mapped'
        and exists (
          select 1 from public.site_settings setting
          where setting.car_multi_city_mapped_enabled is true
            and setting.car_threshold_daily_rates_enabled is true
        )
      )
    )
  )
);

-- Existing values are intentionally left untouched. Only the structural
-- contract for future reviewed offers changes: minimum is auditable and
-- maximum is optional (NULL means no maximum).
alter table public.car_offers
  alter column min_rental_days set not null,
  alter column max_rental_days drop not null,
  alter column max_rental_days set default null;

alter table public.car_offers
  drop constraint if exists car_offers_pricing_strategy_check,
  drop constraint if exists car_offers_engine_capacity_cc_check,
  drop constraint if exists car_offers_required_licence_category_check,
  drop constraint if exists car_offers_minimum_driver_age_check,
  drop constraint if exists car_offers_insurance_mode_check,
  drop constraint if exists car_offers_rental_days_contract_check;

alter table public.car_offers
  add constraint car_offers_pricing_strategy_check
    check (pricing_strategy in ('legacy_compat', 'threshold_daily_rate')),
  add constraint car_offers_engine_capacity_cc_check
    check (engine_capacity_cc is null or engine_capacity_cc > 0),
  add constraint car_offers_required_licence_category_check
    check (
      required_licence_category is null
      or required_licence_category ~ '^[A-Za-z0-9][A-Za-z0-9+ /-]{0,31}$'
    ),
  add constraint car_offers_minimum_driver_age_check
    check (minimum_driver_age is null or minimum_driver_age between 16 and 99),
  add constraint car_offers_insurance_mode_check
    check (insurance_mode in (
      'legacy_optional_daily',
      'optional_daily',
      'included',
      'not_offered'
    )),
  add constraint car_offers_rental_days_contract_check
    check (
      min_rental_days is not null
      and min_rental_days >= 1
      and (max_rental_days is null or max_rental_days >= min_rental_days)
    );

insert into public.car_vehicle_kinds (
  id,
  code,
  name_i18n,
  is_active,
  sort_order
)
values
  (
    'ca220001-0000-4000-8000-000000000004',
    'scooter',
    '{"pl":"Skuter","en":"Scooter","he":"קטנוע"}'::jsonb,
    true,
    40
  ),
  (
    'ca220001-0000-4000-8000-000000000005',
    'bicycle',
    '{"pl":"Rower","en":"Bicycle","he":"אופניים"}'::jsonb,
    true,
    50
  )
on conflict (code) do update
set
  name_i18n = excluded.name_i18n,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

create table if not exists public.car_offer_daily_rate_tiers (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null,
  threshold_days integer not null,
  daily_rate numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_offer_daily_rate_tiers_offer_fkey
    foreign key (offer_id)
    references public.car_offers(id)
    on delete cascade,
  constraint car_offer_daily_rate_tiers_offer_threshold_key
    unique (offer_id, threshold_days),
  constraint car_offer_daily_rate_tiers_threshold_check
    check (threshold_days > 0),
  constraint car_offer_daily_rate_tiers_daily_rate_check
    check (daily_rate > 0)
);

create index if not exists car_offer_daily_rate_tiers_offer_active_threshold_idx
  on public.car_offer_daily_rate_tiers (offer_id, is_active, threshold_days);

create index if not exists car_offers_pricing_strategy_public_idx
  on public.car_offers (pricing_strategy, is_available, is_published);

drop trigger if exists car_offer_daily_rate_tiers_set_updated_at
on public.car_offer_daily_rate_tiers;
create trigger car_offer_daily_rate_tiers_set_updated_at
before update on public.car_offer_daily_rate_tiers
for each row execute function public.car_multicity_set_updated_at();

create or replace function public.car_validate_daily_rate_tier_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception using errcode = '23514', message = 'car_daily_rate_tier_id_is_immutable';
  end if;
  if tg_op = 'UPDATE' and new.offer_id is distinct from old.offer_id then
    raise exception using errcode = '23514', message = 'car_daily_rate_tier_offer_id_is_immutable';
  end if;
  return new;
end
$$;

drop trigger if exists car_offer_daily_rate_tiers_validate_identity
on public.car_offer_daily_rate_tiers;
create trigger car_offer_daily_rate_tiers_validate_identity
before update on public.car_offer_daily_rate_tiers
for each row execute function public.car_validate_daily_rate_tier_identity();

create or replace function public.car_sync_daily_rate_tier_min_days()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_offer_id uuid := case when tg_op = 'DELETE' then old.offer_id else new.offer_id end;
  v_strategy text;
  v_lowest integer;
  v_max integer;
begin
  select offer.pricing_strategy, offer.max_rental_days
  into v_strategy, v_max
  from public.car_offers offer
  where offer.id = v_offer_id
  for update;

  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select min(tier.threshold_days)
  into v_lowest
  from public.car_offer_daily_rate_tiers tier
  where tier.offer_id = v_offer_id
    and tier.is_active;

  if v_lowest is null then
    if v_strategy = 'threshold_daily_rate' then
      raise exception using
        errcode = '23514',
        message = 'threshold_daily_rate_requires_active_tier';
    end if;
  else
    if v_max is not null and v_max < v_lowest then
      raise exception using
        errcode = '23514',
        message = 'car_offer_max_days_below_lowest_active_tier';
    end if;
    update public.car_offers
    set min_rental_days = v_lowest
    where id = v_offer_id
      and min_rental_days is distinct from v_lowest;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;

drop trigger if exists car_offer_daily_rate_tiers_sync_min
on public.car_offer_daily_rate_tiers;
create trigger car_offer_daily_rate_tiers_sync_min
after insert or update or delete on public.car_offer_daily_rate_tiers
for each row execute function public.car_sync_daily_rate_tier_min_days();

-- Pricing/location decoupling: legacy_compat retains every existing profile
-- invariant. threshold_daily_rate is validated from its exact offer and exact
-- tiers and does not derive city availability from a pricing profile.
create or replace function public.car_multicity_validate_offer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.car_pricing_profiles%rowtype;
  v_lowest integer;
  v_has_pickup boolean;
  v_has_return boolean;
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception using errcode = '23514', message = 'car_offer_id_is_immutable';
  end if;

  if new.pricing_strategy = 'threshold_daily_rate' then
    select min(tier.threshold_days)
    into v_lowest
    from public.car_offer_daily_rate_tiers tier
    where tier.offer_id = new.id
      and tier.is_active;

    if v_lowest is null then
      raise exception using errcode = '23514', message = 'threshold_daily_rate_requires_active_tier';
    end if;
    if new.min_rental_days is distinct from v_lowest then
      raise exception using errcode = '23514', message = 'threshold_daily_rate_min_must_equal_lowest_tier';
    end if;
    if new.max_rental_days is not null and new.max_rental_days < v_lowest then
      raise exception using errcode = '23514', message = 'threshold_daily_rate_max_below_min';
    end if;
  else
    if new.pricing_profile_id is not null then
      select profile.* into v_profile
      from public.car_pricing_profiles profile
      where profile.id = new.pricing_profile_id;

      if not found then
        raise exception using errcode = '23503', message = 'car_offer_pricing_profile_missing';
      end if;
      if v_profile.legacy_booking_location <> lower(btrim(new.location)) then
        raise exception using errcode = '23514', message = 'car_offer_pricing_profile_location_mismatch';
      end if;
    end if;
  end if;

  if new.availability_mode = 'mapped' then
    if new.pricing_strategy = 'legacy_compat' then
      if new.pricing_profile_id is null then
        raise exception using errcode = '23514', message = 'mapped_car_offer_requires_pricing_profile';
      end if;
      if v_profile.is_active is not true then
        raise exception using errcode = '23514', message = 'mapped_car_offer_requires_active_pricing_profile';
      end if;

      select
        exists (
          select 1
          from public.car_offer_city_availability availability
          join public.car_rental_cities city
            on city.id = availability.city_id and city.is_active
          join public.car_pricing_profile_cities mapping
            on mapping.pricing_profile_id = new.pricing_profile_id
           and mapping.city_id = availability.city_id
           and mapping.is_active and mapping.pickup_supported
          where availability.offer_id = new.id
            and availability.is_active and availability.pickup_enabled
            and (
              availability.fee_mode = 'override'
              or (
                v_profile.calculator_key = 'larnaca'
                and mapping.legacy_pricing_city_key in (
                  'larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'
                )
              )
              or (
                v_profile.calculator_key = 'paphos'
                and mapping.legacy_pricing_city_key = 'paphos'
              )
            )
        ),
        exists (
          select 1
          from public.car_offer_city_availability availability
          join public.car_rental_cities city
            on city.id = availability.city_id and city.is_active
          join public.car_pricing_profile_cities mapping
            on mapping.pricing_profile_id = new.pricing_profile_id
           and mapping.city_id = availability.city_id
           and mapping.is_active and mapping.return_supported
          where availability.offer_id = new.id
            and availability.is_active and availability.return_enabled
            and (
              availability.fee_mode = 'override'
              or (
                v_profile.calculator_key = 'larnaca'
                and mapping.legacy_pricing_city_key in (
                  'larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'
                )
              )
              or (
                v_profile.calculator_key = 'paphos'
                and mapping.legacy_pricing_city_key = 'paphos'
              )
            )
        )
      into v_has_pickup, v_has_return;
    else
      select
        exists (
          select 1
          from public.car_offer_city_availability availability
          join public.car_rental_cities city
            on city.id = availability.city_id and city.is_active
          where availability.offer_id = new.id
            and availability.is_active and availability.pickup_enabled
            and (
              availability.fee_mode = 'override'
              or city.code in ('larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos')
            )
        ),
        exists (
          select 1
          from public.car_offer_city_availability availability
          join public.car_rental_cities city
            on city.id = availability.city_id and city.is_active
          where availability.offer_id = new.id
            and availability.is_active and availability.return_enabled
            and (
              availability.fee_mode = 'override'
              or city.code in ('larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos')
            )
        )
      into v_has_pickup, v_has_return;
    end if;

    if not v_has_pickup or not v_has_return then
      raise exception using errcode = '23514', message = 'mapped_car_offer_requires_active_pickup_and_return';
    end if;
  end if;

  return new;
end
$$;

create or replace function public.car_multicity_validate_availability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_strategy text;
  v_profile_id uuid;
  v_offer_mapped boolean;
  v_calculator_key text;
  v_profile_active boolean;
  v_city_active boolean;
  v_city_code text;
  v_mapping_active boolean;
  v_pickup_supported boolean;
  v_return_supported boolean;
  v_pricing_key text;
begin
  select offer.pricing_strategy, offer.pricing_profile_id, offer.availability_mode = 'mapped'
  into v_strategy, v_profile_id, v_offer_mapped
  from public.car_offers offer
  where offer.id = new.offer_id;

  if not found then
    raise exception using errcode = '23503', message = 'car_offer_availability_offer_missing';
  end if;

  select city.is_active, city.code
  into v_city_active, v_city_code
  from public.car_rental_cities city
  where city.id = new.city_id;

  if not found then
    raise exception using errcode = '23503', message = 'car_offer_availability_city_missing';
  end if;

  if not (new.pickup_enabled or new.return_enabled) then
    return new;
  end if;

  if new.is_active and not v_city_active then
    raise exception using errcode = '23514', message = 'active_car_offer_availability_requires_active_city';
  end if;

  if v_strategy = 'threshold_daily_rate' then
    if new.is_active and new.fee_mode = 'inherit'
       and v_city_code not in ('larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos') then
      raise exception using errcode = '23514', message = 'threshold_offer_custom_city_fee_override_required';
    end if;
    return new;
  end if;

  if v_profile_id is null then
    raise exception using errcode = '23514', message = 'car_offer_availability_requires_pricing_profile';
  end if;

  select
    profile.calculator_key,
    profile.is_active,
    mapping.is_active,
    mapping.pickup_supported,
    mapping.return_supported,
    mapping.legacy_pricing_city_key
  into
    v_calculator_key,
    v_profile_active,
    v_mapping_active,
    v_pickup_supported,
    v_return_supported,
    v_pricing_key
  from public.car_pricing_profiles profile
  join public.car_pricing_profile_cities mapping
    on mapping.pricing_profile_id = profile.id and mapping.city_id = new.city_id
  where profile.id = v_profile_id;

  if not found then
    raise exception using errcode = '23514', message = 'car_offer_availability_profile_city_mapping_missing';
  end if;
  if new.pickup_enabled and not v_pickup_supported then
    raise exception using errcode = '23514', message = 'car_offer_pickup_not_supported_by_profile';
  end if;
  if new.return_enabled and not v_return_supported then
    raise exception using errcode = '23514', message = 'car_offer_return_not_supported_by_profile';
  end if;
  if new.is_active and (not v_profile_active or not v_mapping_active) then
    raise exception using errcode = '23514', message = 'active_car_offer_availability_requires_active_mapping';
  end if;
  if v_offer_mapped and new.is_active and new.fee_mode = 'inherit' and not (
    (v_calculator_key = 'larnaca' and v_pricing_key in (
      'larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'
    ))
    or (v_calculator_key = 'paphos' and v_pricing_key = 'paphos')
  ) then
    raise exception using errcode = '23514', message = 'mapped_car_offer_city_fee_override_required';
  end if;

  return new;
end
$$;

create or replace function public.car_multicity_assert_offer_availability_complete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_offer_ids uuid[];
  v_offer_id uuid;
  v_strategy text;
  v_profile_id uuid;
  v_has_pickup boolean;
  v_has_return boolean;
begin
  if tg_op = 'INSERT' then
    v_offer_ids := array[new.offer_id];
  elsif tg_op = 'DELETE' then
    v_offer_ids := array[old.offer_id];
  else
    v_offer_ids := array[new.offer_id, old.offer_id];
  end if;

  foreach v_offer_id in array v_offer_ids loop
    select offer.pricing_strategy, offer.pricing_profile_id
    into v_strategy, v_profile_id
    from public.car_offers offer
    where offer.id = v_offer_id
      and offer.availability_mode = 'mapped';

    if not found then continue; end if;

    if v_strategy = 'threshold_daily_rate' then
      select
        exists (
          select 1
          from public.car_offer_city_availability availability
          join public.car_rental_cities city
            on city.id = availability.city_id and city.is_active
          where availability.offer_id = v_offer_id
            and availability.is_active and availability.pickup_enabled
            and (availability.fee_mode = 'override' or city.code in (
              'larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'
            ))
        ),
        exists (
          select 1
          from public.car_offer_city_availability availability
          join public.car_rental_cities city
            on city.id = availability.city_id and city.is_active
          where availability.offer_id = v_offer_id
            and availability.is_active and availability.return_enabled
            and (availability.fee_mode = 'override' or city.code in (
              'larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'
            ))
        )
      into v_has_pickup, v_has_return;
    else
      select
        exists (
          select 1
          from public.car_offer_city_availability availability
          join public.car_rental_cities city
            on city.id = availability.city_id and city.is_active
          join public.car_pricing_profile_cities mapping
            on mapping.pricing_profile_id = v_profile_id
           and mapping.city_id = availability.city_id
           and mapping.is_active and mapping.pickup_supported
          where availability.offer_id = v_offer_id
            and availability.is_active and availability.pickup_enabled
        ),
        exists (
          select 1
          from public.car_offer_city_availability availability
          join public.car_rental_cities city
            on city.id = availability.city_id and city.is_active
          join public.car_pricing_profile_cities mapping
            on mapping.pricing_profile_id = v_profile_id
           and mapping.city_id = availability.city_id
           and mapping.is_active and mapping.return_supported
          where availability.offer_id = v_offer_id
            and availability.is_active and availability.return_enabled
        )
      into v_has_pickup, v_has_return;
    end if;

    if not v_has_pickup or not v_has_return then
      raise exception using errcode = '23514', message = 'mapped_car_offer_would_lose_pickup_or_return';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;

-- Profile and mapping protection applies only to legacy_compat mapped offers.
-- Threshold pricing availability is exact-offer/city configuration and is not
-- owned by a pricing profile.
create or replace function public.car_multicity_protect_profile_city()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.car_offers offer
      join public.car_offer_city_availability availability
        on availability.offer_id = offer.id
       and availability.city_id = old.city_id
       and availability.is_active
      where offer.pricing_strategy = 'legacy_compat'
        and offer.pricing_profile_id = old.pricing_profile_id
        and offer.availability_mode = 'mapped'
    ) then
      raise exception using errcode = '23514', message = 'car_profile_city_used_by_mapped_offer';
    end if;
    return old;
  end if;

  if exists (
    select 1
    from public.car_offers offer
    join public.car_offer_city_availability availability
      on availability.offer_id = offer.id
     and availability.city_id = old.city_id
     and availability.is_active
    where offer.pricing_strategy = 'legacy_compat'
      and offer.pricing_profile_id = old.pricing_profile_id
      and offer.availability_mode = 'mapped'
      and (
        new.pricing_profile_id is distinct from old.pricing_profile_id
        or new.city_id is distinct from old.city_id
        or new.is_active is not true
        or (availability.pickup_enabled and new.pickup_supported is not true)
        or (availability.return_enabled and new.return_supported is not true)
      )
  ) then
    raise exception using errcode = '23514', message = 'car_profile_city_change_breaks_mapped_offer';
  end if;

  return new;
end
$$;

create or replace function public.car_multicity_protect_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.car_offers offer
      where offer.pricing_strategy = 'legacy_compat'
        and offer.pricing_profile_id = old.id
        and offer.availability_mode = 'mapped'
    ) then
      raise exception using errcode = '23514', message = 'car_pricing_profile_used_by_mapped_offer';
    end if;
    return old;
  end if;

  if new.is_active is not true and old.is_active is true and exists (
    select 1 from public.car_offers offer
    where offer.pricing_strategy = 'legacy_compat'
      and offer.pricing_profile_id = old.id
      and offer.availability_mode = 'mapped'
  ) then
    raise exception using errcode = '23514', message = 'active_mapped_offer_requires_active_pricing_profile';
  end if;

  if new.legacy_booking_location is distinct from old.legacy_booking_location and exists (
    select 1 from public.car_offers offer
    where offer.pricing_strategy = 'legacy_compat'
      and offer.pricing_profile_id = old.id
      and lower(btrim(offer.location)) <> new.legacy_booking_location
  ) then
    raise exception using errcode = '23514', message = 'car_pricing_profile_location_change_conflicts_with_offer';
  end if;

  if new.calculator_key = 'paphos' and exists (
    select 1
    from public.car_pricing_profile_cities mapping
    join public.car_rental_cities city on city.id = mapping.city_id
    where mapping.pricing_profile_id = old.id
      and city.code <> 'paphos'
  ) then
    raise exception using errcode = '23514', message = 'paphos_profile_cross_city_mapping_forbidden';
  end if;

  return new;
end
$$;

drop trigger if exists car_offers_multicity_validate on public.car_offers;
create trigger car_offers_multicity_validate
before insert or update of
  id,
  location,
  pricing_profile_id,
  availability_mode,
  pricing_strategy,
  min_rental_days,
  max_rental_days
on public.car_offers
for each row execute function public.car_multicity_validate_offer();

-- Exact 24-hour duration seam for the next runtime stage. It accepts instants,
-- not timezone-less local strings, so browser and PostgreSQL can share the
-- same elapsed-time contract across Europe/Nicosia DST transitions.
create or replace function public.car_rental_duration_days_24h(
  p_pickup_at timestamptz,
  p_return_at timestamptz
)
returns integer
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case
    when p_return_at <= p_pickup_at then null
    else ceil(extract(epoch from (p_return_at - p_pickup_at)) / 86400.0)::integer
  end
$$;

-- Server-authoritative base-price seam. It is deliberately unused by the
-- current browser flow and returns no row while the feature flag is OFF.
create or replace function public.resolve_car_threshold_daily_rate_quote(
  p_offer_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_submitted_base_price numeric default null
)
returns table (
  offer_id uuid,
  rental_days integer,
  threshold_days integer,
  daily_rate numeric(12,2),
  base_rental_price numeric(12,2),
  currency text,
  submitted_base_matches boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_offer public.car_offers%rowtype;
  v_days integer;
  v_tier public.car_offer_daily_rate_tiers%rowtype;
begin
  if not exists (
    select 1 from public.site_settings setting
    where setting.car_threshold_daily_rates_enabled is true
  ) then
    return;
  end if;

  select offer.* into v_offer
  from public.car_offers offer
  where offer.id = p_offer_id
    and offer.pricing_strategy = 'threshold_daily_rate'
    and offer.is_available is true
    and offer.is_published is true;
  if not found then return; end if;

  v_days := public.car_rental_duration_days_24h(p_pickup_at, p_return_at);
  if v_days is null
     or v_days < v_offer.min_rental_days
     or (v_offer.max_rental_days is not null and v_days > v_offer.max_rental_days) then
    return;
  end if;

  select tier.* into v_tier
  from public.car_offer_daily_rate_tiers tier
  where tier.offer_id = p_offer_id
    and tier.is_active
    and tier.threshold_days <= v_days
  order by tier.threshold_days desc
  limit 1;
  if not found then return; end if;

  offer_id := v_offer.id;
  rental_days := v_days;
  threshold_days := v_tier.threshold_days;
  daily_rate := v_tier.daily_rate;
  base_rental_price := round(v_tier.daily_rate * v_days, 2);
  currency := v_offer.currency;
  submitted_base_matches := p_submitted_base_price is null
    or round(p_submitted_base_price, 2) = base_rental_price;
  return next;
end
$$;

alter table public.car_offer_daily_rate_tiers enable row level security;

revoke all on table public.car_offer_daily_rate_tiers from public, anon, authenticated;
grant select on table public.car_offer_daily_rate_tiers to anon, authenticated;
grant insert, update, delete on table public.car_offer_daily_rate_tiers to authenticated;
grant all privileges on table public.car_offer_daily_rate_tiers to service_role;

drop policy if exists car_offer_daily_rate_tiers_public_read
on public.car_offer_daily_rate_tiers;
drop policy if exists car_offer_daily_rate_tiers_admin_all
on public.car_offer_daily_rate_tiers;

create policy car_offer_daily_rate_tiers_public_read
on public.car_offer_daily_rate_tiers
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.site_settings setting
    where setting.car_multi_city_mapped_enabled is true
      and setting.car_threshold_daily_rates_enabled is true
  )
  and exists (
    select 1 from public.car_offers offer
    where offer.id = car_offer_daily_rate_tiers.offer_id
      and offer.pricing_strategy = 'threshold_daily_rate'
      and offer.availability_mode = 'mapped'
      and offer.is_available is true
      and offer.is_published is true
  )
);

create policy car_offer_daily_rate_tiers_admin_all
on public.car_offer_daily_rate_tiers
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

revoke all on function public.car_validate_daily_rate_tier_identity() from public, anon, authenticated;
revoke all on function public.car_sync_daily_rate_tier_min_days() from public, anon, authenticated;
revoke all on function public.car_rental_duration_days_24h(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.resolve_car_threshold_daily_rate_quote(uuid, timestamptz, timestamptz, numeric) from public, anon, authenticated;
grant execute on function public.car_validate_daily_rate_tier_identity() to service_role;
grant execute on function public.car_sync_daily_rate_tier_min_days() to service_role;
grant execute on function public.car_rental_duration_days_24h(timestamptz, timestamptz) to service_role;
grant execute on function public.resolve_car_threshold_daily_rate_quote(uuid, timestamptz, timestamptz, numeric) to service_role;

comment on column public.car_offers.pricing_strategy is
  'legacy_compat preserves the existing Larnaca/Paphos runtime; threshold_daily_rate selects one exact-offer daily rate threshold for the complete rental duration.';
comment on column public.car_offers.insurance_mode is
  'Exact-offer insurance configuration foundation. legacy_optional_daily preserves the current public wording and behaviour.';
comment on table public.car_offer_daily_rate_tiers is
  'Exact-offer daily rates. The greatest active threshold_days not exceeding rental days applies to every rental day; rates are never blended.';
comment on column public.car_offer_daily_rate_tiers.daily_rate is
  'Daily rate, not total tier price. Base rental price equals daily_rate multiplied by the complete rental-day count.';

do $$
begin
  if exists (
    select 1 from public.car_offers
    where pricing_strategy <> 'legacy_compat'
  ) or exists (
    select 1 from public.car_offer_daily_rate_tiers
  ) or exists (
    select 1 from public.site_settings
    where car_threshold_daily_rates_enabled is true
       or car_multi_city_mapped_enabled is true
  ) or exists (
    select 1 from public.car_offers
    where availability_mode <> 'legacy'
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_flexible_pricing_foundation_not_inert';
  end if;
end
$$;

commit;
