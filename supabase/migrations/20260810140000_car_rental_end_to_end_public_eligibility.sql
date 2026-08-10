-- car-rental-end-to-end-public-eligibility-v1
-- Fail-closed public eligibility, route resolution, booking admission and
-- atomic Admin availability saves for threshold_daily_rate offers.
--
-- Independently applicable after Stage 3A-3D, six-decimal precision and exact
-- owner routing. Both capability flags must be OFF. No data row is changed.

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
    'public.car_offer_daily_rate_tiers',
    'public.car_offer_city_availability',
    'public.car_rental_cities',
    'public.site_settings',
    'public.partners',
    'public.partner_resources'
  ]::text[]) required(name)
  where to_regclass(required.name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'car_end_to_end_public_eligibility_required_table_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null
     or to_regprocedure('public.is_partner_user(uuid)') is null
     or to_regprocedure('public.car_threshold_standard_directional_fee(text)') is null
     or to_regprocedure('public.car_validate_threshold_booking_financials()') is null
     or to_regprocedure('public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)') is null then
    raise exception using
      errcode = '42883',
      message = 'car_end_to_end_public_eligibility_required_function_missing';
  end if;

  select coalesce(array_agg(required.contract order by required.contract), '{}'::text[])
  into v_missing
  from unnest(array[
    'car_offers.id',
    'car_offers.pricing_strategy',
    'car_offers.availability_mode',
    'car_offers.is_available',
    'car_offers.is_published',
    'car_offers.submission_status',
    'car_offers.stock_count',
    'car_offers.updated_at',
    'car_offers.min_rental_days',
    'car_offers.max_rental_days',
    'car_offers.owner_partner_id',
    'car_bookings.offer_id',
    'car_bookings.pickup_city_code',
    'car_bookings.return_city_code',
    'car_offer_daily_rate_tiers.offer_id',
    'car_offer_daily_rate_tiers.threshold_days',
    'car_offer_daily_rate_tiers.daily_rate',
    'car_offer_daily_rate_tiers.is_active',
    'car_offer_city_availability.offer_id',
    'car_offer_city_availability.city_id',
    'car_offer_city_availability.pickup_enabled',
    'car_offer_city_availability.return_enabled',
    'car_offer_city_availability.is_active',
    'car_offer_city_availability.fee_mode',
    'car_offer_city_availability.fee_per_direction',
    'car_offer_city_availability.fee_note',
    'car_offer_city_availability.updated_at',
    'car_rental_cities.id',
    'car_rental_cities.code',
    'car_rental_cities.is_active',
    'site_settings.car_multi_city_mapped_enabled',
    'site_settings.car_threshold_daily_rates_enabled',
    'partners.id',
    'partners.status',
    'partners.can_manage_cars'
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
      message = 'car_end_to_end_public_eligibility_required_column_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if not exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = 'public.car_offer_daily_rate_tiers'::regclass
      and attribute.attname = 'daily_rate'
      and attribute.attnum > 0
      and not attribute.attisdropped
      and format_type(attribute.atttypid, attribute.atttypmod) = 'numeric(12,6)'
  ) then
    raise exception using
      errcode = '42804',
      message = 'car_end_to_end_public_eligibility_requires_six_decimal_daily_rate';
  end if;

  if (select count(*) from public.site_settings) <> 1
     or exists (
       select 1
       from public.site_settings setting
       where setting.id <> 1
          or setting.car_multi_city_mapped_enabled
          or setting.car_threshold_daily_rates_enabled
     ) then
    raise exception using
      errcode = '23514',
      message = 'car_end_to_end_public_eligibility_requires_both_flags_off';
  end if;
end
$prerequisites$;

lock table public.site_settings in share mode;
lock table public.car_offers in share mode;
lock table public.car_offer_daily_rate_tiers in share mode;
lock table public.car_offer_city_availability in share mode;
lock table public.car_rental_cities in share mode;
lock table public.partners in share mode;
lock table public.partner_resources in share mode;
lock table public.car_bookings in share mode;

-- The helper is deliberately SECURITY DEFINER to avoid recursive RLS policy
-- evaluation. It exposes only a boolean and reads no booking/customer data.
create or replace function public.car_threshold_offer_has_public_prerequisites(
  p_offer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(exists (
    select 1
    from public.car_offers offer
    join public.site_settings setting
      on setting.id = 1
     and setting.car_multi_city_mapped_enabled
     and setting.car_threshold_daily_rates_enabled
    join public.partners owner_partner
      on owner_partner.id = offer.owner_partner_id
     and lower(owner_partner.status) = 'active'
     and owner_partner.can_manage_cars
    where offer.id = p_offer_id
      and offer.pricing_strategy = 'threshold_daily_rate'
      and offer.availability_mode = 'mapped'
      and offer.is_published
      and offer.is_available
      and offer.submission_status = 'approved'
      and offer.stock_count > 0
      and offer.min_rental_days >= 1
      and (offer.max_rental_days is null or offer.max_rental_days >= offer.min_rental_days)
      and offer.min_rental_days = (
        select min(tier.threshold_days)
        from public.car_offer_daily_rate_tiers tier
        where tier.offer_id = offer.id
          and tier.is_active
          and tier.daily_rate > 0
      )
      and not exists (
        select 1
        from public.car_offer_daily_rate_tiers invalid_tier
        where invalid_tier.offer_id = offer.id
          and invalid_tier.is_active
          and (
            invalid_tier.threshold_days < offer.min_rental_days
            or invalid_tier.daily_rate <= 0
            or (
              offer.max_rental_days is not null
              and invalid_tier.threshold_days > offer.max_rental_days
            )
          )
      )
      and not exists (
        select 1
        from public.car_offer_city_availability invalid_availability
        left join public.car_rental_cities invalid_city
          on invalid_city.id = invalid_availability.city_id
        where invalid_availability.offer_id = offer.id
          and invalid_availability.is_active
          and (
            invalid_availability.pickup_enabled
            or invalid_availability.return_enabled
          )
          and (
            invalid_city.id is null
            or invalid_city.is_active is not true
            or not (
              (
                invalid_availability.fee_mode = 'override'
                and invalid_availability.fee_per_direction is not null
                and invalid_availability.fee_per_direction >= 0
              )
              or (
                invalid_availability.fee_mode = 'inherit'
                and invalid_availability.fee_per_direction is null
                and public.car_threshold_standard_directional_fee(invalid_city.code) is not null
              )
            )
          )
      )
      and exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.is_active
        where availability.offer_id = offer.id
          and availability.is_active
          and availability.pickup_enabled
          and (
            (
              availability.fee_mode = 'override'
              and availability.fee_per_direction is not null
              and availability.fee_per_direction >= 0
            )
            or (
              availability.fee_mode = 'inherit'
              and availability.fee_per_direction is null
              and public.car_threshold_standard_directional_fee(city.code) is not null
            )
          )
      )
      and exists (
        select 1
        from public.car_offer_city_availability availability
        join public.car_rental_cities city
          on city.id = availability.city_id
         and city.is_active
        where availability.offer_id = offer.id
          and availability.is_active
          and availability.return_enabled
          and (
            (
              availability.fee_mode = 'override'
              and availability.fee_per_direction is not null
              and availability.fee_per_direction >= 0
            )
            or (
              availability.fee_mode = 'inherit'
              and availability.fee_per_direction is null
              and public.car_threshold_standard_directional_fee(city.code) is not null
            )
          )
      )
  ), false)
$$;

comment on function public.car_threshold_offer_has_public_prerequisites(uuid) is
  'Fail-closed exact-offer public threshold eligibility. Configuration means requestable only and never partner acceptance.';

create or replace function public.car_threshold_offer_route_is_public_eligible(
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
  select coalesce(
    public.car_threshold_offer_has_public_prerequisites(p_offer_id)
    and normalized.pickup_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and normalized.return_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and exists (
      select 1
      from public.car_rental_cities city
      join public.car_offer_city_availability availability
        on availability.city_id = city.id
       and availability.offer_id = p_offer_id
      where city.code = normalized.pickup_code
        and city.is_active
        and availability.is_active
        and availability.pickup_enabled
        and (
          (
            availability.fee_mode = 'override'
            and availability.fee_per_direction is not null
            and availability.fee_per_direction >= 0
          )
          or (
            availability.fee_mode = 'inherit'
            and availability.fee_per_direction is null
            and public.car_threshold_standard_directional_fee(city.code) is not null
          )
        )
    )
    and exists (
      select 1
      from public.car_rental_cities city
      join public.car_offer_city_availability availability
        on availability.city_id = city.id
       and availability.offer_id = p_offer_id
      where city.code = normalized.return_code
        and city.is_active
        and availability.is_active
        and availability.return_enabled
        and (
          (
            availability.fee_mode = 'override'
            and availability.fee_per_direction is not null
            and availability.fee_per_direction >= 0
          )
          or (
            availability.fee_mode = 'inherit'
            and availability.fee_per_direction is null
            and public.car_threshold_standard_directional_fee(city.code) is not null
          )
        )
    ),
    false
  )
  from normalized
$$;

comment on function public.car_threshold_offer_route_is_public_eligible(uuid, text, text) is
  'Adds exact directional pickup/return and fee validation to the public threshold offer prerequisites.';

create or replace function public.car_threshold_offer_city_availability_is_public(
  p_offer_id uuid,
  p_city_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    public.car_threshold_offer_has_public_prerequisites(p_offer_id)
    and exists (
      select 1
      from public.car_offer_city_availability availability
      join public.car_rental_cities city
        on city.id = availability.city_id
       and city.is_active
      where availability.offer_id = p_offer_id
        and availability.city_id = p_city_id
        and availability.is_active
        and (availability.pickup_enabled or availability.return_enabled)
        and (
          (
            availability.fee_mode = 'override'
            and availability.fee_per_direction is not null
            and availability.fee_per_direction >= 0
          )
          or (
            availability.fee_mode = 'inherit'
            and availability.fee_per_direction is null
            and public.car_threshold_standard_directional_fee(city.code) is not null
          )
        )
    ),
    false
  )
$$;

comment on function public.car_threshold_offer_city_availability_is_public(uuid, uuid) is
  'RLS-safe exact offer-city row eligibility; exposes only a boolean and no private configuration.';

create or replace function public.resolve_public_threshold_offer_ids(
  p_pickup_city_code text,
  p_return_city_code text
)
returns table (offer_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select offer.id
  from public.car_offers offer
  where offer.pricing_strategy = 'threshold_daily_rate'
    and public.car_threshold_offer_route_is_public_eligible(
      offer.id,
      p_pickup_city_code,
      p_return_city_code
    )
  order by offer.id
$$;

comment on function public.resolve_public_threshold_offer_ids(text, text) is
  'Read-only exact-ID public threshold route resolver. Returns IDs only and never creates or accepts a booking.';

-- Freeze the legacy resolver result before tightening threshold routing. The
-- replacement below must be byte-for-byte equivalent in outcome for every
-- legacy_compat offer while returning NULL (never a legacy location fallback)
-- when a threshold offer lacks an active exact Cars owner.
create temporary table _car_end_to_end_legacy_partner_routing_before
on commit drop
as
select
  offer.id as offer_id,
  offer.location,
  public.partner_service_fulfillment_partner_id_for_car_booking(
    offer.id,
    offer.location
  ) as partner_id
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

  -- Threshold offers are never permitted to fall back to partner_resources or
  -- a Larnaca/Paphos location owner. Invalid/missing exact ownership is NULL;
  -- the public admission helper and booking trigger reject that configuration.
  if p_offer_id is not null
     and v_pricing_strategy = 'threshold_daily_rate' then
    select partner.id
    into pid
    from public.partners partner
    where partner.id = v_exact_owner_id
      and lower(partner.status) = 'active'
      and partner.can_manage_cars
    limit 1;

    return pid;
  end if;

  if loc is null then
    return null;
  end if;

  if loc not in ('paphos','larnaca','all-cyprus') then
    return null;
  end if;

  has_resource_fn := (
    to_regprocedure('public.partner_service_fulfillment_partner_id_for_resource(text,uuid)')
    is not null
  );
  has_loc_fn := (
    to_regprocedure('public.partner_service_fulfillment_partner_id_for_car_location(text)')
    is not null
  );

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
  'Threshold offers use only an active exact owner and otherwise return NULL; legacy_compat routing remains unchanged.';

do $legacy_partner_routing_oracle$
begin
  if exists (
    select 1
    from _car_end_to_end_legacy_partner_routing_before before_state
    where public.partner_service_fulfillment_partner_id_for_car_booking(
      before_state.offer_id,
      before_state.location
    ) is distinct from before_state.partner_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_end_to_end_legacy_partner_routing_changed';
  end if;
end
$legacy_partner_routing_oracle$;

-- Remove the audited rogue authenticated SELECT policy and replace only the
-- canonical public policies. Existing admin/partner operational policies stay.
drop policy if exists car_offers_auth_select on public.car_offers;
drop policy if exists "Anyone can view available car offers" on public.car_offers;
drop policy if exists "Authenticated users can view all offers" on public.car_offers;
drop policy if exists car_offers_public_select on public.car_offers;
drop policy if exists car_offers_authenticated_select on public.car_offers;

create policy car_offers_public_select
on public.car_offers
for select
to anon
using (
  (
    pricing_strategy = 'legacy_compat'
    and is_available
    and is_published
  )
  or (
    pricing_strategy = 'threshold_daily_rate'
    and public.car_threshold_offer_has_public_prerequisites(id)
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
    pricing_strategy = 'legacy_compat'
    and is_available
    and is_published
  )
  or (
    pricing_strategy = 'threshold_daily_rate'
    and public.car_threshold_offer_has_public_prerequisites(id)
  )
);

drop policy if exists car_offer_city_availability_public_read
on public.car_offer_city_availability;

create policy car_offer_city_availability_public_read
on public.car_offer_city_availability
for select
to anon, authenticated
using (
  is_active
  and (
    exists (
      select 1
      from public.car_offers offer
      where offer.id = car_offer_city_availability.offer_id
        and offer.pricing_strategy = 'legacy_compat'
        and offer.availability_mode = 'mapped'
        and offer.is_available
        and offer.is_published
    )
    or (
      public.car_threshold_offer_city_availability_is_public(offer_id, city_id)
    )
  )
);

drop policy if exists car_offer_daily_rate_tiers_public_read
on public.car_offer_daily_rate_tiers;

create policy car_offer_daily_rate_tiers_public_read
on public.car_offer_daily_rate_tiers
for select
to anon, authenticated
using (
  is_active
  and public.car_threshold_offer_has_public_prerequisites(offer_id)
);

create or replace function public.car_threshold_booking_public_eligibility_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_strategy text;
begin
  if new.offer_id is null then
    return new;
  end if;

  select offer.pricing_strategy
  into v_strategy
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
  end if;

  return new;
end
$$;

drop trigger if exists car_bookings_00_threshold_public_eligibility
on public.car_bookings;
create trigger car_bookings_00_threshold_public_eligibility
before insert on public.car_bookings
for each row execute function public.car_threshold_booking_public_eligibility_guard();

comment on function public.car_threshold_booking_public_eligibility_guard() is
  'Admission guard only. It does not change booking/payment/fulfillment status and never represents partner acceptance.';

create or replace function public.admin_save_car_offer_city_availability_batch(
  p_offer_id uuid,
  p_expected_rows jsonb,
  p_desired_rows jsonb
)
returns setof public.car_offer_city_availability
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_offer public.car_offers%rowtype;
  v_request_role text;
  v_expected_count integer;
  v_desired_count integer;
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
    raise exception using
      errcode = '42501',
      message = 'car_availability_batch_admin_required';
  end if;

  if p_offer_id is null
     or p_expected_rows is null
     or jsonb_typeof(p_expected_rows) <> 'array'
     or p_desired_rows is null
     or jsonb_typeof(p_desired_rows) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'car_availability_batch_invalid_arguments';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_expected_rows) item
    where jsonb_typeof(item) <> 'object'
  ) or exists (
    select 1
    from jsonb_array_elements(p_desired_rows) item
    where jsonb_typeof(item) <> 'object'
       or item ? 'offer_id'
       or item ? 'is_active'
       or item ? 'updated_at'
  ) then
    raise exception using
      errcode = '22023',
      message = 'car_availability_batch_invalid_row_shape';
  end if;

  select offer.*
  into v_offer
  from public.car_offers offer
  where offer.id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'car_availability_batch_offer_missing';
  end if;

  -- The exact offer lock also serializes FK-backed inserts for this offer.
  perform 1
  from public.car_offer_city_availability availability
  where availability.offer_id = p_offer_id
  for update;

  v_expected_count := jsonb_array_length(p_expected_rows);
  v_desired_count := jsonb_array_length(p_desired_rows);

  if exists (
    select 1
    from jsonb_to_recordset(p_expected_rows) expected(city_id uuid, updated_at timestamptz)
    where expected.city_id is null or expected.updated_at is null
  ) or (
    select count(*)
    from jsonb_to_recordset(p_expected_rows) expected(city_id uuid, updated_at timestamptz)
  ) <> (
    select count(distinct expected.city_id)
    from jsonb_to_recordset(p_expected_rows) expected(city_id uuid, updated_at timestamptz)
  ) then
    raise exception using errcode = '22023', message = 'car_availability_batch_invalid_expected_rows';
  end if;

  if v_expected_count <> (
    select count(*)
    from public.car_offer_city_availability availability
    where availability.offer_id = p_offer_id
  ) or exists (
    select 1
    from jsonb_to_recordset(p_expected_rows) expected(city_id uuid, updated_at timestamptz)
    left join public.car_offer_city_availability availability
      on availability.offer_id = p_offer_id
     and availability.city_id = expected.city_id
    where availability.offer_id is null
       or availability.updated_at is distinct from expected.updated_at
  ) then
    raise exception using errcode = '40001', message = 'car_availability_batch_stale_snapshot';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_desired_rows) desired(
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
       or (
         desired.fee_mode = 'inherit'
         and desired.fee_per_direction is not null
       )
       or (
         desired.fee_mode = 'override'
         and (desired.fee_per_direction is null or desired.fee_per_direction < 0)
       )
       or (desired.fee_note is not null and char_length(desired.fee_note) > 500)
  ) or (
    select count(*)
    from jsonb_to_recordset(p_desired_rows) desired(city_id uuid)
  ) <> (
    select count(distinct desired.city_id)
    from jsonb_to_recordset(p_desired_rows) desired(city_id uuid)
  ) then
    raise exception using errcode = '22023', message = 'car_availability_batch_invalid_desired_rows';
  end if;

  if v_desired_count <> (
    select count(*)
    from jsonb_to_recordset(p_desired_rows) desired(city_id uuid)
    join public.car_rental_cities city on city.id = desired.city_id
  ) then
    raise exception using errcode = '23503', message = 'car_availability_batch_city_missing';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_desired_rows) desired(
      city_id uuid,
      pickup_enabled boolean,
      return_enabled boolean,
      fee_mode text,
      fee_per_direction numeric,
      fee_note text
    )
    join public.car_rental_cities city on city.id = desired.city_id
    where (desired.pickup_enabled or desired.return_enabled)
      and (
        city.is_active is not true
        or (
          desired.fee_mode = 'inherit'
          and public.car_threshold_standard_directional_fee(city.code) is null
        )
      )
  ) then
    raise exception using errcode = '23514', message = 'car_availability_batch_active_city_or_fee_invalid';
  end if;

  if v_offer.availability_mode = 'mapped' and (
    not exists (
      select 1
      from jsonb_to_recordset(p_desired_rows) desired(
        city_id uuid,
        pickup_enabled boolean,
        return_enabled boolean,
        fee_mode text,
        fee_per_direction numeric,
        fee_note text
      )
      join public.car_rental_cities city on city.id = desired.city_id and city.is_active
      where desired.pickup_enabled
        and (
          desired.fee_mode = 'override'
          or public.car_threshold_standard_directional_fee(city.code) is not null
        )
    )
    or not exists (
      select 1
      from jsonb_to_recordset(p_desired_rows) desired(
        city_id uuid,
        pickup_enabled boolean,
        return_enabled boolean,
        fee_mode text,
        fee_per_direction numeric,
        fee_note text
      )
      join public.car_rental_cities city on city.id = desired.city_id and city.is_active
      where desired.return_enabled
        and (
          desired.fee_mode = 'override'
          or public.car_threshold_standard_directional_fee(city.code) is not null
        )
    )
  ) then
    raise exception using errcode = '23514', message = 'car_availability_batch_mapped_offer_requires_pickup_and_return';
  end if;

  -- Phase 1 is a monotonic bridge for every final-active row. The existing
  -- non-deferrable per-row completeness trigger must never observe a gap while
  -- pickup and return move between different cities. Existing directions are
  -- therefore OR-ed with reviewed final directions before any direction is
  -- removed. Fees already use the reviewed final contract.
  insert into public.car_offer_city_availability (
    offer_id,
    city_id,
    pickup_enabled,
    return_enabled,
    is_active,
    fee_mode,
    fee_per_direction,
    fee_note
  )
  select
    p_offer_id,
    desired.city_id,
    desired.pickup_enabled,
    desired.return_enabled,
    true,
    desired.fee_mode,
    desired.fee_per_direction,
    desired.fee_note
  from jsonb_to_recordset(p_desired_rows) desired(
    city_id uuid,
    pickup_enabled boolean,
    return_enabled boolean,
    fee_mode text,
    fee_per_direction numeric,
    fee_note text
  )
  where desired.pickup_enabled or desired.return_enabled
  on conflict (offer_id, city_id) do update
  set pickup_enabled = public.car_offer_city_availability.pickup_enabled
                       or excluded.pickup_enabled,
      return_enabled = public.car_offer_city_availability.return_enabled
                       or excluded.return_enabled,
      is_active = true,
      fee_mode = excluded.fee_mode,
      fee_per_direction = excluded.fee_per_direction,
      fee_note = excluded.fee_note;

  -- Phase 2 applies the exact reviewed directional state. Because every
  -- final-active row now carries the union of current/final directions, any
  -- row order remains complete during cross-row directional swaps.
  insert into public.car_offer_city_availability (
    offer_id,
    city_id,
    pickup_enabled,
    return_enabled,
    is_active,
    fee_mode,
    fee_per_direction,
    fee_note
  )
  select
    p_offer_id,
    desired.city_id,
    desired.pickup_enabled,
    desired.return_enabled,
    true,
    desired.fee_mode,
    desired.fee_per_direction,
    desired.fee_note
  from jsonb_to_recordset(p_desired_rows) desired(
    city_id uuid,
    pickup_enabled boolean,
    return_enabled boolean,
    fee_mode text,
    fee_per_direction numeric,
    fee_note text
  )
  where desired.pickup_enabled or desired.return_enabled
  on conflict (offer_id, city_id) do update
  set pickup_enabled = excluded.pickup_enabled,
      return_enabled = excluded.return_enabled,
      is_active = excluded.is_active,
      fee_mode = excluded.fee_mode,
      fee_per_direction = excluded.fee_per_direction,
      fee_note = excluded.fee_note;

  -- Persist explicitly retained inactive rows only after all final active rows
  -- exist. is_active is always derived; callers cannot submit it.
  insert into public.car_offer_city_availability (
    offer_id,
    city_id,
    pickup_enabled,
    return_enabled,
    is_active,
    fee_mode,
    fee_per_direction,
    fee_note
  )
  select
    p_offer_id,
    desired.city_id,
    false,
    false,
    false,
    desired.fee_mode,
    desired.fee_per_direction,
    desired.fee_note
  from jsonb_to_recordset(p_desired_rows) desired(
    city_id uuid,
    pickup_enabled boolean,
    return_enabled boolean,
    fee_mode text,
    fee_per_direction numeric,
    fee_note text
  )
  where not desired.pickup_enabled and not desired.return_enabled
  on conflict (offer_id, city_id) do update
  set pickup_enabled = excluded.pickup_enabled,
      return_enabled = excluded.return_enabled,
      is_active = excluded.is_active,
      fee_mode = excluded.fee_mode,
      fee_per_direction = excluded.fee_per_direction,
      fee_note = excluded.fee_note;

  -- Remove rows absent from the reviewed final rowset last.
  delete from public.car_offer_city_availability availability
  where availability.offer_id = p_offer_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_desired_rows) desired(city_id uuid)
      where desired.city_id = availability.city_id
    );

  if v_desired_count <> (
    select count(*)
    from public.car_offer_city_availability availability
    where availability.offer_id = p_offer_id
  ) or exists (
    select 1
    from jsonb_to_recordset(p_desired_rows) desired(
      city_id uuid,
      pickup_enabled boolean,
      return_enabled boolean,
      fee_mode text,
      fee_per_direction numeric,
      fee_note text
    )
    left join public.car_offer_city_availability availability
      on availability.offer_id = p_offer_id
     and availability.city_id = desired.city_id
    where availability.offer_id is null
       or availability.pickup_enabled is distinct from desired.pickup_enabled
       or availability.return_enabled is distinct from desired.return_enabled
       or availability.is_active is distinct from (desired.pickup_enabled or desired.return_enabled)
       or availability.fee_mode is distinct from desired.fee_mode
       or availability.fee_per_direction is distinct from desired.fee_per_direction
       or availability.fee_note is distinct from desired.fee_note
  ) then
    raise exception using errcode = '23514', message = 'car_availability_batch_postcondition_failed';
  end if;

  return query
  select availability.*
  from public.car_offer_city_availability availability
  where availability.offer_id = p_offer_id
  order by availability.city_id;
end
$$;

comment on function public.admin_save_car_offer_city_availability_batch(uuid, jsonb, jsonb) is
  'Admin/service-only atomic exact-offer rowset replacement with whole-rowset optimistic concurrency. Pickup and return remain directional; is_active is derived.';

create or replace function public.admin_set_car_threshold_offer_activation_state(
  p_offer_id uuid,
  p_expected_updated_at timestamptz,
  p_activate boolean
)
returns public.car_offers
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_offer public.car_offers%rowtype;
  v_request_role text;
  v_mapped_flag boolean;
  v_threshold_flag boolean;
  v_affected integer;
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
    raise exception using
      errcode = '42501',
      message = 'car_threshold_activation_admin_required';
  end if;

  if p_offer_id is null or p_expected_updated_at is null or p_activate is null then
    raise exception using
      errcode = '22023',
      message = 'car_threshold_activation_invalid_arguments';
  end if;

  select
    setting.car_multi_city_mapped_enabled,
    setting.car_threshold_daily_rates_enabled
  into v_mapped_flag, v_threshold_flag
  from public.site_settings setting
  where setting.id = 1
  for share;

  if not found or (select count(*) from public.site_settings) <> 1 then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_activation_settings_contract_invalid';
  end if;

  select offer.*
  into v_offer
  from public.car_offers offer
  where offer.id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'car_threshold_activation_offer_missing';
  end if;

  if v_offer.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'car_threshold_activation_stale_offer';
  end if;

  if v_offer.pricing_strategy is distinct from 'threshold_daily_rate' then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_activation_requires_threshold_strategy';
  end if;

  perform 1
  from public.partners partner
  where partner.id = v_offer.owner_partner_id
  for share;

  perform 1
  from public.car_offer_daily_rate_tiers tier
  where tier.offer_id = p_offer_id
  for update;

  perform 1
  from public.car_offer_city_availability availability
  where availability.offer_id = p_offer_id
  for update;

  if p_activate then
    if v_mapped_flag is not true or v_threshold_flag is not true then
      raise exception using
        errcode = '23514',
        message = 'car_threshold_activation_requires_both_capabilities';
    end if;

    update public.car_offers
    set availability_mode = 'mapped',
        submission_status = 'approved',
        is_available = true,
        is_published = true
    where id = p_offer_id;
  else
    update public.car_offers
    set is_published = false
    where id = p_offer_id;
  end if;

  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_activation_exact_row_postcondition_failed';
  end if;

  select offer.*
  into v_offer
  from public.car_offers offer
  where offer.id = p_offer_id;

  if p_activate
     and not public.car_threshold_offer_has_public_prerequisites(p_offer_id) then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_activation_public_prerequisites_failed';
  end if;

  if not exists (
    select 1
    from public.site_settings setting
    where setting.id = 1
      and setting.car_multi_city_mapped_enabled is not distinct from v_mapped_flag
      and setting.car_threshold_daily_rates_enabled is not distinct from v_threshold_flag
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_activation_changed_capability_flags';
  end if;

  return v_offer;
end
$$;

comment on function public.admin_set_car_threshold_offer_activation_state(uuid, timestamptz, boolean) is
  'Admin/service-only exact threshold offer activation or publication-only rollback. Locks all prerequisites, preserves flags and never confirms a booking.';

alter table public.car_offers enable row level security;
alter table public.car_offer_city_availability enable row level security;
alter table public.car_offer_daily_rate_tiers enable row level security;

revoke all on function public.car_threshold_offer_has_public_prerequisites(uuid)
from public, anon, authenticated;
revoke all on function public.car_threshold_offer_route_is_public_eligible(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.car_threshold_offer_city_availability_is_public(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.resolve_public_threshold_offer_ids(text, text)
from public, anon, authenticated;
revoke all on function public.car_threshold_booking_public_eligibility_guard()
from public, anon, authenticated;
revoke all on function public.admin_save_car_offer_city_availability_batch(uuid, jsonb, jsonb)
from public, anon, authenticated;
revoke all on function public.admin_set_car_threshold_offer_activation_state(uuid, timestamptz, boolean)
from public, anon, authenticated;

grant execute on function public.car_threshold_offer_has_public_prerequisites(uuid)
to anon, authenticated, service_role;
grant execute on function public.car_threshold_offer_route_is_public_eligible(uuid, text, text)
to anon, authenticated, service_role;
grant execute on function public.car_threshold_offer_city_availability_is_public(uuid, uuid)
to anon, authenticated, service_role;
grant execute on function public.resolve_public_threshold_offer_ids(text, text)
to anon, authenticated, service_role;
grant execute on function public.car_threshold_booking_public_eligibility_guard()
to service_role;
grant execute on function public.admin_save_car_offer_city_availability_batch(uuid, jsonb, jsonb)
to authenticated, service_role;
grant execute on function public.admin_set_car_threshold_offer_activation_state(uuid, timestamptz, boolean)
to authenticated, service_role;

do $postconditions$
declare
  v_offer_policy text;
  v_availability_policy text;
  v_tier_policy text;
  v_guard_source text;
  v_batch_source text;
  v_partner_resolver_source text;
  v_activation_source text;
begin
  if exists (
    select 1
    from pg_policy policy
    where policy.polrelid = 'public.car_offers'::regclass
      and policy.polname in (
        'car_offers_auth_select',
        'Anyone can view available car offers',
        'Authenticated users can view all offers'
      )
  ) then
    raise exception using errcode = '23514', message = 'car_end_to_end_rogue_offer_policy_remains';
  end if;

  select pg_get_expr(policy.polqual, policy.polrelid)
  into v_offer_policy
  from pg_policy policy
  where policy.polrelid = 'public.car_offers'::regclass
    and policy.polname = 'car_offers_public_select';

  select pg_get_expr(policy.polqual, policy.polrelid)
  into v_availability_policy
  from pg_policy policy
  where policy.polrelid = 'public.car_offer_city_availability'::regclass
    and policy.polname = 'car_offer_city_availability_public_read';

  select pg_get_expr(policy.polqual, policy.polrelid)
  into v_tier_policy
  from pg_policy policy
  where policy.polrelid = 'public.car_offer_daily_rate_tiers'::regclass
    and policy.polname = 'car_offer_daily_rate_tiers_public_read';

  if position('car_threshold_offer_has_public_prerequisites' in coalesce(v_offer_policy, '')) = 0
     or position('legacy_compat' in coalesce(v_offer_policy, '')) = 0
     or position('legacy_compat' in coalesce(v_availability_policy, '')) = 0
     or position('car_threshold_offer_city_availability_is_public' in coalesce(v_availability_policy, '')) = 0
     or position('car_threshold_offer_has_public_prerequisites' in coalesce(v_tier_policy, '')) = 0 then
    raise exception using errcode = '23514', message = 'car_end_to_end_public_policy_contract_missing';
  end if;

  select procedure.prosrc into v_guard_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.car_threshold_booking_public_eligibility_guard()');

  select procedure.prosrc into v_batch_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure(
    'public.admin_save_car_offer_city_availability_batch(uuid,jsonb,jsonb)'
  );

  select procedure.prosrc into v_partner_resolver_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure(
    'public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)'
  );

  select procedure.prosrc into v_activation_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure(
    'public.admin_set_car_threshold_offer_activation_state(uuid,timestamptz,boolean)'
  );

  if position('car_threshold_offer_route_is_public_eligible' in coalesce(v_guard_source, '')) = 0
     or position('new.status' in coalesce(v_guard_source, '')) > 0
     or position('new.payment_status' in coalesce(v_guard_source, '')) > 0 then
    raise exception using errcode = '23514', message = 'car_end_to_end_booking_guard_contract_missing';
  end if;

  if position('car_availability_batch_admin_required' in coalesce(v_batch_source, '')) = 0
     or position('car_availability_batch_stale_snapshot' in coalesce(v_batch_source, '')) = 0
     or position('or excluded.pickup_enabled' in coalesce(v_batch_source, '')) = 0
     or position('or excluded.return_enabled' in coalesce(v_batch_source, '')) = 0
     or position('desired.pickup_enabled or desired.return_enabled' in coalesce(v_batch_source, '')) = 0
     or position('delete from public.car_offer_city_availability' in coalesce(v_batch_source, '')) = 0 then
    raise exception using errcode = '23514', message = 'car_end_to_end_batch_rpc_contract_missing';
  end if;

  if position('v_pricing_strategy = ''threshold_daily_rate''' in coalesce(v_partner_resolver_source, '')) = 0
     or position('partner.id = v_exact_owner_id' in coalesce(v_partner_resolver_source, '')) = 0
     or position('return pid;' in coalesce(v_partner_resolver_source, '')) = 0
     or position('and v_exact_owner_id is not null then' in coalesce(v_partner_resolver_source, '')) > 0 then
    raise exception using errcode = '23514', message = 'car_end_to_end_exact_owner_fail_closed_contract_missing';
  end if;

  if position('car_threshold_activation_stale_offer' in coalesce(v_activation_source, '')) = 0
     or position('car_threshold_offer_has_public_prerequisites' in coalesce(v_activation_source, '')) = 0
     or position('car_threshold_activation_changed_capability_flags' in coalesce(v_activation_source, '')) = 0
     or position('new.status' in coalesce(v_activation_source, '')) > 0
     or position('car_bookings' in coalesce(v_activation_source, '')) > 0 then
    raise exception using errcode = '23514', message = 'car_end_to_end_activation_rpc_contract_missing';
  end if;

  if (select count(*) from public.site_settings) <> 1
     or exists (
       select 1
       from public.site_settings setting
       where setting.id <> 1
          or setting.car_multi_city_mapped_enabled
          or setting.car_threshold_daily_rates_enabled
     ) then
    raise exception using errcode = '23514', message = 'car_end_to_end_public_eligibility_changed_flags';
  end if;
end
$postconditions$;

commit;
