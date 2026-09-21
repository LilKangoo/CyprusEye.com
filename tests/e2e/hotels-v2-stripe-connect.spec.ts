import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ serviceWorkers: 'block' });
const escapedResponses = new WeakMap<Page, string[]>();
test.afterEach(async ({page}) => {
  expect(escapedResponses.get(page) || [], 'Every HTTPS response must come from an offline fixture').toEqual([]);
});
const scope='partner=20000000-0000-4000-8000-000000000001&hotel=9b6d99a0-923a-4fbc-be54-c066e856e6ca';
async function mock(page: Page, status: string, options: { fail?: boolean; malformed?: boolean; productionOrigins?: boolean; authorizationUrl?: string } = {}) {
  // No external SDK, auth call or Stripe request: exact public SDK surface only.
  const actions: string[] = [];
  const imports: string[] = [];
  const escaped: string[] = [];
  escapedResponses.set(page, escaped);
  page.on('response', response => {
    if (response.url().startsWith('https://') && response.headers()['x-hotels-offline-fixture'] !== '1') escaped.push(new URL(response.url()).origin);
  });
  await page.exposeFunction('recordSyntheticConnectAction', (action: string) => actions.push(action));
  await page.exposeFunction('recordSyntheticConnectImport', (origin: string) => imports.push(origin));
  // Production hostnames are fulfilled entirely from local files: no DNS,
  // production server, Stripe API or remote Supabase SDK is contacted.
  await page.route(/^https:\/\//, route => {
    const url = new URL(route.request().url());
    const sources: Record<string, [string, string]> = {
      '/partners/stripe-connect.html': ['partners/stripe-connect.html','text/html'],
      '/partners/stripe-connect': ['partners/stripe-connect.html','text/html'],
      '/partners/stripe-connect-return.html': ['partners/stripe-connect-return.html','text/html'],
      '/partners/stripe-connect-return': ['partners/stripe-connect-return.html','text/html'],
      '/js/hotels-stripe-connect-page.js': ['js/hotels-stripe-connect-page.js','application/javascript'],
      '/partners/hotels-v2-workspace.css': ['partners/hotels-v2-workspace.css','text/css'],
    };
    const source = sources[url.pathname];
    if (!options.productionOrigins || !['https://cypruseye.com','https://www.cypruseye.com'].includes(url.origin) || !source) return route.abort();
    const body = readFileSync(source[0],'utf8');
    if (source[0] === 'js/hotels-stripe-connect-page.js') expect(body, `Fixture cwd: ${process.cwd()}`).toContain('async function connectOnCurrentOrigin()');
    return route.fulfill({contentType:source[1],headers:{'x-hotels-offline-fixture':'1'},body});
  });
  await page.route('**/js/supabaseClient.js', route => route.fulfill({ contentType:'application/javascript', headers:{'x-hotels-offline-fixture':'1'}, body:`
    if(['/partners/stripe-connect-return.html','/partners/stripe-connect-return'].includes(location.pathname) && location.search) {
      throw Error('callback_not_scrubbed');
    }
    await window.recordSyntheticConnectImport(location.origin);
    window.__sdkImportSearch=location.search;
    window.__connectCalls=[];
    export const supabase={auth:{getUser:async()=>({data:{user:{id:'synthetic'}}})},functions:{invoke:async(name,{body})=>{
      window.__connectCalls.push(body);
      await window.recordSyntheticConnectAction(body.action);
      ${options.fail ? "return {error:{message:'private_error'}};" : ''}
      if(body.action==='begin') return {data:{contract_version:'hotels_partner_stripe_connect_begin_v1',authorization_url:${JSON.stringify(options.authorizationUrl || 'https://evil.invalid/')}}};
      return {data:{contract_version:'hotels_partner_stripe_connect_v1',status:${JSON.stringify(status)},checked_at:null${options.malformed ? ',account_id:"acct_private"' : ''}}};
    }}};
  ` }));
  return { actions, imports };
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
test('extensionless production callback scrubs before SDK import and cannot replay completion',async({page})=>{
  const { actions } = await mock(page,'CONNECTED');
  await page.goto('/partners/stripe-connect-return?code=ac_Synthetic&state='+ 'a'.repeat(64));
  await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state','CONNECTED');
  expect(new URL(page.url()).pathname).toBe('/partners/stripe-connect-return');
  expect(new URL(page.url()).search).toBe('');
  expect(await page.evaluate(()=>(window as any).__sdkImportSearch)).toBe('');
  expect(actions).toEqual(['complete']);
  expect(await page.evaluate(()=>(window as any).__connectCalls.map((r:any)=>r.action))).toEqual(['complete']);
  await expect(page.locator('body')).not.toContainText('ac_Synthetic');
  await page.reload();
  await expect(page.locator('[data-stripe-status]')).toContainText('could not be verified');
  expect(await page.evaluate(()=>(window as any).__connectCalls)).toEqual([]);
  expect(actions).toEqual(['complete']);
});
for (const path of ['/partners/stripe-connect.html','/partners/stripe-connect']) {
  test(`www entry ${path} normalizes to fixed apex before SDK with only allowed parameters`,async({page})=>{
    const { actions, imports } = await mock(page,'NOT_CONNECTED',{productionOrigins:true});
    await page.goto(`https://www.cypruseye.com${path}?${scope}&lang=he&next=https://evil.invalid&redirect_uri=https://evil.invalid&code=ac_DoNotForward&state=${'b'.repeat(64)}#private_fragment`);
    await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state','NOT_CONNECTED');
    const url = new URL(page.url());
    expect(url.origin).toBe('https://cypruseye.com');
    expect(url.pathname).toBe('/partners/stripe-connect.html');
    expect(Array.from(url.searchParams.keys()).sort()).toEqual(['hotel','lang','partner']);
    expect(url.searchParams.get('lang')).toBe('he');
    expect(url.hash).toBe('');
    expect(imports).toEqual(['https://cypruseye.com']);
    expect(actions).toEqual(['status']);
  });
}
for (const path of ['/partners/stripe-connect-return.html','/partners/stripe-connect-return']) {
  test(`apex callback ${path} completes once after scrub; no cross-origin forwarding`,async({page})=>{
    const { actions, imports } = await mock(page,'CONNECTED',{productionOrigins:true});
    await page.goto(`https://cypruseye.com${path}?code=ac_Synthetic&state=${'a'.repeat(64)}`);
    await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state','CONNECTED');
    expect(page.url()).toBe(`https://cypruseye.com${path}`);
    expect(imports).toEqual(['https://cypruseye.com']);
    expect(actions).toEqual(['complete']);
    await page.reload();
    await expect(page.locator('[data-stripe-status]')).toContainText('could not be verified');
    expect(actions).toEqual(['complete']);
  });
  test(`noncanonical callback ${path} scrubs and fails closed before SDK`,async({page})=>{
    const { actions, imports } = await mock(page,'CONNECTED',{productionOrigins:true});
    await page.goto(`https://www.cypruseye.com${path}?code=ac_Synthetic&state=${'a'.repeat(64)}`);
    await expect(page.locator('[data-stripe-status]')).toContainText('could not be verified');
    expect(page.url()).toBe(`https://www.cypruseye.com${path}`);
    expect(imports).toEqual([]);
    expect(actions).toEqual([]);
    await expect(page.locator('body')).not.toContainText('ac_Synthetic');
  });
}
test('apex begin still rejects a Stripe URL with the wrong callback origin',async({page})=>{
  const { actions } = await mock(page,'NOT_CONNECTED',{productionOrigins:true,
    authorizationUrl:'https://connect.stripe.com/oauth/authorize?redirect_uri='+encodeURIComponent('https://www.cypruseye.com/partners/stripe-connect-return.html')});
  await page.goto(`https://cypruseye.com/partners/stripe-connect?${scope}`);
  await page.locator('[data-stripe-begin]').click();
  await expect(page.locator('[data-stripe-status]')).toContainText('could not be verified');
  expect(new URL(page.url()).origin).toBe('https://cypruseye.com');
  expect(actions).toEqual(['status','begin']);
});
test('www entry can begin once with the exact apex callback; Stripe navigation is mocked',async({page})=>{
  const authorizationUrl = 'https://connect.stripe.com/oauth/authorize?response_type=code&client_id=ca_Synthetic&scope=read_write&state='+ 'a'.repeat(64)
    +'&redirect_uri='+encodeURIComponent('https://cypruseye.com/partners/stripe-connect-return.html');
  const { actions, imports } = await mock(page,'NOT_CONNECTED',{productionOrigins:true,authorizationUrl});
  const navigations: string[] = [];
  await page.route('https://connect.stripe.com/oauth/authorize?**',route=>{
    navigations.push(route.request().url());
    return route.fulfill({contentType:'text/html',headers:{'x-hotels-offline-fixture':'1'},body:'<!doctype html><title>Synthetic Stripe destination</title>'});
  });
  await page.goto(`https://www.cypruseye.com/partners/stripe-connect?${scope}`);
  await page.locator('[data-stripe-begin]').click();
  await expect(page).toHaveURL(authorizationUrl);
  expect(imports).toEqual(['https://cypruseye.com']);
  expect(actions).toEqual(['status','begin']);
  expect(navigations).toEqual([authorizationUrl]);
});
test('www entry with malformed scope does not redirect, import SDK or invoke Edge',async({page})=>{
  const { actions, imports } = await mock(page,'NOT_CONNECTED',{productionOrigins:true});
  await page.goto('https://www.cypruseye.com/partners/stripe-connect?partner=invalid&hotel=invalid&next=https://evil.invalid');
  await expect(page.locator('[data-stripe-status]')).toContainText('could not be verified');
  expect(new URL(page.url()).origin).toBe('https://www.cypruseye.com');
  expect(actions).toEqual([]);
  expect(imports).toEqual([]);
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
