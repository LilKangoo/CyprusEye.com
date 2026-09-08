import assert from 'node:assert/strict';
import test from 'node:test';
import { accountState, connectConfig, createConnectService } from '../../supabase/functions/hotels-stripe-connect/service.mjs';

const actor = '10000000-0000-4000-8000-000000000002';
const partner = '20000000-0000-4000-8000-000000000001';
const hotel = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const requestId = '30000000-0000-4000-8000-000000000001';
const state = 'a'.repeat(64);
const ready = () => ({ id: 'acct_Synthetic', type: 'standard', charges_enabled: true, payouts_enabled: true,
  details_submitted: true, requirements: { currently_due: [], past_due: [], disabled_reason: null } });
function fixture() {
  const f = { enabled: true, authorized: true, calls: [], account: ready(), row: null, states: new Map(), events: new Set(),
    validSignature: true, token: { stripe_user_id: 'acct_Synthetic', livemode: false, scope: 'read_write' } };
  const store = async (action, value) => {
    f.calls.push(`store:${action}`);
    if (action === 'begin') { f.states.set(value.state, { actor: value.actor, partner_id: value.partner_id, hotel_id: value.hotel_id }); return { state: value.state }; }
    if (action === 'claim') {
      const pending = f.states.get(value.state);
      if (!pending || pending.actor !== value.actor || pending.claimed) throw new Error('invalid_state');
      pending.claimed = true; return pending;
    }
    if (action === 'finish') { f.row = { account_id: value.account_id, status: value.status, live_mode: value.live_mode, revision: 1, revoked: false }; return f.row; }
    if (action === 'status') return f.row;
    if (action === 'refresh') { f.row.status = value.status; f.row.revision += 1; return f.row; }
    if (action === 'event_context') return f.row;
    if (action === 'event') {
      if (f.events.has(value.event_id)) return { duplicate: true };
      f.events.add(value.event_id);
      if (!f.row.revoked || value.revoked) { f.row.status = value.status; f.row.revoked = value.revoked; }
      return { reconciled: true };
    }
    throw new Error('unexpected_store');
  };
  f.service = createConnectService({ config: connectConfig({ origin: 'https://local.example.invalid', clientId: 'ca_Synthetic', liveMode: false }),
    scope: async (a,p,h) => ({ authorized: f.authorized && a === actor && p === partner && h === hotel, enabled: f.enabled }), store,
    randomState: () => state,
    stripe: {
      exchange: async () => { f.calls.push('exchange'); if (f.exchangeError) throw new Error('ambiguous_exchange'); return f.token; },
      account: async () => { f.calls.push('account'); return f.account; },
      verifyEvent: async raw => { f.calls.push('verify'); if (!f.validSignature) throw new Error('invalid_signature'); return JSON.parse(raw); },
    } });
  f.begin = () => f.service.request(actor, { action: 'begin', partner_id: partner, hotel_id: hotel, request_id: requestId });
  f.complete = () => f.service.request(actor, { action: 'complete', code: 'ac_Synthetic', state });
  return f;
}
test('all six states are server-derived, never browser account ID', async () => {
  assert.equal(accountState(ready()), 'CONNECTED');
  assert.equal(accountState({ ...ready(), details_submitted: false }), 'ONBOARDING_INCOMPLETE');
  assert.equal(accountState({ ...ready(), payouts_enabled: false }), 'ACTION_REQUIRED');
  assert.equal(accountState({ ...ready(), requirements: { ...ready().requirements, past_due: ['business'] } }), 'RESTRICTED');
  const f = fixture();
  assert.equal((await f.service.request(actor, { action: 'status', partner_id: partner, hotel_id: hotel })).status, 'NOT_CONNECTED');
  f.enabled = false;
  assert.equal((await f.begin()).status, 'DISABLED');
  assert.deepEqual(f.calls, ['store:status']);
});
test('Standard OAuth uses fixed redirect; complete once; sanitized status; no money routing', async () => {
  const f = fixture(); const result = await f.begin(); const url = new URL(result.authorization_url);
  assert.equal(url.origin, 'https://connect.stripe.com'); assert.equal(url.searchParams.get('scope'), 'read_write');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://local.example.invalid/partners/stripe-connect-return.html');
  assert.equal(url.searchParams.get('state'), state);
  assert.deepEqual(await f.complete(), { contract_version: 'hotels_partner_stripe_connect_v1', status: 'CONNECTED', checked_at: null });
  await assert.rejects(f.complete()); assert.equal(f.calls.filter(c => c === 'exchange').length, 1);
  assert.equal(f.calls.some(c => /charge|transfer|payout/.test(c)), false);
});
for (const action of ['begin','status','refresh']) test(`${action}: wrong Partner/Hotel/actor denied`, async () => {
  const f = fixture();
  for (const key of ['partner_id','hotel_id']) await assert.rejects(f.service.request(actor, {
    action, partner_id: partner, hotel_id: hotel, ...(action === 'begin' ? { request_id: requestId } : {}), [key]: requestId,
  }));
  await assert.rejects(f.service.request(requestId, { action, partner_id: partner, hotel_id: hotel,
    ...(action === 'begin' ? { request_id: requestId } : {}) }));
  assert.deepEqual(f.calls, []);
});
test('browser-supplied account, redirect, callback actor and extra keys rejected', async () => {
  const f = fixture();
  for (const extra of ['account_id','return_url','redirect_uri','actor']) await assert.rejects(f.service.request(actor, {
    action: 'begin', partner_id: partner, hotel_id: hotel, request_id: requestId, [extra]: 'untrusted',
  }));
  await f.begin(); await assert.rejects(f.service.request(requestId, { action: 'complete', code: 'ac_Synthetic', state }));
  await assert.rejects(f.service.request(actor, { action: 'complete', code: 'ac_Synthetic', state: 'b'.repeat(64) }));
  assert.equal(f.calls.includes('exchange'), false);
});
for (const mutation of [a => { a.type='express'; }, a => { a.charges_enabled='true'; },
  a => { delete a.details_submitted; }, a => { a.requirements.currently_due=null; },
  a => { a.requirements.past_due=[123]; }, a => { a.id='acct_Other'; }]) {
  test('malformed/mismatched Stripe account never marks Connected', async () => {
    const f=fixture(); await f.begin(); mutation(f.account); await assert.rejects(f.complete()); assert.equal(f.row,null);
  });
}
for (const token of [{ stripe_user_id:'acct_Synthetic',scope:'read_write',livemode:true },
  { stripe_user_id:'acct_Synthetic',scope:'read_only',livemode:false },
  { stripe_user_id:'bad',scope:'read_write',livemode:false }]) test('OAuth mode/scope/account mismatch denied', async () => {
  const f=fixture();await f.begin();f.token=token;await assert.rejects(f.complete());assert.equal(f.row,null);
});
test('permission revoked after begin prevents exchange; failure never retries', async () => {
  const f=fixture();await f.begin();f.enabled=false;await assert.rejects(f.complete());assert.equal(f.calls.includes('exchange'),false);
  const g=fixture();await g.begin();g.exchangeError=true;await assert.rejects(g.complete());await assert.rejects(g.complete());
  assert.equal(g.calls.filter(c=>c==='exchange').length,1);
});
test('signed webhook reconciliation, deduplication and sticky deauthorization', async () => {
  const f=fixture();await f.begin();await f.complete();
  const event={ id:'evt_Synthetic',account:'acct_Synthetic',livemode:false,type:'account.application.deauthorized' };
  f.validSignature=false;await assert.rejects(f.service.webhook(JSON.stringify(event),'bad'));assert.equal(f.row.status,'CONNECTED');
  f.validSignature=true;assert.deepEqual(await f.service.webhook(JSON.stringify(event),'valid'),{reconciled:true});
  assert.equal(f.row.status,'DISABLED');assert.deepEqual(await f.service.webhook(JSON.stringify(event),'valid'),{duplicate:true});
  await f.service.webhook(JSON.stringify({...event,id:'evt_Update',type:'account.updated'}),'valid');assert.equal(f.row.status,'DISABLED');
});
test('invalid configuration fails closed', () => {
  for (const origin of ['http://local.example.invalid','https://user:pass@local.example.invalid','https://local.example.invalid/evil','https://local.example.invalid?next=evil'])
    assert.throws(()=>connectConfig({origin,clientId:'ca_Synthetic',liveMode:false}));
});
