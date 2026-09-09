BEGIN;
SET TRANSACTION READ ONLY;
DO $physical$
DECLARE a jsonb; b jsonb; ci integer; cj integer; constraint_oid oid;
 qualified_expression text; qualified_definition text; visible_expression text; visible_definition text;
BEGIN
 IF current_database() !~ '^hotels_114416_' OR inet_server_port()<>55479
 OR host(inet_server_addr())<>'127.0.0.1' THEN RAISE EXCEPTION 'local_fixture_required'; END IF;
 a:=public.hotel_v2_seven_arches_independent_pricing_activation_lineage()->'lower_catalog';
 SELECT (n-1)::integer INTO STRICT ci FROM jsonb_array_elements(a) WITH ORDINALITY x(v,n)
  WHERE v->>'relation'='availability_foundation_evolution_receipts';
 SELECT (n-1)::integer INTO STRICT cj FROM jsonb_array_elements(a->ci->'constraints') WITH ORDINALITY x(v,n)
  WHERE v->>'name'='hotel_admin_availability_evolution_owner_membership_exact';
 SELECT oid INTO STRICT constraint_oid FROM pg_constraint
  WHERE conrelid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass
   AND conname='hotel_admin_availability_evolution_owner_membership_exact' AND convalidated;
 -- These are two real PostgreSQL deparses of the SAME physical constraint
 -- and dependency OID. No expression is fabricated with text replacement.
 PERFORM set_config('search_path','pg_catalog, public',true);
 SELECT pg_get_expr(conbin,conrelid),pg_get_constraintdef(oid)
  INTO qualified_expression,qualified_definition FROM pg_constraint WHERE oid=constraint_oid;
 PERFORM set_config('search_path','pg_catalog, extensions, public',true);
 SELECT pg_get_expr(conbin,conrelid),pg_get_constraintdef(oid)
  INTO visible_expression,visible_definition FROM pg_constraint WHERE oid=constraint_oid;
 PERFORM set_config('search_path','pg_catalog, public',true);
 IF qualified_expression=visible_expression OR qualified_definition=visible_definition
  OR position('extensions.digest(' IN qualified_expression)=0
  OR position('extensions.digest(' IN visible_expression)<>0
  OR position('digest(' IN visible_expression)=0
 THEN RAISE EXCEPTION 'physical_qualification_difference_not_reproduced'; END IF;
 a:=jsonb_set(jsonb_set(a,ARRAY[ci::text,'constraints',cj::text,'expression'],to_jsonb(qualified_expression)),
  ARRAY[ci::text,'constraints',cj::text,'definition'],to_jsonb(qualified_definition));
 b:=jsonb_set(jsonb_set(a,ARRAY[ci::text,'constraints',cj::text,'expression'],to_jsonb(visible_expression)),
  ARRAY[ci::text,'constraints',cj::text,'definition'],to_jsonb(visible_definition));
 IF a=b OR hotels_lineage_private.catalog_is_exact(a,b) IS NOT TRUE
  OR hotels_lineage_private.catalog_is_exact(b,a) IS NOT TRUE
 THEN RAISE EXCEPTION 'physical_qualification_comparison_failed'; END IF;
 -- A changed digest algorithm is not qualification-only, in either spelling.
 IF hotels_lineage_private.catalog_is_exact(a,jsonb_set(b,
   ARRAY[ci::text,'constraints',cj::text,'expression'],to_jsonb(replace(visible_expression,'''sha256''','''sha512'''))))
 THEN RAISE EXCEPTION 'physical_semantic_negative_accepted'; END IF;
END $physical$;
SELECT 'PHYSICAL_POSTGRES_QUALIFICATION_VARIANTS_PASS' AS sentinel,
 current_setting('transaction_read_only') AS transaction_read_only,
 true AS same_physical_constraint_and_digest_dependency,
 2 AS accepted_directions,1 AS semantic_negative_rejected;
ROLLBACK;
