begin;

-- Stage 3C/3D: complete, server-authoritative financial validation for future
-- threshold_daily_rate bookings. This migration is additive and inert while
-- either Cars activation flag remains false. It never accepts or confirms a
-- booking; partner availability remains the existing fulfillment workflow.

do $$
declare
  v_missing text[];
begin
  select coalesce(array_agg(name order by name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.car_bookings',
    'public.car_offers',
    'public.car_offer_city_availability',
    'public.car_offer_daily_rate_tiers',
    'public.car_rental_cities',
    'public.site_settings'
  ]::text[]) required(name)
  where to_regclass(name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'car_threshold_authoritative_required_object_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.car_rental_duration_days_24h(timestamptz,timestamptz)') is null
     or to_regprocedure('public.car_coupon_quote(text,numeric,timestamptz,timestamptz,uuid,text,text,text,uuid,text)') is null then
    raise exception using
      errcode = '42883',
      message = 'car_threshold_authoritative_required_function_missing';
  end if;

  select coalesce(array_agg(contract order by contract), '{}'::text[])
  into v_missing
  from unnest(array[
    'car_bookings.id',
    'car_bookings.offer_id',
    'car_bookings.status',
    'car_bookings.payment_status',
    'car_bookings.location',
    'car_bookings.pickup_date',
    'car_bookings.pickup_time',
    'car_bookings.pickup_location',
    'car_bookings.return_date',
    'car_bookings.return_time',
    'car_bookings.return_location',
    'car_bookings.quoted_price',
    'car_bookings.total_price',
    'car_bookings.final_price',
    'car_bookings.base_rental_price',
    'car_bookings.final_rental_price',
    'car_bookings.full_insurance',
    'car_bookings.young_driver',
    'car_bookings.coupon_id',
    'car_bookings.coupon_code',
    'car_bookings.coupon_discount_amount',
    'car_bookings.coupon_partner_id',
    'car_bookings.coupon_partner_commission_bps',
    'car_offers.pricing_strategy',
    'car_offers.availability_mode',
    'car_offers.min_rental_days',
    'car_offers.max_rental_days',
    'car_offers.insurance_mode',
    'car_offers.insurance_per_day',
    'car_offers.young_driver_fee',
    'car_offers.young_driver_cost',
    'car_offer_city_availability.fee_mode',
    'car_offer_city_availability.fee_per_direction',
    'site_settings.car_multi_city_mapped_enabled',
    'site_settings.car_threshold_daily_rates_enabled'
  ]::text[]) required(contract)
  where not exists (
    select 1
    from information_schema.columns column_contract
    where column_contract.table_schema = 'public'
      and column_contract.table_name = split_part(required.contract, '.', 1)
      and column_contract.column_name = split_part(required.contract, '.', 2)
  );

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42703',
      message = 'car_threshold_authoritative_required_column_missing',
      detail = array_to_string(v_missing, ',');
  end if;
end
$$;

alter table public.car_bookings
  add column if not exists currency text,
  add column if not exists pickup_location_fee numeric(12,2),
  add column if not exists return_location_fee numeric(12,2),
  add column if not exists insurance_added boolean,
  add column if not exists insurance_cost numeric(12,2),
  add column if not exists young_driver_fee boolean,
  add column if not exists young_driver_cost numeric(12,2),
  add column if not exists pickup_city_code text,
  add column if not exists return_city_code text,
  add column if not exists pricing_snapshot jsonb,
  add column if not exists pricing_validated_at timestamptz;

do $$
declare
  v_invalid text[];
begin
  select coalesce(array_agg(expected.column_name order by expected.column_name), '{}'::text[])
  into v_invalid
  from (values
    ('currency'::text, 'text'::text),
    ('pickup_location_fee', 'numeric(12,2)'),
    ('return_location_fee', 'numeric(12,2)'),
    ('insurance_added', 'boolean'),
    ('insurance_cost', 'numeric(12,2)'),
    ('young_driver_fee', 'boolean'),
    ('young_driver_cost', 'numeric(12,2)'),
    ('pickup_city_code', 'text'),
    ('return_city_code', 'text'),
    ('pricing_snapshot', 'jsonb'),
    ('pricing_validated_at', 'timestamp with time zone')
  ) expected(column_name, formatted_type)
  where not exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = to_regclass('public.car_bookings')
      and attribute.attname = expected.column_name
      and attribute.attnum > 0
      and not attribute.attisdropped
      and format_type(attribute.atttypid, attribute.atttypmod) = expected.formatted_type
  );

  if cardinality(v_invalid) > 0 then
    raise exception using
      errcode = '42804',
      message = 'car_threshold_authoritative_booking_column_type_mismatch',
      detail = array_to_string(v_invalid, ',');
  end if;
end
$$;

alter table public.car_bookings
  drop constraint if exists car_bookings_pickup_city_code_check,
  drop constraint if exists car_bookings_return_city_code_check,
  drop constraint if exists car_bookings_pricing_snapshot_check,
  drop constraint if exists car_bookings_pickup_location_fee_check,
  drop constraint if exists car_bookings_return_location_fee_check,
  drop constraint if exists car_bookings_insurance_cost_check,
  drop constraint if exists car_bookings_young_driver_cost_check;

alter table public.car_bookings
  add constraint car_bookings_pickup_city_code_check
    check (pickup_city_code is null or pickup_city_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint car_bookings_return_city_code_check
    check (return_city_code is null or return_city_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint car_bookings_pricing_snapshot_check
    check (pricing_snapshot is null or jsonb_typeof(pricing_snapshot) = 'object'),
  add constraint car_bookings_pickup_location_fee_check
    check (pickup_location_fee is null or pickup_location_fee >= 0),
  add constraint car_bookings_return_location_fee_check
    check (return_location_fee is null or return_location_fee >= 0),
  add constraint car_bookings_insurance_cost_check
    check (insurance_cost is null or insurance_cost >= 0),
  add constraint car_bookings_young_driver_cost_check
    check (young_driver_cost is null or young_driver_cost >= 0);

create index if not exists car_bookings_pricing_snapshot_strategy_idx
  on public.car_bookings ((pricing_snapshot ->> 'pricing_strategy'))
  where pricing_snapshot is not null;

create or replace function public.car_threshold_standard_directional_fee(
  p_city_code text
)
returns numeric(12,2)
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case lower(btrim(p_city_code))
    when 'larnaca' then 0.00::numeric(12,2)
    when 'nicosia' then 15.00::numeric(12,2)
    when 'ayia-napa' then 15.00::numeric(12,2)
    when 'protaras' then 20.00::numeric(12,2)
    when 'limassol' then 20.00::numeric(12,2)
    when 'paphos' then 40.00::numeric(12,2)
    else null::numeric(12,2)
  end
$$;

create or replace function public.car_rental_local_duration_days_24h(
  p_pickup_date date,
  p_pickup_time time without time zone,
  p_return_date date,
  p_return_time time without time zone
)
returns integer
language sql
immutable
strict
set search_path = pg_catalog
as $$
  -- PostgreSQL otherwise shifts a non-existent spring-forward wall time into
  -- the next valid hour. The browser contract rejects that input, so require
  -- both local values to survive an exact timezone round trip before pricing.
  select case
    when (
      ((p_pickup_date + p_pickup_time) at time zone 'Europe/Nicosia')
        at time zone 'Europe/Nicosia'
    ) = p_pickup_date + p_pickup_time
    and (
      ((p_return_date + p_return_time) at time zone 'Europe/Nicosia')
        at time zone 'Europe/Nicosia'
    ) = p_return_date + p_return_time
    then public.car_rental_duration_days_24h(
      (p_pickup_date + p_pickup_time) at time zone 'Europe/Nicosia',
      (p_return_date + p_return_time) at time zone 'Europe/Nicosia'
    )
    else null::integer
  end
$$;

create or replace function public.resolve_car_threshold_authoritative_quote(
  p_offer_id uuid,
  p_pickup_date date,
  p_pickup_time time without time zone,
  p_return_date date,
  p_return_time time without time zone,
  p_pickup_city_code text,
  p_return_city_code text,
  p_pickup_location text,
  p_return_location text,
  p_full_insurance boolean default false,
  p_young_driver boolean default false,
  p_coupon_code text default null,
  p_user_id uuid default auth.uid(),
  p_user_email text default null
)
returns table (
  quote_valid boolean,
  offer_id uuid,
  pricing_strategy text,
  tier_id uuid,
  threshold_days integer,
  rental_days integer,
  daily_rate numeric(12,2),
  rental_base_price numeric(12,2),
  pickup_location_fee numeric(12,2),
  return_location_fee numeric(12,2),
  insurance_selected boolean,
  insurance_mode text,
  insurance_daily_rate numeric(12,2),
  insurance_cost numeric(12,2),
  young_driver_selected boolean,
  young_driver_daily_rate numeric(12,2),
  young_driver_cost numeric(12,2),
  pre_discount_total numeric(12,2),
  coupon_id uuid,
  coupon_code text,
  discount_amount numeric(12,2),
  final_rental_price numeric(12,2),
  currency text,
  coupon_partner_id uuid,
  coupon_partner_commission_bps integer,
  pricing_snapshot jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_offer public.car_offers%rowtype;
  v_tier public.car_offer_daily_rate_tiers%rowtype;
  v_pickup_availability public.car_offer_city_availability%rowtype;
  v_return_availability public.car_offer_city_availability%rowtype;
  v_pickup_city public.car_rental_cities%rowtype;
  v_return_city public.car_rental_cities%rowtype;
  v_pickup_code text := lower(btrim(coalesce(p_pickup_city_code, '')));
  v_return_code text := lower(btrim(coalesce(p_return_city_code, '')));
  v_pickup_at timestamptz;
  v_return_at timestamptz;
  v_rental_days integer;
  v_pickup_fee numeric(12,2);
  v_return_fee numeric(12,2);
  v_insurance_mode text;
  v_insurance_rate numeric(12,2) := 0;
  v_insurance_selected boolean := false;
  v_insurance_cost numeric(12,2) := 0;
  v_young_selected boolean := coalesce(p_young_driver, false);
  v_young_rate numeric(12,2) := 0;
  v_young_cost numeric(12,2) := 0;
  v_rental_base numeric(12,2);
  v_pre_discount numeric(12,2);
  v_discount numeric(12,2) := 0;
  v_final numeric(12,2);
  v_coupon record;
  v_coupon_code text := upper(btrim(coalesce(p_coupon_code, '')));
  v_coupon_id uuid;
  v_applied_coupon_code text;
  v_coupon_partner_id uuid;
  v_coupon_partner_commission_bps integer;
  v_snapshot jsonb;
  v_authenticated_user_id uuid := auth.uid();
  v_effective_user_id uuid;
begin
  -- Coupon/user eligibility must be evaluated for the actual JWT principal;
  -- callers cannot quote as another authenticated user. Anonymous quotes may
  -- only use a NULL user id.
  if (v_authenticated_user_id is null and p_user_id is not null)
     or (
       v_authenticated_user_id is not null
       and p_user_id is not null
       and p_user_id is distinct from v_authenticated_user_id
     ) then
    return;
  end if;
  v_effective_user_id := v_authenticated_user_id;
  if v_authenticated_user_id is not null
     and nullif(btrim(coalesce(p_user_email, '')), '') is not null
     and lower(btrim(p_user_email)) is distinct from lower(btrim(coalesce(auth.jwt() ->> 'email', ''))) then
    return;
  end if;

  if not exists (
    select 1
    from public.site_settings setting
    where setting.car_multi_city_mapped_enabled is true
      and setting.car_threshold_daily_rates_enabled is true
  ) then
    return;
  end if;

  if v_pickup_code !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or v_return_code !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or lower(btrim(coalesce(p_pickup_location, ''))) <> v_pickup_code
     or lower(btrim(coalesce(p_return_location, ''))) <> v_return_code then
    return;
  end if;

  select offer.*
  into v_offer
  from public.car_offers offer
  where offer.id = p_offer_id
    and offer.pricing_strategy = 'threshold_daily_rate'
    and offer.availability_mode = 'mapped'
    and offer.is_available is true
    and offer.is_published is true;
  if not found then return; end if;

  select city.*
  into v_pickup_city
  from public.car_rental_cities city
  where city.code = v_pickup_code
    and city.is_active is true;
  if not found then return; end if;

  select city.*
  into v_return_city
  from public.car_rental_cities city
  where city.code = v_return_code
    and city.is_active is true;
  if not found then return; end if;

  select availability.*
  into v_pickup_availability
  from public.car_offer_city_availability availability
  where availability.offer_id = p_offer_id
    and availability.city_id = v_pickup_city.id
    and availability.is_active is true
    and availability.pickup_enabled is true;
  if not found then return; end if;

  select availability.*
  into v_return_availability
  from public.car_offer_city_availability availability
  where availability.offer_id = p_offer_id
    and availability.city_id = v_return_city.id
    and availability.is_active is true
    and availability.return_enabled is true;
  if not found then return; end if;

  v_pickup_at := (p_pickup_date + p_pickup_time) at time zone 'Europe/Nicosia';
  v_return_at := (p_return_date + p_return_time) at time zone 'Europe/Nicosia';
  v_rental_days := public.car_rental_duration_days_24h(v_pickup_at, v_return_at);
  if v_rental_days is null
     or v_rental_days < v_offer.min_rental_days
     or (v_offer.max_rental_days is not null and v_rental_days > v_offer.max_rental_days) then
    return;
  end if;

  select tier.*
  into v_tier
  from public.car_offer_daily_rate_tiers tier
  where tier.offer_id = p_offer_id
    and tier.is_active is true
    and tier.threshold_days <= v_rental_days
  order by tier.threshold_days desc
  limit 1;
  if not found or v_tier.threshold_days < v_offer.min_rental_days then return; end if;

  v_pickup_fee := case v_pickup_availability.fee_mode
    when 'override' then v_pickup_availability.fee_per_direction
    when 'inherit' then public.car_threshold_standard_directional_fee(v_pickup_code)
    else null
  end;
  v_return_fee := case v_return_availability.fee_mode
    when 'override' then v_return_availability.fee_per_direction
    when 'inherit' then public.car_threshold_standard_directional_fee(v_return_code)
    else null
  end;
  if v_pickup_fee is null or v_pickup_fee < 0
     or v_return_fee is null or v_return_fee < 0 then
    return;
  end if;

  v_insurance_mode := lower(btrim(coalesce(v_offer.insurance_mode, 'legacy_optional_daily')));
  if v_insurance_mode = 'included' then
    v_insurance_selected := false;
    v_insurance_rate := 0;
  elsif v_insurance_mode = 'not_offered' then
    if coalesce(p_full_insurance, false) then return; end if;
    v_insurance_selected := false;
    v_insurance_rate := 0;
  elsif v_insurance_mode in ('legacy_optional_daily', 'optional_daily') then
    v_insurance_rate := coalesce(v_offer.insurance_per_day, case when v_insurance_mode = 'legacy_optional_daily' then 17 else null end);
    if v_insurance_rate is null or v_insurance_rate < 0 then return; end if;
    v_insurance_selected := coalesce(p_full_insurance, false);
  else
    return;
  end if;
  v_insurance_cost := round(case when v_insurance_selected then v_insurance_rate * v_rental_days else 0 end, 2);

  if v_young_selected and v_offer.young_driver_fee is not true then return; end if;
  v_young_rate := case when v_offer.young_driver_fee is true then coalesce(v_offer.young_driver_cost, 0) else 0 end;
  if v_young_rate < 0 then return; end if;
  v_young_cost := round(case when v_young_selected then v_young_rate * v_rental_days else 0 end, 2);

  v_rental_base := round(v_tier.daily_rate * v_rental_days, 2);
  v_pre_discount := round(v_rental_base + v_pickup_fee + v_return_fee + v_insurance_cost + v_young_cost, 2);
  if v_rental_base <= 0 or v_pre_discount <= 0 then return; end if;

  v_final := v_pre_discount;
  if v_coupon_code <> '' then
    select coupon_quote.*
    into v_coupon
    from public.car_coupon_quote(
      v_coupon_code,
      v_pre_discount,
      v_pickup_at,
      v_return_at,
      p_offer_id,
      v_offer.location,
      null,
      null,
      v_effective_user_id,
      p_user_email
    ) coupon_quote
    limit 1;
    if not found or v_coupon.is_valid is not true then return; end if;
    v_discount := round(coalesce(v_coupon.discount_amount, 0), 2);
    v_final := round(v_coupon.final_rental_price, 2);
    v_coupon_id := v_coupon.coupon_id;
    v_applied_coupon_code := v_coupon.coupon_code;
    v_coupon_partner_id := v_coupon.partner_id;
    v_coupon_partner_commission_bps := v_coupon.partner_commission_bps_override;
  end if;

  v_snapshot := jsonb_build_object(
    'version', 'car-threshold-authoritative-v1',
    'pricing_strategy', 'threshold_daily_rate',
    'offer_id', v_offer.id,
    'tier_id', v_tier.id,
    'threshold_days', v_tier.threshold_days,
    'daily_rate', v_tier.daily_rate,
    'rental_days', v_rental_days,
    'base_rental_price', v_rental_base,
    'pickup_city_code', v_pickup_code,
    'return_city_code', v_return_code,
    'pickup_fee_mode', v_pickup_availability.fee_mode,
    'return_fee_mode', v_return_availability.fee_mode,
    'pickup_location_fee', v_pickup_fee,
    'return_location_fee', v_return_fee,
    'insurance_mode', v_insurance_mode,
    'insurance_selected', v_insurance_selected,
    'insurance_daily_rate', v_insurance_rate,
    'insurance_cost', v_insurance_cost,
    'young_driver_selected', v_young_selected,
    'young_driver_daily_rate', v_young_rate,
    'young_driver_cost', v_young_cost,
    'pre_discount_total', v_pre_discount,
    'coupon_id', v_coupon_id,
    'coupon_code', v_applied_coupon_code,
    'discount_amount', v_discount,
    'final_rental_price', v_final,
    'currency', upper(coalesce(nullif(v_offer.currency, ''), 'EUR')),
    'pickup_at', v_pickup_at,
    'return_at', v_return_at
  );

  quote_valid := true;
  offer_id := v_offer.id;
  pricing_strategy := 'threshold_daily_rate';
  tier_id := v_tier.id;
  threshold_days := v_tier.threshold_days;
  rental_days := v_rental_days;
  daily_rate := v_tier.daily_rate;
  rental_base_price := v_rental_base;
  pickup_location_fee := v_pickup_fee;
  return_location_fee := v_return_fee;
  insurance_selected := v_insurance_selected;
  insurance_mode := v_insurance_mode;
  insurance_daily_rate := v_insurance_rate;
  insurance_cost := v_insurance_cost;
  young_driver_selected := v_young_selected;
  young_driver_daily_rate := v_young_rate;
  young_driver_cost := v_young_cost;
  pre_discount_total := v_pre_discount;
  coupon_id := v_coupon_id;
  coupon_code := v_applied_coupon_code;
  discount_amount := v_discount;
  final_rental_price := v_final;
  currency := upper(coalesce(nullif(v_offer.currency, ''), 'EUR'));
  coupon_partner_id := v_coupon_partner_id;
  coupon_partner_commission_bps := v_coupon_partner_commission_bps;
  pricing_snapshot := v_snapshot;
  return next;
end
$$;

create or replace function public.car_validate_threshold_booking_financials()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_strategy text;
  v_offer_location text;
  v_quote record;
  v_coupon_code text := nullif(upper(btrim(coalesce(new.coupon_code, ''))), '');
  v_request_role text := coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
begin
  if new.offer_id is null then
    -- All browser-created Cars requests must identify the exact offer. This
    -- closes the only route around strategy selection while retaining the
    -- nullable FK for historical rows and privileged operational maintenance.
    if tg_op = 'INSERT' and v_request_role in ('anon', 'authenticated') then
      raise exception using errcode = '23514', message = 'car_booking_public_insert_requires_exact_offer';
    end if;
    if new.pricing_snapshot is not null then
      raise exception using errcode = '23514', message = 'threshold_booking_snapshot_requires_exact_offer';
    end if;
    return new;
  end if;

  select offer.pricing_strategy, lower(btrim(offer.location))
  into v_strategy, v_offer_location
  from public.car_offers offer
  where offer.id = new.offer_id;
  if not found then return new; end if;

  if v_strategy <> 'threshold_daily_rate' then
    if new.pricing_snapshot is not null
       and new.pricing_snapshot ->> 'pricing_strategy' = 'threshold_daily_rate' then
      raise exception using errcode = '23514', message = 'threshold_booking_snapshot_strategy_mismatch';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.site_settings setting
    where setting.car_multi_city_mapped_enabled is true
      and setting.car_threshold_daily_rates_enabled is true
  ) then
    raise exception using errcode = '23514', message = 'threshold_booking_runtime_disabled';
  end if;

  if tg_op = 'INSERT' and coalesce(new.status, '') <> 'pending' then
    raise exception using errcode = '23514', message = 'threshold_booking_must_enter_partner_workflow_pending';
  end if;

  -- Financial validation cannot be used to forge a successful payment. A
  -- threshold request always enters the existing workflow as unpaid; only the
  -- existing service-deposit/Stripe path may update payment_status later.
  if tg_op = 'INSERT' and coalesce(new.payment_status, 'unpaid') <> 'unpaid' then
    raise exception using errcode = '23514', message = 'threshold_booking_must_enter_payment_workflow_unpaid';
  end if;

  select quote.*
  into v_quote
  from public.resolve_car_threshold_authoritative_quote(
    new.offer_id,
    new.pickup_date,
    coalesce(new.pickup_time, '10:00'::time),
    new.return_date,
    coalesce(new.return_time, '10:00'::time),
    new.pickup_city_code,
    new.return_city_code,
    new.pickup_location,
    new.return_location,
    coalesce(new.full_insurance, new.insurance_added, false),
    coalesce(new.young_driver, false),
    v_coupon_code,
    auth.uid(),
    coalesce(nullif(to_jsonb(new) ->> 'email', ''), nullif(to_jsonb(new) ->> 'customer_email', ''))
  ) quote
  limit 1;

  if not found or v_quote.quote_valid is not true then
    raise exception using errcode = '23514', message = 'threshold_booking_authoritative_quote_rejected';
  end if;

  if lower(btrim(coalesce(new.location, ''))) <> v_offer_location
     or lower(btrim(coalesce(new.pickup_location, ''))) <> new.pickup_city_code
     or lower(btrim(coalesce(new.return_location, ''))) <> new.return_city_code
     or round(new.quoted_price, 2) is distinct from v_quote.final_rental_price
     or round(new.total_price, 2) is distinct from v_quote.final_rental_price
     or round(new.base_rental_price, 2) is distinct from v_quote.pre_discount_total
     or round(new.final_rental_price, 2) is distinct from v_quote.final_rental_price
     or round(coalesce(new.pickup_location_fee, 0), 2) is distinct from v_quote.pickup_location_fee
     or round(coalesce(new.return_location_fee, 0), 2) is distinct from v_quote.return_location_fee
     or round(coalesce(new.insurance_cost, 0), 2) is distinct from v_quote.insurance_cost
     or coalesce(new.insurance_added, false) is distinct from v_quote.insurance_selected
     or coalesce(new.full_insurance, false) is distinct from v_quote.insurance_selected
     or round(coalesce(new.young_driver_cost, 0), 2) is distinct from v_quote.young_driver_cost
     or coalesce(new.young_driver, false) is distinct from v_quote.young_driver_selected
     or coalesce(new.young_driver_fee, false) is distinct from v_quote.young_driver_selected
     or new.coupon_id is distinct from v_quote.coupon_id
     or nullif(upper(btrim(coalesce(new.coupon_code, ''))), '') is distinct from nullif(upper(btrim(coalesce(v_quote.coupon_code, ''))), '')
     or round(coalesce(new.coupon_discount_amount, 0), 2) is distinct from v_quote.discount_amount
     or new.coupon_partner_id is distinct from v_quote.coupon_partner_id
     or new.coupon_partner_commission_bps is distinct from v_quote.coupon_partner_commission_bps
     or upper(btrim(coalesce(new.currency, ''))) is distinct from v_quote.currency
     or new.pricing_snapshot is distinct from v_quote.pricing_snapshot
     or (new.final_price is not null and round(new.final_price, 2) is distinct from v_quote.final_rental_price) then
    raise exception using errcode = '23514', message = 'threshold_booking_financial_tamper_detected';
  end if;

  new.pricing_validated_at := clock_timestamp();
  return new;
end
$$;

drop trigger if exists car_bookings_validate_threshold_financials
on public.car_bookings;
create trigger car_bookings_validate_threshold_financials
before insert or update of
  offer_id,
  location,
  pickup_date,
  pickup_time,
  pickup_location,
  pickup_city_code,
  return_date,
  return_time,
  return_location,
  return_city_code,
  quoted_price,
  total_price,
  final_price,
  currency,
  base_rental_price,
  final_rental_price,
  pickup_location_fee,
  return_location_fee,
  insurance_added,
  full_insurance,
  insurance_cost,
  young_driver,
  young_driver_fee,
  young_driver_cost,
  coupon_id,
  coupon_code,
  coupon_discount_amount,
  coupon_partner_id,
  coupon_partner_commission_bps,
  pricing_snapshot
on public.car_bookings
for each row execute function public.car_validate_threshold_booking_financials();

revoke all on function public.car_threshold_standard_directional_fee(text) from public, anon, authenticated;
revoke all on function public.car_rental_local_duration_days_24h(date,time without time zone,date,time without time zone) from public, anon, authenticated;
revoke all on function public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text) from public;
revoke all on function public.car_validate_threshold_booking_financials() from public, anon, authenticated;

grant execute on function public.car_threshold_standard_directional_fee(text) to service_role;
grant execute on function public.car_rental_local_duration_days_24h(date,time without time zone,date,time without time zone) to service_role;
grant execute on function public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text) to anon, authenticated, service_role;
grant execute on function public.car_validate_threshold_booking_financials() to service_role;

comment on function public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text) is
  'Returns a complete exact-offer threshold quote from database configuration. It validates money only and never accepts or confirms a booking.';
comment on column public.car_bookings.pricing_snapshot is
  'Additive audit snapshot for server-validated threshold pricing; NULL for legacy bookings.';
comment on column public.car_bookings.pricing_validated_at is
  'Financial-validation timestamp only. It does not represent partner acceptance or booking confirmation.';
comment on column public.car_bookings.pickup_location_fee is
  'Directional pickup-fee snapshot; authoritatively validated for threshold bookings.';
comment on column public.car_bookings.return_location_fee is
  'Directional return-fee snapshot; authoritatively validated for threshold bookings.';
comment on column public.car_bookings.insurance_cost is
  'Insurance-cost snapshot; authoritatively validated for threshold bookings.';
comment on column public.car_bookings.young_driver_cost is
  'Young-driver-cost snapshot; authoritatively validated for threshold bookings.';

do $$
begin
  if exists (
    select 1 from public.site_settings
    where car_threshold_daily_rates_enabled is true
       or car_multi_city_mapped_enabled is true
  ) or exists (
    select 1 from public.car_offers
    where pricing_strategy <> 'legacy_compat'
       or availability_mode <> 'legacy'
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_authoritative_foundation_not_inert';
  end if;
end
$$;

commit;
