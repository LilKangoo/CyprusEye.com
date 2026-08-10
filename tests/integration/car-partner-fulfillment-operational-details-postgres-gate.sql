-- PostgreSQL 16 integration gate for 20260810150000.
-- Run after the isolated base + migration. Every gate mutation is rolled back.

begin;

do $existing_backfill$
declare
  v_fulfillment public.partner_service_fulfillments%rowtype;
begin
  select * into strict v_fulfillment
  from public.partner_service_fulfillments fulfillment
  where fulfillment.id = '1569af6f-f98a-4f1b-95cc-055963c75c98'::uuid;

  if v_fulfillment.partner_id <> '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
     or v_fulfillment.resource_id <> '2817e6de-25ba-5237-b721-dbc0460a7de4'::uuid
     or v_fulfillment.status <> 'pending_acceptance'
     or v_fulfillment.total_price <> 270
     or v_fulfillment.contact_revealed_at is not null
     or v_fulfillment.details->>'pickup_date' <> '2026-08-11'
     or v_fulfillment.details->>'pickup_time' <> '10:00:00'
     or v_fulfillment.details->>'return_date' <> '2026-08-14'
     or v_fulfillment.details->>'return_time' <> '10:30:00'
     or v_fulfillment.details ?| array[
       'full_name', 'customer_name', 'email', 'customer_email',
       'phone', 'customer_phone', 'pickup_address', 'return_address'
     ] then
    raise exception 'existing pending fulfillment backfill or protected contract mismatch';
  end if;

  if (select status from public.car_bookings
      where id = 'cffce74a-0617-44a2-b6d8-481043c95d8f'::uuid) <> 'pending'
     or (select payment_status from public.car_bookings
         where id = 'cffce74a-0617-44a2-b6d8-481043c95d8f'::uuid) <> 'unpaid' then
    raise exception 'backfill changed booking/payment lifecycle';
  end if;

  if (select payload from public.partner_service_fulfillment_form_snapshots
      where fulfillment_id = v_fulfillment.id)
     <> '{"full_name":"Synthetic Customer","email":"synthetic@example.test"}'::jsonb then
    raise exception 'backfill changed gated form snapshot';
  end if;
end
$existing_backfill$;

-- The exact partner may read the operational row before acceptance, while
-- contact and form-snapshot PII remain hidden by their existing gates.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"5c3ab931-af5c-4bab-a7ab-9474afab339e"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 1
  from public.partner_service_fulfillments
  where id = '1569af6f-f98a-4f1b-95cc-055963c75c98'::uuid
    and status = 'pending_acceptance'
    and details->>'pickup_time' = '10:00:00'
    and details->>'return_time' = '10:30:00')::integer);
select 1 / ((select count(*) = 0
  from public.partner_service_fulfillment_contacts
  where fulfillment_id = '1569af6f-f98a-4f1b-95cc-055963c75c98'::uuid)::integer);
select 1 / ((select count(*) = 0
  from public.partner_service_fulfillment_form_snapshots
  where fulfillment_id = '1569af6f-f98a-4f1b-95cc-055963c75c98'::uuid)::integer);
reset role;

-- A fresh booking creates one request only. Exact-owner routing and manual
-- pending_acceptance lifecycle are preserved even after a payment-state update.
insert into public.car_bookings (
  id, offer_id, status, payment_status, pickup_date, pickup_time,
  return_date, return_time, location, pickup_location, return_location,
  car_model, total_price, quoted_price, final_price, currency, full_name, email, phone,
  base_rental_price, final_rental_price, pickup_location_fee, return_location_fee,
  insurance_cost, young_driver_cost
) values (
  'ca2f2000-0000-4000-8000-000000000001',
  '2817e6de-25ba-5237-b721-dbc0460a7de4',
  'pending', 'unpaid', '2026-09-10', '09:15', '2026-09-13', '11:45',
  'larnaca', 'ayia-napa', 'ayia-napa', 'Kymco UVX', 270, 270, 270, 'EUR',
  'Future Synthetic Customer', 'future@example.test', '+35700000001',
  270, 270, 0, 0, 0, 0
);

do $new_booking$
declare
  v_fulfillment public.partner_service_fulfillments%rowtype;
begin
  if (select count(*) from public.partner_service_fulfillments
      where resource_type = 'cars'
        and booking_id = 'ca2f2000-0000-4000-8000-000000000001'::uuid) <> 1 then
    raise exception 'fresh booking did not create exactly one Cars fulfillment';
  end if;

  select * into strict v_fulfillment
  from public.partner_service_fulfillments fulfillment
  where fulfillment.resource_type = 'cars'
    and fulfillment.booking_id = 'ca2f2000-0000-4000-8000-000000000001'::uuid;

  if v_fulfillment.partner_id <> '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
     or v_fulfillment.resource_id <> '2817e6de-25ba-5237-b721-dbc0460a7de4'::uuid
     or v_fulfillment.status <> 'pending_acceptance'
     or v_fulfillment.contact_revealed_at is not null
     or v_fulfillment.details->>'pickup_date' <> '2026-09-10'
     or v_fulfillment.details->>'pickup_time' <> '09:15:00'
     or v_fulfillment.details->>'return_date' <> '2026-09-13'
     or v_fulfillment.details->>'return_time' <> '11:45:00'
     or v_fulfillment.details->>'duration_days' <> '4'
     or v_fulfillment.details ?| array[
       'full_name', 'customer_name', 'email', 'customer_email',
       'phone', 'customer_phone', 'pickup_address', 'return_address'
     ] then
    raise exception 'fresh Cars fulfillment operational contract mismatch';
  end if;
end
$new_booking$;

update public.car_bookings
set payment_status = 'partial'
where id = 'ca2f2000-0000-4000-8000-000000000001'::uuid;

do $payment_does_not_accept$
begin
  if (select count(*) from public.partner_service_fulfillments
      where resource_type = 'cars'
        and booking_id = 'ca2f2000-0000-4000-8000-000000000001'::uuid) <> 1
     or (select status from public.partner_service_fulfillments
         where resource_type = 'cars'
           and booking_id = 'ca2f2000-0000-4000-8000-000000000001'::uuid)
        <> 'pending_acceptance'
     or (select status from public.car_bookings
         where id = 'ca2f2000-0000-4000-8000-000000000001'::uuid)
        <> 'pending' then
    raise exception 'payment update duplicated or auto-accepted the booking request';
  end if;
end
$payment_does_not_accept$;

-- Exact owner membership sees the new row immediately; unrelated membership
-- cannot see it. Contact and form snapshot remain unavailable before accept.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"5c3ab931-af5c-4bab-a7ab-9474afab339e"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 1
  from public.partner_service_fulfillments
  where booking_id = 'ca2f2000-0000-4000-8000-000000000001'::uuid
    and partner_id = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
    and status = 'pending_acceptance')::integer);
select 1 / ((select count(*) = 0
  from public.partner_service_fulfillment_contacts contact_row
  join public.partner_service_fulfillments fulfillment
    on fulfillment.id = contact_row.fulfillment_id
  where fulfillment.booking_id = 'ca2f2000-0000-4000-8000-000000000001'::uuid)::integer);
select 1 / ((select count(*) = 0
  from public.partner_service_fulfillment_form_snapshots snapshot_row
  join public.partner_service_fulfillments fulfillment
    on fulfillment.id = snapshot_row.fulfillment_id
  where fulfillment.booking_id = 'ca2f2000-0000-4000-8000-000000000001'::uuid)::integer);
reset role;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"ca2f1000-0000-4000-8000-000000000099"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 0
  from public.partner_service_fulfillments
  where booking_id = 'ca2f2000-0000-4000-8000-000000000001'::uuid)::integer);
reset role;

rollback;

-- The synthetic future row was rolled back; the migrated existing row remains.
select 1 / ((select count(*) = 0
  from public.car_bookings
  where id = 'ca2f2000-0000-4000-8000-000000000001'::uuid)::integer);
select 1 / ((select count(*) = 1
  from public.partner_service_fulfillments
  where id = '1569af6f-f98a-4f1b-95cc-055963c75c98'::uuid
    and status = 'pending_acceptance')::integer);
