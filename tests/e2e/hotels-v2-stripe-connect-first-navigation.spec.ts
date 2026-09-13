import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';

// Real HTTP navigation and the real registered SW, NOT Playwright routing:
// page.route/context.route would disable HTTP cache and hide this failure mode.
test.use({ serviceWorkers: 'allow' });
const ROOT = process.cwd();
const CSS_PATH = '/partners/hotels-v2-workspace.css';
const STRIPE_PATH = '/partners/stripe-connect';
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const currentCss = readFileSync(path.join(ROOT, CSS_PATH));
const stripeHtml = readFileSync(path.join(ROOT, 'partners/stripe-connect.html'));

// Reuse ONLY the synthetic data initializer, never its page.setContent harness.
// Portal HTML, styles, script tags, workspace renderer and PWA boot remain real.
const source = ts.createSourceFile('partner-fixture.ts', readFileSync(path.join(ROOT,
  'tests/e2e/partner-hotels-v2-h3-2b-workspace.spec.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
let initializer: ts.CallExpression | undefined;
function findInitializer(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'page.evaluate'
      && node.arguments[0]?.getText(source).includes('root.__h32b = store;')) initializer = node;
  ts.forEachChild(node, findInitializer);
}
findInitializer(source);
if (!initializer) throw new Error('Review synthetic workspace fixture initializer');
const fixtureCode = ts.transpileModule([
  ...source.statements.filter(ts.isVariableStatement).map(node => node.getText(source)),
  'const options = { commercialOwnerPreset: true };',
  `exports.args = ${initializer.arguments[1].getText(source)};`,
  `exports.initialize = ${initializer.arguments[0].getText(source)};`,
].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const fixture: { args?: any; initialize?: (args: any) => void } = {};
new Function('exports', fixtureCode)(fixture);

async function localServer(cssDelay = 0) {
  const requests: { pathname: string; search: string; method: string; status: number; hash?: string }[] = [];
  const actions: any[] = [];
  // Authentication and unrelated CRM boot are stubbed at the HTTP server, not
  // by replacing the document, stylesheet or SW. No production SDK is loaded.
  const stubScripts = new Set(['/js/auth.js', '/js/authUi.js', '/assets/js/modal-auth.js', '/js/partners.js']);
  const sdk = `export const supabase = {
    auth: { getUser: async () => ({data:{user:{id:'offline-first-navigation-partner'}}}) },
    functions: { invoke: async (name, {body}) => {
      if(name !== 'hotels-stripe-connect') throw Error('unexpected_function');
      const response = await fetch('/__stripe_status_fixture__', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      return response.json();
    } }
  }; window.supabase = supabase; window.getSupabase = () => supabase;`;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    // An additional restrictive CSP intersects the committed Portal CSP. This
    // blocks external analytics, fonts, images and all external connect traffic.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'");
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    let body: Buffer | string = '';
    let type = 'application/javascript';
    if (url.pathname === '/__stripe_status_fixture__') {
      for await (const chunk of req) body += chunk.toString();
      const action = JSON.parse(String(body)); actions.push(action);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      if (action.action !== 'status') { res.writeHead(400); res.end(JSON.stringify({error:{message:'mutation_forbidden'}})); return; }
      res.end(JSON.stringify({data:{contract_version:'hotels_partner_stripe_connect_v1',status:'NOT_CONNECTED',checked_at:null}}));
      return;
    }
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/js/supabaseClient.js') body = sdk;
    else if (stubScripts.has(url.pathname)) body = '// Offline authentication/CRM boundary only.';
    else {
      const relative = url.pathname === '/partners/' ? 'partners/index.html'
        : url.pathname === STRIPE_PATH ? 'partners/stripe-connect.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file = path.resolve(ROOT, relative);
      if (!file.startsWith(ROOT + path.sep) || !/^(partners|js|assets|css|admin)\//.test(relative)
          || !existsSync(file) || !statSync(file).isFile() || !/\.(html|js|css|svg|png|webp|jpg|jpeg|ico|json|webmanifest|woff2?)$/.test(relative)) {
        requests.push({pathname:url.pathname,search:url.search,method:'GET',status:404}); res.writeHead(404); res.end(); return;
      }
      body = readFileSync(file);
      type = ({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml',
        '.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'} as Record<string,string>)[path.extname(file)] || 'application/octet-stream';
      if (/stripe-connect(?:-return)?(?:\.html)?$/.test(url.pathname)) {
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
      }
      if (url.pathname === '/partners/sw.js') res.setHeader('Service-Worker-Allowed', '/partners/');
      if (url.pathname === CSS_PATH && !url.search && cssDelay) await new Promise(resolve => setTimeout(resolve, cssDelay));
    }
    res.setHeader('Content-Type', `${type}; charset=utf-8`);
    const digest = sha(body); res.setHeader('ETag', `"${digest}"`);
    const status = req.headers['if-none-match'] === `"${digest}"` ? 304 : 200;
    requests.push({pathname:url.pathname,search:url.search,method:'GET',status,hash:digest});
    res.writeHead(status); res.end(status === 304 ? undefined : body);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No loopback server');
  return { origin:`http://127.0.0.1:${address.port}`, requests, actions,
    close:async () => { server.closeAllConnections(); await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); } };
}

async function preparePortal(context: BrowserContext, page: Page, origin: string) {
  expect(await context.cookies()).toEqual([]);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache'); // Clear once; never disable cache.
  await cdp.detach();
  await context.addInitScript(() => {
    const root = window as any;
    root.__storageAtEntry = {cookies:document.cookie,local:localStorage.length,session:sessionStorage.length};
    root.__cacheAtEntry = caches.keys();
    document.addEventListener('DOMContentLoaded', () => {
      if (location.pathname !== '/partners/stripe-connect') return;
      const href = new URL('/partners/hotels-v2-workspace.css', location.origin).href;
      const sheet = [...document.styleSheets].find(s => s.href === href);
      root.__stripeFirstDom = { background:getComputedStyle(document.body).backgroundColor,
        cssRules:sheet?.cssRules.length || 0, cssEnd:performance.getEntriesByName(href).at(-1)?.responseEnd || 0,
        dcl:performance.now(), grid:getComputedStyle(document.querySelector('.partner-stripe-grid')!).display };
    }, {once:true});
  });
  const portal = await page.goto(origin + '/partners/?lang=en');
  expect(portal?.status()).toBe(200);
  expect(sha(await portal!.body())).toBe(sha(readFileSync(path.join(ROOT, 'partners/index.html'))));
  expect(await page.evaluate(() => (window as any).__storageAtEntry)).toEqual({cookies:'',local:0,session:0});
  expect(await page.evaluate(() => (window as any).__cacheAtEntry)).toEqual([]);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');
  await page.evaluate(fixture.initialize!, fixture.args);
  await page.evaluate(async ({partnerId,hotelId,assignmentId}) => {
    const root = window as any, w = root.__h32b.workspace;
    w.feature_flags = {hotel_rooms_v2_enabled:true,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:true};
    w.capability_lifecycle = {contract_version:'hotels_v2_capability_lifecycle_v1',version:6,
      feature_flags:{...w.feature_flags},public_booking_enabled:false,architecture:'legacy',expected_public_change:false,audit_chain_exact:true};
    w.stripe_connection = {contract_version:'hotels_partner_stripe_capability_v1',partner_id:partnerId,hotel_id:hotelId,
      platform_enabled:true,onboarding_authorized:true,account_status:'NOT_CONNECTED',checked_at:null,
      platform_ready:true,attestation_status:'READY',can_connect:true};
    const localImages = (value: any): any => typeof value === 'string' && value.startsWith('https://example.test/')
      ? '/assets/cyprus_logo-128.png' : Array.isArray(value) ? value.map(localImages)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,localImages(v)])) : value;
    root.__h32b.workspace = localImages(w);
    await root.HotelsV2PartnerWorkspace.open({partnerId,assignment:{assignment_id:assignmentId,hotel_id:hotelId}});
  }, fixture.args);
  const direct = page.locator('[data-phw-section="payments"]:visible').first();
  if (await direct.count()) await direct.click();
  else { await page.locator('[data-phw-more]').click(); await page.locator('[data-phw-drawer] [data-phw-section="payments"]').click(); }
  await expect(page.locator('[data-phw-panel="payments"]')).toBeVisible();
  await expect(page.getByRole('link', {name:'Open Stripe Connect'})).toHaveAttribute('href',
    `/partners/stripe-connect?partner=${fixture.args.partnerId}&hotel=${fixture.args.hotelId}&lang=en`);
}

async function cacheEvidence(page: Page) {
  return page.evaluate(async () => {
    const rows: {cache:string;url:string;sha:string}[]=[];
    for (const key of await caches.keys()) {
      const cache=await caches.open(key);
      for (const request of await cache.keys()) {
        if (!/stripe-connect|hotels-v2-workspace\.css/.test(request.url)) continue;
        const response=await cache.match(request);
        const digest=await crypto.subtle.digest('SHA-256',await response!.arrayBuffer());
        rows.push({cache:key,url:request.url,sha:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')});
      }
    }
    return rows;
  });
}

async function expectStyled(page: Page) {
  const first=await page.evaluate(() => (window as any).__stripeFirstDom);
  expect(first.background).toBe('rgb(9, 13, 24)'); expect(first.grid).toBe('grid');
  expect(first.cssRules).toBeGreaterThan(0); expect(first.cssEnd).toBeGreaterThan(0);
  expect(first.cssEnd).toBeLessThanOrEqual(first.dcl);
  // Paint entry delivery can follow load. Even when CSS is deliberately slow,
  // the real head stylesheet must finish before the first contentful paint.
  await expect.poll(() => page.evaluate(() =>
    performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0)).toBeGreaterThan(0);
  const firstContentfulPaint = await page.evaluate(() =>
    performance.getEntriesByName('first-contentful-paint')[0].startTime);
  expect(first.cssEnd).toBeLessThanOrEqual(firstContentfulPaint);
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(9, 13, 24)');
  await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href',CSS_PATH);
  await expect(page.locator('.partner-stripe-topbar')).toBeVisible();
  await expect(page.locator('.partner-stripe-account')).toHaveCSS('border-radius','18px');
  await expect(page.locator('.partner-stripe-account')).toBeVisible();
  const logo=page.getByRole('img',{name:'Stripe',exact:true}); await expect(logo).toBeVisible();
  await expect.poll(()=>logo.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
  await expect(page.getByRole('button',{name:'Connect Stripe',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Refresh status',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Back to Partner portal'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  return { ...first, firstContentfulPaint };
}

for (const scenario of [
  {name:'desktop',viewport:{width:1440,height:1000},delay:0},
  {name:'mobile',viewport:{width:390,height:844},delay:0},
  {name:'delayed-css',viewport:{width:1440,height:1000},delay:400},
]) test(`fresh SW-enabled Portal Payments first navigation and reload are styled: ${scenario.name}`, async ({browser},testInfo)=>{
  const server=await localServer(scenario.delay);
  const context=await browser.newContext({serviceWorkers:'allow',viewport:scenario.viewport,locale:'en-US'});
  const page=await context.newPage();
  const responses: {url:string;status:number;type:string;sw:boolean;sha:string}[]=[];
  const pending: Promise<void>[]=[];
  page.on('response',response=>{
    const url=new URL(response.url());
    if (url.pathname===CSS_PATH && !url.search || url.pathname===STRIPE_PATH) pending.push((async()=>{
      responses.push({url:response.url(),status:response.status(),type:response.headers()['content-type'],sw:response.fromServiceWorker(),sha:sha(await response.body())});
    })());
  });
  try {
    await preparePortal(context,page,server.origin);
    const before=await cacheEvidence(page); expect(before.filter(row=>new URL(row.url).pathname===STRIPE_PATH)).toEqual([]);
    expect(before.filter(row=>row.url===server.origin+CSS_PATH)).toEqual([]);
    await page.getByRole('link',{name:'Open Stripe Connect'}).click();
    await page.waitForURL(server.origin+STRIPE_PATH+'?**',{waitUntil:'load'});
    const first=await expectStyled(page);
    await page.screenshot({path:testInfo.outputPath('first-navigation.png'),fullPage:true});
    const firstCache=await cacheEvidence(page);
    await page.reload({waitUntil:'load'}); const reload=await expectStyled(page);
    await Promise.all(pending);
    expect(responses.filter(row=>new URL(row.url).pathname===STRIPE_PATH)).toHaveLength(2);
    for(const row of responses) {
      expect(row.status).toBe(200);
      if(new URL(row.url).pathname===STRIPE_PATH){expect(row.sha).toBe(sha(stripeHtml));expect(row.sw).toBe(false);}
      else {expect(row.sha).toBe(sha(currentCss));expect(row.type).toContain('text/css');expect(row.sw).toBe(true);}
    }
    expect(server.actions.map(row=>row.action)).toEqual(['status','status']);
    expect((await cacheEvidence(page)).some(row=>new URL(row.url).pathname===STRIPE_PATH)).toBe(false);
    console.log(JSON.stringify({scenario:scenario.name,firstNavigation:'PASS',reload:'PASS',swController:true,first,reloadEvidence:reload,beforeCache:before,firstCache,responses,actions:server.actions.map(row=>row.action)}));
  } finally {await context.close();await server.close();}
});

test('controlled stale CSS cache explains unstyled-first/styled-reload without changing current runtime',async({browser},testInfo)=>{
  const server=await localServer(250);
  const context=await browser.newContext({serviceWorkers:'allow',viewport:{width:1440,height:1000},locale:'en-US'});
  const page=await context.newPage();
  try {
    await preparePortal(context,page,server.origin);
    // Synthetic obsolete response, NOT claimed to be the historical user's CSS.
    // It models an old stylesheet that lacks the newly added standalone selectors.
    const staleCss='/* deliberately obsolete local cache fixture: no Stripe page selectors */';
    await page.evaluate(async({cssPath,staleCss})=>{
      const key=(await caches.keys()).find(key=>key.startsWith('ce-partners-pwa-'))!;
      await (await caches.open(key)).put(cssPath,new Response(staleCss,{headers:{'Content-Type':'text/css'}}));
    },{cssPath:CSS_PATH,staleCss});
    const cssResponse=page.waitForResponse(response=>response.url()===server.origin+CSS_PATH);
    await page.getByRole('link',{name:'Open Stripe Connect'}).click();
    await page.waitForURL(server.origin+STRIPE_PATH+'?**',{waitUntil:'load'});
    const staleResponse=await cssResponse;
    expect(staleResponse.fromServiceWorker()).toBe(true);
    expect(sha(await staleResponse.body())).toBe(sha(staleCss));
    const first=await page.evaluate(()=>(window as any).__stripeFirstDom);
    expect(first.background).not.toBe('rgb(9, 13, 24)');expect(first.grid).not.toBe('grid');
    await expect.poll(async()=> (await cacheEvidence(page)).find(row=>row.url===server.origin+CSS_PATH)?.sha).toBe(sha(currentCss));
    // Revalidation updates cache only, not the already-rendered document.
    await expect(page.locator('body')).not.toHaveCSS('background-color','rgb(9, 13, 24)');
    await page.reload({waitUntil:'load'}); await expectStyled(page);
    expect(server.actions.map(row=>row.action)).toEqual(['status','status']);
    await page.screenshot({path:testInfo.outputPath('stale-cache-reload.png'),fullPage:true});
    console.log(JSON.stringify({controlledStaleCache:'REPRODUCED',freshRuntimeBug:false,historicalClientCache:'NOT_INSPECTED',currentHtmlUnchanged:true,staleCssSha:sha(staleCss),currentCssSha:sha(currentCss)}));
  } finally {await context.close();await server.close();}
});
