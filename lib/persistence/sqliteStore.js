import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

let db = null;
let statements = null;
let initialized = false;
let dataDirectory = null;

function mapUserRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name || null,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureDatabase(directory) {
  if (initialized) {
    return;
  }

  dataDirectory = directory || dataDirectory || process.cwd();
  fs.mkdirSync(dataDirectory, { recursive: true });
  const databasePath = path.join(dataDirectory, 'app.sqlite');
  db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS form_submissions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at DESC);
  `);

  statements = {
    insertUser: db.prepare(
      `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
       VALUES (@id, @email, @name, @passwordHash, @createdAt, @updatedAt)`
    ),
    getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
    updateUserPassword: db.prepare(
      'UPDATE users SET password_hash = @passwordHash, updated_at = @updatedAt WHERE id = @id'
    ),
    deleteResetTokensForUser: db.prepare('DELETE FROM reset_tokens WHERE user_id = ?'),
    insertResetToken: db.prepare(
      `INSERT INTO reset_tokens (token, user_id, expires_at, created_at)
       VALUES (@token, @userId, @expiresAt, @createdAt)`
    ),
    getResetToken: db.prepare('SELECT * FROM reset_tokens WHERE token = ?'),
    deleteResetToken: db.prepare('DELETE FROM reset_tokens WHERE token = ?'),
    insertJournalEntry: db.prepare(
      'INSERT INTO journal_entries (id, payload, created_at) VALUES (@id, @payload, @createdAt)'
    ),
    listJournalEntries: db.prepare(
      'SELECT payload FROM journal_entries ORDER BY created_at DESC LIMIT @limit'
    ),
    insertFormSubmission: db.prepare(
      'INSERT INTO form_submissions (id, type, payload, created_at) VALUES (@id, @type, @payload, @createdAt)'
    ),
    pruneFormSubmissions: db.prepare(
      `DELETE FROM form_submissions
       WHERE rowid NOT IN (
         SELECT rowid FROM form_submissions ORDER BY created_at DESC LIMIT @limit
       )`
    ),
  };

  initialized = true;
}

export function initSqliteStore(directory) {
  ensureDatabase(directory);
}

export function createUser(user, directory) {
  ensureDatabase(directory);
  try {
    statements.insertUser.run(user);
    return true;
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return false;
    }
    throw error;
  }
}

export function getUserByEmail(email, directory) {
  ensureDatabase(directory);
  const row = statements.getUserByEmail.get(email);
  return mapUserRow(row);
}

export function getUserById(userId, directory) {
  ensureDatabase(directory);
  const row = statements.getUserById.get(userId);
  return mapUserRow(row);
}

export function updateUserPassword(userId, passwordHash, updatedAt, directory) {
  ensureDatabase(directory);
  statements.updateUserPassword.run({ id: userId, passwordHash, updatedAt });
}

export function replaceResetTokenForUser(userId, token, expiresAt, directory) {
  ensureDatabase(directory);
  const transaction = db.transaction(() => {
    statements.deleteResetTokensForUser.run(userId);
    statements.insertResetToken.run({
      token,
      userId,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
  });
  transaction();
}

export function getResetToken(token, directory) {
  ensureDatabase(directory);
  const row = statements.getResetToken.get(token);
  if (!row) {
    return null;
  }
  return {
    token: row.token,
    userId: row.user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function deleteResetToken(token, directory) {
  ensureDatabase(directory);
  statements.deleteResetToken.run(token);
}

export function insertJournalEntry(entry, directory) {
  ensureDatabase(directory);
  statements.insertJournalEntry.run({
    id: entry.id,
    payload: JSON.stringify(entry),
    createdAt: entry.createdAt,
  });
}

export function listJournalEntries(limit = 200, directory) {
  ensureDatabase(directory);
  const rows = statements.listJournalEntries.all({ limit });
  return rows
    .map((row) => {
      try {
        return JSON.parse(row.payload);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

export function recordFormSubmission(entry, directory) {
  ensureDatabase(directory);
  statements.insertFormSubmission.run({
    id: entry.id,
    type: entry.type,
    payload: JSON.stringify(entry.payload ?? {}),
    createdAt: entry.createdAt,
  });
}

export function pruneFormSubmissions(limit = 500, directory) {
  ensureDatabase(directory);
  statements.pruneFormSubmissions.run({ limit });
}
