import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

const source = readFileSync('js/hotels-v2-partner-workspace-repository.js','utf8');
const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const OTHER = '22222222-2222-4222-8222-222222222222';
const CORRELATION = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY = '55555555-5555-4555-8555-555555555555';
async function fingerprint(str) {
  return Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(str))).toString('hex');
}
function setup(hotelId=HOTEL, scenario={}) {
  const calls = [];
  let validated = 0;
  const core = {
    PUBLISHED_ARCHITECTURE_TARGET: HOTEL,
    requireCanonicalUuid: (value) => value,
    buildExternalCalendarDraft: (_control,intent) => ({hotel_id:hotelId,intent}),
    validateExternalCalendarPreview: (value) => value,
    validateExternalCalendarApplyResult: (value, expected) => {
      validated++;
      if (scenario.invalidReceipt) throw new Error('Incorrect calendar receipt');
      assert.equal(value.contract_version,'hotels_v2_external_calendar_apply_result_v1');
      assert.equal(value.hotel_id,expected.plan.hotel_id);
      assert.equal(value.correlation_id,expected.correlationId);
      assert.equal(value.idempotency_key,expected.idempotencyKey);
      return value;
    },
  };
  const rpc = async (name, payload) => {
    calls.push({name,payload});
    if (scenario.error && name === 'hotel_v2_partner_apply_external_calendar_direct_114496') {
      return {data:null,status:scenario.error.status,error:{code:scenario.error.code,message:scenario.error.message}};
    }
    if (name.endsWith('preview_external_calendar_plan_114493')) {
      return {data:{changed:true,reviewed_plan:scenario.plan},error:null};
    }
    if (name === 'hotel_v2_partner_apply_external_calendar_direct_114496') {
      return {data:{contract_version:'hotels_v2_external_calendar_apply_result_v1',hotel_id:hotelId,
        correlation_id:CORRELATION,idempotency_key:IDEMPOTENCY},error:null};
    }
    throw new Error('Unexpected RPC '+name);
  };
  const root = {HotelsV2PartnerWorkspaceCore:core,window:{getSupabase:()=>({rpc})},crypto:webcrypto,TextEncoder,console};
  vm.runInNewContext(source,root,{filename:'hotels-v2-partner-workspace-repository.js'});
  return {calls,repository:root.HotelsV2PartnerWorkspaceRepository,validated};
}
function plan(hotel=HOTEL, operation={entity:'calendar_source',action:'create',payload:{}}) {
  return {hotel_id:hotel,plan_fingerprint:'fingerprint-1',operations:[operation]};
}
async function preview(h, p) {
  const draft = {hotel_id:p.hotel_id,intent:{entity:'calendar_source',action:'create'}};
  await h.repository.previewExternalCalendarPlan(draft, {hotel_id:p.hotel_id});
}
test('pilot direct apply uses only new 114496 endpoint and strict receipt validator',async()=>{
  const p=plan();const h=setup(HOTEL,{plan:p});await preview(h,p);
  const result=await h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY);
  assert.equal(result.hotel_id,HOTEL);
  assert.deepEqual(h.calls.map(x=>x.name),[
    'hotel_v2_partner_preview_external_calendar_plan_114493',
    'hotel_v2_partner_apply_external_calendar_direct_114496'
  ]);
  assert.equal(h.calls[1].payload.p_ical_url,null);
});
test('review plan is consumed one time, no replay or silent fallback',async()=>{
  const p=plan();const h=setup(HOTEL,{plan:p});await preview(h,p);
  await h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY);
  await assert.rejects(h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY),/Run Review again/);
  assert.equal(h.calls.length,2);
});
test('different hotel is blocked locally before calling any write',async()=>{
  const p=plan(OTHER);const h=setup(OTHER,{plan:p});await preview(h,p);
  await assert.rejects(h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY),/not enabled/);
  assert.equal(h.calls.length,1);
});
test('mutated server plan cannot be used for direct write',async()=>{
  const p=plan();const h=setup(HOTEL,{plan:p});await preview(h,p);
  p.operations[0].action='update';
  await assert.rejects(h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY),/Run Review again/);
  assert.equal(h.calls.length,1);
});
test('404 missing RPC fails closed without proposal fallback',async()=>{
  const p=plan();const h=setup(HOTEL,{plan:p,error:{status:404,code:'PGRST202',message:'Could not find the function in schema cache'}});await preview(h,p);
  await assert.rejects(h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY));
  assert.equal(h.calls.length,2);
  assert.equal(h.calls[1].name,'hotel_v2_partner_apply_external_calendar_direct_114496');
});
test('denied write fails closed, with no retry',async()=>{
  const p=plan();const h=setup(HOTEL,{plan:p,error:{status:403,code:'42501',message:'Partner assignment denied'}});await preview(h,p);
  await assert.rejects(h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY));
  assert.equal(h.calls.length,2);
});
test('success with invalid receipt is ambiguous and never retried',async()=>{
  const p=plan();const h=setup(HOTEL,{plan:p,invalidReceipt:true});await preview(h,p);
  await assert.rejects(h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY),
    e=>e.saveSucceeded===true && /Nothing was retried/.test(e.userMessage));
  assert.equal(h.calls.length,2);
});
test('secret URL must match exact private preview fingerprint and is never used for source metadata',async()=>{
  const url='https://calendar.example.org/private.ics?token=private';
  const hash=await fingerprint(url);
  const p=plan(HOTEL,{entity:'ical_secret',action:'set',payload:{url_fingerprint:hash}});
  const h=setup(HOTEL,{plan:p});
  const draft={hotel_id:HOTEL,intent:{entity:'ical_secret',action:'set',payload:{ical_url:url}}};
  await h.repository.previewExternalCalendarPlan(draft,{hotel_id:HOTEL});
  await assert.rejects(h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY,url+'modified'),/Run Review again/);
  assert.equal(h.calls.length,1);
  const result=await h.repository.applyExternalCalendarDirect114496(p,CORRELATION,IDEMPOTENCY,url);
  assert.equal(result.hotel_id,HOTEL);
  assert.equal(h.calls[1].payload.p_ical_url,url);
  assert.equal(h.calls[1].name,'hotel_v2_partner_apply_external_calendar_direct_114496');
});
