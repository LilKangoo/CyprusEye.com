begin;
set transaction isolation level repeatable read;

-- Hotels 2.0 H1A: additive, zero-downtime bridge used before the
-- hotel_bookings RLS lockdown.  It deliberately does not alter any booking,
-- fulfillment, property, payment, coupon, or publication row.

do $$
declare
  v_missing text[];
begin
  select coalesce(array_agg(required.name order by required.name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.hotels',
    'public.hotel_bookings',
    'public.partner_service_fulfillments',
    'public.partner_resources',
    'public.partner_users'
  ]::text[]) as required(name)
  where to_regclass(required.name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'hotels_h1a_partner_bridge_required_object_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null
     or to_regprocedure('public.is_partner_user(uuid)') is null
     or to_regprocedure('public.partner_get_referral_attributed_orders(uuid,integer)') is null
     or to_regprocedure('public.upsert_partner_service_fulfillment_from_booking_with_partner(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)') is null then
    raise exception using
      errcode = '42883',
      message = 'hotels_h1a_partner_bridge_required_helper_missing';
  end if;

  if exists (
    select 1
    from public.partner_service_fulfillments fulfillment
    left join public.hotel_bookings booking
      on booking.id = fulfillment.booking_id
    where fulfillment.resource_type = 'hotels'
      and (
        booking.id is null
        or fulfillment.resource_id is distinct from booking.hotel_id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_partner_bridge_historical_relationship_mismatch';
  end if;

  if exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'hotel_bookings'
      and column_info.column_name in (
        'id', 'hotel_id', 'arrival_date', 'departure_date', 'nights',
        'num_adults', 'num_children', 'total_price', 'base_price',
        'final_price', 'extras_price', 'selected_extras', 'booking_details',
        'room_type_id', 'room_type_name', 'rate_plan_id', 'rate_plan_name',
        'cancellation_policy_type', 'status', 'customer_email', 'user_id',
        'created_by'
      )
    group by column_info.table_schema, column_info.table_name
    having count(*) <> 22
  ) or (
    select count(*)
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'hotel_bookings'
      and column_info.column_name in (
        'id', 'hotel_id', 'arrival_date', 'departure_date', 'nights',
        'num_adults', 'num_children', 'total_price', 'base_price',
        'final_price', 'extras_price', 'selected_extras', 'booking_details',
        'room_type_id', 'room_type_name', 'rate_plan_id', 'rate_plan_name',
        'cancellation_policy_type', 'status', 'customer_email', 'user_id',
        'created_by'
      )
  ) <> 22 then
    raise exception using
      errcode = '42703',
      message = 'hotels_h1a_partner_bridge_booking_contract_missing';
  end if;
end
$$;

-- Customer Dashboard compatibility bridge. New authenticated bookings are
-- owned by user_id after the lockdown; historical guest rows remain available
-- only when both owner columns are NULL and the verified JWT email matches.
-- Guest-link access continues through the existing booking-access Edge
-- Function and does not depend on this RPC.
create or replace function public.customer_get_hotel_bookings(
  p_limit integer default 100
)
returns setof public.hotel_bookings
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(coalesce(auth.jwt()->>'email', ''))), '');
begin
  if v_uid is null then
    raise exception using
      errcode = '42501',
      message = 'hotel_customer_booking_access_auth_required';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using
      errcode = '22023',
      message = 'hotel_customer_booking_access_invalid_limit';
  end if;

  return query
  select booking.*
  from public.hotel_bookings booking
  where booking.user_id = v_uid
     or booking.created_by = v_uid
     or (
       booking.user_id is null
       and booking.created_by is null
       and v_email is not null
       and lower(btrim(booking.customer_email)) = v_email
     )
  order by booking.created_at desc, booking.id
  limit p_limit;
end;
$$;

comment on function public.customer_get_hotel_bookings(integer) is
  'Authenticated customer Hotel bookings, including verified-email legacy guest rows with no recorded owner.';

revoke all on function public.customer_get_hotel_bookings(integer) from public;
revoke all on function public.customer_get_hotel_bookings(integer) from anon;
revoke all on function public.customer_get_hotel_bookings(integer) from service_role;
grant execute on function public.customer_get_hotel_bookings(integer) to authenticated;

-- The legacy referral RPC includes customer_name in its transport contract,
-- even though the Partner Portal never renders it. Expose a compatibility
-- wrapper that preserves every operational field but redacts the name before
-- it crosses the API boundary. The legacy function itself is locked down in
-- the final security migration after the client has switched to this bridge.
create or replace function public.partner_get_referral_attributed_orders_safe(
  p_partner_id uuid,
  p_limit integer default 40
)
returns table (
  booking_id uuid,
  service_type text,
  service_id uuid,
  service_slug text,
  service_date text,
  customer_name text,
  booking_status text,
  payment_status text,
  total_amount numeric,
  currency text,
  referral_code text,
  referral_source text,
  referral_captured_at timestamptz,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    attributed.booking_id,
    attributed.service_type,
    attributed.service_id,
    attributed.service_slug,
    attributed.service_date,
    null::text as customer_name,
    attributed.booking_status,
    attributed.payment_status,
    attributed.total_amount,
    attributed.currency,
    attributed.referral_code,
    attributed.referral_source,
    attributed.referral_captured_at,
    attributed.created_at
  from public.partner_get_referral_attributed_orders(p_partner_id, p_limit) attributed;
$$;

comment on function public.partner_get_referral_attributed_orders_safe(uuid,integer) is
  'Exact-partner referral attribution rows with customer identity redacted.';

revoke all on function public.partner_get_referral_attributed_orders_safe(uuid,integer) from public;
revoke all on function public.partner_get_referral_attributed_orders_safe(uuid,integer) from anon;
revoke all on function public.partner_get_referral_attributed_orders_safe(uuid,integer) from service_role;
grant execute on function public.partner_get_referral_attributed_orders_safe(uuid,integer) to authenticated;

create temporary table hotels_h1a_partner_bridge_before on commit drop as
select
  (select md5(coalesce(string_agg(to_jsonb(booking_row)::text, '|' order by booking_row.id), ''))
   from public.hotel_bookings booking_row) as booking_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(fulfillment_row)::text, '|' order by fulfillment_row.id), ''))
   from public.partner_service_fulfillments fulfillment_row
   where fulfillment_row.resource_type = 'hotels') as fulfillment_fingerprint;

create or replace function public.partner_get_hotel_booking_operational_context(
  p_partner_id uuid,
  p_booking_ids uuid[] default null,
  p_hotel_ids uuid[] default null,
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 500
)
returns table (
  fulfillment_id uuid,
  booking_id uuid,
  hotel_id uuid,
  arrival_date date,
  departure_date date,
  nights integer,
  num_adults integer,
  num_children integer,
  total_price numeric,
  base_price numeric,
  final_price numeric,
  extras_price numeric,
  selected_extras jsonb,
  room_type_id text,
  room_type_name jsonb,
  rate_plan_id text,
  rate_plan_name jsonb,
  cancellation_policy_type text,
  room_inventory_units integer,
  status text,
  currency text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
begin
  if p_partner_id is null
     or not (
       public.is_current_user_admin()
       or public.is_partner_user(p_partner_id)
     ) then
    raise exception using
      errcode = '42501',
      message = 'hotel_partner_context_forbidden';
  end if;

  if coalesce(cardinality(p_booking_ids), 0) > 500
     or coalesce(cardinality(p_hotel_ids), 0) > 100
     or p_limit is null
     or p_limit < 1
     or p_limit > 1000
     or (p_start_date is not null and p_end_date is not null and p_end_date < p_start_date)
     or (p_start_date is not null and p_end_date is not null and p_end_date - p_start_date > 1096)
     or (coalesce(cardinality(p_booking_ids), 0) = 0 and coalesce(cardinality(p_hotel_ids), 0) = 0) then
    raise exception using
      errcode = '22023',
      message = 'hotel_partner_context_invalid_scope';
  end if;

  return query
  select distinct on (booking.id)
    fulfillment.id,
    booking.id,
    booking.hotel_id,
    booking.arrival_date,
    booking.departure_date,
    booking.nights,
    booking.num_adults,
    booking.num_children,
    booking.total_price,
    booking.base_price,
    booking.final_price,
    booking.extras_price,
    coalesce(booking.selected_extras, '[]'::jsonb),
    booking.room_type_id,
    coalesce(booking.room_type_name, '{}'::jsonb),
    booking.rate_plan_id,
    coalesce(booking.rate_plan_name, '{}'::jsonb),
    booking.cancellation_policy_type,
    case
      when coalesce(booking.booking_details->>'room_inventory_units', '') ~ '^[0-9]+$'
        then (booking.booking_details->>'room_inventory_units')::integer
      else null
    end,
    booking.status,
    coalesce(nullif(fulfillment.currency, ''), 'EUR')
  from public.hotel_bookings booking
  join public.partner_service_fulfillments fulfillment
    on fulfillment.booking_id = booking.id
   and fulfillment.resource_type = 'hotels'
   and fulfillment.partner_id = p_partner_id
   and fulfillment.resource_id = booking.hotel_id
  where (
      coalesce(cardinality(p_booking_ids), 0) = 0
      or booking.id = any(p_booking_ids)
    )
    and (
      coalesce(cardinality(p_hotel_ids), 0) = 0
      or booking.hotel_id = any(p_hotel_ids)
    )
    and (p_start_date is null or booking.departure_date >= p_start_date)
    and (p_end_date is null or booking.arrival_date <= p_end_date)
  order by booking.id, fulfillment.created_at desc, fulfillment.id
  limit p_limit;
end;
$$;

comment on function public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer) is
  'Exact-partner, non-PII Hotel booking context for Partner Portal calendar and fulfillment operations.';

revoke all on function public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer) from public;
revoke all on function public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer) from anon;
revoke all on function public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer) from service_role;
grant execute on function public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer) to authenticated;

-- Admin-only compatibility wrapper.  The underlying helper becomes internal
-- in the later lockdown migration without breaking the current Transport
-- assignment fallback used by the Admin dashboard.
create or replace function public.admin_upsert_partner_service_fulfillment_exact(
  p_partner_id uuid,
  p_resource_type text,
  p_booking_id uuid,
  p_resource_id uuid,
  p_start_date date,
  p_end_date date,
  p_total_price numeric,
  p_currency text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_reference text,
  p_summary text,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception using
      errcode = '42501',
      message = 'admin_fulfillment_upsert_required';
  end if;

  return public.upsert_partner_service_fulfillment_from_booking_with_partner(
    p_partner_id,
    p_resource_type,
    p_booking_id,
    p_resource_id,
    p_start_date,
    p_end_date,
    p_total_price,
    p_currency,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_reference,
    p_summary,
    p_created_at
  );
end;
$$;

comment on function public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamptz) is
  'Admin-only wrapper for the internal exact-partner fulfillment upsert helper.';

revoke all on function public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamptz) from public;
revoke all on function public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamptz) from anon;
revoke all on function public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamptz) from service_role;
grant execute on function public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamptz) to authenticated;

do $$
declare
  v_before record;
  v_booking_after text;
  v_fulfillment_after text;
begin
  select * into v_before from hotels_h1a_partner_bridge_before;
  select md5(coalesce(string_agg(to_jsonb(booking_row)::text, '|' order by booking_row.id), ''))
  into v_booking_after
  from public.hotel_bookings booking_row;
  select md5(coalesce(string_agg(to_jsonb(fulfillment_row)::text, '|' order by fulfillment_row.id), ''))
  into v_fulfillment_after
  from public.partner_service_fulfillments fulfillment_row
  where fulfillment_row.resource_type = 'hotels';

  if v_booking_after is distinct from v_before.booking_fingerprint
     or v_fulfillment_after is distinct from v_before.fulfillment_fingerprint then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_partner_bridge_protected_data_changed';
  end if;

  if to_regprocedure('public.customer_get_hotel_bookings(integer)') is null
     or to_regprocedure('public.partner_get_referral_attributed_orders_safe(uuid,integer)') is null
     or to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is null
     or has_function_privilege('anon', 'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.customer_get_hotel_bookings(integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.partner_get_referral_attributed_orders_safe(uuid,integer)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.customer_get_hotel_bookings(integer)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.partner_get_referral_attributed_orders_safe(uuid,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.customer_get_hotel_bookings(integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.partner_get_referral_attributed_orders_safe(uuid,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)', 'EXECUTE') then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_partner_bridge_postcondition_failed';
  end if;
end
$$;

commit;
