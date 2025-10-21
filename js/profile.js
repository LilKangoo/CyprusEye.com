const sb = window.getSupabase();

async function requireCurrentUser() {
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
  const { data, error } = await sb
    .from('profiles')
    .update(values)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMyProfile() {
  const { data, error } = await sb
    .from('profiles')
    .select('id,email,name,username,xp,level,updated_at')
    .single();
  if (error) throw error;
  return data;
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
