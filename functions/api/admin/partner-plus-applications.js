import { createSupabaseClients } from '../../_utils/supabaseAdmin.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const ADMIN_USER_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';
const ADMIN_EMAIL = 'lilkangoomedia@gmail.com';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isTruthyFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

async function requirePartnerPlusAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const { publicClient, adminClient } = createSupabaseClients(env, authHeader);
  if (!publicClient || !adminClient) {
    throw new Error('Supabase clients are not configured');
  }

  const { data: userResult, error: userError } = await publicClient.auth.getUser();
  const user = userResult?.user || null;
  if (userError || !user?.id) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const userId = String(user.id || '').trim();
  const userEmail = normalizeEmail(user.email);
  if (userId === ADMIN_USER_ID || userEmail === ADMIN_EMAIL) {
    return { ok: true, user, adminClient };
  }

  if (isTruthyFlag(user.app_metadata?.is_admin) || isTruthyFlag(user.user_metadata?.is_admin)) {
    return { ok: true, user, adminClient };
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  if (profile?.is_admin || normalizeEmail(profile?.email) === ADMIN_EMAIL) {
    return { ok: true, user, adminClient };
  }

  return { ok: false, status: 403, error: 'Forbidden' };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
    },
  });
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const auth = await requirePartnerPlusAdmin(request, env);
    if (!auth.ok) {
      return json({ error: auth.error }, auth.status);
    }

    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(Number.parseInt(url.searchParams.get('limit') || '500', 10) || 500, 1000));

    const { data, error } = await auth.adminClient
      .from('partner_plus_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return json({ ok: true, data: Array.isArray(data) ? data : [] });
  } catch (error) {
    console.error('[admin-partner-plus-applications] failed:', error);
    return json({ error: error?.message || 'Server error' }, 500);
  }
}
