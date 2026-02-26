/**
 * Mobile Navigation - Simple & Clean
 * Shows 6 navigation links at bottom of page (excludes current page)
 */

(function() {
  'use strict';

  // All 7 navigation pages
  const NAV_PAGES = [
    { icon: '🎯', label: 'Przygoda', href: 'index.html', page: 'home' },
    { icon: '💬', label: 'Społeczność', href: 'community.html', page: 'community' },
    { icon: '🎒', label: 'Pakowanie', href: 'packing.html', page: 'packing' },
    { icon: '✅', label: 'Misje', href: 'tasks.html', page: 'tasks' },
    { icon: '🧭', label: 'Wycieczki', href: 'trips.html', page: 'trips' },
    { icon: '🚗', label: 'Wynajem', href: 'car.html', page: 'carrental' },
    { icon: '🚕', label: 'Transport', href: 'transport.html', page: 'transport' }
  ];

  function toRootHref(href) {
    if (!href) return '#';
    if (/^https?:\/\//i.test(href)) return href;
    if (href.charAt(0) === '/') return href;
    return '/' + href.replace(/^\/+/, '');
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
    nav.setAttribute('aria-label', 'Mobile Navigation');
    
    // Filter out current page, show only 6 links
    const linksToShow = NAV_PAGES.filter(page => page.page !== currentPage);
    
    // Create links
    linksToShow.forEach(page => {
      const link = document.createElement('a');
      link.href = toRootHref(page.href);
      link.className = 'mobile-nav-link';
      link.setAttribute('aria-label', page.label);
      
      // Icon
      const icon = document.createElement('span');
      icon.className = 'mobile-nav-icon';
      icon.textContent = page.icon;
      
      // Label
      const label = document.createElement('span');
      label.className = 'mobile-nav-label';
      label.textContent = page.label;
      
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
  }

  init();
})();
