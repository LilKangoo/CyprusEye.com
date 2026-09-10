import fs from 'node:fs';
import vm from 'node:vm';
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const ids=['b4ef504f-cdeb-4e3c-a54d-932146ef4e94','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'];
function state(status='SUCCESSOR_ALREADY_COMPLETE'):any{return {contract_version:'hotels_shadow_preparation_state_v1',hotel_id:hotel,status,
 reasons:status==='BLOCKED'?['successor_topology_or_protected_contract_not_exact']:[],room_type_ids:ids,
 feature_flags:{hotel_rooms_v2_enabled:false,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:false},
 public_booking_enabled:false,mutation_allowed:status==='PRE_H2B1_READY'};}
function load(response:any){
 const calls:any[]=[];
 const context=vm.createContext({console,crypto:{randomUUID:()=> '84000000-0000-4000-8000-000000000482'},window:{getSupabase:()=>({rpc:async(name:string,payload:any)=>{
 calls.push({name,payload});return typeof response==='function'?response(name):{data:response,error:null};}})}});
 for(const p of ['admin/hotels-v2-workspace-core.js','admin/hotels-v2-workspace-repository.js'])vm.runInContext(fs.readFileSync(p,'utf8'),context);
 return {repo:context.HotelsV2WorkspaceRepository,calls};
}
const plan={hotel_id:hotel,source_contract:'seven_arches_two_apartments_v1',expected_property_policy:{children_policy:null,minimum_child_age:null},rooms:ids.map(id=>({id}))};
describe('H2B1 successor-aware preparation',()=>{
 test('completed successor is a read-only no-op, including stale modal confirmation',async()=>{
  const {repo,calls}=load(state());
  await expect(repo.prepareShadowRoomsSuccessor(plan)).rejects.toMatchObject({preparationComplete:true});
  expect(calls.map(c=>c.name)).toEqual(['hotel_v2_admin_get_shadow_preparation_state_114483']);
 });
 test('blocked topology visibly rejects before any mutation',async()=>{
  const {repo,calls}=load(state('BLOCKED'));
  await expect(repo.prepareShadowRoomsSuccessor(plan)).rejects.toThrow('successor_topology_or_protected_contract_not_exact');
  expect(calls).toHaveLength(1);
 });
 test('historical PRE path fetches fresh state and calls only successor wrapper exactly once',async()=>{
  const {repo,calls}=load((name:string)=>name==='hotel_v2_admin_get_shadow_preparation_state_114483'
   ?{data:state('PRE_H2B1_READY'),error:null}
   :{data:null,error:{code:'55000',message:'hotels_v2_h2b1_capability_flag_enabled'}});
  await expect(repo.prepareShadowRoomsSuccessor(plan)).rejects.toMatchObject({userMessage:expect.stringContaining('current capability state')});
  expect(calls.map(c=>c.name)).toEqual(['hotel_v2_admin_get_shadow_preparation_state_114483','hotel_v2_admin_prepare_shadow_rooms_successor']);
 });
 for(const [label,change] of [
  ['foreign hotel',(v:any)=>{v.hotel_id=ids[0];}],['extra key',(v:any)=>{v.account_id='private';}],
  ['missing flag',(v:any)=>{delete v.feature_flags.hotel_external_sync_enabled;}],['null flag',(v:any)=>{v.feature_flags.hotel_external_sync_enabled=null;}],
  ['string flag',(v:any)=>{v.feature_flags.hotel_external_sync_enabled='true';}],['Rooms ON ready',(v:any)=>{v.feature_flags.hotel_rooms_v2_enabled=true;}],
  ['Stripe ON',(v:any)=>{v.feature_flags.hotel_stripe_connect_enabled=true;}],['Instant ON',(v:any)=>{v.feature_flags.hotel_instant_booking_enabled=true;}],
  ['wrong rooms',(v:any)=>{v.room_type_ids=[ids[0],ids[0]];}],['public ON',(v:any)=>{v.public_booking_enabled=true;}],
  ['complete mutation allowed',(v:any)=>{v.mutation_allowed=true;}],['ready blockers',(v:any)=>{v.reasons=['unexpected'];}],
 ] as [string,(v:any)=>void][]){test('malformed '+label+' fails closed',async()=>{const v=state();change(v);const {repo,calls}=load(v);await expect(repo.prepareShadowRoomsSuccessor(plan)).rejects.toThrow('invalid apartment preparation state');expect(calls).toHaveLength(1);});}
 test.each([404,401,403,500])('HTTP %s error has no fallback or mutation retry',async(status)=>{
  const {repo,calls}=load(()=>({data:null,error:{code:status===404?'PGRST202':'42501',message:'denied'},status}));
  await expect(repo.prepareShadowRoomsSuccessor(plan)).rejects.toThrow();expect(calls).toHaveLength(1);
 });
 test('transport failure is not converted to completion',async()=>{
  const {repo,calls}=load(()=>{throw Error('network unavailable');});await expect(repo.prepareShadowRoomsSuccessor(plan)).rejects.toThrow();expect(calls).toHaveLength(1);
 });
 test('runtime UI uses successor entry only; historical stale pricing guard remains',()=>{
  const ui=fs.readFileSync('admin/hotels-v2-workspace.js','utf8');
  expect(ui).not.toContain('Repository.prepareLegacyShadowRooms(');
  expect(ui).toContain('Repository.prepareShadowRoomsSuccessor(plan)');
  expect(ui).toContain('data-shadow-save-error');expect(ui).toContain("inlineError.setAttribute('role', 'alert')");
  const migration=fs.readFileSync('supabase/migrations/20260811448200_hotels_v2_shadow_preparation_successor.sql','utf8');
  expect(migration).toContain('hotels_114482_preparation_already_complete');
  expect(migration).not.toContain('UPDATE public.hotel_pricing_schedules');
  expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.hotel_v2_admin_prepare_legacy_shadow_rooms');
 });
});
