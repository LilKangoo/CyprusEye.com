const AUTH_EVENTS = new Set();

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

const state = createEmptyState();

function resetState() {
  state.currentSession = null;
  state.users = {};
  state.profiles = {};
  state.xpEvents = {};
  state.lastResetRequests = [];
  state.lastVerificationRequests = [];
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
      state.profiles[userId] = { ...existing, ...overrides, updated_at: new Date().toISOString() };
    }
    return state.profiles[userId];
  }
  const template = {
    id: userId,
    email: overrides.email || '',
    name: overrides.name || '',
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
  state.users[email] = {
    id,
    email,
    password,
    confirmed_at: profile.confirmed_at ?? new Date().toISOString(),
  };
  ensureProfile(id, { ...profile, email });
  state.xpEvents[id] = xpEvents.map((event, index) => ({
    xp_delta: Number(event.xp_delta) || 0,
    reason: event.reason || `xp-event-${index + 1}`,
    created_at: event.created_at || new Date(Date.now() - index * 60000).toISOString(),
  }));
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
  const updated = { ...existing, ...values, updated_at: new Date().toISOString() };
  state.profiles[user.id] = updated;
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
          },
        };
        ensureProfile(user.id, { email: user.email });
        broadcast('SIGNED_IN');
        return { data: { session: state.currentSession }, error: null };
      },
      async signUp({ email, password, options }) {
        if (state.users[email]) {
          return { data: null, error: { message: 'User already registered' } };
        }
        const profileData = options?.data ?? {};
        const user = seedUser({ email, password, profile: { name: profileData.name || '' } });
        return { data: { user: { id: user.id, email: user.email } }, error: null };
      },
      async signOut() {
        state.currentSession = null;
        broadcast('SIGNED_OUT');
        return { error: null };
      },
      async resetPasswordForEmail(email, { redirectTo } = {}) {
        state.lastResetRequests.push({ email, redirectTo, at: Date.now() });
        return { data: {}, error: null };
      },
      async updateUser({ password }) {
        const { user, error } = requireSession();
        if (error) {
          return { data: null, error };
        }
        const existing = resolveUserByEmail(user.email);
        if (existing) {
          existing.password = password;
        }
        return { data: { user: clone(state.currentSession?.user) }, error: null };
      },
      async resend({ type, email, options }) {
        state.lastVerificationRequests.push({ type, email, redirectTo: options?.emailRedirectTo ?? null, at: Date.now() });
        return { data: {}, error: null };
      },
      onAuthStateChange(callback) {
        AUTH_EVENTS.add(callback);
        callback('INITIAL_SESSION', state.currentSession);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                AUTH_EVENTS.delete(callback);
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
}

resetState();

globalThis.__supabaseStub = {
  state,
  reset: resetState,
  seedUser,
  addXpEvent({ userId, xp_delta, reason, created_at }) {
    if (!userId) return;
    if (!Array.isArray(state.xpEvents[userId])) {
      state.xpEvents[userId] = [];
    }
    state.xpEvents[userId].unshift({
      xp_delta: Number(xp_delta) || 0,
      reason: reason || 'event',
      created_at: created_at || new Date().toISOString(),
    });
  },
  setSession(user) {
    if (!user) {
      state.currentSession = null;
      return;
    }
    state.currentSession = { user: { id: user.id, email: user.email } };
  },
};
