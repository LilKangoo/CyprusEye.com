import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {dirname,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const db=process.env.HOTELS_RECONCILIATION_DB,psql=process.env.HOTELS_RECONCILIATION_PSQL,
 binary=process.env.HOTELS_RECONCILIATION_POSTGREST;
assert.match(db||'',/^hotels_114416_successor_[a-z0-9_]+$/);assert.ok(psql);assert.ok(binary);
function sql(input){const r=spawnSync(psql,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const tableNames=JSON.parse(sql(`SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY 1)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r'
 AND (n.nspname IN('public','hotels_v2_private','hotels_lineage_private','hotels_lifecycle_private','hotel_stripe_connect_private','auth'))`));
const snapshot=()=>sql('BEGIN READ ONLY;SELECT jsonb_object_agg(name,hash) FROM ('+tableNames.map(t=>
 `SELECT '${t}' name,public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb)) hash FROM ${t} x`).join(' UNION ALL ')+') x;ROLLBACK;');
const before=snapshot();
const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const secret=randomBytes(48).toString('hex');
const part=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const unsigned=part({alg:'HS256',typ:'JWT'})+'.'+part({role:'authenticated',sub:'10000000-0000-4000-8000-000000000001',exp:Math.floor(Date.now()/1000)+300});
const token=unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
const child=spawn(binary,[],{env:{...process.env,DYLD_LIBRARY_PATH:resolve(dirname(psql),'../lib'),PGRST_DB_URI:`postgres://authenticator@127.0.0.1:55479/${db}`,
 PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,
 PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(port),PGRST_LOG_LEVEL:'crit'},stdio:['ignore','ignore','pipe']});
let error='';child.stderr.on('data',c=>{error=(error+c.toString()).slice(-2000);});
const base=`http://127.0.0.1:${port}`;
const results=[];
try{
 let ready=false;for(let i=0;i<100;i++){
  if(child.exitCode!==null||child.signalCode!==null)throw Error('Local PostgREST exited before readiness: '+error.replaceAll(secret,'[ephemeral-key]'));
  try{const response=await fetch(base,{signal:AbortSignal.timeout(500)});if(response.status===200){ready=true;break;}}catch{}
  await delay(100);
 }assert.ok(ready,'Local PostgREST readiness timed out');
 for(const [rpc,contract] of [
  ['hotel_v2_admin_get_seven_arches_reviewed_pricing','hotels_v2_seven_arches_reviewed_pricing_admin_control_v1'],
  ['hotel_v2_admin_get_capability_lifecycle','hotels_v2_capability_lifecycle_v1']
 ]){
  const start=performance.now();const response=await fetch(`${base}/rpc/${rpc}`,{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}',signal:AbortSignal.timeout(60000)});
  const data=await response.json();assert.equal(response.status,200,`${rpc}: ${data.code||'unexpected_status'}`);
  assert.equal(data.contract_version,contract,`${rpc}: unexpected contract`);
  if(rpc.includes('capability')){assert.equal(data.architecture,'legacy');assert.equal(data.expected_public_change,false);assert.equal(data.public_booking_enabled,false);}
  results.push({rpc,http_status:response.status,contract:data.contract_version,elapsed_ms:Number((performance.now()-start).toFixed(3))});
 }
 const anonymous=await fetch(`${base}/rpc/hotel_v2_admin_get_capability_lifecycle`,{
  method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.ok([401,403].includes(anonymous.status),'Anonymous Admin RPC did not fail closed');
 assert.equal(snapshot(),before,'Read-only RPC changed protected data');
 console.log(JSON.stringify({local_only:true,port,results,anonymous_http:anonymous.status,
  protected_relations_unchanged:tableNames.length,preview_calls:0,submit_calls:0,apply_calls:0},null,2));
}finally{
 child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)resolve();else child.once('exit',resolve);});
}
