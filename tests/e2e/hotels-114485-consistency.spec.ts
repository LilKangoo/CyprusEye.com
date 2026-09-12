import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {content114485,HOTEL_114485} from '../fixtures/hotels-114485-content';
test('Admin successor content DTO and amenities Review stay read-only in Chromium',async({page})=>{
  await page.route('**/*',route=>route.abort());
  await page.setContent('<main id="review"></main>');
  for(const f of ['core','repository','']){
    let source=fs.readFileSync('admin/hotels-v2-workspace'+(f?'-'+f:'')+'.js','utf8');
    if(!f)source=source.replace('    state,\n    init,','    renderPartnerPropertyProposalPanel,\n    state,\n    init,');
    await page.addScriptTag({content:source});
  }
  const dto=content114485({HOTEL_PARTNER_CAPABILITIES:await page.evaluate(()=>(window as any).HotelsV2WorkspaceCore.HOTEL_PARTNER_CAPABILITIES)});
  await page.evaluate(async({dto,id})=>{
    const w=window as any;w.calls=[];
    w.getSupabase=()=>({rpc:async(name:string)=>{w.calls.push(name);return{data:dto,error:null};}});
    // 114485 is the frozen PRE-Stripe read contract; current Repository targets
    // 114487 and must not silently accept an old DTO as its successor response.
    w.result=w.HotelsV2WorkspaceCore.validatePartnerHotelPermissions(dto.assignment_snapshot,id,{contentReadOnly:true});
    const stripeOn=structuredClone(dto.assignment_snapshot);
    stripeOn.feature_flags.hotel_stripe_connect_enabled=true;
    try { w.HotelsV2WorkspaceCore.validatePartnerHotelPermissions(stripeOn,id,{contentReadOnly:true}); throw Error('old contract accepted Stripe ON'); }
    catch(error:any) { if(!error.message.includes('flags OFF')) throw error; }
    const property={id,title_i18n:{en:'7 Arches'},amenities:Array.from({length:19},(_,i)=>'amenity_'+i)};
    const proposal={id:'85000000-0000-4000-8000-000000000001',version:1,source_property_updated_at:dto.property_updated_at,
      content:{title_i18n:{en:'7 Arches TEST'},amenities:[...property.amenities].reverse()},photos:{}};
    w.property=property;w.proposal=proposal;w.original=JSON.stringify(property);
    const api=w.HotelsV2Workspace;api.state.workspace={property};
    api.state.partnerPropertyProposals={property_updated_at:dto.property_updated_at,proposals:[proposal]};
    document.getElementById('review')!.innerHTML=api.renderPartnerPropertyProposalPanel(property);
  },{dto,id:HOTEL_114485});
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('7 Arches TEST');
  await expect(page.locator('tbody')).not.toContainText('amenity_');
  for(const action of ['add','remove']){
    await page.evaluate(action=>{
      const w=window as any;w.proposal.content.amenities=action==='add'?[...w.property.amenities,'extra']:w.property.amenities.slice(1);
      document.getElementById('review')!.innerHTML=w.HotelsV2Workspace.renderPartnerPropertyProposalPanel(w.property);
    },action);
    await expect(page.locator('tbody tr')).toHaveCount(2);
  }
  expect(await page.evaluate(()=>{const w=window as any;return{calls:w.calls,unchanged:JSON.stringify(w.property)===w.original,flags:w.result.feature_flags};})).toEqual({
    calls:[],unchanged:true,flags:dto.feature_flags,
  });
});
