-- car-fleet-operations-v1
-- Atomic exact-ID Admin operations for reviewed Cars fleet changes.
--
-- This migration changes no offer, availability, partner, deposit, booking or
-- feature-flag row. The RPC requires a complete optimistic snapshot for every
-- selected offer before it performs the first write. One rejected target rolls
-- back the complete reviewed batch.

begin;

do $prerequisites$
declare
  v_missing text[];
begin
  select coalesce(array_agg(required.name order by required.name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.car_offers',
    'public.car_bookings',
    'public.car_offer_city_availability',
    'public.car_offer_daily_rate_tiers',
    'public.car_rental_cities',
    'public.car_pricing_profiles',
    'public.car_pricing_profile_cities',
    'public.partners',
    'public.partner_resources',
    'public.service_deposit_rules',
    'public.service_deposit_overrides',
    'public.site_settings'
  ]::text[]) required(name)
  where to_regclass(required.name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'car_fleet_operations_required_table_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null
     or to_regprocedure('public.car_threshold_standard_directional_fee(text)') is null
     or to_regprocedure('public.admin_save_car_offer_city_availability_batch(uuid,jsonb,jsonb)') is null
     or to_regprocedure('public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)') is null
     or to_regprocedure('public.car_threshold_offer_route_is_public_eligible(uuid,text,text)') is null then
    raise exception using
      errcode = '42883',
      message = 'car_fleet_operations_required_function_missing';
  end if;

  select coalesce(array_agg(required.contract order by required.contract), '{}'::text[])
  into v_missing
  from unnest(array[
    'car_offers.id',
    'car_offers.updated_at',
    'car_offers.pricing_strategy',
    'car_offers.pricing_profile_id',
    'car_offers.location',
    'car_offers.availability_mode',
    'car_offers.owner_partner_id',
    'car_offers.deposit_amount',
    'car_offer_city_availability.offer_id',
    'car_offer_city_availability.city_id',
    'car_offer_city_availability.pickup_enabled',
    'car_offer_city_availability.return_enabled',
    'car_offer_city_availability.is_active',
    'car_offer_city_availability.fee_mode',
    'car_offer_city_availability.fee_per_direction',
    'car_offer_city_availability.fee_note',
    'car_offer_city_availability.updated_at',
    'service_deposit_overrides.id',
    'service_deposit_overrides.resource_type',
    'service_deposit_overrides.resource_id',
    'service_deposit_overrides.mode',
    'service_deposit_overrides.amount',
    'service_deposit_overrides.currency',
    'service_deposit_overrides.include_children',
    'service_deposit_overrides.enabled',
    'service_deposit_overrides.updated_at',
    'partners.cars_locations',
    'site_settings.car_multi_city_mapped_enabled',
    'site_settings.car_threshold_daily_rates_enabled'
  ]::text[]) required(contract)
  where not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = split_part(required.contract, '.', 1)
      and column_info.column_name = split_part(required.contract, '.', 2)
  );

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42703',
      message = 'car_fleet_operations_required_column_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if (select count(*) from public.site_settings) <> 1
     or not exists (select 1 from public.site_settings where id = 1) then
    raise exception using
      errcode = '23514',
      message = 'car_fleet_operations_site_settings_contract_invalid';
  end if;
end
$prerequisites$;

lock table public.site_settings in share mode;
lock table public.car_offers in share mode;
lock table public.car_offer_city_availability in share mode;
lock table public.service_deposit_overrides in share mode;

-- A single predicate shared by row validation, mapped completeness validation,
-- batch preflight and mapped-legacy booking admission. Exact configured rows
-- own the direction. An explicit per-offer override is valid for any active
-- catalog city. Inherited legacy pricing retains the calculator's supported
-- fee keys, but profile-city direction flags never own mapped availability.
create or replace function public.car_multicity_directional_availability_is_valid(
  p_pricing_strategy text,
  p_availability_mode text,
  p_pricing_profile_id uuid,
  p_city_id uuid,
  p_direction text,
  p_row_active boolean,
  p_fee_mode text,
  p_fee_per_direction numeric
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with contract as (
    select
      lower(btrim(coalesce(p_pricing_strategy, 'legacy_compat'))) as strategy,
      lower(btrim(coalesce(p_availability_mode, 'legacy'))) as availability_mode,
      lower(btrim(coalesce(p_direction, ''))) as direction,
      lower(btrim(coalesce(p_fee_mode, ''))) as fee_mode
  ),
  catalog as (
    select city.id, city.code, city.is_active
    from public.car_rental_cities city
    where city.id = p_city_id
  ),
  legacy_profile as (
    select
      profile.id as profile_id,
      profile.calculator_key,
      profile.is_active as profile_active,
      coalesce(
        case when mapping.is_active then mapping.legacy_pricing_city_key end,
        catalog.code
      ) as legacy_pricing_city_key
    from public.car_pricing_profiles profile
    cross join catalog
    left join public.car_pricing_profile_cities mapping
      on mapping.pricing_profile_id = profile.id
     and mapping.city_id = p_city_id
    where profile.id = p_pricing_profile_id
  )
  select coalesce(
    contract.direction in ('pickup', 'return')
    and catalog.id is not null
    and p_row_active is true
    and catalog.is_active is true
    and (
      (
        contract.fee_mode = 'override'
        and p_fee_per_direction is not null
        and p_fee_per_direction >= 0
        -- A custom exact fee is configuration-only while a legacy offer is
        -- still in legacy mode. Its customer-facing legacy resolver is not
        -- changed by storing that inert future row.
      )
      or (
        contract.fee_mode = 'inherit'
        and p_fee_per_direction is null
        and (
          (
            contract.strategy = 'threshold_daily_rate'
            and public.car_threshold_standard_directional_fee(catalog.code) is not null
          )
          or (
            contract.strategy = 'legacy_compat'
            and legacy_profile.profile_id is not null
            and legacy_profile.profile_active
            and (
              (
                legacy_profile.calculator_key = 'larnaca'
                and legacy_profile.legacy_pricing_city_key in (
                  'larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'
                )
              )
              or (
                legacy_profile.calculator_key = 'paphos'
                and legacy_profile.legacy_pricing_city_key = 'paphos'
              )
            )
          )
        )
      )
    ),
    false
  )
  from contract
  left join catalog on true
  left join legacy_profile on true
$$;

comment on function public.car_multicity_directional_availability_is_valid(
  text, text, uuid, uuid, text, boolean, text, numeric
) is
  'Validates one active exact offer-city direction and fee. Exact rows own directions; inherit retains only the existing calculator pricing-key contract.';

-- Preserve legacy pricing/profile invariants. For mapped offers, exact active
-- rows determine pickup and return independently. Legacy+legacy public runtime
-- remains unchanged because stored availability rows stay inert in that mode.
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
    end if;

    select
      exists (
        select 1
        from public.car_offer_city_availability availability
        where availability.offer_id = new.id
          and availability.is_active
          and availability.pickup_enabled
          and public.car_multicity_directional_availability_is_valid(
            new.pricing_strategy,
            'mapped',
            new.pricing_profile_id,
            availability.city_id,
            'pickup',
            true,
            availability.fee_mode,
            availability.fee_per_direction
          )
      ),
      exists (
        select 1
        from public.car_offer_city_availability availability
        where availability.offer_id = new.id
          and availability.is_active
          and availability.return_enabled
          and public.car_multicity_directional_availability_is_valid(
            new.pricing_strategy,
            'mapped',
            new.pricing_profile_id,
            availability.city_id,
            'return',
            true,
            availability.fee_mode,
            availability.fee_per_direction
          )
      )
    into v_has_pickup, v_has_return;

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
  v_offer public.car_offers%rowtype;
begin
  select offer.*
  into v_offer
  from public.car_offers offer
  where offer.id = new.offer_id;

  if not found then
    raise exception using errcode = '23503', message = 'car_offer_availability_offer_missing';
  end if;

  if not (new.pickup_enabled or new.return_enabled) then
    return new;
  end if;

  if new.pickup_enabled and not public.car_multicity_directional_availability_is_valid(
    v_offer.pricing_strategy,
    v_offer.availability_mode,
    v_offer.pricing_profile_id,
    new.city_id,
    'pickup',
    new.is_active,
    new.fee_mode,
    new.fee_per_direction
  ) then
    raise exception using errcode = '23514', message = 'car_offer_pickup_or_fee_contract_invalid';
  end if;

  if new.return_enabled and not public.car_multicity_directional_availability_is_valid(
    v_offer.pricing_strategy,
    v_offer.availability_mode,
    v_offer.pricing_profile_id,
    new.city_id,
    'return',
    new.is_active,
    new.fee_mode,
    new.fee_per_direction
  ) then
    raise exception using errcode = '23514', message = 'car_offer_return_or_fee_contract_invalid';
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
  v_offer public.car_offers%rowtype;
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
    select offer.*
    into v_offer
    from public.car_offers offer
    where offer.id = v_offer_id
      and offer.availability_mode = 'mapped';

    if not found then continue; end if;

    select
      exists (
        select 1
        from public.car_offer_city_availability availability
        where availability.offer_id = v_offer_id
          and availability.is_active
          and availability.pickup_enabled
          and public.car_multicity_directional_availability_is_valid(
            v_offer.pricing_strategy,
            'mapped',
            v_offer.pricing_profile_id,
            availability.city_id,
            'pickup',
            true,
            availability.fee_mode,
            availability.fee_per_direction
          )
      ),
      exists (
        select 1
        from public.car_offer_city_availability availability
        where availability.offer_id = v_offer_id
          and availability.is_active
          and availability.return_enabled
          and public.car_multicity_directional_availability_is_valid(
            v_offer.pricing_strategy,
            'mapped',
            v_offer.pricing_profile_id,
            availability.city_id,
            'return',
            true,
            availability.fee_mode,
            availability.fee_per_direction
          )
      )
    into v_has_pickup, v_has_return;

    if not v_has_pickup or not v_has_return then
      raise exception using errcode = '23514', message = 'mapped_car_offer_would_lose_pickup_or_return';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;

-- Profile-city rows may still supply an inherited legacy fee key, but their
-- pickup_supported/return_supported flags are no longer availability gates.
-- Protect only pricing-key changes that could silently alter a live mapped
-- legacy quote; directional support metadata may change independently.
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
       and availability.fee_mode = 'inherit'
      where offer.pricing_strategy = 'legacy_compat'
        and offer.pricing_profile_id = old.pricing_profile_id
        and offer.availability_mode = 'mapped'
    ) then
      raise exception using errcode = '23514', message = 'car_profile_city_pricing_key_used_by_mapped_offer';
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
     and availability.fee_mode = 'inherit'
    where offer.pricing_strategy = 'legacy_compat'
      and offer.pricing_profile_id = old.pricing_profile_id
      and offer.availability_mode = 'mapped'
      and (
        new.pricing_profile_id is distinct from old.pricing_profile_id
        or new.city_id is distinct from old.city_id
        or new.is_active is not true
        or new.legacy_pricing_city_key is distinct from old.legacy_pricing_city_key
      )
  ) then
    raise exception using errcode = '23514', message = 'car_profile_city_pricing_change_breaks_mapped_offer';
  end if;

  return new;
end
$$;

-- A legacy-priced offer that opts into configured availability is admitted by
-- its exact directional rows, mapped capability, fee contract and the existing
-- legacy partner resolver. A legacy+legacy offer never enters this helper.
create or replace function public.car_mapped_legacy_offer_route_is_booking_eligible(
  p_offer_id uuid,
  p_pickup_city_code text,
  p_return_city_code text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with normalized as (
    select
      lower(btrim(coalesce(p_pickup_city_code, ''))) as pickup_code,
      lower(btrim(coalesce(p_return_city_code, ''))) as return_code
  )
  select coalesce(exists (
    select 1
    from public.car_offers offer
    join public.site_settings setting
      on setting.id = 1
     and setting.car_multi_city_mapped_enabled
    cross join normalized
    where offer.id = p_offer_id
      and offer.pricing_strategy = 'legacy_compat'
      and offer.availability_mode = 'mapped'
      and offer.is_available
      and offer.is_published
      and normalized.pickup_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      and normalized.return_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      and public.partner_service_fulfillment_partner_id_for_car_booking(
        offer.id,
        offer.location
      ) is not null
      and exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.code = normalized.pickup_code
        where availability.offer_id = offer.id
          and availability.is_active
          and availability.pickup_enabled
          and public.car_multicity_directional_availability_is_valid(
            offer.pricing_strategy,
            'mapped',
            offer.pricing_profile_id,
            availability.city_id,
            'pickup',
            true,
            availability.fee_mode,
            availability.fee_per_direction
          )
      )
      and exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.code = normalized.return_code
        where availability.offer_id = offer.id
          and availability.is_active
          and availability.return_enabled
          and public.car_multicity_directional_availability_is_valid(
            offer.pricing_strategy,
            'mapped',
            offer.pricing_profile_id,
            availability.city_id,
            'return',
            true,
            availability.fee_mode,
            availability.fee_per_direction
          )
      )
  ), false)
$$;

comment on function public.car_mapped_legacy_offer_route_is_booking_eligible(uuid, text, text) is
  'Fail-closed booking admission for legacy_compat + mapped only. It validates requestability and never changes booking, payment or fulfillment status.';

create or replace function public.car_threshold_booking_public_eligibility_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_strategy text;
  v_availability_mode text;
begin
  if new.offer_id is null then
    return new;
  end if;

  select offer.pricing_strategy, offer.availability_mode
  into v_strategy, v_availability_mode
  from public.car_offers offer
  where offer.id = new.offer_id;

  if v_strategy = 'threshold_daily_rate'
     and not public.car_threshold_offer_route_is_public_eligible(
       new.offer_id,
       new.pickup_city_code,
       new.return_city_code
     ) then
    raise exception using
      errcode = '23514',
      message = 'threshold_booking_offer_or_route_not_public_eligible';
  elsif v_strategy = 'legacy_compat'
        and v_availability_mode = 'mapped'
        and not public.car_mapped_legacy_offer_route_is_booking_eligible(
          new.offer_id,
          new.pickup_city_code,
          new.return_city_code
        ) then
    raise exception using
      errcode = '23514',
      message = 'mapped_legacy_booking_offer_or_route_not_public_eligible';
  end if;

  -- Price/route validity never represents partner acceptance. Existing status,
  -- payment status and fulfillment pending_acceptance lifecycle are untouched.
  return new;
end
$$;

comment on function public.car_threshold_booking_public_eligibility_guard() is
  'Fail-closed threshold and mapped-legacy booking admission. It never confirms or accepts a reservation.';

-- Input contract (one object per exact offer):
-- {
--   "offer_id": uuid,
--   "expected_offer_updated_at": timestamptz,
--   "expected_availability_rows": [{"city_id": uuid, "updated_at": timestamptz}],
--   "expected_deposit_override": null | {"id": uuid, "updated_at": timestamptz},
--   "desired_availability_rows"?: [{city_id,pickup_enabled,return_enabled,fee_mode,fee_per_direction?,fee_note?}],
--   "offer_patch"?: {availability_mode?,deposit_amount?,owner_partner_id?},
--   "deposit_override"?: {action: default|remove|flat|per_day|percent_total,amount?,currency?,include_children?}
-- }
create or replace function public.car_fleet_apply_reviewed_operations_internal(
  p_operations jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_request_role text;
  v_operation jsonb;
  v_offer_id uuid;
  v_expected_offer_updated_at timestamptz;
  v_expected_rows jsonb;
  v_expected_deposit jsonb;
  v_desired_rows jsonb;
  v_patch jsonb;
  v_deposit_change jsonb;
  v_offer public.car_offers%rowtype;
  v_override public.service_deposit_overrides%rowtype;
  v_override_found boolean;
  v_target_mode text;
  v_target_owner_id uuid;
  v_deposit_action text;
  v_amount numeric;
  v_currency text;
  v_include_children boolean;
  v_operation_count integer;
  v_locked_count integer;
  v_flags_before jsonb;
  v_protected_before text;
  v_protected_after text;
  v_receipt jsonb;
begin
  begin
    v_request_role := coalesce(
      nullif(auth.jwt() ->> 'role', ''),
      nullif(current_setting('request.jwt.claim.role', true), '')
    );
  exception when others then
    v_request_role := null;
  end;

  if not public.is_current_user_admin()
     and v_request_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'car_fleet_operations_admin_required';
  end if;

  if p_operations is null
     or jsonb_typeof(p_operations) <> 'array'
     or jsonb_array_length(p_operations) < 1
     or jsonb_array_length(p_operations) > 250 then
    raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_batch';
  end if;

  v_operation_count := jsonb_array_length(p_operations);

  -- Structural preflight: no table is written and no caller-controlled object
  -- may contain an unreviewed field.
  for v_operation in
    select operation.value
    from jsonb_array_elements(p_operations) operation(value)
  loop
    if jsonb_typeof(v_operation) <> 'object'
       or not (v_operation ? 'offer_id')
       or not (v_operation ? 'expected_offer_updated_at')
       or not (v_operation ? 'expected_availability_rows')
       or not (v_operation ? 'expected_deposit_override')
       or exists (
         select 1
         from jsonb_object_keys(v_operation) field(name)
         where field.name not in (
           'offer_id',
           'expected_offer_updated_at',
           'expected_availability_rows',
           'expected_deposit_override',
           'desired_availability_rows',
           'offer_patch',
           'deposit_override'
         )
       ) then
      raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_operation_shape';
    end if;

    begin
      v_offer_id := (v_operation ->> 'offer_id')::uuid;
      v_expected_offer_updated_at := (v_operation ->> 'expected_offer_updated_at')::timestamptz;
    exception when others then
      raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_offer_identity';
    end;

    if v_offer_id is null or v_expected_offer_updated_at is null then
      raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_offer_identity';
    end if;

    v_expected_rows := v_operation -> 'expected_availability_rows';
    if jsonb_typeof(v_expected_rows) <> 'array'
       or exists (
         select 1
         from jsonb_array_elements(v_expected_rows) expected(row_value)
         where jsonb_typeof(expected.row_value) <> 'object'
            or not (expected.row_value ? 'city_id')
            or not (expected.row_value ? 'updated_at')
            or exists (
              select 1
              from jsonb_object_keys(expected.row_value) expected_field(name)
              where expected_field.name not in ('city_id', 'updated_at')
            )
       ) then
      raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_expected_availability';
    end if;

    begin
      if exists (
        select 1
        from jsonb_to_recordset(v_expected_rows) expected(city_id uuid, updated_at timestamptz)
        where expected.city_id is null or expected.updated_at is null
      ) or (
        select count(*)
        from jsonb_to_recordset(v_expected_rows) expected(city_id uuid)
      ) <> (
        select count(distinct expected.city_id)
        from jsonb_to_recordset(v_expected_rows) expected(city_id uuid)
      ) then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_expected_availability';
      end if;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_expected_availability';
    end;

    v_expected_deposit := v_operation -> 'expected_deposit_override';
    if v_expected_deposit <> 'null'::jsonb and (
      jsonb_typeof(v_expected_deposit) <> 'object'
      or not (v_expected_deposit ? 'id')
      or not (v_expected_deposit ? 'updated_at')
      or exists (
        select 1
        from jsonb_object_keys(v_expected_deposit) expected_deposit_field(name)
        where expected_deposit_field.name not in ('id', 'updated_at')
      )
    ) then
      raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_expected_deposit';
    end if;

    if v_expected_deposit <> 'null'::jsonb then
      begin
        if (v_expected_deposit ->> 'id')::uuid is null
           or (v_expected_deposit ->> 'updated_at')::timestamptz is null then
          raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_expected_deposit';
        end if;
      exception when invalid_text_representation or datetime_field_overflow then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_expected_deposit';
      end;
    end if;

    v_patch := coalesce(v_operation -> 'offer_patch', '{}'::jsonb);
    if jsonb_typeof(v_patch) <> 'object'
       or exists (
         select 1
         from jsonb_object_keys(v_patch) patch_field(name)
         where patch_field.name not in ('availability_mode', 'deposit_amount', 'owner_partner_id')
       ) then
      raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_offer_patch';
    end if;

    if v_patch ? 'availability_mode'
       and coalesce(v_patch ->> 'availability_mode', '') not in ('legacy', 'mapped') then
      raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_availability_mode';
    end if;

    if v_patch ? 'deposit_amount' then
      if jsonb_typeof(v_patch -> 'deposit_amount') not in ('number', 'null') then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_security_deposit';
      end if;
      if jsonb_typeof(v_patch -> 'deposit_amount') = 'number' then
        v_amount := (v_patch ->> 'deposit_amount')::numeric;
        if v_amount < 0 or v_amount >= 100000000 or v_amount <> round(v_amount, 2) then
          raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_security_deposit';
        end if;
      end if;
    end if;

    if v_patch ? 'owner_partner_id' then
      begin
        v_target_owner_id := (v_patch ->> 'owner_partner_id')::uuid;
      exception when others then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_owner_partner';
      end;
      if v_target_owner_id is null then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_owner_partner';
      end if;
    end if;

    if v_operation ? 'desired_availability_rows' then
      v_desired_rows := v_operation -> 'desired_availability_rows';
      if jsonb_typeof(v_desired_rows) <> 'array'
         or exists (
           select 1
           from jsonb_array_elements(v_desired_rows) desired(row_value)
           where jsonb_typeof(desired.row_value) <> 'object'
              or not (desired.row_value ? 'city_id')
              or not (desired.row_value ? 'pickup_enabled')
              or not (desired.row_value ? 'return_enabled')
              or not (desired.row_value ? 'fee_mode')
              or exists (
                select 1
                from jsonb_object_keys(desired.row_value) desired_field(name)
                where desired_field.name not in (
                  'city_id', 'pickup_enabled', 'return_enabled',
                  'fee_mode', 'fee_per_direction', 'fee_note'
                )
              )
         ) then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_desired_availability';
      end if;

      begin
        if exists (
          select 1
          from jsonb_to_recordset(v_desired_rows) desired(
            city_id uuid,
            pickup_enabled boolean,
            return_enabled boolean,
            fee_mode text,
            fee_per_direction numeric,
            fee_note text
          )
          where desired.city_id is null
             or desired.pickup_enabled is null
             or desired.return_enabled is null
             or desired.fee_mode not in ('inherit', 'override')
             or (desired.fee_mode = 'inherit' and desired.fee_per_direction is not null)
             or (desired.fee_mode = 'override' and (
               desired.fee_per_direction is null
               or desired.fee_per_direction < 0
               or desired.fee_per_direction >= 100000000
               or desired.fee_per_direction <> round(desired.fee_per_direction, 2)
             ))
             or (desired.fee_note is not null and char_length(desired.fee_note) > 500)
        ) or (
          select count(*)
          from jsonb_to_recordset(v_desired_rows) desired(city_id uuid)
        ) <> (
          select count(distinct desired.city_id)
          from jsonb_to_recordset(v_desired_rows) desired(city_id uuid)
        ) then
          raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_desired_availability';
        end if;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_desired_availability';
      end;
    end if;

    if v_operation ? 'deposit_override' then
      v_deposit_change := v_operation -> 'deposit_override';
      if jsonb_typeof(v_deposit_change) <> 'object'
         or not (v_deposit_change ? 'action')
         or exists (
           select 1
           from jsonb_object_keys(v_deposit_change) deposit_field(name)
           where deposit_field.name not in ('action', 'amount', 'currency', 'include_children')
         ) then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_deposit_override';
      end if;

      v_deposit_action := lower(btrim(coalesce(v_deposit_change ->> 'action', '')));
      if v_deposit_action not in ('default', 'remove', 'flat', 'per_day', 'percent_total') then
        raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_deposit_action';
      end if;

      if v_deposit_action in ('default', 'remove') then
        if exists (
          select 1 from jsonb_object_keys(v_deposit_change) field(name)
          where field.name <> 'action'
        ) then
          raise exception using errcode = '22023', message = 'car_fleet_operations_remove_deposit_has_values';
        end if;
      else
        if not (v_deposit_change ? 'amount')
           or jsonb_typeof(v_deposit_change -> 'amount') <> 'number'
           or (v_deposit_change ? 'currency' and jsonb_typeof(v_deposit_change -> 'currency') <> 'string')
           or (v_deposit_change ? 'include_children' and jsonb_typeof(v_deposit_change -> 'include_children') <> 'boolean') then
          raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_deposit_values';
        end if;
        v_amount := (v_deposit_change ->> 'amount')::numeric;
        v_currency := upper(btrim(coalesce(v_deposit_change ->> 'currency', 'EUR')));
        if v_amount <= 0
           or v_amount >= 10000000000
           or v_amount <> round(v_amount, 2)
           or (v_deposit_action = 'percent_total' and v_amount > 100)
           or v_currency !~ '^[A-Z]{3}$' then
          raise exception using errcode = '22023', message = 'car_fleet_operations_invalid_deposit_values';
        end if;
      end if;
    end if;

    if not (v_operation ? 'desired_availability_rows')
       and v_patch = '{}'::jsonb
       and not (v_operation ? 'deposit_override') then
      raise exception using errcode = '22023', message = 'car_fleet_operations_empty_operation';
    end if;
  end loop;

  if (
    select count(*)
    from jsonb_array_elements(p_operations) operation(value)
  ) <> (
    select count(distinct (operation.value ->> 'offer_id')::uuid)
    from jsonb_array_elements(p_operations) operation(value)
  ) then
    raise exception using errcode = '22023', message = 'car_fleet_operations_duplicate_offer_id';
  end if;

  -- Lock every reviewed object in deterministic order, then revalidate every
  -- complete snapshot. No mutation occurs before the entire batch passes.
  perform offer.id
  from public.car_offers offer
  join (
    select (operation.value ->> 'offer_id')::uuid as offer_id
    from jsonb_array_elements(p_operations) operation(value)
  ) target on target.offer_id = offer.id
  order by offer.id
  for update;

  select count(*)
  into v_locked_count
  from public.car_offers offer
  where offer.id in (
    select (operation.value ->> 'offer_id')::uuid
    from jsonb_array_elements(p_operations) operation(value)
  );
  if v_locked_count <> v_operation_count then
    raise exception using errcode = 'P0002', message = 'car_fleet_operations_offer_missing';
  end if;

  perform availability.offer_id
  from public.car_offer_city_availability availability
  where availability.offer_id in (
    select (operation.value ->> 'offer_id')::uuid
    from jsonb_array_elements(p_operations) operation(value)
  )
  order by availability.offer_id, availability.city_id
  for update;

  perform override_row.id
  from public.service_deposit_overrides override_row
  where override_row.resource_type = 'cars'
    and override_row.resource_id in (
      select (operation.value ->> 'offer_id')::uuid
      from jsonb_array_elements(p_operations) operation(value)
    )
  order by override_row.resource_id
  for update;

  perform partner.id
  from public.partners partner
  where partner.id in (
    select (operation.value -> 'offer_patch' ->> 'owner_partner_id')::uuid
    from jsonb_array_elements(p_operations) operation(value)
    where (operation.value -> 'offer_patch') ? 'owner_partner_id'
  )
  order by partner.id
  for share;

  perform setting.id
  from public.site_settings setting
  where setting.id = 1
  for share;

  select to_jsonb(setting)
  into v_flags_before
  from public.site_settings setting
  where setting.id = 1;

  select md5(coalesce(string_agg(
    (
      to_jsonb(offer)
      - array['updated_at', 'availability_mode', 'owner_partner_id', 'deposit_amount']::text[]
    )::text,
    E'\n' order by offer.id
  ), ''))
  into v_protected_before
  from public.car_offers offer
  where offer.id in (
    select (operation.value ->> 'offer_id')::uuid
    from jsonb_array_elements(p_operations) operation(value)
  );

  for v_operation in
    select operation.value
    from jsonb_array_elements(p_operations) operation(value)
    order by (operation.value ->> 'offer_id')::uuid
  loop
    v_offer_id := (v_operation ->> 'offer_id')::uuid;
    v_expected_offer_updated_at := (v_operation ->> 'expected_offer_updated_at')::timestamptz;
    v_expected_rows := v_operation -> 'expected_availability_rows';
    v_expected_deposit := v_operation -> 'expected_deposit_override';
    v_patch := coalesce(v_operation -> 'offer_patch', '{}'::jsonb);

    select offer.* into strict v_offer
    from public.car_offers offer
    where offer.id = v_offer_id;

    if v_offer.updated_at is distinct from v_expected_offer_updated_at then
      raise exception using errcode = '40001', message = 'car_fleet_operations_stale_offer';
    end if;

    if jsonb_array_length(v_expected_rows) <> (
      select count(*)
      from public.car_offer_city_availability availability
      where availability.offer_id = v_offer_id
    ) or exists (
      select 1
      from jsonb_to_recordset(v_expected_rows) expected(city_id uuid, updated_at timestamptz)
      left join public.car_offer_city_availability availability
        on availability.offer_id = v_offer_id
       and availability.city_id = expected.city_id
      where availability.offer_id is null
         or availability.updated_at is distinct from expected.updated_at
    ) then
      raise exception using errcode = '40001', message = 'car_fleet_operations_stale_availability';
    end if;

    select override_row.*
    into v_override
    from public.service_deposit_overrides override_row
    where override_row.resource_type = 'cars'
      and override_row.resource_id = v_offer_id;
    v_override_found := found;

    if v_expected_deposit = 'null'::jsonb then
      if v_override_found then
        raise exception using errcode = '40001', message = 'car_fleet_operations_stale_deposit_override';
      end if;
    elsif not v_override_found
       or v_override.id is distinct from (v_expected_deposit ->> 'id')::uuid
       or v_override.updated_at is distinct from (v_expected_deposit ->> 'updated_at')::timestamptz then
      raise exception using errcode = '40001', message = 'car_fleet_operations_stale_deposit_override';
    end if;

    v_target_mode := coalesce(v_patch ->> 'availability_mode', v_offer.availability_mode);
    v_target_owner_id := case
      when v_patch ? 'owner_partner_id' then (v_patch ->> 'owner_partner_id')::uuid
      else v_offer.owner_partner_id
    end;

    if v_patch ? 'owner_partner_id' then
      if not exists (
        select 1
        from public.partners partner
        where partner.id = v_target_owner_id
          and lower(partner.status) = 'active'
          and partner.can_manage_cars
      ) then
        raise exception using errcode = '23514', message = 'car_fleet_operations_active_cars_owner_required';
      end if;
      if v_offer.pricing_strategy = 'legacy_compat' and not exists (
        select 1
        from public.partners partner
        where partner.id = v_target_owner_id
          and partner.cars_locations @> array[lower(btrim(v_offer.location))]::text[]
      ) then
        raise exception using errcode = '23514', message = 'car_fleet_operations_legacy_owner_location_required';
      end if;
    end if;

    if v_operation ? 'desired_availability_rows' then
      v_desired_rows := v_operation -> 'desired_availability_rows';
      if jsonb_array_length(v_desired_rows) <> (
        select count(*)
        from jsonb_to_recordset(v_desired_rows) desired(city_id uuid)
        join public.car_rental_cities city on city.id = desired.city_id
      ) then
        raise exception using errcode = '23503', message = 'car_fleet_operations_city_missing';
      end if;

      if exists (
        select 1
        from jsonb_to_recordset(v_desired_rows) desired(
          city_id uuid,
          pickup_enabled boolean,
          return_enabled boolean,
          fee_mode text,
          fee_per_direction numeric,
          fee_note text
        )
        where (desired.pickup_enabled and not public.car_multicity_directional_availability_is_valid(
          v_offer.pricing_strategy,
          v_target_mode,
          v_offer.pricing_profile_id,
          desired.city_id,
          'pickup',
          true,
          desired.fee_mode,
          desired.fee_per_direction
        )) or (desired.return_enabled and not public.car_multicity_directional_availability_is_valid(
          v_offer.pricing_strategy,
          v_target_mode,
          v_offer.pricing_profile_id,
          desired.city_id,
          'return',
          true,
          desired.fee_mode,
          desired.fee_per_direction
        ))
      ) then
        raise exception using errcode = '23514', message = 'car_fleet_operations_direction_or_fee_invalid';
      end if;
    end if;

    if v_target_mode = 'mapped' then
      if v_operation ? 'desired_availability_rows' then
        v_desired_rows := v_operation -> 'desired_availability_rows';
        if not exists (
          select 1
          from jsonb_to_recordset(v_desired_rows) desired(
            city_id uuid,
            pickup_enabled boolean,
            fee_mode text,
            fee_per_direction numeric
          )
          where desired.pickup_enabled
            and public.car_multicity_directional_availability_is_valid(
              v_offer.pricing_strategy, 'mapped', v_offer.pricing_profile_id,
              desired.city_id, 'pickup', true, desired.fee_mode, desired.fee_per_direction
            )
        ) or not exists (
          select 1
          from jsonb_to_recordset(v_desired_rows) desired(
            city_id uuid,
            return_enabled boolean,
            fee_mode text,
            fee_per_direction numeric
          )
          where desired.return_enabled
            and public.car_multicity_directional_availability_is_valid(
              v_offer.pricing_strategy, 'mapped', v_offer.pricing_profile_id,
              desired.city_id, 'return', true, desired.fee_mode, desired.fee_per_direction
            )
        ) then
          raise exception using errcode = '23514', message = 'car_fleet_operations_mapped_requires_pickup_and_return';
        end if;
      elsif not exists (
        select 1
        from public.car_offer_city_availability availability
        where availability.offer_id = v_offer_id
          and availability.is_active
          and availability.pickup_enabled
          and public.car_multicity_directional_availability_is_valid(
            v_offer.pricing_strategy, 'mapped', v_offer.pricing_profile_id,
            availability.city_id, 'pickup', true,
            availability.fee_mode, availability.fee_per_direction
          )
      ) or not exists (
        select 1
        from public.car_offer_city_availability availability
        where availability.offer_id = v_offer_id
          and availability.is_active
          and availability.return_enabled
          and public.car_multicity_directional_availability_is_valid(
            v_offer.pricing_strategy, 'mapped', v_offer.pricing_profile_id,
            availability.city_id, 'return', true,
            availability.fee_mode, availability.fee_per_direction
          )
      ) then
        raise exception using errcode = '23514', message = 'car_fleet_operations_mapped_requires_pickup_and_return';
      end if;

      if v_offer.pricing_strategy = 'threshold_daily_rate' then
        if v_target_owner_id is null or not exists (
          select 1
          from public.partners partner
          where partner.id = v_target_owner_id
            and lower(partner.status) = 'active'
            and partner.can_manage_cars
        ) then
          raise exception using errcode = '23514', message = 'car_fleet_operations_threshold_exact_owner_required';
        end if;
      elsif not (v_patch ? 'owner_partner_id') and public.partner_service_fulfillment_partner_id_for_car_booking(
        v_offer.id,
        v_offer.location
      ) is null then
        raise exception using errcode = '23514', message = 'car_fleet_operations_legacy_partner_route_required';
      end if;
    end if;
  end loop;

  -- MUTATION PHASE. Every selected offer and every dependent snapshot has
  -- passed before this point. Any later exception rolls back this whole call.

  -- Downgrade mapped offers first so retained/changed rows can be edited while
  -- they are intentionally inert. Rows are never deleted merely by changing
  -- availability_mode.
  for v_operation in
    select operation.value
    from jsonb_array_elements(p_operations) operation(value)
    order by (operation.value ->> 'offer_id')::uuid
  loop
    v_offer_id := (v_operation ->> 'offer_id')::uuid;
    v_patch := coalesce(v_operation -> 'offer_patch', '{}'::jsonb);
    if v_patch ->> 'availability_mode' = 'legacy' then
      update public.car_offers offer
      set availability_mode = 'legacy'
      where offer.id = v_offer_id
        and offer.availability_mode <> 'legacy';
    end if;
  end loop;

  -- Reuse the proven trigger-safe exact-offer rowset replacement. Calls are
  -- nested in this transaction, so a failure for any later offer rolls back
  -- every earlier rowset replacement as well.
  for v_operation in
    select operation.value
    from jsonb_array_elements(p_operations) operation(value)
    order by (operation.value ->> 'offer_id')::uuid
  loop
    if v_operation ? 'desired_availability_rows' then
      perform count(*)
      from public.admin_save_car_offer_city_availability_batch(
        (v_operation ->> 'offer_id')::uuid,
        v_operation -> 'expected_availability_rows',
        v_operation -> 'desired_availability_rows'
      );
    end if;
  end loop;

  -- Exact allowlisted offer changes only. Pricing, publication, stock, flags,
  -- booking and fulfillment fields cannot be expressed by the input contract.
  for v_operation in
    select operation.value
    from jsonb_array_elements(p_operations) operation(value)
    order by (operation.value ->> 'offer_id')::uuid
  loop
    v_offer_id := (v_operation ->> 'offer_id')::uuid;
    v_patch := coalesce(v_operation -> 'offer_patch', '{}'::jsonb);
    if v_patch <> '{}'::jsonb then
      update public.car_offers offer
      set availability_mode = case
            when v_patch ? 'availability_mode' then v_patch ->> 'availability_mode'
            else offer.availability_mode
          end,
          deposit_amount = case
            when v_patch ? 'deposit_amount' then (v_patch ->> 'deposit_amount')::numeric
            else offer.deposit_amount
          end,
          owner_partner_id = case
            when v_patch ? 'owner_partner_id' then (v_patch ->> 'owner_partner_id')::uuid
            else offer.owner_partner_id
          end
      where offer.id = v_offer_id;
    end if;
  end loop;

  for v_operation in
    select operation.value
    from jsonb_array_elements(p_operations) operation(value)
    order by (operation.value ->> 'offer_id')::uuid
  loop
    if v_operation ? 'deposit_override' then
      v_offer_id := (v_operation ->> 'offer_id')::uuid;
      v_deposit_change := v_operation -> 'deposit_override';
      v_deposit_action := lower(btrim(v_deposit_change ->> 'action'));
      if v_deposit_action in ('default', 'remove') then
        delete from public.service_deposit_overrides override_row
        where override_row.resource_type = 'cars'
          and override_row.resource_id = v_offer_id;
      else
        v_amount := (v_deposit_change ->> 'amount')::numeric;
        v_currency := upper(btrim(coalesce(v_deposit_change ->> 'currency', 'EUR')));
        v_include_children := coalesce((v_deposit_change ->> 'include_children')::boolean, true);
        insert into public.service_deposit_overrides (
          resource_type,
          resource_id,
          mode,
          amount,
          currency,
          include_children,
          enabled
        ) values (
          'cars',
          v_offer_id,
          v_deposit_action,
          v_amount,
          v_currency,
          v_include_children,
          true
        )
        on conflict (resource_type, resource_id) do update
        set mode = excluded.mode,
            amount = excluded.amount,
            currency = excluded.currency,
            include_children = excluded.include_children,
            enabled = true;
      end if;
    end if;
  end loop;

  -- Exact postconditions for every requested field/rowset.
  for v_operation in
    select operation.value
    from jsonb_array_elements(p_operations) operation(value)
    order by (operation.value ->> 'offer_id')::uuid
  loop
    v_offer_id := (v_operation ->> 'offer_id')::uuid;
    v_patch := coalesce(v_operation -> 'offer_patch', '{}'::jsonb);

    select offer.* into strict v_offer
    from public.car_offers offer
    where offer.id = v_offer_id;

    if (v_patch ? 'availability_mode'
        and v_offer.availability_mode is distinct from v_patch ->> 'availability_mode')
       or (v_patch ? 'deposit_amount'
        and v_offer.deposit_amount is distinct from (v_patch ->> 'deposit_amount')::numeric)
       or (v_patch ? 'owner_partner_id'
        and v_offer.owner_partner_id is distinct from (v_patch ->> 'owner_partner_id')::uuid) then
      raise exception using errcode = '23514', message = 'car_fleet_operations_offer_postcondition_failed';
    end if;

    if v_patch ? 'owner_partner_id'
       and v_offer.pricing_strategy = 'legacy_compat'
       and public.partner_service_fulfillment_partner_id_for_car_booking(
         v_offer.id,
         v_offer.location
       ) is distinct from v_offer.owner_partner_id then
      raise exception using errcode = '23514', message = 'car_fleet_operations_legacy_owner_route_postcondition_failed';
    end if;

    if v_operation ? 'desired_availability_rows' then
      v_desired_rows := v_operation -> 'desired_availability_rows';
      if jsonb_array_length(v_desired_rows) <> (
        select count(*)
        from public.car_offer_city_availability availability
        where availability.offer_id = v_offer_id
      ) or exists (
        select 1
        from jsonb_to_recordset(v_desired_rows) desired(
          city_id uuid,
          pickup_enabled boolean,
          return_enabled boolean,
          fee_mode text,
          fee_per_direction numeric,
          fee_note text
        )
        left join public.car_offer_city_availability availability
          on availability.offer_id = v_offer_id
         and availability.city_id = desired.city_id
        where availability.offer_id is null
           or availability.pickup_enabled is distinct from desired.pickup_enabled
           or availability.return_enabled is distinct from desired.return_enabled
           or availability.is_active is distinct from (
             desired.pickup_enabled or desired.return_enabled
           )
           or availability.fee_mode is distinct from desired.fee_mode
           or availability.fee_per_direction is distinct from desired.fee_per_direction
           or availability.fee_note is distinct from desired.fee_note
      ) then
        raise exception using errcode = '23514', message = 'car_fleet_operations_availability_postcondition_failed';
      end if;
    end if;

    if v_operation ? 'deposit_override' then
      v_deposit_change := v_operation -> 'deposit_override';
      v_deposit_action := lower(btrim(v_deposit_change ->> 'action'));
      if v_deposit_action in ('default', 'remove') then
        if exists (
          select 1
          from public.service_deposit_overrides override_row
          where override_row.resource_type = 'cars'
            and override_row.resource_id = v_offer_id
        ) then
          raise exception using errcode = '23514', message = 'car_fleet_operations_deposit_postcondition_failed';
        end if;
      elsif not exists (
        select 1
        from public.service_deposit_overrides override_row
        where override_row.resource_type = 'cars'
          and override_row.resource_id = v_offer_id
          and override_row.mode = v_deposit_action
          and override_row.amount = (v_deposit_change ->> 'amount')::numeric
          and override_row.currency = upper(btrim(coalesce(v_deposit_change ->> 'currency', 'EUR')))
          and override_row.include_children = coalesce(
            (v_deposit_change ->> 'include_children')::boolean,
            true
          )
          and override_row.enabled
      ) then
        raise exception using errcode = '23514', message = 'car_fleet_operations_deposit_postcondition_failed';
      end if;
    end if;
  end loop;

  select md5(coalesce(string_agg(
    (
      to_jsonb(offer)
      - array['updated_at', 'availability_mode', 'owner_partner_id', 'deposit_amount']::text[]
    )::text,
    E'\n' order by offer.id
  ), ''))
  into v_protected_after
  from public.car_offers offer
  where offer.id in (
    select (operation.value ->> 'offer_id')::uuid
    from jsonb_array_elements(p_operations) operation(value)
  );

  if v_protected_after is distinct from v_protected_before then
    raise exception using errcode = '23514', message = 'car_fleet_operations_protected_offer_contract_changed';
  end if;

  if (select to_jsonb(setting) from public.site_settings setting where setting.id = 1)
     is distinct from v_flags_before then
    raise exception using errcode = '23514', message = 'car_fleet_operations_feature_flags_changed';
  end if;

  select jsonb_build_object(
    'status', 'CAR_FLEET_OPERATIONS_APPLIED',
    'offer_count', v_operation_count,
    'offer_ids', coalesce(jsonb_agg(offer.id order by offer.id), '[]'::jsonb),
    'offers', coalesce(jsonb_agg(jsonb_build_object(
      'offer_id', offer.id,
      'updated_at', offer.updated_at,
      'availability_mode', offer.availability_mode,
      'owner_partner_id', offer.owner_partner_id,
      'security_deposit_amount', offer.deposit_amount,
      'availability_row_count', (
        select count(*)
        from public.car_offer_city_availability availability
        where availability.offer_id = offer.id
      ),
      'has_deposit_override', exists (
        select 1
        from public.service_deposit_overrides override_row
        where override_row.resource_type = 'cars'
          and override_row.resource_id = offer.id
      )
    ) order by offer.id), '[]'::jsonb)
  )
  into v_receipt
  from public.car_offers offer
  where offer.id in (
    select (operation.value ->> 'offer_id')::uuid
    from jsonb_array_elements(p_operations) operation(value)
  );

  return v_receipt;
end
$$;

comment on function public.car_fleet_apply_reviewed_operations_internal(jsonb) is
  'Internal all-or-nothing exact-offer Fleet mutation helper. Call through admin_apply_car_fleet_bulk_operation.';

-- Public Admin RPC contract. The browser submits one immutable exact-ID
-- target snapshot plus one allowlisted tri-state operation object. The server
-- derives every desired availability row itself, verifies the browser review,
-- then delegates once to the transaction-local mutation helper above.
create or replace function public.admin_apply_car_fleet_bulk_operation(
  p_targets jsonb,
  p_operations jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_request_role text;
  v_target jsonb;
  v_offer_id uuid;
  v_expected_rows jsonb;
  v_expected_rows_compact jsonb;
  v_expected_deposit jsonb;
  v_expected_deposit_compact jsonb;
  v_reviewed_desired jsonb;
  v_server_desired jsonb;
  v_patch jsonb;
  v_deposit_change jsonb;
  v_internal_operations jsonb := '[]'::jsonb;
  v_internal_operation jsonb;
  v_internal_receipt jsonb;
  v_availability_action text;
  v_security_action text;
  v_payment_action text;
  v_partner_action text;
begin
  begin
    v_request_role := coalesce(
      nullif(auth.jwt() ->> 'role', ''),
      nullif(current_setting('request.jwt.claim.role', true), '')
    );
  exception when others then
    v_request_role := null;
  end;

  if not public.is_current_user_admin()
     and v_request_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'car_fleet_bulk_admin_required';
  end if;

  if p_targets is null
     or jsonb_typeof(p_targets) <> 'array'
     or jsonb_array_length(p_targets) < 1
     or jsonb_array_length(p_targets) > 250
     or p_operations is null
     or jsonb_typeof(p_operations) <> 'object' then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_contract';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_operations) field(name)
    where field.name not in (
      'availability_mode', 'cities', 'security_deposit', 'payment_due', 'partner'
    )
  ) or not (
    p_operations ? 'availability_mode'
    and p_operations ? 'cities'
    and p_operations ? 'security_deposit'
    and p_operations ? 'payment_due'
    and p_operations ? 'partner'
  ) then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_operation_shape';
  end if;

  v_availability_action := lower(btrim(coalesce(p_operations ->> 'availability_mode', '')));
  v_security_action := lower(btrim(coalesce(p_operations -> 'security_deposit' ->> 'action', '')));
  v_payment_action := lower(btrim(coalesce(p_operations -> 'payment_due' ->> 'action', '')));
  v_partner_action := lower(btrim(coalesce(p_operations -> 'partner' ->> 'action', '')));

  if v_availability_action not in ('no_change', 'legacy', 'mapped')
     or v_security_action not in ('no_change', 'unspecified', 'none', 'amount')
     or v_payment_action not in ('no_change', 'default', 'flat', 'per_day', 'percent_total')
     or v_partner_action not in ('no_change', 'assign')
     or jsonb_typeof(p_operations -> 'cities') <> 'array'
     or jsonb_typeof(p_operations -> 'security_deposit') <> 'object'
     or jsonb_typeof(p_operations -> 'payment_due') <> 'object'
     or jsonb_typeof(p_operations -> 'partner') <> 'object' then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_operation_value';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_operations -> 'security_deposit') field(name)
    where field.name not in ('action', 'amount')
  ) or exists (
    select 1 from jsonb_object_keys(p_operations -> 'payment_due') field(name)
    where field.name not in ('action', 'amount', 'currency', 'include_children')
  ) or exists (
    select 1 from jsonb_object_keys(p_operations -> 'partner') field(name)
    where field.name not in ('action', 'partner_id')
  ) then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_unapproved_operation_field';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_operations -> 'cities') city_op(value)
    where jsonb_typeof(city_op.value) <> 'object'
       or not (city_op.value ? 'city_id')
       or coalesce(city_op.value ->> 'pickup', '') not in ('no_change', 'enable', 'disable')
       or coalesce(city_op.value ->> 'return', '') not in ('no_change', 'enable', 'disable')
       or coalesce(city_op.value ->> 'fee_action', '') not in ('no_change', 'inherit', 'custom')
       or exists (
         select 1 from jsonb_object_keys(city_op.value) field(name)
         where field.name not in ('city_id', 'pickup', 'return', 'fee_action', 'fee_per_direction')
       )
  ) then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_city_operation';
  end if;

  begin
    if (
      select count(*)
      from jsonb_array_elements(p_operations -> 'cities') city_op(value)
    ) <> (
      select count(distinct (city_op.value ->> 'city_id')::uuid)
      from jsonb_array_elements(p_operations -> 'cities') city_op(value)
    ) then
      raise exception using errcode = '22023', message = 'car_fleet_bulk_duplicate_city_operation';
    end if;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_city_operation';
  end;

  if v_security_action = 'amount' and (
    jsonb_typeof(p_operations -> 'security_deposit' -> 'amount') is distinct from 'number'
    or (p_operations -> 'security_deposit' ->> 'amount')::numeric <= 0
  ) then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_security_deposit';
  end if;

  if v_payment_action in ('flat', 'per_day', 'percent_total') and (
    jsonb_typeof(p_operations -> 'payment_due' -> 'amount') is distinct from 'number'
    or (p_operations -> 'payment_due' ->> 'amount')::numeric <= 0
    or (
      v_payment_action = 'percent_total'
      and (p_operations -> 'payment_due' ->> 'amount')::numeric > 100
    )
  ) then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_payment_due';
  end if;

  if v_partner_action = 'assign' then
    begin
      if (p_operations -> 'partner' ->> 'partner_id')::uuid is null then
        raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_partner';
      end if;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_partner';
    end;
  end if;

  if v_availability_action = 'no_change'
     and jsonb_array_length(p_operations -> 'cities') = 0
     and v_security_action = 'no_change'
     and v_payment_action = 'no_change'
     and v_partner_action = 'no_change' then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_empty_operation';
  end if;

  if (
    select count(*) from jsonb_array_elements(p_targets) target(value)
  ) <> (
    select count(distinct (target.value ->> 'offer_id')::uuid)
    from jsonb_array_elements(p_targets) target(value)
  ) then
    raise exception using errcode = '22023', message = 'car_fleet_bulk_duplicate_offer_id';
  end if;

  for v_target in
    select target.value
    from jsonb_array_elements(p_targets) target(value)
    order by (target.value ->> 'offer_id')::uuid
  loop
    if jsonb_typeof(v_target) <> 'object'
       or not (
         v_target ? 'offer_id'
         and v_target ? 'expected_updated_at'
         and v_target ? 'expected_availability'
         and v_target ? 'expected_deposit_override'
         and v_target ? 'desired_availability'
         and v_target ? 'target_availability_mode'
       )
       or exists (
         select 1 from jsonb_object_keys(v_target) field(name)
         where field.name not in (
           'offer_id', 'expected_updated_at', 'expected_availability',
           'expected_deposit_override', 'desired_availability',
           'target_availability_mode'
         )
       ) then
      raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_target_shape';
    end if;

    begin
      v_offer_id := (v_target ->> 'offer_id')::uuid;
      if v_offer_id is null or (v_target ->> 'expected_updated_at')::timestamptz is null then
        raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_target_identity';
      end if;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_target_identity';
    end;

    if coalesce(v_target ->> 'target_availability_mode', '') not in ('legacy', 'mapped')
       or (
         v_availability_action <> 'no_change'
         and v_target ->> 'target_availability_mode' <> v_availability_action
       ) then
      raise exception using errcode = '22023', message = 'car_fleet_bulk_target_mode_mismatch';
    end if;

    v_expected_rows := v_target -> 'expected_availability';
    if jsonb_typeof(v_expected_rows) <> 'array'
       or exists (
         select 1
         from jsonb_array_elements(v_expected_rows) expected(value)
         where jsonb_typeof(expected.value) <> 'object'
            or not (
              expected.value ? 'city_id'
              and expected.value ? 'updated_at'
              and expected.value ? 'pickup_enabled'
              and expected.value ? 'return_enabled'
              and expected.value ? 'is_active'
              and expected.value ? 'fee_mode'
              and expected.value ? 'fee_per_direction'
              and expected.value ? 'fee_note'
            )
       ) then
      raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_expected_availability';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'city_id', expected.city_id,
      'updated_at', expected.updated_at
    ) order by expected.city_id), '[]'::jsonb)
    into v_expected_rows_compact
    from jsonb_to_recordset(v_expected_rows) expected(
      city_id uuid,
      updated_at timestamptz,
      pickup_enabled boolean,
      return_enabled boolean,
      is_active boolean,
      fee_mode text,
      fee_per_direction numeric,
      fee_note text
    );

    v_expected_deposit := v_target -> 'expected_deposit_override';
    if v_expected_deposit = 'null'::jsonb then
      v_expected_deposit_compact := 'null'::jsonb;
    elsif jsonb_typeof(v_expected_deposit) = 'object'
          and v_expected_deposit ? 'id'
          and v_expected_deposit ? 'updated_at' then
      v_expected_deposit_compact := jsonb_build_object(
        'id', v_expected_deposit ->> 'id',
        'updated_at', v_expected_deposit ->> 'updated_at'
      );
    else
      raise exception using errcode = '22023', message = 'car_fleet_bulk_invalid_expected_deposit';
    end if;

    v_patch := '{}'::jsonb;
    if v_availability_action <> 'no_change' then
      v_patch := v_patch || jsonb_build_object('availability_mode', v_availability_action);
    end if;
    if v_security_action = 'unspecified' then
      v_patch := v_patch || jsonb_build_object('deposit_amount', null);
    elsif v_security_action = 'none' then
      v_patch := v_patch || jsonb_build_object('deposit_amount', 0);
    elsif v_security_action = 'amount' then
      v_patch := v_patch || jsonb_build_object(
        'deposit_amount', (p_operations -> 'security_deposit' ->> 'amount')::numeric
      );
    end if;
    if v_partner_action = 'assign' then
      v_patch := v_patch || jsonb_build_object(
        'owner_partner_id', p_operations -> 'partner' ->> 'partner_id'
      );
    end if;

    v_internal_operation := jsonb_build_object(
      'offer_id', v_offer_id,
      'expected_offer_updated_at', v_target ->> 'expected_updated_at',
      'expected_availability_rows', v_expected_rows_compact,
      'expected_deposit_override', v_expected_deposit_compact,
      'offer_patch', v_patch
    );

    if jsonb_array_length(p_operations -> 'cities') > 0 then
      with expected as (
        select *
        from jsonb_to_recordset(v_expected_rows) row_state(
          city_id uuid,
          updated_at timestamptz,
          pickup_enabled boolean,
          return_enabled boolean,
          is_active boolean,
          fee_mode text,
          fee_per_direction numeric,
          fee_note text
        )
      ), city_operation as (
        select
          (item.value ->> 'city_id')::uuid as city_id,
          item.value ->> 'pickup' as pickup_action,
          item.value ->> 'return' as return_action,
          item.value ->> 'fee_action' as fee_action,
          case when item.value ->> 'fee_action' = 'custom'
            then (item.value ->> 'fee_per_direction')::numeric
            else null
          end as custom_fee
        from jsonb_array_elements(p_operations -> 'cities') item(value)
      ), combined as (
        select
          coalesce(expected.city_id, city_operation.city_id) as city_id,
          case city_operation.pickup_action
            when 'enable' then true
            when 'disable' then false
            else coalesce(expected.pickup_enabled, false)
          end as pickup_enabled,
          case city_operation.return_action
            when 'enable' then true
            when 'disable' then false
            else coalesce(expected.return_enabled, false)
          end as return_enabled,
          case city_operation.fee_action
            when 'inherit' then 'inherit'
            when 'custom' then 'override'
            else coalesce(expected.fee_mode, 'inherit')
          end as fee_mode,
          case city_operation.fee_action
            when 'inherit' then null
            when 'custom' then city_operation.custom_fee
            else case when coalesce(expected.fee_mode, 'inherit') = 'override'
              then expected.fee_per_direction else null end
          end as fee_per_direction,
          expected.fee_note
        from expected
        full join city_operation using (city_id)
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'city_id', combined.city_id,
        'pickup_enabled', combined.pickup_enabled,
        'return_enabled', combined.return_enabled,
        'fee_mode', combined.fee_mode,
        'fee_per_direction', combined.fee_per_direction,
        'fee_note', combined.fee_note
      ) order by combined.city_id), '[]'::jsonb)
      into v_server_desired
      from combined;

      v_reviewed_desired := v_target -> 'desired_availability';
      if jsonb_typeof(v_reviewed_desired) <> 'array' or exists (
        select 1
        from (
          select jsonb_agg(item.value order by item.value ->> 'city_id') as rows
          from jsonb_array_elements(v_reviewed_desired) item(value)
        ) reviewed
        cross join (
          select jsonb_agg(item.value order by item.value ->> 'city_id') as rows
          from jsonb_array_elements(v_server_desired) item(value)
        ) derived
        where reviewed.rows is distinct from derived.rows
      ) then
        raise exception using errcode = '22023', message = 'car_fleet_bulk_reviewed_availability_mismatch';
      end if;
      v_internal_operation := v_internal_operation
        || jsonb_build_object('desired_availability_rows', v_server_desired);
    elsif v_target -> 'desired_availability' <> 'null'::jsonb then
      raise exception using errcode = '22023', message = 'car_fleet_bulk_unrequested_availability_write';
    end if;

    if v_payment_action <> 'no_change' then
      if v_payment_action = 'default' then
        v_deposit_change := jsonb_build_object('action', 'default');
      else
        v_deposit_change := jsonb_build_object(
          'action', v_payment_action,
          'amount', (p_operations -> 'payment_due' ->> 'amount')::numeric,
          'currency', upper(btrim(coalesce(p_operations -> 'payment_due' ->> 'currency', 'EUR'))),
          'include_children', coalesce((p_operations -> 'payment_due' ->> 'include_children')::boolean, true)
        );
      end if;
      v_internal_operation := v_internal_operation
        || jsonb_build_object('deposit_override', v_deposit_change);
    end if;

    v_internal_operations := v_internal_operations || jsonb_build_array(v_internal_operation);
  end loop;

  v_internal_receipt := public.car_fleet_apply_reviewed_operations_internal(
    v_internal_operations
  );

  return jsonb_build_object(
    'operation', 'fleet_bulk',
    'target_count', (v_internal_receipt ->> 'offer_count')::integer,
    'offer_ids', coalesce(v_internal_receipt -> 'offer_ids', '[]'::jsonb),
    'offers', coalesce(v_internal_receipt -> 'offers', '[]'::jsonb)
  );
end
$$;

comment on function public.admin_apply_car_fleet_bulk_operation(jsonb, jsonb) is
  'Admin/service-only exact-ID Fleet transaction. The server derives reviewed rowsets; stale or invalid targets roll back the entire batch.';

revoke all on function public.car_multicity_directional_availability_is_valid(
  text, text, uuid, uuid, text, boolean, text, numeric
) from public, anon, authenticated;
revoke all on function public.car_multicity_validate_offer()
from public, anon, authenticated;
revoke all on function public.car_multicity_validate_availability()
from public, anon, authenticated;
revoke all on function public.car_multicity_assert_offer_availability_complete()
from public, anon, authenticated;
revoke all on function public.car_multicity_protect_profile_city()
from public, anon, authenticated;
revoke all on function public.car_mapped_legacy_offer_route_is_booking_eligible(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.car_threshold_booking_public_eligibility_guard()
from public, anon, authenticated;
revoke all on function public.car_fleet_apply_reviewed_operations_internal(jsonb)
from public, anon, authenticated;
revoke all on function public.admin_apply_car_fleet_bulk_operation(jsonb, jsonb)
from public, anon;

grant execute on function public.car_multicity_directional_availability_is_valid(
  text, text, uuid, uuid, text, boolean, text, numeric
) to service_role;
grant execute on function public.car_multicity_validate_offer()
to service_role;
grant execute on function public.car_multicity_validate_availability()
to service_role;
grant execute on function public.car_multicity_assert_offer_availability_complete()
to service_role;
grant execute on function public.car_multicity_protect_profile_city()
to service_role;
grant execute on function public.car_mapped_legacy_offer_route_is_booking_eligible(uuid, text, text)
to service_role;
grant execute on function public.car_threshold_booking_public_eligibility_guard()
to service_role;
grant execute on function public.car_fleet_apply_reviewed_operations_internal(jsonb)
to service_role;
grant execute on function public.admin_apply_car_fleet_bulk_operation(jsonb, jsonb)
to authenticated, service_role;

do $postconditions$
declare
  v_rpc_source text;
  v_internal_source text;
  v_guard_source text;
  v_direction_source text;
  v_profile_city_source text;
begin
  select procedure.prosrc into v_rpc_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)');

  select procedure.prosrc into v_internal_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.car_fleet_apply_reviewed_operations_internal(jsonb)');

  select procedure.prosrc into v_guard_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.car_threshold_booking_public_eligibility_guard()');

  select procedure.prosrc into v_direction_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.car_multicity_directional_availability_is_valid(text,text,uuid,uuid,text,boolean,text,numeric)');

  select procedure.prosrc into v_profile_city_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.car_multicity_protect_profile_city()');

  if to_regprocedure('public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)') is null
     or position('v_server_desired' in coalesce(v_rpc_source, '')) = 0
     or position('MUTATION PHASE' in coalesce(v_internal_source, '')) = 0
     or position('expected_availability_rows' in coalesce(v_internal_source, '')) = 0
     or position('expected_deposit_override' in coalesce(v_internal_source, '')) = 0
     or position('car_mapped_legacy_offer_route_is_booking_eligible' in coalesce(v_guard_source, '')) = 0
     or position('mapping.pickup_supported' in coalesce(v_direction_source, '')) > 0
     or position('mapping.return_supported' in coalesce(v_direction_source, '')) > 0
     or position('new.pickup_supported' in coalesce(v_profile_city_source, '')) > 0
     or position('new.return_supported' in coalesce(v_profile_city_source, '')) > 0 then
    raise exception using errcode = '23514', message = 'car_fleet_operations_function_postcondition_failed';
  end if;

  if has_function_privilege('anon', 'public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.admin_apply_car_fleet_bulk_operation(jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.car_fleet_apply_reviewed_operations_internal(jsonb)', 'EXECUTE') then
    raise exception using errcode = '42501', message = 'car_fleet_operations_rpc_grant_postcondition_failed';
  end if;
end
$postconditions$;

commit;
