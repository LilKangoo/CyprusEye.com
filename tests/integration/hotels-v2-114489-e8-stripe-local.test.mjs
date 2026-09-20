// Current release: Hotels Connect is account connection, not payment routing.
// Real legacy webhook signature negatives are separate from Connect mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';
import {createConnectService,connectConfig} from '../../supabase/functions/hotels-stripe-connect/service.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('Connect exposes no charge/checkout/payment success mutation',()=>{
 const source=read('supabase/functions/hotels-stripe-connect/service.mjs');
 assert.doesNotMatch(source,/paymentIntents|checkout\.sessions|transfers\.create|payouts\.create/);
 assert.match(source,/\['account.updated', 'account.application.deauthorized'\]/);
});
test('Connect wrong event type, malformed event, unknown account cannot mutate connection or booking',async()=>{
 let writes=0;
 const service=createConnectService({config:connectConfig({origin:'https://local.example.invalid',clientId:'ca_Synthetic',liveMode:false}),
 scope:()=>{throw Error('unexpected scope');},randomState:()=>{throw Error('unexpected state');},
 store:action=>{assert.equal(action,'event_context');return null;},
 // Verified-event adapter only; this test does NOT claim SDK signature coverage.
 stripe:{verifyEvent:async raw=>JSON.parse(raw),account:()=>{writes++;throw Error('account network forbidden');}}});
 const event={id:'evt_Synthetic',account:'acct_Unbound',livemode:false,type:'payment_intent.succeeded'};
 assert.deepEqual(await service.webhook(JSON.stringify(event),'offline-adapter'),{ignored:true});
 assert.deepEqual(await service.webhook(JSON.stringify({...event,type:'account.updated'}),'offline-adapter'),{ignored:true});
 for(const value of ['{','null','{}',JSON.stringify({...event,livemode:true})])await assert.rejects(service.webhook(value,'offline-adapter'));
 assert.equal(writes,0);
});
test('real legacy Stripe webhook rejects missing/malformed/invalid signatures before any DB/network access',async()=>{
 const source=read('supabase/functions/stripe-webhook/index.ts').replace(/^import .*;\n/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 let handler,db=0,network=0;
 vm.runInNewContext(js,{serve:f=>{handler=f;},Deno:{env:{get:name=>({STRIPE_SECRET_KEY:'sk_test_SYNTHETIC_ONLY',STRIPE_WEBHOOK_SECRET:'whsec_SYNTHETIC_ONLY'})[name]}},
 createClient:()=>{db++;throw Error('DB forbidden');},fetch:()=>{network++;throw Error('network forbidden');},
 console:{log(){},warn(){},error(){}},Request,Response,URL,TextEncoder,crypto:webcrypto});
 for(const signature of ['', 'invalid', 't=1,v1=bad', 't=1,v1='+'0'.repeat(64)]){
  const response=await handler(new Request('https://local.example.invalid/webhook',{method:'POST',headers:signature?{'stripe-signature':signature}:{},body:'{"type":"payment_intent.succeeded"}'}));
  assert.equal(response.status,400);
 }
 assert.equal(db,0);assert.equal(network,0);
});
