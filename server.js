import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR_PATH = path.join(__dirname, 'data');
const DATA_FILE_PATH = path.join(DATA_DIR_PATH, 'users.json');
const SPREADSHEET_FILE_PATH = path.join(DATA_DIR_PATH, 'users.csv');
const COMMUNITY_JOURNAL_FILE_PATH = path.join(DATA_DIR_PATH, 'community-journal.json');
const FORM_SUBMISSIONS_FILE_PATH = path.join(DATA_DIR_PATH, 'form-submissions.json');
const NOT_FOUND_PAGE_PATH = path.join(__dirname, '404.html');
const PASSWORD_RESET_URL = process.env.PASSWORD_RESET_URL || 'http://localhost:3000/reset-password';
const PASSWORD_RESET_TOKEN_TTL_MS = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MS || 1000 * 60 * 60);
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '/');
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'kontakt@wakacjecypr.com';
const SMTP_FROM = process.env.SMTP_FROM || 'WakacjeCypr Quest <no-reply@wakacjecypr.com>';

let mailTransport = null;
let mailTransportInitialized = false;

let cachedNotFoundPage = null;

function applySecurityHeaders(res) {
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://esm.sh https://*.esm.sh https://unpkg.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://daoohnbnnowmmcizgvrq.supabase.co https://*.supabase.co wss://daoohnbnnowmmcizgvrq.supabase.co wss://*.supabase.co https://www.google-analytics.com https://region1.google-analytics.com https://esm.sh https://*.esm.sh https://unpkg.com https://*.tile.openstreetmap.org; frame-src 'self' https://docs.google.com; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function jsonResponse(res, statusCode, data) {
  const body = JSON.stringify(data);
  applySecurityHeaders(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function getMailTransport() {
  if (mailTransportInitialized) {
    return mailTransport;
  }
  mailTransportInitialized = true;

  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn('SMTP_HOST nie został ustawiony – powiadomienia e-mail będą logowane w konsoli.');
    mailTransport = null;
    return mailTransport;
  }

  const port = Number.parseInt(process.env.SMTP_PORT || '', 10);
  const secureEnv = process.env.SMTP_SECURE;
  const secure = secureEnv ? secureEnv === 'true' : port === 465;

  const transportConfig = {
    host,
    secure,
  };

  if (Number.isFinite(port)) {
    transportConfig.port = port;
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (user && pass) {
    transportConfig.auth = { user, pass };
  }

  mailTransport = nodemailer.createTransport(transportConfig);
  return mailTransport;
}

function escapeHtml(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

async function sendContactNotification(entry) {
  const textLines = [
    'Otrzymaliśmy nowe zgłoszenie z formularza wycieczek WakacjeCypr.',
    `Imię i nazwisko: ${entry.name}`,
    `Adres e-mail: ${entry.email}`,
    `Preferowana usługa: ${entry.service || 'nie podano'}`,
    `Język interfejsu: ${entry.language || 'nie podano'}`,
    '',
    'Wiadomość:',
    entry.message,
    '',
    `ID zgłoszenia: ${entry.id}`,
    `Data zgłoszenia: ${entry.createdAt}`,
  ];

  if (entry.referer) {
    textLines.push(`Strona źródłowa: ${entry.referer}`);
  }
  if (entry.userAgent) {
    textLines.push(`Przeglądarka: ${entry.userAgent}`);
  }

  const text = textLines.join('\n');
  const htmlParts = [
    '<p>Otrzymaliśmy nowe zgłoszenie z formularza wycieczek WakacjeCypr.</p>',
    '<ul>',
    `<li><strong>Imię i nazwisko:</strong> ${escapeHtml(entry.name)}</li>`,
    `<li><strong>Adres e-mail:</strong> ${escapeHtml(entry.email)}</li>`,
    `<li><strong>Preferowana usługa:</strong> ${escapeHtml(entry.service || 'nie podano')}</li>`,
    `<li><strong>Język interfejsu:</strong> ${escapeHtml(entry.language || 'nie podano')}</li>`,
    `<li><strong>ID zgłoszenia:</strong> ${escapeHtml(entry.id)}</li>`,
    `<li><strong>Data zgłoszenia:</strong> ${escapeHtml(entry.createdAt)}</li>`,
    '</ul>',
    '<p><strong>Wiadomość:</strong></p>',
    `<p>${escapeHtml(entry.message).replace(/\n/g, '<br />')}</p>`,
  ];

  if (entry.referer) {
    htmlParts.push(`<p><strong>Strona źródłowa:</strong> ${escapeHtml(entry.referer)}</p>`);
  }
  if (entry.userAgent) {
    htmlParts.push(`<p><strong>Przeglądarka:</strong> ${escapeHtml(entry.userAgent)}</p>`);
  }

  const html = htmlParts.join('');
  const subject = 'Nowe zgłoszenie z formularza wycieczek';

  const transport = getMailTransport();
  if (!transport) {
    console.warn('Powiadomienie e-mail nie zostało wysłane – brak konfiguracji SMTP.');
    console.log(`\n===== Symulowana wiadomość e-mail =====\nDo: ${CONTACT_EMAIL}\nTemat: ${subject}\n\n${text}\n===== Koniec wiadomości =====\n`);
    return;
  }

  await transport.sendMail({
    from: SMTP_FROM,
    to: CONTACT_EMAIL,
    subject,
    text,
    html,
    replyTo: entry.email,
  });
}

async function sendAdminNotificationEmail(params) {
  const to = Array.isArray(params?.to) ? params.to : typeof params?.to === 'string' ? [params.to] : [];
  const subject = typeof params?.subject === 'string' ? params.subject : '';
  const text = typeof params?.text === 'string' ? params.text : '';
  const html = typeof params?.html === 'string' ? params.html : '';

  if (!to.length || !subject || (!text && !html)) {
    throw new Error('Invalid admin notification payload');
  }

  const transport = getMailTransport();
  if (!transport) {
    console.warn('Powiadomienie admina nie zostało wysłane – brak konfiguracji SMTP.');
    console.log(`\n===== Symulowana wiadomość e-mail (admin relay) =====\nDo: ${to.join(', ')}\nTemat: ${subject}\n\n${text}\n===== Koniec wiadomości =====\n`);
    return;
  }

  await transport.sendMail({
    from: SMTP_FROM,
    to: to.join(','),
    subject,
    text,
    html,
  });
}

async function ensureSpreadsheetFile() {
  await fs.mkdir(DATA_DIR_PATH, { recursive: true });
  try {
    await fs.access(SPREADSHEET_FILE_PATH);
  } catch (error) {
    const header = 'id,email,name,createdAt,updatedAt\n';
    await fs.writeFile(SPREADSHEET_FILE_PATH, header, 'utf-8');
  }
}

async function handleAdminNotificationRelay(req, res) {
  try {
    const required = (process.env.ADMIN_NOTIFY_SECRET || '').trim();
    if (required) {
      const provided = (req.headers['x-admin-notify-secret'] || '').toString().trim();
      if (!provided || provided !== required) {
        return jsonResponse(res, 401, { error: 'Unauthorized' });
      }
    }

    const body = await parseRequestBody(req);
    await sendAdminNotificationEmail(body);
    return jsonResponse(res, 200, { ok: true });
  } catch (error) {
    console.error('Błąd podczas wysyłki powiadomienia admina:', error);
    return jsonResponse(res, 500, { error: error?.message || 'Email send failed' });
  }
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function appendUserToSpreadsheet(user) {
  const row = [
    user.id,
    user.email,
    user.name ?? '',
    user.createdAt,
    user.updatedAt,
  ]
    .map(escapeCsvValue)
    .join(',');
  await ensureSpreadsheetFile();
  await fs.appendFile(SPREADSHEET_FILE_PATH, `${row}\n`, 'utf-8');
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR_PATH, { recursive: true });
  try {
    await fs.access(DATA_FILE_PATH);
  } catch (error) {
    const initialData = { users: [], resetTokens: [] };
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

async function ensureCommunityJournalFile() {
  await fs.mkdir(DATA_DIR_PATH, { recursive: true });
  try {
    await fs.access(COMMUNITY_JOURNAL_FILE_PATH);
  } catch (error) {
    const initialData = { entries: [] };
    await fs.writeFile(COMMUNITY_JOURNAL_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

async function ensureFormSubmissionsFile() {
  await fs.mkdir(DATA_DIR_PATH, { recursive: true });
  try {
    await fs.access(FORM_SUBMISSIONS_FILE_PATH);
  } catch (error) {
    await fs.writeFile(FORM_SUBMISSIONS_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

async function readData() {
  await ensureDataFile();
  const file = await fs.readFile(DATA_FILE_PATH, 'utf-8');
  return JSON.parse(file);
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

async function readCommunityJournal() {
  await ensureCommunityJournalFile();
  try {
    const file = await fs.readFile(COMMUNITY_JOURNAL_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(file);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    return { entries: parsed.entries };
  } catch (error) {
    console.error('Nie udało się wczytać dziennika podróży:', error);
    return { entries: [] };
  }
}

async function writeCommunityJournal(data) {
  const payload = {
    entries: Array.isArray(data?.entries) ? data.entries : [],
  };
  await fs.writeFile(COMMUNITY_JOURNAL_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

async function appendFormSubmission(entry) {
  await ensureFormSubmissionsFile();
  try {
    const raw = await fs.readFile(FORM_SUBMISSIONS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const submissions = Array.isArray(parsed) ? parsed : [];
    submissions.unshift(entry);
    const limited = submissions.slice(0, 500);
    await fs.writeFile(FORM_SUBMISSIONS_FILE_PATH, JSON.stringify(limited, null, 2), 'utf-8');
  } catch (error) {
    console.error('Nie udało się zapisać zgłoszenia formularza:', error);
  }
}

async function parseRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) {
    return {};
  }
  const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }

  if (!contentType || contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error('INVALID_JSON');
    }
  }

  if (contentType.includes('text/plain')) {
    return { text: raw };
  }

  throw new Error('INVALID_JSON');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  const [salt, originalHash] = storedHash.split(':');
  const candidateHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(candidateHash, 'hex'));
}

async function sendPasswordResetEmail(email, token) {
  const resetLink = `${PASSWORD_RESET_URL}?token=${token}`;
  const message = `\n===== Symulowana wiadomość e-mail =====\nDo: ${email}\nTemat: Resetowanie hasła - AppGPT\n\nKliknij w poniższy link, aby ustawić nowe hasło:\n${resetLink}\n\nJeśli to nie Ty zainicjowałeś reset, zignoruj tę wiadomość.\n===== Koniec wiadomości =====\n`;
  console.info(message);
}

async function handleRegister(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { email, password, name } = body || {};

    if (!email || typeof email !== 'string') {
      return jsonResponse(res, 400, { error: 'Adres e-mail jest wymagany.' });
    }
    if (!validatePassword(password)) {
      return jsonResponse(res, 400, { error: 'Hasło musi składać się z co najmniej 8 znaków.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const data = await readData();

    if (data.users.some((user) => user.email === normalizedEmail)) {
      return jsonResponse(res, 409, { error: 'Użytkownik z takim adresem e-mail już istnieje.' });
    }

    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name: typeof name === 'string' && name.trim() ? name.trim() : null,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    data.users.push(user);
    await writeData(data);
    await appendUserToSpreadsheet(user);
    return jsonResponse(res, 201, { user: sanitizeUser(user) });
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format JSON.' });
    }
    console.error('Błąd rejestracji użytkownika:', error);
    return jsonResponse(res, 500, { error: 'Wystąpił błąd podczas rejestracji.' });
  }
}

async function handleLogin(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { email, password } = body || {};

    if (!email || typeof email !== 'string' || typeof password !== 'string') {
      return jsonResponse(res, 400, { error: 'Adres e-mail i hasło są wymagane.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const data = await readData();
    const user = data.users.find((candidate) => candidate.email === normalizedEmail);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return jsonResponse(res, 401, { error: 'Nieprawidłowy e-mail lub hasło.' });
    }

    return jsonResponse(res, 200, { user: sanitizeUser(user) });
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format JSON.' });
    }
    console.error('Błąd logowania:', error);
    return jsonResponse(res, 500, { error: 'Wystąpił błąd podczas logowania.' });
  }
}

async function handlePasswordResetRequest(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { email } = body || {};

    if (!email || typeof email !== 'string') {
      return jsonResponse(res, 400, { error: 'Adres e-mail jest wymagany.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const data = await readData();
    const user = data.users.find((candidate) => candidate.email === normalizedEmail);

    if (user) {
      const token = createToken();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();

      data.resetTokens = data.resetTokens.filter((entry) => entry.userId !== user.id);
      data.resetTokens.push({ token, userId: user.id, expiresAt });
      await writeData(data);

      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (emailError) {
        console.error('Nie udało się wysłać wiadomości resetującej hasło:', emailError);
      }
    }

    return jsonResponse(res, 200, {
      message: 'Jeśli konto istnieje, wiadomość z instrukcją resetu została wysłana.',
    });
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format JSON.' });
    }
    console.error('Błąd podczas inicjowania resetowania hasła:', error);
    return jsonResponse(res, 500, { error: 'Wystąpił błąd podczas przetwarzania prośby.' });
  }
}

async function handlePasswordResetConfirm(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { token, password } = body || {};

    if (!token || typeof token !== 'string') {
      return jsonResponse(res, 400, { error: 'Token resetu jest wymagany.' });
    }
    if (!validatePassword(password)) {
      return jsonResponse(res, 400, { error: 'Hasło musi składać się z co najmniej 8 znaków.' });
    }

    const data = await readData();
    const tokenIndex = data.resetTokens.findIndex((entry) => entry.token === token);

    if (tokenIndex === -1) {
      return jsonResponse(res, 400, { error: 'Nieprawidłowy lub wygasły token.' });
    }

    const tokenEntry = data.resetTokens[tokenIndex];
    if (new Date(tokenEntry.expiresAt).getTime() < Date.now()) {
      data.resetTokens.splice(tokenIndex, 1);
      await writeData(data);
      return jsonResponse(res, 400, { error: 'Nieprawidłowy lub wygasły token.' });
    }

    const user = data.users.find((candidate) => candidate.id === tokenEntry.userId);
    if (!user) {
      data.resetTokens.splice(tokenIndex, 1);
      await writeData(data);
      return jsonResponse(res, 400, { error: 'Nieprawidłowy lub wygasły token.' });
    }

    user.passwordHash = hashPassword(password);
    user.updatedAt = new Date().toISOString();
    data.resetTokens.splice(tokenIndex, 1);
    await writeData(data);

    return jsonResponse(res, 200, { message: 'Hasło zostało zresetowane.' });
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format JSON.' });
    }
    console.error('Błąd podczas resetowania hasła:', error);
    return jsonResponse(res, 500, { error: 'Wystąpił błąd podczas resetowania hasła.' });
  }
}

const routes = {
  'POST /api/register': handleRegister,
  'POST /api/login': handleLogin,
  'POST /api/password-reset/request': handlePasswordResetRequest,
  'POST /api/password-reset/confirm': handlePasswordResetConfirm,
  'GET /api/community/journal': handleListCommunityJournal,
  'POST /api/community/journal': handleCreateCommunityJournal,
  'GET /api/community/journal/stream': handleCommunityJournalStream,
  'POST /api/forms/coupon-search': handleCouponSearchForm,
  'POST /api/forms/contact': handleContactForm,
  'POST /api/notifications/admin': handleAdminNotificationRelay,
};

const journalStreamClients = new Set();

function broadcastJournalEvent(event, data) {
  if (!journalStreamClients.size) {
    return;
  }

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of journalStreamClients) {
    const { res, heartbeat } = client;
    try {
      res.write(payload);
    } catch (error) {
      clearInterval(heartbeat);
      journalStreamClients.delete(client);
    }
  }
}

async function handleListCommunityJournal(req, res) {
  try {
    const data = await readCommunityJournal();
    return jsonResponse(res, 200, { entries: data.entries });
  } catch (error) {
    console.error('Błąd podczas odczytywania wpisów dziennika:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się pobrać wpisów dziennika.' });
  }
}

function sanitizeJournalString(value, { maxLength } = {}) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!maxLength || trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength);
}

async function handleCreateCommunityJournal(req, res) {
  try {
    const body = await parseRequestBody(req);
    const title = sanitizeJournalString(body?.title, { maxLength: 200 });
    const notes = sanitizeJournalString(body?.notes, { maxLength: 4000 });
    if (!notes) {
      return jsonResponse(res, 400, { error: 'Treść wpisu jest wymagana.' });
    }

    const photoDataUrl = typeof body?.photoDataUrl === 'string' ? body.photoDataUrl : null;
    const now = new Date().toISOString();
    const entry = {
      id: `journal-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      title,
      notes,
      photoDataUrl,
      createdAt: now,
      updatedAt: now,
      userKey:
        typeof body?.userKey === 'string' && body.userKey.trim() ? body.userKey.trim() : null,
      username:
        typeof body?.username === 'string' && body.username.trim()
          ? body.username.trim()
          : 'Podróżnik',
      likedBy: [],
      comments: [],
    };

    const data = await readCommunityJournal();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    await writeCommunityJournal({ entries: [entry, ...entries] });
    broadcastJournalEvent('journal-entry-created', { entry });

    return jsonResponse(res, 201, { entry });
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format JSON.' });
    }
    console.error('Błąd podczas zapisywania wpisu w dzienniku:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się zapisać wpisu w dzienniku.' });
  }
}

function buildRedirectTarget(targetPath) {
  if (!targetPath) {
    return '/';
  }
  try {
    const url = new URL(targetPath, 'http://localhost');
    return `${url.pathname}${url.search}`;
  } catch (error) {
    return targetPath;
  }
}

async function handleCouponSearchForm(req, res) {
  try {
    const body = await parseRequestBody(req);
    const couponQuery = typeof body?.coupon === 'string' ? body.coupon.trim() : '';
    const language = typeof body?.lang === 'string' ? body.lang.trim() : null;
    const now = new Date().toISOString();

    await appendFormSubmission({
      id: `coupon-search-${Date.now()}`,
      type: 'coupon-search',
      coupon: couponQuery,
      language,
      userAgent: req.headers['user-agent'] || null,
      referer: req.headers.referer || null,
      createdAt: now,
    });

    const redirectUrl = couponQuery
      ? `/kupon.html?coupon=${encodeURIComponent(couponQuery)}`
      : '/kupon.html';

    if ((req.headers.accept || '').includes('application/json')) {
      return jsonResponse(res, 200, { redirectUrl });
    }

    applySecurityHeaders(res);
    res.writeHead(303, {
      Location: redirectUrl,
      'Cache-Control': 'no-cache',
    });
    res.end();
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format danych formularza.' });
    }
    console.error('Błąd podczas obsługi wyszukiwarki kuponów:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się przekierować wyszukiwarki kuponów.' });
  }
}

function sanitizeContactField(value, { maxLength }) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

async function handleContactForm(req, res) {
  try {
    const body = await parseRequestBody(req);
    const name = sanitizeContactField(body?.name, { maxLength: 120 });
    const email = normalizeEmail(body?.email || '');
    const message = sanitizeContactField(body?.message, { maxLength: 2000 });
    const service = sanitizeContactField(body?.service, { maxLength: 120 });
    const language = sanitizeContactField(body?.lang, { maxLength: 10 });

    if (!name || !email || !message) {
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('application/json')) {
        return jsonResponse(res, 422, { error: 'Wypełnij imię, e-mail oraz wiadomość.' });
      }
      const referer = req.headers.referer ? buildRedirectTarget(req.headers.referer) : null;
      const target = referer ? `${referer}${referer.includes('?') ? '&' : '?'}error=1` : '/index.html?error=1';
      applySecurityHeaders(res);
      res.writeHead(303, {
        Location: target,
        'Cache-Control': 'no-cache',
      });
      res.end();
      return;
    }

    const entry = {
      id: `contact-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      type: 'contact',
      name,
      email,
      message,
      service: service || null,
      language: language || null,
      userAgent: req.headers['user-agent'] || null,
      referer: req.headers.referer || null,
      createdAt: new Date().toISOString(),
    };

    await appendFormSubmission(entry);
    await sendContactNotification(entry);

    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('application/json')) {
      return jsonResponse(res, 200, { message: 'Dziękujemy za zgłoszenie. Skontaktujemy się wkrótce.' });
    }

    const referer = req.headers.referer ? buildRedirectTarget(req.headers.referer) : null;
    const target = referer ? `${referer}${referer.includes('?') ? '&' : '?'}success=1` : '/index.html?success=1';
    applySecurityHeaders(res);
    res.writeHead(303, {
      Location: target,
      'Cache-Control': 'no-cache',
    });
    res.end();
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('application/json')) {
        return jsonResponse(res, 400, { error: 'Niepoprawny format danych formularza.' });
      }
      const referer = req.headers.referer ? buildRedirectTarget(req.headers.referer) : null;
      const target = referer ? `${referer}${referer.includes('?') ? '&' : '?'}error=1` : '/index.html?error=1';
      applySecurityHeaders(res);
      res.writeHead(303, {
        Location: target,
        'Cache-Control': 'no-cache',
      });
      res.end();
      return;
    }
    console.error('Błąd podczas wysyłania formularza kontaktowego:', error);
    if ((req.headers.accept || '').includes('application/json')) {
      return jsonResponse(res, 500, { error: 'Nie udało się wysłać formularza kontaktowego.' });
    }
    applySecurityHeaders(res);
    res.writeHead(303, {
      Location: '/index.html?error=1',
      'Cache-Control': 'no-cache',
    });
    res.end();
  }
}

function handleCommunityJournalStream(req, res) {
  applySecurityHeaders(res);
  if (req.httpVersionMajor < 2) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
  } else {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    });
  }

  res.write('retry: 5000\n\n');

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
      res.end();
    }
  }, 30000);

  const client = { res, heartbeat };
  journalStreamClients.add(client);

  req.on('close', () => {
    clearInterval(heartbeat);
    journalStreamClients.delete(client);
  });
}

function resolveRoute(method, pathname) {
  const normalizedMethod = method.toUpperCase();
  const directKey = `${normalizedMethod} ${pathname}`;
  if (routes[directKey]) {
    return routes[directKey];
  }

  if (BASE_PATH !== '/' && pathname.startsWith(`${BASE_PATH}/`)) {
    const alternativeKey = `${normalizedMethod} ${pathname.slice(BASE_PATH.length)}`;
    if (routes[alternativeKey]) {
      return routes[alternativeKey];
    }
  }

  return null;
}

function createServer() {
  return http.createServer(async (req, res) => {
    if (!req.url || !req.method) {
      return jsonResponse(res, 400, { error: 'Nieobsługiwane żądanie.' });
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    const isHealthRequest =
      url.pathname === '/health' || (BASE_PATH !== '/' && url.pathname === `${BASE_PATH}/health`);

    if ((req.method === 'GET' || req.method === 'HEAD') && isHealthRequest) {
      if (req.method === 'HEAD') {
        const body = JSON.stringify({ status: 'ok' });
        applySecurityHeaders(res);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
        });
        res.end();
        return;
      }

      return jsonResponse(res, 200, { status: 'ok' });
    }

    const faviconPath = BASE_PATH === '/' ? '/favicon.ico' : `${BASE_PATH}/favicon.ico`;
    if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/favicon.ico' || url.pathname === faviconPath)) {
      applySecurityHeaders(res);
      res.writeHead(204, {
        'Cache-Control': 'public, max-age=86400',
      });
      res.end();
      return;
    }

    const handler = resolveRoute(req.method, url.pathname);

    if (handler) {
      return handler(req, res);
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const served = await tryServeStaticFile(req, url.pathname, res);
      if (served) {
        return;
      }
      await serveNotFoundPage(req, res);
      return;
    }

    return jsonResponse(res, 404, { error: 'Endpoint nie istnieje.' });
  });
}

export async function start() {
  await ensureSpreadsheetFile();
  await ensureDataFile();
  await ensureCommunityJournalFile();
  await ensureFormSubmissionsFile();
  const port = process.env.PORT !== undefined ? Number(process.env.PORT) : 3001;
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      console.log(`Serwer API uruchomiony na porcie ${actualPort}`);
      resolve(server);
    });
  });
}

export { createServer, ensureDataFile };

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  start();
}
function normalizeBasePath(candidate) {
  if (!candidate) {
    return '/';
  }
  let basePath = candidate.trim();
  if (!basePath.startsWith('/')) {
    basePath = `/${basePath}`;
  }
  if (basePath.length > 1 && basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }
  return basePath || '/';
}

function isWithinBasePath(pathname) {
  if (BASE_PATH === '/') {
    return true;
  }
  return pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`);
}

function extractPathRelativeToBase(pathname) {
  if (BASE_PATH === '/') {
    if (!pathname || pathname === '/') {
      return '';
    }
    return pathname.slice(1);
  }

  if (pathname === BASE_PATH || pathname === `${BASE_PATH}/`) {
    return '';
  }

  if (pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length + 1);
  }

  return null;
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.webmanifest':
      return 'application/manifest+json; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

async function serveStaticAsset(req, res, filePath, stats = null) {
  const fileStats = stats ?? (await fs.stat(filePath));
  if (fileStats.isDirectory()) {
    return false;
  }

  const mimeType = getMimeType(filePath);
  const shouldNoCache =
    mimeType.startsWith('text/html') ||
    filePath.endsWith(`${path.sep}sw.js`) ||
    filePath.endsWith('.webmanifest');
  const headers = {
    'Content-Type': mimeType,
    'Content-Length': fileStats.size,
    'Cache-Control': shouldNoCache ? 'no-cache' : 'public, max-age=31536000, immutable',
  };

  applySecurityHeaders(res);
  res.writeHead(200, headers);

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  const file = await fs.readFile(filePath);
  res.end(file);
  return true;
}

async function tryServeStaticFile(req, pathname, res) {
  if (!isWithinBasePath(pathname)) {
    return false;
  }

  const relativePath = extractPathRelativeToBase(pathname);
  if (relativePath === null) {
    return false;
  }

  const targetPath = relativePath ? relativePath : 'index.html';

  if (targetPath.startsWith('data/')) {
    return false;
  }

  const absolutePath = path.resolve(__dirname, targetPath);
  if (!absolutePath.startsWith(__dirname)) {
    return false;
  }

  try {
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      const indexPath = path.join(absolutePath, 'index.html');
      try {
        const servedIndex = await serveStaticAsset(req, res, indexPath);
        if (servedIndex) {
          return true;
        }
      } catch (indexError) {
        if (indexError.code !== 'ENOENT') {
          console.error('Nie udało się odczytać pliku indeksu katalogu:', indexError);
        }
      }
      return false;
    }

    const served = await serveStaticAsset(req, res, absolutePath, stats);
    if (served) {
      return true;
    }
  } catch (error) {
    if (error.code === 'ENOENT' && !targetPath.endsWith('.html')) {
      // Retry HTML fallback for paths like /app/achievements
      const htmlCandidate = `${targetPath}.html`;
      const htmlPath = path.resolve(__dirname, htmlCandidate);
      if (htmlPath.startsWith(__dirname)) {
        try {
          const servedHtml = await serveStaticAsset(req, res, htmlPath);
          if (servedHtml) {
            return true;
          }
        } catch (htmlError) {
          if (htmlError.code !== 'ENOENT') {
            console.error('Nie udało się odczytać pliku statycznego:', htmlError);
          }
        }
      }
    } else if (error.code !== 'ENOENT') {
      console.error('Nie udało się odczytać pliku statycznego:', error);
    }
  }

  return false;
}

async function serveNotFoundPage(req, res) {
  try {
    if (!cachedNotFoundPage) {
      cachedNotFoundPage = await fs.readFile(NOT_FOUND_PAGE_PATH, 'utf-8');
    }
    const body = cachedNotFoundPage;
    applySecurityHeaders(res);
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(body, 'utf-8'),
      'Cache-Control': 'no-cache',
    };
    res.writeHead(404, headers);
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(body);
    }
  } catch (error) {
    const fallback = '404 Not Found';
    applySecurityHeaders(res);
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(fallback, 'utf-8'),
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : fallback);
  }
}
