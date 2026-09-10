import fs from 'node:fs';
import {test,expect} from '@playwright/test';
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
async function setup(page:any,status:string){
 await page.route('**/*',(r:any)=>r.request().url().endsWith('/shadow-successor-test')
  ?r.fulfill({contentType:'text/html',body:'<main id="test"></main>'}):r.abort());
 await page.goto('/shadow-successor-test');
 await page.evaluate(({hotel,status}:any)=>{
  const w=window as any;w.__calls=[];
  w.__dto={contract_version:'hotels_shadow_preparation_state_v1',hotel_id:hotel,status,
   reasons:status==='BLOCKED'?['successor_topology_or_protected_contract_not_exact']:[],
   room_type_ids:['b4ef504f-cdeb-4e3c-a54d-932146ef4e94','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'],
   feature_flags:{hotel_rooms_v2_enabled:false,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:false},
   public_booking_enabled:false,mutation_allowed:status==='PRE_H2B1_READY'};
  w.getSupabase=()=>({rpc:async(name:string)=>{w.__calls.push(name);
   if(name==='hotel_v2_admin_get_shadow_preparation_state_114483')return {data:w.__dto,error:null};
   if(name==='hotel_v2_admin_prepare_shadow_rooms_successor')return {data:null,error:{code:'55000',message:'hotels_v2_h2b1_capability_flag_enabled'}};
   throw Error('Unapproved RPC '+name);
  }});
 },{hotel,status});
 for(const path of ['admin/hotels-v2-workspace-core.js','admin/hotels-v2-workspace-repository.js','admin/hotels-v2-workspace.js']){
  let code=fs.readFileSync(path,'utf8');
  if(path.endsWith('/hotels-v2-workspace.js'))code=code.replace('  function renderRoomsPanel(panel) {',
   '  root.__shadowTest={state,render:renderRoomsPanel,review:openReview};\n  function renderRoomsPanel(panel) {');
  await page.addScriptTag({content:code});
 }
 await page.evaluate(async(hotel:string)=>{
  const w=window as any,s=w.__shadowTest.state;
  s.workspace=w.HotelsV2WorkspaceCore.normalizeWorkspace({property:{id:hotel,architecture_version:'legacy',title:{en:'7 Arches'},pricing_model:'tiered_by_nights',max_persons:8,photos:[],pricing_tiers:{currency:'EUR',rules:[]}},feature_flags:w.__dto.feature_flags,room_types:[],room_rates:[],rate_plans:[],units:[]});
  s.shadowPreparation=await w.HotelsV2WorkspaceRepository.getShadowPreparationState(hotel);
  w.__shadowTest.render(document.querySelector('#test'));
 },hotel);
}
test('successor-complete Rooms panel has details and no historical preparation or Save',async({page})=>{
 await setup(page,'SUCCESSOR_ALREADY_COMPLETE');
 await expect(page.locator('[data-shadow-preparation-complete]')).toContainText('2 apartments prepared');
 await expect(page.locator('[data-shadow-preparation-complete]')).toContainText('Successor configuration verified');
 await expect(page.getByRole('button',{name:'Prepare 2 existing apartments'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Save reviewed changes'})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__calls)).toEqual(['hotel_v2_admin_get_shadow_preparation_state_114483']);
});
test('partial successor visibly BLOCKED, no preparation mutation controls',async({page})=>{
 await setup(page,'BLOCKED');
 await expect(page.locator('[data-shadow-preparation-blocked]')).toContainText('successor_topology_or_protected_contract_not_exact');
 await expect(page.getByRole('button',{name:'Prepare 2 existing apartments'})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__calls.length)).toBe(1);
});
test('stale Review rechecks complete state: no old or successor mutation and modal closes',async({page})=>{
 await setup(page,'SUCCESSOR_ALREADY_COMPLETE');
 await page.evaluate(async(hotel:string)=>{
  const w=window as any;await w.__shadowTest.review({title:'Stale preparation Review',entity:'seven_arches_shadow_package',before:{rooms:[]},after:{rooms:['reviewed']},onConfirm:()=>w.HotelsV2WorkspaceRepository.prepareShadowRoomsSuccessor({hotel_id:hotel})});
 },hotel);
 await page.getByRole('button',{name:'Save reviewed changes'}).click();
 await expect(page.getByRole('button',{name:'Save reviewed changes'})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__calls)).toEqual(['hotel_v2_admin_get_shadow_preparation_state_114483','hotel_v2_admin_get_shadow_preparation_state_114483']);
});
test('historical reviewed save error stays visible inside modal; no automatic retry',async({page})=>{
 await setup(page,'PRE_H2B1_READY');
 await page.evaluate(async(hotel:string)=>{
  const w=window as any;await w.__shadowTest.review({title:'Historical preparation Review',entity:'seven_arches_shadow_package',before:{rooms:[]},after:{rooms:['reviewed']},onConfirm:()=>w.HotelsV2WorkspaceRepository.prepareShadowRoomsSuccessor({hotel_id:hotel,source_contract:'seven_arches_two_apartments_v1',expected_property_policy:{children_policy:null,minimum_child_age:null},rooms:w.__dto.room_type_ids.map((id:string)=>({id}))})});
 },hotel);
 await page.getByRole('button',{name:'Save reviewed changes'}).click();
 await expect(page.locator('[data-shadow-save-error]')).toContainText('current capability state');
 await expect(page.locator('[data-shadow-save-error]')).toHaveAttribute('role','alert');
 expect(await page.evaluate(()=>(window as any).__calls)).toEqual(['hotel_v2_admin_get_shadow_preparation_state_114483','hotel_v2_admin_get_shadow_preparation_state_114483','hotel_v2_admin_prepare_shadow_rooms_successor']);
});
