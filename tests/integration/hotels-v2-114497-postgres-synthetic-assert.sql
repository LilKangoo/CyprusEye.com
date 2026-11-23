\set ON_ERROR_STOP on
-- Everything here executes in a one-use, network-isolated Docker PostgreSQL.
-- Positive behavior uses deliberately simplified 114494 stubs. NO real guest data.
BEGIN;
DO $checks$
DECLARE v_oid oid;
BEGIN
 v_oid:=to_regprocedure('public.hotel_v2_public_begin_request_114497(uuid,text,jsonb)');
 IF v_oid IS NULL THEN RAISE EXCEPTION 'missing_new_request_rpc'; END IF;
 IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid=v_oid)
    OR (SELECT p.proowner FROM pg_proc p WHERE p.oid=v_oid) <> 'postgres'::regrole
    THEN RAISE EXCEPTION 'new_request_rpc_security_error'; END IF;
 IF has_function_privilege('service_role',v_oid,'EXECUTE') IS DISTINCT FROM false
    OR has_function_privilege('authenticated',v_oid,'EXECUTE') IS DISTINCT FROM true
    OR has_function_privilege('anon',v_oid,'EXECUTE') IS DISTINCT FROM true
    THEN RAISE EXCEPTION 'public_request_acl_invalid'; END IF;
 IF has_function_privilege('anon','public.hotel_v2_partner_accept_request_114497(uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.hotel_v2_partner_accept_request_114497(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.hotel_v2_partner_accept_request_114497(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'partner_confirmation_acl_invalid'; END IF;
 IF has_function_privilege('anon','hotels_public_booking_114497_private.require_request_only()','EXECUTE')
 THEN RAISE EXCEPTION 'internal_gate_acl_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM hotels_public_booking_114497_private.request_mode_gate
    WHERE request_mode_enabled) OR
    (SELECT count(*) FROM hotels_public_booking_114497_private.request_mode_gate)<>1
 THEN RAISE EXCEPTION 'new_request_gate_not_off'; END IF;
 RAISE NOTICE 'EXACT_VERSIONED_MIGRATION_COMPILED_AND_ACL_PASS';
END $checks$;
COMMIT;
\echo MIGRATION_SQL_AND_ACCESS_CONTROLS=PASS

BEGIN;
SET LOCAL ROLE anon;
DO $test_off$
DECLARE context jsonb;
BEGIN
 context:=public.hotel_v2_public_request_context_114497();
 IF context->>'contract_version' <> 'hotels_v2_public_request_context_114497_v1'
 OR context->>'can_submit'<>'false'
 OR context->>'minimum_stay_nights'<>'2'
 OR context->>'minimum_child_age'<>'15'
 OR jsonb_array_length(context->'rooms')<>2 THEN
  RAISE EXCEPTION 'disabled_public_read_contract_wrong';
 END IF;
 IF public.hotel_v2_public_get_request_options_114497('{}'::jsonb)->>'can_submit'<>'false'
 THEN RAISE EXCEPTION 'disabled_options_claim_active'; END IF;
 BEGIN
  PERFORM public.hotel_v2_public_create_request_quote_114497('{}'::jsonb);
  RAISE EXCEPTION 'disabled_quote_was_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.hotel_v2_partner_pending_requests_114497(
    '40000000-0000-4000-8000-000000000001'::uuid);
  RAISE EXCEPTION 'anonymous_inbox_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RAISE NOTICE 'ANONYMOUS_GATE_OFF_AND_PARTNER_INBOX_DENIED=PASS';
END $test_off$;
RESET ROLE;
COMMIT;
\echo DISABLED_REQUESTS_REJECTED=PASS

BEGIN;
SET LOCAL ROLE service_role;
DO $acl_service$
BEGIN
 BEGIN
  PERFORM public.hotel_v2_public_begin_request_114497(
    '55555555-5555-4555-8555-555555555555'::uuid,
    repeat('a',64),'{}'::jsonb);
  RAISE EXCEPTION 'service_role_can_submit';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $acl_service$;
RESET ROLE;
COMMIT;
\echo SERVICE_ROLE_EXPLICITLY_DENIED=PASS

-- THIS ENABLES ONLY THE SYNTHETIC DISPOSABLE FIXTURE, NEVER PRODUCTION.
UPDATE hotels_public_booking_114497_private.request_mode_gate
SET request_mode_enabled=true;

BEGIN;
SET LOCAL ROLE anon;
DO $negative$
BEGIN
 IF public.hotel_v2_public_request_context_114497()->>'can_submit'<>'true'
 THEN RAISE EXCEPTION 'synthetic_gate_not_enabled'; END IF;
 IF public.hotel_v2_public_get_request_options_114497('{}'::jsonb)->>'can_submit'<>'true'
 THEN RAISE EXCEPTION 'synthetic_read_options_not_enabled'; END IF;
 BEGIN
  PERFORM public.hotel_v2_public_create_request_quote_114497(
    '{"force_mode":"B"}'::jsonb);
  RAISE EXCEPTION 'request_only_accepts_paid_mode_B';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.hotel_v2_public_create_request_quote_114497(
    '{"available":false}'::jsonb);
  RAISE EXCEPTION 'request_only_accepts_unavailable_dates';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RAISE NOTICE 'PAID_MODE_B_AND_UNAVAILABLE_DATES_DENIED=PASS';
END $negative$;

SELECT issued->>'quote_id' AS synthetic_quote_id,
       issued->>'lookup_token' AS synthetic_lookup_token
FROM (
 SELECT public.hotel_v2_public_create_request_quote_114497(
  '{"hotel_id":"9b6d99a0-923a-4fbc-be54-c066e856e6ca",
    "arrival_date":"2027-04-10","departure_date":"2027-04-12",
    "adults":2,"child_ages":[],"selected_extra_ids":[]}'::jsonb
 ) AS issued
) x \gset
-- psql does not interpolate variables inside dollar-quoted PL/pgSQL bodies.
SELECT set_config('hotels_synthetic.quote_id', :'synthetic_quote_id', false),
       set_config('hotels_synthetic.lookup_token', :'synthetic_lookup_token', false);

DO $test_begin$
DECLARE value jsonb;
BEGIN
 value:=public.hotel_v2_public_begin_request_114497(
  current_setting('hotels_synthetic.quote_id')::uuid,
  current_setting('hotels_synthetic.lookup_token'),
  '{"name":"Synthetic Guest","email":"synthetic@example.invalid","lang":"pl"}'::jsonb);
 IF value->>'mode'<>'A' OR value->>'status'<>'request_pending'
 OR value->'payment_required' IS DISTINCT FROM 'false'::jsonb THEN
  RAISE EXCEPTION 'synthetic_mode_A_request_result_bad: %',value;
 END IF;
 RAISE NOTICE 'SYNTHETIC_MODE_A_BEGIN_ROUTE=PASS';
END $test_begin$;
RESET ROLE;
COMMIT;
\echo SYNTHETIC_REQUEST_CREATED=PASS

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
DO $test_partner$
DECLARE inbox jsonb;confirmed jsonb;empty_inbox jsonb;
BEGIN
 inbox:=public.hotel_v2_partner_pending_requests_114497(
   '40000000-0000-4000-8000-000000000001'::uuid);
 IF inbox->>'contract_version'<>'hotels_v2_partner_pending_requests_114497_v1'
    OR jsonb_array_length(inbox->'requests')<>1
    OR inbox#>>'{requests,0,customer_email}'<>'synthetic@example.invalid'
 THEN RAISE EXCEPTION 'synthetic_partner_inbox_wrong'; END IF;
 IF inbox::text LIKE '%aaaaaaaaaa%' THEN
   RAISE EXCEPTION 'private_quote_token_was_exposed'; END IF;
 BEGIN
  PERFORM public.hotel_v2_partner_pending_requests_114497(
    '40000000-0000-4000-8000-000000000002'::uuid);
  RAISE EXCEPTION 'wrong_partner_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 confirmed:=public.hotel_v2_partner_accept_request_114497(
   (inbox#>>'{requests,0,order_id}')::uuid,
   '40000000-0000-4000-8000-000000000001'::uuid);
 IF confirmed->>'status'<>'confirmed' OR confirmed->>'mode'<>'A'
    OR confirmed->'payment_required' IS DISTINCT FROM 'false'::jsonb
 THEN RAISE EXCEPTION 'synthetic_partner_confirm_failed'; END IF;
 empty_inbox:=public.hotel_v2_partner_pending_requests_114497(
   '40000000-0000-4000-8000-000000000001'::uuid);
 IF jsonb_array_length(empty_inbox->'requests')<>0
 THEN RAISE EXCEPTION 'confirmed_order_still_pending'; END IF;
 RAISE NOTICE 'PARTNER_MEMBERSHIP_ASSIGNMENT_PENDING_AND_CONFIRM=PASS';
END $test_partner$;
RESET ROLE;
COMMIT;
\echo SYNTHETIC_PARTNER_CONFIRMATION=PASS

-- Switching on the existing global paid-booking flag MUST force
-- every public 114497 function to report OFF or reject write.
UPDATE hotels_public_booking_114494_private.global_flag SET enabled=true;
BEGIN;
SET LOCAL ROLE anon;
DO $global_gate$
BEGIN
 IF public.hotel_v2_public_request_capability_114497()->>'can_submit'<>'false'
 OR public.hotel_v2_public_request_context_114497()->>'can_submit'<>'false'
 THEN RAISE EXCEPTION 'global_payment_gate_bleed'; END IF;
 BEGIN
  PERFORM public.hotel_v2_public_create_request_quote_114497('{}'::jsonb);
  RAISE EXCEPTION 'global_payment_gate_did_not_block_request';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RAISE NOTICE 'EXISTING_GLOBAL_BOOKING_FLAG_REMAINS_SEPARATE=PASS';
END $global_gate$;
RESET ROLE;
COMMIT;
\echo PAYMENT_MODE_ISOLATION=PASS

\echo SYNTHETIC_CONTRACT_TEST_COMPLETE
