begin;

-- Car Rental Multi-City Admin Pricing V2.
-- Additive per-offer/city delivery fees. The migration is inert while every
-- offer remains legacy and site_settings.car_multi_city_mapped_enabled=false.

do $$
declare
  v_missing text[];
  v_offer_count bigint;
  v_availability_count bigint;
  v_fingerprint text;
  v_availability_fingerprint text;
  v_fee_columns_already_present boolean;
begin
  select coalesce(array_agg(required_name order by required_name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.car_offers',
    'public.car_offer_city_availability',
    'public.car_pricing_profiles',
    'public.car_pricing_profile_cities',
    'public.car_rental_cities',
    'public.site_settings'
  ]::text[]) as required(required_name)
  where to_regclass(required_name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'car_multicity_pricing_v2_required_object_missing',
      detail = array_to_string(v_missing, ',');
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
      message = 'car_multicity_pricing_v2_requires_inert_runtime';
  end if;

  select
    count(*)::bigint,
    md5(coalesce(string_agg(
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
    ), ''))
  into v_offer_count, v_fingerprint
  from public.car_offers co;

  select
    count(*)::bigint,
    md5(coalesce(string_agg(
      jsonb_build_array(
        availability.offer_id,
        availability.city_id,
        availability.pickup_enabled,
        availability.return_enabled,
        availability.is_active,
        availability.created_at,
        availability.updated_at
      )::text,
      E'\n' order by availability.offer_id, availability.city_id
    ), ''))
  into v_availability_count, v_availability_fingerprint
  from public.car_offer_city_availability availability;

  perform set_config('cypruseye.car_pricing_v2_offer_count', v_offer_count::text, true);
  perform set_config('cypruseye.car_pricing_v2_fingerprint', v_fingerprint, true);
  perform set_config('cypruseye.car_pricing_v2_availability_count', v_availability_count::text, true);
  perform set_config('cypruseye.car_pricing_v2_availability_fingerprint', v_availability_fingerprint, true);

  select count(*) = 3
  into v_fee_columns_already_present
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'car_offer_city_availability'
    and column_name in ('fee_mode', 'fee_per_direction', 'fee_note');
  perform set_config(
    'cypruseye.car_pricing_v2_fee_columns_already_present',
    v_fee_columns_already_present::text,
    true
  );
end
$$;

alter table public.car_offer_city_availability
  add column if not exists fee_mode text not null default 'inherit',
  add column if not exists fee_per_direction numeric(10,2),
  add column if not exists fee_note text;

-- A newly inserted catalog city is always inert until an administrator makes
-- a separate, reviewed activation decision. Existing city rows are untouched.
alter table public.car_rental_cities
  alter column is_active set default false;

alter table public.car_offer_city_availability
  drop constraint if exists car_offer_city_availability_fee_mode_check,
  drop constraint if exists car_offer_city_availability_fee_contract_check,
  drop constraint if exists car_offer_city_availability_fee_note_check;

alter table public.car_offer_city_availability
  add constraint car_offer_city_availability_fee_mode_check
    check (fee_mode in ('inherit', 'override')),
  add constraint car_offer_city_availability_fee_contract_check
    check (
      (fee_mode = 'inherit' and fee_per_direction is null)
      or
      (fee_mode = 'override' and fee_per_direction is not null and fee_per_direction >= 0)
    ),
  add constraint car_offer_city_availability_fee_note_check
    check (fee_note is null or char_length(fee_note) <= 500);

-- Keep the exact profile/city key contract, but allow any normalized city slug.
-- Only the six legacy Larnaca keys and Paphos local key have an inherited fee;
-- every other slug requires a per-offer override before mapped activation.
alter table public.car_pricing_profile_cities
  drop constraint if exists car_pricing_profile_cities_legacy_key_check;

alter table public.car_pricing_profile_cities
  add constraint car_pricing_profile_cities_legacy_key_check check (
    legacy_pricing_city_key = lower(legacy_pricing_city_key)
    and legacy_pricing_city_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

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
    raise exception using errcode = '23514', message = 'car_offer_id_is_immutable';
  end if;

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

  if new.availability_mode = 'mapped' then
    if new.pricing_profile_id is null then
      raise exception using errcode = '23514', message = 'mapped_car_offer_requires_pricing_profile';
    end if;

    if v_profile.is_active is not true then
      raise exception using errcode = '23514', message = 'mapped_car_offer_requires_active_pricing_profile';
    end if;

    if exists (
      select 1
      from public.car_offer_city_availability availability
      join public.car_pricing_profile_cities mapping
        on mapping.pricing_profile_id = new.pricing_profile_id
       and mapping.city_id = availability.city_id
      where availability.offer_id = new.id
        and availability.is_active
        and (availability.pickup_enabled or availability.return_enabled)
        and availability.fee_mode = 'inherit'
        and not (
          (v_profile.calculator_key = 'larnaca' and mapping.legacy_pricing_city_key in (
            'larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'
          ))
          or (v_profile.calculator_key = 'paphos' and mapping.legacy_pricing_city_key = 'paphos')
        )
    ) then
      raise exception using errcode = '23514', message = 'mapped_car_offer_city_fee_override_required';
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
      )
    into v_has_pickup, v_has_return;

    if not v_has_pickup or not v_has_return then
      raise exception using errcode = '23514', message = 'mapped_car_offer_requires_active_pickup_and_return';
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
  select profile.* into v_profile
  from public.car_pricing_profiles profile
  where profile.id = new.pricing_profile_id;
  if not found then
    raise exception using errcode = '23503', message = 'car_profile_city_profile_missing';
  end if;

  select city.* into v_city
  from public.car_rental_cities city
  where city.id = new.city_id;
  if not found then
    raise exception using errcode = '23503', message = 'car_profile_city_city_missing';
  end if;

  if new.legacy_pricing_city_key <> v_city.code then
    raise exception using errcode = '23514', message = 'car_profile_city_legacy_key_mismatch';
  end if;

  if v_profile.calculator_key = 'paphos'
     and (v_city.code <> 'paphos' or new.legacy_pricing_city_key <> 'paphos') then
    raise exception using errcode = '23514', message = 'paphos_profile_cross_city_mapping_forbidden';
  end if;

  if new.is_active and (not v_profile.is_active or not v_city.is_active) then
    raise exception using errcode = '23514', message = 'active_car_profile_city_requires_active_parents';
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
  v_offer_mapped boolean;
  v_calculator_key text;
  v_profile_active boolean;
  v_city_active boolean;
  v_mapping_active boolean;
  v_pickup_supported boolean;
  v_return_supported boolean;
  v_pricing_key text;
begin
  select offer.pricing_profile_id, offer.availability_mode = 'mapped'
  into v_profile_id, v_offer_mapped
  from public.car_offers offer
  where offer.id = new.offer_id;

  if not found then
    raise exception using errcode = '23503', message = 'car_offer_availability_offer_missing';
  end if;

  if (new.pickup_enabled or new.return_enabled) and v_profile_id is null then
    raise exception using errcode = '23514', message = 'car_offer_availability_requires_pricing_profile';
  end if;

  if new.pickup_enabled or new.return_enabled then
    select
      profile.calculator_key,
      profile.is_active,
      city.is_active,
      mapping.is_active,
      mapping.pickup_supported,
      mapping.return_supported,
      mapping.legacy_pricing_city_key
    into
      v_calculator_key,
      v_profile_active,
      v_city_active,
      v_mapping_active,
      v_pickup_supported,
      v_return_supported,
      v_pricing_key
    from public.car_pricing_profiles profile
    join public.car_pricing_profile_cities mapping
      on mapping.pricing_profile_id = profile.id and mapping.city_id = new.city_id
    join public.car_rental_cities city on city.id = mapping.city_id
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
    if new.is_active and (not v_profile_active or not v_city_active or not v_mapping_active) then
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
declare
  v_calculator_key text;
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
      raise exception using errcode = '23514', message = 'car_profile_city_used_by_mapped_offer';
    end if;
    return old;
  end if;

  select calculator_key into v_calculator_key
  from public.car_pricing_profiles
  where id = old.pricing_profile_id;

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
        or (
          availability.fee_mode = 'inherit'
          and not (
            (v_calculator_key = 'larnaca' and new.legacy_pricing_city_key in (
              'larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'
            ))
            or (v_calculator_key = 'paphos' and new.legacy_pricing_city_key = 'paphos')
          )
        )
      )
  ) then
    raise exception using errcode = '23514', message = 'car_profile_city_change_breaks_mapped_offer';
  end if;

  return new;
end
$$;

revoke all on function public.car_multicity_validate_offer() from public, anon, authenticated;
revoke all on function public.car_multicity_validate_profile_city() from public, anon, authenticated;
revoke all on function public.car_multicity_validate_availability() from public, anon, authenticated;
revoke all on function public.car_multicity_protect_profile_city() from public, anon, authenticated;
grant execute on function public.car_multicity_validate_offer() to service_role;
grant execute on function public.car_multicity_validate_profile_city() to service_role;
grant execute on function public.car_multicity_validate_availability() to service_role;
grant execute on function public.car_multicity_protect_profile_city() to service_role;

comment on column public.car_offer_city_availability.fee_mode is
  'inherit uses the existing legacy calculator city fee; override uses fee_per_direction for this exact offer and city.';
comment on column public.car_offer_city_availability.fee_per_direction is
  'Exact pickup or return fee for one direction. Zero is an explicit free-delivery override.';
comment on column public.car_offer_city_availability.fee_note is
  'Optional administrator note. Never used by the public price calculator.';

do $$
declare
  v_offer_count bigint;
  v_availability_count bigint;
  v_fingerprint text;
  v_availability_fingerprint text;
begin
  select
    count(*)::bigint,
    md5(coalesce(string_agg(
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
    ), ''))
  into v_offer_count, v_fingerprint
  from public.car_offers co;

  select
    count(*)::bigint,
    md5(coalesce(string_agg(
      jsonb_build_array(
        availability.offer_id,
        availability.city_id,
        availability.pickup_enabled,
        availability.return_enabled,
        availability.is_active,
        availability.created_at,
        availability.updated_at
      )::text,
      E'\n' order by availability.offer_id, availability.city_id
    ), ''))
  into v_availability_count, v_availability_fingerprint
  from public.car_offer_city_availability availability;

  if v_offer_count::text <> current_setting('cypruseye.car_pricing_v2_offer_count', true)
     or v_fingerprint <> current_setting('cypruseye.car_pricing_v2_fingerprint', true)
     or v_availability_count::text <> current_setting('cypruseye.car_pricing_v2_availability_count', true)
     or v_availability_fingerprint <> current_setting('cypruseye.car_pricing_v2_availability_fingerprint', true) then
    raise exception using errcode = '23514', message = 'car_multicity_pricing_v2_protected_data_changed';
  end if;

  if current_setting('cypruseye.car_pricing_v2_fee_columns_already_present', true) = 'false'
     and exists (
    select 1 from public.car_offer_city_availability
    where fee_mode <> 'inherit' or fee_per_direction is not null
  ) then
    raise exception using errcode = '23514', message = 'car_multicity_pricing_v2_existing_fee_defaults_changed';
  end if;

  if exists (select 1 from public.car_offers where availability_mode <> 'legacy')
     or exists (select 1 from public.site_settings where car_multi_city_mapped_enabled is true) then
    raise exception using errcode = '23514', message = 'car_multicity_pricing_v2_runtime_activated';
  end if;
end
$$;

commit;
