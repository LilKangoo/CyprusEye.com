// Offline deterministic successor compiler. Inputs must be the six accepted
// post-114480 definitions; no production discovery or fixture-pin substitution.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const lit=s=>"'"+s.replaceAll("'","''")+"'";
export const schema='hotels_stripe_dto_private';
export const targets=[
 'public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)',
 'hotels_lifecycle_private.partner_connection(uuid,uuid)',
 'hotels_lifecycle_private.catalog_snapshot()',
 'hotels_lifecycle_private.predecessor_source(oid)',
 'hotels_lineage_private.predecessor(oid)',
 'hotels_lineage_private.successors_are_exact(text)',
];
const catalogs=JSON.parse(readFileSync(new URL('./hotels-v2-remaining-rollout-catalog.json',import.meta.url),'utf8'))[114480];
export const expected=Object.fromEntries(targets.map(s=>[s,catalogs.functions.find(f=>f.signature===s.replace(/^public\./,''))?.source_sha]));
assert.ok(Object.values(expected).every(Boolean));
export function evolve(signature,source){
 const replace=(old,value,count=1)=>{assert.equal(source.split(old).length-1,count,signature+':'+old);source=source.split(old).join(value);};
 if(signature===targets[0]){
  replace("'platform_enabled',(select hotel_stripe_connect_enabled from public.site_settings where id=1)",
   "'platform_enabled',(select hotel_stripe_connect_enabled from public.site_settings where id=1),\n    'account_exists',exists(select 1 from hotel_stripe_connect_private.accounts where partner_id=p_partner_id),\n    'account_status',coalesce((select status from hotel_stripe_connect_private.accounts where partner_id=p_partner_id),'NOT_CONNECTED')");
  replace('  v_state:=',"  perform hotels_stripe_dto_private.predecessor_source('public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)'::regprocedure);\n  perform hotels_stripe_dto_private.assert_exact();\n  v_state:=");
 }else if(signature===targets[1]){
  replace('platform boolean;','platform boolean; attestation text;');
  replace(' SELECT * INTO a FROM',` PERFORM hotels_stripe_dto_private.predecessor_source('hotels_lifecycle_private.partner_connection(uuid,uuid)'::regprocedure);
 PERFORM hotels_stripe_dto_private.assert_exact();
 SELECT coalesce((SELECT CASE
  WHEN contract_version IS DISTINCT FROM 'hotels_standard_connect_server_v1' OR ready IS NOT TRUE THEN 'NOT_READY'
  WHEN checked_at<=statement_timestamp()-interval '15 minutes' THEN 'STALE'
  ELSE 'READY' END FROM hotels_lifecycle_private.stripe_readiness
  ORDER BY checked_at DESC,request_id DESC LIMIT 1),'MISSING') INTO attestation;
 SELECT * INTO a FROM`);
  replace("'checked_at',a.checked_at,","'checked_at',a.checked_at,'platform_ready',attestation='READY','attestation_status',attestation,");
 }else if(signature===targets[2]){
  replace('p.prosrc','hotels_stripe_dto_private.predecessor_source(p.oid)',3);
  source='\n WITH dto_guard AS MATERIALIZED (SELECT hotels_stripe_dto_private.assert_exact())\n'+source.trim()+' FROM dto_guard\n';
 }else if(signature===targets[3]){
  replace('SELECT prosrc INTO STRICT s FROM pg_proc WHERE oid=p_oid;',
   'SELECT hotels_stripe_dto_private.predecessor_source(p_oid) INTO STRICT s;');
 }else if(signature===targets[4]){
  replace('p.prosrc','hotels_stripe_dto_private.predecessor_source(p.oid)');
  replace('pg_get_functiondef(p.oid)','hotels_stripe_dto_private.predecessor_definition(p.oid)');
 }else if(signature===targets[5]){
  replace('p.prosrc','hotels_stripe_dto_private.predecessor_source(p.oid)');
  replace('BEGIN\n','BEGIN\n PERFORM hotels_stripe_dto_private.assert_exact();\n');
 }
 return source;
}
export const stateCheck=`hotels_lineage_private.current_anchor_is_exact() IS TRUE
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
 AND public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE`;
export function compile(before){
 const bindings=targets.map((signature,i)=>{const b=before[signature];assert.equal(hash(b.source),expected[signature],signature);
 assert.deepEqual(b.metadata,{acl:[...(i===0?[['authenticated','EXECUTE',false]]:[]),['postgres','EXECUTE',false]],owner:'postgres',config:[i<2?'search_path=pg_catalog, public, auth':'search_path=pg_catalog, public'],strict:i===3,language:i===2?'sql':'plpgsql',leakproof:false,volatility:'s',returns_set:false,security_definer:true},signature+' exact predecessor security');
 const after=evolve(signature,b.source);return {signature,before_source:b.source,before_definition:b.definition,before_hash:expected[signature],after_hash:hash(after),metadata:b.metadata,after_source:after};});
 const tuples=bindings.map(b=>`(${lit(b.signature)},${lit(b.before_source)},${lit(b.before_definition)},${lit(b.before_hash)},${lit(b.after_hash)},${lit(JSON.stringify(b.metadata))}::jsonb,${lit(b.after_source)})`).join(',\n');
 let result=`-- 114481: safe Stripe DTO successor; no activation, account, authorization or money write.
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
 IF to_regnamespace('${schema}') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448000')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448000')
 THEN RAISE EXCEPTION 'hotels_114481_boundary_mismatch'; END IF;
 IF (${stateCheck}) IS NOT TRUE THEN RAISE EXCEPTION 'hotels_114481_precondition_failed'; END IF;
END $pre$;
CREATE SCHEMA ${schema} AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE ${schema}.bindings(signature text PRIMARY KEY,before_source text NOT NULL,
 before_definition text NOT NULL,before_hash text NOT NULL,after_hash text NOT NULL,
 metadata jsonb NOT NULL,after_source text NOT NULL);
CREATE TABLE ${schema}.certificate(id integer PRIMARY KEY CHECK(id=1),binding_hash text NOT NULL,
 helper_catalog jsonb NOT NULL,relation_catalog jsonb NOT NULL,business_hash text NOT NULL);
CREATE FUNCTION ${schema}.helper_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='${schema}'
$f$;
CREATE FUNCTION ${schema}.relation_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT jsonb_build_object('schema',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl)
 FROM pg_namespace WHERE nspname='${schema}'),
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
 'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
 'policies',(SELECT jsonb_agg(to_jsonb(p)-'oid'-'polrelid') FROM pg_policy p WHERE p.polrelid=c.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relkind IN('r','p','v','m','f')))
$f$;
CREATE FUNCTION ${schema}.business_hash() RETURNS text
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
CREATE FUNCTION ${schema}.assert_exact() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE c ${schema}.certificate%rowtype;
BEGIN
 SELECT * INTO STRICT c FROM ${schema}.certificate WHERE id=1;
 IF EXISTS(SELECT 1 FROM (VALUES __KERNEL_PINS__) e(signature,expected_hash)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IS DISTINCT FROM e.expected_hash)
 OR c.helper_catalog IS DISTINCT FROM ${schema}.helper_catalog()
 OR c.relation_catalog IS DISTINCT FROM ${schema}.relation_catalog()
 OR c.binding_hash IS DISTINCT FROM (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,'UTF8')),'hex') FROM ${schema}.bindings b)
 OR (SELECT count(*) FROM ${schema}.bindings)<>6
 OR EXISTS(SELECT 1 FROM ${schema}.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IS DISTINCT FROM b.after_hash
 OR encode(sha256(convert_to(b.before_source,'UTF8')),'hex') IS DISTINCT FROM b.before_hash
 OR encode(sha256(convert_to(b.after_source,'UTF8')),'hex') IS DISTINCT FROM b.after_hash
 OR hotels_lifecycle_private.metadata(p.oid) IS DISTINCT FROM b.metadata)
 THEN RAISE EXCEPTION 'hotels_114481_source_security_drift'; END IF;
END $f$;
CREATE FUNCTION ${schema}.predecessor_source(p_oid oid) RETURNS text
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE s text; b ${schema}.bindings%rowtype;
BEGIN
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
  WHERE oid='${schema}.assert_exact()'::regprocedure) IS DISTINCT FROM
  (SELECT helper_catalog->'${schema}.assert_exact()'->>0 FROM ${schema}.certificate WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_114481_assertion_source_drift'; END IF;
 SELECT * INTO b FROM ${schema}.bindings WHERE to_regprocedure(signature)=p_oid;
 SELECT prosrc INTO s FROM pg_proc WHERE oid=p_oid;
 IF b.signature IS NOT NULL THEN
  IF encode(sha256(convert_to(s,'UTF8')),'hex') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.metadata
  THEN RAISE EXCEPTION 'hotels_114481_bound_source_drift'; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END $f$;
CREATE FUNCTION ${schema}.predecessor_definition(p_oid oid) RETURNS text
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE d text;
BEGIN
 PERFORM ${schema}.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM ${schema}.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END $f$;
INSERT INTO ${schema}.bindings VALUES
${tuples};
SELECT set_config('hotels_114481.business_before',${schema}.business_hash(),true) IS NOT NULL;
DO $evolve$ DECLARE b record; d text; BEGIN
 FOR b IN SELECT * FROM ${schema}.bindings ORDER BY signature LOOP
  SELECT pg_get_functiondef(p.oid) INTO STRICT d FROM pg_proc p WHERE p.oid=to_regprocedure(b.signature)
   AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=b.before_hash
   AND hotels_lifecycle_private.metadata(p.oid)=b.metadata;
  IF (length(d)-length(replace(d,b.before_source,'')))/length(b.before_source)<>1
   OR d IS DISTINCT FROM b.before_definition THEN RAISE EXCEPTION 'hotels_114481_source_mismatch'; END IF;
  EXECUTE replace(d,b.before_source,b.after_source);
 END LOOP;
END $evolve$;
DO $security$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='${schema}' LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.oid::regprocedure);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.oid::regprocedure);
 END LOOP;
END $security$;
ALTER TABLE ${schema}.bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.certificate ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.certificate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER bindings_immutable BEFORE UPDATE OR DELETE ON ${schema}.bindings FOR EACH ROW EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
CREATE TRIGGER bindings_no_truncate BEFORE TRUNCATE ON ${schema}.bindings FOR EACH STATEMENT EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
CREATE TRIGGER certificate_immutable BEFORE UPDATE OR DELETE ON ${schema}.certificate FOR EACH ROW EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
CREATE TRIGGER certificate_no_truncate BEFORE TRUNCATE ON ${schema}.certificate FOR EACH STATEMENT EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
INSERT INTO ${schema}.certificate SELECT 1,
 (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,'UTF8')),'hex') FROM ${schema}.bindings b),
 ${schema}.helper_catalog(),${schema}.relation_catalog(),current_setting('hotels_114481.business_before');
DO $post$ BEGIN
 PERFORM ${schema}.assert_exact();
 IF ${schema}.business_hash() IS DISTINCT FROM (SELECT business_hash FROM ${schema}.certificate WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_114481_business_change'; END IF;
 IF (${stateCheck}) IS NOT TRUE THEN RAISE EXCEPTION 'hotels_114481_postcondition_failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;
 const kernel=['helper_catalog','relation_catalog'].map(name=>{
  const body=result.split(`CREATE FUNCTION ${schema}.${name}()`)[1].split('$f$')[1];
  return `(${lit(schema+'.'+name+'()')},${lit(hash(body))})`;
 }).join(',');
 result=result.replace('__KERNEL_PINS__',kernel);
 return result;
}
