// Disposable loopback fixture only. The shipped verifier itself never mutates.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {dirname,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {captureQuery,functions,hash} from './hotels-v2-114420-postinstall-contract.mjs';
import {build} from './hotels-v2-114420-postinstall-build.mjs';
const db=process.env.HOTELS_RECONCILIATION_DB,psql=process.env.HOTELS_RECONCILIATION_PSQL,binary=process.env.HOTELS_RECONCILIATION_POSTGREST;
assert.match(db||'',/^hotels_114416_successor_post420_[a-z0-9_]+$/);assert.ok(psql);assert.ok(binary);
function sql(input){const r=spawnSync(psql,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:12e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const verifier=readFileSync('supabase/manual/hotels_v2_114420_postinstall_readonly.sql','utf8');
assert.match(verifier,/^BEGIN;\nSET TRANSACTION READ ONLY;\nSET TRANSACTION ISOLATION LEVEL REPEATABLE READ;/);
assert.match(verifier,/ROLLBACK;\n$/);
assert.equal(build(JSON.parse(sql(captureQuery()))).sql,verifier,'Catalog/source regeneration must be byte-identical');
const specs=[...verifier.matchAll(/\((\d+),'([^']+)','([^']+)','([^']+)',\n[^\n]+\n\s*\$check\1\$([\s\S]*?)\$check\1\$/g)].map(m=>({section:m[2],name:m[3],expected:m[4],query:m[5]}));
assert.equal(specs.length,120);
const tableNames=JSON.parse(sql("SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN('public','auth','hotels_v2_private','hotels_lineage_private')"));
const snapshot=()=>sql('BEGIN READ ONLY;SELECT jsonb_object_agg(name,hash) FROM ('+tableNames.map(t=>`SELECT '${t}' name,public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb)) hash FROM ${t} x`).join(' UNION ALL ')+') x;ROLLBACK;');
const before=snapshot();
const runVerifier=()=>sql(verifier).split('\n').map(line=>line.split('|'));
const start=performance.now(),rows=runVerifier();
assert.equal(rows.length,135);assert.equal(rows.filter(r=>r[5]!=='t').length,0);
assert.deepEqual(rows.at(-1).slice(-4),['t','[]','134','134']);
const version=spawnSync(binary,['--version'],{encoding:'utf8',env:{...process.env,DYLD_LIBRARY_PATH:resolve(dirname(psql),'../lib')}});assert.equal(version.status,0,version.stderr);
const result={postgres:sql('SHOW server_version'),postgrest:version.stdout.trim(),verifier_sha:hash(verifier),rows:rows.length,required_leaves:134,passed_leaves:134,verifier_ms:Number((performance.now()-start).toFixed(3)),negatives:[],gets:[]};
function negative(name,mutation,leaf,section){const s=specs.find(s=>s.name===leaf&&(!section||s.section===section));assert.ok(s,leaf);const actual=sql('BEGIN;SET LOCAL search_path=pg_catalog,public;'+mutation+';'+s.query+';ROLLBACK;');assert.notEqual(actual,s.expected,name);result.negatives.push({name,leaf,fail_closed:true});}
const table='hotel_seven_arches_public_quote_issuances',rel='public.'+table;
for(const role of ['PUBLIC','anon','authenticated','service_role'])negative('unexpected_'+role+'_grant',`GRANT SELECT ON ${rel} TO ${role}`,table+'_security');
negative('grantability',`GRANT SELECT ON ${rel} TO authenticated WITH GRANT OPTION`,table+'_security');
negative('column_acl',`GRANT SELECT(quote_fingerprint) ON ${rel} TO authenticated`,table+'_security');
negative('owner_drift',`ALTER TABLE ${rel} OWNER TO authenticated`,table+'_security');
negative('rls_drift',`ALTER TABLE ${rel} DISABLE ROW LEVEL SECURITY`,table+'_security');
negative('force_rls',`ALTER TABLE ${rel} FORCE ROW LEVEL SECURITY`,table+'_security');
negative('policy_added',`CREATE POLICY diagnostic_extra ON ${rel} FOR SELECT USING(true)`,table+'_security');
negative('extra_column',`ALTER TABLE ${rel} ADD COLUMN diagnostic_extra integer`,table,'bridge_columns');
negative('column_nullability',`ALTER TABLE ${rel} ALTER COLUMN issued_at DROP NOT NULL`,table,'bridge_columns');
negative('column_default',`ALTER TABLE ${rel} ALTER COLUMN issued_at SET DEFAULT clock_timestamp()`,table,'bridge_columns');
negative('constraint_removed',`ALTER TABLE public.hotel_bookings DROP CONSTRAINT hotel_bookings_7a_authority_token_check`,'three_checks_and_no_pricing_fk_drift');
negative('unexpected_index',`CREATE INDEX diagnostic_extra ON ${rel}(issued_at)`,table,'bridge_indexes');
negative('trigger_disabled',`ALTER TABLE ${rel} DISABLE TRIGGER hotel_7a_public_quote_issuance_immutable`,'four_triggers_exact_no_extra');
const partnerFn=functions.find(f=>f.name==='hotel_v2_partner_get_seven_arches_reviewed_pricing').signature;
negative('function_security',`ALTER FUNCTION ${partnerFn} SECURITY INVOKER`,partnerFn);
negative('function_search_path',`ALTER FUNCTION ${partnerFn} SET search_path=public`,partnerFn);
negative('function_acl',`GRANT EXECUTE ON FUNCTION ${partnerFn} TO anon`,partnerFn);
negative('future_schema',`CREATE SCHEMA hotels_lifecycle_private`,'114480_lifecycle_schema_absent');
negative('wrong_history',"INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811442000')",'recorded_114420');
assert.equal(snapshot(),before,'Local negative probes did not roll back');
const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const secret=randomBytes(48).toString('hex'),part=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function token(subject){const unsigned=part({alg:'HS256',typ:'JWT'})+'.'+part({role:'authenticated',sub:subject,exp:Math.floor(Date.now()/1000)+300});return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');}
const child=spawn(binary,[],{env:{...process.env,DYLD_LIBRARY_PATH:resolve(dirname(psql),'../lib'),PGRST_DB_URI:`postgres://authenticator@127.0.0.1:55479/${db}`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(port),PGRST_LOG_LEVEL:'crit'},stdio:['ignore','ignore','pipe']});
let error='';child.stderr.on('data',c=>{error=(error+c).slice(-2000);});
const base=`http://127.0.0.1:${port}`,owner=token('10000000-0000-4000-8000-000000000002');
async function get(rpc,args,auth=owner){assert.ok(['hotel_v2_partner_get_seven_arches_reviewed_pricing','hotel_v2_partner_get_workspace'].includes(rpc));const response=await fetch(`${base}/rpc/${rpc}`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body:JSON.stringify(args),signal:AbortSignal.timeout(60000)});return {status:response.status,data:await response.json()};}
try{
 let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Local PostgREST failed: '+error.replaceAll(secret,'[ephemeral-key]'));try{if((await fetch(base,{signal:AbortSignal.timeout(500)})).status===200){ready=true;break;}}catch{}await delay(100);}assert.ok(ready);
 const args={p_partner_id:'20000000-0000-4000-8000-000000000001',p_hotel_id:'9b6d99a0-923a-4fbc-be54-c066e856e6ca'};
 const control=await get('hotel_v2_partner_get_seven_arches_reviewed_pricing',args);
 assert.equal(control.status,200,control.data.code);assert.equal(control.data.contract_version,'hotels_v2_seven_arches_reviewed_pricing_partner_control_v1');assert.equal(control.data.current_items.length,54);
 const dates=JSON.parse(sql("SELECT jsonb_build_object('p_from',current_date,'p_to',current_date+30)"));
 const workspace=await get('hotel_v2_partner_get_workspace',{...args,...dates});assert.equal(workspace.status,200,workspace.data.code);
 assert.equal(control.data.pricing_snapshot_token,workspace.data.pricing.snapshot_token,'Partner Get must return workspace composite token');assert.match(control.data.pricing_snapshot_token,/^[0-9a-f]{64}$/);
 result.gets.push({rpc:'hotel_v2_partner_get_seven_arches_reviewed_pricing',http:200,items:54,composite_workspace_token:true},{rpc:'hotel_v2_partner_get_workspace',http:200});
 for(const [name,a,auth] of [['anonymous',args,null],['foreign_hotel',{...args,p_hotel_id:'90000000-0000-4000-8000-000000000099'},owner],['foreign_partner',{...args,p_partner_id:'20000000-0000-4000-8000-000000000099'},owner]]){
  const r=await get('hotel_v2_partner_get_seven_arches_reviewed_pricing',a,auth);
  if(name==='foreign_hotel'){assert.equal(r.status,500);assert.equal(r.data.code,'55000');assert.equal(r.data.message,'hotels_v2_seven_arches_reviewed_pricing_control_unavailable');}
  else{assert.ok([401,403].includes(r.status),name+': '+r.status+'/'+r.data.code);assert.equal(r.data.code,'42501');}
  result.gets.push({name,http:r.status,code:r.data.code,fail_closed:true});
 }
}finally{child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)resolve();else child.once('exit',resolve);});}
assert.equal(snapshot(),before,'Read-only Get changed protected data');
// Simulate only the local ledger step; never invoke CLI migration repair.
sql("INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811442000')");
const afterRepair=runVerifier();assert.deepEqual(afterRepair.at(-1).slice(-4),['f','["recorded_114420"]','134','133']);
result.post_repair_postinstall_fails_closed=true;
const next=sql(readFileSync('supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_preflight.sql','utf8'));
assert.match(next,/hotels_v2_external_calendar_site_settings_compatibility_preflight_v2/);
result.next_114425_preflight='PASS';assert.equal(snapshot(),before);
result.protected_relations_unchanged=tableNames.length;result.preview_calls=0;result.submit_calls=0;result.apply_calls=0;result.quote_calls=0;result.booking_calls=0;result.local_only=true;
console.log(JSON.stringify(result,null,2));
