// Cloudflare Pages Function: Ban / Unban user
// POST { ban: boolean, duration?: '24h'|'7d'|'30d'|'permanent'|'custom', until?: ISO8601, reason?: string, block_email?: boolean }
// Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (and optionally SUPABASE_ANON_KEY)

import { createSupabaseClients, requireAdmin } from '../../../../_utils/supabaseAdmin';

export async function onRequestPost(context) {
  try {
    const { request, env, params } = context;
    const body = await request.json();
    const userId = params.id;

    if (!userId) return new Response(JSON.stringify({ error: 'Missing user id' }), { status: 400 });

    await requireAdmin(request, env);
    const { adminClient, publicClient } = createSupabaseClients(env, request.headers.get('Authorization'));

    if (body?.ban === false) {
      // Unban
      const { error: upErr } = await publicClient
        .from('profiles')
        .update({ banned_until: null, ban_reason: null, ban_permanent: false })
        .eq('id', userId);
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    }

    // Ban
    const { duration, until, reason, block_email } = body || {};
    let banned_until = null;
    let ban_permanent = false;
    const now = new Date();

    if (duration === 'permanent') {
      ban_permanent = true;
    } else if (duration === 'custom' && until) {
      banned_until = new Date(until);
    } else if (duration === '24h' || duration === '7d' || duration === '30d') {
      const hours = duration === '24h' ? 24 : duration === '7d' ? 7 * 24 : 30 * 24;
      banned_until = new Date(now.getTime() + hours * 60 * 60 * 1000);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid ban payload' }), { status: 400 });
    }

    const { error: profErr } = await publicClient
      .from('profiles')
      .update({ banned_until: banned_until ? banned_until.toISOString() : null, ban_reason: reason || null, ban_permanent })
      .eq('id', userId);
    if (profErr) throw profErr;

    // Revoke sessions
    await adminClient.auth.admin.signOut(userId);

    // Optionally block email via app_metadata
    if (block_email) {
      // Load auth user to get email
      const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;
      if (email) {
        await adminClient.auth.admin.updateUserById(userId, { app_metadata: { blocked: true } });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Server error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
