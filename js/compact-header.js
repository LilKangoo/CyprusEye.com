(function () {
  'use strict';

  if (window.__compactHeaderBooted) {
    return;
  }
  window.__compactHeaderBooted = true;

  const SELECTORS = {
    header: '.app-header.nav-modern',
    compactHeader: '.app-header.nav-modern.nav-modern--compact',
    top: '.nav-modern__top',
    topActions: '.nav-modern__top-actions',
    oldStats: '.nav-modern__stats.nav-modern__stats-lite',
    compactProfile: '.compact-header__profile',
    trigger: '[data-compact-profile-trigger]',
    menu: '[data-compact-profile-menu]',
    close: '[data-compact-profile-close]',
    name: '[data-compact-user-name]',
    status: '[data-compact-user-status]',
    partnerLink: '[data-compact-partner-link]',
  };

  const BRAND_NAME = 'CyprusEye Save & Travel';
  const BRAND_ALT = 'CyprusEye.com - eye with a Cyprus island outline inside.';
  const BRAND_HOME_LABEL = 'CyprusEye Save & Travel home';
  const AUTH_MODAL_SCRIPT_ID = 'ce-modal-auth-script';
  const AUTH_MODAL_SCRIPT_SRC = '/assets/js/modal-auth.js?v=1';
  const SOS_SCRIPT_ID = 'ce-sos-script';
  const SOS_SCRIPT_SRC = '/js/sos.js?v=1';

  let partnerLookupUserId = '';
  let partnerAccess = false;
  let partnerLookupPromise = null;
  let authFallbackBound = false;
  let menuListenersBound = false;

  const PARTNER_FULL_SELECT = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_manage_blog, can_auto_publish_blog, can_manage_transport, cars_locations, affiliate_enabled';
  const PARTNER_LEGACY_SELECT = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_manage_blog, can_auto_publish_blog';

  function getState() {
    return window.CE_STATE || {};
  }

  function getLanguage() {
    try {
      const appLang = window.appI18n?.language;
      if (typeof appLang === 'string' && appLang.trim()) {
        return appLang.trim().toLowerCase();
      }
    } catch (_error) {}

    try {
      const paramLang = new URL(window.location.href).searchParams.get('lang');
      if (typeof paramLang === 'string' && paramLang.trim()) {
        return paramLang.trim().toLowerCase();
      }
    } catch (_error) {}

    try {
      const storedLang = window.localStorage.getItem('ce_lang');
      if (typeof storedLang === 'string' && storedLang.trim()) {
        return storedLang.trim().toLowerCase();
      }
    } catch (_error) {}

    const docLang = (document.documentElement.lang || '').trim().toLowerCase();
    return docLang || 'en';
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
    } catch (_error) {}
    return fallback;
  }

  function toFiniteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function hasOwn(source, key) {
    return !!source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, key);
  }

  function readMetricFromDom(scope, selector, fallback) {
    if (!(scope instanceof HTMLElement)) {
      return fallback;
    }
    const element = scope.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      return fallback;
    }
    const raw = String(element.textContent || '').replace(/[^\d.-]/g, '').trim();
    if (!raw) {
      return fallback;
    }
    return toFiniteNumber(raw, fallback);
  }

  function countVisitedPlaces(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).length;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return 0;

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).length;
        }
      } catch (_error) {}

      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const inner = trimmed.slice(1, -1).trim();
        if (!inner) return 0;
        return inner
          .split(',')
          .map((part) => String(part).trim().replace(/^"|"$/g, ''))
          .filter(Boolean).length;
      }
    }

    return 0;
  }

  function setHidden(element, hidden) {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    element.hidden = !!hidden;
    element.classList.toggle('hidden', !!hidden);
    if (hidden) {
      element.setAttribute('aria-hidden', 'true');
    } else {
      element.removeAttribute('aria-hidden');
    }
  }

  function createElement(tag, className, options = {}) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (options.text) {
      element.textContent = options.text;
    }
    if (options.html) {
      element.innerHTML = options.html;
    }
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        if (value === false || value === null || value === undefined) {
          return;
        }
        if (value === true) {
          element.setAttribute(key, '');
          return;
        }
        element.setAttribute(key, String(value));
      });
    }
    return element;
  }

  function ensureScript(id, src) {
    if (!src) return;
    const normalizedSrc = src.replace(/\?.*$/, '');
    const relativeSrc = normalizedSrc.replace(/^\//, '');
    const existing = document.getElementById(id)
      || Array.from(document.scripts).find((node) => {
        const current = node.getAttribute('src') || '';
        return current.includes(normalizedSrc) || current.includes(relativeSrc);
      });
    if (existing) return;

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.defer = true;
    document.body.appendChild(script);
  }

  function removeLegacyAuthMessage() {
    const message = document.getElementById('authMessage');
    if (message) {
      message.remove();
    }
  }

  function buildAuthUrl(tab = 'login') {
    const url = new URL('/auth/', window.location.origin);
    const lang = getLanguage();
    if (lang) {
      url.searchParams.set('lang', lang);
    }
    if (tab) {
      url.searchParams.set('tab', tab);
    }
    return url.toString();
  }

  function bindAuthFallback() {
    if (authFallbackBound) return;
    authFallbackBound = true;

    document.addEventListener('click', (event) => {
      const opener = event.target instanceof Element
        ? event.target.closest('[data-open-auth]')
        : null;
      if (!(opener instanceof HTMLElement)) {
        return;
      }
      if (window.__authModalController && typeof window.__authModalController.open === 'function') {
        return;
      }
      event.preventDefault();
      const tab = opener.getAttribute('data-auth-target') || 'login';
      window.location.assign(buildAuthUrl(tab));
    });
  }

  function injectSosModal() {
    if (document.getElementById('sosModal')) {
      return;
    }

    const modal = createElement('div', 'sos-modal', {
      attributes: {
        id: 'sosModal',
        hidden: true,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'sosTitle',
        'aria-describedby': 'sosDescription',
      },
      html: `
        <div class="sos-dialog" role="document" tabindex="-1">
          <header class="sos-header">
            <div>
              <h2 id="sosTitle" data-i18n="sos.title">${getText('sos.title', 'SOS')}</h2>
              <p id="sosDescription" data-i18n="sos.description">${getText('sos.description', 'Quick access to emergency numbers, embassy contact, and medical guidance.')}</p>
            </div>
            <button type="button" class="icon-button" id="sosClose" aria-label="${getText('sos.close', 'Close SOS')}" data-i18n="sos.close">X</button>
          </header>

          <div class="sos-grid" aria-describedby="sosDescription">
            <section class="sos-card">
              <h3 data-i18n="sos.emergency.title">${getText('sos.emergency.title', '🚑 Emergency numbers in Cyprus')}</h3>
              <ul>
                <li>
                  <strong>112</strong>
                  <p data-i18n="sos.emergency.eu">${getText('sos.emergency.eu', 'Universal EU emergency number (police, ambulance, fire brigade).')} <a href="tel:112">${getText('common.callNow', 'Call now')}</a></p>
                </li>
                <li>
                  <strong>199</strong>
                  <p data-i18n="sos.emergency.cyprus">${getText('sos.emergency.cyprus', 'Cyprus emergency number working alongside 112.')} <a href="tel:199">${getText('common.connect', 'Connect')}</a></p>
                </li>
              </ul>
            </section>

            <section class="sos-card">
              <h3 data-i18n="sos.embassy.title">${getText('sos.embassy.title', '🛡️ Embassy of Poland in Nicosia')}</h3>
              <ul>
                <li>
                  <strong>${getText('sos.embassy.hotlineLabel', 'Emergency phone')}</strong>
                  <p data-i18n="sos.embassy.hotline"><a href="tel:+35799660451">+357 99 660 451</a></p>
                </li>
                <li>
                  <strong>${getText('sos.embassy.receptionLabel', 'Reception')}</strong>
                  <p data-i18n="sos.embassy.reception"><a href="tel:+35722751777">+357 22 751 777</a></p>
                </li>
                <li>
                  <strong>${getText('sos.embassy.emailLabel', 'E-mail')}</strong>
                  <p data-i18n="sos.embassy.email"><a href="mailto:nicosia.info@msz.gov.pl">nicosia.info@msz.gov.pl</a></p>
                </li>
              </ul>
            </section>

            <section class="sos-card">
              <h3 data-i18n="sos.medical.title">${getText('sos.medical.title', '🏥 Medical help')}</h3>
              <ul>
                <li>
                  <strong>1480</strong>
                  <p data-i18n="sos.medical.helpline">${getText('sos.medical.helpline', 'Cyprus health helpline for public care guidance.')}</p>
                </li>
                <li>
                  <strong>${getText('sos.medical.insuranceLabel', 'Travel insurance')}</strong>
                  <p data-i18n="sos.medical.insurance">${getText('sos.medical.insurance', 'Keep your policy number ready and contact your insurer before a private visit if possible.')}</p>
                </li>
              </ul>
            </section>

            <section class="sos-card">
              <h3 data-i18n="sos.transport.title">${getText('sos.transport.title', '🚗 Transport and road help')}</h3>
              <ul>
                <li>
                  <strong data-i18n="sos.transport.carRentalLabel">${getText('sos.transport.carRentalLabel', 'Car rental / transfer')}</strong>
                  <p data-i18n="sos.transport.carRental">${getText('sos.transport.carRental', 'Use the SOS panel to quickly switch to emergency support and booking help when needed.')}</p>
                </li>
              </ul>
            </section>
          </div>
        </div>
      `,
    });

    document.body.appendChild(modal);
  }

  function ensureSupportScripts() {
    if (document.getElementById('auth-modal')) {
      ensureScript(AUTH_MODAL_SCRIPT_ID, AUTH_MODAL_SCRIPT_SRC);
    }

    if (document.querySelector('[aria-controls="sosModal"]')) {
      if (!document.getElementById('sosModal')) {
        injectSosModal();
      }
      ensureScript(SOS_SCRIPT_ID, SOS_SCRIPT_SRC);
    }
  }

  function normalizeBranding(scope = document) {
    scope.querySelectorAll('.nav-modern__brand-link').forEach((link) => {
      link.setAttribute('aria-label', BRAND_HOME_LABEL);

      const img = link.querySelector('img');
      if (img) {
        img.setAttribute('alt', BRAND_ALT);
      }

      const brandName = link.querySelector('.brand-name');
      if (brandName) {
        brandName.textContent = BRAND_NAME;
      }
    });
  }

  function findLoginButton(actions) {
    const direct = actions.querySelector('[data-open-auth][data-auth-target="login"]');
    if (direct) return direct;

    const legacy = actions.querySelector('.nav-modern__login');
    if (legacy) return legacy;

    return Array.from(actions.querySelectorAll('button, a')).find((element) => {
      const type = element.getAttribute('data-auth');
      const target = element.getAttribute('data-auth-target');
      return type !== 'logout' && target !== 'register';
    }) || null;
  }

  function ensureAuthActions(topActions) {
    let auth = topActions.querySelector('.nav-modern__auth');
    if (!auth) {
      auth = createElement('div', 'nav-modern__auth');
      topActions.prepend(auth);
    }

    let actions = auth.querySelector('#auth-actions');
    if (!actions) {
      actions = createElement('div', 'auth-actions-inline', {
        attributes: { id: 'auth-actions', 'aria-live': 'polite' },
      });
      auth.prepend(actions);
    }

    actions.classList.add('auth-actions-inline');
    actions.setAttribute('data-auth', 'anon-only');

    let loginButton = findLoginButton(actions);
    if (!loginButton) {
      loginButton = createElement('button', '', {
        text: getText('header.login', 'Sign in'),
        attributes: {
          type: 'button',
          'data-open-auth': true,
          'data-auth-target': 'login',
          'data-i18n': 'header.login',
          'data-i18n-attrs': 'aria-label:auth.login.aria',
          'aria-label': getText('auth.login.aria', 'Sign in'),
        },
      });
      actions.prepend(loginButton);
    }

    loginButton.classList.remove('nav-modern__login', 'btn', 'btn-sm');
    loginButton.classList.add('compact-header__auth-btn', 'compact-header__auth-btn--primary');
    loginButton.setAttribute('type', 'button');
    loginButton.setAttribute('data-open-auth', '');
    loginButton.setAttribute('data-auth-target', 'login');
    loginButton.setAttribute('data-i18n', 'header.login');
    loginButton.setAttribute('data-i18n-attrs', 'aria-label:auth.login.aria');

    let registerButton = actions.querySelector('[data-auth-target="register"]');
    if (!registerButton) {
      registerButton = createElement('button', 'compact-header__auth-btn', {
        text: getText('auth.tab.register', 'Register'),
        attributes: {
          type: 'button',
          'data-open-auth': true,
          'data-auth-target': 'register',
          'data-i18n': 'auth.tab.register',
        },
      });
      actions.appendChild(registerButton);
    }

    registerButton.classList.add('compact-header__auth-btn');
    registerButton.classList.remove('nav-modern__login', 'btn', 'btn-sm');
    registerButton.setAttribute('type', 'button');
    registerButton.setAttribute('data-open-auth', '');
    registerButton.setAttribute('data-auth-target', 'register');
    registerButton.setAttribute('data-i18n', 'auth.tab.register');

    const spinner = auth.querySelector('[data-auth="spinner"]');
    if (!spinner) {
      const spinnerEl = createElement('div', 'auth-spinner-inline', {
        text: getText('auth.status.spinner', 'Connecting...'),
        attributes: { 'data-auth': 'spinner', 'aria-live': 'polite', hidden: true, 'data-i18n': 'auth.status.spinner' },
      });
      auth.appendChild(spinnerEl);
    }
  }

  function ensureProfileShell(profile) {
    profile.classList.add('compact-header__profile');
    profile.setAttribute('data-auth', 'user-only');

    let trigger = profile.querySelector(SELECTORS.trigger);
    if (!trigger) {
      trigger = createElement('button', 'compact-profile__trigger', {
        attributes: {
          type: 'button',
          'data-compact-profile-trigger': true,
          'aria-expanded': 'false',
          'aria-haspopup': 'menu',
          'aria-controls': 'compactProfileMenu',
        },
      });
      profile.prepend(trigger);
    }

    let summary = trigger.querySelector('.compact-profile__summary');
    if (!summary) {
      summary = createElement('span', 'compact-profile__summary');
      trigger.appendChild(summary);
    }

    let chevron = trigger.querySelector('.compact-profile__chevron');
    if (!chevron) {
      chevron = createElement('span', 'compact-profile__chevron', {
        text: '▾',
        attributes: { 'aria-hidden': 'true' },
      });
      trigger.appendChild(chevron);
    }

    let menu = profile.querySelector(SELECTORS.menu);
    if (!menu) {
      menu = createElement('div', 'compact-profile__menu', {
        attributes: {
          id: 'compactProfileMenu',
          'data-compact-profile-menu': true,
          hidden: true,
        },
      });
      profile.appendChild(menu);
    }

    return { trigger, summary, menu, chevron };
  }

  function ensureStatCard(container, modifier, labelText, valueNode, extraNode) {
    let card = container.querySelector(`.compact-profile__stat--${modifier}`);
    if (!card) {
      card = createElement('div', `compact-profile__stat compact-profile__stat--${modifier}`);
      container.appendChild(card);
    }
    card.innerHTML = '';

    const label = createElement('span', 'compact-profile__stat-label', { text: labelText });
    card.appendChild(label);

    if (valueNode instanceof Node) {
      card.appendChild(valueNode);
    }

    if (extraNode instanceof Node) {
      card.appendChild(extraNode);
    }

    return card;
  }

  function ensureCompactProfile(root, top, topActions) {
    const oldStats = top.querySelector(SELECTORS.oldStats) || top.querySelector('.nav-modern__stats');
    let profile = top.querySelector(SELECTORS.compactProfile);
    if (!profile) {
      profile = createElement('div', 'compact-header__profile', {
        attributes: { 'data-auth': 'user-only' },
      });
      top.insertBefore(profile, topActions);
    }

    const { trigger, summary, menu, chevron } = ensureProfileShell(profile);

    let avatar = profile.querySelector('#headerUserAvatar') || root.querySelector('#headerUserAvatar');
    if (!(avatar instanceof HTMLImageElement)) {
      avatar = createElement('img', 'profile-avatar', {
        attributes: {
          id: 'headerUserAvatar',
          src: '/assets/cyprus_logo-1000x1054.png',
          alt: 'Avatar',
          width: '48',
          height: '48',
          loading: 'eager',
        },
      });
    }
    avatar.className = 'profile-avatar';
    avatar.setAttribute('width', '48');
    avatar.setAttribute('height', '48');
    avatar.setAttribute('loading', 'eager');

    let name = trigger.querySelector('.profile-name') || (oldStats ? oldStats.querySelector('.profile-name') : null);
    if (!(name instanceof HTMLElement)) {
      name = createElement('span', 'profile-name', {
        text: getText('header.profileLabel', 'My profile'),
        attributes: { 'data-i18n': 'header.profileLabel' },
      });
    }

    let status = trigger.querySelector('.profile-status') || (oldStats ? oldStats.querySelector('.profile-status') : null);
    if (!(status instanceof HTMLElement)) {
      status = createElement('span', 'profile-status', {
        text: getText('header.statusPlaceholder', 'Level 1 • 0 badges'),
        attributes: { 'data-i18n': 'header.statusPlaceholder' },
      });
    }

    summary.innerHTML = '';
    summary.appendChild(name);
    summary.appendChild(status);

    if (avatar.parentElement !== trigger) {
      trigger.insertBefore(avatar, summary);
    }
    if (summary.nextElementSibling !== chevron) {
      trigger.appendChild(chevron);
    }

    let menuHeader = menu.querySelector('.compact-profile__menu-header');
    if (!menuHeader) {
      menuHeader = createElement('div', 'compact-profile__menu-header');
      menu.prepend(menuHeader);
    }
    menuHeader.innerHTML = '';

    const menuAvatar = createElement('img', 'compact-profile__avatar', {
      attributes: {
        src: avatar.getAttribute('src') || '/assets/cyprus_logo-1000x1054.png',
        alt: 'Avatar',
        width: '48',
        height: '48',
        loading: 'lazy',
        'data-compact-user-avatar': true,
      },
    });
    const identity = createElement('div', 'compact-profile__identity');
    identity.appendChild(createElement('p', 'compact-profile__menu-name', {
      text: name.textContent || getText('header.profileLabel', 'My profile'),
      attributes: { 'data-compact-user-name': true, 'data-i18n': 'header.profileLabel' },
    }));
    identity.appendChild(createElement('p', 'compact-profile__menu-status', {
      text: status.textContent || getText('header.statusPlaceholder', 'Level 1 • 0 badges'),
      attributes: { 'data-compact-user-status': true, 'data-i18n': 'header.statusPlaceholder' },
    }));
    const closeButton = createElement('button', 'compact-profile__menu-close', {
      text: 'X',
      attributes: {
        type: 'button',
        'data-compact-profile-close': true,
        'aria-label': getText('common.close', 'Close'),
      },
    });
    menuHeader.appendChild(menuAvatar);
    menuHeader.appendChild(identity);
    menuHeader.appendChild(closeButton);

    let stats = menu.querySelector('.compact-profile__stats');
    if (!stats) {
      stats = createElement('div', 'compact-profile__stats');
      menu.appendChild(stats);
    }

    let levelValue = root.querySelector('#headerLevelNumber');
    if (!(levelValue instanceof HTMLElement)) {
      levelValue = createElement('span', 'compact-profile__stat-value', {
        text: '1',
        attributes: { id: 'headerLevelNumber' },
      });
    } else {
      levelValue.className = 'compact-profile__stat-value';
    }

    let xpPoints = root.querySelector('#headerXpPoints');
    if (!(xpPoints instanceof HTMLElement)) {
      xpPoints = createElement('span', '', {
        text: '0',
        attributes: { id: 'headerXpPoints' },
      });
    }
    const xpPointsWrapper = createElement('span', 'compact-profile__xp-points');
    xpPointsWrapper.appendChild(xpPoints);
    xpPointsWrapper.appendChild(document.createTextNode(' XP'));

    let xpFill = root.querySelector('#headerXpFill');
    if (!(xpFill instanceof HTMLElement)) {
      xpFill = createElement('div', 'compact-profile__xp-fill stats-lite__xp-fill is-width-zero', {
        attributes: { id: 'headerXpFill' },
      });
    } else {
      xpFill.className = 'compact-profile__xp-fill stats-lite__xp-fill';
      if (!xpFill.style.width) {
        xpFill.classList.add('is-width-zero');
      }
    }
    const xpBar = createElement('div', 'compact-profile__xp-bar', {
      attributes: {
        role: 'img',
        'aria-label': getText('metrics.xp.aria', 'Experience progress'),
        'data-i18n-attrs': 'aria-label:metrics.xp.aria',
      },
    });
    xpBar.appendChild(xpFill);

    let badgesValue = root.querySelector('#headerBadgesCount');
    if (!(badgesValue instanceof HTMLElement)) {
      badgesValue = createElement('span', 'compact-profile__stat-value', {
        text: '0',
        attributes: { id: 'headerBadgesCount' },
      });
    } else {
      badgesValue.className = 'compact-profile__stat-value';
    }

    stats.innerHTML = '';
    ensureStatCard(stats, 'level', getText('metrics.level.abbrev', 'LVL'), levelValue);
    const xpCard = ensureStatCard(stats, 'xp', getText('account.profile.labels.xp', 'XP'), xpPointsWrapper, xpBar);
    xpCard.classList.add('compact-profile__xp-card');
    ensureStatCard(stats, 'badges', getText('metrics.badges.label', 'Badges'), badgesValue);

    let actions = menu.querySelector('.compact-profile__actions');
    if (!actions) {
      actions = createElement('div', 'compact-profile__actions');
      menu.appendChild(actions);
    }
    const existingLogoutButton = root.querySelector('.nav-modern__top [data-auth="logout"]');
    actions.innerHTML = '';

    const profileLink = createElement('a', 'compact-profile__link', {
      text: getText('header.profileLabel', 'My profile'),
      attributes: {
        href: '/achievements.html',
        'data-i18n': 'header.profileLabel',
      },
    });
    actions.appendChild(profileLink);

    const partnerLink = createElement('a', 'compact-profile__link compact-profile__partner-link', {
      text: getText('header.partnerPortal', 'Partner portal'),
      attributes: {
        href: '/partners/',
        'data-compact-partner-link': true,
        'data-i18n': 'header.partnerPortal',
        hidden: true,
      },
    });
    actions.appendChild(partnerLink);

    let logoutButton = existingLogoutButton;
    if (!(logoutButton instanceof HTMLElement)) {
      logoutButton = createElement('button', 'compact-profile__logout', {
        text: getText('header.logout', 'Log out'),
        attributes: {
          type: 'button',
          'data-auth': 'logout',
          'data-i18n': 'header.logout',
          'data-i18n-attrs': 'aria-label:auth.logout.aria',
          'aria-label': getText('auth.logout.aria', 'Log out'),
        },
      });
    } else {
      logoutButton.classList.remove('btn', 'btn-sm');
      logoutButton.classList.add('compact-profile__logout');
      logoutButton.setAttribute('data-i18n', 'header.logout');
      logoutButton.setAttribute('data-i18n-attrs', 'aria-label:auth.logout.aria');
    }
    actions.appendChild(logoutButton);

    if (oldStats) {
      oldStats.remove();
    }

    return profile;
  }

  function closeAllMenus(except) {
    document.querySelectorAll(SELECTORS.compactProfile).forEach((profile) => {
      if (except && profile === except) {
        return;
      }
      const trigger = profile.querySelector(SELECTORS.trigger);
      const menu = profile.querySelector(SELECTORS.menu);
      if (trigger instanceof HTMLElement && menu instanceof HTMLElement) {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && menu.contains(activeElement)) {
          trigger.focus({ preventScroll: true });
        }
        trigger.setAttribute('aria-expanded', 'false');
        setHidden(menu, true);
      }
    });
  }

  function getDisplayName(state) {
    const profile = state?.profile || {};
    const user = state?.session?.user || {};
    const metadata = user?.user_metadata || {};

    const candidates = [
      profile.username,
      metadata.username,
      profile.name,
      metadata.display_name,
      metadata.name,
      metadata.full_name,
      user.email,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return getText('header.profileLabel', 'My profile');
  }

  function getHeaderStats(scope, state = getState()) {
    const profile = state?.profile || {};
    const snapshot = window.__CE_HEADER_STATS_SNAPSHOT || {};
    const domLevel = readMetricFromDom(scope, '#headerLevelNumber', 1);
    const domXp = readMetricFromDom(scope, '#headerXpPoints', 0);
    const domBadges = readMetricFromDom(scope, '#headerBadgesCount', 0);

    const level = hasOwn(profile, 'level')
      ? Math.max(1, toFiniteNumber(profile.level, 1))
      : Math.max(1, toFiniteNumber(snapshot.level, domLevel));

    const xp = hasOwn(profile, 'xp')
      ? Math.max(0, toFiniteNumber(profile.xp, 0))
      : Math.max(0, toFiniteNumber(snapshot.xp, domXp));

    let badges = domBadges;
    if (hasOwn(profile, 'badges') && Number.isFinite(Number(profile.badges))) {
      badges = Math.max(0, Number(profile.badges));
    } else if (hasOwn(profile, 'visited_places')) {
      badges = Math.max(0, countVisitedPlaces(profile.visited_places));
    } else if (Number.isFinite(Number(snapshot.badges))) {
      badges = Math.max(0, Number(snapshot.badges));
    }

    const avatarUrl = typeof profile.avatar_url === 'string' && profile.avatar_url.trim()
      ? profile.avatar_url.trim()
      : (typeof snapshot.avatar_url === 'string' && snapshot.avatar_url.trim() ? snapshot.avatar_url.trim() : '');

    return { level, xp, badges, avatarUrl };
  }

  function syncMetricFields(scope, state = getState()) {
    if (!(scope instanceof HTMLElement)) {
      return;
    }

    const { level, xp, badges, avatarUrl } = getHeaderStats(scope, state);
    const levelEl = scope.querySelector('#headerLevelNumber');
    const xpEl = scope.querySelector('#headerXpPoints');
    const xpFillEl = scope.querySelector('#headerXpFill');
    const badgesEl = scope.querySelector('#headerBadgesCount');
    const triggerAvatar = scope.querySelector('#headerUserAvatar');
    const menuAvatar = scope.querySelector('[data-compact-user-avatar]');

    if (levelEl instanceof HTMLElement) {
      levelEl.textContent = String(level);
    }

    if (xpEl instanceof HTMLElement) {
      xpEl.textContent = String(xp);
    }

    if (badgesEl instanceof HTMLElement) {
      badgesEl.textContent = String(badges);
    }

    if (xpFillEl instanceof HTMLElement) {
      const XP_PER_LEVEL = 150;
      const currentLevelXP = xp % XP_PER_LEVEL;
      const progressPercent = Math.max(0, Math.min(100, Math.round((currentLevelXP / XP_PER_LEVEL) * 100)));
      xpFillEl.style.width = `${progressPercent}%`;
      xpFillEl.classList.toggle('is-width-zero', progressPercent <= 0);
    }

    if (avatarUrl) {
      if (triggerAvatar instanceof HTMLImageElement) {
        triggerAvatar.src = avatarUrl;
      }
      if (menuAvatar instanceof HTMLImageElement) {
        menuAvatar.src = avatarUrl;
      }
    }
  }

  function bindProfileMenus() {
    if (menuListenersBound) return;
    menuListenersBound = true;

    document.addEventListener('click', (event) => {
      const closeButton = event.target instanceof Element
        ? event.target.closest(SELECTORS.close)
        : null;
      if (closeButton instanceof HTMLElement) {
        closeAllMenus();
        return;
      }

      const trigger = event.target instanceof Element
        ? event.target.closest(SELECTORS.trigger)
        : null;

      if (trigger instanceof HTMLElement) {
        const profile = trigger.closest(SELECTORS.compactProfile);
        const menu = profile?.querySelector(SELECTORS.menu);
        const open = menu?.hidden !== false;
        closeAllMenus(profile);
        if (profile && menu instanceof HTMLElement) {
          trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
          setHidden(menu, !open);
          if (open) {
            syncMenuIdentity(profile, getState());
            void lookupPartnerAccess();
          }
        }
        return;
      }

      const insideMenu = event.target instanceof Element
        ? event.target.closest(SELECTORS.menu)
        : null;
      if (!insideMenu) {
        closeAllMenus();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllMenus();
      }
    });
  }

  function getStatusText(state) {
    const metrics = getHeaderStats(document.querySelector(SELECTORS.compactHeader), state);
    const level = metrics.level;
    const badges = metrics.badges;
    const isPl = getLanguage() === 'pl';
    return isPl ? `Poziom ${level} • ${badges} odznak` : `Level ${level} • ${badges} badges`;
  }

  function syncMenuIdentity(profile, state = getState()) {
    if (!(profile instanceof HTMLElement)) {
      return;
    }

    const trigger = profile.querySelector(SELECTORS.trigger);
    const nameEl = profile.querySelector(SELECTORS.name);
    const statusEl = profile.querySelector(SELECTORS.status);
    const menuAvatar = profile.querySelector('[data-compact-user-avatar]');
    const triggerAvatar = trigger?.querySelector('#headerUserAvatar');
    const triggerName = trigger?.querySelector('.profile-name');
    const triggerStatus = trigger?.querySelector('.profile-status');

    const displayName = getDisplayName(state);
    const statusText = getStatusText(state);

    if (triggerName instanceof HTMLElement) {
      triggerName.textContent = displayName;
    }
    if (triggerStatus instanceof HTMLElement) {
      triggerStatus.textContent = statusText;
    }
    if (nameEl instanceof HTMLElement) {
      nameEl.textContent = displayName;
    }
    if (statusEl instanceof HTMLElement) {
      statusEl.textContent = statusText;
    }
    if (menuAvatar instanceof HTMLImageElement && triggerAvatar instanceof HTMLImageElement && triggerAvatar.getAttribute('src')) {
      menuAvatar.setAttribute('src', triggerAvatar.getAttribute('src'));
    }

    syncMetricFields(profile.closest(SELECTORS.compactHeader) || profile, state);
  }

  async function loadAccessiblePartnersFallback(sb) {
    if (!sb) return [];

    const fetchWithColumns = async (columns) => {
      const { data, error } = await sb
        .from('partners')
        .select(columns)
        .order('name', { ascending: true })
        .limit(100);

      return { data, error };
    };

    let { data, error } = await fetchWithColumns(PARTNER_FULL_SELECT);

    if (error && (/cars_locations/i.test(String(error.message || '')) || /affiliate_enabled/i.test(String(error.message || '')) || /can_manage_transport/i.test(String(error.message || '')))) {
      ({ data, error } = await fetchWithColumns(PARTNER_LEGACY_SELECT));
    }

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  async function lookupPartnerAccess() {
    const state = getState();
    const userId = String(state?.session?.user?.id || '').trim();
    const links = Array.from(document.querySelectorAll(SELECTORS.partnerLink));

    if (!links.length) return false;

    if (!userId) {
      partnerLookupUserId = '';
      partnerAccess = false;
      links.forEach((link) => setHidden(link, true));
      return false;
    }

    if (partnerLookupPromise && partnerLookupUserId === userId) {
      return partnerLookupPromise;
    }

    if (partnerLookupUserId === userId) {
      links.forEach((link) => setHidden(link, !partnerAccess));
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
        } else {
          partnerAccess = Array.isArray(data) && data.length > 0;
        }

        if (!partnerAccess) {
          const fallbackPartners = await loadAccessiblePartnersFallback(sb);
          partnerAccess = Array.isArray(fallbackPartners) && fallbackPartners.length > 0;
        }

        return partnerAccess;
      } catch (error) {
        console.warn('[compact-header] Partner access lookup failed.', error);
        partnerAccess = false;
        return false;
      } finally {
        links.forEach((link) => setHidden(link, !partnerAccess));
      }
    })();

    return partnerLookupPromise;
  }

  function enforceAuthVisibility(root, state = getState()) {
    const isLogged = !!state?.session?.user;

    root.querySelectorAll('[data-auth="anon-only"]').forEach((element) => {
      setHidden(element, isLogged);
    });

    root.querySelectorAll('[data-auth="user-only"]').forEach((element) => {
      setHidden(element, !isLogged);
    });

    root.querySelectorAll('[data-auth="logout"]').forEach((element) => {
      setHidden(element, !isLogged);
    });
  }

  function upgradeHeader(root) {
    if (!(root instanceof HTMLElement)) {
      return;
    }

    const top = root.querySelector(SELECTORS.top);
    const topActions = root.querySelector(SELECTORS.topActions);
    if (!(top instanceof HTMLElement) || !(topActions instanceof HTMLElement)) {
      normalizeBranding(root);
      return;
    }

    root.classList.add('nav-modern--compact');
    root.dataset.compactUpgraded = 'true';

    ensureAuthActions(topActions);
    ensureCompactProfile(root, top, topActions);
    normalizeBranding(root);
    enforceAuthVisibility(root);
  }

  function upgradeAllHeaders() {
    document.querySelectorAll(SELECTORS.header).forEach((header) => {
      upgradeHeader(header);
    });
  }

  function syncCompactHeader(state = getState()) {
    document.querySelectorAll(SELECTORS.compactHeader).forEach((root) => {
      enforceAuthVisibility(root, state);
      root.querySelectorAll(SELECTORS.compactProfile).forEach((profile) => {
        syncMenuIdentity(profile, state);
      });
    });

    if (state?.session?.user) {
      void lookupPartnerAccess();
      return;
    }

    closeAllMenus();
    document.querySelectorAll(SELECTORS.partnerLink).forEach((link) => setHidden(link, true));
  }

  function init() {
    if (!document.querySelector(SELECTORS.header)) {
      return;
    }

    removeLegacyAuthMessage();
    upgradeAllHeaders();
    bindProfileMenus();
    bindAuthFallback();
    ensureSupportScripts();
    syncCompactHeader();

    document.addEventListener('ce-auth:state', (event) => {
      syncCompactHeader(event?.detail || getState());
    });

    document.addEventListener('wakacjecypr:languagechange', () => {
      normalizeBranding();
      syncCompactHeader();
    });

    document.addEventListener('ce:header-stats', () => {
      syncCompactHeader();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
