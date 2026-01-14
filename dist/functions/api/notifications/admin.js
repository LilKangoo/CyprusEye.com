export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, x-admin-notify-secret',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const required = String(env?.ADMIN_NOTIFY_SECRET || '').trim();
  if (required) {
    const provided = String(request.headers.get('x-admin-notify-secret') || '').trim();
    if (!provided || provided !== required) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let body;
  try {
    body = await request.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const to = Array.isArray(body?.to)
    ? body.to.map((v) => String(v || '').trim()).filter(Boolean)
    : typeof body?.to === 'string'
      ? [String(body.to).trim()].filter(Boolean)
      : [];

  const subject = typeof body?.subject === 'string' ? body.subject : '';
  const text = typeof body?.text === 'string' ? body.text : '';
  const html = typeof body?.html === 'string' ? body.html : '';

  if (!to.length || !subject || (!text && !html)) {
    return new Response(JSON.stringify({ error: 'Invalid admin notification payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawFrom = String(env?.SMTP_FROM || env?.MAIL_FROM || 'CyprusEye.com <no-reply@wakacjecypr.com>').trim();
  const match = rawFrom.match(/^(.*)<([^>]+)>\s*$/);
  const fromEmail = match ? match[2].trim() : rawFrom;
  const fromName = 'CyprusEye.com';

  const payload = {
    personalizations: [{ to: to.map((email) => ({ email })) }],
    from: {
      email: fromEmail,
      name: fromName,
    },
    subject,
    content: [
      { type: 'text/plain', value: text || (html ? html.replace(/<[^>]*>/g, ' ') : '') },
      ...(html ? [{ type: 'text/html', value: html }] : []),
    ],
  };

  const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    let errText = '';
    try {
      errText = await resp.text();
    } catch (_e) {
      errText = '';
    }

    return new Response(JSON.stringify({ error: 'Email send failed', status: resp.status, details: errText || resp.statusText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
