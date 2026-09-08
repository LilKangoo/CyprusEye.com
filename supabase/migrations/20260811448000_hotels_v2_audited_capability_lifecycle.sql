-- Future, local-only lifecycle stage. No capability is enabled by installation.
-- Predecessor projections are bound to exact BEFORE/AFTER source+metadata, not
-- acceptance of arbitrary old hashes. Actual DTOs always report actual flags.
-- Privileged postgres remains a trusted administrator, not cryptographically excluded.
BEGIN;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
LOCK TABLE public.site_settings IN SHARE ROW EXCLUSIVE MODE;
DO $pre$
BEGIN
 IF to_regnamespace('hotels_lifecycle_private') IS NOT NULL
 OR to_regprocedure('public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text)') IS NULL
 OR public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
 OR (SELECT count(*) FROM public.site_settings)<>1
 OR NOT EXISTS(SELECT 1 FROM public.site_settings WHERE id=1 AND hotel_rooms_v2_enabled IS FALSE
   AND hotel_stripe_connect_enabled IS FALSE AND hotel_instant_booking_enabled IS FALSE
   AND hotel_external_sync_enabled IS NOT NULL)
 THEN RAISE EXCEPTION 'hotels_lifecycle_install_boundary_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM (VALUES
 ('hotel_stripe_connect_private.scope(uuid,uuid,uuid)','58c64002fd15b8690a7e2e89b64120225763415517674c9a2e0a350b07b16eda'),
 ('public.hotel_v2_stripe_connect_service(text,jsonb)','72869ca7d965c802b5ad67f6235cbbe1712f56c1961fd5beaadb35f200aac0c4'),
 ('hotel_stripe_connect_private.authorization_state(uuid)','23d55b3b97ee8893d2b464d9ea688af47827dbd9dd6570cea585346291e96fcb'),
 ('hotel_stripe_connect_private.authorization_receipt_hash(jsonb)','64aef185af0ffbecf4fdf378b36414d6e2f7da32dd70cb25c4ae0a2f8ea9c052'),
 ('hotel_stripe_connect_private.guard_authorization_receipt()','235988d6ff8107dc333eda8cf68178ce05f00b48315569c485a5d28da3eada8d'),
 ('public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text)','10e1a64961f129ef145736b21119774d6c665b77b467510c551042bfc07523d7'),
 ('public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)','45dc3a00c73a0f031298523cf41e9ffeac90e1e46c50c532b796a231276de473')
 ) e(signature,hash) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR p.proowner<>'postgres'::regrole
 OR p.prosecdef IS DISTINCT FROM (p.proname<>'authorization_receipt_hash')
 OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname=CASE WHEN p.proname='authorization_receipt_hash' THEN 'sql' ELSE 'plpgsql' END)
 OR p.provolatile::text IS DISTINCT FROM CASE WHEN p.proname='authorization_receipt_hash' THEN 'i'
 WHEN p.proname IN ('scope','authorization_state','hotel_v2_admin_get_partner_stripe_onboarding_authorization') THEN 's' ELSE 'v' END
 OR p.proconfig IS DISTINCT FROM ARRAY[CASE WHEN p.proname='hotel_v2_stripe_connect_service'
 THEN 'search_path=pg_catalog, public, hotel_stripe_connect_private'
 WHEN p.proname IN ('guard_authorization_receipt','hotel_v2_admin_get_partner_stripe_onboarding_authorization','hotel_v2_admin_set_partner_stripe_onboarding_authorization')
 THEN 'search_path=pg_catalog, public, auth' ELSE 'search_path=pg_catalog, public' END]
 OR p.proleakproof OR p.proretset
 OR has_function_privilege(0::oid,p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE')
 OR has_function_privilege('authenticated',p.oid,'EXECUTE') IS DISTINCT FROM
 (p.proname IN ('hotel_v2_admin_get_partner_stripe_onboarding_authorization','hotel_v2_admin_set_partner_stripe_onboarding_authorization'))
 OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM (p.proname='hotel_v2_stripe_connect_service')
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.grantee<>p.proowner AND (a.is_grantable OR a.grantee NOT IN ('authenticated'::regrole,'service_role'::regrole)))
 OR encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') IS DISTINCT FROM e.hash)
 THEN RAISE EXCEPTION 'hotels_lifecycle_partner_authorization_source_drift'; END IF;
END $pre$;
CREATE SCHEMA hotels_lifecycle_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA hotels_lifecycle_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hotels_lifecycle_private.bindings(
 signature text PRIMARY KEY, before_source text NOT NULL, before_definition text NOT NULL,
 before_hash text NOT NULL, after_hash text NOT NULL, after_metadata jsonb NOT NULL);
CREATE TABLE hotels_lifecycle_private.foundation(
 id integer PRIMARY KEY CHECK(id=1), initial_flags jsonb NOT NULL,
 catalog jsonb NOT NULL, predecessor_receipts jsonb NOT NULL);
CREATE TABLE hotels_lifecycle_private.decisions(
 version bigint PRIMARY KEY CHECK(version>0), request_id uuid UNIQUE NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id), capability text NOT NULL,
 enabled boolean NOT NULL, reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000 AND reason=btrim(reason)),
 before_state jsonb NOT NULL, after_state jsonb NOT NULL, previous_hash text NOT NULL,
 receipt_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE hotels_lifecycle_private.context(
 transaction_id bigint PRIMARY KEY, backend_pid integer NOT NULL, request_id uuid NOT NULL,
 actor_id uuid NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL);
CREATE TABLE hotels_lifecycle_private.stripe_readiness(
 request_id uuid PRIMARY KEY, ready boolean NOT NULL, contract_version text NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT clock_timestamp());

CREATE FUNCTION hotels_lifecycle_private.hash(p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,public AS $f$
 SELECT encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex')
$f$;
CREATE FUNCTION hotels_lifecycle_private.metadata(p_oid oid) RETURNS jsonb
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT jsonb_build_object('owner',pg_get_userbyid(p.proowner),'language',l.lanname,
 'security_definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,
 'leakproof',p.proleakproof,'returns_set',p.proretset,'config',p.proconfig,
 'acl',(SELECT jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable)
 ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee))
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=p_oid
$f$;
CREATE FUNCTION hotels_lifecycle_private.predecessor_source(p_oid oid) RETURNS text
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE b hotels_lifecycle_private.bindings%rowtype; s text;
BEGIN
 SELECT prosrc INTO STRICT s FROM pg_proc WHERE oid=p_oid;
 SELECT * INTO b FROM hotels_lifecycle_private.bindings WHERE to_regprocedure(signature)=p_oid;
 IF FOUND THEN
  IF encode(extensions.digest(convert_to(s,'UTF8'),'sha256'),'hex') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.after_metadata
   OR encode(extensions.digest(convert_to(b.before_source,'UTF8'),'sha256'),'hex') IS DISTINCT FROM b.before_hash
  THEN RAISE EXCEPTION 'hotels_lifecycle_evolved_source_security_drift'; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END $f$;
CREATE FUNCTION hotels_lifecycle_private.predecessor_definition(p_oid oid) RETURNS text
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE d text;
BEGIN
 PERFORM hotels_lifecycle_private.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM hotels_lifecycle_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END $f$;
CREATE FUNCTION hotels_lifecycle_private.actual_flags() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT jsonb_build_object('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled,
 'hotel_external_sync_enabled',hotel_external_sync_enabled,'hotel_instant_booking_enabled',hotel_instant_booking_enabled,
 'hotel_stripe_connect_enabled',hotel_stripe_connect_enabled) FROM public.site_settings WHERE id=1
$f$;
CREATE FUNCTION hotels_lifecycle_private.catalog_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT jsonb_build_object(
 'bindings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY signature) FROM hotels_lifecycle_private.bindings b),
 'evolved',(SELECT jsonb_object_agg(b.signature,jsonb_build_array(
  encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),hotels_lifecycle_private.metadata(p.oid)) ORDER BY b.signature)
  FROM hotels_lifecycle_private.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)),
 'authorization_dependencies',(SELECT jsonb_object_agg(p.oid::regprocedure::text,
 jsonb_build_array(hotels_lifecycle_private.hash(to_jsonb(p.prosrc)),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='hotel_stripe_connect_private'
 OR p.proname IN ('hotel_v2_stripe_connect_service','hotel_v2_admin_get_partner_stripe_onboarding_authorization',
 'hotel_v2_admin_set_partner_stripe_onboarding_authorization','hotel_v2_h2a_require_admin','is_current_user_admin')),
 'schema',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl) FROM pg_namespace WHERE nspname='hotels_lifecycle_private'),
 'functions',(SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('metadata',hotels_lifecycle_private.metadata(p.oid),
 'hash',hotels_lifecycle_private.hash(to_jsonb(p.prosrc))) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='hotels_lifecycle_private'
 OR p.proname IN ('hotel_v2_admin_get_capability_lifecycle','hotel_v2_admin_set_capability_lifecycle','hotel_v2_attest_stripe_platform_readiness')),
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,
 'persistence',c.relpersistence,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid::regtype::text,a.atttypmod,a.attnotnull,
 a.attidentity,a.attgenerated,a.attcollation::regcollation::text,
 (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(conname,convalidated,pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
 'policies',(SELECT jsonb_agg(to_jsonb(p)-'oid'-'polrelid') FROM pg_policy p WHERE p.polrelid=c.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.tgname)
 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('hotels_lifecycle_private','hotel_stripe_connect_private') AND c.relkind IN ('r','p')),
 'settings_guard',(SELECT jsonb_build_array(t.tgenabled,pg_get_triggerdef(t.oid)) FROM pg_trigger t
 WHERE t.tgrelid='public.site_settings'::regclass AND t.tgname='hotels_capability_lifecycle_guard'))
$f$;
CREATE FUNCTION hotels_lifecycle_private.predecessor_receipts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET timezone='UTC' AS $f$
DECLARE signature text; fingerprint text; result jsonb:='{}';
BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.hotel_admin_availability_foundation_receipts','public.hotel_admin_availability_foundation_evolution_receipts',
  'public.hotel_partner_workspace_foundation_receipts','public.hotel_partner_property_proposal_foundation_receipts',
  'public.hotel_seven_arches_task2_stage2_compatibility_receipts','public.hotel_seven_arches_pricing_activation_evolution_receipts',
  'public.hotel_seven_arches_independent_pricing_evolution_receipts','public.hotel_seven_arches_reviewed_pricing_foundation_receipts',
  'hotels_v2_private.hotel_external_calendar_foundation_receipts','hotels_v2_private.hotel_external_calendar_activation_receipts',
  'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'] LOOP
  EXECUTE format('SELECT hotels_lifecycle_private.hash(coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),''[]''::jsonb)) FROM %s r',signature::regclass) INTO fingerprint;
  result:=result||jsonb_build_object(signature,fingerprint);
 END LOOP;
 RETURN result;
END $f$;
CREATE FUNCTION hotels_lifecycle_private.chain_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE f hotels_lifecycle_private.foundation%rowtype; d record; s jsonb; v bigint:=0; h text:=repeat('0',64); k text;
BEGIN
 SELECT * INTO STRICT f FROM hotels_lifecycle_private.foundation WHERE id=1;
 IF f.catalog IS DISTINCT FROM hotels_lifecycle_private.catalog_snapshot() THEN
  RAISE EXCEPTION 'hotels_lifecycle_catalog_drift'; END IF;
 s:=f.initial_flags||jsonb_build_object('public_booking_enabled',false);
 FOR d IN SELECT * FROM hotels_lifecycle_private.decisions ORDER BY version LOOP
  k:=CASE d.capability WHEN 'rooms' THEN 'hotel_rooms_v2_enabled' WHEN 'external' THEN 'hotel_external_sync_enabled'
   WHEN 'stripe' THEN 'hotel_stripe_connect_enabled' WHEN 'instant' THEN 'hotel_instant_booking_enabled'
   WHEN 'public_booking' THEN 'public_booking_enabled' END;
  IF k IS NULL OR d.version<>v+1 OR d.before_state IS DISTINCT FROM s
   OR d.after_state IS DISTINCT FROM jsonb_set(s,ARRAY[k],to_jsonb(d.enabled))
   OR d.after_state IS NOT DISTINCT FROM s OR d.previous_hash IS DISTINCT FROM h
   OR d.receipt_hash IS DISTINCT FROM hotels_lifecycle_private.hash(
    (to_jsonb(d)-'receipt_hash'-'created_at')||jsonb_build_object('created_at_epoch',extract(epoch FROM d.created_at)))
  THEN RAISE EXCEPTION 'hotels_lifecycle_chain_invalid'; END IF;
  s:=d.after_state; v:=d.version; h:=d.receipt_hash;
 END LOOP;
 IF (s->>'hotel_instant_booking_enabled')::boolean OR (s->>'public_booking_enabled')::boolean THEN
  RAISE EXCEPTION 'hotels_lifecycle_unsupported_public_stage'; END IF;
 RETURN jsonb_build_object('version',v,'state',s,'receipt_hash',h);
END $f$;
CREATE FUNCTION hotels_lifecycle_private.safe_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE s jsonb; flags jsonb;
BEGIN
 s:=hotels_lifecycle_private.chain_state(); flags:=hotels_lifecycle_private.actual_flags();
 IF (SELECT count(*) FROM public.site_settings)<>1
 OR flags IS DISTINCT FROM ((s->'state')-'public_booking_enabled')
 OR EXISTS(SELECT 1 FROM jsonb_each(flags) e WHERE jsonb_typeof(e.value)<>'boolean')
 THEN RAISE EXCEPTION 'hotels_lifecycle_flag_state_drift'; END IF;
 RETURN jsonb_build_object('contract_version','hotels_v2_capability_lifecycle_v1','version',s->'version',
 'feature_flags',flags,'public_booking_enabled',false,'architecture','legacy','expected_public_change',false,'audit_chain_exact',true);
END $f$;
CREATE FUNCTION hotels_lifecycle_private.predecessor_flag_exact(p_flag text,p_actual boolean) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE s jsonb;
BEGIN
 IF p_flag NOT IN ('hotel_rooms_v2_enabled','hotel_stripe_connect_enabled') OR p_actual IS NULL THEN RETURN false; END IF;
 s:=hotels_lifecycle_private.safe_state();
 RETURN p_actual IS NOT DISTINCT FROM (s->'feature_flags'->>p_flag)::boolean;
END $f$;
CREATE FUNCTION hotels_lifecycle_private.public_booking_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT (hotels_lifecycle_private.safe_state()->>'public_booking_enabled')::boolean
$f$;
CREATE FUNCTION hotels_lifecycle_private.partner_connection(p_partner_id uuid,p_hotel_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE permitted boolean; a hotel_stripe_connect_private.accounts%rowtype; platform boolean;
BEGIN
 PERFORM public.hotel_v2_h3_2a_require_partner_hotel_access(p_partner_id,p_hotel_id,null,false);
 platform:=(hotels_lifecycle_private.safe_state()->'feature_flags'->>'hotel_stripe_connect_enabled')::boolean;
 permitted:=EXISTS(SELECT 1 FROM public.partner_users WHERE partner_id=p_partner_id AND user_id=auth.uid() AND role='owner')
  AND (hotel_stripe_connect_private.authorization_state(p_partner_id)->>'enabled')::boolean;
 SELECT * INTO a FROM hotel_stripe_connect_private.accounts WHERE partner_id=p_partner_id;
 RETURN jsonb_build_object('contract_version','hotels_partner_stripe_capability_v1','partner_id',p_partner_id,'hotel_id',p_hotel_id,
 'platform_enabled',platform,'onboarding_authorized',permitted,'account_status',coalesce(a.status,'NOT_CONNECTED'),
 'checked_at',a.checked_at,'can_connect',platform AND permitted AND (a.partner_id IS NULL OR a.status='ONBOARDING_INCOMPLETE'));
END $f$;
CREATE FUNCTION hotels_lifecycle_private.immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
BEGIN RAISE EXCEPTION 'hotels_lifecycle_immutable_receipt'; END $f$;
CREATE FUNCTION hotels_lifecycle_private.guard_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE c hotels_lifecycle_private.context%rowtype;
BEGIN
 IF TG_OP<>'UPDATE' AND TG_OP<>'INSERT' THEN RAISE EXCEPTION 'hotels_lifecycle_transition_required'; END IF;
 IF TG_TABLE_SCHEMA='public' THEN
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)->'hotel_rooms_v2_enabled',to_jsonb(NEW)->'hotel_external_sync_enabled',
    to_jsonb(NEW)->'hotel_stripe_connect_enabled',to_jsonb(NEW)->'hotel_instant_booking_enabled')
   IS NOT DISTINCT FROM (to_jsonb(OLD)->'hotel_rooms_v2_enabled',to_jsonb(OLD)->'hotel_external_sync_enabled',
    to_jsonb(OLD)->'hotel_stripe_connect_enabled',to_jsonb(OLD)->'hotel_instant_booking_enabled') THEN RETURN NEW; END IF;
 END IF;
 SELECT * INTO c FROM hotels_lifecycle_private.context WHERE transaction_id=txid_current() AND backend_pid=pg_backend_pid();
 IF NOT FOUND OR auth.uid() IS NULL OR c.actor_id IS DISTINCT FROM auth.uid() THEN
  RAISE EXCEPTION USING errcode='42501',message='hotels_lifecycle_explicit_admin_transition_required'; END IF;
 PERFORM public.hotel_v2_h2a_require_admin();
 IF TG_TABLE_SCHEMA='public' THEN
  IF NEW.id<>1 OR jsonb_build_object('hotel_rooms_v2_enabled',NEW.hotel_rooms_v2_enabled,
   'hotel_external_sync_enabled',NEW.hotel_external_sync_enabled,'hotel_instant_booking_enabled',NEW.hotel_instant_booking_enabled,
   'hotel_stripe_connect_enabled',NEW.hotel_stripe_connect_enabled) IS DISTINCT FROM c.after_state-'public_booking_enabled'
  THEN RAISE EXCEPTION 'hotels_lifecycle_transition_target_mismatch'; END IF;
 ELSE
  IF NEW.actor_id IS DISTINCT FROM c.actor_id OR NEW.request_id IS DISTINCT FROM c.request_id
   OR NEW.before_state IS DISTINCT FROM c.before_state OR NEW.after_state IS DISTINCT FROM c.after_state
  THEN RAISE EXCEPTION 'hotels_lifecycle_transition_receipt_mismatch'; END IF;
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER hotels_capability_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON public.site_settings
 FOR EACH ROW EXECUTE FUNCTION hotels_lifecycle_private.guard_transition();
CREATE TRIGGER lifecycle_decision_guard BEFORE INSERT ON hotels_lifecycle_private.decisions
 FOR EACH ROW EXECUTE FUNCTION hotels_lifecycle_private.guard_transition();
CREATE TRIGGER lifecycle_decision_immutable BEFORE UPDATE OR DELETE ON hotels_lifecycle_private.decisions
 FOR EACH ROW EXECUTE FUNCTION hotels_lifecycle_private.immutable();
CREATE TRIGGER lifecycle_decision_no_truncate BEFORE TRUNCATE ON hotels_lifecycle_private.decisions
 FOR EACH STATEMENT EXECUTE FUNCTION hotels_lifecycle_private.immutable();

CREATE FUNCTION public.hotel_v2_admin_get_capability_lifecycle() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE s jsonb; stripe_ready boolean;
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 IF auth.uid() IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='hotels_lifecycle_admin_required'; END IF;
 s:=hotels_lifecycle_private.safe_state();
 SELECT coalesce((SELECT ready AND contract_version='hotels_standard_connect_server_v1' AND checked_at>statement_timestamp()-interval '15 minutes'
 FROM hotels_lifecycle_private.stripe_readiness ORDER BY checked_at DESC,request_id DESC LIMIT 1),false) INTO stripe_ready;
 RETURN s||jsonb_build_object('capabilities',jsonb_build_array(
  jsonb_build_object('key','rooms','enabled',s->'feature_flags'->'hotel_rooms_v2_enabled','blocked_reasons','[]'::jsonb,'requires_confirmation',true),
  jsonb_build_object('key','external','enabled',s->'feature_flags'->'hotel_external_sync_enabled','blocked_reasons',jsonb_build_array('external_calendar_has_separate_reviewed_source_lifecycle'),'requires_confirmation',true),
  jsonb_build_object('key','stripe','enabled',s->'feature_flags'->'hotel_stripe_connect_enabled','blocked_reasons',CASE WHEN stripe_ready THEN '[]'::jsonb ELSE jsonb_build_array('verified_server_configuration_required') END,'requires_confirmation',true),
  jsonb_build_object('key','instant','enabled',false,'blocked_reasons',jsonb_build_array('instant_booking_contract_not_installed'),'requires_confirmation',true),
  jsonb_build_object('key','public_booking','enabled',false,'blocked_reasons',jsonb_build_array('public_booking_release_contract_not_installed'),'requires_confirmation',true)));
END $f$;
CREATE FUNCTION public.hotel_v2_admin_set_capability_lifecycle(p_capability text,p_enabled boolean,
 p_expected_version bigint,p_request_id uuid,p_reason text,p_confirmation text) RETURNS jsonb
-- Exact protected BEFORE/AFTER maps measured 42–44s on the synthetic fixture.
-- Scope the RPC budget to this explicit Admin decision; no global role change.
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,auth SET statement_timeout='60s' AS $f$
DECLARE s jsonb; before_state jsonb; after_state jsonb; k text; d jsonb; existing hotels_lifecycle_private.decisions%rowtype;
 v_actor uuid:=auth.uid(); blocked jsonb; v_created_at timestamptz;
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 IF v_actor IS NULL OR p_request_id IS NULL OR p_enabled IS NULL OR p_expected_version IS NULL OR p_expected_version<0
 OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 10 AND 1000 OR p_reason<>btrim(p_reason)
 OR p_confirmation IS DISTINCT FROM 'CONFIRM_HOTELS_CAPABILITY_CHANGE'
 THEN RAISE EXCEPTION USING errcode='22023',message='hotels_lifecycle_invalid_decision'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hotels-global-capability-lifecycle',0));
 PERFORM 1 FROM public.site_settings WHERE id=1 FOR UPDATE;
 s:=hotels_lifecycle_private.chain_state(); PERFORM hotels_lifecycle_private.safe_state();
 SELECT * INTO existing FROM hotels_lifecycle_private.decisions WHERE request_id=p_request_id;
 IF FOUND THEN
  IF existing.actor_id IS DISTINCT FROM v_actor OR existing.capability IS DISTINCT FROM p_capability
   OR existing.enabled IS DISTINCT FROM p_enabled OR existing.reason IS DISTINCT FROM p_reason
   OR existing.version<>p_expected_version+1 THEN RAISE EXCEPTION 'hotels_lifecycle_idempotency_conflict'; END IF;
  RETURN jsonb_build_object('replayed',true,'decision_version',existing.version,'current',public.hotel_v2_admin_get_capability_lifecycle());
 END IF;
 IF (s->>'version')::bigint<>p_expected_version THEN RAISE EXCEPTION 'hotels_lifecycle_stale_version'; END IF;
 k:=CASE p_capability WHEN 'rooms' THEN 'hotel_rooms_v2_enabled' WHEN 'stripe' THEN 'hotel_stripe_connect_enabled' END;
 IF k IS NULL THEN RAISE EXCEPTION 'hotels_lifecycle_missing_activation_prerequisites'; END IF;
 IF p_enabled THEN
  SELECT e->'blocked_reasons' INTO blocked FROM jsonb_array_elements(public.hotel_v2_admin_get_capability_lifecycle()->'capabilities') e WHERE e->>'key'=p_capability;
  IF blocked IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'hotels_lifecycle_missing_activation_prerequisites'; END IF;
 END IF;
 IF public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 OR hotels_lifecycle_private.predecessor_receipts() IS DISTINCT FROM (SELECT predecessor_receipts FROM hotels_lifecycle_private.foundation WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_lifecycle_protected_state_invalid'; END IF;
 before_state:=s->'state'; after_state:=jsonb_set(before_state,ARRAY[k],to_jsonb(p_enabled));
 IF before_state=after_state THEN RAISE EXCEPTION 'hotels_lifecycle_no_change'; END IF;
 INSERT INTO hotels_lifecycle_private.context VALUES(txid_current(),pg_backend_pid(),p_request_id,v_actor,before_state,after_state);
 v_created_at:=clock_timestamp();
 d:=jsonb_build_object('version',p_expected_version+1,'request_id',p_request_id,'actor_id',v_actor,
 'capability',p_capability,'enabled',p_enabled,'reason',p_reason,'before_state',before_state,'after_state',after_state,'previous_hash',s->>'receipt_hash',
 'created_at_epoch',extract(epoch FROM v_created_at));
 INSERT INTO hotels_lifecycle_private.decisions(version,request_id,actor_id,capability,enabled,reason,before_state,after_state,previous_hash,receipt_hash,created_at)
 VALUES(p_expected_version+1,p_request_id,v_actor,p_capability,p_enabled,p_reason,before_state,after_state,s->>'receipt_hash',hotels_lifecycle_private.hash(d),v_created_at);
 UPDATE public.site_settings SET hotel_rooms_v2_enabled=(after_state->>'hotel_rooms_v2_enabled')::boolean,
 hotel_stripe_connect_enabled=(after_state->>'hotel_stripe_connect_enabled')::boolean WHERE id=1;
 DELETE FROM hotels_lifecycle_private.context WHERE transaction_id=txid_current();
 PERFORM hotels_lifecycle_private.safe_state();
 IF public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 OR hotels_lifecycle_private.predecessor_receipts() IS DISTINCT FROM (SELECT predecessor_receipts FROM hotels_lifecycle_private.foundation WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_lifecycle_post_transition_protected_state_invalid'; END IF;
 RETURN jsonb_build_object('replayed',false,'decision_version',p_expected_version+1,'current',public.hotel_v2_admin_get_capability_lifecycle());
END $f$;
CREATE FUNCTION public.hotel_v2_attest_stripe_platform_readiness(p_request_id uuid,p_ready boolean,p_contract_version text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
BEGIN
 IF p_request_id IS NULL OR p_ready IS NULL OR p_contract_version IS DISTINCT FROM 'hotels_standard_connect_server_v1'
 THEN RAISE EXCEPTION 'hotels_lifecycle_invalid_server_attestation'; END IF;
 INSERT INTO hotels_lifecycle_private.stripe_readiness(request_id,ready,contract_version) VALUES(p_request_id,p_ready,p_contract_version);
 RETURN true;
END $f$;

-- Exact guarded source evolution manifest is inserted here by the local builder.
-- Six already-bound read-only validators also deduplicate identical zero-argument
-- STABLE/IMMUTABLE inputs. SQL uses MATERIALIZED CTEs; PL/pgSQL uses invocation-
-- local constants under its existing STABLE snapshot. Every predicate remains;
-- nothing is cached across calls, transactions, or the decision BEFORE/AFTER.
-- Quoted historical source evidence is untouched. Exact before/after hashes and
-- metadata still guard every evolution. No timeout or lock policy is changed.
DO $evolve$
DECLARE e jsonb; patch jsonb; oid_value oid; src text; def text; before_meta jsonb; before_def text; before_src text;
BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements($manifest$[{"signature":"public.hotel_v2_seven_arches_independent_pricing_activation_lineage()","before":"2438f50b54d60d603a169b499b9918b975a0f215993b23e480e9e77fdd5bacba","after":"2c40bc68f2d7dd54bb50654d0ca3e5a528509964377fc57e460718e7baa82fd9","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":2},{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":1},{"needle":"select prosrc from pg_proc","replacement":"select hotels_lifecycle_private.predecessor_source(oid) from pg_proc","count":28},{"needle":"select prosrc\n        from pg_proc","replacement":"select hotels_lifecycle_private.predecessor_source(oid)\n        from pg_proc","count":1},{"needle":"setting.hotel_rooms_v2_enabled is distinct from false","replacement":"not hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled)","count":1},{"needle":"setting.hotel_stripe_connect_enabled is distinct from false","replacement":"not hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled)","count":1},{"needle":" public.hotel_v2_7a_pricing_activation_transaction_is_preserved()\n","replacement":" v_lifecycle_once_0\n","count":1},{"needle":" public.hotel_v2_7a_pricing_activation_transaction_is_preserved(),","replacement":" v_lifecycle_once_0,","count":1},{"needle":"d',case when public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n        then","replacement":"d',case when v_lifecycle_once_1\n        then","count":1},{"needle":"ctor',case when public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n        then 'e","replacement":"ctor',case when v_lifecycle_once_1\n        then 'e","count":1},{"needle":" public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n","replacement":" v_lifecycle_once_1\n","count":1},{"needle":"declare","replacement":"declare\n  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.\n  v_lifecycle_once_0 constant boolean:=public.hotel_v2_7a_pricing_activation_transaction_is_preserved();\n  v_lifecycle_once_1 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_h3_2b_flags_off()","before":"24913daf8524b3f9eea0d35b1e25e84807664edda55a6bcc0802a19cb85b8513","after":"c4866c37cc2a4c5569e9efee957db4f13cc641290e2b2ea4b96f6265e9a2691f","patches":[{"needle":"not hotel_rooms_v2_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled)","count":1},{"needle":"not hotel_stripe_connect_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',hotel_stripe_connect_enabled)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_partner_list_assigned_properties(uuid)","before":"96509745b06e4c21c3ea67d94f7aa57d7bf17d86772fbf4ac9710ae421b3c017","after":"01a3987c9596801a9bdbb34df9bc2825d60daad2e83f0f7c0c8f5e7df82af6a3","patches":[{"needle":"setting.hotel_rooms_v2_enabled\n      or false","replacement":"not hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled)\n      or false","count":1},{"needle":"or setting.hotel_stripe_connect_enabled\n","replacement":"or not hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled)\n","count":1}],"metadata":{"acl":[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_admin_c_validate_pricing_graph(uuid)","before":"03f787a5e00fbbe65bdcaf1a96529512f60775074a1fdf4dcdd04104c7c7d335","after":"4c5b744e6117c1e27a6215a98ebd788b30d06e6bcf4040ea2335a2f4f1fbb6f0","patches":[{"needle":"and setting.hotel_rooms_v2_enabled)","replacement":"and not hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled))","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"v","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_admin_c_pricing_control_snapshot(uuid)","before":"3f954c525277c771c3009e9ca1fbbf6c68776904f40bc70978d01f7f10a060b0","after":"5d40f4475e8bbda75d3f44820ba90cca32fbb57cc405191e2c1369d1fc5a01c3","patches":[{"needle":"'property',v_property,'feature_flags',v_flags,'legacy_safety',v_legacy","replacement":"'property',v_property,'feature_flags',v_flags,'capability_lifecycle',hotels_lifecycle_private.safe_state(),'legacy_safety',v_legacy","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)","before":"54623c446938b9606b3b798e779efbe39820dd3a715e49fcc4b30a803a5de942","after":"ae51c6ed5516fe7c37b684ac843572af0d2b23b08ca28759b58c926c97df9798","patches":[{"needle":"'feature_flags',jsonb_build_object('hotel_rooms_v2_enabled',false,'hotel_external_sync_enabled',(select hotel_external_sync_enabled from public.site_settings where id=1),\n      'hotel_instant_booking_enabled',false,'hotel_stripe_connect_enabled',false)","replacement":"'capability_lifecycle',hotels_lifecycle_private.safe_state(),\n    'stripe_connection',hotels_lifecycle_private.partner_connection(p_partner_id,p_hotel_id),\n    'feature_flags',hotels_lifecycle_private.actual_flags()","count":1}],"metadata":{"acl":[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_admin_d_snapshot_external_base(uuid,date,date,boolean)","before":"b256a7e58e52c0ee53336c2dff5e4f351c16187e09fb00bdf434a5c2dd36a43d","after":"0d8e57d5bb06811f3ad39f6d4a638783d4517bf6c0b660a64a551790059e625c","patches":[{"needle":"not hotel_rooms_v2_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled)","count":1},{"needle":"not hotel_stripe_connect_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',hotel_stripe_connect_enabled)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"v","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_partner_workspace_function_lineage_is_exact()","before":"dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85","after":"e1bbb882e4ed18b28ff638262aedd9f29692a520d62aa016b6ef2b82f79a7757","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":3}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_public_create_seven_arches_booking(jsonb)","before":"82949643fe6099308f9293a335f27e1d1be9f66c1aa3e0d77925458cdd7142f7","after":"1406fba4204f321bb4478a380ff391b0317ebee87548ada0252c4c9fd655feb6","patches":[{"needle":"where id=1 and hotel_rooms_v2_enabled is true)","replacement":"where id=1 and hotel_rooms_v2_enabled is true\n      and hotels_lifecycle_private.public_booking_enabled())","count":1}],"metadata":{"acl":[["anon","EXECUTE",false],["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"v","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_external_calendar_site_settings_fingerprint()","before":"e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd","after":"8e88d7f4778e65afda80b98a9ba4b32a7ed7c56ae4022312bedcfd6f2b8e45f9","patches":[{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":1},{"needle":"v_setting.hotel_rooms_v2_enabled is distinct from false","replacement":"not hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',v_setting.hotel_rooms_v2_enabled)","count":1},{"needle":"v_setting.hotel_stripe_connect_enabled is distinct from false","replacement":"not hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',v_setting.hotel_stripe_connect_enabled)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)","before":"b21177e87bbac4750e90243dd4d695c45d361deb69fbd5d9cce5be8eb1412d7c","after":"2b5702a60866205e56c6ecb7492581cf1b262098f5142b39559de5c6feb012cf","patches":[{"needle":"setting.hotel_rooms_v2_enabled\n      or false","replacement":"not hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled)\n      or false","count":1},{"needle":"or setting.hotel_stripe_connect_enabled\n","replacement":"or not hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled)\n","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_external_calendar_activation_function_fingerprints()","before":"fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914","after":"4050571cca29b2e8210f01806e8af643e484af6039985a0d2517b89ada5c2693","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_seven_arches_pricing_scoped_lineage()","before":"5d8e31185a165c555c2fcfcce2802fe569bb7cc201ddfb7ac91978acfa2e3141","after":"6c6fa70bde2eb675c2cfce0b00e426ebbf79920f79fd717f6bd8fb932962c9e5","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":1},{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":3},{"needle":"setting.hotel_rooms_v2_enabled is not distinct from false","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled)","count":1},{"needle":"setting.hotel_stripe_connect_enabled is not distinct from false","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_admin_d_current_foundation_snapshot()","before":"192eb5fa15d359b7298b17b0c1a2ce363205ed8ed80a034a74cae4db53121961","after":"19a0f835c9baeee68bc35614424ac92022aa087d9c760f7b9f2fe9068be18218","patches":[{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":1},{"needle":"not hotel_rooms_v2_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled)","count":1},{"needle":"not hotel_stripe_connect_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',hotel_stripe_connect_enabled)","count":1},{"needle":"r exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt\n      where receipt.id=1 and receipt.compatibility_function_fingerprints=\n        jsonb_set(public.hotel_v2_external_calendar_activation_function_fingerprints(),\n          array['public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)']::text[],\n          receipt.compatibility_function_fingerprints->\n            'public.hotel_v2_partner_get","replacement":"r exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt\n      where receipt.id=1 and receipt.compatibility_function_fingerprints=\n        jsonb_set(v_lifecycle_once_0,\n          array['public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)']::text[],\n          receipt.compatibility_function_fingerprints->\n            'public.hotel_v2_partner_get","count":1},{"needle":"d public.hotel_v2_partner_workspace_function_lineage_is_exact());","replacement":"d v_lifecycle_once_1);","count":1},{"needle":"(public.hotel_v2_external_calendar_activation_function_fingerprints(),","replacement":"(v_lifecycle_once_0,","count":1},{"needle":" public.hotel_v2_partner_workspace_function_lineage_is_exact())","replacement":" v_lifecycle_once_1)","count":1},{"needle":" public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();","replacement":" v_lifecycle_once_2;","count":1},{"needle":"')\n    and public.hotel_v2_seven_arches_pricing_scoped_lineage() is not nul","replacement":"')\n    and v_lifecycle_once_3 is not nul","count":1},{"needle":"3 is not null\n    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()\n    and public.hotel_","replacement":"3 is not null\n    and v_lifecycle_once_4\n    and public.hotel_","count":1},{"needle":"4\n    and public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n    and p","replacement":"4\n    and v_lifecycle_once_2\n    and p","count":1},{"needle":"2\n    and public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()\n    and p","replacement":"2\n    and v_lifecycle_once_5\n    and p","count":1},{"needle":"5\n    and public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()\n    and p","replacement":"5\n    and v_lifecycle_once_6\n    and p","count":1},{"needle":"6\n    and public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()\n    and p","replacement":"6\n    and v_lifecycle_once_7\n    and p","count":1},{"needle":"7\n    and public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()\n    and p","replacement":"7\n    and v_lifecycle_once_8\n    and p","count":1},{"needle":"8\n    and public.hotel_v2_external_calendar_provider_sources_are_attributable()\n    and h","replacement":"8\n    and v_lifecycle_once_9\n    and h","count":1},{"needle":"9\n    and hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()\n    and v","replacement":"9\n    and v_lifecycle_once_10\n    and v","count":1},{"needle":" public.hotel_v2_seven_arches_owner_capabilities()\n","replacement":" v_lifecycle_once_11\n","count":1},{"needle":" public.hotel_v2_seven_arches_pricing_scoped_lineage() ","replacement":" v_lifecycle_once_3 ","count":1},{"needle":" public.hotel_v2_7a_pricing_activation_transaction_is_preserved()\n","replacement":" v_lifecycle_once_4\n","count":1},{"needle":"d public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n ","replacement":"d v_lifecycle_once_2\n ","count":1},{"needle":"2\n    and public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()\n    and p","replacement":"2\n    and v_lifecycle_once_5\n    and p","count":1},{"needle":"5\n    and public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()\n    and p","replacement":"5\n    and v_lifecycle_once_6\n    and p","count":1},{"needle":"6\n    and public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()\n    and p","replacement":"6\n    and v_lifecycle_once_7\n    and p","count":1},{"needle":"7\n    and public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()\n    and p","replacement":"7\n    and v_lifecycle_once_8\n    and p","count":1},{"needle":"8\n    and public.hotel_v2_external_calendar_provider_sources_are_attributable()\n    and h","replacement":"8\n    and v_lifecycle_once_9\n    and h","count":1},{"needle":" hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()\n","replacement":" v_lifecycle_once_10\n","count":1},{"needle":" public.hotel_v2_seven_arches_owner_capabilities())","replacement":" v_lifecycle_once_11)","count":1},{"needle":" public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n","replacement":" v_lifecycle_once_2\n","count":1},{"needle":" public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()\n","replacement":" v_lifecycle_once_5\n","count":1},{"needle":" public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()\n","replacement":" v_lifecycle_once_6\n","count":1},{"needle":" public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()\n","replacement":" v_lifecycle_once_7\n","count":1},{"needle":" public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()\n","replacement":" v_lifecycle_once_8\n","count":1},{"needle":" public.hotel_v2_external_calendar_provider_sources_are_attributable()\n","replacement":" v_lifecycle_once_9\n","count":1},{"needle":" hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact())","replacement":" v_lifecycle_once_10)","count":1},{"needle":"declare","replacement":"declare\n  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.\n  v_lifecycle_once_0 constant jsonb:=public.hotel_v2_external_calendar_activation_function_fingerprints();\n  v_lifecycle_once_1 constant boolean:=public.hotel_v2_partner_workspace_function_lineage_is_exact();\n  v_lifecycle_once_2 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();\n  v_lifecycle_once_3 constant jsonb:=public.hotel_v2_seven_arches_pricing_scoped_lineage();\n  v_lifecycle_once_4 constant boolean:=public.hotel_v2_7a_pricing_activation_transaction_is_preserved();\n  v_lifecycle_once_5 constant boolean:=public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact();\n  v_lifecycle_once_6 constant boolean:=public.hotel_v2_seven_arches_independent_pricing_topology_is_exact();\n  v_lifecycle_once_7 constant boolean:=public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact();\n  v_lifecycle_once_8 constant boolean:=public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact();\n  v_lifecycle_once_9 constant boolean:=public.hotel_v2_external_calendar_provider_sources_are_attributable();\n  v_lifecycle_once_10 constant boolean:=hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact();\n  v_lifecycle_once_11 constant jsonb:=public.hotel_v2_seven_arches_owner_capabilities();","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()","before":"1ceacd910ff472446e3da8c2d6ffe692ef01db704524426bfb0aaebdb8e2cfd0","after":"6e53ef01e748a54cb1dbbae5d35010a343aa4331a0c5450a4d2fc967a1e253fd","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":9},{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":3},{"needle":"setting.hotel_rooms_v2_enabled is not distinct from false","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled)","count":1},{"needle":"setting.hotel_stripe_connect_enabled is not distinct from false","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled)","count":1},{"needle":"and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())\n     o","replacement":"and not v_lifecycle_once_0)\n     o","count":1},{"needle":"r public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())\n","replacement":"r v_lifecycle_once_0)\n","count":1},{"needle":"r public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()))","replacement":"r v_lifecycle_once_0))","count":1},{"needle":"t public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())\n","replacement":"t v_lifecycle_once_0)\n","count":1},{"needle":" public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())","replacement":" v_lifecycle_once_0)","count":1},{"needle":"declare","replacement":"declare\n  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.\n  v_lifecycle_once_0 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)","before":"786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef","after":"0715f51bc7f331754c7fcc4fada0585a59675b6ae286d1fe5dc394aff16c2e28","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":9}],"metadata":{"acl":[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth","statement_timeout=60s"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"v","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_7a_pricing_activation_transaction_is_preserved()","before":"1e3c8c0d3383d8ecc384ff1da4e7ddf687bb8ae3f957247e1a63f6196f92ea81","after":"1e74c1b709abb1fb29de0283d37d03325fd0ed7d5f6a01567a73174f8c6e983e","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":2}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()","before":"fd5ec022e7e2483b2f2febcb17267e2750e634f8d3f296425a49768268420a1a","after":"17b801fefd47c93859f1e7868b606d3d56288dd590f931aa4c385148a72d85cc","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":5},{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":1},{"needle":"setting.hotel_rooms_v2_enabled is not distinct from false","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled)","count":1},{"needle":"setting.hotel_stripe_connect_enabled is not distinct from false","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled)","count":1},{"needle":")\n      or public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())\n    and e","replacement":")\n      or v_lifecycle_once_0)\n    and e","count":1},{"needle":" public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())","replacement":" v_lifecycle_once_0)","count":1},{"needle":"declare","replacement":"declare\n  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.\n  v_lifecycle_once_0 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_seven_arches_independent_pricing_legacy_projection()","before":"1d7a7fe016be8d615660a92e5ef911754bc858154e1b909592e4266476a7a57a","after":"b596013a158f7358a1ca7514bff6228d0dc88c2e4e1c7b2e4f6ee7437ecbac75","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":13},{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":3},{"needle":"setting.hotel_rooms_v2_enabled is not distinct from false","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled)","count":1},{"needle":"setting.hotel_stripe_connect_enabled is not distinct from false","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()","before":"9e9cc99a27d6397d4ec769df213b5a0344c5f0a7dcaf828a5b07683c09b7f932","after":"3ff36a3245901ea37f53e6dfbf9213e1bc72f127b7531041904833d5993eef17","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()","before":"25b49120d68a6500f8a52eff105f197cfc6bd659467f0c5f903651efca40f044","after":"2b2be7bc649fd8c152a5c07e1f2aef62d8ec837d29d77adfd78ff4603e794a07","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":16},{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":2},{"needle":"')\n       and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())\n     or v_founda","replacement":"')\n       and not v_lifecycle_once_0)\n     or v_founda","count":1},{"needle":"))\n       and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())\n     or v_founda","replacement":"))\n       and not v_lifecycle_once_0)\n     or v_founda","count":1},{"needle":" public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()\n","replacement":" v_lifecycle_once_1\n","count":1},{"needle":" public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())","replacement":" v_lifecycle_once_0)","count":1},{"needle":" public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint(),","replacement":" v_lifecycle_once_1,","count":1},{"needle":"declare","replacement":"declare\n  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.\n  v_lifecycle_once_0 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();\n  v_lifecycle_once_1 constant text:=public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint();","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()","before":"c0e257ae4a8bbf8fae16270025dbbd34490ff39ebeda1733e26de1215b372e0e","after":"448e4e89c367efe15c33c3c6fa0a92f4d9972957da130b365536c15bd25fc69a","patches":[{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_public_quote_seven_arches(jsonb)","before":"df28183f1566e5d4a9a234373c3fdd1976935774f58f9b37b69c2361e597e81c","after":"9968579d255778c5f632d8e566a2bcc49b370e23bfb61bffb1a95792136b22ca","patches":[{"needle":"where id=1 and hotel_rooms_v2_enabled is true)","replacement":"where id=1 and hotel_rooms_v2_enabled is true\n      and hotels_lifecycle_private.public_booking_enabled())","count":1}],"metadata":{"acl":[["anon","EXECUTE",false],["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"v","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_external_calendar_guard_source()","before":"fa7de473c2ab0c4a9ef038baa3bcc1058d0d013eb809d930bcd5ef29ebb969f5","after":"420566d02e827709d6b0cf3e5f671216ef10789beb9b693b4df70314a48c5fba","patches":[{"needle":"not hotel_rooms_v2_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled)","count":1},{"needle":"not hotel_stripe_connect_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',hotel_stripe_connect_enabled)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"v","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_external_calendar_provider_protected_fingerprints()","before":"4fbaaf830310f6cd1bf8500255f812c43cee95c71a679f44c6e0b72fa421c74a","after":"70e1931dc0e075af8ac9139936dd7388668e38f5880a2d229a3f9834bda52acd","patches":[{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":2}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_external_calendar_provider_evolution_is_safe()","before":"07c8246f8729217b497cb0e15834406fa80b1c3caf44b28f1128771a569777b3","after":"04cedf05665423bd1f01dc28aefe9be7e59ae34688601bcee759b57cc099c5a3","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":5},{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":7},{"needle":"(public.hotel_v2_seven_arches_pricing_scoped_lineage())","replacement":"((SELECT value FROM v_lifecycle_once_0))","count":1},{"needle":"and public.hotel_v2_seven_arches_pricing_scoped_lineage()->>'","replacement":"and (SELECT value FROM v_lifecycle_once_0)->>'","count":1},{"needle":" public.hotel_v2_seven_arches_pricing_scoped_lineage()-","replacement":" (SELECT value FROM v_lifecycle_once_0)-","count":1},{"needle":" public.hotel_v2_external_calendar_site_settings_fingerprint()\n","replacement":" (SELECT value FROM v_lifecycle_once_1)\n","count":1},{"needle":"e()'=\n      hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()->\n      'pu","replacement":"e()'=\n      (SELECT value FROM v_lifecycle_once_2)->\n      'pu","count":1},{"needle":" hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()-","replacement":" (SELECT value FROM v_lifecycle_once_2)-","count":1},{"needle":"=hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()\n","replacement":"=(SELECT value FROM v_lifecycle_once_2)\n","count":1},{"needle":" public.hotel_v2_external_calendar_site_settings_fingerprint() ","replacement":" (SELECT value FROM v_lifecycle_once_1) ","count":1},{"needle":"d coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>\n      'o","replacement":"d coalesce(((SELECT value FROM v_lifecycle_once_3)->>\n      'o","count":1},{"needle":"d coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>\n      's","replacement":"d coalesce(((SELECT value FROM v_lifecycle_once_3)->>\n      's","count":1},{"needle":"(public.hotel_v2_admin_d_current_foundation_snapshot()-","replacement":"((SELECT value FROM v_lifecycle_once_3)-","count":1},{"needle":"\nselect coalesce((se","replacement":"\nWITH v_lifecycle_once_0 AS MATERIALIZED (SELECT public.hotel_v2_seven_arches_pricing_scoped_lineage() AS value),\nv_lifecycle_once_1 AS MATERIALIZED (SELECT public.hotel_v2_external_calendar_site_settings_fingerprint() AS value),\nv_lifecycle_once_2 AS MATERIALIZED (SELECT hotels_v2_private.hotel_external_calendar_provider_function_fingerprints() AS value),\nv_lifecycle_once_3 AS MATERIALIZED (SELECT public.hotel_v2_admin_d_current_foundation_snapshot() AS value)\n\nselect coalesce((se","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_external_calendar_stage2_compatible_fingerprints()","before":"3cc1148945a35dd044203e88f5153374adf112188b84e83ce47f03d5a3193eca","after":"8fbfdbc8807fb6efee5371ed9126da892fc958474f943a6098f583e31af39096","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":1},{"needle":"not hotel_rooms_v2_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled)","count":1},{"needle":"not hotel_stripe_connect_enabled","replacement":"hotels_lifecycle_private.predecessor_flag_exact('hotel_stripe_connect_enabled',hotel_stripe_connect_enabled)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()","before":"0479f3728660aeedcd94c8ca2228c174b778a9df43ccd64449965ff30073fc32","after":"c34259ae9d3cf5fe3fd296e6c79bfafc8238b34ab65111edef0c4c46f2a78b6e","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":1},{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":4}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()","before":"7f35ba043a7bf730aa70204438f59639e743a80f7937a3be5b8efa793a7b113a","after":"0469f5be71cfaeaa3656bb31cdbf9c89e4284817229ac98971d833216122bbf5","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()","before":"2a69f53d963d295b767dc5d4b17a5df7c175513efe5f36e9aac350746091d1cd","after":"c6bd94ce0c4d1d01709acd21c64b2270a16d23c7bf9402ecdba0d669d8fc88dd","patches":[{"needle":"procedure_row.prosrc","replacement":"hotels_lifecycle_private.predecessor_source(procedure_row.oid)","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}},{"signature":"hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()","before":"2a122fdadc46adcdfd8114f4a011fe6d28d2dd9710bc2cc9830cc98178c2889e","after":"7a8e5e487451c8834dd42d7ab89a47742e4006d0e92d87480b1c643e288aef5a","patches":[{"needle":"pg_get_functiondef(","replacement":"hotels_lifecycle_private.predecessor_definition(","count":1}],"metadata":{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}}]$manifest$::jsonb) LOOP
  oid_value:=to_regprocedure(e->>'signature');
  SELECT prosrc INTO STRICT src FROM pg_proc WHERE oid=oid_value;
  IF encode(extensions.digest(convert_to(src,'UTF8'),'sha256'),'hex') IS DISTINCT FROM e->>'before'
   OR (SELECT proowner FROM pg_proc WHERE oid=oid_value)<>'postgres'::regrole THEN
   RAISE EXCEPTION 'hotels_lifecycle_source_boundary_mismatch: %',e->>'signature';
  END IF;
  before_meta:=hotels_lifecycle_private.metadata(oid_value);
  IF before_meta IS DISTINCT FROM e->'metadata' THEN RAISE EXCEPTION 'hotels_lifecycle_before_metadata_drift: %',e->>'signature'; END IF;
  before_def:=pg_get_functiondef(oid_value); before_src:=src;
  FOR patch IN SELECT value FROM jsonb_array_elements(e->'patches') LOOP
   IF (length(src)-length(replace(src,patch->>'needle','')))/length(patch->>'needle')<>(patch->>'count')::integer THEN
    RAISE EXCEPTION 'hotels_lifecycle_patch_cardinality_mismatch: %',e->>'signature';
   END IF;
   src:=replace(src,patch->>'needle',patch->>'replacement');
  END LOOP;
  IF encode(extensions.digest(convert_to(src,'UTF8'),'sha256'),'hex') IS DISTINCT FROM e->>'after' THEN
   RAISE EXCEPTION 'hotels_lifecycle_after_source_mismatch'; END IF;
  def:=replace(before_def,before_src,src); EXECUTE def;
  IF hotels_lifecycle_private.metadata(oid_value) IS DISTINCT FROM before_meta THEN
   RAISE EXCEPTION 'hotels_lifecycle_metadata_not_preserved'; END IF;
  INSERT INTO hotels_lifecycle_private.bindings VALUES(e->>'signature',before_src,before_def,e->>'before',e->>'after',before_meta);
 END LOOP;
END $evolve$;

DO $security$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='hotels_lifecycle_private' AND c.relkind='r' LOOP
  EXECUTE format('ALTER TABLE %s OWNER TO postgres',r.oid::regclass);
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',r.oid::regclass);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',r.oid::regclass);
  EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,anon,authenticated,service_role',r.oid::regclass);
  IF r.relname IN ('bindings','foundation') THEN
   EXECUTE format('CREATE TRIGGER lifecycle_immutable BEFORE INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION hotels_lifecycle_private.immutable()',r.oid::regclass);
   EXECUTE format('CREATE TRIGGER lifecycle_no_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION hotels_lifecycle_private.immutable()',r.oid::regclass);
  END IF;
 END LOOP;
 FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='hotels_lifecycle_private' OR p.proname IN ('hotel_v2_admin_get_capability_lifecycle','hotel_v2_admin_set_capability_lifecycle','hotel_v2_attest_stripe_platform_readiness') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.oid::regprocedure);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.oid::regprocedure);
 END LOOP;
END $security$;
GRANT EXECUTE ON FUNCTION public.hotel_v2_admin_get_capability_lifecycle(),
 public.hotel_v2_admin_set_capability_lifecycle(text,boolean,bigint,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_v2_attest_stripe_platform_readiness(uuid,boolean,text) TO service_role;
-- One installation receipt. Its trigger is installed immediately after insertion.
ALTER TABLE hotels_lifecycle_private.foundation DISABLE TRIGGER lifecycle_immutable;
INSERT INTO hotels_lifecycle_private.foundation VALUES(1,hotels_lifecycle_private.actual_flags(),
 hotels_lifecycle_private.catalog_snapshot(),hotels_lifecycle_private.predecessor_receipts());
ALTER TABLE hotels_lifecycle_private.foundation ENABLE TRIGGER lifecycle_immutable;
-- The seal must reflect the final enabled trigger, never its installation state.
ALTER TABLE hotels_lifecycle_private.foundation DISABLE TRIGGER lifecycle_immutable;
UPDATE hotels_lifecycle_private.foundation SET catalog=jsonb_set(catalog,'{relations}',
 (SELECT jsonb_agg(CASE WHEN e->>'name'='foundation' THEN jsonb_set(e,'{triggers}',
  (SELECT jsonb_agg(CASE WHEN t->>0='lifecycle_immutable' THEN jsonb_set(t,'{1}','"O"'::jsonb) ELSE t END) FROM jsonb_array_elements(e->'triggers') t)) ELSE e END)
 FROM jsonb_array_elements(catalog->'relations') e));
ALTER TABLE hotels_lifecycle_private.foundation ENABLE TRIGGER lifecycle_immutable;
DO $post$
BEGIN
 PERFORM hotels_lifecycle_private.safe_state();
 IF public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
 OR EXISTS(SELECT 1 FROM hotels_lifecycle_private.decisions)
 OR EXISTS(SELECT 1 FROM hotels_lifecycle_private.context)
 OR hotels_lifecycle_private.actual_flags() IS DISTINCT FROM (SELECT initial_flags FROM hotels_lifecycle_private.foundation WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_lifecycle_install_postcondition_failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;
