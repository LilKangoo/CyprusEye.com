const PROFILE_COLUMNS = 'id,email,name,xp,level,updated_at';

function getSupabaseClient() {
  if (typeof window !== 'undefined' && typeof window.getSupabase === 'function') {
    return window.getSupabase();
  }
  throw new Error('Klient Supabase nie jest dostępny.');
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeProfile(user, record) {
  if (!user && !record) {
    return null;
  }

  const metadata =
    user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : Object.create(null);

  const profile = record && typeof record === 'object' ? { ...record } : {};

  if (user?.id && !profile.id) {
    profile.id = user.id;
  }

  const email = pickFirstString(record?.email, user?.email);
  profile.email = email ?? null;

  const name = pickFirstString(
    record?.name,
    metadata.name,
    metadata.full_name,
    metadata.display_name,
    metadata.first_name,
    metadata.preferred_name,
  );
  profile.name = name ?? null;

  const username = pickFirstString(
    record?.username,
    metadata.username,
    metadata.preferred_username,
    metadata.nickname,
    metadata.user_name,
  );
  profile.username = username ?? null;

  profile.xp = toNumber(record?.xp ?? profile.xp, 0);
  profile.level = toNumber(record?.level ?? profile.level, 0);
  profile.updated_at = record?.updated_at || record?.updatedAt || profile.updated_at || null;

  return profile;
}

async function fetchProfileRow(columns, userId) {
  const sb = getSupabaseClient();
  const query = sb.from('profiles').select(columns).eq('id', userId);
  console.log('[fetchProfileRow] Pobieranie profilu, kolumny:', columns, 'userId:', userId);
  try {
    const result = typeof query.maybeSingle === 'function' ? await query.maybeSingle() : await query.single();
    console.log('[fetchProfileRow] Wynik zapytania:', result);
    if (result?.error?.code === 'PGRST116') {
      return { data: null, error: null };
    }
    return result;
  } catch (error) {
    console.error('[fetchProfileRow] Błąd zapytania:', error);
    return { data: null, error };
  }
}

async function requireCurrentUser() {
  const sb = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error) throw error;
  if (!user?.id) {
    throw new Error('Brak zalogowanego użytkownika.');
  }
  return user;
}

async function updateProfile(values) {
  const user = await requireCurrentUser();
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('profiles')
    .update(values)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadProfileForUser(user) {
  if (!user?.id) {
    throw new Error('Brak zalogowanego użytkownika.');
  }

  const { data, error } = await fetchProfileRow(PROFILE_COLUMNS, user.id);
  if (error) {
    // Jeśli nie ma profilu (PGRST116), zwróć bazowy profil z user metadata
    if (error.code === 'PGRST116') {
      return normalizeProfile(user, null);
    }
    throw error;
  }

  return normalizeProfile(user, data);
}

export async function getMyProfile() {
  const user = await requireCurrentUser();
  const profile = await loadProfileForUser(user);
  console.log('[getMyProfile] Pobrano profil:', profile);
  return profile;
}

export async function updateMyName(name) {
  return updateProfile({ name });
}

export async function updateMyUsername(username) {
  const trimmed = typeof username === 'string' ? username.trim() : '';
  if (!trimmed) {
    throw new Error('Nazwa użytkownika jest wymagana.');
  }

  const payloads = [
    { username: trimmed, username_normalized: trimmed.toLowerCase() },
    { username: trimmed },
  ];

  let lastError = null;

  for (const payload of payloads) {
    try {
      return await updateProfile(payload);
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '').toLowerCase();
      const details = String(error?.details || '').toLowerCase();
      const hint = `${message} ${details}`;
      if ('username_normalized' in payload && hint.includes('username_normalized')) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
