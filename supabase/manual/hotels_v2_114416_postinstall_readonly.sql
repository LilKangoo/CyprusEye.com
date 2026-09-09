BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- Prepared only; no timeout override, mutation RPC, DDL, DML or acquired lock.
-- Anonymous blocks contain SELECT/IF/RAISE only; any failed predicate aborts.
DO $history$
BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
  RAISE EXCEPTION 'hotels_114416_history_missing'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['20260811435000','20260811436000','20260811437000',
  '20260811440000','20260811440500','20260811440600','20260811440700','20260811441000','20260811441500']) expected(version)
  WHERE (SELECT count(*) FROM supabase_migrations.schema_migrations recorded WHERE recorded.version::text=expected.version)<>1)
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version::text IN
  ('20260811442000','20260811442500','20260811445000','20260811446000','20260811447000','20260811448000'))
 OR (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version::text='20260811441600')>1
 THEN RAISE EXCEPTION 'hotels_114416_history_boundary_mismatch'; END IF;
END $history$;
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
DO $postinstall$
BEGIN
 IF to_regnamespace('hotels_lineage_private') IS NULL
 OR to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') IS NOT NULL
 OR to_regnamespace('hotels_lifecycle_private') IS NOT NULL
 OR (SELECT count(*) FROM hotels_lineage_private.reconciliation_receipts)<>1
 OR EXISTS(SELECT 1 FROM hotels_lineage_private.successor_receipts)
 OR hotels_lineage_private.current_anchor_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NULL
 OR public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114416_postinstall_boundary_mismatch'; END IF;
END $postinstall$;
DO $commercial_and_maintenance$
DECLARE oracle jsonb;
BEGIN
 oracle:=public.hotel_v2_seven_arches_reviewed_pricing_oracle();
 IF (oracle->>'core_case_count')::integer IS DISTINCT FROM 100
 OR (oracle->>'core_mismatch_count')::integer IS DISTINCT FROM 0
 OR (oracle->>'guest_one_case_count')::integer IS DISTINCT FROM 20
 OR (oracle->>'guest_one_mismatch_count')::integer IS DISTINCT FROM 0
 OR public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 OR NOT EXISTS(SELECT 1 FROM public.site_settings WHERE id=1 AND hotel_rooms_v2_enabled IS FALSE
  AND hotel_external_sync_enabled IS TRUE AND hotel_instant_booking_enabled IS FALSE AND hotel_stripe_connect_enabled IS FALSE)
 OR NOT EXISTS(SELECT 1 FROM public.hotels WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND architecture_version='legacy')
 OR (SELECT count(*) FROM public.hotel_seven_arches_independent_pricing_authority)<>54
 OR (SELECT count(*) FROM public.hotel_room_rates WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
  AND id IN('7e420964-9cbf-4f1b-abd3-09840af5240f','3320590d-632d-423f-80d0-fd021cba7293')
  AND base_nightly_rate=100 AND currency='EUR' AND is_active AND review_status='reviewed')<>2
 OR NOT EXISTS(SELECT 1 FROM public.hotel_commission_policies WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
  AND commission_mode='per_allocated_room_per_night' AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed')
 THEN RAISE EXCEPTION 'hotels_114416_commercial_boundary_mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.hotel_seven_arches_reviewed_pricing_transaction_context)
 OR EXISTS(SELECT 1 FROM public.hotel_seven_arches_pricing_activation_transaction_context)
 OR EXISTS(SELECT 1 FROM hotels_v2_private.hotel_external_calendar_sync_jobs
  WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND status IN('queued','leased','running'))
 OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND backend_type='client backend'
  AND xact_start<statement_timestamp()-interval '5 minutes')
 OR EXISTS(SELECT 1 FROM pg_locks lock_row JOIN pg_class relation_row ON relation_row.oid=lock_row.relation
  JOIN pg_namespace namespace_row ON namespace_row.oid=relation_row.relnamespace
  WHERE lock_row.pid<>pg_backend_pid() AND namespace_row.nspname IN('public','hotels_v2_private')
   AND (relation_row.relname LIKE 'hotel%' OR relation_row.relname IN('partners','partner_users','partner_resources','partner_user_resources','site_settings'))
   AND lock_row.mode<>'AccessShareLock')
 THEN RAISE EXCEPTION 'hotels_114416_maintenance_blocker'; END IF;
END $commercial_and_maintenance$;
SELECT 'HOTELS_114416_POSTINSTALL_OK' AS sentinel,current_setting('transaction_read_only') AS transaction_read_only,
 true AS anchor_and_historical_receipts_exact,1 AS reconciliation_receipts,0 AS successor_receipts,
 true AS scoped_lineage,true AS receipt_chain,true AS topology,true AS activation_safe,
 (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version::text='20260811441600') AS recorded_114416,
 false AS next_stage_authorized;
ROLLBACK;
