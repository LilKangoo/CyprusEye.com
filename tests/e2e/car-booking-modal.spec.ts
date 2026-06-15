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
  }, CAR_OFFERS);
}

async function openCarPage(page: Page, language: 'pl' | 'en' | 'he') {
  await seedCarOffers(page);
  const errors = collectPageErrors(page);
  await page.goto(`/car.html?lang=${language}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function', null, { timeout: 15000 });
  await page.waitForFunction(() => (
    Boolean(document.querySelector('#pickupLocation option[value="larnaca"]'))
    && Boolean(document.querySelector('#pickupLocation option[value="hotel"]'))
  ), null, { timeout: 15000 });
  return errors;
}

async function configureFinderRoute(page: Page, offer: 'larnaca' | 'paphos') {
  await page.locator('#pickupDate').fill('2026-07-10');
  await page.locator('#pickupTime').fill('10:00');
  await page.locator('#returnDate').fill('2026-07-14');
  await page.locator('#returnTime').fill('10:00');
  await page.locator('#rentalPassengers').fill('2');

  const location = offer === 'paphos' ? 'hotel' : 'larnaca';
  await page.locator('#pickupLocation').selectOption(location);
  await page.locator('#returnLocation').selectOption(location);

  await page.waitForFunction((expectedOffer) => (
    document.body?.dataset?.carLocation === expectedOffer
  ), offer, { timeout: 15000 });
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
}

test.describe('car booking modal regression', () => {
  test('car.html?lang=pl keeps default order without complete dates', async ({ page }) => {
    const errors = await openCarPage(page, 'pl');
    await page.waitForFunction(() => (
      document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]').length === 3
    ), null, { timeout: 15000 });

    await expect(page.locator('#carRentalGrid [data-select-car]')).toHaveCount(3);
    await expect(page.locator('#carRentalGrid [data-select-car]').first()).toHaveAttribute('data-select-car-offer-id', 'lca-he-ready');
    expect(await getRenderedOfferIds(page)).toEqual(['lca-he-ready', 'lca-not-he-ready', 'lca-he-ready-budget']);

    const cardState = await page.evaluate(() => Array.from(document.querySelectorAll('#carRentalGrid .auto-card')).map((card) => ({
      price: String(card.querySelector('.auto-card-price')?.textContent || ''),
      buttonText: String(card.querySelector('[data-select-car]')?.textContent || '').trim(),
      offerId: String(card.querySelector('[data-select-car-offer-id]')?.getAttribute('data-select-car-offer-id') || '').trim(),
    })));
    expect(cardState.every((card) => card.buttonText && card.offerId)).toBe(true);
    expect(cardState.map((card) => card.price).join(' ')).not.toMatch(/\b(?:NaN|undefined|null)\b/i);
    expect(errors.join('\n')).not.toMatch(/isEn|ReferenceError/i);
  });

  test('car.html?lang=pl sorts Larnaka cards by quote and opens #carHomeModal', async ({ page }) => {
    const errors = await openCarPage(page, 'pl');
    await configureFinderRoute(page, 'larnaca');
    await expectGridMatchesCurrentFleet(page, 'larnaca');
    await expectRenderedCardsSortedByQuote(page, ['lca-he-ready-budget', 'lca-not-he-ready', 'lca-he-ready']);
    await expectFirstCarOpensModal(page);

    expect(errors.join('\n')).not.toContain('isEn');
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
