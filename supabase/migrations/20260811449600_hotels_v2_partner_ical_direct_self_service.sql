-- DRAFT MIGRATION / #190. DO NOT MERGE WITHOUT AUTHENTICATED DB + WORKER ACCEPTANCE.
-- Only adds a new versioned partner RPC. Public booking / payments remain OFF.
BEGIN;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='5s';

DO $precheck_114496$
DECLARE
  item record;
  v_oid oid;
  v_sha text;
BEGIN
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations
      WHERE version='20260811449300')<>1
    OR (SELECT count(*) FROM supabase_migrations.schema_migrations
      WHERE version='20260811449400')<>1 THEN
    RAISE EXCEPTION 'hotels_114496_predecessors_missing';
  END IF;
  IF to_regprocedure('public.hotel_v2_partner_apply_external_calendar_direct_114496(jsonb,uuid,uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'hotels_114496_already_installed';
  END IF;
  IF hotels_post_114493_private.catalog_epoch_is_exact_114493() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'hotels_114496_catalog_epoch_mismatch';
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('public.hotel_v2_external_calendar_apply_common_114493(text,jsonb,uuid,uuid,text)',
      '062355e3b34d98b3eeacff83cfc2f472b24eafe33dffe1a78bb5196a5dfc7a52'),
    ('public.hotel_v2_external_calendar_preview_common_114493(text,jsonb)',
      'f500acc85f39bbe0ccb8b62aa6c210f753cd0aadc7ce48f1a5fbfb00f4f2ce5d'),
    ('public.hotel_v2_external_calendar_control_common_114493(text,uuid,uuid)',
      'c0c62169383c97ead607f532a95096da55c03b5f5d1fe8d9736bbb2449398891')
  ) AS t(signature,expected_sha) LOOP
    v_oid:=to_regprocedure(item.signature);
    IF v_oid IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid=v_oid AND p.prosecdef
        AND p.proowner='postgres'::regrole
    ) THEN
      RAISE EXCEPTION 'hotels_114496_dependency_security_mismatch: %',item.signature;
    END IF;
    SELECT encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')
    INTO v_sha FROM pg_proc p WHERE p.oid=v_oid;
    IF v_sha IS DISTINCT FROM item.expected_sha THEN
      RAISE EXCEPTION 'hotels_114496_dependency_source_mismatch: %',item.signature;
    END IF;
  END LOOP;
END
$precheck_114496$;

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

  IF pg_catalog.jsonb_typeof(v_operation) IS DISTINCT FROM 'object'
    OR v_entity IS NULL OR v_action IS NULL
    OR NOT (
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

DO $postcheck_114496$
DECLARE v_oid oid;
BEGIN
  v_oid:=to_regprocedure('public.hotel_v2_partner_apply_external_calendar_direct_114496(jsonb,uuid,uuid,text)');
  IF v_oid IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid=v_oid AND p.prosecdef
      AND p.proowner='postgres'::regrole
      AND p.proconfig @> ARRAY['search_path=pg_catalog,public,auth']::text[]
  ) THEN
    RAISE EXCEPTION 'hotels_114496_post_function_security_mismatch';
  END IF;
  IF NOT has_function_privilege('authenticated',v_oid,'EXECUTE')
    OR has_function_privilege('anon',v_oid,'EXECUTE')
    OR has_function_privilege('service_role',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'hotels_114496_post_function_acl_mismatch';
  END IF;
  IF hotels_post_114493_private.catalog_epoch_is_exact_114493() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'hotels_114496_post_catalog_epoch_mismatch';
  END IF;
END
$postcheck_114496$;
COMMIT;
