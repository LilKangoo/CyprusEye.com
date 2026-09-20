// Extends the certified E5B2 local transport fixture. No public enablement.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const {HTTP_DB,HTTP_PORT,FIXTURE_CONTAINER,CURL_IMAGE,PSQL,HTTP_DIR,ADMIN_TOKEN,PARTNER_TOKEN}=process.env;
assert.match(HTTP_DB||'',/^hotels_114489_e8_[0-9]+$/);
assert.equal(HTTP_PORT,'53090');assert.equal(FIXTURE_CONTAINER,'hotels-114489-114487-fixture');
assert.equal(CURL_IMAGE,'curlimages/curl:8.10.1');
assert.equal(PSQL,'/private/tmp/hotels-114489-docker-psql-plain.sh');
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const read=q=>execFileSync(PSQL,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55510','-U','postgres','-d',HTTP_DB],{
 input:'BEGIN READ ONLY; '+q+'; ROLLBACK;',encoding:'utf8',maxBuffer:8e6}).trim();
const snapshot=()=>JSON.parse(read(`SELECT jsonb_build_object(
 'business_hash',hotels_stripe_dto_private.business_hash(),
 'bookings',(SELECT count(*) FROM public.hotel_bookings),
 'quote_issuances',(SELECT count(*) FROM public.hotel_seven_arches_public_quote_issuances),
 'booking_receipts',(SELECT count(*) FROM public.hotel_seven_arches_public_booking_receipts),
 'booking_context',(SELECT count(*) FROM public.hotel_seven_arches_public_booking_transaction_context),
 'conversion_context',(SELECT count(*) FROM hotels_published_architecture_private.context),
 'instant',(SELECT hotel_instant_booking_enabled FROM public.site_settings WHERE id=1),
 'public_booking',hotels_lifecycle_private.public_booking_enabled())`));
const before=snapshot();assert.equal(before.instant,false);assert.equal(before.public_booking,false);
const evidence=[];
function request(name,token,body){
 const args=['run','--rm','--network','container:'+FIXTURE_CONTAINER,CURL_IMAGE,'-sS','--max-time','40','-X','POST','-H','Content-Type: application/json'];
 if(token)args.push('-H','Authorization: Bearer '+token);
 args.push('--data-binary',JSON.stringify(body),'-w','\n%{http_code}','http://127.0.0.1:'+HTTP_PORT+'/rpc/'+name);
 const raw=execFileSync('docker',args,{encoding:'utf8',maxBuffer:2e6});
 const split=raw.lastIndexOf('\n');return {status:Number(raw.slice(split+1)),body:JSON.parse(raw.slice(0,split))};
}
const display=request('hotel_v2_public_get_seven_arches_display_114489','',{});
assert.equal(display.status,200);
const ctx={console,URL,TextEncoder};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(readFileSync('js/hotels-v2-seven-arches-public-pricing.js','utf8'),ctx);
const api=ctx.HotelsV2SevenArchesPublicPricing;api.validateDisplay(display.body);
assert.equal(display.body.architecture_version,'rooms_v2');assert.equal(display.body.is_published,true);
assert.equal(display.body.public_booking_enabled,false);assert.equal(display.body.instant_booking_enabled,false);
assert.deepEqual(Object.keys(display.body).sort(),['contract_version','hotel_id','architecture_version','is_published','public_booking_enabled','instant_booking_enabled','room_types','currency','min_nightly_rate','display_only'].sort());
let calls=0;const client={rpc:async()=>{calls++;throw Error('booking transport forbidden');}};
assert.throws(()=>api.assertBookingAllowed({id:hotel,architecture_version:'rooms_v2'}));
await assert.rejects(api.createQuoteSession(client).submit({id:hotel,architecture_version:'rooms_v2'},null,{}));assert.equal(calls,0);
const upper={contract_version:'hotels_v2_seven_arches_public_quote_request_v1',hotel_id:hotel,
 room_type_id:'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',room_rate_id:'7e420964-9cbf-4f1b-abd3-09840af5240f',
 arrival_date:'2099-09-10',departure_date:'2099-09-12',guest_count:2,selected_extra_ids:[]};
const cases=[
 ['valid_upper',upper],
 ['valid_ground',{...upper,room_type_id:'825c01b7-9f82-492a-9c81-9b1d5cd7acd3',room_rate_id:'3320590d-632d-423f-80d0-fd021cba7293'}],
 ['wrong_hotel',{...upper,hotel_id:'00000000-0000-4000-8000-000000000001'}],
 ['wrong_room',{...upper,room_type_id:'00000000-0000-4000-8000-000000000001'}],
 ['wrong_rate',{...upper,room_rate_id:'00000000-0000-4000-8000-000000000001'}],
 ['cross_room_rate',{...upper,room_rate_id:'3320590d-632d-423f-80d0-fd021cba7293'}],
 ['invalid_dates',{...upper,arrival_date:'invalid',departure_date:'2020-01-01'}],
 ['invalid_guests',{...upper,guest_count:0}],['over_capacity',{...upper,guest_count:99}],
 ['stale_snapshot',{...upper,authority_token:'0'.repeat(64),expires_at:'2000-01-01T00:00:00Z'}],
 ['forged_amount',{...upper,total_price:0,customer_total:0}],['forged_currency',{...upper,currency:'USD'}],
 ['forged_discount',{...upper,coupon_discount_amount:100000}],
 ['forged_payment',{...upper,payment_intent_id:'pi_Synthetic',payment_status:'paid'}],
 ['wrong_booking_payment',{...upper,booking_id:'00000000-0000-4000-8000-000000000001',payment_id:'pi_Other'}],
 ['null',null],['array',[]],['empty',{}],['replay_rejected',upper],
];
for(const [role,token] of [['anon',''],['admin',ADMIN_TOKEN],['partner',PARTNER_TOKEN]]){
 assert.ok(role==='anon'||token);
 for(const rpc of ['hotel_v2_public_quote_seven_arches','hotel_v2_public_create_seven_arches_booking']){
  for(const [scenario,value] of cases){
   const body=rpc.includes('create_')&&value&&typeof value==='object'&&!Array.isArray(value)
    ?{...value,contract_version:'hotels_v2_seven_arches_public_booking_request_v1',request_id:'30000000-0000-4000-8000-00000000e008'}:value;
   const r=request(rpc,token,{p_request:body});
   evidence.push({role,rpc,scenario,http:r.status,code:r.body.code,message:r.body.message});
   assert.equal(r.status,role==='anon'?401:403,JSON.stringify(evidence.at(-1)));
   assert.equal(r.body.code,'42501');assert.equal(r.body.message,'hotels_v2_public_booking_disabled');
  }
 }
 console.log('E8_RELEASE_GATE_'+role+'=38/38 PASS');
}
// Do not invoke the private pricing core as postgres to bypass release gates.
for(const [role,token] of [['anon',''],['partner',PARTNER_TOKEN]]){
 const r=request('hotel_v2_public_quote_seven_arches_core',token,{p_request:upper});
 evidence.push({role,rpc:'hotel_v2_public_quote_seven_arches_core',scenario:'private_core',http:r.status,code:r.body.code,message:r.body.message});
 assert.equal(r.status,role==='anon'?401:403);assert.equal(r.body.code,'42501');
 for(const rpc of ['hotel_v2_admin_get_published_architecture_conversion_114489']){
  const a=request(rpc,token,{p_hotel_id:hotel});
  evidence.push({role,rpc,scenario:'private_admin',http:a.status,code:a.body.code,message:a.body.message});
  assert.equal(a.status,role==='anon'?401:403);assert.equal(a.body.code,'42501');
 }
}
const after=snapshot();assert.deepEqual(after,before,'negative requests must not change any protected business state');
const report={PUBLIC_DISPLAY_HTTP:200,PUBLIC_DISPLAY_CLIENT_CONTRACT:'PASS',PUBLIC_BOOKING_DISABLED_GUARD:'PASS',
 INSTANT_BOOKING_DISABLED_GUARD:'PASS',FRONTEND_BOOKING_TRANSPORT_CALLS:calls,
 BOOKING_PREVIEW_RESULT:'GATED_OFF',RELEASE_GATE_CASES:114,PRIVATE_DENIAL_CASES:4,
 BUSINESS_BEFORE_AFTER_EXACT:true,counts:after,evidence};
writeFileSync(HTTP_DIR+'/e8-public-booking.json',JSON.stringify(report,null,2)+'\n');
console.log('E8_PUBLIC_BOOKING=PASS cases='+evidence.length+' unchanged_business=true');
