-- One result set. Compare business_fingerprint with the preaction result.
-- Expected Edge index.ts SHA256: 1c90f5732a67a7cf2d02c20ed440d20979f0822109bcf5a50ddbda18e7817164 (external source/deployment verification; SQL cannot attest deployment).
BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
WITH checks AS (SELECT * FROM (VALUES
(1,'transaction_read_only',current_setting('transaction_read_only')='on'),
(2,'recorded_boundary',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448500')
 AND NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448500')),
(3,'predecessor_source_security',(SELECT count(*)=3 AND coalesce(bool_and(
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
 ) e(signature,source,volatility,result,config,acl) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) LEFT JOIN pg_language l ON l.oid=p.prolang)),
(4,'readiness_storage_security',EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=to_regclass('hotels_lifecycle_private.stripe_readiness')
 AND c.relowner='postgres'::regrole AND c.relrowsecurity AND c.relforcerowsecurity
 AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>c.relowner)
 AND (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)=
 '[["request_id","uuid",true],["ready","boolean",true],["contract_version","text",true],["checked_at","timestamp with time zone",true]]'::jsonb
 AND NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))),
(5,'flags_and_public_booking',hotels_lifecycle_private.safe_state() @> '{"feature_flags":{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_stripe_connect_enabled":false,"hotel_instant_booking_enabled":false},"public_booking_enabled":false}'::jsonb),
(6,'partner_authorization_off',(hotel_stripe_connect_private.authorization_state('0a321bfe-da6b-43f6-8e0b-7c68546a8b18')->>'enabled')::boolean IS FALSE),
(7,'commission_eur10',(SELECT count(*)=1 FROM public.hotel_commission_policies WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 AND commission_mode='per_allocated_room_per_night' AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed')),
(8,'payment_lineage',public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()),
(9,'successor_source_security_all_four_states',EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('public.hotel_v2_admin_get_stripe_platform_readiness_114486()')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='1838e6de07b87f36b3a49fc9c001f85060f3a01aed9817120c070ed77a5602c6' AND p.proowner='postgres'::regrole
 AND p.prosecdef AND p.provolatile='s' AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset
 AND l.lanname='plpgsql' AND p.prorettype='jsonb'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog, public, auth']
 AND (SELECT coalesce(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable),'[]'::jsonb) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)='[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb)),
(10,'business_fingerprint_available',hotels_stripe_dto_private.business_hash() IS NOT NULL)
) v(ordinal,predicate,passed))
SELECT ordinal,predicate,coalesce(passed,false) AS passed,
 CASE WHEN ordinal=10 THEN hotels_stripe_dto_private.business_hash() ELSE NULL END AS business_fingerprint
FROM checks ORDER BY ordinal;
ROLLBACK;
