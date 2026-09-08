// Real loopback PostgREST + installed PostgreSQL store; Stripe only is mocked.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createConnectService, connectConfig } from '../../supabase/functions/hotels-stripe-connect/service.mjs';
import { JWT_SECRET, TOKENS, USER_IDS } from './hotels-v2-h3-2a-partner-access-auth.mjs';
const base = process.env.HOTELS_CONNECT_TEST_URL || 'http://127.0.0.1:53079';
assert.equal(new URL(base).origin,'http://127.0.0.1:53079');
const database=process.env.HOTELS_CONNECT_TEST_DB || 'hotels_functional_stripe';
assert.match(database,/^hotels_functional_[a-z0-9_]+$/);
const binary=process.env.HOTELS_CONNECT_TEST_PSQL;
assert.ok(binary && binary.startsWith('/private/tmp/') && binary.endsWith('/bin/psql'));
function sql(query) {
 const r=spawnSync(binary,['-X','-qAt','-h','127.0.0.1','-p','55479','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const head=encode({alg:'HS256',typ:'JWT'}), payload=encode({role:'service_role',exp:Math.floor(Date.now()/1000)+600});
const jwt=`${head}.${payload}.${crypto.createHmac('sha256',JWT_SECRET).update(`${head}.${payload}`).digest('base64url')}`;
async function rpc(action,request,token=jwt) {
 const r=await fetch(`${base}/rpc/hotel_v2_stripe_connect_service`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
 body:JSON.stringify({p_action:action,p_request:request}),signal:AbortSignal.timeout(10000)});
 return {status:r.status,data:await r.json()};
}
const store=async(action,value)=>{const r=await rpc(action,value);if(r.status!==200)throw new Error(r.data?.message||'store_rejected');return r.data;};
const partner='20000000-0000-4000-8000-000000000001',hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const context={actor:USER_IDS.owner,partner_id:partner,hotel_id:hotel};
const businessQuery=`select md5(jsonb_build_array(
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_room_rates r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_commission_policies r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_payment_policies r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_payment_policy_terms r))::text)`;
const before=sql(businessQuery);
sql(`insert into auth.users(id) values('${USER_IDS.owner}') on conflict do nothing;
 update public.hotel_partner_hotel_permissions set initiate_stripe_onboarding=true where partner_id='${partner}';`);
let denied=0,exchanges=0,accountReads=0;
for(const token of [TOKENS.anon,TOKENS.owner,TOKENS.admin,TOKENS.secondOwner]) {
 const r=await rpc('scope',context,token);assert.ok([401,403,404].includes(r.status));denied++;
}
assert.deepEqual(await store('scope',context),{authorized:true,enabled:false});
const service=createConnectService({config:connectConfig({origin:'https://local.example.invalid',clientId:'ca_Synthetic',liveMode:false}),
 scope:(actor,partner_id,hotel_id)=>store('scope',{actor,partner_id,hotel_id}),store,randomState:()=>crypto.randomBytes(32).toString('hex'),
 stripe:{exchange:async()=>{exchanges++;return {stripe_user_id:'acct_PostgrestSynthetic',livemode:false,scope:'read_write'};},
 account:async()=>{accountReads++;return {id:'acct_PostgrestSynthetic',type:'standard',charges_enabled:true,payouts_enabled:true,details_submitted:true,
 requirements:{currently_due:[],past_due:[],disabled_reason:null}};},verifyEvent:async()=>{throw Error('not called');}}});
const begin={action:'begin',partner_id:partner,hotel_id:hotel,request_id:crypto.randomUUID()};
assert.equal((await service.request(USER_IDS.owner,begin)).status,'DISABLED');assert.equal(exchanges,0);
sql('update public.site_settings set hotel_stripe_connect_enabled=true where id=1');
try {
 for(const actor of [USER_IDS.scopedStaff,USER_IDS.secondOwner,USER_IDS.nonAdmin]) {
   await assert.rejects(service.request(actor,begin));denied++;
 }
 const first=await service.request(USER_IDS.owner,begin);
 assert.deepEqual(await service.request(USER_IDS.owner,begin),first,'idempotent begin must reuse the server nonce');
 const state=new URL(first.authorization_url).searchParams.get('state');
 const complete={action:'complete',code:'ac_Synthetic',state};
 await assert.rejects(service.request(USER_IDS.coOwnerA,complete));denied++;
 const result=await service.request(USER_IDS.owner,complete);assert.equal(result.status,'CONNECTED');
 assert.deepEqual(Object.keys(result).sort(),['checked_at','contract_version','status']);
 await assert.rejects(service.request(USER_IDS.owner,complete));denied++;
 assert.equal(exchanges,1);assert.equal(accountReads,1);
 const secondHotel=await service.request(USER_IDS.owner,{action:'status',partner_id:partner,hotel_id:'c1000000-0000-4000-8000-000000000001'});
 assert.equal(secondHotel.status,'CONNECTED');
 await assert.rejects(service.request(USER_IDS.owner,{action:'status',partner_id:partner,hotel_id:crypto.randomUUID()}));denied++;
 assert.equal(sql('select count(*) from hotel_stripe_connect_private.accounts'),'1');
 assert.equal(sql('select count(*) from hotel_stripe_connect_private.oauth_states where finished_at is not null'),'1');
 assert.equal(sql(businessQuery),before,'prices/payment/commission must remain byte-equivalent');
 console.log(JSON.stringify({sentinel:'HOTELS_STRIPE_CONNECT_POSTGREST_PASS',denied,oauth_exchanges:exchanges,
 verified_account_reads:accountReads,partner_accounts:1,hotels_reusing_account:2,business_unchanged:true,live_stripe_calls:0}));
} finally {
 // Disposable fixture only. Keep public/Stripe flags off even on assertion error.
 sql('update public.site_settings set hotel_stripe_connect_enabled=false where id=1');
}
