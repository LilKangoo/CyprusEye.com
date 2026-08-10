begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Customer-facing Cars references are intentionally separate from payment
-- deposits and from the internal UUID.  They are derived on the server from
-- the already server-generated booking UUID and are immutable thereafter.
do $$
declare
  v_missing_columns text[];
begin
  if to_regclass('public.car_bookings') is null then
    raise exception using
      errcode = '42P01',
      message = 'car_booking_public_reference_required_table_missing';
  end if;

  if to_regclass('public.car_offers') is null then
    raise exception using
      errcode = '42P01',
      message = 'car_booking_public_reference_offer_table_missing';
  end if;

  if to_regprocedure('public.car_validate_threshold_booking_financials()') is null then
    raise exception using
      errcode = '42883',
      message = 'car_booking_public_reference_threshold_validator_missing';
  end if;

  select coalesce(array_agg(required.column_name order by required.column_name), '{}'::text[])
  into v_missing_columns
  from unnest(array[
    'id','full_name','email','phone','country','car_model','offer_id',
    'pickup_date','pickup_time','pickup_location','pickup_address','pickup_city_code',
    'return_date','return_time','return_location','return_address','return_city_code',
    'num_passengers','child_seats','full_insurance','flight_number','special_requests',
    'lang','location','status','source','payment_status',
    'quoted_price','total_price','currency','base_rental_price','final_rental_price',
    'pickup_location_fee','return_location_fee','insurance_added','insurance_cost',
    'young_driver','young_driver_fee','young_driver_cost',
    'coupon_id','coupon_code','coupon_discount_amount','coupon_partner_id','coupon_partner_commission_bps',
    'pricing_snapshot','referral_code','referral_source','referral_captured_at'
  ]::text[]) required(column_name)
  where not exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = to_regclass('public.car_bookings')
      and attribute.attname = required.column_name
      and attribute.attnum > 0
      and not attribute.attisdropped
  );

  if cardinality(v_missing_columns) > 0 then
    raise exception using
      errcode = '42703',
      message = 'car_booking_public_reference_required_columns_missing',
      detail = array_to_string(v_missing_columns, ',');
  end if;

  if not exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = to_regclass('public.car_offers')
      and attribute.attname = 'is_available'
      and attribute.attnum > 0
      and not attribute.attisdropped
  ) or not exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = to_regclass('public.car_offers')
      and attribute.attname = 'is_published'
      and attribute.attnum > 0
      and not attribute.attisdropped
  ) then
    raise exception using
      errcode = '42703',
      message = 'car_booking_public_reference_offer_columns_missing';
  end if;
end
$$;

alter table public.car_bookings
  add column if not exists booking_reference text,
  add column if not exists public_submission_key uuid;

do $$
declare
  v_invalid text[];
begin
  select coalesce(array_agg(expected.column_name order by expected.column_name), '{}'::text[])
  into v_invalid
  from (values
    ('booking_reference'::text, 'text'::text),
    ('public_submission_key', 'uuid')
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
      message = 'car_booking_public_reference_column_type_mismatch',
      detail = array_to_string(v_invalid, ',');
  end if;
end
$$;

-- Freeze public inserts before recording the protected baseline so an
-- in-flight request cannot race the backfill/count comparison.
lock table public.car_bookings in share row exclusive mode;

create temporary table _car_booking_public_reference_before on commit drop as
select
  count(*)::bigint as booking_count,
  md5(coalesce(string_agg(
    md5((to_jsonb(booking) - 'booking_reference' - 'public_submission_key')::text),
    ',' order by booking.id
  ), '')) as protected_fingerprint
from public.car_bookings booking;

do $$
begin
  if exists (
    select 1
    from pg_trigger trigger_state
    where trigger_state.tgrelid = to_regclass('public.car_bookings')
      and not trigger_state.tgisinternal
      and trigger_state.tgenabled <> 'O'
  ) then
    raise exception using
      errcode = '55000',
      message = 'car_booking_public_reference_requires_enabled_booking_triggers';
  end if;
end
$$;

-- The backfill changes only the newly added reference column.  Temporarily
-- pausing user triggers prevents it from looking like an operational booking
-- update (updated_at, fulfillment and notification triggers must not run).
alter table public.car_bookings disable trigger user;

update public.car_bookings booking
set booking_reference = 'CAR-' || substr(replace(booking.id::text, '-', ''), 1, 8)
where booking.booking_reference is null;

alter table public.car_bookings enable trigger user;

do $$
declare
  v_invalid_count integer;
  v_duplicate_count integer;
begin
  select count(*)::integer
  into v_invalid_count
  from public.car_bookings booking
  where booking.booking_reference is null
     or booking.booking_reference !~ '^CAR-[0-9a-f]{8}$'
     or booking.booking_reference <> 'CAR-' || substr(replace(booking.id::text, '-', ''), 1, 8);

  select count(*)::integer
  into v_duplicate_count
  from (
    select booking.booking_reference
    from public.car_bookings booking
    group by booking.booking_reference
    having count(*) > 1
  ) duplicate_reference;

  if v_invalid_count > 0 or v_duplicate_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'car_booking_public_reference_backfill_invalid',
      detail = format('invalid=%s,duplicates=%s', v_invalid_count, v_duplicate_count);
  end if;
end
$$;

alter table public.car_bookings
  alter column booking_reference set not null;

alter table public.car_bookings
  drop constraint if exists car_bookings_booking_reference_format_check,
  drop constraint if exists car_bookings_booking_reference_key;

alter table public.car_bookings
  add constraint car_bookings_booking_reference_format_check
    check (booking_reference ~ '^CAR-[0-9a-f]{8}$'),
  add constraint car_bookings_booking_reference_key
    unique (booking_reference);

create unique index if not exists car_bookings_public_submission_key_key
  on public.car_bookings (public_submission_key)
  where public_submission_key is not null;

create or replace function public.car_bookings_assign_public_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_expected text;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception using errcode = '23514', message = 'car_booking_internal_id_is_immutable';
    end if;
    if new.booking_reference is distinct from old.booking_reference then
      raise exception using errcode = '23514', message = 'car_booking_public_reference_is_immutable';
    end if;
    if new.public_submission_key is distinct from old.public_submission_key then
      raise exception using errcode = '23514', message = 'car_booking_submission_key_is_immutable';
    end if;
    return new;
  end if;

  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  v_expected := 'CAR-' || substr(replace(new.id::text, '-', ''), 1, 8);
  new.booking_reference := v_expected;
  return new;
end
$$;

drop trigger if exists car_bookings_00_assign_public_reference
on public.car_bookings;
create trigger car_bookings_00_assign_public_reference
before insert or update of id, booking_reference, public_submission_key
on public.car_bookings
for each row execute function public.car_bookings_assign_public_reference();

create or replace function public.submit_car_booking_request(
  p_submission_key uuid,
  p_booking jsonb
)
returns table(
  booking_id uuid,
  booking_reference text,
  booking_status text,
  idempotent boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_booking public.car_bookings%rowtype;
  v_unknown_keys text[];
  v_offer_id uuid;
  v_pickup_at timestamp without time zone;
  v_return_at timestamp without time zone;
begin
  if p_submission_key is null then
    raise exception using errcode = '22023', message = 'car_booking_submission_key_required';
  end if;
  if p_booking is null or jsonb_typeof(p_booking) <> 'object' then
    raise exception using errcode = '22023', message = 'car_booking_payload_must_be_object';
  end if;

  -- A completed request must remain recoverable even when the offer or its
  -- route is changed after commit but before the browser receives the reply.
  -- The opaque key returns only the narrow, PII-free reference contract.
  select booking.*
  into v_booking
  from public.car_bookings booking
  where booking.public_submission_key = p_submission_key;

  if found then
    if v_booking.booking_reference is null then
      raise exception using errcode = '23514', message = 'car_booking_idempotent_result_missing';
    end if;
    booking_id := v_booking.id;
    booking_reference := v_booking.booking_reference;
    booking_status := v_booking.status;
    idempotent := true;
    return next;
    return;
  end if;

  select coalesce(array_agg(key_name order by key_name), '{}'::text[])
  into v_unknown_keys
  from jsonb_object_keys(p_booking) key_name
  where key_name <> all (array[
    'full_name','email','phone','country',
    'car_model','offer_id',
    'pickup_date','pickup_time','pickup_location','pickup_address','pickup_city_code',
    'return_date','return_time','return_location','return_address','return_city_code',
    'num_passengers','child_seats','full_insurance','flight_number','special_requests',
    'lang','location','status','source',
    'quoted_price','total_price','currency','base_rental_price','final_rental_price',
    'pickup_location_fee','return_location_fee','insurance_added','insurance_cost',
    'young_driver','young_driver_fee','young_driver_cost',
    'coupon_id','coupon_code','coupon_discount_amount','coupon_partner_id','coupon_partner_commission_bps',
    'pricing_snapshot',
    'referral_code','referral_source','referral_captured_at'
  ]::text[]);

  if cardinality(v_unknown_keys) > 0 then
    raise exception using
      errcode = '22023',
      message = 'car_booking_payload_contains_unsupported_fields',
      detail = array_to_string(v_unknown_keys, ',');
  end if;

  if nullif(btrim(p_booking ->> 'full_name'), '') is null
     or nullif(btrim(p_booking ->> 'email'), '') is null
     or nullif(btrim(p_booking ->> 'phone'), '') is null
     or nullif(btrim(p_booking ->> 'car_model'), '') is null
     or nullif(btrim(p_booking ->> 'offer_id'), '') is null
     or nullif(btrim(p_booking ->> 'pickup_date'), '') is null
     or nullif(btrim(p_booking ->> 'pickup_location'), '') is null
     or nullif(btrim(p_booking ->> 'return_date'), '') is null
     or nullif(btrim(p_booking ->> 'return_location'), '') is null
     or nullif(btrim(p_booking ->> 'location'), '') is null then
    raise exception using errcode = '23502', message = 'car_booking_required_field_missing';
  end if;

  if btrim(p_booking ->> 'email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(regexp_replace(p_booking ->> 'phone', '[^0-9]', '', 'g')) < 6 then
    raise exception using errcode = '23514', message = 'car_booking_contact_invalid';
  end if;

  if coalesce(nullif(btrim(p_booking ->> 'lang'), ''), 'en') not in ('pl', 'en', 'he')
     or coalesce(nullif(btrim(p_booking ->> 'source'), ''), 'website') not in ('website', 'website_autopfo', 'website_autolca') then
    raise exception using errcode = '23514', message = 'car_booking_public_metadata_invalid';
  end if;

  v_offer_id := (p_booking ->> 'offer_id')::uuid;
  if not exists (
    select 1
    from public.car_offers offer
    where offer.id = v_offer_id
      and offer.is_available is true
      and offer.is_published is true
  ) then
    raise exception using errcode = '23514', message = 'car_booking_exact_public_offer_required';
  end if;

  v_pickup_at := (p_booking ->> 'pickup_date')::date
    + coalesce(nullif(p_booking ->> 'pickup_time', '')::time, '10:00'::time);
  v_return_at := (p_booking ->> 'return_date')::date
    + coalesce(nullif(p_booking ->> 'return_time', '')::time, '10:00'::time);
  if v_return_at <= v_pickup_at then
    raise exception using errcode = '22007', message = 'car_booking_return_must_follow_pickup';
  end if;

  if coalesce(nullif(p_booking ->> 'num_passengers', '')::integer, 1) <= 0
     or coalesce(nullif(p_booking ->> 'child_seats', '')::integer, 0) < 0
     or coalesce(nullif(p_booking ->> 'quoted_price', '')::numeric, 0) < 0
     or coalesce(nullif(p_booking ->> 'total_price', '')::numeric, 0) < 0
     or coalesce(nullif(p_booking ->> 'base_rental_price', '')::numeric, 0) < 0
     or coalesce(nullif(p_booking ->> 'final_rental_price', '')::numeric, 0) < 0
     or coalesce(nullif(p_booking ->> 'pickup_location_fee', '')::numeric, 0) < 0
     or coalesce(nullif(p_booking ->> 'return_location_fee', '')::numeric, 0) < 0
     or coalesce(nullif(p_booking ->> 'insurance_cost', '')::numeric, 0) < 0
     or coalesce(nullif(p_booking ->> 'young_driver_cost', '')::numeric, 0) < 0
     or coalesce(nullif(p_booking ->> 'coupon_discount_amount', '')::numeric, 0) < 0 then
    raise exception using errcode = '23514', message = 'car_booking_public_numeric_value_invalid';
  end if;

  if nullif(btrim(p_booking ->> 'status'), '') is not null
     and p_booking ->> 'status' <> 'pending' then
    raise exception using errcode = '23514', message = 'car_booking_public_status_must_be_pending';
  end if;

  insert into public.car_bookings (
    public_submission_key,
    full_name, email, phone, country,
    car_model, offer_id,
    pickup_date, pickup_time, pickup_location, pickup_address, pickup_city_code,
    return_date, return_time, return_location, return_address, return_city_code,
    num_passengers, child_seats, full_insurance, flight_number, special_requests,
    lang, location, status, source, payment_status,
    quoted_price, total_price, currency, base_rental_price, final_rental_price,
    pickup_location_fee, return_location_fee, insurance_added, insurance_cost,
    young_driver, young_driver_fee, young_driver_cost,
    coupon_id, coupon_code, coupon_discount_amount, coupon_partner_id, coupon_partner_commission_bps,
    pricing_snapshot,
    referral_code, referral_source, referral_captured_at
  ) values (
    p_submission_key,
    btrim(p_booking ->> 'full_name'), btrim(p_booking ->> 'email'), btrim(p_booking ->> 'phone'), nullif(btrim(p_booking ->> 'country'), ''),
    btrim(p_booking ->> 'car_model'), v_offer_id,
    (p_booking ->> 'pickup_date')::date, coalesce(nullif(p_booking ->> 'pickup_time', '')::time, '10:00'::time),
    btrim(p_booking ->> 'pickup_location'), nullif(btrim(p_booking ->> 'pickup_address'), ''), nullif(btrim(p_booking ->> 'pickup_city_code'), ''),
    (p_booking ->> 'return_date')::date, coalesce(nullif(p_booking ->> 'return_time', '')::time, '10:00'::time),
    btrim(p_booking ->> 'return_location'), nullif(btrim(p_booking ->> 'return_address'), ''), nullif(btrim(p_booking ->> 'return_city_code'), ''),
    coalesce(nullif(p_booking ->> 'num_passengers', '')::integer, 1),
    coalesce(nullif(p_booking ->> 'child_seats', '')::integer, 0),
    coalesce(nullif(p_booking ->> 'full_insurance', '')::boolean, false),
    nullif(btrim(p_booking ->> 'flight_number'), ''), nullif(btrim(p_booking ->> 'special_requests'), ''),
    coalesce(nullif(btrim(p_booking ->> 'lang'), ''), 'en'),
    lower(btrim(p_booking ->> 'location')), 'pending',
    coalesce(nullif(btrim(p_booking ->> 'source'), ''), 'website'), 'unpaid',
    nullif(p_booking ->> 'quoted_price', '')::numeric,
    nullif(p_booking ->> 'total_price', '')::numeric,
    upper(coalesce(nullif(btrim(p_booking ->> 'currency'), ''), 'EUR')),
    nullif(p_booking ->> 'base_rental_price', '')::numeric,
    nullif(p_booking ->> 'final_rental_price', '')::numeric,
    nullif(p_booking ->> 'pickup_location_fee', '')::numeric,
    nullif(p_booking ->> 'return_location_fee', '')::numeric,
    coalesce(nullif(p_booking ->> 'insurance_added', '')::boolean, false),
    coalesce(nullif(p_booking ->> 'insurance_cost', '')::numeric, 0),
    coalesce(nullif(p_booking ->> 'young_driver', '')::boolean, false),
    coalesce(nullif(p_booking ->> 'young_driver_fee', '')::boolean, false),
    coalesce(nullif(p_booking ->> 'young_driver_cost', '')::numeric, 0),
    nullif(p_booking ->> 'coupon_id', '')::uuid,
    nullif(upper(btrim(p_booking ->> 'coupon_code')), ''),
    coalesce(nullif(p_booking ->> 'coupon_discount_amount', '')::numeric, 0),
    nullif(p_booking ->> 'coupon_partner_id', '')::uuid,
    nullif(p_booking ->> 'coupon_partner_commission_bps', '')::integer,
    p_booking -> 'pricing_snapshot',
    nullif(btrim(p_booking ->> 'referral_code'), ''),
    nullif(btrim(p_booking ->> 'referral_source'), ''),
    nullif(p_booking ->> 'referral_captured_at', '')::timestamptz
  )
  on conflict (public_submission_key) where public_submission_key is not null
  do nothing
  returning * into v_booking;

  if found then
    booking_id := v_booking.id;
    booking_reference := v_booking.booking_reference;
    booking_status := v_booking.status;
    idempotent := false;
    return next;
    return;
  end if;

  select booking.*
  into v_booking
  from public.car_bookings booking
  where booking.public_submission_key = p_submission_key;

  if not found or v_booking.booking_reference is null then
    raise exception using errcode = '23514', message = 'car_booking_idempotent_result_missing';
  end if;

  booking_id := v_booking.id;
  booking_reference := v_booking.booking_reference;
  booking_status := v_booking.status;
  idempotent := true;
  return next;
end
$$;

revoke all on function public.car_bookings_assign_public_reference() from public, anon, authenticated;
revoke all on function public.submit_car_booking_request(uuid,jsonb) from public;
grant execute on function public.car_bookings_assign_public_reference() to service_role;
grant execute on function public.submit_car_booking_request(uuid,jsonb) to anon, authenticated, service_role;

comment on column public.car_bookings.booking_reference is
  'Stable server-generated customer-facing Cars booking number. Contains no PII and is separate from the internal UUID.';
comment on column public.car_bookings.public_submission_key is
  'Opaque idempotency key for the public booking submission RPC. It is not a booking reference and is immutable.';
comment on function public.submit_car_booking_request(uuid,jsonb) is
  'Creates one pending/unpaid Cars request and returns only its public reference contract. Existing pricing, fulfillment, partner-confirmation and notification triggers remain authoritative.';

do $$
declare
  v_before record;
  v_after_count bigint;
  v_after_fingerprint text;
begin
  select * into v_before from _car_booking_public_reference_before;

  select
    count(*)::bigint,
    md5(coalesce(string_agg(
      md5((to_jsonb(booking) - 'booking_reference' - 'public_submission_key')::text),
      ',' order by booking.id
    ), ''))
  into v_after_count, v_after_fingerprint
  from public.car_bookings booking;

  if v_after_count is distinct from v_before.booking_count
     or v_after_fingerprint is distinct from v_before.protected_fingerprint then
    raise exception using
      errcode = '23514',
      message = 'car_booking_public_reference_protected_data_changed';
  end if;
end
$$;

commit;
