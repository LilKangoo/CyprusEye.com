// Cloudflare Pages Function: Password operations
// POST { action: 'reset'|'magic_link'|'set_temporary', temp_password?: string }

import { createSupabaseClients, requireAdmin } from '../../../../_utils/supabaseAdmin';

export async function onRequestPost(context) {
  try {
    const { request, env, params } = context;
    const body = await request.json();
    const userId = params.id;
    if (!userId) return new Response(JSON.stringify({ error: 'Missing user id' }), { status: 400, headers: { 'content-type': 'application/json' } });

    await requireAdmin(request, env);
    const { adminClient, publicClient } = createSupabaseClients(env, request.headers.get('Authorization'));

    // Resolve target user email once and reuse for link generation
    const { data: userRes, error: userErr } = await adminClient.auth.admin.getUserById(userId);
    if (userErr || !userRes?.user?.email) {
      throw new Error('Target user not found or has no email');
    }
    const targetEmail = userRes.user.email;

    const action = body?.action;
    const redirectTo = 'https://cypruseye.com/auth/callback/';

    if (action === 'reset') {
      // Trigger Supabase to send a standard password reset email
      const { data, error } = await publicClient.auth.resetPasswordForEmail(targetEmail, {
        redirectTo,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, link: null }), { headers: { 'content-type': 'application/json' } });
    }

    if (action === 'magic_link') {
      // For admin UX, treat "magic link" as an alternative entry to the same
      // password reset flow: send a recovery email that leads to the callback page.
      const { data, error } = await publicClient.auth.resetPasswordForEmail(targetEmail, {
        redirectTo,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, link: null }), { headers: { 'content-type': 'application/json' } });
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
