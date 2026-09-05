\set ON_ERROR_STOP on

-- Focused, post-114450 payment-policy lineage validation.  The fixture must already
-- contain the production-shaped three-activity Admin H3.1 chain.

DO $baseline$
DECLARE
  v_hotel_id constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid;
  v_policy_id uuid;
  v_activity_count integer;
  v_policy_version bigint;
  v_term_1_methods text[];
  v_term_2_methods text[];
  v_promotion_snapshot jsonb;
  v_reviewed_target_fingerprint text;
  v_snapshot_source_hash text;
BEGIN
  SELECT p.id, p.version
    INTO STRICT v_policy_id, v_policy_version
  FROM public.hotel_payment_policies AS p
  WHERE p.hotel_id = v_hotel_id
    AND p.code = 'seven-kamares-request-confirmation';

  SELECT count(*)::integer
    INTO v_activity_count
  FROM public.hotel_activity_log AS a
  WHERE a.hotel_id = v_hotel_id
    AND a.entity_type = 'payment_policy'
    AND a.entity_id = v_policy_id
    AND a.source = 'hotels_v2_h3_1_admin_configuration';

  SELECT t.payment_methods
    INTO STRICT v_term_1_methods
  FROM public.hotel_payment_policy_terms AS t
  WHERE t.payment_policy_id = v_policy_id AND t.sequence = 1;

  SELECT t.payment_methods
    INTO STRICT v_term_2_methods
  FROM public.hotel_payment_policy_terms AS t
  WHERE t.payment_policy_id = v_policy_id AND t.sequence = 2;

  v_promotion_snapshot :=
    public.hotel_v2_h3_1p_pricing_promotion_snapshot(v_hotel_id);
  SELECT review.target_fingerprint
    INTO STRICT v_reviewed_target_fingerprint
  FROM public.hotel_pricing_promotion_reviews AS review
  WHERE review.hotel_id = v_hotel_id
    AND review.contract_version = 'seven_kamares_legacy_to_h3_pricing_v1'
    AND review.review_status = 'reviewed';
  SELECT encode(extensions.digest(convert_to(procedure_row.prosrc, 'UTF8'), 'sha256'), 'hex')
    INTO STRICT v_snapshot_source_hash
  FROM pg_catalog.pg_proc AS procedure_row
  WHERE procedure_row.oid =
    'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'::regprocedure;

  IF v_activity_count <> 3
     OR v_policy_version <> 3
     OR v_term_1_methods IS DISTINCT FROM ARRAY['bank_transfer', 'card', 'online']::text[]
     OR v_term_2_methods IS DISTINCT FROM ARRAY['bank_transfer', 'card', 'cash']::text[]
     OR v_promotion_snapshot ->> 'supported' IS DISTINCT FROM 'true'
     OR v_promotion_snapshot #>> '{target,target_fingerprint}'
          IS DISTINCT FROM v_reviewed_target_fingerprint
     OR v_snapshot_source_hash IS DISTINCT FROM
          '2fcbd3faf9deab53d06332141cb76ab383bf5e0d87fb4309478a8fbc431ae339'
     OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_external_calendar_provider_evolution_is_safe() IS DISTINCT FROM true
     OR public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'payment_policy_lineage_baseline_not_exact';
  END IF;
END
$baseline$;

CREATE TEMP TABLE payment_policy_lineage_lifecycle_before (
  hotel_external_sync_enabled boolean NOT NULL
) ON COMMIT PRESERVE ROWS;

INSERT INTO payment_policy_lineage_lifecycle_before (hotel_external_sync_enabled)
SELECT s.hotel_external_sync_enabled
FROM public.site_settings AS s
WHERE s.id = 1;

CREATE OR REPLACE FUNCTION pg_temp.seven_arches_payment_policy_post_provider_plan()
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
SELECT jsonb_build_object(
  'hotel_id', hotel.id,
  'expected_property_updated_at', hotel.updated_at,
  'reviewed_at', clock_timestamp(),
  'operations', jsonb_build_array(jsonb_build_object(
    'entity', 'payment_policy',
    'type', 'update',
    'id', policy.id,
    'expected_version', policy.version,
    'expected_children_fingerprint',
      public.hotel_v2_h3_1_payment_terms_fingerprint(policy.id),
    'payload', jsonb_build_object(
      'code', policy.code,
      'name_i18n', policy.name_i18n,
      'currency', policy.currency,
      'is_active', policy.is_active,
      'review_status', policy.review_status,
      'terms', jsonb_build_array(
        jsonb_build_object(
          'id', '38600000-0000-4000-8000-000000000008'::uuid,
          'sequence', 1,
          'due_event', 'after_partner_acceptance',
          'amount_mode', 'percent_total',
          'amount_value', 50,
          'recipient', 'partner',
          'payment_methods', jsonb_build_array('card', 'online'),
          'instructions_i18n', jsonb_build_object()
        ),
        jsonb_build_object(
          'id', '38600000-0000-4000-8000-000000000009'::uuid,
          'sequence', 2,
          'due_event', 'on_arrival',
          'amount_mode', 'remaining_balance',
          'amount_value', NULL,
          'recipient', 'partner',
          'payment_methods', jsonb_build_array('bank_transfer', 'cash'),
          'instructions_i18n', jsonb_build_object()
        )
      )
    )
  )))
FROM public.hotels AS hotel
JOIN public.hotel_payment_policies AS policy
  ON policy.id = '38600000-0000-4000-8000-000000000001'::uuid
WHERE hotel.id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
$function$;

REVOKE ALL ON FUNCTION pg_temp.seven_arches_payment_policy_post_provider_plan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pg_temp.seven_arches_payment_policy_post_provider_plan() TO authenticated;

BEGIN;

UPDATE public.site_settings
SET hotel_external_sync_enabled = false
WHERE id = 1;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '10000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

SELECT public.hotel_v2_admin_apply_h3_1_configuration(
  pg_temp.seven_arches_payment_policy_post_provider_plan(),
  '38610000-0000-4000-8000-000000000004'::uuid
);

RESET ROLE;

UPDATE public.site_settings AS s
SET hotel_external_sync_enabled = b.hotel_external_sync_enabled
FROM payment_policy_lineage_lifecycle_before AS b
WHERE s.id = 1;

COMMIT;

DROP FUNCTION pg_temp.seven_arches_payment_policy_post_provider_plan();

DO $post_reviewed_update$
DECLARE
  v_hotel_id constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid;
  v_policy_id uuid;
  v_activity_count integer;
  v_policy_version bigint;
  v_term_1_methods text[];
  v_term_2_methods text[];
  v_latest_matches boolean;
  v_admin_d jsonb;
  v_oracle jsonb;
  v_promotion_snapshot jsonb;
  v_reviewed_target_fingerprint text;
BEGIN
  SELECT p.id, p.version
    INTO STRICT v_policy_id, v_policy_version
  FROM public.hotel_payment_policies AS p
  WHERE p.hotel_id = v_hotel_id
    AND p.code = 'seven-kamares-request-confirmation';

  SELECT count(*)::integer
    INTO v_activity_count
  FROM public.hotel_activity_log AS a
  WHERE a.hotel_id = v_hotel_id
    AND a.entity_type = 'payment_policy'
    AND a.entity_id = v_policy_id
    AND a.source = 'hotels_v2_h3_1_admin_configuration';

  SELECT t.payment_methods
    INTO STRICT v_term_1_methods
  FROM public.hotel_payment_policy_terms AS t
  WHERE t.payment_policy_id = v_policy_id AND t.sequence = 1;

  SELECT t.payment_methods
    INTO STRICT v_term_2_methods
  FROM public.hotel_payment_policy_terms AS t
  WHERE t.payment_policy_id = v_policy_id AND t.sequence = 2;

  SELECT EXISTS (
    SELECT 1
    FROM public.hotel_activity_log AS a
    WHERE a.hotel_id = v_hotel_id
      AND a.entity_type = 'payment_policy'
      AND a.entity_id = v_policy_id
      AND a.source = 'hotels_v2_h3_1_admin_configuration'
      AND a.actor_type = 'admin'
      AND a.correlation_id = '38610000-0000-4000-8000-000000000004'::uuid
      AND (a.after_state ->> 'version')::bigint = v_policy_version
      AND a.after_state = (
        SELECT to_jsonb(p) || jsonb_build_object(
          'terms', (
            SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sequence, t.id)
            FROM public.hotel_payment_policy_terms AS t
            WHERE t.payment_policy_id = p.id
          )
        )
        FROM public.hotel_payment_policies AS p
        WHERE p.id = v_policy_id
      )
  ) INTO v_latest_matches;

  v_admin_d := public.hotel_v2_admin_d_current_foundation_snapshot();
  v_oracle := public.hotel_v2_seven_arches_reviewed_pricing_oracle();
  v_promotion_snapshot :=
    public.hotel_v2_h3_1p_pricing_promotion_snapshot(v_hotel_id);
  SELECT review.target_fingerprint
    INTO STRICT v_reviewed_target_fingerprint
  FROM public.hotel_pricing_promotion_reviews AS review
  WHERE review.hotel_id = v_hotel_id
    AND review.contract_version = 'seven_kamares_legacy_to_h3_pricing_v1'
    AND review.review_status = 'reviewed';

  IF v_activity_count <> 4
     OR v_policy_version <> 4
     OR v_term_1_methods IS DISTINCT FROM ARRAY['card', 'online']::text[]
     OR v_term_2_methods IS DISTINCT FROM ARRAY['bank_transfer', 'cash']::text[]
     OR v_latest_matches IS DISTINCT FROM true
     OR v_promotion_snapshot ->> 'supported' IS DISTINCT FROM 'true'
     OR v_promotion_snapshot #>> '{target,target_fingerprint}'
          IS DISTINCT FROM v_reviewed_target_fingerprint
     OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_external_calendar_provider_evolution_is_safe() IS DISTINCT FROM true
     OR public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact() IS DISTINCT FROM true
     OR (v_admin_d ->> 'safe')::boolean IS DISTINCT FROM true
     OR (v_oracle ->> 'core_case_count')::integer <> 100
     OR (v_oracle ->> 'core_mismatch_count')::integer <> 0
     OR (v_oracle ->> 'guest_one_case_count')::integer <> 20
     OR (v_oracle ->> 'guest_one_mismatch_count')::integer <> 0
     OR NOT EXISTS (
       SELECT 1
       FROM public.hotel_commission_policies AS c
       WHERE c.hotel_id = v_hotel_id
         AND c.is_active
         AND c.review_status = 'reviewed'
         AND c.commission_mode = 'per_allocated_room_per_night'
         AND c.amount = 10.00
         AND c.currency = 'EUR'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'payment_policy_lineage_post_114450_reviewed_update_not_exact';
  END IF;
END
$post_reviewed_update$;

CREATE TEMP TABLE payment_policy_lineage_negative_results (
  test_name text PRIMARY KEY
) ON COMMIT PRESERVE ROWS;

CREATE OR REPLACE FUNCTION pg_temp.payment_lineage_expect_false(
  p_test_name text,
  p_mutation_sql text,
  p_check_sql text DEFAULT
    'SELECT public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, hotels_v2_private, pg_temp
AS $function$
DECLARE
  v_safe boolean;
BEGIN
  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    EXECUTE p_mutation_sql;
    EXECUTE p_check_sql INTO v_safe;
    IF v_safe IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'payment_lineage_negative_not_rejected:%', p_test_name;
    END IF;
    RAISE EXCEPTION 'payment_lineage_negative_rollback';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'payment_lineage_negative_rollback' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO pg_temp.payment_policy_lineage_negative_results (test_name)
  VALUES (p_test_name);
END
$function$;

CREATE OR REPLACE FUNCTION pg_temp.payment_lineage_expect_sqlstate(
  p_test_name text,
  p_mutation_sql text,
  p_sqlstate text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, hotels_v2_private, pg_temp
AS $function$
DECLARE
  v_observed text;
BEGIN
  BEGIN
    EXECUTE p_mutation_sql;
    RAISE EXCEPTION 'payment_lineage_negative_missing_error:%', p_test_name;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_observed = RETURNED_SQLSTATE;
      IF SQLERRM LIKE 'payment_lineage_negative_missing_error:%'
         OR v_observed <> p_sqlstate THEN
        RAISE;
      END IF;
  END;

  INSERT INTO pg_temp.payment_policy_lineage_negative_results (test_name)
  VALUES (p_test_name);
END
$function$;

SELECT pg_temp.payment_lineage_expect_sqlstate(
  'unsupported_method_code',
  $mutation$
    UPDATE public.hotel_payment_policy_terms
    SET payment_methods = ARRAY['wire_crypto']::text[]
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$,
  '23514'
);

SELECT pg_temp.payment_lineage_expect_sqlstate(
  'duplicate_method_code',
  $mutation$
    UPDATE public.hotel_payment_policy_terms
    SET payment_methods = ARRAY['card', 'card']::text[]
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$,
  '23514'
);

SELECT pg_temp.payment_lineage_expect_false(
  'current_term_latest_activity_mismatch',
  $mutation$
    UPDATE public.hotel_payment_policy_terms
    SET payment_methods = ARRAY['bank_transfer', 'card']::text[]
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'latest_activity_current_term_mismatch',
  $mutation$
    UPDATE public.hotel_activity_log
    SET after_state = jsonb_set(
      after_state,
      '{terms,0,payment_methods}',
      '["bank_transfer","card"]'::jsonb
    )
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'wrong_activity_source',
  $mutation$
    UPDATE public.hotel_activity_log SET source = 'unreviewed_payment_configuration'
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'non_admin_activity_actor',
  $mutation$
    UPDATE public.hotel_activity_log SET actor_type = 'partner'
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_sqlstate(
  'missing_activity_correlation',
  $mutation$
    UPDATE public.hotel_activity_log SET correlation_id = NULL
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  $mutation$,
  '23502'
);

SELECT pg_temp.payment_lineage_expect_false(
  'broken_activity_state_chain',
  $mutation$
    UPDATE public.hotel_activity_log
    SET before_state = jsonb_set(before_state, '{version}', '99'::jsonb)
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'invalid_activity_version_progression',
  $mutation$
    UPDATE public.hotel_activity_log
    SET after_state = jsonb_set(after_state, '{version}', '99'::jsonb)
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'unmatched_term_recreation',
  $mutation$
    UPDATE public.hotel_activity_log
    SET after_state = jsonb_set(
      after_state,
      '{terms,0,id}',
      to_jsonb('3861f269-a50f-4aa0-9804-999999999999'::text)
    )
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'direct_raw_table_method_mutation',
  $mutation$
    UPDATE public.hotel_payment_policy_terms
    SET payment_methods = ARRAY['bank_transfer']::text[]
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 2
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'accepted_code_added_without_activity',
  $mutation$
    UPDATE public.hotel_payment_policy_terms
    SET payment_methods = ARRAY['bank_transfer', 'card', 'online']::text[]
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'method_removed_without_activity',
  $mutation$
    UPDATE public.hotel_payment_policy_terms
    SET payment_methods = ARRAY['online']::text[]
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'term_count_change',
  $mutation$
    INSERT INTO public.hotel_payment_policy_terms (
      id, hotel_id, payment_policy_id, sequence, due_event, amount_mode, amount_value,
      recipient, payment_methods, version
    ) VALUES (
      '3861f269-a50f-4aa0-9804-999999999997'::uuid,
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
      (SELECT id FROM public.hotel_payment_policies
       WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
      3, 'on_arrival', 'remaining_balance', NULL,
      'partner', ARRAY['cash']::text[], 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_sqlstate(
  'duplicate_term_sequence',
  $mutation$
    INSERT INTO public.hotel_payment_policy_terms (
      id, hotel_id, payment_policy_id, sequence, due_event, amount_mode, amount_value,
      recipient, payment_methods, version
    ) VALUES (
      '3861f269-a50f-4aa0-9804-999999999998'::uuid,
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
      (SELECT id FROM public.hotel_payment_policies
       WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
      1, 'after_partner_acceptance', 'percent_total', 50,
      'partner', ARRAY['card']::text[], 1
    )
  $mutation$,
  '23505'
);

SELECT pg_temp.payment_lineage_expect_false(
  'fixed_due_event_change',
  $mutation$
    UPDATE public.hotel_payment_policy_terms SET due_event = 'before_arrival'
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'fixed_amount_mode_change',
  $mutation$
    UPDATE public.hotel_payment_policy_terms SET amount_mode = 'flat'
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'fixed_amount_value_change',
  $mutation$
    UPDATE public.hotel_payment_policy_terms SET amount_value = 51
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'fixed_recipient_change',
  $mutation$
    UPDATE public.hotel_payment_policy_terms SET recipient = 'platform'
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'policy_code_change',
  $mutation$
    UPDATE public.hotel_payment_policies SET code = 'unexpected-policy'
    WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'policy_status_change',
  $mutation$
    UPDATE public.hotel_payment_policies
    SET is_active = false, review_status = 'requires_review'
    WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'policy_currency_change',
  $mutation$
    UPDATE public.hotel_payment_policies SET currency = 'GBP'
    WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'commission_mode_change',
  $mutation$
    UPDATE public.hotel_commission_policies
    SET commission_mode = 'percent_booking_total'
    WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid AND is_active
  $mutation$,
  'SELECT public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
);

SELECT pg_temp.payment_lineage_expect_false(
  'commission_amount_change',
  $mutation$
    UPDATE public.hotel_commission_policies SET amount = 11.00
    WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid AND is_active
  $mutation$,
  'SELECT public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
);

SELECT pg_temp.payment_lineage_expect_false(
  'commission_currency_change',
  $mutation$
    UPDATE public.hotel_commission_policies SET currency = 'GBP'
    WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid AND is_active
  $mutation$,
  'SELECT public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
);

SELECT pg_temp.payment_lineage_expect_false(
  'commission_status_change',
  $mutation$
    UPDATE public.hotel_commission_policies
    SET is_active = false, review_status = 'requires_review'
    WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid AND is_active
  $mutation$,
  'SELECT public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
);

SELECT pg_temp.payment_lineage_expect_false(
  'payment_support_helper_source_drift',
  $mutation$
    CREATE OR REPLACE FUNCTION public.hotel_v2_h3_1_codes_valid(p_codes text[])
    RETURNS boolean
    LANGUAGE sql
    IMMUTABLE
    SET search_path = pg_catalog
    AS 'SELECT false'
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'accepted_writer_source_drift',
  $mutation$
    CREATE OR REPLACE FUNCTION public.hotel_v2_admin_apply_h3_1_configuration(
      p_plan jsonb,
      p_correlation_id uuid DEFAULT gen_random_uuid()
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    VOLATILE
    SECURITY DEFINER
    SET search_path = pg_catalog, public, auth
    AS $drift$
    BEGIN
      RETURN '{}'::jsonb;
    END
    $drift$
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'accepted_writer_security_drift',
  $mutation$
    ALTER FUNCTION public.hotel_v2_admin_apply_h3_1_configuration(jsonb, uuid)
    SECURITY INVOKER
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'payment_constraint_drift',
  $mutation$
    ALTER TABLE public.hotel_payment_policy_terms
    DROP CONSTRAINT hotel_payment_policy_terms_sequence_check
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'payment_trigger_drift',
  $mutation$
    DO $trigger_case$
    DECLARE
      v_trigger_name name;
    BEGIN
      SELECT t.tgname
        INTO STRICT v_trigger_name
      FROM pg_catalog.pg_trigger AS t
      WHERE t.tgrelid = 'public.hotel_payment_policy_terms'::regclass
        AND NOT t.tgisinternal
      ORDER BY t.tgname
      LIMIT 1;
      EXECUTE format(
        'ALTER TABLE public.hotel_payment_policy_terms DISABLE TRIGGER %I',
        v_trigger_name
      );
    END
    $trigger_case$
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'payment_rls_drift',
  $mutation$
    ALTER TABLE public.hotel_payment_policy_terms DISABLE ROW LEVEL SECURITY
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'payment_raw_acl_drift',
  $mutation$
    GRANT UPDATE ON public.hotel_payment_policy_terms TO authenticated
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'activity_raw_acl_drift',
  $mutation$
    GRANT UPDATE ON public.hotel_activity_log TO authenticated
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'activity_evidence_deletion',
  $mutation$
    DELETE FROM public.hotel_activity_log
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at, id OFFSET 1 LIMIT 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'activity_evidence_action_mutation',
  $mutation$
    UPDATE public.hotel_activity_log SET action = 'create'
    WHERE id = (
      SELECT id FROM public.hotel_activity_log
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        AND entity_type = 'payment_policy'
        AND source = 'hotels_v2_h3_1_admin_configuration'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'new_executable_payment_method_consumer',
  $mutation$
    CREATE FUNCTION public.hotel_v2_test_executable_payment_method_consumer()
    RETURNS text[]
    LANGUAGE sql
    STABLE
    SET search_path = pg_catalog, public
    AS 'SELECT payment_methods FROM public.hotel_payment_policy_terms ORDER BY sequence LIMIT 1'
  $mutation$
);

SELECT pg_temp.payment_lineage_expect_false(
  'payment_mutation_during_protected_state',
  $mutation$
    UPDATE public.hotel_payment_policy_terms SET amount_value = 49
    WHERE payment_policy_id = (
      SELECT id FROM public.hotel_payment_policies
      WHERE hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    ) AND sequence = 1
  $mutation$,
  'SELECT public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
);

DO $final$
DECLARE
  v_negative_count integer;
BEGIN
  SELECT count(*)::integer
    INTO v_negative_count
  FROM pg_temp.payment_policy_lineage_negative_results;

  IF v_negative_count <> 38
     OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact() IS DISTINCT FROM true
     OR public.hotel_v2_external_calendar_provider_evolution_is_safe() IS DISTINCT FROM true
     OR (public.hotel_v2_admin_d_current_foundation_snapshot() ->> 'safe')::boolean
          IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = format(
        'payment_policy_lineage_negative_gate_not_exact:%s/38',
        v_negative_count
      );
  END IF;
END
$final$;

SELECT
  'HOTELS_V2_7A_PAYMENT_POLICY_LINEAGE_GATE_PASS'::text AS sentinel,
  2::integer AS positive_count,
  count(*)::integer AS negative_count,
  true AS reviewed_post_114450_method_update_safe,
  true AS rollback_containment
FROM pg_temp.payment_policy_lineage_negative_results;
