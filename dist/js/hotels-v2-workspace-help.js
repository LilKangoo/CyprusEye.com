(function attachHotelsV2WorkspaceHelp(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2WorkspaceHelp = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2WorkspaceHelp() {
  'use strict';

  const LANGUAGES = Object.freeze(['en', 'pl', 'he']);
  const HELP_FIELDS = Object.freeze([
    'title', 'what_this_is', 'what_it_changes', 'how_to_use', 'example',
    'review_or_activation_behavior', 'important_note',
  ]);
  const PRESENTATION_CONTRACT = 'hotels_v2_workspace_bookings_payments_presentation_v1';
  const DIALOG_ID = 'hotels-v2-workspace-help-dialog';
  const DIALOG_TITLE_ID = `${DIALOG_ID}-title`;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
  const CURRENCY = /^[A-Z]{3}$/;
  const SHARED_SURFACES = new WeakMap();

  const LABELS = Object.freeze({
    en: Object.freeze({
      what_this_is: 'What this is', what_it_changes: 'What it changes',
      how_to_use: 'How to use it', example: 'Example',
      review_or_activation_behavior: 'Review or activation', important_note: 'Important note',
      help: 'Help', close: 'Close help',
    }),
    pl: Object.freeze({
      what_this_is: 'Co to jest', what_it_changes: 'Co to zmienia',
      how_to_use: 'Jak z tego korzystać', example: 'Przykład',
      review_or_activation_behavior: 'Akceptacja lub aktywacja', important_note: 'Ważna informacja',
      help: 'Pomoc', close: 'Zamknij pomoc',
    }),
    he: Object.freeze({
      what_this_is: 'מה זה', what_it_changes: 'מה זה משנה',
      how_to_use: 'איך משתמשים', example: 'דוגמה',
      review_or_activation_behavior: 'בדיקה או הפעלה', important_note: 'חשוב לדעת',
      help: 'עזרה', close: 'סגירת העזרה',
    }),
  });

  function fail(message) { throw new Error(message); }
  function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function exactKeys(value, keys, label) {
    if (!isObject(value)) fail(`${label} must be an object.`);
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
      fail(`${label} contains an unexpected field envelope.`);
    }
    return value;
  }
  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function safeText(value, label, { nullable = false, maximum = 1000 } = {}) {
    if (nullable && value === null) return null;
    if (typeof value !== 'string' || value.trim().length < 1 || value.length > maximum
        || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label} must be safe text.`);
    return value;
  }
  function canonicalUuid(value, label) {
    if (typeof value !== 'string' || !UUID.test(value)) fail(`${label} must be a lowercase canonical UUID.`);
    return value;
  }
  function isoDate(value, label) {
    if (typeof value !== 'string') fail(`${label} must be an ISO date.`);
    const match = DATE.exec(value);
    if (!match) fail(`${label} must be an ISO date.`);
    const parsed = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (new Date(parsed).toISOString().slice(0, 10) !== value) fail(`${label} must be a real ISO date.`);
    return value;
  }
  function isoTimestamp(value, label) {
    if (typeof value !== 'string' || !TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) {
      fail(`${label} must be an ISO timestamp with a timezone.`);
    }
    return value;
  }
  function exactBoolean(value, label) {
    if (typeof value !== 'boolean') fail(`${label} must be boolean.`);
    return value;
  }
  function nullableInteger(value, label) {
    if (value === null) return null;
    if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a non-negative integer or null.`);
    return value;
  }
  function nullableMoney(value, label) {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
        || Math.abs(Math.round(value * 100) - value * 100) > 1e-7) {
      fail(`${label} must be non-negative exact money or null.`);
    }
    return value;
  }
  function nullableCurrency(value, label) {
    if (value === null) return null;
    if (typeof value !== 'string' || !CURRENCY.test(value)) fail(`${label} must be an ISO currency or null.`);
    return value;
  }

  const TOPICS = Object.create(null);
  function entry(values) {
    if (!Array.isArray(values) || values.length !== HELP_FIELDS.length) fail('A help entry is incomplete.');
    return Object.fromEntries(HELP_FIELDS.map((field, index) => [field, safeText(values[index], field)]));
  }
  function addTopic(id, en, pl, he) {
    if (!/^(?:section|controls)\.[a-z_]+$/.test(id) || Object.prototype.hasOwnProperty.call(TOPICS, id)) {
      fail(`Invalid or duplicate help topic: ${id}.`);
    }
    TOPICS[id] = { en: entry(en), pl: entry(pl), he: entry(he) };
  }

  addTopic('section.overview', [
    'Overview help',
    'A read-only summary of this Hotel workspace and the work currently available to you.',
    'Opening or reading Overview changes nothing.',
    'Start here to check the Hotel, available sections and persistent lifecycle notice before editing.',
    'Pricing can be waiting for Admin review while Property information remains editable.',
    'Items that need review or activation keep their status until the authorized step is completed.',
    'The visible lifecycle comes from the authorized Hotel record; a temporary “Saved” or “Failed” message does not replace it.',
  ], [
    'Pomoc — Przegląd',
    'Podsumowanie tylko do odczytu tego panelu Hotelu i funkcji, z których możesz teraz korzystać.',
    'Otwarcie ani przeczytanie Przeglądu niczego nie zmienia.',
    'Zacznij tutaj, aby sprawdzić Hotel, dostępne sekcje i stały komunikat o etapie działania przed edycją.',
    'Cennik może oczekiwać na akceptację Admina, a informacje o obiekcie nadal mogą być edytowalne.',
    'Elementy wymagające akceptacji lub aktywacji zachowują status do czasu wykonania uprawnionego kroku.',
    'Widoczny etap pochodzi z autoryzowanych danych Hotelu; tymczasowy komunikat „Zapisano” lub „Nie udało się” go nie zastępuje.',
  ], [
    'עזרה — סקירה כללית',
    'תקציר לקריאה בלבד של סביבת העבודה של המלון ושל הפעולות הזמינות לך כעת.',
    'פתיחת הסקירה או קריאתה אינן משנות דבר.',
    'כדאי להתחיל כאן כדי לבדוק את המלון, את הסעיפים הזמינים ואת הודעת מחזור החיים הקבועה לפני עריכה.',
    'התמחור יכול להמתין לבדיקת האדמין, בעוד שפרטי הנכס עדיין ניתנים לעריכה.',
    'פריטים שדורשים בדיקה או הפעלה שומרים על הסטטוס שלהם עד להשלמת הפעולה המורשית.',
    'מחזור החיים המוצג מגיע מרשומת המלון המורשית; הודעה זמנית כמו „נשמר” או „נכשל” אינה מחליפה אותו.',
  ]);

  addTopic('section.property', [
    'Property help',
    'Property contains the Hotel information guests use to understand the place, such as its name, description, location and amenities.',
    'Editable fields prepare a proposed change; they do not silently replace reviewed live content.',
    'Correct only inaccurate or incomplete information, enter a clear reason and submit the proposal.',
    'You can correct an amenity description and explain why the guest information changed.',
    'A Partner proposal is pending Admin review until it is accepted or rejected; only accepted content becomes approved.',
    'Check the persistent proposal status before preparing another change.',
  ], [
    'Pomoc — Obiekt',
    'Sekcja Obiekt zawiera informacje, dzięki którym goście poznają Hotel, między innymi nazwę, opis, lokalizację i udogodnienia.',
    'Edytowalne pola przygotowują propozycję zmiany; nie zastępują po cichu zatwierdzonej treści.',
    'Popraw tylko nieaktualne lub niepełne informacje, podaj jasny powód i wyślij propozycję zmiany.',
    'Możesz poprawić opis udogodnienia i wyjaśnić, dlaczego zmieniła się informacja dla gościa.',
    'Propozycja Partnera oczekuje na akceptację Admina do czasu przyjęcia lub odrzucenia; tylko zaakceptowana treść staje się zatwierdzona.',
    'Przed przygotowaniem kolejnej zmiany sprawdź stały status propozycji.',
  ], [
    'עזרה — הנכס',
    'סעיף הנכס מכיל את פרטי המלון שעוזרים לאורחים להבין את המקום, כגון שם, תיאור, מיקום ושירותים.',
    'השדות הניתנים לעריכה מכינים הצעת שינוי; הם אינם מחליפים בשקט תוכן חי שכבר נבדק.',
    'תקנו רק מידע שגוי או חסר, הוסיפו סיבה ברורה ושלחו את ההצעה.',
    'אפשר לתקן תיאור של שירות ולהסביר מדוע המידע לאורח השתנה.',
    'הצעת שותף ממתינה לבדיקת האדמין עד לאישור או לדחייה; רק תוכן שאושר הופך לתוכן המאושר.',
    'לפני הכנת שינוי נוסף, בדקו את סטטוס ההצעה הקבוע.',
  ]);

  addTopic('section.rooms', [
    'Rooms help',
    'Rooms describes each exact Room guests can book, including content, gallery, occupancy, beds, bathrooms and size.',
    'A change affects only the selected Room and can change how guests understand its capacity or layout.',
    'Confirm the Room, then check its name, gallery and every structure field before submission.',
    'Upper and Ground may share features, but each Room keeps its own identity and information.',
    'Content, photo or structure changes that require review remain proposed until Admin accepts them.',
    'Never use one Room to stand in for another; occupancy and bed details must be exact.',
  ], [
    'Pomoc — Apartamenty',
    'Sekcja opisuje każdy konkretny Pokój lub Apartament, w tym treść, galerię, liczbę gości, łóżka, łazienki i powierzchnię.',
    'Zmiana dotyczy wyłącznie wybranego Apartamentu i może wpływać na widoczną pojemność lub układ.',
    'Potwierdź Apartament, a następnie sprawdź nazwę, galerię i wszystkie dane struktury przed wysłaniem.',
    'Górny i Dolny Apartament mogą mieć podobne cechy, ale każdy zachowuje własną tożsamość i informacje.',
    'Treść, zdjęcia lub struktura wymagające akceptacji pozostają propozycją do czasu zatwierdzenia przez Admina.',
    'Nie używaj jednego Apartamentu jako zamiennika drugiego; liczba gości i łóżek musi być dokładna.',
  ], [
    'עזרה — חדרים',
    'הסעיף מתאר כל חדר מדויק שאורחים יכולים להזמין, כולל תוכן, גלריה, תפוסה, מיטות, חדרי רחצה וגודל.',
    'שינוי משפיע רק על החדר שנבחר ויכול לשנות את האופן שבו אורחים מבינים את הקיבולת או המבנה שלו.',
    'אשרו את החדר, ואז בדקו את השם, הגלריה וכל שדה מבני לפני השליחה.',
    'לחדר העליון ולחדר הקרקע עשויים להיות מאפיינים דומים, אך לכל חדר זהות ומידע משלו.',
    'תוכן, תמונות או מבנה שדורשים בדיקה נשארים בגדר הצעה עד שהאדמין מאשר אותם.',
    'אין להשתמש בחדר אחד כתחליף לאחר; התפוסה ופרטי המיטות חייבים להיות מדויקים.',
  ]);

  addTopic('section.pricing', [
    'Rates & Pricing help',
    'Independent nightly price rules for Upper and Ground Rooms, organized by guest-count tiers and minimum-night thresholds.',
    'Only an accepted pricing proposal changes the live customer price; Preview and submission do not change it immediately.',
    'Edit one or more existing tiers, choose Preview, check the result, enter a reason and submit for Admin review.',
    'Upper and Ground may initially have equal prices, but a proposal can change one Room without changing the other.',
    'Admin reviews the exact proposal and chooses Accept or Reject; until acceptance, the reviewed live price remains in use.',
    'Customer pays, CyprusEye commission and Partner receives are read-only server-derived values; commission is EUR 10 per allocated Room per rental night.',
  ], [
    'Pomoc — Stawki i ceny',
    'Niezależne zasady ceny za noc dla Górnego i Dolnego Apartamentu, uporządkowane według liczby gości i minimalnej liczby nocy.',
    'Tylko zaakceptowana propozycja zmiany cennika zmienia cenę aktywną dla klienta; Podgląd ani wysłanie nie zmieniają jej od razu.',
    'Edytuj co najmniej jeden istniejący próg, wybierz Podgląd, sprawdź wynik, podaj powód i wyślij do akceptacji Admina.',
    'Górny i Dolny Apartament mogą początkowo mieć równe ceny, ale propozycja może zmienić jeden niezależnie od drugiego.',
    'Admin sprawdza dokładną propozycję i wybiera Akceptuj lub Odrzuć; do akceptacji obowiązuje zatwierdzona cena aktywna.',
    'Kwoty „Klient płaci”, „Prowizja CyprusEye” i „Partner otrzymuje” są wyliczane przez serwer i tylko do odczytu; prowizja wynosi 10 EUR za przydzielony Pokój za noc pobytu.',
  ], [
    'עזרה — תעריפים ותמחור',
    'כללי מחיר ללילה עצמאיים לחדר העליון ולחדר הקרקע, לפי מדרגות מספר אורחים וסף מינימום לילות.',
    'רק הצעת תמחור שאושרה משנה את המחיר החי ללקוח; תצוגה מקדימה ושליחה אינן משנות אותו מיד.',
    'ערכו מדרגה קיימת אחת או יותר, בחרו בתצוגה מקדימה, בדקו את התוצאה, הזינו סיבה ושלחו לבדיקת האדמין.',
    'המחירים של החדר העליון ושל חדר הקרקע עשויים להיות זהים בתחילה, אך אפשר לשנות אחד בלי לשנות את האחר.',
    'האדמין בודק את ההצעה המדויקת ובוחר לאשר או לדחות; עד לאישור, המחיר החי שנבדק נשאר בתוקף.',
    'הסכום שהלקוח משלם, עמלת CyprusEye והסכום שהשותף מקבל נגזרים מהשרת ומוצגים לקריאה בלבד; העמלה היא 10 אירו לכל חדר שהוקצה, לכל ליל אירוח.',
  ]);

  addTopic('section.calendar', [
    'Calendar help',
    'Exact Room availability together with reviewed inbound sources from Booking.com, Airbnb or Generic iCal.',
    'An active source imports blocked dates into its mapped Room; it never sends CyprusEye availability back to the provider.',
    'Map each source to the exact Room, configure its private calendar URL, complete review, then enable or synchronize only when available.',
    'A Booking.com calendar for Upper must be mapped to Upper, not Ground or the whole Hotel.',
    'Activation is unavailable until the private URL is configured and the source is reviewed and ready; health can show a safe synchronization warning.',
    'The private calendar URL is stored privately and never returned to the Admin or Partner browser after submission.',
  ], [
    'Pomoc — Kalendarz',
    'Dokładna dostępność Pokoi połączona ze sprawdzonymi źródłami przychodzącymi Booking.com, Airbnb lub Generic iCal.',
    'Aktywne źródło importuje zablokowane daty do przypisanego Pokoju; nigdy nie wysyła dostępności CyprusEye z powrotem do dostawcy.',
    'Przypisz źródło do dokładnego Pokoju, skonfiguruj prywatny adres URL, zakończ weryfikację, a potem włącz lub zsynchronizuj, gdy funkcja jest dostępna.',
    'Kalendarz Booking.com dla Górnego Apartamentu musi być przypisany do niego, a nie do Dolnego Apartamentu ani całego Hotelu.',
    'Aktywacja jest niedostępna do czasu konfiguracji prywatnego adresu URL oraz sprawdzenia i gotowości źródła; stan może pokazać bezpieczne ostrzeżenie synchronizacji.',
    'Prywatny adres URL kalendarza jest przechowywany prywatnie i po wysłaniu nigdy nie wraca do przeglądarki Admina ani Partnera.',
  ], [
    'עזרה — לוח שנה',
    'זמינות מדויקת לפי חדר יחד עם מקורות נכנסים שנבדקו מ־Booking.com, מ־Airbnb או מ־Generic iCal.',
    'מקור פעיל מייבא תאריכים חסומים אל החדר שאליו הוא ממופה; הוא לעולם אינו שולח את זמינות CyprusEye בחזרה לספק.',
    'מפו כל מקור לחדר המדויק, הגדירו את כתובת לוח השנה הפרטית, השלימו בדיקה ואז הפעילו או סנכרנו רק כשהאפשרות זמינה.',
    'לוח שנה של Booking.com עבור החדר העליון חייב להיות ממופה לחדר העליון, ולא לחדר הקרקע או למלון כולו.',
    'הפעלה אינה זמינה לפני שהכתובת הפרטית הוגדרה והמקור נבדק ומוכן; מצב הבריאות יכול להציג אזהרת סנכרון בטוחה.',
    'כתובת לוח השנה הפרטית נשמרת באופן פרטי ולעולם אינה מוחזרת לדפדפן של האדמין או של השותף לאחר השליחה.',
  ]);

  addTopic('section.bookings', [
    'Bookings help',
    'An authorized Hotel-scoped summary of the reservations available in this workspace.',
    'Reading the summary changes no booking and adds no booking-status mutation.',
    'Check dates, guest count, status and exact Room allocation, then open the secure complete booking management flow when needed.',
    'A booking for five to eight guests can show both Upper and Ground when both Rooms were allocated.',
    'The exact available status is shown; unavailable information is labelled unavailable rather than guessed.',
    'Only bookings authorized for this Hotel appear; an empty state means no matching booking is currently available.',
  ], [
    'Pomoc — Rezerwacje',
    'Autoryzowane, ograniczone do tego Hotelu podsumowanie rezerwacji dostępnych w tym panelu.',
    'Odczyt podsumowania nie zmienia rezerwacji i nie dodaje funkcji zmiany statusu.',
    'Sprawdź daty, liczbę gości, status i dokładny przydział Pokoi, a w razie potrzeby otwórz bezpieczne pełne zarządzanie rezerwacją.',
    'Rezerwacja dla pięciu–ośmiu gości może pokazywać Górny i Dolny Apartament, jeśli przydzielono oba.',
    'Wyświetlany jest dokładny dostępny status; brakujące informacje są oznaczone jako niedostępne, a nie odgadywane.',
    'Widoczne są tylko rezerwacje autoryzowane dla tego Hotelu; pusty widok oznacza brak pasującej rezerwacji.',
  ], [
    'עזרה — הזמנות',
    'תקציר מורשה, המוגבל למלון הזה, של ההזמנות הזמינות בסביבת העבודה.',
    'קריאת התקציר אינה משנה הזמנה ואינה מוסיפה דרך לשינוי סטטוס.',
    'בדקו תאריכים, מספר אורחים, סטטוס והקצאת חדרים מדויקת, ובמידת הצורך פתחו את ניהול ההזמנה המלא והמאובטח.',
    'הזמנה לחמישה עד שמונה אורחים יכולה להציג גם את החדר העליון וגם את חדר הקרקע כאשר שניהם הוקצו.',
    'הסטטוס המדויק הזמין מוצג; מידע שאינו זמין מסומן כלא זמין ולא מנוחש.',
    'מוצגות רק הזמנות מורשות של המלון הזה; מצב ריק פירושו שאין כרגע הזמנה מתאימה.',
  ]);

  addTopic('section.payments', [
    'Payments help',
    'The exact commercial information currently available for authorized Hotel bookings.',
    'Values are informational here; this section creates no payment, payout, refund or new payment state.',
    'Read Customer pays, Paid, Remaining, CyprusEye commission and Partner receives, then open the existing secure payment flow for authorized work.',
    'If a payment value is not known exactly, it is unavailable rather than shown as zero, paid or unpaid.',
    'Only controls already authorized by the secure payment flow can act; this summary remains read-only.',
    'Commission is EUR 10 per allocated Room per rental night: one Room uses one commission unit per night and both Rooms use two; the display is server-derived.',
  ], [
    'Pomoc — Płatności',
    'Dokładne informacje handlowe dostępne obecnie dla autoryzowanych rezerwacji tego Hotelu.',
    'Wartości są informacyjne; sekcja nie tworzy płatności, wypłat, zwrotów ani nowych statusów płatności.',
    'Sprawdź kwoty „Klient płaci”, „Zapłacono”, „Pozostało”, „Prowizja CyprusEye” i „Partner otrzymuje”, a potem otwórz istniejący bezpieczny proces płatności.',
    'Jeśli wartość płatności nie jest dokładnie znana, jest niedostępna, a nie pokazana jako zero, zapłacona lub niezapłacona.',
    'Działać mogą tylko funkcje autoryzowane w bezpiecznym procesie płatności; podsumowanie pozostaje tylko do odczytu.',
    'Prowizja wynosi 10 EUR za przydzielony Pokój za noc pobytu: jeden Pokój oznacza jedną jednostkę prowizji za noc, a oba Pokoje — dwie; wynik pochodzi z serwera.',
  ], [
    'עזרה — תשלומים',
    'המידע המסחרי המדויק שזמין כעת עבור הזמנות מורשות של המלון.',
    'הערכים כאן הם למידע בלבד; הסעיף אינו יוצר תשלום, העברת כספים, החזר או מצב תשלום חדש.',
    'בדקו את הסכום שהלקוח משלם, את הסכום ששולם, את היתרה, את עמלת CyprusEye ואת הסכום שהשותף מקבל, ואז פתחו את תהליך התשלום המאובטח הקיים לעבודה מורשית.',
    'אם ערך תשלום אינו ידוע במדויק, הוא מוצג כלא זמין ולא כאפס, שולם או לא שולם.',
    'רק פקדים שכבר מורשים בתהליך התשלום המאובטח יכולים לפעול; התקציר נשאר לקריאה בלבד.',
    'העמלה היא 10 אירו לכל חדר שהוקצה, לכל ליל אירוח: חדר אחד הוא יחידת עמלה אחת ללילה ושני חדרים הם שתי יחידות עמלה; התצוגה נגזרת מהשרת.',
  ]);

  addTopic('controls.property', [
    'Editing and reviewing Property information',
    'These controls prepare a Partner proposal for the editable Property information in the form.',
    'Edits change the proposal draft, not approved Property information before acceptance.',
    'Make the smallest accurate edit, Preview when offered, enter a useful reason and submit for Admin review.',
    'Explain which guest-facing detail was corrected instead of entering a generic reason such as “update”.',
    'Pending Admin review means no decision; accepted means approved; rejected means approved content remains unchanged.',
    'Persistent accepted, rejected or pending status is separate from a temporary success or error message.',
  ], [
    'Edycja i akceptacja informacji o obiekcie',
    'Te funkcje przygotowują propozycję Partnera dotyczącą edytowalnych informacji o obiekcie w formularzu.',
    'Zmiany aktualizują szkic propozycji, a nie zatwierdzone informacje przed akceptacją.',
    'Wprowadź najmniejszą dokładną zmianę, użyj Podglądu, podaj pomocny powód i wyślij do akceptacji Admina.',
    'Opisz, która informacja dla gościa została poprawiona, zamiast wpisywać ogólny powód „aktualizacja”.',
    'Oczekiwanie na Admina oznacza brak decyzji; zaakceptowana propozycja jest zatwierdzona; odrzucona nie zmienia treści.',
    'Stały status zaakceptowana, odrzucona lub oczekująca jest niezależny od tymczasowego komunikatu.',
  ], [
    'עריכה ובדיקה של פרטי הנכס',
    'הפקדים האלה מכינים הצעת שותף עבור פרטי הנכס הניתנים לעריכה בטופס.',
    'העריכות משנות את טיוטת ההצעה, ולא את פרטי הנכס המאושרים לפני קבלתה.',
    'בצעו שינוי מדויק ומצומצם, הציגו תצוגה מקדימה, הזינו סיבה מועילה ושלחו לבדיקת האדמין.',
    'הסבירו איזה פרט לאורח תוקן, במקום לכתוב סיבה כללית כגון „עדכון”.',
    'ממתין לאדמין פירושו שאין החלטה; אושר פירושו שהתקבל; נדחה פירושו שהתוכן המאושר לא השתנה.',
    'סטטוס קבוע של אושר, נדחה או ממתין נפרד מהודעת הצלחה או שגיאה זמנית.',
  ]);

  addTopic('controls.rooms', [
    'Room content, photos and structure',
    'Controls for one exact Room: guest-facing content, gallery, occupancy, bed configuration, bathrooms and size in m².',
    'Content and gallery affect presentation; structure affects the factual capacity and layout of that Room.',
    'Confirm the Room identity, update only verified values and review every photo and structure field before submission.',
    'Record a double bed and a sofa bed as separate bed details for the selected Room.',
    'Where Admin review is required, approved content stays authoritative until the proposed content, photos or structure are accepted.',
    'Do not estimate occupancy, bathroom count or size; leave unavailable information unavailable until verified.',
  ], [
    'Treść, zdjęcia i struktura Apartamentu',
    'Funkcje jednego konkretnego Pokoju: treść dla gości, galeria, liczba gości, konfiguracja łóżek, łazienki i powierzchnia w m².',
    'Treść i galeria wpływają na prezentację; struktura wpływa na faktyczną pojemność i układ Apartamentu.',
    'Potwierdź Apartament, aktualizuj tylko sprawdzone wartości i przejrzyj każde zdjęcie oraz pole przed wysłaniem.',
    'Łóżko podwójne i rozkładana sofa powinny być zapisane jako osobne informacje dla wybranego Apartamentu.',
    'Gdy wymagana jest akceptacja Admina, zatwierdzona treść obowiązuje do przyjęcia propozycji treści, zdjęć lub struktury.',
    'Nie szacuj liczby gości, łazienek ani powierzchni; pozostaw informację niedostępną do czasu jej potwierdzenia.',
  ], [
    'תוכן, תמונות ומבנה החדר',
    'פקדים לחדר מדויק אחד: תוכן לאורחים, גלריה, תפוסה, סידור מיטות, חדרי רחצה וגודל במ״ר.',
    'התוכן והגלריה משפיעים על התצוגה; המבנה משפיע על הקיבולת והמבנה העובדתיים של החדר.',
    'אשרו את זהות החדר, עדכנו רק ערכים מאומתים ובדקו כל תמונה וכל שדה לפני השליחה.',
    'מיטה זוגית וספת מיטה צריכות להירשם כפרטי מיטה נפרדים עבור החדר שנבחר.',
    'כאשר נדרשת בדיקת אדמין, התוכן המאושר נשאר הקובע עד לאישור הצעת התוכן, התמונות או המבנה.',
    'אין להעריך תפוסה, מספר חדרי רחצה או גודל; השאירו מידע כלא זמין עד שניתן לאמת אותו.',
  ]);

  addTopic('controls.pricing', [
    'Pricing proposal and commercial totals',
    'Upper and Ground Room prices remain independent, with existing nightly-price tiers for guest count and minimum nights.',
    'Partner edits tiers, selects Preview, enters a reason and submits for Admin review; only an accepted proposal changes the live customer price.',
    'Check Room identity, guest-count tier, minimum-night threshold and nightly price in Preview before submitting.',
    'Changing a Ground tier leaves the matching Upper tier unchanged, even if both prices were equal before.',
    'Admin Accept applies the reviewed proposal; Reject leaves live pricing unchanged. Proposal status records the decision.',
    'Customer pays, CyprusEye commission and Partner receives are server-derived and read-only. Commission is exactly EUR 10 per allocated Room per rental night: both Rooms mean two commission units per night.',
  ], [
    'Propozycja ceny i wartości handlowe',
    'Ceny Górnego i Dolnego Apartamentu pozostają niezależne, z istniejącymi progami ceny za noc według liczby gości i minimalnej liczby nocy.',
    'Partner edytuje progi, wybiera Podgląd, podaje powód i wysyła do Admina; tylko zaakceptowana propozycja zmienia cenę aktywną dla klienta.',
    'Przed wysłaniem sprawdź w Podglądzie Apartament, liczbę gości, minimalną liczbę nocy i cenę za noc.',
    'Zmiana progu Dolnego Apartamentu nie zmienia progu Górnego, nawet jeśli wcześniej obie ceny były równe.',
    'Akceptuj stosuje sprawdzoną propozycję; Odrzuć pozostawia cennik bez zmian. Status propozycji zapisuje decyzję.',
    'Kwoty „Klient płaci”, „Prowizja CyprusEye” i „Partner otrzymuje” są wyliczane przez serwer i tylko do odczytu. Prowizja to dokładnie 10 EUR za przydzielony Pokój za noc; oba Pokoje oznaczają dwie jednostki prowizji za noc.',
  ], [
    'הצעת תמחור וסכומים מסחריים',
    'מחירי החדר העליון וחדר הקרקע נשארים עצמאיים, עם מדרגות מחיר ללילה לפי מספר אורחים ומינימום לילות.',
    'השותף עורך מדרגות, בוחר בתצוגה מקדימה, מזין סיבה ושולח לאדמין; רק הצעה שאושרה משנה את המחיר החי ללקוח.',
    'בדקו בתצוגה המקדימה את זהות החדר, מדרגת האורחים, מינימום הלילות והמחיר ללילה לפני השליחה.',
    'שינוי מדרגה של חדר הקרקע אינו משנה את מדרגת החדר העליון, גם אם המחירים היו זהים קודם.',
    'אישור האדמין מחיל את ההצעה שנבדקה; דחייה משאירה את התמחור החי ללא שינוי. סטטוס ההצעה מתעד את ההחלטה.',
    'הסכום שהלקוח משלם, עמלת CyprusEye והסכום שהשותף מקבל נגזרים מהשרת ומוצגים לקריאה בלבד. העמלה היא בדיוק 10 אירו לכל חדר שהוקצה, לכל ליל אירוח; שני החדרים הם שתי יחידות עמלה ללילה.',
  ]);

  addTopic('controls.calendar', [
    'External calendar setup and synchronization',
    'Reviewed inbound Booking.com, Airbnb and Generic iCal sources, each mapped to one exact Room.',
    'A ready enabled source imports blocked dates; disabling stops that source. No availability is sent outward.',
    'Choose provider and Room, submit the private URL, complete source review, then enable or use manual sync only when the capability is available.',
    'When the URL is missing, activation stays unavailable; a reviewed ready source can be enabled by an authorized control.',
    'Source changes require review: Admin Preview shows the safe impact, Accept applies it and Reject leaves the live source unchanged. Lifecycle distinguishes URL missing, ready, active, never synchronized and a safe synchronization warning.',
    'The private URL is never returned to either browser after submission. Manual synchronization is inbound only.',
  ], [
    'Konfiguracja i synchronizacja kalendarza zewnętrznego',
    'Sprawdzone źródła przychodzące Booking.com, Airbnb i Generic iCal, każde przypisane do jednego dokładnego Pokoju.',
    'Gotowe włączone źródło importuje zablokowane daty; wyłączenie je zatrzymuje. Dostępność nie jest wysyłana na zewnątrz.',
    'Wybierz dostawcę i Pokój, wyślij prywatny adres URL, zakończ weryfikację, a potem włącz lub użyj synchronizacji ręcznej, gdy funkcja jest dostępna.',
    'Gdy brakuje adresu URL, aktywacja jest niedostępna; sprawdzone gotowe źródło może włączyć uprawniona funkcja.',
    'Zmiany źródła wymagają weryfikacji: Podgląd Admina pokazuje bezpieczny wpływ, Akceptuj go stosuje, a Odrzuć pozostawia aktywne źródło bez zmian. Etap odróżnia brak adresu URL, gotowość, aktywność, brak synchronizacji i bezpieczne ostrzeżenie.',
    'Prywatny adres URL po wysłaniu nigdy nie wraca do żadnej przeglądarki. Synchronizacja ręczna jest wyłącznie przychodząca.',
  ], [
    'הגדרה וסנכרון של לוח שנה חיצוני',
    'מקורות נכנסים שנבדקו מ־Booking.com, מ־Airbnb ומ־Generic iCal, כאשר כל מקור ממופה לחדר מדויק אחד.',
    'מקור מוכן ומופעל מייבא תאריכים חסומים; השבתה עוצרת אותו. זמינות אינה נשלחת החוצה.',
    'בחרו ספק וחדר, שלחו את הכתובת הפרטית, השלימו בדיקה ואז הפעילו או השתמשו בסנכרון ידני רק כשהיכולת זמינה.',
    'כאשר הכתובת חסרה, ההפעלה נשארת לא זמינה; פקד מורשה יכול להפעיל מקור שנבדק ומוכן.',
    'שינויי מקור דורשים בדיקה: תצוגת האדמין מציגה את ההשפעה הבטוחה, אישור מחיל אותה ודחייה משאירה את המקור החי ללא שינוי. מחזור החיים מבחין בין כתובת חסרה, מוכן, פעיל, טרם סונכרן ואזהרת סנכרון בטוחה.',
    'הכתובת הפרטית לעולם אינה מוחזרת לאף אחד מהדפדפנים לאחר השליחה. סנכרון ידני הוא נכנס בלבד.',
  ]);

  addTopic('controls.bookings', [
    'Booking status, Room allocation and management',
    'The card shows only authorized Hotel information: dates, guests, status, allocation and exact totals where available.',
    'It is presentation-only and cannot change booking status or Room allocation.',
    'Read the exact values and open complete booking management through the existing secure action when further work is needed.',
    'For five to eight guests, an exact allocation can contain both named Rooms rather than a generic two-Room label.',
    'Status meanings are exact: Pending awaits confirmation, Confirmed is accepted, Completed has ended and Cancelled is no longer active. Actions remain in the complete management flow.',
    'A missing value is unavailable; it must not be interpreted as zero, false, pending, paid or unpaid.',
  ], [
    'Status rezerwacji, przydział Apartamentów i zarządzanie',
    'Karta pokazuje tylko autoryzowane dane Hotelu: daty, gości, status, przydział i dokładne kwoty, jeśli są dostępne.',
    'Służy wyłącznie do prezentacji i nie może zmienić statusu rezerwacji ani przydziału Apartamentów.',
    'Odczytaj dokładne wartości i otwórz pełne zarządzanie rezerwacją przez istniejącą bezpieczną funkcję.',
    'Dla pięciu–ośmiu gości dokładny przydział może zawierać oba nazwane Apartamenty zamiast ogólnej etykiety „dwa Pokoje”.',
    'Znaczenie statusów jest dokładne: Oczekująca czeka na potwierdzenie, Potwierdzona została przyjęta, Zakończona dobiegła końca, a Anulowana nie jest aktywna. Czynności pozostają w pełnym procesie zarządzania.',
    'Brakująca wartość jest niedostępna; nie oznacza zera, fałszu, oczekującej, zapłaconej ani niezapłaconej.',
  ], [
    'סטטוס הזמנה, הקצאת חדרים וניהול',
    'הכרטיס מציג רק מידע מורשה של המלון: תאריכים, אורחים, סטטוס, הקצאה וסכומים מדויקים כאשר הם זמינים.',
    'הוא מיועד לתצוגה בלבד ואינו יכול לשנות סטטוס הזמנה או הקצאת חדרים.',
    'קראו את הערכים המדויקים ופתחו את ניהול ההזמנה המלא דרך הפעולה המאובטחת הקיימת כשנדרשת עבודה נוספת.',
    'עבור חמישה עד שמונה אורחים, הקצאה מדויקת יכולה לכלול את שני החדרים בשמם במקום תווית כללית.',
    'משמעות הסטטוסים מדויקת: ממתינה מחכה לאישור, מאושרת התקבלה, הושלמה הסתיימה ובוטלה אינה פעילה עוד. הפעולות נשארות בתהליך הניהול המלא.',
    'ערך חסר אינו זמין; אין לפרש אותו כאפס, כשקר, כממתין, כשולם או כלא שולם.',
  ]);

  addTopic('controls.payments', [
    'Payment values and secure management',
    'A read-only summary of Customer pays, Paid, Remaining, CyprusEye commission, Partner receives, currency, state and safe reference where available.',
    'It creates no payment, payout, refund, invoice or payment-state change.',
    'Compare the server-derived values, then use the existing secure payment action for authorized work.',
    'When Paid or Remaining is not exact, it is unavailable instead of calculated in the browser.',
    'The secure management flow decides which actions are authorized; this workspace adds no direct payment mutation.',
    'Commission is read-only; Partner receives is server-derived and read-only. Commission is EUR 10 per allocated Room per rental night: one unit per Room per night and two when both Rooms are allocated.',
  ], [
    'Wartości płatności i bezpieczne zarządzanie',
    'Podsumowanie tylko do odczytu: Klient płaci, Zapłacono, Pozostało, prowizja CyprusEye, Partner otrzymuje, waluta, stan i bezpieczne oznaczenie.',
    'Nie tworzy płatności, wypłaty, zwrotu, faktury ani zmiany statusu płatności.',
    'Porównaj wartości wyliczone przez serwer, a potem użyj istniejącej bezpiecznej funkcji płatności do autoryzowanej pracy.',
    'Jeśli Zapłacono lub Pozostało nie jest dokładne, wartość jest niedostępna zamiast obliczana w przeglądarce.',
    'Bezpieczny proces określa dostępne czynności; panel nie dodaje bezpośredniej zmiany płatności.',
    'Prowizja jest tylko do odczytu, a kwota „Partner otrzymuje” jest wyliczana przez serwer. Prowizja to 10 EUR za przydzielony Pokój za noc: jedna jednostka prowizji za Pokój za noc i dwie dla obu Pokoi.',
  ], [
    'ערכי תשלום וניהול מאובטח',
    'תקציר לקריאה בלבד של הסכום שהלקוח משלם, הסכום ששולם, היתרה, עמלת CyprusEye, הסכום שהשותף מקבל, המטבע, המצב והפניה בטוחה כאשר הם זמינים.',
    'הוא אינו יוצר תשלום, העברת כספים, החזר, חשבונית או שינוי במצב התשלום.',
    'השוו בין הערכים שנגזרו מהשרת, ולאחר מכן השתמשו בפעולת התשלום המאובטחת הקיימת לעבודה מורשית.',
    'כאשר שולם או נותר לתשלום אינם מדויקים, הערך אינו זמין במקום להיות מחושב בדפדפן.',
    'התהליך המאובטח קובע אילו פעולות מורשות; סביבת העבודה אינה מוסיפה שינוי תשלום ישיר.',
    'העמלה מוצגת לקריאה בלבד; הסכום שהשותף מקבל נגזר מהשרת ומוצג לקריאה בלבד. העמלה היא 10 אירו לכל חדר שהוקצה, לכל ליל אירוח: יחידה אחת לחדר ללילה ושתיים כאשר שני החדרים הוקצו.',
  ]);

  deepFreeze(TOPICS);

  function languageOrEnglish(language) {
    return LANGUAGES.includes(language) ? language : 'en';
  }

  function direction(language) {
    return languageOrEnglish(language) === 'he' ? 'rtl' : 'ltr';
  }

  function topic(topicId, language = 'en') {
    if (typeof topicId !== 'string' || !Object.prototype.hasOwnProperty.call(TOPICS, topicId)) {
      fail(`Unknown help topic: ${String(topicId)}.`);
    }
    return TOPICS[topicId][languageOrEnglish(language)];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
  }

  function helpButton(topicId, options = {}) {
    if (!isObject(options)) fail('Help button options must be an object.');
    const allowed = ['language', 'className', 'label', 'section'];
    if (Object.keys(options).some((key) => !allowed.includes(key))) fail('Help button options contain an unexpected field.');
    const language = languageOrEnglish(options.language);
    const helpTopic = topic(topicId, language);
    const className = options.className === undefined ? '' : options.className;
    if (typeof className !== 'string' || !/^[a-zA-Z0-9 _-]*$/.test(className)) fail('Help button className is invalid.');
    if (options.section !== undefined && typeof options.section !== 'boolean') fail('Help button section must be boolean.');
    const label = options.label === undefined || options.label === null
      ? `${LABELS[language].help}: ${helpTopic.title}`
      : safeText(options.label, 'Help button label', { maximum: 200 });
    const classes = ['hotels-v2-help-trigger', className.trim()].filter(Boolean).join(' ');
    return `<button type="button" class="${escapeHtml(classes)}" data-hv2-help-topic="${escapeHtml(topicId)}"${options.section ? ' data-hv2-section-help' : ''} aria-label="${escapeHtml(label)}" aria-expanded="false" aria-controls="${DIALOG_ID}">?</button>`;
  }

  function validateNameI18n(value, label) {
    if (!isObject(value)) fail(`${label} must be an object.`);
    const keys = Object.keys(value);
    if (!keys.length || keys.some((key) => !LANGUAGES.includes(key))) fail(`${label} contains an unsupported language.`);
    keys.forEach((key) => {
      const entryValue = value[key];
      if (typeof entryValue !== 'string' || entryValue !== entryValue.trim() || entryValue.length > 200
          || /[\u0000-\u001f\u007f]/.test(entryValue)) fail(`${label}.${key} must be safe localized text.`);
    });
    if (!keys.some((key) => value[key].length > 0)) fail(`${label} requires at least one localized Room name.`);
    return clone(value);
  }

  function validatePayment(value, label) {
    if (value === null) return null;
    exactKeys(value, ['state', 'paid', 'remaining', 'cypruseye_commission', 'partner_net', 'currency'], label);
    return {
      state: safeText(value.state, `${label}.state`, { nullable: true, maximum: 80 }),
      paid: nullableMoney(value.paid, `${label}.paid`),
      remaining: nullableMoney(value.remaining, `${label}.remaining`),
      cypruseye_commission: nullableMoney(value.cypruseye_commission, `${label}.cypruseye_commission`),
      partner_net: nullableMoney(value.partner_net, `${label}.partner_net`),
      currency: nullableCurrency(value.currency, `${label}.currency`),
    };
  }

  function validatePresentation(value, options) {
    exactKeys(options, ['hotelId', 'scope'], 'Presentation validation options');
    const expectedHotelId = canonicalUuid(options.hotelId, 'Expected Hotel ID');
    if (!['admin', 'partner'].includes(options.scope)) fail('Presentation scope must be admin or partner.');
    exactKeys(value, [
      'contract_version', 'scope', 'hotel_id', 'generated_at', 'capabilities', 'summary', 'bookings',
    ], 'Bookings and Payments presentation');
    if (value.contract_version !== PRESENTATION_CONTRACT) fail('Bookings and Payments presentation contract is unsupported.');
    if (value.scope !== options.scope) fail('Bookings and Payments presentation scope does not match the request.');
    if (canonicalUuid(value.hotel_id, 'Presentation Hotel ID') !== expectedHotelId) {
      fail('Bookings and Payments presentation returned a different Hotel.');
    }
    isoTimestamp(value.generated_at, 'Presentation generated_at');

    exactKeys(value.capabilities, [
      'bookings_visible', 'payments_visible', 'full_booking_management', 'full_payment_management',
    ], 'Presentation capabilities');
    const capabilities = {
      bookings_visible: exactBoolean(value.capabilities.bookings_visible, 'capabilities.bookings_visible'),
      payments_visible: exactBoolean(value.capabilities.payments_visible, 'capabilities.payments_visible'),
      full_booking_management: exactBoolean(value.capabilities.full_booking_management, 'capabilities.full_booking_management'),
      full_payment_management: exactBoolean(value.capabilities.full_payment_management, 'capabilities.full_payment_management'),
    };

    exactKeys(value.summary, ['total_bookings', 'upcoming_bookings', 'current_recent_bookings'], 'Presentation summary');
    const summary = {
      total_bookings: nullableInteger(value.summary.total_bookings, 'summary.total_bookings'),
      upcoming_bookings: nullableInteger(value.summary.upcoming_bookings, 'summary.upcoming_bookings'),
      current_recent_bookings: nullableInteger(value.summary.current_recent_bookings, 'summary.current_recent_bookings'),
    };
    if (!capabilities.bookings_visible && Object.values(summary).some((count) => count !== null)) {
      fail('Hidden booking summary counts must remain unavailable.');
    }
    if (summary.total_bookings !== null && [summary.upcoming_bookings, summary.current_recent_bookings]
      .some((count) => count !== null && count > summary.total_bookings)) {
      fail('Booking summary counts exceed the authorized total.');
    }

    if (!Array.isArray(value.bookings) || value.bookings.length > 200) fail('Presentation bookings must be a bounded array.');
    if (!capabilities.bookings_visible && value.bookings.length) fail('Hidden bookings must not be returned.');
    if (summary.total_bookings !== null && value.bookings.length > summary.total_bookings) {
      fail('Returned bookings exceed the authorized summary total.');
    }

    const seenBookings = new Set();
    const bookings = value.bookings.map((booking, bookingIndex) => {
      const label = `bookings[${bookingIndex}]`;
      exactKeys(booking, [
        'booking_id', 'reference', 'status', 'arrival_date', 'departure_date', 'guest_count',
        'allocation', 'customer_total', 'currency', 'payment',
      ], label);
      const bookingId = canonicalUuid(booking.booking_id, `${label}.booking_id`);
      if (seenBookings.has(bookingId)) fail('Presentation contains a duplicate booking.');
      seenBookings.add(bookingId);
      const arrivalDate = isoDate(booking.arrival_date, `${label}.arrival_date`);
      const departureDate = isoDate(booking.departure_date, `${label}.departure_date`);
      if (departureDate <= arrivalDate) fail(`${label} departure must follow arrival.`);
      const guestCount = booking.guest_count === null ? null : nullableInteger(booking.guest_count, `${label}.guest_count`);
      if (guestCount !== null && (guestCount < 1 || guestCount > 100)) fail(`${label}.guest_count is outside the safe range.`);
      if (!Array.isArray(booking.allocation) || booking.allocation.length > 100) {
        fail(`${label}.allocation must be a bounded array.`);
      }
      const seenRooms = new Set();
      const allocation = booking.allocation.map((room, roomIndex) => {
        const roomLabel = `${label}.allocation[${roomIndex}]`;
        exactKeys(room, ['room_type_id', 'room_name_i18n', 'units'], roomLabel);
        const roomTypeId = canonicalUuid(room.room_type_id, `${roomLabel}.room_type_id`);
        if (seenRooms.has(roomTypeId)) fail(`${label}.allocation contains a duplicate Room.`);
        seenRooms.add(roomTypeId);
        if (!Number.isSafeInteger(room.units) || room.units < 1 || room.units > 100) {
          fail(`${roomLabel}.units must be a safe positive integer.`);
        }
        return {
          room_type_id: roomTypeId,
          room_name_i18n: validateNameI18n(room.room_name_i18n, `${roomLabel}.room_name_i18n`),
          units: room.units,
        };
      });
      const currency = nullableCurrency(booking.currency, `${label}.currency`);
      const customerTotal = nullableMoney(booking.customer_total, `${label}.customer_total`);
      const payment = validatePayment(booking.payment, `${label}.payment`);
      if (customerTotal !== null && currency === null) fail(`${label} customer total requires an exact currency.`);
      if (payment && [payment.paid, payment.remaining, payment.cypruseye_commission, payment.partner_net]
        .some((amount) => amount !== null) && payment.currency === null && currency === null) {
        fail(`${label} payment money requires an exact currency.`);
      }
      if (!capabilities.payments_visible && payment !== null) fail('Payment details were returned without payment visibility.');
      if (payment && payment.currency !== null && currency !== null && payment.currency !== currency) {
        fail(`${label} payment currency does not match the booking currency.`);
      }
      return {
        booking_id: bookingId,
        reference: safeText(booking.reference, `${label}.reference`, { nullable: true, maximum: 120 }),
        status: safeText(booking.status, `${label}.status`, { nullable: true, maximum: 80 }),
        arrival_date: arrivalDate,
        departure_date: departureDate,
        guest_count: guestCount,
        allocation,
        customer_total: customerTotal,
        currency,
        payment,
      };
    });

    return deepFreeze({
      contract_version: PRESENTATION_CONTRACT,
      scope: value.scope,
      hotel_id: value.hotel_id,
      generated_at: value.generated_at,
      capabilities,
      summary,
      bookings,
    });
  }

  function unavailablePresentation(options) {
    exactKeys(options, [
      'hotelId', 'scope', 'bookingsVisible', 'paymentsVisible', 'fullBookingManagement',
      'fullPaymentManagement', 'upcomingBookings',
    ], 'Unavailable presentation options');
    const hotelId = canonicalUuid(options.hotelId, 'Unavailable presentation Hotel ID');
    if (!['admin', 'partner'].includes(options.scope)) fail('Unavailable presentation scope must be admin or partner.');
    ['bookingsVisible', 'paymentsVisible', 'fullBookingManagement', 'fullPaymentManagement']
      .forEach((key) => exactBoolean(options[key], `Unavailable presentation ${key}`));
    const upcoming = nullableInteger(options.upcomingBookings, 'Unavailable presentation upcomingBookings');
    if (options.scope === 'partner' && upcoming !== null) {
      fail('Partner unavailable presentation cannot synthesize an upcoming booking count.');
    }
    if (!options.bookingsVisible && upcoming !== null) fail('Hidden bookings cannot expose an upcoming count.');
    return validatePresentation({
      contract_version: PRESENTATION_CONTRACT,
      scope: options.scope,
      hotel_id: hotelId,
      generated_at: new Date().toISOString(),
      capabilities: {
        bookings_visible: options.bookingsVisible,
        payments_visible: options.paymentsVisible,
        full_booking_management: options.fullBookingManagement,
        full_payment_management: options.fullPaymentManagement,
      },
      summary: { total_bookings: null, upcoming_bookings: upcoming, current_recent_bookings: null },
      bookings: [],
    }, { hotelId, scope: options.scope });
  }

  function hasOnlyKeys(value, allowed) {
    return isObject(value) && Object.keys(value).every((key) => allowed.includes(key));
  }

  function presentationFromAvailability(options) {
    exactKeys(options, [
      'hotelId', 'scope', 'availability', 'rooms', 'bookingsVisible',
      'paymentsVisible', 'fullBookingManagement', 'fullPaymentManagement', 'upcomingBookings',
    ], 'Availability presentation options');
    const hotelId = canonicalUuid(options.hotelId, 'Availability presentation Hotel ID');
    if (!['admin', 'partner'].includes(options.scope)) fail('Availability presentation scope must be admin or partner.');
    ['bookingsVisible', 'paymentsVisible', 'fullBookingManagement', 'fullPaymentManagement']
      .forEach((key) => exactBoolean(options[key], `Availability presentation ${key}`));
    if (options.paymentsVisible) fail('Availability cannot provide a payment presentation.');
    const upcoming = nullableInteger(options.upcomingBookings, 'Availability presentation upcomingBookings');
    if (!options.bookingsVisible) {
      if (upcoming !== null) fail('Hidden bookings cannot expose an upcoming count.');
      return unavailablePresentation({
        hotelId,
        scope: options.scope,
        bookingsVisible: false,
        paymentsVisible: false,
        fullBookingManagement: options.fullBookingManagement,
        fullPaymentManagement: options.fullPaymentManagement,
        upcomingBookings: null,
      });
    }
    if (!isObject(options.availability)) fail('Availability presentation requires an exact availability object.');
    const availabilityKeys = [
      'contract_version', 'hotel_id', 'from', 'to', 'snapshot_token', 'snapshot_as_of',
      'snapshot_valid_until', 'property', 'room_types', 'room_rates', 'units', 'cells',
      'product_cells', 'daily_inventory', 'unit_calendar_blocks', 'operational_overrides',
      'rate_rule_operational_restrictions', 'booking_allocations', 'holds',
      'unmapped_booking_blockers', 'recent_activity', 'public_change',
    ];
    exactKeys(options.availability, availabilityKeys, 'Availability presentation source');
    if (canonicalUuid(options.availability.hotel_id, 'Availability presentation source Hotel ID') !== hotelId) {
      fail('Availability presentation source belongs to another Hotel.');
    }
    if (!Array.isArray(options.rooms) || options.rooms.length > 1000) fail('Availability presentation Rooms must be bounded.');
    const allowedRoomKeys = [
      'id', 'hotel_id', 'code', 'name_i18n', 'description_i18n', 'gallery', 'capacity_adults',
      'capacity_children', 'max_occupancy', 'bed_configuration', 'bathrooms', 'size_sqm',
      'amenities', 'inventory_mode', 'base_inventory_count', 'status', 'sort_order',
      'floor_label_i18n', 'version', 'updated_at',
    ];
    const rooms = new Map();
    options.rooms.forEach((room, index) => {
      if (!hasOnlyKeys(room, allowedRoomKeys) || !Object.prototype.hasOwnProperty.call(room, 'id')
          || !Object.prototype.hasOwnProperty.call(room, 'name_i18n')) {
        fail(`Availability presentation rooms[${index}] has an unsafe field envelope.`);
      }
      const id = canonicalUuid(room.id, `Availability presentation rooms[${index}].id`);
      if (room.hotel_id !== undefined && canonicalUuid(room.hotel_id, `Availability presentation rooms[${index}].hotel_id`) !== hotelId) {
        fail('Availability presentation contains a Room from another Hotel.');
      }
      if (rooms.has(id)) fail('Availability presentation contains a duplicate Room.');
      rooms.set(id, validateNameI18n(room.name_i18n, `Availability presentation rooms[${index}].name_i18n`));
    });

    const sourceAllocations = options.availability.booking_allocations;
    if (!Array.isArray(sourceAllocations) || sourceAllocations.length > 50000) {
      fail('Availability presentation booking allocations must be bounded.');
    }
    const allocationKeys = [
      'id', 'booking_id', 'arrival_date', 'departure_date', 'current_booking_updated_at',
      'current_booking_status', 'room_type_id', 'rate_plan_id', 'room_rate_id', 'unit_ids',
      'units_required', 'allocated_guest_counts', 'pricing_guest_counts', 'booking_updated_at',
      'status', 'version', 'updated_at', 'active_commitment_from', 'active_commitment_to',
      'active_commitments',
    ];
    const groups = new Map();
    const seenAllocationIds = new Set();
    sourceAllocations.forEach((row, index) => {
      const label = `Availability presentation bookingAllocations[${index}]`;
      exactKeys(row, allocationKeys, label);
      const allocationId = canonicalUuid(row.id, `${label}.id`);
      const bookingId = canonicalUuid(row.booking_id, `${label}.booking_id`);
      const roomTypeId = canonicalUuid(row.room_type_id, `${label}.room_type_id`);
      if (seenAllocationIds.has(allocationId)) fail('Availability presentation contains a duplicate allocation.');
      seenAllocationIds.add(allocationId);
      if (!rooms.has(roomTypeId)) fail('Availability presentation allocation refers to an unknown Room.');
      const arrivalDate = isoDate(row.arrival_date, `${label}.arrival_date`);
      const departureDate = isoDate(row.departure_date, `${label}.departure_date`);
      if (departureDate <= arrivalDate) fail(`${label} departure must follow arrival.`);
      isoTimestamp(row.current_booking_updated_at, `${label}.current_booking_updated_at`);
      const bookingStatus = safeText(row.current_booking_status, `${label}.current_booking_status`, { maximum: 80 });
      if (!['active', 'released'].includes(row.status)) fail(`${label}.status is unsupported.`);
      if (!Number.isSafeInteger(row.units_required) || row.units_required < 1 || row.units_required > 100) {
        fail(`${label}.units_required is invalid.`);
      }
      if (!Array.isArray(row.allocated_guest_counts) || row.allocated_guest_counts.length !== row.units_required
          || row.allocated_guest_counts.some((count) => !Number.isSafeInteger(count) || count < 1 || count > 50)) {
        fail(`${label}.allocated_guest_counts is invalid.`);
      }
      if (!Array.isArray(row.pricing_guest_counts) || row.pricing_guest_counts.length !== row.units_required
          || row.pricing_guest_counts.some((count) => !Number.isSafeInteger(count) || count < 1 || count > 50)) {
        fail(`${label}.pricing_guest_counts is invalid.`);
      }
      if (!Array.isArray(row.unit_ids) || !Array.isArray(row.active_commitments)) fail(`${label} nested collections are invalid.`);
      const current = groups.get(bookingId);
      if (current && (current.arrival_date !== arrivalDate || current.departure_date !== departureDate
          || current.status !== bookingStatus)) {
        fail('Availability presentation contains inconsistent rows for one booking.');
      }
      const group = current || {
        booking_id: bookingId,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        status: bookingStatus,
        active: [],
      };
      if (row.status === 'active') group.active.push({
        room_type_id: roomTypeId,
        room_name_i18n: rooms.get(roomTypeId),
        units: row.units_required,
        guests: [...row.allocated_guest_counts],
      });
      groups.set(bookingId, group);
    });

    const bookings = Array.from(groups.values()).map((group) => {
      if (new Set(group.active.map((row) => row.room_type_id)).size !== group.active.length) {
        fail('Availability presentation contains duplicate active allocation for one Room.');
      }
      const guests = group.active.flatMap((row) => row.guests);
      const guestCount = guests.length ? guests.reduce((sum, count) => sum + count, 0) : null;
      return {
        booking_id: group.booking_id,
        reference: null,
        status: group.status,
        arrival_date: group.arrival_date,
        departure_date: group.departure_date,
        guest_count: guestCount,
        allocation: group.active.map(({ room_type_id, room_name_i18n, units }) => ({
          room_type_id, room_name_i18n, units,
        })),
        customer_total: null,
        currency: null,
        payment: null,
      };
    }).sort((left, right) => left.arrival_date.localeCompare(right.arrival_date)
      || left.booking_id.localeCompare(right.booking_id));

    return validatePresentation({
      contract_version: PRESENTATION_CONTRACT,
      scope: options.scope,
      hotel_id: hotelId,
      generated_at: new Date().toISOString(),
      capabilities: {
        bookings_visible: true,
        payments_visible: false,
        full_booking_management: options.fullBookingManagement,
        full_payment_management: options.fullPaymentManagement,
      },
      summary: { total_bookings: null, upcoming_bookings: upcoming, current_recent_bookings: null },
      bookings,
    }, { hotelId, scope: options.scope });
  }

  function createSurface(documentObject) {
    const dialog = documentObject.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.className = 'hotels-v2-help-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', DIALOG_TITLE_ID);

    const surface = documentObject.createElement('div');
    surface.className = 'hotels-v2-help-dialog__surface';
    const header = documentObject.createElement('header');
    header.className = 'hotels-v2-help-dialog__header';
    const titleElement = documentObject.createElement('h2');
    titleElement.id = DIALOG_TITLE_ID;
    titleElement.tabIndex = -1;
    const closeButton = documentObject.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'hotels-v2-help-dialog__close';
    closeButton.setAttribute('data-hv2-help-close', '');
    closeButton.textContent = '×';
    header.append(titleElement, closeButton);
    const body = documentObject.createElement('div');
    body.className = 'hotels-v2-help-dialog__body';
    body.setAttribute('data-hv2-help-body', '');
    surface.append(header, body);
    dialog.append(surface);
    (documentObject.body || documentObject.documentElement).append(dialog);
    return { dialog, surface, titleElement, closeButton, body, activeController: null };
  }

  function sharedSurface(documentObject) {
    let shared = SHARED_SURFACES.get(documentObject);
    if (!shared) {
      shared = createSurface(documentObject);
      SHARED_SURFACES.set(documentObject, shared);
    }
    return shared;
  }

  function createController({ root, language = 'en', role = 'partner' }) {
    if (!root || typeof root.addEventListener !== 'function' || typeof root.querySelectorAll !== 'function') {
      fail('Help controller root must be a Document or Element.');
    }
    if (!['partner', 'admin'].includes(role)) fail('Help controller role must be partner or admin.');
    const documentObject = root.nodeType === 9 ? root : root.ownerDocument;
    if (!documentObject || typeof documentObject.createElement !== 'function') fail('Help controller requires a document.');
    const shared = sharedSurface(documentObject);
    let languageSource = language;
    let activeTrigger = null;
    let activeTopic = null;
    let destroyed = false;

    function currentLanguage() {
      return languageOrEnglish(typeof languageSource === 'function' ? languageSource() : languageSource);
    }

    function triggers() {
      return Array.from(root.querySelectorAll('[data-hv2-help-topic]'));
    }

    function syncTriggerLabels() {
      const activeLanguage = currentLanguage();
      triggers().forEach((trigger) => {
        const topicId = trigger.getAttribute('data-hv2-help-topic');
        const helpTopic = topic(topicId, activeLanguage, role);
        trigger.setAttribute('type', 'button');
        trigger.setAttribute('aria-controls', DIALOG_ID);
        trigger.setAttribute('aria-label', `${LABELS[activeLanguage].help}: ${helpTopic.title}`);
        if (!trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');
      });
    }

    function setExpanded(trigger) {
      triggers().forEach((candidate) => candidate.setAttribute('aria-expanded', candidate === trigger ? 'true' : 'false'));
    }

    function render(topicId) {
      const activeLanguage = currentLanguage();
      const helpTopic = topic(topicId, activeLanguage, role);
      const labels = LABELS[activeLanguage];
      shared.dialog.lang = activeLanguage;
      shared.dialog.dir = direction(activeLanguage);
      shared.titleElement.textContent = helpTopic.title;
      shared.closeButton.setAttribute('aria-label', labels.close);
      const sections = HELP_FIELDS.slice(1).map((field) => {
        const section = documentObject.createElement('section');
        const heading = documentObject.createElement('h3');
        const paragraph = documentObject.createElement('p');
        heading.textContent = labels[field];
        paragraph.textContent = helpTopic[field];
        section.append(heading, paragraph);
        return section;
      });
      shared.body.replaceChildren(...sections);
      syncTriggerLabels();
    }

    function restoreFocus() {
      const trigger = activeTrigger;
      activeTrigger = null;
      activeTopic = null;
      setExpanded(null);
      if (trigger && typeof trigger.focus === 'function' && trigger.isConnected !== false) trigger.focus();
    }

    function close() {
      if (shared.activeController !== controller) return;
      shared.activeController = null;
      if (shared.dialog.open && typeof shared.dialog.close === 'function') {
        shared.dialog.close();
      } else {
        shared.dialog.removeAttribute('open');
      }
      restoreFocus();
    }

    function open(topicId, trigger = null) {
      if (destroyed) fail('Help controller has been destroyed.');
      topic(topicId, currentLanguage(), role);
      if (shared.activeController && shared.activeController !== controller) shared.activeController.close();
      if (activeTrigger && activeTrigger !== trigger) activeTrigger.setAttribute('aria-expanded', 'false');
      activeTrigger = trigger;
      activeTopic = topicId;
      render(topicId);
      setExpanded(trigger);
      shared.activeController = controller;
      if (!shared.dialog.open) {
        if (typeof shared.dialog.showModal === 'function') shared.dialog.showModal();
        else shared.dialog.setAttribute('open', '');
      }
      shared.closeButton.focus();
    }

    function rootClick(event) {
      const trigger = event.target?.closest?.('[data-hv2-help-topic]');
      if (!trigger || !root.contains(trigger)) return;
      event.preventDefault();
      open(trigger.getAttribute('data-hv2-help-topic'), trigger);
    }

    function dialogClick(event) {
      if (shared.activeController !== controller) return;
      if (event.target === shared.dialog || event.target?.closest?.('[data-hv2-help-close]')) close();
    }

    function documentPointerDown(event) {
      if (shared.activeController !== controller || !shared.dialog.open) return;
      if (!shared.surface.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }

    function dialogKeydown(event) {
      if (shared.activeController === controller && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }

    function dialogClose() {
      if (shared.activeController !== controller) return;
      shared.activeController = null;
      restoreFocus();
    }

    function setLanguage(nextLanguage) {
      languageSource = nextLanguage;
      syncTriggerLabels();
      if (activeTopic && shared.activeController === controller) render(activeTopic);
    }

    function destroy() {
      if (destroyed) return;
      if (shared.activeController === controller) close();
      root.removeEventListener('click', rootClick);
      shared.dialog.removeEventListener('click', dialogClick);
      shared.dialog.removeEventListener('keydown', dialogKeydown);
      shared.dialog.removeEventListener('close', dialogClose);
      documentObject.removeEventListener('pointerdown', documentPointerDown, true);
      destroyed = true;
    }

    const controller = Object.freeze({
      open,
      close,
      destroy,
      setLanguage,
      get openTopic() { return activeTopic; },
    });
    syncTriggerLabels();
    root.addEventListener('click', rootClick);
    shared.dialog.addEventListener('click', dialogClick);
    shared.dialog.addEventListener('keydown', dialogKeydown);
    shared.dialog.addEventListener('close', dialogClose);
    documentObject.addEventListener('pointerdown', documentPointerDown, true);
    return controller;
  }

  return Object.freeze({
    LANGUAGES,
    TOPICS,
    PRESENTATION_CONTRACT,
    DIALOG_ID,
    direction,
    topic,
    getTopic: topic,
    helpButton,
    createController,
    validatePresentation,
    unavailablePresentation,
    presentationFromAvailability,
  });
});
