(function () {
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

  const carFleet = (Array.isArray(config.fleet) && config.fleet.length ? config.fleet : DEFAULT_CAR_FLEET).map((car) => ({
    ...car,
    pricePerDay: isFiniteNumber(car.pricePerDay) ? car.pricePerDay : toNumberOrZero(car.pricePerDay),
  }));

  const rentalLocations = (Array.isArray(config.locations) && config.locations.length
    ? config.locations
    : DEFAULT_RENTAL_LOCATIONS
  ).map((location) => ({
    ...location,
    shortLabel: isNonEmptyString(location.shortLabel)
      ? location.shortLabel.trim()
      : isNonEmptyString(location.label)
      ? location.label.trim()
      : '',
    fee: isFiniteNumber(location.fee) ? location.fee : toNumberOrZero(location.fee),
  }));

  const PRICE_CATEGORIES = (Array.isArray(config.priceCategories) && config.priceCategories.length
    ? config.priceCategories
    : DEFAULT_PRICE_CATEGORIES
  ).map((category) => ({ ...category }));

  const RENTAL_INCLUDED_FEATURES = (Array.isArray(config.includedFeatures) && config.includedFeatures.length
    ? config.includedFeatures
    : DEFAULT_RENTAL_INCLUDED_FEATURES
  ).map((feature) => ({
    short: isNonEmptyString(feature.short) ? feature.short.trim() : '',
    description: isNonEmptyString(feature.description)
      ? feature.description.trim()
      : isNonEmptyString(feature.short)
      ? feature.short.trim()
      : '',
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

  const includedShortList = RENTAL_INCLUDED_FEATURES.filter((feature) => isNonEmptyString(feature.short)).map((feature) =>
    feature.short,
  );
  const defaultIncludedMessage = includedShortList.length
    ? `W cenie: ${includedShortList.join(', ')}.`
    : '';
  const CAR_RENTAL_INCLUDED_MESSAGE = isNonEmptyString(config.includedMessage)
    ? config.includedMessage.trim()
    : defaultIncludedMessage;

  const EURO_FORMATTER = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

  function populateIncludedFeatures() {
    const lists = document.querySelectorAll('[data-included-list]');
    lists.forEach((list) => {
      list.innerHTML = '';
      RENTAL_INCLUDED_FEATURES.forEach((feature) => {
        const item = document.createElement('li');
        item.textContent = feature.description;
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

  function populateCarSelect(select) {
    if (!select) {
      return;
    }

    select.innerHTML = '';
    carFleet.forEach((car) => {
      const option = document.createElement('option');
      option.value = car.id;
      option.textContent = `${car.name} (${car.year}) — ${EURO_FORMATTER.format(car.pricePerDay)} / dzień`;
      select.appendChild(option);
    });
  }

  function populateLocationSelects(selects) {
    selects
      .filter(Boolean)
      .forEach((select) => {
        select.innerHTML = '';
        rentalLocations.forEach((location) => {
          const option = document.createElement('option');
          option.value = location.id;
          option.textContent = location.label;
          select.appendChild(option);
        });

        if (rentalLocations.length) {
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
      return setRentalError('Wybierz model auta z listy.');
    }

    if (!pickupDateInput.value || !returnDateInput.value) {
      return setRentalError('Uzupełnij daty odbioru i zwrotu.');
    }

    const pickupTime = pickupTimeInput.value || '00:00';
    const returnTime = returnTimeInput.value || '00:00';
    const pickupDate = new Date(`${pickupDateInput.value}T${pickupTime}`);
    const returnDate = new Date(`${returnDateInput.value}T${returnTime}`);

    if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(returnDate.getTime())) {
      return setRentalError('Proszę wybrać poprawne daty i godziny.');
    }

    if (returnDate <= pickupDate) {
      return setRentalError('Data zwrotu musi być późniejsza niż data odbioru.');
    }

    const diffHours = (returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60);
    const rentalDays = Math.ceil(diffHours / 24);

    if (rentalDays < RENTAL_MINIMUM_DAYS) {
      return setRentalError(`Minimalny czas wynajmu to ${RENTAL_MINIMUM_DAYS} dni.`);
    }

    const pickupLocation = getRentalLocationById(pickupSelect.value);
    const returnLocation = getRentalLocationById(returnSelect.value);

    if (!pickupLocation || !returnLocation) {
      return setRentalError('Wybierz miejsca odbioru i zwrotu pojazdu.');
    }

    const basePrice = car.pricePerDay * rentalDays;
    const pickupFee = pickupLocation.fee;
    const returnFee = returnLocation.fee;
    const insuranceCost = fullInsuranceCheckbox?.checked ? FULL_INSURANCE_DAILY * rentalDays : 0;
    const youngDriverCost = youngDriverCheckbox?.checked ? YOUNG_DRIVER_DAILY * rentalDays : 0;
    const totalPrice = basePrice + pickupFee + returnFee + insuranceCost + youngDriverCost;

    const breakdownItems = [
      `${EURO_FORMATTER.format(car.pricePerDay)} × ${rentalDays} dni = ${EURO_FORMATTER.format(basePrice)}`,
      pickupFee > 0
        ? `Odbiór: ${pickupLocation.shortLabel} +${EURO_FORMATTER.format(pickupFee)}`
        : `Odbiór: ${pickupLocation.shortLabel} – w cenie`,
      returnFee > 0
        ? `Zwrot: ${returnLocation.shortLabel} +${EURO_FORMATTER.format(returnFee)}`
        : `Zwrot: ${returnLocation.shortLabel} – w cenie`,
    ];

    if (insuranceCost > 0) {
      breakdownItems.push(
        `Pełne AC: ${EURO_FORMATTER.format(FULL_INSURANCE_DAILY)} × ${rentalDays} dni = ${EURO_FORMATTER.format(insuranceCost)}`,
      );
    }

    if (youngDriverCost > 0) {
      breakdownItems.push(
        `Młody kierowca: ${EURO_FORMATTER.format(YOUNG_DRIVER_DAILY)} × ${rentalDays} dni = ${EURO_FORMATTER.format(youngDriverCost)}`,
      );
    }

    resultEl.textContent = `Całkowita cena wynajmu: ${EURO_FORMATTER.format(totalPrice)}`;
    breakdownEl.innerHTML = `<p>Wycena obejmuje:</p><ul>${breakdownItems
      .map((item) => `<li>${item}</li>`)
      .join('')}</ul>`;
    messageEl.textContent = CAR_RENTAL_INCLUDED_MESSAGE;
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
    price.textContent = `${EURO_FORMATTER.format(car.pricePerDay)} / dzień`;

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'auto-card-title';

    const title = document.createElement('h3');
    title.textContent = car.name;
    const subtitle = document.createElement('span');
    subtitle.textContent = `${car.year} • ${car.category}`;
    title.appendChild(subtitle);

    titleWrapper.appendChild(title);

    header.appendChild(price);
    header.appendChild(titleWrapper);

    card.appendChild(header);

    const specs = document.createElement('ul');
    specs.className = 'auto-card-specs';
    [
      `${car.seats} miejsc`,
      car.transmission,
      car.fuel,
    ].forEach((value) => {
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
        li.textContent = feature;
        featuresList.appendChild(li);
      });
      card.appendChild(featuresList);
    }

    if (car.note) {
      const note = document.createElement('p');
      note.className = 'auto-card-note';
      note.textContent = car.note;
      card.appendChild(note);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'Zarezerwuj to auto';
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

    const sortedFleet = carFleet
      .slice()
      .sort((a, b) => {
        if (a.pricePerDay === b.pricePerDay) {
          return a.name.localeCompare(b.name, 'pl');
        }
        return a.pricePerDay - b.pricePerDay;
      });

    const groups = PRICE_CATEGORIES.map((category) => ({ ...category, cars: [] }));

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
        heading.textContent = group.label;
        const description = document.createElement('p');
        description.textContent = group.description;
        title.appendChild(heading);
        title.appendChild(description);

        const badge = document.createElement('span');
        badge.className = 'auto-category-badge';
        badge.textContent = group.badge;

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
    };

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

  window.CarRental = {
    initializeSection: initializeCarRentalSection,
    getFleet: () => carFleet.map((car) => ({ ...car })),
    getRentalLocations: () => rentalLocations.map((location) => ({ ...location })),
    formatPrice(value) {
      return EURO_FORMATTER.format(value);
    },
    getIncludedMessage() {
      return CAR_RENTAL_INCLUDED_MESSAGE;
    },
    minimumDays: RENTAL_MINIMUM_DAYS,
  };
})();
