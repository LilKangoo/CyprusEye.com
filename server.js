import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR_PATH = path.join(__dirname, 'data');
const DATA_FILE_PATH = path.join(DATA_DIR_PATH, 'users.json');
const SPREADSHEET_FILE_PATH = path.join(DATA_DIR_PATH, 'users.csv');
const COMMUNITY_JOURNAL_FILE_PATH = path.join(DATA_DIR_PATH, 'community-journal.json');
const REVIEWS_FILE_PATH = path.join(DATA_DIR_PATH, 'reviews.json');
const PASSWORD_RESET_URL = process.env.PASSWORD_RESET_URL || 'http://localhost:3000/reset-password';
const PASSWORD_RESET_TOKEN_TTL_MS = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MS || 1000 * 60 * 60);
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '/');
const JOURNAL_COMMENT_MAX_LENGTH = 400;
const REVIEW_COMMENT_MAX_LENGTH = 2000;
const REVIEW_MAX_DATA_URL_LENGTH = 6_000_000; // ok. ~4.5 MB danych zdjęcia w base64

function jsonResponse(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
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

async function ensureReviewsFile() {
  await fs.mkdir(DATA_DIR_PATH, { recursive: true });
  try {
    await fs.access(REVIEWS_FILE_PATH);
  } catch (error) {
    const initialData = { reviews: {} };
    await fs.writeFile(REVIEWS_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
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
    console.error('Nie udało się wczytać dziennika społeczności:', error);
    return { entries: [] };
  }
}

async function writeCommunityJournal(data) {
  const payload = {
    entries: Array.isArray(data?.entries) ? data.entries : [],
  };
  await fs.writeFile(COMMUNITY_JOURNAL_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

async function readReviews() {
  await ensureReviewsFile();
  try {
    const file = await fs.readFile(REVIEWS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(file);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.reviews !== 'object' || parsed.reviews === null) {
      return { reviews: {} };
    }
    return { reviews: parsed.reviews };
  } catch (error) {
    console.error('Nie udało się wczytać opinii o miejscach:', error);
    return { reviews: {} };
  }
}

async function writeReviews(data) {
  const payload = {
    reviews: typeof data?.reviews === 'object' && data.reviews !== null ? data.reviews : {},
  };
  await fs.writeFile(REVIEWS_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
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
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('INVALID_JSON');
  }
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
  'GET /api/reviews': handleListReviews,
  'POST /api/reviews': handleUpsertReview,
  'GET /api/reviews/stream': handleReviewsStream,
};

const journalStreamClients = new Set();
const reviewStreamClients = new Set();

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

function broadcastReviewEvent(event, data) {
  if (!reviewStreamClients.size) {
    return;
  }

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of reviewStreamClients) {
    const { res, heartbeat } = client;
    try {
      res.write(payload);
    } catch (error) {
      clearInterval(heartbeat);
      reviewStreamClients.delete(client);
    }
  }
}

async function handleListCommunityJournal(req, res) {
  try {
    const data = await readCommunityJournal();
    return jsonResponse(res, 200, { entries: data.entries });
  } catch (error) {
    console.error('Błąd podczas odczytywania wpisów społeczności:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się pobrać wpisów społeczności.' });
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
    console.error('Błąd podczas zapisywania wpisu społeczności:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się zapisać wpisu społeczności.' });
  }
}

function cloneJournalComments(comments) {
  if (!Array.isArray(comments)) {
    return [];
  }
  return comments
    .map((comment) => {
      if (!comment || typeof comment !== 'object') {
        return null;
      }
      return {
        ...comment,
        replies: cloneJournalComments(comment.replies),
      };
    })
    .filter(Boolean);
}

function findJournalComment(comments, commentId) {
  if (!Array.isArray(comments)) {
    return null;
  }

  for (const comment of comments) {
    if (!comment || typeof comment !== 'object') {
      continue;
    }
    if (comment.id === commentId) {
      return comment;
    }
    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const found = findJournalComment(replies, commentId);
    if (found) {
      return found;
    }
  }

  return null;
}

function sanitizeUsername(value, { fallback = 'Podróżnik', maxLength = 120 } = {}) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function sanitizeUserKey(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.slice(0, 160);
}

function sanitizeReviewComment(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.length > REVIEW_COMMENT_MAX_LENGTH) {
    return trimmed.slice(0, REVIEW_COMMENT_MAX_LENGTH);
  }
  return trimmed;
}

function sanitizeReviewPhoto(dataUrl) {
  if (typeof dataUrl !== 'string') {
    return null;
  }
  const trimmed = dataUrl.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.startsWith('data:image/')) {
    return null;
  }
  if (trimmed.length > REVIEW_MAX_DATA_URL_LENGTH) {
    return null;
  }
  return trimmed;
}

async function handleCreateCommunityJournalComment(req, res, params) {
  try {
    const entryId = params?.entryId;
    if (!entryId) {
      return jsonResponse(res, 400, { error: 'Identyfikator wpisu jest wymagany.' });
    }

    const body = await parseRequestBody(req);
    const text = sanitizeJournalString(body?.text, { maxLength: JOURNAL_COMMENT_MAX_LENGTH });
    if (!text) {
      return jsonResponse(res, 400, { error: 'Treść komentarza jest wymagana.' });
    }

    const userKey = sanitizeUserKey(body?.userKey);
    if (!userKey) {
      return jsonResponse(res, 400, { error: 'Identyfikator użytkownika jest wymagany.' });
    }

    const username = sanitizeUsername(body?.username, { fallback: 'Podróżnik' });
    const parentCommentId =
      typeof body?.parentCommentId === 'string' && body.parentCommentId.trim()
        ? body.parentCommentId.trim()
        : null;

    const data = await readCommunityJournal();
    const entries = Array.isArray(data.entries) ? [...data.entries] : [];
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      return jsonResponse(res, 404, { error: 'Nie znaleziono wskazanego wpisu społeczności.' });
    }

    const now = new Date().toISOString();
    const originalEntry = entries[index];
    const entry = {
      ...originalEntry,
      comments: cloneJournalComments(originalEntry.comments),
      likedBy: Array.isArray(originalEntry.likedBy) ? [...originalEntry.likedBy] : [],
    };

    const comment = {
      id: `comment-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      text,
      createdAt: now,
      updatedAt: now,
      userKey,
      username,
      replies: [],
    };

    if (parentCommentId) {
      const parent = findJournalComment(entry.comments, parentCommentId);
      if (!parent) {
        return jsonResponse(res, 404, { error: 'Nie znaleziono komentarza nadrzędnego.' });
      }
      parent.replies = Array.isArray(parent.replies) ? [...parent.replies, comment] : [comment];
    } else {
      entry.comments = Array.isArray(entry.comments) ? [...entry.comments, comment] : [comment];
    }

    entry.updatedAt = now;
    entries[index] = entry;
    await writeCommunityJournal({ entries });
    broadcastJournalEvent('journal-entry-updated', { entry });

    return jsonResponse(res, 201, { entry, comment });
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format JSON.' });
    }
    console.error('Błąd podczas dodawania komentarza społeczności:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się zapisać komentarza.' });
  }
}

async function handleToggleCommunityJournalLike(req, res, params) {
  try {
    const entryId = params?.entryId;
    if (!entryId) {
      return jsonResponse(res, 400, { error: 'Identyfikator wpisu jest wymagany.' });
    }

    const body = await parseRequestBody(req);
    const userKey = sanitizeUserKey(body?.userKey);
    if (!userKey) {
      return jsonResponse(res, 400, { error: 'Identyfikator użytkownika jest wymagany.' });
    }

    const desiredLike = typeof body?.like === 'boolean' ? body.like : null;

    const data = await readCommunityJournal();
    const entries = Array.isArray(data.entries) ? [...data.entries] : [];
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      return jsonResponse(res, 404, { error: 'Nie znaleziono wskazanego wpisu społeczności.' });
    }

    const now = new Date().toISOString();
    const originalEntry = entries[index];
    if (originalEntry.userKey && originalEntry.userKey === userKey) {
      return jsonResponse(res, 403, { error: 'Nie możesz polubić własnego wpisu.' });
    }

    const likedBy = new Set(Array.isArray(originalEntry.likedBy) ? originalEntry.likedBy : []);
    const currentlyLiked = likedBy.has(userKey);
    let liked = currentlyLiked;

    if (desiredLike === true) {
      likedBy.add(userKey);
      liked = true;
    } else if (desiredLike === false) {
      likedBy.delete(userKey);
      liked = false;
    } else if (currentlyLiked) {
      likedBy.delete(userKey);
      liked = false;
    } else {
      likedBy.add(userKey);
      liked = true;
    }

    const entry = {
      ...originalEntry,
      likedBy: Array.from(likedBy),
      comments: cloneJournalComments(originalEntry.comments),
      updatedAt: now,
    };

    entries[index] = entry;
    await writeCommunityJournal({ entries });
    broadcastJournalEvent('journal-entry-updated', { entry });

    return jsonResponse(res, 200, { entry, liked });
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format JSON.' });
    }
    console.error('Błąd podczas aktualizowania polubienia wpisu społeczności:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się zaktualizować polubienia.' });
  }
}

function normalizeRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 5) {
    return null;
  }
  return rounded;
}

function sanitizeReview(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const placeId = typeof raw.placeId === 'string' ? raw.placeId.trim() : '';
  if (!placeId) {
    return null;
  }

  const userKey = sanitizeUserKey(raw.userKey);
  if (!userKey) {
    return null;
  }

  const rating = normalizeRating(raw.rating);
  if (!rating) {
    return null;
  }

  const username = sanitizeUsername(raw.username, { fallback: 'Gracz', maxLength: 120 });
  const comment = sanitizeReviewComment(raw.comment);
  const photoDataUrl = sanitizeReviewPhoto(raw.photoDataUrl);

  const createdAtRaw = typeof raw.createdAt === 'string' ? raw.createdAt : '';
  const updatedAtRaw = typeof raw.updatedAt === 'string' ? raw.updatedAt : '';
  const createdTimestamp = Date.parse(createdAtRaw);
  const updatedTimestamp = Date.parse(updatedAtRaw);
  const createdAt = Number.isFinite(createdTimestamp)
    ? new Date(createdTimestamp).toISOString()
    : new Date().toISOString();
  const updatedAt = Number.isFinite(updatedTimestamp)
    ? new Date(updatedTimestamp).toISOString()
    : createdAt;

  return {
    id:
      typeof raw.id === 'string'
        ? raw.id
        : `review-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    placeId,
    userKey,
    username,
    rating,
    comment,
    photoDataUrl,
    createdAt,
    updatedAt,
  };
}

async function handleListReviews(req, res) {
  try {
    const data = await readReviews();
    return jsonResponse(res, 200, { reviews: data.reviews });
  } catch (error) {
    console.error('Błąd podczas pobierania opinii:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się pobrać opinii.' });
  }
}

async function handleUpsertReview(req, res) {
  try {
    const body = await parseRequestBody(req);
    const sanitized = sanitizeReview(body);
    if (!sanitized) {
      return jsonResponse(res, 400, { error: 'Przekazano nieprawidłowe dane opinii.' });
    }

    const { placeId, userKey } = sanitized;
    const now = new Date().toISOString();

    const data = await readReviews();
    const reviewsMap = typeof data.reviews === 'object' && data.reviews !== null ? { ...data.reviews } : {};
    const existingList = Array.isArray(reviewsMap[placeId]) ? [...reviewsMap[placeId]] : [];

    const existingIndex = existingList.findIndex(
      (review) => review && (review.id === sanitized.id || review.userKey === userKey),
    );

    const review = {
      ...sanitized,
      id:
        existingIndex >= 0 && existingList[existingIndex]?.id
          ? existingList[existingIndex].id
          : sanitized.id,
      createdAt:
        existingIndex >= 0 && existingList[existingIndex]?.createdAt
          ? existingList[existingIndex].createdAt
          : sanitized.createdAt,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      existingList[existingIndex] = review;
    } else {
      existingList.push(review);
    }

    existingList.sort((a, b) => {
      const aDate = Date.parse(a?.updatedAt || a?.createdAt || 0);
      const bDate = Date.parse(b?.updatedAt || b?.createdAt || 0);
      return bDate - aDate;
    });

    reviewsMap[placeId] = existingList;
    await writeReviews({ reviews: reviewsMap });
    broadcastReviewEvent('review-upserted', { review });

    return jsonResponse(res, 201, { review });
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return jsonResponse(res, 400, { error: 'Niepoprawny format JSON.' });
    }
    console.error('Błąd podczas zapisywania opinii:', error);
    return jsonResponse(res, 500, { error: 'Nie udało się zapisać opinii.' });
  }
}

function handleCommunityJournalStream(req, res) {
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

function handleReviewsStream(req, res) {
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
  reviewStreamClients.add(client);

  req.on('close', () => {
    clearInterval(heartbeat);
    reviewStreamClients.delete(client);
  });
}

const dynamicRoutes = [
  {
    method: 'POST',
    pattern: /^\/api\/community\/journal\/([^/]+)\/comments$/,
    handler: (req, res, [entryId]) => handleCreateCommunityJournalComment(req, res, { entryId }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/community\/journal\/([^/]+)\/likes$/,
    handler: (req, res, [entryId]) => handleToggleCommunityJournalLike(req, res, { entryId }),
  },
];

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

function resolveDynamicRoute(method, pathname) {
  const normalizedMethod = method.toUpperCase();

  for (const route of dynamicRoutes) {
    if (route.method !== normalizedMethod) {
      continue;
    }

    const match = pathname.match(route.pattern);
    if (match) {
      return { handler: route.handler, params: match.slice(1) };
    }

    if (BASE_PATH !== '/' && pathname.startsWith(`${BASE_PATH}/`)) {
      const relative = pathname.slice(BASE_PATH.length);
      const relativeMatch = relative.match(route.pattern);
      if (relativeMatch) {
        return { handler: route.handler, params: relativeMatch.slice(1) };
      }
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

    const dynamicMatch = resolveDynamicRoute(req.method, url.pathname);
    if (dynamicMatch) {
      return dynamicMatch.handler(req, res, dynamicMatch.params);
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const served = await tryServeStaticFile(req, url.pathname, res);
      if (served) {
        return;
      }
    }

    return jsonResponse(res, 404, { error: 'Endpoint nie istnieje.' });
  });
}

export async function start() {
  await ensureSpreadsheetFile();
  await ensureDataFile();
  await ensureCommunityJournalFile();
  await ensureReviewsFile();
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

async function tryServeStaticFile(req, pathname, res) {
  if (!isWithinBasePath(pathname)) {
    return false;
  }

  const relativePath = extractPathRelativeToBase(pathname);
  if (relativePath === null) {
    return false;
  }

  const targetPath = relativePath ? relativePath : 'app.html';

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
      return false;
    }

    const mimeType = getMimeType(absolutePath);
    const headers = {
      'Content-Type': mimeType,
      'Content-Length': stats.size,
    };

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
    } else {
      const file = await fs.readFile(absolutePath);
      res.end(file);
    }

    return true;
  } catch (error) {
    if (error.code === 'ENOENT' && !targetPath.endsWith('.html')) {
      // Retry HTML fallback for paths like /app/achievements
      const htmlCandidate = `${targetPath}.html`;
      const htmlPath = path.resolve(__dirname, htmlCandidate);
      if (htmlPath.startsWith(__dirname)) {
        try {
          const stats = await fs.stat(htmlPath);
          if (stats.isDirectory()) {
            return false;
          }

          const mimeType = getMimeType(htmlPath);
          const headers = {
            'Content-Type': mimeType,
            'Content-Length': stats.size,
          };

          res.writeHead(200, headers);
          if (req.method === 'HEAD') {
            res.end();
          } else {
            const file = await fs.readFile(htmlPath);
            res.end(file);
          }
          return true;
        } catch (htmlError) {
          if (htmlError.code !== 'ENOENT') {
            console.error('Nie udało się odczytać pliku statycznego:', htmlError);
          }
        }
      }
    }

    if (error.code !== 'ENOENT') {
      console.error('Błąd podczas serwowania pliku statycznego:', error);
    }
  }

  return false;
}
