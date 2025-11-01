(function () {
  'use strict';

  const SUPPORTED_LANGUAGES = ['pl', 'en', 'el'];
  const DEFAULT_IMAGE = 'assets/cyprus_logo-1000x1054.png';
  const CANONICAL_ORIGIN = 'https://www.cypruseye.com';
  const LOCALE_FALLBACK = {
    pl: 'pl_PL',
    en: 'en_GB',
    el: 'el_GR',
  };

  const head = document.head || document.getElementsByTagName('head')[0];

  function ensureMeta(attribute, value) {
    const selector = `meta[${attribute}="${value}"]`;
    let element = head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, value);
      head.appendChild(element);
    }
    return element;
  }

  function ensureLocalizedMeta(attribute, value, language) {
    const selector = `meta[${attribute}="${value}"][lang="${language}"]`;
    let element = head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, value);
      element.setAttribute('lang', language);
      head.appendChild(element);
    }
    return element;
  }

  function ensureLink(rel) {
    let link = head.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      head.appendChild(link);
    }
    return link;
  }

  function ensureAlternate(hreflang) {
    let link = head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hreflang);
      head.appendChild(link);
    }
    return link;
  }

  function toAbsoluteUrl(value) {
    if (!value) {
      return '';
    }
    try {
      return new URL(value, CANONICAL_ORIGIN).toString();
    } catch (error) {
      return value;
    }
  }

  const meta = {
    description: ensureMeta('name', 'description'),
    ogTitle: ensureMeta('property', 'og:title'),
    ogDescription: ensureMeta('property', 'og:description'),
    ogUrl: ensureMeta('property', 'og:url'),
    ogImage: ensureMeta('property', 'og:image'),
    ogLocale: ensureMeta('property', 'og:locale'),
  };

  const canonicalLink = ensureLink('canonical');

  const fallback = {
    title: document.title,
    description: meta.description.getAttribute('content') || '',
    ogTitle: meta.ogTitle.getAttribute('content') || document.title,
    ogDescription: meta.ogDescription.getAttribute('content') || '',
    ogImage: meta.ogImage.getAttribute('content') || DEFAULT_IMAGE,
    ogLocale: meta.ogLocale.getAttribute('content') || '',
  };

  function getTranslations(language) {
    const i18n = window.appI18n;
    if (!i18n || !i18n.translations) {
      return {};
    }
    return i18n.translations[language] || {};
  }

  function getTranslationString(translations, key) {
    if (!translations) {
      return null;
    }
    const entry = translations[key];
    if (typeof entry === 'string') {
      return entry;
    }
    if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string') {
        return entry.text;
      }
      if (typeof entry.html === 'string') {
        return entry.html;
      }
    }
    return null;
  }

  function buildCanonicalUrl() {
    const url = new URL(window.location.pathname, CANONICAL_ORIGIN);
    return url.toString();
  }

  function buildLanguageUrl(language) {
    const url = new URL(window.location.pathname, CANONICAL_ORIGIN);
    const params = new URLSearchParams(window.location.search);
    if (language) {
      params.set('lang', language);
    }
    params.forEach((value, key) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
    if (language) {
      url.searchParams.set('lang', language);
    } else {
      url.searchParams.delete('lang');
    }
    return url.toString();
  }

  function updateAlternateLinks(activeLanguage) {
    SUPPORTED_LANGUAGES.forEach((code) => {
      const link = ensureAlternate(code);
      link.setAttribute('href', buildLanguageUrl(code));
    });

    const defaultLink = ensureAlternate('x-default');
    defaultLink.setAttribute('href', buildCanonicalUrl());

    canonicalLink.setAttribute('href', buildCanonicalUrl());

    if (meta.ogUrl) {
      meta.ogUrl.setAttribute('content', buildLanguageUrl(activeLanguage));
    }
  }

  function updateSeo(language) {
    const pageKey = document.body?.dataset?.seoPage || 'home';
    const translations = getTranslations(language);
    const baseKey = `seo.${pageKey}`;

    const title = getTranslationString(translations, `${baseKey}.title`) || fallback.title;
    if (title) {
      document.title = title;
    }

    const description =
      getTranslationString(translations, `${baseKey}.description`) || fallback.description;
    if (description && meta.description) {
      meta.description.setAttribute('content', description);
    }

    const ogTitle = getTranslationString(translations, `${baseKey}.ogTitle`) || title || fallback.ogTitle;
    if (ogTitle && meta.ogTitle) {
      meta.ogTitle.setAttribute('content', ogTitle);
    }

    const ogDescription =
      getTranslationString(translations, `${baseKey}.ogDescription`) || description || fallback.ogDescription;
    if (ogDescription && meta.ogDescription) {
      meta.ogDescription.setAttribute('content', ogDescription);
    }

    const ogImageValue =
      getTranslationString(translations, `${baseKey}.ogImage`) ||
      getTranslationString(translations, 'seo.ogImage') ||
      fallback.ogImage ||
      DEFAULT_IMAGE;
    if (ogImageValue && meta.ogImage) {
      meta.ogImage.setAttribute('content', toAbsoluteUrl(ogImageValue));
    }

    const localeValue =
      getTranslationString(translations, `${baseKey}.locale`) ||
      getTranslationString(translations, 'seo.locale') ||
      fallback.ogLocale ||
      LOCALE_FALLBACK[language] ||
      LOCALE_FALLBACK.en;
    if (localeValue && meta.ogLocale) {
      meta.ogLocale.setAttribute('content', localeValue);
    }

    const titleElement = head.querySelector('title');
    if (titleElement) {
      titleElement.setAttribute('lang', language);
    }

    SUPPORTED_LANGUAGES.forEach((code) => {
      const localizedTranslations = getTranslations(code);
      const localizedBaseKey = `seo.${pageKey}`;
      const localizedTitle =
        getTranslationString(localizedTranslations, `${localizedBaseKey}.title`) || fallback.title;
      const localizedDescription =
        getTranslationString(localizedTranslations, `${localizedBaseKey}.description`) || fallback.description;
      const localizedOgTitle =
        getTranslationString(localizedTranslations, `${localizedBaseKey}.ogTitle`) || localizedTitle;
      const localizedOgDescription =
        getTranslationString(localizedTranslations, `${localizedBaseKey}.ogDescription`) ||
        localizedDescription;

      const titleMeta = ensureLocalizedMeta('name', 'title', code);
      titleMeta.setAttribute('content', localizedTitle);

      const descriptionMeta = ensureLocalizedMeta('name', 'description', code);
      descriptionMeta.setAttribute('content', localizedDescription);

      const ogTitleMeta = ensureLocalizedMeta('property', 'og:title', code);
      ogTitleMeta.setAttribute('content', localizedOgTitle);

      const ogDescriptionMeta = ensureLocalizedMeta('property', 'og:description', code);
      ogDescriptionMeta.setAttribute('content', localizedOgDescription);
    });

    head
      .querySelectorAll('meta[property="og:locale:alternate"]')
      .forEach((node) => node.parentNode?.removeChild(node));
    SUPPORTED_LANGUAGES.filter((code) => code !== language).forEach((code) => {
      const locale = LOCALE_FALLBACK[code] || code;
      const alternate = ensureLocalizedMeta('property', 'og:locale:alternate', code);
      alternate.setAttribute('content', locale);
    });

    updateAlternateLinks(language);
  }

  function getActiveLanguage() {
    if (window.appI18n && window.appI18n.language) {
      return window.appI18n.language;
    }
    return document.documentElement.lang || 'pl';
  }

  function applyForCurrentLanguage() {
    updateSeo(getActiveLanguage());
  }

  document.addEventListener('wakacjecypr:languagechange', (event) => {
    const language = event?.detail?.language || getActiveLanguage();
    updateSeo(language);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyForCurrentLanguage, { once: true });
  } else {
    applyForCurrentLanguage();
  }
})();

(function () {
  'use strict';

  const MOBILE_NAV_ITEMS = [
    {
      id: 'mobileAdventureTab',
      icon: '🎯',
      label: 'Przygoda',
      i18nKey: 'mobile.nav.adventure',
      pageUrl: 'index.html',
      target: 'adventureView',
    },
    {
      id: 'mobileCommunityTab',
      icon: '💬',
      label: 'Społeczność',
      i18nKey: 'mobile.nav.community',
      pageUrl: 'community.html',
    },
    {
      id: 'mobilePackingTab',
      icon: '🎒',
      label: 'Pakowanie',
      i18nKey: 'mobile.nav.packing',
      pageUrl: 'packing.html',
      target: 'packingView',
    },
    {
      id: 'mobileTasksTab',
      icon: '✅',
      label: 'Misje',
      i18nKey: 'mobile.nav.tasks',
      pageUrl: 'tasks.html',
      target: 'tasksView',
    },
    {
      id: 'mobileMediaTripsTab',
      icon: '📸',
      label: 'VIP',
      i18nKey: 'mobile.nav.mediaTrips',
      pageUrl: 'vip.html',
      target: 'mediaTripsView',
      ariaLabel: 'Otwórz stronę VIP wyjazdów indywidualnych',
      i18nAttrs: 'aria-label:nav.mediaTrips.ariaLabel',
    },
    {
      id: 'mobileCarRentalTab',
      icon: '🚗',
      label: 'Wynajem aut',
      i18nKey: 'mobile.nav.carRental',
      pageUrl: 'car-rental-landing.html',
    },
    {
      id: 'mobileCouponsTab',
      icon: '🎟️',
      label: 'Kupony',
      i18nKey: 'mobile.nav.coupons',
      pageUrl: 'kupon.html',
    },
  ];

  const SEO_PAGE_TO_TAB = {
    home: 'mobileAdventureTab',
    achievements: 'mobileAdventureTab',
    attractions: 'mobileAdventureTab',
    community: 'mobileCommunityTab',
    packing: 'mobilePackingTab',
    tasks: 'mobileTasksTab',
    mediatrips: 'mobileMediaTripsTab',
    vip: 'mobileMediaTripsTab',
    carrental: 'mobileCarRentalTab',
    carrentallanding: 'mobileCarRentalTab',
    carrentalpfo: 'mobileCarRentalTab',
    cruise: 'mobileAdventureTab',
    advertise: 'mobileAdventureTab',
    coupon: 'mobileCouponsTab',
    notfound: 'mobileAdventureTab',
  };

  function determineActiveMobileTabId() {
    const seoPage = document.body?.dataset?.seoPage;
    if (seoPage) {
      const normalized = seoPage.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(SEO_PAGE_TO_TAB, normalized)) {
        return SEO_PAGE_TO_TAB[normalized];
      }
    }

    const path = window.location?.pathname?.toLowerCase() ?? '';
    if (path.includes('community')) {
      return 'mobileCommunityTab';
    }
    if (path.includes('packing')) {
      return 'mobilePackingTab';
    }
    if (path.includes('tasks')) {
      return 'mobileTasksTab';
    }
    if (path.includes('vip')) {
      return 'mobileMediaTripsTab';
    }
    if (path.includes('car-rental') || path.includes('autopfo')) {
      return 'mobileCarRentalTab';
    }
    if (path.includes('kupon') || path.includes('coupon')) {
      return 'mobileCouponsTab';
    }

    return 'mobileAdventureTab';
  }

  function buildMobileTabbarButton(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-tabbar-btn';
    button.id = item.id;
    button.setAttribute('aria-pressed', 'false');

    if (item.target) {
      button.setAttribute('data-target', item.target);
      button.setAttribute('aria-controls', item.target);
    }

    button.dataset.pageUrl = item.pageUrl;

    if (item.ariaLabel) {
      button.setAttribute('aria-label', item.ariaLabel);
    }
    if (item.i18nAttrs) {
      button.setAttribute('data-i18n-attrs', item.i18nAttrs);
    }

    const icon = document.createElement('span');
    icon.className = 'mobile-tabbar-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;

    const label = document.createElement('span');
    label.className = 'mobile-tabbar-label';
    label.setAttribute('data-i18n', item.i18nKey);
    label.textContent = item.label;

    button.append(icon, label);

    return button;
  }

  function updateMobileTabbarActiveState(nav) {
    const mobileTabbar = nav || document.querySelector('.mobile-tabbar');
    if (!mobileTabbar) {
      return;
    }

    const activeId = determineActiveMobileTabId();
    const buttons = mobileTabbar.querySelectorAll('.mobile-tabbar-btn');
    buttons.forEach((button) => {
      const isActive = button.id === activeId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function attachPageNavigation(nav) {
    if (document.querySelector('.app-view')) {
      return;
    }

    nav.querySelectorAll('.mobile-tabbar-btn').forEach((button) => {
      const targetPage = button.dataset.pageUrl;
      if (!targetPage) {
        return;
      }

      button.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = targetPage;
      });
    });
  }

  function insertMobileTabbar(nav) {
    const footer = document.querySelector('.app-footer');
    if (footer?.parentNode) {
      footer.parentNode.insertBefore(nav, footer);
      return;
    }

    const firstScript = document.body?.querySelector('script');
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(nav, firstScript);
      return;
    }

    document.body?.appendChild(nav);
  }

  function ensureMobileTabbar() {
    if (!document.body) {
      return;
    }

    let mobileTabbar = document.querySelector('.mobile-tabbar');
    if (!mobileTabbar) {
      mobileTabbar = document.createElement('nav');
      mobileTabbar.className = 'mobile-tabbar';
      mobileTabbar.setAttribute('aria-label', 'Dolna nawigacja');
      insertMobileTabbar(mobileTabbar);
    }

    mobileTabbar.innerHTML = '';
    
    // Get current page's tab ID to exclude it from navigation
    const currentTabId = determineActiveMobileTabId();
    
    // Render only buttons that are NOT the current page (show 6 out of 7)
    MOBILE_NAV_ITEMS.forEach((item) => {
      // Skip the button for the current page
      if (item.id === currentTabId) {
        return;
      }
      
      const button = buildMobileTabbarButton(item);
      mobileTabbar.appendChild(button);
    });

    attachPageNavigation(mobileTabbar);
    updateMobileTabbarActiveState(mobileTabbar);
  }

  function initializeMobileTabbar() {
    ensureMobileTabbar();
    updateMobileTabbarActiveState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMobileTabbar, { once: true });
  } else {
    initializeMobileTabbar();
  }

  window.determineActiveMobileTabId = determineActiveMobileTabId;
  window.ensureMobileTabbar = ensureMobileTabbar;
  window.updateMobileTabbarActiveState = updateMobileTabbarActiveState;

  window.addEventListener('pageshow', () => {
    updateMobileTabbarActiveState();
  });
})();
