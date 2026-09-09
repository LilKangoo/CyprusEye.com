BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- Prepared only; no timeout override, mutation RPC, DDL, DML or acquired lock.
-- Anonymous blocks contain SELECT/IF/RAISE only; any failed predicate aborts.
-- Permission guard and lexer derived from the exact tested 114416 source.
DO $history$
BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
  RAISE EXCEPTION 'hotels_114416_history_missing'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['20260811435000','20260811436000','20260811437000',
  '20260811440000','20260811440500','20260811440600','20260811440700','20260811441000','20260811441500']) expected(version)
  WHERE (SELECT count(*) FROM supabase_migrations.schema_migrations recorded WHERE recorded.version::text=expected.version)<>1)
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version::text IN
  ('20260811441600','20260811442000','20260811442500','20260811445000','20260811446000','20260811447000','20260811448000'))

 THEN RAISE EXCEPTION 'hotels_114416_history_boundary_mismatch'; END IF;
END $history$;
DO $boundary$
DECLARE r regclass;
BEGIN
  IF to_regnamespace('hotels_lineage_private') IS NOT NULL
    OR to_regprocedure('public.hotel_v2_public_create_seven_arches_booking(jsonb)') IS NOT NULL
    OR to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') IS NOT NULL
    OR to_regclass('public.hotel_seven_arches_public_quote_issuances') IS NOT NULL
    OR to_regnamespace('hotels_lifecycle_private') IS NOT NULL THEN
    RAISE EXCEPTION 'hotels_114416_boundary_mismatch';
  END IF;
  IF EXISTS(SELECT 1 FROM (VALUES
    ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',
      '5d8e31185a165c555c2fcfcce2802fe569bb7cc201ddfb7ac91978acfa2e3141'),
    ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
      'e895de1ed9bd868f2aaf8b5b21cf17b1a7fdf5a75de33f943991151012fa89eb'),
    ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
      'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650')
  ) e(signature,sha) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
  WHERE p.oid IS NULL OR p.proowner<>'postgres'::regrole OR NOT p.prosecdef
    OR p.provolatile<>'s' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']
    OR encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')<>e.sha
    OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.grantee<>p.proowner)) THEN
    RAISE EXCEPTION 'hotels_114416_source_security_mismatch';
  END IF;
  IF (SELECT count(*) FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts)<>1
    OR EXISTS(SELECT 1 FROM public.hotel_seven_arches_reviewed_pricing_transaction_context)
    OR EXISTS(SELECT 1 FROM public.hotel_seven_arches_pricing_activation_transaction_context)
    OR public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint() IS DISTINCT FROM
       (SELECT catalog_fingerprint FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts WHERE id=1)
  THEN RAISE EXCEPTION 'hotels_114416_historical_foundation_mismatch'; END IF;
END $boundary$;
DO $permission_guard$
DECLARE o public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
 p public.hotel_partner_hotel_permissions%rowtype;
 a public.hotel_activity_log%rowtype;
 r public.hotel_partner_action_receipts%rowtype;
 e public.hotel_partner_event_outbox%rowtype;
 live jsonb; previous jsonb; next_state jsonb;
BEGIN
 SELECT * INTO STRICT o FROM public.hotel_admin_availability_foundation_evolution_receipts WHERE id=1;
 SELECT * INTO STRICT p FROM public.hotel_partner_hotel_permissions WHERE hotel_id=o.hotel_id;
 IF o.hotel_id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
   OR o.permission_version<>1 OR p.version<>2 OR p.partner_id<>o.partner_id
   OR p.assignment_id<>o.assignment_id OR NOT p.has_mutation_capability
   OR NOT EXISTS(SELECT 1 FROM public.partner_resources x JOIN public.hotels h
     ON h.id=x.resource_id AND h.owner_partner_id=x.partner_id
     WHERE x.id=o.assignment_id AND x.partner_id=o.partner_id
       AND x.resource_type='hotels' AND h.id=o.hotel_id)
   OR (SELECT encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)'))
       IS DISTINCT FROM 'aed6f0c7ae4d3590aa8b997d5d661790e42851e5ab1cf07d91e282117c532bc8'
 THEN RAISE EXCEPTION 'hotels_114416_prewrite_permission_provenance_invalid'; END IF;
 live:=public.hotel_v2_h3_2a_permissions_snapshot(o.assignment_id);
 SELECT * INTO STRICT a FROM public.hotel_activity_log x
 WHERE x.hotel_id=o.hotel_id AND x.created_at>=o.created_at
   AND (x.before_state->>'assignment_id'=o.assignment_id::text
     OR x.after_state->>'assignment_id'=o.assignment_id::text)
   AND (x.before_state ? 'partner_permissions' OR x.after_state ? 'partner_permissions');
 previous:=a.before_state->'partner_permissions'; next_state:=a.after_state->'partner_permissions';
 IF a.source IS DISTINCT FROM 'hotels_v2_h3_2a_partner_permissions'
   OR a.entity_type IS DISTINCT FROM 'property' OR a.entity_id IS DISTINCT FROM o.hotel_id
   OR a.action IS DISTINCT FROM 'update' OR a.actor_type IS DISTINCT FROM 'admin'
   OR a.actor_id IS NULL OR a.actor_id IS DISTINCT FROM p.updated_by
   OR a.before_state->>'partner_id' IS DISTINCT FROM o.partner_id::text
   OR a.after_state->>'partner_id' IS DISTINCT FROM o.partner_id::text
   OR a.before_state->>'assignment_id' IS DISTINCT FROM o.assignment_id::text
   OR a.after_state->>'assignment_id' IS DISTINCT FROM o.assignment_id::text
   OR previous IS DISTINCT FROM o.after_permission
   OR previous->'version' IS DISTINCT FROM '1'::jsonb
   OR next_state->'version' IS DISTINCT FROM '2'::jsonb
   OR next_state-'updated_at' IS DISTINCT FROM live-'updated_at'
   OR NOT pg_input_is_valid(next_state->>'updated_at','timestamp with time zone')
   OR (next_state->>'updated_at')::timestamptz IS DISTINCT FROM p.updated_at
   OR previous#>'{capabilities,initiate_stripe_onboarding}' IS DISTINCT FROM 'false'::jsonb
   OR previous#>'{capabilities,request_booking_changes}' IS DISTINCT FROM 'false'::jsonb
   OR next_state->'capabilities' IS DISTINCT FROM
     (previous->'capabilities'||'{"initiate_stripe_onboarding":true,"request_booking_changes":true}'::jsonb)
 THEN RAISE EXCEPTION 'hotels_114416_prewrite_permission_provenance_invalid'; END IF;
 SELECT * INTO STRICT r FROM public.hotel_partner_action_receipts x
 WHERE x.correlation_id=a.correlation_id AND x.action='apply_partner_hotel_permissions';
 IF r.hotel_id IS DISTINCT FROM o.hotel_id OR r.partner_id IS DISTINCT FROM o.partner_id
   OR r.actor_user_id IS DISTINCT FROM a.actor_id OR r.created_at<a.created_at
   OR r.request_hash!~'^[0-9a-f]{64}$'
   OR r.result IS DISTINCT FROM jsonb_build_object('ok',true,
     'contract_version','hotels_v2_h3_2a_partner_permissions_v1',
     'decision','apply_partner_hotel_permissions','hotel_id',o.hotel_id,
     'assignment_id',o.assignment_id,'partner_id',o.partner_id,'changed',true,
     'permission',next_state,'correlation_id',r.correlation_id,'idempotency_key',r.idempotency_key)
 THEN RAISE EXCEPTION 'hotels_114416_prewrite_permission_provenance_invalid'; END IF;
 SELECT * INTO STRICT e FROM public.hotel_partner_event_outbox x
 WHERE x.dedupe_key='h3_2a:permission:'||r.id::text;
 IF e.hotel_id IS DISTINCT FROM o.hotel_id OR e.partner_id IS DISTINCT FROM o.partner_id
   OR e.aggregate_type IS DISTINCT FROM 'hotel_partner_permissions'
   OR e.aggregate_id IS DISTINCT FROM o.assignment_id
   OR e.event_type IS DISTINCT FROM 'hotel.partner_permissions.updated'
   OR e.payload IS DISTINCT FROM jsonb_build_object('hotel_id',o.hotel_id,
     'assignment_id',o.assignment_id,'partner_id',o.partner_id,'permission_version',2,
     'has_mutation_capability',true,'correlation_id',a.correlation_id)
 THEN RAISE EXCEPTION 'hotels_114416_prewrite_permission_provenance_invalid'; END IF;
 PERFORM jsonb_build_object('hotel_id',o.hotel_id,'partner_id',o.partner_id,
   'assignment_id',o.assignment_id,'historical_permission',previous,
   'current_permission',next_state,'activity',jsonb_set(to_jsonb(a),'{created_at}',
     to_jsonb((extract(epoch from a.created_at)*1000000)::bigint)),
   'action_receipt',jsonb_set(to_jsonb(r),'{created_at}',
     to_jsonb((extract(epoch from r.created_at)*1000000)::bigint)),
   'outbox_identity',jsonb_build_object(
     'id',e.id,'dedupe_key',e.dedupe_key,'aggregate_type',e.aggregate_type,
     'aggregate_id',e.aggregate_id,'event_type',e.event_type,'payload',e.payload));
EXCEPTION WHEN no_data_found OR too_many_rows OR invalid_text_representation
 OR invalid_datetime_format THEN RAISE EXCEPTION 'hotels_114416_prewrite_permission_provenance_invalid';
END  $permission_guard$;
DO $recognized_constraint$
DECLARE input text; t text; coverage text:=''; normalized text:=''; canonical text; constraint_oid oid;
BEGIN
 SELECT oid,pg_get_expr(conbin,conrelid) INTO STRICT constraint_oid,input FROM pg_constraint
 WHERE conrelid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass
 AND conname='hotel_admin_availability_evolution_owner_membership_exact' AND contype='c' AND convalidated;
 FOR t IN SELECT m[1] FROM regexp_matches(input,
   $lex$'(?:[^']|'')*'|"(?:[^"]|"")*"|[[:space:]]+|[^[:space:]'"]+$lex$,'g') m
 LOOP
   coverage:=coverage||t;
   IF t~'^[[:space:]]+$' THEN CONTINUE; END IF;
   IF left(t,1) NOT IN ('''','"') THEN
     t:=replace(replace(t,'pg_catalog.',''),'extensions.digest','digest');
   END IF;
   normalized:=normalized||t;
 END LOOP;

 IF coverage IS DISTINCT FROM input THEN RAISE EXCEPTION 'hotels_114416_constraint_token_mismatch'; END IF;
 canonical:=regexp_replace(normalized,$cast$('(?:[^']|'')*')::(?:text|name)$cast$,$replacement$\1$replacement$,'g');
 IF canonical !~ $pattern$^\(*owner_membership_fingerprint=encode\(digest\(convert_to\(\(*jsonb_build_object\('contract_version','hotels_v2_seven_arches_owner_membership_v1','hotel_id',hotel_id,'partner_id',partner_id,'assignment_id',assignment_id,'role','owner','owner_user_ids',to_jsonb\(owner_user_ids\)\)\)*::text,'UTF8'\),'sha256'\),'hex'\)\)*$$pattern$
 OR NOT EXISTS(SELECT 1 FROM pg_depend WHERE classid='pg_constraint'::regclass AND objid=constraint_oid
  AND refclassid='pg_proc'::regclass AND refobjid='extensions.digest(bytea,text)'::regprocedure)
 OR EXISTS(SELECT 1 FROM pg_depend d JOIN pg_proc p ON p.oid=d.refobjid JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE d.classid='pg_constraint'::regclass AND d.objid=constraint_oid AND d.refclassid='pg_proc'::regclass
  AND n.nspname<>'pg_catalog' AND p.oid<>'extensions.digest(bytea,text)'::regprocedure)
 THEN RAISE EXCEPTION 'hotels_114416_constraint_semantic_mismatch'; END IF;
END $recognized_constraint$;
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
SELECT 'HOTELS_114416_PREWRITE_OK' AS sentinel,current_setting('transaction_read_only') AS transaction_read_only,
 true AS before_source_security_exact,true AS permission_provenance_exact,true AS recognized_constraint_exact,
 true AS commercial_boundary_exact,true AS maintenance_clear,false AS write_authorized;
ROLLBACK;
