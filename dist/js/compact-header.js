(function () {
  'use strict';

  const SELECTORS = {
    root: '.nav-modern--compact',
    trigger: '[data-compact-profile-trigger]',
    menu: '[data-compact-profile-menu]',
    name: '[data-compact-user-name]',
    status: '[data-compact-user-status]',
    partnerLink: '[data-compact-partner-link]',
    overlay: '[data-auth="user-only"]',
  };

  let partnerLookupUserId = '';
  let partnerAccess = false;
  let partnerLookupPromise = null;

  function getRoot() {
    return document.querySelector(SELECTORS.root);
  }

  function getTrigger() {
    return document.querySelector(SELECTORS.trigger);
  }

  function getMenu() {
    return document.querySelector(SELECTORS.menu);
  }

  function getState() {
    return window.CE_STATE || {};
  }

  function getText(key, fallback) {
    try {
      const i18n = window.appI18n;
      const lang = i18n?.language || document.documentElement.lang || 'en';
      const translations = i18n?.translations?.[lang] || {};
      const parts = String(key || '').split('.');
      let current = translations;
      for (const part of parts) {
        if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
          current = null;
          break;
        }
        current = current[part];
      }
      if (typeof current === 'string' && current.trim()) {
        return current;
      }
      if (current && typeof current === 'object') {
        if (typeof current.text === 'string' && current.text.trim()) return current.text;
        if (typeof current.html === 'string' && current.html.trim()) return current.html;
      }
    } catch (_error) {
    }
    return fallback;
  }

  function getDisplayName(state) {
    const profile = state?.profile || {};
    const user = state?.session?.user || {};
    const metadata = user?.user_metadata || {};

    const candidates = [
      profile.name,
      profile.username,
      metadata.full_name,
      metadata.name,
      metadata.display_name,
      metadata.username,
      user.email,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return getText('header.profileLabel', 'My profile');
  }

  function getStatusText(state) {
    const profile = state?.profile || {};
    const level = Number.isFinite(Number(profile.level)) ? Math.max(1, Number(profile.level)) : 1;
    const badges = Number.isFinite(Number(profile.badges)) ? Math.max(0, Number(profile.badges)) : 0;
    const levelLabel = document.documentElement.lang === 'pl'
      ? `Poziom ${level}`
      : `Level ${level}`;
    const badgesLabel = document.documentElement.lang === 'pl'
      ? `${badges} odznak`
      : `${badges} badges`;
    return `${levelLabel} • ${badgesLabel}`;
  }

  function syncMenuIdentity(state = getState()) {
    const nameEl = document.querySelector(SELECTORS.name);
    const statusEl = document.querySelector(SELECTORS.status);
    const menuAvatar = document.querySelector('[data-compact-user-avatar]');
    const triggerAvatar = document.getElementById('headerUserAvatar');
    if (nameEl) {
      nameEl.textContent = getDisplayName(state);
    }
    if (statusEl) {
      const triggerStatus = document.querySelector(`${SELECTORS.trigger} .profile-status`);
      const triggerText = triggerStatus?.textContent?.trim();
      statusEl.textContent = triggerText || getStatusText(state);
    }
    if (menuAvatar && triggerAvatar?.getAttribute('src')) {
      menuAvatar.setAttribute('src', triggerAvatar.getAttribute('src'));
    }
  }

  function setMenuOpen(open) {
    const trigger = getTrigger();
    const menu = getMenu();
    if (!trigger || !menu) return;

    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.hidden = !open;
  }

  async function lookupPartnerAccess() {
    const state = getState();
    const userId = String(state?.session?.user?.id || '').trim();
    const link = document.querySelector(SELECTORS.partnerLink);

    if (!link) return false;

    if (!userId) {
      partnerLookupUserId = '';
      partnerAccess = false;
      link.hidden = true;
      return false;
    }

    if (partnerLookupPromise && partnerLookupUserId === userId) {
      return partnerLookupPromise;
    }

    if (partnerLookupUserId === userId) {
      link.hidden = !partnerAccess;
      return partnerAccess;
    }

    partnerLookupUserId = userId;

    partnerLookupPromise = (async () => {
      try {
        const sb = typeof window.getSupabase === 'function' ? window.getSupabase() : null;
        if (!sb) {
          partnerAccess = false;
          return false;
        }

        const { data, error } = await sb
          .from('partner_users')
          .select('partner_id')
          .eq('user_id', userId)
          .limit(1);

        if (error) {
          console.warn('[compact-header] Failed to resolve partner access.', error);
          partnerAccess = false;
          return false;
        }

        partnerAccess = Array.isArray(data) && data.length > 0;
        return partnerAccess;
      } catch (error) {
        console.warn('[compact-header] Partner access lookup failed.', error);
        partnerAccess = false;
        return false;
      } finally {
        link.hidden = !partnerAccess;
      }
    })();

    return partnerLookupPromise;
  }

  function handleDocumentClick(event) {
    const trigger = getTrigger();
    const menu = getMenu();
    if (!trigger || !menu || menu.hidden) return;

    const target = event.target;
    if (trigger.contains(target) || menu.contains(target)) {
      return;
    }
    setMenuOpen(false);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      setMenuOpen(false);
    }
  }

  function bindMenuToggle() {
    const trigger = getTrigger();
    if (!trigger || trigger.dataset.compactHeaderBound === 'true') {
      return;
    }

    trigger.dataset.compactHeaderBound = 'true';
    trigger.addEventListener('click', () => {
      const menu = getMenu();
      const open = !menu || menu.hidden;
      syncMenuIdentity();
      setMenuOpen(open);
      if (open) {
        void lookupPartnerAccess();
      }
    });
  }

  function syncCompactHeader(state = getState()) {
    const root = getRoot();
    if (!root) return;

    const isLogged = !!state?.session?.user;
    if (!isLogged) {
      setMenuOpen(false);
      const partnerLink = document.querySelector(SELECTORS.partnerLink);
      if (partnerLink) {
        partnerLink.hidden = true;
      }
      return;
    }

    syncMenuIdentity(state);
    void lookupPartnerAccess();
  }

  function init() {
    const root = getRoot();
    if (!root) return;

    bindMenuToggle();
    syncCompactHeader();

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('ce-auth:state', (event) => {
      syncCompactHeader(event?.detail || getState());
    });
    document.addEventListener('wakacjecypr:languagechange', () => {
      syncCompactHeader();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
