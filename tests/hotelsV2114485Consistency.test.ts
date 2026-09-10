import fs from 'node:fs';
import vm from 'node:vm';
import {content114485, HOTEL_114485} from './fixtures/hotels-114485-content';
function harness(): any {
  const c: any = {console, URL, TextEncoder}; c.window=c;c.globalThis=c;
  for(const f of ['core','repository','']){
    const path='admin/hotels-v2-workspace'+(f?'-'+f:'')+'.js';
    let source=fs.readFileSync(path,'utf8');
    if(!f)source=source.replace('    state,\n    init,','    partnerPropertyProposalDiff,\n    renderPartnerPropertyProposalPanel,\n    state,\n    init,');
    vm.runInNewContext(source,c);
  }
  c.dto=content114485(c.HotelsV2WorkspaceCore);c.calls=[];
  c.getSupabase=()=>({rpc:async(name: string)=>{c.calls.push(name);return {data:c.dto,error:null};}});
  return c;
}
test('114485 content read accepts exact successor flags; default write validator stays closed',async()=>{
  const c=harness();
  const result=await c.HotelsV2WorkspaceRepository.getContentControl(HOTEL_114485);
  expect(result.feature_flags).toEqual(c.dto.feature_flags);
  expect(c.calls).toEqual(['hotel_v2_admin_get_content_control_114485']);
  expect(()=>c.HotelsV2WorkspaceCore.validatePartnerHotelPermissions(c.dto.assignment_snapshot,HOTEL_114485)).toThrow(/flags OFF/);
});
for(const field of ['hotel_rooms_v2_enabled','hotel_external_sync_enabled','hotel_instant_booking_enabled','hotel_stripe_connect_enabled']){
  for(const value of [null,'false',undefined])test(`${field} rejects ${String(value)}`,async()=>{
    const c=harness();c.dto.feature_flags[field]=value;
    await expect(c.HotelsV2WorkspaceRepository.getContentControl(HOTEL_114485)).rejects.toThrow();
  });
}
for(const flag of ['hotel_instant_booking_enabled','hotel_stripe_connect_enabled'])test(`${flag} enabled fails closed`,async()=>{
  const c=harness();c.dto.feature_flags[flag]=true;
  await expect(c.HotelsV2WorkspaceRepository.getContentControl(HOTEL_114485)).rejects.toThrow();
});
test('cross-envelope flag drift and foreign Hotel still fail closed',async()=>{
  const c=harness();c.dto.assignment_snapshot.feature_flags.hotel_rooms_v2_enabled=false;
  await expect(c.HotelsV2WorkspaceRepository.getContentControl(HOTEL_114485)).rejects.toThrow(/inconsistent/);
  c.dto.hotel_id='85000000-0000-4000-8000-000000000999';
  await expect(c.HotelsV2WorkspaceRepository.getContentControl(HOTEL_114485)).rejects.toThrow();
});
test('19 amenities compare as a set only for Review; title diff retained, arrays untouched',()=>{
  const c=harness(), api=c.HotelsV2Workspace;
  const property={id:HOTEL_114485,title_i18n:{en:'7 Arches'},amenities:Array.from({length:19},(_,i)=>'amenity_'+i)};
  const proposal={content:{title_i18n:{en:'7 Arches TEST'},amenities:[...property.amenities].reverse()},photos:{}};
  const before=JSON.stringify({property,proposal});
  expect(api.partnerPropertyProposalDiff(proposal,property).map((r:any)=>r.field)).toEqual(['title_i18n']);
  expect(JSON.stringify({property,proposal})).toBe(before);
  proposal.content.amenities.push('extra');
  expect(api.partnerPropertyProposalDiff(proposal,property).map((r:any)=>r.field)).toContain('amenities');
  proposal.content.amenities=property.amenities.slice(1);
  expect(api.partnerPropertyProposalDiff(proposal,property).map((r:any)=>r.field)).toContain('amenities');
});
test('foundation flags validate discovery, not operational workspace gating',()=>{
  const s=fs.readFileSync('js/partners.js','utf8');
  expect(s).toContain('source.foundation_only !== true || source.workspace_available !== false');
  const renderer=s.slice(s.indexOf('  function renderAssignedHotels()'),s.indexOf('  async function refreshAssignedHotels()'));
  expect(renderer).not.toContain('workspace_available');
  expect(renderer).toContain('HotelsV2PartnerWorkspace.open');
});
