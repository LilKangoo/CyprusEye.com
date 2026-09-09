// Only read RPCs against an owned synthetic loopback PostgREST instance.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {dirname,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const db=process.env.HOTELS_RECONCILIATION_DB,psql=process.env.HOTELS_RECONCILIATION_PSQL,binary=process.env.HOTELS_RECONCILIATION_POSTGREST;
assert.match(db||'',/^hotels_114416_successor_post425_remaining_[a-z0-9_]+$/);assert.ok(psql);assert.ok(binary);
function sql(input){const r=spawnSync(psql,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:16e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const tables=JSON.parse(sql("SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN('public','auth','hotels_v2_private','hotels_lineage_private','hotel_stripe_connect_private','hotels_lifecycle_private')"));
const snapshot=()=>sql('BEGIN READ ONLY;SELECT jsonb_object_agg(name,hash) FROM ('+tables.map(t=>`SELECT '${t}' name,public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb)) hash FROM ${t} x`).join(' UNION ALL ')+') x;ROLLBACK;');
const before=snapshot(),socket=createServer();await new Promise((r,j)=>{socket.once('error',j);socket.listen(0,'127.0.0.1',r);});const port=socket.address().port;await new Promise(r=>socket.close(r));
const secret=randomBytes(48).toString('hex'),part=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),unsigned=part({alg:'HS256',typ:'JWT'})+'.'+part({role:'authenticated',sub:'10000000-0000-4000-8000-000000000002',exp:Math.floor(Date.now()/1000)+300});
const token=unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
const child=spawn(binary,[],{env:{...process.env,DYLD_LIBRARY_PATH:resolve(dirname(psql),'../lib'),PGRST_DB_URI:`postgres://authenticator@127.0.0.1:55479/${db}`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(port),PGRST_LOG_LEVEL:'crit'},stdio:['ignore','ignore','pipe']});
let error='';child.stderr.on('data',b=>error=(error+b).slice(-2000));const base=`http://127.0.0.1:${port}`,results=[];
async function get(rpc,args,auth=true){assert.ok(['hotel_v2_partner_get_seven_arches_reviewed_pricing','hotel_v2_partner_get_workspace'].includes(rpc));const started=performance.now(),r=await fetch(`${base}/rpc/${rpc}`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(args),signal:AbortSignal.timeout(60000)});return {http:r.status,data:await r.json(),elapsed_ms:+(performance.now()-started).toFixed(3)};}
try{
 let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(error.replaceAll(secret,'[ephemeral-key]'));try{if((await fetch(base,{signal:AbortSignal.timeout(500)})).status===200){ready=true;break;}}catch{}await delay(100);}assert.ok(ready);
 const args={p_partner_id:'20000000-0000-4000-8000-000000000001',p_hotel_id:'9b6d99a0-923a-4fbc-be54-c066e856e6ca'},control=await get('hotel_v2_partner_get_seven_arches_reviewed_pricing',args);
 assert.equal(control.http,200,JSON.stringify({code:control.data.code,message:control.data.message}));assert.equal(control.data.current_items.length,54);assert.equal(control.data.contract_version,'hotels_v2_seven_arches_reviewed_pricing_partner_control_v1');
 const dates=JSON.parse(sql("SELECT jsonb_build_object('p_from',current_date,'p_to',current_date+30)")),workspace=await get('hotel_v2_partner_get_workspace',{...args,...dates});
 assert.equal(workspace.http,200,JSON.stringify({code:workspace.data.code,message:workspace.data.message}));assert.equal(control.data.pricing_snapshot_token,workspace.data.pricing.snapshot_token);assert.match(control.data.pricing_snapshot_token,/^[0-9a-f]{64}$/);
 results.push({rpc:'reviewed_pricing',http:200,items:54,elapsed_ms:control.elapsed_ms},{rpc:'workspace',http:200,elapsed_ms:workspace.elapsed_ms});
 for(const [name,a,auth]of [['anonymous',args,false],['foreign_hotel',{...args,p_hotel_id:'90000000-0000-4000-8000-000000000099'},true],['foreign_partner',{...args,p_partner_id:'20000000-0000-4000-8000-000000000099'},true]]){const r=await get('hotel_v2_partner_get_seven_arches_reviewed_pricing',a,auth);assert.ok([401,403,500].includes(r.http));assert.equal(r.data.code,name==='foreign_hotel'?'55000':'42501');results.push({name,http:r.http,code:r.data.code,fail_closed:true});}
}finally{child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null||child.signalCode!==null?r():child.once('exit',r));}
assert.equal(snapshot(),before);console.log(JSON.stringify({partner_composite_token_exact:true,results,protected_tables_unchanged:tables.length,preview_calls:0,submit_calls:0,apply_calls:0,quote_calls:0,booking_calls:0,production_access:false}));
