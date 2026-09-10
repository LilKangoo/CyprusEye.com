// Targeted local-only successor/DTO test. No production URI or Stripe client.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {dirname,resolve} from 'node:path';
import {build,pins} from './hotels-v2-114481-gates.mjs';
import {targets,lit,compile,hash,schema} from './hotels-v2-114481-contract.mjs';
const bin=process.env.HOTELS_114481_PSQL,port=process.env.HOTELS_114481_PORT;
const baseline=process.env.HOTELS_114481_BASELINE,db=process.env.HOTELS_114481_DB;
assert.ok(bin);assert.equal(port,'55489');
for(const value of [baseline,db])assert.match(value||'',/^hotels_114481_[a-z0-9_]+$/);
assert.notEqual(baseline,db);
const args=name=>['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',name];
function run(input,name=db){return spawnSync(bin,args(name),{input,encoding:'utf8',maxBuffer:16e6});}
function sql(input,name=db){const r=run(input,name);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
for(const name of [db,baseline])assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()",name),`${name}|127.0.0.1|${port}`);
const migration=fs.readFileSync('supabase/migrations/20260811448100_hotels_v2_stripe_readonly_dto_successor.sql','utf8');
const b=JSON.parse(sql(`BEGIN READ ONLY;SET LOCAL search_path=pg_catalog,public;SELECT jsonb_object_agg(s,jsonb_build_object('source',p.prosrc,'definition',pg_get_functiondef(p.oid),'metadata',hotels_lifecycle_private.metadata(p.oid))) FROM unnest(ARRAY[${targets.map(lit)}]) x(s) JOIN pg_proc p ON p.oid=to_regprocedure(s);ROLLBACK;`,baseline));
assert.equal(compile(b),migration,'compiler/source/security provenance');
const snapshot=()=>sql(`SELECT ${schema}.business_hash()`),before=snapshot();
assert.equal(before,sql(`SELECT business_hash FROM ${schema}.certificate WHERE id=1`));
const results={local_only:true,baseline_boundary:114480,install_boundary:114481,checks:[],production_access:false};
for(const [name,change] of [
 ['missing_114480_history',"DELETE FROM supabase_migrations.schema_migrations WHERE version='20260811448000'"],
 ['premature_114481_history',"INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811448100')"],
 ['predecessor_public_acl',`GRANT EXECUTE ON FUNCTION ${targets[0]} TO PUBLIC`],
 ['predecessor_search_path',`ALTER FUNCTION ${targets[0]} SET search_path=public`],
 ]){
 const r=run(migration.replace('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
  'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;\n'+change+';').replace(/^COMMIT;$/m,'ROLLBACK;'),baseline);
 assert.notEqual(r.status,0,name);assert.match(r.stderr,/hotels_114481_boundary_mismatch|hotels_114481_precondition_failed|hotels_lifecycle_catalog_drift/);
 assert.equal(sql(`SELECT to_regnamespace('${schema}') IS NULL`,baseline),'t');results.checks.push({name,pass:true});
}
for(const phase of ['preactivation','postinstall']){
 const g=build(phase);assert.equal(g.sql,fs.readFileSync(`supabase/manual/hotels_v2_114481_${phase}_readonly.sql`,'utf8'));
 const rows=sql(g.sql,phase==='preactivation'?baseline:db).split('\n');assert.equal(rows.length,g.rows);
 assert.ok(rows.every(row=>row.endsWith('|t')),rows.filter(row=>!row.endsWith('|t')).join('\n'));
 results.checks.push({name:phase,rows:g.rows,pass:true});
}
const replay=run(migration);assert.notEqual(replay.status,0);assert.match(replay.stderr,/hotels_114481_boundary_mismatch/);assert.equal(snapshot(),before);
results.checks.push({name:'replay_rejected_unchanged',pass:true});
const admin='10000000-0000-4000-8000-000000000001',owner='10000000-0000-4000-8000-000000000002';
const partner=sql("SELECT hotels_lineage_private.permission_evidence()->>'partner_id'");
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca',foreign='90000000-0000-4000-8000-000000000099';
const claims=actor=>`SELECT set_config('request.jwt.claims',${lit(JSON.stringify({sub:actor,role:'authenticated'}))},true) IS NOT NULL;`;
function dto(actor,query,setup=''){
 const out=sql(`BEGIN;${setup}${claims(actor)} SET LOCAL ROLE authenticated;SELECT ${query};ROLLBACK;`).split('\n');return JSON.parse(out.at(-1));
}
const adminGet=`public.hotel_v2_admin_get_partner_stripe_onboarding_authorization('${partner}')`;
const partnerGet=`public.hotel_v2_partner_get_workspace('${partner}','${hotel}',CURRENT_DATE,CURRENT_DATE+7)`;
const av=dto(admin,adminGet);assert.deepEqual(Object.keys(av).sort(),['account_exists','account_status','contract_version','enabled','partner_id','platform_enabled','version']);assert.equal(av.account_exists,false);assert.equal(av.account_status,'NOT_CONNECTED');
const pv=dto(owner,partnerGet).stripe_connection;
assert.equal(pv.platform_ready,false);assert.equal(pv.attestation_status,'MISSING');assert.equal(pv.onboarding_authorized,false);assert.equal(pv.can_connect,false);
assert.ok(!JSON.stringify(av).includes('account_id'));assert.ok(!JSON.stringify(pv).includes('account_id'));
results.checks.push({name:'exact_admin_partner_dtos',pass:true});
for(const [name,actor,query] of [['partner_cannot_read_admin',owner,adminGet],['foreign_actor',foreign,partnerGet],['foreign_partner',owner,partnerGet.replace(partner,foreign)],['foreign_hotel',owner,partnerGet.replace(hotel,foreign)]]){
 const r=run(`BEGIN;${claims(actor)} SET LOCAL ROLE authenticated;SELECT ${query};ROLLBACK;`);assert.notEqual(r.status,0,name);assert.match(r.stderr,name==='foreign_hotel'?/hotels_v2_h3_2b_legacy_architecture_guard/:/denied|required|not_found|not available/i,name);results.checks.push({name,pass:true});
}
for(const role of ['anon','service_role']){
 const r=run(`BEGIN;SET LOCAL ROLE ${role};SELECT ${adminGet};ROLLBACK;`);assert.notEqual(r.status,0);assert.match(r.stderr,/permission denied/);results.checks.push({name:role+'_admin_denied',pass:true});
}
for(const [status,ready,version,age] of [
 ['NOT_READY',false,'hotels_standard_connect_server_v1','1 minute'],
 ['NOT_READY',true,'invalid','1 minute'],
 ['STALE',true,'hotels_standard_connect_server_v1','15 minutes'],
 ['STALE',true,'hotels_standard_connect_server_v1','16 minutes'],
 ['READY',true,'hotels_standard_connect_server_v1','14 minutes'],
]){
 const setup=`INSERT INTO hotels_lifecycle_private.stripe_readiness VALUES(gen_random_uuid(),${ready},${lit(version)},statement_timestamp()-interval '${age}');`;
 const v=dto(owner,partnerGet,setup).stripe_connection;assert.equal(v.attestation_status,status);assert.equal(v.platform_ready,status==='READY');assert.equal(v.can_connect,false);results.checks.push({name:'attestation_'+status+'_'+age+'_'+ready,pass:true});
}
for(const status of ['ONBOARDING_INCOMPLETE','CONNECTED','RESTRICTED','ACTION_REQUIRED','DISABLED']){
 const setup=`INSERT INTO hotel_stripe_connect_private.accounts(partner_id,account_id,live_mode,status) VALUES('${partner}','acct_SYNTHETIC114481',false,'${status}');`;
 const v=dto(admin,adminGet,setup);assert.equal(v.account_exists,true);assert.equal(v.account_status,status);assert.ok(!JSON.stringify(v).includes('acct_'));results.checks.push({name:'safe_account_'+status,pass:true});
}
// Every drift probe is a rolled-back local transaction. Existing receipts never
// need disabling/rewrite in the migration. Negative DDL is fixture-only.
const negatives=[
 ...targets.map(s=>['bound_source_'+s,`CREATE OR REPLACE FUNCTION `]),
 ['public_acl',`GRANT EXECUTE ON FUNCTION ${targets[0]} TO PUBLIC`],
 ['missing_admin_acl',`REVOKE EXECUTE ON FUNCTION ${targets[0]} FROM authenticated`],
 ['partner_acl',`GRANT EXECUTE ON FUNCTION ${targets[1]} TO authenticated`],
 ['owner',`ALTER FUNCTION ${targets[0]} OWNER TO authenticated`],
 ['invoker',`ALTER FUNCTION ${targets[0]} SECURITY INVOKER`],
 ['search_path',`ALTER FUNCTION ${targets[0]} SET search_path=public`],
 ['binding_rls',`ALTER TABLE ${schema}.bindings DISABLE ROW LEVEL SECURITY`],
 ['binding_acl',`GRANT SELECT ON ${schema}.bindings TO authenticated`],
 ['binding_policy',`CREATE POLICY unexpected ON ${schema}.bindings USING(true)`],
 ['certificate_trigger',`ALTER TABLE ${schema}.certificate DISABLE TRIGGER certificate_immutable`],
 ['helper_acl',`GRANT EXECUTE ON FUNCTION ${schema}.predecessor_source(oid) TO anon`],
 ];
for(let [name,change]of negatives){
 if(name.startsWith('bound_source_')){const s=name.slice('bound_source_'.length),definition=sql(`SELECT pg_get_functiondef('${s}'::regprocedure)`);change=definition.replace(/AS (\$\w*\$)/,'AS $1\n-- synthetic drift\n');}
 const r=run(`BEGIN;${change};SELECT ${schema}.assert_exact();ROLLBACK;`);assert.notEqual(r.status,0,name);results.checks.push({name,pass:true});
}
for(const signature of Object.keys(pins.after).filter(s=>s.startsWith(schema+'.'))){
 const definition=sql(`SELECT pg_get_functiondef('${signature}'::regprocedure)`);
 const change=signature===schema+'.assert_exact()'
  ? `CREATE OR REPLACE FUNCTION ${signature} RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$BEGIN RETURN;END$$`
  : definition.replace(/AS (\$\w*\$)/,'AS $1\n-- synthetic helper drift\n');
 const r=run(`BEGIN;${change};${claims(admin)} SET LOCAL ROLE authenticated;SELECT ${adminGet};ROLLBACK;`);
 assert.notEqual(r.status,0,signature+' must be detected through public entry');results.checks.push({name:'kernel_drift_'+signature,pass:true});
}
for(const mutation of [`UPDATE ${schema}.bindings SET after_hash=repeat('0',64)`,`DELETE FROM ${schema}.certificate`,`TRUNCATE ${schema}.bindings`]){const r=run('BEGIN;'+mutation+';ROLLBACK;');assert.notEqual(r.status,0);assert.match(r.stderr,/immutable/i);results.checks.push({name:'immutable_receipt',pass:true});}
assert.equal(snapshot(),before,'all local probes rolled back');
assert.equal(sql('SELECT hotels_lineage_private.current_anchor_is_exact(),public.hotel_v2_seven_arches_payment_policy_lineage_is_exact(),hotels_lifecycle_private.public_booking_enabled()'),'t|t|f');
assert.equal(sql('SELECT public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NOT NULL,public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),public.hotel_v2_external_calendar_provider_evolution_is_safe()'),'t|t|t|t|t');
// Real loopback PostgREST transport, ephemeral local-only key, read RPCs only.
const binary=process.env.HOTELS_114481_POSTGREST;assert.ok(binary);
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const httpPort=socket.address().port;await new Promise(r=>socket.close(r));
const secret=randomBytes(48).toString('hex'),part=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function token(actor){const value=part({alg:'HS256',typ:'JWT'})+'.'+part({role:'authenticated',sub:actor,exp:Math.floor(Date.now()/1000)+120});return value+'.'+createHmac('sha256',secret).update(value).digest('base64url');}
const child=spawn(binary,[],{env:{...process.env,DYLD_LIBRARY_PATH:resolve(dirname(bin),'../lib'),PGRST_DB_URI:`postgres://authenticator@127.0.0.1:${port}/${db}`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(httpPort),PGRST_LOG_LEVEL:'crit'},stdio:['ignore','ignore','pipe']});
const base=`http://127.0.0.1:${httpPort}`;let diagnostics='';child.stderr.on('data',b=>diagnostics+=b);
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,diagnostics.replaceAll(secret,'[local-key]'));
 const signature=sql("SELECT pg_get_function_identity_arguments('public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure)");
 const names=signature.split(', ').map(s=>s.split(' ')[0]);
 for(const [actor,rpc,args,expectedStatus]of [
 [admin,'hotel_v2_admin_get_partner_stripe_onboarding_authorization',{p_partner_id:partner},200],
 [owner,'hotel_v2_admin_get_partner_stripe_onboarding_authorization',{p_partner_id:partner},403],
 [owner,'hotel_v2_partner_get_workspace',Object.fromEntries(names.map((n,i)=>[n,[partner,hotel,'2026-09-10','2026-09-17'][i]])),200],
 [owner,'hotel_v2_partner_get_workspace',Object.fromEntries(names.map((n,i)=>[n,[foreign,hotel,'2026-09-10','2026-09-17'][i]])),403],
 ]){
  const response=await fetch(base+'/rpc/'+rpc,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token(actor)},body:JSON.stringify(args)});const value=await response.json();assert.equal(response.status,expectedStatus,rpc+':'+(value.code||''));
  if(expectedStatus===200){if(rpc.includes('authorization'))assert.equal(value.account_status,'NOT_CONNECTED');else assert.equal(value.stripe_connection.attestation_status,'MISSING');}
  results.checks.push({name:'postgrest_'+rpc,http:response.status,pass:true});
 }
}finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
assert.equal(snapshot(),before);results.passed=results.checks.length;results.stripe_api_calls=0;results.flags_unchanged=true;results.read_only_transport=true;
console.log(JSON.stringify(results,null,2));
