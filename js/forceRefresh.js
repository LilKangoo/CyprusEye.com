export function initForceRefresh(sb) {
  if (typeof window === 'undefined') return;
  if (!sb) return;

  const path = window.location?.pathname || '/';
  if (
    path.startsWith('/admin/') ||
    path.startsWith('/auth/') ||
    path.startsWith('/reset/') ||
    path.startsWith('/account/')
  )
    return;

  const LS_APPLIED = 'ce_force_refresh_applied_version';
  const SS_PENDING = 'ce_force_refresh_pending_version';
  const POLL_MS = 5 * 60 * 1000;

  const readApplied = () => {
    try {
      return Number(window.localStorage.getItem(LS_APPLIED) || 0);
    } catch (_) {
      return 0;
    }
  };

  const writeApplied = (v) => {
    try {
      window.localStorage.setItem(LS_APPLIED, String(v));
    } catch (_) {}
  };

  const readPending = () => {
    try {
      return Number(window.sessionStorage.getItem(SS_PENDING) || 0);
    } catch (_) {
      return 0;
    }
  };

  const writePending = (v) => {
    try {
      window.sessionStorage.setItem(SS_PENDING, String(v));
    } catch (_) {}
  };

  const clearPending = () => {
    try {
      window.sessionStorage.removeItem(SS_PENDING);
    } catch (_) {}
  };

  async function fetchRemoteVersion() {
    const { data, error } = await sb
      .from('site_settings')
      .select('force_refresh_version')
      .eq('id', 1)
      .maybeSingle();

    if (error) return null;
    return Number(data?.force_refresh_version || 0);
  }

  async function checkAndReloadIfNeeded() {
    try {
      const remote = await fetchRemoteVersion();
      if (remote == null) return;

      const applied = readApplied();
      if (remote <= applied) {
        clearPending();
        return;
      }

      const pending = readPending();
      if (pending === remote) {
        writeApplied(remote);
        clearPending();
        return;
      }

      writePending(remote);
      window.location.reload();
    } catch (_) {}
  }

  setTimeout(() => {
    checkAndReloadIfNeeded();
    setInterval(checkAndReloadIfNeeded, POLL_MS);
  }, 1500);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkAndReloadIfNeeded();
    }
  });
}
