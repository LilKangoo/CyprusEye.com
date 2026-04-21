import { createSupabaseClients } from '../../_utils/supabaseAdmin.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const CONTACT_EMAIL = 'kontakt@wakacjecypr.com';
const DEFAULT_FROM = 'CyprusEye.com <no-reply@wakacjecypr.com>';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeField(value, maxLength = 0) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (maxLength > 0 && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return character;
    }
  });
}

async function parseBody(request) {
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return request.json().catch(() => ({}));
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const body = {};
    formData.forEach((value, key) => {
      body[key] = typeof value === 'string' ? value : '';
    });
    return body;
  }
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
}

function wantsJson(request) {
  const accept = String(request.headers.get('accept') || '').toLowerCase();
  return accept.includes('application/json') || accept.includes('text/json');
}

function getLanguage(body) {
  const language = String(body?.lang || 'en').trim().toLowerCase();
  return language === 'pl' ? 'pl' : 'en';
}

function getLocalizedMessage(language, key) {
  const messages = {
    success: {
      pl: 'Dziękujemy za zgłoszenie. Skontaktujemy się wkrótce.',
      en: 'Thank you for your application. We will contact you soon.',
    },
    validation: {
      pl: 'Wypełnij imię i adres e-mail.',
      en: 'Please provide your name and e-mail address.',
    },
    server: {
      pl: 'Nie udało się wysłać formularza kontaktowego.',
      en: 'We could not send the contact form.',
    },
  };
  return messages[key]?.[language] || messages[key]?.en || '';
}

function buildRedirectUrl(request, body, queryKey) {
  const fallback = String(body?.context || '').trim() === 'advertise-partner'
    ? '/advertise.html'
    : '/index.html';
  const referer = String(request.headers.get('referer') || '').trim();
  if (!referer) {
    return `${fallback}${fallback.includes('?') ? '&' : '?'}${queryKey}=1`;
  }

  try {
    const url = new URL(referer);
    url.searchParams.set(queryKey, '1');
    return `${url.pathname}${url.search}`;
  } catch (_) {
    return `${fallback}${fallback.includes('?') ? '&' : '?'}${queryKey}=1`;
  }
}

async function sendAdminEmail(env, { subject, text, html, replyTo }) {
  const to = String(env?.CONTACT_EMAIL || CONTACT_EMAIL).trim();
  if (!to || !subject || (!text && !html)) return false;

  const rawFrom = String(env?.SMTP_FROM || env?.MAIL_FROM || DEFAULT_FROM).trim();
  const match = rawFrom.match(/^(.*)<([^>]+)>\s*$/);
  const fromEmail = match ? match[2].trim() : rawFrom;
  const fromName = match ? String(match[1] || '').trim() || 'CyprusEye.com' : 'CyprusEye.com';

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [
      { type: 'text/plain', value: text || (html ? html.replace(/<[^>]*>/g, ' ') : '') },
      ...(html ? [{ type: 'text/html', value: html }] : []),
    ],
  };

  if (replyTo) {
    payload.reply_to = { email: replyTo };
  }

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('[contact-form] admin email failed:', response.status, details || response.statusText);
    return false;
  }

  return true;
}

function buildPartnerEmailPayload(entry) {
  const optionalFields = [
    ['Firma / marka / obiekt', entry.service],
    ['Typ partnera', entry.partner_type],
    ['Wybrany pakiet', entry.package_tier],
    ['Telefon / WhatsApp', entry.phone],
    ['Lokalizacja', entry.location],
    ['Strona / social media', entry.website],
    ['Opis usługi', entry.service_description],
    ['Rodzaj wycieczek', entry.tour_types],
    ['Języki obsługi', entry.tour_languages],
    ['Obszar działania', entry.tour_area],
    ['Rodzaj obiektu', entry.accommodation_type],
    ['Liczba miejsc / skala oferty', entry.accommodation_capacity],
    ['Kategoria miejsca / usługi', entry.local_service_category],
    ['Rabat / benefit / oferta', entry.local_service_offer],
    ['Język interfejsu', entry.language],
  ].filter(([, value]) => typeof value === 'string' && value.trim());

  const textLines = [
    'Otrzymaliśmy nowe zgłoszenie współpracy partnerskiej.',
    `Imię i nazwisko: ${entry.name}`,
    `Adres e-mail: ${entry.email}`,
    `ID zgłoszenia: ${entry.id}`,
    `Data zgłoszenia: ${entry.created_at}`,
  ];

  optionalFields.forEach(([label, value]) => {
    textLines.splice(textLines.length - 2, 0, `${label}: ${value}`);
  });

  textLines.push('');
  textLines.push('Dodatkowe informacje:');
  textLines.push(entry.message || 'nie podano');
  textLines.push('');
  if (entry.referer) textLines.push(`Strona źródłowa: ${entry.referer}`);
  if (entry.user_agent) textLines.push(`Przeglądarka: ${entry.user_agent}`);

  const htmlParts = [
    '<p>Otrzymaliśmy nowe zgłoszenie współpracy partnerskiej.</p>',
    '<ul>',
    `<li><strong>Imię i nazwisko:</strong> ${escapeHtml(entry.name)}</li>`,
    `<li><strong>Adres e-mail:</strong> ${escapeHtml(entry.email)}</li>`,
    `<li><strong>ID zgłoszenia:</strong> ${escapeHtml(entry.id)}</li>`,
    `<li><strong>Data zgłoszenia:</strong> ${escapeHtml(entry.created_at)}</li>`,
    '</ul>',
  ];

  if (optionalFields.length) {
    htmlParts.push('<ul>');
    optionalFields.forEach(([label, value]) => {
      htmlParts.push(`<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`);
    });
    htmlParts.push('</ul>');
  }

  htmlParts.push('<p><strong>Dodatkowe informacje:</strong></p>');
  htmlParts.push(`<p>${escapeHtml(entry.message || 'nie podano').replace(/\n/g, '<br />')}</p>`);

  if (entry.referer) {
    htmlParts.push(`<p><strong>Strona źródłowa:</strong> ${escapeHtml(entry.referer)}</p>`);
  }
  if (entry.user_agent) {
    htmlParts.push(`<p><strong>Przeglądarka:</strong> ${escapeHtml(entry.user_agent)}</p>`);
  }

  return {
    subject: 'Nowe zgłoszenie współpracy partnerskiej',
    text: textLines.join('\n'),
    html: htmlParts.join(''),
  };
}

function buildGenericEmailPayload(entry) {
  const lines = [
    'Otrzymaliśmy nowe zgłoszenie z formularza kontaktowego.',
    `Imię i nazwisko: ${entry.name}`,
    `Adres e-mail: ${entry.email}`,
    entry.service ? `Usługa / temat: ${entry.service}` : '',
    '',
    'Wiadomość:',
    entry.message || 'nie podano',
  ].filter(Boolean);

  return {
    subject: 'Nowe zgłoszenie z formularza kontaktowego',
    text: lines.join('\n'),
    html: `
      <p>Otrzymaliśmy nowe zgłoszenie z formularza kontaktowego.</p>
      <ul>
        <li><strong>Imię i nazwisko:</strong> ${escapeHtml(entry.name)}</li>
        <li><strong>Adres e-mail:</strong> ${escapeHtml(entry.email)}</li>
        ${entry.service ? `<li><strong>Usługa / temat:</strong> ${escapeHtml(entry.service)}</li>` : ''}
      </ul>
      <p><strong>Wiadomość:</strong></p>
      <p>${escapeHtml(entry.message || 'nie podano').replace(/\n/g, '<br />')}</p>
    `,
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await parseBody(request);
    const language = getLanguage(body);
    const name = sanitizeField(body?.name, 120);
    const email = normalizeEmail(body?.email);

    if (!name || !email) {
      if (wantsJson(request)) {
        return json({ error: getLocalizedMessage(language, 'validation') }, 422);
      }
      return Response.redirect(buildRedirectUrl(request, body, 'error'), 303);
    }

    const entry = {
      id: `contact-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      source_context: sanitizeField(body?.context, 60) || null,
      workflow_status: 'pending',
      language,
      partner_type: sanitizeField(body?.partner_type, 40) || null,
      package_tier: sanitizeField(body?.package_tier, 40) || null,
      service: sanitizeField(body?.service, 120),
      name,
      email,
      phone: sanitizeField(body?.phone, 80) || null,
      location: sanitizeField(body?.location, 140) || null,
      website: sanitizeField(body?.website, 240) || null,
      service_description: sanitizeField(body?.service_description, 1500) || null,
      tour_types: sanitizeField(body?.tour_types, 240) || null,
      tour_languages: sanitizeField(body?.tour_languages, 240) || null,
      tour_area: sanitizeField(body?.tour_area, 240) || null,
      accommodation_type: sanitizeField(body?.accommodation_type, 140) || null,
      accommodation_capacity: sanitizeField(body?.accommodation_capacity, 140) || null,
      local_service_category: sanitizeField(body?.local_service_category, 180) || null,
      local_service_offer: sanitizeField(body?.local_service_offer, 240) || null,
      message: sanitizeField(body?.message, 2000) || null,
      referer: sanitizeField(request.headers.get('referer'), 400) || null,
      user_agent: sanitizeField(request.headers.get('user-agent'), 500) || null,
      created_at: new Date().toISOString(),
    };

    const isPartnerLead = entry.source_context === 'advertise-partner';
    if (isPartnerLead && (!entry.partner_type || !entry.package_tier || !entry.service || !entry.location || !entry.service_description)) {
      if (wantsJson(request)) {
        return json({ error: getLocalizedMessage(language, 'validation') }, 422);
      }
      return Response.redirect(buildRedirectUrl(request, body, 'error'), 303);
    }

    if (isPartnerLead) {
      const { adminClient } = createSupabaseClients(env, request.headers.get('Authorization'));
      const { data: insertedApplication, error } = await adminClient
        .from('partner_plus_applications')
        .insert({
          source_context: entry.source_context,
          workflow_status: entry.workflow_status,
          language: entry.language,
          partner_type: entry.partner_type,
          package_tier: entry.package_tier,
          service: entry.service || 'Partner application',
          name: entry.name,
          email: entry.email,
          phone: entry.phone,
          location: entry.location,
          website: entry.website,
          service_description: entry.service_description,
          tour_types: entry.tour_types,
          tour_languages: entry.tour_languages,
          tour_area: entry.tour_area,
          accommodation_type: entry.accommodation_type,
          accommodation_capacity: entry.accommodation_capacity,
          local_service_category: entry.local_service_category,
          local_service_offer: entry.local_service_offer,
          message: entry.message,
          referer: entry.referer,
          user_agent: entry.user_agent,
        })
        .select('id, created_at')
        .single();
      if (error) throw error;
      if (insertedApplication?.id) {
        entry.id = insertedApplication.id;
      }
      if (insertedApplication?.created_at) {
        entry.created_at = insertedApplication.created_at;
      }
    }

    const emailPayload = isPartnerLead ? buildPartnerEmailPayload(entry) : buildGenericEmailPayload(entry);
    await sendAdminEmail(env, {
      ...emailPayload,
      replyTo: entry.email,
    });

    if (wantsJson(request)) {
      return json({ ok: true, message: getLocalizedMessage(language, 'success') });
    }

    return Response.redirect(buildRedirectUrl(request, body, 'success'), 303);
  } catch (error) {
    console.error('[contact-form] failed:', error);
    const language = 'pl';
    if (wantsJson(request)) {
      return json({ error: getLocalizedMessage(language, 'server') }, 500);
    }
    return Response.redirect(buildRedirectUrl(request, {}, 'error'), 303);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
    },
  });
}
