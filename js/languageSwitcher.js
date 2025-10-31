/**
 * Language Switcher Module
 * Handles language switching with RTL support for Hebrew
 */

const SUPPORTED_LANGUAGES = {
  pl: { name: 'Polski', flag: '🇵🇱', dir: 'ltr', locale: 'pl_PL' },
  en: { name: 'English', flag: '🇬🇧', dir: 'ltr', locale: 'en_GB' },
  el: { name: 'Ελληνικά', flag: '🇬🇷', dir: 'ltr', locale: 'el_GR' },
  he: { name: 'עברית', flag: '🇮🇱', dir: 'rtl', locale: 'he_IL' }
};

const DEFAULT_LANGUAGE = 'pl';
const LANGUAGE_STORAGE_KEY = 'cypruseye-language';

/**
 * Get the current language from localStorage or detect from browser
 */
function getCurrentLanguage() {
  // Check localStorage first
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES[stored]) {
    return stored;
  }

  // Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  if (langParam && SUPPORTED_LANGUAGES[langParam]) {
    return langParam;
  }

  // Detect from browser language
  const browserLang = navigator.language.split('-')[0];
  if (SUPPORTED_LANGUAGES[browserLang]) {
    return browserLang;
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Set the language and apply direction
 */
function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES[lang]) {
    console.error(`Language ${lang} is not supported`);
    return false;
  }

  const langConfig = SUPPORTED_LANGUAGES[lang];
  
  // Save to localStorage
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);

  // Update HTML attributes
  document.documentElement.lang = lang;
  document.documentElement.dir = langConfig.dir;

  // Update meta tags
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) {
    ogLocale.content = langConfig.locale;
  }

  // Trigger event for i18n system to reload
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));

  // Update active button state
  updateLanguageSwitcherUI(lang);

  return true;
}

/**
 * Update the UI state of language switcher buttons
 */
function updateLanguageSwitcherUI(currentLang) {
  document.querySelectorAll('[data-lang-switch]').forEach(button => {
    const lang = button.getAttribute('data-lang-switch');
    if (lang === currentLang) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'true');
    } else {
      button.classList.remove('is-active');
      button.removeAttribute('aria-current');
    }
  });
}

/**
 * Create desktop language switcher (dropdown in header)
 */
function createDesktopLanguageSwitcher(containerId = 'languageSwitcherDesktop') {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const currentLang = getCurrentLanguage();
  const currentConfig = SUPPORTED_LANGUAGES[currentLang];
  
  const switcherHTML = `
    <div class="language-switcher-desktop" role="group" aria-label="Language selector">
      <button 
        class="language-switcher-toggle"
        aria-label="Change language (current: ${currentConfig.name})"
        aria-expanded="false"
        aria-haspopup="menu"
      >
        <span class="language-flag" aria-hidden="true">${currentConfig.flag}</span>
        <span class="language-name">${currentConfig.name}</span>
        <span class="language-arrow" aria-hidden="true">▼</span>
      </button>
      <div class="language-switcher-menu" role="menu">
        ${Object.entries(SUPPORTED_LANGUAGES).map(([code, config]) => `
          <button 
            class="language-switcher-btn ${code === currentLang ? 'is-active' : ''}"
            data-lang-switch="${code}"
            role="menuitem"
            aria-label="Switch to ${config.name}"
          >
            <span class="language-flag" aria-hidden="true">${config.flag}</span>
            <span class="language-name">${config.name}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = switcherHTML;

  const switcher = container.querySelector('.language-switcher-desktop');
  const toggle = container.querySelector('.language-switcher-toggle');
  let isExpanded = false;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    isExpanded = !isExpanded;
    switcher.classList.toggle('is-expanded', isExpanded);
    toggle.setAttribute('aria-expanded', isExpanded.toString());
  });

  document.addEventListener('click', (e) => {
    if (isExpanded && !switcher.contains(e.target)) {
      isExpanded = false;
      switcher.classList.remove('is-expanded');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isExpanded) {
      isExpanded = false;
      switcher.classList.remove('is-expanded');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });

  container.querySelectorAll('[data-lang-switch]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const lang = button.getAttribute('data-lang-switch');
      if (setLanguage(lang)) {
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.location.href = url.toString();
      }
    });
  });
}

/**
 * Create mobile language switcher (tabbar button + overlay menu)
 */
function createMobileLanguageSwitcher() {
  const tabbar = document.querySelector('.mobile-tabbar');
  if (!tabbar) {
    return;
  }

  const currentLang = getCurrentLanguage();
  const currentConfig = SUPPORTED_LANGUAGES[currentLang];

  // Add button to tabbar
  const tabbarButton = document.createElement('button');
  tabbarButton.type = 'button';
  tabbarButton.className = 'mobile-tabbar-btn language-tabbar-btn';
  tabbarButton.id = 'mobileLanguageTab';
  tabbarButton.setAttribute('aria-pressed', 'false');
  tabbarButton.innerHTML = `
    <span class="mobile-tabbar-icon language-tabbar-icon" aria-hidden="true">${currentConfig.flag}</span>
    <span class="mobile-tabbar-label language-tabbar-label" data-i18n="mobile.nav.language">Język</span>
  `;
  tabbar.appendChild(tabbarButton);

  // Create overlay menu
  const overlay = document.createElement('div');
  overlay.className = 'language-mobile-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  
  const menu = document.createElement('div');
  menu.className = 'language-mobile-menu';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Select language');
  menu.innerHTML = `
    <div class="language-mobile-menu-header">
      <h2 class="language-mobile-menu-title" data-i18n="language.switcher.label">Wybierz język</h2>
      <button class="language-mobile-menu-close" aria-label="Close" type="button">✕</button>
    </div>
    <div class="language-mobile-menu-list">
      ${Object.entries(SUPPORTED_LANGUAGES).map(([code, config]) => `
        <button 
          class="language-switcher-btn ${code === currentLang ? 'is-active' : ''}"
          data-lang-switch="${code}"
        >
          <span class="language-flag" aria-hidden="true">${config.flag}</span>
          <span class="language-name">${config.name}</span>
        </button>
      `).join('')}
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(menu);

  // Event handlers
  const openMenu = () => {
    overlay.classList.add('is-visible');
    menu.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeMenu = () => {
    overlay.classList.remove('is-visible');
    menu.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  tabbarButton.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);
  menu.querySelector('.language-mobile-menu-close').addEventListener('click', closeMenu);

  menu.querySelectorAll('[data-lang-switch]').forEach(button => {
    button.addEventListener('click', () => {
      const lang = button.getAttribute('data-lang-switch');
      if (setLanguage(lang)) {
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.location.href = url.toString();
      }
    });
  });
}

/**
 * Create language switcher UI (both desktop and mobile)
 */
function createLanguageSwitcher(containerId = 'languageSwitcherDesktop') {
  // Desktop dropdown in header
  createDesktopLanguageSwitcher(containerId);
  
  // Mobile tabbar button + overlay
  createMobileLanguageSwitcher();
}

/**
 * Initialize language system
 */
function initLanguageSystem() {
  const currentLang = getCurrentLanguage();
  setLanguage(currentLang);

  // Create switcher if container exists
  if (document.getElementById('languageSwitcherDesktop') || document.querySelector('.mobile-tabbar')) {
    createLanguageSwitcher();
  }

  // Update existing buttons
  updateLanguageSwitcherUI(currentLang);

  // Listen for manual language switches
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-lang-switch]');
    if (button) {
      e.preventDefault();
      const lang = button.getAttribute('data-lang-switch');
      if (setLanguage(lang)) {
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.location.href = url.toString();
      }
    }
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanguageSystem);
} else {
  initLanguageSystem();
}

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPPORTED_LANGUAGES,
    getCurrentLanguage,
    setLanguage,
    createLanguageSwitcher,
    initLanguageSystem
  };
}
