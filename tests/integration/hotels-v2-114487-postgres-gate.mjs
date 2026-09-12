// Requires the real, disposable current-repository fixture through 114486,
// with a real audited Stripe-ON lifecycle decision. No production URL accepted.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const bin=process.env.HOTELS_114487_PSQL;
assert.ok(bin,'HOTELS_114487_PSQL required');
const port=process.env.HOTELS_114487_PORT||'55508';
assert.ok(['55508','55509'].includes(port),'Only isolated disposable ports accepted; never 55479/55489/55507');
const run=q=>spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d','hotels_114487_test'],{input:q,encoding:'utf8',maxBuffer:16e6});
const sql=q=>{const r=run(q);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),'hotels_114487_test|127.0.0.1|'+port);
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const rpc='public.hotel_v2_admin_get_content_control_114487';
const claims=id=>`SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-00000000000${id}","role":"authenticated"}',true);SET LOCAL ROLE authenticated;`;
const migration=readFileSync(new URL('../../supabase/migrations/20260811448700_hotels_v2_admin_post_stripe_content_read_successor.sql',import.meta.url),'utf8');
const pre=migration.match(/DO \$pre\$[\s\S]*?END \$pre\$;/)[0];
const post=migration.match(/DO \$post\$[\s\S]*?END \$post\$;/)[0];
let count=0;const pass=s=>{count++;console.log('PASS '+s);};
const permissionsSourceSha='5800d0f35b7b4f289353946177e07daee7f6ce050009d457ba5fbac4f585d2ab';
const permissionsCatalogSha='328994f274b80eec25d8e558915abf8f673ad560a459b54c99ef75682f41619e';
// Exact catalog projection used by the accepted 114480/completion manuals.
// A catalog SHA includes source/security metadata; it is never a prosrc SHA.
const permissionsHashes=()=>JSON.parse(sql(`BEGIN;SET TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog,public;
WITH metadata AS (
 SELECT jsonb_build_object(
  'signature',p.oid::regprocedure::text,'identity_arguments',pg_get_function_identity_arguments(p.oid),
  'result',pg_get_function_result(p.oid),'language',l.lanname,'volatility',p.provolatile,
  'definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'configuration',p.proconfig,
  'strict',p.proisstrict,'parallel',p.proparallel,'leakproof',p.proleakproof,'kind',p.prokind,
  'returns_set',p.proretset,'source_sha',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
  'acl',coalesce((SELECT jsonb_agg(jsonb_build_array(
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
    pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
    ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
    pg_get_userbyid(a.grantor),a.privilege_type)
    FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'[]'::jsonb),
  'effective',jsonb_build_array(has_function_privilege(0::oid,p.oid,'EXECUTE'),
    has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),
    has_function_privilege('service_role',p.oid,'EXECUTE'))) AS value
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('public.hotel_v2_admin_get_partner_hotel_permissions(uuid)')
)
SELECT jsonb_build_object('source_sha',value->>'source_sha',
 'catalog_sha',encode(sha256(convert_to(value::text,'UTF8')),'hex')) FROM metadata;
ROLLBACK;`));
const expectedPermissionsHashes={source_sha:permissionsSourceSha,catalog_sha:permissionsCatalogSha};
assert.deepEqual(permissionsHashes(),expectedPermissionsHashes);
pass('real PostgreSQL proves permissions source 5800 and distinct metadata catalog 328994');
const before=sql('SELECT hotels_stripe_dto_private.business_hash()');
const allFunctions=sql("SELECT coalesce(jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(pg_get_functiondef(p.oid),p.proacl::text) ORDER BY p.oid::regprocedure::text),'{}') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','hotels_lifecycle_private','hotel_stripe_connect_private') AND p.prokind='f'");
const unchangedInventory=()=>sql(`SELECT jsonb_build_object('lifecycle', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY version),'[]') FROM hotels_lifecycle_private.decisions d),'authorization',hotel_stripe_connect_private.authorization_state('0a321bfe-da6b-43f6-8e0b-7c68546a8b18'),'flags',hotels_lifecycle_private.safe_state())`);
const inventory=unchangedInventory();
assert.equal(JSON.parse(inventory).flags.version,6,'exact production-shaped audited version6 fixture');
assert.equal(JSON.parse(inventory).authorization.enabled,false,'Partner authorization remains OFF');
const fail=(label,q,pattern)=>{const r=run('BEGIN;'+q+';ROLLBACK;');assert.notEqual(r.status,0,label);assert.match(r.stderr,pattern,label);assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before,label+' rollback');pass(label);};
assert.equal(pre.split(permissionsSourceSha).length-1,1);
fail('catalog hash substituted for expected prosrc fails closed',
 pre.replace(permissionsSourceSha,permissionsCatalogSha),/hotels_114487_predecessor_source_security_mismatch/);
assert.deepEqual(permissionsHashes(),expectedPermissionsHashes,'failed guard never changes predecessor');
fail('114486 history required',"DELETE FROM supabase_migrations.schema_migrations WHERE version='20260811448600';"+pre,/hotels_114487_boundary_mismatch/);
fail('later history fails closed',"INSERT INTO supabase_migrations.schema_migrations VALUES('20260811448800');"+pre,/hotels_114487_boundary_mismatch/);
for(const signature of ['public.hotel_v2_admin_get_content_control_114485(uuid)','public.hotel_v2_admin_get_stripe_platform_readiness_114486()']){
 fail(signature+' missing search_path rejected',`ALTER FUNCTION ${signature} RESET ALL;`+pre,/hotels_114487_predecessor_source_security_mismatch/);
 fail(signature+' extra ACL rejected',`GRANT EXECUTE ON FUNCTION ${signature} TO anon;`+pre,/hotels_114487_predecessor_source_security_mismatch/);
 fail(signature+' volatility drift rejected',`ALTER FUNCTION ${signature} VOLATILE;`+pre,/hotels_114487_predecessor_source_security_mismatch/);
}
sql(migration);pass('114487 install passes exact real predecessor sources/security');
assert.deepEqual(permissionsHashes(),expectedPermissionsHashes);
pass('114487 installation preserves exact permissions source and metadata catalog hashes');
assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);assert.equal(unchangedInventory(),inventory);pass('install zero business, lifecycle, authorization, account, permission mutation');
assert.equal(sql(`SELECT coalesce(jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(pg_get_functiondef(p.oid),p.proacl::text) ORDER BY p.oid::regprocedure::text),'{}') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','hotels_lifecycle_private','hotel_stripe_connect_private') AND p.prokind='f' AND p.oid<>'${rpc}(uuid)'::regprocedure`),allFunctions);pass('every predecessor function/writer body, configuration and ACL unchanged');
fail('migration replay rejected',pre,/hotels_114487_boundary_mismatch/);
const result=sql(`BEGIN;SET TRANSACTION READ ONLY;${claims(1)}SELECT ${rpc}('${hotel}');ROLLBACK;`).split('\n').at(-1);
const dto=JSON.parse(result);assert.equal(dto.hotel_id,hotel);assert.equal(dto.contract_version,'hotels_v2_admin_b_content_control_v1');
assert.deepEqual(dto.feature_flags,{hotel_rooms_v2_enabled:true,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:true});
assert.deepEqual(dto.assignment_snapshot.feature_flags,dto.feature_flags);assert.ok(dto.assignment_snapshot.assignments.length>0);pass('Admin READ ONLY exact post-Stripe DTO with operational assignments');
console.log('SYNTHETIC_DTO='+result);
fail('frozen114485 still rejects Stripe ON',claims(1)+`SELECT public.hotel_v2_admin_get_content_control_114485('${hotel}')`,/hotels_v2_admin_b_public_activation_guard/);
for(const role of ['anon','service_role'])fail(role+' denied',`SET LOCAL ROLE ${role};SELECT ${rpc}('${hotel}')`,/permission denied/);
fail('non-admin denied',claims(2)+`SELECT ${rpc}('${hotel}')`,/admin|permission|42501/);
fail('missing actor denied',`SET LOCAL ROLE authenticated;SELECT ${rpc}('${hotel}')`,/admin|permission|42501/);
fail('NULL hotel denied',claims(1)+`SELECT ${rpc}(NULL)`,/invalid_content_control_query/);
fail('missing hotel denied',claims(1)+`SELECT ${rpc}('87000000-0000-4000-8000-000000000999')`,/property_not_found/);
const foreign=sql(`SELECT id FROM public.hotels WHERE id<>'${hotel}' LIMIT 1`);assert.ok(foreign,'fixture must include an existing foreign Hotel');
fail('existing foreign hotel denied',claims(1)+`SELECT ${rpc}('${foreign}')`,/property_not_found/);
for(const [flag,value]of [['hotel_stripe_connect_enabled',false],['hotel_rooms_v2_enabled',false],['hotel_external_sync_enabled',false],['hotel_instant_booking_enabled',true]]){
 // Bypass immutable guard only in this rollback-only corrupt synthetic fixture,
 // so the READ itself—not an UPDATE trigger—is proven to reject the state.
 fail('READ rejects '+flag+'='+value,`SET LOCAL session_replication_role=replica;UPDATE public.site_settings SET ${flag}=${value} WHERE id=1;SET LOCAL session_replication_role=origin;${claims(1)}SELECT ${rpc}('${hotel}')`,/lifecycle_flag_state_drift|post_stripe_lifecycle_required/);
}
fail('audited Stripe OFF lifecycle rejected by successor read',claims(1)+`SELECT public.hotel_v2_admin_set_capability_lifecycle('stripe',false,6,'87000000-0000-4000-8000-000000000111','Synthetic 114487 rollback-only disabled lifecycle','CONFIRM_HOTELS_CAPABILITY_CHANGE');SELECT ${rpc}('${hotel}')`,/hotels_114487_post_stripe_lifecycle_required/);
fail('audited Rooms OFF lifecycle rejected by successor read',claims(1)+`SELECT public.hotel_v2_admin_set_capability_lifecycle('rooms',false,6,'87000000-0000-4000-8000-000000000112','Synthetic 114487 rollback-only disabled lifecycle','CONFIRM_HOTELS_CAPABILITY_CHANGE');SELECT ${rpc}('${hotel}')`,/hotels_114487_post_stripe_lifecycle_required/);
fail('READ rejects public-booking state tampering',`SET LOCAL session_replication_role=replica;UPDATE hotels_lifecycle_private.decisions SET after_state=jsonb_set(after_state,'{public_booking_enabled}','true') WHERE version=(SELECT max(version) FROM hotels_lifecycle_private.decisions);SET LOCAL session_replication_role=origin;${claims(1)}SELECT ${rpc}('${hotel}')`,/lifecycle_chain_invalid|unsupported_public_stage/);
fail('new RPC NULL proconfig postcondition rejected',`ALTER FUNCTION ${rpc}(uuid) RESET ALL;`+post,/hotels_114487_source_security_postcondition_failed/);
fail('new RPC extra grantee postcondition rejected',`GRANT EXECUTE ON FUNCTION ${rpc}(uuid) TO anon;`+post,/hotels_114487_source_security_postcondition_failed/);
assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);assert.equal(unchangedInventory(),inventory);pass('all reads/negative tests rolled back; complete business and decision state unchanged');
console.log('TARGETED_SQL='+count+'/'+count+' PASS');
