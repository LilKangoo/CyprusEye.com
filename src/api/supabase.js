/**
 * Supabase API Layer
 * Wrapper functions for Supabase client operations
 */

import store from '../state/store.js';

/**
 * Get Supabase client instance
 * @returns {Object|null}
 */
export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check for test stub first
  if (window.__supabaseStub) {
    return window.__supabaseStub;
  }

  // Check for real client
  if (window.sb) {
    return window.sb;
  }

  // Fallback to global getSupabase function
  if (typeof window.getSupabase === 'function') {
    return window.getSupabase();
  }

  return null;
}

/**
 * Get display name from Supabase user
 * @param {Object} user - Supabase user object
 * @returns {string}
 */
export function getSupabaseDisplayName(user) {
  if (!user) {
    return '';
  }

  // Try user_metadata first
  if (user.user_metadata?.name) {
    return user.user_metadata.name;
  }

  // Try email
  if (user.email) {
    return user.email.split('@')[0];
  }

  // Fallback to ID
  return user.id?.slice(0, 8) || 'User';
}

/**
 * Normalize Supabase progress snapshot
 * @param {Object} progress - Raw progress from Supabase
 * @returns {Object}
 */
export function normalizeSupabaseProgressSnapshot(progress) {
  if (!progress || typeof progress !== 'object') {
    return { xp: 0, level: 1 };
  }

  return {
    xp: Number.isFinite(progress.xp) ? Math.max(0, progress.xp) : 0,
    level: Number.isFinite(progress.level) ? Math.max(1, progress.level) : 1,
  };
}

/**
 * Check if Supabase is available
 * @returns {boolean}
 */
export function isSupabaseAvailable() {
  return getSupabaseClient() !== null;
}

/**
 * Get current Supabase user
 * @returns {Object|null}
 */
export async function getCurrentUser() {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  try {
    const { data: { user } } = await client.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Get user session
 * @returns {Object|null}
 */
export async function getSession() {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  try {
    const { data: { session } } = await client.auth.getSession();
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Sign in with email
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object} Result with data or error
 */
export async function signInWithEmail(email, password) {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const result = await client.auth.signInWithPassword({ email, password });
    return result;
  } catch (error) {
    console.error('Error signing in:', error);
    return { data: null, error };
  }
}

/**
 * Sign up with email
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} metadata - User metadata
 * @returns {Object} Result with data or error
 */
export async function signUpWithEmail(email, password, metadata = {}) {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const result = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    return result;
  } catch (error) {
    console.error('Error signing up:', error);
    return { data: null, error };
  }
}

/**
 * Sign out
 * @returns {Object} Result with error if any
 */
export async function signOut() {
  const client = getSupabaseClient();
  if (!client) {
    return { error: new Error('Supabase not available') };
  }

  try {
    const result = await client.auth.signOut();
    return result;
  } catch (error) {
    console.error('Error signing out:', error);
    return { error };
  }
}

/**
 * Update user profile in database
 * @param {string} userId - User ID
 * @param {Object} updates - Profile updates
 * @returns {Object} Result with data or error
 */
export async function updateUserProfile(userId, updates) {
  const client = getSupabaseClient();
  if (!client || !userId) {
    return { data: null, error: new Error('Invalid parameters') };
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { data: null, error };
  }
}

/**
 * Get user profile from database
 * @param {string} userId - User ID
 * @returns {Object} Result with data or error
 */
export async function getUserProfile(userId) {
  const client = getSupabaseClient();
  if (!client || !userId) {
    return { data: null, error: new Error('Invalid parameters') };
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error getting profile:', error);
    return { data: null, error };
  }
}

/**
 * Subscribe to Supabase auth changes
 * @param {Function} callback - Callback(event, session)
 * @returns {Object} Subscription object
 */
export function subscribeToAuthChanges(callback) {
  const client = getSupabaseClient();
  if (!client) {
    return { unsubscribe: () => {} };
  }

  try {
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return subscription;
  } catch (error) {
    console.error('Error subscribing to auth changes:', error);
    return { unsubscribe: () => {} };
  }
}

/**
 * Initialize Supabase state in store
 */
export function initializeSupabaseState() {
  store.setState('supabase', {
    client: getSupabaseClient(),
    user: null,
    session: null,
    isAvailable: isSupabaseAvailable(),
  });
}

/**
 * Update Supabase user in store
 * @param {Object} user - User object
 */
export function updateSupabaseUser(user) {
  const current = store.getState('supabase') || {};
  store.setState('supabase', {
    ...current,
    user,
  });
}

/**
 * Update Supabase session in store
 * @param {Object} session - Session object
 */
export function updateSupabaseSession(session) {
  const current = store.getState('supabase') || {};
  store.setState('supabase', {
    ...current,
    session,
  });
}
