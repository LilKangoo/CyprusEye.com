const sb = window.getSupabase();

const form = document.getElementById('form-password-update');
const messageEl = document.getElementById('resetMessage');
const backButton = document.getElementById('resetBackToAuth');

const SUPABASE_RETURN_PARAMS = new Set([
  'access_token',
  'token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_hash',
  'type',
  'code',
  'error',
  'error_description',
  'provider_token',
  'provider_refresh_token',
  'state',
]);

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

function parseSupabaseReturnParams() {
  if (typeof window === 'undefined') {
    return null;
  }

  let currentUrl;
  try {
    currentUrl = new URL(window.location.href);
  } catch (error) {
    console.warn('Nie udało się odczytać adresu URL dla Supabase.', error);
    return null;
  }

  const searchParams = new URLSearchParams(currentUrl.search);
  const rawHash = currentUrl.hash?.startsWith('#') ? currentUrl.hash.slice(1) : currentUrl.hash;
  let hashSource = rawHash || '';
  let hashPrefix = '';

  if (hashSource.startsWith('/?')) {
    hashSource = hashSource.slice(2);
  } else if (hashSource.startsWith('?')) {
    hashSource = hashSource.slice(1);
  } else {
    const questionIndex = hashSource.indexOf('?');
    if (questionIndex !== -1) {
      hashPrefix = hashSource.slice(0, questionIndex);
      hashSource = hashSource.slice(questionIndex + 1);
    }
  }

  const hashParams = hashSource && hashSource.includes('=') ? new URLSearchParams(hashSource) : null;
  const typeValue = (searchParams.get('type') || hashParams?.get('type') || '').toLowerCase();

  return { currentUrl, searchParams, rawHash, hashParams, hashPrefix, typeValue };
}

function stripSupabaseReturnParams(parsed) {
  if (!parsed) {
    return false;
  }

  const { currentUrl, searchParams, hashParams, rawHash, hashPrefix } = parsed;
  let updated = false;

  SUPABASE_RETURN_PARAMS.forEach((key) => {
    if (searchParams.has(key)) {
      searchParams.delete(key);
      updated = true;
    }
  });

  let cleanedHash = '';
  if (hashParams) {
    SUPABASE_RETURN_PARAMS.forEach((key) => {
      if (hashParams.has(key)) {
        hashParams.delete(key);
        updated = true;
      }
    });
    cleanedHash = hashParams.toString();
    if (hashPrefix) {
      cleanedHash = cleanedHash ? `${hashPrefix}?${cleanedHash}` : hashPrefix;
    }
    if (!cleanedHash && rawHash) {
      updated = true;
    }
  }

  const cleanedSearch = searchParams.toString();
  if (!updated) {
    return false;
  }

  const searchPart = cleanedSearch ? `?${cleanedSearch}` : '';
  const hashPart = cleanedHash ? `#${cleanedHash}` : '';
  const newUrl = `${currentUrl.pathname}${searchPart}${hashPart}`;

  try {
    window.history.replaceState(window.history.state, document.title, newUrl);
  } catch (error) {
    console.warn('Nie udało się wyczyścić parametrów Supabase z adresu URL.', error);
  }

  return true;
}

async function applySessionFromReturnParams(parsed) {
  if (!parsed) {
    return;
  }

  const searchParams = parsed.searchParams;
  const hashParams = parsed.hashParams;

  const code = searchParams.get('code') || hashParams?.get('code');
  const tokenHash = searchParams.get('token_hash') || hashParams?.get('token_hash');
  const typeValue = (searchParams.get('type') || hashParams?.get('type') || '').toLowerCase();
  const accessToken = hashParams?.get('access_token');
  const refreshToken = hashParams?.get('refresh_token');

  if (accessToken && refreshToken) {
    stripSupabaseReturnParams(parsed);
    await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return;
  }

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }
    stripSupabaseReturnParams(parsed);
    return;
  }

  if (tokenHash) {
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: typeValue || 'recovery' });
    if (error) {
      throw error;
    }
    stripSupabaseReturnParams(parsed);
  }
}

async function ensureRecoverySession() {
  setMessage('Sprawdzamy link odzyskiwania…', 'info');
  setFormDisabled(true);

  try {
    try {
      await sb.auth.getSession();
    } catch (_) {}

    const parsed = parseSupabaseReturnParams();
    if (parsed) {
      await applySessionFromReturnParams(parsed);
    }

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
    setMessage('Hasło zostało zaktualizowane. Przenosimy na stronę główną…', 'success');
    window.setTimeout(() => {
      window.location.assign('/');
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
