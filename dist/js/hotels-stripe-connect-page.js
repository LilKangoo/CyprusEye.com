const params = new URL(location.href).searchParams;
const callback = location.pathname.endsWith('/stripe-connect-return.html');
const code = params.get('code'); const nonce = params.get('state');
const callbackError = params.has('error');
// Do this before importing the Supabase SDK. Never persist code/state or expose
// them in DOM, logs, sessionStorage or referrer headers.
if (callback) history.replaceState(null, '', location.pathname);
const lang = ['pl', 'he'].includes(params.get('lang')) ? params.get('lang') : 'en';
document.documentElement.lang = lang;
document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
const copy = {
  en: { explanation: 'Connect your own Stripe account with full Stripe Dashboard access. One account is shared by all Hotels of your Partner business.', routing: 'Account connection does not enable payments or change settlement, deposits or commission.',
    NOT_CONNECTED: 'Not connected', ONBOARDING_INCOMPLETE: 'Stripe setup incomplete', CONNECTED: 'Connected — verified by server', RESTRICTED: 'Restricted', ACTION_REQUIRED: 'Action required in Stripe', DISABLED: 'Stripe connection is not enabled', unavailable: 'Connection could not be verified. Nothing was retried automatically.', begin: 'Connect Stripe', refresh: 'Refresh status' },
  pl: { explanation: 'Połącz własne konto Stripe z pełnym panelem Stripe. Jedno konto obsługuje wszystkie Hotele podmiotu Partnera.', routing: 'Połączenie konta nie uruchamia płatności ani nie zmienia rozliczeń, zaliczek i prowizji.',
    NOT_CONNECTED: 'Niepołączone', ONBOARDING_INCOMPLETE: 'Konfiguracja Stripe nieukończona', CONNECTED: 'Połączone — potwierdzone przez serwer', RESTRICTED: 'Ograniczone', ACTION_REQUIRED: 'Wymagane działanie w Stripe', DISABLED: 'Połączenie Stripe nie jest włączone', unavailable: 'Nie udało się zweryfikować połączenia. Operacji nie ponowiono automatycznie.', begin: 'Połącz Stripe', refresh: 'Odśwież stan' },
  he: { explanation: 'חברו חשבון Stripe משלכם עם גישה מלאה ללוח הבקרה. חשבון אחד משותף לכל המלונות של עסק השותף.', routing: 'חיבור החשבון אינו מפעיל תשלומים ואינו משנה הסדרי תשלום, מקדמות או עמלות.',
    NOT_CONNECTED: 'לא מחובר', ONBOARDING_INCOMPLETE: 'הגדרת Stripe לא הושלמה', CONNECTED: 'מחובר — אומת בשרת', RESTRICTED: 'מוגבל', ACTION_REQUIRED: 'נדרשת פעולה ב־Stripe', DISABLED: 'חיבור Stripe אינו מופעל', unavailable: 'לא ניתן לאמת את החיבור. הפעולה לא נוסתה שוב אוטומטית.', begin: 'חיבור Stripe', refresh: 'רענון מצב' },
}[lang];
document.querySelectorAll('[data-copy]').forEach(el => { el.textContent = copy[el.dataset.copy]; });
document.querySelector('h1').textContent = lang === 'pl' ? 'Połączenie Stripe' : lang === 'he' ? 'חיבור Stripe' : 'Stripe connection';
document.querySelector('a[href="/partners/"]').textContent = lang === 'pl' ? 'Wróć do panelu Partnera' : lang === 'he' ? 'חזרה לפורטל השותף' : 'Back to Partner portal';
const status = document.querySelector('[data-stripe-status]');
const begin = document.querySelector('[data-stripe-begin]');
const refresh = document.querySelector('[data-stripe-refresh]');
if (begin) begin.textContent = copy.begin;
if (refresh) refresh.textContent = copy.refresh;
let busy = false;
const scope = { partner_id: params.get('partner'), hotel_id: params.get('hotel') };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
try {
  const { supabase } = await import('./supabaseClient.js');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('authentication_required');
  const invoke = async body => {
    const { data: response, error: failed } = await supabase.functions.invoke('hotels-stripe-connect', { body });
    if (failed) throw new Error('request_failed');
    return response;
  };
  const display = response => {
    if (!response || response.contract_version !== 'hotels_partner_stripe_connect_v1'
      || !['NOT_CONNECTED','ONBOARDING_INCOMPLETE','CONNECTED','RESTRICTED','ACTION_REQUIRED','DISABLED'].includes(response.status)
      || (response.checked_at !== null && (typeof response.checked_at !== 'string' || !Number.isFinite(Date.parse(response.checked_at))))
      || Object.keys(response).sort().join() !== 'checked_at,contract_version,status') throw new Error('invalid_response');
    status.textContent = copy[response.status];
    status.dataset.state = response.status;
    if (begin) begin.hidden = !['NOT_CONNECTED','ONBOARDING_INCOMPLETE','ACTION_REQUIRED'].includes(response.status);
    if (refresh) refresh.hidden = response.status === 'DISABLED';
  };
  const run = async action => {
    if (busy) return;
    busy = true;
    if (begin) begin.disabled = true;
    if (refresh) refresh.disabled = true;
    try {
      const response = await invoke({ action, ...scope, ...(action === 'begin' ? { request_id: crypto.randomUUID() } : {}) });
      if (action === 'begin') {
        if (response?.contract_version !== 'hotels_partner_stripe_connect_begin_v1'
          || Object.keys(response).sort().join() !== 'authorization_url,contract_version') throw new Error('invalid_response');
        const target = new URL(response.authorization_url);
        if (target.origin !== 'https://connect.stripe.com' || target.pathname !== '/oauth/authorize'
          || target.username || target.password || target.hash
          || target.searchParams.get('redirect_uri') !== `${location.origin}/partners/stripe-connect-return.html`) throw new Error('unsafe_redirect');
        location.assign(target.href);
      } else display(response);
    } catch (_) { status.textContent = copy.unavailable; if (begin) begin.hidden = true; }
    finally { busy = false; if (begin) begin.disabled = false; if (refresh) refresh.disabled = false; }
  };
  if (callback) {
    if (callbackError || !code || !nonce) throw new Error('callback_incomplete');
    display(await invoke({ action: 'complete', code, state: nonce }));
  } else {
    if (!UUID.test(scope.partner_id || '') || !UUID.test(scope.hotel_id || '')) throw new Error('invalid_scope');
    display(await invoke({ action: 'status', ...scope }));
    begin.addEventListener('click', () => { void run('begin'); });
    refresh.addEventListener('click', () => { void run('refresh'); });
  }
} catch (_) { status.textContent = copy.unavailable; }
