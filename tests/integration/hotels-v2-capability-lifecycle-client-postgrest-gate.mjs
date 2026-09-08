// Safe reads from the synthetic loopback fixture, then real source/dist parsers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {TOKENS} from './hotels-v2-h3-2a-partner-access-auth.mjs';
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca',partner='20000000-0000-4000-8000-000000000001';
async function get(name,args,token){
 const r=await fetch(`http://127.0.0.1:53079/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
 body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,name);return r.json();
}
const lifecycle=await get('hotel_v2_admin_get_capability_lifecycle',{},TOKENS.admin);
const pricing=await get('hotel_v2_admin_get_pricing_control',{p_hotel_id:hotel},TOKENS.admin);
const from=new Date().toISOString().slice(0,10),to=new Date(Date.now()+86400000).toISOString().slice(0,10);
const workspace=await get('hotel_v2_partner_get_workspace',{p_partner_id:partner,p_hotel_id:hotel,p_from:from,p_to:to},TOKENS.owner);
let parsed=0;
for(const prefix of ['', 'dist/']){
 const root={console,TextEncoder,URL}; root.window=root; root.globalThis=root;
 for(const file of ['admin/hotels-v2-workspace-core.js','js/hotels-v2-partner-workspace-core.js'])
  vm.runInNewContext(fs.readFileSync(prefix+file,'utf8'),root,{filename:prefix+file});
 root.HotelsV2WorkspaceCore.validateCapabilityLifecycle(lifecycle,null,true);
 // This historical SQL seed already has a different frozen legacy-row hash
 // before 114480. Do not weaken the production client or alter bound SQL rows
 // to disguise it. Validate the new envelope verbatim, and retain the exact
 // expected fail-closed legacy check; accepted-price DTOs are covered in Jest.
 assert.equal(pricing.legacy_safety.legacy_pricing_fingerprint,'5ef5f18181c37ede1619b3a9a89e3915');
 assert.throws(()=>root.HotelsV2WorkspaceCore.validatePricingControl(pricing,hotel),
  /accepted 7 Kamares legacy pricing fingerprint is not intact/);
 root.HotelsV2WorkspaceCore.validateCapabilityLifecycle(pricing.capability_lifecycle,pricing.feature_flags);
 root.HotelsV2PartnerWorkspaceCore.validateWorkspace(workspace,{partnerId:partner,hotelId:hotel});
 parsed+=3;
}
console.log(JSON.stringify({sentinel:'HOTELS_CAPABILITY_REAL_DTO_SOURCE_DIST_PASS',parsed_contracts:parsed,
 reads:3,mutations:0,public_booking:lifecycle.public_booking_enabled,
 pricing_fixture_legacy_pin:'EXPECTED_PREEXISTING_FIXTURE_DIFFERENCE_REJECTED',private_payloads_returned:false}));
