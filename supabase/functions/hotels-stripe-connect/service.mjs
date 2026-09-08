// Partner-owned Standard OAuth only. No charges, transfers, account creation,
// payout scheduling or fee calculation. Dependencies are injectable for offline tests.
export const STATES = Object.freeze(['NOT_CONNECTED', 'ONBOARDING_INCOMPLETE', 'CONNECTED', 'RESTRICTED', 'ACTION_REQUIRED', 'DISABLED']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fail = (message) => { throw new Error(message); };
export function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join() !== [...keys].sort().join()) fail('invalid_request');
}
export function accountState(account) {
  if (!account || !/^acct_[A-Za-z0-9]+$/.test(account.id) || account.type !== 'standard'
    || ['charges_enabled', 'payouts_enabled', 'details_submitted'].some(k => typeof account[k] !== 'boolean')
    || !account.requirements || !Array.isArray(account.requirements.currently_due)
    || !Array.isArray(account.requirements.past_due)
    || [...account.requirements.currently_due, ...account.requirements.past_due].some(v => typeof v !== 'string')
    || (account.requirements.disabled_reason !== null && typeof account.requirements.disabled_reason !== 'string')) fail('invalid_stripe_account');
  if (account.requirements.disabled_reason || account.requirements.past_due.length) return 'RESTRICTED';
  if (!account.details_submitted) return 'ONBOARDING_INCOMPLETE';
  if (account.requirements.currently_due.length || !account.charges_enabled || !account.payouts_enabled) return 'ACTION_REQUIRED';
  return 'CONNECTED';
}
export function connectConfig({ origin, clientId, liveMode }) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || !/^ca_[A-Za-z0-9]+$/.test(clientId) || typeof liveMode !== 'boolean') fail('invalid_connect_configuration');
  return Object.freeze({ origin: url.origin, clientId, liveMode, redirect: `${url.origin}/partners/stripe-connect-return.html` });
}
export function createConnectService({ config, scope, store, stripe, randomState }) {
  const scoped = async (actor, partner, hotel) => {
    if (!UUID.test(actor) || !UUID.test(partner) || !UUID.test(hotel)) fail('invalid_scope');
    const s = await scope(actor, partner, hotel);
    if (s?.authorized !== true || typeof s.enabled !== 'boolean') fail('access_denied');
    return s;
  };
  const publicStatus = row => {
    const status = row == null ? 'NOT_CONNECTED' : row.status;
    if (!STATES.includes(status)) fail('invalid_stored_status');
    if (row?.checked_at != null && (typeof row.checked_at !== 'string' || !Number.isFinite(Date.parse(row.checked_at)))) fail('invalid_checked_at');
    return { contract_version: 'hotels_partner_stripe_connect_v1', status, checked_at: row?.checked_at || null };
  };
  return {
    async request(actor, body) {
      if (body?.action === 'complete') {
        exactKeys(body, ['action', 'code', 'state']);
        if (!UUID.test(actor) || !/^[a-f0-9]{64}$/.test(body.state) || typeof body.code !== 'string'
          || !/^ac_[A-Za-z0-9]{1,250}$/.test(body.code)) fail('invalid_callback');
        // Atomic claim before the one-use exchange: a lost response is never
        // retried automatically, and a claimed state cannot be replayed.
        const context = await store('claim', { actor, state: body.state });
        if (!(await scoped(actor, context.partner_id, context.hotel_id)).enabled) fail('connect_disabled');
        const token = await stripe.exchange(body.code);
        if (token?.livemode !== config.liveMode || token?.scope !== 'read_write'
          || !/^acct_[A-Za-z0-9]+$/.test(token?.stripe_user_id || '')) fail('invalid_oauth_exchange');
        const account = await stripe.account(token.stripe_user_id);
        if (account.id !== token.stripe_user_id) fail('stripe_account_mismatch');
        const status = accountState(account);
        // Never return/store access/refresh tokens or an ID chosen by the browser.
        return publicStatus(await store('finish', { actor, state: body.state,
          account_id: account.id, live_mode: config.liveMode, status }));
      }
      exactKeys(body, body?.action === 'begin' ? ['action', 'partner_id', 'hotel_id', 'request_id'] : ['action', 'partner_id', 'hotel_id']);
      if (!['begin', 'status', 'refresh'].includes(body.action)) fail('invalid_action');
      const s = await scoped(actor, body.partner_id, body.hotel_id);
      if (!s.enabled) return publicStatus({ status: 'DISABLED' });
      const context = { actor, partner_id: body.partner_id, hotel_id: body.hotel_id };
      if (body.action === 'begin') {
        if (!UUID.test(body.request_id)) fail('invalid_request_id');
        const state = randomState();
        if (!/^[a-f0-9]{64}$/.test(state)) fail('invalid_state_entropy');
        const pending = await store('begin', { ...context, state, request_id: body.request_id });
        if (!/^[a-f0-9]{64}$/.test(pending?.state || '')) fail('invalid_stored_state');
        const target = new URL('https://connect.stripe.com/oauth/authorize');
        for (const [k, v] of Object.entries({ response_type: 'code', client_id: config.clientId,
          scope: 'read_write', redirect_uri: config.redirect, state: pending.state })) target.searchParams.set(k, v);
        return { contract_version: 'hotels_partner_stripe_connect_begin_v1', authorization_url: target.href };
      }
      const row = await store('status', context);
      if (row?.account_id && row.live_mode !== config.liveMode) fail('stripe_mode_mismatch');
      if (body.action === 'status' || !row?.account_id || row.revoked) return publicStatus(row);
      const account = await stripe.account(row.account_id);
      if (account.id !== row.account_id) fail('stripe_account_mismatch');
      return publicStatus(await store('refresh', { ...context, account_id: row.account_id,
        expected_revision: row.revision, status: accountState(account) }));
    },
    async webhook(raw, signature) {
      const event = await stripe.verifyEvent(raw, signature);
      if (event?.livemode !== config.liveMode || !/^evt_[A-Za-z0-9]+$/.test(event?.id || '')
        || !/^acct_[A-Za-z0-9]+$/.test(event?.account || '')) fail('invalid_connect_event');
      if (!['account.updated', 'account.application.deauthorized'].includes(event.type)) return { ignored: true };
      const binding = await store('event_context', { account_id: event.account, live_mode: config.liveMode });
      if (!binding) return { ignored: true };
      const revoked = event.type === 'account.application.deauthorized';
      const account = revoked ? null : await stripe.account(event.account);
      if (account && account.id !== event.account) fail('stripe_account_mismatch');
      return store('event', { event_id: event.id, account_id: event.account, live_mode: config.liveMode,
        expected_revision: binding.revision, revoked, status: revoked ? 'DISABLED' : accountState(account) });
    },
  };
}
