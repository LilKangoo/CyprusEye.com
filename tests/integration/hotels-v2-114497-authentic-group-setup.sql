\set ON_ERROR_STOP on
-- Only synthetic quote_core is revised. Authentic confirm_core and lock_inventory
-- remain byte-for-byte pinned to production source; DO NOT use in production.
-- 7 Kamares live 5-person group rule (read-only verified):
-- room A allocates 3, prices 2; room B allocates 2, prices 2.
BEGIN;
CREATE OR REPLACE FUNCTION hotels_public_booking_114494_private.quote_core(p jsonb)
RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object(
 'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
 'partner_id','40000000-0000-4000-8000-000000000001',
 'mode',coalesce(p->>'force_mode','A'),
 'available',coalesce((p->>'available')::boolean,true),
 'currency','EUR','gross',CASE WHEN p->>'synthetic_bundle'='true' THEN 400 ELSE 200 END,'due_now',0,
 'adults',coalesce((p->>'adults')::integer,2),
 'child_ages',coalesce(p->'child_ages','[]'::jsonb),
 'extras','[]'::jsonb,
 'arrival_date',coalesce(p->>'arrival_date','2027-04-10'),
 'departure_date',coalesce(p->>'departure_date','2027-04-12'),
 'allocation',CASE WHEN p->>'synthetic_bundle'='true' THEN
   jsonb_build_array(
    jsonb_build_object(
      'room_type_id','11111111-1111-4111-8111-111111111111',
      'rate_plan_id','55555555-5555-4555-8555-555555555555',
      'room_rate_id','66666666-6666-4666-8666-666666666666',
      'allocated_guests',3,'pricing_guests',2,'units',1),
    jsonb_build_object(
      'room_type_id','22222222-2222-4222-8222-222222222222',
      'rate_plan_id','77777777-7777-4777-8777-777777777777',
      'room_rate_id','88888888-8888-4888-8888-888888888888',
      'allocated_guests',2,'pricing_guests',2,'units',1)
   ) ELSE jsonb_build_array(jsonb_build_object(
    'room_type_id','11111111-1111-4111-8111-111111111111',
    'rate_plan_id','55555555-5555-4555-8555-555555555555',
    'room_rate_id','66666666-6666-4666-8666-666666666666',
    'allocated_guests',2,'pricing_guests',2,'units',1)) END,
 'base_total',CASE WHEN p->>'synthetic_bundle'='true' THEN 400 ELSE 200 END,'extras_total',0);
$f$;


DO $group_seed$
DECLARE i integer; order_id uuid;booking_id uuid; req jsonb;
BEGIN
 req:=jsonb_build_object(
  'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'arrival_date','2027-06-10','departure_date','2027-06-12',
  'adults',5,'child_ages','[]'::jsonb,
  'room_type_id',null,'selected_extra_ids','[]'::jsonb,
  'synthetic_bundle',true
 );
 FOR i IN 1..2 LOOP
  order_id:=CASE WHEN i=1 THEN '95555555-5555-4555-8555-555555555555'::uuid
   ELSE '96666666-6666-4666-8666-666666666666'::uuid END;
  booking_id:=CASE WHEN i=1 THEN '97777777-7777-4777-8777-777777777777'::uuid
   ELSE '98888888-8888-4888-8888-888888888888'::uuid END;
  INSERT INTO hotels_public_booking_114494_private.quotes(id,request,authority,token)
  VALUES(order_id,req,hotels_public_booking_114494_private.quote_core(req),repeat('a',64));
  INSERT INTO hotels_public_booking_114494_private.orders(id,booking_id,mode,status,actor_id)
  VALUES(order_id,booking_id,'A','request_pending','30000000-0000-4000-8000-000000000001');
  INSERT INTO public.hotel_bookings
  (id,hotel_id,arrival_date,departure_date,customer_name,customer_email,total_price,status)
  VALUES(booking_id,'9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  '2027-06-10','2027-06-12','Synthetic Group Guest','group@example.invalid',400,'pending');
 END LOOP;
 IF (SELECT count(*) FROM hotels_public_booking_114494_private.quotes
  WHERE request->>'synthetic_bundle'='true'
    AND jsonb_array_length(authority->'allocation')=2
    AND authority->>'gross'='400')<>2
 THEN RAISE EXCEPTION 'synthetic_group_quote_mismatch'; END IF;
END $group_seed$;
COMMIT;
\echo SYNTHETIC_5_GUEST_2_APARTMENT_QUOTES=PASS
