import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const HOTEL='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const sql=readFileSync('supabase/migrations/20260811449700_hotels_v2_public_request_only_partner_accept.sql','utf8');
const clientSrc=readFileSync('js/hotels-v2-public-request-114497.js','utf8');
const page=readFileSync('hotel.html','utf8');
const partner=readFileSync('js/hotels-v2-partner-workspace.js','utf8');
const repository=readFileSync('js/hotels-v2-partner-workspace-repository.js','utf8');

function testSyntax(path) {
  const p=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
}
test('all staged JavaScript files parse',()=>{
  testSyntax('js/hotels-v2-public-request-114497.js');
  testSyntax('js/hotels-v2-partner-workspace.js');
  testSyntax('js/hotels-v2-partner-workspace-repository.js');
});
test('request-only migration is transactional and OFF by default',()=>{
  assert.match(sql,/\bBEGIN;/);
  assert.match(sql,/\bCOMMIT;\s*$/);
  assert.match(sql,/request_mode_enabled boolean NOT NULL DEFAULT false/);
  assert.match(sql,/INSERT INTO hotels_public_booking_114497_private\.request_mode_gate/);
  assert.match(sql,/hotels_public_booking_114494_private\.public_booking_state\(\) IS DISTINCT FROM false/);
  assert.match(sql,/hotels_post_114493_private\.catalog_epoch_is_exact_114493\(\)/);
  assert.doesNotMatch(sql,/UPDATE\s+public\.site_settings/i);
  assert.doesNotMatch(sql,/UPDATE\s+hotels_post_114489_private/i);
});
test('server rejects non-A booking and payment modes at every write step',()=>{
  for(const name of ['hotel_v2_public_create_request_quote_114497','hotel_v2_public_begin_request_114497','hotel_v2_partner_accept_request_114497']){
    assert.ok(sql.includes('CREATE FUNCTION public.'+name));
  }
  assert.match(sql,/quote_core\(p_request\)->>'mode'/);
  assert.match(sql,/v_quote#>>'\{quote,mode\}' IS DISTINCT FROM 'A'/);
  assert.match(sql,/v_quote\.authority->>'mode' IS DISTINCT FROM 'A'/);
  assert.match(sql,/v_result->'payment_required' IS DISTINCT FROM 'false'::jsonb/);
  assert.match(sql,/v_result->>'status' NOT IN \('request_pending','confirmed'\)/);
  assert.match(sql,/hotels_public_booking_114494_private\.begin_core\(/);
  assert.match(sql,/hotels_public_booking_114494_private\.confirm_core\(/);
});
test('Partner inbox is scoped by exact assignment and process_bookings; no token returned',()=>{
  assert.match(sql,/public\.hotel_v2_h3_2a_require_partner_membership/);
  assert.match(sql,/p\.has_mutation_capability AND p\.process_bookings/g);
  assert.match(sql,/o\.mode='A' AND o\.status='request_pending'/);
  assert.match(sql,/q\.authority->>'partner_id'=p_partner_id::text/);
  assert.doesNotMatch(sql,/['"]lookup_token['"]/);
  assert.match(sql,/TO authenticated;/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
});
test('new public pilot UI does not reuse legacy raw hotel_bookings.insert',()=>{
  assert.match(page,/\/js\/hotels-v2-public-request-114497\.js/);
  assert.match(page,/HotelsV2PublicRequest114497\?\.mount/);
  assert.match(page,/if \(isHotelPageDisplayOnly\(\)\)/);
  assert.match(clientSrc,/const PILOT =/);
  assert.match(clientSrc,/hotel_v2_public_request_context_114497/);
  assert.doesNotMatch(clientSrc,/hotel_bookings/);
  assert.match(clientSrc,/options\?\.mode!=='A'/);
  assert.match(clientSrc,/status\.payment_required!==false/);
});
test('Partner inbox is explicitly frontend gated and uses one-shot accept',()=>{
  assert.match(partner,/state\.partnerRequestInboxReady === true/);
  assert.match(partner,/state\.partnerRequestInboxReady = true/);
  assert.match(partner,/state\.partnerRequestInboxReady = false/);
  assert.doesNotMatch(partner,/CYPRUSEYE_HOTELS_V2_REQUEST_ONLY_114497_ENABLED/);
  assert.match(partner,/Repository\.listPendingRequests114497/);
  assert.match(partner,/Repository\.acceptRequest114497/);
  assert.match(repository,/const currentRequestOnlyOrders = new Map\(\)/);
  assert.match(repository,/allowed\.delete\(order\)/);
  assert.match(repository,/value\.mode!=='A'\|\|value\.status!=='confirmed'/);
});
test('Public request contract respects child ages and 1-4 choice / 5-8 bundle',()=>{
  const exported={exports:{}};
  class FakeFormData {
    constructor(form){this.form=form;}
    get(key){return this.form.data[key];}
  }
  const sandbox={module:exported,FormData:FakeFormData};
  vm.runInNewContext(clientSrc,sandbox);
  const api=exported.exports;
  const context={
    contract_version:'hotels_v2_public_request_context_114497_v1',
    hotel_id:HOTEL,can_submit:false,minimum_stay_nights:2,maximum_stay_nights:365,currency:'EUR',
    children_policy:'minimum_age',minimum_child_age:15,
    rooms:[{id:'11111111-1111-4111-8111-111111111111',max_occupancy:4},
           {id:'22222222-2222-4222-8222-222222222222',max_occupancy:4}],
    allocation_rules:[
      {min_guest_count:1,max_guest_count:4,allocation_mode:'customer_choice'},
      {min_guest_count:5,max_guest_count:8,allocation_mode:'required_bundle'},
    ],extras:[],
  };
  assert.equal(api.validateContext(context).hotel_id,HOTEL);
  function make(adults,ages){
    return {
      data:{adults:String(adults),children:String(ages.length),
        room_type_id:context.rooms[0].id,arrival_date:'2027-03-10',departure_date:'2027-03-12'},
      querySelectorAll(sel){
        if(sel==='[data-request-child-age]')return ages.map(value=>({value:String(value)}));
        return [];
      }
    };
  }
  const single=api.prepareRequest(make(2,[15]),context);
  assert.equal(single.room_type_id,context.rooms[0].id);
  assert.equal(single.child_ages[0],15);
  const bundle=api.prepareRequest(make(4,[15]),context);
  assert.equal(bundle.room_type_id,null);
  assert.throws(()=>api.prepareRequest(make(2,[14]),context),/INVALID_CHILD_POLICY/);
  assert.throws(()=>api.prepareRequest(make(2,[18]),context),/INVALID_GUESTS/);
  assert.throws(()=>api.prepareRequest(make(8,[1]),context),/INVALID_GUESTS/);
  assert.equal(api.COPY.pl.heading,'Zapytanie o pobyt');
  assert.throws(()=>api.prepareRequest({...make(2,[]),
    data:{...make(2,[]).data,departure_date:'2027-03-11'}},context),/INVALID_DATES/);
  assert.equal(api.prepareRequest({...make(2,[]),
    data:{...make(2,[]).data,departure_date:'2027-03-24'}},context).room_type_id,context.rooms[0].id);
  assert.ok(api.COPY.he.pending);
  assert.match(api.COPY.pl.childMinimum,/Minimalny wiek dziecka/);
  assert.ok(api.COPY.en.childPolicyError);
});


test('request UI pins authoritative quotes and never silently replays an ambiguous begin',()=>{
  assert.match(clientSrc,/verifiedPrice=Number\(options\.gross\)/);
  assert.match(clientSrc,/Number\(issued\.quote\?\.gross\)!==verifiedPrice/);
  assert.match(clientSrc,/Number\(issued\.quote\?\.due_now\)!==0/);
  assert.match(clientSrc,/beginAttempted=true/);
  assert.match(clientSrc,/finalized=true/);
  assert.match(clientSrc,/RPC\.status/);
  assert.match(clientSrc,/p_order_id:issued\.quote_id/);
  assert.match(clientSrc,/previewButton\.disabled=finalized/);
  assert.match(clientSrc,/if\(submitting\|\|finalized\|\|!verified\)return/);
  assert.doesNotMatch(clientSrc,/retry.*RPC\.begin/);
});
test('display-only view stays protected while server-gated A-only form can appear',()=>{
  assert.match(page,/form\.hidden = true/);
  assert.match(page,/data-hotel-request-only-114497/);
  assert.match(page,/Wyślij zapytanie poniżej/);
  assert.match(page,/אין תשלום מקוון/);
});

test('live 7 Kamares child policy is server-derived, never invented',()=>{
  assert.match(sql,/'children_policy',v_hotel\.children_policy/);
  assert.match(sql,/'minimum_child_age',v_hotel\.minimum_child_age/);
  assert.match(clientSrc,/context\.minimum_child_age/);
  assert.match(clientSrc,/INVALID_CHILD_POLICY/);
  assert.doesNotMatch(clientSrc,/minimum_child_age\s*:\s*15/);
});
