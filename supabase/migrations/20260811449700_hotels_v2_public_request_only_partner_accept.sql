-- DRAFT / NO DEPLOY until end-to-end isolated DB, concurrent requests, and rollback acceptance.
-- Separate request-only release from 114494 global booking/payment capability.
-- Pilot only. Default OFF. Does not change any historical function, booking mode, payment flag, or existing order.
BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';

DO $pre_114497$
BEGIN
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations
        WHERE version='20260811449400') <> 1
    OR to_regnamespace('hotels_public_booking_114494_private') IS NULL
    OR to_regnamespace('hotels_public_booking_114497_private') IS NOT NULL
    OR to_regprocedure('public.hotel_v2_public_begin_request_114497(uuid,text,jsonb)') IS NOT NULL
    OR hotels_post_114493_private.catalog_epoch_is_exact_114493() IS DISTINCT FROM true
    OR hotels_post_114493_private.pricing_activation_current_is_safe_114493() IS DISTINCT FROM true
    OR hotels_post_114493_private.reviewed_pricing_receipt_chain_is_exact_114493() IS DISTINCT FROM true
    OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS DISTINCT FROM true
    OR public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() IS DISTINCT FROM true
    OR hotels_public_booking_114494_private.public_booking_state() IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION USING errcode='55000',
      message='hotels_114497_release_preflight_failed';
  END IF;
END
$pre_114497$;

CREATE SCHEMA hotels_public_booking_114497_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA hotels_public_booking_114497_private
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE hotels_public_booking_114497_private.request_mode_gate (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  hotel_id uuid NOT NULL UNIQUE
    CHECK (hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  request_mode_enabled boolean NOT NULL DEFAULT false
);
ALTER TABLE hotels_public_booking_114497_private.request_mode_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels_public_booking_114497_private.request_mode_gate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hotels_public_booking_114497_private.request_mode_gate
  FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO hotels_public_booking_114497_private.request_mode_gate(singleton,hotel_id)
VALUES(true,'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid);

CREATE FUNCTION hotels_public_booking_114497_private.require_request_only()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth' AS $f$
BEGIN
  PERFORM hotels_public_booking_114494_private.require_safety();
  IF NOT EXISTS (
    SELECT 1 FROM hotels_public_booking_114497_private.request_mode_gate
    WHERE singleton AND request_mode_enabled AND hotel_id=
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  ) THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_requests_not_enabled';
  END IF;
END $f$;
REVOKE ALL ON FUNCTION hotels_public_booking_114497_private.require_request_only()
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.hotel_v2_public_request_capability_114497()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth' AS $f$
DECLARE
  v_enabled boolean;
BEGIN
  PERFORM hotels_public_booking_114494_private.require_safety();
  SELECT request_mode_enabled INTO v_enabled
  FROM hotels_public_booking_114497_private.request_mode_gate WHERE singleton;
  RETURN jsonb_build_object(
    'contract_version','hotels_v2_public_request_only_capability_114497_v1',
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'can_submit',coalesce(v_enabled,false)
  );
END $f$;
REVOKE ALL ON FUNCTION public.hotel_v2_public_request_capability_114497()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_public_request_capability_114497()
  TO anon,authenticated;

CREATE FUNCTION public.hotel_v2_public_get_request_options_114497(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth' AS $f$
DECLARE
  v_quote jsonb;
  v_enabled boolean;
BEGIN
  PERFORM hotels_public_booking_114494_private.require_safety();
  v_quote:=hotels_public_booking_114494_private.public_quote(
    hotels_public_booking_114494_private.quote_core(p_request)
  );
  SELECT request_mode_enabled INTO v_enabled
  FROM hotels_public_booking_114497_private.request_mode_gate WHERE singleton;
  RETURN v_quote || jsonb_build_object(
    'can_submit',coalesce(v_enabled,false)
      AND v_quote->>'mode'='A',
    'request_only',true
  );
END $f$;
REVOKE ALL ON FUNCTION public.hotel_v2_public_get_request_options_114497(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_public_get_request_options_114497(jsonb)
  TO anon,authenticated;

CREATE FUNCTION public.hotel_v2_public_create_request_quote_114497(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth' AS $f$
DECLARE
  v_quote jsonb;
BEGIN
  PERFORM hotels_public_booking_114497_private.require_request_only();
  IF hotels_public_booking_114494_private.quote_core(p_request)->>'mode'
       IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_request_only_mode_required';
  END IF;
  v_quote:=hotels_public_booking_114494_private.issue_quote(p_request);
  IF v_quote#>>'{quote,mode}' IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_request_only_mode_changed';
  END IF;
  RETURN v_quote;
END $f$;
REVOKE ALL ON FUNCTION public.hotel_v2_public_create_request_quote_114497(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_public_create_request_quote_114497(jsonb)
  TO anon,authenticated;

CREATE FUNCTION public.hotel_v2_public_begin_request_114497(
  p_quote_id uuid,p_lookup_token text,p_customer jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth' AS $f$
DECLARE
  v_quote hotels_public_booking_114494_private.quotes%rowtype;
  v_result jsonb;
BEGIN
  PERFORM hotels_public_booking_114497_private.require_request_only();
  v_quote:=hotels_public_booking_114494_private.require_quote(
    p_quote_id,p_lookup_token
  );
  IF v_quote.authority->>'mode' IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_request_only_mode_required';
  END IF;
  v_result:=hotels_public_booking_114494_private.begin_core(
    p_quote_id,p_lookup_token,p_customer
  );
  -- A concurrent calendar activation must never silently promote this
  -- request-only endpoint into a payment or automatic booking.
  IF v_result->>'mode' IS DISTINCT FROM 'A'
    OR v_result->>'status' NOT IN ('request_pending','confirmed')
    OR v_result->'payment_required' IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_request_only_mode_changed';
  END IF;
  RETURN v_result;
END $f$;
REVOKE ALL ON FUNCTION public.hotel_v2_public_begin_request_114497(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_public_begin_request_114497(uuid,text,jsonb)
  TO anon,authenticated;

CREATE FUNCTION public.hotel_v2_partner_pending_requests_114497(p_partner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth' AS $f$
DECLARE
  v_rows jsonb;
BEGIN
  PERFORM hotels_public_booking_114497_private.require_request_only();
  IF auth.uid() IS NULL OR p_partner_id IS NULL THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_partner_access_denied';
  END IF;
  PERFORM public.hotel_v2_h3_2a_require_partner_membership(p_partner_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.partner_resources r
    JOIN public.hotel_partner_hotel_permissions p ON p.assignment_id=r.id
    WHERE r.id='a082c085-a6ea-46fd-8548-c8d9c6ee2c34'::uuid
      AND r.partner_id=p_partner_id AND p.partner_id=p_partner_id
      AND r.resource_type='hotels'
      AND r.resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      AND p.hotel_id=r.resource_id
      AND p.has_mutation_capability AND p.process_bookings
  ) THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_partner_access_denied';
  END IF;
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'order_id',t.order_id,
      'booking_id',t.booking_id,
      'arrival_date',t.arrival_date,
      'departure_date',t.departure_date,
      'customer_name',t.customer_name,
      'customer_email',t.customer_email,
      'total_price',t.total_price,
      'currency','EUR',
      'status','request_pending',
      'room_allocation',t.room_allocation
    ) ORDER BY t.arrival_date,t.order_id
  ),'[]'::jsonb)
  INTO v_rows FROM (
    SELECT o.id AS order_id,b.id AS booking_id,
      b.arrival_date,b.departure_date,b.customer_name,
      b.customer_email,b.total_price,
      q.authority->'allocation' AS room_allocation
    FROM hotels_public_booking_114494_private.orders o
    JOIN hotels_public_booking_114494_private.quotes q ON q.id=o.id
    JOIN public.hotel_bookings b ON b.id=o.booking_id
    WHERE o.mode='A' AND o.status='request_pending'
      AND b.status='pending'
      AND b.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      AND q.authority->>'partner_id'=p_partner_id::text
    ORDER BY b.arrival_date,o.id
    LIMIT 100
  ) t;
  RETURN jsonb_build_object(
    'contract_version','hotels_v2_partner_pending_requests_114497_v1',
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'partner_id',p_partner_id,
    'requests',v_rows
  );
END $f$;
REVOKE ALL ON FUNCTION public.hotel_v2_partner_pending_requests_114497(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_partner_pending_requests_114497(uuid)
  TO authenticated;

CREATE FUNCTION public.hotel_v2_partner_accept_request_114497(
  p_order_id uuid,p_partner_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth' AS $f$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM hotels_public_booking_114497_private.require_request_only();
  IF auth.uid() IS NULL OR p_order_id IS NULL OR p_partner_id IS NULL THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_acceptance_denied';
  END IF;
  PERFORM public.hotel_v2_h3_2a_require_partner_membership(p_partner_id);
  IF NOT EXISTS(
    SELECT 1 FROM public.partner_resources r
    JOIN public.hotel_partner_hotel_permissions p ON p.assignment_id=r.id
    WHERE r.id='a082c085-a6ea-46fd-8548-c8d9c6ee2c34'::uuid
      AND r.partner_id=p_partner_id AND p.partner_id=p_partner_id
      AND r.resource_type='hotels'
      AND r.resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      AND p.hotel_id=r.resource_id
      AND p.has_mutation_capability AND p.process_bookings
  ) OR NOT EXISTS(
    SELECT 1 FROM hotels_public_booking_114494_private.orders o
    JOIN hotels_public_booking_114494_private.quotes q ON q.id=o.id
    WHERE o.id=p_order_id AND o.mode='A'
      AND q.authority->>'partner_id'=p_partner_id::text
      AND o.status IN ('request_pending','confirmed')
  ) THEN
    RAISE EXCEPTION USING errcode='42501',
      message='hotels_114497_acceptance_denied';
  END IF;
  PERFORM hotels_public_booking_114494_private.confirm_core(p_order_id);
  v_result:=hotels_public_booking_114494_private.status_core(p_order_id);
  IF v_result->>'status' IS DISTINCT FROM 'confirmed'
    OR v_result->>'mode' IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION USING errcode='55000',
      message='hotels_114497_acceptance_postcondition_failed';
  END IF;
  RETURN v_result;
END $f$;
REVOKE ALL ON FUNCTION public.hotel_v2_partner_accept_request_114497(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_partner_accept_request_114497(uuid,uuid)
  TO authenticated;

DO $post_114497$
BEGIN
  IF (SELECT count(*) FROM hotels_public_booking_114497_private.request_mode_gate
       WHERE singleton AND request_mode_enabled IS FALSE)<>1
    OR hotels_public_booking_114494_private.public_booking_state() IS DISTINCT FROM false
    OR hotels_post_114493_private.catalog_epoch_is_exact_114493() IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION USING errcode='55000',
      message='hotels_114497_post_install_gate_failed';
  END IF;
END
$post_114497$;

COMMIT;
