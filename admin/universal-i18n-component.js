/**
 * UNIVERSAL I18N COMPONENT
 * Multilingual input fields for all admin forms
 */

// Supported languages configuration
const I18N_LANGUAGES = [
  { code: 'pl', label: '🇵🇱 Polski', required: true, rtl: false },
  { code: 'en', label: '🇬🇧 English', required: true, rtl: false },
  { code: 'el', label: '🇬🇷 Ελληνικά', required: false, rtl: false },
  { code: 'he', label: '🇮🇱 עברית', required: false, rtl: true }
];

/**
 * Render language tabs
 */
function renderI18nTabs(fieldName, activeLanguage = 'pl') {
  return `
    <div class="lang-tabs" data-field="${fieldName}">
      ${I18N_LANGUAGES.map((lang, i) => `
        <button type="button" 
                class="lang-tab ${lang.code === activeLanguage ? 'active' : ''}" 
                data-lang="${lang.code}"
                data-field="${fieldName}"
                onclick="switchI18nTab('${fieldName}', '${lang.code}')">
          ${lang.label} ${lang.required ? '<span class="required">*</span>' : ''}
        </button>
      `).join('')}
    </div>
  `;
}

/**
 * Render i18n input field
 */
function renderI18nInput(config) {
  const {
    fieldName,     // e.g., 'title', 'description'
    label,         // e.g., 'Title', 'Description'
    type = 'text', // 'text' or 'textarea'
    rows = 4,
    placeholder = '',
    currentValues = {} // { pl: 'value', en: 'value', ... }
  } = config;
  
  return `
    <div class="i18n-field-group">
      <label class="i18n-field-label">${label}</label>
      ${renderI18nTabs(fieldName)}
      
      ${I18N_LANGUAGES.map((lang, i) => `
        <div class="lang-content ${lang.code === 'pl' ? 'active' : ''}" 
             data-lang="${lang.code}"
             data-field="${fieldName}"
             ${lang.rtl ? 'dir="rtl"' : ''}>
          
          ${type === 'textarea' ? `
            <textarea 
              name="${fieldName}_${lang.code}" 
              rows="${rows}"
              ${lang.required ? 'required' : ''}
              placeholder="${placeholder} (${lang.code.toUpperCase()})"
              class="i18n-input"
            >${currentValues[lang.code] || ''}</textarea>
          ` : `
            <input 
              type="text"
              name="${fieldName}_${lang.code}"
              value="${currentValues[lang.code] || ''}"
              ${lang.required ? 'required' : ''}
              placeholder="${placeholder} (${lang.code.toUpperCase()})"
              class="i18n-input"
            />
          `}
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Switch language tab
 */
function switchI18nTab(fieldName, langCode) {
  // Update tabs
  document.querySelectorAll(`.lang-tab[data-field="${fieldName}"]`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === langCode);
  });
  
  // Update content
  document.querySelectorAll(`.lang-content[data-field="${fieldName}"]`).forEach(div => {
    div.classList.toggle('active', div.dataset.lang === langCode);
  });
}

/**
 * Extract i18n values from FormData
 */
function extractI18nValues(formData, fieldName) {
  const i18nObj = {};
  
  I18N_LANGUAGES.forEach(lang => {
    const value = formData.get(`${fieldName}_${lang.code}`);
    if (value && value.trim()) {
      i18nObj[lang.code] = value.trim();
    }
  });
  
  return Object.keys(i18nObj).length > 0 ? i18nObj : null;
}

/**
 * Validate i18n fields (PL and EN required)
 */
function validateI18nField(i18nObj, fieldLabel) {
  if (!i18nObj) {
    return `${fieldLabel} jest wymagane`;
  }
  
  if (!i18nObj.pl || !i18nObj.pl.trim()) {
    return `${fieldLabel} w języku polskim jest wymagane`;
  }
  
  if (!i18nObj.en || !i18nObj.en.trim()) {
    return `${fieldLabel} w języku angielskim jest wymagane`;
  }
  
  return null; // Valid
}

/**
 * Get translated value for current language
 */
function getI18nValue(i18nObj, fallback = '') {
  if (!i18nObj || typeof i18nObj !== 'object') {
    return fallback;
  }
  
  const currentLang = window.appI18n?.language || 'pl';
  
  // Fallback chain: current → en → pl → fallback
  return i18nObj[currentLang] || i18nObj.en || i18nObj.pl || fallback;
}

/**
 * Inject i18n styles
 */
function injectI18nStyles() {
  if (document.getElementById('i18n-component-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'i18n-component-styles';
  style.textContent = `
    .i18n-field-group {
      margin: 20px 0;
    }
    
    .i18n-field-label {
      display: block;
      margin-bottom: 12px;
      font-weight: 600;
      color: var(--admin-text);
      font-size: 14px;
    }
    
    .i18n-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--admin-border);
      border-radius: 6px;
      background: var(--admin-bg-light);
      color: var(--admin-text);
      font-family: inherit;
      font-size: 14px;
    }
    
    .i18n-input:focus {
      outline: none;
      border-color: var(--admin-primary);
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
    }
    
    textarea.i18n-input {
      resize: vertical;
      min-height: 100px;
    }
  `;
  
  document.head.appendChild(style);
}

// Auto-inject styles
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectI18nStyles);
} else {
  injectI18nStyles();
}

// Export globally
window.I18N_LANGUAGES = I18N_LANGUAGES;
window.renderI18nTabs = renderI18nTabs;
window.renderI18nInput = renderI18nInput;
window.switchI18nTab = switchI18nTab;
window.extractI18nValues = extractI18nValues;
window.validateI18nField = validateI18nField;
window.getI18nValue = getI18nValue;

console.log('✅ Universal I18N Component loaded');
