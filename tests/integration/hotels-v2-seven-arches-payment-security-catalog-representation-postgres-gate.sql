\set ON_ERROR_STOP on

-- Focused, post-114450 validation for the representation-stable payment
-- relation/policy security contract.  Every catalog mutation is contained in
-- a PL/pgSQL subtransaction and is rolled back before the next case.

CREATE TEMP TABLE payment_security_catalog_positive_results (
  test_name text PRIMARY KEY
) ON COMMIT PRESERVE ROWS;

CREATE TEMP TABLE payment_security_catalog_negative_results (
  test_name text PRIMARY KEY
) ON COMMIT PRESERVE ROWS;

CREATE OR REPLACE FUNCTION pg_temp.payment_security_catalog_expect_true(
  p_test_name text,
  p_mutation_sql text[]
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_statement text;
BEGIN
  BEGIN
    FOREACH v_statement IN ARRAY p_mutation_sql LOOP
      EXECUTE v_statement;
    END LOOP;

    IF public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
         IS DISTINCT FROM true THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'payment_security_representation_positive_rejected:' || p_test_name;
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'payment_security_representation_positive_rollback:' || p_test_name;
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM IS DISTINCT FROM
           'payment_security_representation_positive_rollback:' || p_test_name THEN
        RAISE;
      END IF;
  END;

  IF public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'payment_security_representation_positive_leaked:' || p_test_name;
  END IF;

  INSERT INTO pg_temp.payment_security_catalog_positive_results (test_name)
  VALUES (p_test_name);
END
$function$;

CREATE OR REPLACE FUNCTION pg_temp.payment_security_catalog_expect_false(
  p_test_name text,
  p_mutation_sql text[]
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_statement text;
BEGIN
  BEGIN
    FOREACH v_statement IN ARRAY p_mutation_sql LOOP
      EXECUTE v_statement;
    END LOOP;

    IF public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
         IS DISTINCT FROM false THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'payment_security_contract_negative_not_rejected:' || p_test_name;
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'payment_security_contract_negative_rollback:' || p_test_name;
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM IS DISTINCT FROM
           'payment_security_contract_negative_rollback:' || p_test_name THEN
        RAISE;
      END IF;
  END;

  IF public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'payment_security_contract_negative_leaked:' || p_test_name;
  END IF;

  INSERT INTO pg_temp.payment_security_catalog_negative_results (test_name)
  VALUES (p_test_name);
END
$function$;

DO $baseline$
BEGIN
  IF public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'payment_security_catalog_baseline_not_exact';
  END IF;

  INSERT INTO pg_temp.payment_security_catalog_positive_results (test_name)
  VALUES ('production_shaped_child_contract');
END
$baseline$;

-- An owner's effective privileges do not depend on whether the default owner
-- ACL is materialized in relacl.  Both physical representations are accepted.
SELECT pg_temp.payment_security_catalog_expect_true(
  'implicit_default_owner_acl_representation',
  ARRAY[
    'REVOKE ALL PRIVILEGES ON TABLE public.hotel_activity_log FROM postgres',
    'REVOKE ALL PRIVILEGES ON TABLE public.hotel_payment_policies FROM postgres',
    'REVOKE ALL PRIVILEGES ON TABLE public.hotel_payment_policy_terms FROM postgres'
  ]
);

SELECT pg_temp.payment_security_catalog_expect_true(
  'explicit_owner_acl_representation',
  ARRAY[
    'GRANT ALL PRIVILEGES ON TABLE public.hotel_activity_log TO postgres WITH GRANT OPTION',
    'GRANT ALL PRIVILEGES ON TABLE public.hotel_payment_policies TO postgres WITH GRANT OPTION',
    'GRANT ALL PRIVILEGES ON TABLE public.hotel_payment_policy_terms TO postgres WITH GRANT OPTION'
  ]
);

-- Revoke and rebuild the exact non-owner grants in a deliberately different
-- statement order.  The semantic ACL set, not aclitem storage order, controls.
SELECT pg_temp.payment_security_catalog_expect_true(
  'physical_acl_item_order_independent',
  ARRAY[
    'REVOKE SELECT, INSERT ON TABLE public.hotel_activity_log FROM service_role',
    'REVOKE SELECT ON TABLE public.hotel_payment_policies FROM service_role',
    'REVOKE SELECT ON TABLE public.hotel_payment_policy_terms FROM service_role',
    'GRANT SELECT ON TABLE public.hotel_payment_policy_terms TO service_role',
    'GRANT INSERT ON TABLE public.hotel_activity_log TO service_role',
    'GRANT SELECT ON TABLE public.hotel_payment_policies TO service_role',
    'GRANT SELECT ON TABLE public.hotel_activity_log TO service_role'
  ]
);

-- Redundant parentheses and explicit public qualification can deparse
-- differently across accepted catalogs but retain the exact function-backed
-- Admin predicate and dependency.
SELECT pg_temp.payment_security_catalog_expect_true(
  'canonical_policy_deparse_representation',
  ARRAY[
    'DROP POLICY hotel_activity_log_admin_select ON public.hotel_activity_log',
    'DROP POLICY hotel_payment_policies_admin_select ON public.hotel_payment_policies',
    'DROP POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms',
    'CREATE POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms AS PERMISSIVE FOR SELECT TO authenticated USING (((public.is_current_user_admin())))',
    'CREATE POLICY hotel_activity_log_admin_select ON public.hotel_activity_log AS PERMISSIVE FOR SELECT TO authenticated USING (((public.is_current_user_admin())))',
    'CREATE POLICY hotel_payment_policies_admin_select ON public.hotel_payment_policies AS PERMISSIVE FOR SELECT TO authenticated USING (((public.is_current_user_admin())))'
  ]
);

-- PostgreSQL retains a repeated role token in pg_policy.polroles even though
-- the effective role set is unchanged.  Canonical comparison treats roles as
-- a sorted set and still requires that its sole member is authenticated.
SELECT pg_temp.payment_security_catalog_expect_true(
  'canonical_policy_role_set_representation',
  ARRAY[
    'DROP POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms',
    'CREATE POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms AS PERMISSIVE FOR SELECT TO authenticated, authenticated USING (public.is_current_user_admin())'
  ]
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'additional_service_role_dml_privilege',
  ARRAY['GRANT UPDATE ON TABLE public.hotel_payment_policy_terms TO service_role']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'removed_service_role_privilege',
  ARRAY['REVOKE SELECT ON TABLE public.hotel_payment_policies FROM service_role']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'wrong_authenticated_grantee',
  ARRAY['GRANT SELECT ON TABLE public.hotel_payment_policies TO authenticated']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'changed_grantable_state',
  ARRAY['GRANT SELECT ON TABLE public.hotel_payment_policies TO service_role WITH GRANT OPTION']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'unauthorized_public_grant',
  ARRAY['GRANT SELECT ON TABLE public.hotel_payment_policies TO PUBLIC']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'unauthorized_anon_grant',
  ARRAY['GRANT SELECT ON TABLE public.hotel_payment_policies TO anon']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'unauthorized_authenticated_dml',
  ARRAY['GRANT UPDATE ON TABLE public.hotel_payment_policies TO authenticated']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'relation_owner_drift',
  ARRAY['ALTER TABLE public.hotel_payment_policy_terms OWNER TO service_role']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'relation_rls_disabled',
  ARRAY['ALTER TABLE public.hotel_payment_policy_terms DISABLE ROW LEVEL SECURITY']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'relation_force_rls_enabled',
  ARRAY['ALTER TABLE public.hotel_payment_policy_terms FORCE ROW LEVEL SECURITY']
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'admin_select_policy_missing',
  ARRAY[
    'DROP POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms'
  ]
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'unexpected_extra_policy',
  ARRAY[
    'CREATE POLICY hotel_payment_policy_terms_unexpected_select ON public.hotel_payment_policy_terms FOR SELECT TO authenticated USING (public.is_current_user_admin())'
  ]
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'policy_command_drift',
  ARRAY[
    'DROP POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms',
    'CREATE POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms FOR UPDATE TO authenticated USING (public.is_current_user_admin())'
  ]
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'policy_role_drift',
  ARRAY[
    'DROP POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms',
    'CREATE POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms FOR SELECT TO service_role USING (public.is_current_user_admin())'
  ]
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'policy_predicate_drift',
  ARRAY[
    'DROP POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms',
    'CREATE POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms FOR SELECT TO authenticated USING (false)'
  ]
);

SELECT pg_temp.payment_security_catalog_expect_false(
  'policy_permissive_restrictive_drift',
  ARRAY[
    'DROP POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms',
    'CREATE POLICY hotel_payment_policy_terms_admin_select ON public.hotel_payment_policy_terms AS RESTRICTIVE FOR SELECT TO authenticated USING (public.is_current_user_admin())'
  ]
);

DO $final$
DECLARE
  v_positive_count integer;
  v_negative_count integer;
  v_relation_child_count integer;
  v_policy_child_count integer;
BEGIN
  SELECT count(*)::integer
    INTO v_positive_count
  FROM pg_temp.payment_security_catalog_positive_results;

  SELECT count(*)::integer
    INTO v_negative_count
  FROM pg_temp.payment_security_catalog_negative_results;

  SELECT count(*)::integer
    INTO v_relation_child_count
  FROM pg_catalog.pg_class AS relation_row
  WHERE relation_row.oid = ANY (ARRAY[
    'public.hotel_activity_log'::regclass,
    'public.hotel_payment_policies'::regclass,
    'public.hotel_payment_policy_terms'::regclass
  ])
    AND relation_row.relowner = 'postgres'::regrole
    AND relation_row.relrowsecurity
    AND NOT relation_row.relforcerowsecurity;

  SELECT count(*)::integer
    INTO v_policy_child_count
  FROM pg_catalog.pg_policy AS policy_row
  WHERE (policy_row.polrelid, policy_row.polname) IN (
    ('public.hotel_activity_log'::regclass, 'hotel_activity_log_admin_select'),
    ('public.hotel_payment_policies'::regclass, 'hotel_payment_policies_admin_select'),
    ('public.hotel_payment_policy_terms'::regclass,
      'hotel_payment_policy_terms_admin_select')
  );

  IF v_positive_count <> 6
     OR v_negative_count <> 16
     OR v_relation_child_count <> 3
     OR v_policy_child_count <> 3
     OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
          IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = format(
        'payment_security_catalog_representation_gate_not_exact:%s/6:%s/16:%s/3:%s/3',
        v_positive_count,
        v_negative_count,
        v_relation_child_count,
        v_policy_child_count
      );
  END IF;
END
$final$;

SELECT
  'HOTELS_V2_7A_PAYMENT_SECURITY_CATALOG_REPRESENTATION_GATE_PASS'::text
    AS sentinel,
  (SELECT count(*)::integer
   FROM pg_temp.payment_security_catalog_positive_results) AS positive_count,
  (SELECT count(*)::integer
   FROM pg_temp.payment_security_catalog_negative_results) AS negative_count,
  3::integer AS relation_child_count,
  3::integer AS policy_child_count,
  true AS rollback_containment;
