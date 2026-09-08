/// <reference lib="deno.ns" />
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';
import { connectConfig, createConnectService } from '../../supabase/functions/hotels-stripe-connect/service.mjs';

Deno.test('real Stripe SDK verifies signed Connect webhook before storage; no API access', async () => {
  const stripe = new Stripe('sk_test_SYNTHETIC_NOT_A_CREDENTIAL', { apiVersion:'2023-10-16', maxNetworkRetries:0,
    httpClient:Stripe.createFetchHttpClient() });
  const secret='whsec_SYNTHETIC_LOCAL_SIGNATURE_TEST_ONLY';
  const raw=JSON.stringify({id:'evt_Synthetic',account:'acct_Synthetic',livemode:false,type:'account.application.deauthorized'});
  const cryptoProvider=Stripe.createSubtleCryptoProvider();
  const sign=async(timestamp:number)=>{
    const encoder=new TextEncoder();
    const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const bytes=await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}.${raw}`));
    return `t=${timestamp},v1=${Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}`;
  };
  const signature=await sign(Math.floor(Date.now()/1000));
  let storageCalls=0;
  const service=createConnectService({config:connectConfig({origin:'https://local.example.invalid',clientId:'ca_Synthetic',liveMode:false}),
    scope:()=>{throw Error('not used');},randomState:()=>{throw Error('not used');},
    store:(action:string)=>{storageCalls++;return action==='event_context'?{revision:1}:{reconciled:true};},
    stripe:{exchange:()=>{throw Error('API forbidden');},account:()=>{throw Error('API forbidden');},
      verifyEvent:(body:string,header:string)=>stripe.webhooks.constructEventAsync(body,header,secret,300,cryptoProvider)}});
  for(const [body,header] of [[raw,signature.replace(/v1=./,'v1=z')],[raw.replace('false','true'),signature]]) {
    let rejected=false;try{await service.webhook(body,header);}catch(_){rejected=true;}
    if(!rejected||storageCalls!==0)throw Error('unverified event reached storage');
  }
  const expired=await sign(Math.floor(Date.now()/1000)-600);
  let rejected=false;try{await service.webhook(raw,expired);}catch(_){rejected=true;}
  if(!rejected||storageCalls!==0)throw Error('expired signature reached storage');
  const result=await service.webhook(raw,signature);
  if(result.reconciled!==true||Number(storageCalls)!==2)throw Error('valid deauthorization not reconciled');
});
