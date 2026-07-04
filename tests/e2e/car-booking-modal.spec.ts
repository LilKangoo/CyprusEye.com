import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const CAR_OFFERS = [
  {
    id: 'lca-he-ready',
    location: 'larnaca',
    is_available: true,
    north_allowed: true,
    sort_order: 1,
    car_model: {
      pl: 'Toyota Yaris Larnaka',
      en: 'Toyota Yaris Larnaca',
      he: 'טויוטה יאריס לרנקה',
    },
    car_type: { pl: 'Ekonomiczne', en: 'Economy', he: 'חסכוני' },
    description: {
      pl: 'Małe auto do odbioru w Larnace.',
      en: 'Small car for Larnaca pickup.',
      he: 'רכב קטן לאיסוף בלרנקה.',
    },
    features: {
      pl: ['Klimatyzacja', 'Bluetooth'],
      en: ['Air conditioning', 'Bluetooth'],
      he: ['מיזוג אוויר', 'Bluetooth'],
    },
    transmission: 'automatic',
    fuel_type: 'petrol',
    max_passengers: 5,
    price_per_day: 35,
    price_3days: 105,
    price_4_6days: 35,
    price_7_10days: 32,
    price_10plus_days: 30,
    young_driver_fee: true,
    young_driver_cost: 10,
  },
  {
    id: 'lca-not-he-ready',
    location: 'larnaca',
    is_available: true,
    north_allowed: true,
    sort_order: 2,
    car_model: {
      pl: 'Ford Fiesta Larnaka',
      en: 'Ford Fiesta Larnaca',
    },
    car_type: { pl: 'Ekonomiczne', en: 'Economy' },
    description: {
      pl: 'Rekord bez treści HE.',
      en: 'Record without HE copy.',
    },
    features: {
      pl: ['Klimatyzacja'],
      en: ['Air conditioning'],
    },
    transmission: 'manual',
    fuel_type: 'petrol',
    max_passengers: 5,
    price_per_day: 31,
    price_3days: 93,
    price_4_6days: 31,
    price_7_10days: 29,
    price_10plus_days: 27,
  },
  {
    id: 'lca-he-ready-budget',
    location: 'larnaca',
    is_available: true,
    north_allowed: true,
    sort_order: 3,
    car_model: {
      pl: 'Hyundai i10 Larnaka',
      en: 'Hyundai i10 Larnaca',
      he: 'יונדאי i10 לרנקה',
    },
    car_type: { pl: 'Mini', en: 'Mini', he: 'מיני' },
    description: {
      pl: 'Tańsze HE-ready auto w późniejszej pozycji domyślnej.',
      en: 'Cheaper HE-ready car in a later default position.',
      he: 'רכב זול יותר שמוכן לעברית ומופיע מאוחר יותר כברירת מחדל.',
    },
    features: {
      pl: ['Klimatyzacja', 'USB'],
      en: ['Air conditioning', 'USB'],
      he: ['מיזוג אוויר', 'USB'],
    },
    transmission: 'manual',
    fuel_type: 'petrol',
    max_passengers: 4,
    price_per_day: 24,
    price_3days: 72,
    price_4_6days: 24,
    price_7_10days: 23,
    price_10plus_days: 21,
  },
  {
    id: 'pfo-he-ready',
    location: 'paphos',
    is_available: true,
    north_allowed: false,
    sort_order: 1,
    car_model: {
      pl: 'Nissan Note Pafos',
      en: 'Nissan Note Paphos',
      he: 'ניסאן נוט פאפוס',
    },
    car_type: { pl: 'Kompakt', en: 'Compact', he: 'קומפקטי' },
    description: {
      pl: 'Lokalna flota Pafos.',
      en: 'Local Paphos fleet.',
      he: 'צי מקומי בפאפוס.',
    },
    features: {
      pl: ['Klimatyzacja', 'Kamera cofania'],
      en: ['Air conditioning', 'Reverse camera'],
      he: ['מיזוג אוויר', 'מצלמת רוורס'],
    },
    transmission: 'automatic',
    fuel_type: 'petrol',
    max_passengers: 5,
    price_3days: 120,
    price_4_6days: 34,
    price_7_10days: 31,
    price_10plus_days: 28,
  },
  {
    id: 'pfo-not-he-ready',
    location: 'paphos',
    is_available: true,
    north_allowed: false,
    sort_order: 2,
    car_model: {
      pl: 'Kia Picanto Pafos',
      en: 'Kia Picanto Paphos',
    },
    car_type: { pl: 'Mini', en: 'Mini' },
    description: {
      pl: 'Rekord Pafos bez treści HE.',
      en: 'Paphos record without HE copy.',
    },
    features: {
      pl: ['Klimatyzacja'],
      en: ['Air conditioning'],
    },
    transmission: 'automatic',
    fuel_type: 'petrol',
    max_passengers: 4,
    price_3days: 105,
    price_4_6days: 30,
    price_7_10days: 28,
    price_10plus_days: 25,
  },
  {
    id: 'pfo-he-ready-budget',
    location: 'paphos',
    is_available: true,
    north_allowed: false,
    sort_order: 3,
    car_model: {
      pl: 'Mazda 2 Pafos',
      en: 'Mazda 2 Paphos',
      he: 'מאזדה 2 פאפוס',
    },
    car_type: { pl: 'Mini', en: 'Mini', he: 'מיני' },
    description: {
      pl: 'Tańsza lokalna flota Pafos.',
      en: 'Cheaper local Paphos fleet.',
      he: 'צי מקומי זול יותר בפאפוס.',
    },
    features: {
      pl: ['Klimatyzacja', 'USB'],
      en: ['Air conditioning', 'USB'],
      he: ['מיזוג אוויר', 'USB'],
    },
    transmission: 'manual',
    fuel_type: 'petrol',
    max_passengers: 4,
    price_3days: 90,
    price_4_6days: 24,
    price_7_10days: 23,
    price_10plus_days: 21,
  },
];

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

async function seedCarOffers(page: Page) {
  const rows = CAR_OFFERS.map((row) => ({
    image_url: '/assets/cyprus_logo-1000x1054.png',
    ...row,
  }));

  await page.addInitScript((rows) => {
    const seed = (stub: any) => {
      if (!stub || typeof stub.seedTable !== 'function') return;
      if (typeof stub.reset === 'function') {
        stub.reset();
      }
      stub.seedTable('car_offers', rows);
    };

    const existing = (window as any).__supabaseStub || {};
    const previousOnReady = existing.onReady;
    existing.onReady = (stub: any) => {
      if (typeof previousOnReady === 'function') {
        previousOnReady(stub);
      }
      seed(stub);
    };
    (window as any).__supabaseStub = existing;
    seed(existing);
  }, rows);
}

async function openCarPage(page: Page, language: 'pl' | 'en' | 'he') {
  await seedCarOffers(page);
  const errors = collectPageErrors(page);
  await page.goto(`/car.html?lang=${language}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function', null, { timeout: 15000 });
  await page.waitForFunction(() => (
    Boolean(document.querySelector('#pickupLocation option[value="larnaca"]'))
    && Boolean(document.querySelector('#pickupLocation option[value="paphos"]'))
  ), null, { timeout: 15000 });
  return errors;
}

async function openHomePage(page: Page, language: 'pl' | 'en' | 'he' = 'pl') {
  await seedCarOffers(page);
  const errors = collectPageErrors(page);
  await page.goto(`/index.html?lang=${language}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('#carsFinderPickupLocation option[value="larnaca"]')), null, { timeout: 15000 });
  return errors;
}

async function configureFinderRoute(page: Page, offer: 'larnaca' | 'paphos') {
  const location = offer === 'paphos' ? 'paphos' : 'larnaca';
  await configureFinderCities(page, location, location);
}

async function configureFinderCities(page: Page, pickupCity: string, returnCity: string, youngDriver = false) {
  await page.locator('#pickupDate').fill('2026-07-10');
  await page.locator('#pickupTime').fill('10:00');
  await page.locator('#returnDate').fill('2026-07-14');
  await page.locator('#returnTime').fill('10:00');
  await page.locator('#rentalPassengers').fill('2');
  await page.locator('#youngDriver').setChecked(youngDriver);

  await page.locator('#pickupLocation').selectOption(pickupCity);
  await page.locator('#returnLocation').selectOption(returnCity);

  const expectedOffer = youngDriver ? 'larnaca' : (pickupCity === 'paphos' && returnCity === 'paphos' ? 'paphos' : 'larnaca');
  await page.waitForFunction((expectedOffer) => (
    document.body?.dataset?.carLocation === expectedOffer
  ), expectedOffer, { timeout: 15000 });
}

async function configureHomeFinderCities(page: Page, pickupCity: string, returnCity: string, youngDriver = false) {
  await page.locator('#carsFinderPickupDate').fill('2026-07-10');
  await page.locator('#carsFinderPickupTime').fill('10:00');
  await page.locator('#carsFinderReturnDate').fill('2026-07-14');
  await page.locator('#carsFinderReturnTime').fill('10:00');
  await page.locator('#carsFinderPassengers').fill('2');
  await page.locator('#carsFinderYoungDriver').setChecked(youngDriver);
  await page.locator('#carsFinderPickupLocation').selectOption(pickupCity);
  await page.locator('#carsFinderReturnLocation').selectOption(returnCity);
  const expectedOffer = youngDriver ? 'larnaca' : (pickupCity === 'paphos' && returnCity === 'paphos' ? 'paphos' : 'larnaca');
  await page.waitForFunction((expected) => {
    const titles = Array.from(document.querySelectorAll('#carsHomeGrid .ce-home-card-title'))
      .map((node) => String(node.textContent || '').trim())
      .filter(Boolean);
    if (!titles.length) return false;
    return expected === 'paphos'
      ? titles.every((title) => /Pafos|Paphos/.test(title))
      : titles.every((title) => /Larnaka|Larnaca/.test(title));
  }, expectedOffer, { timeout: 15000 });
}

async function expectGridMatchesCurrentFleet(page: Page, offer: 'larnaca' | 'paphos') {
  const handle = await page.waitForFunction((expectedOffer) => {
    const fleet = typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function'
      ? (window as any).CE_CAR_GET_CURRENT_FLEET()
      : [];
    const fleetIds = Array.isArray(fleet)
      ? fleet.map((row: any) => String(row?.id || '').trim()).filter(Boolean).sort()
      : [];
    const renderedIds = Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
      .map((button) => String(button.getAttribute('data-select-car-offer-id') || '').trim())
      .filter(Boolean);
    const buttonIds = [...renderedIds].sort();
    const locationOk = document.body?.dataset?.carLocation === expectedOffer;
    const idsMatch = fleetIds.length > 0
      && buttonIds.length === fleetIds.length
      && buttonIds.every((id, index) => id === fleetIds[index]);
    return locationOk && idsMatch ? { fleetIds, buttonIds, renderedIds } : false;
  }, offer, { timeout: 15000 });

  const snapshot = await handle.jsonValue() as { fleetIds: string[]; buttonIds: string[]; renderedIds: string[] };
  await expect(page.locator('#carRentalGrid [data-select-car]').first()).toBeVisible();
  return snapshot;
}

async function getRenderedOfferIds(page: Page) {
  return page.locator('#carRentalGrid [data-select-car-offer-id]').evaluateAll((buttons) => (
    buttons.map((button) => String(button.getAttribute('data-select-car-offer-id') || '').trim())
  ));
}

async function expectRenderedOrder(page: Page, expectedIds: string[]) {
  await page.waitForFunction((expected) => {
    const renderedIds = Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
      .map((button) => String(button.getAttribute('data-select-car-offer-id') || '').trim());
    return renderedIds.length === expected.length
      && renderedIds.every((id, index) => id === expected[index]);
  }, expectedIds, { timeout: 15000 });
}

async function expectRenderedCardsSortedByQuote(page: Page, expectedIds: string[]) {
  await expectRenderedOrder(page, expectedIds);
  const snapshot = await page.evaluate(() => {
    const offer = document.body?.dataset?.carLocation === 'paphos' ? 'paphos' : 'larnaca';
    const quote = (window as any).CE_CAR_COMPUTE_QUOTE;
    const readValue = (id: string) => String((document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value || '').trim();
    const fullInsurance = !!(document.getElementById('fullInsurance') as HTMLInputElement | null)?.checked;
    const youngDriver = !!(document.getElementById('youngDriver') as HTMLInputElement | null)?.checked;

    return Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]')).map((button) => {
      const offerId = String(button.getAttribute('data-select-car-offer-id') || '').trim();
      const carModel = String(button.getAttribute('data-select-car') || '').trim();
      const card = button.closest('.auto-card');
      const priceText = String(card?.querySelector('.auto-card-price')?.textContent || '').trim();
      const result = typeof quote === 'function'
        ? quote({
          offer,
          offerId,
          carModel,
          pickupDateStr: readValue('pickupDate'),
          returnDateStr: readValue('returnDate'),
          pickupTimeStr: readValue('pickupTime') || '10:00',
          returnTimeStr: readValue('returnTime') || '10:00',
          pickupLocation: readValue('pickupLocation'),
          returnLocation: readValue('returnLocation'),
          fullInsurance,
          youngDriver,
        })
        : null;
      return {
        offerId,
        total: Number(result?.total),
        priceText,
      };
    });
  });

  expect(snapshot.map((entry) => entry.offerId)).toEqual(expectedIds);
  for (const entry of snapshot) {
    expect(Number.isFinite(entry.total)).toBe(true);
    expect(entry.total).toBeGreaterThan(0);
    expect(entry.priceText).not.toMatch(/\b(?:NaN|undefined|null)\b/i);
  }
  for (let i = 1; i < snapshot.length; i += 1) {
    expect(snapshot[i].total).toBeGreaterThanOrEqual(snapshot[i - 1].total);
  }
  return snapshot;
}

async function expectFirstCarOpensModal(page: Page) {
  await page.locator('#carRentalGrid [data-select-car]').first().click();
  await expect(page.locator('#carHomeModal')).toBeVisible();
  await expect(page.locator('#carHomeModal')).toHaveCSS('display', 'flex');
  await expect(page.locator('#localReservationForm')).toBeVisible();
  await expect(page.locator('#res_pickup_place_type')).toBeVisible();
  await expect(page.locator('#res_return_place_type')).toBeVisible();
  await expect(page.locator('#res_phone_country_code')).toHaveAttribute('type', 'hidden');
  await expect(page.locator('#res_phone_country_button')).toBeVisible();
  await expect(page.locator('#res_phone_local')).toBeVisible();
  await expect(page.locator('#res_pickup_location')).toHaveAttribute('type', 'hidden');
  await expect(page.locator('#res_return_location')).toHaveAttribute('type', 'hidden');
}

async function openPhoneCountryPicker(page: Page) {
  await page.locator('#res_phone_country_button').click();
  await expect(page.locator('#res_phone_country_panel')).toBeVisible();
}

async function selectPhoneCountry(page: Page, query: string, optionText: RegExp | string, expectedButtonText?: RegExp | string) {
  await openPhoneCountryPicker(page);
  await page.locator('#res_phone_country_search').fill(query);
  const option = page.locator('#res_phone_country_results [data-phone-country-option]', { hasText: optionText }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('#res_phone_country_button_text')).toContainText(expectedButtonText || optionText);
}

test.describe('car booking modal regression', () => {
  test('car finder dropdown uses city-only values without prices or place types', async ({ page }) => {
    await openCarPage(page, 'pl');

    const snapshot = await page.locator('#pickupLocation option').evaluateAll((options) => options.map((option) => ({
      value: option.getAttribute('value') || '',
      label: option.textContent?.trim() || '',
    })));

    expect(snapshot.map((option) => option.value).filter(Boolean)).toEqual([
      'larnaca',
      'nicosia',
      'ayia-napa',
      'protaras',
      'limassol',
      'paphos',
    ]);
    expect(snapshot.map((option) => option.value)).not.toEqual(expect.arrayContaining([
      'airport_pfo',
      'city_center',
      'hotel',
      'other',
    ]));
    expect(snapshot.map((option) => option.label).join(' ')).not.toMatch(/\+|€|Lotnisko|Hotel|Adres|Inne/i);
  });

  test('car.html?lang=pl keeps default order without complete dates', async ({ page }) => {
    const errors = await openCarPage(page, 'pl');
    await page.waitForFunction(() => (
      document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]').length === 3
    ), null, { timeout: 15000 });

    await expect(page.locator('#carRentalGrid [data-select-car]')).toHaveCount(3);
    await expect(page.locator('#carRentalGrid [data-select-car]').first()).toHaveAttribute('data-select-car-offer-id', 'lca-he-ready');
    expect(await getRenderedOfferIds(page)).toEqual(['lca-he-ready', 'lca-not-he-ready', 'lca-he-ready-budget']);

    const cardState = await page.evaluate(() => Array.from(document.querySelectorAll('#carRentalGrid .auto-card')).map((card) => {
      const selectEl = card.matches('[data-select-car]') ? card : card.querySelector('[data-select-car]');
      const offerEl = card.matches('[data-select-car-offer-id]') ? card : card.querySelector('[data-select-car-offer-id]');
      return {
        price: String(card.querySelector('.auto-card-price')?.textContent || ''),
        buttonText: String(selectEl?.textContent || '').trim(),
        offerId: String(offerEl?.getAttribute('data-select-car-offer-id') || '').trim(),
        isFleetCard: card.classList.contains('auto-card--fleet'),
        badge: String(card.querySelector('.auto-card-badge')?.textContent || '').trim(),
        hasBottomBody: !!card.querySelector('.auto-card-body'),
        hasBottomSpecs: !!card.querySelector('.auto-card-specs'),
        hasBottomNote: !!card.querySelector('.auto-card-note'),
      };
    }));
    expect(cardState.every((card) => (
      card.buttonText
      && card.offerId
      && card.isFleetCard
      && card.badge
      && !card.hasBottomBody
      && !card.hasBottomSpecs
      && !card.hasBottomNote
    ))).toBe(true);
    expect(cardState.map((card) => card.price).join(' ')).not.toMatch(/\b(?:NaN|undefined|null)\b/i);
    expect(errors.join('\n')).not.toMatch(/isEn|ReferenceError/i);
  });

  test('car.html image click selects car without opening image preview', async ({ page }) => {
    await openCarPage(page, 'pl');
    await configureFinderCities(page, 'larnaca', 'larnaca', false);
    await page.waitForFunction(() => (
      document.querySelectorAll('#carRentalGrid .auto-card--fleet .auto-card-image').length > 0
    ), null, { timeout: 15000 });

    const firstCar = page.locator('#carRentalGrid [data-select-car]').first();
    const selectedName = await firstCar.getAttribute('data-select-car');
    await firstCar.locator('.auto-card-image').click();

    await expect(page.locator('#carImageModal')).toBeHidden();
    await expect(page.locator('#carHomeModal')).toBeVisible();
    await expect(page.locator('#res_car')).toHaveValue(selectedName || '');
  });

  test('car.html replaces selected-car panel with selectable cards instruction', async ({ page }) => {
    await openCarPage(page, 'pl');
    await configureFinderCities(page, 'larnaca', 'larnaca', false);
    await page.waitForFunction(() => (
      document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]').length === 3
    ), null, { timeout: 15000 });

    const instruction = page.locator('#selectedCarHighlight');
    await expect(instruction).toBeVisible();
    await expect(instruction).toContainText('Kliknij wybrane auto, aby przejść do rezerwacji.');
    await expect(instruction).not.toContainText('Wybrane auto');
    await expect(page.locator('#selectedCarHighlight .selected-car-highlight__media')).toHaveCount(0);
    await expect(page.locator('#selectedCarHighlight .selected-car-highlight__label')).toHaveCount(0);

    const firstCar = page.locator('#carRentalGrid [data-select-car]').first();
    const selectedName = await firstCar.getAttribute('data-select-car');
    await expect(firstCar).toHaveClass(/auto-card--fleet/);
    await firstCar.click();
    await expect(page.locator('#carHomeModal')).toBeVisible();
    await expect(page.locator('#res_car')).toHaveValue(selectedName || '');
  });

  test('car.html Hebrew instruction is localized and mobile cards do not overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCarPage(page, 'he');
    await configureFinderCities(page, 'larnaca', 'larnaca', false);
    await page.waitForFunction(() => (
      document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]').length > 0
    ), null, { timeout: 15000 });

    await expect(page.locator('#selectedCarHighlight')).toContainText('לחצו על הרכב שבחרתם כדי להמשיך להזמנה.');
    const snapshot = await page.evaluate(() => ({
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        && document.body.scrollWidth <= document.body.clientWidth + 1,
      pageText: String(document.body.textContent || ''),
      cardCount: document.querySelectorAll('#carRentalGrid .auto-card--fleet[data-select-car]').length,
    }));
    expect(snapshot.noHorizontalOverflow).toBe(true);
    expect(snapshot.cardCount).toBeGreaterThan(0);
    expect(snapshot.pageText).not.toMatch(/\b(?:undefined|null)\b/i);
  });

  test('car.html?lang=pl sorts Larnaka cards by quote and opens #carHomeModal', async ({ page }) => {
    const errors = await openCarPage(page, 'pl');
    await configureFinderRoute(page, 'larnaca');
    await expectGridMatchesCurrentFleet(page, 'larnaca');
    await expectRenderedCardsSortedByQuote(page, ['lca-he-ready-budget', 'lca-not-he-ready', 'lca-he-ready']);
    await expectFirstCarOpensModal(page);

    expect(errors.join('\n')).not.toContain('isEn');
  });

  test('car.html fleet resolver follows Paphos and young-driver routing rules', async ({ page }) => {
    await openCarPage(page, 'pl');

    await configureFinderCities(page, 'paphos', 'paphos', false);
    await expectGridMatchesCurrentFleet(page, 'paphos');
    expect(await getRenderedOfferIds(page)).toEqual(['pfo-he-ready-budget', 'pfo-not-he-ready', 'pfo-he-ready']);

    await configureFinderCities(page, 'paphos', 'paphos', true);
    await page.waitForFunction(() => (
      Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
        .every((button) => String(button.getAttribute('data-select-car-offer-id') || '').startsWith('lca-'))
    ), null, { timeout: 15000 });
    expect(await getRenderedOfferIds(page)).toEqual(['lca-he-ready']);

    await configureFinderCities(page, 'paphos', 'larnaca', false);
    await expectGridMatchesCurrentFleet(page, 'larnaca');
    expect(await getRenderedOfferIds(page)).not.toContain('pfo-he-ready');

    await configureFinderCities(page, 'larnaca', 'paphos', false);
    await expectGridMatchesCurrentFleet(page, 'larnaca');
    expect(await getRenderedOfferIds(page)).not.toContain('pfo-he-ready');
  });

  test('booking modal place type options depend on selected city', async ({ page }) => {
    await openCarPage(page, 'pl');

    await configureFinderCities(page, 'larnaca', 'paphos', false);
    await expectFirstCarOpensModal(page);
    await expect(page.locator('#res_pickup_city_label')).toContainText('Larnaka');
    await expect(page.locator('#res_return_city_label')).toContainText('Paphos');
    await expect(page.locator('#res_pickup_place_type option')).toHaveText(['Lotnisko', 'Hotel', 'Adres']);
    await expect(page.locator('#res_return_place_type option')).toHaveText(['Lotnisko', 'Hotel', 'Adres']);
    await page.locator('#res_pickup_place_type').selectOption('airport');
    await expect(page.locator('#pickupFlightField')).toBeVisible();
    await expect(page.locator('#returnFlightField')).toBeHidden();
    await page.locator('#res_pickup_place_type').selectOption('hotel');
    await expect(page.locator('#pickupAddressField')).toBeVisible();
    await expect(page.locator('#pickupFlightField')).toBeHidden();
    await page.locator('#res_pickup_place_type').selectOption('address');
    await expect(page.locator('#pickupAddressField')).toBeVisible();
    await expect(page.locator('#pickupFlightField')).toBeHidden();
    await page.locator('#res_return_place_type').selectOption('airport');
    await expect(page.locator('#returnFlightField')).toBeVisible();

    await page.locator('#carHomeModal .modal-close').click();
    await configureFinderCities(page, 'nicosia', 'limassol', false);
    await expectFirstCarOpensModal(page);
    await expect(page.locator('#res_pickup_city_label')).toContainText('Nikozja');
    await expect(page.locator('#res_return_city_label')).toContainText('Limassol');
    await expect(page.locator('#res_pickup_place_type option')).toHaveText(['Hotel', 'Adres']);
    await expect(page.locator('#res_return_place_type option')).toHaveText(['Hotel', 'Adres']);
    await expect(page.locator('#pickupFlightField')).toBeHidden();
    await expect(page.locator('#returnFlightField')).toBeHidden();
  });

  test('booking modal requires airport flight numbers and submits full phone number', async ({ page }) => {
    await openCarPage(page, 'pl');
    await configureFinderCities(page, 'larnaca', 'paphos', false);
    await expectFirstCarOpensModal(page);

    await openPhoneCountryPicker(page);
    await expect(page.locator('#res_phone_country_search')).toBeVisible();
    await expect(page.locator('#res_phone_country_results')).toBeVisible();
    expect(await page.locator('#res_phone_country_results [data-phone-country-option]').count()).toBeGreaterThan(4);
    await page.keyboard.press('Escape');

    await selectPhoneCountry(page, 'Poland', '+48');
    await expect(page.locator('#res_phone_country_code')).toHaveValue('+48');
    await selectPhoneCountry(page, 'Cyprus', '+357');
    await expect(page.locator('#res_phone_country_code')).toHaveValue('+357');
    await selectPhoneCountry(page, '+44', /United Kingdom/, '+44');
    await expect(page.locator('#res_phone_country_code')).toHaveValue('+44');
    await selectPhoneCountry(page, 'Germany', '+49');
    await expect(page.locator('#res_phone_country_code')).toHaveValue('+49');
    await selectPhoneCountry(page, 'PL', '+48');
    await expect(page.locator('#res_phone_country_code')).toHaveValue('+48');

    const phoneRowSnapshot = await page.evaluate(() => {
      const row = document.querySelector('.auto-phone-row');
      const button = document.getElementById('res_phone_country_button');
      const local = document.getElementById('res_phone_local');
      const rowRect = row?.getBoundingClientRect();
      const buttonRect = button?.getBoundingClientRect();
      const localRect = local?.getBoundingClientRect();
      return {
        containsButton: !!row && !!button && row.contains(button),
        containsLocal: !!row && !!local && row.contains(local),
        sameLine: !!buttonRect && !!localRect && Math.abs(buttonRect.top - localRect.top) < 3,
        rowWidth: rowRect?.width || 0,
        buttonRight: buttonRect?.right || 0,
        localRight: localRect?.right || 0,
      };
    });
    expect(phoneRowSnapshot.containsButton).toBe(true);
    expect(phoneRowSnapshot.containsLocal).toBe(true);
    expect(phoneRowSnapshot.sameLine).toBe(true);

    await page.locator('#res_full_name').fill('Jan Testowy');
    await page.locator('#res_email').fill('jan.testowy@example.com');
    await page.evaluate(() => {
      const input = document.getElementById('res_phone_country_code') as HTMLInputElement | null;
      if (input) input.value = '';
    });
    await page.locator('#res_phone_local').fill('');
    await page.locator('#btnSubmitReservation').click();
    await expect(page.locator('#res_phone_country_button.input-error')).toBeVisible();
    await expect(page.locator('#res_phone_local.input-error')).toBeVisible();

    await selectPhoneCountry(page, 'Poland', '+48');
    await page.locator('#res_phone_local').fill('+48 123 456 789');
    await page.locator('#res_pickup_place_type').selectOption('airport');
    await page.locator('#res_return_place_type').selectOption('airport');

    await page.locator('#btnSubmitReservation').click();
    await expect(page.locator('#pickupFlightField .field-error')).toBeVisible();
    await expect(page.locator('#returnFlightField .field-error')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__supabaseStub?.getTableRows?.('car_bookings')?.length || 0
    ))).toBe(0);

    await page.locator('#res_pickup_flight').fill('W1234');
    await page.locator('#res_return_flight').fill('W5678');
    await page.locator('#btnSubmitReservation').click();
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__supabaseStub?.getTableRows?.('car_bookings')?.length || 0
    )), { timeout: 15000 }).toBe(1);

    const inserted = await page.evaluate(() => (
      (window as any).__supabaseStub?.getTableRows?.('car_bookings')?.[0] || null
    ));
    expect(inserted).toMatchObject({
      phone: '+48 123 456 789',
      flight_number: 'Pickup: W1234 | Return: W5678',
    });
  });

  test('phone country selector stays compact on mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await openCarPage(page, 'en');
    await configureFinderCities(page, 'larnaca', 'paphos', false);
    await expectFirstCarOpensModal(page);

    const layout = await page.evaluate(() => {
      const row = document.querySelector('.auto-phone-row');
      const button = document.getElementById('res_phone_country_button');
      const local = document.getElementById('res_phone_local');
      const rowRect = row?.getBoundingClientRect();
      const buttonRect = button?.getBoundingClientRect();
      const localRect = local?.getBoundingClientRect();
      return {
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
          && document.body.scrollWidth <= document.body.clientWidth + 1,
        sameLine: !!buttonRect && !!localRect && Math.abs(buttonRect.top - localRect.top) < 3,
        rowWithinViewport: !!rowRect && rowRect.left >= -1 && rowRect.right <= window.innerWidth + 1,
      };
    });

    expect(layout.noHorizontalOverflow).toBe(true);
    expect(layout.sameLine).toBe(true);
    expect(layout.rowWithinViewport).toBe(true);

    await openPhoneCountryPicker(page);
    await page.locator('#res_phone_country_search').fill('+49');
    await expect(page.locator('#res_phone_country_results [data-phone-country-option]', { hasText: 'Germany' })).toBeVisible();
  });

  test('index.html car finder uses the same fleet rules', async ({ page }) => {
    await openHomePage(page, 'pl');

    await configureHomeFinderCities(page, 'paphos', 'paphos', false);
    await expect(page.locator('#carsHomeGrid .ce-home-card-title').first()).toContainText(/Pafos|Paphos/);

    await configureHomeFinderCities(page, 'paphos', 'paphos', true);
    await page.waitForFunction(() => {
      const titles = Array.from(document.querySelectorAll('#carsHomeGrid .ce-home-card-title'))
        .map((node) => String(node.textContent || ''));
      return titles.length > 0 && titles.every((title) => /Larnaka|Larnaca/.test(title));
    }, null, { timeout: 15000 });

    await configureHomeFinderCities(page, 'paphos', 'larnaca', false);
    await page.waitForFunction(() => {
      const titles = Array.from(document.querySelectorAll('#carsHomeGrid .ce-home-card-title'))
        .map((node) => String(node.textContent || ''));
      return titles.length > 0 && titles.every((title) => /Larnaka|Larnaca/.test(title));
    }, null, { timeout: 15000 });

    await configureHomeFinderCities(page, 'larnaca', 'paphos', false);
    await page.waitForFunction(() => {
      const titles = Array.from(document.querySelectorAll('#carsHomeGrid .ce-home-card-title'))
        .map((node) => String(node.textContent || ''));
      return titles.length > 0 && titles.every((title) => /Larnaka|Larnaca/.test(title));
    }, null, { timeout: 15000 });
  });

  test('index.html car finder hides empty results until route and dates are complete', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openHomePage(page, 'pl');

    await expect(page.locator('#carsHomeGrid')).toBeHidden();
    await expect(page.locator('#carsHomeTabsRow')).toBeHidden();
    await expect(page.locator('#carsHomeCarouselNav')).toBeHidden();
    await expect(page.getByText('Uzupełnij trasę')).toHaveCount(0);

    const desktopLayout = await page.evaluate(() => {
      const finder = document.getElementById('carsHomeFinder');
      const grid = document.getElementById('carsHomeGrid');
      const cta = document.querySelector('.cars-home-panel a[data-i18n="home.cars.cta"]');
      const finderRect = finder?.getBoundingClientRect();
      const gridRect = grid?.getBoundingClientRect();
      const ctaRect = cta?.getBoundingClientRect();
      return {
        gridHidden: !!grid?.hidden,
        gridHeight: gridRect?.height || 0,
        finderToCtaGap: finderRect && ctaRect ? ctaRect.top - finderRect.bottom : 999,
      };
    });
    expect(desktopLayout.gridHidden).toBe(true);
    expect(desktopLayout.gridHeight).toBe(0);
    expect(desktopLayout.finderToCtaGap).toBeLessThan(80);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await page.evaluate(() => ({
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        && document.body.scrollWidth <= document.body.clientWidth + 1,
      gridHidden: !!document.getElementById('carsHomeGrid')?.hidden,
    }));
    expect(mobileLayout.noHorizontalOverflow).toBe(true);
    expect(mobileLayout.gridHidden).toBe(true);

    await page.setViewportSize({ width: 1280, height: 900 });
    await configureHomeFinderCities(page, 'paphos', 'paphos', false);
    await expect(page.locator('#carsHomeGrid')).toBeVisible();
    await expect(page.locator('#carsHomeTabsRow')).toBeVisible();
    await expect(page.locator('#carsHomeGrid .ce-home-card-title').first()).toContainText(/Pafos|Paphos/);
    await expect(page.locator('#carsHomeGrid')).not.toContainText('NaN');

    await page.locator('#carsFinderReset').click();
    await expect(page.locator('#carsHomeGrid')).toBeHidden();
    await expect(page.locator('#carsHomeTabsRow')).toBeHidden();
    await expect(page.locator('#carsHomeCarouselNav')).toBeHidden();
    await expect(page.getByText('Uzupełnij trasę')).toHaveCount(0);
  });

  test('car.html?lang=en sorts Larnaka cards by quote and opens #carHomeModal', async ({ page }) => {
    const errors = await openCarPage(page, 'en');
    await configureFinderRoute(page, 'larnaca');
    await expectGridMatchesCurrentFleet(page, 'larnaca');
    await expectRenderedCardsSortedByQuote(page, ['lca-he-ready-budget', 'lca-not-he-ready', 'lca-he-ready']);
    await expectFirstCarOpensModal(page);

    expect(errors.join('\n')).not.toContain('isEn');
  });

  for (const language of ['pl', 'en'] as const) {
    test(`car.html?lang=${language} switches to Pafos cards and opens #carHomeModal`, async ({ page }) => {
      const errors = await openCarPage(page, language);

      await configureFinderRoute(page, 'larnaca');
      const larnacaSnapshot = await expectGridMatchesCurrentFleet(page, 'larnaca');

      await configureFinderRoute(page, 'paphos');
      const paphosSnapshot = await expectGridMatchesCurrentFleet(page, 'paphos');

      expect(paphosSnapshot.buttonIds).not.toEqual(larnacaSnapshot.buttonIds);
      expect(paphosSnapshot.buttonIds).toEqual(['pfo-he-ready', 'pfo-he-ready-budget', 'pfo-not-he-ready']);
      expect(paphosSnapshot.buttonIds).not.toContain('lca-he-ready');
      expect(paphosSnapshot.buttonIds).not.toContain('lca-not-he-ready');
      await expectRenderedCardsSortedByQuote(page, ['pfo-he-ready-budget', 'pfo-not-he-ready', 'pfo-he-ready']);

      await expectFirstCarOpensModal(page);
      expect(errors.join('\n')).not.toContain('isEn');
    });
  }

  test('mobile car.html?lang=pl sorts Pafos cards by quote and opens #carHomeModal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await openCarPage(page, 'pl');
    await configureFinderRoute(page, 'paphos');
    await expectGridMatchesCurrentFleet(page, 'paphos');
    await expectRenderedCardsSortedByQuote(page, ['pfo-he-ready-budget', 'pfo-not-he-ready', 'pfo-he-ready']);
    await expectFirstCarOpensModal(page);

    expect(errors.join('\n')).not.toContain('isEn');
  });

  test('car.html?lang=he keeps record-gated HE-ready cars bookable', async ({ page }) => {
    const errors = await openCarPage(page, 'he');
    await configureFinderRoute(page, 'larnaca');
    const snapshot = await expectGridMatchesCurrentFleet(page, 'larnaca');

    expect(snapshot.buttonIds).toEqual(['lca-he-ready', 'lca-he-ready-budget']);
    expect(snapshot.buttonIds).not.toContain('lca-not-he-ready');
    await expectRenderedCardsSortedByQuote(page, ['lca-he-ready-budget', 'lca-he-ready']);

    await expectFirstCarOpensModal(page);
    expect(errors.join('\n')).not.toContain('isEn');
  });

  test('car.html?lang=he keeps Pafos HE-ready cars sorted and bookable', async ({ page }) => {
    const errors = await openCarPage(page, 'he');
    await configureFinderRoute(page, 'paphos');
    const snapshot = await expectGridMatchesCurrentFleet(page, 'paphos');

    expect(snapshot.buttonIds).toEqual(['pfo-he-ready', 'pfo-he-ready-budget']);
    expect(snapshot.buttonIds).not.toContain('pfo-not-he-ready');
    await expectRenderedCardsSortedByQuote(page, ['pfo-he-ready-budget', 'pfo-he-ready']);

    await expectFirstCarOpensModal(page);
    expect(errors.join('\n')).not.toContain('isEn');
  });

  test('shop.html?lang=he remains excluded from HE checkout/payment UI', async ({ page }) => {
    await page.goto('/shop.html?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');

    const directions = await page.evaluate(() => {
      (window as any).shopOpenCart?.();
      const styleDirection = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? window.getComputedStyle(element).direction : '';
      };
      return {
        html: document.documentElement.dir,
        body: window.getComputedStyle(document.body).direction,
        cart: styleDirection('#cartSidebar'),
        checkout: styleDirection('#checkoutModal'),
        checkoutHidden: document.getElementById('checkoutModal')?.hidden ?? null,
      };
    });

    expect(directions.html).toBe('ltr');
    expect(directions.body).toBe('ltr');
    expect(directions.cart).toBe('ltr');
    expect(directions.checkout).toBe('ltr');
    expect(directions.checkoutHidden).toBe(true);
  });
});
