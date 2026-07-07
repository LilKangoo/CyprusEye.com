import { supabase } from '/js/supabaseClient.js';
import { enhancePhoneInput } from '/js/phone-input.js';

const LANGUAGES = ['pl', 'en', 'he'];
const FALLBACK_ORDER = ['pl', 'en', 'he'];
const PUBLIC_STATUS = 'active';
const PUBLIC_VISIBILITY = 'public';

const TEXT = {
  pl: {
    mode: 'Special Offer',
    previewMode: 'Admin preview',
    unavailableTitle: 'Kampania nie jest jeszcze dostępna.',
    unavailableCopy: 'Ta kampania nie jest obecnie publiczna.',
    home: 'Wróć do CyprusEye',
    about: 'O kampanii',
    prize: 'Nagroda',
    rules: 'Regulamin',
    faq: 'FAQ',
    links: 'Powiązane usługi',
    noFaq: 'Brak pytań FAQ.',
    noPrize: 'Opis nagrody nie jest jeszcze dostępny.',
    noRules: 'Regulamin nie jest jeszcze dostępny.',
    noLinks: 'Linki do usług nie są jeszcze dostępne.',
    entryTitle: 'Formularz zgłoszeniowy',
    notConfigured: 'Formularz nie został jeszcze skonfigurowany.',
    noFormRequired: 'Ta kampania nie wymaga formularza zgłoszeniowego.',
    previewMessage: 'Podgląd formularza. Wysyłanie zgłoszeń nie jest jeszcze dostępne.',
    submitLabel: 'Wyślij zgłoszenie',
    selectPlaceholder: 'Wybierz opcję',
    genericField: 'Pole formularza',
    starts: 'Start',
    ends: 'Koniec',
    winner: 'Ogłoszenie zwycięzcy',
  },
  en: {
    mode: 'Special Offer',
    previewMode: 'Admin preview',
    unavailableTitle: 'Campaign is not available yet.',
    unavailableCopy: 'This campaign is not public at the moment.',
    home: 'Back to CyprusEye',
    about: 'About this campaign',
    prize: 'Prize',
    rules: 'Rules',
    faq: 'FAQ',
    links: 'Linked services',
    noFaq: 'No FAQ items.',
    noPrize: 'Prize copy is not available yet.',
    noRules: 'Rules are not available yet.',
    noLinks: 'Linked services are not available yet.',
    entryTitle: 'Entry form',
    notConfigured: 'The entry form has not been configured yet.',
    noFormRequired: 'This campaign does not require an entry form.',
    previewMessage: 'Form preview. Entry submission is not available yet.',
    submitLabel: 'Submit entry',
    selectPlaceholder: 'Select an option',
    genericField: 'Form field',
    starts: 'Starts',
    ends: 'Ends',
    winner: 'Winner announcement',
  },
  he: {
    mode: 'Special Offer',
    previewMode: 'תצוגה מקדימה למנהל',
    unavailableTitle: 'הקמפיין עדיין לא זמין.',
    unavailableCopy: 'הקמפיין אינו ציבורי כרגע.',
    home: 'חזרה ל-CyprusEye',
    about: 'על הקמפיין',
    prize: 'פרס',
    rules: 'כללים',
    faq: 'שאלות נפוצות',
    links: 'שירותים קשורים',
    noFaq: 'אין פריטי FAQ.',
    noPrize: 'תיאור הפרס עדיין לא זמין.',
    noRules: 'הכללים עדיין לא זמינים.',
    noLinks: 'קישורי השירותים עדיין לא זמינים.',
    entryTitle: 'טופס הרשמה',
    notConfigured: 'טופס ההרשמה עדיין לא הוגדר.',
    noFormRequired: 'הקמפיין הזה אינו דורש טופס הרשמה.',
    previewMessage: 'תצוגה מקדימה של הטופס. שליחת הרשמות עדיין אינה זמינה.',
    submitLabel: 'שליחת הרשמה',
    selectPlaceholder: 'בחרו אפשרות',
    genericField: 'שדה טופס',
    starts: 'התחלה',
    ends: 'סיום',
    winner: 'הכרזת הזוכה',
  },
};

const refs = {
  loading: document.querySelector('[data-special-offer-loading]'),
  unavailable: document.querySelector('[data-special-offer-unavailable]'),
  unavailableKicker: document.querySelector('[data-special-offer-unavailable-kicker]'),
  unavailableTitle: document.querySelector('[data-special-offer-unavailable-title]'),
  unavailableCopy: document.querySelector('[data-special-offer-unavailable-copy]'),
  home: document.querySelector('[data-special-offer-home]'),
  content: document.querySelector('[data-special-offer-content]'),
  modeLabel: document.querySelector('[data-special-offer-mode-label]'),
  title: document.querySelector('[data-special-offer-title]'),
  short: document.querySelector('[data-special-offer-short]'),
  dates: document.querySelector('[data-special-offer-dates]'),
  full: document.querySelector('[data-special-offer-full]'),
  prizes: document.querySelector('[data-special-offer-prizes]'),
  rules: document.querySelector('[data-special-offer-rules]'),
  faq: document.querySelector('[data-special-offer-faq]'),
  links: document.querySelector('[data-special-offer-links]'),
  entrySection: document.querySelector('[data-special-offer-entry-placeholder]'),
  entryTitle: document.querySelector('[data-special-offer-entry-title]'),
  entryCopy: document.querySelector('[data-special-offer-entry-copy]'),
  languageButtons: Array.from(document.querySelectorAll('[data-special-offer-lang]')),
  labels: Array.from(document.querySelectorAll('[data-special-offer-label]')),
};

let currentState = null;

function normalizeLang(value) {
  const lang = String(value || '').trim().toLowerCase().split('-')[0];
  return LANGUAGES.includes(lang) ? lang : 'pl';
}

function readRequestedLang() {
  const url = new URL(window.location.href);
  return normalizeLang(url.searchParams.get('lang') || localStorage.getItem('ce_lang') || document.documentElement.lang);
}

function readSlug() {
  const url = new URL(window.location.href);
  const querySlug = String(url.searchParams.get('slug') || '').trim();
  if (querySlug) return querySlug;

  const parts = url.pathname.split('/').filter(Boolean);
  const specialOffersIndex = parts.indexOf('special-offers');
  if (specialOffersIndex >= 0 && parts[specialOffersIndex + 1]) {
    return decodeURIComponent(parts[specialOffersIndex + 1]);
  }
  return '';
}

function isAdminPreview() {
  const url = new URL(window.location.href);
  return ['1', 'true', 'admin'].includes(String(url.searchParams.get('admin_preview') || url.searchParams.get('preview') || '').toLowerCase());
}

function getText(lang) {
  return TEXT[lang] || TEXT.pl;
}

function setPageLanguage(lang) {
  const safeLang = normalizeLang(lang);
  const dir = safeLang === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = safeLang;
  document.documentElement.dir = dir;
  document.body.setAttribute('dir', dir);
  document.body.classList.toggle('is-rtl', dir === 'rtl');
  refs.languageButtons.forEach((button) => {
    const active = button.getAttribute('data-special-offer-lang') === safeLang;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateStaticText(lang) {
  const t = getText(lang);
  if (refs.unavailableKicker) refs.unavailableKicker.textContent = t.mode;
  if (refs.unavailableTitle) refs.unavailableTitle.textContent = t.unavailableTitle;
  if (refs.unavailableCopy) refs.unavailableCopy.textContent = t.unavailableCopy;
  if (refs.home) refs.home.textContent = t.home;
  if (refs.entryTitle) refs.entryTitle.textContent = t.entryTitle;
  if (refs.entryCopy) refs.entryCopy.textContent = t.entryCopy;
  refs.labels.forEach((node) => {
    const key = node.getAttribute('data-special-offer-label');
    if (key && t[key]) node.textContent = t[key];
  });
}

function setRobotsNoIndex(enabled) {
  let meta = document.querySelector('meta[name="robots"][data-special-offer-robots]');
  if (!enabled) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('data-special-offer-robots', 'true');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', 'noindex, nofollow');
}

function showLoading() {
  refs.loading.hidden = false;
  refs.unavailable.hidden = true;
  refs.content.hidden = true;
}

function showUnavailable(lang) {
  setPageLanguage(lang);
  updateStaticText(lang);
  refs.loading.hidden = true;
  refs.unavailable.hidden = false;
  refs.content.hidden = true;
  setRobotsNoIndex(true);
  document.title = `${getText(lang).unavailableTitle} • CyprusEye`;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function hasText(value) {
  return cleanText(value).length > 0;
}

function byLang(rows) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const lang = normalizeLang(row?.lang);
    if (lang) map.set(lang, row);
  });
  return map;
}

function pickTranslation(rows, requestedLang) {
  const map = byLang(rows);
  const candidates = [requestedLang, ...FALLBACK_ORDER].filter((lang, index, list) => list.indexOf(lang) === index);
  for (const lang of candidates) {
    const row = map.get(lang);
    if (row) return { row, lang };
  }
  const first = Array.isArray(rows) ? rows.find(Boolean) : null;
  return { row: first || null, lang: requestedLang };
}

function formatDate(value, lang, timezone) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : lang === 'pl' ? 'pl-PL' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || 'Asia/Nicosia',
    }).format(date);
  } catch (_error) {
    return date.toLocaleString();
  }
}

function renderDates(campaign, lang) {
  const t = getText(lang);
  const items = [
    [t.starts, campaign?.start_at],
    [t.ends, campaign?.end_at],
    [t.winner, campaign?.winner_announce_at],
  ]
    .map(([label, value]) => {
      const formatted = formatDate(value, lang, campaign?.timezone);
      return formatted ? `<span>${escapeHtml(label)}: ${escapeHtml(formatted)}</span>` : '';
    })
    .filter(Boolean);
  refs.dates.innerHTML = items.join('');
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setText(node, value) {
  if (!node) return;
  node.textContent = cleanText(value);
}

function setParagraphs(node, value) {
  if (!node) return;
  const text = cleanText(value);
  node.replaceChildren();
  if (!text) return;
  text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const p = document.createElement('p');
    p.textContent = part;
    node.appendChild(p);
  });
}

function isSafeHref(value) {
  const href = cleanText(value);
  if (!href) return false;
  if (href.startsWith('/')) return true;
  return /^https?:\/\//i.test(href);
}

function sanitizeHtml(html) {
  const source = cleanText(html);
  if (!source) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, svg, link, meta').forEach((node) => node.remove());
  const allowedTags = new Set(['SECTION', 'P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'A', 'BR']);
  Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name);
      } else if (node.tagName === 'A' && name === 'href') {
        if (!isSafeHref(attr.value)) node.removeAttribute('href');
      } else if (!(node.tagName === 'A' && name === 'target')) {
        node.removeAttribute(attr.name);
      }
    });
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return doc.body.innerHTML;
}

function parseFaq(value) {
  const source = typeof value === 'string'
    ? (() => {
        try { return JSON.parse(value); } catch (_error) { return []; }
      })()
    : value;
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => ({
      question: cleanText(item?.question),
      answer: cleanText(item?.answer),
    }))
    .filter((item) => item.question && item.answer);
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function normalizeOptions(value) {
  const source = typeof value === 'string'
    ? (() => {
        try { return JSON.parse(value); } catch (_error) { return []; }
      })()
    : value;
  if (!Array.isArray(source)) return [];
  return source
    .map((option) => ({
      value: cleanText(option?.value),
      label: cleanText(option?.label),
    }))
    .filter((option) => option.value || option.label);
}

function getFieldTranslation(field, translationsByField, lang) {
  const picked = pickTranslation(translationsByField.get(field?.id) || [], lang).row || {};
  return {
    label: cleanText(picked.label),
    placeholder: cleanText(picked.placeholder),
    help_text: cleanText(picked.help_text),
    options_json: normalizeOptions(picked.options_json),
  };
}

function getMaxDateForMinAge(minAge) {
  const age = Number(minAge);
  if (!Number.isFinite(age) || age < 0) return '';
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  return date.toISOString().slice(0, 10);
}

function getTextValidationAttributes(validation) {
  const attrs = [];
  if (Number.isFinite(Number(validation.min_length)) && Number(validation.min_length) >= 0) {
    attrs.push(`minlength="${escapeHtml(Number(validation.min_length))}"`);
  }
  if (Number.isFinite(Number(validation.max_length)) && Number(validation.max_length) >= 0) {
    attrs.push(`maxlength="${escapeHtml(Number(validation.max_length))}"`);
  }
  return attrs.join(' ');
}

function renderRequiredMarker(required) {
  return required ? '<span class="special-offer-form-required" aria-hidden="true">*</span>' : '';
}

function renderFormField(field, translationsByField, lang, index) {
  const t = getText(lang);
  const translation = getFieldTranslation(field, translationsByField, lang);
  const label = translation.label || t.genericField;
  const placeholder = translation.placeholder;
  const helpText = translation.help_text;
  const options = translation.options_json;
  const validation = parseJsonObject(field?.validation_json);
  const fieldType = cleanText(field?.field_type) || 'text';
  const fieldKey = cleanText(field?.field_key) || `field_${index + 1}`;
  const inputId = `specialOfferField${index + 1}_${fieldKey.replace(/[^a-z0-9_]/gi, '_')}`;
  const required = field?.required === true;
  const commonAttrs = [
    `id="${escapeHtml(inputId)}"`,
    `name="${escapeHtml(fieldKey)}"`,
    `data-special-offer-field-key="${escapeHtml(fieldKey)}"`,
    required ? 'required aria-required="true"' : '',
    placeholder ? `placeholder="${escapeHtml(placeholder)}"` : '',
    `dir="${lang === 'he' ? 'rtl' : 'ltr'}"`,
  ].filter(Boolean).join(' ');
  const textAttrs = getTextValidationAttributes(validation);
  let control = '';

  if (fieldType === 'textarea' || fieldType === 'contest_answer') {
    control = `<textarea rows="4" ${commonAttrs} ${textAttrs}></textarea>`;
  } else if (fieldType === 'select') {
    control = `
      <select ${commonAttrs}>
        <option value="">${escapeHtml(placeholder || t.selectPlaceholder)}</option>
        ${options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`).join('')}
      </select>
    `;
  } else if (fieldType === 'checkbox_group') {
    control = options.length
      ? `<div class="special-offer-form-options" role="group" aria-labelledby="${escapeHtml(inputId)}Label">
          ${options.map((option, optionIndex) => `
            <label class="special-offer-form-choice">
              <input type="checkbox" name="${escapeHtml(fieldKey)}" value="${escapeHtml(option.value)}" ${required ? 'data-required-group="true"' : ''} />
              <span>${escapeHtml(option.label || option.value)}</span>
            </label>
          `).join('')}
        </div>`
      : `<p class="special-offer-empty">${escapeHtml(t.notConfigured)}</p>`;
  } else if (fieldType === 'checkbox' || fieldType === 'consent') {
    control = `
      <label class="special-offer-form-choice special-offer-form-choice--standalone">
        <input id="${escapeHtml(inputId)}" name="${escapeHtml(fieldKey)}" type="checkbox" ${required || validation.must_be_true ? 'required aria-required="true"' : ''} />
        <span>${escapeHtml(label)} ${renderRequiredMarker(required)}</span>
      </label>
    `;
  } else {
    const inputType = fieldType === 'email'
      ? 'email'
      : fieldType === 'phone'
        ? 'tel'
        : fieldType === 'date' || fieldType === 'date_of_birth'
          ? 'date'
          : ['url', 'facebook_profile_url', 'shared_post_url'].includes(fieldType)
            ? 'url'
            : 'text';
    const dobMax = fieldType === 'date_of_birth' && validation.min_age !== undefined
      ? `max="${escapeHtml(getMaxDateForMinAge(validation.min_age))}" data-min-age="${escapeHtml(validation.min_age)}"`
      : '';
    const phoneAttrs = fieldType === 'phone'
      ? `data-special-offer-phone="true" data-placeholder="${escapeHtml(placeholder)}"`
      : '';
    const autocomplete = fieldType === 'email'
      ? 'autocomplete="email"'
      : fieldType === 'phone'
        ? 'autocomplete="tel"'
        : fieldType === 'country'
          ? 'autocomplete="country-name"'
          : fieldType === 'city'
            ? 'autocomplete="address-level2"'
            : '';
    control = `<input type="${escapeHtml(inputType)}" ${commonAttrs} ${textAttrs} ${dobMax} ${phoneAttrs} ${autocomplete} />`;
  }

  return `
    <div class="special-offer-form-field special-offer-form-field--${escapeHtml(fieldType)}" data-special-offer-form-field="${escapeHtml(fieldKey)}">
      ${fieldType === 'checkbox' || fieldType === 'consent' ? '' : `
        <label id="${escapeHtml(inputId)}Label" for="${escapeHtml(inputId)}">
          <span>${escapeHtml(label)}</span>
          ${renderRequiredMarker(required)}
        </label>
      `}
      ${control}
      ${helpText ? `<p class="special-offer-form-help">${escapeHtml(helpText)}</p>` : ''}
    </div>
  `;
}

function enhanceFormPhoneInputs(lang) {
  document.querySelectorAll('[data-special-offer-phone]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    enhancePhoneInput(input, {
      language: () => lang,
      fieldSelector: '.special-offer-form-field',
      fieldClass: 'special-offer-form-field--phone-enhanced',
      required: input.required,
      placeholder: input.dataset.placeholder || '',
    });
  });
}

function renderEntryForm(data, lang) {
  const t = getText(lang);
  if (!refs.entrySection) return;
  refs.entrySection.hidden = false;
  refs.entrySection.dir = lang === 'he' ? 'rtl' : 'ltr';
  const requiresForm = data.campaign?.requires_form === true;
  if (!requiresForm) {
    refs.entrySection.innerHTML = `
      <h2>${escapeHtml(t.entryTitle)}</h2>
      <p class="special-offer-empty">${escapeHtml(t.noFormRequired)}</p>
    `;
    return;
  }

  const translationsByField = new Map();
  (Array.isArray(data.formFieldTranslations) ? data.formFieldTranslations : []).forEach((row) => {
    if (!row?.field_id) return;
    if (!translationsByField.has(row.field_id)) translationsByField.set(row.field_id, []);
    translationsByField.get(row.field_id).push(row);
  });
  const activeFields = (Array.isArray(data.formFields) ? data.formFields : [])
    .filter((field) => field?.active === true)
    .slice()
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));

  if (!activeFields.length) {
    refs.entrySection.innerHTML = `
      <h2>${escapeHtml(t.entryTitle)}</h2>
      <p class="special-offer-empty">${escapeHtml(t.notConfigured)}</p>
    `;
    return;
  }

  refs.entrySection.innerHTML = `
    <h2>${escapeHtml(t.entryTitle)}</h2>
    <form class="special-offer-entry-form" data-special-offer-entry-form aria-describedby="specialOfferFormPreviewNotice">
      <div class="special-offer-form-grid">
        ${activeFields.map((field, index) => renderFormField(field, translationsByField, lang, index)).join('')}
      </div>
      <div class="special-offer-form-submit">
        <p id="specialOfferFormPreviewNotice">${escapeHtml(t.previewMessage)}</p>
        <button class="special-offer-button" type="button" disabled>${escapeHtml(t.submitLabel)}</button>
      </div>
    </form>
  `;
  const form = refs.entrySection.querySelector('[data-special-offer-entry-form]');
  if (form) {
    form.addEventListener('submit', (event) => event.preventDefault());
  }
  enhanceFormPhoneInputs(lang);
}

function renderPrizes(prizes, prizeTranslations, lang, previewMode) {
  const t = getText(lang);
  refs.prizes.replaceChildren();
  const translationMap = new Map();
  (Array.isArray(prizeTranslations) ? prizeTranslations : []).forEach((row) => {
    if (!translationMap.has(row?.prize_id)) translationMap.set(row?.prize_id, []);
    translationMap.get(row?.prize_id).push(row);
  });

  const visiblePrizes = (Array.isArray(prizes) ? prizes : []).slice().sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
  if (!visiblePrizes.length) {
    refs.prizes.innerHTML = `<p class="special-offer-empty">${escapeHtml(t.noPrize)}</p>`;
    return;
  }

  visiblePrizes.forEach((prize) => {
    const picked = pickTranslation(translationMap.get(prize.id) || [], lang).row || {};
    const name = cleanText(picked.name || (previewMode ? prize.name : ''));
    const description = cleanText(picked.description || (previewMode ? prize.description : ''));
    const restrictions = cleanText(picked.restrictions || (previewMode ? prize.restrictions : ''));
    const notes = cleanText(picked.fulfillment_notes || (previewMode ? prize.fulfillment_notes : ''));
    const card = document.createElement('article');
    card.className = 'special-offer-prize';
    if (lang === 'he') card.dir = 'rtl';
    const h3 = document.createElement('h3');
    h3.textContent = name || t.noPrize;
    card.appendChild(h3);
    [description, restrictions, notes].filter(Boolean).forEach((value) => {
      const p = document.createElement('p');
      p.textContent = value;
      card.appendChild(p);
    });
    refs.prizes.appendChild(card);
  });
}

function renderRules(translation, lang) {
  const t = getText(lang);
  const html = sanitizeHtml(translation?.rules_html);
  refs.rules.innerHTML = html || `<p class="special-offer-empty">${escapeHtml(t.noRules)}</p>`;
}

function renderFaq(translation, lang) {
  const t = getText(lang);
  refs.faq.replaceChildren();
  const items = parseFaq(translation?.faq_json);
  if (!items.length) {
    refs.faq.innerHTML = `<p class="special-offer-empty">${escapeHtml(t.noFaq)}</p>`;
    return;
  }
  items.forEach((item, index) => {
    const details = document.createElement('details');
    if (index === 0) details.open = true;
    if (lang === 'he') details.dir = 'rtl';
    const summary = document.createElement('summary');
    summary.textContent = item.question;
    const answer = document.createElement('p');
    answer.textContent = item.answer;
    details.append(summary, answer);
    refs.faq.appendChild(details);
  });
}

function renderLinks(links, linkTranslations, lang) {
  const t = getText(lang);
  refs.links.replaceChildren();
  const translationMap = new Map();
  (Array.isArray(linkTranslations) ? linkTranslations : []).forEach((row) => {
    if (!translationMap.has(row?.link_id)) translationMap.set(row?.link_id, []);
    translationMap.get(row?.link_id).push(row);
  });

  const visibleLinks = (Array.isArray(links) ? links : [])
    .filter((link) => link && link.is_active !== false)
    .slice()
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));

  visibleLinks.forEach((link) => {
    const picked = pickTranslation(translationMap.get(link.id) || [], lang).row || {};
    const url = cleanText(picked.url || link.url);
    const label = cleanText(picked.label || link.label || link.link_type);
    if (!url || !label || !isSafeHref(url)) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.textContent = label;
    anchor.dataset.primary = link.is_primary ? 'true' : 'false';
    if (/^https?:\/\//i.test(url)) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    refs.links.appendChild(anchor);
  });

  if (!refs.links.children.length) {
    refs.links.innerHTML = `<p class="special-offer-empty">${escapeHtml(t.noLinks)}</p>`;
  }
}

function getMetaDescription(translation) {
  return cleanText(translation?.seo_description || translation?.short_description || translation?.full_description).slice(0, 160);
}

function updateSeo(translation, campaign) {
  const title = cleanText(translation?.seo_title || translation?.title || campaign?.slug || 'Special Offer');
  document.title = `${title} • CyprusEye`;
  const description = getMetaDescription(translation);
  if (description) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
  }
}

function renderCampaign(data, requestedLang, previewMode) {
  const picked = pickTranslation(data.translations, requestedLang);
  const lang = normalizeLang(picked.lang);
  const translation = picked.row || {};
  const t = getText(lang);
  currentState = { data, lang, previewMode };
  setPageLanguage(lang);
  updateStaticText(lang);
  updateSeo(translation, data.campaign);
  setRobotsNoIndex(previewMode || data.campaign?.status !== PUBLIC_STATUS || data.campaign?.visibility !== PUBLIC_VISIBILITY);

  refs.loading.hidden = true;
  refs.unavailable.hidden = true;
  refs.content.hidden = false;

  setText(refs.modeLabel, previewMode ? t.previewMode : t.mode);
  setText(refs.title, translation.title || data.campaign?.slug || t.mode);
  setText(refs.short, translation.short_description);
  setParagraphs(refs.full, translation.full_description);
  renderDates(data.campaign, lang);
  renderPrizes(data.prizes, data.prizeTranslations, lang, previewMode);
  renderRules(translation, lang);
  renderFaq(translation, lang);
  renderLinks(data.links, data.linkTranslations, lang);
  renderEntryForm(data, lang);
}

async function fetchRows(table, filters = [], order = null) {
  let query = supabase.from(table).select('*');
  filters.forEach(([column, value, mode]) => {
    if (mode === 'in') {
      query = query.in(column, value);
    } else {
      query = query.eq(column, value);
    }
  });
  if (order) query = query.order(order, { ascending: true });
  const { data, error } = await query;
  if (error) {
    console.error(`Special Offer landing select failed for ${table}:`, error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function loadCampaign(slug, previewMode) {
  let previewAllowed = false;
  if (previewMode) {
    try {
      const { data } = await supabase.auth.getUser();
      previewAllowed = Boolean(data?.user?.id);
    } catch (_error) {
      previewAllowed = false;
    }
  }

  let query = supabase.from('special_offers').select('*').eq('slug', slug).limit(1);
  if (!previewAllowed) {
    query = query.eq('status', PUBLIC_STATUS).eq('visibility', PUBLIC_VISIBILITY);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    if (error) console.error('Special Offer landing campaign select failed:', error);
    return null;
  }
  if (!previewAllowed && (data.status !== PUBLIC_STATUS || data.visibility !== PUBLIC_VISIBILITY)) {
    return null;
  }

  const offerId = data.id;
  const [translations, prizes, links, formFields] = await Promise.all([
    fetchRows('special_offer_translations', [['offer_id', offerId]], 'lang'),
    fetchRows('special_offer_prizes', [['offer_id', offerId]], 'sort_order'),
    fetchRows('special_offer_links', [['offer_id', offerId]], 'sort_order'),
    data.requires_form === true ? fetchRows('special_offer_form_fields', [['offer_id', offerId], ['active', true]], 'sort_order') : Promise.resolve([]),
  ]);
  const prizeIds = prizes.map((row) => row.id).filter(Boolean);
  const linkIds = links.map((row) => row.id).filter(Boolean);
  const formFieldIds = formFields.map((row) => row.id).filter(Boolean);
  const [prizeTranslations, linkTranslations, formFieldTranslations] = await Promise.all([
    prizeIds.length ? fetchRows('special_offer_prize_translations', [['prize_id', prizeIds, 'in']], 'lang') : Promise.resolve([]),
    linkIds.length ? fetchRows('special_offer_link_translations', [['link_id', linkIds, 'in']], 'lang') : Promise.resolve([]),
    formFieldIds.length ? fetchRows('special_offer_form_field_translations', [['field_id', formFieldIds, 'in']], 'lang') : Promise.resolve([]),
  ]);

  return {
    campaign: data,
    translations,
    prizes,
    prizeTranslations,
    links,
    linkTranslations,
    formFields,
    formFieldTranslations,
    previewAllowed,
  };
}

function bindLanguageButtons() {
  refs.languageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextLang = normalizeLang(button.getAttribute('data-special-offer-lang'));
      const url = new URL(window.location.href);
      url.searchParams.set('lang', nextLang);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      if (currentState) {
        renderCampaign(currentState.data, nextLang, currentState.previewMode);
      } else {
        setPageLanguage(nextLang);
        updateStaticText(nextLang);
      }
    });
  });
}

async function init() {
  bindLanguageButtons();
  const lang = readRequestedLang();
  setPageLanguage(lang);
  updateStaticText(lang);
  showLoading();
  const slug = readSlug();
  if (!slug) {
    showUnavailable(lang);
    return;
  }

  try {
    const previewMode = isAdminPreview();
    const campaign = await loadCampaign(slug, previewMode);
    if (!campaign) {
      showUnavailable(lang);
      return;
    }
    renderCampaign(campaign, lang, Boolean(campaign.previewAllowed));
  } catch (error) {
    console.error('Special Offer landing failed:', error);
    showUnavailable(lang);
  }
}

init();
