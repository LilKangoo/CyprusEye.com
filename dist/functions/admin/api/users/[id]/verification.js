// Cloudflare Pages Function: Resend verification email
// POST { action?: 'resend_signup' }

import { createSupabaseClients, requireAdmin } from '../../../../_utils/supabaseAdmin';

export async function onRequestPost(context) {
  try {
    const { request, env, params } = context;
    const body = await request.json().catch(() => ({}));
    const userId = params.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing user id' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    await requireAdmin(request, env);
    const { adminClient, publicClient } = createSupabaseClients(env, request.headers.get('Authorization'));
    if (!publicClient) {
      throw new Error('Public client not configured');
    }

    const { data: userRes, error: userErr } = await adminClient.auth.admin.getUserById(userId);
    if (userErr || !userRes?.user?.email) {
      throw new Error('Target user not found or has no email');
    }

    const action = String(body?.action || 'resend_signup');
    if (action !== 'resend_signup') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const targetEmail = userRes.user.email;
    const emailRedirectTo = 'https://cypruseye.com/auth/';

    const { error } = await publicClient.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: { emailRedirectTo },
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
