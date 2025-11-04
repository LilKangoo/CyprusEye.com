// Cloudflare Pages Function: Password operations
// POST { action: 'reset'|'magic_link'|'set_temporary', temp_password?: string }

import { createSupabaseClients, requireAdmin } from '../../../_utils/supabaseAdmin.js';

export async function onRequestPost(context) {
  try {
    const { request, env, params } = context;
    const body = await request.json();
    const userId = params.id;
    if (!userId) return new Response(JSON.stringify({ error: 'Missing user id' }), { status: 400 });

    await requireAdmin(request, env);
    const { adminClient } = createSupabaseClients(env, request.headers.get('Authorization'));

    const action = body?.action;
    if (action === 'reset') {
      const { data, error } = await adminClient.auth.admin.generateLink({ type: 'recovery', user_id: userId });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, link: data?.properties?.action_link || null }), { headers: { 'content-type': 'application/json' } });
    }

    if (action === 'magic_link') {
      const { data, error } = await adminClient.auth.admin.generateLink({ type: 'magiclink', user_id: userId });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, link: data?.properties?.action_link || null }), { headers: { 'content-type': 'application/json' } });
    }

    if (action === 'set_temporary') {
      const pwd = (body?.temp_password || '').toString();
      if (!pwd || pwd.length < 8) return new Response(JSON.stringify({ error: 'Password too short' }), { status: 400 });
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password: pwd });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Server error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
