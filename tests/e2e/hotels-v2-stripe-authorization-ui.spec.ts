import fs from 'node:fs';
import {test,expect} from '@playwright/test';

const partner='0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
test('Admin exact audited grant UI: read, explicit confirm, fresh Get, one Set',async({page})=>{
  await page.route('**/*',route=>route.request().url().endsWith('/stripe-ui-test')
    ? route.fulfill({contentType:'text/html',body:'<main id="test"></main>'}) : route.abort());
  // Loopback is a secure context for the real crypto.randomUUID contract.
  await page.goto('/stripe-ui-test');
  await page.evaluate((id)=>{
    const w=window as any;w.__calls=[];
    w.getSupabase=()=>({rpc:async(name:string,args:any)=>{
      w.__calls.push({name,args});
      if(name==='hotel_v2_admin_get_partner_stripe_onboarding_authorization') return {data:{contract_version:'hotels_v2_partner_stripe_authorization_control_v1',partner_id:id,version:0,enabled:false,platform_enabled:false,account_exists:false,account_status:'NOT_CONNECTED'},error:null};
      if(name==='hotel_v2_admin_get_capability_lifecycle') return {data:{contract_version:'hotels_v2_capability_lifecycle_v1',version:0,feature_flags:{hotel_rooms_v2_enabled:false,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:false},public_booking_enabled:false,architecture:'legacy',expected_public_change:false,audit_chain_exact:true,capabilities:[
        {key:'rooms',enabled:false,blocked_reasons:[],requires_confirmation:true},
        {key:'external',enabled:true,blocked_reasons:['external_calendar_has_separate_reviewed_source_lifecycle'],requires_confirmation:true},
        {key:'stripe',enabled:false,blocked_reasons:['verified_server_configuration_required'],requires_confirmation:true},
        {key:'instant',enabled:false,blocked_reasons:['instant_booking_contract_not_installed'],requires_confirmation:true},
        {key:'public_booking',enabled:false,blocked_reasons:['public_booking_release_contract_not_installed'],requires_confirmation:true},
      ]},error:null};
      if(name==='hotel_v2_admin_set_partner_stripe_onboarding_authorization') return {data:{contract_version:'hotels_v2_partner_stripe_authorization_result_v1',partner_id:id,version:1,current_version:1,enabled:true,current_enabled:true,replayed:false},error:null};
      throw Error('Unapproved RPC '+name);
    }});
  },partner);
  for(const path of ['admin/hotels-v2-workspace-core.js','admin/hotels-v2-workspace-repository.js','admin/hotels-v2-workspace.js']){
    let code=fs.readFileSync(path,'utf8');
    // Test-only access to the real private renderer/binder; no production test hook.
    if(path.endsWith('/hotels-v2-workspace.js')) code=code.replace('  function renderPartnerPanel(panel) {','  root.__stripeCards=stripePartnerCards; root.__stripeBind=bindStripePartnerCards;\n  function renderPartnerPanel(panel) {');
    await page.addScriptTag({content:code});
  }
  await page.evaluate(id=>{const w=window as any,p=document.querySelector('#test')!;p.innerHTML=w.__stripeCards([{partner_id:id}]);w.__stripeBind(p);},partner);
  expect(await page.evaluate(()=>(window as any).__calls.length)).toBe(0);
  await page.getByRole('button',{name:'Load current Stripe authorization'}).click();
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('NOT AUTHORIZED');
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('fresh server verification required');
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('Connected account existsNO');
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('Account statusNOT_CONNECTED');
  expect(await page.evaluate(()=>(window as any).__calls.some((c:any)=>c.name.includes('_set_')))).toBe(false);
  await page.locator('textarea[name="reason"]').fill('Explicit isolated browser test decision');
  await page.locator('input[name="confirmation"]').check();
  await page.getByRole('button',{name:'Confirm authorization',exact:true}).click();
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('granted at version 1');
  const calls=await page.evaluate(()=>(window as any).__calls);
  expect(calls.map((c:any)=>c.name)).toEqual(['hotel_v2_admin_get_partner_stripe_onboarding_authorization','hotel_v2_admin_get_capability_lifecycle','hotel_v2_admin_get_partner_stripe_onboarding_authorization','hotel_v2_admin_set_partner_stripe_onboarding_authorization']);
  expect(calls[3].args.p_partner_id).toBe(partner);
  await expect(page.locator('[data-stripe-authorization-decision]')).toHaveCount(0);
});
