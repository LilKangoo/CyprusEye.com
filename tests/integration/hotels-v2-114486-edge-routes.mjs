// Real handler + real Stripe SDK signature verification; all auth/storage offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto,createHmac} from 'node:crypto';
import ts from 'typescript';
import {connectConfig,createConnectService} from '../../supabase/functions/hotels-stripe-connect/service.mjs';
const require=createRequire(import.meta.url);
const Stripe=require(process.env.HOTELS_114486_STRIPE_SDK || 'stripe');
const javascript=ts.transpileModule(fs.readFileSync('supabase/functions/hotels-stripe-connect/index.ts','utf8').replace(/^import .*;\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const actor='10000000-0000-4000-8000-000000000001',partner='20000000-0000-4000-8000-000000000001',hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const secret='whsec_SYNTHETIC_SIGNATURE_ONLY';
const begin={action:'begin',partner_id:partner,hotel_id:hotel,request_id:'86000000-0000-4000-8000-000000000020'};
async function request({jwt=true,user=true,admin=true,grant=true,enabled=true,patch={},webhook=false,signature,body={action:'verify_platform_configuration'}}={}){
 const env={HOTELS_CONNECT_ORIGIN:'https://local.example.invalid',HOTELS_CONNECT_MODE:'test',STRIPE_CONNECT_CLIENT_ID:'ca_Synthetic',
 STRIPE_SECRET_KEY:'sk_test_SYNTHETIC_ONLY',STRIPE_CONNECT_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://local.example.invalid',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',...patch};
 let handler;const calls=[];let attested=false;
 const business={flags:{stripe:enabled},grant,commission:10,payments:'unchanged',bookings:[],public_booking:false};const before=JSON.stringify(business);
 const client={auth:{getUser:async()=>({data:{user:user?{id:actor}:null},error:null})},rpc:async(name,args)=>{
 calls.push({name,args});
 if(name==='hotel_v2_admin_get_capability_lifecycle')return admin?{data:{contract_version:'hotels_v2_capability_lifecycle_v1'}}:{error:{code:'42501'}};
 if(name==='hotel_v2_attest_stripe_platform_readiness'){assert.equal(args.p_ready,true);assert.equal(args.p_contract_version,'hotels_standard_connect_server_v1');attested=true;return {data:true};}
 assert.equal(name,'hotel_v2_stripe_connect_service');
 if(args.p_action==='scope')return grant?{data:{authorized:true,enabled}}:{error:{code:'42501'}};
 if(args.p_action==='event_context')return {data:{revision:1}};
 if(args.p_action==='event')return {data:{reconciled:true}};
 throw Error('unexpected write');
 }};
 const OfflineStripe=class extends Stripe{constructor(...args){super(...args);this.oauth.token=()=>{throw Error('STRIPE_API_FORBIDDEN');};this.accounts.retrieve=()=>{throw Error('STRIPE_API_FORBIDDEN');};}};
 vm.runInNewContext(javascript,{Deno:{env:{get:n=>env[n]},serve:f=>{handler=f;}},createClient:()=>client,Stripe:OfflineStripe,
 connectConfig,createConnectService,Request,Response,URL,crypto:webcrypto});
 const response=await handler(new Request('https://local.example.invalid/functions/v1/hotels-stripe-connect'+(webhook?'/webhook':''),{
 method:'POST',headers:{...(!webhook?{origin:env.HOTELS_CONNECT_ORIGIN}:{}),...(jwt?{Authorization:'Bearer synthetic'}:{}),...(signature?{'stripe-signature':signature}:{})},body:typeof body==='string'?body:JSON.stringify(body)}));
 assert.equal(JSON.stringify(business),before,'verification cannot change business state');return {response,calls,attested};
}
test('gateway exemption applies only to hotels-stripe-connect; real handler retains auth',()=>{
 const config=fs.readFileSync('supabase/config.toml','utf8');assert.match(config,/\[functions\.hotels-stripe-connect\]\s*verify_jwt = false/);
 const edge=fs.readFileSync('supabase/functions/hotels-stripe-connect/index.ts','utf8');assert.match(edge,/db.auth.getUser/);assert.match(edge,/constructEventAsync/);
});
for(const [name,opts] of Object.entries({noJwtAdmin:{jwt:false},invalidJwtAdmin:{user:false},nonAdmin:{admin:false},noJwtPartner:{jwt:false,body:begin},noGrant:{grant:false,body:begin}}))test(name+' denied',async()=>{
 const r=await request(opts);assert.ok(r.response.status>=400);assert.equal(r.attested,false);assert.equal(r.calls.some(c=>c.args?.p_action==='begin'),false);
});
test('global OFF cannot start OAuth or create state',async()=>{const r=await request({enabled:false,body:begin});assert.equal((await r.response.json()).status,'DISABLED');assert.equal(r.calls.length,1);});
test('Admin config verification writes only the existing attestation, without Stripe API or any business mutation',async()=>{
 const r=await request();assert.equal(r.response.status,200);assert.equal(r.attested,true);assert.deepEqual(r.calls.map(c=>c.name),['hotel_v2_admin_get_capability_lifecycle','hotel_v2_attest_stripe_platform_readiness']);
 assert.deepEqual(await r.response.json(),{contract_version:'hotels_standard_connect_server_v1',configuration_verified:true,account_connected:false,capability_enabled_by_this_request:false});
});
for(const patch of [{HOTELS_CONNECT_MODE:'wrong'},{STRIPE_SECRET_KEY:'sk_live_SYNTHETIC'},{STRIPE_CONNECT_WEBHOOK_SECRET:''},{STRIPE_CONNECT_CLIENT_ID:'bad'},{HOTELS_CONNECT_ORIGIN:'http://local.example.invalid'}])test('invalid config fails without writing READY',async()=>{
 const r=await request({patch});assert.ok(r.response.status>=400);assert.equal(r.attested,false);
});
const event=JSON.stringify({id:'evt_Synthetic',account:'acct_Synthetic',livemode:false,type:'account.application.deauthorized'});
const stamp=Math.floor(Date.now()/1000),sig=`t=${stamp},v1=${createHmac('sha256',secret).update(`${stamp}.${event}`).digest('hex')}`;
test('real signed webhook with NO JWT reaches handler and signature-verified storage',async()=>{
 const r=await request({webhook:true,jwt:false,body:event,signature:sig});assert.equal(r.response.status,200);assert.deepEqual(await r.response.json(),{reconciled:true});assert.deepEqual(r.calls.map(c=>c.args.p_action),['event_context','event']);
});
for(const signature of [undefined,'t=1,v1=bad',sig.replace(/v1=./,'v1=z')])test('missing/invalid signature denied before storage',async()=>{
 const r=await request({webhook:true,jwt:false,body:event,signature});assert.ok(r.response.status>=400);assert.equal(r.calls.length,0);
});
