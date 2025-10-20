import { sb } from './supabaseClient.js';
import { refreshSessionAndProfile } from './auth.js';

export async function bootAuth() {
  await refreshSessionAndProfile();
  updateAuthUI();
}

export function updateAuthUI() {
  const S = window.CE_STATE || {};
  const isLogged = !!S.session;
  const isGuest = !!S.guest?.active;

  document.querySelectorAll('[data-auth=login]').forEach((el) => {
    el.hidden = isLogged || isGuest;
  });
  document.querySelectorAll('[data-auth=logout]').forEach((el) => {
    el.hidden = !(isLogged || isGuest);
  });

  const badge = document.querySelector('#auth-state');
  if (badge) {
    badge.textContent = isLogged ? 'Zalogowany' : isGuest ? 'Gość' : 'Niezalogowany';
  }

  document.querySelectorAll('[data-gated=true]').forEach((el) => {
    el.hidden = !isLogged;
  });

  document.querySelectorAll('[data-auth-guest-note]').forEach((el) => {
    if (isGuest) {
      el.hidden = false;
      el.textContent = 'Grasz jako gość — postęp zapisany lokalnie na tym urządzeniu.';
    } else {
      el.hidden = true;
    }
  });
}

document.querySelectorAll('[data-auth=logout]').forEach((el) =>
  el.addEventListener('click', async () => {
    await sb.auth.signOut();
    localStorage.removeItem('ce_guest');
    window.CE_STATE = {};
    updateAuthUI();
    location.assign('/');
  }),
);
