// Utility: Supabase clients for Cloudflare Pages Functions
// Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY (optional but recommended), SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

export function createSupabaseClients(env, authHeaderValue) {
  const url = env.SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const publicClient = anon
    ? createClient(url, anon, {
        global: { headers: authHeaderValue ? { Authorization: authHeaderValue } : {} },
      })
    : null;
  const adminClient = createClient(url, service);
  return { publicClient, adminClient };
}

export async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const { publicClient } = createSupabaseClients(env, auth);
  if (!publicClient) throw new Error('Public client not configured');
  const { data: userRes, error: userErr } = await publicClient.auth.getUser();
  if (userErr || !userRes?.user) {
    throw new Error('Unauthorized');
  }
  const uid = userRes.user.id;
  const { data: profile, error } = await publicClient
    .from('profiles')
    .select('id,is_admin')
    .eq('id', uid)
    .single();
  if (error || !profile?.is_admin) {
    throw new Error('Forbidden');
  }
  return { adminId: uid };
}
