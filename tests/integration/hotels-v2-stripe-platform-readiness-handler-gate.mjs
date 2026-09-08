// Exercise the real Edge handler with offline adapters, never live credentials/API.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {connectConfig,createConnectService} from '../../supabase/functions/hotels-stripe-connect/service.mjs';
const source=fs.readFileSync(new URL('../../supabase/functions/hotels-stripe-connect/index.ts',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'');
const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
async function run({admin=true,authenticated=true,patch={},body={action:'verify_platform_configuration'},origin='https://local.example.invalid'}={}) {
 const values={HOTELS_CONNECT_ORIGIN:'https://local.example.invalid',STRIPE_CONNECT_CLIENT_ID:'ca_Synthetic',HOTELS_CONNECT_MODE:'test',
  STRIPE_SECRET_KEY:'sk_test_SYNTHETIC_NOT_A_CREDENTIAL',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_SYNTHETIC_ONLY',
  SUPABASE_URL:'https://local.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',SUPABASE_ANON_KEY:'synthetic-anon',...patch};
 let handler;const calls=[];
 class Stripe { static createFetchHttpClient(){return {};} }
 const createClient=(_url,key)=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'synthetic-verified-admin'}:null},error:null})},
  rpc:async(name,args)=>{calls.push({name,args,key});
   if(name==='hotel_v2_admin_get_capability_lifecycle')return admin?{data:{contract_version:'hotels_v2_capability_lifecycle_v1'},error:null}:{data:null,error:{code:'42501'}};
   assert.equal(name,'hotel_v2_attest_stripe_platform_readiness');assert.equal(key,'synthetic-service');
   return {data:true,error:null};
  }});
 vm.runInNewContext(javascript,{Deno:{env:{get:name=>values[name]},serve:callback=>{handler=callback;}},
  createClient,Stripe,connectConfig,createConnectService,Request,Response,URL,crypto:webcrypto});
 const response=await handler(new Request('https://local.example.invalid/functions/v1/hotels-stripe-connect',{
  method:'POST',headers:{origin,Authorization:'Bearer synthetic-local-only'},body:JSON.stringify(body)}));
 return {response,calls};
}
test('real handler attests server configuration only after Admin check, without changing flags/accounts',async()=>{
 const {response,calls}=await run();assert.equal(response.status,200);
 assert.deepEqual(calls.map(c=>c.name),['hotel_v2_admin_get_capability_lifecycle','hotel_v2_attest_stripe_platform_readiness']);
 assert.deepEqual(await response.json(),{contract_version:'hotels_standard_connect_server_v1',configuration_verified:true,
  account_connected:false,capability_enabled_by_this_request:false});
});
for(const [name,options] of Object.entries({
 unauthenticated:{authenticated:false},nonAdmin:{admin:false},foreignOrigin:{origin:'https://other.example.invalid'},
 invalidMode:{patch:{HOTELS_CONNECT_MODE:'invalid'}},wrongKeyMode:{patch:{STRIPE_SECRET_KEY:'sk_live_SYNTHETIC_ONLY'}},
 missingWebhook:{patch:{STRIPE_CONNECT_WEBHOOK_SECRET:''}},invalidWebhook:{patch:{STRIPE_CONNECT_WEBHOOK_SECRET:'bad'}},
 browserReadiness:{body:{action:'verify_platform_configuration',ready:true}},
 browserAccount:{body:{action:'verify_platform_configuration',account_id:'acct_Untrusted'}}
}))test(`configuration attestation fails closed: ${name}`,async()=>{
 const {response,calls}=await run(options);assert.ok(response.status>=400);
 assert.equal(calls.some(c=>c.name==='hotel_v2_attest_stripe_platform_readiness'),false);
});
