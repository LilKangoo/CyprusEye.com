const AUTH_EVENTS = new Set();
const STORAGE_KEY = '__supabaseStubState';
const WINDOW_NAME_PREFIX = '[[SUPABASE_STUB_STATE=';
const WINDOW_NAME_SUFFIX = ']]';

function createEmptyState() {
  return {
    currentSession: null,
    users: {},
    profiles: {},
    xpEvents: {},
    lastResetRequests: [],
    lastVerificationRequests: [],
  };
}

function getAvailableStorages() {
  const stores = [];
  for (const key of ['sessionStorage', 'localStorage']) {
    try {
      const store = globalThis?.[key];
      if (store && typeof store.getItem === 'function' && typeof store.setItem === 'function') {
        stores.push(store);
      }
    } catch (error) {
      // ignore storage access issues
    }
  }
  return stores;
}

const STORAGE_TARGETS = getAvailableStorages();

function getWindowName() {
  try {
    if (typeof window !== 'undefined' && typeof window.name === 'string') {
      return window.name;
    }
  } catch (error) {
    // ignore access errors
  }
  return '';
}

function setWindowName(value) {
  try {
    if (typeof window !== 'undefined') {
      window.name = value;
    }
  } catch (error) {
    // ignore write errors
  }
}

function readPersistedState() {
  for (const store of STORAGE_TARGETS) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (typeof raw === 'string' && raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (error) {
      // ignore JSON/storage errors
    }
  }
  return readWindowNameState();
}

const state = createEmptyState();

function persistState() {
  const payload = JSON.stringify(state);
  for (const store of STORAGE_TARGETS) {
    try {
      store.setItem(STORAGE_KEY, payload);
    } catch (error) {
      // ignore storage write failures
    }
  }
  writeWindowNameState(state);
}

function clearPersistedStateStorage() {
  for (const store of STORAGE_TARGETS) {
    try {
      store.removeItem(STORAGE_KEY);
    } catch (error) {
      // ignore storage removal issues
    }
  }
  setWindowName(stripWindowNameState(getWindowName()));
}

function readWindowNameState() {
  try {
    const current = getWindowName();
    if (!current) {
      return null;
    }
    const start = current.indexOf(WINDOW_NAME_PREFIX);
    if (start === -1) {
      return null;
    }
    const end = current.indexOf(WINDOW_NAME_SUFFIX, start + WINDOW_NAME_PREFIX.length);
    if (end === -1) {
      return null;
    }
    const raw = current.slice(start + WINDOW_NAME_PREFIX.length, end);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function stripWindowNameState(current) {
  if (!current) {
    return '';
  }
  const start = current.indexOf(WINDOW_NAME_PREFIX);
  if (start === -1) {
    return current;
  }
  const end = current.indexOf(WINDOW_NAME_SUFFIX, start + WINDOW_NAME_PREFIX.length);
  if (end === -1) {
    return current.slice(0, start);
  }
  return `${current.slice(0, start)}${current.slice(end + WINDOW_NAME_SUFFIX.length)}`;
}

function writeWindowNameState(value) {
  try {
    const serialized = JSON.stringify(value);
    const current = getWindowName();
    const cleaned = stripWindowNameState(current);
    setWindowName(`${cleaned}${WINDOW_NAME_PREFIX}${serialized}${WINDOW_NAME_SUFFIX}`);
  } catch (error) {
    // ignore window.name write failures
  }
}

function hydrateState(source) {
  if (!source || typeof source !== 'object') {
    return;
  }
  state.currentSession = source.currentSession ?? null;
  state.users = source.users ? { ...source.users } : {};
  state.profiles = source.profiles ? { ...source.profiles } : {};
  state.xpEvents = source.xpEvents ? { ...source.xpEvents } : {};
  state.lastResetRequests = Array.isArray(source.lastResetRequests)
    ? [...source.lastResetRequests]
    : [];
  state.lastVerificationRequests = Array.isArray(source.lastVerificationRequests)
    ? [...source.lastVerificationRequests]
    : [];
}

const persistedState = readPersistedState();
if (persistedState) {
  hydrateState(persistedState);
  writeWindowNameState(state);
} else {
  persistState();
}

function resetState() {
  state.currentSession = null;
  state.users = {};
  state.profiles = {};
  state.xpEvents = {};
  state.lastResetRequests = [];
  state.lastVerificationRequests = [];
  persistState();
}

function broadcast(event) {
  for (const handler of AUTH_EVENTS) {
    try {
      handler(event, state.currentSession);
    } catch (error) {
      console.error('supabase stub handler error', error);
    }
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function ensureProfile(userId, overrides = {}) {
  if (!userId) return null;
  const existing = state.profiles[userId];
  if (existing) {
    if (overrides && Object.keys(overrides).length) {
      const next = { ...existing, ...overrides, updated_at: new Date().toISOString() };
      if (typeof overrides.username === 'string' && !('username_normalized' in overrides)) {
        next.username_normalized = overrides.username.trim().toLowerCase();
      }
      state.profiles[userId] = next;
    }
    return state.profiles[userId];
  }
  const template = {
    id: userId,
    email: overrides.email || '',
    name: overrides.name || '',
    username: overrides.username || '',
    username_normalized:
      typeof overrides.username === 'string' && overrides.username
        ? overrides.username.trim().toLowerCase()
        : overrides.username_normalized || '',
    xp: overrides.xp ?? 0,
    level: overrides.level ?? 1,
    updated_at: new Date().toISOString(),
  };
  state.profiles[userId] = template;
  if (!state.xpEvents[userId]) {
    state.xpEvents[userId] = [];
  }
  return template;
}

function seedUser({ email, password, profile = {}, xpEvents = [] }) {
  if (!email) {
    throw new Error('email is required for seedUser');
  }
  const id = profile.id || `user-${Math.random().toString(36).slice(2, 10)}`;
  const metadata = profile.metadata && typeof profile.metadata === 'object' ? { ...profile.metadata } : {};
  if (typeof profile.username === 'string' && !metadata.username) {
    metadata.username = profile.username;
  }
  state.users[email] = {
    id,
    email,
    password,
    confirmed_at: profile.confirmed_at ?? new Date().toISOString(),
    metadata,
  };
  ensureProfile(id, { ...profile, email });
  state.xpEvents[id] = xpEvents.map((event, index) => ({
    xp_delta: Number(event.xp_delta) || 0,
    reason: event.reason || `xp-event-${index + 1}`,
    created_at: event.created_at || new Date(Date.now() - index * 60000).toISOString(),
  }));
  persistState();
  return state.users[email];
}

function resolveUserByEmail(email) {
  return email ? state.users[email] ?? null : null;
}

function getCurrentUser() {
  return state.currentSession?.user ?? null;
}

function requireSession() {
  const user = getCurrentUser();
  if (!user) {
    return { error: { message: 'Not authenticated' }, user: null };
  }
  return { error: null, user };
}

function selectProfilesSingle() {
  const { user, error } = requireSession();
  if (error) {
    return { data: null, error };
  }
  const profile = state.profiles[user.id];
  if (!profile) {
    return { data: null, error: { message: 'Profile not found' } };
  }
  return { data: clone(profile), error: null };
}

function updateProfile(values, filters = []) {
  const { user, error } = requireSession();
  if (error) {
    return { data: null, error };
  }
  const allowed = filters.every((filter) => filter.column !== 'id' || filter.value === user.id);
  if (!allowed) {
    return { data: null, error: { message: 'Permission denied' } };
  }
  const existing = state.profiles[user.id];
  if (!existing) {
    return { data: null, error: { message: 'Profile not found' } };
  }
  if (typeof values.username === 'string') {
    const normalized = values.username.trim().toLowerCase();
    for (const [profileId, profile] of Object.entries(state.profiles)) {
      if (
        profileId !== user.id &&
        profile &&
        typeof profile.username === 'string' &&
        profile.username.trim().toLowerCase() === normalized
      ) {
        return {
          data: null,
          error: {
            message: 'duplicate key value violates unique constraint "profiles_username_key"',
            code: '23505',
          },
        };
      }
      if (
        profileId !== user.id &&
        profile &&
        typeof profile.username_normalized === 'string' &&
        profile.username_normalized === normalized
      ) {
        return {
          data: null,
          error: {
            message: 'duplicate key value violates unique constraint "profiles_username_key"',
            code: '23505',
          },
        };
      }
    }
  }

  const updated = { ...existing, ...values };
  if (typeof values.username === 'string') {
    const trimmed = values.username.trim();
    updated.username = trimmed;
    if ('username_normalized' in values) {
      updated.username_normalized = values.username_normalized;
    } else {
      updated.username_normalized = trimmed ? trimmed.toLowerCase() : '';
    }
  } else if (typeof values.username_normalized === 'string') {
    updated.username_normalized = values.username_normalized;
  }
  updated.updated_at = new Date().toISOString();
  state.profiles[user.id] = updated;
  persistState();
  return { data: clone(updated), error: null };
}

function insertXpEvents(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return { data: [], error: null };
  }
  const { user, error } = requireSession();
  if (error) {
    return { data: null, error: { message: 'Not authenticated' } };
  }
  const [row] = rows;
  if (row.user_id && row.user_id !== user.id) {
    return { data: null, error: { message: 'Permission denied' } };
  }
  const payload = {
    xp_delta: Number(row.xp_delta) || 0,
    reason: row.reason || 'event',
    created_at: new Date().toISOString(),
  };
  if (!Array.isArray(state.xpEvents[user.id])) {
    state.xpEvents[user.id] = [];
  }
  state.xpEvents[user.id].unshift(payload);
  const profile = state.profiles[user.id];
  if (profile) {
    profile.xp = (profile.xp || 0) + payload.xp_delta;
    profile.updated_at = new Date().toISOString();
  }
  persistState();
  return { data: [clone(payload)], error: null };
}

function selectXpEventsOrdered(column, { ascending } = {}) {
  const { user, error } = requireSession();
  if (error) {
    return { data: null, error };
  }
  const events = Array.isArray(state.xpEvents[user.id]) ? [...state.xpEvents[user.id]] : [];
  if (column === 'created_at') {
    events.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return ascending ? aTime - bTime : bTime - aTime;
    });
  }
  return { data: clone(events), error: null };
}

export function createClient() {
  return {
    auth: {
      async getSession() {
        return { data: { session: state.currentSession }, error: null };
      },
      async getUser() {
        if (Array.isArray(stubApi.getUserQueue) && stubApi.getUserQueue.length > 0) {
          const next = stubApi.getUserQueue.shift();
          if (typeof next === 'function') {
            return await next();
          }
          if (next && typeof next === 'object' && ('data' in next || 'error' in next)) {
            return next;
          }
          return { data: { user: next ?? null }, error: null };
        }
        return { data: { user: getCurrentUser() }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const user = resolveUserByEmail(email);
        if (!user || (password && user.password && user.password !== password)) {
          return { data: null, error: { message: 'Invalid login credentials' } };
        }
        state.currentSession = {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { ...(user.metadata || {}) },
          },
        };
        ensureProfile(user.id, { email: user.email });
        broadcast('SIGNED_IN');
        persistState();
        return { data: { session: state.currentSession }, error: null };
      },
      async signUp({ email, password, options }) {
        if (state.users[email]) {
          return { data: null, error: { message: 'User already registered' } };
        }
        const profileData = options?.data ?? {};
        const user = seedUser({ email, password, profile: { name: profileData.name || '' } });
        persistState();
        return { data: { user: { id: user.id, email: user.email } }, error: null };
      },
      async signOut() {
        state.currentSession = null;
        broadcast('SIGNED_OUT');
        persistState();
        return { error: null };
      },
      async resetPasswordForEmail(email, { redirectTo } = {}) {
        state.lastResetRequests.push({ email, redirectTo, at: Date.now() });
        persistState();
        return { data: {}, error: null };
      },
      async updateUser({ password, data } = {}) {
        const { user, error } = requireSession();
        if (error) {
          return { data: null, error };
        }
        const existing = resolveUserByEmail(user.email);
        if (existing) {
          if (typeof password === 'string') {
            existing.password = password;
          }
          if (data && typeof data === 'object') {
            existing.metadata = { ...(existing.metadata || {}), ...data };
          }
        }
        if (state.currentSession?.user) {
          if (data && typeof data === 'object') {
            state.currentSession.user.user_metadata = {
              ...(state.currentSession.user.user_metadata || {}),
              ...data,
            };
          }
        }
        persistState();
        return { data: { user: clone(state.currentSession?.user) }, error: null };
      },
      async resend({ type, email, options }) {
        state.lastVerificationRequests.push({ type, email, redirectTo: options?.emailRedirectTo ?? null, at: Date.now() });
        persistState();
        return { data: {}, error: null };
      },
      onAuthStateChange(callback) {
        AUTH_EVENTS.add(callback);
        let initialTimer = null;
        const triggerInitial = () => {
          initialTimer = null;
          try {
            callback('INITIAL_SESSION', state.currentSession);
          } catch (error) {
            console.error('supabase stub initial auth handler error', error);
          }
        };
        if (typeof stubApi.initialSessionEventDelay === 'number' && stubApi.initialSessionEventDelay >= 0) {
          initialTimer = setTimeout(triggerInitial, stubApi.initialSessionEventDelay);
        } else {
          triggerInitial();
        }
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                AUTH_EVENTS.delete(callback);
                if (initialTimer) {
                  clearTimeout(initialTimer);
                  initialTimer = null;
                }
              },
            },
          },
          error: null,
        };
      },
    },
    from(table) {
      if (table === 'profiles') {
        return {
          select() {
            return {
              async single() {
                return selectProfilesSingle();
              },
            };
          },
          update(values) {
            const filters = [];
            return {
              eq(column, value) {
                filters.push({ column, value });
                return {
                  select() {
                    return {
                      async single() {
                        return updateProfile(values, filters);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'user_xp_events') {
        return {
          select() {
            return {
              async order(column, options) {
                return selectXpEventsOrdered(column, options);
              },
            };
          },
          async insert(rows) {
            return insertXpEvents(rows);
          },
        };
      }
      return {
        async select() {
          return { data: null, error: { message: `Table ${table} not implemented` } };
        },
      };
    },
  };

const stubApi =
  typeof globalThis.__supabaseStub === 'object' && globalThis.__supabaseStub !== null
    ? globalThis.__supabaseStub
    : {};
stubApi.state = state;
stubApi.reset = resetState;
stubApi.seedUser = seedUser;
stubApi.addXpEvent = function addXpEvent({ userId, xp_delta, reason, created_at }) {
  if (!userId) return;
  if (!Array.isArray(state.xpEvents[userId])) {
    state.xpEvents[userId] = [];
  }
  state.xpEvents[userId].unshift({
    xp_delta: Number(xp_delta) || 0,
    reason: reason || 'event',
    created_at: created_at || new Date().toISOString(),
  });
  persistState();
};
stubApi.setSession = function setSession(user) {
  if (!user) {
    state.currentSession = null;
    persistState();
    return;
  }
  const existing = user.email ? resolveUserByEmail(user.email) : null;
  const metadata =
    (user && typeof user.user_metadata === 'object' && user.user_metadata) || existing?.metadata || {};
  state.currentSession = {
    user: {
      id: user.id,
      email: user.email,
      user_metadata: { ...metadata },
    },
  };
  persistState();
};
stubApi.clearPersistence = clearPersistedStateStorage;

if (!Array.isArray(stubApi.getUserQueue)) {
  stubApi.getUserQueue = [];
}

globalThis.__supabaseStub = stubApi;

if (typeof stubApi.onReady === 'function') {
  try {
    stubApi.onReady(stubApi);
  } catch (error) {
    console.error('supabase stub onReady error', error);
  }
}
}
