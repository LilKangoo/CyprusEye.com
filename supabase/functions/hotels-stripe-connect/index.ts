import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';
import { connectConfig, createConnectService } from './service.mjs';

// Separate Connect webhook endpoint configuration is required. Never reuse the
// platform's deposit webhook secret. Deployment/configuration is not automatic.
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error('configuration_missing'); return value; };
Deno.serve(async (request: Request) => {
  let headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const config = connectConfig({ origin: env('HOTELS_CONNECT_ORIGIN'), clientId: env('STRIPE_CONNECT_CLIENT_ID'),
      liveMode: env('HOTELS_CONNECT_MODE') === 'live' });
    if (!['live', 'test'].includes(env('HOTELS_CONNECT_MODE'))) throw new Error('configuration_invalid');
    const origin = request.headers.get('origin');
    if (origin && origin !== config.origin) return new Response(null, { status: 403 });
    if (origin) headers = { ...headers, 'Access-Control-Allow-Origin': config.origin, Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers });
    const raw = await request.text();
    if (raw.length > 65536) return new Response(null, { status: 413, headers });
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const store = async (action: string, value: unknown) => {
      const { data, error } = await db.rpc('hotel_v2_stripe_connect_service', { p_action: action, p_request: value });
      if (error) throw new Error('connection_state_rejected');
      return data;
    };
    // No SDK retry of OAuth exchange or account requests after ambiguous errors.
    const stripe = new Stripe(env('STRIPE_SECRET_KEY'), { apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 0, timeout: 12000 });
    const service = createConnectService({ config,
      scope: (actor: string, partner_id: string, hotel_id: string) => store('scope', { actor, partner_id, hotel_id }), store,
      randomState: () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join(''),
      stripe: {
        exchange: (code: string) => stripe.oauth.token({ grant_type: 'authorization_code', code }),
        account: (id: string) => stripe.accounts.retrieve(id),
        verifyEvent: (body: string, signature: string) => stripe.webhooks.constructEventAsync(body, signature,
          env('STRIPE_CONNECT_WEBHOOK_SECRET'), 300, Stripe.createSubtleCryptoProvider()),
      },
    });
    const signature = request.headers.get('stripe-signature');
    let result;
    if (new URL(request.url).pathname.endsWith('/webhook')) {
      if (!signature) return new Response(null, { status: 401, headers });
      result = await service.webhook(raw, signature);
    } else {
      if (!origin || signature) return new Response(null, { status: 403, headers });
      const authorization = request.headers.get('authorization') || '';
      if (!authorization.startsWith('Bearer ')) return new Response(null, { status: 401, headers });
      const { data, error } = await db.auth.getUser(authorization.slice(7));
      if (error || !data.user) return new Response(null, { status: 401, headers });
      const body = JSON.parse(raw);
      if (body?.action === 'verify_platform_configuration') {
        if (Object.keys(body).join() !== 'action') throw new Error('invalid_request');
        // Administrative configuration attestation, NOT a Stripe account connection.
        // Verify Admin using the user's JWT; the browser cannot supply readiness or account identity.
        const adminDb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
          global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
        });
        const access = await adminDb.rpc('hotel_v2_admin_get_capability_lifecycle');
        if (access.error || access.data?.contract_version !== 'hotels_v2_capability_lifecycle_v1') return new Response(null, { status: 403, headers });
        const mode = config.liveMode ? 'live' : 'test';
        if (!env('STRIPE_SECRET_KEY').startsWith(`sk_${mode}_`)
          || !env('STRIPE_CONNECT_WEBHOOK_SECRET').startsWith('whsec_')) throw new Error('configuration_invalid');
        const attestation = await db.rpc('hotel_v2_attest_stripe_platform_readiness', {
          p_request_id: crypto.randomUUID(), p_ready: true, p_contract_version: 'hotels_standard_connect_server_v1',
        });
        if (attestation.error || attestation.data !== true) throw new Error('configuration_attestation_rejected');
        result = { contract_version: 'hotels_standard_connect_server_v1', configuration_verified: true,
          account_connected: false, capability_enabled_by_this_request: false };
      } else result = await service.request(data.user.id, body);
    }
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (_) {
    // No Stripe response, code, token, account ID or private database error is
    // logged or exposed. Failure never implies Connected or automatic retry.
    return new Response(JSON.stringify({ error: 'stripe_connection_not_completed' }), { status: 400, headers });
  }
});
