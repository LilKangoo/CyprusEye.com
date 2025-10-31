const PROFILE_COLUMNS = 'id,email,name,username,avatar_url,xp,level,updated_at';

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
  profile.avatar_url = record?.avatar_url || null;

  return profile;
}

async function fetchProfileRow(columns, userId) {
  const sb = getSupabaseClient();
  const query = sb.from('profiles').select(columns).eq('id', userId);
  try {
    const result = typeof query.maybeSingle === 'function' ? await query.maybeSingle() : await query.single();
    if (result?.error?.code === 'PGRST116') {
      return { data: null, error: null };
    }
    return result;
  } catch (error) {
    console.error('Błąd pobierania profilu:', error);
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
  return loadProfileForUser(user);
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

export async function uploadAvatar(file) {
  const user = await requireCurrentUser();
  const sb = getSupabaseClient();

  // Walidacja pliku
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    throw new Error('Plik jest za duży (maksymalnie 2MB)');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Tylko pliki graficzne są dozwolone (JPG, PNG, GIF, WebP)');
  }

  // Usuń stary avatar jeśli istnieje
  try {
    const { data: files } = await sb.storage.from('avatars').list(user.id);
    if (files && files.length > 0) {
      const filesToRemove = files.map((f) => `${user.id}/${f.name}`);
      await sb.storage.from('avatars').remove(filesToRemove);
    }
  } catch (error) {
    console.warn('Nie udało się usunąć starego avatara:', error);
  }

  // Upload nowego pliku
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

  const { data, error } = await sb.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  // Pobierz publiczny URL
  const {
    data: { publicUrl },
  } = sb.storage.from('avatars').getPublicUrl(fileName);

  // Zaktualizuj profil
  return updateProfile({ avatar_url: publicUrl });
}

export async function removeAvatar() {
  const user = await requireCurrentUser();
  const sb = getSupabaseClient();

  // Usuń pliki z storage
  try {
    const { data: files } = await sb.storage.from('avatars').list(user.id);
    if (files && files.length > 0) {
      const filesToRemove = files.map((f) => `${user.id}/${f.name}`);
      await sb.storage.from('avatars').remove(filesToRemove);
    }
  } catch (error) {
    console.warn('Nie udało się usunąć plików avatara:', error);
  }

  // Zaktualizuj profil (usuń URL)
  return updateProfile({ avatar_url: null });
}
