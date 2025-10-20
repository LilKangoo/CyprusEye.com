import { sb } from './supabaseClient.js';

export async function getMyProfile() {
  const { data, error } = await sb
    .from('profiles')
    .select('id,email,name,xp,level,updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyName(name) {
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser();
  if (userError) throw userError;
  if (!user?.id) {
    throw new Error('Brak zalogowanego użytkownika.');
  }
  const { data, error } = await sb
    .from('profiles')
    .update({ name })
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
