// Isolated local performance/safety proof. Real RPC, no artificial sleep or
// concurrent decision in normal samples; authentication is synthetic and local.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyBody,optimizedSignatures} from './hotels-v2-capability-lifecycle-latency-static-gate.mjs';
import {TOKENS} from './hotels-v2-h3-2a-partner-access-auth.mjs';
const database=process.env.HOTELS_LIFECYCLE_TEST_DATABASE, binary=process.env.HOTELS_CONNECT_TEST_PSQL;
assert.match(database||'',/^hotels_functional_global_[a-z0-9_]+$/);
assert.ok(binary?.startsWith('/private/tmp/')&&binary.endsWith('/bin/psql'));
function sql(q){const r=spawnSync(binary,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',database,'-c',q],{encoding:'utf8',maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql('select current_database()||\'|\'||host(inet_server_addr())||\'|\'||inet_server_port()'),`${database}|127.0.0.1|55479`);
for(const signature of optimizedSignatures){
 const body=JSON.parse(sql(`select to_json(prosrc) from pg_proc where oid='${signature}'::regprocedure`));
 verifyBody(signature,body);
}
const query=`select md5(jsonb_build_array(hotels_lifecycle_private.predecessor_receipts(),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_room_rates r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_pricing_schedule_occupancy_tiers r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_commission_policies r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_payment_policies r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_payment_policy_terms r))::text)`;
const before=sql(query),samples=[];let lockWaitSamples=0;
async function rpc(name,args={}){
 const response=await fetch('http://127.0.0.1:53079/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+TOKENS.admin,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(65000)});
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
}
for(let i=0;i<6;i++){
 const current=await rpc('hotel_v2_admin_get_capability_lifecycle');
 assert.equal(current.public_booking_enabled,false);
 const started=performance.now();
 const monitor=setInterval(()=>{
  lockWaitSamples+=Number(sql("select count(*) from pg_stat_activity where datname=current_database() and application_name='PostgREST' and wait_event_type='Lock'"));
 },500);
 let result;
 try{result=await rpc('hotel_v2_admin_set_capability_lifecycle',{
  p_capability:'rooms',p_enabled:!current.feature_flags.hotel_rooms_v2_enabled,p_expected_version:current.version,
  p_request_id:randomUUID(),p_reason:'Synthetic local sequential latency safety sample.',p_confirmation:'CONFIRM_HOTELS_CAPABILITY_CHANGE'});
 }finally{clearInterval(monitor);}
 const ms=Math.round(performance.now()-started);samples.push(ms);
 assert.equal(result.replayed,false);assert.equal(result.current.version,current.version+1);
 assert.equal(result.current.public_booking_enabled,false);assert.ok(ms<20000,'normal decision exceeds 20s budget: '+ms);
}
assert.equal(sql(query),before);
assert.equal(sql('select count(*) from hotels_lifecycle_private.context'),'0');
assert.equal(sql('select public.hotel_v2_external_calendar_provider_evolution_is_safe()'),'t');
assert.equal(sql('select public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'),'t');
const sorted=[...samples].sort((a,b)=>a-b);
console.log(JSON.stringify({sentinel:'HOTELS_LIFECYCLE_LATENCY_SAFETY_PASS',predicate_bodies_reconstructed:6,
 normal_samples_ms:samples,empirical_p95_ms:sorted[Math.ceil(sorted.length*0.95)-1],worst_ms:sorted.at(-1),
 budget_ms:20000,rpc_ceiling_ms:60000,timeout_changed:false,lock_wait_samples:lockWaitSamples,
 production_latency_claim:false,artificial_delay:false,parallel_decisions:false,receipts_prices_payment_commission_unchanged:true,
 transaction_context:0,public_booking:false},null,2));
