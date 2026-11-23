-- REVIEW-ONLY CANDIDATE. DO NOT APPLY TO PRODUCTION.
-- This file lives under docs/, NOT supabase/migrations/.
-- Owner request: assigned Partner may connect own Airbnb / Booking.com / ICS
-- without per-calendar Admin approval. Requires independent auth, URL, worker,
-- replay, receipt, and catalog-seal testing before a migration is approved.
--
-- References: reviewed 114493 source, issue #179, issue #175.
-- Partner preview still uses:
--   public.hotel_v2_partner_preview_external_calendar_plan_114493(jsonb)
-- Direct application below intentionally bypasses ONLY the provider-proposal
-- queue, NOT the reviewed plan, auth, permission snapshot, source guards,
-- audit log, Vault, transaction or idempotency checks.
--
-- IMPLEMENTATION DRAFT; HAS NOT BEEN INSTALLED OR EXECUTED.
CREATE FUNCTION public.hotel_v2_partner_apply_external_calendar_direct_114496(
  p_reviewed_plan jsonb,
  p_correlation_id uuid,
  p_idempotency_key uuid,
  p_ical_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_operations jsonb;
  v_operation jsonb;
  v_entity text;
  v_action text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE='42501',
      MESSAGE='hotels_v2_calendar_direct_auth_required_114496';
  END IF;

  IF p_reviewed_plan IS NULL
    OR pg_catalog.jsonb_typeof(p_reviewed_plan) <> 'object'
    OR NOT (p_reviewed_plan ? 'operations')
    OR pg_catalog.jsonb_typeof(p_reviewed_plan->'operations') <> 'array'
    OR pg_catalog.jsonb_array_length(p_reviewed_plan->'operations') <> 1
    OR p_correlation_id IS NULL
    OR p_idempotency_key IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE='22023',
      MESSAGE='hotels_v2_calendar_direct_invalid_plan_114496';
  END IF;

  v_operations := p_reviewed_plan->'operations';
  v_operation := v_operations->0;
  v_entity := v_operation->>'entity';
  v_action := v_operation->>'action';

  IF NOT (
       (v_entity='calendar_source' AND v_action IN('create','update','enable','disable'))
    OR (v_entity='ical_secret' AND v_action IN('set','rotate','clear'))
    OR (v_entity='calendar_sync' AND v_action='trigger')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE='42501',
      MESSAGE='hotels_v2_calendar_direct_action_denied_114496';
  END IF;

  IF ((v_entity='ical_secret' AND v_action IN('set','rotate'))
      IS DISTINCT FROM (p_ical_url IS NOT NULL)) THEN
    RAISE EXCEPTION USING
      ERRCODE='22023',
      MESSAGE='hotels_v2_calendar_direct_url_scope_invalid_114496';
  END IF;

  -- Critical: preserve the reviewed 114493 partner path. It validates
  -- auth.uid(), assignment, manage_availability, room scope,
  -- review fingerprint, current snapshot, versions, concurrency,
  -- secure Vault binding, receipts, audit and idempotency.
  RETURN public.hotel_v2_external_calendar_apply_common_114493(
    'partner',
    p_reviewed_plan,
    p_correlation_id,
    p_idempotency_key,
    p_ical_url
  );
END
$function$;

ALTER FUNCTION public.hotel_v2_partner_apply_external_calendar_direct_114496(
  jsonb,uuid,uuid,text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.hotel_v2_partner_apply_external_calendar_direct_114496(
  jsonb,uuid,uuid,text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.hotel_v2_partner_apply_external_calendar_direct_114496(
  jsonb,uuid,uuid,text
) TO authenticated;

-- END OF DRAFT. Do not promote without end-to-end negative auth, staged
-- source/create -> secret/set -> enable -> sync/trigger and catalog proof.
