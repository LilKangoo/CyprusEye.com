// Cloudflare Pages Function: Update account (email + enforcement flags)
// POST { email?: string, require_password_change?: boolean, require_email_update?: boolean }

import { createSupabaseClients, requireAdmin } from '../../../../_utils/supabaseAdmin';

export async function onRequestPost(context) {
  try {
    const { request, env, params } = context;
    const body = await request.json();
    const userId = params.id;
    if (!userId) return new Response(JSON.stringify({ error: 'Missing user id' }), { status: 400 });

    await requireAdmin(request, env);
    const { adminClient, publicClient } = createSupabaseClients(env, request.headers.get('Authorization'));

    const updates = [];

    if (typeof body.email === 'string' && body.email.trim()) {
      updates.push(async () => {
        const { data, error } = await adminClient.auth.admin.updateUserById(userId, { email: body.email.trim() });
        if (error) throw error;
      });
    }

    if (typeof body.require_password_change === 'boolean' || typeof body.require_email_update === 'boolean') {
      const flags = {};
      if (typeof body.require_password_change === 'boolean') flags.require_password_change = body.require_password_change;
      if (typeof body.require_email_update === 'boolean') flags.require_email_update = body.require_email_update;
      updates.push(async () => {
        const { error } = await publicClient.from('profiles').update(flags).eq('id', userId);
        if (error) throw error;
      });
    }

    for (const task of updates) await task();

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Server error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
