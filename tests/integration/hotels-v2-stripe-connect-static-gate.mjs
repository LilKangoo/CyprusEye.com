import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
 assert.match(read('partners/sw.js'),/stripe-connect-return\.html.*return false/);
 assert.match(read('_headers'),/\/partners\/stripe-connect-return\.html\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer/);
});
