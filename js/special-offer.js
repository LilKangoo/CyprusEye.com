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
    linkCta: 'Otwórz link',
    entryTitle: 'Formularz zgłoszeniowy',
    notConfigured: 'Formularz nie został jeszcze skonfigurowany.',
    noFormRequired: 'Ta kampania nie wymaga formularza zgłoszeniowego.',
    previewMessage: 'Podgląd formularza. Wysyłanie zgłoszeń nie jest jeszcze dostępne.',
    submitLabel: 'Wyślij zgłoszenie',
    submittingLabel: 'Wysyłanie...',
    authChecking: 'Sprawdzamy dostęp do formularza...',
    loginRequiredTitle: 'Zaloguj się, aby wysłać zgłoszenie',
    loginRequiredCopy: 'Strona kampanii jest publiczna, ale formularz jest dostępny tylko dla zalogowanych uczestników.',
    loginButton: 'Wypełnij formularz',
    emailNotConfirmedTitle: 'Potwierdź adres e-mail',
    emailNotConfirmedCopy: 'Formularz odblokuje się po potwierdzeniu adresu e-mail konta. Sprawdź skrzynkę i wróć na tę stronę.',
    refreshAccess: 'Sprawdziłem e-mail / Odśwież dostęp',
    authUnavailable: 'Logowanie nie jest teraz dostępne na tej stronie. Spróbuj ponownie za chwilę.',
    formErrorTitle: 'Sprawdź pola formularza',
    accountEmailHint: 'Zgłoszenie zostanie przypisane do zalogowanego konta.',
    successTitle: 'Zgłoszenie zapisane',
    successReference: 'Numer zgłoszenia',
    successStatus: 'Status',
    pendingReview: 'Zgłoszenie zostało zapisane i oczekuje na ręczną weryfikację.',
    submittedSuccess: 'Zgłoszenie zostało zapisane.',
    retry: 'Spróbuj ponownie',
    errors: {
      login_required: 'Zaloguj się, aby wysłać zgłoszenie.',
      email_not_confirmed: 'Potwierdź adres e-mail przed wysłaniem zgłoszenia.',
      authenticated_email_missing: 'Nie udało się potwierdzić adresu e-mail konta. Zaloguj się ponownie.',
      campaign_not_available: 'Ta kampania nie jest obecnie dostępna.',
      campaign_not_open: 'Kampania jeszcze się nie rozpoczęła.',
      campaign_closed: 'Kampania została zakończona.',
      form_not_configured: 'Formularz nie został jeszcze skonfigurowany.',
      required_field_missing: 'Uzupełnij wymagane pole.',
      invalid_email_field: 'Podaj poprawny adres e-mail.',
      invalid_phone_field: 'Podaj poprawny numer telefonu z kierunkowym.',
      invalid_url_field: 'Podaj poprawny link zaczynający się od http:// lub https://.',
      min_age_field: 'Nie spełniasz minimalnego wieku wymaganego w tej kampanii.',
      must_be_true_field: 'Ta zgoda jest wymagana.',
      invalid_option: 'Wybierz jedną z dostępnych opcji.',
      duplicate_entry: 'Masz już zapisane zgłoszenie w tej kampanii.',
      max_entries_reached: 'Osiągnięto maksymalną liczbę zgłoszeń dla tej kampanii.',
      admin_entries_blocked: 'Konta administracyjne nie mogą wysyłać zgłoszeń w tej kampanii.',
      partner_entries_blocked: 'Konta partnerów nie mogą wysyłać zgłoszeń w tej kampanii.',
      submission_not_accepted: 'Nie można przyjąć tego zgłoszenia. Odśwież stronę i spróbuj ponownie.',
      network_error: 'Problem z połączeniem. Spróbuj ponownie.',
      temporary_error: 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.',
    },
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
    linkCta: 'Open link',
    entryTitle: 'Entry form',
    notConfigured: 'The entry form has not been configured yet.',
    noFormRequired: 'This campaign does not require an entry form.',
    previewMessage: 'Form preview. Entry submission is not available yet.',
    submitLabel: 'Submit entry',
    submittingLabel: 'Submitting...',
    authChecking: 'Checking form access...',
    loginRequiredTitle: 'Sign in to submit your entry',
    loginRequiredCopy: 'The campaign page is public, but the entry form is available only to signed-in participants.',
    loginButton: 'Fill in the form',
    emailNotConfirmedTitle: 'Confirm your email address',
    emailNotConfirmedCopy: 'The form will unlock after your account email is confirmed. Check your inbox and return to this page.',
    refreshAccess: 'I confirmed my email / Refresh access',
    authUnavailable: 'Sign-in is not available on this page right now. Please try again shortly.',
    formErrorTitle: 'Check the form fields',
    accountEmailHint: 'Your entry will be linked to the signed-in account.',
    successTitle: 'Entry saved',
    successReference: 'Entry reference',
    successStatus: 'Status',
    pendingReview: 'Your entry has been saved and is awaiting manual review.',
    submittedSuccess: 'Your entry has been saved.',
    retry: 'Try again',
    errors: {
      login_required: 'Please sign in to submit your entry.',
      email_not_confirmed: 'Confirm your email address before submitting your entry.',
      authenticated_email_missing: 'Could not confirm your account email. Please sign in again.',
      campaign_not_available: 'This campaign is not available right now.',
      campaign_not_open: 'This campaign has not started yet.',
      campaign_closed: 'This campaign has ended.',
      form_not_configured: 'The entry form has not been configured yet.',
      required_field_missing: 'Complete this required field.',
      invalid_email_field: 'Enter a valid email address.',
      invalid_phone_field: 'Enter a valid phone number with country code.',
      invalid_url_field: 'Enter a valid link starting with http:// or https://.',
      min_age_field: 'You do not meet the minimum age required for this campaign.',
      must_be_true_field: 'This consent is required.',
      invalid_option: 'Choose one of the available options.',
      duplicate_entry: 'You already have an entry for this campaign.',
      max_entries_reached: 'The maximum number of entries for this campaign has been reached.',
      admin_entries_blocked: 'Admin accounts cannot submit entries for this campaign.',
      partner_entries_blocked: 'Partner accounts cannot submit entries for this campaign.',
      submission_not_accepted: 'This entry could not be accepted. Refresh the page and try again.',
      network_error: 'Connection problem. Please try again.',
      temporary_error: 'Your entry could not be submitted. Please try again shortly.',
    },
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
    linkCta: 'פתיחת הקישור',
    entryTitle: 'טופס הרשמה',
    notConfigured: 'טופס ההרשמה עדיין לא הוגדר.',
    noFormRequired: 'הקמפיין הזה אינו דורש טופס הרשמה.',
    previewMessage: 'תצוגה מקדימה של הטופס. שליחת הרשמות עדיין אינה זמינה.',
    submitLabel: 'שליחת הרשמה',
    submittingLabel: 'שולחים...',
    authChecking: 'בודקים גישה לטופס...',
    loginRequiredTitle: 'התחברו כדי לשלוח הרשמה',
    loginRequiredCopy: 'עמוד הקמפיין פתוח לכולם, אך הטופס זמין רק למשתתפים מחוברים.',
    loginButton: 'מילוי הטופס',
    emailNotConfirmedTitle: 'אשרו את כתובת האימייל',
    emailNotConfirmedCopy: 'הטופס ייפתח לאחר אישור כתובת האימייל של החשבון. בדקו את תיבת הדואר וחזרו לעמוד הזה.',
    refreshAccess: 'אישרתי אימייל / רענון גישה',
    authUnavailable: 'ההתחברות אינה זמינה כרגע בעמוד זה. נסו שוב בעוד רגע.',
    formErrorTitle: 'בדקו את שדות הטופס',
    accountEmailHint: 'ההרשמה תשויך לחשבון המחובר.',
    successTitle: 'ההרשמה נשמרה',
    successReference: 'מספר הרשמה',
    successStatus: 'סטטוס',
    pendingReview: 'ההרשמה נשמרה וממתינה לבדיקה ידנית.',
    submittedSuccess: 'ההרשמה נשמרה.',
    retry: 'נסו שוב',
    errors: {
      login_required: 'יש להתחבר כדי לשלוח הרשמה.',
      email_not_confirmed: 'יש לאשר את כתובת האימייל לפני שליחת הרשמה.',
      authenticated_email_missing: 'לא ניתן לאשר את כתובת האימייל של החשבון. התחברו שוב.',
      campaign_not_available: 'הקמפיין אינו זמין כרגע.',
      campaign_not_open: 'הקמפיין עדיין לא התחיל.',
      campaign_closed: 'הקמפיין הסתיים.',
      form_not_configured: 'טופס ההרשמה עדיין לא הוגדר.',
      required_field_missing: 'יש למלא שדה חובה זה.',
      invalid_email_field: 'הזינו כתובת אימייל תקינה.',
      invalid_phone_field: 'הזינו מספר טלפון תקין עם קידומת מדינה.',
      invalid_url_field: 'הזינו קישור תקין שמתחיל ב-http:// או https://.',
      min_age_field: 'אינכם עומדים בגיל המינימלי הנדרש לקמפיין זה.',
      must_be_true_field: 'נדרשת הסכמה זו.',
      invalid_option: 'בחרו אחת מהאפשרויות הזמינות.',
      duplicate_entry: 'כבר קיימת הרשמה שלכם לקמפיין זה.',
      max_entries_reached: 'הגעתם למספר ההרשמות המקסימלי לקמפיין זה.',
      admin_entries_blocked: 'חשבונות מנהלים אינם יכולים לשלוח הרשמות לקמפיין זה.',
      partner_entries_blocked: 'חשבונות שותפים אינם יכולים לשלוח הרשמות לקמפיין זה.',
      submission_not_accepted: 'לא ניתן לקבל את ההרשמה הזו. רעננו את העמוד ונסו שוב.',
      network_error: 'בעיה בחיבור. נסו שוב.',
      temporary_error: 'לא ניתן היה לשלוח את ההרשמה. נסו שוב בעוד רגע.',
    },
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
let currentSlug = '';
let submitting = false;
let formStatus = 'idle';
let formDraft = {};
let lastValidationErrors = [];
let activeSubmitErrorCode = '';
let authState = {
  checking: true,
  session: null,
  user: null,
  confirmed: false,
};
let authRefreshPromise = null;

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

function getSafeCurrentAuthRedirect() {
  try {
    const url = new URL(window.location.href);
    const allowedPath = url.pathname === '/special-offer.html'
      || /^\/special-offers\/[A-Za-z0-9][A-Za-z0-9_-]*(?:\/)?$/.test(url.pathname);
    if (!allowedPath) return '/';
    ['access_token', 'token', 'refresh_token', 'expires_in', 'expires_at', 'token_hash', 'type', 'code', 'error', 'error_description', 'provider_token', 'provider_refresh_token', 'state'].forEach((key) => {
      url.searchParams.delete(key);
    });
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (_error) {
    return '/';
  }
}

function configureAuthRedirectTarget() {
  const redirect = getSafeCurrentAuthRedirect();
  document.documentElement.dataset.authRedirect = redirect;
  document.body.dataset.authRedirect = redirect;
  let meta = document.querySelector('meta[name="ce-auth-redirect"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'ce-auth-redirect');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', redirect);
  document.querySelectorAll('#form-login, #form-register').forEach((form) => {
    if (form instanceof HTMLFormElement) {
      form.dataset.authRedirect = redirect;
    }
  });
}

function isConfirmedAuthUser(user) {
  if (!user?.id) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at || user.app_metadata?.email_confirmed_at);
}

async function refreshSpecialOfferAuthState() {
  if (authRefreshPromise) return authRefreshPromise;
  authRefreshPromise = (async () => {
    authState = { ...authState, checking: true };
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session || null;
    } catch (_error) {
      session = window.CE_STATE?.session || null;
    }
    const user = session?.user || window.CE_STATE?.session?.user || null;
    authState = {
      checking: false,
      session: session || null,
      user: user || null,
      confirmed: isConfirmedAuthUser(user),
    };
    return authState;
  })().finally(() => {
    authRefreshPromise = null;
  });
  return authRefreshPromise;
}

function rerenderEntryFormIfPossible({ scroll = false } = {}) {
  if (!currentState?.data) return;
  renderEntryForm(currentState.data, currentState.lang);
  if (scroll && refs.entrySection) {
    refs.entrySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  return /^https?:\/\//i.test(href);
}

function isSafeImageSrc(value) {
  if (value === null || value === undefined) return false;
  const source = String(value);
  if (!source || source.length > 2048) return false;
  if (/[ \t\r\n\f\v\u0000-\u001F\u007F]/.test(source)) return false;
  return /^https:\/\/[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?(?:[/?#][^\s\u0000-\u001F\u007F]*)?$/i.test(source)
    || /^\/[^/\s\u0000-\u001F\u007F?#][^\s\u0000-\u001F\u007F]*$/.test(source);
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

function getActiveFields(data = currentState?.data) {
  return (Array.isArray(data?.formFields) ? data.formFields : [])
    .filter((field) => field?.active === true)
    .slice()
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
}

function getActiveFieldMap(data = currentState?.data) {
  const map = new Map();
  getActiveFields(data).forEach((field) => {
    const key = cleanText(field?.field_key);
    if (key) map.set(key, field);
  });
  return map;
}

function getFormElement() {
  return refs.entrySection?.querySelector('[data-special-offer-entry-form]') || null;
}

function getFieldWrapper(fieldKey) {
  if (!refs.entrySection) return null;
  const selector = `[data-special-offer-form-field="${CSS.escape(fieldKey)}"]`;
  return refs.entrySection.querySelector(selector);
}

function getFieldInputs(form, fieldKey) {
  if (!(form instanceof HTMLFormElement)) return [];
  return Array.from(form.elements).filter((element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      return false;
    }
    return element.name === fieldKey;
  });
}

function getFieldValue(form, field) {
  const key = cleanText(field?.field_key);
  const type = cleanText(field?.field_type);
  const inputs = getFieldInputs(form, key);
  if (!inputs.length) return type === 'checkbox_group' ? [] : type === 'checkbox' || type === 'consent' ? false : '';

  if (type === 'checkbox_group') {
    return inputs
      .filter((input) => input instanceof HTMLInputElement && input.checked)
      .map((input) => input.value);
  }
  if (type === 'checkbox' || type === 'consent') {
    const input = inputs.find((item) => item instanceof HTMLInputElement);
    return input instanceof HTMLInputElement ? input.checked : false;
  }
  const input = inputs[0];
  if (type === 'phone' && input instanceof HTMLInputElement && input.__cePhoneInputController?.sync) {
    input.__cePhoneInputController.sync();
  }
  return cleanText(input.value);
}

function setFieldValue(form, field, value) {
  const key = cleanText(field?.field_key);
  const type = cleanText(field?.field_type);
  const inputs = getFieldInputs(form, key);
  if (!inputs.length) return;

  if (type === 'checkbox_group') {
    const values = Array.isArray(value) ? value.map(String) : [];
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement) input.checked = values.includes(input.value);
    });
    return;
  }
  if (type === 'checkbox' || type === 'consent') {
    const input = inputs.find((item) => item instanceof HTMLInputElement);
    if (input instanceof HTMLInputElement) input.checked = value === true;
    return;
  }
  const input = inputs[0];
  if (input instanceof HTMLInputElement && type === 'phone' && input.__cePhoneInputController?.setFullNumber) {
    input.__cePhoneInputController.setFullNumber(cleanText(value));
  } else {
    input.value = cleanText(value);
  }
}

function saveCurrentFormDraft() {
  const form = getFormElement();
  if (!(form instanceof HTMLFormElement) || !currentState?.data) return;
  const nextDraft = { ...formDraft };
  getActiveFields(currentState.data).forEach((field) => {
    const key = cleanText(field?.field_key);
    if (!key) return;
    nextDraft[key] = getFieldValue(form, field);
  });
  formDraft = nextDraft;
}

function restoreFormDraft() {
  const form = getFormElement();
  if (!(form instanceof HTMLFormElement) || !currentState?.data) return;
  getActiveFields(currentState.data).forEach((field) => {
    const key = cleanText(field?.field_key);
    if (!key || !(key in formDraft)) return;
    setFieldValue(form, field, formDraft[key]);
  });
}

function clearFieldErrors() {
  refs.entrySection?.querySelectorAll('.special-offer-form-field--error').forEach((node) => {
    node.classList.remove('special-offer-form-field--error');
  });
  refs.entrySection?.querySelectorAll('[data-special-offer-field-error]').forEach((node) => node.remove());
  refs.entrySection?.querySelector('[data-special-offer-error-summary]')?.remove();
}

function getErrorMessage(code, lang) {
  const t = getText(lang);
  return t.errors?.[code] || t.errors?.temporary_error || TEXT.en.errors.temporary_error;
}

function showFormStatus(message, tone = 'info') {
  const node = refs.entrySection?.querySelector('[data-special-offer-form-status]');
  if (!(node instanceof HTMLElement)) return;
  node.textContent = message || '';
  node.dataset.tone = tone;
}

function showValidationErrors(errors, lang) {
  clearFieldErrors();
  lastValidationErrors = errors;
  if (!errors.length) return;

  const t = getText(lang);
  const summary = document.createElement('div');
  summary.className = 'special-offer-form-error-summary';
  summary.dataset.specialOfferErrorSummary = 'true';
  summary.setAttribute('role', 'alert');
  summary.setAttribute('tabindex', '-1');
  summary.dir = lang === 'he' ? 'rtl' : 'ltr';
  summary.innerHTML = `
    <strong>${escapeHtml(t.formErrorTitle)}</strong>
    <ul>${errors.map((error) => `<li>${escapeHtml(error.label || error.fieldKey)}: ${escapeHtml(error.message)}</li>`).join('')}</ul>
  `;
  const form = getFormElement();
  const grid = form?.querySelector('.special-offer-form-grid');
  if (form && grid) form.insertBefore(summary, grid);

  errors.forEach((error) => {
    const wrapper = getFieldWrapper(error.fieldKey);
    if (!(wrapper instanceof HTMLElement)) return;
    wrapper.classList.add('special-offer-form-field--error');
    const errorNode = document.createElement('p');
    errorNode.className = 'special-offer-form-error';
    errorNode.dataset.specialOfferFieldError = 'true';
    errorNode.textContent = error.message;
    wrapper.appendChild(errorNode);
  });

  const firstWrapper = getFieldWrapper(errors[0]?.fieldKey);
  const focusTarget = firstWrapper?.querySelector('input, textarea, select, button');
  if (focusTarget instanceof HTMLElement) {
    focusTarget.focus({ preventScroll: true });
    firstWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function bindValidationClearHandlers(form) {
  if (!(form instanceof HTMLFormElement)) return;
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    const key = target.name;
    const wrapper = key ? getFieldWrapper(key) : null;
    wrapper?.classList.remove('special-offer-form-field--error');
    wrapper?.querySelectorAll('[data-special-offer-field-error]').forEach((node) => node.remove());
  });
  form.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    const key = target.name;
    const wrapper = key ? getFieldWrapper(key) : null;
    wrapper?.classList.remove('special-offer-form-field--error');
    wrapper?.querySelectorAll('[data-special-offer-field-error]').forEach((node) => node.remove());
  });
}

function validateFieldValue(field, value, translation, lang) {
  const validation = parseJsonObject(field?.validation_json);
  const type = cleanText(field?.field_type) || 'text';
  const required = field?.required === true;
  const label = translation?.label || cleanText(field?.field_key) || getText(lang).genericField;
  const options = normalizeOptions(translation?.options_json);
  const allowedValues = new Set(options.map((option) => option.value).filter(Boolean));
  const stringValue = typeof value === 'string' ? value.trim() : '';
  const missing = type === 'checkbox_group'
    ? !Array.isArray(value) || value.length === 0
    : type === 'checkbox' || type === 'consent'
      ? value !== true
      : stringValue === '';

  if (required && missing) return { code: type === 'consent' ? 'must_be_true_field' : 'required_field_missing', label };
  if (!required && missing) return null;

  if (type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(stringValue)) return { code: 'invalid_email_field', label };
  if (['url', 'facebook_profile_url', 'shared_post_url'].includes(type) && !/^https?:\/\/[^\s]+$/i.test(stringValue)) return { code: 'invalid_url_field', label };
  if (type === 'phone' && !/^\+[1-9][0-9]{0,3}\s+[0-9][0-9\s().-]{3,39}$/.test(stringValue)) return { code: 'invalid_phone_field', label };
  if (type === 'date_of_birth') {
    const date = new Date(`${stringValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return { code: 'invalid_field', label };
    const minAge = Number(validation.min_age);
    if (Number.isFinite(minAge) && minAge >= 0) {
      const maxDate = getMaxDateForMinAge(minAge);
      if (maxDate && stringValue > maxDate) return { code: 'min_age_field', label };
    }
  }
  if (validation.must_be_true === true && value !== true) return { code: 'must_be_true_field', label };
  if (Number.isFinite(Number(validation.min_length)) && stringValue.length < Number(validation.min_length)) return { code: 'required_field_missing', label };
  if (Number.isFinite(Number(validation.max_length)) && stringValue.length > Number(validation.max_length)) return { code: 'temporary_error', label };
  if (type === 'select' && !allowedValues.has(stringValue)) return { code: 'invalid_option', label };
  if (type === 'checkbox_group') {
    if (!Array.isArray(value)) return { code: 'invalid_option', label };
    if (value.some((item) => !allowedValues.has(String(item)))) return { code: 'invalid_option', label };
  }
  return null;
}

function collectSpecialOfferAnswers() {
  const form = getFormElement();
  const data = currentState?.data;
  const lang = currentState?.lang || readRequestedLang();
  if (!(form instanceof HTMLFormElement) || !data) return { answers: {}, errors: [] };
  const translationsByField = new Map();
  (Array.isArray(data.formFieldTranslations) ? data.formFieldTranslations : []).forEach((row) => {
    if (!row?.field_id) return;
    if (!translationsByField.has(row.field_id)) translationsByField.set(row.field_id, []);
    translationsByField.get(row.field_id).push(row);
  });
  const answers = {};
  const errors = [];
  getActiveFields(data).forEach((field) => {
    const key = cleanText(field?.field_key);
    if (!key) return;
    const translation = getFieldTranslation(field, translationsByField, lang);
    const value = getFieldValue(form, field);
    const error = validateFieldValue(field, value, translation, lang);
    if (error) {
      errors.push({
        fieldKey: key,
        label: error.label,
        code: error.code,
        message: getErrorMessage(error.code, lang),
      });
      return;
    }
    const type = cleanText(field?.field_type);
    const isEmptyOptional = field?.required !== true
      && type !== 'checkbox'
      && type !== 'consent'
      && type !== 'checkbox_group'
      && cleanText(value) === '';
    if (isEmptyOptional) return;
    answers[key] = value;
  });
  return { answers, errors };
}

function getSubmissionStorageKey() {
  return `ce_special_offer_submission_id:${currentSlug || readSlug() || 'unknown'}`;
}

function createUuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getSubmissionId() {
  const key = getSubmissionStorageKey();
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const next = createUuid();
    sessionStorage.setItem(key, next);
    return next;
  } catch (_error) {
    return createUuid();
  }
}

function clearSubmissionId() {
  try {
    sessionStorage.removeItem(getSubmissionStorageKey());
  } catch (_error) {
    // ignore storage errors
  }
}

async function getCurrentSession() {
  if (authState?.session?.user?.id) return authState.session;
  const cached = window.CE_STATE?.session || null;
  if (cached?.user?.id) return cached;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch (_error) {
    return null;
  }
}

function openAuthGate(lang, code = 'login_required') {
  saveCurrentFormDraft();
  configureAuthRedirectTarget();
  formStatus = 'login_required';
  activeSubmitErrorCode = code;
  showFormStatus(getErrorMessage(code, lang), 'warning');
  const opened = (() => {
    try {
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
        return true;
      }
      const controller = window.__authModalController;
      if (controller && typeof controller.open === 'function') {
        controller.setActiveTab?.('login', { focus: false });
        controller.open('login');
        return true;
      }
    } catch (error) {
      console.warn('Special Offer auth modal failed:', error);
    }
    return false;
  })();
  if (!opened) {
    showFormStatus(getText(lang).authUnavailable, 'error');
  }
}

function setSubmitButtonState(state, lang) {
  const button = refs.entrySection?.querySelector('[data-special-offer-submit]');
  if (!(button instanceof HTMLButtonElement)) return;
  const t = getText(lang);
  const disabled = state === 'submitting' || state === 'validating' || currentState?.previewMode;
  button.disabled = disabled;
  button.textContent = state === 'submitting' ? t.submittingLabel : t.submitLabel;
  button.setAttribute('aria-busy', state === 'submitting' ? 'true' : 'false');
}

function mapSubmitError(error) {
  const raw = cleanText(error?.message || error?.details || error?.hint || error?.code || error);
  if (!raw) return 'temporary_error';
  const normalized = raw.toLowerCase();
  const known = [
    'login_required',
    'email_not_confirmed',
    'authenticated_email_missing',
    'campaign_not_available',
    'campaign_not_open',
    'campaign_closed',
    'form_not_configured',
    'required_field_missing',
    'invalid_email_field',
    'invalid_phone_field',
    'invalid_url_field',
    'min_age_field',
    'must_be_true_field',
    'invalid_option',
    'duplicate_entry',
    'max_entries_reached',
    'admin_entries_blocked',
    'partner_entries_blocked',
    'submission_not_accepted',
  ];
  for (const code of known) {
    if (normalized.includes(code)) return code;
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) return 'network_error';
  return 'temporary_error';
}

function showSuccessState(result, lang) {
  const t = getText(lang);
  const payload = Array.isArray(result) ? result[0] : result;
  const status = cleanText(payload?.status || 'submitted');
  const reference = cleanText(payload?.reference || '');
  refs.entrySection.innerHTML = `
    <div class="special-offer-form-success" data-special-offer-success dir="${lang === 'he' ? 'rtl' : 'ltr'}" role="status">
      <h2>${escapeHtml(t.successTitle)}</h2>
      ${reference ? `<p><strong>${escapeHtml(t.successReference)}:</strong> ${escapeHtml(reference)}</p>` : ''}
      <p><strong>${escapeHtml(t.successStatus)}:</strong> ${escapeHtml(status)}</p>
      <p>${escapeHtml(status === 'pending_review' ? t.pendingReview : t.submittedSuccess)}</p>
    </div>
  `;
}

async function applyAuthenticatedEmailToForm() {
  const form = getFormElement();
  if (!(form instanceof HTMLFormElement)) return;
  const fieldMap = getActiveFieldMap();
  if (!fieldMap.has('email')) return;
  const session = await getCurrentSession();
  const email = cleanText(session?.user?.email);
  const input = form.elements.namedItem('email');
  const wrapper = getFieldWrapper('email');
  wrapper?.querySelector('[data-special-offer-account-email-hint]')?.remove();
  if (input instanceof HTMLInputElement && email) {
    input.value = email;
    input.readOnly = true;
    formDraft.email = email;
    const hint = document.createElement('p');
    hint.className = 'special-offer-form-help special-offer-form-account-hint';
    hint.dataset.specialOfferAccountEmailHint = 'true';
    hint.textContent = getText(currentState?.lang || readRequestedLang()).accountEmailHint;
    wrapper?.appendChild(hint);
  } else if (input instanceof HTMLInputElement) {
    input.readOnly = false;
  }
}

async function handleEntrySubmit(event) {
  event?.preventDefault();
  const state = currentState;
  const lang = state?.lang || readRequestedLang();
  const data = state?.data;
  if (!state || !data || submitting) return;
  if (state.previewMode) return;
  if (data.campaign?.status !== PUBLIC_STATUS || data.campaign?.visibility !== PUBLIC_VISIBILITY) return;
  if (data.campaign?.requires_form !== true || !getActiveFields(data).length) return;

  submitting = true;
  saveCurrentFormDraft();
  clearFieldErrors();
  formStatus = 'validating';
  setSubmitButtonState('validating', lang);

  await refreshSpecialOfferAuthState();
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    submitting = false;
    setSubmitButtonState('idle', lang);
    openAuthGate(lang);
    return;
  }
  if (!isConfirmedAuthUser(session.user)) {
    submitting = false;
    formStatus = 'login_required';
    activeSubmitErrorCode = 'email_not_confirmed';
    setSubmitButtonState('idle', lang);
    showFormStatus(getErrorMessage('email_not_confirmed', lang), 'warning');
    openAuthGate(lang, 'email_not_confirmed');
    return;
  }

  await applyAuthenticatedEmailToForm();
  saveCurrentFormDraft();
  const { answers, errors } = collectSpecialOfferAnswers();
  if (errors.length) {
    submitting = false;
    formStatus = 'non_retryable_error';
    setSubmitButtonState('idle', lang);
    showValidationErrors(errors, lang);
    showFormStatus(getText(lang).formErrorTitle, 'error');
    return;
  }

  const submissionId = getSubmissionId();
  formStatus = 'submitting';
  setSubmitButtonState('submitting', lang);
  showFormStatus('', 'info');
  try {
    const { data: result, error } = await supabase.rpc('submit_special_offer_entry', {
      p_offer_slug: currentSlug,
      p_lang: lang,
      p_answers: answers,
      p_client_submission_id: submissionId,
    });
    if (error) throw error;
    clearSubmissionId();
    formDraft = {};
    activeSubmitErrorCode = '';
    formStatus = 'success';
    showSuccessState(result, lang);
  } catch (error) {
    console.warn('Special Offer entry submit failed:', error);
    const code = mapSubmitError(error);
    activeSubmitErrorCode = code;
    const retryable = code === 'network_error' || code === 'temporary_error';
    formStatus = retryable ? 'retryable_error' : 'non_retryable_error';
    showFormStatus(getErrorMessage(code, lang), retryable ? 'warning' : 'error');
  } finally {
    submitting = false;
    if (formStatus !== 'success') setSubmitButtonState('idle', lang);
  }
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

function renderLockedFormState(lang, state) {
  const t = getText(lang);
  const isEmailConfirmation = state === 'email_not_confirmed';
  const title = state === 'checking'
    ? t.authChecking
    : isEmailConfirmation
      ? t.emailNotConfirmedTitle
      : t.loginRequiredTitle;
  const copy = state === 'checking'
    ? ''
    : isEmailConfirmation
      ? t.emailNotConfirmedCopy
      : t.loginRequiredCopy;
  const buttonLabel = isEmailConfirmation ? t.refreshAccess : t.loginButton;
  refs.entrySection.innerHTML = `
    <h2>${escapeHtml(t.entryTitle)}</h2>
    <div class="special-offer-form-locked" data-special-offer-form-locked dir="${lang === 'he' ? 'rtl' : 'ltr'}">
      <h3>${escapeHtml(title)}</h3>
      ${copy ? `<p>${escapeHtml(copy)}</p>` : ''}
      ${state === 'checking' ? `<p class="special-offer-form-help">${escapeHtml(t.authChecking)}</p>` : `
        <button type="button" class="special-offer-button" data-special-offer-auth-open>${escapeHtml(buttonLabel)}</button>
      `}
    </div>
  `;
  const button = refs.entrySection.querySelector('[data-special-offer-auth-open]');
  if (button instanceof HTMLButtonElement) {
    button.addEventListener('click', async () => {
      if (isEmailConfirmation) {
        await refreshSpecialOfferAuthState();
        if (authState.confirmed) {
          activeSubmitErrorCode = '';
          formStatus = 'idle';
          rerenderEntryFormIfPossible({ scroll: true });
          return;
        }
      }
      openAuthGate(lang, isEmailConfirmation ? 'email_not_confirmed' : 'login_required');
    });
  }
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

  const previewMode = currentState?.previewMode === true;
  const canSubmit = !previewMode
    && data.campaign?.status === PUBLIC_STATUS
    && data.campaign?.visibility === PUBLIC_VISIBILITY;
  if (canSubmit) {
    if (authState.checking) {
      renderLockedFormState(lang, 'checking');
      return;
    }
    if (!authState.user?.id) {
      renderLockedFormState(lang, 'login_required');
      return;
    }
    if (!authState.confirmed) {
      renderLockedFormState(lang, 'email_not_confirmed');
      return;
    }
  }
  const statusMessage = previewMode ? t.previewMessage : activeSubmitErrorCode ? getErrorMessage(activeSubmitErrorCode, lang) : '';

  refs.entrySection.innerHTML = `
    <h2>${escapeHtml(t.entryTitle)}</h2>
    <form class="special-offer-entry-form" data-special-offer-entry-form aria-describedby="specialOfferFormPreviewNotice" novalidate>
      <div class="special-offer-form-status" data-special-offer-form-status role="status" aria-live="polite" data-tone="${activeSubmitErrorCode ? 'error' : 'info'}">${escapeHtml(statusMessage)}</div>
      <div class="special-offer-form-grid">
        ${activeFields.map((field, index) => renderFormField(field, translationsByField, lang, index)).join('')}
      </div>
      <div class="special-offer-form-submit">
        <p id="specialOfferFormPreviewNotice">${escapeHtml(previewMode ? t.previewMessage : '')}</p>
        <button class="special-offer-button" type="${canSubmit ? 'submit' : 'button'}" ${canSubmit ? '' : 'disabled'} data-special-offer-submit>${escapeHtml(t.submitLabel)}</button>
      </div>
    </form>
  `;
  const form = refs.entrySection.querySelector('[data-special-offer-entry-form]');
  if (form) {
    form.addEventListener('submit', handleEntrySubmit);
    bindValidationClearHandlers(form);
  }
  enhanceFormPhoneInputs(lang);
  restoreFormDraft();
  void applyAuthenticatedEmailToForm();
  setSubmitButtonState(formStatus, lang);
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
    const description = cleanText(picked.description || link.description);
    const imageUrl = String(link.image_url || '');
    if (!url || !label || !isSafeHref(url)) return;
    const card = document.createElement('article');
    card.className = 'special-offer-link-card';
    card.dataset.primary = link.is_primary ? 'true' : 'false';
    card.dir = lang === 'he' ? 'rtl' : 'ltr';

    if (isSafeImageSrc(imageUrl)) {
      const media = document.createElement('div');
      media.className = 'special-offer-link-card__media';
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = label;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        media.remove();
        card.classList.add('special-offer-link-card--no-image');
      }, { once: true });
      media.appendChild(image);
      card.appendChild(media);
    } else {
      card.classList.add('special-offer-link-card--no-image');
    }

    const body = document.createElement('div');
    body.className = 'special-offer-link-card__body';
    const title = document.createElement('h3');
    title.textContent = label;
    body.appendChild(title);
    if (description) {
      const copy = document.createElement('p');
      copy.textContent = description;
      body.appendChild(copy);
    }
    const anchor = document.createElement('a');
    anchor.className = 'special-offer-link-card__cta';
    anchor.href = url;
    anchor.textContent = t.linkCta;
    anchor.setAttribute('aria-label', label);
    if (/^https?:\/\//i.test(url)) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    body.appendChild(anchor);
    card.appendChild(body);
    refs.links.appendChild(card);
  });

  if (!refs.links.children.length) {
    const empty = document.createElement('p');
    empty.className = 'special-offer-empty';
    empty.textContent = t.noLinks;
    refs.links.appendChild(empty);
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
      saveCurrentFormDraft();
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

function bindAuthEvents() {
  const refreshAndRender = async ({ scroll = false } = {}) => {
    saveCurrentFormDraft();
    await refreshSpecialOfferAuthState();
    activeSubmitErrorCode = '';
    formStatus = 'idle';
    rerenderEntryFormIfPossible({ scroll: scroll || authState.confirmed });
    await applyAuthenticatedEmailToForm();
    showFormStatus('', 'info');
    setSubmitButtonState('idle', currentState?.lang || readRequestedLang());
  };
  document.addEventListener('ce-auth:post-login', () => {
    window.__authModalController?.close?.({ restoreFocus: false });
    void refreshAndRender({ scroll: true });
  });
  document.addEventListener('ce-auth:state', () => {
    void refreshAndRender();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refreshAndRender();
  });
  window.addEventListener('focus', () => {
    void refreshAndRender();
  });
}

async function init() {
  bindLanguageButtons();
  bindAuthEvents();
  configureAuthRedirectTarget();
  const lang = readRequestedLang();
  setPageLanguage(lang);
  updateStaticText(lang);
  showLoading();
  const slug = readSlug();
  currentSlug = slug;
  if (!slug) {
    showUnavailable(lang);
    return;
  }

  try {
    await refreshSpecialOfferAuthState();
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
