\set ON_ERROR_STOP on
-- USE ONLY IN NEW DISPOSABLE CI POSTGRES, never in production.
-- This checks the AUTHENTIC 114494 begin_core against synthetic quote/tables.
-- Run AFTER the successful authentic concurrent confirmation test.
BEGIN;

ALTER TABLE hotels_public_booking_114494_private.quotes
 ADD COLUMN expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '5 minutes';
ALTER TABLE hotels_public_booking_114494_private.orders
 ADD COLUMN customer_hash text;

CREATE FUNCTION hotels_public_booking_114494_private.digest(p jsonb)
RETURNS text LANGUAGE sql AS $f$
  SELECT encode(sha256(convert_to(p::text,'UTF8')),'hex');
$f$;

CREATE TABLE public.hotel_seven_arches_public_booking_transaction_context (
 backend_pid integer,transaction_id bigint,booking_id uuid,hotel_id uuid,
 quote_fingerprint text,authority_token text,actor_id uuid
);

ALTER TABLE public.hotel_bookings ADD COLUMN num_adults integer;
ALTER TABLE public.hotel_bookings ADD COLUMN num_children integer;
ALTER TABLE public.hotel_bookings ADD COLUMN nights integer;
ALTER TABLE public.hotel_bookings ADD COLUMN base_price numeric;
ALTER TABLE public.hotel_bookings ADD COLUMN extras_price numeric;
ALTER TABLE public.hotel_bookings ADD COLUMN final_price numeric;
ALTER TABLE public.hotel_bookings ADD COLUMN lang text;
ALTER TABLE public.hotel_bookings ADD COLUMN selected_extras jsonb;
ALTER TABLE public.hotel_bookings ADD COLUMN pricing_breakdown jsonb;
ALTER TABLE public.hotel_bookings ADD COLUMN booking_details jsonb;
ALTER TABLE public.hotel_bookings ADD COLUMN pricing_quote_fingerprint text;
ALTER TABLE public.hotel_bookings ADD COLUMN pricing_authority_token text;
ALTER TABLE public.hotel_bookings ADD COLUMN pricing_quote_expires_at timestamptz;
ALTER TABLE public.hotel_bookings ADD COLUMN pricing_allocation jsonb;

-- No payment job creation is allowed in the request-only test.
CREATE TABLE hotels_public_booking_114494_private.payment_jobs(
 order_id uuid NOT NULL,kind text NOT NULL,idempotency_key text NOT NULL,
 PRIMARY KEY(order_id,kind)
);
CREATE FUNCTION hotels_public_booking_114494_private.enqueue(p_id uuid,p_kind text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $f$
 INSERT INTO hotels_public_booking_114494_private.payment_jobs(order_id,kind,idempotency_key)
 VALUES(p_id,p_kind,'synthetic:'||p_id::text||':'||p_kind)
 ON CONFLICT(order_id,kind) DO NOTHING;
$f$;

COMMIT;
\echo SYNTHETIC_BEGIN_DEPENDENCIES=PASS

BEGIN;
SET LOCAL ROLE anon;
DO $run_authentic_begin$
DECLARE
  v_request jsonb:=jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'arrival_date','2027-05-10','departure_date','2027-05-12',
    'adults',2,'child_ages','[]'::jsonb,
    'room_type_id','11111111-1111-4111-8111-111111111111',
    'selected_extra_ids','[]'::jsonb
  );
  v_customer jsonb:='{"name":"Test Guest","email":"nonexistent@example.invalid","lang":"pl"}'::jsonb;
  v_other_customer jsonb:='{"name":"Other Guest","email":"notreal@example.invalid","lang":"pl"}'::jsonb;
  v_issued jsonb;v_first jsonb;v_second jsonb;v_id uuid;v_token text;
BEGIN
  v_issued:=public.hotel_v2_public_create_request_quote_114497(v_request);
  v_id:=(v_issued->>'quote_id')::uuid;v_token:=v_issued->>'lookup_token';
  IF v_issued#>>'{quote,mode}' IS DISTINCT FROM 'A'
     OR v_issued#>>'{quote,due_now}' IS DISTINCT FROM '0'
  THEN RAISE EXCEPTION 'authentic_begin_issued_wrong_mode_or_amount'; END IF;

  v_first:=public.hotel_v2_public_begin_request_114497(v_id,v_token,v_customer);
  IF v_first->>'status' IS DISTINCT FROM 'request_pending'
    OR v_first->>'mode' IS DISTINCT FROM 'A'
    OR v_first->'payment_required' IS DISTINCT FROM 'false'::jsonb
  THEN RAISE EXCEPTION 'authentic_begin_wrong_initial_result'; END IF;

  -- Duplicate request with IDENTICAL quote and customer is idempotent.
  v_second:=public.hotel_v2_public_begin_request_114497(v_id,v_token,v_customer);
  IF v_second IS DISTINCT FROM v_first THEN
    RAISE EXCEPTION 'authentic_begin_idempotent_response_drift'; END IF;

  BEGIN
    PERFORM public.hotel_v2_public_begin_request_114497(v_id,v_token,v_other_customer);
    RAISE EXCEPTION 'authentic_begin_accepted_changed_customer';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%hotels_114494_idempotency_conflict%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.hotel_v2_public_begin_request_114497(
      v_id,repeat('b',64),v_customer);
    RAISE EXCEPTION 'authentic_begin_accepted_incorrect_token';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%hotels_114494_lookup_denied%'
      AND SQLERRM NOT LIKE '%query returned no rows%'
    THEN RAISE; END IF;
  END;

  RAISE NOTICE 'AUTHENTIC_BEGIN_CORE_A_ONLY_IDEMPOTENCY_AND_TOKEN=PASS';
END $run_authentic_begin$;
RESET ROLE;
COMMIT;

DO $verify_no_payment$
BEGIN
 IF (SELECT count(*) FROM hotels_public_booking_114494_private.orders
       WHERE status='request_pending')<>2
    OR (SELECT count(*) FROM hotels_public_booking_114494_private.orders
       WHERE status='confirmed')<>1
    OR (SELECT count(*) FROM hotels_public_booking_114494_private.payment_jobs)<>0
    OR (SELECT count(*) FROM public.hotel_inventory_holds)<>0
    OR (SELECT count(*) FROM public.hotel_seven_arches_public_booking_transaction_context)<>1
    OR (SELECT count(*) FROM public.hotel_bookings
      WHERE arrival_date='2027-05-10' AND status='pending')<>1
 THEN RAISE EXCEPTION 'AUTHENTIC_BEGIN_CORE_SIDE_EFFECT_MISMATCH'; END IF;
 RAISE NOTICE 'ONE_NEW_PENDING_ORDER_NO_STRIPE_JOB_NO_HOLD=PASS';
END $verify_no_payment$;
\echo AUTHENTIC_BEGIN_CORE_SYNTHETIC_ACCEPTANCE_COMPLETE
