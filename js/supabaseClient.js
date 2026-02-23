import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUPABASE_CONFIG } from './config.js'
import { initForceRefresh } from './forceRefresh.js'

export const sb = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: SUPABASE_CONFIG.storageKey,
    storage: window.localStorage,
    flowType: 'pkce',
    // Disable navigator locks coordination to avoid auth lock timeouts in busy tabs.
    multiTab: false,
  },
})

const AUTH_LOCK_ERROR_RE = /Navigator LockManager lock|lock:sb-.*-auth-token|timed out waiting/i;
const SESSION_CACHE_TTL_MS = 1500;
const GET_SESSION_TIMEOUT_MS = 12500;

const originalGetSession = typeof sb?.auth?.getSession === 'function'
  ? sb.auth.getSession.bind(sb.auth)
  : null;
const originalSetSession = typeof sb?.auth?.setSession === 'function'
  ? sb.auth.setSession.bind(sb.auth)
  : null;

let sessionCache = null;
let sessionCacheAt = 0;
let getSessionInFlight = null;

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
  sessionCache = session || null;
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
      if (persisted?.access_token) return persisted;
    }
  } catch (_) {}

  try {
    const stateSession = window.CE_STATE?.session || null;
    if (stateSession?.access_token) return stateSession;
  } catch (_) {}

  return null;
}

async function getSessionSafe(options = {}) {
  if (!originalGetSession) return buildSessionResponse(null, 'no-client');

  const force = Boolean(options?.force);
  const timeoutMs = Number(options?.timeoutMs || GET_SESSION_TIMEOUT_MS);
  const now = Date.now();

  if (!force && (now - sessionCacheAt) < SESSION_CACHE_TTL_MS) {
    return buildSessionResponse(sessionCache, 'memory-cache');
  }

  if (getSessionInFlight) return getSessionInFlight;

  const runner = (async () => {
    try {
      const result = await withTimeout(originalGetSession(), timeoutMs);
      const session = result?.data?.session || null;
      if (!result?.error) {
        setSessionCache(session);
        return { ...(result || {}), source: 'supabase' };
      }
      if (isAuthLockTimeoutError(result.error)) {
        const fallback = readPersistedSessionFallback();
        if (fallback) {
          setSessionCache(fallback);
          return buildSessionResponse(fallback, 'persisted-fallback');
        }
        return buildSessionResponse(sessionCache, 'memory-fallback');
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
        return buildSessionResponse(sessionCache, 'memory-fallback');
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
  if (typeof window.getSupabase !== 'function') {
    window.getSupabase = () => sb
  }

  try {
    initForceRefresh(sb)
  } catch (_) {}
}
