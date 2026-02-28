import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUPABASE_CONFIG } from './config.js'
import { initForceRefresh } from './forceRefresh.js?v=2'

const authLockChains = new Map()
const AUTH_ERROR_TEXT_RE = /jwt expired|expired jwt|invalid jwt|token expired|auth session missing|session expired|unauthorized|forbidden/i
const AUTH_ENDPOINT_RE = /\/auth\/v1\//i
const NATIVE_FETCH = typeof globalThis.fetch === 'function'
  ? globalThis.fetch.bind(globalThis)
  : null
let sbRef = null
let authRefreshInFlight = null

function inMemoryAuthLock(lockName, maybeTimeout, maybeFn) {
  const fn = typeof maybeFn === 'function'
    ? maybeFn
    : (typeof maybeTimeout === 'function' ? maybeTimeout : null)
  if (typeof fn !== 'function') {
    return Promise.resolve(null)
  }

  const key = String(lockName || 'supabase-auth-lock')
  const previous = authLockChains.get(key) || Promise.resolve()
  const run = previous
    .catch(() => {})
    .then(() => fn())

  authLockChains.set(key, run)
  return run.finally(() => {
    if (authLockChains.get(key) === run) {
      authLockChains.delete(key)
    }
  })
}

function messageFromUnknownError(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const message = String(value.message || value.error_description || value.error || '').trim()
    if (message) return message
  }
  return String(value)
}

function isAuthSessionExpiredError(value) {
  const raw = messageFromUnknownError(value).toLowerCase()
  if (!raw) return false
  const code = String(value?.code || '').trim().toUpperCase()
  const status = Number(value?.status || value?.statusCode || 0)
  return (
    code === 'PGRST301'
    || code === 'PGRST302'
    || code === 'PGRST303'
    || code === '401'
    || status === 401
    || AUTH_ERROR_TEXT_RE.test(raw)
  )
}

function toUserFacingAuthMessage(value, fallback = 'Session expired. Please sign in again.') {
  const raw = messageFromUnknownError(value).trim()
  if (!raw) return fallback
  if (isAuthSessionExpiredError(raw)) return fallback
  return raw
}

function requestUrlOf(input) {
  if (typeof input === 'string') return input
  if (input && typeof input === 'object' && typeof input.url === 'string') return input.url
  return ''
}

async function readResponseTextSafe(response) {
  if (!response || typeof response.clone !== 'function') return ''
  try {
    return await response.clone().text()
  } catch (_error) {
    return ''
  }
}

function withRefreshedAuthorizationHeader(init, accessToken) {
  const token = String(accessToken || '').trim()
  if (!token) return null

  const sourceHeaders = init?.headers
  const headers = new Headers(sourceHeaders || {})
  if (!headers.has('authorization') && !headers.has('Authorization')) {
    return null
  }
  headers.set('Authorization', `Bearer ${token}`)
  return { ...(init || {}), headers }
}

async function refreshSessionForFailedRequest() {
  if (!sbRef?.auth || typeof sbRef.auth.refreshSession !== 'function') {
    return null
  }
  if (authRefreshInFlight) return authRefreshInFlight

  const runner = (async () => {
    try {
      const { data, error } = await sbRef.auth.refreshSession()
      if (error) return null
      const session = data?.session || null
      if (session?.access_token) {
        setSessionCache(session)
      }
      return session
    } catch (_error) {
      return null
    }
  })()

  authRefreshInFlight = runner.finally(() => {
    if (authRefreshInFlight === runner) {
      authRefreshInFlight = null
    }
  })
  return authRefreshInFlight
}

async function supabaseFetchWithAuthRetry(input, init) {
  if (!NATIVE_FETCH) {
    throw new Error('Fetch API unavailable')
  }

  const response = await NATIVE_FETCH(input, init)
  const url = requestUrlOf(input)
  if (AUTH_ENDPOINT_RE.test(url)) return response
  if (response.status !== 401) return response

  const responseText = await readResponseTextSafe(response)
  if (!isAuthSessionExpiredError({ message: responseText, status: response.status })) {
    return response
  }

  const refreshedSession = await refreshSessionForFailedRequest()
  const freshToken = String(refreshedSession?.access_token || sessionCache?.access_token || '').trim()
  if (!freshToken) return response

  const retryInit = withRefreshedAuthorizationHeader(init, freshToken)
  if (!retryInit) return response

  try {
    return await NATIVE_FETCH(input, retryInit)
  } catch (_error) {
    return response
  }
}

export const sb = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: SUPABASE_CONFIG.storageKey,
    storage: window.localStorage,
    flowType: 'pkce',
    // Keep single-tab behavior and force local lock implementation to avoid browser LockManager timeouts.
    multiTab: false,
    lock: inMemoryAuthLock,
  },
  global: {
    fetch: supabaseFetchWithAuthRetry,
  },
})
sbRef = sb

const AUTH_LOCK_ERROR_RE = /Navigator LockManager lock|lock:sb-.*-auth-token|timed out waiting/i;
const SESSION_CACHE_TTL_MS = 1500;
const GET_SESSION_TIMEOUT_MS = 12500;
const SESSION_EXPIRY_SKEW_MS = 20 * 1000;

const originalGetSession = typeof sb?.auth?.getSession === 'function'
  ? sb.auth.getSession.bind(sb.auth)
  : null;
const originalSetSession = typeof sb?.auth?.setSession === 'function'
  ? sb.auth.setSession.bind(sb.auth)
  : null;

let sessionCache = null;
let sessionCacheAt = 0;
let getSessionInFlight = null;

function parseJwtPayload(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const json = atob(b64);
    return JSON.parse(json);
  } catch (_error) {
    return null;
  }
}

function getSessionExpiryMs(session) {
  if (!session || typeof session !== 'object') return null;
  const expiresAt = Number(session.expires_at || 0);
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    return expiresAt * 1000;
  }
  const payload = parseJwtPayload(session.access_token);
  const exp = Number(payload?.exp || 0);
  if (Number.isFinite(exp) && exp > 0) {
    return exp * 1000;
  }
  return null;
}

function isSessionExpired(session, skewMs = SESSION_EXPIRY_SKEW_MS) {
  if (!session || typeof session !== 'object') return true;
  if (!session.access_token) return true;
  const expiryMs = getSessionExpiryMs(session);
  if (!Number.isFinite(expiryMs) || expiryMs <= 0) return false;
  return expiryMs <= (Date.now() + Math.max(0, Number(skewMs || 0)));
}

function sanitizeSessionCandidate(session, skewMs = SESSION_EXPIRY_SKEW_MS) {
  return isSessionExpired(session, skewMs) ? null : session;
}

function isAuthLockTimeoutError(error) {
  const msg = String(error?.message || error || '');
  return AUTH_LOCK_ERROR_RE.test(msg);
}

function withTimeout(promise, timeoutMs) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer !== null) window.clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('AUTH_GET_SESSION_TIMEOUT')), timeoutMs);
    }),
  ]);
}

function setSessionCache(session) {
  sessionCache = sanitizeSessionCandidate(session, SESSION_EXPIRY_SKEW_MS);
  sessionCacheAt = Date.now();
}

function buildSessionResponse(session, source = 'cache') {
  return { data: { session: session || null }, error: null, source };
}

function readPersistedSessionFallback() {
  try {
    const ceAuth = window.CE_AUTH;
    if (ceAuth && typeof ceAuth.readPersistedSession === 'function') {
      const snapshot = ceAuth.readPersistedSession();
      const persisted = snapshot?.session || null;
      const safePersisted = sanitizeSessionCandidate(persisted, 0);
      if (safePersisted?.access_token) return safePersisted;
    }
  } catch (_) {}

  try {
    const stateSession = window.CE_STATE?.session || null;
    const safeStateSession = sanitizeSessionCandidate(stateSession, 0);
    if (safeStateSession?.access_token) return safeStateSession;
  } catch (_) {}

  return null;
}

async function getSessionSafe(options = {}) {
  if (!originalGetSession) return buildSessionResponse(null, 'no-client');

  const force = Boolean(options?.force);
  const timeoutMs = Number(options?.timeoutMs || GET_SESSION_TIMEOUT_MS);
  const now = Date.now();

  if (!force && (now - sessionCacheAt) < SESSION_CACHE_TTL_MS) {
    const safeCachedSession = sanitizeSessionCandidate(sessionCache);
    if (safeCachedSession) {
      return buildSessionResponse(safeCachedSession, 'memory-cache');
    }
  }

  if (getSessionInFlight) return getSessionInFlight;

  const runner = (async () => {
    try {
      const result = await withTimeout(originalGetSession(), timeoutMs);
      const rawSession = result?.data?.session || null;
      const session = sanitizeSessionCandidate(rawSession);
      if (!result?.error) {
        if (!session && rawSession?.access_token) {
          const refreshed = sanitizeSessionCandidate(await refreshSessionForFailedRequest());
          if (refreshed) {
            setSessionCache(refreshed);
            return { ...(result || {}), data: { session: refreshed }, source: 'supabase-refreshed' };
          }
        }
        setSessionCache(session);
        return { ...(result || {}), data: { session }, source: 'supabase' };
      }
      if (isAuthLockTimeoutError(result.error)) {
        const fallback = readPersistedSessionFallback();
        if (fallback) {
          setSessionCache(fallback);
          return buildSessionResponse(fallback, 'persisted-fallback');
        }
        return buildSessionResponse(sanitizeSessionCandidate(sessionCache), 'memory-fallback');
      }
      return result;
    } catch (error) {
      if (
        error?.message === 'AUTH_GET_SESSION_TIMEOUT'
        || isAuthLockTimeoutError(error)
      ) {
        const fallback = readPersistedSessionFallback();
        if (fallback) {
          setSessionCache(fallback);
          return buildSessionResponse(fallback, 'persisted-fallback');
        }
        return buildSessionResponse(sanitizeSessionCandidate(sessionCache), 'memory-fallback');
      }
      return { data: { session: null }, error };
    }
  })();

  getSessionInFlight = runner.finally(() => {
    if (getSessionInFlight === runner) {
      getSessionInFlight = null;
    }
  });

  return getSessionInFlight;
}

async function setSessionSafe(sessionPayload, options = {}) {
  if (!originalSetSession) {
    return { data: { session: null }, error: new Error('AUTH_SET_SESSION_UNAVAILABLE') };
  }

  const retries = Math.max(0, Number(options?.retries ?? 1));
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const result = await originalSetSession(sessionPayload);
      if (!result?.error) {
        setSessionCache(result?.data?.session || null);
      }
      if (result?.error && isAuthLockTimeoutError(result.error) && attempt < retries) {
        attempt += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 120 * attempt));
        continue;
      }
      return result;
    } catch (error) {
      if (isAuthLockTimeoutError(error) && attempt < retries) {
        attempt += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 120 * attempt));
        continue;
      }
      return { data: { session: null }, error };
    }
  }

  return { data: { session: null }, error: new Error('AUTH_SET_SESSION_FAILED') };
}

if (sb?.auth) {
  sb.auth.getSessionSafe = getSessionSafe;
  sb.auth.setSessionSafe = setSessionSafe;

  sb.auth.getSession = (...args) => {
    if (args.length) return originalGetSession(...args);
    return getSessionSafe();
  };

  sb.auth.setSession = (...args) => {
    if (!args.length) return originalSetSession();
    return setSessionSafe(args[0], { retries: 1 });
  };
}

// Export as both 'sb' and 'supabase' for compatibility
export const supabase = sb;

if (typeof window !== 'undefined') {
  window.sb = sb
  window.supabase = sb
  window.__SB__ = sb
  window.CE_AUTH_UTILS = {
    isRecoverableError: isAuthSessionExpiredError,
    toUserMessage: toUserFacingAuthMessage,
  }
  if (typeof window.getSupabase !== 'function') {
    window.getSupabase = () => sb
  }

  try {
    initForceRefresh(sb)
  } catch (_) {}
}
