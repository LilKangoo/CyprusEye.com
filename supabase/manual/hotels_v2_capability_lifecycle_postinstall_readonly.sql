BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout='120s';
DO $gate$
DECLARE s jsonb;
BEGIN
 s:=hotels_lifecycle_private.safe_state();
 IF (s->>'version')::bigint<>0 OR (s->>'public_booking_enabled')::boolean
 OR EXISTS(SELECT 1 FROM hotels_lifecycle_private.decisions)
 OR EXISTS(SELECT 1 FROM hotels_lifecycle_private.context)
 OR hotels_lifecycle_private.predecessor_receipts() IS DISTINCT FROM
 (SELECT predecessor_receipts FROM hotels_lifecycle_private.foundation WHERE id=1)
 OR public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_capability_postinstall_boundary_failed'; END IF;
END $gate$;
SELECT 'HOTELS_CAPABILITY_POSTINSTALL_OK' AS sentinel,current_setting('transaction_read_only') AS transaction_read_only,
 true AS source_security_catalog_exact,true AS predecessor_receipts_unchanged,
 0 AS decisions,0 AS transaction_context,false AS public_booking_enabled,
 hotels_lifecycle_private.actual_flags() AS exact_feature_flags;
ROLLBACK;
