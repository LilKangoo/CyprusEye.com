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
      externalCalendars: 'External calendars', externalCalendarCreate: 'Add provider source', externalCalendarEdit: 'Edit source',
      calendarProvider: 'Provider', bookingCom: 'Booking.com', airbnb: 'Airbnb', genericIcal: 'Generic iCal',
      calendarProviderNote: 'All provider options use an ICS export URL. Provider is saved separately from the source code.',
      configured: 'Configured (URL hidden)', notConfigured: 'Not configured', setUrl: 'Set URL', rotateUrl: 'Rotate URL', clearUrl: 'Clear URL',
      enableSource: 'Enable', disableSource: 'Disable', triggerSync: 'Run manual sync', activationOff: 'Enable is unavailable while the global external-calendar flag is OFF.',
      syncUnavailable: 'Manual sync requires an enabled source and global activation.',
      intervalMinutes: 'Sync interval (minutes)', unitsPerEvent: 'Units per event', priority: 'Priority', health: 'Sanitized sync health',
      attempts: 'Last attempt', success: 'Last success', failure: 'Last failure', events: 'Events', activeEvents: 'Active events', blocks: 'Blocks',
      calendarUrl: 'Private HTTPS iCal URL', calendarUrlNeverShown: 'The URL is sent only for this reviewed Save and is never displayed again.',
      never_synced: 'Never synced', healthy: 'Healthy', degraded: 'Degraded', syncing: 'Syncing',
      providerUnavailable: 'Provider controls are read-only until the reviewed provider stage is installed.',
      providerWorkerUnavailable: 'Activation and manual sync remain unavailable until the reviewed worker/scheduler binding is ready.',
      privateUrlRequired: 'A private export URL is required before activation.',
      adminReviewRequired: 'Admin review is required before activation.',
      providerProposalHistory: 'Provider changes awaiting Admin review', providerProposalSubmitted: 'Provider change submitted for Admin review. Live calendar state is unchanged.',
      locationUnknown: 'Location not specified', allOff: 'All capabilities OFF', assignedHotels: 'exact assigned Hotels', loadingAssignments: 'Loading exact assigned Hotels…',
      reviewedPricingIntro: 'Propose exact independent Room prices for Admin review. Live prices do not change when this proposal is submitted.',
      reviewedPricingMatrix: 'Reviewed Room pricing matrix', minimumNights: 'Minimum nights', currentPrice: 'Current price', requestedPrice: 'Requested price',
      previewProposal: 'Preview proposal', submitProposal: 'Submit for Admin review', proposalSubmitted: 'Pricing proposal submitted for Admin review. Live pricing is unchanged.',
      proposalStatus: 'Proposal status', proposalId: 'Proposal ID', roomImpact: 'Room price impact', bundleImpact: '5–8 guest bundle impact',
      commissionReadOnly: 'Commission is server-derived and read-only.', noPricingChanges: 'Change at least one exact Room tier before Preview.',
      pricingProposalHistory: 'Reviewed pricing proposals', pricingControlUnavailable: 'Exact reviewed pricing control is unavailable. No proposal can be prepared.',
      acceptedProposal: 'Accepted', rejectedProposal: 'Rejected', consumed: 'Consumed', expires: 'Expires',
      totalBookings: 'Visible bookings', upcomingBookings: 'Upcoming', currentRecentBookings: 'Current / recent',
      noBookings: 'No matching bookings are currently available.', noPayments: 'No authorized payment summaries are currently available.',
      bookingDates: 'Stay', bookingStatus: 'Booking status', guestCount: 'Guests', roomAllocation: 'Room allocation',
      customerPays: 'Customer pays', amountPaid: 'Paid', amountRemaining: 'Remaining', paymentState: 'Payment state',
      bookingConfirmed: 'Confirmed', bookingPending: 'Pending', bookingCancelled: 'Cancelled', bookingCompleted: 'Completed',
      paymentPaid: 'Paid', paymentPartiallyPaid: 'Partially paid', paymentUnpaid: 'Unpaid', paymentPending: 'Pending',
      partnerReceives: 'Partner receives', unavailableValue: 'Unavailable', openBookingManagement: 'Open complete booking management',
      openPaymentManagement: 'Open secure payment management', bookingPresentationUnavailable: 'Booking details are unavailable from the secure read contract.',
      paymentPresentationUnavailable: 'Payment details are unavailable from the secure read contract.', lifecycleTitle: 'Current workspace state',
      pricingPendingLifecycle: 'A pricing proposal is pending Admin review; live customer prices remain unchanged.',
      providerReadyLifecycle: 'A reviewed calendar source has a private URL and is ready for activation.',
      providerSetupLifecycle: 'Provider controls are ready. Create or review a Room source and configure its private export URL before activation.',
      providerActiveLifecycle: 'An external calendar source is active. Only sanitized synchronization status is shown.',
      providerWarningLifecycle: 'An active calendar source reports a safe synchronization warning.',
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
      externalCalendars: 'Kalendarze zewnętrzne', externalCalendarCreate: 'Dodaj źródło dostawcy', externalCalendarEdit: 'Edytuj źródło',
      calendarProvider: 'Dostawca', bookingCom: 'Booking.com', airbnb: 'Airbnb', genericIcal: 'Ogólny iCal',
      calendarProviderNote: 'Wszystkie opcje dostawcy używają adresu eksportu ICS. Dostawca jest zapisywany niezależnie od kodu źródła.',
      configured: 'Skonfigurowano (URL ukryty)', notConfigured: 'Nie skonfigurowano', setUrl: 'Ustaw URL', rotateUrl: 'Obróć URL', clearUrl: 'Usuń URL',
      enableSource: 'Włącz', disableSource: 'Wyłącz', triggerSync: 'Uruchom ręczną synchronizację', activationOff: 'Włączenie jest niedostępne, gdy globalna flaga kalendarza zewnętrznego jest WYŁĄCZONA.',
      syncUnavailable: 'Ręczna synchronizacja wymaga włączonego źródła i globalnej aktywacji.',
      intervalMinutes: 'Interwał synchronizacji (minuty)', unitsPerEvent: 'Jednostki na zdarzenie', priority: 'Priorytet', health: 'Oczyszczony stan synchronizacji',
      attempts: 'Ostatnia próba', success: 'Ostatni sukces', failure: 'Ostatni błąd', events: 'Zdarzenia', activeEvents: 'Aktywne zdarzenia', blocks: 'Blokady',
      calendarUrl: 'Prywatny adres HTTPS iCal', calendarUrlNeverShown: 'URL jest wysyłany tylko dla tego sprawdzonego zapisu i nigdy nie jest ponownie wyświetlany.',
      never_synced: 'Nigdy nie synchronizowano', healthy: 'Prawidłowy', degraded: 'Pogorszony', syncing: 'Synchronizacja',
      providerUnavailable: 'Kontrolki dostawców są tylko do odczytu do czasu instalacji zweryfikowanego etapu dostawców.',
      providerWorkerUnavailable: 'Aktywacja i synchronizacja ręczna pozostają niedostępne do czasu gotowości zweryfikowanego powiązania worker/harmonogram.',
      privateUrlRequired: 'Przed aktywacją wymagany jest prywatny adres eksportu.',
      adminReviewRequired: 'Przed aktywacją wymagana jest weryfikacja przez Admina.',
      providerProposalHistory: 'Zmiany dostawców oczekujące na Admina', providerProposalSubmitted: 'Zmianę dostawcy wysłano do Admina. Bieżący stan kalendarza nie uległ zmianie.',
      locationUnknown: 'Nie podano lokalizacji', allOff: 'Wszystkie możliwości WYŁĄCZONE', assignedHotels: 'dokładnie przypisanych hoteli', loadingAssignments: 'Ładowanie dokładnie przypisanych hoteli…',
      reviewedPricingIntro: 'Zaproponuj dokładne ceny niezależnych pokoi do weryfikacji przez Admina. Wysłanie propozycji nie zmienia bieżących cen.',
      reviewedPricingMatrix: 'Macierz cen pokoju do weryfikacji', minimumNights: 'Minimalna liczba nocy', currentPrice: 'Bieżąca cena', requestedPrice: 'Proponowana cena',
      previewProposal: 'Wyświetl propozycję', submitProposal: 'Wyślij do Admina', proposalSubmitted: 'Propozycję cen wysłano do weryfikacji przez Admina. Bieżące ceny nie uległy zmianie.',
      proposalStatus: 'Status propozycji', proposalId: 'Identyfikator propozycji', roomImpact: 'Wpływ na cenę pokoju', bundleImpact: 'Wpływ na pakiet dla 5–8 gości',
      commissionReadOnly: 'Prowizja jest wyliczana przez serwer i tylko do odczytu.', noPricingChanges: 'Przed podglądem zmień co najmniej jeden dokładny próg pokoju.',
      pricingProposalHistory: 'Propozycje cen do weryfikacji', pricingControlUnavailable: 'Dokładna kontrola cen do weryfikacji jest niedostępna. Nie można przygotować propozycji.',
      acceptedProposal: 'Zaakceptowana', rejectedProposal: 'Odrzucona', consumed: 'Rozpatrzona', expires: 'Wygasa',
      totalBookings: 'Widoczne rezerwacje', upcomingBookings: 'Nadchodzące', currentRecentBookings: 'Bieżące / ostatnie',
      noBookings: 'Obecnie nie ma pasujących rezerwacji.', noPayments: 'Obecnie nie ma dostępnych podsumowań płatności w tym zakresie uprawnień.',
      bookingDates: 'Pobyt', bookingStatus: 'Status rezerwacji', guestCount: 'Goście', roomAllocation: 'Przydział pokoi',
      customerPays: 'Klient płaci', amountPaid: 'Zapłacono', amountRemaining: 'Pozostało', paymentState: 'Stan płatności',
      bookingConfirmed: 'Potwierdzona', bookingPending: 'Oczekująca', bookingCancelled: 'Anulowana', bookingCompleted: 'Zakończona',
      paymentPaid: 'Zapłacono', paymentPartiallyPaid: 'Częściowo zapłacono', paymentUnpaid: 'Niezapłacona', paymentPending: 'Oczekuje',
      partnerReceives: 'Partner otrzymuje', unavailableValue: 'Niedostępne', openBookingManagement: 'Otwórz pełną obsługę rezerwacji',
      openPaymentManagement: 'Otwórz bezpieczną obsługę płatności', bookingPresentationUnavailable: 'Szczegóły rezerwacji są niedostępne w bezpiecznym kontrakcie odczytu.',
      paymentPresentationUnavailable: 'Szczegóły płatności są niedostępne w bezpiecznym kontrakcie odczytu.', lifecycleTitle: 'Bieżący stan panelu',
      pricingPendingLifecycle: 'Propozycja ceny oczekuje na akceptację Admina; aktualne ceny dla klientów nie uległy zmianie.',
      providerReadyLifecycle: 'Zweryfikowane źródło kalendarza ma prywatny URL i jest gotowe do aktywacji.',
      providerSetupLifecycle: 'Kontrolki dostawców są gotowe. Utwórz lub zweryfikuj źródło Pokoju i skonfiguruj jego prywatny adres eksportu przed aktywacją.',
      providerActiveLifecycle: 'Źródło kalendarza zewnętrznego jest aktywne. Widoczny jest wyłącznie bezpieczny stan synchronizacji.',
      providerWarningLifecycle: 'Aktywne źródło kalendarza zgłasza bezpieczne ostrzeżenie synchronizacji.',
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
      externalCalendars: 'יומנים חיצוניים', externalCalendarCreate: 'הוספת מקור ספק', externalCalendarEdit: 'עריכת מקור',
      calendarProvider: 'ספק', bookingCom: 'Booking.com', airbnb: 'Airbnb', genericIcal: 'iCal כללי',
      calendarProviderNote: 'כל אפשרויות הספק משתמשות בכתובת יצוא ICS. הספק נשמר בנפרד מקוד המקור.',
      configured: 'מוגדר (הכתובת מוסתרת)', notConfigured: 'לא מוגדר', setUrl: 'הגדרת כתובת', rotateUrl: 'החלפת כתובת', clearUrl: 'מחיקת כתובת',
      enableSource: 'הפעלה', disableSource: 'השבתה', triggerSync: 'הפעלת סנכרון ידני', activationOff: 'אי אפשר להפעיל כל עוד הדגל הגלובלי של יומן חיצוני כבוי.',
      syncUnavailable: 'סנכרון ידני דורש מקור פעיל והפעלה גלובלית.',
      intervalMinutes: 'מרווח סנכרון (דקות)', unitsPerEvent: 'יחידות לאירוע', priority: 'עדיפות', health: 'מצב סנכרון מסונן',
      attempts: 'ניסיון אחרון', success: 'הצלחה אחרונה', failure: 'כשל אחרון', events: 'אירועים', activeEvents: 'אירועים פעילים', blocks: 'חסימות',
      calendarUrl: 'כתובת iCal פרטית ב-HTTPS', calendarUrlNeverShown: 'הכתובת נשלחת רק בשמירה שנבדקה ואינה מוצגת שוב.',
      never_synced: 'טרם סונכרן', healthy: 'תקין', degraded: 'פגום', syncing: 'בסנכרון',
      providerUnavailable: 'בקרות הספק הן לקריאה בלבד עד להתקנת שלב הספק שנבדק.',
      providerWorkerUnavailable: 'הפעלה וסנכרון ידני אינם זמינים עד שמוכן חיבור ה-worker/מתזמן שנבדק.',
      privateUrlRequired: 'נדרשת כתובת יצוא פרטית לפני הפעלה.',
      adminReviewRequired: 'נדרשת בדיקת Admin לפני הפעלה.',
      providerProposalHistory: 'שינויי ספק הממתינים לבדיקת Admin', providerProposalSubmitted: 'שינוי הספק נשלח לבדיקת Admin. מצב היומן החי לא השתנה.',
      locationUnknown: 'לא צוין מיקום', allOff: 'כל היכולות כבויות', assignedHotels: 'מלונות משויכים מדויקים', loadingAssignments: 'טוען מלונות משויכים מדויקים…',
      reviewedPricingIntro: 'הצעת מחירים מדויקים לחדרים עצמאיים לבדיקת Admin. השליחה אינה משנה את המחירים החיים.',
      reviewedPricingMatrix: 'מטריצת תמחור חדרים לבדיקה', minimumNights: 'מינימום לילות', currentPrice: 'מחיר נוכחי', requestedPrice: 'מחיר מבוקש',
      previewProposal: 'תצוגה מקדימה להצעה', submitProposal: 'שליחה לבדיקת Admin', proposalSubmitted: 'הצעת התמחור נשלחה לבדיקת Admin. התמחור החי לא השתנה.',
      proposalStatus: 'סטטוס הצעה', proposalId: 'מזהה הצעה', roomImpact: 'השפעה על מחיר החדר', bundleImpact: 'השפעה על חבילה ל־5–8 אורחים',
      commissionReadOnly: 'העמלה מחושבת בשרת ומוצגת לקריאה בלבד.', noPricingChanges: 'יש לשנות לפחות מדרגת חדר מדויקת אחת לפני התצוגה המקדימה.',
      pricingProposalHistory: 'הצעות תמחור לבדיקה', pricingControlUnavailable: 'בקרת התמחור המדויקת אינה זמינה. לא ניתן להכין הצעה.',
      acceptedProposal: 'אושרה', rejectedProposal: 'נדחתה', consumed: 'טופלה', expires: 'תפוגה',
      totalBookings: 'הזמנות מוצגות', upcomingBookings: 'קרובות', currentRecentBookings: 'נוכחיות / אחרונות',
      noBookings: 'אין כרגע הזמנות תואמות.', noPayments: 'אין כרגע סיכומי תשלום מורשים להצגה.',
      bookingDates: 'שהייה', bookingStatus: 'סטטוס הזמנה', guestCount: 'אורחים', roomAllocation: 'הקצאת חדרים',
      customerPays: 'הלקוח משלם', amountPaid: 'שולם', amountRemaining: 'נותר', paymentState: 'מצב תשלום',
      bookingConfirmed: 'מאושרת', bookingPending: 'ממתינה', bookingCancelled: 'בוטלה', bookingCompleted: 'הושלמה',
      paymentPaid: 'שולם', paymentPartiallyPaid: 'שולם חלקית', paymentUnpaid: 'לא שולם', paymentPending: 'ממתין',
      partnerReceives: 'השותף מקבל', unavailableValue: 'לא זמין', openBookingManagement: 'פתיחת ניהול ההזמנה המלא',
      openPaymentManagement: 'פתיחת ניהול התשלום המאובטח', bookingPresentationUnavailable: 'פרטי ההזמנה אינם זמינים מחוזה הקריאה המאובטח.',
      paymentPresentationUnavailable: 'פרטי התשלום אינם זמינים מחוזה הקריאה המאובטח.', lifecycleTitle: 'מצב סביבת העבודה הנוכחי',
      pricingPendingLifecycle: 'הצעת מחיר ממתינה לבדיקת Admin; המחירים החיים ללקוחות לא השתנו.',
      providerReadyLifecycle: 'למקור יומן שנבדק יש כתובת פרטית והוא מוכן להפעלה.',
      providerSetupLifecycle: 'בקרות הספק מוכנות. יש ליצור או לבדוק מקור לחדר ולהגדיר את כתובת היצוא הפרטית שלו לפני הפעלה.',
      providerActiveLifecycle: 'מקור יומן חיצוני פעיל. מוצג רק מצב סנכרון מסונן ובטוח.',
      providerWarningLifecycle: 'מקור יומן פעיל מציג אזהרת סנכרון בטוחה.',
    },
  });

  // Presentation-only copy. Backend permission and review contracts remain in Core/Repository.
  const PORTAL_COPY = {
    en: {
      refresh: 'Refresh workspace', loading: 'Loading your hotel…', access: 'Your permissions',
      workspace: 'Partner workspace', publicOff: 'Partner tools do not publish public booking. Changes follow the available review process.',
      management: 'Hotel management', more: 'More', support: 'Support', close: 'Close',
      publicBooking: 'Public booking', ready: 'Ready', approval: 'Admin approval', required: 'Required',
      quickAccess: 'Your hotel, at a glance', welcome: 'Everything you need to manage your property, in one place.',
      lastRefresh: 'Last workspace refresh', notProvided: 'Not provided', activeData: 'Active data',
      draftProposal: 'Draft proposal', approvalStep: 'Admin decision', activePricing: 'Active pricing',
      localDraft: 'Changes here are a draft. Live prices stay unchanged until Admin approval.',
      sourceCount: 'Calendar sources', searchBookings: 'Search booking ID, status or room', allStatuses: 'All statuses',
      payoutServices: 'Automatic payouts', technical: 'View diagnostics', hotel: 'Hotel',
      supportCopy: 'Contact your CyprusEye administrator through your existing support channel. Do not send passwords or private calendar URLs.',
      overviewHint: 'A clear view of your hotel and the tools available to your assignment.',
      propertyHint: 'Keep property information and photos up to date through review.',
      roomsHint: 'Manage room content, photos and approved room structure.',
      pricingHint: 'View live prices and prepare changes for Admin approval.',
      availabilityHint: 'View availability and manage supported calendar sources.',
      bookingsHint: 'See authorized stays and open existing booking management.',
      paymentsHint: 'Check available payment information and your commission policy.',
      draftTimeline: 'Active data → Draft → Review → Admin decision → Active',
      availabilitySnapshot: 'Availability snapshot', availableUnits: 'Available units',
      noResults: 'No matching results', retry: 'Try refresh again', ratesShort: 'Rates', roomList: 'Room list',
    },
    pl: {
      refresh: 'Odśwież panel', loading: 'Ładowanie hotelu…', access: 'Twoje uprawnienia',
      workspace: 'Panel Partnera', publicOff: 'Panel Partnera nie publikuje rezerwacji publicznych. Zmiany przechodzą dostępny proces weryfikacji.',
      management: 'Zarządzanie hotelem', more: 'Więcej', support: 'Pomoc', close: 'Zamknij',
      publicBooking: 'Rezerwacje publiczne', ready: 'Gotowe', approval: 'Zgoda Admina', required: 'Wymagana',
      quickAccess: 'Twój hotel w skrócie', welcome: 'Wszystko, czego potrzebujesz do zarządzania obiektem, w jednym miejscu.',
      lastRefresh: 'Ostatnie odświeżenie', notProvided: 'Nie podano', activeData: 'Aktywne dane',
      draftProposal: 'Projekt propozycji', approvalStep: 'Decyzja Admina', activePricing: 'Aktywne ceny',
      localDraft: 'Zmiany są projektem. Ceny dla klientów nie zmienią się przed zgodą Admina.',
      sourceCount: 'Źródła kalendarza', searchBookings: 'Szukaj ID rezerwacji, statusu lub pokoju', allStatuses: 'Wszystkie statusy',
      payoutServices: 'Automatyczne wypłaty', technical: 'Zobacz diagnostykę', hotel: 'Hotel',
      supportCopy: 'Skontaktuj się z administratorem CyprusEye przez dotychczasowy kanał pomocy. Nie wysyłaj haseł ani prywatnych adresów kalendarza.',
      overviewHint: 'Stan hotelu i narzędzia dostępne dla Twojego przypisania.',
      propertyHint: 'Aktualizuj dane i zdjęcia obiektu w procesie weryfikacji.',
      roomsHint: 'Zarządzaj opisami, zdjęciami i zatwierdzoną strukturą pokoi.',
      pricingHint: 'Sprawdź aktywne ceny i przygotuj propozycję dla Admina.',
      availabilityHint: 'Sprawdź dostępność i obsługiwane źródła kalendarza.',
      bookingsHint: 'Zobacz dostępne pobyty i otwórz zarządzanie rezerwacjami.',
      paymentsHint: 'Sprawdź dostępne płatności i zasady prowizji.',
      draftTimeline: 'Aktywne dane → Projekt → Weryfikacja → Decyzja Admina → Aktywne',
      availabilitySnapshot: 'Bieżąca dostępność', availableUnits: 'Dostępne jednostki',
      noResults: 'Brak pasujących wyników', retry: 'Spróbuj odświeżyć ponownie', ratesShort: 'Ceny', roomList: 'Lista pokoi',
    },
    he: {
      refresh: 'רענון סביבת העבודה', loading: 'טוען את המלון…', access: 'ההרשאות שלך',
      workspace: 'סביבת השותף', publicOff: 'כלי השותף אינם מפעילים הזמנות לציבור. שינויים עוברים את תהליך הבדיקה הזמין.',
      management: 'ניהול המלון', more: 'עוד', support: 'תמיכה', close: 'סגירה',
      publicBooking: 'הזמנות לציבור', ready: 'מוכן', approval: 'אישור מנהל', required: 'נדרש',
      quickAccess: 'המלון שלך במבט אחד', welcome: 'כל מה שצריך לניהול הנכס, במקום אחד.',
      lastRefresh: 'רענון אחרון', notProvided: 'לא נמסר', activeData: 'נתונים פעילים',
      draftProposal: 'טיוטת הצעה', approvalStep: 'החלטת מנהל', activePricing: 'מחירים פעילים',
      localDraft: 'השינויים כאן הם טיוטה. המחירים ללקוחות לא ישתנו עד לאישור מנהל.',
      sourceCount: 'מקורות יומן', searchBookings: 'חיפוש מזהה הזמנה, סטטוס או חדר', allStatuses: 'כל הסטטוסים',
      payoutServices: 'תשלומים אוטומטיים', technical: 'הצגת אבחון', hotel: 'מלון',
      supportCopy: 'אפשר לפנות למנהל CyprusEye בערוץ התמיכה הקיים. אין לשלוח סיסמאות או כתובות יומן פרטיות.',
      overviewHint: 'מצב המלון והכלים הזמינים בהתאם להרשאות שלך.',
      propertyHint: 'עדכון פרטי הנכס והתמונות באמצעות בדיקה.',
      roomsHint: 'ניהול תוכן, תמונות ומבנה מאושר של החדרים.',
      pricingHint: 'הצגת מחירים פעילים והכנת שינויים לאישור מנהל.',
      availabilityHint: 'הצגת זמינות וניהול מקורות יומן נתמכים.',
      bookingsHint: 'הצגת שהיות מורשות ופתיחת ניהול ההזמנות הקיים.',
      paymentsHint: 'הצגת מידע זמין על תשלומים ומדיניות העמלה.',
      draftTimeline: 'נתונים פעילים ← טיוטה ← בדיקה ← החלטת מנהל ← פעיל',
      availabilitySnapshot: 'תמונת זמינות', availableUnits: 'יחידות זמינות',
      noResults: 'אין תוצאות תואמות', retry: 'ניסיון רענון נוסף', ratesShort: 'מחירים', roomList: 'רשימת חדרים',
    },
  };

  const state = {
    root: null, dialog: null, portal: null, partnerId: null, assignment: null, workspace: null,
    language: 'en', section: 'overview', loading: false, generation: 0, pending: null,
    opener: null, roomEditor: null, commercialPreview: null, commercialRequest: null,
    pricingProposal: null, pricingControl: null, pricingControlError: null,
    mediaDraft: { property: [], rooms: {} }, photoDraft: { property: null, rooms: {} },
    externalCalendar: null, externalCalendarError: null,
    presentation: null, presentationError: null, helpController: null, lastRefresh: null,
  };

  function text(key) { return PORTAL_COPY[state.language]?.[key] || COPY[state.language]?.[key] || COPY.en[key] || key; }
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
  function icon(key) {
    const paths = {
      overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
      property: 'M3 21V7l9-4 9 4v14M8 21v-5h8v5M7 9h2m6 0h2M7 12h2m6 0h2',
      rooms: 'M3 18V8m18 10V8M3 14h18M5 14V9h14v5M7 6h10',
      pricing: 'M4 20V10m8 10V4m8 16v-7', availability: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16M8 14h2m4 0h2',
      bookings: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6',
      payments: 'M3 6h18v13H3zM3 10h18m-5 5h2', more: 'M5 12h1m5 0h1m5 0h1',
      support: 'M9 8a3 3 0 116 0c0 2-3 2-3 4m0 4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0',
    };
    return `<svg class="phw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key] || paths.overview}"/></svg>`;
  }
  function statusBadge(label, tone = 'info') { return `<span class="phw-badge" data-state="${tone}">${html(label)}</span>`; }
  function metricCard(label, value, tone, detail = '') {
    return `<article class="phw-metric"><span>${html(label)}</span>${statusBadge(value, tone)}${detail ? `<small>${html(detail)}</small>` : ''}</article>`;
  }
  function workspaceStatuses() {
    const pricing = state.workspace.pricing;
    const rates = pricing?.room_rates || [];
    const pricesActive = rates.length > 0 && rates.every((rate) => rate.is_active === true && rate.review_status === 'reviewed');
    const sources = state.externalCalendar?.sources;
    const externalActive = state.workspace.feature_flags.hotel_external_sync_enabled === true
      && sources?.some((row) => row.is_enabled === true);
    const externalReady = state.externalCalendar?.provider_capability?.stage === 'provider_types_active'
      && sources?.some((row) => row.review_status === 'reviewed' && row.secret_configured === true);
    return [
      [text('workspace'), text(state.workspace.sections.overview.available ? 'active' : 'unavailable'), state.workspace.sections.overview.available ? 'success' : 'muted'],
      [text('pricing'), text(!pricing ? 'unavailable' : pricesActive ? 'active' : 'inactive'), pricesActive ? 'success' : 'muted'],
      [text('approval'), text(capability('edit_property_content') || capability('edit_property_photos') || state.pricingControl ? 'required' : 'readOnly'), 'warning'],
      [text('externalCalendars'), text(!state.externalCalendar ? 'unavailable' : externalActive ? 'active' : externalReady ? 'ready' : 'notConfigured'), externalActive || externalReady ? 'success' : 'muted'],
    ];
  }
  function publicStatus() {
    const flag = state.workspace.feature_flags.hotel_rooms_v2_enabled;
    return `${html(text('publicBooking'))} ${statusBadge(text(flag === true ? 'active' : flag === false ? 'disabled' : 'unavailable'), flag === true ? 'success' : 'muted')}`;
  }
  function navButton(key, label, mobile = false) {
    return `<button type="button" data-phw-section="${key}" ${state.section === key ? 'aria-current="page"' : ''} class="${state.section === key ? 'is-active' : ''}">${icon(label)}<span>${html(text(mobile && label === 'pricing' ? 'ratesShort' : label))}</span></button>`;
  }
  function proposalTimeline() {
    return `<ol class="phw-timeline" aria-label="${html(text('draftTimeline'))}">${['activeData', 'draftProposal', 'review', 'approvalStep', 'active'].map((key, i) => `<li><span>${i + 1}</span>${html(text(key))}</li>`).join('')}</ol>`;
  }
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
    const keys = { active: 'active', inactive: 'inactive', draft: 'draft', disabled: 'disabled', requires_review: 'requiresReview', reviewed: 'reviewed', pooled: 'pooled', unitized: 'unitized', pending_admin_review: 'pendingReview', accepted: 'acceptedProposal', rejected: 'rejectedProposal' };
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
      `${text('size')}: ${room.size_sqm == null ? text('notProvided') : `${room.size_sqm} · ${text('confirmed')}`}`,
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
      <h2>${html(text('overview'))}</h2><p class="partner-hotel-workspace__panel-copy">${html(text('welcome'))}</p>
      <div class="phw-metrics">${workspaceStatuses().map(([label, value, tone]) => metricCard(label, value, tone)).join('')}</div>
      <h3>${html(text('quickAccess'))}</h3><div class="phw-quick-links">${sectionDefinitions().filter(([key]) => key !== 'overview').map(([key, label]) => `<button type="button" data-phw-section="${key}" class="phw-quick-link">${icon(label)}<strong>${html(text(label))}</strong><span>${html(text(`${label}Hint`))}</span><b aria-hidden="true">↗</b></button>`).join('')}</div>
      <div class="partner-hotel-workspace__grid phw-overview-details">
        <div class="partner-hotel-workspace__card"><h3>${html(text('access'))}</h3><div class="partner-hotel-workspace__chips">${enabled.map((key) => `<span class="partner-hotel-workspace__chip">${html(capabilityLabel(key))}</span>`).join('') || `<span>${html(text('unavailable'))}</span>`}</div></div>
        <div class="partner-hotel-workspace__card"><h3>${html(text('publicBooking'))}</h3><p>${publicStatus()}</p><p>${html(text('publicOff'))}</p></div>
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
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="property_content"><h2>${html(text('property'))}</h2><article class="partner-hotel-workspace__card phw-property-current">${statusBadge(text('activeData'), 'success')}<h3>${html(localized(canonical.title_i18n))}</h3><p>${html([canonical.address_line, canonical.city, canonical.country].filter(Boolean).join(', '))}</p><p>${html(localized(canonical.description_i18n, text('notProvided')))}</p></article>${proposalTimeline()}${draft.exists ? `<div class="partner-hotel-workspace__status" data-tone="warning">${html(text('pendingReview'))}</div>` : ''}${contentForm}${photosForm}</section>`;
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
    const roomTabs = [['all', 'roomList'], ...(capability('edit_room_content') ? [['content', 'roomContent']] : []), ...(capability('edit_room_photos') ? [['photos', 'roomPhotos']] : []), ...(capability('edit_room_structure') ? [['structure', 'roomStructure']] : [])];
    const tabs = `<div class="phw-room-tabs" role="group" aria-label="${html(text('rooms'))}">${roomTabs.map(([key, label]) => `<button type="button" class="btn-sm" data-phw-room-tab="${key}" aria-pressed="${key === 'all'}">${html(text(label))}</button>`).join('')}</div>`;
    const selected = rooms.find((room) => room.id === state.roomEditor?.id) || null;
    const cards = rooms.map((room) => `<article class="partner-hotel-workspace__card"><h3>${html(localized(room.name_i18n, room.code))}</h3>${statusBadge(enumLabel(room.status), room.status === 'active' ? 'success' : room.status === 'draft' ? 'info' : 'muted')}<ul class="partner-hotel-workspace__room-facts">${roomFacts(room).map((fact) => `<li>${html(fact)}</li>`).join('')}</ul><p>${html(room.amenities.length ? room.amenities.join(' · ') : text('noneConfigured'))}</p><div class="partner-hotel-workspace__actions">${capability('edit_room_content') && room.status !== 'disabled' ? `<button class="btn-sm" data-phw-room-edit="content" data-room-id="${room.id}">${html(text('editContent'))}</button>` : ''}${capability('edit_room_photos') && room.status !== 'disabled' ? `<button class="btn-sm" data-phw-room-edit="photos" data-room-id="${room.id}">${html(text('editPhotos'))}</button>` : ''}${capability('edit_room_structure') && room.status !== 'disabled' ? `<button class="btn-sm" data-phw-room-edit="structure" data-room-id="${room.id}">${html(text('editStructure'))}</button>` : ''}</div>${diagnostics(room.id)}</article>`).join('');
    const create = capability('create_rooms') ? `<details class="partner-hotel-workspace__card"><summary>${html(text('createRoom'))}</summary><form class="partner-hotel-workspace__form" data-phw-room-create><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('code'))}<input name="code" required /></label>${i18nFields('name', {})}${i18nFields('description', {}, true)}<label class="partner-hotel-workspace__field">${html(text('maximumOccupancy'))}<input name="max_occupancy" type="number" min="1" max="50" required /></label><label class="partner-hotel-workspace__field">${html(text('bathrooms'))}<input name="bathrooms" type="number" min="0" max="20" step="0.5" value="1" /></label><label class="partner-hotel-workspace__field">${html(text('size'))}<input name="size_sqm" type="number" min="1" step="0.1" /></label><label class="partner-hotel-workspace__field">${html(text('baseInventory'))}<input name="base_inventory_count" type="number" min="0" value="1" /></label><label class="partner-hotel-workspace__field">${html(text('inventoryMode'))}<select name="inventory_mode"><option value="pooled">${html(text('pooled'))}</option><option value="unitized">${html(text('unitized'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('amenities'))}<input name="amenities" /></label></div><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label><button class="btn-sm primary">${html(text('review'))}</button></form></details>` : '';
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="rooms"><h2>${html(text('rooms'))}</h2>${tabs}<div class="partner-hotel-workspace__grid">${cards || `<p>${html(text('empty'))}</p>`}${create}</div>${renderRoomEditor(selected)}</section>`;
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
    const reviewedTargets = Core.sevenArchesReviewedPricingTargets(state.workspace);
    if (reviewedTargets) return renderSevenArchesReviewedPricing(pricing, reviewedTargets);
    if (Core.hasSevenArchesReviewedPricingIdentity(state.workspace)) {
      return `<section class="partner-hotel-workspace__panel" data-phw-panel="rates_pricing"><h2>${html(text('pricing'))}</h2><div class="partner-hotel-workspace__status" data-tone="error">${html(text('pricingControlUnavailable'))}</div></section>`;
    }
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

  function renderSevenArchesReviewedPricing(pricing, targets) {
    const policy = pricing.commission_policy;
    const policyCard = policy ? `<article class="partner-hotel-workspace__card" data-phw-commission-policy><h3>${html(text('commissionPolicy'))}</h3><p><strong>${html(commissionRule(policy))}</strong></p><p>${html(text('commissionReadOnly'))}</p><small>${html(policy.code)}</small></article>` : '';
    const proposals = [...(state.pricingControl?.proposals || [])];
    if (state.pricingProposal && !proposals.some((entry) => entry.proposal_id === state.pricingProposal.proposal_id)) {
      proposals.unshift({ ...state.pricingProposal, reason: '', item_count: 0, created_at: null, expires_at: null, consumed_at: null });
    }
    const proposalStatus = (entry) => entry.status === 'pending_admin_review'
      && entry.expires_at && Date.parse(entry.expires_at) <= Date.now()
      ? 'expired'
      : entry.status;
    const proposal = proposals.length ? `<section data-phw-reviewed-pricing-status><h3>${html(text('pricingProposalHistory'))}</h3><div class="partner-hotel-workspace__grid">${proposals.map((entry) => `<article class="partner-hotel-workspace__card"><strong>${html(enumLabel(proposalStatus(entry)))}</strong><p>${entry.reason ? html(entry.reason) : ''}</p><small>${html(text('proposalId'))}: ${html(entry.proposal_id)}</small>${entry.expires_at ? `<br><small>${html(text('expires'))}: ${html(entry.expires_at)}</small>` : ''}${entry.consumed_at ? `<br><small>${html(text('consumed'))}: ${html(entry.consumed_at)}</small>` : ''}</article>`).join('')}</div></section>` : '';
    const hasPending = proposals.some((entry) => proposalStatus(entry) === 'pending_admin_review');
    const canPropose = capability('manage_prices') && state.pricingControl && !hasPending;
    const matrices = targets.map((target) => {
      const guests = [...new Set(target.tiers.map((tier) => tier.guest_count))].sort((a, b) => a - b);
      const nights = [...new Set(target.tiers.map((tier) => tier.threshold_nights))].sort((a, b) => a - b);
      const guestAttrs = (guest) => `data-phw-guest-cell="${guest}" data-guest-hidden="${guest !== guests[0]}"`;
      const rows = nights.map((night) => `<tr><th scope="row">${night}<small>${html(text('nights'))}</small></th>${guests.map((guest) => {
        const tier = target.tiers.find((row) => row.threshold_nights === night && row.guest_count === guest);
        if (!tier) return `<td ${guestAttrs(guest)}>${html(text('notProvided'))}</td>`;
        return `<td ${guestAttrs(guest)} data-phw-reviewed-tier-row><span class="phw-active-price">${html(formatMoney(tier.nightly_rate, target.schedule.currency))}</span><label class="partner-hotel-workspace__field"><span class="phw-sr-only">${html(text('requestedPrice'))}</span><input data-phw-reviewed-tier name="price_${html(tier.id)}" data-tier-id="${html(tier.id)}" data-before-price="${html(tier.nightly_rate)}" type="number" min="10" max="9999999999.99" step="0.01" value="${html(tier.nightly_rate)}" ${canPropose ? '' : 'disabled'} aria-label="${html(`${localized(target.room.name_i18n, target.room.code)} · ${guest} ${text('guests')} · ${night} ${text('nights')} · ${text('requestedPrice')}`)}"></label></td>`;
      }).join('')}</tr>`).join('');
      return `<article class="partner-hotel-workspace__card phw-pricing-room" data-phw-reviewed-room="${html(target.roomKey)}"><header><div>${statusBadge(text('activePricing'), 'success')}<h3>${html(localized(target.room.name_i18n, target.room.code))}</h3></div><span class="phw-tier-count">${target.tiers.length} · ${html(target.schedule.currency)}</span></header><p>${html(localized(target.schedule.name_i18n, target.schedule.code))} · ${html(text('reviewedPricingMatrix'))}</p><p>${html(text('localDraft'))}</p><label class="partner-hotel-workspace__field phw-guest-selector">${html(text('guests'))}<select data-phw-guest-filter>${guests.map((guest) => `<option value="${guest}">${guest} ${html(text('guests'))}</option>`).join('')}</select></label><div class="partner-hotel-workspace__table-wrap"><table class="phw-price-matrix"><caption>${html(text('currentPrice'))} / ${html(text('draftProposal'))}</caption><thead><tr><th scope="col">${html(text('minimumNights'))}</th>${guests.map((guest) => `<th scope="col" ${guestAttrs(guest)}>${guest} ${html(text('guests'))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${diagnostics(target.room.id)}${diagnostics(target.rate.id)}</article>`;
    }).join('');
    const unavailable = state.pricingControlError ? `<div class="partner-hotel-workspace__status" data-tone="error">${html(state.pricingControlError)}</div>` : '';
    const form = canPropose ? `<form class="partner-hotel-workspace__form" data-phw-seven-arches-pricing><div class="partner-hotel-workspace__grid">${matrices}${policyCard}</div><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" minlength="3" maxlength="500" required></label><button class="btn-sm primary" type="submit">${html(text('previewProposal'))}</button></form>` : `<div class="partner-hotel-workspace__grid">${matrices}${policyCard}</div><div class="partner-hotel-workspace__status" data-tone="warning">${html(text(hasPending ? 'pendingReview' : 'pricingControlUnavailable'))}</div>`;
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="rates_pricing"><h2>${html(text('pricing'))}</h2><p class="partner-hotel-workspace__panel-copy">${html(text('reviewedPricingIntro'))}</p>${proposalTimeline()}${proposal}${unavailable}${form}</section>`;
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
    const capability = control.provider_capability;
    const providerActive = capability.stage === 'provider_types_active';
    const roomOptions = control.rooms.filter((room) => room.status === 'active')
      .map((room) => `<option value="${room.id}">${html(localized(room.name_i18n, room.id))}</option>`).join('');
    let cards = control.sources.map((source) => {
      const room = control.rooms.find((entry) => entry.id === source.room_type_id);
      const health = source.health;
      const canReview = providerActive && capability.source_review_available;
      const canManageUrl = canReview && capability.private_url_management_available && !source.is_enabled;
      const canEnable = capability.activation_available && source.secret_configured && source.review_status === 'reviewed';
      const blocker = !source.secret_configured
        ? 'privateUrlRequired'
        : source.review_status !== 'reviewed'
          ? 'adminReviewRequired'
          : !capability.worker_scheduler_ready ? 'providerWorkerUnavailable' : 'activationOff';
      return `<article class="partner-hotel-workspace__card" data-phw-external-source="${source.id}" data-provider-stage="${html(capability.stage)}"><h4>${html(source.code)}</h4><p>${html(externalCalendarProviderLabel(source.source_type))} · ${html(localized(room?.name_i18n, source.room_type_id))} · ${html(source.secret_configured ? text('configured') : text('notConfigured'))} · ${html(source.review_status)}</p><p>${html(text('health'))}: ${html(text(health.status))}</p><dl><div><dt>${html(text('attempts'))}</dt><dd>${html(health.last_attempt_at || '—')}</dd></div><div><dt>${html(text('success'))}</dt><dd>${html(health.last_success_at || '—')}</dd></div><div><dt>${html(text('failure'))}</dt><dd>${html(health.last_error_code || health.last_error_message || '—')}</dd></div><div><dt>${html(text('events'))}</dt><dd>${health.last_event_count}</dd></div><div><dt>${html(text('activeEvents'))}</dt><dd>${health.last_active_event_count}</dd></div><div><dt>${html(text('blocks'))}</dt><dd>${health.last_block_count}</dd></div></dl><form class="partner-hotel-workspace__form" data-phw-external-source-form data-source-id="${source.id}"><h5>${html(text('externalCalendarEdit'))}</h5><fieldset ${canReview ? '' : 'disabled'}><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('calendarProvider'))}<select name="source_type" required>${externalCalendarProviderOptions(source.source_type)}</select></label><label class="partner-hotel-workspace__field">${html(text('room'))}<select name="room_type_id">${roomOptions.replace(`value="${source.room_type_id}"`, `value="${source.room_type_id}" selected`)}</select></label><label class="partner-hotel-workspace__field">${html(text('code'))}<input name="code" value="${html(source.code)}" required maxlength="80"></label><label class="partner-hotel-workspace__field">${html(text('intervalMinutes'))}<input name="sync_interval_minutes" type="number" min="15" max="1440" value="${source.sync_interval_minutes}" required></label><label class="partner-hotel-workspace__field">${html(text('unitsPerEvent'))}<input name="units_per_event" type="number" min="1" max="100" value="${source.units_per_event}" required></label><label class="partner-hotel-workspace__field">${html(text('priority'))}<input name="priority" type="number" min="-32768" max="32767" value="${source.priority}" required></label></div><p class="partner-hotel-workspace__panel-copy">${html(text('calendarProviderNote'))}</p><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" minlength="3" maxlength="500" required></label><button class="btn-sm" type="submit">${html(text('review'))}</button></fieldset></form><div class="partner-hotel-workspace__actions"><button class="btn-sm" type="button" data-phw-external-secret="${source.secret_configured ? 'rotate' : 'set'}" data-source-id="${source.id}" ${canManageUrl ? '' : 'disabled'}>${html(text(source.secret_configured ? 'rotateUrl' : 'setUrl'))}</button>${source.secret_configured && !source.is_enabled ? `<button class="btn-sm" type="button" data-phw-external-secret="clear" data-source-id="${source.id}" ${canManageUrl ? '' : 'disabled'}>${html(text('clearUrl'))}</button>` : ''}${source.is_enabled ? `<button class="btn-sm" type="button" data-phw-external-lifecycle="disable" data-source-id="${source.id}" ${canReview ? '' : 'disabled'}>${html(text('disableSource'))}</button>` : `<button class="btn-sm" type="button" data-phw-external-lifecycle="enable" data-source-id="${source.id}" ${canEnable ? '' : `disabled title="${html(text(blocker))}"`}>${html(text('enableSource'))}</button>`}<button class="btn-sm" type="button" data-phw-external-sync data-source-id="${source.id}" ${source.is_enabled && capability.manual_sync_available ? '' : 'disabled'}>${html(text('triggerSync'))}</button></div>${!source.is_enabled && !canEnable ? `<p class="partner-hotel-workspace__panel-copy">${html(text(blocker))}</p>` : ''}${diagnostics(source.id)}</article>`;
    }).join('');
    cards += control.provider_proposals.map((proposal) => {
      const room = control.rooms.find((entry) => entry.id === proposal.room_type_id);
      const status = proposal.status === 'pending_admin_review'
        ? text('pendingReview') : proposal.status === 'accepted' ? text('acceptedProposal') : text('rejectedProposal');
      return `<article class="partner-hotel-workspace__card" data-phw-external-proposal="${proposal.proposal_id}" data-proposal-status="${proposal.status}"><h4>${html(text('providerProposalHistory'))}</h4><p><strong>${html(status)}</strong> · ${html(externalCalendarProviderLabel(proposal.source_type || 'ical'))} · ${html(localized(room?.name_i18n, proposal.room_type_id || proposal.source_id))}</p><p>${html(proposal.reason)}</p><p>${html(text('expires'))}: ${html(proposal.expires_at)}</p>${diagnostics(proposal.proposal_id)}</article>`;
    }).join('');
    return `<section class="partner-hotel-workspace__form" data-phw-external-calendars data-provider-stage="${html(capability.stage)}"><h3>${html(text('externalCalendars'))}</h3><p class="partner-hotel-workspace__panel-copy">${html(text('calendarUrlNeverShown'))}</p>${providerActive ? '' : `<div class="partner-hotel-workspace__status" data-tone="warning">${html(text('providerUnavailable'))}</div>`}<div class="partner-hotel-workspace__grid">${cards || `<p>${html(text('empty'))}</p>`}</div>${providerActive && capability.source_review_available ? `<details class="partner-hotel-workspace__card"><summary>${html(text('externalCalendarCreate'))}</summary><form class="partner-hotel-workspace__form" data-phw-external-create><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('calendarProvider'))}<select name="source_type" required>${externalCalendarProviderOptions()}</select></label><label class="partner-hotel-workspace__field">${html(text('room'))}<select name="room_type_id" required>${roomOptions}</select></label><label class="partner-hotel-workspace__field">${html(text('code'))}<input name="code" required maxlength="80"></label><label class="partner-hotel-workspace__field">${html(text('intervalMinutes'))}<input name="sync_interval_minutes" type="number" min="15" max="1440" value="60" required></label><label class="partner-hotel-workspace__field">${html(text('unitsPerEvent'))}<input name="units_per_event" type="number" min="1" max="100" value="1" required></label><label class="partner-hotel-workspace__field">${html(text('priority'))}<input name="priority" type="number" min="-32768" max="32767" value="100" required></label></div><p class="partner-hotel-workspace__panel-copy">${html(text('calendarProviderNote'))}</p><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" minlength="3" maxlength="500" required></label><button class="btn-sm primary" ${roomOptions ? '' : 'disabled'}>${html(text('review'))}</button></form></details>` : ''}</section>`;
  }

  function renderAvailability() {
    const availability = state.workspace.availability;
    if (!availability) return '';
    const eligibleRooms = state.workspace.rooms.filter((room) => room.status === 'active');
    const minimumDate = availability.from > todayIso() ? availability.from : todayIso();
    const calendar = `<section class="partner-hotel-workspace__card"><h3>${html(text('availabilitySnapshot'))}</h3><p>${html(availability.from)} – ${html(availability.to)}</p><div class="phw-availability-grid">${(availability.cells || []).map((cell) => `<article><time>${html(cell.stay_date)}</time><strong>${html(roomName(cell.room_type_id))}</strong>${statusBadge(text(cell.available_units > 0 && !cell.operational_closed && !cell.safety_closed ? 'open' : 'closed'), cell.available_units > 0 && !cell.operational_closed && !cell.safety_closed ? 'success' : 'muted')}<span>${html(text('availableUnits'))}: ${html(cell.available_units)}</span></article>`).join('') || `<p>${html(text('empty'))}</p>`}</div></section>`;
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="calendar_availability"><h2>${html(text('availability'))}</h2><p class="partner-hotel-workspace__panel-copy">${html(text('publicOff'))}</p>${calendar}<form class="partner-hotel-workspace__form" data-phw-availability><h3>${html(text('dailyInventory'))}</h3><div class="partner-hotel-workspace__form-grid"><label class="partner-hotel-workspace__field">${html(text('room'))}<select name="room_type_id" ${eligibleRooms.length ? '' : 'disabled'}>${eligibleRooms.map((room) => `<option value="${room.id}">${html(localized(room.name_i18n, room.code))}</option>`).join('')}</select></label><label class="partner-hotel-workspace__field">${html(text('stayDate'))}<input name="stay_date" type="date" min="${minimumDate}" max="${availability.to}" value="${minimumDate}" required /></label><label class="partner-hotel-workspace__field">${html(text('sellableUnits'))}<select name="sellable_mode"><option value="no_change">${html(text('unchanged'))}</option><option value="set">${html(text('set'))}</option><option value="clear">${html(text('clear'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('units'))}<input name="sellable_units" type="number" min="0" max="10000" /></label><label class="partner-hotel-workspace__field">${html(text('closure'))}<select name="closed_mode"><option value="no_change">${html(text('unchanged'))}</option><option value="set_closed">${html(text('closed'))}</option><option value="set_open">${html(text('open'))}</option><option value="clear">${html(text('clear'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('expiry'))}<select name="expiry_mode"><option value="no_change">${html(text('unchanged'))}</option><option value="set">${html(text('set'))}</option><option value="clear">${html(text('clear'))}</option></select></label><label class="partner-hotel-workspace__field">${html(text('futureExpiry'))}<input name="expires_at" type="datetime-local" /></label></div><label class="partner-hotel-workspace__field">${html(text('reason'))}<input name="reason" maxlength="500" required /></label><button class="btn-sm primary" ${eligibleRooms.length ? '' : 'disabled'}>${html(text('review'))}</button></form>${renderExternalCalendars()}</section>`;
  }

  function presentationMoney(value, currency) {
    return typeof value === 'number' ? formatMoney(value, currency) : text('unavailableValue');
  }

  function presentationCount(value) {
    return Number.isInteger(value) && value >= 0 ? String(value) : html(text('unavailableValue'));
  }

  function presentationStatus(value, kind = 'booking') {
    if (typeof value !== 'string' || !value.trim()) return text('unavailableValue');
    const normalized = value.trim().toLowerCase();
    const booking = {
      confirmed: 'bookingConfirmed', pending: 'bookingPending', cancelled: 'bookingCancelled',
      canceled: 'bookingCancelled', completed: 'bookingCompleted',
    };
    const payment = {
      paid: 'paymentPaid', partially_paid: 'paymentPartiallyPaid', unpaid: 'paymentUnpaid', pending: 'paymentPending',
    };
    return text((kind === 'payment' ? payment : booking)[normalized] || normalized.replaceAll('_', ' '));
  }

  function bookingAllocationMarkup(booking) {
    const allocation = Array.isArray(booking.allocation) ? booking.allocation : [];
    if (!allocation.length) return `<span>${html(text('unavailableValue'))}</span>`;
    return `<ul class="partner-hotel-workspace__allocation">${allocation.map((entry) => `<li>${html(localized(entry.room_name_i18n, text('room')))}${entry.units > 1 ? ` × ${entry.units}` : ''}</li>`).join('')}</ul>`;
  }

  function bookingCardMarkup(booking, includePayment = false) {
    const payment = booking.payment;
    return `<article class="partner-hotel-workspace__card partner-hotel-workspace__booking-card" data-booking-id="${html(booking.booking_id)}">
      <header><div><span class="partner-hotel-workspace__eyebrow">${html(booking.reference || `#${booking.booking_id.slice(0, 8)}`)}</span><h3>${html(text('bookingDates'))}: ${html(booking.arrival_date)} – ${html(booking.departure_date)}</h3></div><span class="partner-hotel-workspace__chip">${html(presentationStatus(booking.status))}</span></header>
      <dl><div><dt>${html(text('guestCount'))}</dt><dd>${booking.guest_count == null ? html(text('unavailableValue')) : html(booking.guest_count)}</dd></div><div><dt>${html(text('roomAllocation'))}</dt><dd>${bookingAllocationMarkup(booking)}</dd></div><div><dt>${html(text('customerPays'))}</dt><dd>${presentationMoney(booking.customer_total, booking.currency)}</dd></div>${includePayment ? `<div><dt>${html(text('paymentState'))}</dt><dd>${html(presentationStatus(payment?.state, 'payment'))}</dd></div><div><dt>${html(text('amountPaid'))}</dt><dd>${presentationMoney(payment?.paid, payment?.currency || booking.currency)}</dd></div><div><dt>${html(text('amountRemaining'))}</dt><dd>${presentationMoney(payment?.remaining, payment?.currency || booking.currency)}</dd></div><div><dt>${html(text('commission'))}</dt><dd>${presentationMoney(payment?.cypruseye_commission, payment?.currency || booking.currency)}</dd></div><div><dt>${html(text('partnerReceives'))}</dt><dd>${presentationMoney(payment?.partner_net, payment?.currency || booking.currency)}</dd></div>` : ''}</dl>
    </article>`;
  }

  function renderBookings() {
    const presentation = state.presentation;
    if (!presentation?.capabilities.bookings_visible) {
      const canOpen = state.workspace?.sections?.bookings?.available === true;
      return `<section class="partner-hotel-workspace__panel" data-phw-panel="bookings"><h2>${html(text('bookings'))}</h2><p class="partner-hotel-workspace__panel-copy">${html(state.presentationError || text('bookingPresentationUnavailable'))}</p>${canOpen ? `<button class="btn-sm primary" type="button" data-phw-existing-flow="bookings">${html(text('openBookingManagement'))}</button>` : ''}</section>`;
    }
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="bookings"><h2>${html(text('bookings'))}</h2>
      <div class="partner-hotel-workspace__summary"><span><strong>${presentationCount(presentation.summary.total_bookings)}</strong>${html(text('totalBookings'))}</span><span><strong>${presentationCount(presentation.summary.upcoming_bookings)}</strong>${html(text('upcomingBookings'))}</span><span><strong>${presentationCount(presentation.summary.current_recent_bookings)}</strong>${html(text('currentRecentBookings'))}</span></div>
      ${presentation.bookings.length ? `<label class="partner-hotel-workspace__field">${html(text('searchBookings'))}<input type="search" data-phw-booking-search autocomplete="off"></label><div class="partner-hotel-workspace__table-wrap phw-booking-table"><table class="partner-hotel-workspace__table"><thead><tr>${['bookings', 'bookingDates', 'roomAllocation', 'guestCount', 'bookingStatus', 'customerPays'].map((key) => `<th scope="col">${html(text(key))}</th>`).join('')}</tr></thead><tbody>${presentation.bookings.map((booking) => `<tr data-phw-booking-search-row="${html([booking.reference, booking.booking_id, booking.status, ...(booking.allocation || []).map((row) => localized(row.room_name_i18n))].filter(Boolean).join(' '))}"><th scope="row">${html(booking.reference || `#${booking.booking_id.slice(0, 8)}`)}</th><td>${html(booking.arrival_date)}<br>${html(booking.departure_date)}</td><td>${bookingAllocationMarkup(booking)}</td><td>${html(booking.guest_count ?? text('notProvided'))}</td><td>${statusBadge(presentationStatus(booking.status), booking.status === 'confirmed' ? 'success' : 'muted')}</td><td>${presentationMoney(booking.customer_total, booking.currency)}</td></tr>`).join('')}</tbody></table></div><div class="partner-hotel-workspace__grid phw-booking-mobile">${presentation.bookings.map((booking) => `<div data-phw-booking-search-row="${html([booking.reference, booking.booking_id, booking.status, ...(booking.allocation || []).map((row) => localized(row.room_name_i18n))].filter(Boolean).join(' '))}">${bookingCardMarkup(booking)}</div>`).join('')}</div><p data-phw-no-booking-results hidden>${html(text('noResults'))}</p>` : `<div class="phw-empty"><p>${html(text('noBookings'))}</p></div>`}
      ${presentation.capabilities.full_booking_management ? `<button class="btn-sm primary" type="button" data-phw-existing-flow="bookings">${html(text('openBookingManagement'))}</button>` : ''}
    </section>`;
  }

  function renderPayments() {
    const presentation = state.presentation;
    const paymentContext = `<div class="partner-hotel-workspace__grid"><article class="partner-hotel-workspace__card"><h3>${html(text('commissionPolicy'))}</h3><p>${html(commissionRule(state.workspace.pricing?.commission_policy))}</p><p>${html(text('readOnly'))}</p></article>${state.workspace.feature_flags.hotel_stripe_connect_enabled === false ? `<article class="partner-hotel-workspace__card"><h3>${html(text('payoutServices'))}</h3>${statusBadge(text('notConfigured'), 'muted')}</article>` : ''}</div>`;
    if (!presentation?.capabilities.payments_visible) {
      const canOpen = state.workspace?.sections?.payments?.available === true;
      return `<section class="partner-hotel-workspace__panel" data-phw-panel="payments"><h2>${html(text('payments'))}</h2>${paymentContext}<p class="partner-hotel-workspace__panel-copy">${html(state.presentationError || text('paymentPresentationUnavailable'))}</p><p class="partner-hotel-workspace__panel-copy">${html(text('commissionReadOnly'))}</p>${canOpen ? `<button class="btn-sm primary" type="button" data-phw-existing-flow="payments">${html(text('openPaymentManagement'))}</button>` : ''}</section>`;
    }
    const rows = presentation.bookings.filter((booking) => booking.payment !== null);
    return `<section class="partner-hotel-workspace__panel" data-phw-panel="payments"><h2>${html(text('payments'))}</h2>${paymentContext}
      <p class="partner-hotel-workspace__panel-copy">${html(text('commissionReadOnly'))}</p>
      <div class="partner-hotel-workspace__grid">${rows.length ? rows.map((booking) => bookingCardMarkup(booking, true)).join('') : `<p>${html(text('noPayments'))}</p>`}</div>
      ${presentation.capabilities.full_payment_management ? `<button class="btn-sm primary" type="button" data-phw-existing-flow="payments">${html(text('openPaymentManagement'))}</button>` : ''}
    </section>`;
  }

  function lifecycleBannerMarkup() {
    const messages = [];
    if (capability('manage_prices') && !state.pricingControl) messages.push(text('pricingControlUnavailable'));
    if (state.pricingControl?.proposals?.some((proposal) => proposal.status === 'pending_admin_review')) messages.push(text('pricingPendingLifecycle'));
    const control = state.externalCalendar;
    if (capability('manage_availability') && state.externalCalendarError) messages.push(text('providerUnavailable'));
    else if (capability('manage_availability') && control) {
      if (control.provider_capability?.stage !== 'provider_types_active') messages.push(text('providerUnavailable'));
      else {
        if (control.provider_proposals?.some((proposal) => proposal.status === 'pending_admin_review')) messages.push(text('adminReviewRequired'));
        if (control.sources?.some((source) => source.is_enabled && source.health?.status === 'degraded')) messages.push(text('providerWarningLifecycle'));
        else if (control.sources?.some((source) => source.is_enabled)) messages.push(text('providerActiveLifecycle'));
        else if (control.sources?.some((source) => source.review_status === 'reviewed' && source.secret_configured)) messages.push(text('providerReadyLifecycle'));
        else if (control.sources?.some((source) => !source.secret_configured)) messages.push(text('privateUrlRequired'));
        else if (!control.sources?.length) messages.push(text('providerSetupLifecycle'));
      }
    }
    if (!messages.length) messages.push(text('publicOff'));
    return `<aside class="partner-hotel-workspace__lifecycle" data-phw-lifecycle><strong>${html(text('lifecycleTitle'))}</strong><ul>${messages.map((message) => `<li>${html(message)}</li>`).join('')}</ul></aside>`;
  }

  function decorateHelp() {
    const Help = root.HotelsV2WorkspaceHelp;
    if (!Help?.helpButton || !Help?.createController) return;
    const sectionTopics = {
      overview: 'section.overview', property_content: 'section.property', rooms: 'section.rooms',
      rates_pricing: 'section.pricing', calendar_availability: 'section.calendar',
      bookings: 'section.bookings', payments: 'section.payments',
    };
    Object.entries(sectionTopics).forEach(([section, topic]) => {
      const heading = state.root.querySelector(`[data-phw-panel="${section}"] > h2`);
      if (heading) heading.insertAdjacentHTML('beforeend', Help.helpButton(topic, { section: true }));
    });
    const controls = [
      ['property_content', '[data-phw-property-content] > h3', 'controls.property'],
      ['rooms', '[data-phw-panel="rooms"] > h2', 'controls.rooms'],
      ['rates_pricing', '[data-phw-seven-arches-pricing] h3', 'controls.pricing'],
      ['calendar_availability', '[data-phw-external-calendars] > h3', 'controls.calendar'],
      ['bookings', '[data-phw-panel="bookings"] .partner-hotel-workspace__summary', 'controls.bookings'],
      ['payments', '[data-phw-panel="payments"] .partner-hotel-workspace__panel-copy', 'controls.payments'],
    ];
    controls.forEach(([section, selector, topic]) => {
      if (state.root.querySelector(`[data-hv2-help-topic="${topic}"]:not([data-hv2-section-help])`)) return;
      const panel = state.root.querySelector(`[data-phw-panel="${section}"]`);
      const target = state.root.querySelector(selector) || panel?.querySelector('h2');
      target?.insertAdjacentHTML('afterend', Help.helpButton(topic));
    });
    state.helpController?.destroy?.();
    state.helpController = Help.createController({ root: state.root, language: state.language });
  }

  function render() {
    if (!state.root || !state.workspace) return;
    const definitions = sectionDefinitions();
    if (!definitions.some(([key]) => key === state.section)) state.section = definitions[0]?.[0] || 'overview';
    const panels = [renderOverview(), renderProperty(), renderRooms(), renderPricing(), renderAvailability(), renderBookings(), renderPayments()].join('');
    state.root.dir = state.language === 'he' ? 'rtl' : 'ltr';
    state.root.lang = state.language;
    const refreshTime = state.lastRefresh ? new Intl.DateTimeFormat(state.language, { hour: '2-digit', minute: '2-digit' }).format(state.lastRefresh) : text('notProvided');
    const primary = definitions.filter(([key]) => ['overview', 'property_content', 'rooms', 'rates_pricing'].includes(key));
    state.root.innerHTML = `
      <div class="phw-shell">
        <aside class="phw-sidebar">
          <div class="phw-brand"><span class="phw-brand-mark" aria-hidden="true">C</span><div>CyprusEye<small>${html(text('workspace'))}</small></div></div>
          <span class="partner-hotel-workspace__eyebrow">${html(text('management'))}</span>
          <nav class="partner-hotel-workspace__nav" aria-label="${html(text('workspace'))}">${definitions.map(([key, label]) => navButton(key, label)).join('')}</nav>
          <div class="phw-sidebar-footer"><button class="btn-sm" type="button" data-phw-diagnostics>${html(text('technical'))}</button><button class="btn-sm" type="button" data-phw-support>${icon('support')}${html(text('support'))}</button></div>
        </aside>
        <div class="phw-main">
          <header class="partner-hotel-workspace__header">
            <div class="partner-hotel-workspace__identity"><div class="partner-hotel-workspace__eyebrow">${html(text('hotel'))}</div><h1 id="partnerHotelWorkspaceTitle">${html(propertyName())}</h1><div class="partner-hotel-workspace__meta">${html([state.workspace.property.city, state.workspace.property.country].filter(Boolean).join(', '))}</div></div>
            <div class="partner-hotel-workspace__header-actions"><label class="partner-hotel-workspace__field">${html(text('language'))}<select data-phw-language><option value="en" ${state.language === 'en' ? 'selected' : ''}>English</option><option value="pl" ${state.language === 'pl' ? 'selected' : ''}>Polski</option><option value="he" ${state.language === 'he' ? 'selected' : ''}>עברית</option></select></label><button type="button" class="btn-sm" data-phw-refresh>${html(text('refresh'))}</button><button type="button" class="btn-sm phw-back" data-phw-close>${html(text('back'))}</button></div>
          </header>
          <div class="phw-status-strip" data-phw-public-status><span>${publicStatus()}</span><span>${html(text('lastRefresh'))} <time>${html(refreshTime)}</time></span></div>
          <div class="partner-hotel-workspace__status" data-phw-status role="status" aria-live="polite"></div>
          <div class="partner-hotel-workspace__body">${panels}</div>
          <details class="phw-workspace-notes"><summary>${html(text('lifecycleTitle'))}</summary>${lifecycleBannerMarkup()}</details>
        </div>
      </div>
      <nav class="phw-mobile-nav" aria-label="${html(text('workspace'))}">${primary.map(([key, label]) => navButton(key, label, true)).join('')}<button type="button" data-phw-more aria-haspopup="dialog">${icon('more')}<span>${html(text('more'))}</span></button></nav>
      <dialog class="phw-drawer" data-phw-drawer aria-labelledby="phwDrawerTitle"></dialog>`;
    state.root.querySelectorAll('[data-phw-panel]').forEach((panel) => { panel.hidden = panel.getAttribute('data-phw-panel') !== state.section; });
    state.root.querySelectorAll('[data-phw-panel] > h2').forEach((heading) => { heading.tabIndex = -1; });
    syncPricingTargets();
    decorateHelp();
  }

  function openUtilityDrawer(kind, opener) {
    const drawer = state.root.querySelector('[data-phw-drawer]');
    if (!drawer) return;
    const title = text(kind === 'more' ? 'more' : kind === 'support' ? 'support' : 'technical');
    const content = kind === 'more'
      ? `<nav class="partner-hotel-workspace__nav">${sectionDefinitions().filter(([key]) => ['calendar_availability', 'bookings', 'payments'].includes(key)).map(([key, label]) => navButton(key, label)).join('')}<button type="button" data-phw-diagnostics>${html(text('technical'))}</button><button type="button" data-phw-support>${html(text('support'))}</button><button type="button" data-phw-close>${html(text('back'))}</button></nav>`
      : kind === 'support' ? `<p>${html(text('supportCopy'))}</p>`
        : `<dl><dt>${html(text('workspace'))}</dt><dd>${html(state.workspace.contract_version)}</dd><dt>${html(text('hotel'))}</dt><dd><code>${html(state.workspace.hotel_id)}</code></dd><dt>${html(text('publicBooking'))}</dt><dd>${publicStatus()}</dd></dl>${lifecycleBannerMarkup()}`;
    drawer.innerHTML = `<header><h2 id="phwDrawerTitle">${html(title)}</h2><button class="btn-sm" type="button" data-phw-drawer-close>${html(text('close'))}</button></header>${content}`;
    drawer.onclose = () => (opener?.isConnected ? opener : state.root.querySelector('[data-phw-more]'))?.focus();
    if (!drawer.open) drawer.showModal();
    drawer.querySelector('[data-phw-drawer-close]').focus();
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
          : domain === 'seven_arches_pricing' ? await Repository.previewSevenArchesPricingProposal(draft)
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
  function reviewedPricingImpact(impact) {
    const roomScope = impact.scope === 'single_room';
    const title = roomScope ? `${text('roomImpact')} · ${impact.room_key}` : `${text('bundleImpact')} · ${impact.requested_guest_count} ${text('guests')}`;
    return `<article class="partner-hotel-workspace__card" data-phw-reviewed-commercial-impact><h3>${html(title)}</h3><p>${impact.minimum_nights} ${html(text('nights'))}</p><div class="partner-hotel-workspace-review__commercial"><div><small>${html(text('before'))}</small><strong>${html(formatMoney(impact.customer_before, impact.currency))}</strong></div><div><small>${html(text('after'))}</small><strong>${html(formatMoney(impact.customer_after, impact.currency))}</strong></div><div><small>${html(text('commission'))}</small><strong>${html(formatMoney(impact.cypruseye_commission, impact.currency))}</strong></div><div><small>${html(text('partnerNet'))}</small><strong>${html(formatMoney(impact.partner_net_after, impact.currency))}</strong></div></div></article>`;
  }
  function focusables(node) { return Array.from(node.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')); }
  function openReview() {
    const { preview, domain } = state.pending;
    if (domain === 'seven_arches_pricing') {
      const policy = preview.reviewed_plan.commission_policy;
      state.dialog.dir = state.language === 'he' ? 'rtl' : 'ltr';
      state.dialog.innerHTML = `<div class="partner-hotel-workspace-review__shell"><header class="partner-hotel-workspace-review__header"><h2 id="partnerHotelWorkspaceReviewTitle">${html(text('reviewTitle'))}</h2><button class="btn-sm" type="button" data-phw-review-cancel aria-label="${html(text('cancel'))}">×</button></header><div class="partner-hotel-workspace-review__body"><p>${html(text('reviewedPricingIntro'))}</p><div class="partner-hotel-workspace__grid">${preview.commercial_impacts.map(reviewedPricingImpact).join('')}</div><article class="partner-hotel-workspace__card"><h3>${html(text('commissionPolicy'))}</h3><strong>${html(commissionRule(policy))}</strong><p>${html(text('commissionReadOnly'))}</p></article><p>${html(text('readOnly'))}</p></div><footer class="partner-hotel-workspace-review__footer"><button class="btn-sm" type="button" data-phw-review-cancel>${html(text('cancel'))}</button><button class="btn-sm primary" type="button" data-phw-review-save>${html(text('submitProposal'))}</button></footer></div>`;
      state.dialog.showModal();
      focusables(state.dialog)[0]?.focus();
      return;
    }
    const impact = preview.impacts[0];
    state.dialog.dir = state.language === 'he' ? 'rtl' : 'ltr';
    const affectedRooms = impact.affected_room_type_ids || [];
    const affectedRates = impact.affected_room_rate_ids || [];
    state.dialog.innerHTML = `<div class="partner-hotel-workspace-review__shell"><header class="partner-hotel-workspace-review__header"><h2 id="partnerHotelWorkspaceReviewTitle">${html(text('reviewTitle'))}</h2><button class="btn-sm" type="button" data-phw-review-cancel aria-label="${html(text('cancel'))}">×</button></header><div class="partner-hotel-workspace-review__body"><div class="partner-hotel-workspace-review__impact"><strong>${html(text('impacted'))}</strong><p>${html(impactLabel(impact.entity))} · ${html(impactLabel(impact.action))}</p><p>${html(impact.fields.map(fieldLabel).join(', '))}</p>${affectedRooms.map((id) => html(roomName(id))).join(', ')} ${affectedRates.map((id) => html(rateName(id))).join(', ')}${diagnostics(impact.id)}</div>${domain === 'pricing' ? `<h3>${html(text('before'))}</h3>${commercialColumns(preview.commercial_before)}<h3>${html(text('after'))}</h3>${commercialColumns(preview.commercial_after)}${preview.example_before ? `<h3>${html(text('exampleBefore'))}</h3>${exampleCommercial(preview.example_before)}` : ''}${preview.example_after ? `<h3>${html(text('exampleAfter'))}</h3>${exampleCommercial(preview.example_after)}` : ''}<p>${html(text('readOnly'))}</p>` : ''}${domain === 'external_calendar' ? `<p>${html(text('calendarUrlNeverShown'))}</p>` : ''}${preview.blocking_reasons.map((reason) => `<div class="partner-hotel-workspace__status" data-tone="warning">${html(blockerLabel(reason))}</div>`).join('')}</div><footer class="partner-hotel-workspace-review__footer"><button class="btn-sm" type="button" data-phw-review-cancel>${html(text('cancel'))}</button><button class="btn-sm primary" type="button" data-phw-review-save ${preview.blocking_reasons.length ? 'disabled' : ''}>${html(text(domain === 'external_calendar' ? 'submitProposal' : 'save'))}</button></footer></div>`;
    state.dialog.showModal();
    focusables(state.dialog)[0]?.focus();
  }
  function closeReview() { if (state.dialog?.open) state.dialog.close(); const opener = state.pending?.opener; if (['external_calendar', 'seven_arches_pricing'].includes(state.pending?.domain)) Repository.clearReviewedPlans(); if (state.dialog) state.dialog.innerHTML = ''; state.pending = null; opener?.focus?.(); }

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
          : domain === 'seven_arches_pricing'
            ? await Repository.submitSevenArchesPricingProposal(preview.reviewed_plan, correlation, idempotency)
          : domain === 'availability'
            ? await Repository.applyAvailabilityPlan(preview.reviewed_plan, correlation, idempotency)
            : await Repository.submitExternalCalendarProposal(preview.reviewed_plan, correlation, idempotency, state.pending.secretUrl || null);
      if (result.workspace) state.workspace = result.workspace;
      if (domain === 'external_calendar') state.externalCalendar = result.control;
      if (domain === 'content') { state.mediaDraft = { property: [], rooms: {} }; state.photoDraft = { property: null, rooms: {} }; }
      if (domain === 'pricing') { state.commercialPreview = null; state.commercialRequest = null; }
      if (domain === 'seven_arches_pricing') {
        state.pricingProposal = result;
        try {
          state.pricingControl = await Repository.getSevenArchesPricingControl(state.partnerId, state.workspace.hotel_id);
          state.pricingControlError = null;
        } catch (error) {
          state.pricingControl = null;
          state.pricingControlError = error.userMessage || error.message;
        }
      }
      closeReview(); render(); setStatus(text(domain === 'seven_arches_pricing'
        ? 'proposalSubmitted' : domain === 'external_calendar' ? 'providerProposalSubmitted' : 'saved'), 'success');
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
      const transientUrl = secretInput ? payload.ical_url : null;
      const urlInput = event.currentTarget.elements?.ical_url;
      if (urlInput) urlInput.value = '';
      const expectedVersion = secret ? (source.binding_version || 0) : entity === 'calendar_sync' ? source.health.state_version : source.version;
      const draft = externalCalendarDraft({ entity, action, id: source.id, expected_version: expectedVersion, payload, reason: String(data.get('reason') || '').trim() });
      state.dialog.close();
      await review('external_calendar', draft, opener);
      if (state.pending?.domain === 'external_calendar') state.pending.secretUrl = transientUrl;
      else { Repository.clearReviewedPlans(); if (!state.dialog.open) state.dialog.innerHTML = ''; }
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
    state.root.innerHTML = `<div class="phw-empty" role="status" aria-busy="true"><h2>${html(text('loading'))}</h2><div class="phw-skeleton"></div><div class="phw-skeleton"></div></div>`;
    try {
      const from = todayIso(); const to = addDays(from, 30);
      const workspace = await Repository.getWorkspace(state.partnerId, state.assignment.hotel_id, from, to);
      if (generation !== state.generation) return;
      state.workspace = workspace;
      state.externalCalendar = null; state.externalCalendarError = null; state.pricingControl = null; state.pricingControlError = null;
      state.presentation = null; state.presentationError = null;
      try {
        state.presentation = await Repository.getBookingsPaymentsPresentation(
          state.partnerId,
          workspace.hotel_id,
          {
            limit: 100,
            bookingsVisible: workspace.sections.bookings.available === true,
            fullBookingManagement: workspace.sections.bookings.available === true,
            fullPaymentManagement: false,
            availability: workspace.availability,
            rooms: workspace.rooms,
            currency: workspace.pricing?.currency || workspace.availability?.property?.currency || null,
          },
        );
      } catch (error) {
        state.presentationError = error.userMessage || error.message;
      }
      if (Core.isSevenArchesReviewedPricingWorkspace(workspace)) {
        try {
          state.pricingControl = await Repository.getSevenArchesPricingControl(state.partnerId, workspace.hotel_id);
        } catch (error) {
          state.pricingControlError = error.userMessage || error.message;
        }
      }
      if (workspace.assignment.capabilities.manage_availability === true) {
        try {
          state.externalCalendar = await Repository.getExternalCalendarControl(state.partnerId, workspace.hotel_id);
        } catch (error) {
          state.externalCalendarError = error.userMessage || error.message;
        }
      }
      if (generation !== state.generation) return;
      if (state.commercialRequest?.pricing_snapshot_token !== workspace.pricing?.snapshot_token) { state.commercialRequest = null; state.commercialPreview = null; }
      state.lastRefresh = new Date(); state.loading = false; render();
    } catch (error) {
      if (generation !== state.generation) return;
      state.loading = false; state.workspace = null; state.root.innerHTML = `<div class="phw-empty" role="alert"><h2>${html(text('unavailable'))}</h2><p>${html(error.userMessage || error.message)}</p><div class="partner-hotel-workspace__actions"><button class="btn-sm primary" data-phw-refresh>${html(text('retry'))}</button><button class="btn-sm" data-phw-close>${html(text('back'))}</button></div></div>`;
    }
  }

  async function open(options = {}) {
    if (!Core || !Repository || !state.root) return;
    state.partnerId = Core.requireCanonicalUuid(options.partnerId, 'partner_id');
    Core.requireCanonicalUuid(options.assignment?.assignment_id, 'assignment_id'); Core.requireCanonicalUuid(options.assignment?.hotel_id, 'hotel_id');
    state.assignment = options.assignment; state.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.language = initialLanguage(); state.section = 'overview'; state.workspace = null; state.commercialPreview = null; state.commercialRequest = null; state.pricingProposal = null; state.pricingControl = null; state.pricingControlError = null; state.externalCalendar = null; state.externalCalendarError = null; state.presentation = null; state.presentationError = null; state.mediaDraft = { property: [], rooms: {} }; state.photoDraft = { property: null, rooms: {} };
    document.body.classList.add('phw-open'); if (state.portal) state.portal.hidden = true; state.root.hidden = false; await load(); state.root.focus?.();
  }
  function close(options = {}) {
    document.body.classList.remove('phw-open');
    state.generation += 1; Repository?.clearReviewedPlans?.(); closeReview(); state.helpController?.destroy?.(); state.helpController = null; state.workspace = null; state.assignment = null; state.partnerId = null; state.commercialRequest = null; state.commercialPreview = null; state.pricingProposal = null; state.pricingControl = null; state.pricingControlError = null; state.externalCalendar = null; state.externalCalendarError = null; state.presentation = null; state.presentationError = null; state.mediaDraft = { property: [], rooms: {} }; state.photoDraft = { property: null, rooms: {} };
    if (state.root) { state.root.hidden = true; state.root.innerHTML = ''; }
    if (options.restorePortal !== false && state.portal) state.portal.hidden = false;
    state.opener?.focus?.(); state.opener = null;
  }

  function bindRootEvents() {
    state.root.addEventListener('input', (event) => {
      if (!event.target.matches('[data-phw-booking-search]')) return;
      const query = event.target.value.trim().toLocaleLowerCase(state.language);
      let visible = 0;
      state.root.querySelectorAll('[data-phw-booking-search-row]').forEach((row) => {
        row.hidden = !row.dataset.phwBookingSearchRow.toLocaleLowerCase(state.language).includes(query);
        if (!row.hidden) visible += 1;
      });
      const empty = state.root.querySelector('[data-phw-no-booking-results]');
      if (empty) empty.hidden = visible > 0;
    });
    state.root.addEventListener('click', (event) => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.matches('[data-phw-close]')) { close({ restorePortal: true }); return; }
      if (button.matches('[data-phw-refresh]')) { if (state.loading) return; Repository.clearReviewedPlans(); void load(); return; }
      if (button.matches('[data-phw-more]')) { openUtilityDrawer('more', button); return; }
      if (button.matches('[data-phw-diagnostics]')) { openUtilityDrawer('diagnostics', button); return; }
      if (button.matches('[data-phw-support]')) { openUtilityDrawer('support', button); return; }
      if (button.matches('[data-phw-drawer-close]')) { button.closest('dialog').close(); return; }
      if (button.matches('[data-phw-section]')) { state.root.querySelector('[data-phw-drawer]')?.close(); capturePhotoDrafts(); state.section = button.dataset.phwSection; render(); state.root.querySelector(`[data-phw-panel="${state.section}"] h2`)?.focus(); return; }
      if (button.matches('[data-phw-existing-flow]')) {
        const destination = button.dataset.phwExistingFlow || 'bookings';
        close({ restorePortal: true });
        root.dispatchEvent(new CustomEvent('ce:partner-hotel-bookings', { detail: { destination } }));
        return;
      }
      if (button.matches('[data-phw-room-tab]')) {
        const panel = button.closest('[data-phw-panel]');
        panel.querySelectorAll('[data-phw-room-tab]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
        panel.querySelectorAll('[data-phw-room-edit]').forEach((action) => { action.hidden = button.dataset.phwRoomTab !== 'all' && action.dataset.phwRoomEdit !== button.dataset.phwRoomTab; });
        return;
      }
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
      if (event.target.matches('[data-phw-guest-filter]')) {
        const card = event.target.closest('[data-phw-reviewed-room]');
        card.dataset.mobileGuest = event.target.value;
        card.querySelectorAll('[data-phw-guest-cell]').forEach((cell) => { cell.dataset.guestHidden = String(cell.dataset.phwGuestCell !== event.target.value); });
        return;
      }
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
        const entity = String(data.get('entity')); const target = Core.requirePricingTargetUuid(entity, String(data.get('target')), 'pricing target'); const nightly = Number(data.get('nightly_rate'));
        const stayDate = String(data.get('stay_date'));
        if (entity === 'exact_date_price') {
          const existing = state.workspace.pricing.exact_date_prices.some((row) => row.room_rate_id === target && row.stay_date === stayDate);
          if (!existing && !exactDateExampleSupports(target, stayDate)) { setStatus(text('exactDateExampleRequired'), 'error'); return; }
        }
        const intent = entity === 'exact_date_price' ? { entity, action: 'upsert', id: null, payload: { room_rate_id: target, stay_date: stayDate, nightly_rate_mode: 'set', nightly_rate: nightly }, reason: String(data.get('reason') || '').trim() } : { entity, action: 'update', id: target, payload: { nightly_rate: nightly }, reason: String(data.get('reason') || '').trim() };
        const example = state.commercialRequest?.pricing_snapshot_token === state.workspace.pricing.snapshot_token ? state.commercialRequest : null;
        await review('pricing', pricingDraft(intent, example), opener); return;
      }
      if (form.matches('[data-phw-seven-arches-pricing]')) {
        const requestedItems = Array.from(form.querySelectorAll('[data-phw-reviewed-tier]')).filter((input) => {
          const requested = Number(input.value);
          const before = Number(input.dataset.beforePrice);
          return Number.isFinite(requested) && requested !== before;
        }).map((input) => ({ schedule_tier_id: input.dataset.tierId, requested_price: Number(input.value) }));
        if (!requestedItems.length) { setStatus(text('noPricingChanges'), 'warning'); return; }
        try {
          const draft = Core.buildSevenArchesReviewedPricingDraft(state.workspace, requestedItems, String(data.get('reason') || '').trim());
          await review('seven_arches_pricing', draft, opener);
        } catch (error) { setStatus(error.message || String(error), 'error'); }
        return;
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
    text: (key) => PORTAL_COPY[initialLanguage()]?.[key] || COPY[initialLanguage()]?.[key] || COPY.en[key] || key,
    capabilityText: (key) => {
      const language = initialLanguage();
      const copyKey = { edit_property_content: 'content', edit_property_photos: 'photos', edit_room_content: 'roomContent', edit_room_photos: 'roomPhotos', create_rooms: 'createRoom', edit_room_structure: 'roomStructure', manage_prices: 'pricing', manage_availability: 'availability', process_bookings: 'bookings', request_booking_changes: 'bookingChanges', view_payment_status: 'payments', initiate_stripe_onboarding: 'stripeOnboarding' }[key];
      return COPY[language]?.[copyKey] || COPY.en[copyKey] || key;
    },
  });
});
