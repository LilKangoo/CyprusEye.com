// Network-free, synthetic Partner successor read/validation gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const target='9b6d99a0-923a-4fbc-be54-c066e856e6ca',partner='20000000-0000-4000-8000-000000000001';
const foreign='90000000-0000-4000-8000-000000000999',assignment='30000000-0000-4000-8000-000000000001',token='a'.repeat(64);
const oldRpc='hotel_v2_partner_get_workspace',newRpc='hotel_v2_partner_get_workspace_114489';
const from='2026-09-13',to='2026-10-13';
const payload={p_partner_id:partner,p_hotel_id:target,p_from:from,p_to:to};
const clone=v=>JSON.parse(JSON.stringify(v));
function load(rpc=async()=>{throw Error('unexpected RPC');}){
 const context=vm.createContext({console,TextEncoder,window:{getSupabase:()=>({rpc})}});
 for(const file of ['admin/hotels-v2-workspace-core.js','js/hotels-v2-partner-workspace-core.js','js/hotels-v2-partner-workspace-repository.js'])
  vm.runInContext(readFileSync(new URL('../../'+file,import.meta.url),'utf8'),context,{filename:file});
 return {Core:context.HotelsV2PartnerWorkspaceCore,Repository:context.HotelsV2PartnerWorkspaceRepository};
}
const {Core}=load();let passed=0;const pass=s=>{passed++;console.log('PASS '+s);};
function fixture(architecture='legacy',versioned=true,hotelId=target){
 const flags={hotel_rooms_v2_enabled:true,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:true};
 return {
  contract_version:versioned?Core.CONTRACTS.workspace114489:Core.CONTRACTS.workspace,
  partner:{id:partner,role:'owner'},hotel_id:hotelId,
  assignment:{id:assignment,permission_version:1,capabilities:Object.fromEntries(Core.CAPABILITIES.map(k=>[k,false])),access_snapshot_token:token},
  feature_flags:flags,content_snapshot_token:token,
  property:{id:hotelId,slug:'synthetic-seven-kamares',title_i18n:{en:'Synthetic Hotel'},description_i18n:{en:''},
   city:'Paphos',address_line:null,district:null,postal_code:null,country:'Cyprus',latitude:null,longitude:null,
   google_maps_url:null,amenities:[],check_in_from:'14:00',check_out_until:'11:00',cover_image_url:null,photos:[],
   architecture_version:architecture,status:'approved',is_published:true,updated_at:'2026-09-13T00:00:00Z'},
  property_draft:{exists:false,id:null,status:null,version:0,source_property_updated_at:null,content:{},photos:{},updated_at:null},
  rooms:[],units:[],pricing:null,availability:null,recent_activity:[],
  sections:Object.fromEntries(Core.SECTION_KEYS.map(k=>[k,{visible:k==='overview',available:k==='overview',
   status:k==='overview'?'available':['bookings','payments'].includes(k)?'existing_flow':['booking_changes','stripe_onboarding'].includes(k)?'future_stage':'unavailable'}])),
  legacy_authoritative:architecture==='legacy',public_change:false,
  capability_lifecycle:{contract_version:'hotels_v2_capability_lifecycle_v1',version:6,feature_flags:clone(flags),
   public_booking_enabled:false,architecture:'legacy',expected_public_change:false,audit_chain_exact:true},
  stripe_connection:{contract_version:'hotels_partner_stripe_capability_v1',partner_id:partner,hotel_id:hotelId,
   platform_enabled:true,onboarding_authorized:true,account_status:'NOT_CONNECTED',checked_at:null,can_connect:true,
   platform_ready:false,attestation_status:'STALE'},
  ...(versioned?{architecture_successor:{contract_version:'hotels_v2_published_architecture_v1',hotel_id:hotelId,
   architecture_version:architecture,is_published:true,public_booking_enabled:false,conversion_receipt_present:architecture==='rooms_v2'}}:{}),
 };
}
for(const architecture of ['legacy','rooms_v2']){
 const value=fixture(architecture);
 assert.deepEqual(clone(Core.validateWorkspace114489(value,{partnerId:partner,hotelId:target})),value);
 assert.equal(value.capability_lifecycle.architecture,'legacy');
 assert.equal(Core.stripeConnectionPresentation(value.stripe_connection).canConnect,false);
 pass(architecture+' successor preserves property publication/global lifecycle/Stripe NOT_CONNECTED');
}
assert.deepEqual(clone(Core.validateWorkspace(fixture('legacy',false))),fixture('legacy',false));
assert.throws(()=>Core.validateWorkspace(fixture('rooms_v2',false)),/legacy\/public/);
assert.throws(()=>Core.validateWorkspace(fixture('rooms_v2')),/unexpected field envelope/);
assert.throws(()=>Core.validateWorkspace114489(fixture('legacy',false)),/unexpected field envelope/);
pass('old contract stays strictly legacy; explicit successor never reinterprets an old DTO');
for(const [label,mutate] of [
 ['missing evidence',v=>delete v.architecture_successor],
 ['wrong evidence contract',v=>v.architecture_successor.contract_version='unversioned'],
 ['foreign evidence Hotel',v=>v.architecture_successor.hotel_id=foreign],
 ['foreign property',v=>v.property.id=foreign],
 ['architecture mismatch',v=>v.architecture_successor.architecture_version='legacy'],
 ['property unpublished',v=>v.property.is_published=false],
 ['evidence unpublished',v=>v.architecture_successor.is_published=false],
 ['receipt absent',v=>v.architecture_successor.conversion_receipt_present=false],
 ['fake legacy authority',v=>v.legacy_authoritative=true],
 ['public change',v=>v.public_change=true],
 ['evidence booking on',v=>v.architecture_successor.public_booking_enabled=true],
 ['global booking on',v=>v.capability_lifecycle.public_booking_enabled=true],
 ['global architecture spoofed',v=>v.capability_lifecycle.architecture='rooms_v2'],
 ['audit drift',v=>v.capability_lifecycle.audit_chain_exact=false],
 ['missing lifecycle',v=>{delete v.capability_lifecycle;delete v.stripe_connection;}],
 ['Rooms off',v=>{v.feature_flags.hotel_rooms_v2_enabled=false;v.capability_lifecycle.feature_flags.hotel_rooms_v2_enabled=false;}],
 ['instant on',v=>{v.feature_flags.hotel_instant_booking_enabled=true;v.capability_lifecycle.feature_flags.hotel_instant_booking_enabled=true;}],
 ['foreign Stripe',v=>v.stripe_connection.partner_id=foreign],
 ['capability drift',v=>v.assignment.capabilities.manage_prices=true],
 ['unknown evidence key',v=>v.architecture_successor.booking_url='forbidden'],
 ['unexpected raw row',v=>v.customer_email='synthetic@example.test'],
]){
 const value=fixture('rooms_v2');mutate(value);assert.throws(()=>Core.validateWorkspace114489(value));pass('reject '+label);
}
assert.throws(()=>Core.validateWorkspace114489(fixture('rooms_v2',true,foreign)));
assert.throws(()=>Core.validateWorkspace114489(fixture(),{partnerId:foreign,hotelId:target}));
const premature=fixture();premature.architecture_successor.conversion_receipt_present=true;
assert.throws(()=>Core.validateWorkspace114489(premature));pass('target, Partner identity and legacy receipt absence');
const missing=(changes={})=>({data:null,status:404,error:{code:'PGRST202',message:
 'Could not find the function public.'+newRpc+'(p_from, p_hotel_id, p_partner_id, p_to) in the schema cache'},...changes});
{
 const calls=[];const {Repository}=load(async(name,body)=>{calls.push({name,body});return {data:fixture('rooms_v2'),error:null};});
 assert.equal((await Repository.getWorkspace(partner,target,from,to)).property.architecture_version,'rooms_v2');
 assert.deepEqual(clone(calls),[{name:newRpc,body:payload}]);pass('one exact successor READ; correct four arguments');
}
{
 const calls=[];const {Repository}=load(async(name,body)=>{calls.push({name,body});return name===newRpc?missing():{data:fixture('legacy',false),error:null};});
 assert.equal((await Repository.getWorkspace(partner,target,from,to)).contract_version,Core.CONTRACTS.workspace);
 assert.deepEqual(clone(calls),[{name:newRpc,body:payload},{name:oldRpc,body:payload}]);pass('exact 404/PGRST202 missing successor allows one strict legacy read');
}
{
 const calls=[];const {Repository}=load(async name=>{calls.push(name);return {data:fixture('legacy',false,foreign),error:null};});
 await Repository.getWorkspace(partner,foreign,from,to);assert.deepEqual(calls,[oldRpc]);pass('other Hotels never probe target successor');
}
for(const [label,response] of [
 ['permission',{data:null,status:403,error:{code:'42501',message:'permission denied'}}],
 ['timeout',{data:null,status:500,error:{code:'57014',message:'statement timeout'}}],
 ['drift',{data:null,status:400,error:{code:'55000',message:'architecture lineage drift'}}],
 ['bare404',{data:null,status:404,error:{code:'404',message:'not found'}}],
 ['wrongHTTP',missing({status:500})],['noHTTP',missing({status:undefined})],
 ['wrongRPC',missing({error:{code:'PGRST202',message:'Could not find the function public.other_rpc in the schema cache'}})],
 ['prefixedRPC',missing({error:{code:'PGRST202',message:'Could not find the function public.x'+newRpc+' in the schema cache'}})],
 ['suffixedRPC',missing({error:{code:'PGRST202',message:'Could not find the function public.'+newRpc+'_extra in the schema cache'}})],
 ['noCacheEvidence',missing({error:{code:'PGRST202',message:'Could not find the function public.'+newRpc}})],
 ['wrongSuccessContract',{data:fixture('legacy',false),error:null}],['malformedDTO',{data:{contract_version:Core.CONTRACTS.workspace114489},error:null}],
]){
 const calls=[];const {Repository}=load(async name=>{calls.push(name);return response;});
 await assert.rejects(Repository.getWorkspace(partner,target,from,to),label);
 assert.deepEqual(calls,[newRpc]);pass(label+' fails closed without fallback or retry');
}
{
 const calls=[],transport=Error('fetch failed');const {Repository}=load(async name=>{calls.push(name);throw transport;});
 await assert.rejects(Repository.getWorkspace(partner,target,from,to),e=>e===transport);
 assert.deepEqual(calls,[newRpc]);pass('transport preserved, no fallback/retry');
}
{
 const calls=[];const {Repository}=load(async name=>{calls.push(name);return name===newRpc?missing():{data:fixture('rooms_v2',false),error:null};});
 await assert.rejects(Repository.getWorkspace(partner,target,from,to),/legacy\/public/);
 assert.deepEqual(calls,[newRpc,oldRpc]);pass('legacy compatibility cannot accept rooms_v2');
}
{
 const calls=[];const {Repository}=load(async name=>{calls.push(name);return {data:fixture('rooms_v2'),error:null};});
 await assert.rejects(Repository.getWorkspace(partner,target,'not-a-date',to));assert.deepEqual(calls,[]);pass('invalid request never reaches RPC');
}
console.log('PARTNER_114489_CLIENT_TESTS='+passed+'/'+passed+' PASS');
