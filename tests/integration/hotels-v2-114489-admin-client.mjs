import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca',actor='10000000-0000-4000-8000-000000000001';
const request='10000000-0000-4000-8000-000000000002';
const confirm='CONVERT 7 KAMARES TO ROOMS_V2';
const clone=x=>JSON.parse(JSON.stringify(x));
const plan=()=>({contract_version:'hotels_v2_published_conversion_plan_v1',hotel_id:hotel,actor_id:actor,
 issued_at:'2026-09-19T00:00:00Z',expires_at:'2026-09-19T00:15:00Z',from:'legacy',to:'rooms_v2',
 is_published:true,public_booking_enabled:false,signature:'a'.repeat(64),snapshot_hash:'b'.repeat(64)});
const ready=()=>({contract_version:'hotels_v2_published_conversion_readiness_v1',hotel_id:hotel,
 status:'READY',conversion_allowed:true,blocking_reasons:[],plan:plan()});
const receipt=()=>({contract_version:'hotels_v2_published_conversion_result_v1',hotel_id:hotel,
 request_id:request,architecture_version:'rooms_v2',is_published:true,public_booking_enabled:false,replayed:false});
function load(rpc){
 const ctx=vm.createContext({console,window:{getSupabase:()=>({rpc})}});
 for(const p of ['admin/hotels-v2-workspace-core.js','admin/hotels-v2-workspace-repository.js'])
  vm.runInContext(readFileSync(new URL('../../'+p,import.meta.url),'utf8'),ctx,{filename:p});
 return ctx.HotelsV2WorkspaceRepository;
}
test('readiness accepts the exact server contract, blocked/converted never expose executable plans',()=>{
 const repo=load();assert.deepEqual(clone(repo.validatePublishedConversionReadiness(ready())),ready());
 for(const status of ['BLOCKED','ALREADY_CONVERTED']){
  const dto={...ready(),status,conversion_allowed:false,plan:null,blocking_reasons:status==='BLOCKED'?['unsafe']:[]};
  assert.equal(repo.validatePublishedConversionReadiness(dto).status,status);
 }
});
for(const [label,mutate] of [
 ['foreign hotel',v=>v.hotel_id=actor],['unknown field',v=>v.extra=true],
 ['missing status',v=>delete v.status],['ready blockers',v=>v.blocking_reasons=['unsafe']],
 ['false ready',v=>v.conversion_allowed=false],['plan missing',v=>v.plan=null],
 ['wrong plan contract',v=>v.plan.contract_version='legacy'],['wrong plan target',v=>v.plan.hotel_id=actor],
 ['unpublish',v=>v.plan.is_published=false],['booking enabled',v=>v.plan.public_booking_enabled=true],
 ['bad signature',v=>v.plan.signature='x'],['bad snapshot',v=>v.plan.snapshot_hash='x'],
 ['bad actor',v=>v.plan.actor_id='x'],['bad timestamp',v=>v.plan.expires_at='bad'],
 ['reversed expiry',v=>v.plan.expires_at='2020-01-01T00:00:00Z'],['extra plan key',v=>v.plan.price=100],
 ['wrong transition',v=>v.plan.to='legacy'],['malformed blocker',v=>v.blocking_reasons=[null]],
])test('reject '+label,()=>{const value=ready();mutate(value);assert.throws(()=>load().validatePublishedConversionReadiness(value));});

test('one fresh read, explicit Apply, no automatic refresh or retry',async()=>{
 const calls=[];const repo=load(async(name,args)=>{calls.push({name,args});return {data:calls.length===1?ready():receipt(),error:null};});
 const value=await repo.getPublishedArchitectureConversion(hotel);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'hotel_v2_admin_get_published_architecture_conversion_114489');
 await assert.rejects(repo.applyPublishedArchitectureConversion(value.plan,request,'wrong confirmation'));
 assert.equal(calls.length,1);
 assert.equal((await repo.applyPublishedArchitectureConversion(value.plan,request,confirm)).architecture_version,'rooms_v2');
 await assert.rejects(repo.applyPublishedArchitectureConversion(value.plan,request,confirm));
 assert.equal(calls.length,2);assert.equal(calls[1].name,'hotel_v2_admin_convert_legacy_hotel_to_v2_114489');
 assert.deepEqual(clone(calls[1].args),clone({p_plan:value.plan,p_request_id:request,p_confirmation:confirm}));
});
for(const code of ['57014','42501','PGRST202','55000'])test(code+' consumes one attempted plan without fallback',async()=>{
 const calls=[];const repo=load(async name=>{calls.push(name);return calls.length===1?{data:ready(),error:null}:{data:null,error:{code,message:'synthetic failure'},status:500};});
 const value=await repo.getPublishedArchitectureConversion(hotel);
 await assert.rejects(repo.applyPublishedArchitectureConversion(value.plan,request,confirm));
 await assert.rejects(repo.applyPublishedArchitectureConversion(value.plan,request,confirm));
 assert.equal(calls.length,2);
});
test('foreign target, manufactured and changed plans never reach transport',async()=>{
 const calls=[];const repo=load(async name=>{calls.push(name);return {data:ready(),error:null};});
 await assert.rejects(repo.getPublishedArchitectureConversion(actor));
 await assert.rejects(repo.applyPublishedArchitectureConversion(plan(),request,confirm));assert.equal(calls.length,0);
 const value=await repo.getPublishedArchitectureConversion(hotel);value.plan.snapshot_hash='c'.repeat(64);
 await assert.rejects(repo.applyPublishedArchitectureConversion(value.plan,request,confirm));assert.equal(calls.length,1);
});
test('exact target uses versioned property writer; unrelated Hotel preserves historical route',async()=>{
 for(const id of [hotel,actor]){
  const calls=[];const repo=load(async(name,args)=>{calls.push({name,args});throw Error('stop after route observation');});
  await assert.rejects(repo.applyPropertyControlPlan({contract_version:'hotels_v2_admin_b_property_control_v1',hotel_id:id,
   expected_property_updated_at:'2026-09-19T00:00:00Z',reviewed_at:'2026-09-19T00:01:00Z',expected_operational_profile_version:0,
   expected_original:{city:'Old'},payload:{city:'New'}},request));
  assert.equal(calls.length,1);assert.equal(calls[0].name,id===hotel?'hotel_v2_admin_apply_property_control_plan_114489':'hotel_v2_admin_apply_property_control_plan');
 }
});
