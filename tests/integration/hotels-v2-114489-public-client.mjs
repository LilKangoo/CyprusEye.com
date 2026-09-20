import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function load(){const ctx=vm.createContext({console});vm.runInContext(readFileSync(new URL('../../js/hotels-v2-seven-arches-public-pricing.js',import.meta.url),'utf8'),ctx);return ctx.HotelsV2SevenArchesPublicPricing;}
const dto=()=>({contract_version:'hotels_v2_seven_arches_public_display_v1',hotel_id:'9b6d99a0-923a-4fbc-be54-c066e856e6ca',
 architecture_version:'rooms_v2',is_published:true,public_booking_enabled:false,instant_booking_enabled:false,
 currency:'EUR',min_nightly_rate:100,display_only:true,room_types:Object.keys(load().ROOMS).map(id=>({id,name_i18n:{en:'Apartment'},description_i18n:{},max_occupancy:4,inventory_count:1,
 beds:[{type:'double',count:1},{type:'sofa',count:1}],bathrooms:1,photos:['/assets/synthetic-room.jpg']}))});
test('published rooms_v2 public DTO accepts explicit quantity-to-count result',()=>{
 assert.equal(load().validateDisplay(dto()).room_types[0].beds[0].count,1);
});
for(const [label,change] of [
 ['raw DB bed',v=>v.room_types[0].beds[0]={type:'double',quantity:1}],
 ['public booking',v=>v.public_booking_enabled=true],['instant booking',v=>v.instant_booking_enabled=true],
 ['publication off',v=>v.is_published=false],['private field',v=>v.partner_id='private'],
 ['unsafe photo',v=>v.room_types[0].photos=['javascript:alert(1)']],
])test('public DTO rejects '+label,()=>{const v=dto();change(v);assert.throws(()=>load().validateDisplay(v));});
test('cached legacy and converted Hotels both reject booking without a transport call',async()=>{
 const api=load();let calls=0;const client={rpc:async()=>{calls++;throw Error('unexpected');}};
 for(const architecture_version of ['legacy','rooms_v2']){
  const hotel={id:api.HOTEL_ID,architecture_version};
  assert.throws(()=>api.assertBookingAllowed(hotel),/booking is not enabled/);
  await assert.rejects(api.createQuoteSession(client).submit(hotel,null,{}));
 }
 assert.equal(calls,0);
});
