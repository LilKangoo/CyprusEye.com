/**
 * Language Switcher Module
 * Handles language switching with RTL support for Hebrew
 */

const SUPPORTED_LANGUAGES = {
  pl: { name: 'Polski', flag: '🇵🇱', dir: 'ltr', locale: 'pl_PL' },
  en: { name: 'English', flag: '🇬🇧', dir: 'ltr', locale: 'en_GB' },
  // el: { name: 'Ελληνικά', flag: '🇬🇷', dir: 'ltr', locale: 'el_GR' },
  // he: { name: 'עברית', flag: '🇮🇱', dir: 'rtl', locale: 'he_IL' }
};

const DEFAULT_LANGUAGE = 'pl';
const LANGUAGE_STORAGE_KEY = 'cypruseye-language';

/**
 * Get the current language from localStorage or detect from browser
 */
function getCurrentLanguage() {
  // Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  if (langParam && SUPPORTED_LANGUAGES[langParam]) {
    return langParam;
  }

  // Check localStorage
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES[stored]) {
    return stored;
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
 * Also delegates to the global i18n system (appI18n) when available
 * so that all data-i18n translations are refreshed immediately.
 */
function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES[lang]) {
    console.error(`Language ${lang} is not supported`);
    return false;
  }

  const langConfig = SUPPORTED_LANGUAGES[lang];
  
  // Save to localStorage (used by this switcher on next load)
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);

  // Update HTML attributes
  document.documentElement.lang = lang;
  document.documentElement.dir = langConfig.dir;

  // Update meta tags
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) {
    ogLocale.content = langConfig.locale;
  }

  // If the legacy/global i18n system is present, delegate to it so that
  // all [data-i18n] elements and internal modules switch language too.
  if (window.appI18n && typeof window.appI18n.setLanguage === 'function') {
    try {
      window.appI18n.setLanguage(lang);
    } catch (error) {
      console.error('Failed to delegate language change to appI18n:', error);
    }
  }

  // Trigger event for other listeners (languageRefresh, custom modules)
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
        // Update URL without reloading
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.history.pushState({}, '', url.toString());
        
        // Close menu
        closeMenu();
        
        // Update UI immediately (event already dispatched in setLanguage())
      }
    });
  });
}

/**
 * Create language switcher UI (mobile only - desktop uses FAB from components.css)
 */
function createLanguageSwitcher(containerId = 'languageSwitcherDesktop') {
  // Desktop uses the existing FAB from components.css
  // Only create mobile tabbar button + overlay
  createMobileLanguageSwitcher();
}

/**
 * Initialize language system
 * NOTE: This system is DISABLED - using i18n.js instead
 */
function initLanguageSystem() {
  console.log('languageSwitcher.js: DISABLED - using i18n.js system');
  // System disabled to avoid conflicts with i18n.js
  // The i18n.js handles all language switching
}

// Auto-initialize when DOM is ready - DISABLED
// Commenting out to prevent conflicts with i18n.js
/*
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanguageSystem);
} else {
  initLanguageSystem();
}
*/

/**
 * Get translated field from POI object based on current language
 * @param {Object} poi - POI object
 * @param {string} fieldName - Field name ('name', 'description', 'badge')
 * @returns {string} Translated value or fallback
 */
function getPoiTranslatedField(poi, fieldName) {
  if (!poi) return '';

  const currentLang = getCurrentLanguage();
  const i18nFieldName = `${fieldName}_i18n`;

  // 1) Supabase JSONB i18n field on the POI (preferred)
  if (poi[i18nFieldName] && typeof poi[i18nFieldName] === 'object') {
    const translated = poi[i18nFieldName][currentLang];
    if (translated) return translated;

    // Fallback to Polish if current language not available
    if (poi[i18nFieldName].pl) return poi[i18nFieldName].pl;

    // Fallback to English if Polish not available
    if (poi[i18nFieldName].en) return poi[i18nFieldName].en;
  }

  // 2) Static i18n JSON (places.<id>.<field>) when key is available
  const keyFieldName = `${fieldName}Key`;
  const translationKey = poi[keyFieldName];
  if (translationKey && window.appI18n && window.appI18n.translations) {
    const lang = window.appI18n.language || currentLang;
    const translations = window.appI18n.translations[lang];

    if (translations) {
      let value = translations[translationKey];

      // Support nested keys via dot notation (e.g. 'places.panagia-kykkos-viewpoint.name')
      if (typeof value === 'undefined' && translationKey.indexOf('.') !== -1) {
        const parts = translationKey.split('.');
        let current = translations;
        for (const part of parts) {
          if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
            current = current[part];
          } else {
            current = undefined;
            break;
          }
        }
        value = current;
      }

      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object') {
        if (typeof value.text === 'string') return value.text;
        if (typeof value.html === 'string') return value.html;
      }
    }
  }

  // 3) Fallback to legacy field
  return poi[fieldName] || '';
}

/**
 * Convenience function to get translated POI name
 * @param {Object} poi - POI object
 * @returns {string} Translated name
 */
function getPoiName(poi) {
  return getPoiTranslatedField(poi, 'name') || poi.id || 'Unnamed';
}

/**
 * Convenience function to get translated POI description
 * @param {Object} poi - POI object
 * @returns {string} Translated description
 */
function getPoiDescription(poi) {
  return getPoiTranslatedField(poi, 'description') || '';
}

/**
 * Convenience function to get translated POI badge
 * @param {Object} poi - POI object
 * @returns {string} Translated badge
 */
function getPoiBadge(poi) {
  return getPoiTranslatedField(poi, 'badge') || '';
}

/**
 * Get translated field from Hotel object based on current language
 * @param {Object} hotel - Hotel object
 * @param {string} fieldName - Field name ('title', 'description')
 * @returns {string} Translated value or fallback
 */
function getHotelTranslatedField(hotel, fieldName) {
  if (!hotel) return '';
  
  const currentLang = getCurrentLanguage();
  
  // Hotel fields are already JSONB (title, description)
  // No _i18n suffix needed
  if (hotel[fieldName] && typeof hotel[fieldName] === 'object') {
    const translated = hotel[fieldName][currentLang];
    if (translated) return translated;
    
    // Fallback to Polish if current language not available
    if (hotel[fieldName].pl) return hotel[fieldName].pl;
    
    // Fallback to English if Polish not available
    if (hotel[fieldName].en) return hotel[fieldName].en;
  }
  
  // Fallback to direct field if it's a string (legacy)
  if (typeof hotel[fieldName] === 'string') return hotel[fieldName];
  
  return '';
}

/**
 * Convenience function to get translated hotel title
 * @param {Object} hotel - Hotel object
 * @returns {string} Translated title
 */
function getHotelName(hotel) {
  return getHotelTranslatedField(hotel, 'title') || hotel.slug || 'Unnamed Hotel';
}

/**
 * Convenience function to get translated hotel description
 * @param {Object} hotel - Hotel object
 * @returns {string} Translated description
 */
function getHotelDescription(hotel) {
  return getHotelTranslatedField(hotel, 'description') || '';
}

/**
 * Get a translated field from a trip object based on current language
 * @param {Object} trip - Trip object with i18n fields
 * @param {string} fieldName - Field to translate (e.g., 'title', 'description')
 * @returns {string} Translated value
 */
function getTripTranslatedField(trip, fieldName) {
  if (!trip) return '';
  
  const currentLang = getCurrentLanguage();
  
  // Check if field is an i18n object
  if (trip[fieldName] && typeof trip[fieldName] === 'object') {
    // Try current language
    const translated = trip[fieldName][currentLang];
    if (translated) return translated;
    
    // Fallback to Polish if current language not available
    if (trip[fieldName].pl) return trip[fieldName].pl;
    
    // Fallback to English if Polish not available
    if (trip[fieldName].en) return trip[fieldName].en;
  }
  
  // Fallback to direct field if it's a string (legacy)
  if (typeof trip[fieldName] === 'string') return trip[fieldName];
  
  return '';
}

/**
 * Convenience function to get translated trip title
 * @param {Object} trip - Trip object
 * @returns {string} Translated title
 */
function getTripName(trip) {
  return getTripTranslatedField(trip, 'title') || trip.slug || 'Unnamed Trip';
}

/**
 * Convenience function to get translated trip description
 * @param {Object} trip - Trip object
 * @returns {string} Translated description
 */
function getTripDescription(trip) {
  return getTripTranslatedField(trip, 'description') || '';
}

// Make POI functions globally accessible
window.getPoiName = getPoiName;
window.getPoiDescription = getPoiDescription;
window.getPoiBadge = getPoiBadge;
window.getPoiTranslatedField = getPoiTranslatedField;

// Make Hotel functions globally accessible
window.getHotelName = getHotelName;
window.getHotelDescription = getHotelDescription;
window.getHotelTranslatedField = getHotelTranslatedField;

// Make Trip functions globally accessible
window.getTripName = getTripName;
window.getTripDescription = getTripDescription;
window.getTripTranslatedField = getTripTranslatedField;

// Make current language getter globally accessible
window.getCurrentLanguage = getCurrentLanguage;

/**
 * Get a translated field from a quest/task object based on current language
 * @param {Object} quest - Quest/Task object with i18n fields
 * @param {string} fieldName - Field to translate (e.g., 'title', 'description')
 * @returns {string} Translated value
 */
function getQuestTranslatedField(quest, fieldName) {
  if (!quest) return '';
  
  const currentLang = getCurrentLanguage();
  const i18nField = `${fieldName}_i18n`;
  
  // Check if i18n field exists
  if (quest[i18nField] && typeof quest[i18nField] === 'object') {
    // Try current language
    if (quest[i18nField][currentLang]) return quest[i18nField][currentLang];
    
    // Fallback to Polish
    if (quest[i18nField].pl) return quest[i18nField].pl;
    
    // Fallback to English
    if (quest[i18nField].en) return quest[i18nField].en;
  }
  
  // Fallback to legacy field (backward compatibility)
  if (typeof quest[fieldName] === 'string') return quest[fieldName];
  
  return '';
}

/**
 * Convenience function to get translated quest title
 * @param {Object} quest - Quest object
 * @returns {string} Translated title
 */
function getQuestTitle(quest) {
  return getQuestTranslatedField(quest, 'title') || quest?.id || 'Unnamed Quest';
}

/**
 * Convenience function to get translated quest description
 * @param {Object} quest - Quest object
 * @returns {string} Translated description
 */
function getQuestDescription(quest) {
  return getQuestTranslatedField(quest, 'description') || '';
}

// Make Quest functions globally accessible
window.getQuestTitle = getQuestTitle;
window.getQuestDescription = getQuestDescription;
window.getQuestTranslatedField = getQuestTranslatedField;

/**
 * Get a translated field from a car object based on current language
 * @param {Object} car - Car object with i18n fields
 * @param {string} fieldName - Field to translate (e.g., 'car_model', 'description', 'car_type')
 * @returns {string} Translated value
 */
function getCarTranslatedField(car, fieldName) {
  if (!car) return '';
  
  const currentLang = getCurrentLanguage();
  
  // Check if field is an i18n object
  if (car[fieldName] && typeof car[fieldName] === 'object') {
    // Try current language
    const translated = car[fieldName][currentLang];
    if (translated) return translated;
    
    // Fallback to Polish if current language not available
    if (car[fieldName].pl) return car[fieldName].pl;
    
    // Fallback to English if Polish not available
    if (car[fieldName].en) return car[fieldName].en;
  }
  
  // Fallback to direct field if it's a string (legacy)
  if (typeof car[fieldName] === 'string') return car[fieldName];
  
  return '';
}

/**
 * Convenience function to get translated car model name
 * @param {Object} car - Car object
 * @returns {string} Translated car model
 */
function getCarName(car) {
  return getCarTranslatedField(car, 'car_model') || car.car_type || 'Unknown Car';
}

/**
 * Convenience function to get translated car description
 * @param {Object} car - Car object
 * @returns {string} Translated description
 */
function getCarDescription(car) {
  return getCarTranslatedField(car, 'description') || '';
}

/**
 * Convenience function to get translated car type
 * @param {Object} car - Car object
 * @returns {string} Translated car type
 */
function getCarType(car) {
  return getCarTranslatedField(car, 'car_type') || '';
}

/**
 * Get translated features array for current language
 * @param {Object} car - Car object
 * @returns {Array} Array of translated features
 */
function getCarFeatures(car) {
  if (!car || !car.features) return [];
  
  const currentLang = getCurrentLanguage();
  
  // Check if features is an i18n object
  if (car.features && typeof car.features === 'object' && !Array.isArray(car.features)) {
    // Try current language
    if (car.features[currentLang] && Array.isArray(car.features[currentLang])) {
      return car.features[currentLang];
    }
    
    // Fallback to Polish if current language not available
    if (car.features.pl && Array.isArray(car.features.pl)) {
      return car.features.pl;
    }
    
    // Fallback to English if Polish not available
    if (car.features.en && Array.isArray(car.features.en)) {
      return car.features.en;
    }
  }
  
  // Fallback to direct array (legacy)
  if (Array.isArray(car.features)) {
    return car.features;
  }
  
  return [];
}

// Make Car functions globally accessible
window.getCarTranslatedField = getCarTranslatedField;
window.getCarName = getCarName;
window.getCarDescription = getCarDescription;
window.getCarType = getCarType;
window.getCarFeatures = getCarFeatures;

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPPORTED_LANGUAGES,
    getCurrentLanguage,
    setLanguage,
    createLanguageSwitcher,
    initLanguageSystem,
    getPoiTranslatedField,
    getPoiName,
    getPoiDescription,
    getPoiBadge,
    getHotelTranslatedField,
    getHotelName,
    getHotelDescription
  };
}
