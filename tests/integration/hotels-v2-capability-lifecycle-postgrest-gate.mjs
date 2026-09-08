// Synthetic loopback-only lifecycle exercise. Never a production operator script.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {TOKENS,JWT_SECRET,USER_IDS} from './hotels-v2-h3-2a-partner-access-auth.mjs';
const database=process.env.HOTELS_LIFECYCLE_TEST_DATABASE;
const binary=process.env.HOTELS_CONNECT_TEST_PSQL;
assert.match(database||'',/^hotels_functional_global_[a-z0-9_]+$/);
assert.ok(binary?.startsWith('/private/tmp/')&&binary.endsWith('/bin/psql'));
const sql=q=>{const r=spawnSync(binary,['-X','-qAt','-h','127.0.0.1','-p','55479','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8',maxBuffer:4e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
assert.equal(sql("select current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${database}|127.0.0.1|55479`);
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const prefix=`${enc({alg:'HS256',typ:'JWT'})}.${enc({role:'service_role',exp:Math.floor(Date.now()/1000)+3600})}`;
const service=`${prefix}.${crypto.createHmac('sha256',JWT_SECRET).update(prefix).digest('base64url')}`;
const calls=[];
async function rpc(name,args={},token=TOKENS.admin){
 const start=performance.now();
 const r=await fetch(`http://127.0.0.1:53079/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(120000)});
 const data=await r.json(); const ms=Math.round(performance.now()-start);
 calls.push({name,status:r.status,ms,...(name==='hotel_v2_admin_set_capability_lifecycle'?{capability:args.p_capability,enabled:args.p_enabled,version:args.p_expected_version,replayed:data.replayed===true}:{})});return {status:r.status,data};
}
const getter='hotel_v2_admin_get_capability_lifecycle',setter='hotel_v2_admin_set_capability_lifecycle';
const partner='20000000-0000-4000-8000-000000000001',hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const args=(capability,enabled,version)=>({p_capability:capability,p_enabled:enabled,p_expected_version:version,
 p_request_id:crypto.randomUUID(),p_reason:'Explicit synthetic lifecycle decision, not a production request.',p_confirmation:'CONFIRM_HOTELS_CAPABILITY_CHANGE'});
let negatives=0;
const deny=r=>{assert.ok([400,401,403,409].includes(r.status),JSON.stringify(r));negatives++;};
async function state(){const r=await rpc(getter);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.public_booking_enabled,false);assert.equal(r.data.audit_chain_exact,true);return r.data;}
const protectedQuery=`select md5(jsonb_build_array(
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_room_rates r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_rate_plans r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_pricing_schedules r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_pricing_schedule_occupancy_tiers r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_commission_policies r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_payment_policies r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_payment_policy_terms r),
 (select jsonb_agg(to_jsonb(r) order by assignment_id) from public.hotel_partner_hotel_permissions r),
 hotels_lifecycle_private.predecessor_receipts())::text)`;
const baseline=sql(protectedQuery);
sql(`insert into auth.users(id) values('${USER_IDS.admin}'),('${USER_IDS.owner}') on conflict do nothing`);
assert.equal((await state()).version,0);
assert.equal(sql('select count(*) from hotel_stripe_connect_private.onboarding_authorizations'),'0');
for(const token of [TOKENS.anon,TOKENS.owner,TOKENS.scopedStaff,service]){
 deny(await rpc(getter,{},token));deny(await rpc(setter,args('rooms',true,0),token));
}
for(const patch of [{p_enabled:null},{p_expected_version:-1},{p_request_id:'bad'},{p_reason:'short'},
 {p_confirmation:'yes'},{p_capability:'unknown'},{p_capability:'instant'},{p_capability:'public_booking'},
 {p_capability:'external'},{p_capability:'stripe'}]) deny(await rpc(setter,{...args('rooms',true,0),...patch}));
for(const token of [TOKENS.anon,TOKENS.owner,TOKENS.admin]) deny(await rpc('hotel_v2_attest_stripe_platform_readiness',
 {p_request_id:crypto.randomUUID(),p_ready:true,p_contract_version:'hotels_standard_connect_server_v1'},token));
const first=args('rooms',true,0);
const outcomes=await Promise.all([rpc(setter,first),rpc(setter,args('rooms',true,0))]);
assert.equal(outcomes.filter(r=>r.status===200).length,1,JSON.stringify(outcomes));
assert.ok(outcomes.find(r=>r.status!==200).data.message.includes('stale_version'));
const winner=outcomes[0].status===200?first:null;
if(winner){assert.equal((await rpc(setter,winner)).data.replayed,true);deny(await rpc(setter,{...winner,p_reason:'Changed synthetic reason'}));}
let current=await state();assert.equal(current.feature_flags.hotel_rooms_v2_enabled,true);
assert.equal(current.feature_flags.hotel_stripe_connect_enabled,false);
assert.equal(sql('select count(*) from hotel_stripe_connect_private.accounts'),'0');
assert.equal(sql('select count(*) from hotel_stripe_connect_private.onboarding_authorizations'),'0');
const attest=await rpc('hotel_v2_attest_stripe_platform_readiness',{
 p_request_id:crypto.randomUUID(),p_ready:true,p_contract_version:'hotels_standard_connect_server_v1'},service);
assert.equal(attest.status,200,JSON.stringify(attest.data));
let result=await rpc(setter,args('stripe',true,current.version));assert.equal(result.status,200,JSON.stringify(result.data));
current=await state();assert.equal(current.feature_flags.hotel_rooms_v2_enabled,true);assert.equal(current.feature_flags.hotel_stripe_connect_enabled,true);
assert.equal(sql('select count(*) from hotel_stripe_connect_private.onboarding_authorizations'),'0');
assert.equal(sql('select count(*) from hotel_stripe_connect_private.accounts'),'0');
const from=new Date().toISOString().slice(0,10),to=new Date(Date.now()+86400000).toISOString().slice(0,10);
async function workspace(){const r=await rpc('hotel_v2_partner_get_workspace',{p_partner_id:partner,p_hotel_id:hotel,p_from:from,p_to:to},TOKENS.owner);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
let w=await workspace();assert.equal(w.stripe_connection.onboarding_authorized,false);assert.equal(w.stripe_connection.can_connect,false);
const permission=await rpc('hotel_v2_admin_set_partner_stripe_onboarding_authorization',{
 p_partner_id:partner,p_enabled:true,p_expected_version:0,p_request_id:crypto.randomUUID(),p_reason:'Separate synthetic Partner authorization, no global flag change.'});
assert.equal(permission.status,200,JSON.stringify(permission.data));
w=await workspace();assert.equal(w.stripe_connection.onboarding_authorized,true);assert.equal(w.stripe_connection.account_status,'NOT_CONNECTED');assert.equal(w.stripe_connection.can_connect,true);
const store=(action,request)=>rpc('hotel_v2_stripe_connect_service',{p_action:action,p_request:request},service);
const oauth=crypto.randomBytes(32).toString('hex');
let r=await store('begin',{actor:USER_IDS.owner,partner_id:partner,hotel_id:hotel,state:oauth,request_id:crypto.randomUUID()});assert.equal(r.status,200,JSON.stringify(r.data));
r=await store('claim',{actor:USER_IDS.owner,state:oauth});assert.equal(r.status,200,JSON.stringify(r.data));
r=await store('finish',{actor:USER_IDS.owner,state:oauth,account_id:'acct_LocalLifecycleSynthetic',live_mode:false,status:'CONNECTED'});assert.equal(r.status,200,JSON.stringify(r.data));
w=await workspace();assert.equal(w.stripe_connection.account_status,'CONNECTED');assert.equal(w.stripe_connection.can_connect,false);assert.ok(w.stripe_connection.checked_at);
assert.equal(JSON.stringify(w.stripe_connection).includes('acct_'),false);
result=await rpc(setter,args('rooms',false,current.version));assert.equal(result.status,200,JSON.stringify(result.data));
current=await state();assert.equal(current.feature_flags.hotel_rooms_v2_enabled,false);assert.equal(current.feature_flags.hotel_stripe_connect_enabled,true);
w=await workspace();assert.ok(w.rooms.length);assert.equal(w.capability_lifecycle.public_booking_enabled,false);
result=await rpc(setter,args('stripe',false,current.version));assert.equal(result.status,200,JSON.stringify(result.data));
current=await state();assert.equal(current.feature_flags.hotel_stripe_connect_enabled,false);assert.equal(current.feature_flags.hotel_external_sync_enabled,true);
w=await workspace();assert.equal(w.stripe_connection.platform_enabled,false);assert.equal(w.stripe_connection.can_connect,false);
assert.equal(sql('select count(*) from hotel_stripe_connect_private.accounts'),'1');
for(const name of ['hotel_v2_public_quote_seven_arches','hotel_v2_public_create_seven_arches_booking']){
 const r=await rpc(name,{p_request:{}},TOKENS.anon);deny(r);assert.equal(r.data.message,'hotels_v2_public_booking_disabled');
}
assert.equal(sql('select count(*) from hotels_lifecycle_private.decisions'),'4');
assert.equal(sql('select count(*) from hotels_lifecycle_private.context'),'0');
assert.equal(sql(protectedQuery),baseline);
assert.equal(sql('select public.hotel_v2_external_calendar_provider_evolution_is_safe()'),'t');
assert.equal(sql('select public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'),'t');
const normal=calls.filter(c=>c.name===setter&&c.status===200&&!c.replayed&&c.version>0);
assert.equal(normal.length,3);
assert.ok(normal.every(c=>c.ms<20000),'normal lifecycle decision exceeds local 20s safety budget: '+JSON.stringify(normal));
console.log(JSON.stringify({sentinel:'HOTELS_CAPABILITY_LIFECYCLE_POSTGREST_PASS',negatives,concurrent_winners:1,
 audit_receipts:4,transaction_context:0,public_booking:false,external_sync:true,permission_independent:true,
 mock_connected_account_count:1,business_unchanged:true,live_stripe_calls:0,mutation_calls:calls.filter(c=>c.name===setter),
 normal_transition_times_ms:normal.map(c=>({capability:c.capability,enabled:c.enabled,ms:c.ms})),
 worst_normal_ms:Math.max(...normal.map(c=>c.ms)),timeout_margin_safe:true,
 get_calls:calls.filter(c=>c.name===getter).length},null,2));
