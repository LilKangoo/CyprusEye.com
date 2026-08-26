(function attachHotelsV2PartnerWorkspace(root, factory) {
  const api = factory(root.HotelsV2PartnerWorkspaceCore, root.HotelsV2PartnerWorkspaceRepository, root.HotelsV2PartnerMedia, root);
  root.HotelsV2PartnerWorkspace = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2PartnerWorkspace(Core, Repository, Media, root) {
  'use strict';

  const COPY = Object.freeze({
    en: {
      openWorkspace: 'Open workspace', back: 'Back to Hotel bookings', refresh: 'Refresh exact workspace',
      workspace: 'Hotel workspace', loading: 'Loading exact assigned Hotel…', overview: 'Overview',
      property: 'Property', rooms: 'Rooms', pricing: 'Rates & Pricing', availability: 'Calendar',
      bookings: 'Bookings', payments: 'Payments', access: 'Exact access', publicOff: 'Legacy public behavior remains authoritative. Hotels V2 flags remain OFF.',
      adminReview: 'Property changes are saved as a proposal for Admin review. They do not change the public Hotel.',
      noUpload: 'Only existing Admin-managed Hotel media can be selected. Upload is not available in this stage.',
      review: 'Review', reviewTitle: 'Review exact Hotel change', cancel: 'Cancel', save: 'Save reviewed change',
      noChange: 'No semantic change. Nothing can be saved.', saved: 'Reviewed change saved. The exact workspace was refreshed.',
      stale: 'State changed after Review. Reload and review again; nothing was retried.',
      unavailable: 'This capability is not available for the exact assignment.', future: 'This capability is recorded but remains unavailable in this stage.',
      existingFlow: 'Open existing flow', technical: 'Technical diagnostics', reason: 'Reason for Admin/audit',
      content: 'Property content proposal', photos: 'Property photos proposal', editContent: 'Edit content',
      editPhotos: 'Edit photos', editStructure: 'Edit structure', createRoom: 'Create draft Room',
      roomContent: 'Room content', roomPhotos: 'Room photos', roomStructure: 'Room structure',
      basePrice: 'Room base nightly price', sharedTier: 'Shared schedule tier price', directTier: 'Independent occupancy tier price', exactDate: 'Exact-date nightly price',
      customerPrice: 'Customer price', commission: 'CyprusEye commission', partnerNet: 'Partner net', readOnly: 'Read-only server result',
      stayPreview: 'Commercial stay preview', previewStay: 'Preview exact stay', notCalculated: 'Not calculated',
      dailyInventory: 'Daily inventory', set: 'Set', clear: 'Clear', unchanged: 'No change', closed: 'Closed', open: 'Open',
      pendingReview: 'Pending Admin review', blocked: 'Mutation blocked by the server contract',
      language: 'Workspace language', empty: 'Nothing is configured for this section.', impacted: 'Exact affected scope',
      amenities: 'Amenities', latitude: 'Latitude', longitude: 'Longitude', photo: 'Photo', cover: 'Cover', order: 'Order',
      code: 'Code', maximumOccupancy: 'Maximum occupancy', bathrooms: 'Bathrooms', size: 'Size m²', baseInventory: 'Base inventory', inventoryMode: 'Inventory mode',
      capacityAdults: 'Adult capacity', capacityChildren: 'Child capacity', sortOrder: 'Sort order', pooled: 'Pooled', unitized: 'Unitized',
      bedConfiguration: 'Bed configuration', bedType: 'Bed type', quantity: 'Quantity', addBed: 'Add bed', remove: 'Remove',
      notConfirmed: 'Requires review — not confirmed', fieldConfigured: 'Configured', photosCount: 'photos', amenitiesCount: 'amenities',
      splitNotConfirmed: 'Adult/child split requires review', noneConfigured: 'none configured',
      confirmed: 'Confirmed', missingUnknown: 'Missing / unknown',
      singleBed: 'Single', doubleBed: 'Double', sofaBed: 'Sofa bed', bunkBed: 'Bunk bed', kingBed: 'King', queenBed: 'Queen', otherBed: 'Other',
      bedLabelRequired: 'Add at least one localized label for an Other bed.',
      bedConfigurationInvalid: 'Each bed needs a valid type and a whole-number quantity from 1 to 20.',
      priceField: 'Price field', exactProduct: 'Exact product', stayDate: 'Stay date', nightlyPrice: 'Nightly price',
      checkIn: 'Check-in', checkOut: 'Check-out', adults: 'Adults', childAges: 'Child ages', ratePlan: 'Rate Plan', room: 'Room', allocation: 'Allocation', automatic: 'Automatic',
      sellableUnits: 'Sellable units', units: 'Units', closure: 'Closure', expiry: 'Expiry', futureExpiry: 'Future expiry', before: 'Before', after: 'After',
      active: 'Active', inactive: 'Inactive', draft: 'Draft', disabled: 'Disabled', requiresReview: 'Requires review', reviewed: 'Reviewed', guests: 'guests', nights: 'nights',
      authoritativeOnly: 'Base-price editing is available only for products whose base price is authoritative.', coverError: 'The cover image must remain among the selected photos.',
      expiryError: 'Choose a valid expiry strictly in the future.', contractImmutable: 'This Hotel pricing contract is immutable for Partner editing.',
      exactDateExampleRequired: 'Preview and retain a successful exact stay that includes this Room Rate and stay date before creating a new exact-date price.',
      upload: 'Upload selected photos', uploading: 'Uploading optimized WebP photos…', uploadReady: 'Uploaded photos were added. Review and Save to attach them.',
      uploadPartial: 'Only some photos uploaded. Nothing was retried or deleted. The successful photos remain available below; inspect them before Review.',
      uploadOutputTooLarge: 'The optimized WebP photo must be non-empty and no larger than 10 MB.',
      title: 'Name', name: 'Name', description: 'Description', floor: 'Floor', city: 'City', addressLine: 'Address', district: 'District / area', postalCode: 'Postcode', country: 'Country', mapsUrl: 'Google Maps URL',
      bookingChanges: 'Booking changes', stripeOnboarding: 'Stripe onboarding', update: 'Update', create: 'Create', upsert: 'Create or update',
      commissionBasis: 'Commission basis', exampleBefore: 'Example stay before', exampleAfter: 'Example stay after',
      percentBooking: 'of booking total', perRoomNight: 'per allocated Room per rental night',
      ratePlans: 'Rate Plans', roomRateProducts: 'Room Rate products', commissionPolicy: 'CyprusEye commission policy',
      pricingSource: 'Pricing source', currentNightlyPrice: 'Current customer nightly price', editableBasePrice: 'Base price editable with Review',
      tierOwnedPrice: 'Price is owned by its reviewed schedule or occupancy tier', immutableCommercialRule: 'Immutable commercial rule returned by the server',
      exactStayCustomerTotal: 'Exact stay customer total', customerSellingPrice: 'Customer selling price for the reviewed price unit',
      mediaUnavailable: 'Partner Hotel media upload is unavailable.',
      externalCalendars: 'External calendars', externalCalendarCreate: 'Add iCal source', externalCalendarEdit: 'Edit source',
      calendarProvider: 'Provider', bookingCom: 'Booking.com', airbnb: 'Airbnb', genericIcal: 'Generic iCal',
      calendarProviderNote: 'All provider options use an ICS export URL. Provider is saved separately from the source code.',
      configured: 'Configured (URL hidden)', notConfigured: 'Not configured', setUrl: 'Set URL', rotateUrl: 'Rotate URL', clearUrl: 'Clear URL',
      enableSource: 'Enable', disableSource: 'Disable', triggerSync: 'Run manual sync', activationOff: 'Enable is unavailable while the global external-calendar flag is OFF.',
      syncUnavailable: 'Manual sync requires an enabled source and global activation.',
      intervalMinutes: 'Sync interval (minutes)', unitsPerEvent: 'Units per event', priority: 'Priority', health: 'Sanitized sync health',
      attempts: 'Last attempt', success: 'Last success', failure: 'Last failure', events: 'Events', activeEvents: 'Active events', blocks: 'Blocks',
      calendarUrl: 'Private HTTPS iCal URL', calendarUrlNeverShown: 'The URL is sent only for this reviewed Save and is never displayed again.',
      never_synced: 'Never synced', healthy: 'Healthy', degraded: 'Degraded', syncing: 'Syncing',
      locationUnknown: 'Location not specified', allOff: 'All capabilities OFF', assignedHotels: 'exact assigned Hotels', loadingAssignments: 'Loading exact assigned Hotels…',
    },
    pl: {
      openWorkspace: 'Otwórz panel', back: 'Wróć do rezerwacji hotelowych', refresh: 'Odśwież dokładny panel',
      workspace: 'Panel hotelu', loading: 'Ładowanie przypisanego hotelu…', overview: 'Przegląd',
      property: 'Obiekt', rooms: 'Pokoje', pricing: 'Plany i ceny', availability: 'Kalendarz',
      bookings: 'Rezerwacje', payments: 'Płatności', access: 'Dokładny dostęp', publicOff: 'Publiczne działanie legacy pozostaje nadrzędne. Flagi Hotels V2 są WYŁĄCZONE.',
      adminReview: 'Zmiany obiektu zapisują się jako propozycja do weryfikacji przez Admina. Nie zmieniają publicznego hotelu.',
      noUpload: 'Można wybierać tylko istniejące media zarządzane przez Admina. Wysyłanie plików nie jest dostępne na tym etapie.',
      review: 'Sprawdź', reviewTitle: 'Sprawdź dokładną zmianę hotelu', cancel: 'Anuluj', save: 'Zapisz sprawdzoną zmianę',
      noChange: 'Brak zmiany semantycznej. Nie ma nic do zapisania.', saved: 'Sprawdzona zmiana zapisana. Dokładny panel został odświeżony.',
      stale: 'Stan zmienił się po weryfikacji. Odśwież i sprawdź ponownie; niczego nie ponowiono automatycznie.',
      unavailable: 'Ta możliwość nie jest dostępna dla dokładnego przypisania.', future: 'Ta możliwość jest zapisana, ale pozostaje niedostępna na tym etapie.',
      existingFlow: 'Otwórz istniejący proces', technical: 'Diagnostyka techniczna', reason: 'Powód dla Admina/audytu',
      content: 'Propozycja treści obiektu', photos: 'Propozycja zdjęć obiektu', editContent: 'Edytuj treść',
      editPhotos: 'Edytuj zdjęcia', editStructure: 'Edytuj strukturę', createRoom: 'Utwórz szkic pokoju',
      roomContent: 'Treść pokoju', roomPhotos: 'Zdjęcia pokoju', roomStructure: 'Struktura pokoju',
      basePrice: 'Bazowa cena pokoju za noc', sharedTier: 'Cena progu wspólnego harmonogramu', directTier: 'Cena niezależnego progu obłożenia', exactDate: 'Cena za noc dla dokładnej daty',
      customerPrice: 'Cena klienta', commission: 'Prowizja CyprusEye', partnerNet: 'Kwota Partnera', readOnly: 'Wynik serwera tylko do odczytu',
      stayPreview: 'Podgląd komercyjny pobytu', previewStay: 'Wyświetl dokładny pobyt', notCalculated: 'Nie obliczono',
      dailyInventory: 'Dzienny stan sprzedaży', set: 'Ustaw', clear: 'Wyczyść', unchanged: 'Bez zmiany', closed: 'Zamknięte', open: 'Otwarte',
      pendingReview: 'Oczekuje na Admina', blocked: 'Zmiana zablokowana przez kontrakt serwera',
      language: 'Język panelu', empty: 'Brak konfiguracji w tej sekcji.', impacted: 'Dokładny zakres wpływu',
      amenities: 'Udogodnienia', latitude: 'Szerokość geograficzna', longitude: 'Długość geograficzna', photo: 'Zdjęcie', cover: 'Okładka', order: 'Kolejność',
      code: 'Kod', maximumOccupancy: 'Maksymalna liczba gości', bathrooms: 'Łazienki', size: 'Powierzchnia m²', baseInventory: 'Bazowy stan', inventoryMode: 'Tryb inwentarza',
      capacityAdults: 'Miejsca dla dorosłych', capacityChildren: 'Miejsca dla dzieci', sortOrder: 'Kolejność', pooled: 'Wspólny', unitized: 'Jednostkowy',
      bedConfiguration: 'Konfiguracja łóżek', bedType: 'Rodzaj łóżka', quantity: 'Liczba', addBed: 'Dodaj łóżko', remove: 'Usuń',
      notConfirmed: 'Wymaga weryfikacji — niepotwierdzone', fieldConfigured: 'Skonfigurowano', photosCount: 'zdjęć', amenitiesCount: 'udogodnień',
      splitNotConfirmed: 'Podział dorośli/dzieci wymaga weryfikacji', noneConfigured: 'brak skonfigurowanych',
      confirmed: 'Potwierdzone', missingUnknown: 'Brak / nieznane',
      singleBed: 'Pojedyncze', doubleBed: 'Podwójne', sofaBed: 'Sofa', bunkBed: 'Piętrowe', kingBed: 'King', queenBed: 'Queen', otherBed: 'Inne',
      bedLabelRequired: 'Dodaj co najmniej jedną nazwę językową dla innego łóżka.',
      bedConfigurationInvalid: 'Każde łóżko wymaga prawidłowego typu i pełnej liczby od 1 do 20.',
      priceField: 'Pole ceny', exactProduct: 'Dokładny produkt', stayDate: 'Data pobytu', nightlyPrice: 'Cena za noc',
      checkIn: 'Przyjazd', checkOut: 'Wyjazd', adults: 'Dorośli', childAges: 'Wiek dzieci', ratePlan: 'Plan taryfowy', room: 'Pokój', allocation: 'Reguła przydziału', automatic: 'Automatycznie',
      sellableUnits: 'Jednostki do sprzedaży', units: 'Liczba jednostek', closure: 'Zamknięcie', expiry: 'Wygaśnięcie', futureExpiry: 'Przyszłe wygaśnięcie', before: 'Przed', after: 'Po',
      active: 'Aktywny', inactive: 'Nieaktywny', draft: 'Szkic', disabled: 'Wyłączony', requiresReview: 'Wymaga weryfikacji', reviewed: 'Zweryfikowany', guests: 'gości', nights: 'nocy',
      authoritativeOnly: 'Edycja ceny bazowej jest dostępna tylko dla produktów, dla których cena bazowa jest źródłem nadrzędnym.', coverError: 'Zdjęcie okładkowe musi pozostać wśród wybranych zdjęć.',
      expiryError: 'Wybierz prawidłowe wygaśnięcie ściśle w przyszłości.', contractImmutable: 'Ten kontrakt cenowy hotelu jest niezmienny dla Partnera.',
      exactDateExampleRequired: 'Przed utworzeniem nowej ceny dla dokładnej daty wyświetl i zachowaj udany dokładny pobyt obejmujący ten produkt oraz tę datę.',
      upload: 'Wyślij wybrane zdjęcia', uploading: 'Wysyłanie zoptymalizowanych zdjęć WebP…', uploadReady: 'Wysłane zdjęcia dodano. Sprawdź i zapisz, aby je dołączyć.',
      uploadPartial: 'Wysłano tylko część zdjęć. Niczego nie ponowiono ani nie usunięto. Udane zdjęcia są widoczne poniżej; sprawdź je przed weryfikacją.',
      uploadOutputTooLarge: 'Zoptymalizowane zdjęcie WebP musi być niepuste i nie może przekraczać 10 MB.',
      title: 'Nazwa', name: 'Nazwa', description: 'Opis', floor: 'Piętro', city: 'Miasto', addressLine: 'Adres', district: 'Dzielnica / obszar', postalCode: 'Kod pocztowy', country: 'Kraj', mapsUrl: 'Adres Google Maps',
      bookingChanges: 'Zmiany rezerwacji', stripeOnboarding: 'Konfiguracja Stripe', update: 'Aktualizacja', create: 'Utworzenie', upsert: 'Utworzenie lub aktualizacja',
      commissionBasis: 'Podstawa prowizji', exampleBefore: 'Przykładowy pobyt przed zmianą', exampleAfter: 'Przykładowy pobyt po zmianie',
      percentBooking: 'wartości rezerwacji', perRoomNight: 'za przydzielony pokój za noc pobytu',
      ratePlans: 'Plany taryfowe', roomRateProducts: 'Produkty cen pokoi', commissionPolicy: 'Zasada prowizji CyprusEye',
      pricingSource: 'Źródło ceny', currentNightlyPrice: 'Bieżąca cena klienta za noc', editableBasePrice: 'Cena bazowa edytowalna po weryfikacji',
      tierOwnedPrice: 'Ceną zarządza zweryfikowany harmonogram lub próg obłożenia', immutableCommercialRule: 'Niezmienna zasada handlowa zwrócona przez serwer',
      exactStayCustomerTotal: 'Dokładna suma klienta za pobyt', customerSellingPrice: 'Cena sprzedaży dla klienta za sprawdzaną jednostkę ceny',
      mediaUnavailable: 'Wysyłanie mediów hotelowych Partnera jest niedostępne.',
      externalCalendars: 'Kalendarze zewnętrzne', externalCalendarCreate: 'Dodaj źródło iCal', externalCalendarEdit: 'Edytuj źródło',
      calendarProvider: 'Dostawca', bookingCom: 'Booking.com', airbnb: 'Airbnb', genericIcal: 'Ogólny iCal',
      calendarProviderNote: 'Wszystkie opcje dostawcy używają adresu eksportu ICS. Dostawca jest zapisywany niezależnie od kodu źródła.',
      configured: 'Skonfigurowano (URL ukryty)', notConfigured: 'Nie skonfigurowano', setUrl: 'Ustaw URL', rotateUrl: 'Obróć URL', clearUrl: 'Usuń URL',
      enableSource: 'Włącz', disableSource: 'Wyłącz', triggerSync: 'Uruchom ręczną synchronizację', activationOff: 'Włączenie jest niedostępne, gdy globalna flaga kalendarza zewnętrznego jest WYŁĄCZONA.',
      syncUnavailable: 'Ręczna synchronizacja wymaga włączonego źródła i globalnej aktywacji.',
      intervalMinutes: 'Interwał synchronizacji (minuty)', unitsPerEvent: 'Jednostki na zdarzenie', priority: 'Priorytet', health: 'Oczyszczony stan synchronizacji',
      attempts: 'Ostatnia próba', success: 'Ostatni sukces', failure: 'Ostatni błąd', events: 'Zdarzenia', activeEvents: 'Aktywne zdarzenia', blocks: 'Blokady',
      calendarUrl: 'Prywatny adres HTTPS iCal', calendarUrlNeverShown: 'URL jest wysyłany tylko dla tego sprawdzonego zapisu i nigdy nie jest ponownie wyświetlany.',
      never_synced: 'Nigdy nie synchronizowano', healthy: 'Prawidłowy', degraded: 'Pogorszony', syncing: 'Synchronizacja',
      locationUnknown: 'Nie podano lokalizacji', allOff: 'Wszystkie możliwości WYŁĄCZONE', assignedHotels: 'dokładnie przypisanych hoteli', loadingAssignments: 'Ładowanie dokładnie przypisanych hoteli…',
    },
    he: {
      openWorkspace: 'פתיחת סביבת העבודה', back: 'חזרה להזמנות המלון', refresh: 'רענון סביבת העבודה המדויקת',
      workspace: 'סביבת עבודה למלון', loading: 'טוען את המלון המשויך המדויק…', overview: 'סקירה',
      property: 'נכס', rooms: 'חדרים', pricing: 'תוכניות ומחירים', availability: 'לוח שנה',
      bookings: 'הזמנות', payments: 'תשלומים', access: 'גישה מדויקת', publicOff: 'ההתנהגות הציבורית הישנה נשארת סמכותית. דגלי Hotels V2 כבויים.',
      adminReview: 'שינויי הנכס נשמרים כהצעה לבדיקת מנהל ואינם משנים את המלון הציבורי.',
      noUpload: 'אפשר לבחור רק מדיה קיימת שמנוהלת בידי Admin. העלאה אינה זמינה בשלב זה.',
      review: 'בדיקה', reviewTitle: 'בדיקת שינוי מדויק במלון', cancel: 'ביטול', save: 'שמירת השינוי שנבדק',
      noChange: 'אין שינוי סמנטי. אין מה לשמור.', saved: 'השינוי שנבדק נשמר וסביבת העבודה המדויקת רועננה.',
      stale: 'המצב השתנה לאחר הבדיקה. יש לרענן ולבדוק מחדש; דבר לא נוסה שוב אוטומטית.',
      unavailable: 'יכולת זו אינה זמינה לשיוך המדויק.', future: 'יכולת זו רשומה אך אינה זמינה בשלב זה.',
      existingFlow: 'פתיחת התהליך הקיים', technical: 'אבחון טכני', reason: 'סיבה עבור Admin/ביקורת',
      content: 'הצעת תוכן לנכס', photos: 'הצעת תמונות לנכס', editContent: 'עריכת תוכן',
      editPhotos: 'עריכת תמונות', editStructure: 'עריכת מבנה', createRoom: 'יצירת טיוטת חדר',
      roomContent: 'תוכן החדר', roomPhotos: 'תמונות החדר', roomStructure: 'מבנה החדר',
      basePrice: 'מחיר בסיס ללילה', sharedTier: 'מחיר מדרגה בלוח משותף', directTier: 'מחיר מדרגת תפוסה עצמאית', exactDate: 'מחיר ללילה בתאריך מדויק',
      customerPrice: 'מחיר ללקוח', commission: 'עמלת CyprusEye', partnerNet: 'נטו לשותף', readOnly: 'תוצאת שרת לקריאה בלבד',
      stayPreview: 'תצוגה מסחרית לשהייה', previewStay: 'תצוגת שהייה מדויקת', notCalculated: 'לא חושב',
      dailyInventory: 'מלאי יומי', set: 'הגדרה', clear: 'ניקוי', unchanged: 'ללא שינוי', closed: 'סגור', open: 'פתוח',
      pendingReview: 'ממתין לבדיקת Admin', blocked: 'השינוי נחסם לפי חוזה השרת',
      language: 'שפת סביבת העבודה', empty: 'אין הגדרה בחלק זה.', impacted: 'היקף ההשפעה המדויק',
      amenities: 'מתקנים', latitude: 'קו רוחב', longitude: 'קו אורך', photo: 'תמונה', cover: 'תמונת שער', order: 'סדר',
      code: 'קוד', maximumOccupancy: 'תפוסה מרבית', bathrooms: 'חדרי רחצה', size: 'גודל במ״ר', baseInventory: 'מלאי בסיס', inventoryMode: 'מצב מלאי',
      capacityAdults: 'קיבולת מבוגרים', capacityChildren: 'קיבולת ילדים', sortOrder: 'סדר מיון', pooled: 'מאוגד', unitized: 'לפי יחידות',
      bedConfiguration: 'תצורת מיטות', bedType: 'סוג מיטה', quantity: 'כמות', addBed: 'הוספת מיטה', remove: 'הסרה',
      notConfirmed: 'דורש בדיקה — לא אושר', fieldConfigured: 'מוגדר', photosCount: 'תמונות', amenitiesCount: 'מתקנים',
      splitNotConfirmed: 'חלוקת מבוגרים/ילדים דורשת בדיקה', noneConfigured: 'לא הוגדרו',
      confirmed: 'מאושר', missingUnknown: 'חסר / לא ידוע',
      singleBed: 'יחיד', doubleBed: 'זוגי', sofaBed: 'ספה נפתחת', bunkBed: 'קומתיים', kingBed: 'קינג', queenBed: 'קווין', otherBed: 'אחר',
      bedLabelRequired: 'יש להוסיף לפחות שם מקומי אחד למיטה מסוג אחר.',
      bedConfigurationInvalid: 'כל מיטה דורשת סוג תקין וכמות שלמה מ-1 עד 20.',
      priceField: 'שדה מחיר', exactProduct: 'מוצר מדויק', stayDate: 'תאריך שהייה', nightlyPrice: 'מחיר ללילה',
      checkIn: 'הגעה', checkOut: 'עזיבה', adults: 'מבוגרים', childAges: 'גילי ילדים', ratePlan: 'תוכנית תעריף', room: 'חדר', allocation: 'כלל הקצאה', automatic: 'אוטומטי',
      sellableUnits: 'יחידות למכירה', units: 'יחידות', closure: 'סגירה', expiry: 'תפוגה', futureExpiry: 'תפוגה עתידית', before: 'לפני', after: 'אחרי',
      active: 'פעיל', inactive: 'לא פעיל', draft: 'טיוטה', disabled: 'מושבת', requiresReview: 'דורש בדיקה', reviewed: 'נבדק', guests: 'אורחים', nights: 'לילות',
      authoritativeOnly: 'עריכת מחיר בסיס זמינה רק למוצרים שבהם מחיר הבסיס הוא המקור הסמכותי.', coverError: 'תמונת השער חייבת להישאר בין התמונות שנבחרו.',
      expiryError: 'יש לבחור תאריך תפוגה תקין שנמצא בעתיד.', contractImmutable: 'חוזה התמחור של מלון זה נעול לעריכת שותף.',
      exactDateExampleRequired: 'לפני יצירת מחיר חדש לתאריך מדויק, יש להציג ולשמור שהייה מדויקת ומוצלחת שכוללת את מוצר החדר ואת התאריך הזה.',
      upload: 'העלאת התמונות שנבחרו', uploading: 'מעלה תמונות WebP ממוטבות…', uploadReady: 'התמונות שהועלו נוספו. יש לבדוק ולשמור כדי לצרף אותן.',
      uploadPartial: 'רק חלק מהתמונות הועלו. לא בוצע ניסיון חוזר ולא נמחק דבר. התמונות שהצליחו נשארו למטה; יש לבדוק אותן לפני Review.',
      uploadOutputTooLarge: 'תמונת WebP הממוטבת חייבת להיות לא ריקה ובגודל של עד 10 MB.',
      title: 'שם', name: 'שם', description: 'תיאור', floor: 'קומה', city: 'עיר', addressLine: 'כתובת', district: 'אזור', postalCode: 'מיקוד', country: 'מדינה', mapsUrl: 'כתובת Google Maps',
      bookingChanges: 'שינויים בהזמנה', stripeOnboarding: 'הגדרת Stripe', update: 'עדכון', create: 'יצירה', upsert: 'יצירה או עדכון',
      commissionBasis: 'בסיס עמלה', exampleBefore: 'שהייה לדוגמה לפני השינוי', exampleAfter: 'שהייה לדוגמה אחרי השינוי',
      percentBooking: 'מסכום ההזמנה', perRoomNight: 'לכל חדר מוקצה לכל ליל שכירות',
      ratePlans: 'תוכניות מחיר', roomRateProducts: 'מוצרי מחיר לחדר', commissionPolicy: 'מדיניות עמלת CyprusEye',
      pricingSource: 'מקור המחיר', currentNightlyPrice: 'מחיר הלקוח הנוכחי ללילה', editableBasePrice: 'מחיר הבסיס ניתן לעריכה לאחר בדיקה',
      tierOwnedPrice: 'המחיר מנוהל בידי לוח או מדרגת תפוסה שנבדקו', immutableCommercialRule: 'כלל מסחרי בלתי ניתן לשינוי שהוחזר מהשרת',
      exactStayCustomerTotal: 'סכום הלקוח המדויק לשהייה', customerSellingPrice: 'מחיר המכירה ללקוח עבור יחידת המחיר הנבדקת',
      mediaUnavailable: 'העלאת מדיה למלון השותף אינה זמינה.',
      externalCalendars: 'יומנים חיצוניים', externalCalendarCreate: 'הוספת מקור iCal', externalCalendarEdit: 'עריכת מקור',
      calendarProvider: 'ספק', bookingCom: 'Booking.com', airbnb: 'Airbnb', genericIcal: 'iCal כללי',
      calendarProviderNote: 'כל אפשרויות הספק משתמשות בכתובת יצוא ICS. הספק נשמר בנפרד מקוד המקור.',
      configured: 'מוגדר (הכתובת מוסתרת)', notConfigured: 'לא מוגדר', setUrl: 'הגדרת כתובת', rotateUrl: 'החלפת כתובת', clearUrl: 'מחיקת כתובת',
      enableSource: 'הפעלה', disableSource: 'השבתה', triggerSync: 'הפעלת סנכרון ידני', activationOff: 'אי אפשר להפעיל כל עוד הדגל הגלובלי של יומן חיצוני כבוי.',
      syncUnavailable: 'סנכרון ידני דורש מקור פעיל והפעלה גלובלית.',
      intervalMinutes: 'מרווח סנכרון (דקות)', unitsPerEvent: 'יחידות לאירוע', priority: 'עדיפות', health: 'מצב סנכרון מסונן',
      attempts: 'ניסיון אחרון', success: 'הצלחה אחרונה', failure: 'כשל אחרון', events: 'אירועים', activeEvents: 'אירועים פעילים', blocks: 'חסימות',
      calendarUrl: 'כתובת iCal פרטית ב-HTTPS', calendarUrlNeverShown: 'הכתובת נשלחת רק בשמירה שנבדקה ואינה מוצגת שוב.',
      never_synced: 'טרם סונכרן', healthy: 'תקין', degraded: 'פגום', syncing: 'בסנכרון',
      locationUnknown: 'לא צוין מיקום', allOff: 'כל היכולות כבויות', assignedHotels: 'מלונות משויכים מדויקים', loadingAssignments: 'טוען מלונות משויכים מדויקים…',
    },
  });

  const state = {
    root: null, dialog: null, portal: null, partnerId: null, assignment: null, workspace: null,
    language: 'en', section: 'overview', loading: false, generation: 0, pending: null,
    opener: null, roomEditor: null, commercialPreview: null, commercialRequest: null,
    mediaDraft: { property: [], rooms: {} }, photoDraft: { property: null, rooms: {} },
    externalCalendar: null, externalCalendarError: null,
  };

  function text(key) { return COPY[state.language]?.[key] || COPY.en[key] || key; }
  function html(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
  function initialLanguage() {
    let candidate = '';
    try { candidate = new URL(location.href).searchParams.get('lang') || ''; } catch (_error) {}
    candidate = candidate || (typeof root.getCurrentLanguage === 'function' ? root.getCurrentLanguage() : '') || root.appI18n?.language || document.documentElement.lang || 'en';
    candidate = String(candidate).toLowerCase();
    return candidate.startsWith('he') ? 'he' : (candidate.startsWith('pl') ? 'pl' : 'en');
  }
  function todayIso() { return new Date().toISOString().slice(0, 10); }
  function addDays(iso, days) { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
  function localized(value, fallback = '') { return Core.localized(value, state.language, fallback); }
  function formatMoney(value, currency) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return text('notCalculated');
    try { return new Intl.NumberFormat(state.language === 'he' ? 'he-IL' : (state.language === 'pl' ? 'pl-PL' : 'en-GB'), { style: 'currency', currency }).format(value); }
    catch (_error) { return `${value.toFixed(2)} ${currency}`; }
  }
  function setStatus(message, tone = '') {
    const node = state.root?.querySelector('[data-phw-status]');
    if (!node) return;
    node.textContent = message || '';
    node.dataset.tone = tone;
  }
  function capability(key) { return state.workspace?.assignment?.capabilities?.[key] === true; }
  function propertyName() {
    return localized(state.workspace?.property?.title_i18n, localized(state.assignment?.name_i18n, state.assignment?.slug || text('workspace')));
  }
  function roomName(id) {
    const room = state.workspace?.rooms?.find((entry) => entry.id === id);
    return localized(room?.name_i18n, room?.code || 'Room');
  }
  function rateName(id) {
    const pricing = state.workspace?.pricing;
    const rate = pricing?.room_rates?.find((entry) => entry.id === id);
    if (!rate) return '';
    const room = roomName(rate.room_type_id);
    const plan = pricing.rate_plans.find((entry) => entry.id === rate.rate_plan_id);
    return `${room} · ${localized(plan?.name_i18n, plan?.code || 'Rate Plan')}`;
  }
  function diagnostics(id) { return `<details class="partner-hotel-workspace__diagnostics"><summary>${html(text('technical'))}</summary><code>${html(id || '')}</code></details>`; }
  function enumLabel(value) {
    const keys = { active: 'active', inactive: 'inactive', draft: 'draft', disabled: 'disabled', requires_review: 'requiresReview', reviewed: 'reviewed', pooled: 'pooled', unitized: 'unitized' };
    return text(keys[value] || value);
  }
  function blockerLabel(value) {
    return value === 'h3_1p_contract_immutable' ? text('contractImmutable') : String(value || '').replaceAll('_', ' ');
  }
  function capabilityLabel(value) {
    const keys = {
      edit_property_content: 'content', edit_property_photos: 'photos', edit_room_content: 'roomContent', edit_room_photos: 'roomPhotos',
      create_rooms: 'createRoom', edit_room_structure: 'roomStructure', manage_prices: 'pricing', manage_availability: 'availability',
      process_bookings: 'bookings', request_booking_changes: 'bookingChanges', view_payment_status: 'payments', initiate_stripe_onboarding: 'stripeOnboarding',
    };
    return text(keys[value] || value);
  }
  function impactLabel(value) {
    return text({ property_content: 'content', property_photos: 'photos', room_content: 'roomContent', room_photos: 'roomPhotos', room_structure: 'roomStructure', room: 'rooms', room_rate_price: 'basePrice', schedule_tier_price: 'sharedTier', room_rate_tier_price: 'directTier', exact_date_price: 'exactDate', daily_inventory: 'dailyInventory', update: 'update', create: 'create', upsert: 'upsert' }[value] || value);
  }
  function propertyLabel(value) {
    return text({ city: 'city', address_line: 'addressLine', district: 'district', postal_code: 'postalCode', country: 'country', google_maps_url: 'mapsUrl', check_in_from: 'checkIn', check_out_until: 'checkOut' }[value] || value);
  }
  function fieldLabel(value) {
    return propertyLabel(value) !== value ? propertyLabel(value) : structureLabel(value) !== value ? structureLabel(value) : text({
      title_i18n: 'title', name_i18n: 'name', description_i18n: 'description', amenities: 'amenities', floor_label_i18n: 'floor',
      cover_image_url: 'cover', photos: 'photos', gallery: 'roomPhotos', nightly_rate: 'nightlyPrice', stay_date: 'stayDate',
      sellable_units: 'sellableUnits', closed: 'closure', expires_at: 'expiry',
    }[value] || value);
  }
  function structureLabel(key) {
    return text({ capacity_adults: 'capacityAdults', capacity_children: 'capacityChildren', max_occupancy: 'maximumOccupancy', bathrooms: 'bathrooms', size_sqm: 'size', base_inventory_count: 'baseInventory', sort_order: 'sortOrder' }[key] || key);
  }
  const BED_TYPES = Object.freeze(['single', 'double', 'sofa', 'bunk', 'king', 'queen', 'other']);
  function bedTypeLabel(type) {
    return text({ single: 'singleBed', double: 'doubleBed', sofa: 'sofaBed', bunk: 'bunkBed', king: 'kingBed', queen: 'queenBed', other: 'otherBed' }[type] || type);
  }
  function bedSummary(room) {
    if (!room.bed_configuration.length) return text('notConfirmed');
    return room.bed_configuration.map((bed) => `${bed.quantity} × ${bed.type === 'other' ? localized(bed.label, bedTypeLabel('other')) : bedTypeLabel(bed.type)}`).join(' · ');
  }
  function bedRow(bed = {}) {
    const type = BED_TYPES.includes(bed.type) ? bed.type : 'single';
    const label = bed.label || {};
    return `<div class="partner-hotel-workspace__bed-row" data-phw-bed-row><label class="partner-hotel-workspace__field">${html(text('bedType'))}<select data-phw-bed-type>${BED_TYPES.map((candidate) => `<option value="${candidate}" ${candidate === type ? 'selected' : ''}>${html(bedTypeLabel(candidate))}</option>`).join('')}</select></label><label class="partner-hotel-workspace__field">${html(text('quantity'))}<input data-phw-bed-quantity type="number" min="1" max="20" step="1" value="${Number.isInteger(bed.quantity) ? bed.quantity : 1}" /></label>${['pl', 'en', 'he'].map((language) => `<label class="partner-hotel-workspace__field">${html(text('otherBed'))} — ${language.toUpperCase()}<input data-phw-bed-label="${language}" maxlength="160" dir="${language === 'he' ? 'rtl' : 'ltr'}" value="${html(label[language] || '')}" /></label>`).join('')}<button class="btn-sm" type="button" data-phw-remove-bed>${html(text('remove'))}</button></div>`;
  }
  function roomFacts(room) {
    const capacity = room.max_occupancy != null
      ? `${structureLabel('max_occupancy')}: ${room.max_occupancy} · ${text('splitNotConfirmed')}`
      : `${structureLabel('capacity_adults')}: ${room.capacity_adults} · ${structureLabel('capacity_children')}: ${room.capacity_children}`;
    return [
      capacity,
      `${text('bedConfiguration')}: ${room.bed_configuration.length ? `${bedSummary(room)} · ${text('confirmed')}` : `${text('missingUnknown')} · ${text('requiresReview')}`}`,
      `${text('bathrooms')}: ${room.bathrooms == null ? `${text('missingUnknown')} · ${text('requiresReview')}` : `${room.bathrooms} · ${text('confirmed')}`}`,
      `${text('size')}: ${room.size_sqm == null ? `${text('missingUnknown')} · ${text('requiresReview')}` : `${room.size_sqm} · ${text('confirmed')}`}`,
      `${text('inventoryMode')}: ${enumLabel(room.inventory_mode)} · ${room.base_inventory_count} · ${text('confirmed')}`,
      `${room.gallery.length} ${text('photosCount')} · ${room.gallery.length ? text('confirmed') : text('missingUnknown')}`,
      `${room.amenities.length} ${text('amenitiesCount')} · ${room.amenities.length ? text('confirmed') : text('missingUnknown')}`,
      `${text('description')}: ${Object.values(room.description_i18n).some((value) => String(value).trim()) ? text('confirmed') : text('missingUnknown')}`,
    ];
  }
  function bedConfigurationFromForm(form) {
    return Array.from(form.querySelectorAll('[data-phw-bed-row]')).map((row) => {
      const type = String(row.querySelector('[data-phw-bed-type]')?.value || '');
      const quantity = Number(row.querySelector('[data-phw-bed-quantity]')?.value);
      if (!BED_TYPES.includes(type) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error(text('bedConfigurationInvalid'));
      const result = { type, quantity };
      if (type === 'other') {
        result.label = Core.compactI18n(Object.fromEntries(['pl', 'en', 'he'].map((language) => [language, String(row.querySelector(`[data-phw-bed-label="${language}"]`)?.value || '')])), 160);
        if (!Object.keys(result.label).length) throw new Error(text('bedLabelRequired'));
      }
      return result;
    });
  }
  function photoChoices(urls, selected, cover, inputName, offset = 0) {
    return urls.map((url, index) => `<label class="partner-hotel-workspace__card" data-phw-photo-card>
      <img src="${html(url)}" alt="" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px">
      <span><input type="checkbox" name="${inputName}" value="${html(url)}" ${selected.includes(url) ? 'checked' : ''}/> ${html(text('photo'))} ${offset + index + 1}</span>
      <span>${html(text('order'))}<input type="number" min="1" max="250" value="${offset + index + 1}" data-phw-photo-order /></span>
      ${inputName === 'photo' ? `<span><input type="radio" name="cover" value="${html(url)}" ${url === cover ? 'checked' : ''}/> ${html(text('cover'))}</span>` : ''}
    </label>`).join('');
  }
  function orderedPhotos(form, inputName) {
    return Array.from(form.querySelectorAll(`input[name="${inputName}"]:checked`))
      .map((input, index) => ({ url: input.value, order: Number(input.closest('[data-phw-photo-card]')?.querySelector('[data-phw-photo-order]')?.value || index + 1), index }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map((entry) => entry.url);
  }
  function capturePhotoDrafts() {
    const propertyForm = state.root?.querySelector('[data-phw-property-photos]');
    if (propertyForm) state.photoDraft.property = { photos: orderedPhotos(propertyForm, 'photo'), cover_image_url: nullableText(new FormData(propertyForm).get('cover')) };
    state.root?.querySelectorAll('[data-phw-room-form="photos"]').forEach((form) => { state.photoDraft.rooms[form.dataset.roomId] = orderedPhotos(form, 'gallery'); });
  }
  function appendUploadedPhotos(form, urls, inputName) {
    const grid = form.querySelector('.partner-hotel-workspace__grid');
    if (!grid || !urls.length) return;
    const existing = new Set(Array.from(form.querySelectorAll(`input[name="${inputName}"]`)).map((input) => input.value));
    const fresh = urls.filter((url) => !existing.has(url));
    if (!fresh.length) return;
    const offset = existing.size;
    grid.insertAdjacentHTML('beforeend', photoChoices(fresh, fresh, null, inputName, offset));
  }

  function sectionDefinitions() {
    return [
      ['overview', 'overview'], ['property_content', 'property'], ['rooms', 'rooms'],
      ['rates_pricing', 'pricing'], ['calendar_availability', 'availability'],
      ['bookings', 'bookings'], ['payments', 'payments'],
    ].filter(([key]) => key === 'property_content'
      ? state.workspace?.sections?.property_content?.visible || state.workspace?.sections?.property_photos?.visible
      : state.workspace?.sections?.[key]?.visible);
  }

  function renderOverview() {
    const enabled = Core.CAPABILITIES.filter((key) => capability(key));
    const deferred = [
      capability('request_booking_changes') ? `<div class="partner-hotel-workspace__card"><h3>${html(text('bookingChanges'))}</h3><p>${html(text('future'))}</p></div>` : '',
      capability('initiate_stripe_onboarding') ? `<div class="partner-hotel-workspace__card"><h3>${html(text('stripeOnboarding'))}</h3><p>${html(text('future'))}</p></div>` : '',
    ].join('');
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="overview">
      <h2>${html(text('overview'))}</h2><p class="partner-hotel-workspace__panel-copy">${html(text('publicOff'))}</p>
      <div class="partner-hotel-workspace__grid">
        <div class="partner-hotel-workspace__card"><h3>${html(text('access'))}</h3><div class="partner-hotel-workspace__chips">${enabled.map((key) => `<span class="partner-hotel-workspace__chip">${html(capabilityLabel(key))}</span>`).join('') || `<span>${html(text('unavailable'))}</span>`}</div></div>
        <div class="partner-hotel-workspace__card"><h3>${html(propertyName())}</h3><p>${html(state.workspace.property.city || '')}</p>${diagnostics(state.workspace.hotel_id)}</div>
        ${deferred}
      </div>
    </section>`;
  }

  function i18nFields(prefix, value, textarea = false) {
    return ['pl', 'en', 'he'].map((language) => `<label class="partner-hotel-workspace__field">${html(text(prefix))} — ${html(language.toUpperCase())}${textarea
      ? `<textarea name="${html(prefix)}_${language}" dir="${language === 'he' ? 'rtl' : 'ltr'}">${html(value?.[language] || '')}</textarea>`
      : `<input name="${html(prefix)}_${language}" dir="${language === 'he' ? 'rtl' : 'ltr'}" value="${html(value?.[language] || '')}" />`}</label>`).join('');
  }

  function renderProperty() {
    const canonical = state.workspace.property;
    const draft = state.workspace.property_draft;
    const source = Object.keys(draft.content || {}).length ? draft.content : canonical;
    const photoSource = state.photoDraft.property || (Object.keys(draft.photos || {}).length ? draft.photos : canonical);
    const contentForm = capability('edit_property_content') ? `<form class="partner-hotel-workspace__form" data-phw-property-content>
      <h3>${html(text('content'))}</h3><p class="partner-hotel-workspace__panel-copy">${html(text('adminReview'))}</p>
      <div class="partner-hotel-workspace__form-grid">${i18nFields('title', source.title_i18n)}${i18nFields('description', source.description_i18n, true)}
        ${['city', 'address_line', 'district', 'postal_code', 'country', 'google_maps_url', 'check_in_from', 'check_out_until'].map((key) => `<label class="partner-hotel-workspace__field">${html(propertyLabel(key))}<input name="${key}" value="${html(source[key] || '')}" /></label>`).join('')}
        <label class="partner-hotel-workspace__field">${html(text('latitude'))}<input name="latitude" type="number" step="any" value="${source.latitude ?? ''}" /></label>
        <label class="partner-hotel-workspace__field">${html(text('longitude'))}<input name="longitude" type="number" step="any" value="${source.longitude ?? ''}" /></label>
        <label class="partner-hotel-workspace__field">${html(text('amenities'))}<input name="amenities" value="${html((source.amenities || []).join(', '))}" /></label>
      </div><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label>
      <div class="partner-hotel-workspace__actions"><button class="btn-sm primary" type="submit">${html(text('review'))}</button></div>
    </form>` : '';
    const selectedPhotos = Array.from(new Set([...(Array.isArray(photoSource.photos) ? photoSource.photos : []), ...state.mediaDraft.property]));
    const availablePhotos = Array.from(new Set([...selectedPhotos, ...(canonical.photos || []), canonical.cover_image_url].filter(Boolean)));
    const photosForm = capability('edit_property_photos') ? `<form class="partner-hotel-workspace__form" data-phw-property-photos>
      <h3>${html(text('photos'))}</h3><label class="partner-hotel-workspace__field">${html(text('photo'))}<input type="file" name="uploads" accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" multiple /></label><button class="btn-sm" type="button" data-phw-upload-property>${html(text('upload'))}</button>
      <div class="partner-hotel-workspace__grid">${photoChoices(availablePhotos, selectedPhotos, photoSource.cover_image_url, 'photo') || `<p>${html(text('empty'))}</p>`}</div>
      <label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label>
      <button class="btn-sm primary" type="submit">${html(text('review'))}</button>
    </form>` : '';
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="property_content"><h2>${html(text('property'))}</h2>${draft.exists ? `<div class="partner-hotel-workspace__status" data-tone="warning">${html(text('pendingReview'))}</div>` : ''}${contentForm}${photosForm}</section>`;
  }

  function renderRoomEditor(room) {
    if (!room) return '';
    const mode = state.roomEditor?.mode;
    if (mode === 'content' && capability('edit_room_content')) return `<form class="partner-hotel-workspace__form" data-phw-room-form="content" data-room-id="${room.id}"><h3>${html(text('roomContent'))}</h3><div class="partner-hotel-workspace__form-grid">${i18nFields('name', room.name_i18n)}${i18nFields('description', room.description_i18n, true)}<label class="partner-hotel-workspace__field">${html(text('amenities'))}<input name="amenities" value="${html(room.amenities.join(', '))}" /></label>${i18nFields('floor', room.floor_label_i18n)}</div><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label><button class="btn-sm primary">${html(text('review'))}</button></form>`;
    if (mode === 'photos' && capability('edit_room_photos')) {
      const uploaded = state.mediaDraft.rooms[room.id] || [];
      const selected = Array.from(new Set([...(state.photoDraft.rooms[room.id] || room.gallery), ...uploaded]));
      const proposedPropertyPhotos = state.workspace.property_draft?.photos?.photos || [];
      const sources = Array.from(new Set([...selected, ...proposedPropertyPhotos, ...state.mediaDraft.property, ...(state.workspace.property.photos || [])]));
      return `<form class="partner-hotel-workspace__form" data-phw-room-form="photos" data-room-id="${room.id}"><h3>${html(text('roomPhotos'))}</h3><label class="partner-hotel-workspace__field">${html(text('photo'))}<input type="file" name="uploads" accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" multiple /></label><button class="btn-sm" type="button" data-phw-upload-room>${html(text('upload'))}</button><div class="partner-hotel-workspace__grid">${photoChoices(sources, selected, null, 'gallery')}</div><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label><button class="btn-sm primary">${html(text('review'))}</button></form>`;
    }
    if (mode === 'structure' && capability('edit_room_structure')) return `<form class="partner-hotel-workspace__form" data-phw-room-form="structure" data-room-id="${room.id}"><h3>${html(text('roomStructure'))}</h3><div class="partner-hotel-workspace__form-grid">${['capacity_adults', 'capacity_children', 'max_occupancy', 'bathrooms', 'size_sqm', 'base_inventory_count', 'sort_order'].map((key) => `<label class="partner-hotel-workspace__field">${html(structureLabel(key))}<input name="${key}" type="number" step="${['bathrooms', 'size_sqm'].includes(key) ? '0.1' : '1'}" value="${room[key] ?? ''}" />${['bathrooms', 'size_sqm'].includes(key) && room[key] == null ? `<small>${html(text('notConfirmed'))}</small>` : ''}</label>`).join('')}<label class="partner-hotel-workspace__field">${html(text('inventoryMode'))}<select name="inventory_mode"><option value="pooled" ${room.inventory_mode === 'pooled' ? 'selected' : ''}>${html(text('pooled'))}</option><option value="unitized" ${room.inventory_mode === 'unitized' ? 'selected' : ''}>${html(text('unitized'))}</option></select></label></div><fieldset><legend>${html(text('bedConfiguration'))}</legend>${room.bed_configuration.length ? '' : `<p>${html(text('notConfirmed'))}</p>`}<div data-phw-bed-rows>${room.bed_configuration.map((bed) => bedRow(bed)).join('')}</div><button class="btn-sm" type="button" data-phw-add-bed>${html(text('addBed'))}</button></fieldset><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label><button class="btn-sm primary">${html(text('review'))}</button></form>`;
    return '';
  }

  function renderRooms() {
    const rooms = state.workspace.rooms || [];
    const selected = rooms.find((room) => room.id === state.roomEditor?.id) || null;
    const cards = rooms.map((room) => `<article class="partner-hotel-workspace__card"><h3>${html(localized(room.name_i18n, room.code))}</h3><p>${html(enumLabel(room.status))}</p><ul class="partner-hotel-workspace__room-facts">${roomFacts(room).map((fact) => `<li>${html(fact)}</li>`).join('')}</ul><p>${html(room.amenities.length ? room.amenities.join(' · ') : text('noneConfigured'))}</p><div class="partner-hotel-workspace__actions">${capability('edit_room_content') && room.status !== 'disabled' ? `<button class="btn-sm" data-phw-room-edit="content" data-room-id="${room.id}">${html(text('editContent'))}</button>` : ''}${capability('edit_room_photos') && room.status !== 'disabled' ? `<button class="btn-sm" data-phw-room-edit="photos" data-room-id="${room.id}">${html(text('editPhotos'))}</button>` : ''}${capability('edit_room_structure') && room.status !== 'disabled' ? `<button class="btn-sm" data-phw-room-edit="structure" data-room-id="${room.id}">${html(text('editStructure'))}</button>` : ''}</div>${diagnostics(room.id)}</article>`).join('');
    const create = capability('create_rooms') ? `<details class="partner-hotel-workspace__card"><summary>${html(text('createRoom'))}</summary><form class="partner-hotel-workspace__form" data-phw-room-create><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('code'))}<input name="code" required /></label>${i18nFields('name', {})}${i18nFields('description', {}, true)}<label class="partner-hotel-workspace__field">${html(text('maximumOccupancy'))}<input name="max_occupancy" type="number" min="1" max="50" required /></label><label class="partner-hotel-workspace__field">${html(text('bathrooms'))}<input name="bathrooms" type="number" min="0" max="20" step="0.5" value="1" /></label><label class="partner-hotel-workspace__field">${html(text('size'))}<input name="size_sqm" type="number" min="1" step="0.1" /></label><label class="partner-hotel-workspace__field">${html(text('baseInventory'))}<input name="base_inventory_count" type="number" min="0" value="1" /></label><label class="partner-hotel-workspace__field">${html(text('inventoryMode'))}<select name="inventory_mode"><option value="pooled">${html(text('pooled'))}</option><option value="unitized">${html(text('unitized'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('amenities'))}<input name="amenities" /></label></div><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label><button class="btn-sm primary">${html(text('review'))}</button></form></details>` : '';
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="rooms"><h2>${html(text('rooms'))}</h2><div class="partner-hotel-workspace__grid">${cards || `<p>${html(text('empty'))}</p>`}${create}</div>${renderRoomEditor(selected)}</section>`;
  }

  function pricingTargetOptions(entity) {
    const pricing = state.workspace.pricing;
    if (!pricing) return '';
    if (entity === 'room_rate_price') return pricing.room_rates.filter((row) => row.base_nightly_rate_authoritative).map((row) => `<option value="${row.id}">${html(rateName(row.id))}</option>`).join('');
    if (entity === 'schedule_tier_price') return pricing.schedule_tiers.map((row) => { const schedule = pricing.schedules.find((item) => item.id === row.schedule_id); return `<option value="${row.id}">${html(localized(schedule?.name_i18n, schedule?.code || 'Schedule'))} · ${row.guest_count} ${html(text('guests'))} · ${row.threshold_nights} ${html(text('nights'))}</option>`; }).join('');
    if (entity === 'room_rate_tier_price') return pricing.room_rate_tiers.map((row) => `<option value="${row.id}">${html(rateName(row.room_rate_id))} · ${row.guest_count} ${html(text('guests'))} · ${row.threshold_nights} ${html(text('nights'))}</option>`).join('');
    return pricing.room_rates.map((row) => `<option value="${row.id}">${html(rateName(row.id))}</option>`).join('');
  }

  function renderCommercial(result) {
    if (!result) return '';
    const commercial = result.commercial;
    const blockers = result.blocking_reasons || [];
    return `<div class="partner-hotel-workspace__card"><h3>${html(text('stayPreview'))}</h3>${commercial ? `${commercialColumns(commercial, true)}<p>${html(text('readOnly'))}</p>` : `<p>${html(text('notCalculated'))}</p>`}${blockers.map((reason) => `<p>${html(blockerLabel(reason))}</p>`).join('')}</div>`;
  }

  function commissionRule(policy, quantity = null) {
    if (!policy) return text('notCalculated');
    if (policy.commission_mode === 'percent_booking_total') return `${policy.amount}% ${text('percentBooking')}`;
    const amount = formatMoney(policy.amount, policy.currency);
    return quantity == null ? `${amount} ${text('perRoomNight')}` : `${quantity} × ${amount} ${text('perRoomNight')}`;
  }

  function pricingSourceLabel(row) {
    if (row.base_nightly_rate_authoritative) return text('basePrice');
    if (row.pricing_schedule_id) return text('sharedTier');
    if (String(row.pricing_source || '').includes('tier')) return text('directTier');
    return String(row.pricing_source || text('notCalculated')).replaceAll('_', ' ');
  }

  function renderPricing() {
    const pricing = state.workspace.pricing;
    if (!pricing) return '';
    const blocked = pricing.mutation_blocked_reasons || [];
    const plans = pricing.rate_plans.map((row) => `<article class="partner-hotel-workspace__card"><h3>${html(localized(row.name_i18n, row.code))}</h3><p>${html(enumLabel(row.review_status))} · ${html(text(row.is_active ? 'active' : 'inactive'))}</p>${diagnostics(row.id)}</article>`).join('');
    const rates = pricing.room_rates.map((row) => `<article class="partner-hotel-workspace__card" data-phw-room-rate-product><h3>${html(rateName(row.id))}</h3><p>${html(enumLabel(row.review_status))} · ${html(text(row.is_active ? 'active' : 'inactive'))}</p><dl><div><dt>${html(text('pricingSource'))}</dt><dd>${html(pricingSourceLabel(row))}</dd></div><div><dt>${html(text('currentNightlyPrice'))}</dt><dd>${html(formatMoney(row.base_nightly_rate, row.currency))}</dd></div></dl><p>${html(text(row.base_nightly_rate_authoritative ? 'editableBasePrice' : 'tierOwnedPrice'))}</p>${diagnostics(row.id)}</article>`).join('');
    const policy = pricing.commission_policy;
    const policyCard = policy ? `<article class="partner-hotel-workspace__card" data-phw-commission-policy><h3>${html(text('commissionPolicy'))}</h3><p><strong>${html(commissionRule(policy))}</strong></p><p>${html(text('immutableCommercialRule'))} · ${html(text('readOnly'))}</p><small>${html(policy.code)}</small></article>` : '';
    const hasAuthoritativeBase = pricing.room_rates.some((row) => row.base_nightly_rate_authoritative);
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="rates_pricing"><h2>${html(text('pricing'))}</h2><h3>${html(text('ratePlans'))}</h3><div class="partner-hotel-workspace__grid">${plans || `<p>${html(text('empty'))}</p>`}</div><h3>${html(text('roomRateProducts'))}</h3><div class="partner-hotel-workspace__grid">${rates || `<p>${html(text('empty'))}</p>`}${policyCard}</div>${blocked.length ? `<div class="partner-hotel-workspace__status" data-tone="warning">${html(text('blocked'))}: ${html(blocked.map(blockerLabel).join(', '))}</div>` : ''}
      <form class="partner-hotel-workspace__form" data-phw-pricing ${blocked.length ? 'aria-disabled="true"' : ''}><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('priceField'))}<select name="entity"><option value="room_rate_price" ${hasAuthoritativeBase ? '' : 'disabled'}>${html(text('basePrice'))}</option><option value="schedule_tier_price">${html(text('sharedTier'))}</option><option value="room_rate_tier_price">${html(text('directTier'))}</option><option value="exact_date_price">${html(text('exactDate'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('exactProduct'))}<select name="target"></select></label><label class="partner-hotel-workspace__field" data-phw-exact-date hidden>${html(text('stayDate'))}<input name="stay_date" type="date" min="${todayIso()}" /></label><label class="partner-hotel-workspace__field">${html(text('nightlyPrice'))}<input name="nightly_rate" type="number" min="0" step="0.01" required /></label></div>${hasAuthoritativeBase ? '' : `<p class="partner-hotel-workspace__panel-copy">${html(text('authoritativeOnly'))}</p>`}<label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label><button class="btn-sm primary" ${blocked.length ? 'disabled' : ''}>${html(text('review'))}</button></form>
      <form class="partner-hotel-workspace__form" data-phw-stay><h3>${html(text('stayPreview'))}</h3><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('checkIn'))}<input name="check_in" type="date" min="${todayIso()}" value="${addDays(todayIso(), 1)}" required /></label><label class="partner-hotel-workspace__field">${html(text('checkOut'))}<input name="check_out" type="date" min="${addDays(todayIso(), 1)}" value="${addDays(todayIso(), 3)}" required /></label><label class="partner-hotel-workspace__field">${html(text('adults'))}<input name="adults" type="number" min="1" max="50" value="2" required /></label><label class="partner-hotel-workspace__field">${html(text('childAges'))}<input name="child_ages" placeholder="8, 12" /></label><label class="partner-hotel-workspace__field">${html(text('ratePlan'))}<select name="rate_plan_id"><option value="">${html(text('automatic'))}</option>${pricing.rate_plans.map((row) => `<option value="${row.id}">${html(localized(row.name_i18n, row.code))}</option>`).join('')}</select></label><label class="partner-hotel-workspace__field">${html(text('room'))}<select name="selected_room_type_id"><option value="">${html(text('automatic'))}</option>${state.workspace.rooms.map((room) => `<option value="${room.id}">${html(localized(room.name_i18n, room.code))}</option>`).join('')}</select></label><label class="partner-hotel-workspace__field">${html(text('allocation'))}<select name="allocation_rule_id"><option value="">${html(text('automatic'))}</option>${pricing.allocation_rules.map((row) => `<option value="${row.id}">${html(row.code)}</option>`).join('')}</select></label></div><button class="btn-sm" type="submit">${html(text('previewStay'))}</button></form>${renderCommercial(state.commercialPreview)}
    </section>`;
  }

  function externalCalendarProviderLabel(sourceType) {
    return text(sourceType === 'booking_com' ? 'bookingCom' : sourceType === 'airbnb' ? 'airbnb' : 'genericIcal');
  }

  function externalCalendarProviderOptions(selected = 'ical') {
    return [
      ['booking_com', 'bookingCom'],
      ['airbnb', 'airbnb'],
      ['ical', 'genericIcal'],
    ].map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${html(text(label))}</option>`).join('');
  }

  function renderExternalCalendars() {
    if (state.externalCalendarError) return `<section class="partner-hotel-workspace__form"><h3>${html(text('externalCalendars'))}</h3><div class="partner-hotel-workspace__status" data-tone="error">${html(state.externalCalendarError)}</div></section>`;
    const control = state.externalCalendar;
    if (!control) return `<section class="partner-hotel-workspace__form"><h3>${html(text('externalCalendars'))}</h3><p>${html(text('loading'))}</p></section>`;
    const roomOptions = control.rooms.filter((room) => room.status === 'active')
      .map((room) => `<option value="${room.id}">${html(localized(room.name_i18n, room.id))}</option>`).join('');
    const cards = control.sources.map((source) => {
      const room = control.rooms.find((entry) => entry.id === source.room_type_id);
      const health = source.health;
      return `<article class="partner-hotel-workspace__card" data-phw-external-source="${source.id}"><h4>${html(source.code)}</h4><p>${html(externalCalendarProviderLabel(source.source_type))} · ${html(localized(room?.name_i18n, source.room_type_id))} · ${html(source.secret_configured ? text('configured') : text('notConfigured'))}</p><p>${html(text('health'))}: ${html(text(health.status))}</p><dl><div><dt>${html(text('attempts'))}</dt><dd>${html(health.last_attempt_at || '—')}</dd></div><div><dt>${html(text('success'))}</dt><dd>${html(health.last_success_at || '—')}</dd></div><div><dt>${html(text('failure'))}</dt><dd>${html(health.last_error_code || health.last_error_message || '—')}</dd></div><div><dt>${html(text('events'))}</dt><dd>${health.last_event_count}</dd></div><div><dt>${html(text('activeEvents'))}</dt><dd>${health.last_active_event_count}</dd></div><div><dt>${html(text('blocks'))}</dt><dd>${health.last_block_count}</dd></div></dl><form class="partner-hotel-workspace__form" data-phw-external-source-form data-source-id="${source.id}"><h5>${html(text('externalCalendarEdit'))}</h5><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('calendarProvider'))}<select name="source_type" required>${externalCalendarProviderOptions(source.source_type)}</select></label><label class="partner-hotel-workspace__field">${html(text('room'))}<select name="room_type_id">${roomOptions.replace(`value="${source.room_type_id}"`, `value="${source.room_type_id}" selected`)}</select></label><label class="partner-hotel-workspace__field">${html(text('code'))}<input name="code" value="${html(source.code)}" required maxlength="80"></label><label class="partner-hotel-workspace__field">${html(text('intervalMinutes'))}<input name="sync_interval_minutes" type="number" min="15" max="1440" value="${source.sync_interval_minutes}" required></label><label class="partner-hotel-workspace__field">${html(text('unitsPerEvent'))}<input name="units_per_event" type="number" min="1" max="100" value="${source.units_per_event}" required></label><label class="partner-hotel-workspace__field">${html(text('priority'))}<input name="priority" type="number" min="-32768" max="32767" value="${source.priority}" required></label></div><p class="partner-hotel-workspace__panel-copy">${html(text('calendarProviderNote'))}</p><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" minlength="3" maxlength="500" required></label><button class="btn-sm" type="submit">${html(text('review'))}</button></form><div class="partner-hotel-workspace__actions"><button class="btn-sm" type="button" data-phw-external-secret="${source.secret_configured ? 'rotate' : 'set'}" data-source-id="${source.id}" ${source.is_enabled ? 'disabled' : ''}>${html(text(source.secret_configured ? 'rotateUrl' : 'setUrl'))}</button>${source.secret_configured && !source.is_enabled ? `<button class="btn-sm" type="button" data-phw-external-secret="clear" data-source-id="${source.id}">${html(text('clearUrl'))}</button>` : ''}${source.is_enabled ? `<button class="btn-sm" type="button" data-phw-external-lifecycle="disable" data-source-id="${source.id}">${html(text('disableSource'))}</button>` : `<button class="btn-sm" type="button" data-phw-external-lifecycle="enable" data-source-id="${source.id}" ${control.hotel_external_sync_enabled ? '' : `disabled title="${html(text('activationOff'))}"`}>${html(text('enableSource'))}</button>`}<button class="btn-sm" type="button" data-phw-external-sync data-source-id="${source.id}" ${source.is_enabled && control.hotel_external_sync_enabled ? '' : 'disabled'}>${html(text('triggerSync'))}</button></div>${control.hotel_external_sync_enabled ? '' : `<p class="partner-hotel-workspace__panel-copy">${html(text('activationOff'))}</p>`}${diagnostics(source.id)}</article>`;
    }).join('');
    return `<section class="partner-hotel-workspace__form" data-phw-external-calendars><h3>${html(text('externalCalendars'))}</h3><p class="partner-hotel-workspace__panel-copy">${html(text('calendarUrlNeverShown'))}</p><div class="partner-hotel-workspace__grid">${cards || `<p>${html(text('empty'))}</p>`}</div><details class="partner-hotel-workspace__card"><summary>${html(text('externalCalendarCreate'))}</summary><form class="partner-hotel-workspace__form" data-phw-external-create><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('calendarProvider'))}<select name="source_type" required>${externalCalendarProviderOptions()}</select></label><label class="partner-hotel-workspace__field">${html(text('room'))}<select name="room_type_id" required>${roomOptions}</select></label><label class="partner-hotel-workspace__field">${html(text('code'))}<input name="code" required maxlength="80"></label><label class="partner-hotel-workspace__field">${html(text('intervalMinutes'))}<input name="sync_interval_minutes" type="number" min="15" max="1440" value="60" required></label><label class="partner-hotel-workspace__field">${html(text('unitsPerEvent'))}<input name="units_per_event" type="number" min="1" max="100" value="1" required></label><label class="partner-hotel-workspace__field">${html(text('priority'))}<input name="priority" type="number" min="-32768" max="32767" value="100" required></label></div><p class="partner-hotel-workspace__panel-copy">${html(text('calendarProviderNote'))}</p><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" minlength="3" maxlength="500" required></label><button class="btn-sm primary" ${roomOptions ? '' : 'disabled'}>${html(text('review'))}</button></form></details></section>`;
  }

  function renderAvailability() {
    const availability = state.workspace.availability;
    if (!availability) return '';
    const eligibleRooms = state.workspace.rooms.filter((room) => room.status === 'active');
    const minimumDate = availability.from > todayIso() ? availability.from : todayIso();
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="calendar_availability"><h2>${html(text('availability'))}</h2><p class="partner-hotel-workspace__panel-copy">${html(text('publicOff'))}</p><form class="partner-hotel-workspace__form" data-phw-availability><h3>${html(text('dailyInventory'))}</h3><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('room'))}<select name="room_type_id" ${eligibleRooms.length ? '' : 'disabled'}>${eligibleRooms.map((room) => `<option value="${room.id}">${html(localized(room.name_i18n, room.code))}</option>`).join('')}</select></label><label class="partner-hotel-workspace__field">${html(text('stayDate'))}<input name="stay_date" type="date" min="${minimumDate}" max="${availability.to}" value="${minimumDate}" required /></label><label class="partner-hotel-workspace__field">${html(text('sellableUnits'))}<select name="sellable_mode"><option value="no_change">${html(text('unchanged'))}</option><option value="set">${html(text('set'))}</option><option value="clear">${html(text('clear'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('units'))}<input name="sellable_units" type="number" min="0" max="10000" /></label><label class="partner-hotel-workspace__field">${html(text('closure'))}<select name="closed_mode"><option value="no_change">${html(text('unchanged'))}</option><option value="set_closed">${html(text('closed'))}</option><option value="set_open">${html(text('open'))}</option><option value="clear">${html(text('clear'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('expiry'))}<select name="expiry_mode"><option value="no_change">${html(text('unchanged'))}</option><option value="set">${html(text('set'))}</option><option value="clear">${html(text('clear'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('futureExpiry'))}<input name="expires_at" type="datetime-local" /></label></div><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label><button class="btn-sm primary" ${eligibleRooms.length ? '' : 'disabled'}>${html(text('review'))}</button></form>${renderExternalCalendars()}</section>`;
  }

  function renderExistingFlow(section) {
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="${section}"><h2>${html(text(section))}</h2><p class="partner-hotel-workspace__panel-copy">${html(text('existingFlow'))}</p><button class="btn-sm primary" type="button" data-phw-existing-flow>${html(text('existingFlow'))}</button></section>`;
  }

  function render() {
    if (!state.root || !state.workspace) return;
    const definitions = sectionDefinitions();
    if (!definitions.some(([key]) => key === state.section)) state.section = definitions[0]?.[0] || 'overview';
    const panels = [renderOverview(), renderProperty(), renderRooms(), renderPricing(), renderAvailability(), renderExistingFlow('bookings'), renderExistingFlow('payments')].join('');
    state.root.dir = state.language === 'he' ? 'rtl' : 'ltr';
    state.root.innerHTML = `<header class="partner-hotel-workspace__header"><div class="partner-hotel-workspace__identity"><div class="partner-hotel-workspace__eyebrow">${html(text('workspace'))}</div><h1 id="partnerHotelWorkspaceTitle">${html(propertyName())}</h1><div class="partner-hotel-workspace__meta">${html(state.workspace.property.city || '')}</div></div><div class="partner-hotel-workspace__header-actions"><label class="partner-hotel-workspace__field">${html(text('language'))}<select data-phw-language><option value="pl" ${state.language === 'pl' ? 'selected' : ''}>PL</option><option value="en" ${state.language === 'en' ? 'selected' : ''}>EN</option><option value="he" ${state.language === 'he' ? 'selected' : ''}>HE</option></select></label><button class="btn-sm" data-phw-refresh>${html(text('refresh'))}</button><button class="btn-sm" data-phw-close>${html(text('back'))}</button></div></header><div class="partner-hotel-workspace__status" data-phw-status aria-live="polite">${html(text('publicOff'))}</div><div class="partner-hotel-workspace__layout"><nav class="partner-hotel-workspace__nav" aria-label="${html(text('workspace'))}">${definitions.map(([key, label]) => `<button type="button" data-phw-section="${key}" class="${state.section === key ? 'is-active' : ''}">${html(text(label))}</button>`).join('')}</nav><div class="partner-hotel-workspace__body">${panels}</div></div>`;
    state.root.querySelectorAll('[data-phw-panel]').forEach((panel) => { panel.hidden = panel.getAttribute('data-phw-panel') !== state.section; });
    syncPricingTargets();
  }

  function formI18n(data, prefix) { return Core.compactI18n(Object.fromEntries(['pl', 'en', 'he'].map((lang) => [lang, String(data.get(`${prefix}_${lang}`) || '')]))); }
  function nullableText(value) { const clean = String(value || '').trim(); return clean || null; }
  function nullableNumber(value) { const clean = String(value ?? '').trim(); return clean === '' ? null : Number(clean); }
  function list(value) { return Array.from(new Set(String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean))); }
  function contentDraft(intent) { return { contract_version: Core.CONTRACTS.contentDraft, partner_id: state.partnerId, hotel_id: state.workspace.hotel_id, access_snapshot_token: state.workspace.assignment.access_snapshot_token, content_snapshot_token: state.workspace.content_snapshot_token, intent }; }
  function pricingDraft(intent, exampleStay = null) { return { contract_version: Core.CONTRACTS.pricingDraft, partner_id: state.partnerId, hotel_id: state.workspace.hotel_id, access_snapshot_token: state.workspace.assignment.access_snapshot_token, pricing_snapshot_token: state.workspace.pricing.snapshot_token, intent, example_stay: exampleStay }; }
  function exactDateExampleSupports(roomRateId, stayDate) {
    const request = state.commercialRequest;
    const response = state.commercialPreview;
    return Boolean(request && response?.ok
      && request.pricing_snapshot_token === state.workspace.pricing.snapshot_token
      && request.check_in <= stayDate && request.check_out > stayDate
      && Array.isArray(response.pricing?.nightly_breakdown)
      && response.pricing.nightly_breakdown.some((night) => night.room_rate_id === roomRateId && night.stay_date === stayDate));
  }
  function availabilityDraft(intent) { return { contract_version: Core.CONTRACTS.availabilityDraft, partner_id: state.partnerId, hotel_id: state.workspace.hotel_id, access_snapshot_token: state.workspace.assignment.access_snapshot_token, from: state.workspace.availability.from, to: state.workspace.availability.to, availability_snapshot_token: state.workspace.availability.snapshot_token, intent }; }
  function externalCalendarDraft(intent) { return Core.buildExternalCalendarDraft(state.externalCalendar, intent); }

  async function review(domain, draft, opener) {
    setStatus(text('loading'));
    try {
      const preview = domain === 'content' ? await Repository.previewContentPlan(draft)
        : domain === 'pricing' ? await Repository.previewPricingPlan(draft)
          : domain === 'availability' ? await Repository.previewAvailabilityPlan(draft)
            : await Repository.previewExternalCalendarPlan(draft, state.externalCalendar);
      if (!preview.changed) { setStatus(text('noChange'), 'success'); return; }
      state.pending = { domain, preview, opener };
      openReview();
    } catch (error) { setStatus(error.userMessage || error.message, error.isStale ? 'warning' : 'error'); }
  }

  function commercialColumns(value, exactStay = false) {
    if (!value) return `<p>${html(text('notCalculated'))}</p>`;
    const policy = commissionRule(value.policy, value.policy.commission_mode === 'per_allocated_room_per_night' ? value.calculation_basis.quantity : null);
    return `<div class="partner-hotel-workspace-review__commercial"><div><small>${html(text(exactStay ? 'exactStayCustomerTotal' : 'customerSellingPrice'))}</small><strong>${html(formatMoney(value.customer_price, value.currency))}</strong></div><div><small>${html(text('commission'))}</small><strong>${html(formatMoney(value.cypruseye_commission, value.currency))}</strong></div><div><small>${html(text('partnerNet'))}</small><strong>${html(formatMoney(value.partner_net, value.currency))}</strong></div></div><p><small>${html(text('commissionBasis'))}: ${html(policy)}</small></p>`;
  }
  function exampleCommercial(result) { return result?.commercial ? commercialColumns(result.commercial, true) : `<p>${html(text('notCalculated'))}</p>`; }
  function focusables(node) { return Array.from(node.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')); }
  function openReview() {
    const { preview, domain } = state.pending;
    const impact = preview.impacts[0];
    state.dialog.dir = state.language === 'he' ? 'rtl' : 'ltr';
    const affectedRooms = impact.affected_room_type_ids || [];
    const affectedRates = impact.affected_room_rate_ids || [];
    state.dialog.innerHTML = `<div class="partner-hotel-workspace-review__shell"><header class="partner-hotel-workspace-review__header"><h2 id="partnerHotelWorkspaceReviewTitle">${html(text('reviewTitle'))}</h2><button class="btn-sm" type="button" data-phw-review-cancel aria-label="${html(text('cancel'))}">×</button></header><div class="partner-hotel-workspace-review__body"><div class="partner-hotel-workspace-review__impact"><strong>${html(text('impacted'))}</strong><p>${html(impactLabel(impact.entity))} · ${html(impactLabel(impact.action))}</p><p>${html(impact.fields.map(fieldLabel).join(', '))}</p>${affectedRooms.map((id) => html(roomName(id))).join(', ')} ${affectedRates.map((id) => html(rateName(id))).join(', ')}${diagnostics(impact.id)}</div>${domain === 'pricing' ? `<h3>${html(text('before'))}</h3>${commercialColumns(preview.commercial_before)}<h3>${html(text('after'))}</h3>${commercialColumns(preview.commercial_after)}${preview.example_before ? `<h3>${html(text('exampleBefore'))}</h3>${exampleCommercial(preview.example_before)}` : ''}${preview.example_after ? `<h3>${html(text('exampleAfter'))}</h3>${exampleCommercial(preview.example_after)}` : ''}<p>${html(text('readOnly'))}</p>` : ''}${domain === 'external_calendar' ? `<p>${html(text('calendarUrlNeverShown'))}</p>` : ''}${preview.blocking_reasons.map((reason) => `<div class="partner-hotel-workspace__status" data-tone="warning">${html(blockerLabel(reason))}</div>`).join('')}</div><footer class="partner-hotel-workspace-review__footer"><button class="btn-sm" type="button" data-phw-review-cancel>${html(text('cancel'))}</button><button class="btn-sm primary" type="button" data-phw-review-save ${preview.blocking_reasons.length ? 'disabled' : ''}>${html(text('save'))}</button></footer></div>`;
    state.dialog.showModal();
    focusables(state.dialog)[0]?.focus();
  }
  function closeReview() { if (state.dialog?.open) state.dialog.close(); const opener = state.pending?.opener; if (state.pending?.domain === 'external_calendar') Repository.clearReviewedPlans(); if (state.dialog) state.dialog.innerHTML = ''; state.pending = null; opener?.focus?.(); }

  async function saveReview(button) {
    if (!state.pending) return;
    button.disabled = true;
    const { domain, preview } = state.pending;
    try {
      const correlation = Core.newUuid(); const idempotency = Core.newUuid();
      const result = domain === 'content'
        ? await Repository.applyContentPlan(preview.reviewed_plan, correlation, idempotency)
        : domain === 'pricing'
          ? await Repository.applyPricingPlan(preview.reviewed_plan, correlation, idempotency)
          : domain === 'availability'
            ? await Repository.applyAvailabilityPlan(preview.reviewed_plan, correlation, idempotency)
            : await Repository.applyExternalCalendarPlan(preview.reviewed_plan, correlation, idempotency, state.pending.secretUrl || null);
      if (result.workspace) state.workspace = result.workspace;
      if (domain === 'external_calendar') state.externalCalendar = result.control;
      if (domain === 'content') { state.mediaDraft = { property: [], rooms: {} }; state.photoDraft = { property: null, rooms: {} }; }
      if (domain === 'pricing') { state.commercialPreview = null; state.commercialRequest = null; }
      closeReview(); render(); setStatus(text('saved'), 'success');
    } catch (error) {
      closeReview();
      setStatus(error.userMessage || error.message, error.isStale || error.saveSucceeded ? 'warning' : 'error');
    }
  }

  function openExternalCalendarAction(sourceId, entity, action, opener) {
    const source = state.externalCalendar?.sources.find((row) => row.id === sourceId);
    if (!source) return;
    const secret = entity === 'ical_secret';
    const secretInput = secret && action !== 'clear';
    state.dialog.dir = state.language === 'he' ? 'rtl' : 'ltr';
    state.dialog.innerHTML = `<form class="partner-hotel-workspace-review__shell" data-phw-external-action><header class="partner-hotel-workspace-review__header"><h2>${html(text(secret ? (action === 'rotate' ? 'rotateUrl' : action === 'clear' ? 'clearUrl' : 'setUrl') : action === 'trigger' ? 'triggerSync' : action === 'enable' ? 'enableSource' : 'disableSource'))}</h2><button class="btn-sm" type="button" data-phw-review-cancel>×</button></header><div class="partner-hotel-workspace-review__body">${secretInput ? `<label class="partner-hotel-workspace__field">${html(text('calendarUrl'))}<input name="ical_url" type="password" inputmode="url" autocomplete="new-password" required minlength="1" maxlength="4096"></label><p>${html(text('calendarUrlNeverShown'))}</p>` : ''}<label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" minlength="3" maxlength="500" required autofocus></label></div><footer class="partner-hotel-workspace-review__footer"><button class="btn-sm" type="button" data-phw-review-cancel>${html(text('cancel'))}</button><button class="btn-sm primary" type="submit">${html(text('review'))}</button></footer></form>`;
    state.dialog.showModal();
    focusables(state.dialog)[0]?.focus();
    state.dialog.querySelector('[data-phw-external-action]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const payload = secret ? (action === 'clear' ? { source_id: source.id } : { source_id: source.id, ical_url: String(data.get('ical_url') || '') }) : entity === 'calendar_sync' ? { source_id: source.id } : {};
      const expectedVersion = secret ? (source.binding_version || 0) : entity === 'calendar_sync' ? source.health.state_version : source.version;
      const draft = externalCalendarDraft({ entity, action, id: source.id, expected_version: expectedVersion, payload, reason: String(data.get('reason') || '').trim() });
      state.dialog.close();
      await review('external_calendar', draft, opener);
      if (state.pending?.domain === 'external_calendar') state.pending.secretUrl = secretInput ? payload.ical_url : null;
    });
  }

  function syncPricingTargets() {
    const form = state.root?.querySelector('[data-phw-pricing]'); if (!form) return;
    const entity = form.elements.entity.value;
    form.elements.target.innerHTML = pricingTargetOptions(entity);
    form.querySelector('[data-phw-exact-date]').hidden = entity !== 'exact_date_price';
    const submit = form.querySelector('button[type="submit"],button:not([type])');
    if (submit) submit.disabled = Boolean(state.workspace.pricing.mutation_blocked_reasons.length) || !form.elements.target.value;
  }

  async function uploadPhotos(form, roomId, button) {
    if (!Media) { setStatus(text('mediaUnavailable'), 'error'); return; }
    const files = form.elements.uploads?.files;
    if (!files?.length) { form.elements.uploads?.focus(); return; }
    button.disabled = true;
    setStatus(text('uploading'));
    try {
      const options = { slug: state.workspace.property.slug, assignmentId: state.workspace.assignment.id, files };
      const urls = roomId ? await Media.uploadRoom({ ...options, roomId }) : await Media.uploadProperty(options);
      if (roomId) state.mediaDraft.rooms[roomId] = Array.from(new Set([...(state.mediaDraft.rooms[roomId] || []), ...urls]));
      else state.mediaDraft.property = Array.from(new Set([...state.mediaDraft.property, ...urls]));
      appendUploadedPhotos(form, urls, roomId ? 'gallery' : 'photo');
      capturePhotoDrafts();
      form.elements.uploads.value = '';
      setStatus(text('uploadReady'), 'success');
    } catch (error) {
      if (roomId) state.mediaDraft.rooms[roomId] = Array.from(new Set([...(state.mediaDraft.rooms[roomId] || []), ...(error.uploadedUrls || [])]));
      else state.mediaDraft.property = Array.from(new Set([...state.mediaDraft.property, ...(error.uploadedUrls || [])]));
      appendUploadedPhotos(form, error.uploadedUrls || [], roomId ? 'gallery' : 'photo');
      capturePhotoDrafts();
      const definitiveMessage = error.code === 'partner_media_webp_size' ? text('uploadOutputTooLarge') : (error.message || String(error));
      setStatus(error.partialUpload ? text('uploadPartial') : definitiveMessage, error.partialUpload ? 'warning' : 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function load() {
    const generation = ++state.generation; state.loading = true;
    state.root.innerHTML = `<div class="partner-hotel-workspace__status" data-phw-status>${html(text('loading'))}</div>`;
    try {
      const from = todayIso(); const to = addDays(from, 30);
      const workspace = await Repository.getWorkspace(state.partnerId, state.assignment.hotel_id, from, to);
      if (generation !== state.generation) return;
      state.workspace = workspace;
      state.externalCalendar = null; state.externalCalendarError = null;
      if (workspace.assignment.capabilities.manage_availability === true) {
        try {
          state.externalCalendar = await Repository.getExternalCalendarControl(state.partnerId, workspace.hotel_id);
        } catch (error) {
          state.externalCalendarError = error.userMessage || error.message;
        }
      }
      if (state.commercialRequest?.pricing_snapshot_token !== workspace.pricing?.snapshot_token) { state.commercialRequest = null; state.commercialPreview = null; }
      state.loading = false; render();
    } catch (error) {
      if (generation !== state.generation) return;
      state.loading = false; state.root.innerHTML = `<button class="btn-sm" data-phw-close>${html(text('back'))}</button><div class="partner-hotel-workspace__status" data-tone="error">${html(error.userMessage || error.message)}</div>`;
    }
  }

  async function open(options = {}) {
    if (!Core || !Repository || !state.root) return;
    state.partnerId = Core.requireCanonicalUuid(options.partnerId, 'partner_id');
    Core.requireCanonicalUuid(options.assignment?.assignment_id, 'assignment_id'); Core.requireCanonicalUuid(options.assignment?.hotel_id, 'hotel_id');
    state.assignment = options.assignment; state.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.language = initialLanguage(); state.section = 'overview'; state.workspace = null; state.commercialPreview = null; state.commercialRequest = null; state.externalCalendar = null; state.externalCalendarError = null; state.mediaDraft = { property: [], rooms: {} }; state.photoDraft = { property: null, rooms: {} };
    if (state.portal) state.portal.hidden = true; state.root.hidden = false; await load(); state.root.focus?.();
  }
  function close(options = {}) {
    state.generation += 1; Repository?.clearReviewedPlans?.(); closeReview(); state.workspace = null; state.assignment = null; state.partnerId = null; state.commercialRequest = null; state.commercialPreview = null; state.externalCalendar = null; state.externalCalendarError = null; state.mediaDraft = { property: [], rooms: {} }; state.photoDraft = { property: null, rooms: {} };
    if (state.root) { state.root.hidden = true; state.root.innerHTML = ''; }
    if (options.restorePortal !== false && state.portal) state.portal.hidden = false;
    state.opener?.focus?.(); state.opener = null;
  }

  function bindRootEvents() {
    state.root.addEventListener('click', (event) => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.matches('[data-phw-close]')) { close({ restorePortal: true }); return; }
      if (button.matches('[data-phw-refresh]')) { Repository.clearReviewedPlans(); void load(); return; }
      if (button.matches('[data-phw-section]')) { capturePhotoDrafts(); state.section = button.dataset.phwSection; render(); return; }
      if (button.matches('[data-phw-existing-flow]')) { close({ restorePortal: true }); root.dispatchEvent(new CustomEvent('ce:partner-hotel-bookings')); return; }
      if (button.matches('[data-phw-room-edit]')) { state.roomEditor = { id: button.dataset.roomId, mode: button.dataset.phwRoomEdit }; render(); }
      if (button.matches('[data-phw-add-bed]')) { button.closest('form')?.querySelector('[data-phw-bed-rows]')?.insertAdjacentHTML('beforeend', bedRow()); return; }
      if (button.matches('[data-phw-remove-bed]')) { button.closest('[data-phw-bed-row]')?.remove(); return; }
      if (button.matches('[data-phw-upload-property]')) { void uploadPhotos(button.closest('form'), null, button); return; }
      if (button.matches('[data-phw-upload-room]')) { void uploadPhotos(button.closest('form'), button.closest('form')?.dataset.roomId || null, button); }
      if (button.matches('[data-phw-external-secret]')) { openExternalCalendarAction(button.dataset.sourceId, 'ical_secret', button.dataset.phwExternalSecret, button); return; }
      if (button.matches('[data-phw-external-lifecycle]')) { openExternalCalendarAction(button.dataset.sourceId, 'calendar_source', button.dataset.phwExternalLifecycle, button); return; }
      if (button.matches('[data-phw-external-sync]')) { openExternalCalendarAction(button.dataset.sourceId, 'calendar_sync', 'trigger', button); }
    });
    state.root.addEventListener('change', (event) => {
      if (event.target.matches('[data-phw-language]')) { capturePhotoDrafts(); state.language = event.target.value; render(); return; }
      if (event.target.closest('[data-phw-pricing]') && event.target.name === 'entity') syncPricingTargets();
    });
    state.root.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.target; const data = new FormData(form); const opener = form.querySelector('button[type="submit"],button:not([type])');
      if (form.matches('[data-phw-property-content]')) {
        const payload = { title_i18n: formI18n(data, 'title'), description_i18n: formI18n(data, 'description'), city: nullableText(data.get('city')), address_line: nullableText(data.get('address_line')), district: nullableText(data.get('district')), postal_code: nullableText(data.get('postal_code')), country: nullableText(data.get('country')), latitude: nullableNumber(data.get('latitude')), longitude: nullableNumber(data.get('longitude')), google_maps_url: nullableText(data.get('google_maps_url')), amenities: list(data.get('amenities')), check_in_from: nullableText(data.get('check_in_from')), check_out_until: nullableText(data.get('check_out_until')) };
        await review('content', contentDraft({ entity: 'property_content', action: 'update', id: state.workspace.hotel_id, payload, reason: String(data.get('reason') || '').trim() }), opener); return;
      }
      if (form.matches('[data-phw-property-photos]')) {
        const photos = orderedPhotos(form, 'photo'); const cover = nullableText(data.get('cover')); if (cover && !photos.includes(cover)) { setStatus(text('coverError'), 'error'); return; }
        await review('content', contentDraft({ entity: 'property_photos', action: 'update', id: state.workspace.hotel_id, payload: { cover_image_url: cover, photos }, reason: String(data.get('reason') || '').trim() }), opener); return;
      }
      if (form.matches('[data-phw-room-form]')) {
        const mode = form.dataset.phwRoomForm; const id = form.dataset.roomId; let payload;
        if (mode === 'content') payload = { name_i18n: formI18n(data, 'name'), description_i18n: formI18n(data, 'description'), amenities: list(data.get('amenities')), floor_label_i18n: formI18n(data, 'floor') };
        else if (mode === 'photos') payload = { gallery: orderedPhotos(form, 'gallery') };
        else {
          let beds;
          try { beds = bedConfigurationFromForm(form); } catch (error) { setStatus(error.message, 'error'); return; }
          payload = { capacity_adults: nullableNumber(data.get('capacity_adults')), capacity_children: nullableNumber(data.get('capacity_children')), max_occupancy: nullableNumber(data.get('max_occupancy')), bed_configuration: beds, bathrooms: nullableNumber(data.get('bathrooms')), size_sqm: nullableNumber(data.get('size_sqm')), inventory_mode: String(data.get('inventory_mode')), base_inventory_count: Number(data.get('base_inventory_count')), sort_order: Number(data.get('sort_order')) };
        }
        await review('content', contentDraft({ entity: `room_${mode}`, action: 'update', id, payload, reason: String(data.get('reason') || '').trim() }), opener); return;
      }
      if (form.matches('[data-phw-room-create]')) {
        const payload = { code: String(data.get('code') || '').trim(), name_i18n: formI18n(data, 'name'), description_i18n: formI18n(data, 'description'), gallery: [], capacity_adults: null, capacity_children: null, max_occupancy: Number(data.get('max_occupancy')), bed_configuration: [], bathrooms: Number(data.get('bathrooms')), size_sqm: nullableNumber(data.get('size_sqm')), amenities: list(data.get('amenities')), inventory_mode: String(data.get('inventory_mode')), base_inventory_count: Number(data.get('base_inventory_count')), sort_order: 0, floor_label_i18n: {} };
        await review('content', contentDraft({ entity: 'room', action: 'create', id: null, payload, reason: String(data.get('reason') || '').trim() }), opener); return;
      }
      if (form.matches('[data-phw-pricing]')) {
        const entity = String(data.get('entity')); const target = Core.requireCanonicalUuid(String(data.get('target')), 'pricing target'); const nightly = Number(data.get('nightly_rate'));
        const stayDate = String(data.get('stay_date'));
        if (entity === 'exact_date_price') {
          const existing = state.workspace.pricing.exact_date_prices.some((row) => row.room_rate_id === target && row.stay_date === stayDate);
          if (!existing && !exactDateExampleSupports(target, stayDate)) { setStatus(text('exactDateExampleRequired'), 'error'); return; }
        }
        const intent = entity === 'exact_date_price' ? { entity, action: 'upsert', id: null, payload: { room_rate_id: target, stay_date: stayDate, nightly_rate_mode: 'set', nightly_rate: nightly }, reason: String(data.get('reason') || '').trim() } : { entity, action: 'update', id: target, payload: { nightly_rate: nightly }, reason: String(data.get('reason') || '').trim() };
        const example = state.commercialRequest?.pricing_snapshot_token === state.workspace.pricing.snapshot_token ? state.commercialRequest : null;
        await review('pricing', pricingDraft(intent, example), opener); return;
      }
      if (form.matches('[data-phw-stay]')) {
        const request = { contract_version: Core.CONTRACTS.commercialRequest, partner_id: state.partnerId, hotel_id: state.workspace.hotel_id, pricing_snapshot_token: state.workspace.pricing.snapshot_token, rate_plan_id: nullableText(data.get('rate_plan_id')), allocation_rule_id: nullableText(data.get('allocation_rule_id')), selected_room_type_id: nullableText(data.get('selected_room_type_id')), check_in: String(data.get('check_in')), check_out: String(data.get('check_out')), adults: Number(data.get('adults')), child_ages: String(data.get('child_ages') || '').trim() ? String(data.get('child_ages')).split(',').map((age) => Number(age.trim())) : [] };
        try { state.commercialPreview = await Repository.previewCommercialStay(request); state.commercialRequest = request; render(); setStatus(state.commercialPreview.ok ? text('readOnly') : text('blocked'), state.commercialPreview.ok ? 'success' : 'warning'); } catch (error) { setStatus(error.userMessage || error.message, 'error'); } return;
      }
      if (form.matches('[data-phw-availability]')) {
        const payload = { room_type_id: String(data.get('room_type_id')), stay_date: String(data.get('stay_date')) };
        const sellableMode = String(data.get('sellable_mode')); if (sellableMode !== 'no_change') { payload.sellable_units_mode = sellableMode; payload.sellable_units = sellableMode === 'clear' ? null : Number(data.get('sellable_units')); }
        const closedMode = String(data.get('closed_mode')); if (closedMode !== 'no_change') { payload.closed_mode = closedMode === 'clear' ? 'clear' : 'set'; payload.closed = closedMode === 'clear' ? null : closedMode === 'set_closed'; }
        const expiryMode = String(data.get('expiry_mode'));
        if (expiryMode !== 'no_change') {
          if (expiryMode === 'clear') payload.expires_at = null;
          else {
            const instant = Date.parse(String(data.get('expires_at') || ''));
            if (!Number.isFinite(instant) || instant <= Date.now()) { setStatus(text('expiryError'), 'error'); return; }
            payload.expires_at = new Date(instant).toISOString();
          }
        }
        await review('availability', availabilityDraft({ entity: 'daily_inventory', action: 'upsert', id: null, payload, reason: String(data.get('reason') || '').trim() }), opener); return;
      }
      if (form.matches('[data-phw-external-create], [data-phw-external-source-form]')) {
        const sourceId = form.dataset.sourceId || null;
        const source = sourceId ? state.externalCalendar.sources.find((row) => row.id === sourceId) : null;
        const payload = {
          room_type_id: String(data.get('room_type_id') || ''),
          code: String(data.get('code') || '').trim(),
          source_type: String(data.get('source_type') || ''),
          sync_interval_minutes: Number(data.get('sync_interval_minutes')),
          units_per_event: Number(data.get('units_per_event')),
          priority: Number(data.get('priority')),
        };
        const draft = externalCalendarDraft({
          entity: 'calendar_source', action: source ? 'update' : 'create', id: source?.id || null,
          expected_version: source?.version || 0, payload, reason: String(data.get('reason') || '').trim(),
        });
        await review('external_calendar', draft, opener);
      }
    });
  }

  function init() {
    state.root = document.getElementById('partnerHotelWorkspaceView'); state.dialog = document.getElementById('partnerHotelWorkspaceReview'); state.portal = document.getElementById('partnerPortalView'); state.language = initialLanguage();
    if (!state.root || !state.dialog || !Core || !Repository) return;
    state.root.tabIndex = -1; bindRootEvents();
    state.dialog.addEventListener('click', (event) => { const button = event.target.closest('button'); if (button?.matches('[data-phw-review-cancel]')) closeReview(); if (button?.matches('[data-phw-review-save]')) void saveReview(button); });
    state.dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeReview(); });
    state.dialog.addEventListener('keydown', (event) => { if (event.key !== 'Tab') return; const items = focusables(state.dialog); if (!items.length) return; const first = items[0]; const last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return Object.freeze({
    open,
    close,
    text: (key) => COPY[initialLanguage()]?.[key] || COPY.en[key] || key,
    capabilityText: (key) => {
      const language = initialLanguage();
      const copyKey = { edit_property_content: 'content', edit_property_photos: 'photos', edit_room_content: 'roomContent', edit_room_photos: 'roomPhotos', create_rooms: 'createRoom', edit_room_structure: 'roomStructure', manage_prices: 'pricing', manage_availability: 'availability', process_bookings: 'bookings', request_booking_changes: 'bookingChanges', view_payment_status: 'payments', initiate_stripe_onboarding: 'stripeOnboarding' }[key];
      return COPY[language]?.[copyKey] || COPY.en[copyKey] || key;
    },
  });
});
