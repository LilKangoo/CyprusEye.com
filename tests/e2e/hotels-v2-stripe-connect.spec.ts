import { test, expect, Page } from '@playwright/test';

const scope='partner=20000000-0000-4000-8000-000000000001&hotel=9b6d99a0-923a-4fbc-be54-c066e856e6ca';
async function mock(page: Page, status: string, options: { fail?: boolean; malformed?: boolean } = {}) {
  // No external SDK, auth call or Stripe request: exact public SDK surface only.
  await page.route('**/js/supabaseClient.js', route => route.fulfill({ contentType:'application/javascript', body:`
    window.__connectCalls=[];
    export const supabase={auth:{getUser:async()=>({data:{user:{id:'synthetic'}}})},functions:{invoke:async(name,{body})=>{
      window.__connectCalls.push(body);
      if(location.pathname.endsWith('return.html') && location.search) throw Error('callback_not_scrubbed');
      ${options.fail ? "return {error:{message:'private_error'}};" : ''}
      if(body.action==='begin') return {data:{contract_version:'hotels_partner_stripe_connect_begin_v1',authorization_url:'https://evil.invalid/'}};
      return {data:{contract_version:'hotels_partner_stripe_connect_v1',status:${JSON.stringify(status)},checked_at:null${options.malformed ? ',account_id:"acct_private"' : ''}}};
    }}};
  ` }));
  await page.route('https://**', route => route.abort());
}
for (const status of ['NOT_CONNECTED','ONBOARDING_INCOMPLETE','CONNECTED','RESTRICTED','ACTION_REQUIRED','DISABLED']) {
  test(`Stripe ${status}: only verified server status; no implicit mutation`, async ({page}) => {
    await mock(page,status);await page.goto(`/partners/stripe-connect.html?${scope}`);
    await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state',status);
    expect(await page.evaluate(()=>(window as any).__connectCalls.map((r:any)=>r.action))).toEqual(['status']);
    if(status==='DISABLED') { await expect(page.locator('[data-stripe-begin]')).toBeHidden(); await expect(page.locator('[data-stripe-refresh]')).toBeHidden(); }
    if(status==='CONNECTED') await expect(page.locator('[data-stripe-begin]')).toBeHidden();
  });
}
test('callback scrubbed before SDK import, completes once and cannot replay on reload',async({page})=>{
  await mock(page,'CONNECTED');
  await page.goto('/partners/stripe-connect-return.html?code=ac_Synthetic&state='+ 'a'.repeat(64));
  await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state','CONNECTED');
  expect(new URL(page.url()).search).toBe('');
  expect(await page.evaluate(()=>(window as any).__connectCalls.map((r:any)=>r.action))).toEqual(['complete']);
  await expect(page.locator('body')).not.toContainText('ac_Synthetic');
  await page.reload();await expect(page.locator('[data-stripe-status]')).toContainText('could not be verified');
  expect(await page.evaluate(()=>(window as any).__connectCalls)).toEqual([]);
});
test('no open redirect and no automatic begin retry',async({page})=>{
  await mock(page,'NOT_CONNECTED');await page.goto(`/partners/stripe-connect.html?${scope}`);
  await page.locator('[data-stripe-begin]').click();
  await expect(page.locator('[data-stripe-status]')).toContainText('could not be verified');
  expect(new URL(page.url()).pathname).toBe('/partners/stripe-connect.html');
  expect(await page.evaluate(()=>(window as any).__connectCalls.map((r:any)=>r.action))).toEqual(['status','begin']);
});
for(const options of [{fail:true},{malformed:true}]) test(`Stripe failed/malformed response fails closed ${JSON.stringify(options)}`,async({page})=>{
  await mock(page,'CONNECTED',options);await page.goto(`/partners/stripe-connect.html?${scope}`);
  await expect(page.locator('[data-stripe-status]')).toContainText('could not be verified');
  await expect(page.locator('[data-stripe-begin]')).toBeHidden();
  await expect(page.locator('body')).not.toContainText('acct_private');
  await expect(page.locator('body')).not.toContainText('private_error');
});
for(const lang of ['en','pl','he']) test(`Stripe mobile ${lang}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await mock(page,'DISABLED');
  await page.goto(`/partners/stripe-connect.html?${scope}&lang=${lang}`);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('html')).toHaveAttribute('dir',lang==='he'?'rtl':'ltr');
  await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state','DISABLED');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
