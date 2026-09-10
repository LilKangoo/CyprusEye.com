// Local-only 114484 compiler and targeted regression harness. Never accepts a URL.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {hash,lit,metadataBody} from './hotels-v2-114483-read-compiler.mjs';
const bin=process.env.HOTELS_114484_PSQL;
assert.ok(bin);
const run=q=>spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55489','-U','postgres','-d','hotels_114484_test'],{input:q,encoding:'utf8',maxBuffer:64e6});
const sql=q=>{const r=run(q);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
assert.equal(sql("SELECT host(inet_server_addr())||':'||inet_server_port()"),'127.0.0.1:55489');
const ns='hotels_guest_policy_private',hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const names=[
 'public.hotel_v2_seven_arches_reviewed_pricing_current_state()',
 'hotels_read_once_private.read_06b6ba66f8598192(jsonb)',
 'hotels_stripe_dto_private.predecessor_source(oid)',
 'hotels_stripe_dto_private.predecessor_definition(oid)',
 'hotels_lifecycle_private.predecessor_definition(oid)',
 'hotels_stripe_dto_private.helper_catalog()',
 'hotels_stripe_dto_private.assert_exact()',
 'hotels_read_once_private.metadata(oid)',
 'hotels_read_once_private.assert_exact()',
];
function replace(s,a,b){assert.equal(s.split(a).length-1,1,'exact patch: '+a);return s.replace(a,b);}
function generate(){
 const bindings=names.map(signature=>JSON.parse(sql(`SELECT jsonb_build_object('signature',${lit(signature)},'source',p.prosrc,'definition',pg_get_functiondef(p.oid),'metadata',(${metadataBody.replace('p.oid=p_oid',`p.oid=${lit(signature)}::regprocedure`)})) FROM pg_proc p WHERE p.oid=${lit(signature)}::regprocedure`)));
 for(const b of bindings){
 let s=b.source;
 if(b.signature===names[0]||b.signature===names[1])s=replace(s,"to_jsonb(hotel)-array['pricing_tiers','updated_at']",`${ns}.historical_hotel(to_jsonb(hotel))-array['pricing_tiers','updated_at']`);
 if(b.signature===names[2]){
  s=replace(s,'SELECT prosrc INTO s FROM pg_proc WHERE oid=p_oid;',`SELECT ${ns}.original_source(p_oid) INTO s;`);
  s=replace(s,"convert_to(prosrc,'UTF8')",`convert_to(${ns}.original_source(oid),'UTF8')`);
 }
 if(b.signature===names[3]||b.signature===names[4])s=replace(s,'coalesce(d,pg_get_functiondef(p_oid))',`coalesce(d,${ns}.original_definition(p_oid))`);
 if(b.signature===names[5])s=replace(s,"convert_to(p.prosrc,'UTF8')",`convert_to(${ns}.original_source(p.oid),'UTF8')`);
 if(b.signature===names[6])s=s.replaceAll("convert_to(p.prosrc,'UTF8')",`convert_to(${ns}.original_source(p.oid),'UTF8')`);
 if(b.signature===names[7])s=`SELECT ${ns}.original_metadata(p_oid)`;
 if(b.signature===names[8])s=replace(s,"convert_to(prosrc,'UTF8')",`convert_to(${ns}.original_source(oid),'UTF8')`);
 b.after=s;b.after_hash=hash(s);
 }
 const bindingSql=bindings.map(b=>`(${lit(b.signature)},${lit(b.source)},${lit(b.definition)},${lit(JSON.stringify(b.metadata))}::jsonb,${lit(b.after)},${lit(b.after_hash)})`).join(',\n');
 return `-- 114484: immutable Guest Policy foundation successor; no business writes.
-- Only Property children_policy/minimum_child_age are normalized. All other
-- fields and all historical evidence retain the complete predecessor checks.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
LOCK TABLE public.hotels,public.hotel_activity_log,public.hotel_room_types,
 public.hotel_seven_arches_reviewed_pricing_foundation_receipts IN SHARE MODE;
DO $pre$ BEGIN
 IF to_regnamespace('${ns}') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448300')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448300')
 OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR NOT EXISTS(SELECT 1 FROM public.hotels WHERE id='${hotel}' AND minimum_child_age=15 AND children_policy='minimum_age' AND architecture_version='legacy')
 OR hotels_lifecycle_private.public_booking_enabled() IS NOT FALSE
 THEN RAISE EXCEPTION 'hotels_114484_boundary_or_foundation_mismatch'; END IF;
 PERFORM hotels_read_once_private.assert_exact();
END $pre$;
CREATE SCHEMA ${ns} AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA ${ns} FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE ${ns}.bindings(signature text PRIMARY KEY,before_source text NOT NULL,before_definition text NOT NULL,before_metadata jsonb NOT NULL,after_source text NOT NULL,after_hash text NOT NULL);
CREATE TABLE ${ns}.receipt(id integer PRIMARY KEY CHECK(id=1),mutable_columns text[] NOT NULL CHECK(mutable_columns=ARRAY['children_policy','minimum_child_age']::text[]),historical_foundation jsonb NOT NULL,historical_foundation_hash text NOT NULL,hotel_anchor jsonb NOT NULL,normalized_hotel_hash text NOT NULL,activity_ids uuid[] NOT NULL,business_before text NOT NULL,bindings_hash text NOT NULL,helpers jsonb NOT NULL,relations jsonb NOT NULL);
CREATE FUNCTION ${ns}.raw_metadata(p_oid oid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS ${lit(metadataBody)};
CREATE FUNCTION ${ns}.relation_catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
SELECT jsonb_build_object('schema',(SELECT jsonb_build_array(nspowner,nspacl) FROM pg_namespace WHERE nspname='${ns}'),
'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'kind',r.relkind,'owner',r.relowner,'rls',r.relrowsecurity,'force',r.relforcerowsecurity,'acl',r.relacl,
'columns',(SELECT jsonb_agg(jsonb_build_array(attname,atttypid,atttypmod,attnotnull) ORDER BY attnum) FROM pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped),
'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid=r.oid),
'policies',(SELECT jsonb_agg(to_jsonb(p)-'oid'-'polrelid' ORDER BY polname) FROM pg_policy p WHERE polrelid=r.oid),
'triggers',(SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled,pg_get_triggerdef(oid)) ORDER BY tgname) FROM pg_trigger WHERE tgrelid=r.oid AND NOT tgisinternal)) ORDER BY r.relname)
FROM pg_class r WHERE r.relnamespace='${ns}'::regnamespace AND r.relkind IN('r','p','v','m','f')))
$f$;
CREATE FUNCTION ${ns}.immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
BEGIN RAISE EXCEPTION 'hotels_114484_evidence_immutable'; END $f$;
CREATE FUNCTION ${ns}.assert_exact() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE c ${ns}.receipt%rowtype; b record;
BEGIN
 SELECT * INTO STRICT c FROM ${ns}.receipt WHERE id=1;
 IF (SELECT count(*) FROM ${ns}.receipt)<>1
 OR c.mutable_columns IS DISTINCT FROM ARRAY['children_policy','minimum_child_age']::text[]
 OR c.bindings_hash IS DISTINCT FROM (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(x) ORDER BY signature)::text,'UTF8')),'hex') FROM ${ns}.bindings x)
 OR c.historical_foundation IS DISTINCT FROM (SELECT to_jsonb(x) FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts x WHERE id=1)
 OR c.historical_foundation_hash IS DISTINCT FROM encode(sha256(convert_to(c.historical_foundation::text,'UTF8')),'hex')
 THEN RAISE EXCEPTION 'hotels_114484_evidence_drift'; END IF;
 FOR b IN SELECT * FROM ${ns}.bindings LOOP
  IF ${ns}.raw_metadata(to_regprocedure(b.signature))-0-0 IS DISTINCT FROM b.before_metadata-0-0
   OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure(b.signature)) IS DISTINCT FROM b.after_hash
   OR pg_get_functiondef(to_regprocedure(b.signature)) IS DISTINCT FROM replace(b.before_definition,b.before_source,b.after_source)
  THEN RAISE EXCEPTION 'hotels_114484_bound_source_security_drift:%',b.signature; END IF;
 END LOOP;
 IF c.helpers IS DISTINCT FROM (SELECT jsonb_object_agg(p.oid::regprocedure::text,${ns}.raw_metadata(p.oid)) FROM pg_proc p WHERE p.pronamespace='${ns}'::regnamespace)
 OR c.relations IS DISTINCT FROM ${ns}.relation_catalog()
 OR EXISTS(SELECT 1 FROM pg_class r WHERE r.relnamespace='${ns}'::regnamespace AND r.relkind='r' AND (r.relowner<>'postgres'::regrole OR NOT r.relrowsecurity OR NOT r.relforcerowsecurity
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=r.oid)
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a WHERE a.grantee<>r.relowner)
 OR (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid=r.oid AND NOT t.tgisinternal AND t.tgname='immutable' AND t.tgenabled='O' AND t.tgtype=58 AND t.tgfoid='${ns}.immutable()'::regprocedure)<>1))
 THEN RAISE EXCEPTION 'hotels_114484_helper_security_drift'; END IF;
END $f$;
CREATE FUNCTION ${ns}.original_source(p_oid oid) RETURNS text LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE b ${ns}.bindings%rowtype; s text;
BEGIN
 SELECT * INTO b FROM ${ns}.bindings WHERE to_regprocedure(signature)=p_oid;
 SELECT prosrc INTO s FROM pg_proc WHERE oid=p_oid;
 IF b.signature IS NOT NULL THEN
  -- Validate this exact binding, not the whole dependency graph per catalog row.
  -- historical_hotel/assert_exact additionally validates the complete successor.
  IF encode(sha256(convert_to(s,'UTF8')),'hex') IS DISTINCT FROM b.after_hash
   OR ${ns}.raw_metadata(p_oid)-0-0 IS DISTINCT FROM b.before_metadata-0-0
   OR encode(sha256(convert_to(b.before_source,'UTF8')),'hex') IS DISTINCT FROM b.before_metadata->>0
   OR pg_get_functiondef(p_oid) IS DISTINCT FROM replace(b.before_definition,b.before_source,b.after_source)
  THEN RAISE EXCEPTION 'hotels_114484_bound_source_security_drift'; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END $f$;
CREATE FUNCTION ${ns}.original_definition(p_oid oid) RETURNS text LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE d text; BEGIN
 PERFORM ${ns}.original_source(p_oid);
 SELECT before_definition INTO d FROM ${ns}.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END $f$;
CREATE FUNCTION ${ns}.original_metadata(p_oid oid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE m jsonb; BEGIN
 PERFORM ${ns}.original_source(p_oid);
 SELECT before_metadata INTO m FROM ${ns}.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(m,${ns}.raw_metadata(p_oid));
END $f$;
CREATE FUNCTION ${ns}.historical_hotel(p_hotel jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE c ${ns}.receipt%rowtype; a record; expected jsonb;
BEGIN
 PERFORM ${ns}.assert_exact();
 SELECT * INTO STRICT c FROM ${ns}.receipt WHERE id=1;
 IF p_hotel->>'id' IS DISTINCT FROM '${hotel}'
 OR encode(sha256(convert_to((p_hotel-ARRAY['pricing_tiers','updated_at','children_policy','minimum_child_age'])::text,'UTF8')),'hex') IS DISTINCT FROM c.normalized_hotel_hash
 THEN RAISE EXCEPTION 'hotels_114484_non_guest_property_drift'; END IF;
 expected:=c.hotel_anchor;
 FOR a IN SELECT * FROM public.hotel_activity_log WHERE hotel_id='${hotel}' AND source='hotels_v2_admin_b_guest_policy' AND entity_type='property' AND NOT(id=ANY(c.activity_ids)) ORDER BY created_at,id LOOP
  IF a.actor_type IS DISTINCT FROM 'admin' OR a.actor_id IS NULL OR a.correlation_id IS NULL
  OR (a.before_state-ARRAY['updated_at','pricing_tiers']) IS DISTINCT FROM (expected-ARRAY['updated_at','pricing_tiers'])
  OR (a.before_state-ARRAY['updated_at','children_policy','minimum_child_age']) IS DISTINCT FROM (a.after_state-ARRAY['updated_at','children_policy','minimum_child_age'])
  OR public.hotel_v2_h2b1_children_policy_valid(a.after_state->>'children_policy',(a.after_state->>'minimum_child_age')::integer,false) IS NOT TRUE
  THEN RAISE EXCEPTION 'hotels_114484_guest_policy_audit_drift'; END IF;
  expected:=a.after_state;
 END LOOP;
 IF (p_hotel-ARRAY['updated_at','pricing_tiers']) IS DISTINCT FROM (expected-ARRAY['updated_at','pricing_tiers'])
 THEN RAISE EXCEPTION 'hotels_114484_guest_policy_unreviewed'; END IF;
 RETURN p_hotel||jsonb_build_object('children_policy',c.hotel_anchor->'children_policy','minimum_child_age',c.hotel_anchor->'minimum_child_age');
END $f$;
INSERT INTO ${ns}.bindings VALUES
${bindingSql};
DO $install$ DECLARE b record; stmt text; BEGIN
 FOR b IN SELECT * FROM ${ns}.bindings LOOP
  IF ${ns}.raw_metadata(to_regprocedure(b.signature)) IS DISTINCT FROM b.before_metadata
  THEN RAISE EXCEPTION 'hotels_114484_predecessor_drift:%',b.signature; END IF;
 END LOOP;
 FOR b IN SELECT * FROM ${ns}.bindings LOOP
  stmt:=replace(b.before_definition,b.before_source,b.after_source);
  IF stmt=b.before_definition THEN RAISE EXCEPTION 'hotels_114484_patch_missing'; END IF;
  EXECUTE stmt;
 END LOOP;
END $install$;
DO $secure$ DECLARE p record; r text; BEGIN
 FOR p IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE pronamespace='${ns}'::regnamespace LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.sig);
 END LOOP;
 FOREACH r IN ARRAY ARRAY['bindings','receipt'] LOOP
  EXECUTE format('ALTER TABLE ${ns}.%I ENABLE ROW LEVEL SECURITY',r);
  EXECUTE format('ALTER TABLE ${ns}.%I FORCE ROW LEVEL SECURITY',r);
  EXECUTE format('REVOKE ALL ON ${ns}.%I FROM PUBLIC,anon,authenticated,service_role',r);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ${ns}.%I FOR EACH STATEMENT EXECUTE FUNCTION ${ns}.immutable()',r);
 END LOOP;
END $secure$;
INSERT INTO ${ns}.receipt SELECT 1,ARRAY['children_policy','minimum_child_age']::text[],to_jsonb(f),encode(sha256(convert_to(to_jsonb(f)::text,'UTF8')),'hex'),to_jsonb(h),
 encode(sha256(convert_to((to_jsonb(h)-ARRAY['pricing_tiers','updated_at','children_policy','minimum_child_age'])::text,'UTF8')),'hex'),
 coalesce((SELECT array_agg(id) FROM public.hotel_activity_log WHERE hotel_id='${hotel}' AND source='hotels_v2_admin_b_guest_policy' AND entity_type='property'),'{}'::uuid[]),
 hotels_stripe_dto_private.business_hash(),(SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,'UTF8')),'hex') FROM ${ns}.bindings b),
 (SELECT jsonb_object_agg(p.oid::regprocedure::text,${ns}.raw_metadata(p.oid)) FROM pg_proc p WHERE p.pronamespace='${ns}'::regnamespace),${ns}.relation_catalog()
 FROM public.hotels h CROSS JOIN public.hotel_seven_arches_reviewed_pricing_foundation_receipts f WHERE h.id='${hotel}' AND f.id=1;
DO $post$ BEGIN
 PERFORM ${ns}.assert_exact();
 IF public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR hotels_stripe_dto_private.business_hash() IS DISTINCT FROM (SELECT business_before FROM ${ns}.receipt WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_114484_install_postcondition'; END IF;
 PERFORM hotels_read_once_private.assert_exact();
END $post$;
COMMIT;
`;
}
function preaction(){
 const signatures=[...names,'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)','public.hotel_v2_admin_c_cross_domain_constraint_trigger()','public.hotel_v2_admin_c_validate_cross_domain_hotel(uuid)','public.hotel_v2_admin_c_validate_pricing_graph(uuid)','public.hotel_v2_h2b1_children_policy_valid(text,integer,boolean)'];
 const expected=signatures.map(s=>`(${lit(s)},${lit(sql(`SELECT (${metadataBody.replace('p.oid=p_oid',`p.oid=${lit(s)}::regprocedure`)})`))}::jsonb)`).join(',\n');
 return `BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path=pg_catalog,public;
WITH expected(signature,metadata) AS(VALUES
${expected}
), pins AS MATERIALIZED(SELECT bool_and(e.metadata IS NOT DISTINCT FROM (${metadataBody.replace('p.oid=p_oid','p.oid=to_regprocedure(e.signature)')})) AS exact FROM expected e),
oracle AS MATERIALIZED(SELECT public.hotel_v2_seven_arches_reviewed_pricing_oracle() AS v)
SELECT ordinal,check_name,passed FROM(VALUES
(1,'read_only',current_setting('transaction_read_only')='on'),
(2,'114483_recorded',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448300')),
(3,'114484_absent',to_regnamespace('${ns}') IS NULL AND NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448300')),
(4,'source_security_exact',(SELECT exact FROM pins)),
(5,'foundation_and_successor_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS TRUE AND public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS TRUE),
(6,'child_age_15',EXISTS(SELECT 1 FROM public.hotels WHERE id='${hotel}' AND children_policy='minimum_age' AND minimum_child_age=15 AND architecture_version='legacy')),
(7,'tiers_27_27_authority_54',(SELECT count(*)=54 FROM public.hotel_seven_arches_independent_pricing_authority) AND (SELECT count(*)=27 FROM public.hotel_pricing_schedule_occupancy_tiers WHERE schedule_id='aec20731-7a56-35f0-334e-92b363351f02') AND (SELECT count(*)=27 FROM public.hotel_pricing_schedule_occupancy_tiers WHERE schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b')),
(8,'parity_100_0',(SELECT v->>'core_case_count'='100' AND v->>'core_mismatch_count'='0' AND v->>'guest_one_case_count'='20' AND v->>'guest_one_mismatch_count'='0' FROM oracle)),
(9,'commission_eur10',(SELECT count(*)=1 FROM public.hotel_commission_policies WHERE hotel_id='${hotel}' AND commission_mode='per_allocated_room_per_night' AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed')),
(10,'payment_lineage',public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE),
(11,'flags_exact',hotels_lifecycle_private.safe_state()->'feature_flags'='{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}'::jsonb),
(12,'public_booking_off',hotels_lifecycle_private.public_booking_enabled() IS FALSE)
) g(ordinal,check_name,passed) ORDER BY ordinal;
ROLLBACK;
`;
}
function postinstall(){return `BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path=pg_catalog,public;
WITH verified AS MATERIALIZED(SELECT ${ns}.assert_exact()), r AS MATERIALIZED(SELECT * FROM ${ns}.receipt WHERE id=1)
SELECT ordinal,check_name,passed FROM(VALUES
(1,'read_only',current_setting('transaction_read_only')='on'),
(2,'successor_evidence_source_security_exact',(SELECT count(*)=1 FROM verified)),
(3,'old_foundation_unchanged',(SELECT historical_foundation=(SELECT to_jsonb(f) FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts f WHERE id=1) FROM r)),
(4,'zero_install_business_mutation',(SELECT business_before=hotels_stripe_dto_private.business_hash() FROM r)),
(5,'child_age_15',(SELECT minimum_child_age=15 FROM public.hotels WHERE id='${hotel}')),
(6,'current_pricing_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS TRUE),
(7,'payment_lineage',public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE),
(8,'commission_eur10',(SELECT count(*)=1 FROM public.hotel_commission_policies WHERE hotel_id='${hotel}' AND commission_mode='per_allocated_room_per_night' AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed')),
(9,'flags_exact',hotels_lifecycle_private.safe_state()->'feature_flags'='{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}'::jsonb),
(10,'public_booking_off',hotels_lifecycle_private.public_booking_enabled() IS FALSE)
) g(ordinal,check_name,passed) ORDER BY ordinal;
ROLLBACK;
`;}
if(process.argv.includes('--generate'))console.log(generate());
else if(process.argv.includes('--preaction'))console.log(preaction());
else if(process.argv.includes('--postinstall'))console.log(postinstall());
else {
 let passed=0;const pass=n=>console.log('PASS '+(++passed)+' '+n);
 const claims=`SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true) IS NOT NULL;SET LOCAL ROLE authenticated;`;
 const plan=age=>JSON.parse(sql(`SELECT jsonb_build_object('hotel_id',id,'expected_property_updated_at',updated_at,'reviewed_at',clock_timestamp(),'property_policy',jsonb_build_object('children_policy',children_policy,'minimum_child_age',${age})) FROM public.hotels WHERE id='${hotel}'`));
 const apply=(p,id)=>run(`BEGIN;${claims}SELECT public.hotel_v2_admin_apply_guest_policy_plan(${lit(JSON.stringify(p))}::jsonb,${lit(id)}::uuid) ? 'workspace';COMMIT;`);
 const age=()=>sql(`BEGIN;${claims}SELECT public.hotel_v2_admin_get_property_workspace('${hotel}')#>>'{property,minimum_child_age}';ROLLBACK;`).split('\n').at(-1);
 const business=()=>sql('SELECT hotels_stripe_dto_private.business_hash()');
 const state=()=>JSON.parse(sql('SELECT public.hotel_v2_seven_arches_reviewed_pricing_current_state()'));
 const relations=JSON.parse(sql("SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN('public','hotels_lineage_private','hotels_lifecycle_private','hotel_stripe_connect_private','hotels_v2_private')"));
 const protectedSnapshot=()=>sql('SELECT jsonb_object_agg(name,h) FROM ('+relations.map(r=>{
  let row='to_jsonb(x)',where='';
  if(r==='public.hotels')row=`CASE WHEN x.id='${hotel}' THEN to_jsonb(x)-ARRAY['children_policy','minimum_child_age','updated_at'] ELSE to_jsonb(x) END`;
  if(r==='public.hotel_activity_log')where=" WHERE correlation_id NOT IN('85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000004') OR correlation_id IS NULL";
  return `SELECT ${lit(r)} AS name,encode(sha256(convert_to(coalesce(jsonb_agg(${row} ORDER BY ${row}::text),'[]'::jsonb)::text,'UTF8')),'hex') AS h FROM ${r} x${where}`;
 }).join(' UNION ALL ')+') t');
 const protectedBefore=protectedSnapshot();
 const initial=business();assert.equal(age(),'15');
 const pre=sql(readFileSync('/private/tmp/hotels_v2_114484_preactivation_readonly.sql','utf8')).split('\n');assert.equal(pre.length,12);assert.ok(pre.every(x=>x.endsWith('|t')));pass('preaction 12/12');
 const baseline=apply(plan(16),'85000000-0000-4000-8000-000000000001');
 assert.notEqual(baseline.status,0);assert.match(baseline.stderr,/hotels_v2_seven_arches_pricing_activation_state_invalid/);assert.equal(business(),initial);pass('baseline 23514 at COMMIT; complete rollback');
 const installed=run(readFileSync('supabase/migrations/20260811448400_hotels_v2_guest_policy_foundation_evolution.sql','utf8'));
 assert.equal(installed.status,0,installed.stderr);assert.equal(business(),initial);pass('migration installation; zero business changes');
 const post=sql(readFileSync('/private/tmp/hotels_v2_114484_postinstall_readonly.sql','utf8')).split('\n');assert.equal(post.length,10);assert.ok(post.every(x=>x.endsWith('|t')));pass('postinstall 10/10');
 const before=state();const stale=plan(16);
 const up=apply(stale,'85000000-0000-4000-8000-000000000002');assert.equal(up.status,0,up.stderr);assert.equal(age(),'16');pass('reviewed 15->16 commits and authoritative reload=16');
 assert.deepEqual(state(),before);pass('pricing and complete current-state fingerprints unchanged');
 assert.equal(protectedSnapshot(),protectedBefore);pass('all protected business tables/receipts/flags/bookings unchanged at age16');
 const reads=sql(`BEGIN;${claims}SELECT public.hotel_v2_admin_get_seven_arches_pricing_activation_114483()->>'status'='active' AND public.hotel_v2_admin_get_shadow_preparation_state_114483('${hotel}')->>'status'='SUCCESSOR_ALREADY_COMPLETE' AND public.hotel_v2_admin_get_legacy_pricing_promotion_preview_114483('${hotel}')->'supported'='true'::jsonb;ROLLBACK;`).split('\n').at(-1);
 assert.equal(reads,'t');pass('all three optimized 114483 read paths remain successor-safe at age16');
 const staleResult=apply(stale,'85000000-0000-4000-8000-000000000003');assert.notEqual(staleResult.status,0);assert.match(staleResult.stderr,/stale_guest_policy_property/);pass('stale review fails');
 const down=apply(plan(15),'85000000-0000-4000-8000-000000000004');assert.equal(down.status,0,down.stderr);assert.equal(age(),'15');assert.deepEqual(state(),before);pass('reviewed 16->15 commits; authoritative reload=15');
 assert.equal(protectedSnapshot(),protectedBefore);pass('all protected business tables/receipts/flags/bookings unchanged at age15');
 for(const field of ['pricing_tiers','pricing_schedule_id','nightly_rate','commission','payment_policy','feature_flags','public_booking_enabled','booking_id','title']){
  const p=plan(16);p.property_policy[field]='forbidden';const beforeFail=business();const r=apply(p,'85000000-0000-4000-8000-000000000099');
  assert.notEqual(r.status,0);assert.match(r.stderr,/invalid_property_guest_policy/);assert.equal(business(),beforeFail);pass('guest-policy side channel rejected: '+field);
 }
 for(const [name,q] of [
  ['arbitrary Hotel field',`UPDATE public.hotels SET city='Unauthorized' WHERE id='${hotel}';SELECT ${ns}.historical_hotel(to_jsonb(h)) FROM public.hotels h WHERE id='${hotel}'`],
  ['unreviewed Guest Policy',`UPDATE public.hotels SET minimum_child_age=16 WHERE id='${hotel}';SELECT ${ns}.historical_hotel(to_jsonb(h)) FROM public.hotels h WHERE id='${hotel}'`],
  ['old receipt UPDATE','UPDATE public.hotel_seven_arches_reviewed_pricing_foundation_receipts SET initial_unrelated_fingerprint=repeat(\'0\',64)'],
  ['old receipt DELETE','DELETE FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts'],
  ['successor receipt UPDATE',`UPDATE ${ns}.receipt SET normalized_hotel_hash=repeat('0',64)`],
  ['successor receipt DELETE',`DELETE FROM ${ns}.receipt`],
  ['bound function definition drift',`ALTER FUNCTION public.hotel_v2_seven_arches_reviewed_pricing_current_state() COST 101;SELECT ${ns}.assert_exact()`],
  ['successor execution ACL',`GRANT EXECUTE ON FUNCTION ${ns}.historical_hotel(jsonb) TO authenticated;SELECT ${ns}.assert_exact()`],
 ]){const b=business();const r=run('BEGIN;'+q+';COMMIT;');assert.notEqual(r.status,0,name);assert.equal(business(),b);pass(name+' fails closed');}
 console.log(JSON.stringify({passed,production_access:false,age:age()}));
}
