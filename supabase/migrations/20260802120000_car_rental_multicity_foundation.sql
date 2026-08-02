begin;

-- Car Rental Multi-City Stage 2B: additive, inert foundation.
-- The public readers remain unchanged and every existing offer remains legacy.

do $$
declare
  v_missing_objects text[];
  v_invalid_locations bigint;
  v_fingerprint text;
  v_offer_ids text;
  v_offer_count bigint;
begin
  select coalesce(array_agg(required_name order by required_name), '{}'::text[])
  into v_missing_objects
  from unnest(array[
    'public.car_offers',
    'public.site_settings'
  ]::text[]) as required(required_name)
  where to_regclass(required_name) is null;

  if cardinality(v_missing_objects) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'car_multicity_stage2b_required_object_missing',
      detail = array_to_string(v_missing_objects, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception using
      errcode = '42883',
      message = 'car_multicity_stage2b_admin_helper_missing';
  end if;

  select count(*)
  into v_invalid_locations
  from public.car_offers co
  where lower(btrim(coalesce(co.location, ''))) not in ('larnaca', 'paphos');

  if v_invalid_locations > 0 then
    raise exception using
      errcode = '23514',
      message = 'car_multicity_stage2b_unknown_legacy_location',
      detail = format('affected_offers=%s', v_invalid_locations);
  end if;

  select
    count(*)::bigint,
    coalesce(string_agg(co.id::text, ',' order by co.id), ''),
    md5(coalesce(
      string_agg(
        jsonb_build_array(
          co.id,
          co.price_per_day,
          co.price_3days,
          co.price_4_6days,
          co.price_7_10days,
          co.price_10plus_days,
          co.currency,
          co.location,
          co.owner_partner_id,
          co.deposit_amount,
          co.insurance_per_day,
          co.young_driver_fee,
          co.young_driver_cost,
          co.stock_count,
          co.north_allowed,
          co.is_available,
          co.is_published,
          co.submission_status
        )::text,
        E'\n' order by co.id
      ),
      ''
    ))
  into v_offer_count, v_offer_ids, v_fingerprint
  from public.car_offers co;

  perform set_config('cypruseye.car_multicity_stage2b_baseline_offer_count', v_offer_count::text, false);
  perform set_config('cypruseye.car_multicity_stage2b_baseline_offer_ids', v_offer_ids, false);
  perform set_config('cypruseye.car_multicity_stage2b_baseline_fingerprint', v_fingerprint, false);
end
$$;

create table public.car_rental_cities (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name_i18n jsonb not null,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_rental_cities_code_key unique (code),
  constraint car_rental_cities_code_format_check check (
    code = lower(code)
    and code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint car_rental_cities_name_i18n_check check (
    jsonb_typeof(name_i18n) = 'object'
    and jsonb_typeof(name_i18n -> 'pl') = 'string'
    and jsonb_typeof(name_i18n -> 'en') = 'string'
    and jsonb_typeof(name_i18n -> 'he') = 'string'
  ),
  constraint car_rental_cities_sort_order_check check (sort_order >= 0)
);

create table public.car_pricing_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  calculator_key text not null,
  legacy_booking_location text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_pricing_profiles_code_key unique (code),
  constraint car_pricing_profiles_code_format_check check (
    code = lower(code)
    and code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint car_pricing_profiles_calculator_key_check check (
    calculator_key in ('larnaca', 'paphos')
  ),
  constraint car_pricing_profiles_legacy_location_check check (
    legacy_booking_location in ('larnaca', 'paphos')
  ),
  constraint car_pricing_profiles_calculator_location_check check (
    calculator_key = legacy_booking_location
  )
);

create table public.car_vehicle_kinds (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name_i18n jsonb not null,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_vehicle_kinds_code_key unique (code),
  constraint car_vehicle_kinds_code_format_check check (
    code = lower(code)
    and code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint car_vehicle_kinds_name_i18n_check check (
    jsonb_typeof(name_i18n) = 'object'
    and jsonb_typeof(name_i18n -> 'pl') = 'string'
    and jsonb_typeof(name_i18n -> 'en') = 'string'
    and jsonb_typeof(name_i18n -> 'he') = 'string'
  ),
  constraint car_vehicle_kinds_sort_order_check check (sort_order >= 0)
);

insert into public.car_rental_cities (
  id,
  code,
  name_i18n,
  is_active,
  sort_order
)
values
  ('ca200001-0000-4000-8000-000000000001', 'larnaca', '{"pl":"Larnaka","en":"Larnaca","he":"לרנקה"}'::jsonb, true, 10),
  ('ca200001-0000-4000-8000-000000000002', 'nicosia', '{"pl":"Nikozja","en":"Nicosia","he":"ניקוסיה"}'::jsonb, true, 20),
  ('ca200001-0000-4000-8000-000000000003', 'ayia-napa', '{"pl":"Ayia Napa","en":"Ayia Napa","he":"איה נאפה"}'::jsonb, true, 30),
  ('ca200001-0000-4000-8000-000000000004', 'protaras', '{"pl":"Protaras","en":"Protaras","he":"פרוטארס"}'::jsonb, true, 40),
  ('ca200001-0000-4000-8000-000000000005', 'limassol', '{"pl":"Limassol","en":"Limassol","he":"לימסול"}'::jsonb, true, 50),
  ('ca200001-0000-4000-8000-000000000006', 'paphos', '{"pl":"Pafos","en":"Paphos","he":"פאפוס"}'::jsonb, true, 60);

insert into public.car_pricing_profiles (
  id,
  code,
  name,
  calculator_key,
  legacy_booking_location,
  is_active
)
values
  ('ca210001-0000-4000-8000-000000000001', 'larnaca', 'Larnaca legacy pricing profile', 'larnaca', 'larnaca', true),
  ('ca210001-0000-4000-8000-000000000002', 'paphos', 'Paphos legacy pricing profile', 'paphos', 'paphos', true);

insert into public.car_vehicle_kinds (
  id,
  code,
  name_i18n,
  is_active,
  sort_order
)
values
  ('ca220001-0000-4000-8000-000000000001', 'car', '{"pl":"Samochód","en":"Car","he":"רכב"}'::jsonb, true, 10),
  ('ca220001-0000-4000-8000-000000000002', 'quad', '{"pl":"Quad","en":"Quad","he":"טרקטורון"}'::jsonb, true, 20),
  ('ca220001-0000-4000-8000-000000000003', 'buggy', '{"pl":"Buggy","en":"Buggy","he":"באגי"}'::jsonb, true, 30);

alter table public.car_offers
  add column pricing_profile_id uuid,
  add column availability_mode text not null default 'legacy',
  add column vehicle_kind_id uuid not null default 'ca220001-0000-4000-8000-000000000001'::uuid,
  add constraint car_offers_pricing_profile_id_fkey
    foreign key (pricing_profile_id)
    references public.car_pricing_profiles(id)
    on delete restrict,
  add constraint car_offers_vehicle_kind_id_fkey
    foreign key (vehicle_kind_id)
    references public.car_vehicle_kinds(id)
    on delete restrict,
  add constraint car_offers_availability_mode_check
    check (availability_mode in ('legacy', 'mapped'));

alter table public.site_settings
  add column car_multi_city_mapped_enabled boolean not null default false;

create table public.car_pricing_profile_cities (
  pricing_profile_id uuid not null,
  city_id uuid not null,
  pickup_supported boolean not null default false,
  return_supported boolean not null default false,
  legacy_pricing_city_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_pricing_profile_cities_pkey primary key (pricing_profile_id, city_id),
  constraint car_pricing_profile_cities_profile_fkey
    foreign key (pricing_profile_id)
    references public.car_pricing_profiles(id)
    on delete restrict,
  constraint car_pricing_profile_cities_city_fkey
    foreign key (city_id)
    references public.car_rental_cities(id)
    on delete restrict,
  constraint car_pricing_profile_cities_profile_key_unique
    unique (pricing_profile_id, legacy_pricing_city_key),
  constraint car_pricing_profile_cities_legacy_key_check check (
    legacy_pricing_city_key in (
      'larnaca',
      'nicosia',
      'ayia-napa',
      'protaras',
      'limassol',
      'paphos'
    )
  ),
  constraint car_pricing_profile_cities_active_support_check check (
    not is_active or pickup_supported or return_supported
  )
);

insert into public.car_pricing_profile_cities (
  pricing_profile_id,
  city_id,
  pickup_supported,
  return_supported,
  legacy_pricing_city_key,
  is_active
)
values
  ('ca210001-0000-4000-8000-000000000001', 'ca200001-0000-4000-8000-000000000001', true, true, 'larnaca', true),
  ('ca210001-0000-4000-8000-000000000001', 'ca200001-0000-4000-8000-000000000002', true, true, 'nicosia', true),
  ('ca210001-0000-4000-8000-000000000001', 'ca200001-0000-4000-8000-000000000003', true, true, 'ayia-napa', true),
  ('ca210001-0000-4000-8000-000000000001', 'ca200001-0000-4000-8000-000000000004', true, true, 'protaras', true),
  ('ca210001-0000-4000-8000-000000000001', 'ca200001-0000-4000-8000-000000000005', true, true, 'limassol', true),
  ('ca210001-0000-4000-8000-000000000001', 'ca200001-0000-4000-8000-000000000006', true, true, 'paphos', true),
  ('ca210001-0000-4000-8000-000000000002', 'ca200001-0000-4000-8000-000000000006', true, true, 'paphos', true);

create table public.car_offer_city_availability (
  offer_id uuid not null,
  city_id uuid not null,
  pickup_enabled boolean not null default false,
  return_enabled boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_offer_city_availability_pkey primary key (offer_id, city_id),
  constraint car_offer_city_availability_offer_fkey
    foreign key (offer_id)
    references public.car_offers(id)
    on delete cascade,
  constraint car_offer_city_availability_city_fkey
    foreign key (city_id)
    references public.car_rental_cities(id)
    on delete restrict,
  constraint car_offer_city_availability_active_direction_check check (
    not is_active or pickup_enabled or return_enabled
  )
);

create index car_rental_cities_active_sort_idx
  on public.car_rental_cities (is_active, sort_order, code);

create index car_pricing_profiles_active_code_idx
  on public.car_pricing_profiles (is_active, code);

create index car_pricing_profiles_legacy_location_idx
  on public.car_pricing_profiles (legacy_booking_location, is_active);

create index car_vehicle_kinds_active_sort_idx
  on public.car_vehicle_kinds (is_active, sort_order, code);

create index car_pricing_profile_cities_city_active_idx
  on public.car_pricing_profile_cities (city_id, is_active, pricing_profile_id);

create index car_pricing_profile_cities_profile_active_idx
  on public.car_pricing_profile_cities (pricing_profile_id, is_active, city_id);

create index car_offer_city_availability_city_active_idx
  on public.car_offer_city_availability (city_id, is_active, offer_id);

create index car_offer_city_availability_offer_active_idx
  on public.car_offer_city_availability (offer_id, is_active, city_id);

create index car_offers_pricing_profile_idx
  on public.car_offers (pricing_profile_id, location);

create index car_offers_availability_mode_idx
  on public.car_offers (availability_mode, is_available, is_published);

create index car_offers_vehicle_kind_idx
  on public.car_offers (vehicle_kind_id, is_available, is_published);

update public.car_offers co
set pricing_profile_id = profile.id
from public.car_pricing_profiles profile
where profile.legacy_booking_location = lower(btrim(co.location))
  and profile.code in ('larnaca', 'paphos');

create or replace function public.car_multicity_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end
$$;

create or replace function public.car_multicity_validate_offer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.car_pricing_profiles%rowtype;
  v_has_pickup boolean;
  v_has_return boolean;
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception using
      errcode = '23514',
      message = 'car_offer_id_is_immutable';
  end if;

  if new.pricing_profile_id is not null then
    select profile.*
    into v_profile
    from public.car_pricing_profiles profile
    where profile.id = new.pricing_profile_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'car_offer_pricing_profile_missing';
    end if;

    if v_profile.legacy_booking_location <> lower(btrim(new.location)) then
      raise exception using
        errcode = '23514',
        message = 'car_offer_pricing_profile_location_mismatch';
    end if;
  end if;

  if new.availability_mode = 'mapped' then
    if new.pricing_profile_id is null then
      raise exception using
        errcode = '23514',
        message = 'mapped_car_offer_requires_pricing_profile';
    end if;

    if v_profile.is_active is not true then
      raise exception using
        errcode = '23514',
        message = 'mapped_car_offer_requires_active_pricing_profile';
    end if;

    select
      exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.is_active
        join public.car_pricing_profile_cities mapping
          on mapping.pricing_profile_id = new.pricing_profile_id
         and mapping.city_id = availability.city_id
         and mapping.is_active
         and mapping.pickup_supported
        where availability.offer_id = new.id
          and availability.is_active
          and availability.pickup_enabled
      ),
      exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.is_active
        join public.car_pricing_profile_cities mapping
          on mapping.pricing_profile_id = new.pricing_profile_id
         and mapping.city_id = availability.city_id
         and mapping.is_active
         and mapping.return_supported
        where availability.offer_id = new.id
          and availability.is_active
          and availability.return_enabled
      )
    into v_has_pickup, v_has_return;

    if not v_has_pickup or not v_has_return then
      raise exception using
        errcode = '23514',
        message = 'mapped_car_offer_requires_active_pickup_and_return';
    end if;
  end if;

  return new;
end
$$;

create or replace function public.car_multicity_validate_profile_city()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.car_pricing_profiles%rowtype;
  v_city public.car_rental_cities%rowtype;
begin
  select profile.*
  into v_profile
  from public.car_pricing_profiles profile
  where profile.id = new.pricing_profile_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'car_profile_city_profile_missing';
  end if;

  select city.*
  into v_city
  from public.car_rental_cities city
  where city.id = new.city_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'car_profile_city_city_missing';
  end if;

  if new.legacy_pricing_city_key <> v_city.code then
    raise exception using
      errcode = '23514',
      message = 'car_profile_city_legacy_key_mismatch';
  end if;

  if v_profile.calculator_key = 'paphos'
     and (v_city.code <> 'paphos' or new.legacy_pricing_city_key <> 'paphos') then
    raise exception using
      errcode = '23514',
      message = 'paphos_profile_cross_city_mapping_forbidden';
  end if;

  if new.is_active and (not v_profile.is_active or not v_city.is_active) then
    raise exception using
      errcode = '23514',
      message = 'active_car_profile_city_requires_active_parents';
  end if;

  return new;
end
$$;

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
      where offer.pricing_profile_id = old.pricing_profile_id
        and offer.availability_mode = 'mapped'
    ) then
      raise exception using
        errcode = '23514',
        message = 'car_profile_city_used_by_mapped_offer';
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
    where offer.pricing_profile_id = old.pricing_profile_id
      and offer.availability_mode = 'mapped'
      and (
        new.pricing_profile_id is distinct from old.pricing_profile_id
        or new.city_id is distinct from old.city_id
        or new.is_active is not true
        or (availability.pickup_enabled and new.pickup_supported is not true)
        or (availability.return_enabled and new.return_supported is not true)
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_profile_city_change_breaks_mapped_offer';
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
  v_profile_id uuid;
  v_profile_active boolean;
  v_city_active boolean;
  v_mapping_active boolean;
  v_pickup_supported boolean;
  v_return_supported boolean;
begin
  select offer.pricing_profile_id
  into v_profile_id
  from public.car_offers offer
  where offer.id = new.offer_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'car_offer_availability_offer_missing';
  end if;

  if (new.pickup_enabled or new.return_enabled) and v_profile_id is null then
    raise exception using
      errcode = '23514',
      message = 'car_offer_availability_requires_pricing_profile';
  end if;

  if new.pickup_enabled or new.return_enabled then
    select
      profile.is_active,
      city.is_active,
      mapping.is_active,
      mapping.pickup_supported,
      mapping.return_supported
    into
      v_profile_active,
      v_city_active,
      v_mapping_active,
      v_pickup_supported,
      v_return_supported
    from public.car_pricing_profiles profile
    join public.car_pricing_profile_cities mapping
      on mapping.pricing_profile_id = profile.id
     and mapping.city_id = new.city_id
    join public.car_rental_cities city
      on city.id = mapping.city_id
    where profile.id = v_profile_id;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'car_offer_availability_profile_city_mapping_missing';
    end if;

    if new.pickup_enabled and not v_pickup_supported then
      raise exception using
        errcode = '23514',
        message = 'car_offer_pickup_not_supported_by_profile';
    end if;

    if new.return_enabled and not v_return_supported then
      raise exception using
        errcode = '23514',
        message = 'car_offer_return_not_supported_by_profile';
    end if;

    if new.is_active and (not v_profile_active or not v_city_active or not v_mapping_active) then
      raise exception using
        errcode = '23514',
        message = 'active_car_offer_availability_requires_active_mapping';
    end if;
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

  foreach v_offer_id in array v_offer_ids
  loop
    select offer.pricing_profile_id
    into v_profile_id
    from public.car_offers offer
    where offer.id = v_offer_id
      and offer.availability_mode = 'mapped';

    if not found then
      continue;
    end if;

    select
      exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.is_active
        join public.car_pricing_profile_cities mapping
          on mapping.pricing_profile_id = v_profile_id
         and mapping.city_id = availability.city_id
         and mapping.is_active
         and mapping.pickup_supported
        where availability.offer_id = v_offer_id
          and availability.is_active
          and availability.pickup_enabled
      ),
      exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.is_active
        join public.car_pricing_profile_cities mapping
          on mapping.pricing_profile_id = v_profile_id
         and mapping.city_id = availability.city_id
         and mapping.is_active
         and mapping.return_supported
        where availability.offer_id = v_offer_id
          and availability.is_active
          and availability.return_enabled
      )
    into v_has_pickup, v_has_return;

    if not v_has_pickup or not v_has_return then
      raise exception using
        errcode = '23514',
        message = 'mapped_car_offer_would_lose_pickup_or_return';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
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
      select 1
      from public.car_offers offer
      where offer.pricing_profile_id = old.id
        and offer.availability_mode = 'mapped'
    ) then
      raise exception using
        errcode = '23514',
        message = 'car_pricing_profile_used_by_mapped_offer';
    end if;
    return old;
  end if;

  if new.is_active is not true
     and old.is_active is true
     and exists (
       select 1
       from public.car_offers offer
       where offer.pricing_profile_id = old.id
         and offer.availability_mode = 'mapped'
     ) then
    raise exception using
      errcode = '23514',
      message = 'active_mapped_offer_requires_active_pricing_profile';
  end if;

  if new.legacy_booking_location is distinct from old.legacy_booking_location
     and exists (
       select 1
       from public.car_offers offer
       where offer.pricing_profile_id = old.id
         and lower(btrim(offer.location)) <> new.legacy_booking_location
     ) then
    raise exception using
      errcode = '23514',
      message = 'car_pricing_profile_location_change_conflicts_with_offer';
  end if;

  if new.calculator_key = 'paphos'
     and exists (
       select 1
       from public.car_pricing_profile_cities mapping
       join public.car_rental_cities city on city.id = mapping.city_id
       where mapping.pricing_profile_id = old.id
         and city.code <> 'paphos'
     ) then
    raise exception using
      errcode = '23514',
      message = 'paphos_profile_cross_city_mapping_forbidden';
  end if;

  return new;
end
$$;

create or replace function public.car_multicity_protect_city()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE'
     and new.code is distinct from old.code
     and exists (
       select 1
       from public.car_pricing_profile_cities mapping
       where mapping.city_id = old.id
     ) then
    raise exception using
      errcode = '23514',
      message = 'mapped_car_city_code_is_immutable';
  end if;

  if tg_op = 'UPDATE'
     and old.is_active is true
     and new.is_active is not true
     and exists (
       select 1
       from public.car_offer_city_availability availability
       join public.car_offers offer
         on offer.id = availability.offer_id
        and offer.availability_mode = 'mapped'
       where availability.city_id = old.id
         and availability.is_active
     ) then
    raise exception using
      errcode = '23514',
      message = 'car_city_used_by_active_mapped_offer';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$$;

create trigger car_rental_cities_set_updated_at
before update on public.car_rental_cities
for each row execute function public.car_multicity_set_updated_at();

create trigger car_pricing_profiles_set_updated_at
before update on public.car_pricing_profiles
for each row execute function public.car_multicity_set_updated_at();

create trigger car_pricing_profile_cities_set_updated_at
before update on public.car_pricing_profile_cities
for each row execute function public.car_multicity_set_updated_at();

create trigger car_offer_city_availability_set_updated_at
before update on public.car_offer_city_availability
for each row execute function public.car_multicity_set_updated_at();

create trigger car_vehicle_kinds_set_updated_at
before update on public.car_vehicle_kinds
for each row execute function public.car_multicity_set_updated_at();

create trigger car_offers_multicity_validate
before insert or update of id, location, pricing_profile_id, availability_mode
on public.car_offers
for each row execute function public.car_multicity_validate_offer();

create trigger car_pricing_profile_cities_validate
before insert or update
on public.car_pricing_profile_cities
for each row execute function public.car_multicity_validate_profile_city();

create trigger car_pricing_profile_cities_protect
before update or delete
on public.car_pricing_profile_cities
for each row execute function public.car_multicity_protect_profile_city();

create trigger car_offer_city_availability_validate
before insert or update
on public.car_offer_city_availability
for each row execute function public.car_multicity_validate_availability();

create trigger car_offer_city_availability_complete
after insert or update or delete
on public.car_offer_city_availability
for each row execute function public.car_multicity_assert_offer_availability_complete();

create trigger car_pricing_profiles_protect
before update or delete
on public.car_pricing_profiles
for each row execute function public.car_multicity_protect_profile();

create trigger car_rental_cities_protect
before update or delete
on public.car_rental_cities
for each row execute function public.car_multicity_protect_city();

alter table public.car_rental_cities enable row level security;
alter table public.car_pricing_profiles enable row level security;
alter table public.car_pricing_profile_cities enable row level security;
alter table public.car_offer_city_availability enable row level security;
alter table public.car_vehicle_kinds enable row level security;

revoke all on table public.car_rental_cities from public, anon, authenticated;
revoke all on table public.car_pricing_profiles from public, anon, authenticated;
revoke all on table public.car_pricing_profile_cities from public, anon, authenticated;
revoke all on table public.car_offer_city_availability from public, anon, authenticated;
revoke all on table public.car_vehicle_kinds from public, anon, authenticated;

grant select on table public.car_rental_cities to anon, authenticated;
grant select on table public.car_pricing_profiles to anon, authenticated;
grant select on table public.car_pricing_profile_cities to anon, authenticated;
grant select on table public.car_offer_city_availability to anon, authenticated;
grant select on table public.car_vehicle_kinds to anon, authenticated;

grant insert, update, delete on table public.car_rental_cities to authenticated;
grant insert, update, delete on table public.car_pricing_profiles to authenticated;
grant insert, update, delete on table public.car_pricing_profile_cities to authenticated;
grant insert, update, delete on table public.car_offer_city_availability to authenticated;
grant insert, update, delete on table public.car_vehicle_kinds to authenticated;

grant all privileges on table public.car_rental_cities to service_role;
grant all privileges on table public.car_pricing_profiles to service_role;
grant all privileges on table public.car_pricing_profile_cities to service_role;
grant all privileges on table public.car_offer_city_availability to service_role;
grant all privileges on table public.car_vehicle_kinds to service_role;

create policy car_rental_cities_public_read
on public.car_rental_cities
for select
to anon, authenticated
using (is_active);

create policy car_rental_cities_admin_all
on public.car_rental_cities
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy car_pricing_profiles_public_read
on public.car_pricing_profiles
for select
to anon, authenticated
using (is_active);

create policy car_pricing_profiles_admin_all
on public.car_pricing_profiles
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy car_pricing_profile_cities_public_read
on public.car_pricing_profile_cities
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.car_pricing_profiles profile
    where profile.id = pricing_profile_id
      and profile.is_active
  )
  and exists (
    select 1
    from public.car_rental_cities city
    where city.id = city_id
      and city.is_active
  )
);

create policy car_pricing_profile_cities_admin_all
on public.car_pricing_profile_cities
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy car_offer_city_availability_public_read
on public.car_offer_city_availability
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.car_offers offer
    where offer.id = offer_id
      and offer.availability_mode = 'mapped'
      and offer.is_available
      and offer.is_published
  )
);

create policy car_offer_city_availability_admin_all
on public.car_offer_city_availability
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy car_vehicle_kinds_public_read
on public.car_vehicle_kinds
for select
to anon, authenticated
using (is_active);

create policy car_vehicle_kinds_admin_all
on public.car_vehicle_kinds
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

revoke all on function public.car_multicity_set_updated_at() from public, anon, authenticated;
revoke all on function public.car_multicity_validate_offer() from public, anon, authenticated;
revoke all on function public.car_multicity_validate_profile_city() from public, anon, authenticated;
revoke all on function public.car_multicity_protect_profile_city() from public, anon, authenticated;
revoke all on function public.car_multicity_validate_availability() from public, anon, authenticated;
revoke all on function public.car_multicity_assert_offer_availability_complete() from public, anon, authenticated;
revoke all on function public.car_multicity_protect_profile() from public, anon, authenticated;
revoke all on function public.car_multicity_protect_city() from public, anon, authenticated;

grant execute on function public.car_multicity_set_updated_at() to service_role;
grant execute on function public.car_multicity_validate_offer() to service_role;
grant execute on function public.car_multicity_validate_profile_city() to service_role;
grant execute on function public.car_multicity_protect_profile_city() to service_role;
grant execute on function public.car_multicity_validate_availability() to service_role;
grant execute on function public.car_multicity_assert_offer_availability_complete() to service_role;
grant execute on function public.car_multicity_protect_profile() to service_role;
grant execute on function public.car_multicity_protect_city() to service_role;

comment on table public.car_rental_cities is
  'Stage 2B configurable car rental city catalog. Inert until mapped availability is enabled.';
comment on table public.car_pricing_profiles is
  'Stage 2B legacy calculator profiles. calculator_key does not introduce new pricing logic.';
comment on table public.car_pricing_profile_cities is
  'Stage 2B explicit city-to-legacy-pricing-key mappings.';
comment on table public.car_offer_city_availability is
  'Stage 2B pickup and return availability. No existing offers are seeded here.';
comment on table public.car_vehicle_kinds is
  'Stage 2B vehicle classification only; no payment or fulfillment semantics.';
comment on column public.car_offers.availability_mode is
  'legacy preserves the current public reader; mapped is reserved for controlled later rollout.';
comment on column public.site_settings.car_multi_city_mapped_enabled is
  'Global mapped-availability gate. Stage 2B requires false.';

do $$
declare
  v_current_fingerprint text;
  v_current_offer_ids text;
  v_current_offer_count bigint;
  v_baseline_fingerprint text := current_setting('cypruseye.car_multicity_stage2b_baseline_fingerprint', true);
  v_baseline_offer_ids text := current_setting('cypruseye.car_multicity_stage2b_baseline_offer_ids', true);
  v_baseline_offer_count bigint := nullif(
    current_setting('cypruseye.car_multicity_stage2b_baseline_offer_count', true),
    ''
  )::bigint;
begin
  if (select count(*) from public.car_rental_cities) <> 6
     or (select count(*) from public.car_pricing_profiles) <> 2
     or (select count(*) from public.car_pricing_profile_cities) <> 7
     or (select count(*) from public.car_vehicle_kinds) <> 3 then
    raise exception using
      errcode = '23514',
      message = 'car_multicity_stage2b_seed_cardinality_mismatch';
  end if;

  if exists (
    select 1
    from public.car_pricing_profile_cities mapping
    join public.car_pricing_profiles profile on profile.id = mapping.pricing_profile_id
    join public.car_rental_cities city on city.id = mapping.city_id
    where profile.code = 'paphos'
      and (city.code <> 'paphos' or mapping.legacy_pricing_city_key <> 'paphos')
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_multicity_stage2b_paphos_cross_city_seed';
  end if;

  if exists (
    select 1
    from public.car_offers offer
    join public.car_pricing_profiles profile on profile.id = offer.pricing_profile_id
    where profile.legacy_booking_location <> lower(btrim(offer.location))
  ) or exists (
    select 1
    from public.car_offers offer
    where offer.pricing_profile_id is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_multicity_stage2b_offer_profile_backfill_invalid';
  end if;

  if exists (
    select 1
    from public.car_offers offer
    where offer.availability_mode <> 'legacy'
  ) or exists (
    select 1
    from public.car_offer_city_availability
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_multicity_stage2b_foundation_not_inert';
  end if;

  if not exists (
    select 1
    from public.site_settings settings
    where settings.id = 1
      and settings.car_multi_city_mapped_enabled is false
  ) or exists (
    select 1
    from public.site_settings settings
    where settings.car_multi_city_mapped_enabled is true
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_multicity_stage2b_feature_flag_not_false';
  end if;

  select
    count(*)::bigint,
    coalesce(string_agg(co.id::text, ',' order by co.id), ''),
    md5(coalesce(
      string_agg(
        jsonb_build_array(
          co.id,
          co.price_per_day,
          co.price_3days,
          co.price_4_6days,
          co.price_7_10days,
          co.price_10plus_days,
          co.currency,
          co.location,
          co.owner_partner_id,
          co.deposit_amount,
          co.insurance_per_day,
          co.young_driver_fee,
          co.young_driver_cost,
          co.stock_count,
          co.north_allowed,
          co.is_available,
          co.is_published,
          co.submission_status
        )::text,
        E'\n' order by co.id
      ),
      ''
    ))
  into v_current_offer_count, v_current_offer_ids, v_current_fingerprint
  from public.car_offers co;

  if v_baseline_fingerprint is null
     or v_current_fingerprint is distinct from v_baseline_fingerprint
     or v_current_offer_ids is distinct from v_baseline_offer_ids
     or v_current_offer_count is distinct from v_baseline_offer_count then
    raise exception using
      errcode = '23514',
      message = 'car_multicity_stage2b_protected_offer_contract_changed';
  end if;
end
$$;

commit;
