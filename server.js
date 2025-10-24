import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'zlib';
import {
  initSqliteStore,
  createUser as createStoredUser,
  getUserByEmail as getStoredUserByEmail,
  getUserById as getStoredUserById,
  updateUserPassword as updateStoredUserPassword,
  replaceResetTokenForUser,
  getResetToken as getStoredResetToken,
  deleteResetToken as deleteStoredResetToken,
  insertJournalEntry as storeJournalEntry,
  listJournalEntries as listStoredJournalEntries,
  recordFormSubmission as storeFormSubmission,
  pruneFormSubmissions as pruneStoredFormSubmissions,
} from './lib/persistence/sqliteStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR_PATH = path.join(__dirname, 'data');
const NOT_FOUND_PAGE_PATH = path.join(__dirname, '404.html');
const PASSWORD_RESET_URL = process.env.PASSWORD_RESET_URL || 'http://localhost:3000/reset-password';
const PASSWORD_RESET_TOKEN_TTL_MS = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MS || 1000 * 60 * 60);
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '/');
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'kontakt@wakacjecypr.com';
const SMTP_FROM = process.env.SMTP_FROM || 'WakacjeCypr Quest <no-reply@wakacjecypr.com>';
const EXPORT_HASH_SECRET = process.env.EXPORT_HASH_SECRET || 'cypruseye-export-salt';
const COMMUNITY_JOURNAL_TOKEN = process.env.COMMUNITY_JOURNAL_TOKEN || process.env.COMMUNITY_JOURNAL_API_KEY;
const MAX_JOURNAL_PHOTO_SIZE_BYTES = 1_500_000; // ~1.5 MB base64 payload cap
const LANGUAGE_COOKIE_NAME = 'ce_lang';
const DEFAULT_LANGUAGE = 'pl';
const SUPPORTED_LANGUAGES = new Map([
  ['pl', { code: 'pl', dir: 'ltr' }],
  ['en', { code: 'en', dir: 'ltr' }],
  ['el', { code: 'el', dir: 'ltr' }],
]);
const NOSCRIPT_LANGUAGE_COPY = new Map([
  ['pl', { label: 'Wybierz język:' }],
  ['en', { label: 'Choose language:' }],
  ['el', { label: 'Επιλέξτε γλώσσα:' }],
]);

const STATIC_ASSET_CACHE = new Map();
const BROTLI_OPTIONS = {
  params: {
    [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
  },
};
const GZIP_OPTIONS = { level: 6 };
const COMPRESSIBLE_MIME_TYPES = new Set([
  'text/html',
  'text/css',
  'text/plain',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'image/svg+xml',
]);

class AsyncLock {
  constructor() {
    this._current = Promise.resolve();
  }

  run(task) {
    const next = this._current.then(() => task());
    this._current = next.catch(() => {});
    return next;
  }
}

const userDataLock = new AsyncLock();
const journalLock = new AsyncLock();
const formSubmissionsLock = new AsyncLock();

class SlidingWindowRateLimiter {
  constructor() {
    this.buckets = new Map();
  }

  tryConsume(key, limit, windowMs) {
    const now = Date.now();
    const threshold = now - windowMs;
    const bucket = this.buckets.get(key) || [];
    const recent = bucket.filter((timestamp) => timestamp > threshold);
    if (recent.length >= limit) {
      this.buckets.set(key, recent);
      return false;
    }
    recent.push(now);
    this.buckets.set(key, recent);
    return true;
  }
}

const rateLimiter = new SlidingWindowRateLimiter();

function resolveClientIdentifier(req) {
  const forwarded = typeof req.headers?.['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : null;
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return req.socket?.remoteAddress || 'unknown';
}

function enforceRateLimit(req, res, bucket, limit, windowMs) {
  const identifier = resolveClientIdentifier(req);
  const key = `${bucket}:${identifier}`;
  if (!rateLimiter.tryConsume(key, limit, windowMs)) {
    jsonResponse(res, 429, {
      error: 'Zbyt wiele prób. Spróbuj ponownie za kilka minut.',
    });
    return false;
  }
  return true;
}

let mailTransport = null;
let mailTransportInitialized = false;

let cachedNotFoundPage = null;

function hashForExport(value) {
  return crypto.createHmac('sha256', EXPORT_HASH_SECRET).update(value).digest('hex');
}

function safeCompareStrings(candidate, reference) {
  if (typeof candidate !== 'string' || typeof reference !== 'string') {
    return false;
  }
  const candidateBuffer = Buffer.from(candidate);
  const referenceBuffer = Buffer.from(reference);
  if (candidateBuffer.length !== referenceBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuffer, referenceBuffer);
}

function isJournalRequestAuthorized(req) {
  if (!COMMUNITY_JOURNAL_TOKEN) {
    return true;
  }

  const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : '';
  const bearerToken = authHeader.slice(0, 7).toLowerCase() === 'bearer '
    ? authHeader.slice(7).trim()
    : '';
  const apiKeyHeader = typeof req.headers?.['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : '';

  return (
    safeCompareStrings(bearerToken, COMMUNITY_JOURNAL_TOKEN) ||
    safeCompareStrings(apiKeyHeader, COMMUNITY_JOURNAL_TOKEN)
  );
}

function sanitizePhotoDataUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('data:image/')) {
    return null;
  }

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex === -1) {
    return null;
  }

  const header = trimmed.slice(0, commaIndex);
  if (!/;base64$/i.test(header)) {
    return null;
  }

  const mimeType = header.slice('data:'.length).split(';')[0];
  const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
  if (!allowedMimeTypes.has(mimeType.toLowerCase())) {
    return null;
  }

  const base64Payload = trimmed.slice(commaIndex + 1);

  if (Buffer.byteLength(base64Payload, 'base64') > MAX_JOURNAL_PHOTO_SIZE_BYTES) {
    const error = new Error('PHOTO_TOO_LARGE');
    error.code = 'PHOTO_TOO_LARGE';
    throw error;
  }

  return trimmed;
}

function hashOptional(value) {
  return typeof value === 'string' && value ? hashForExport(value) : null;
}

function buildCouponSubmissionSnapshot(entry) {
  return {
    id: entry.id,
    type: 'coupon-search',
    payload: {
      couponHash: hashOptional(entry.coupon),
      couponLength: entry.coupon ? entry.coupon.length : 0,
      language: entry.language || null,
      userAgentHash: hashOptional(entry.userAgent),
      refererHash: hashOptional(entry.referer),
    },
    createdAt: entry.createdAt,
  };
}

function buildContactSubmissionSnapshot(entry) {
  return {
    id: entry.id,
    type: 'contact',
    payload: {
      nameHash: hashOptional(entry.name),
      emailHash: hashOptional(entry.email),
      serviceHash: hashOptional(entry.service),
      language: entry.language || null,
      userAgentHash: hashOptional(entry.userAgent),
      refererHash: hashOptional(entry.referer),
      messageDigest: hashOptional(entry.message),
      messageLength: entry.message ? entry.message.length : 0,
    },
    createdAt: entry.createdAt,
  };
}

function createSecurityContext() {
  return {
    scriptNonce: crypto.randomBytes(16).toString('base64'),
    styleNonce: crypto.randomBytes(16).toString('base64'),
  };
}

function applySecurityHeaders(res) {
  const context = res.__securityContext || createSecurityContext();
  res.__securityContext = context;
  const scriptNonce = context.scriptNonce;
  const styleNonce = context.styleNonce;

  const scriptSources = [
    "'self'",
    scriptNonce ? `'nonce-${scriptNonce}'` : null,
    'https://esm.sh',
    'https://cdn.jsdelivr.net',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
  ].filter(Boolean);

  const styleSources = [
    "'self'",
    styleNonce ? `'nonce-${styleNonce}'` : null,
    'https://fonts.googleapis.com',
  ].filter(Boolean);

  const connectSources = [
    "'self'",
    'https://daoohnbnnowmmcizgvrq.supabase.co',
    'wss://daoohnbnnowmmcizgvrq.supabase.co',
    'https://www.google-analytics.com',
    'https://www.googletagmanager.com',
  ];

  const imgSources = [
    "'self'",
    'data:',
    'https://www.google-analytics.com',
    'https://tile.openstreetmap.org',
    'https://a.tile.openstreetmap.org',
    'https://b.tile.openstreetmap.org',
    'https://c.tile.openstreetmap.org',
  ];

  const fontSources = ["'self'", 'https://fonts.gstatic.com', 'data:'];

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSources.join(' ')}`,
    `style-src ${styleSources.join(' ')}`,
    `connect-src ${connectSources.join(' ')}`,
    `img-src ${imgSources.join(' ')}`,
    `font-src ${fontSources.join(' ')}`,
    `frame-ancestors 'self'`,
  ].join('; ');

  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', csp);
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

async function appendFormSubmission(entry) {
  await formSubmissionsLock.run(async () => {
    try {
      storeFormSubmission(entry, DATA_DIR_PATH);
      pruneStoredFormSubmissions(500, DATA_DIR_PATH);
    } catch (error) {
      console.error('Nie udało się zapisać zgłoszenia formularza:', error);
    }
  });
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

async function sendPasswordResetEmail(email, token, transport) {
  if (!transport) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  const resetLink = `${PASSWORD_RESET_URL}?token=${token}`;
  const text = [
    'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta CyprusEye.',
    'Jeśli to Ty rozpocząłeś ten proces, kliknij w poniższy link i ustaw nowe hasło:',
    resetLink,
    '',
    'Jeżeli nie prosiłeś o reset, zignoruj tę wiadomość – Twoje hasło pozostanie bez zmian.',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111;">
    <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta CyprusEye.</p>
    <p>Jeśli to Ty rozpocząłeś ten proces, kliknij w poniższy przycisk, aby ustawić nowe hasło:</p>
    <p><a href="${resetLink}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Ustaw nowe hasło</a></p>
    <p>Jeżeli nie prosiłeś o reset, zignoruj tę wiadomość – Twoje hasło pozostanie bez zmian.</p>
  </body></html>`;

  await transport.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Resetowanie hasła – CyprusEye',
    text,
    html,
  });
}

async function handleRegister(req, res) {
  try {
    if (!enforceRateLimit(req, res, 'register', 5, 10 * 60 * 1000)) {
      return;
    }

    const body = await parseRequestBody(req);
    const { email, password, name } = body || {};

    if (!email || typeof email !== 'string') {
      return jsonResponse(res, 400, { error: 'Adres e-mail jest wymagany.' });
    }
    if (!validatePassword(password)) {
      return jsonResponse(res, 400, { error: 'Hasło musi składać się z co najmniej 8 znaków.' });
    }

    const normalizedEmail = normalizeEmail(email);
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

    const result = await userDataLock.run(async () => {
      const existing = getStoredUserByEmail(normalizedEmail, DATA_DIR_PATH);
      if (existing) {
        return { status: 409 };
      }
      const success = createStoredUser(user, DATA_DIR_PATH);
      return { status: success ? 201 : 500 };
    });

    if (result.status === 409) {
      return jsonResponse(res, 409, { error: 'Użytkownik z takim adresem e-mail już istnieje.' });
    }
    if (result.status !== 201) {
      return jsonResponse(res, 500, { error: 'Nie udało się zapisać użytkownika.' });
    }

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
    if (!enforceRateLimit(req, res, 'login', 10, 10 * 60 * 1000)) {
      return;
    }

    const body = await parseRequestBody(req);
    const { email, password } = body || {};

    if (!email || typeof email !== 'string' || typeof password !== 'string') {
      return jsonResponse(res, 400, { error: 'Adres e-mail i hasło są wymagane.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const lookup = getStoredUserByEmail(normalizedEmail, DATA_DIR_PATH);

    if (!lookup || !verifyPassword(password, lookup.passwordHash)) {
      return jsonResponse(res, 401, { error: 'Nieprawidłowy e-mail lub hasło.' });
    }

    return jsonResponse(res, 200, { user: sanitizeUser(lookup) });
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
    if (!enforceRateLimit(req, res, 'password-reset-request', 3, 60 * 60 * 1000)) {
      return;
    }

    const body = await parseRequestBody(req);
    const { email } = body || {};

    if (!email || typeof email !== 'string') {
      return jsonResponse(res, 400, { error: 'Adres e-mail jest wymagany.' });
    }

    const transport = getMailTransport();
    if (!transport) {
      return jsonResponse(res, 503, {
        error: 'Reset hasła jest chwilowo niedostępny. Skontaktuj się z obsługą lub spróbuj ponownie później.',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const result = await userDataLock.run(async () => {
      const user = getStoredUserByEmail(normalizedEmail, DATA_DIR_PATH);
      if (!user) {
        return null;
      }

      const token = createToken();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();
      replaceResetTokenForUser(user.id, token, expiresAt, DATA_DIR_PATH);
      return { user, token };
    });

    if (result && result.user) {
      try {
        await sendPasswordResetEmail(result.user.email, result.token, transport);
      } catch (emailError) {
        console.error('Nie udało się wysłać wiadomości resetującej hasło:', emailError);
        return jsonResponse(res, 502, {
          error: 'Wiadomość resetująca hasło nie mogła zostać wysłana. Spróbuj ponownie później.',
        });
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

    const outcome = await userDataLock.run(async () => {
      const tokenEntry = getStoredResetToken(token, DATA_DIR_PATH);
      if (!tokenEntry) {
        return { status: 400, error: 'Nieprawidłowy lub wygasły token.' };
      }

      if (new Date(tokenEntry.expiresAt).getTime() < Date.now()) {
        deleteStoredResetToken(token, DATA_DIR_PATH);
        return { status: 400, error: 'Nieprawidłowy lub wygasły token.' };
      }

      const user = getStoredUserById(tokenEntry.userId, DATA_DIR_PATH);
      if (!user) {
        deleteStoredResetToken(token, DATA_DIR_PATH);
        return { status: 400, error: 'Nieprawidłowy lub wygasły token.' };
      }

      const hashed = hashPassword(password);
      const updatedAt = new Date().toISOString();
      updateStoredUserPassword(user.id, hashed, updatedAt, DATA_DIR_PATH);
      deleteStoredResetToken(token, DATA_DIR_PATH);

      return { status: 200 };
    });

    if (!outcome || outcome.status !== 200) {
      return jsonResponse(res, outcome?.status || 400, {
        error: outcome?.error || 'Nieprawidłowy lub wygasły token.',
      });
    }

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
    const entries = await journalLock.run(async () => listStoredJournalEntries(200, DATA_DIR_PATH));
    return jsonResponse(res, 200, { entries });
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
    if (!isJournalRequestAuthorized(req)) {
      return jsonResponse(res, 401, { error: 'Wymagane jest uwierzytelnienie.' });
    }

    const body = await parseRequestBody(req);
    const title = sanitizeJournalString(body?.title, { maxLength: 200 });
    const notes = sanitizeJournalString(body?.notes, { maxLength: 4000 });
    if (!notes) {
      return jsonResponse(res, 400, { error: 'Treść wpisu jest wymagana.' });
    }

    let photoDataUrl = null;
    try {
      photoDataUrl = sanitizePhotoDataUrl(body?.photoDataUrl);
    } catch (photoError) {
      if (photoError.code === 'PHOTO_TOO_LARGE') {
        return jsonResponse(res, 413, { error: 'Załączone zdjęcie jest zbyt duże (limit 1.5 MB).' });
      }
      throw photoError;
    }
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

    await journalLock.run(async () => {
      storeJournalEntry(entry, DATA_DIR_PATH);
    });
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

    const submission = {
      id: `coupon-search-${Date.now()}`,
      coupon: couponQuery,
      language,
      userAgent: req.headers['user-agent'] || null,
      referer: req.headers.referer || null,
      createdAt: now,
    };

    await appendFormSubmission(buildCouponSubmissionSnapshot(submission));

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

    await appendFormSubmission(buildContactSubmissionSnapshot(entry));
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
  if (!isJournalRequestAuthorized(req)) {
    return jsonResponse(res, 401, { error: 'Wymagane jest uwierzytelnienie.' });
  }

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
  initSqliteStore(DATA_DIR_PATH);
  return http.createServer(async (req, res) => {
    if (!req.url || !req.method) {
      return jsonResponse(res, 400, { error: 'Nieobsługiwane żądanie.' });
    }

    const securityContext = createSecurityContext();
    res.__securityContext = securityContext;

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

    const handler = resolveRoute(req.method, url.pathname);

    if (handler) {
      return handler(req, res);
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const served = await tryServeStaticFile(req, url.pathname, res, url);
      if (served) {
        return;
      }
      await serveNotFoundPage(req, res, url);
      return;
    }

    return jsonResponse(res, 404, { error: 'Endpoint nie istnieje.' });
  });
}

export async function start() {
  initSqliteStore(DATA_DIR_PATH);
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

export { createServer };

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

function normalizeLanguageCandidate(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function selectSupportedLanguage(value) {
  const candidate = normalizeLanguageCandidate(value);
  if (!candidate) {
    return null;
  }
  if (SUPPORTED_LANGUAGES.has(candidate)) {
    return candidate;
  }
  if (candidate.includes('-')) {
    const short = candidate.split('-')[0];
    if (SUPPORTED_LANGUAGES.has(short)) {
      return short;
    }
  }
  return null;
}

function parseCookies(header = '') {
  const jar = new Map();
  if (!header) {
    return jar;
  }
  header.split(';').forEach((part) => {
    const [name, ...rest] = part.split('=');
    if (!name) {
      return;
    }
    const key = name.trim();
    if (!key) {
      return;
    }
    const value = rest.join('=').trim();
    jar.set(key, value);
  });
  return jar;
}

function detectLanguageFromHeader(header) {
  if (typeof header !== 'string' || !header.trim()) {
    return null;
  }
  const entries = header.split(',');
  for (const rawEntry of entries) {
    const entry = rawEntry.split(';')[0];
    const candidate = selectSupportedLanguage(entry);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function detectPreferredLanguage(req, url) {
  const urlLang = selectSupportedLanguage(url?.searchParams?.get('lang'));
  if (urlLang) {
    return urlLang;
  }

  const cookies = parseCookies(req.headers?.cookie);
  const cookieLang = selectSupportedLanguage(cookies.get(LANGUAGE_COOKIE_NAME));
  if (cookieLang) {
    return cookieLang;
  }

  const headerLang = detectLanguageFromHeader(req.headers?.['accept-language']);
  if (headerLang) {
    return headerLang;
  }

  return DEFAULT_LANGUAGE;
}

function updateHtmlTagAttribute(html, attribute, value) {
  const match = html.match(/<html\b[^>]*>/i);
  if (!match) {
    return html;
  }
  const tag = match[0];
  const attrRegex = new RegExp(`${attribute}\\s*=\\s*"[^"]*"`, 'i');
  let updated = tag;
  if (attrRegex.test(tag)) {
    updated = tag.replace(attrRegex, `${attribute}="${value}"`);
  } else {
    updated = tag.replace('<html', `<html ${attribute}="${value}"`);
  }
  return html.replace(tag, updated);
}

function updateLanguageInputs(html, language) {
  return html.replace(/<input\b[^>]*data-language-field[^>]*>/gi, (match) => {
    if (!/name\s*=\s*"lang"/i.test(match)) {
      return match;
    }
    if (/value\s*=\s*"[^"]*"/i.test(match)) {
      return match.replace(/value\s*=\s*"[^"]*"/i, `value="${language}"`);
    }
    return match.replace(/\/>$/, ` value="${language}" />`).replace(/>$/, ` value="${language}">`);
  });
}

function injectLanguageSwitcherFallback(html, language) {
  if (/data-noscript-language-switcher/.test(html)) {
    return html;
  }

  const copy = NOSCRIPT_LANGUAGE_COPY.get(language) || NOSCRIPT_LANGUAGE_COPY.get(DEFAULT_LANGUAGE);
  const labelText = copy?.label || 'Choose language:';
  const fallback = `\n<noscript>\n  <div class="language-switcher language-switcher--static" data-noscript-language-switcher>\n    <p class="language-switcher__label">${labelText}</p>\n    <ul class="language-switcher__list">\n      <li><a class="language-switcher__link" href="?lang=pl">🇵🇱 Polski</a></li>\n      <li><a class="language-switcher__link" href="?lang=en">🇬🇧 English</a></li>\n      <li><a class="language-switcher__link" href="?lang=el">🇬🇷 Ελληνικά</a></li>\n    </ul>\n  </div>\n</noscript>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${fallback}\n</body>`);
  }
  return `${html}${fallback}`;
}

function addNonceAttribute(html, tagName, nonce) {
  if (!nonce) {
    return html;
  }

  const pattern = new RegExp(`<${tagName}([^>]*?)>`, 'gi');
  return html.replace(pattern, (match, attrs) => {
    if (/\bnonce\s*=/.test(attrs)) {
      return match;
    }
    const safeAttrs = attrs.replace(/\s+$/, '');
    return `<${tagName}${safeAttrs} nonce="${nonce}">`;
  });
}

function enhanceHtmlDocument(html, { language, securityContext } = {}) {
  let output = html;
  const lang = SUPPORTED_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
  const languageMeta = SUPPORTED_LANGUAGES.get(lang) || SUPPORTED_LANGUAGES.get(DEFAULT_LANGUAGE);

  output = updateHtmlTagAttribute(output, 'lang', lang);
  if (languageMeta?.dir) {
    output = updateHtmlTagAttribute(output, 'dir', languageMeta.dir);
  }

  output = updateLanguageInputs(output, lang);
  output = injectLanguageSwitcherFallback(output, lang);

  if (securityContext?.styleNonce) {
    output = addNonceAttribute(output, 'style', securityContext.styleNonce);
  }
  if (securityContext?.scriptNonce) {
    output = addNonceAttribute(output, 'script', securityContext.scriptNonce);
  }

  return output;
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

function getBaseMimeType(mimeType) {
  if (typeof mimeType !== 'string') {
    return '';
  }
  return mimeType.split(';')[0];
}

function isCompressibleMime(mimeType) {
  const base = getBaseMimeType(mimeType);
  return COMPRESSIBLE_MIME_TYPES.has(base);
}

function createEtag(stats) {
  const size = typeof stats.size === 'number' ? stats.size : 0;
  const mtimeMs =
    typeof stats.mtimeMs === 'number'
      ? stats.mtimeMs
      : stats.mtime instanceof Date
      ? stats.mtime.getTime()
      : Date.now();
  return `W/"${size.toString(16)}-${Math.round(mtimeMs).toString(16)}"`;
}

function parseAcceptEncoding(header) {
  if (typeof header !== 'string' || !header.trim()) {
    return [];
  }

  return header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...params] = part.split(';').map((segment) => segment.trim());
      let q = 1;
      for (const param of params) {
        const [key, value] = param.split('=').map((segment) => segment.trim());
        if (key === 'q') {
          const numeric = Number.parseFloat(value);
          if (Number.isFinite(numeric)) {
            q = numeric;
          }
        }
      }
      return { name: name.toLowerCase(), q };
    })
    .filter((item) => item.q > 0 && item.name);
}

function selectEncoding(header) {
  const parsed = parseAcceptEncoding(header);
  if (!parsed.length) {
    return null;
  }

  parsed.sort((a, b) => b.q - a.q);
  const supported = ['br', 'gzip'];
  for (const item of parsed) {
    if (supported.includes(item.name)) {
      return item.name;
    }
    if (item.name === '*') {
      return supported[0];
    }
    if (item.name === 'identity') {
      return null;
    }
  }
  return null;
}

function compressBuffer(buffer, encoding) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return buffer;
  }
  try {
    if (encoding === 'br') {
      return brotliCompressSync(buffer, BROTLI_OPTIONS);
    }
    if (encoding === 'gzip') {
      return gzipSync(buffer, GZIP_OPTIONS);
    }
  } catch (error) {
    console.warn('Nie udało się skompresować zasobu statycznego:', error);
  }
  return buffer;
}

async function getStaticAssetEntry(filePath, fileStats, mimeType) {
  const baseMime = getBaseMimeType(mimeType);
  const mtimeMs =
    typeof fileStats.mtimeMs === 'number'
      ? fileStats.mtimeMs
      : fileStats.mtime instanceof Date
      ? fileStats.mtime.getTime()
      : Date.now();
  const cacheEntry = STATIC_ASSET_CACHE.get(filePath);
  if (cacheEntry && cacheEntry.mtimeMs === mtimeMs && cacheEntry.size === fileStats.size) {
    return cacheEntry;
  }

  let text = null;
  let buffer = null;
  const shouldReadAsText =
    baseMime.startsWith('text/') || baseMime === 'application/json' || baseMime === 'application/javascript' || baseMime === 'image/svg+xml';

  if (shouldReadAsText) {
    text = await fs.readFile(filePath, 'utf-8');
    buffer = Buffer.from(text, 'utf-8');
  } else {
    buffer = await fs.readFile(filePath);
  }

  const entry = {
    filePath,
    size: fileStats.size,
    mtimeMs,
    mimeType: baseMime,
    buffer,
    text,
    etag: createEtag(fileStats),
    compressed: new Map(),
  };

  if (baseMime !== 'text/html' && isCompressibleMime(baseMime)) {
    const brotli = compressBuffer(buffer, 'br');
    const gzip = compressBuffer(buffer, 'gzip');
    if (brotli && brotli !== buffer) {
      entry.compressed.set('br', brotli);
    }
    if (gzip && gzip !== buffer) {
      entry.compressed.set('gzip', gzip);
    }
  }

  STATIC_ASSET_CACHE.set(filePath, entry);
  return entry;
}

function isFresh(req, entry) {
  const etag = entry?.etag;
  const ifNoneMatch = req.headers?.['if-none-match'];
  if (etag && typeof ifNoneMatch === 'string' && ifNoneMatch) {
    const tokens = ifNoneMatch
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (tokens.includes(etag)) {
      return true;
    }
  }

  const ifModifiedSince = req.headers?.['if-modified-since'];
  if (typeof ifModifiedSince === 'string' && ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    if (!Number.isNaN(since)) {
      const normalizedMtime = Math.floor(entry.mtimeMs / 1000) * 1000;
      if (normalizedMtime <= since) {
        return true;
      }
    }
  }

  return false;
}

async function serveStaticAsset(req, res, filePath, stats = null, url = null) {
  const fileStats = stats ?? (await fs.stat(filePath));
  if (fileStats.isDirectory()) {
    return false;
  }

  const mimeType = getMimeType(filePath);
  const baseMime = getBaseMimeType(mimeType);
  const cacheEntry = await getStaticAssetEntry(filePath, fileStats, mimeType);
  const cacheControl = baseMime === 'text/html' ? 'no-cache' : 'public, max-age=31536000, immutable';
  const varyHeader = isCompressibleMime(baseMime) ? 'Accept-Encoding' : undefined;
  const lastModified = new Date(cacheEntry.mtimeMs).toUTCString();

  if (isFresh(req, cacheEntry)) {
    const notModifiedHeaders = {
      'Content-Type': mimeType,
      'Cache-Control': cacheControl,
      'ETag': cacheEntry.etag,
      'Last-Modified': lastModified,
    };
    if (varyHeader) {
      notModifiedHeaders.Vary = varyHeader;
    }
    applySecurityHeaders(res);
    res.writeHead(304, notModifiedHeaders);
    res.end();
    return true;
  }

  let bodyBuffer;
  if (baseMime === 'text/html') {
    const rawHtml = cacheEntry.text ?? (await fs.readFile(filePath, 'utf-8'));
    const language = detectPreferredLanguage(req, url);
    const securityContext = res.__securityContext;
    const enhanced = enhanceHtmlDocument(rawHtml, { language, securityContext });
    bodyBuffer = Buffer.from(enhanced, 'utf-8');
  } else {
    bodyBuffer = cacheEntry.buffer;
  }

  let encoding = null;
  let responseBuffer = bodyBuffer;

  if (isCompressibleMime(baseMime)) {
    const preferredEncoding = selectEncoding(req.headers?.['accept-encoding']);
    if (preferredEncoding === 'br' || preferredEncoding === 'gzip') {
      encoding = preferredEncoding;
      if (baseMime === 'text/html') {
        responseBuffer = compressBuffer(bodyBuffer, preferredEncoding);
      } else {
        const cachedCompressed = cacheEntry.compressed.get(preferredEncoding);
        if (cachedCompressed) {
          responseBuffer = cachedCompressed;
        } else {
          responseBuffer = compressBuffer(bodyBuffer, preferredEncoding);
          if (responseBuffer && responseBuffer !== bodyBuffer) {
            cacheEntry.compressed.set(preferredEncoding, responseBuffer);
          }
        }
      }
    }
  }

  if (encoding && (!responseBuffer || responseBuffer === bodyBuffer)) {
    encoding = null;
    responseBuffer = bodyBuffer;
  }

  const headers = {
    'Content-Type': mimeType,
    'Cache-Control': cacheControl,
    'ETag': cacheEntry.etag,
    'Last-Modified': lastModified,
    'Content-Length': responseBuffer.length,
  };

  if (encoding) {
    headers['Content-Encoding'] = encoding;
  }
  if (varyHeader) {
    headers.Vary = varyHeader;
  }

  applySecurityHeaders(res);
  res.writeHead(200, headers);

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  res.end(responseBuffer);
  return true;
}

async function tryServeStaticFile(req, pathname, res, url) {
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
        const servedIndex = await serveStaticAsset(req, res, indexPath, null, url);
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

    const served = await serveStaticAsset(req, res, absolutePath, stats, url);
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
          const servedHtml = await serveStaticAsset(req, res, htmlPath, null, url);
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

async function serveNotFoundPage(req, res, url) {
  try {
    if (!cachedNotFoundPage) {
      cachedNotFoundPage = await fs.readFile(NOT_FOUND_PAGE_PATH, 'utf-8');
    }
    const language = detectPreferredLanguage(req, url);
    const securityContext = res.__securityContext;
    const body = enhanceHtmlDocument(cachedNotFoundPage, { language, securityContext });
    const buffer = Buffer.from(body, 'utf-8');
    applySecurityHeaders(res);
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
    };
    res.writeHead(404, headers);
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(buffer);
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
