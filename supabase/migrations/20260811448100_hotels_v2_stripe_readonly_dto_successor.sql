-- 114481: safe Stripe DTO successor; no activation, account, authorization or money write.
-- Source provenance: exact post-114480 pins; only six bound functions evolve.
-- Historical receipts and binding rows remain byte-identical. The new immutable
-- certificate authenticates each BEFORE projection against the exact live AFTER.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
LOCK TABLE public.site_settings,public.hotel_partner_hotel_permissions,
 hotel_stripe_connect_private.accounts,hotel_stripe_connect_private.onboarding_authorizations,
 hotels_lifecycle_private.stripe_readiness,hotels_lifecycle_private.decisions IN SHARE MODE;
DO $pre$ BEGIN
 IF to_regnamespace('hotels_stripe_dto_private') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448000')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448000')
 THEN RAISE EXCEPTION 'hotels_114481_boundary_mismatch'; END IF;
 IF (hotels_lineage_private.current_anchor_is_exact() IS TRUE
 AND hotels_lifecycle_private.safe_state() @> '{"public_booking_enabled":false,"architecture":"legacy","feature_flags":{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}}'::jsonb
 AND EXISTS(SELECT 1 FROM public.hotel_partner_hotel_permissions p WHERE p.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 AND p.partner_id=(hotels_lineage_private.permission_evidence()->>'partner_id')::uuid
 AND p.assignment_id=(hotels_lineage_private.permission_evidence()->>'assignment_id')::uuid AND p.version=2)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.onboarding_authorizations)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.accounts)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.oauth_states)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.stripe_readiness)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.context)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.decisions)
 AND public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE) IS NOT TRUE THEN RAISE EXCEPTION 'hotels_114481_precondition_failed'; END IF;
END $pre$;
CREATE SCHEMA hotels_stripe_dto_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA hotels_stripe_dto_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hotels_stripe_dto_private.bindings(signature text PRIMARY KEY,before_source text NOT NULL,
 before_definition text NOT NULL,before_hash text NOT NULL,after_hash text NOT NULL,
 metadata jsonb NOT NULL,after_source text NOT NULL);
CREATE TABLE hotels_stripe_dto_private.certificate(id integer PRIMARY KEY CHECK(id=1),binding_hash text NOT NULL,
 helper_catalog jsonb NOT NULL,relation_catalog jsonb NOT NULL,business_hash text NOT NULL);
CREATE FUNCTION hotels_stripe_dto_private.helper_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='hotels_stripe_dto_private'
$f$;
CREATE FUNCTION hotels_stripe_dto_private.relation_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT jsonb_build_object('schema',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl)
 FROM pg_namespace WHERE nspname='hotels_stripe_dto_private'),
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
 'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
 'policies',(SELECT jsonb_agg(to_jsonb(p)-'oid'-'polrelid') FROM pg_policy p WHERE p.polrelid=c.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hotels_stripe_dto_private' AND c.relkind IN('r','p','v','m','f')))
$f$;
CREATE FUNCTION hotels_stripe_dto_private.business_hash() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE r record; h text; values_json jsonb:='{}';
BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN('r','p') AND n.nspname IN('public','hotels_lineage_private','hotels_lifecycle_private','hotel_stripe_connect_private','hotels_v2_private') ORDER BY 1,2 LOOP
  EXECUTE format('SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),''[]''::jsonb)::text,''UTF8'')),''hex'') FROM %I.%I x',r.nspname,r.relname) INTO h;
  values_json:=values_json||jsonb_build_object(r.nspname||'.'||r.relname,h);
 END LOOP;
 RETURN encode(sha256(convert_to(values_json::text,'UTF8')),'hex');
END $f$;
CREATE FUNCTION hotels_stripe_dto_private.assert_exact() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE c hotels_stripe_dto_private.certificate%rowtype;
BEGIN
 SELECT * INTO STRICT c FROM hotels_stripe_dto_private.certificate WHERE id=1;
 IF EXISTS(SELECT 1 FROM (VALUES ('hotels_stripe_dto_private.helper_catalog()','1762100fee5e72a4a349d8789adac731880eec19c0592316bd597f56e7256e20'),('hotels_stripe_dto_private.relation_catalog()','d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44')) e(signature,expected_hash)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IS DISTINCT FROM e.expected_hash)
 OR c.helper_catalog IS DISTINCT FROM hotels_stripe_dto_private.helper_catalog()
 OR c.relation_catalog IS DISTINCT FROM hotels_stripe_dto_private.relation_catalog()
 OR c.binding_hash IS DISTINCT FROM (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,'UTF8')),'hex') FROM hotels_stripe_dto_private.bindings b)
 OR (SELECT count(*) FROM hotels_stripe_dto_private.bindings)<>6
 OR EXISTS(SELECT 1 FROM hotels_stripe_dto_private.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IS DISTINCT FROM b.after_hash
 OR encode(sha256(convert_to(b.before_source,'UTF8')),'hex') IS DISTINCT FROM b.before_hash
 OR encode(sha256(convert_to(b.after_source,'UTF8')),'hex') IS DISTINCT FROM b.after_hash
 OR hotels_lifecycle_private.metadata(p.oid) IS DISTINCT FROM b.metadata)
 THEN RAISE EXCEPTION 'hotels_114481_source_security_drift'; END IF;
END $f$;
CREATE FUNCTION hotels_stripe_dto_private.predecessor_source(p_oid oid) RETURNS text
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE s text; b hotels_stripe_dto_private.bindings%rowtype;
BEGIN
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
  WHERE oid='hotels_stripe_dto_private.assert_exact()'::regprocedure) IS DISTINCT FROM
  (SELECT helper_catalog->'hotels_stripe_dto_private.assert_exact()'->>0 FROM hotels_stripe_dto_private.certificate WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_114481_assertion_source_drift'; END IF;
 SELECT * INTO b FROM hotels_stripe_dto_private.bindings WHERE to_regprocedure(signature)=p_oid;
 SELECT prosrc INTO s FROM pg_proc WHERE oid=p_oid;
 IF b.signature IS NOT NULL THEN
  IF encode(sha256(convert_to(s,'UTF8')),'hex') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.metadata
  THEN RAISE EXCEPTION 'hotels_114481_bound_source_drift'; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END $f$;
CREATE FUNCTION hotels_stripe_dto_private.predecessor_definition(p_oid oid) RETURNS text
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE d text;
BEGIN
 PERFORM hotels_stripe_dto_private.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM hotels_stripe_dto_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END $f$;
INSERT INTO hotels_stripe_dto_private.bindings VALUES
('public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)','
declare v_state jsonb;
begin
  if auth.uid() is null then raise exception using errcode=''42501'',message=''hotel_stripe_authorization_admin_required'';end if;
  perform public.hotel_v2_h2a_require_admin();
  if p_partner_id is null or not exists(select 1 from public.partners where id=p_partner_id) then
    raise exception using errcode=''22023'',message=''hotel_stripe_authorization_partner_required'';end if;
  v_state:=hotel_stripe_connect_private.authorization_state(p_partner_id);
  return jsonb_build_object(''contract_version'',''hotels_v2_partner_stripe_authorization_control_v1'',
    ''partner_id'',p_partner_id,''version'',(v_state->>''version'')::bigint,''enabled'',(v_state->>''enabled'')::boolean,
    ''platform_enabled'',(select hotel_stripe_connect_enabled from public.site_settings where id=1));
end
','CREATE OR REPLACE FUNCTION public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(p_partner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public'', ''auth''
AS $function$
declare v_state jsonb;
begin
  if auth.uid() is null then raise exception using errcode=''42501'',message=''hotel_stripe_authorization_admin_required'';end if;
  perform public.hotel_v2_h2a_require_admin();
  if p_partner_id is null or not exists(select 1 from public.partners where id=p_partner_id) then
    raise exception using errcode=''22023'',message=''hotel_stripe_authorization_partner_required'';end if;
  v_state:=hotel_stripe_connect_private.authorization_state(p_partner_id);
  return jsonb_build_object(''contract_version'',''hotels_v2_partner_stripe_authorization_control_v1'',
    ''partner_id'',p_partner_id,''version'',(v_state->>''version'')::bigint,''enabled'',(v_state->>''enabled'')::boolean,
    ''platform_enabled'',(select hotel_stripe_connect_enabled from public.site_settings where id=1));
end
$function$
','45dc3a00c73a0f031298523cf41e9ffeac90e1e46c50c532b796a231276de473','0515e9b4ce45815ab3d55585d47c1027f914e4b8b48dcda760386147f53e6fdd','{"acl":[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb,'
declare v_state jsonb;
begin
  if auth.uid() is null then raise exception using errcode=''42501'',message=''hotel_stripe_authorization_admin_required'';end if;
  perform public.hotel_v2_h2a_require_admin();
  if p_partner_id is null or not exists(select 1 from public.partners where id=p_partner_id) then
    raise exception using errcode=''22023'',message=''hotel_stripe_authorization_partner_required'';end if;
  perform hotels_stripe_dto_private.predecessor_source(''public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)''::regprocedure);
  perform hotels_stripe_dto_private.assert_exact();
  v_state:=hotel_stripe_connect_private.authorization_state(p_partner_id);
  return jsonb_build_object(''contract_version'',''hotels_v2_partner_stripe_authorization_control_v1'',
    ''partner_id'',p_partner_id,''version'',(v_state->>''version'')::bigint,''enabled'',(v_state->>''enabled'')::boolean,
    ''platform_enabled'',(select hotel_stripe_connect_enabled from public.site_settings where id=1),
    ''account_exists'',exists(select 1 from hotel_stripe_connect_private.accounts where partner_id=p_partner_id),
    ''account_status'',coalesce((select status from hotel_stripe_connect_private.accounts where partner_id=p_partner_id),''NOT_CONNECTED''));
end
'),
('hotels_lifecycle_private.partner_connection(uuid,uuid)','
DECLARE permitted boolean; a hotel_stripe_connect_private.accounts%rowtype; platform boolean;
BEGIN
 PERFORM public.hotel_v2_h3_2a_require_partner_hotel_access(p_partner_id,p_hotel_id,null,false);
 platform:=(hotels_lifecycle_private.safe_state()->''feature_flags''->>''hotel_stripe_connect_enabled'')::boolean;
 permitted:=EXISTS(SELECT 1 FROM public.partner_users WHERE partner_id=p_partner_id AND user_id=auth.uid() AND role=''owner'')
  AND (hotel_stripe_connect_private.authorization_state(p_partner_id)->>''enabled'')::boolean;
 SELECT * INTO a FROM hotel_stripe_connect_private.accounts WHERE partner_id=p_partner_id;
 RETURN jsonb_build_object(''contract_version'',''hotels_partner_stripe_capability_v1'',''partner_id'',p_partner_id,''hotel_id'',p_hotel_id,
 ''platform_enabled'',platform,''onboarding_authorized'',permitted,''account_status'',coalesce(a.status,''NOT_CONNECTED''),
 ''checked_at'',a.checked_at,''can_connect'',platform AND permitted AND (a.partner_id IS NULL OR a.status=''ONBOARDING_INCOMPLETE''));
END ','CREATE OR REPLACE FUNCTION hotels_lifecycle_private.partner_connection(p_partner_id uuid, p_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public'', ''auth''
AS $function$
DECLARE permitted boolean; a hotel_stripe_connect_private.accounts%rowtype; platform boolean;
BEGIN
 PERFORM public.hotel_v2_h3_2a_require_partner_hotel_access(p_partner_id,p_hotel_id,null,false);
 platform:=(hotels_lifecycle_private.safe_state()->''feature_flags''->>''hotel_stripe_connect_enabled'')::boolean;
 permitted:=EXISTS(SELECT 1 FROM public.partner_users WHERE partner_id=p_partner_id AND user_id=auth.uid() AND role=''owner'')
  AND (hotel_stripe_connect_private.authorization_state(p_partner_id)->>''enabled'')::boolean;
 SELECT * INTO a FROM hotel_stripe_connect_private.accounts WHERE partner_id=p_partner_id;
 RETURN jsonb_build_object(''contract_version'',''hotels_partner_stripe_capability_v1'',''partner_id'',p_partner_id,''hotel_id'',p_hotel_id,
 ''platform_enabled'',platform,''onboarding_authorized'',permitted,''account_status'',coalesce(a.status,''NOT_CONNECTED''),
 ''checked_at'',a.checked_at,''can_connect'',platform AND permitted AND (a.partner_id IS NULL OR a.status=''ONBOARDING_INCOMPLETE''));
END $function$
','e47e5f9c1101cc829a7b263080b7b2b3d046be4103016d1da3298f0714145793','f46e6a3fb6e534739c91a61abeec102c32b67500b7d597d954ea01e57a3dedbc','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb,'
DECLARE permitted boolean; a hotel_stripe_connect_private.accounts%rowtype; platform boolean; attestation text;
BEGIN
 PERFORM public.hotel_v2_h3_2a_require_partner_hotel_access(p_partner_id,p_hotel_id,null,false);
 platform:=(hotels_lifecycle_private.safe_state()->''feature_flags''->>''hotel_stripe_connect_enabled'')::boolean;
 permitted:=EXISTS(SELECT 1 FROM public.partner_users WHERE partner_id=p_partner_id AND user_id=auth.uid() AND role=''owner'')
  AND (hotel_stripe_connect_private.authorization_state(p_partner_id)->>''enabled'')::boolean;
 PERFORM hotels_stripe_dto_private.predecessor_source(''hotels_lifecycle_private.partner_connection(uuid,uuid)''::regprocedure);
 PERFORM hotels_stripe_dto_private.assert_exact();
 SELECT coalesce((SELECT CASE
  WHEN contract_version IS DISTINCT FROM ''hotels_standard_connect_server_v1'' OR ready IS NOT TRUE THEN ''NOT_READY''
  WHEN checked_at<=statement_timestamp()-interval ''15 minutes'' THEN ''STALE''
  ELSE ''READY'' END FROM hotels_lifecycle_private.stripe_readiness
  ORDER BY checked_at DESC,request_id DESC LIMIT 1),''MISSING'') INTO attestation;
 SELECT * INTO a FROM hotel_stripe_connect_private.accounts WHERE partner_id=p_partner_id;
 RETURN jsonb_build_object(''contract_version'',''hotels_partner_stripe_capability_v1'',''partner_id'',p_partner_id,''hotel_id'',p_hotel_id,
 ''platform_enabled'',platform,''onboarding_authorized'',permitted,''account_status'',coalesce(a.status,''NOT_CONNECTED''),
 ''checked_at'',a.checked_at,''platform_ready'',attestation=''READY'',''attestation_status'',attestation,''can_connect'',platform AND permitted AND (a.partner_id IS NULL OR a.status=''ONBOARDING_INCOMPLETE''));
END '),
('hotels_lifecycle_private.catalog_snapshot()','
 SELECT jsonb_build_object(
 ''bindings'',(SELECT jsonb_agg(to_jsonb(b) ORDER BY signature) FROM hotels_lifecycle_private.bindings b),
 ''evolved'',(SELECT jsonb_object_agg(b.signature,jsonb_build_array(
  encode(extensions.digest(convert_to(p.prosrc,''UTF8''),''sha256''),''hex''),hotels_lifecycle_private.metadata(p.oid)) ORDER BY b.signature)
  FROM hotels_lifecycle_private.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)),
 ''authorization_dependencies'',(SELECT jsonb_object_agg(p.oid::regprocedure::text,
 jsonb_build_array(hotels_lifecycle_private.hash(to_jsonb(p.prosrc)),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotel_stripe_connect_private''
 OR p.proname IN (''hotel_v2_stripe_connect_service'',''hotel_v2_admin_get_partner_stripe_onboarding_authorization'',
 ''hotel_v2_admin_set_partner_stripe_onboarding_authorization'',''hotel_v2_h2a_require_admin'',''is_current_user_admin'')),
 ''schema'',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl) FROM pg_namespace WHERE nspname=''hotels_lifecycle_private''),
 ''functions'',(SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''metadata'',hotels_lifecycle_private.metadata(p.oid),
 ''hash'',hotels_lifecycle_private.hash(to_jsonb(p.prosrc))) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotels_lifecycle_private''
 OR p.proname IN (''hotel_v2_admin_get_capability_lifecycle'',''hotel_v2_admin_set_capability_lifecycle'',''hotel_v2_attest_stripe_platform_readiness'')),
 ''relations'',(SELECT jsonb_agg(jsonb_build_object(''name'',c.relname,''owner'',pg_get_userbyid(c.relowner),''kind'',c.relkind,
 ''persistence'',c.relpersistence,''rls'',c.relrowsecurity,''force'',c.relforcerowsecurity,''acl'',c.relacl,
 ''columns'',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid::regtype::text,a.atttypmod,a.attnotnull,
 a.attidentity,a.attgenerated,a.attcollation::regcollation::text,
 (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 ''constraints'',(SELECT jsonb_agg(jsonb_build_array(conname,convalidated,pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
 ''policies'',(SELECT jsonb_agg(to_jsonb(p)-''oid''-''polrelid'') FROM pg_policy p WHERE p.polrelid=c.oid),
 ''triggers'',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.tgname)
 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN (''hotels_lifecycle_private'',''hotel_stripe_connect_private'') AND c.relkind IN (''r'',''p'')),
 ''settings_guard'',(SELECT jsonb_build_array(t.tgenabled,pg_get_triggerdef(t.oid)) FROM pg_trigger t
 WHERE t.tgrelid=''public.site_settings''::regclass AND t.tgname=''hotels_capability_lifecycle_guard''))
','CREATE OR REPLACE FUNCTION hotels_lifecycle_private.catalog_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
 SELECT jsonb_build_object(
 ''bindings'',(SELECT jsonb_agg(to_jsonb(b) ORDER BY signature) FROM hotels_lifecycle_private.bindings b),
 ''evolved'',(SELECT jsonb_object_agg(b.signature,jsonb_build_array(
  encode(extensions.digest(convert_to(p.prosrc,''UTF8''),''sha256''),''hex''),hotels_lifecycle_private.metadata(p.oid)) ORDER BY b.signature)
  FROM hotels_lifecycle_private.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)),
 ''authorization_dependencies'',(SELECT jsonb_object_agg(p.oid::regprocedure::text,
 jsonb_build_array(hotels_lifecycle_private.hash(to_jsonb(p.prosrc)),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotel_stripe_connect_private''
 OR p.proname IN (''hotel_v2_stripe_connect_service'',''hotel_v2_admin_get_partner_stripe_onboarding_authorization'',
 ''hotel_v2_admin_set_partner_stripe_onboarding_authorization'',''hotel_v2_h2a_require_admin'',''is_current_user_admin'')),
 ''schema'',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl) FROM pg_namespace WHERE nspname=''hotels_lifecycle_private''),
 ''functions'',(SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''metadata'',hotels_lifecycle_private.metadata(p.oid),
 ''hash'',hotels_lifecycle_private.hash(to_jsonb(p.prosrc))) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotels_lifecycle_private''
 OR p.proname IN (''hotel_v2_admin_get_capability_lifecycle'',''hotel_v2_admin_set_capability_lifecycle'',''hotel_v2_attest_stripe_platform_readiness'')),
 ''relations'',(SELECT jsonb_agg(jsonb_build_object(''name'',c.relname,''owner'',pg_get_userbyid(c.relowner),''kind'',c.relkind,
 ''persistence'',c.relpersistence,''rls'',c.relrowsecurity,''force'',c.relforcerowsecurity,''acl'',c.relacl,
 ''columns'',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid::regtype::text,a.atttypmod,a.attnotnull,
 a.attidentity,a.attgenerated,a.attcollation::regcollation::text,
 (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 ''constraints'',(SELECT jsonb_agg(jsonb_build_array(conname,convalidated,pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
 ''policies'',(SELECT jsonb_agg(to_jsonb(p)-''oid''-''polrelid'') FROM pg_policy p WHERE p.polrelid=c.oid),
 ''triggers'',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.tgname)
 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN (''hotels_lifecycle_private'',''hotel_stripe_connect_private'') AND c.relkind IN (''r'',''p'')),
 ''settings_guard'',(SELECT jsonb_build_array(t.tgenabled,pg_get_triggerdef(t.oid)) FROM pg_trigger t
 WHERE t.tgrelid=''public.site_settings''::regclass AND t.tgname=''hotels_capability_lifecycle_guard''))
$function$
','ef46235b2ad39502b4d4787b34b817e7dee986a5ea0bd526c76690cb2f6b2a71','a9daaad29c3561c8191707fcef258d3fb734705058c4b15ec857ef2e554f5aa7','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb,'
 WITH dto_guard AS MATERIALIZED (SELECT hotels_stripe_dto_private.assert_exact())
SELECT jsonb_build_object(
 ''bindings'',(SELECT jsonb_agg(to_jsonb(b) ORDER BY signature) FROM hotels_lifecycle_private.bindings b),
 ''evolved'',(SELECT jsonb_object_agg(b.signature,jsonb_build_array(
  encode(extensions.digest(convert_to(hotels_stripe_dto_private.predecessor_source(p.oid),''UTF8''),''sha256''),''hex''),hotels_lifecycle_private.metadata(p.oid)) ORDER BY b.signature)
  FROM hotels_lifecycle_private.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)),
 ''authorization_dependencies'',(SELECT jsonb_object_agg(p.oid::regprocedure::text,
 jsonb_build_array(hotels_lifecycle_private.hash(to_jsonb(hotels_stripe_dto_private.predecessor_source(p.oid))),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotel_stripe_connect_private''
 OR p.proname IN (''hotel_v2_stripe_connect_service'',''hotel_v2_admin_get_partner_stripe_onboarding_authorization'',
 ''hotel_v2_admin_set_partner_stripe_onboarding_authorization'',''hotel_v2_h2a_require_admin'',''is_current_user_admin'')),
 ''schema'',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl) FROM pg_namespace WHERE nspname=''hotels_lifecycle_private''),
 ''functions'',(SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''metadata'',hotels_lifecycle_private.metadata(p.oid),
 ''hash'',hotels_lifecycle_private.hash(to_jsonb(hotels_stripe_dto_private.predecessor_source(p.oid)))) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotels_lifecycle_private''
 OR p.proname IN (''hotel_v2_admin_get_capability_lifecycle'',''hotel_v2_admin_set_capability_lifecycle'',''hotel_v2_attest_stripe_platform_readiness'')),
 ''relations'',(SELECT jsonb_agg(jsonb_build_object(''name'',c.relname,''owner'',pg_get_userbyid(c.relowner),''kind'',c.relkind,
 ''persistence'',c.relpersistence,''rls'',c.relrowsecurity,''force'',c.relforcerowsecurity,''acl'',c.relacl,
 ''columns'',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid::regtype::text,a.atttypmod,a.attnotnull,
 a.attidentity,a.attgenerated,a.attcollation::regcollation::text,
 (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 ''constraints'',(SELECT jsonb_agg(jsonb_build_array(conname,convalidated,pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
 ''policies'',(SELECT jsonb_agg(to_jsonb(p)-''oid''-''polrelid'') FROM pg_policy p WHERE p.polrelid=c.oid),
 ''triggers'',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.tgname)
 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN (''hotels_lifecycle_private'',''hotel_stripe_connect_private'') AND c.relkind IN (''r'',''p'')),
 ''settings_guard'',(SELECT jsonb_build_array(t.tgenabled,pg_get_triggerdef(t.oid)) FROM pg_trigger t
 WHERE t.tgrelid=''public.site_settings''::regclass AND t.tgname=''hotels_capability_lifecycle_guard'')) FROM dto_guard
'),
('hotels_lifecycle_private.predecessor_source(oid)','
DECLARE b hotels_lifecycle_private.bindings%rowtype; s text;
BEGIN
 SELECT prosrc INTO STRICT s FROM pg_proc WHERE oid=p_oid;
 SELECT * INTO b FROM hotels_lifecycle_private.bindings WHERE to_regprocedure(signature)=p_oid;
 IF FOUND THEN
  IF encode(extensions.digest(convert_to(s,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.after_metadata
   OR encode(extensions.digest(convert_to(b.before_source,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM b.before_hash
  THEN RAISE EXCEPTION ''hotels_lifecycle_evolved_source_security_drift''; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END ','CREATE OR REPLACE FUNCTION hotels_lifecycle_private.predecessor_source(p_oid oid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE STRICT SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
DECLARE b hotels_lifecycle_private.bindings%rowtype; s text;
BEGIN
 SELECT prosrc INTO STRICT s FROM pg_proc WHERE oid=p_oid;
 SELECT * INTO b FROM hotels_lifecycle_private.bindings WHERE to_regprocedure(signature)=p_oid;
 IF FOUND THEN
  IF encode(extensions.digest(convert_to(s,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.after_metadata
   OR encode(extensions.digest(convert_to(b.before_source,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM b.before_hash
  THEN RAISE EXCEPTION ''hotels_lifecycle_evolved_source_security_drift''; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END $function$
','e18f68f4948e3030079ae9c765fd27515a234b8d1d18079588a6c2dd32f9a1b5','983d1c22792ce60fcd73e71d1e5f3bfe6869f3b2ba734e92a4364f924741819f','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":true,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb,'
DECLARE b hotels_lifecycle_private.bindings%rowtype; s text;
BEGIN
 SELECT hotels_stripe_dto_private.predecessor_source(p_oid) INTO STRICT s;
 SELECT * INTO b FROM hotels_lifecycle_private.bindings WHERE to_regprocedure(signature)=p_oid;
 IF FOUND THEN
  IF encode(extensions.digest(convert_to(s,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.after_metadata
   OR encode(extensions.digest(convert_to(b.before_source,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM b.before_hash
  THEN RAISE EXCEPTION ''hotels_lifecycle_evolved_source_security_drift''; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END '),
('hotels_lineage_private.predecessor(oid)','
DECLARE r record; b jsonb; pin jsonb; s text; d text; m jsonb; signature text;
BEGIN
 SELECT CASE WHEN n.nspname=''public'' THEN ''public.'' ELSE '''' END||p.oid::regprocedure::text,
  encode(extensions.digest(convert_to(p.prosrc,''UTF8''),''sha256''),''hex''),
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(p.oid))) INTO signature,s,d
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid=p_oid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 m:=hotels_lineage_private.successor_metadata(p_oid);
 FOR r IN SELECT * FROM hotels_lineage_private.successor_receipts ORDER BY stage DESC LOOP
  b:=r.bindings->signature;
  IF b IS NULL THEN CONTINUE; END IF;
  pin:=hotels_lineage_private.successor_manifest(r.stage)->signature;
  IF pin IS NULL OR pin IS DISTINCT FROM b
   OR s IS DISTINCT FROM b->>''after_source''
   OR d IS DISTINCT FROM b->>''after_definition''
   OR m IS DISTINCT FROM b->''after_metadata''
  THEN RETURN NULL; END IF;
  s:=b->>''before_source''; d:=b->>''before_definition''; m:=b->''before_metadata'';
 END LOOP;
 RETURN jsonb_build_object(''source'',s,''definition'',d,''metadata'',m);
END ','CREATE OR REPLACE FUNCTION hotels_lineage_private.predecessor(p_oid oid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
DECLARE r record; b jsonb; pin jsonb; s text; d text; m jsonb; signature text;
BEGIN
 SELECT CASE WHEN n.nspname=''public'' THEN ''public.'' ELSE '''' END||p.oid::regprocedure::text,
  encode(extensions.digest(convert_to(p.prosrc,''UTF8''),''sha256''),''hex''),
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(p.oid))) INTO signature,s,d
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid=p_oid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 m:=hotels_lineage_private.successor_metadata(p_oid);
 FOR r IN SELECT * FROM hotels_lineage_private.successor_receipts ORDER BY stage DESC LOOP
  b:=r.bindings->signature;
  IF b IS NULL THEN CONTINUE; END IF;
  pin:=hotels_lineage_private.successor_manifest(r.stage)->signature;
  IF pin IS NULL OR pin IS DISTINCT FROM b
   OR s IS DISTINCT FROM b->>''after_source''
   OR d IS DISTINCT FROM b->>''after_definition''
   OR m IS DISTINCT FROM b->''after_metadata''
  THEN RETURN NULL; END IF;
  s:=b->>''before_source''; d:=b->>''before_definition''; m:=b->''before_metadata'';
 END LOOP;
 RETURN jsonb_build_object(''source'',s,''definition'',d,''metadata'',m);
END $function$
','36e662d92c41f3b3474f41fc0094c33ba049006769c6403254d0f185a2f1d087','f7371ac466fa1b3b95480d13e2447cd1817ae8a7bd76c439dd8673795d1f764c','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb,'
DECLARE r record; b jsonb; pin jsonb; s text; d text; m jsonb; signature text;
BEGIN
 SELECT CASE WHEN n.nspname=''public'' THEN ''public.'' ELSE '''' END||p.oid::regprocedure::text,
  encode(extensions.digest(convert_to(hotels_stripe_dto_private.predecessor_source(p.oid),''UTF8''),''sha256''),''hex''),
  public.hotel_v2_h3_2b_hash(to_jsonb(hotels_stripe_dto_private.predecessor_definition(p.oid))) INTO signature,s,d
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid=p_oid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 m:=hotels_lineage_private.successor_metadata(p_oid);
 FOR r IN SELECT * FROM hotels_lineage_private.successor_receipts ORDER BY stage DESC LOOP
  b:=r.bindings->signature;
  IF b IS NULL THEN CONTINUE; END IF;
  pin:=hotels_lineage_private.successor_manifest(r.stage)->signature;
  IF pin IS NULL OR pin IS DISTINCT FROM b
   OR s IS DISTINCT FROM b->>''after_source''
   OR d IS DISTINCT FROM b->>''after_definition''
   OR m IS DISTINCT FROM b->''after_metadata''
  THEN RETURN NULL; END IF;
  s:=b->>''before_source''; d:=b->>''before_definition''; m:=b->''before_metadata'';
 END LOOP;
 RETURN jsonb_build_object(''source'',s,''definition'',d,''metadata'',m);
END '),
('hotels_lineage_private.successors_are_exact(text)','
DECLARE r hotels_lineage_private.successor_receipts%rowtype; previous text:=p_root_hash;
 expected_stage integer:=114450; pins jsonb; linked boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=''hotels_lineage_private.successor_receipts''::regclass
   AND c.relowner=''postgres''::regrole AND c.relkind=''r'' AND c.relpersistence=''p''
   AND c.relrowsecurity AND NOT c.relforcerowsecurity)
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=''hotels_lineage_private.successor_receipts''::regclass)
  OR EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault(''r'',c.relowner))) a
   WHERE c.oid=''hotels_lineage_private.successor_receipts''::regclass AND a.grantee<>c.relowner)
  OR EXISTS(SELECT 1 FROM unnest(ARRAY[''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER'']) x(privilege)
   WHERE has_table_privilege(0::oid,''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''anon'',''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''authenticated'',''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''service_role'',''hotels_lineage_private.successor_receipts'',x.privilege))
  OR (SELECT count(*) FROM pg_trigger WHERE tgrelid=''hotels_lineage_private.successor_receipts''::regclass AND NOT tgisinternal)<>2
  OR EXISTS(SELECT 1 FROM (VALUES(''successor_immutable'',27),(''successor_no_truncate'',34)) e(name,type)
   LEFT JOIN pg_trigger t ON t.tgrelid=''hotels_lineage_private.successor_receipts''::regclass AND t.tgname=e.name
   WHERE t.oid IS NULL OR t.tgtype<>e.type OR t.tgenabled<>''O''
    OR t.tgfoid<>''public.hotel_v2_h3_2b_immutable_row()''::regprocedure)
 THEN RETURN false; END IF;
 FOR r IN SELECT * FROM hotels_lineage_private.successor_receipts ORDER BY stage LOOP
  SELECT jsonb_object_agg(k,hotels_lineage_private.successor_binding_pin(v)) INTO pins
   FROM jsonb_each(r.bindings) x(k,v);
  IF r.stage<>expected_stage OR r.previous_hash IS DISTINCT FROM previous
   OR pins IS NULL OR hotels_lineage_private.successor_manifest(r.stage) IS NULL
   OR r.bindings IS DISTINCT FROM pins
   OR pins IS DISTINCT FROM hotels_lineage_private.successor_manifest(r.stage)
   OR r.receipt_hash IS DISTINCT FROM public.hotel_v2_h3_2b_hash(
    jsonb_build_object(''stage'',r.stage,''previous_hash'',r.previous_hash,''bindings'',r.bindings))
  THEN RETURN false; END IF;
  IF r.stage=114450 THEN
   IF to_regclass(''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'') IS NULL
   THEN RETURN false; END IF;
   EXECUTE $linked_provider$
    SELECT count(*)=1 AND bool_and(id=1 AND contract_version=''hotels_v2_external_calendar_provider_evolution_v1''
     AND prior_reviewed_pricing_catalog_fingerprint=(SELECT evidence->>''catalog_after''
       FROM hotels_lineage_private.reconciliation_receipts WHERE id=1)
     AND NOT EXISTS(SELECT 1 FROM jsonb_each($1) x(signature,pin)
       WHERE prior_function_source_hashes->>signature IS DISTINCT FROM pin->>''before_source''
        OR prior_function_fingerprints->>signature IS DISTINCT FROM pin->>''before_definition''))
    FROM hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
   $linked_provider$ INTO linked USING pins;
   IF hotels_lineage_private.predecessor_source_hash(to_regprocedure(
       ''public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'')) IS DISTINCT FROM
       ''d5715bd29b456053bb32b0cf26793553617e8082443762091b7643943d5282db''
    OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(
       ''public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'')
      AND p.proowner=''postgres''::regrole AND p.prosecdef AND p.provolatile=''s''
      AND p.prokind=''f'' AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset AND p.proparallel=''u''
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname=''plpgsql'')
      AND p.proconfig=ARRAY[''search_path=pg_catalog, public'']
      AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault(''f'',p.proowner))) a WHERE a.grantee<>p.proowner)
      AND NOT has_function_privilege(0::oid,p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''anon'',p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''authenticated'',p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''service_role'',p.oid,''EXECUTE''))
   THEN RETURN false; END IF;
  ELSE
   IF to_regclass(''hotels_lifecycle_private.foundation'') IS NULL
     OR to_regclass(''hotels_lifecycle_private.bindings'') IS NULL THEN RETURN false; END IF;
   EXECUTE $linked_lifecycle$
    SELECT (SELECT count(*)=1 AND bool_and(id=1) FROM hotels_lifecycle_private.foundation)
     AND (SELECT count(*) FROM hotels_lifecycle_private.bindings)=(SELECT count(*) FROM jsonb_object_keys($1))
     AND NOT EXISTS(SELECT 1 FROM jsonb_each($1) x(signature,pin)
      LEFT JOIN hotels_lifecycle_private.bindings b ON b.signature=x.signature
      WHERE b.signature IS NULL OR b.before_hash IS DISTINCT FROM pin->>''before_source''
       OR b.after_hash IS DISTINCT FROM pin->>''after_source''
       OR encode(extensions.digest(convert_to(b.before_source,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM pin->>''before_source''
       OR public.hotel_v2_h3_2b_hash(to_jsonb(b.before_definition)) IS DISTINCT FROM pin->>''before_definition'')
   $linked_lifecycle$ INTO linked USING pins;
   IF linked IS NOT TRUE THEN RETURN false; END IF;
   -- Pin the entire low-level call closure before invoking its raw projector.
   -- None of these three functions calls scoped lineage or a composite.
   IF EXISTS(SELECT 1 FROM (VALUES
    (''hotels_lifecycle_private.hash(jsonb)'',''0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a'',''i'',false,true),
    (''hotels_lifecycle_private.metadata(oid)'',''2b49509d355fc1078aafed91f4f9307c3d55413169d7e514cab68f9e1faf760d'',''s'',true,true),
    (''hotels_lifecycle_private.catalog_snapshot()'',''ef46235b2ad39502b4d4787b34b817e7dee986a5ea0bd526c76690cb2f6b2a71'',''s'',true,false)
   ) e(signature,sha,volatility,definer,strict) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
   WHERE p.oid IS NULL OR p.proowner<>''postgres''::regrole OR p.prosecdef<>e.definer OR p.proisstrict<>e.strict
    OR p.prokind<>''f'' OR p.proleakproof OR p.proretset OR p.proparallel<>''u''
    OR p.provolatile<>e.volatility::"char"
    OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname=''sql'')
    OR p.proconfig IS DISTINCT FROM ARRAY[''search_path=pg_catalog, public'']
    OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault(''f'',p.proowner))) a WHERE a.grantee<>p.proowner)
    OR encode(extensions.digest(convert_to(p.prosrc,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM e.sha
    OR has_function_privilege(0::oid,p.oid,''EXECUTE'')
    OR has_function_privilege(''anon'',p.oid,''EXECUTE'')
    OR has_function_privilege(''authenticated'',p.oid,''EXECUTE'')
    OR has_function_privilege(''service_role'',p.oid,''EXECUTE''))
   THEN RETURN false; END IF;
   EXECUTE ''SELECT catalog IS NOT DISTINCT FROM hotels_lifecycle_private.catalog_snapshot()
     FROM hotels_lifecycle_private.foundation WHERE id=1'' INTO linked;
  END IF;
  IF linked IS NOT TRUE THEN RETURN false; END IF;
  previous:=r.receipt_hash; expected_stage:=114480;
 END LOOP;
 -- Validate every manifested current object, not just functions referenced by
 -- the baseline pricing catalog. This includes provider worker/runtime seams.
 IF EXISTS(SELECT 1 FROM (SELECT DISTINCT k FROM hotels_lineage_private.successor_receipts certificate,
    LATERAL jsonb_object_keys(certificate.bindings) x(k)) signatures
   WHERE hotels_lineage_private.predecessor(to_regprocedure(k)) IS NULL)
 THEN RETURN false; END IF;
 RETURN true;
END ','CREATE OR REPLACE FUNCTION hotels_lineage_private.successors_are_exact(p_root_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
DECLARE r hotels_lineage_private.successor_receipts%rowtype; previous text:=p_root_hash;
 expected_stage integer:=114450; pins jsonb; linked boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=''hotels_lineage_private.successor_receipts''::regclass
   AND c.relowner=''postgres''::regrole AND c.relkind=''r'' AND c.relpersistence=''p''
   AND c.relrowsecurity AND NOT c.relforcerowsecurity)
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=''hotels_lineage_private.successor_receipts''::regclass)
  OR EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault(''r'',c.relowner))) a
   WHERE c.oid=''hotels_lineage_private.successor_receipts''::regclass AND a.grantee<>c.relowner)
  OR EXISTS(SELECT 1 FROM unnest(ARRAY[''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER'']) x(privilege)
   WHERE has_table_privilege(0::oid,''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''anon'',''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''authenticated'',''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''service_role'',''hotels_lineage_private.successor_receipts'',x.privilege))
  OR (SELECT count(*) FROM pg_trigger WHERE tgrelid=''hotels_lineage_private.successor_receipts''::regclass AND NOT tgisinternal)<>2
  OR EXISTS(SELECT 1 FROM (VALUES(''successor_immutable'',27),(''successor_no_truncate'',34)) e(name,type)
   LEFT JOIN pg_trigger t ON t.tgrelid=''hotels_lineage_private.successor_receipts''::regclass AND t.tgname=e.name
   WHERE t.oid IS NULL OR t.tgtype<>e.type OR t.tgenabled<>''O''
    OR t.tgfoid<>''public.hotel_v2_h3_2b_immutable_row()''::regprocedure)
 THEN RETURN false; END IF;
 FOR r IN SELECT * FROM hotels_lineage_private.successor_receipts ORDER BY stage LOOP
  SELECT jsonb_object_agg(k,hotels_lineage_private.successor_binding_pin(v)) INTO pins
   FROM jsonb_each(r.bindings) x(k,v);
  IF r.stage<>expected_stage OR r.previous_hash IS DISTINCT FROM previous
   OR pins IS NULL OR hotels_lineage_private.successor_manifest(r.stage) IS NULL
   OR r.bindings IS DISTINCT FROM pins
   OR pins IS DISTINCT FROM hotels_lineage_private.successor_manifest(r.stage)
   OR r.receipt_hash IS DISTINCT FROM public.hotel_v2_h3_2b_hash(
    jsonb_build_object(''stage'',r.stage,''previous_hash'',r.previous_hash,''bindings'',r.bindings))
  THEN RETURN false; END IF;
  IF r.stage=114450 THEN
   IF to_regclass(''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'') IS NULL
   THEN RETURN false; END IF;
   EXECUTE $linked_provider$
    SELECT count(*)=1 AND bool_and(id=1 AND contract_version=''hotels_v2_external_calendar_provider_evolution_v1''
     AND prior_reviewed_pricing_catalog_fingerprint=(SELECT evidence->>''catalog_after''
       FROM hotels_lineage_private.reconciliation_receipts WHERE id=1)
     AND NOT EXISTS(SELECT 1 FROM jsonb_each($1) x(signature,pin)
       WHERE prior_function_source_hashes->>signature IS DISTINCT FROM pin->>''before_source''
        OR prior_function_fingerprints->>signature IS DISTINCT FROM pin->>''before_definition''))
    FROM hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
   $linked_provider$ INTO linked USING pins;
   IF hotels_lineage_private.predecessor_source_hash(to_regprocedure(
       ''public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'')) IS DISTINCT FROM
       ''d5715bd29b456053bb32b0cf26793553617e8082443762091b7643943d5282db''
    OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(
       ''public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'')
      AND p.proowner=''postgres''::regrole AND p.prosecdef AND p.provolatile=''s''
      AND p.prokind=''f'' AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset AND p.proparallel=''u''
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname=''plpgsql'')
      AND p.proconfig=ARRAY[''search_path=pg_catalog, public'']
      AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault(''f'',p.proowner))) a WHERE a.grantee<>p.proowner)
      AND NOT has_function_privilege(0::oid,p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''anon'',p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''authenticated'',p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''service_role'',p.oid,''EXECUTE''))
   THEN RETURN false; END IF;
  ELSE
   IF to_regclass(''hotels_lifecycle_private.foundation'') IS NULL
     OR to_regclass(''hotels_lifecycle_private.bindings'') IS NULL THEN RETURN false; END IF;
   EXECUTE $linked_lifecycle$
    SELECT (SELECT count(*)=1 AND bool_and(id=1) FROM hotels_lifecycle_private.foundation)
     AND (SELECT count(*) FROM hotels_lifecycle_private.bindings)=(SELECT count(*) FROM jsonb_object_keys($1))
     AND NOT EXISTS(SELECT 1 FROM jsonb_each($1) x(signature,pin)
      LEFT JOIN hotels_lifecycle_private.bindings b ON b.signature=x.signature
      WHERE b.signature IS NULL OR b.before_hash IS DISTINCT FROM pin->>''before_source''
       OR b.after_hash IS DISTINCT FROM pin->>''after_source''
       OR encode(extensions.digest(convert_to(b.before_source,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM pin->>''before_source''
       OR public.hotel_v2_h3_2b_hash(to_jsonb(b.before_definition)) IS DISTINCT FROM pin->>''before_definition'')
   $linked_lifecycle$ INTO linked USING pins;
   IF linked IS NOT TRUE THEN RETURN false; END IF;
   -- Pin the entire low-level call closure before invoking its raw projector.
   -- None of these three functions calls scoped lineage or a composite.
   IF EXISTS(SELECT 1 FROM (VALUES
    (''hotels_lifecycle_private.hash(jsonb)'',''0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a'',''i'',false,true),
    (''hotels_lifecycle_private.metadata(oid)'',''2b49509d355fc1078aafed91f4f9307c3d55413169d7e514cab68f9e1faf760d'',''s'',true,true),
    (''hotels_lifecycle_private.catalog_snapshot()'',''ef46235b2ad39502b4d4787b34b817e7dee986a5ea0bd526c76690cb2f6b2a71'',''s'',true,false)
   ) e(signature,sha,volatility,definer,strict) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
   WHERE p.oid IS NULL OR p.proowner<>''postgres''::regrole OR p.prosecdef<>e.definer OR p.proisstrict<>e.strict
    OR p.prokind<>''f'' OR p.proleakproof OR p.proretset OR p.proparallel<>''u''
    OR p.provolatile<>e.volatility::"char"
    OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname=''sql'')
    OR p.proconfig IS DISTINCT FROM ARRAY[''search_path=pg_catalog, public'']
    OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault(''f'',p.proowner))) a WHERE a.grantee<>p.proowner)
    OR encode(extensions.digest(convert_to(p.prosrc,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM e.sha
    OR has_function_privilege(0::oid,p.oid,''EXECUTE'')
    OR has_function_privilege(''anon'',p.oid,''EXECUTE'')
    OR has_function_privilege(''authenticated'',p.oid,''EXECUTE'')
    OR has_function_privilege(''service_role'',p.oid,''EXECUTE''))
   THEN RETURN false; END IF;
   EXECUTE ''SELECT catalog IS NOT DISTINCT FROM hotels_lifecycle_private.catalog_snapshot()
     FROM hotels_lifecycle_private.foundation WHERE id=1'' INTO linked;
  END IF;
  IF linked IS NOT TRUE THEN RETURN false; END IF;
  previous:=r.receipt_hash; expected_stage:=114480;
 END LOOP;
 -- Validate every manifested current object, not just functions referenced by
 -- the baseline pricing catalog. This includes provider worker/runtime seams.
 IF EXISTS(SELECT 1 FROM (SELECT DISTINCT k FROM hotels_lineage_private.successor_receipts certificate,
    LATERAL jsonb_object_keys(certificate.bindings) x(k)) signatures
   WHERE hotels_lineage_private.predecessor(to_regprocedure(k)) IS NULL)
 THEN RETURN false; END IF;
 RETURN true;
END $function$
','c9b0de4a528547f1555d29e96530c552f8a827c83b50c65985d4dd75e415ce07','fcf5478ea42f47e6aa45ef2d7aa1a94828a92b3ba763e784b95efbba34fe4139','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb,'
DECLARE r hotels_lineage_private.successor_receipts%rowtype; previous text:=p_root_hash;
 expected_stage integer:=114450; pins jsonb; linked boolean;
BEGIN
 PERFORM hotels_stripe_dto_private.assert_exact();
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=''hotels_lineage_private.successor_receipts''::regclass
   AND c.relowner=''postgres''::regrole AND c.relkind=''r'' AND c.relpersistence=''p''
   AND c.relrowsecurity AND NOT c.relforcerowsecurity)
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=''hotels_lineage_private.successor_receipts''::regclass)
  OR EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault(''r'',c.relowner))) a
   WHERE c.oid=''hotels_lineage_private.successor_receipts''::regclass AND a.grantee<>c.relowner)
  OR EXISTS(SELECT 1 FROM unnest(ARRAY[''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER'']) x(privilege)
   WHERE has_table_privilege(0::oid,''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''anon'',''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''authenticated'',''hotels_lineage_private.successor_receipts'',x.privilege)
    OR has_table_privilege(''service_role'',''hotels_lineage_private.successor_receipts'',x.privilege))
  OR (SELECT count(*) FROM pg_trigger WHERE tgrelid=''hotels_lineage_private.successor_receipts''::regclass AND NOT tgisinternal)<>2
  OR EXISTS(SELECT 1 FROM (VALUES(''successor_immutable'',27),(''successor_no_truncate'',34)) e(name,type)
   LEFT JOIN pg_trigger t ON t.tgrelid=''hotels_lineage_private.successor_receipts''::regclass AND t.tgname=e.name
   WHERE t.oid IS NULL OR t.tgtype<>e.type OR t.tgenabled<>''O''
    OR t.tgfoid<>''public.hotel_v2_h3_2b_immutable_row()''::regprocedure)
 THEN RETURN false; END IF;
 FOR r IN SELECT * FROM hotels_lineage_private.successor_receipts ORDER BY stage LOOP
  SELECT jsonb_object_agg(k,hotels_lineage_private.successor_binding_pin(v)) INTO pins
   FROM jsonb_each(r.bindings) x(k,v);
  IF r.stage<>expected_stage OR r.previous_hash IS DISTINCT FROM previous
   OR pins IS NULL OR hotels_lineage_private.successor_manifest(r.stage) IS NULL
   OR r.bindings IS DISTINCT FROM pins
   OR pins IS DISTINCT FROM hotels_lineage_private.successor_manifest(r.stage)
   OR r.receipt_hash IS DISTINCT FROM public.hotel_v2_h3_2b_hash(
    jsonb_build_object(''stage'',r.stage,''previous_hash'',r.previous_hash,''bindings'',r.bindings))
  THEN RETURN false; END IF;
  IF r.stage=114450 THEN
   IF to_regclass(''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'') IS NULL
   THEN RETURN false; END IF;
   EXECUTE $linked_provider$
    SELECT count(*)=1 AND bool_and(id=1 AND contract_version=''hotels_v2_external_calendar_provider_evolution_v1''
     AND prior_reviewed_pricing_catalog_fingerprint=(SELECT evidence->>''catalog_after''
       FROM hotels_lineage_private.reconciliation_receipts WHERE id=1)
     AND NOT EXISTS(SELECT 1 FROM jsonb_each($1) x(signature,pin)
       WHERE prior_function_source_hashes->>signature IS DISTINCT FROM pin->>''before_source''
        OR prior_function_fingerprints->>signature IS DISTINCT FROM pin->>''before_definition''))
    FROM hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
   $linked_provider$ INTO linked USING pins;
   IF hotels_lineage_private.predecessor_source_hash(to_regprocedure(
       ''public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'')) IS DISTINCT FROM
       ''d5715bd29b456053bb32b0cf26793553617e8082443762091b7643943d5282db''
    OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(
       ''public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'')
      AND p.proowner=''postgres''::regrole AND p.prosecdef AND p.provolatile=''s''
      AND p.prokind=''f'' AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset AND p.proparallel=''u''
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname=''plpgsql'')
      AND p.proconfig=ARRAY[''search_path=pg_catalog, public'']
      AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault(''f'',p.proowner))) a WHERE a.grantee<>p.proowner)
      AND NOT has_function_privilege(0::oid,p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''anon'',p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''authenticated'',p.oid,''EXECUTE'')
      AND NOT has_function_privilege(''service_role'',p.oid,''EXECUTE''))
   THEN RETURN false; END IF;
  ELSE
   IF to_regclass(''hotels_lifecycle_private.foundation'') IS NULL
     OR to_regclass(''hotels_lifecycle_private.bindings'') IS NULL THEN RETURN false; END IF;
   EXECUTE $linked_lifecycle$
    SELECT (SELECT count(*)=1 AND bool_and(id=1) FROM hotels_lifecycle_private.foundation)
     AND (SELECT count(*) FROM hotels_lifecycle_private.bindings)=(SELECT count(*) FROM jsonb_object_keys($1))
     AND NOT EXISTS(SELECT 1 FROM jsonb_each($1) x(signature,pin)
      LEFT JOIN hotels_lifecycle_private.bindings b ON b.signature=x.signature
      WHERE b.signature IS NULL OR b.before_hash IS DISTINCT FROM pin->>''before_source''
       OR b.after_hash IS DISTINCT FROM pin->>''after_source''
       OR encode(extensions.digest(convert_to(b.before_source,''UTF8''),''sha256''),''hex'') IS DISTINCT FROM pin->>''before_source''
       OR public.hotel_v2_h3_2b_hash(to_jsonb(b.before_definition)) IS DISTINCT FROM pin->>''before_definition'')
   $linked_lifecycle$ INTO linked USING pins;
   IF linked IS NOT TRUE THEN RETURN false; END IF;
   -- Pin the entire low-level call closure before invoking its raw projector.
   -- None of these three functions calls scoped lineage or a composite.
   IF EXISTS(SELECT 1 FROM (VALUES
    (''hotels_lifecycle_private.hash(jsonb)'',''0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a'',''i'',false,true),
    (''hotels_lifecycle_private.metadata(oid)'',''2b49509d355fc1078aafed91f4f9307c3d55413169d7e514cab68f9e1faf760d'',''s'',true,true),
    (''hotels_lifecycle_private.catalog_snapshot()'',''ef46235b2ad39502b4d4787b34b817e7dee986a5ea0bd526c76690cb2f6b2a71'',''s'',true,false)
   ) e(signature,sha,volatility,definer,strict) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
   WHERE p.oid IS NULL OR p.proowner<>''postgres''::regrole OR p.prosecdef<>e.definer OR p.proisstrict<>e.strict
    OR p.prokind<>''f'' OR p.proleakproof OR p.proretset OR p.proparallel<>''u''
    OR p.provolatile<>e.volatility::"char"
    OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname=''sql'')
    OR p.proconfig IS DISTINCT FROM ARRAY[''search_path=pg_catalog, public'']
    OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault(''f'',p.proowner))) a WHERE a.grantee<>p.proowner)
    OR encode(extensions.digest(convert_to(hotels_stripe_dto_private.predecessor_source(p.oid),''UTF8''),''sha256''),''hex'') IS DISTINCT FROM e.sha
    OR has_function_privilege(0::oid,p.oid,''EXECUTE'')
    OR has_function_privilege(''anon'',p.oid,''EXECUTE'')
    OR has_function_privilege(''authenticated'',p.oid,''EXECUTE'')
    OR has_function_privilege(''service_role'',p.oid,''EXECUTE''))
   THEN RETURN false; END IF;
   EXECUTE ''SELECT catalog IS NOT DISTINCT FROM hotels_lifecycle_private.catalog_snapshot()
     FROM hotels_lifecycle_private.foundation WHERE id=1'' INTO linked;
  END IF;
  IF linked IS NOT TRUE THEN RETURN false; END IF;
  previous:=r.receipt_hash; expected_stage:=114480;
 END LOOP;
 -- Validate every manifested current object, not just functions referenced by
 -- the baseline pricing catalog. This includes provider worker/runtime seams.
 IF EXISTS(SELECT 1 FROM (SELECT DISTINCT k FROM hotels_lineage_private.successor_receipts certificate,
    LATERAL jsonb_object_keys(certificate.bindings) x(k)) signatures
   WHERE hotels_lineage_private.predecessor(to_regprocedure(k)) IS NULL)
 THEN RETURN false; END IF;
 RETURN true;
END ');
SELECT set_config('hotels_114481.business_before',hotels_stripe_dto_private.business_hash(),true) IS NOT NULL;
DO $evolve$ DECLARE b record; d text; BEGIN
 FOR b IN SELECT * FROM hotels_stripe_dto_private.bindings ORDER BY signature LOOP
  SELECT pg_get_functiondef(p.oid) INTO STRICT d FROM pg_proc p WHERE p.oid=to_regprocedure(b.signature)
   AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=b.before_hash
   AND hotels_lifecycle_private.metadata(p.oid)=b.metadata;
  IF (length(d)-length(replace(d,b.before_source,'')))/length(b.before_source)<>1
   OR d IS DISTINCT FROM b.before_definition THEN RAISE EXCEPTION 'hotels_114481_source_mismatch'; END IF;
  EXECUTE replace(d,b.before_source,b.after_source);
 END LOOP;
END $evolve$;
DO $security$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='hotels_stripe_dto_private' LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.oid::regprocedure);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.oid::regprocedure);
 END LOOP;
END $security$;
ALTER TABLE hotels_stripe_dto_private.bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels_stripe_dto_private.bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE hotels_stripe_dto_private.certificate ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels_stripe_dto_private.certificate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA hotels_stripe_dto_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER bindings_immutable BEFORE UPDATE OR DELETE ON hotels_stripe_dto_private.bindings FOR EACH ROW EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
CREATE TRIGGER bindings_no_truncate BEFORE TRUNCATE ON hotels_stripe_dto_private.bindings FOR EACH STATEMENT EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
CREATE TRIGGER certificate_immutable BEFORE UPDATE OR DELETE ON hotels_stripe_dto_private.certificate FOR EACH ROW EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
CREATE TRIGGER certificate_no_truncate BEFORE TRUNCATE ON hotels_stripe_dto_private.certificate FOR EACH STATEMENT EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
INSERT INTO hotels_stripe_dto_private.certificate SELECT 1,
 (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,'UTF8')),'hex') FROM hotels_stripe_dto_private.bindings b),
 hotels_stripe_dto_private.helper_catalog(),hotels_stripe_dto_private.relation_catalog(),current_setting('hotels_114481.business_before');
DO $post$ BEGIN
 PERFORM hotels_stripe_dto_private.assert_exact();
 IF hotels_stripe_dto_private.business_hash() IS DISTINCT FROM (SELECT business_hash FROM hotels_stripe_dto_private.certificate WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_114481_business_change'; END IF;
 IF (hotels_lineage_private.current_anchor_is_exact() IS TRUE
 AND hotels_lifecycle_private.safe_state() @> '{"public_booking_enabled":false,"architecture":"legacy","feature_flags":{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}}'::jsonb
 AND EXISTS(SELECT 1 FROM public.hotel_partner_hotel_permissions p WHERE p.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 AND p.partner_id=(hotels_lineage_private.permission_evidence()->>'partner_id')::uuid
 AND p.assignment_id=(hotels_lineage_private.permission_evidence()->>'assignment_id')::uuid AND p.version=2)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.onboarding_authorizations)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.accounts)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.oauth_states)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.stripe_readiness)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.context)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.decisions)
 AND public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE) IS NOT TRUE THEN RAISE EXCEPTION 'hotels_114481_postcondition_failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;
