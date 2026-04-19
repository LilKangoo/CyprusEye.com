/**
 * Mobile Navigation - Simple & Clean
 * Shows 6 navigation links at bottom of page (excludes current page)
 */

(function() {
  'use strict';

  // All 7 navigation pages
  const NAV_PAGES = [
    { icon: '🎯', href: 'index.html', page: 'home', key: 'mobile.nav.adventure', fallback: { pl: 'Przygoda', en: 'Adventure' } },
    { icon: '💬', href: 'community.html', page: 'community', key: 'mobile.nav.community', fallback: { pl: 'Społeczność', en: 'Community' } },
    { icon: '🎒', href: 'packing.html', page: 'packing', key: 'mobile.nav.packing', fallback: { pl: 'Pakowanie', en: 'Packing' } },
    { icon: '✅', href: 'tasks.html', page: 'tasks', key: 'mobile.nav.tasks', fallback: { pl: 'Misje', en: 'Missions' } },
    { icon: '🧭', href: 'trips.html', page: 'trips', key: 'mobile.nav.trips', fallback: { pl: 'Wycieczki', en: 'Trips' } },
    { icon: '🚗', href: 'car.html', page: 'carrental', key: 'mobile.nav.carRental', fallback: { pl: 'Wynajem aut', en: 'Cars' } },
    { icon: '🚕', href: 'transport.html', page: 'transport', key: 'mobile.nav.transport', fallback: { pl: 'Transport', en: 'Transport' } }
  ];

  function getCurrentLang() {
    try {
      const documentLang = String(document.documentElement.lang || '').trim().toLowerCase();
      if (documentLang) return documentLang;
    } catch (_error) {}

    try {
      const appLang = String(window.appI18n?.language || '').trim().toLowerCase();
      if (appLang) return appLang;
    } catch (_error) {}

    try {
      const storedLang = String(localStorage.getItem('ce_lang') || '').trim().toLowerCase();
      if (storedLang) return storedLang;
    } catch (_error) {}

    return 'pl';
  }

  function getTranslation(key, fallbackMap) {
    const lang = getCurrentLang();
    const fallback = fallbackMap?.[lang] || fallbackMap?.pl || fallbackMap?.en || '';

    try {
      const translations = window.appI18n?.translations?.[lang];
      if (!translations || !key) {
        return fallback;
      }

      if (typeof translations[key] === 'string' && translations[key]) {
        return translations[key];
      }

      let current = translations;
      const parts = String(key).split('.');
      for (const part of parts) {
        if (!current || typeof current !== 'object' || !(part in current)) {
          current = null;
          break;
        }
        current = current[part];
      }

      if (typeof current === 'string' && current) {
        return current;
      }
    } catch (_error) {}

    return fallback;
  }

  function toRootHref(href) {
    if (!href) return '#';
    if (/^https?:\/\//i.test(href)) return href;
    if (href.charAt(0) === '/') return href;
    return '/' + href.replace(/^\/+/, '');
  }

  function buildLocalizedHref(href) {
    try {
      const url = new URL(toRootHref(href), window.location.origin);
      const lang = getCurrentLang();
      if (lang) {
        url.searchParams.set('lang', lang);
      }
      return url.pathname + url.search + url.hash;
    } catch (_error) {
      return toRootHref(href);
    }
  }

  /**
   * Detect current page from URL
   */
  function getCurrentPage() {
    const path = window.location.pathname.toLowerCase();
    
    // Check seo-page attribute first
    const seoPage = document.body?.dataset?.seoPage;
    if (seoPage) {
      const normalized = seoPage.toLowerCase();
      if (normalized === 'home' || normalized === 'achievements' || normalized === 'attractions' || normalized === 'auth' || normalized === 'reset') return 'home';
      if (normalized === 'community') return 'community';
      if (normalized === 'packing') return 'packing';
      if (normalized === 'tasks') return 'tasks';
      if (normalized === 'vip' || normalized === 'mediatrips') return 'vip';
      if (normalized === 'trips') return 'trips';
      if (normalized.includes('rental') || normalized === 'carrental') return 'carrental';
      if (normalized === 'transport') return 'transport';
    }
    
    // Fallback to URL detection
    if (path.includes('community')) return 'community';
    if (path.includes('packing')) return 'packing';
    if (path.includes('tasks')) return 'tasks';
    if (path.includes('vip')) return 'vip';
    if (path.includes('trips')) return 'trips';
    if (path.includes('car-rental') || path.includes('rental') || path.endsWith('/car.html') || path === '/car.html') return 'carrental';
    if (path.includes('transport')) return 'transport';
    
    return 'home'; // default
  }

  /**
   * Create mobile nav HTML
   */
  function createMobileNav() {
    const currentPage = getCurrentPage();
    
    // Create nav container
    const nav = document.createElement('nav');
    nav.className = 'mobile-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', getTranslation('mobile.nav.aria', { pl: 'Nawigacja dolna', en: 'Bottom navigation' }));
    
    // Filter out current page, show only 6 links
    const linksToShow = NAV_PAGES.filter(page => page.page !== currentPage);
    
    // Create links
    linksToShow.forEach(page => {
      const labelText = getTranslation(page.key, page.fallback);
      const link = document.createElement('a');
      link.href = buildLocalizedHref(page.href);
      link.className = 'mobile-nav-link';
      link.setAttribute('aria-label', labelText);
      
      // Icon
      const icon = document.createElement('span');
      icon.className = 'mobile-nav-icon';
      icon.textContent = page.icon;
      
      // Label
      const label = document.createElement('span');
      label.className = 'mobile-nav-label';
      label.textContent = labelText;
      
      link.appendChild(icon);
      link.appendChild(label);
      nav.appendChild(link);
    });
    
    return nav;
  }

  /**
   * Insert mobile nav into page
   */
  function insertMobileNav() {
    // Remove existing mobile nav if any
    const existing = document.querySelector('.mobile-nav, .mobile-tabbar');
    if (existing) {
      existing.remove();
    }
    
    // Create new nav
    const nav = createMobileNav();
    
    // Insert before footer or at end of body
    const footer = document.querySelector('.app-footer, footer');
    if (footer) {
      footer.parentNode.insertBefore(nav, footer);
    } else {
      document.body.appendChild(nav);
    }
    
    console.log('✅ Mobile navigation created:', nav);
  }

  /**
   * Initialize on page load
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insertMobileNav);
    } else {
      insertMobileNav();
    }

    window.addEventListener('languageChanged', insertMobileNav);
    document.addEventListener('wakacjecypr:languagechange', insertMobileNav);
  }

  init();
})();
