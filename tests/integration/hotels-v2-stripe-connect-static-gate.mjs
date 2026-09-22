import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const read=p=>readFileSync(new URL(`../../${p}`,import.meta.url),'utf8');
const sql=read('supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql');
test('post-114450 additive connection schema: no old function rewrite or business activation',()=>{
 assert.match(sql,/^begin;/);assert.match(sql,/commit;\s*$/);
 assert.equal((sql.match(/create function /g)||[]).length,2);
 assert.doesNotMatch(sql,/create or replace|alter role|alter database|update public\.(site_settings|hotel_room_rates|hotel_payment|hotel_commission)/i);
 assert.match(sql,/partner_id uuid primary key/);assert.match(sql,/account_id text not null unique/);
 assert.equal((sql.match(/force row level security/g)||[]).length,3);
 assert.match(sql,/scope\(v_actor,v_partner,v_hotel\)/);
 assert.match(sql,/member.role='owner'/);assert.match(sql,/permission.initiate_stripe_onboarding is true/);
 assert.match(sql,/no_raw_service_access|revoke all on schema hotel_stripe_connect_private/);
});
test('Edge identity/Standard OAuth only, signed webhook and zero network retries',()=>{
 const edge=read('supabase/functions/hotels-stripe-connect/index.ts');
 const service=read('supabase/functions/hotels-stripe-connect/service.mjs');
 assert.match(edge,/db.auth.getUser/);assert.match(edge,/service.request\(data.user.id/);
 assert.match(edge,/constructEventAsync/);assert.match(edge,/STRIPE_CONNECT_WEBHOOK_SECRET/);
 assert.match(edge,/maxNetworkRetries: 0/);assert.match(edge,/origin !== config.origin/);
 assert.match(service,/account.type !== 'standard'/);
 assert.doesNotMatch(edge,/accounts.create|accountLinks.create|paymentIntents.create|transfers.create|payouts.create|application_fee/);
 assert.doesNotMatch(edge,/console\.(log|error)/);
});
test('OAuth callback cannot enter PWA cache and is scrubbed before SDK import',()=>{
 const page=read('js/hotels-stripe-connect-page.js');
 assert.ok(page.indexOf('history.replaceState')<page.indexOf("await import('./supabaseClient.js')"));
 assert.doesNotMatch(page,/localStorage|sessionStorage\.setItem/);
 assert.match(page,/\['\/partners\/stripe-connect-return\.html', '\/partners\/stripe-connect-return'\]\.includes\(location\.pathname\)/);
 assert.doesNotMatch(page,/endsWith\('\/stripe-connect-return\.html'\)/);
 const sw=read('partners/sw.js');
 assert.match(sw,/\/partners\/stripe-connect-return\.html/);
 assert.match(sw,/\/partners\/stripe-connect-return'/);
 assert.match(sw,/\/partners\/stripe-connect\.html/);
 assert.match(sw,/\/partners\/stripe-connect'/);
 const headers=read('_headers');
 for(const path of ['/partners/stripe-connect-return.html','/partners/stripe-connect-return','/partners/stripe-connect.html','/partners/stripe-connect']) {
  const override=`${path}\n  ! Cache-Control\n  ! Referrer-Policy\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer`;
  assert.ok(headers.includes(override));
  assert.ok(headers.indexOf(override)>headers.indexOf('/*.html\n'));
 }
});
test('Connect-only apex normalization preserves strict redirect validation and never ferries OAuth credentials',()=>{
 const page=read('js/hotels-stripe-connect-page.js');
 assert.match(read('js/config.js'),/base: 'https:\/\/cypruseye\.com'/);
 assert.match(page,/location\.origin === 'https:\/\/www\.cypruseye\.com'/);
 assert.match(page,/if \(callback\) throw new Error\('noncanonical_callback'\)/);
 assert.match(page,/new URL\('\/partners\/stripe-connect\.html', 'https:\/\/cypruseye\.com'\)/);
 assert.match(page,/new URLSearchParams\(\{ partner: scope\.partner_id, hotel: scope\.hotel_id, lang \}\)/);
 assert.match(page,/location\.replace\(target\.href\);\s*} else {\s*await connectOnCurrentOrigin\(\)/);
 assert.match(page,/target\.searchParams\.get\('redirect_uri'\) !== `\$\{location\.origin\}\/partners\/stripe-connect-return\.html`/);
 assert.doesNotMatch(page,/document\.cookie|location\.hostname\.endsWith/);
});
test('SW runtime handlers bypass all OAuth routes and activation removes only old Partner caches',async()=>{
 const handlers=new Map();
 const currentCache='ce-partners-pwa-20260922_2';
 const oldCaches=['ce-partners-pwa-20260907_1','ce-partners-pwa-20260831_1'];
 const preservedCaches=[currentCache,'ce-admin-pwa-20260907_1','unrelated-cache','ce-partners-pwa'];
 const existingCaches=new Set([...oldCaches,...preservedCaches]);
 const deleted=[];const cacheCalls=[];const fetches=[];
 let claims=0;
 runInNewContext(read('partners/sw.js'),{
  URL,Response,
  self:{location:{origin:'https://cypruseye.com'},
   addEventListener:(type,handler)=>handlers.set(type,handler),
   clients:{claim:async()=>{claims++;}}},
  caches:{
   keys:async()=>[...existingCaches],
   delete:async key=>{deleted.push(key);return existingCaches.delete(key);},
   open:async key=>{cacheCalls.push(['open',key]);return {
    put:async request=>{cacheCalls.push(['put',request.url]);},
   };},
   match:async request=>{cacheCalls.push(['match',request.url]);return undefined;},
  },
  fetch:async request=>{fetches.push(request.url);return new Response('synthetic only');},
 },{filename:'partners/sw.js'});
 assert.equal(typeof handlers.get('fetch'),'function');
 assert.equal(typeof handlers.get('activate'),'function');
 const dispatchFetch=async path=>{
  const responses=[];
  handlers.get('fetch')({request:{method:'GET',mode:'navigate',destination:'document',
   url:`https://cypruseye.com${path}`},respondWith:response=>responses.push(response)});
  await Promise.all(responses);
  return responses.length;
 };
 for(const path of ['/partners/stripe-connect-return.html','/partners/stripe-connect-return','/partners/stripe-connect.html','/partners/stripe-connect']) {
  assert.equal(await dispatchFetch(`${path}?code=ac_Synthetic&state=${'a'.repeat(64)}`),0,path);
 }
 assert.deepEqual(fetches,[]);
 assert.deepEqual(cacheCalls,[]);
 // Positive control: the real handler still fetches/caches ordinary navigation.
 assert.equal(await dispatchFetch('/partners/index.html'),1);
 assert.deepEqual(fetches,['https://cypruseye.com/partners/index.html']);
 assert.deepEqual(cacheCalls,[['open',currentCache],['put','https://cypruseye.com/partners/index.html']]);
 const activation=[];
 handlers.get('activate')({waitUntil:promise=>activation.push(promise)});
 assert.equal(activation.length,1);
 await Promise.all(activation);
 assert.deepEqual(deleted.sort(),oldCaches.sort());
 assert.deepEqual([...existingCaches].sort(),preservedCaches.sort());
 assert.equal(claims,1);
});
