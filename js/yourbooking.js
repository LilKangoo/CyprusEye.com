import { SUPABASE_CONFIG } from './config.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    multiTab: true,
  },
});

const DICT = {
  en: {
    pageTitle: 'Your booking | CyprusEye.com',
    loadingTitle: 'Checking booking link...',
    loadingMessage: 'Please wait a moment.',
    unavailableTitle: 'Booking link unavailable',
    unavailableMessage: 'This booking link is invalid, expired or no longer available. Contact us if you need help with your reservation.',
    eyebrow: 'Booking preview',
    subtitlePublic: 'This secure link shows one booking only. Log in with the same email address to see more details.',
    subtitleOwner: 'You are viewing the owner version for this booking.',
    contact: 'Contact us',
    login: 'Log in to see more',
    allBookings: 'View all bookings',
    authTitle: 'Log in',
    authCopy: 'Use the email address from this booking to see more details.',
    authEmail: 'Email',
    authPassword: 'Password',
    authSubmit: 'Log in',
    authClose: 'Close',
    authSigningIn: 'Signing in...',
    authSuccess: 'Signed in. Refreshing booking details...',
    authError: 'We could not sign you in. Check the email and password, then try again.',
    moneyTitle: 'Payment summary',
    paid: 'Paid',
    total: 'Total',
    remaining: 'Remaining',
    privacyPublic: 'For privacy, phone, email and internal notes are hidden in public preview.',
    privacyOwner: 'Full contact details are visible because your account email matches this booking.',
    detailsTitle: 'Booking details',
    reference: 'Booking reference',
    serviceType: 'Service type',
    status: 'Status',
    paymentStatus: 'Payment status',
    date: 'Date',
    time: 'Time',
    returnDate: 'Return date',
    location: 'Route / location',
    pickup: 'Pickup',
    dropoff: 'Drop-off',
    customer: 'Customer',
    email: 'Email',
    phone: 'Phone',
    notes: 'Notes',
    flight: 'Flight number',
    people: 'People',
    ownerNote: 'Open your dashboard to see all current and past bookings linked to your account.',
    mismatchNote: 'This booking belongs to a different email address. Sensitive details are hidden. Log out and sign in with the booking email to see more.',
    unknown: '-',
    type_transport: 'Transport',
    type_cars: 'Car rental',
    type_trips: 'Trip',
    type_hotels: 'Hotel',
  },
  pl: {
    pageTitle: 'Twoja rezerwacja | CyprusEye.com',
    loadingTitle: 'Sprawdzamy link rezerwacji...',
    loadingMessage: 'Poczekaj chwilę.',
    unavailableTitle: 'Link rezerwacji jest niedostępny',
    unavailableMessage: 'Ten link jest nieprawidłowy, wygasł albo nie jest już dostępny. Skontaktuj się z nami, jeśli potrzebujesz pomocy.',
    eyebrow: 'Podgląd rezerwacji',
    subtitlePublic: 'Ten bezpieczny link pokazuje tylko jedną rezerwację. Zaloguj się tym samym adresem email, aby zobaczyć więcej szczegółów.',
    subtitleOwner: 'Widzisz rozszerzony widok właściciela tej rezerwacji.',
    contact: 'Skontaktuj się',
    login: 'Zaloguj się, aby zobaczyć więcej',
    allBookings: 'Zobacz wszystkie rezerwacje',
    authTitle: 'Logowanie',
    authCopy: 'Użyj adresu email z tej rezerwacji, aby zobaczyć więcej szczegółów.',
    authEmail: 'Email',
    authPassword: 'Hasło',
    authSubmit: 'Zaloguj się',
    authClose: 'Zamknij',
    authSigningIn: 'Logowanie...',
    authSuccess: 'Zalogowano. Odświeżamy szczegóły rezerwacji...',
    authError: 'Nie udało się zalogować. Sprawdź email i hasło, a potem spróbuj ponownie.',
    moneyTitle: 'Podsumowanie płatności',
    paid: 'Opłacono',
    total: 'Łącznie',
    remaining: 'Pozostało',
    privacyPublic: 'Dla prywatności telefon, email i notatki wewnętrzne są ukryte w publicznym podglądzie.',
    privacyOwner: 'Pełne dane kontaktowe są widoczne, bo email konta zgadza się z rezerwacją.',
    detailsTitle: 'Szczegóły rezerwacji',
    reference: 'Numer rezerwacji',
    serviceType: 'Typ usługi',
    status: 'Status',
    paymentStatus: 'Status płatności',
    date: 'Data',
    time: 'Godzina',
    returnDate: 'Data powrotu',
    location: 'Trasa / lokalizacja',
    pickup: 'Odbiór',
    dropoff: 'Zwrot / cel',
    customer: 'Klient',
    email: 'Email',
    phone: 'Telefon',
    notes: 'Uwagi',
    flight: 'Numer lotu',
    people: 'Osoby',
    ownerNote: 'Otwórz panel, aby zobaczyć wszystkie obecne i historyczne rezerwacje przypisane do Twojego konta.',
    mismatchNote: 'Ta rezerwacja jest przypisana do innego adresu email. Dane wrażliwe są ukryte. Wyloguj się i zaloguj właściwym kontem, aby zobaczyć więcej.',
    unknown: '-',
    type_transport: 'Transport',
    type_cars: 'Wynajem auta',
    type_trips: 'Wycieczka',
    type_hotels: 'Hotel',
  },
  he: {
    pageTitle: 'ההזמנה שלך | CyprusEye.com',
    loadingTitle: 'בודקים את קישור ההזמנה...',
    loadingMessage: 'רגע אחד בבקשה.',
    unavailableTitle: 'קישור ההזמנה אינו זמין',
    unavailableMessage: 'הקישור אינו תקין, פג תוקף או אינו זמין יותר. צרו קשר אם צריך עזרה.',
    eyebrow: 'תצוגת הזמנה',
    subtitlePublic: 'הקישור המאובטח מציג הזמנה אחת בלבד. התחברו עם אותו אימייל כדי לראות פרטים נוספים.',
    subtitleOwner: 'זהו תצוגת הבעלים עבור ההזמנה הזו.',
    contact: 'צרו קשר',
    login: 'התחברות לפרטים נוספים',
    allBookings: 'כל ההזמנות',
    authTitle: 'התחברות',
    authCopy: 'התחברו עם כתובת האימייל של ההזמנה כדי לראות פרטים נוספים.',
    authEmail: 'אימייל',
    authPassword: 'סיסמה',
    authSubmit: 'התחברות',
    authClose: 'סגירה',
    authSigningIn: 'מתחברים...',
    authSuccess: 'התחברתם. מרעננים את פרטי ההזמנה...',
    authError: 'לא הצלחנו להתחבר. בדקו את האימייל והסיסמה ונסו שוב.',
    moneyTitle: 'סיכום תשלום',
    paid: 'שולם',
    total: 'סה"כ',
    remaining: 'נותר לתשלום',
    privacyPublic: 'מטעמי פרטיות, טלפון, אימייל והערות פנימיות מוסתרים בתצוגה הציבורית.',
    privacyOwner: 'פרטי קשר מלאים מוצגים כי אימייל החשבון תואם להזמנה.',
    detailsTitle: 'פרטי הזמנה',
    reference: 'מספר הזמנה',
    serviceType: 'סוג שירות',
    status: 'סטטוס',
    paymentStatus: 'סטטוס תשלום',
    date: 'תאריך',
    time: 'שעה',
    returnDate: 'תאריך חזרה',
    location: 'מסלול / מיקום',
    pickup: 'איסוף',
    dropoff: 'יעד / החזרה',
    customer: 'לקוח',
    email: 'אימייל',
    phone: 'טלפון',
    notes: 'הערות',
    flight: 'מספר טיסה',
    people: 'אנשים',
    ownerNote: 'פתחו את הדשבורד כדי לראות את כל ההזמנות שמקושרות לחשבון.',
    mismatchNote: 'ההזמנה שייכת לכתובת אימייל אחרת. פרטים רגישים מוסתרים.',
    unknown: '-',
    type_transport: 'הסעה',
    type_cars: 'השכרת רכב',
    type_trips: 'טיול',
    type_hotels: 'מלון',
  },
};

const TYPE_MARK = {
  transport: 'TR',
  cars: 'CAR',
  trips: 'TRP',
  hotels: 'HTL',
};

const CONTACT_URL = 'mailto:kontakt@wakacjecypr.com';

function $(id) {
  return document.getElementById(id);
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

function getLang() {
  const raw = String(getParams().get('lang') || '').trim().toLowerCase().split('-')[0];
  if (raw === 'pl' || raw === 'he') return raw;
  return 'en';
}

function tr(key) {
  return (DICT[state.lang] && DICT[state.lang][key]) || DICT.en[key] || key;
}

const state = {
  lang: getLang(),
  token: '',
  data: null,
};

function setLanguage(lang) {
  state.lang = lang === 'pl' || lang === 'he' ? lang : 'en';
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'he' ? 'rtl' : 'ltr';
  document.title = tr('pageTitle');
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.lang === state.lang ? 'true' : 'false');
  });
  updateAuthModalText();
}

function updateLangUrl(lang) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  window.history.replaceState({}, '', url.toString());
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value || '';
}

function setAuthStatus(message, tone = '') {
  const el = $('authStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = `yb-auth-status${tone ? ` yb-auth-status--${tone}` : ''}`;
}

function updateAuthModalText() {
  setText('authTitle', tr('authTitle'));
  setText('authCopy', tr('authCopy'));
  setText('authEmailLabel', tr('authEmail'));
  setText('authPasswordLabel', tr('authPassword'));
  setText('authSubmit', tr('authSubmit'));
  setText('authCancel', tr('authClose'));
  const closeButton = $('authClose');
  if (closeButton) closeButton.setAttribute('aria-label', tr('authClose'));
}

function openAuthModal() {
  updateAuthModalText();
  setAuthStatus('');
  const modal = $('authModal');
  if (!modal) return;
  modal.hidden = false;
  $('loginLink')?.setAttribute('aria-expanded', 'true');
  window.setTimeout(() => $('authEmail')?.focus(), 0);
}

function closeAuthModal() {
  const modal = $('authModal');
  if (!modal) return;
  modal.hidden = true;
  $('loginLink')?.setAttribute('aria-expanded', 'false');
}

function formatStatus(value) {
  const raw = String(value || '').trim();
  if (!raw) return tr('unknown');
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const locale = state.lang === 'pl' ? 'pl-PL' : state.lang === 'he' ? 'he-IL' : 'en-GB';
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMoney(value, currency) {
  const num = Number(value);
  if (!Number.isFinite(num)) return tr('unknown');
  const locale = state.lang === 'pl' ? 'pl-PL' : state.lang === 'he' ? 'he-IL' : 'en-IE';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: String(currency || 'EUR').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(num);
  } catch (_error) {
    return `${num.toFixed(2)} ${String(currency || 'EUR').toUpperCase()}`;
  }
}

function showLoading() {
  $('bookingPanel').hidden = true;
  $('bookingDetails').hidden = true;
  $('errorState').hidden = false;
  setText('errorTitle', tr('loadingTitle'));
  setText('errorMessage', tr('loadingMessage'));
  setText('errorHomeLink', state.lang === 'pl' ? 'Strona główna' : state.lang === 'he' ? 'דף הבית' : 'Go home');
  setText('errorContactLink', tr('contact'));
  $('errorContactLink').href = CONTACT_URL;
}

function showError() {
  $('bookingPanel').hidden = true;
  $('bookingDetails').hidden = true;
  $('errorState').hidden = false;
  setText('errorTitle', tr('unavailableTitle'));
  setText('errorMessage', tr('unavailableMessage'));
  setText('errorHomeLink', state.lang === 'pl' ? 'Strona główna' : state.lang === 'he' ? 'דף הבית' : 'Go home');
  setText('errorContactLink', tr('contact'));
  $('errorContactLink').href = CONTACT_URL;
}

function addField(container, label, value) {
  const clean = String(value || '').trim();
  if (!clean) return;
  const node = document.createElement('div');
  node.className = 'yb-field';
  node.innerHTML = `
    <p class="yb-label"></p>
    <p class="yb-value"></p>
  `;
  node.querySelector('.yb-label').textContent = label;
  node.querySelector('.yb-value').textContent = clean;
  container.appendChild(node);
}

function normalizePayload(payload) {
  return payload && typeof payload === 'object' ? payload : {};
}

function getFunctionUrl() {
  return `${SUPABASE_CONFIG.url.replace(/\/+$/, '')}/functions/v1/booking-access`;
}

async function getAuthToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return String(data?.session?.access_token || '').trim();
  } catch (_error) {
    return '';
  }
}

async function resolveBooking() {
  const authToken = await getAuthToken();
  const authorizationToken = authToken || SUPABASE_CONFIG.anonKey;
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_CONFIG.anonKey,
    Authorization: `Bearer ${authorizationToken}`,
  };

  const response = await fetch(getFunctionUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'resolve',
      token: state.token,
      lang: state.lang,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    throw new Error('booking_link_unavailable');
  }

  return normalizePayload(payload);
}

function renderBooking(payload) {
  state.data = payload;
  const booking = normalizePayload(payload.booking);
  const schedule = normalizePayload(payload.schedule);
  const location = normalizePayload(payload.location);
  const money = normalizePayload(payload.money);
  const customer = normalizePayload(payload.customer);
  const actions = normalizePayload(payload.actions);
  const isOwner = Boolean(payload.is_owner);
  const type = String(booking.type || '');
  const currency = String(money.currency || 'EUR');

  $('errorState').hidden = true;
  $('bookingPanel').hidden = false;
  $('bookingDetails').hidden = false;

  setText('serviceMark', TYPE_MARK[type] || 'CE');
  setText('eyebrowText', tr('eyebrow'));
  setText('bookingTitle', String(booking.title || tr(`type_${type}`) || tr('detailsTitle')));
  setText('bookingSubtitle', isOwner ? tr('subtitleOwner') : tr('subtitlePublic'));
  setText('statusBadge', formatStatus(booking.status));
  $('statusBadge').className = `yb-badge yb-badge--${String(booking.status || '').toLowerCase()}`;

  const paymentStatus = String(booking.payment_status || '').trim();
  $('paymentBadge').hidden = !paymentStatus;
  if (paymentStatus) {
    setText('paymentBadge', formatStatus(paymentStatus));
    $('paymentBadge').className = `yb-badge yb-badge--${paymentStatus.toLowerCase()}`;
  }

  setText('contactLink', tr('contact'));
  $('contactLink').href = CONTACT_URL;
  setText('loginLink', tr('login'));
  $('loginLink').hidden = isOwner;
  setText('allBookingsLink', tr('allBookings'));
  $('allBookingsLink').href = String(actions.all_bookings_url || `/achievements.html?lang=${state.lang}&section=reservations`);
  $('allBookingsLink').hidden = !isOwner;

  setText('moneyTitle', tr('moneyTitle'));
  setText('labelPaid', tr('paid'));
  setText('labelTotal', tr('total'));
  setText('labelRemaining', tr('remaining'));
  setText('valuePaid', formatMoney(money.paid, currency));
  setText('valueTotal', formatMoney(money.total, currency));
  setText('valueRemaining', formatMoney(money.remaining, currency));
  setText('privacyText', isOwner ? tr('privacyOwner') : tr('privacyPublic'));

  setText('detailsTitle', tr('detailsTitle'));
  const grid = $('detailsGrid');
  grid.innerHTML = '';
  addField(grid, tr('reference'), booking.reference);
  addField(grid, tr('serviceType'), tr(`type_${type}`));
  addField(grid, tr('status'), formatStatus(booking.status));
  addField(grid, tr('paymentStatus'), paymentStatus ? formatStatus(paymentStatus) : '');
  addField(grid, tr('date'), formatDate(schedule.date || schedule.arrival_date));
  addField(grid, tr('time'), schedule.time);
  addField(grid, tr('returnDate'), formatDate(schedule.return_date || schedule.departure_date));
  addField(grid, tr('location'), location.summary);
  addField(grid, tr('pickup'), location.pickup);
  addField(grid, tr('dropoff'), location.dropoff);
  addField(grid, tr('customer'), customer.name);

  if (isOwner) {
    const owner = normalizePayload(payload.owner_details);
    addField(grid, tr('email'), customer.email);
    addField(grid, tr('phone'), customer.phone);
    addField(grid, tr('flight'), owner.flight_number);
    const people = [owner.passengers, owner.adults, owner.children]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .join(' / ');
    addField(grid, tr('people'), people);
    addField(grid, tr('notes'), owner.notes);
  }

  setText('ownerNote', tr('ownerNote'));
  $('ownerNote').hidden = !isOwner;
  setText('mismatchNote', tr('mismatchNote'));
  $('mismatchNote').hidden = !payload.auth_email_mismatch;
}

async function refreshBookingAccess() {
  if (!state.token) {
    showError();
    return;
  }
  const payload = await resolveBooking();
  renderBooking(payload);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = String($('authEmail')?.value || '').trim();
  const password = String($('authPassword')?.value || '');
  if (!email || !password) {
    setAuthStatus(tr('authError'), 'error');
    return;
  }

  setAuthStatus(tr('authSigningIn'));
  $('authSubmit').disabled = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setAuthStatus(tr('authSuccess'), 'success');
    await refreshBookingAccess();
    closeAuthModal();
  } catch (_error) {
    setAuthStatus(tr('authError'), 'error');
  } finally {
    $('authSubmit').disabled = false;
  }
}

function rerenderLanguage() {
  setLanguage(state.lang);
  if (state.data) {
    renderBooking(state.data);
  } else {
    showLoading();
  }
}

async function main() {
  setLanguage(state.lang);
  state.token = String(getParams().get('token') || '').trim();
  showLoading();

  $('loginLink')?.addEventListener('click', (event) => {
    event.preventDefault();
    openAuthModal();
  });
  $('authClose')?.addEventListener('click', closeAuthModal);
  $('authCancel')?.addEventListener('click', closeAuthModal);
  $('authModal')?.addEventListener('click', (event) => {
    if (event.target === $('authModal')) closeAuthModal();
  });
  $('authForm')?.addEventListener('submit', handleAuthSubmit);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('authModal')?.hidden) closeAuthModal();
  });

  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', async () => {
      const lang = button.dataset.lang;
      if (!lang || lang === state.lang) return;
      state.lang = lang;
      updateLangUrl(lang);
      rerenderLanguage();
      if (state.token) {
        try {
          const payload = await resolveBooking();
          renderBooking(payload);
        } catch (_error) {
          showError();
        }
      }
    });
  });

  if (!state.token) {
    showError();
    return;
  }

  try {
    await refreshBookingAccess();
  } catch (_error) {
    showError();
  }
}

main();
