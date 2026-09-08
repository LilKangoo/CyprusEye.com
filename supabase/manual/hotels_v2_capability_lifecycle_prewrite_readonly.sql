BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout='120s';
DO $gate$
BEGIN
 IF to_regnamespace('hotels_lifecycle_private') IS NOT NULL
 OR to_regprocedure('public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text)') IS NULL
 OR (SELECT count(*) FROM public.site_settings)<>1
 OR NOT EXISTS(SELECT 1 FROM public.site_settings WHERE id=1 AND hotel_rooms_v2_enabled IS FALSE
 AND hotel_instant_booking_enabled IS FALSE AND hotel_stripe_connect_enabled IS FALSE AND hotel_external_sync_enabled IS NOT NULL)
 OR public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_capability_prewrite_boundary_failed'; END IF;
END $gate$;
SELECT 'HOTELS_CAPABILITY_PREWRITE_OK' AS sentinel,current_setting('transaction_read_only') AS transaction_read_only,
 true AS predecessor_safe,false AS installation_enables_any_flag,false AS installation_grants_partner_permission;
ROLLBACK;
