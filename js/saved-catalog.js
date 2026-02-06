(() => {
  const VALID_TYPES = ['trip', 'hotel', 'car', 'poi', 'recommendation'];
  const TYPE_SET = new Set(VALID_TYPES);

  let savedCatalogUidCache = 'anon';
  const subscribers = new Set();

  function getLang() {
    try {
      const lang = (window.appI18n && window.appI18n.language) ? window.appI18n.language : (document.documentElement?.lang || 'pl');
      return String(lang || 'pl').toLowerCase().startsWith('en') ? 'en' : 'pl';
    } catch (_) {
      return 'pl';
    }
  }

  function savedCatalogStorageKeyForUid(uid) {
    const id = String(uid || '').trim() || 'anon';
    return `ce_plan_catalog_saved_v1_${id}`;
  }

  function savedCatalogStorageKey() {
    return savedCatalogStorageKeyForUid(savedCatalogUidCache);
  }

  function setSavedCatalogUidCache(uid) {
    const next = String(uid || '').trim() || 'anon';
    savedCatalogUidCache = next;
  }

  function getSavedCatalogAuthedUserId() {
    return savedCatalogUidCache && savedCatalogUidCache !== 'anon' ? savedCatalogUidCache : '';
  }

  function getSessionUserId() {
    try {
      const uid = window.CE_STATE?.session?.user?.id ? String(window.CE_STATE.session.user.id) : '';
      return uid ? String(uid) : '';
    } catch (_) {
      return '';
    }
  }

  function openAuthModalForSavedCatalog(tabId = 'login') {
    const attemptOpen = () => {
      try {
        if (typeof window?.openAuthModal === 'function') {
          window.openAuthModal(tabId);
          return true;
        }
      } catch (_) {}

      try {
        const controller = window?.__authModalController;
        if (controller && typeof controller.open === 'function') {
          controller.setActiveTab?.(tabId, { focus: false });
          controller.open(tabId);
          return true;
        }
      } catch (_) {}

      return false;
    };

    if (attemptOpen()) {
      return true;
    }

    let resolved = false;
    let timeoutId = null;

    const cleanup = () => {
      resolved = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      document.removeEventListener('ce-auth:modal-ready', handleReady);
    };

    const handleReady = () => {
      if (resolved) return;
      if (attemptOpen()) cleanup();
    };

    document.addEventListener('ce-auth:modal-ready', handleReady);

    if (typeof window?.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        if (!resolved && attemptOpen()) {
          cleanup();
        }
      });
    }

    timeoutId = window.setTimeout(() => {
      if (resolved) return;
      cleanup();
      try {
        window.location.assign('/auth/');
      } catch (_) {}
    }, 1500);

    return false;
  }

  function loadSavedCatalogMapForUid(uid) {
    try {
      const raw = localStorage.getItem(savedCatalogStorageKeyForUid(uid));
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch (_) {
      return {};
    }
  }

  function loadSavedCatalogMap() {
    return loadSavedCatalogMapForUid(savedCatalogUidCache);
  }

  function saveSavedCatalogMapForUid(uid, map) {
    try {
      localStorage.setItem(savedCatalogStorageKeyForUid(uid), JSON.stringify(map || {}));
    } catch (_) {}
  }

  function saveSavedCatalogMap(map) {
    saveSavedCatalogMapForUid(savedCatalogUidCache, map);
  }

  function normalizeSavedCatalogMap(map) {
    const src = map && typeof map === 'object' ? map : {};
    const out = {};
    VALID_TYPES.forEach((k) => {
      const arr = Array.isArray(src[k]) ? src[k] : [];
      const uniq = [];
      const seen = new Set();
      arr.forEach((v) => {
        const s = String(v || '').trim();
        if (!s || seen.has(s)) return;
        seen.add(s);
        uniq.push(s);
      });
      out[k] = uniq;
    });
    return out;
  }

  async function loadSavedCatalogMapRemote(userId) {
    const supabase = window.getSupabase ? window.getSupabase() : (window.sb || null);
    if (!supabase) return {};
    const uid = String(userId || '').trim();
    if (!uid) return {};

    try {
      const { data, error } = await supabase
        .from('user_saved_catalog_items')
        .select('item_type, ref_id')
        .eq('user_id', uid);

      if (error) throw error;
      const m = { trip: [], hotel: [], car: [], poi: [], recommendation: [] };
      (Array.isArray(data) ? data : []).forEach((r) => {
        const t = String(r?.item_type || '').trim();
        const id = String(r?.ref_id || '').trim();
        if (!t || !id) return;
        if (!Array.isArray(m[t])) return;
        m[t].push(id);
      });
      return normalizeSavedCatalogMap(m);
    } catch (e) {
      console.warn('[saved-catalog] Failed to load saved catalog items', e);
      return {};
    }
  }

  async function persistSavedCatalogItemRemote({ userId, itemType, refId, saved }) {
    const supabase = window.getSupabase ? window.getSupabase() : (window.sb || null);
    if (!supabase) return true;

    const uid = String(userId || '').trim();
    const type = String(itemType || '').trim();
    const id = String(refId || '').trim();
    if (!uid || !type || !id) return true;

    try {
      if (saved) {
        const { error } = await supabase
          .from('user_saved_catalog_items')
          .upsert({ user_id: uid, item_type: type, ref_id: id }, { onConflict: 'user_id,item_type,ref_id' });
        if (error) throw error;
        return true;
      }

      const { error } = await supabase
        .from('user_saved_catalog_items')
        .delete()
        .eq('user_id', uid)
        .eq('item_type', type)
        .eq('ref_id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[saved-catalog] Failed to persist saved catalog item', e);
      return false;
    }
  }

  async function syncSavedCatalogWithRemoteForUser(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return;
    setSavedCatalogUidCache(uid);

    const localUser = normalizeSavedCatalogMap(loadSavedCatalogMapForUid(uid));
    const localAnon = normalizeSavedCatalogMap(loadSavedCatalogMapForUid('anon'));
    const remote = normalizeSavedCatalogMap(await loadSavedCatalogMapRemote(uid));

    const merged = { trip: [], hotel: [], car: [], poi: [], recommendation: [] };
    const unionInto = (t, arr) => {
      const set = new Set(merged[t]);
      (Array.isArray(arr) ? arr : []).forEach((v) => {
        const s = String(v || '').trim();
        if (!s || set.has(s)) return;
        set.add(s);
        merged[t].push(s);
      });
    };

    VALID_TYPES.forEach((t) => {
      unionInto(t, remote[t]);
      unionInto(t, localUser[t]);
      unionInto(t, localAnon[t]);
    });

    const remoteSet = new Set();
    VALID_TYPES.forEach((t) => {
      (Array.isArray(remote[t]) ? remote[t] : []).forEach((id) => {
        remoteSet.add(`${t}:${String(id || '').trim()}`);
      });
    });

    const toInsert = [];
    VALID_TYPES.forEach((t) => {
      (Array.isArray(merged[t]) ? merged[t] : []).forEach((id) => {
        const key = `${t}:${String(id || '').trim()}`;
        if (!key || remoteSet.has(key)) return;
        toInsert.push({ user_id: uid, item_type: t, ref_id: String(id) });
      });
    });

    if (toInsert.length) {
      const supabase = window.getSupabase ? window.getSupabase() : (window.sb || null);
      if (supabase) {
        try {
          const { error } = await supabase
            .from('user_saved_catalog_items')
            .upsert(toInsert, { onConflict: 'user_id,item_type,ref_id' });
          if (error) throw error;
        } catch (e) {
          console.warn('[saved-catalog] Failed to sync saved catalog items', e);
        }
      }
    }

    saveSavedCatalogMapForUid(uid, merged);

    try {
      localStorage.removeItem(savedCatalogStorageKeyForUid('anon'));
    } catch (_) {}
  }

  function ensureType(type) {
    const t = String(type || '').trim();
    return TYPE_SET.has(t) ? t : '';
  }

  function isSaved(itemType, refId) {
    const type = ensureType(itemType);
    const id = String(refId || '').trim();
    if (!type || !id) return false;
    const m = loadSavedCatalogMap();
    const arr = Array.isArray(m[type]) ? m[type] : [];
    return arr.includes(id);
  }

  function setLocalSaved({ itemType, refId, saved }) {
    const type = ensureType(itemType);
    const id = String(refId || '').trim();
    if (!type || !id) return false;
    const m = loadSavedCatalogMap();
    const arr = Array.isArray(m[type]) ? m[type].slice() : [];
    const idx = arr.indexOf(id);
    if (saved) {
      if (idx < 0) arr.push(id);
    } else {
      if (idx >= 0) arr.splice(idx, 1);
    }
    m[type] = arr;
    saveSavedCatalogMap(m);
    return !!saved;
  }

  function toggleLocalSaved({ itemType, refId }) {
    const type = ensureType(itemType);
    const id = String(refId || '').trim();
    if (!type || !id) return false;
    const before = isSaved(type, id);
    const next = !before;
    setLocalSaved({ itemType: type, refId: id, saved: next });
    return next;
  }

  async function toggleAndPersist({ itemType, refId }) {
    const type = ensureType(itemType);
    const id = String(refId || '').trim();
    if (!type || !id) return { ok: true, saved: false, before: false };

    const before = isSaved(type, id);
    const nextSaved = toggleLocalSaved({ itemType: type, refId: id });

    const uid = getSavedCatalogAuthedUserId();
    if (!uid) {
      notify();
      return { ok: true, saved: nextSaved, before };
    }

    const ok = await persistSavedCatalogItemRemote({ userId: uid, itemType: type, refId: id, saved: nextSaved });
    if (!ok) {
      setLocalSaved({ itemType: type, refId: id, saved: before });
      notify();
      return { ok: false, saved: before, before };
    }

    notify();
    return { ok: true, saved: nextSaved, before };
  }

  function labelForButton(saved) {
    const lang = getLang();
    if (lang === 'en') return saved ? 'Saved' : 'Save';
    return saved ? 'Zapisane' : 'Zapisz';
  }

  function applyButtonState(btn) {
    if (!(btn instanceof HTMLElement)) return;
    const type = btn.getAttribute('data-item-type') || '';
    const refId = btn.getAttribute('data-ref-id') || '';
    const saved = isSaved(type, refId);
    btn.classList.toggle('is-saved', saved);
    btn.textContent = saved ? '★' : '☆';
    const label = labelForButton(saved);
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  function refreshButtons(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('[data-ce-save="1"]').forEach((btn) => applyButtonState(btn));
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function notify() {
    subscribers.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });

    try {
      refreshButtons(document);
    } catch (_) {}
  }

  function installGlobalSaveClickHandler() {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    if (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.ceSavedCatalogClickBound === '1') {
      return;
    }
    if (document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.ceSavedCatalogClickBound = '1';
    }

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest('[data-ce-save="1"]');
      if (!(btn instanceof HTMLElement)) return;

      event.preventDefault();
      event.stopPropagation();

      const type = btn.getAttribute('data-item-type') || '';
      const refId = btn.getAttribute('data-ref-id') || '';

      const uid = getSavedCatalogAuthedUserId() || getSessionUserId();
      if (!uid) {
        openAuthModalForSavedCatalog('login');
        return;
      }

      try {
        setSavedCatalogUidCache(uid);
      } catch (_) {}

      void toggleAndPersist({ itemType: type, refId }).then((res) => {
        applyButtonState(btn);
        if (!res || res.ok) {
          return;
        }

        const lang = getLang();
        const message =
          lang === 'en'
            ? 'Could not sync saved items. Please try again.'
            : 'Nie udało się zsynchronizować zapisanych. Spróbuj ponownie.';
        if (typeof window.showToast === 'function') {
          window.showToast(message, 'error');
        } else if (window.Toast && typeof window.Toast.show === 'function') {
          window.Toast.show(message, 'error');
        }
      });
    }, true);
  }

  async function hydrateFromAuthState() {
    const uid = window.CE_STATE?.session?.user?.id ? String(window.CE_STATE.session.user.id) : '';
    if (uid) {
      setSavedCatalogUidCache(uid);
      await syncSavedCatalogWithRemoteForUser(uid);
      notify();
      return;
    }
    setSavedCatalogUidCache('anon');
    notify();
  }

  function setupAuthObserver() {
    const root = document.documentElement;
    if (!root || typeof MutationObserver === 'undefined') return;

    const onMaybeChange = () => {
      void hydrateFromAuthState();
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== 'attributes') continue;
        if (m.attributeName !== 'data-auth-state') continue;
        onMaybeChange();
        break;
      }
    });

    observer.observe(root, { attributes: true, attributeFilter: ['data-auth-state'] });
  }

  try {
    const initialUid = window.CE_STATE?.session?.user?.id ? String(window.CE_STATE.session.user.id) : '';
    setSavedCatalogUidCache(initialUid || 'anon');
    if (initialUid) {
      void syncSavedCatalogWithRemoteForUser(initialUid).then(() => notify());
    }
  } catch (_) {
    setSavedCatalogUidCache('anon');
  }

  try {
    setupAuthObserver();
  } catch (_) {}

  try {
    installGlobalSaveClickHandler();
  } catch (_) {}

  window.CE_SAVED_CATALOG = {
    isSaved,
    toggleAndPersist,
    refreshButtons,
    applyButtonState,
    subscribe,
    openAuthModal: openAuthModalForSavedCatalog,
    syncForCurrentUser: hydrateFromAuthState,
  };
})();
