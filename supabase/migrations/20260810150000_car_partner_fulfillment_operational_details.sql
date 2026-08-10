-- car-partner-fulfillment-operational-details-v1
-- Adds non-PII pickup/return dates and times to the existing Cars fulfillment
-- details object. Partner routing, booking/payment status and manual acceptance
-- remain unchanged. Existing contact/form-snapshot gates are not broadened.

begin;

do $prerequisites$
declare
  v_missing text[];
  v_trigger_source text;
begin
  select coalesce(array_agg(required.name order by required.name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.car_bookings',
    'public.partner_service_fulfillments',
    'public.partner_service_fulfillment_contacts',
    'public.partner_service_fulfillment_form_snapshots'
  ]::text[]) required(name)
  where to_regclass(required.name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'car_partner_fulfillment_operational_details_required_table_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.trg_partner_service_fulfillment_from_car_booking()') is null
     or to_regprocedure('public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)') is null
     or to_regprocedure('public.upsert_partner_service_fulfillment_from_booking_with_partner(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamptz)') is null
     or to_regprocedure('public.car_booking_rental_days(date,text,date,text)') is null
     or to_regprocedure('public.match_car_offer_id(text,text)') is null
     or to_regprocedure('public.try_uuid(text)') is null
     or to_regprocedure('public.try_numeric(text)') is null then
    raise exception using
      errcode = '42883',
      message = 'car_partner_fulfillment_operational_details_required_function_missing';
  end if;

  select coalesce(array_agg(required.contract order by required.contract), '{}'::text[])
  into v_missing
  from unnest(array[
    'car_bookings.id',
    'car_bookings.offer_id',
    'car_bookings.status',
    'car_bookings.payment_status',
    'car_bookings.pickup_date',
    'car_bookings.pickup_time',
    'car_bookings.return_date',
    'car_bookings.return_time',
    'partner_service_fulfillments.id',
    'partner_service_fulfillments.partner_id',
    'partner_service_fulfillments.resource_type',
    'partner_service_fulfillments.booking_id',
    'partner_service_fulfillments.resource_id',
    'partner_service_fulfillments.status',
    'partner_service_fulfillments.details',
    'partner_service_fulfillments.updated_at',
    'partner_service_fulfillments.contact_revealed_at'
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
      message = 'car_partner_fulfillment_operational_details_required_column_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.car_bookings'::regclass
      and trigger_row.tgname = 'trg_partner_service_fulfillment_from_car_booking_ins'
      and not trigger_row.tgisinternal
  ) then
    raise exception using
      errcode = '42704',
      message = 'car_partner_fulfillment_operational_details_insert_trigger_missing';
  end if;

  select lower(pg_get_functiondef('public.trg_partner_service_fulfillment_from_car_booking()'::regprocedure))
  into v_trigger_source;

  if position('partner_service_fulfillment_partner_id_for_car_booking' in v_trigger_source) = 0
     or position('upsert_partner_service_fulfillment_from_booking_with_partner' in v_trigger_source) = 0
     or position('partner_service_fulfillment_form_snapshots' in v_trigger_source) = 0 then
    raise exception using
      errcode = '55000',
      message = 'car_partner_fulfillment_operational_details_unexpected_trigger_contract';
  end if;
end
$prerequisites$;

-- Freeze the exact booking/fulfillment pairs being inspected and updated. This
-- prevents a concurrent partner action from racing the narrow pending-only
-- backfill and makes every protected-field assertion deterministic.
lock table public.car_bookings in share mode;
lock table public.partner_service_fulfillments in share row exclusive mode;
lock table public.partner_service_fulfillment_contacts in share mode;
lock table public.partner_service_fulfillment_form_snapshots in share mode;

create temporary table _car_pending_fulfillment_operational_targets on commit drop as
select
  fulfillment.id as fulfillment_id,
  booking.id as booking_id,
  booking.pickup_date,
  booking.pickup_time,
  booking.return_date,
  booking.return_time,
  md5((to_jsonb(fulfillment) - 'details' - 'updated_at')::text) as protected_fingerprint
from public.partner_service_fulfillments fulfillment
join public.car_bookings booking
  on booking.id = fulfillment.booking_id
where fulfillment.resource_type = 'cars'
  and fulfillment.status = 'pending_acceptance'
  and booking.status in ('pending', 'message_sent');

create temporary table _car_pending_fulfillment_related_rows_before on commit drop as
select
  (
    select count(*)
    from public.partner_service_fulfillment_contacts contact_row
    join _car_pending_fulfillment_operational_targets target
      on target.fulfillment_id = contact_row.fulfillment_id
  ) as contact_count,
  (
    select md5(coalesce(string_agg(md5(to_jsonb(contact_row)::text), ',' order by contact_row.id), ''))
    from public.partner_service_fulfillment_contacts contact_row
    join _car_pending_fulfillment_operational_targets target
      on target.fulfillment_id = contact_row.fulfillment_id
  ) as contact_fingerprint,
  (
    select count(*)
    from public.partner_service_fulfillment_form_snapshots snapshot_row
    join _car_pending_fulfillment_operational_targets target
      on target.fulfillment_id = snapshot_row.fulfillment_id
  ) as snapshot_count,
  (
    select md5(coalesce(string_agg(md5(to_jsonb(snapshot_row)::text), ',' order by snapshot_row.id), ''))
    from public.partner_service_fulfillment_form_snapshots snapshot_row
    join _car_pending_fulfillment_operational_targets target
      on target.fulfillment_id = snapshot_row.fulfillment_id
  ) as snapshot_fingerprint;

create or replace function public.trg_partner_service_fulfillment_from_car_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
  offer_uuid uuid;
  matched_offer_id uuid;
  pid uuid;
  loc text;
  total_price numeric;
  customer_name text;
  customer_email text;
  customer_phone text;
  summary text;
  currency text;
  car_model_txt text;
  fid uuid;
  details_json jsonb;
  form_json jsonb;
begin
  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  j := to_jsonb(NEW);
  offer_uuid := public.try_uuid(j->>'offer_id');
  loc := coalesce(nullif(j->>'location', ''), nullif(j->>'pickup_location', ''));

  if lower(coalesce(loc, '')) in ('airport_pfo','pfo','paphos_airport') then
    loc := 'paphos';
  elsif lower(coalesce(loc, '')) in ('airport_lca','lca','larnaca_airport') then
    loc := 'larnaca';
  end if;

  matched_offer_id := null;
  car_model_txt := nullif(j->>'car_model', '');
  if offer_uuid is null and car_model_txt is not null and lower(loc) in ('paphos','larnaca') then
    matched_offer_id := public.match_car_offer_id(loc, car_model_txt);
    offer_uuid := coalesce(offer_uuid, matched_offer_id);
  end if;

  pid := public.partner_service_fulfillment_partner_id_for_car_booking(offer_uuid, loc);

  if pid is null then
    return NEW;
  end if;

  if NEW.status in ('cancelled', 'no_show') then
    return NEW;
  end if;

  total_price := coalesce(
    public.try_numeric(j->>'final_price'),
    public.try_numeric(j->>'quoted_price'),
    public.try_numeric(j->>'total_price')
  );
  currency := coalesce(nullif(j->>'currency', ''), 'EUR');
  customer_name := coalesce(nullif(j->>'customer_name', ''), nullif(j->>'full_name', ''));
  customer_email := coalesce(nullif(j->>'customer_email', ''), nullif(j->>'email', ''));
  customer_phone := coalesce(nullif(j->>'customer_phone', ''), nullif(j->>'phone', ''));
  summary := coalesce(nullif(j->>'car_model', ''), nullif(j->>'car_type', ''), 'Car booking');

  select public.upsert_partner_service_fulfillment_from_booking_with_partner(
    pid,
    'cars',
    NEW.id,
    offer_uuid,
    NEW.pickup_date,
    NEW.return_date,
    total_price,
    currency,
    customer_name,
    customer_email,
    customer_phone,
    concat('CAR-', substring(NEW.id::text, 1, 8)),
    summary,
    NEW.created_at
  ) into fid;

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'duration_days', public.car_booking_rental_days(
      NEW.pickup_date,
      NEW.pickup_time::text,
      NEW.return_date,
      NEW.return_time::text
    ),
    'pickup_date', NEW.pickup_date,
    'pickup_time', NEW.pickup_time,
    'return_date', NEW.return_date,
    'return_time', NEW.return_time,
    'pickup_location', nullif(j->>'pickup_location', ''),
    'return_location', nullif(j->>'return_location', ''),
    'pickup_location_fee', public.try_numeric(j->>'pickup_location_fee'),
    'return_location_fee', public.try_numeric(j->>'return_location_fee'),
    'insurance_cost', public.try_numeric(j->>'insurance_cost'),
    'young_driver_cost', public.try_numeric(j->>'young_driver_cost'),
    'insurance_added', case
      when lower(coalesce(nullif(j->>'insurance_added',''), 'false')) in ('true','t','1','yes') then true
      when lower(coalesce(nullif(j->>'insurance_added',''), 'false')) in ('false','f','0','no') then false
      else null
    end,
    'young_driver_fee', case
      when lower(coalesce(nullif(j->>'young_driver_fee',''), 'false')) in ('true','t','1','yes') then true
      when lower(coalesce(nullif(j->>'young_driver_fee',''), 'false')) in ('false','f','0','no') then false
      else null
    end,
    'coupon_id', public.try_uuid(j->>'coupon_id'),
    'coupon_code', nullif(j->>'coupon_code', ''),
    'base_rental_price', public.try_numeric(j->>'base_rental_price'),
    'coupon_discount_amount', public.try_numeric(j->>'coupon_discount_amount'),
    'final_rental_price', public.try_numeric(j->>'final_rental_price'),
    'coupon_partner_id', public.try_uuid(j->>'coupon_partner_id'),
    'coupon_partner_commission_bps', public.try_numeric(j->>'coupon_partner_commission_bps')
  ));

  form_json := jsonb_strip_nulls(jsonb_build_object(
    'full_name', nullif(j->>'full_name', ''),
    'email', nullif(j->>'email', ''),
    'phone', nullif(j->>'phone', ''),
    'country', nullif(j->>'country', ''),
    'car_model', nullif(j->>'car_model', ''),
    'location', nullif(j->>'location', ''),
    'offer_id', offer_uuid,
    'pickup_date', NEW.pickup_date,
    'pickup_time', NEW.pickup_time,
    'pickup_location', nullif(j->>'pickup_location', ''),
    'pickup_address', nullif(j->>'pickup_address', ''),
    'return_date', NEW.return_date,
    'return_time', NEW.return_time,
    'return_location', nullif(j->>'return_location', ''),
    'return_address', nullif(j->>'return_address', ''),
    'num_passengers', NEW.num_passengers,
    'child_seats', NEW.child_seats,
    'full_insurance', NEW.full_insurance,
    'flight_number', nullif(j->>'flight_number', ''),
    'special_requests', nullif(j->>'special_requests', ''),
    'airport_pickup', j->'airport_pickup',
    'airport_return', j->'airport_return',
    'airport_pickup_fee', public.try_numeric(j->>'airport_pickup_fee'),
    'airport_return_fee', public.try_numeric(j->>'airport_return_fee'),
    'pickup_location_fee', public.try_numeric(j->>'pickup_location_fee'),
    'return_location_fee', public.try_numeric(j->>'return_location_fee'),
    'insurance_cost', public.try_numeric(j->>'insurance_cost'),
    'young_driver_cost', public.try_numeric(j->>'young_driver_cost'),
    'insurance_added', case
      when lower(coalesce(nullif(j->>'insurance_added',''), 'false')) in ('true','t','1','yes') then true
      when lower(coalesce(nullif(j->>'insurance_added',''), 'false')) in ('false','f','0','no') then false
      else null
    end,
    'young_driver_fee', case
      when lower(coalesce(nullif(j->>'young_driver_fee',''), 'false')) in ('true','t','1','yes') then true
      when lower(coalesce(nullif(j->>'young_driver_fee',''), 'false')) in ('false','f','0','no') then false
      else null
    end,
    'coupon_id', public.try_uuid(j->>'coupon_id'),
    'coupon_code', nullif(j->>'coupon_code', ''),
    'base_rental_price', public.try_numeric(j->>'base_rental_price'),
    'coupon_discount_amount', public.try_numeric(j->>'coupon_discount_amount'),
    'final_rental_price', public.try_numeric(j->>'final_rental_price'),
    'coupon_partner_id', public.try_uuid(j->>'coupon_partner_id'),
    'coupon_partner_commission_bps', public.try_numeric(j->>'coupon_partner_commission_bps')
  ));

  if fid is not null then
    update public.partner_service_fulfillments
    set details = details_json
    where id = fid;

    insert into public.partner_service_fulfillment_form_snapshots(
      fulfillment_id,
      payload,
      created_at
    )
    values (
      fid,
      coalesce(form_json, '{}'::jsonb),
      coalesce(NEW.created_at, now())
    )
    on conflict (fulfillment_id)
    do update set
      payload = excluded.payload;
  end if;

  return NEW;
end;
$$;

revoke all on function public.trg_partner_service_fulfillment_from_car_booking()
from public, anon, authenticated;
grant execute on function public.trg_partner_service_fulfillment_from_car_booking()
to service_role;

comment on function public.trg_partner_service_fulfillment_from_car_booking()
is 'Creates/updates one pending Cars fulfillment for the exact routed partner and stores non-PII pickup/return timing in fulfillment.details. Partner acceptance remains manual; contact snapshots remain gated.';

-- Existing operationally pending requests receive only the four missing
-- non-PII fields. The exact row IDs were frozen above, and already-correct rows
-- are untouched on rerun.
update public.partner_service_fulfillments fulfillment
set details = coalesce(fulfillment.details, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
    'pickup_date', target.pickup_date,
    'pickup_time', target.pickup_time,
    'return_date', target.return_date,
    'return_time', target.return_time
  ))
from _car_pending_fulfillment_operational_targets target
where fulfillment.id = target.fulfillment_id
  and (
    fulfillment.details->>'pickup_date' is distinct from target.pickup_date::text
    or fulfillment.details->>'pickup_time' is distinct from target.pickup_time::text
    or fulfillment.details->>'return_date' is distinct from target.return_date::text
    or fulfillment.details->>'return_time' is distinct from target.return_time::text
  );

do $postconditions$
declare
  v_before record;
  v_after record;
  v_function_source text;
begin
  if exists (
    select 1
    from _car_pending_fulfillment_operational_targets target
    join public.partner_service_fulfillments fulfillment
      on fulfillment.id = target.fulfillment_id
    where fulfillment.details->>'pickup_date' is distinct from target.pickup_date::text
       or fulfillment.details->>'pickup_time' is distinct from target.pickup_time::text
       or fulfillment.details->>'return_date' is distinct from target.return_date::text
       or fulfillment.details->>'return_time' is distinct from target.return_time::text
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_partner_fulfillment_operational_details_backfill_incomplete';
  end if;

  if exists (
    select 1
    from _car_pending_fulfillment_operational_targets target
    join public.partner_service_fulfillments fulfillment
      on fulfillment.id = target.fulfillment_id
    where md5((to_jsonb(fulfillment) - 'details' - 'updated_at')::text)
          is distinct from target.protected_fingerprint
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_partner_fulfillment_operational_details_changed_protected_fulfillment_fields';
  end if;

  select * into v_before
  from _car_pending_fulfillment_related_rows_before;

  select
    (
      select count(*)
      from public.partner_service_fulfillment_contacts contact_row
      join _car_pending_fulfillment_operational_targets target
        on target.fulfillment_id = contact_row.fulfillment_id
    ) as contact_count,
    (
      select md5(coalesce(string_agg(md5(to_jsonb(contact_row)::text), ',' order by contact_row.id), ''))
      from public.partner_service_fulfillment_contacts contact_row
      join _car_pending_fulfillment_operational_targets target
        on target.fulfillment_id = contact_row.fulfillment_id
    ) as contact_fingerprint,
    (
      select count(*)
      from public.partner_service_fulfillment_form_snapshots snapshot_row
      join _car_pending_fulfillment_operational_targets target
        on target.fulfillment_id = snapshot_row.fulfillment_id
    ) as snapshot_count,
    (
      select md5(coalesce(string_agg(md5(to_jsonb(snapshot_row)::text), ',' order by snapshot_row.id), ''))
      from public.partner_service_fulfillment_form_snapshots snapshot_row
      join _car_pending_fulfillment_operational_targets target
        on target.fulfillment_id = snapshot_row.fulfillment_id
    ) as snapshot_fingerprint
  into v_after;

  if v_after.contact_count is distinct from v_before.contact_count
     or v_after.contact_fingerprint is distinct from v_before.contact_fingerprint
     or v_after.snapshot_count is distinct from v_before.snapshot_count
     or v_after.snapshot_fingerprint is distinct from v_before.snapshot_fingerprint then
    raise exception using
      errcode = '23514',
      message = 'car_partner_fulfillment_operational_details_changed_gated_rows';
  end if;

  select lower(pg_get_functiondef('public.trg_partner_service_fulfillment_from_car_booking()'::regprocedure))
  into v_function_source;

  if position('''pickup_date'', new.pickup_date' in v_function_source) = 0
     or position('''pickup_time'', new.pickup_time' in v_function_source) = 0
     or position('''return_date'', new.return_date' in v_function_source) = 0
     or position('''return_time'', new.return_time' in v_function_source) = 0 then
    raise exception using
      errcode = '23514',
      message = 'car_partner_fulfillment_operational_details_trigger_contract_missing';
  end if;
end
$postconditions$;

commit;
