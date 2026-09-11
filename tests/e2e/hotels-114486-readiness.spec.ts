import fs from 'node:fs';
import {test,expect} from '@playwright/test';

test('Admin 114486 readiness UI: authoritative read, explicit verify, fail closed',async({page})=>{
  await page.route('**/*',route=>route.request().url().endsWith('/readiness-ui-test')
    ? route.fulfill({contentType:'text/html',body:'<main id="test"></main>'})
    : route.abort());

  await page.goto('/readiness-ui-test');

  await page.evaluate(()=>{
    const w=window as any;
    w.__calls=[];
    w.__readinessMode='MISSING';

    const readiness=(state:string)=>{
      if(state==='MISSING') return {
        blocked_reason:'attestation_missing',
        checked_at:null,
        contract_version:'hotels_stripe_platform_readiness_admin_v1',
        expires_at:null,
        observed_at:'2026-09-11T01:00:00.000Z',
        ready:false,
        request_id:null,
        state:'MISSING'
      };

      return {
        blocked_reason:null,
        checked_at:'2026-09-11T00:50:00.000Z',
        contract_version:'hotels_stripe_platform_readiness_admin_v1',
        expires_at:'2026-09-11T01:05:00.000Z',
        observed_at:'2026-09-11T01:00:00.000Z',
        ready:true,
        request_id:'86000000-0000-4000-8000-000000000010',
        state:'READY'
      };
    };

    const lifecycle={
      contract_version:'hotels_v2_capability_lifecycle_v1',
      version:0,
      feature_flags:{
        hotel_rooms_v2_enabled:false,
        hotel_external_sync_enabled:true,
        hotel_instant_booking_enabled:false,
        hotel_stripe_connect_enabled:false
      },
      public_booking_enabled:false,
      architecture:'legacy',
      expected_public_change:false,
      audit_chain_exact:true,
      capabilities:[
        {key:'rooms',enabled:false,blocked_reasons:[],requires_confirmation:true},
        {key:'external',enabled:true,blocked_reasons:['external_calendar_has_separate_reviewed_source_lifecycle'],requires_confirmation:true},
        {key:'stripe',enabled:false,blocked_reasons:[],requires_confirmation:true},
        {key:'instant',enabled:false,blocked_reasons:['instant_booking_contract_not_installed'],requires_confirmation:true},
        {key:'public_booking',enabled:false,blocked_reasons:['public_booking_release_contract_not_installed'],requires_confirmation:true}
      ]
    };

    w.getSupabase=()=>({
      rpc:async(name:string,args:any)=>{
        w.__calls.push({kind:'rpc',name,args});

        if(name==='hotel_v2_admin_get_stripe_platform_readiness_114486'){
          if(w.__readinessMode==='MALFORMED') return {data:{bad:true},error:null};
          return {data:readiness(w.__readinessMode),error:null};
        }

        if(name==='hotel_v2_admin_get_capability_lifecycle')
          return {data:lifecycle,error:null};

        throw Error('Unapproved RPC '+name);
      },
      functions:{
        invoke:async(name:string,options:any)=>{
          w.__calls.push({kind:'function',name,body:options?.body});

          if(name!=='hotels-stripe-connect')
            throw Error('Unapproved Edge function '+name);

          return {
            data:{
              contract_version:'hotels_standard_connect_server_v1',
              configuration_verified:true,
              account_connected:false,
              capability_enabled_by_this_request:false
            },
            error:null
          };
        }
      }
    });
  });

  for(const path of [
    'admin/hotels-v2-workspace-core.js',
    'admin/hotels-v2-workspace-repository.js',
    'admin/hotels-v2-workspace.js'
  ]){
    let code=fs.readFileSync(path,'utf8');

    if(path.endsWith('/hotels-v2-workspace.js')){
      code=code.replace(
        '  function renderPaymentsPanel(panel) {',
        '  root.__readinessCard=stripePlatformReadinessCard; root.__readinessBind=bindStripePlatformReadiness;\n  function renderPaymentsPanel(panel) {'
      );
    }

    await page.addScriptTag({content:code});
  }

  await page.evaluate(()=>{
    const w=window as any;
    const panel=document.querySelector('#test')!;
    panel.innerHTML=w.__readinessCard();
    w.__readinessBind(panel);
  });

  const state=page.locator('[data-stripe-platform-state]');
  const verify=page.locator('[data-stripe-platform-verify]');
  const reload=page.locator('[data-stripe-platform-reload]');

  await expect(state).toContainText('MISSING');
  await expect(verify).toBeEnabled();

  await page.evaluate(()=>((window as any).__readinessMode='READY'));
  await verify.click();

  await expect(state).toContainText('READY');
  await expect(state).toContainText('No account connection, capability grant or payment change');
  await expect(verify).toBeEnabled();

  await page.evaluate(()=>((window as any).__readinessMode='MALFORMED'));
  await reload.click();

  await expect(state).toContainText('Platform readiness unavailable or verification failed');
  await expect(verify).toBeDisabled();
  await expect(reload).toBeEnabled();

  const calls=await page.evaluate(()=>(window as any).__calls);
  expect(calls.map((c:any)=>c.name)).toEqual([
    'hotel_v2_admin_get_stripe_platform_readiness_114486',
    'hotels-stripe-connect',
    'hotel_v2_admin_get_stripe_platform_readiness_114486',
    'hotel_v2_admin_get_capability_lifecycle',
    'hotel_v2_admin_get_stripe_platform_readiness_114486'
  ]);

  expect(calls.some((c:any)=>String(c.name).includes('_set_'))).toBe(false);
});
