import { sb } from './supabaseClient.js';

function ensureNotGuest() {
  const state = window.CE_STATE || {};
  if (state.guest?.active && !state.session?.user) {
    throw new Error('Tryb gościa nie pozwala na zapisywanie XP.');
  }
}

export async function addXp(xp_delta, reason = 'check-in') {
  ensureNotGuest();
  const { data, error: userError } = await sb.auth.getUser();
  if (userError) {
    throw userError;
  }
  const user = data?.user;
  if (!user?.id) {
    throw new Error('Brak zalogowanego użytkownika');
  }

  const payload = [{ user_id: user.id, xp_delta, reason }];
  const { error } = await sb.from('user_xp_events').insert(payload);
  if (error) {
    throw error;
  }
}

export async function myXpEvents() {
  const { data, error } = await sb
    .from('user_xp_events')
    .select('xp_delta,reason,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
}
