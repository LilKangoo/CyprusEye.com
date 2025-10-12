(function () {
  const FALLBACK_LANGUAGE = 'pl';

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function toNumberOrZero(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function getI18n() {
    return typeof window !== 'undefined' ? window.appI18n || null : null;
  }

  function getCurrentLanguage() {
    const i18n = getI18n();
    return (i18n && i18n.language) || FALLBACK_LANGUAGE;
  }

  function getTranslations(language) {
    const i18n = getI18n();
    if (!i18n || !i18n.translations) {
      return {};
    }
    return i18n.translations[language] || {};
  }

  function translateText(key, fallback = '') {
    if (!isNonEmptyString(key)) {
      return isNonEmptyString(fallback) ? fallback : '';
    }

    const language = getCurrentLanguage();
    const translations = getTranslations(language);
    const entry = translations[key];

    let result = null;

    if (typeof entry === 'string') {
      result = entry;
    } else if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string') {
        result = entry.text;
      } else if (typeof entry.html === 'string') {
        result = entry.html;
      }
    }

    if (!isNonEmptyString(result)) {
      result = fallback;
    }

    return isNonEmptyString(result) ? result : '';
  }

  function normalizeTextEntry(value) {
    if (!value) {
      return { key: '', fallback: '' };
    }

    if (typeof value === 'string') {
      return { key: '', fallback: value.trim() };
    }

    if (typeof value === 'object') {
      const key = isNonEmptyString(value.key)
        ? value.key.trim()
        : isNonEmptyString(value.i18nKey)
        ? value.i18nKey.trim()
        : '';
      const fallback = isNonEmptyString(value.fallback)
        ? value.fallback.trim()
        : isNonEmptyString(value.text)
        ? value.text.trim()
        : isNonEmptyString(value.default)
        ? value.default.trim()
        : '';

      return { key, fallback };
    }

    return { key: '', fallback: '' };
  }

  function resolveText(entry, fallback = '') {
    if (!entry || typeof entry !== 'object') {
      return translateText('', fallback);
    }

    const key = isNonEmptyString(entry.key) ? entry.key : '';
    const defaultValue = isNonEmptyString(entry.fallback) ? entry.fallback : fallback;
    return translateText(key, defaultValue);
  }

  function wrapText(value, key) {
    const entry = normalizeTextEntry(value);
    if (!isNonEmptyString(entry.key) && isNonEmptyString(key)) {
      entry.key = key;
    }
    return entry;
  }

  function translateWithReplacements(key, fallback, replacements = {}) {
    const template = translateText(key, fallback);
    return template.replace(/\{\{(\w+)\}\}/g, (match, param) =>
      Object.prototype.hasOwnProperty.call(replacements, param) ? String(replacements[param]) : match,
    );
  }

  function getLocalizedFormatter() {
    const language = getCurrentLanguage();
    const locale = language === 'en' ? 'en-GB' : 'pl-PL';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
  }

  const DEFAULT_CAR_FLEET = [
    {
      id: 'toyota-passo-2020',
      name: 'Toyota Passo',
      year: 2020,
      pricePerDay: 30,
      seats: 4,
      transmission: 'Automat',
      category: 'Kompakt miejski',
      fuel: 'Benzyna',
      features: ['Bez kaucji', 'Klimatyzacja', 'Asysta 24/7'],
      note: 'Niezwykle zwrotny model idealny do parkowania w zatłoczonych kurortach.',
    },
    {
      id: 'toyota-yaris-2023',
      name: 'Toyota Yaris',
      year: 2023,
      pricePerDay: 35,
      seats: 4,
      transmission: 'Automat',
      category: 'Hatchback miejski',
      fuel: 'Benzyna',
      features: ['Nowa generacja', 'Bez kaucji', 'Ekonomiczne spalanie'],
      note: 'Sprawdza się podczas zwiedzania miast i krótkich wypadów poza kurort.',
    },
    {
      id: 'nissan-note-2020',
      name: 'Nissan Note',
      year: 2020,
      pricePerDay: 35,
      seats: 4,
      transmission: 'Automat',
      category: 'Hatchback miejski',
      fuel: 'Benzyna',
      features: ['Wysoka pozycja siedzeń', 'Asysta 24/7', 'Dodatkowy kierowca gratis'],
      note: 'Zwiększona przestrzeń nad głową zapewnia komfort przy dłuższych przejazdach.',
    },
    {
      id: 'kia-rio-2019',
      name: 'Kia Rio',
      year: 2019,
      pricePerDay: 35,
      seats: 4,
      transmission: 'Automat',
      category: 'Hatchback',
      fuel: 'Benzyna',
      features: ['Łatwe manewrowanie', 'Klimatyzacja', 'Foteliki w cenie'],
      note: 'Stabilne prowadzenie sprawdzi się przy zwiedzaniu całej wyspy.',
    },
    {
      id: 'toyota-yaris-hybrid-2023',
      name: 'Toyota Yaris Hybrid',
      year: 2023,
      pricePerDay: 40,
      seats: 4,
      transmission: 'Automat',
      category: 'Hybryda miejska',
      fuel: 'Hybryda',
      features: ['Napęd hybrydowy', 'Bez kaucji', 'Tryb EV w mieście'],
      note: 'Idealna dla osób chcących ograniczyć spalanie podczas częstych przejazdów.',
    },
    {
      id: 'toyota-aqua-hybrid-2022',
      name: 'Toyota Aqua Hybrid',
      year: 2022,
      pricePerDay: 40,
      seats: 5,
      transmission: 'Automat',
      category: 'Hybryda',
      fuel: 'Hybryda',
      features: ['Niskie spalanie', 'System Start/Stop', 'Assistance 24/7'],
      note: 'Napęd hybrydowy i przestronny bagażnik ułatwiają rodzinne wycieczki.',
    },
    {
      id: 'honda-fit-2022',
      name: 'Honda Fit',
      year: 2022,
      pricePerDay: 40,
      seats: 5,
      transmission: 'Automat',
      category: 'Kompakt rodzinny',
      fuel: 'Benzyna',
      features: ['Magic Seats', 'Klimatyzacja', 'Dodatkowy kierowca gratis'],
      note: 'Regulowane siedzenia pozwalają łatwo przewozić sprzęt plażowy lub wózek dziecięcy.',
    },
    {
      id: 'honda-fit-hybrid-2019',
      name: 'Honda Fit Hybrid',
      year: 2019,
      pricePerDay: 40,
      seats: 4,
      transmission: 'Automat',
      category: 'Hybryda',
      fuel: 'Hybryda',
      features: ['Oszczędna jazda', 'Tryby jazdy ECO', 'Bez kaucji'],
      note: 'Świetny kompromis między kompaktowymi wymiarami a przestronną kabiną.',
    },
    {
      id: 'honda-fit-hybrid-2022',
      name: 'Honda Fit Hybrid',
      year: 2022,
      pricePerDay: 40,
      seats: 5,
      transmission: 'Automat',
      category: 'Hybryda miejska',
      fuel: 'Hybryda',
      features: ['Nowoczesne multimedia', 'Napęd hybrydowy', 'Foteliki gratis'],
      note: 'Oferuje cichą jazdę i wszechstronne wnętrze dla aktywnych rodzin.',
    },
    {
      id: 'nissan-note-hybrid-2023',
      name: 'Nissan Note Hybrid',
      year: 2023,
      pricePerDay: 40,
      seats: 4,
      transmission: 'Automat',
      category: 'Hybryda',
      fuel: 'Hybryda',
      features: ['System e-Power', 'Asysta 24/7', 'Nowoczesne systemy bezpieczeństwa'],
      note: 'Dynamiczny napęd hybrydowy e-Power zapewnia płynne przyspieszenie.',
    },
    {
      id: 'mazda-2-2023',
      name: 'Mazda 2',
      year: 2023,
      pricePerDay: 40,
      seats: 4,
      transmission: 'Automat',
      category: 'Hatchback',
      fuel: 'Benzyna',
      features: ['Kokpit Skyactiv', 'Łączność Apple CarPlay/Android Auto', 'Bez kaucji'],
      note: 'Stylowa i żwawa, świetnie sprawdzi się w miejskim ruchu.',
    },
    {
      id: 'toyota-corolla-2021',
      name: 'Toyota Corolla',
      year: 2021,
      pricePerDay: 55,
      seats: 5,
      transmission: 'Automat',
      category: 'Sedan',
      fuel: 'Benzyna',
      features: ['Przestronny bagażnik', 'System Toyota Safety Sense', 'Asysta 24/7'],
      note: 'Komfortowy sedan na dłuższe trasy i rodzinne zwiedzanie wyspy.',
    },
    {
      id: 'mazda-atenza-2019',
      name: 'Mazda Atenza',
      year: 2019,
      pricePerDay: 65,
      seats: 5,
      transmission: 'Automat',
      category: 'Sedan klasy średniej',
      fuel: 'Benzyna',
      features: ['Skórzane wykończenie', 'Adaptacyjne światła', 'Dodatkowy kierowca gratis'],
      note: 'Elegancki sedan klasy premium z dynamicznym prowadzeniem.',
    },
    {
      id: 'mazda-premacy-2018',
      name: 'Mazda Premacy',
      year: 2018,
      pricePerDay: 65,
      seats: 7,
      transmission: 'Automat',
      category: 'Minivan 7-osobowy',
      fuel: 'Benzyna',
      features: ['Przesuwne drzwi', 'Elastyczne siedzenia', 'Foteliki w cenie'],
      note: 'Idealna dla większych grup z możliwością konfiguracji siedzeń i bagażu.',
    },
    {
      id: 'toyota-sienta-2022',
      name: 'Toyota Sienta',
      year: 2022,
      pricePerDay: 70,
      seats: 7,
      transmission: 'Automat',
      category: 'Minivan 7-osobowy',
      fuel: 'Hybryda',
      features: ['Napęd hybrydowy', 'Przesuwne drzwi', 'Pakiet rodzinny'],
      note: 'Lekki i ekonomiczny minivan na całodniowe wycieczki z dziećmi.',
    },
    {
      id: 'nissan-serena-hybrid-2016',
      name: 'Nissan Serena Hybrid',
      year: 2016,
      pricePerDay: 70,
      seats: 8,
      transmission: 'Automat',
      category: 'Minivan 8-osobowy',
      fuel: 'Hybryda',
      features: ['Duża przestrzeń', 'Dwustrefowa klimatyzacja', 'Assistance 24/7'],
      note: 'Świetny wybór dla grup z dodatkowym bagażem lub sprzętem sportowym.',
    },
    {
      id: 'mazda-axela-2022',
      name: 'Mazda Axela',
      year: 2022,
      pricePerDay: 80,
      seats: 5,
      transmission: 'Automat',
      category: 'Hatchback premium',
      fuel: 'Benzyna',
      features: ['Head-up display', 'System Bose Audio', 'Bez kaucji'],
      note: 'Dynamiczny styl z segmentu premium dla wymagających kierowców.',
    },
    {
      id: 'nissan-serena-hybrid-2022',
      name: 'Nissan Serena Hybrid',
      year: 2022,
      pricePerDay: 95,
      seats: 8,
      transmission: 'Automat',
      category: 'Minivan premium',
      fuel: 'Hybryda',
      features: ['Nowa generacja e-Power', 'Pakiet bezpieczeństwa ProPILOT', 'Foteliki w cenie'],
      note: 'Najnowsza odsłona popularnego minivana z bogatym wyposażeniem.',
    },
    {
      id: 'mercedes-s-class-2017',
      name: 'Mercedes S-class',
      year: 2017,
      pricePerDay: 150,
      seats: 5,
      transmission: 'Automat',
      category: 'Limuzyna premium',
      fuel: 'Benzyna',
      features: ['Pakiet VIP', 'Skórzane wykończenie', 'Zawieszenie pneumatyczne'],
      note: 'Luksusowy transport na wyjątkowe okazje, z kierowcą dodatkowo na życzenie.',
    },
    {
      id: 'mercedes-c-class-2020',
      name: 'Mercedes C-class',
      year: 2020,
      pricePerDay: 180,
      seats: 4,
      transmission: 'Automat',
      category: 'Coupe premium',
      fuel: 'Benzyna',
      features: ['Panoramiczny dach', 'Pakiet AMG', 'Asysta 24/7'],
      note: 'Sportowa elegancja dla osób, które chcą zwiedzać Cypr w najwyższym komforcie.',
    },
  ];

  const DEFAULT_RENTAL_LOCATIONS = [
    { id: 'larnaca', label: 'Larnaka (bez opłaty)', shortLabel: 'Larnaka', fee: 0 },
    { id: 'nicosia', label: 'Nikozja (+15€)', shortLabel: 'Nikozja', fee: 15 },
    { id: 'ayia-napa', label: 'Ayia Napa (+15€)', shortLabel: 'Ayia Napa', fee: 15 },
    { id: 'protaras', label: 'Protaras (+20€)', shortLabel: 'Protaras', fee: 20 },
    { id: 'limassol', label: 'Limassol (+20€)', shortLabel: 'Limassol', fee: 20 },
    { id: 'paphos', label: 'Pafos (+40€)', shortLabel: 'Pafos', fee: 40 },
  ];

  const DEFAULT_PRICE_CATEGORIES = [
    {
      id: 'economy',
      label: 'Ekonomiczne i miejskie',
      badge: 'do 40 € / dzień',
      description: 'Zwrotne auta idealne do zwiedzania kurortów i codziennej jazdy.',
      min: 0,
      max: 40,
    },
    {
      id: 'comfort',
      label: 'Rodzinne i komfortowe',
      badge: '41 – 75 € / dzień',
      description: 'Więcej przestrzeni na bagaż, wygoda na dalszych trasach i minivany 7–8 os.',
      min: 41,
      max: 75,
    },
    {
      id: 'premium',
      label: 'Premium i wyjątkowe',
      badge: 'powyżej 75 € / dzień',
      description: 'Najbogatsze wersje wyposażenia i luksusowe limuzyny na specjalne okazje.',
      min: 76,
      max: Infinity,
    },
  ];

  const DEFAULT_RENTAL_INCLUDED_FEATURES = [
    {
      short: 'brak kaucji',
      description: 'Brak kaucji i blokad na karcie.',
    },
    {
      short: 'OC + Assistance 24/7',
      description: 'Ubezpieczenie OC + Assistance 24/7 z udziałem własnym do 500 €.',
    },
    {
      short: 'gratisowy drugi kierowca i foteliki',
      description: 'Drugi kierowca oraz foteliki dziecięce gratis.',
    },
  ];

  const DEFAULT_RENTAL_MINIMUM_DAYS = 3;
  const DEFAULT_FULL_INSURANCE_DAILY = 17;
  const DEFAULT_YOUNG_DRIVER_DAILY = 10;

  const config = typeof window !== 'undefined' && window.CAR_RENTAL_CONFIG ? window.CAR_RENTAL_CONFIG : {};
  if (typeof window !== 'undefined' && window.CAR_RENTAL_CONFIG) {
    delete window.CAR_RENTAL_CONFIG;
  }

  const carFleet = (Array.isArray(config.fleet) && config.fleet.length ? config.fleet : DEFAULT_CAR_FLEET).map((car) => {
    const id = isNonEmptyString(car.id) ? car.id.trim() : '';
    const transmissionKey = id ? `carRental.fleet.${id}.transmission` : '';
    const categoryKey = id ? `carRental.fleet.${id}.category` : '';
    const fuelKey = id ? `carRental.fleet.${id}.fuel` : '';

    const features = Array.isArray(car.features)
      ? car.features.map((feature, index) => wrapText(feature, id ? `carRental.fleet.${id}.feature${index + 1}` : ''))
      : [];

    return {
      ...car,
      id,
      transmission: wrapText(car.transmission, transmissionKey),
      category: wrapText(car.category, categoryKey),
      fuel: wrapText(car.fuel, fuelKey),
      features,
      note: wrapText(car.note, id ? `carRental.fleet.${id}.note` : ''),
      pricePerDay: isFiniteNumber(car.pricePerDay) ? car.pricePerDay : toNumberOrZero(car.pricePerDay),
    };
  });

  const rentalLocations = (Array.isArray(config.locations) && config.locations.length
    ? config.locations
    : DEFAULT_RENTAL_LOCATIONS
  ).map((location) => {
    const id = isNonEmptyString(location.id) ? location.id.trim() : '';
    const labelEntry = wrapText(location.label, id ? `carRental.locations.${id}.label` : '');
    const shortEntry = wrapText(
      location.shortLabel,
      id ? `carRental.locations.${id}.short` : ''
    );

    const shortFallback = isNonEmptyString(shortEntry.fallback)
      ? shortEntry.fallback
      : isNonEmptyString(labelEntry.fallback)
      ? labelEntry.fallback
      : '';

    if (!isNonEmptyString(shortEntry.fallback) && shortFallback) {
      shortEntry.fallback = shortFallback;
    }

    return {
      ...location,
      id,
      label: labelEntry,
      shortLabel: shortEntry,
      fee: isFiniteNumber(location.fee) ? location.fee : toNumberOrZero(location.fee),
    };
  });

  const PRICE_CATEGORIES = (Array.isArray(config.priceCategories) && config.priceCategories.length
    ? config.priceCategories
    : DEFAULT_PRICE_CATEGORIES
  ).map((category) => {
    const id = isNonEmptyString(category.id) ? category.id.trim() : '';
    return {
      ...category,
      id,
      label: wrapText(category.label, id ? `carRental.categories.${id}.label` : ''),
      badge: wrapText(category.badge, id ? `carRental.categories.${id}.badge` : ''),
      description: wrapText(category.description, id ? `carRental.categories.${id}.description` : ''),
    };
  });

  const RENTAL_INCLUDED_FEATURES = (Array.isArray(config.includedFeatures) && config.includedFeatures.length
    ? config.includedFeatures
    : DEFAULT_RENTAL_INCLUDED_FEATURES
  ).map((feature, index) => ({
    short: wrapText(feature.short, `carRental.included.feature${index + 1}.short`),
    description: wrapText(feature.description, `carRental.included.feature${index + 1}.description`),
  }));

  const RENTAL_MINIMUM_DAYS = isFiniteNumber(config.minimumDays)
    ? config.minimumDays
    : DEFAULT_RENTAL_MINIMUM_DAYS;
  const FULL_INSURANCE_DAILY = isFiniteNumber(config.fullInsuranceDaily)
    ? config.fullInsuranceDaily
    : DEFAULT_FULL_INSURANCE_DAILY;
  const YOUNG_DRIVER_DAILY = isFiniteNumber(config.youngDriverDaily)
    ? config.youngDriverDaily
    : DEFAULT_YOUNG_DRIVER_DAILY;

  const includedMessageEntry = wrapText(
    isNonEmptyString(config.includedMessage) || isNonEmptyString(config.includedMessageKey)
      ? {
          key: isNonEmptyString(config.includedMessageKey) ? config.includedMessageKey.trim() : '',
          fallback: isNonEmptyString(config.includedMessage) ? config.includedMessage.trim() : '',
        }
      : null,
    ''
  );

  let EURO_FORMATTER = getLocalizedFormatter();
  let rentalContext = null;

  function refreshFormatter() {
    EURO_FORMATTER = getLocalizedFormatter();
  }

  function formatPrice(value) {
    return EURO_FORMATTER.format(value);
  }

  function formatPricePerDay(value) {
    const price = formatPrice(value);
    return translateWithReplacements('carRental.common.pricePerDay', `${price} / dzień`, { price });
  }

  function formatSeats(count) {
    return translateWithReplacements('carRental.common.seats', `${count} miejsc`, { count });
  }

  function getDaysLabel() {
    return translateText('carRental.common.daysLabel', 'dni');
  }

  function getIncludedMessage() {
    if (isNonEmptyString(includedMessageEntry.key) || isNonEmptyString(includedMessageEntry.fallback)) {
      return resolveText(includedMessageEntry);
    }

    const items = RENTAL_INCLUDED_FEATURES.map((feature) => resolveText(feature.short)).filter((text) => isNonEmptyString(text));
    if (!items.length) {
      return '';
    }

    return translateWithReplacements(
      'carRental.common.includedMessage.template',
      `W cenie: ${items.join(', ')}.`,
      { items: items.join(', ') },
    );
  }

  function populateIncludedFeatures() {
    const lists = document.querySelectorAll('[data-included-list]');
    lists.forEach((list) => {
      list.innerHTML = '';
      RENTAL_INCLUDED_FEATURES.forEach((feature) => {
        const item = document.createElement('li');
        item.textContent = resolveText(feature.description);
        list.appendChild(item);
      });
    });
  }

  function getCarById(carId) {
    if (!carId) {
      return null;
    }
    return carFleet.find((car) => car.id === carId) || null;
  }

  function getRentalLocationById(locationId) {
    if (!locationId) {
      return null;
    }
    return rentalLocations.find((location) => location.id === locationId) || null;
  }

  function populateCarSelect(select, selectedValue) {
    if (!select) {
      return;
    }

    select.innerHTML = '';
    carFleet.forEach((car) => {
      const option = document.createElement('option');
      option.value = car.id;
      const pricePerDay = formatPricePerDay(car.pricePerDay);
      option.textContent = `${car.name} (${car.year}) — ${pricePerDay}`;
      select.appendChild(option);
    });

    const desiredValue = selectedValue && carFleet.some((car) => car.id === selectedValue) ? selectedValue : null;
    if (desiredValue) {
      select.value = desiredValue;
    } else if (carFleet.length) {
      select.value = carFleet[0].id;
    }
  }

  function populateLocationSelects(selects, selectedValues = []) {
    selects
      .filter(Boolean)
      .forEach((select, index) => {
        select.innerHTML = '';
        rentalLocations.forEach((location) => {
          const option = document.createElement('option');
          option.value = location.id;
          option.textContent = resolveText(location.label);
          select.appendChild(option);
        });

        const preferredValue =
          Array.isArray(selectedValues) && selectedValues[index] && rentalLocations.some((loc) => loc.id === selectedValues[index])
            ? selectedValues[index]
            : null;

        if (preferredValue) {
          select.value = preferredValue;
        } else if (rentalLocations.length) {
          select.value = rentalLocations[0].id;
        }
      });
  }

  function setDefaultRentalDates(pickupDateInput, returnDateInput) {
    if (!pickupDateInput || !returnDateInput) {
      return;
    }

    const today = new Date();
    const isoToday = today.toISOString().split('T')[0];
    pickupDateInput.value = isoToday;
    pickupDateInput.min = isoToday;

    const minimumReturn = new Date(today);
    minimumReturn.setDate(minimumReturn.getDate() + RENTAL_MINIMUM_DAYS);
    const isoReturn = minimumReturn.toISOString().split('T')[0];
    returnDateInput.value = isoReturn;
    returnDateInput.min = isoToday;
  }

  function setupPickupDateSync(pickupDateInput, returnDateInput) {
    if (!pickupDateInput || !returnDateInput) {
      return;
    }

    pickupDateInput.addEventListener('change', () => {
      if (!pickupDateInput.value) {
        return;
      }
      const newMin = pickupDateInput.value;
      returnDateInput.min = newMin;
      if (returnDateInput.value && returnDateInput.value < newMin) {
        returnDateInput.value = newMin;
      }
    });
  }

  function updateRentalQuote(context) {
    const {
      carSelect,
      pickupDateInput,
      pickupTimeInput,
      returnDateInput,
      returnTimeInput,
      pickupSelect,
      returnSelect,
      fullInsuranceCheckbox,
      youngDriverCheckbox,
      resultEl,
      breakdownEl,
      messageEl,
    } = context;

    if (
      !carSelect ||
      !pickupDateInput ||
      !returnDateInput ||
      !pickupTimeInput ||
      !returnTimeInput ||
      !pickupSelect ||
      !returnSelect ||
      !resultEl ||
      !breakdownEl ||
      !messageEl
    ) {
      return false;
    }

    const car = getCarById(carSelect.value);
    if (!car) {
      return setRentalError(translateText('carRental.calculator.errors.selectCar', 'Wybierz model auta z listy.'));
    }

    if (!pickupDateInput.value || !returnDateInput.value) {
      return setRentalError(translateText('carRental.calculator.errors.fillDates', 'Uzupełnij daty odbioru i zwrotu.'));
    }

    const pickupTime = pickupTimeInput.value || '00:00';
    const returnTime = returnTimeInput.value || '00:00';
    const pickupDate = new Date(`${pickupDateInput.value}T${pickupTime}`);
    const returnDate = new Date(`${returnDateInput.value}T${returnTime}`);

    if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(returnDate.getTime())) {
      return setRentalError(
        translateText('carRental.calculator.errors.invalidDates', 'Proszę wybrać poprawne daty i godziny.'),
      );
    }

    if (returnDate <= pickupDate) {
      return setRentalError(
        translateText(
          'carRental.calculator.errors.returnAfterPickup',
          'Data zwrotu musi być późniejsza niż data odbioru.',
        ),
      );
    }

    const diffHours = (returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60);
    const rentalDays = Math.ceil(diffHours / 24);

    if (rentalDays < RENTAL_MINIMUM_DAYS) {
      return setRentalError(
        translateWithReplacements(
          'carRental.calculator.errors.minimumDays',
          'Minimalny czas wynajmu to {{days}} {{daysLabel}}.',
          {
            days: RENTAL_MINIMUM_DAYS,
            daysLabel: getDaysLabel(),
          },
        ),
      );
    }

    const pickupLocation = getRentalLocationById(pickupSelect.value);
    const returnLocation = getRentalLocationById(returnSelect.value);

    if (!pickupLocation || !returnLocation) {
      return setRentalError(
        translateText('carRental.calculator.errors.selectLocations', 'Wybierz miejsca odbioru i zwrotu pojazdu.'),
      );
    }

    const basePrice = car.pricePerDay * rentalDays;
    const pickupFee = pickupLocation.fee;
    const returnFee = returnLocation.fee;
    const insuranceCost = fullInsuranceCheckbox?.checked ? FULL_INSURANCE_DAILY * rentalDays : 0;
    const youngDriverCost = youngDriverCheckbox?.checked ? YOUNG_DRIVER_DAILY * rentalDays : 0;
    const totalPrice = basePrice + pickupFee + returnFee + insuranceCost + youngDriverCost;

    const daysLabel = getDaysLabel();
    const pickupLocationLabel = resolveText(pickupLocation.shortLabel);
    const returnLocationLabel = resolveText(returnLocation.shortLabel);
    const perDayFormatted = formatPrice(car.pricePerDay);

    const breakdownItems = [
      translateWithReplacements(
        'carRental.calculator.breakdown.base',
        `${perDayFormatted} × ${rentalDays} ${daysLabel} = ${formatPrice(basePrice)}`,
        {
          pricePerDay: perDayFormatted,
          days: rentalDays,
          daysLabel,
          total: formatPrice(basePrice),
        },
      ),
      pickupFee > 0
        ? translateWithReplacements(
            'carRental.calculator.breakdown.pickupWithFee',
            `Odbiór: ${pickupLocationLabel} +${formatPrice(pickupFee)}`,
            {
              location: pickupLocationLabel,
              price: formatPrice(pickupFee),
            },
          )
        : translateWithReplacements(
            'carRental.calculator.breakdown.pickupIncluded',
            `Odbiór: ${pickupLocationLabel} – w cenie`,
            { location: pickupLocationLabel },
          ),
      returnFee > 0
        ? translateWithReplacements(
            'carRental.calculator.breakdown.returnWithFee',
            `Zwrot: ${returnLocationLabel} +${formatPrice(returnFee)}`,
            {
              location: returnLocationLabel,
              price: formatPrice(returnFee),
            },
          )
        : translateWithReplacements(
            'carRental.calculator.breakdown.returnIncluded',
            `Zwrot: ${returnLocationLabel} – w cenie`,
            { location: returnLocationLabel },
          ),
    ];

    if (insuranceCost > 0) {
      breakdownItems.push(
        translateWithReplacements(
          'carRental.calculator.breakdown.fullInsurance',
          `Pełne AC: ${formatPrice(FULL_INSURANCE_DAILY)} × ${rentalDays} ${daysLabel} = ${formatPrice(insuranceCost)}`,
          {
            pricePerDay: formatPrice(FULL_INSURANCE_DAILY),
            days: rentalDays,
            daysLabel,
            total: formatPrice(insuranceCost),
          },
        ),
      );
    }

    if (youngDriverCost > 0) {
      breakdownItems.push(
        translateWithReplacements(
          'carRental.calculator.breakdown.youngDriver',
          `Młody kierowca: ${formatPrice(YOUNG_DRIVER_DAILY)} × ${rentalDays} ${daysLabel} = ${formatPrice(youngDriverCost)}`,
          {
            pricePerDay: formatPrice(YOUNG_DRIVER_DAILY),
            days: rentalDays,
            daysLabel,
            total: formatPrice(youngDriverCost),
          },
        ),
      );
    }

    resultEl.textContent = translateWithReplacements(
      'carRental.calculator.total',
      `Całkowita cena wynajmu: ${formatPrice(totalPrice)}`,
      { price: formatPrice(totalPrice) },
    );
    const breakdownTitle = translateText('carRental.calculator.breakdown.title', 'Wycena obejmuje:');
    breakdownEl.innerHTML = `<p>${breakdownTitle}</p><ul>${breakdownItems
      .map((item) => `<li>${item}</li>`)
      .join('')}</ul>`;
    messageEl.textContent = getIncludedMessage();
    messageEl.classList.remove('is-error');

    return true;

    function setRentalError(message) {
      resultEl.textContent = '';
      breakdownEl.innerHTML = '';
      messageEl.textContent = message;
      messageEl.classList.add('is-error');
      return false;
    }
  }

  function createCarCard(car, context) {
    const card = document.createElement('article');
    card.className = 'auto-card';

    const header = document.createElement('header');
    header.className = 'auto-card-header';

    const price = document.createElement('span');
    price.className = 'auto-card-price';
    price.textContent = formatPricePerDay(car.pricePerDay);

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'auto-card-title';

    const title = document.createElement('h3');
    title.textContent = car.name;
    const subtitle = document.createElement('span');
    const categoryText = resolveText(car.category);
    subtitle.textContent = `${car.year} • ${categoryText}`;
    title.appendChild(subtitle);

    titleWrapper.appendChild(title);

    header.appendChild(price);
    header.appendChild(titleWrapper);

    card.appendChild(header);

    const specs = document.createElement('ul');
    specs.className = 'auto-card-specs';
    [formatSeats(car.seats), resolveText(car.transmission), resolveText(car.fuel)].forEach((value) => {
      const item = document.createElement('li');
      item.textContent = value;
      specs.appendChild(item);
    });
    card.appendChild(specs);

    if (car.features?.length) {
      const featuresList = document.createElement('ul');
      featuresList.className = 'auto-card-tags';
      car.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = resolveText(feature);
        featuresList.appendChild(li);
      });
      card.appendChild(featuresList);
    }

    if (car.note) {
      const note = document.createElement('p');
      note.className = 'auto-card-note';
      note.textContent = resolveText(car.note);
      card.appendChild(note);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = translateText('carRental.common.reserveCar', 'Zarezerwuj to auto');
    button.addEventListener('click', () => {
      if (context.carSelect) {
        context.carSelect.value = car.id;
        context.carSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      updateRentalQuote(context);
      const calculatorBlock = document.getElementById('carRentalCalculatorBlock');
      if (calculatorBlock) {
        calculatorBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (context.carSelect) {
        context.carSelect.focus({ preventScroll: true });
      }
    });
    card.appendChild(button);

    return card;
  }

  function renderCarFleet(grid, context) {
    if (!grid) {
      return;
    }

    grid.innerHTML = '';

    const language = getCurrentLanguage();
    const sortedFleet = carFleet
      .slice()
      .sort((a, b) => {
        if (a.pricePerDay === b.pricePerDay) {
          return a.name.localeCompare(b.name, language);
        }
        return a.pricePerDay - b.pricePerDay;
      });

    const groups = PRICE_CATEGORIES.map((category) => ({
      ...category,
      labelText: resolveText(category.label),
      descriptionText: resolveText(category.description),
      badgeText: resolveText(category.badge),
      cars: [],
    }));

    sortedFleet.forEach((car) => {
      const category =
        groups.find((group) => car.pricePerDay >= group.min && car.pricePerDay <= group.max) || groups[groups.length - 1];
      category.cars.push(car);
    });

    groups
      .filter((group) => group.cars.length > 0)
      .forEach((group) => {
        const groupSection = document.createElement('article');
        groupSection.className = 'auto-category';
        groupSection.id = `auto-category-${group.id}`;

        const groupHeader = document.createElement('header');
        groupHeader.className = 'auto-category-header';

        const title = document.createElement('div');
        title.className = 'auto-category-title';
        const heading = document.createElement('h3');
        heading.textContent = group.labelText;
        const description = document.createElement('p');
        description.textContent = group.descriptionText;
        title.appendChild(heading);
        title.appendChild(description);

        const badge = document.createElement('span');
        badge.className = 'auto-category-badge';
        badge.textContent = group.badgeText;

        groupHeader.appendChild(title);
        groupHeader.appendChild(badge);

        const list = document.createElement('div');
        list.className = 'auto-category-grid';

        group.cars.forEach((car) => {
          list.appendChild(createCarCard(car, context));
        });

        groupSection.appendChild(groupHeader);
        groupSection.appendChild(list);

        grid.appendChild(groupSection);
      });
  }

  function initializeCarRentalSection() {
    const carSelect = document.getElementById('rentalCarSelect');
    const pickupSelect = document.getElementById('pickupLocation');
    const returnSelect = document.getElementById('returnLocation');
    const pickupDateInput = document.getElementById('pickupDate');
    const returnDateInput = document.getElementById('returnDate');
    const pickupTimeInput = document.getElementById('pickupTime');
    const returnTimeInput = document.getElementById('returnTime');
    const fullInsuranceCheckbox = document.getElementById('fullInsurance');
    const youngDriverCheckbox = document.getElementById('youngDriver');
    const resultEl = document.getElementById('carRentalResult');
    const breakdownEl = document.getElementById('carRentalBreakdown');
    const messageEl = document.getElementById('carRentalMessage');
    const form = document.getElementById('carRentalCalculator');
    const grid = document.getElementById('carRentalGrid');

    if (
      !carSelect ||
      !pickupSelect ||
      !returnSelect ||
      !pickupDateInput ||
      !returnDateInput ||
      !pickupTimeInput ||
      !returnTimeInput ||
      !resultEl ||
      !breakdownEl ||
      !messageEl ||
      !form ||
      !grid
    ) {
      return;
    }

    populateIncludedFeatures();

    const context = {
      carSelect,
      pickupDateInput,
      pickupTimeInput,
      returnDateInput,
      returnTimeInput,
      pickupSelect,
      returnSelect,
      fullInsuranceCheckbox,
      youngDriverCheckbox,
      resultEl,
      breakdownEl,
      messageEl,
      grid,
    };

    rentalContext = context;

    populateCarSelect(carSelect);
    populateLocationSelects([pickupSelect, returnSelect]);
    setDefaultRentalDates(pickupDateInput, returnDateInput);
    setupPickupDateSync(pickupDateInput, returnDateInput);

    if (carFleet.length) {
      carSelect.value = carFleet[0].id;
    }

    renderCarFleet(grid, context);
    updateRentalQuote(context);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      updateRentalQuote(context);
    });

    form.addEventListener('change', () => {
      messageEl.classList.remove('is-error');
      updateRentalQuote(context);
    });
  }

  function refreshDynamicContent() {
    refreshFormatter();
    populateIncludedFeatures();

    if (!rentalContext) {
      return;
    }

    const {
      carSelect,
      pickupSelect,
      returnSelect,
      grid,
    } = rentalContext;

    const selectedCar = carSelect?.value;
    const selectedPickup = pickupSelect?.value;
    const selectedReturn = returnSelect?.value;

    populateCarSelect(carSelect, selectedCar);
    populateLocationSelects([pickupSelect, returnSelect], [selectedPickup, selectedReturn]);
    renderCarFleet(grid, rentalContext);
    updateRentalQuote(rentalContext);
  }

  document.addEventListener('wakacjecypr:languagechange', refreshDynamicContent);

  window.CarRental = {
    initializeSection: initializeCarRentalSection,
    getFleet: () =>
      carFleet.map((car) => ({
        ...car,
        transmission: resolveText(car.transmission),
        category: resolveText(car.category),
        fuel: resolveText(car.fuel),
        features: Array.isArray(car.features) ? car.features.map((feature) => resolveText(feature)) : [],
        note: resolveText(car.note),
      })),
    getRentalLocations: () =>
      rentalLocations.map((location) => ({
        ...location,
        label: resolveText(location.label),
        shortLabel: resolveText(location.shortLabel),
      })),
    formatPrice,
    getIncludedMessage,
    minimumDays: RENTAL_MINIMUM_DAYS,
  };
})();
