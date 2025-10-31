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
 * Create language switcher UI as FAB (Floating Action Button)
 */
function createLanguageSwitcher(containerId = 'languageSwitcher') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Language switcher container #${containerId} not found`);
    return;
  }

  const currentLang = getCurrentLanguage();
  const currentConfig = SUPPORTED_LANGUAGES[currentLang];
  
  // Create FAB structure with toggle button and expandable menu
  const switcherHTML = `
    <div class="language-switcher" role="group" aria-label="Language selector">
      <div class="language-switcher-menu" role="menu">
        ${Object.entries(SUPPORTED_LANGUAGES)
          .filter(([code]) => code !== currentLang)
          .map(([code, config]) => `
            <button 
              class="language-switcher-btn"
              data-lang-switch="${code}"
              role="menuitem"
              aria-label="Switch to ${config.name}"
              title="${config.name}"
            >
              <span class="language-flag" aria-hidden="true">${config.flag}</span>
            </button>
          `).join('')}
      </div>
      <button 
        class="language-switcher-toggle"
        aria-label="Change language (current: ${currentConfig.name})"
        aria-expanded="false"
        aria-haspopup="menu"
        title="${currentConfig.name}"
      >
        <span class="language-flag" aria-hidden="true">${currentConfig.flag}</span>
      </button>
    </div>
  `;

  container.innerHTML = switcherHTML;

  const switcher = container.querySelector('.language-switcher');
  const toggle = container.querySelector('.language-switcher-toggle');
  const menu = container.querySelector('.language-switcher-menu');
  let isExpanded = false;

  // Toggle menu on click
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    isExpanded = !isExpanded;
    switcher.classList.toggle('is-expanded', isExpanded);
    toggle.setAttribute('aria-expanded', isExpanded.toString());
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (isExpanded && !switcher.contains(e.target)) {
      isExpanded = false;
      switcher.classList.remove('is-expanded');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Close menu on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isExpanded) {
      isExpanded = false;
      switcher.classList.remove('is-expanded');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });

  // Attach event listeners to language buttons
  container.querySelectorAll('[data-lang-switch]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const lang = button.getAttribute('data-lang-switch');
      if (setLanguage(lang)) {
        // Reload page to apply new translations
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.location.href = url.toString();
      }
    });
  });
}

/**
 * Initialize language system
 */
function initLanguageSystem() {
  const currentLang = getCurrentLanguage();
  setLanguage(currentLang);

  // Create switcher if container exists
  if (document.getElementById('languageSwitcher')) {
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
