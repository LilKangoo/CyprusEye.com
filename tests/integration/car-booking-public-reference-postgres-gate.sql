\set ON_ERROR_STOP on

do $$
begin
  if (select booking_reference from public.car_bookings where id = '12345678-1234-4234-8234-123456789012') <> 'CAR-12345678' then
    raise exception 'historical_reference_backfill_failed';
  end if;
  if (select updated_at from public.car_bookings where id = '12345678-1234-4234-8234-123456789012')
     is distinct from '2026-08-10 08:00:00+00'::timestamptz then
    raise exception 'historical_updated_at_changed';
  end if;
  if (select count(*) from public.partner_service_fulfillments) <> 1 then
    raise exception 'backfill_created_duplicate_fulfillment';
  end if;
  if exists (
    select 1
    from public.partner_service_fulfillments fulfillment
    join public.car_bookings booking on booking.id = fulfillment.booking_id
    where fulfillment.reference is distinct from booking.booking_reference
  ) then
    raise exception 'historical_fulfillment_reference_mismatch';
  end if;
end
$$;

set role anon;

do $$
begin
  begin
    perform id from public.car_bookings limit 1;
    raise exception 'anon_booking_select_unexpectedly_allowed';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

create temporary table first_submit as
select *
from public.submit_car_booking_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  jsonb_build_object(
    'full_name', 'Test Customer',
    'email', 'test@example.test',
    'phone', '+35799123456',
    'car_model', 'Threshold vehicle',
    'offer_id', '11111111-1111-4111-8111-111111111111',
    'pickup_date', '2026-08-11',
    'pickup_time', '10:00',
    'pickup_location', 'ayia-napa',
    'return_date', '2026-08-12',
    'return_time', '10:00',
    'return_location', 'ayia-napa',
    'location', 'larnaca',
    'status', 'pending',
    'source', 'website_autolca',
    'total_price', 110,
    'quoted_price', 110,
    'base_rental_price', 110,
    'final_rental_price', 110,
    'currency', 'EUR'
  )
);

reset role;
update public.car_offers
set is_published = false
where id = '11111111-1111-4111-8111-111111111111';
set role anon;

create temporary table retry_submit as
select *
from public.submit_car_booking_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  jsonb_build_object(
    'full_name', 'Test Customer',
    'email', 'test@example.test',
    'phone', '+35799123456',
    'car_model', 'Threshold vehicle',
    'offer_id', '11111111-1111-4111-8111-111111111111',
    'pickup_date', '2026-08-11',
    'pickup_time', '10:00',
    'pickup_location', 'ayia-napa',
    'return_date', '2026-08-12',
    'return_time', '10:00',
    'return_location', 'ayia-napa',
    'location', 'larnaca',
    'status', 'pending',
    'source', 'website_autolca',
    'total_price', 110,
    'quoted_price', 110,
    'base_rental_price', 110,
    'final_rental_price', 110,
    'currency', 'EUR'
  )
);

reset role;
update public.car_offers
set is_published = true
where id = '11111111-1111-4111-8111-111111111111';

do $$
begin
  if (select count(*) from first_submit) <> 1
     or (select idempotent from first_submit) is true
     or (select booking_status from first_submit) <> 'pending'
     or (select booking_reference from first_submit) !~ '^CAR-[0-9a-f]{8}$' then
    raise exception 'first_submit_contract_failed';
  end if;
  if (select count(*) from retry_submit) <> 1
     or (select idempotent from retry_submit) is not true
     or (select booking_id from retry_submit) is distinct from (select booking_id from first_submit)
     or (select booking_reference from retry_submit) is distinct from (select booking_reference from first_submit) then
    raise exception 'idempotent_retry_contract_failed';
  end if;
  if (select count(*) from public.car_bookings where public_submission_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'idempotent_retry_created_duplicate';
  end if;
  if (select count(*) from public.partner_service_fulfillments where booking_id = (select booking_id from first_submit)) <> 1 then
    raise exception 'fulfillment_not_exactly_once';
  end if;
  if exists (
    select 1
    from public.partner_service_fulfillments fulfillment
    join public.car_bookings booking on booking.id = fulfillment.booking_id
    where booking.id = (select booking_id from first_submit)
      and (
        fulfillment.reference is distinct from booking.booking_reference
        or fulfillment.status <> 'pending_acceptance'
        or booking.status <> 'pending'
        or booking.payment_status <> 'unpaid'
      )
  ) then
    raise exception 'pending_partner_workflow_or_reference_mismatch';
  end if;
end
$$;

do $$
begin
  begin
    perform * from public.submit_car_booking_request(
      gen_random_uuid(),
      '{"full_name":"Bad","email":"not-email","phone":"12","car_model":"X","offer_id":"11111111-1111-4111-8111-111111111111","pickup_date":"2026-08-11","pickup_location":"ayia-napa","return_date":"2026-08-12","return_location":"ayia-napa","location":"larnaca"}'::jsonb
    );
    raise exception 'invalid_contact_unexpectedly_accepted';
  exception when check_violation then
    if sqlerrm <> 'car_booking_contact_invalid' then raise; end if;
  end;

  begin
    perform * from public.submit_car_booking_request(
      gen_random_uuid(),
      '{"full_name":"Bad","email":"bad@example.test","phone":"+35799123456","car_model":"X","offer_id":"22222222-2222-4222-8222-222222222222","pickup_date":"2026-08-11","pickup_location":"ayia-napa","return_date":"2026-08-12","return_location":"ayia-napa","location":"larnaca"}'::jsonb
    );
    raise exception 'unpublished_offer_unexpectedly_accepted';
  exception when check_violation then
    if sqlerrm <> 'car_booking_exact_public_offer_required' then raise; end if;
  end;

  begin
    perform * from public.submit_car_booking_request(
      gen_random_uuid(),
      '{"full_name":"Bad","email":"bad@example.test","phone":"+35799123456","car_model":"X","offer_id":"11111111-1111-4111-8111-111111111111","pickup_date":"2026-08-11","pickup_location":"ayia-napa","return_date":"2026-08-12","return_location":"ayia-napa","location":"larnaca","payment_status":"paid"}'::jsonb
    );
    raise exception 'protected_field_unexpectedly_accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'car_booking_payload_contains_unsupported_fields' then raise; end if;
  end;

  begin
    perform * from public.submit_car_booking_request(
      gen_random_uuid(),
      '{"full_name":"Bad","email":"bad@example.test","phone":"+35799123456","car_model":"X","offer_id":"11111111-1111-4111-8111-111111111111","pickup_date":"2026-08-11","pickup_location":"ayia-napa","return_date":"2026-08-12","return_location":"ayia-napa","location":"larnaca","status":"confirmed"}'::jsonb
    );
    raise exception 'confirmed_booking_unexpectedly_accepted';
  exception when check_violation then
    if sqlerrm <> 'car_booking_public_status_must_be_pending' then raise; end if;
  end;
end
$$;

insert into public.car_bookings(
  id, full_name, email, phone, car_model, offer_id,
  pickup_date, pickup_location, return_date, return_location,
  location, status, payment_status
) values (
  'aaaaaaaa-0000-4000-8000-000000000001', 'Direct One', 'one@example.test', '+35799111111',
  'Direct', '11111111-1111-4111-8111-111111111111',
  '2026-08-11', 'ayia-napa', '2026-08-12', 'ayia-napa', 'larnaca', 'pending', 'unpaid'
);

do $$
begin
  if (select booking_reference from public.car_bookings where id = 'aaaaaaaa-0000-4000-8000-000000000001') <> 'CAR-aaaaaaaa' then
    raise exception 'direct_insert_reference_missing';
  end if;

  begin
    insert into public.car_bookings(
      id, full_name, email, phone, car_model, offer_id,
      pickup_date, pickup_location, return_date, return_location,
      location, status, payment_status
    ) values (
      'aaaaaaaa-0000-4000-8000-000000000002', 'Direct Two', 'two@example.test', '+35799222222',
      'Direct', '11111111-1111-4111-8111-111111111111',
      '2026-08-11', 'ayia-napa', '2026-08-12', 'ayia-napa', 'larnaca', 'pending', 'unpaid'
    );
    raise exception 'reference_collision_unexpectedly_accepted';
  exception when unique_violation then null;
  end;
end
$$;

select
  (select count(*) from public.car_bookings) as booking_count,
  (select count(*) from public.partner_service_fulfillments) as fulfillment_count,
  (select count(*) from public.car_bookings where status = 'pending') as pending_count,
  (select count(*) from public.car_bookings where payment_status = 'unpaid') as unpaid_count,
  0 as duplicate_reference_count,
  0 as duplicate_fulfillment_count,
  true as car_booking_public_reference_postgres_safe;
