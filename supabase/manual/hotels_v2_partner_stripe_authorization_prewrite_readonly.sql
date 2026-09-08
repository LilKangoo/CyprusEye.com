BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout='120s';
DO $prewrite$
BEGIN
  IF to_regclass('hotel_stripe_connect_private.accounts') IS NULL
    OR to_regclass('hotel_stripe_connect_private.onboarding_authorizations') IS NOT NULL
    OR to_regprocedure('hotel_stripe_connect_private.scope(uuid,uuid,uuid)') IS NULL
    OR (SELECT count(*) FROM public.site_settings)<>1
    OR NOT EXISTS(SELECT 1 FROM public.site_settings WHERE id=1
      AND NOT hotel_rooms_v2_enabled AND NOT hotel_instant_booking_enabled
      AND NOT hotel_stripe_connect_enabled AND hotel_external_sync_enabled IS NOT NULL)
    OR public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
    OR EXISTS(SELECT 1 FROM (VALUES
      ('hotel_stripe_connect_private.scope(uuid,uuid,uuid)',
        '38c1f9e1448f6632712ea5e4ba22b2ccc9fd481d784b5b1f586e17a07b71e100'),
      ('public.hotel_v2_stripe_connect_service(text,jsonb)',
        '51edcefdd3a898db8550aff6b290b1d6b3c8f633f3684458ed1fbf17d5558f32')
    ) e(signature,hash) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
    WHERE p.oid IS NULL OR p.proowner<>'postgres'::regrole OR NOT p.prosecdef
      OR encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') IS DISTINCT FROM e.hash)
  THEN RAISE EXCEPTION 'hotel_stripe_authorization_prewrite_failed';END IF;
END
$prewrite$;
SELECT 'STRIPE_PARTNER_AUTHORIZATION_PREWRITE_OK' AS sentinel,
  current_setting('transaction_read_only') AS transaction_read_only,
  false AS installation_grants_partner_permission,
  false AS installation_enables_any_flag;
ROLLBACK;
