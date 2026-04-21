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

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function isTruthyFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

async function findProfileByEmail(adminClient, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, username, name')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function attachMatchedProfiles(adminClient, rows) {
  const applications = Array.isArray(rows) ? rows : [];
  const emails = Array.from(new Set(
    applications
      .map((row) => normalizeEmail(row?.email))
      .filter(Boolean),
  ));

  if (!emails.length) {
    return applications.map((row) => ({ ...row, matched_profile: null }));
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, username, name')
    .in('email', emails)
    .limit(1000);

  if (error) throw error;

  const profilesByEmail = {};
  (data || []).forEach((profile) => {
    const email = normalizeEmail(profile?.email);
    if (email) profilesByEmail[email] = profile;
  });

  const missingEmails = emails.filter((email) => !profilesByEmail[email]);
  for (const email of missingEmails.slice(0, 50)) {
    const profile = await findProfileByEmail(adminClient, email);
    if (profile?.id) profilesByEmail[email] = profile;
  }

  return applications.map((row) => ({
    ...row,
    matched_profile: profilesByEmail[normalizeEmail(row?.email)] || null,
  }));
}

function getPublicBaseUrl(request, env) {
  const configured = String(env?.PUBLIC_SITE_URL || env?.SITE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
}

function buildAccountInviteEmail(application, request, env) {
  const lang = String(application?.language || '').trim().toLowerCase().startsWith('pl') ? 'pl' : 'en';
  const email = normalizeEmail(application?.email);
  const service = String(application?.service || 'Partner+').trim();
  const baseUrl = getPublicBaseUrl(request, env);
  const signupUrl = `${baseUrl}/index.html?lang=${lang}&auth=register&email=${encodeURIComponent(email)}`;
  const partnerName = String(application?.name || '').trim();
  const approved = String(application?.workflow_status || '').trim().toLowerCase() === 'approved';

  if (lang === 'pl') {
    const subject = 'CyprusEye Partner+ - utwórz konto do panelu partnera';
    const text = [
      `Cześć${partnerName ? ` ${partnerName}` : ''},`,
      '',
      approved
        ? `Twoje zgłoszenie Partner+ dla "${service}" zostało zaakceptowane, ale nie znaleźliśmy jeszcze konta użytkownika dla adresu ${email}.`
        : `Otrzymaliśmy Twoje zgłoszenie Partner+ dla "${service}", ale nie znaleźliśmy jeszcze konta użytkownika dla adresu ${email}.`,
      'Utwórz konto na ten sam adres e-mail, aby administrator mógł prawidłowo przypisać dostęp do panelu partnera.',
      '',
      `Link do rejestracji: ${signupUrl}`,
      '',
      'CyprusEye.com / WakacjeCypr.com',
    ].join('\n');
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
        <h2>Utwórz konto do panelu partnera</h2>
        <p>Cześć${partnerName ? ` ${escapeHtml(partnerName)}` : ''},</p>
        <p>${approved ? 'Twoje zgłoszenie Partner+ dla' : 'Otrzymaliśmy Twoje zgłoszenie Partner+ dla'} <strong>${escapeHtml(service)}</strong>${approved ? ' zostało zaakceptowane' : ''}, ale nie znaleźliśmy jeszcze konta użytkownika dla adresu <strong>${escapeHtml(email)}</strong>.</p>
        <p>Utwórz konto na ten sam adres e-mail, aby administrator mógł prawidłowo przypisać dostęp do panelu partnera.</p>
        <p><a href="${escapeHtml(signupUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700">Utwórz konto</a></p>
        <p style="color:#6b7280">CyprusEye.com / WakacjeCypr.com</p>
      </div>`;
    return { subject, text, html, signupUrl };
  }

  const subject = 'CyprusEye Partner+ - create your partner panel account';
  const text = [
    `Hi${partnerName ? ` ${partnerName}` : ''},`,
    '',
    approved
      ? `Your Partner+ application for "${service}" has been approved, but we have not found a user account for ${email} yet.`
      : `We received your Partner+ application for "${service}", but we have not found a user account for ${email} yet.`,
    'Create an account with the same e-mail address so an admin can attach partner panel access correctly.',
    '',
    `Sign up link: ${signupUrl}`,
    '',
    'CyprusEye.com',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
      <h2>Create your partner panel account</h2>
      <p>Hi${partnerName ? ` ${escapeHtml(partnerName)}` : ''},</p>
      <p>${approved ? 'Your Partner+ application for' : 'We received your Partner+ application for'} <strong>${escapeHtml(service)}</strong>${approved ? ' has been approved' : ''}, but we have not found a user account for <strong>${escapeHtml(email)}</strong> yet.</p>
      <p>Create an account with the same e-mail address so an admin can attach partner panel access correctly.</p>
      <p><a href="${escapeHtml(signupUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700">Create account</a></p>
      <p style="color:#6b7280">CyprusEye.com</p>
    </div>`;
  return { subject, text, html, signupUrl };
}

async function sendMailChannelsEmail(env, { to, subject, text, html }) {
  const recipient = normalizeEmail(to);
  if (!isValidEmail(recipient) || !subject || (!text && !html)) {
    throw new Error('Invalid email payload');
  }

  const rawFrom = String(env?.SMTP_FROM || env?.MAIL_FROM || 'CyprusEye.com <no-reply@wakacjecypr.com>').trim();
  const match = rawFrom.match(/^(.*)<([^>]+)>\s*$/);
  const fromEmail = match ? match[2].trim() : rawFrom;
  const fromName = match ? String(match[1] || '').trim() || 'CyprusEye.com' : 'CyprusEye.com';

  const payload = {
    personalizations: [{ to: [{ email: recipient }] }],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [
      { type: 'text/plain', value: text || (html ? html.replace(/<[^>]*>/g, ' ') : '') },
      ...(html ? [{ type: 'text/html', value: html }] : []),
    ],
  };

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `MailChannels failed (${response.status})`);
  }

  return { channel: 'mailchannels' };
}

async function sendSupabaseInviteEmail(adminClient, email, redirectTo) {
  const recipient = normalizeEmail(email);
  if (!isValidEmail(recipient)) {
    throw new Error('Invalid invite email');
  }

  const { error } = await adminClient.auth.admin.inviteUserByEmail(recipient, {
    redirectTo,
  });

  if (error) throw error;
  return { channel: 'supabase_auth_invite' };
}

async function sendSupabaseOtpEmail(env, email, redirectTo) {
  const recipient = normalizeEmail(email);
  const supabaseUrl = String(env?.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = String(env?.SUPABASE_ANON_KEY || '').trim();
  if (!isValidEmail(recipient)) {
    throw new Error('Invalid OTP email');
  }
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase public auth configuration');
  }

  const endpoint = `${supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      email: recipient,
      create_user: true,
      data: {
        source: 'partner_plus_account_invite',
      },
      gotrue_meta_security: {},
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `Supabase OTP failed (${response.status})`);
  }

  return { channel: 'supabase_auth_otp' };
}

async function sendPartnerPlusAccountInviteEmail(adminClient, env, emailPayload, application) {
  const errors = [];

  try {
    return await sendMailChannelsEmail(env, {
      to: application.email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
    });
  } catch (error) {
    errors.push(`MailChannels: ${error?.message || error}`);
    console.error('[admin-partner-plus-applications] MailChannels invite failed:', error);
  }

  try {
    return await sendSupabaseInviteEmail(adminClient, application.email, emailPayload.signupUrl);
  } catch (error) {
    errors.push(`Supabase Auth invite: ${error?.message || error}`);
    console.error('[admin-partner-plus-applications] Supabase Auth invite failed:', error);
  }

  try {
    return await sendSupabaseOtpEmail(env, application.email, emailPayload.signupUrl);
  } catch (error) {
    errors.push(`Supabase OTP: ${error?.message || error}`);
    console.error('[admin-partner-plus-applications] Supabase OTP invite failed:', error);
  }

  throw new Error(`Partner+ invite email failed. ${errors.join(' | ')}`);
}

function isMissingInviteTrackingColumnError(error) {
  const message = String(error?.message || error?.details || error?.hint || '');
  return error?.code === '42703'
    || /account_invite_sent_at|account_invite_sent_to|column .* does not exist|schema cache/i.test(message);
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
      Allow: 'GET, POST, DELETE, OPTIONS',
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

    const rows = await attachMatchedProfiles(auth.adminClient, data || []);
    return json({ ok: true, data: rows });
  } catch (error) {
    console.error('[admin-partner-plus-applications] failed:', error);
    return json({ error: error?.message || 'Server error' }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const auth = await requirePartnerPlusAdmin(request, env);
    if (!auth.ok) {
      return json({ error: auth.error }, auth.status);
    }

    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      body = {};
    }

    const action = String(body?.action || '').trim();
    const id = String(body?.id || '').trim();
    if (!isUuid(id)) {
      return json({ error: 'Invalid Partner+ application id' }, 400);
    }

    const { data: application, error: appError } = await auth.adminClient
      .from('partner_plus_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (appError) throw appError;
    if (!application?.id) {
      return json({ error: 'Partner+ application not found' }, 404);
    }

    if (action === 'send_account_invite') {
      if (!isValidEmail(application.email)) {
        return json({ error: 'Application has invalid e-mail address' }, 422);
      }

      const emailPayload = buildAccountInviteEmail(application, request, env);
      const delivery = await sendPartnerPlusAccountInviteEmail(auth.adminClient, env, emailPayload, application);

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await auth.adminClient
        .from('partner_plus_applications')
        .update({
          account_invite_sent_at: now,
          account_invite_sent_to: normalizeEmail(application.email),
          updated_at: now,
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (updateError) {
        if (isMissingInviteTrackingColumnError(updateError)) {
          console.warn('[admin-partner-plus-applications] invite sent but tracking columns are missing. Deploy migration 146.', updateError);
          const rows = await attachMatchedProfiles(auth.adminClient, [application]);
          return json({
            ok: true,
            data: rows[0] || application,
            signup_url: emailPayload.signupUrl,
            delivery_channel: delivery.channel,
            warning: 'Invite sent, but tracking columns are missing. Deploy migration 146.',
          });
        }
        throw updateError;
      }
      const rows = await attachMatchedProfiles(auth.adminClient, updated ? [updated] : []);
      return json({
        ok: true,
        data: rows[0] || updated || application,
        signup_url: emailPayload.signupUrl,
        delivery_channel: delivery.channel,
      });
    }

    if (action === 'approve_partner_created') {
      const partnerId = String(body?.partner_id || '').trim();
      const grantAccess = Boolean(body?.grant_access);
      if (!isUuid(partnerId)) {
        return json({ error: 'Missing approved partner id' }, 400);
      }

      let profile = null;
      let accessGranted = false;
      if (grantAccess) {
        profile = await findProfileByEmail(auth.adminClient, application.email);
        if (!profile?.id) {
          return json({ error: 'No user account exists for this application e-mail yet' }, 409);
        }

        const { data: existing, error: existingError } = await auth.adminClient
          .from('partner_users')
          .select('id')
          .eq('partner_id', partnerId)
          .eq('user_id', profile.id)
          .maybeSingle();
        if (existingError) throw existingError;

        if (!existing?.id) {
          const { error: insertError } = await auth.adminClient
            .from('partner_users')
            .insert({ partner_id: partnerId, user_id: profile.id, role: 'owner' });
          if (insertError) throw insertError;
        }
        accessGranted = true;
      } else {
        profile = await findProfileByEmail(auth.adminClient, application.email).catch(() => null);
      }

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await auth.adminClient
        .from('partner_plus_applications')
        .update({
          workflow_status: 'approved',
          matched_profile_id: profile?.id || application.matched_profile_id || null,
          approved_partner_id: partnerId,
          approved_partner_user_id: accessGranted ? profile.id : null,
          access_granted: accessGranted,
          access_granted_at: accessGranted ? now : null,
          reviewed_at: now,
          reviewed_by: auth.user?.id || null,
          updated_at: now,
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (updateError) throw updateError;
      const rows = await attachMatchedProfiles(auth.adminClient, updated ? [updated] : []);
      return json({ ok: true, data: rows[0] || updated || application });
    }

    if (action === 'grant_access') {
      const partnerId = String(application.approved_partner_id || body?.partner_id || '').trim();
      if (!isUuid(partnerId)) {
        return json({ error: 'Approve/create the partner before granting panel access' }, 409);
      }

      const profile = await findProfileByEmail(auth.adminClient, application.email);
      if (!profile?.id) {
        return json({ error: 'No user account exists for this application e-mail yet' }, 409);
      }

      const { data: existing, error: existingError } = await auth.adminClient
        .from('partner_users')
        .select('id')
        .eq('partner_id', partnerId)
        .eq('user_id', profile.id)
        .maybeSingle();
      if (existingError) throw existingError;

      if (!existing?.id) {
        const { error: insertError } = await auth.adminClient
          .from('partner_users')
          .insert({ partner_id: partnerId, user_id: profile.id, role: 'owner' });
        if (insertError) throw insertError;
      }

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await auth.adminClient
        .from('partner_plus_applications')
        .update({
          matched_profile_id: profile.id,
          approved_partner_user_id: profile.id,
          access_granted: true,
          access_granted_at: now,
          reviewed_at: application.reviewed_at || now,
          reviewed_by: application.reviewed_by || auth.user?.id || null,
          updated_at: now,
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (updateError) throw updateError;
      const rows = await attachMatchedProfiles(auth.adminClient, updated ? [updated] : []);
      return json({ ok: true, data: rows[0] || updated || application });
    }

    return json({ error: 'Unsupported Partner+ action' }, 400);
  } catch (error) {
    console.error('[admin-partner-plus-applications:post] failed:', error);
    return json({ error: error?.message || 'Server error' }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    const { request, env } = context;
    const auth = await requirePartnerPlusAdmin(request, env);
    if (!auth.ok) {
      return json({ error: auth.error }, auth.status);
    }

    const url = new URL(request.url);
    const id = String(url.searchParams.get('id') || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json({ error: 'Invalid Partner+ application id' }, 400);
    }

    const { data, error } = await auth.adminClient
      .from('partner_plus_applications')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) {
      return json({ error: 'Partner+ application not found' }, 404);
    }

    return json({ ok: true, id: data.id });
  } catch (error) {
    console.error('[admin-partner-plus-applications:delete] failed:', error);
    return json({ error: error?.message || 'Server error' }, 500);
  }
}
