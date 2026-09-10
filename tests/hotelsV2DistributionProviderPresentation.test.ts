import fs from 'node:fs';
import vm from 'node:vm';
function harness(): any {
  const c:any={console,URL,TextEncoder};c.window=c;c.globalThis=c;
  for(const part of ['core','repository','']){
    let source=fs.readFileSync('admin/hotels-v2-workspace'+(part?'-'+part:'')+'.js','utf8');
    if(!part)source=source.replace('    state,\n    init,','    renderDistributionPanel,\n    state,\n    init,');
    vm.runInNewContext(source,c);
  }
  const api=c.HotelsV2Workspace;
  const flags={hotel_rooms_v2_enabled:true,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:false};
  api.state.workspace={property:{id:'11111111-1111-4111-8111-111111111111'},flags};
  api.state.capabilityLifecycle={contract_version:'hotels_v2_capability_lifecycle_v1',version:1,
    feature_flags:{...flags},public_booking_enabled:false,architecture:'legacy',expected_public_change:false,audit_chain_exact:true,
    capabilities:['rooms','external','stripe','instant','public_booking'].map(key=>({key,enabled:['rooms','external'].includes(key),blocked_reasons:['stage_controlled'],requires_confirmation:true}))};
  api.state.calendar.external_calendar={hotel_id:api.state.workspace.property.id,hotel_external_sync_enabled:true,
    provider_capability:{stage:'provider_types_active',activation_available:true},sources:[]};
  c.getSupabase=()=>{throw new Error('Distribution must not call transport');};
  const panel={innerHTML:'',querySelector:()=>null};
  return {state:api.state,render:()=>{api.renderDistributionPanel(panel);return panel.innerHTML;}};
}
test('audited Rooms/external ON are not unexpected; no sources means no configured source',()=>{
  const h=harness(),before=JSON.stringify(h.state),html=h.render();
  expect(html).toContain('Audited global capabilities');
  expect(html).toContain('Rooms V2 backend capability</span><strong>ON');
  expect(html).toContain('External Calendar capability</span><strong>ON');
  for(const label of ['Instant booking','Stripe Connect','Public booking'])expect(html).toContain(label+'</span><strong>OFF');
  expect(html).toContain('No external provider source configured.');
  expect(html).not.toMatch(/ON — unexpected|must remain off|providers remain inert/);
  expect(JSON.stringify(h.state)).toBe(before);
});
for(const failure of ['missing','inconsistent','error'])test('unavailable lifecycle is UNKNOWN, not fabricated public OFF: '+failure,()=>{
  const h=harness();
  if(failure==='missing')h.state.capabilityLifecycle=null;
  if(failure==='inconsistent')h.state.capabilityLifecycle.feature_flags.hotel_rooms_v2_enabled=false;
  if(failure==='error')h.state.capabilityLifecycleError=new Error('not current');
  expect(h.render()).toContain('Public booking</span><strong>UNKNOWN');
  expect(h.render()).toContain('audited lifecycle unavailable');
});
for(const failure of ['missing','error','foreign','future'])test('provider unavailable differs from empty source list: '+failure,()=>{
  const h=harness();
  if(failure==='missing')h.state.calendar.external_calendar=null;
  if(failure==='error')h.state.calendar.external_calendar_error=new Error('secret diagnostic must not render');
  if(failure==='foreign')h.state.calendar.external_calendar.hotel_id='foreign';
  if(failure==='future')h.state.calendar.external_calendar.provider_capability.stage='provider_types_unavailable';
  expect(h.render()).toContain('Provider source state is unavailable');
  expect(h.render()).not.toMatch(/No external provider source configured|secret diagnostic/);
});
test('URL missing, ready, blocked and enabled states remain distinct without exposing URLs',()=>{
  const h=harness(),control=h.state.calendar.external_calendar;
  control.sources=[{is_enabled:false,secret_configured:false,review_status:'reviewed'}];
  expect(h.render()).toContain('needs its private export URL');
  control.sources[0].secret_configured=true;
  expect(h.render()).toContain('ready for activation');
  control.provider_capability.activation_available=false;
  expect(h.render()).toContain('Activation still requires current server readiness');
  control.provider_capability.activation_available=true;control.hotel_external_sync_enabled=false;
  expect(h.render()).not.toContain('ready for activation');
  control.hotel_external_sync_enabled=true;control.sources[0].is_enabled=true;
  expect(h.render()).toContain('Check Calendar for its latest sync health');
  expect(h.render()).not.toContain('synchronized successfully');
});
