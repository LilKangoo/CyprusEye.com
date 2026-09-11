-- 114486: one global Admin READ; no attestation, business or predecessor mutation.
-- Existing Edge verify_platform_configuration lineage SHA256: 1c90f5732a67a7cf2d02c20ed440d20979f0822109bcf5a50ddbda18e7817164
-- Edge deployment identity is an external gate, not provable by database SQL.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
DO $pre$ BEGIN
 IF (EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448500')
 AND NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448500')) IS NOT TRUE OR to_regprocedure('public.hotel_v2_admin_get_stripe_platform_readiness_114486()') IS NOT NULL
 THEN RAISE EXCEPTION 'hotels_114486_boundary_mismatch'; END IF;
 IF ((SELECT count(*)=3 AND coalesce(bool_and(
 p.oid IS NOT NULL AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.source
 AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile=e.volatility::"char"
 AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset AND l.lanname='plpgsql'
 AND p.proconfig=e.config AND p.prorettype=e.result::regtype AND (SELECT coalesce(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable),'[]'::jsonb) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)=e.acl),false)
 FROM (VALUES
 ('public.hotel_v2_h2a_require_admin()','2f1cc975916dbc86a63d348135a2ff83de50d9f31c20e70219257d476296fa3d','s','void',ARRAY['search_path=pg_catalog, public, auth'],'[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_admin_get_capability_lifecycle()','d9cdf8959c664742d0ec104ba3c20fd1e1dbd7a1c2d17ce6f2daa2288019d68e','s','jsonb',ARRAY['search_path=pg_catalog, public, auth'],'[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_attest_stripe_platform_readiness(uuid,boolean,text)','b35b1611ecc586e4607a0644f4a4550afa5b1c110889cff82773b9e612e75fe6','v','boolean',ARRAY['search_path=pg_catalog, public'],'[["postgres","postgres","EXECUTE",false],["service_role","postgres","EXECUTE",false]]'::jsonb)
 ) e(signature,source,volatility,result,config,acl) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) LEFT JOIN pg_language l ON l.oid=p.prolang)) IS NOT TRUE OR (EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=to_regclass('hotels_lifecycle_private.stripe_readiness')
 AND c.relowner='postgres'::regrole AND c.relrowsecurity AND c.relforcerowsecurity
 AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>c.relowner)
 AND (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)=
 '[["request_id","uuid",true],["ready","boolean",true],["contract_version","text",true],["checked_at","timestamp with time zone",true]]'::jsonb
 AND NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))) IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114486_predecessor_security_mismatch'; END IF;
 IF (hotels_lifecycle_private.safe_state() @> '{"feature_flags":{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_stripe_connect_enabled":false,"hotel_instant_booking_enabled":false},"public_booking_enabled":false}'::jsonb) IS NOT TRUE OR ((hotel_stripe_connect_private.authorization_state('0a321bfe-da6b-43f6-8e0b-7c68546a8b18')->>'enabled')::boolean IS FALSE) IS NOT TRUE OR ((SELECT count(*)=1 FROM public.hotel_commission_policies WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 AND commission_mode='per_allocated_room_per_night' AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed')) IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114486_business_boundary_mismatch'; END IF;
 PERFORM set_config('hotels_114486.business_before',hotels_stripe_dto_private.business_hash(),true);
END $pre$;
CREATE FUNCTION public.hotel_v2_admin_get_stripe_platform_readiness_114486() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth
AS $function$
DECLARE a hotels_lifecycle_private.stripe_readiness%rowtype; state_value text;
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 IF auth.uid() IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114486_admin_required'; END IF;
 SELECT * INTO a FROM hotels_lifecycle_private.stripe_readiness ORDER BY checked_at DESC,request_id DESC LIMIT 1;
 IF NOT FOUND THEN state_value:='MISSING';
 ELSIF a.ready IS NOT TRUE OR a.contract_version IS DISTINCT FROM 'hotels_standard_connect_server_v1'
 OR NOT isfinite(a.checked_at) THEN state_value:='NOT_READY';
 ELSIF a.checked_at<=statement_timestamp()-interval '15 minutes' THEN state_value:='STALE';
 ELSE state_value:='READY'; END IF;
 RETURN jsonb_build_object('contract_version','hotels_stripe_platform_readiness_admin_v1',
 'state',state_value,'ready',state_value='READY','request_id',a.request_id,
 'checked_at',CASE WHEN isfinite(a.checked_at) THEN a.checked_at ELSE NULL END,
 'expires_at',CASE WHEN isfinite(a.checked_at) THEN a.checked_at+interval '15 minutes' ELSE NULL END,
 'observed_at',statement_timestamp(),'blocked_reason',CASE state_value
 WHEN 'MISSING' THEN 'attestation_missing' WHEN 'NOT_READY' THEN 'attestation_invalid'
 WHEN 'STALE' THEN 'attestation_expired' ELSE NULL END);
END $function$;
ALTER FUNCTION public.hotel_v2_admin_get_stripe_platform_readiness_114486() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.hotel_v2_admin_get_stripe_platform_readiness_114486() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_admin_get_stripe_platform_readiness_114486() TO authenticated;
DO $post$ BEGIN
 IF (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('public.hotel_v2_admin_get_stripe_platform_readiness_114486()')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='1838e6de07b87f36b3a49fc9c001f85060f3a01aed9817120c070ed77a5602c6' AND p.proowner='postgres'::regrole
 AND p.prosecdef AND p.provolatile='s' AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset
 AND l.lanname='plpgsql' AND p.prorettype='jsonb'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog, public, auth']
 AND (SELECT coalesce(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable),'[]'::jsonb) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)='[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb)) IS NOT TRUE OR ((SELECT count(*)=3 AND coalesce(bool_and(
 p.oid IS NOT NULL AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.source
 AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile=e.volatility::"char"
 AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset AND l.lanname='plpgsql'
 AND p.proconfig=e.config AND p.prorettype=e.result::regtype AND (SELECT coalesce(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable),'[]'::jsonb) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)=e.acl),false)
 FROM (VALUES
 ('public.hotel_v2_h2a_require_admin()','2f1cc975916dbc86a63d348135a2ff83de50d9f31c20e70219257d476296fa3d','s','void',ARRAY['search_path=pg_catalog, public, auth'],'[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_admin_get_capability_lifecycle()','d9cdf8959c664742d0ec104ba3c20fd1e1dbd7a1c2d17ce6f2daa2288019d68e','s','jsonb',ARRAY['search_path=pg_catalog, public, auth'],'[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_attest_stripe_platform_readiness(uuid,boolean,text)','b35b1611ecc586e4607a0644f4a4550afa5b1c110889cff82773b9e612e75fe6','v','boolean',ARRAY['search_path=pg_catalog, public'],'[["postgres","postgres","EXECUTE",false],["service_role","postgres","EXECUTE",false]]'::jsonb)
 ) e(signature,source,volatility,result,config,acl) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) LEFT JOIN pg_language l ON l.oid=p.prolang)) IS NOT TRUE OR (EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=to_regclass('hotels_lifecycle_private.stripe_readiness')
 AND c.relowner='postgres'::regrole AND c.relrowsecurity AND c.relforcerowsecurity
 AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>c.relowner)
 AND (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)=
 '[["request_id","uuid",true],["ready","boolean",true],["contract_version","text",true],["checked_at","timestamp with time zone",true]]'::jsonb
 AND NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))) IS NOT TRUE
 OR hotels_stripe_dto_private.business_hash() IS DISTINCT FROM current_setting('hotels_114486.business_before')
 THEN RAISE EXCEPTION 'hotels_114486_postcondition_failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;
