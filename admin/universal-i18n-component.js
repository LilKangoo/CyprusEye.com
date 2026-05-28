/**
 * UNIVERSAL I18N COMPONENT
 * Multilingual input fields for all admin forms
 */

// Supported languages configuration
const I18N_LANGUAGES = [
  { code: 'pl', label: '🇵🇱 Polski', required: true, rtl: false, internal: false },
  { code: 'en', label: '🇬🇧 English', required: true, rtl: false, internal: false },
  { code: 'el', label: '🇬🇷 Ελληνικά', required: false, rtl: false, internal: true },
  { code: 'he', label: '🇮🇱 עברית', required: false, rtl: true, internal: true }
];

const I18N_FALLBACK_CHAINS = {
  he: ['he', 'en', 'pl'],
  en: ['en', 'pl'],
  pl: ['pl', 'en'],
  el: ['el', 'en', 'pl']
};

function getI18nLanguageConfig(code) {
  return I18N_LANGUAGES.find((lang) => lang.code === code) || I18N_LANGUAGES[0];
}

function getI18nCopySource(code) {
  if (code === 'he' || code === 'el') return 'en';
  return code === 'pl' ? 'en' : 'pl';
}

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
                data-internal-language="${lang.internal ? 'true' : 'false'}"
                data-field="${fieldName}"
                onclick="switchI18nTab('${fieldName}', '${lang.code}')">
          ${lang.label} ${lang.required ? '<span class="required">*</span>' : ''}${lang.internal ? '<span class="i18n-internal-badge">internal</span>' : ''}
        </button>
      `).join('')}
    </div>
  `;
}

function renderI18nCopyButton(fieldName, langCode) {
  const source = getI18nCopySource(langCode);
  return `
    <button
      type="button"
      class="i18n-copy-btn"
      data-i18n-copy-field="${fieldName}"
      data-i18n-copy-target="${langCode}"
      data-i18n-copy-source="${source}"
    >
      Copy from ${source.toUpperCase()}
    </button>
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
             data-internal-language="${lang.internal ? 'true' : 'false'}"
             ${lang.rtl ? 'dir="rtl"' : ''}>
          <div class="i18n-panel-head">
            <span>${lang.internal ? 'Internal language' : 'Editable language'}</span>
            ${renderI18nCopyButton(fieldName, lang.code)}
          </div>
          
          ${type === 'textarea' ? `
            <textarea 
              name="${fieldName}_${lang.code}" 
              rows="${rows}"
              placeholder="${placeholder} (${lang.code.toUpperCase()})"
              class="i18n-input"
              ${lang.rtl ? 'dir="rtl"' : ''}
            >${currentValues[lang.code] || ''}</textarea>
          ` : `
            <input 
              type="text"
              name="${fieldName}_${lang.code}"
              value="${currentValues[lang.code] || ''}"
              placeholder="${placeholder} (${lang.code.toUpperCase()})"
              class="i18n-input"
              ${lang.rtl ? 'dir="rtl"' : ''}
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
 * Render i18n array input field (for features, tags, etc.)
 */
function renderI18nArrayInput(config) {
  const {
    fieldName,     // e.g., 'features'
    label,         // e.g., 'Features'
    rows = 4,
    placeholder = '',
    currentValues = {} // { pl: ['value1', 'value2'], en: ['value1', 'value2'], ... }
  } = config;
  
  return `
    <div class="i18n-field-group">
      <label class="i18n-field-label">${label}</label>
      ${renderI18nTabs(fieldName)}
      
      ${I18N_LANGUAGES.map((lang, i) => `
        <div class="lang-content ${lang.code === 'pl' ? 'active' : ''}" 
             data-lang="${lang.code}"
             data-field="${fieldName}"
             data-internal-language="${lang.internal ? 'true' : 'false'}"
             ${lang.rtl ? 'dir="rtl"' : ''}>
          <div class="i18n-panel-head">
            <span>${lang.internal ? 'Internal language' : 'Editable language'}</span>
            ${renderI18nCopyButton(fieldName, lang.code)}
          </div>
          
          <textarea 
            name="${fieldName}_${lang.code}" 
            rows="${rows}"
            placeholder="${placeholder} (${lang.code.toUpperCase()})"
            class="i18n-input"
            ${lang.rtl ? 'dir="rtl"' : ''}
          >${Array.isArray(currentValues[lang.code]) ? currentValues[lang.code].join('\n') : ''}</textarea>
          <small style="color: var(--admin-text-muted); font-size: 11px; margin-top: 4px; display: block;">Enter each item on a new line</small>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Extract i18n array values from FormData (split by newlines)
 */
function extractI18nArrayValues(formData, fieldName) {
  const i18nObj = {};
  
  I18N_LANGUAGES.forEach(lang => {
    const value = formData.get(`${fieldName}_${lang.code}`);
    if (value && value.trim()) {
      // Split by newlines, trim each line, filter empty lines
      const items = value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (items.length > 0) {
        i18nObj[lang.code] = items;
      }
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
  
  const chain = I18N_FALLBACK_CHAINS[currentLang] || I18N_FALLBACK_CHAINS.en;
  for (const code of chain) {
    if (i18nObj[code]) return i18nObj[code];
  }
  return Object.values(i18nObj).find(Boolean) || fallback;
}

function copyI18nField(fieldName, targetLang, sourceLang) {
  const target = document.querySelector(`[name="${fieldName}_${targetLang}"]`);
  const source = document.querySelector(`[name="${fieldName}_${sourceLang}"]`);
  if (!target || !source) return;
  target.value = source.value || '';
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function bindI18nCopyButtons() {
  if (window.__ceI18nCopyButtonsBound) return;
  window.__ceI18nCopyButtonsBound = true;
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-i18n-copy-field]');
    if (!button) return;
    copyI18nField(
      button.getAttribute('data-i18n-copy-field'),
      button.getAttribute('data-i18n-copy-target'),
      button.getAttribute('data-i18n-copy-source')
    );
  });
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

    .i18n-internal-badge {
      display: inline-flex;
      align-items: center;
      margin-left: 6px;
      padding: 1px 5px;
      border-radius: 999px;
      background: rgba(234, 179, 8, 0.12);
      color: #92400e;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .i18n-panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      color: var(--admin-text-muted);
      font-size: 12px;
    }

    .i18n-copy-btn {
      border: 1px solid var(--admin-border);
      border-radius: 6px;
      padding: 5px 8px;
      background: var(--admin-bg);
      color: var(--admin-text);
      font-size: 12px;
      cursor: pointer;
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

    .lang-content[dir="rtl"] .i18n-panel-head,
    .lang-content[dir="rtl"] .i18n-input {
      direction: rtl;
      text-align: right;
    }
  `;
  
  document.head.appendChild(style);
}

// Auto-inject styles
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectI18nStyles();
    bindI18nCopyButtons();
  });
} else {
  injectI18nStyles();
  bindI18nCopyButtons();
}

// Export globally
window.I18N_LANGUAGES = I18N_LANGUAGES;
window.renderI18nTabs = renderI18nTabs;
window.renderI18nInput = renderI18nInput;
window.renderI18nArrayInput = renderI18nArrayInput;
window.switchI18nTab = switchI18nTab;
window.extractI18nValues = extractI18nValues;
window.extractI18nArrayValues = extractI18nArrayValues;
window.validateI18nField = validateI18nField;
window.getI18nValue = getI18nValue;
window.copyI18nField = copyI18nField;

console.log('✅ Universal I18N Component loaded');
