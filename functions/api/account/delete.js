// Cloudflare Pages Function: Self-service permanent account deletion
// POST { action: 'preview' | 'execute', confirm_text?: 'DELETE', expected_email?: string }

import { createSupabaseClients } from '../../_utils/supabaseAdmin';
import { normalizeEmail, collectDeleteImpact, executeHardDelete } from '../../_utils/hardDeleteUser';

const JSON_HEADERS = { 'content-type': 'application/json' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function formatErrorMessage(error) {
  const pickText = (...values) => values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';

  const direct = pickText(
    error?.message,
    error?.error,
    error?.error_description,
    error?.details,
    error?.hint,
    error?.code,
    error?.statusText,
  );
  if (direct) return direct;

  const status = Number(error?.statusCode || error?.status || 0);
  if (status > 0) return `Server error (status ${status})`;
  return 'Unexpected server error (empty error payload)';
}

async function requireAuthenticatedUser(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const { publicClient } = createSupabaseClients(env, authHeader);
  if (!publicClient) {
    throw new Error('Public client not configured');
  }

  const { data, error } = await publicClient.auth.getUser();
  if (error || !data?.user?.id) {
    return null;
  }
  return data.user;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'preview').trim().toLowerCase();

    const authUser = await requireAuthenticatedUser(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const userId = String(authUser.id || '').trim();
    if (!userId) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const targetEmail = normalizeEmail(authUser.email);
    const { adminClient } = createSupabaseClients(env, request.headers.get('Authorization'));

    // Protect the operational admin account layer from self-deletes in the public dashboard.
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.is_admin) {
      return json({ error: 'Admin accounts must be deleted from the admin panel.' }, 400);
    }

    const impact = await collectDeleteImpact(adminClient, userId, targetEmail);
    if (action === 'preview') {
      return json({
        ok: true,
        action: 'preview',
        user_id: userId,
        email: targetEmail || null,
        ...impact,
      });
    }

    if (action !== 'execute') {
      return json({ error: 'Invalid action' }, 400);
    }

    const confirmText = String(body?.confirm_text || '').trim();
    if (confirmText !== 'DELETE') {
      return json({ error: 'Confirmation token mismatch' }, 400);
    }

    const expectedEmail = normalizeEmail(body?.expected_email);
    if (expectedEmail && targetEmail && expectedEmail !== targetEmail) {
      return json({ error: 'Email confirmation mismatch' }, 400);
    }

    const result = await executeHardDelete(adminClient, adminClient, userId, targetEmail);
    return json({
      ok: true,
      action: 'execute',
      user_id: userId,
      email: targetEmail || null,
      preview: impact,
      ...result,
    });
  } catch (e) {
    const message = formatErrorMessage(e);
    console.error('[account-delete] failed:', e);
    return json({ error: message || 'Server error' }, 500);
  }
}
