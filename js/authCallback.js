const sb = window.getSupabase();

const form = document.getElementById('form-password-update');
const messageEl = document.getElementById('resetMessage');
const backButton = document.getElementById('resetBackToAuth');

function setMessage(text, tone = 'info') {
  if (!messageEl) {
    return;
  }
  messageEl.textContent = text || '';
  if (tone) {
    messageEl.dataset.tone = tone;
    messageEl.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  } else {
    messageEl.removeAttribute('data-tone');
    messageEl.removeAttribute('aria-live');
  }
}

function setFormDisabled(disabled) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  form.querySelectorAll('input, button').forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
      el.disabled = disabled;
    }
  });
}

async function applySessionFromHash() {
  const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
  if (!hash) {
    return;
  }

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }
}

async function ensureRecoverySession() {
  setMessage('Sprawdzamy link odzyskiwania…', 'info');
  setFormDisabled(true);

  try {
    await applySessionFromHash();
    const { data, error } = await sb.auth.getSession();
    if (error) {
      throw error;
    }
    const session = data?.session;
    if (!session?.user) {
      setMessage('Link odzyskiwania jest nieprawidłowy lub wygasł.', 'error');
      return false;
    }
    setFormDisabled(false);
    setMessage('Wprowadź nowe hasło dla swojego konta.', 'info');
    return true;
  } catch (error) {
    console.error('Nie udało się zweryfikować linku resetu hasła.', error);
    setMessage(`Błąd: ${error.message || 'Nie udało się zweryfikować linku.'}`, 'error');
    return false;
  }
}

async function handlePasswordUpdate(event) {
  event.preventDefault();
  event.stopPropagation();

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const password = form.password?.value || '';
  const confirm = form.passwordConfirm?.value || '';

  if (!password || password.length < 8) {
    setMessage('Hasło musi mieć co najmniej 8 znaków.', 'error');
    return;
  }

  if (password !== confirm) {
    setMessage('Hasła nie są identyczne.', 'error');
    return;
  }

  setFormDisabled(true);
  setMessage('Zapisujemy nowe hasło…', 'info');

  try {
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      throw error;
    }
    setMessage('Hasło zostało zaktualizowane. Przenosimy do logowania…', 'success');
    window.setTimeout(() => {
      window.location.assign('/auth/');
    }, 800);
  } catch (error) {
    console.error('Nie udało się zaktualizować hasła.', error);
    setFormDisabled(false);
    setMessage(`Błąd: ${error.message || 'Nie udało się zapisać nowego hasła.'}`, 'error');
  }
}

if (form) {
  ensureRecoverySession().then((ready) => {
    if (ready) {
      form.addEventListener('submit', handlePasswordUpdate);
    }
  });
}

if (backButton instanceof HTMLButtonElement) {
  backButton.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.assign('/auth/');
  });
}
