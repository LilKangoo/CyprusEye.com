BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- Supplement to the existing stage verifier. Prepared only, never seals/replays a stage.
DO $source_pins$
BEGIN
 IF EXISTS(SELECT 1 FROM (VALUES
  ('hotels_lineage_private.successor_manifest(integer)','cece5beeeec9d0bb1e72a9851f095792834010246f791445a5185c06e1298500'),
  ('hotels_lineage_private.successor_metadata(oid)','b332ed3e26a761f855d8ef6a005667f57938738633f4c0c22b5ee0718d026ebb'),
  ('hotels_lineage_private.successor_binding_pin(jsonb)','d9fff1cd2a8eebb20670daa5a4ae33472f8a76a2f0b8be2dcb8b80f3018e038c'),
  ('hotels_lineage_private.successors_are_exact(text)','c9b0de4a528547f1555d29e96530c552f8a827c83b50c65985d4dd75e415ce07'),
  ('hotels_lineage_private.predecessor(oid)','36e662d92c41f3b3474f41fc0094c33ba049006769c6403254d0f185a2f1d087'),
  ('hotels_lineage_private.predecessor_definition_hash(oid)','17cf79369b87f8d42d603176badec258f56feeac7fc833cd479b413c732dd0da'),
  ('hotels_lineage_private.predecessor_source_hash(oid)','5af87a938445ef7db28016ad5de01e397dd93c4dc32f548940fd0866e595eb96'),
  ('hotels_lineage_private.successor_boundary_is_exact(integer,boolean)','74c84408a1c4e4d96aca8aeeb3b1d3216176bebbf3184b0ef77432233f868cfb'),
  ('hotels_lineage_private.seal_successor(integer)','cb6e8f25862fa9474c7f7b0c3d3fe699a6ffb578665c89d421b9d7da7f58c9d6'),
  ('hotels_lineage_private.permission_evidence()','6b59caafd6caa96a5df5c107910e3ce3dd5eb8776201e4e8e72aa3cb9bf365bc'),
  ('hotels_lineage_private.function_map()','fb0fac6e627924bbefe4d302ab885499cc1897bac1548012b4bbb1dcafed5a54'),
  ('hotels_lineage_private.current_anchor_is_exact()','9640721b8192e8e60d983dd2115ee31a856d3afda150e7a68361d1a37e10a031'),
  ('hotels_lineage_private.lineage_matches_historical(jsonb)','71a29e0880a00f5697a45b787009d8f8673f59a1267d40021bb4b8c38fbcc8dc'),
  ('hotels_lineage_private.owner_constraint_tokens(text)','71b5fc65cefe575c1069bdd8e1a7d7c1a953c3e7614db0f38f0dc4270d315f66'),
  ('hotels_lineage_private.catalog_is_exact(jsonb,jsonb)','4767d2844cfd78f1ca6661c8bc2d756e3a1158985445b00c6b17524aa350419f')
 ) expected(signature,source_sha)
 LEFT JOIN pg_proc actual ON actual.oid=to_regprocedure(expected.signature)
 WHERE actual.oid IS NULL OR actual.proowner IS DISTINCT FROM 'postgres'::regrole
 OR encode(extensions.digest(actual.prosrc,'sha256'),'hex') IS DISTINCT FROM expected.source_sha)
 THEN RAISE EXCEPTION 'hotels_lineage_private_source_pin_mismatch'; END IF;
END $source_pins$;
DO $successor$
DECLARE root_hash text;
BEGIN
 SELECT evidence_hash INTO STRICT root_hash FROM hotels_lineage_private.reconciliation_receipts;
 IF (SELECT count(*) FROM hotels_lineage_private.successor_receipts)<>2
 OR (SELECT array_agg(stage ORDER BY stage) FROM hotels_lineage_private.successor_receipts)
    IS DISTINCT FROM ARRAY[114450,114480]
 OR hotels_lineage_private.successors_are_exact(root_hash) IS NOT TRUE
 OR hotels_lineage_private.successor_boundary_is_exact(114480,true) IS NOT TRUE
 OR hotels_lineage_private.current_anchor_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NULL
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 OR to_regnamespace('hotels_lifecycle_private') IS NULL
 THEN RAISE EXCEPTION 'hotels_114480_successor_certificate_mismatch'; END IF;
END $successor$;
SELECT 'HOTELS_114480_SUCCESSOR_CERTIFICATE_OK' AS sentinel,
 current_setting('transaction_read_only') AS transaction_read_only,
 2 AS successor_receipt_count,true AS exact_stage_set,true AS before_after_pins_exact,
 true AS predecessor_and_receipt_hashes_exact,true AS immutable_security_exact,
 true AS current_catalog_and_sources_exact,false AS next_write_authorized;
ROLLBACK;
