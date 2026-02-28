export function initForceRefresh(sb) {
  if (typeof window === 'undefined') return;
  if (!sb) return;

  const path = window.location?.pathname || '/';
  if (
    path.startsWith('/auth/') ||
    path.startsWith('/reset/') ||
    path.startsWith('/account/')
  )
    return;

  const LS_APPLIED = 'ce_force_refresh_applied_version';
  const SS_PENDING = 'ce_force_refresh_pending_version';
  const POLL_MS = 5 * 60 * 1000;
  const DEBUG_KEY = 'CE_FORCE_REFRESH_DEBUG';
  const FORCE_REFRESH_ROW_ID = 1;

  const isHomePage = () => (String(document.body?.dataset?.seoPage || '').toLowerCase() === 'home');

  const isLanguageSelectionPending = () => {
    if (!isHomePage()) return false;
    try {
      return String(window.localStorage.getItem('ce_lang_selected') || '').toLowerCase() !== 'true';
    } catch (_) {
      return false;
    }
  };

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

  const emitDebug = (patch = {}) => {
    try {
      const base = (window[DEBUG_KEY] && typeof window[DEBUG_KEY] === 'object') ? window[DEBUG_KEY] : {};
      const next = {
        ...base,
        appliedVersion: readApplied(),
        pendingVersion: readPending(),
        ...patch,
      };
      window[DEBUG_KEY] = next;
      window.dispatchEvent(new CustomEvent('ce:force-refresh-status', { detail: next }));
    } catch (_) {
    }
  };

  async function clearAppCachesBestEffort() {
    try {
      if (typeof caches === 'undefined' || !caches.keys) return;
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (_) {
    }
  }

  async function fetchRemoteVersion() {
    const { data, error } = await sb
      .from('site_settings')
      .select('force_refresh_version')
      .eq('id', FORCE_REFRESH_ROW_ID)
      .maybeSingle();

    if (error) return null;
    return Number(data?.force_refresh_version || 0);
  }

  async function checkAndReloadIfNeeded(trigger = 'auto') {
    try {
      const remote = await fetchRemoteVersion();
      if (remote == null) {
        emitDebug({
          lastCheckAt: new Date().toISOString(),
          trigger,
          action: 'error',
          remoteVersion: null,
        });
        return { action: 'error', remote: null };
      }

      const applied = readApplied();
      if (remote <= applied) {
        clearPending();
        emitDebug({
          lastCheckAt: new Date().toISOString(),
          trigger,
          action: 'noop',
          remoteVersion: remote,
          appliedVersion: applied,
          pendingVersion: 0,
        });
        return { action: 'noop', remote };
      }

      const pending = readPending();
      if (pending === remote) {
        writeApplied(remote);
        clearPending();
        emitDebug({
          lastCheckAt: new Date().toISOString(),
          trigger,
          action: 'applied_pending',
          remoteVersion: remote,
          appliedVersion: remote,
          pendingVersion: 0,
        });
        return { action: 'applied_pending', remote };
      }

      // Do not force-reload homepage during first language selection flow.
      // Otherwise users can see language modal twice (reload while selector is open).
      if (isLanguageSelectionPending()) {
        emitDebug({
          lastCheckAt: new Date().toISOString(),
          trigger,
          action: 'deferred_for_language_selection',
          remoteVersion: remote,
          appliedVersion: applied,
          pendingVersion: pending,
        });
        return { action: 'deferred_for_language_selection', remote };
      }

      writePending(remote);
      emitDebug({
        lastCheckAt: new Date().toISOString(),
        trigger,
        action: 'reload',
        remoteVersion: remote,
        appliedVersion: applied,
        pendingVersion: remote,
      });
      await clearAppCachesBestEffort();
      window.location.reload();
      return { action: 'reload', remote };
    } catch (_) {}
    return { action: 'error', remote: null };
  }

  window.CE_FORCE_REFRESH_CHECK_NOW = () => checkAndReloadIfNeeded('manual');
  window.CE_FORCE_REFRESH_KEYS = { applied: LS_APPLIED, pending: SS_PENDING };
  emitDebug({
    lastCheckAt: null,
    trigger: 'init',
    action: 'idle',
    remoteVersion: null,
  });

  setTimeout(() => {
    checkAndReloadIfNeeded('startup');
    setInterval(() => checkAndReloadIfNeeded('interval'), POLL_MS);
  }, 1500);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkAndReloadIfNeeded('visibility');
    }
  });

  document.addEventListener('ce:language-selected', () => {
    checkAndReloadIfNeeded('language-selected');
  });

  window.addEventListener('storage', (event) => {
    if (event?.key === 'ce_lang_selected' && String(event.newValue || '').toLowerCase() === 'true') {
      checkAndReloadIfNeeded('language-storage');
    }
  });

  // Realtime refresh signal so installed apps update immediately, not only on interval.
  try {
    const channel = sb
      .channel('ce-force-refresh-site-settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_settings',
          filter: `id=eq.${FORCE_REFRESH_ROW_ID}`,
        },
        () => {
          checkAndReloadIfNeeded('realtime');
        },
      )
      .subscribe((status) => {
        emitDebug({
          realtimeStatus: status || 'unknown',
        });
      });

    window.addEventListener('beforeunload', () => {
      try {
        sb.removeChannel(channel);
      } catch (_) {}
    });
  } catch (_) {}
}
