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
    const buttonIds = Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
      .map((button) => String(button.getAttribute('data-select-car-offer-id') || '').trim())
      .filter(Boolean)
      .sort();
    const locationOk = document.body?.dataset?.carLocation === expectedOffer;
    const idsMatch = fleetIds.length > 0
      && buttonIds.length === fleetIds.length
      && buttonIds.every((id, index) => id === fleetIds[index]);
    return locationOk && idsMatch ? { fleetIds, buttonIds } : false;
  }, offer, { timeout: 15000 });

  const snapshot = await handle.jsonValue() as { fleetIds: string[]; buttonIds: string[] };
  await expect(page.locator('#carRentalGrid [data-select-car]').first()).toBeVisible();
  return snapshot;
}

async function expectFirstCarOpensModal(page: Page) {
  await page.locator('#carRentalGrid [data-select-car]').first().click();
  await expect(page.locator('#carHomeModal')).toBeVisible();
  await expect(page.locator('#carHomeModal')).toHaveCSS('display', 'flex');
  await expect(page.locator('#localReservationForm')).toBeVisible();
}

test.describe('car booking modal regression', () => {
  test('car.html?lang=pl opens #carHomeModal from Larnaka cards', async ({ page }) => {
    const errors = await openCarPage(page, 'pl');
    await configureFinderRoute(page, 'larnaca');
    await expectGridMatchesCurrentFleet(page, 'larnaca');
    await expectFirstCarOpensModal(page);

    expect(errors.join('\n')).not.toContain('isEn');
  });

  test('car.html?lang=en opens #carHomeModal from Larnaka cards', async ({ page }) => {
    const errors = await openCarPage(page, 'en');
    await configureFinderRoute(page, 'larnaca');
    await expectGridMatchesCurrentFleet(page, 'larnaca');
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
      expect(paphosSnapshot.buttonIds).toEqual(['pfo-he-ready', 'pfo-not-he-ready']);
      expect(paphosSnapshot.buttonIds).not.toContain('lca-he-ready');
      expect(paphosSnapshot.buttonIds).not.toContain('lca-not-he-ready');

      await expectFirstCarOpensModal(page);
      expect(errors.join('\n')).not.toContain('isEn');
    });
  }

  test('car.html?lang=he keeps record-gated HE-ready cars bookable', async ({ page }) => {
    const errors = await openCarPage(page, 'he');
    await configureFinderRoute(page, 'larnaca');
    const snapshot = await expectGridMatchesCurrentFleet(page, 'larnaca');

    expect(snapshot.buttonIds).toEqual(['lca-he-ready']);
    expect(snapshot.buttonIds).not.toContain('lca-not-he-ready');

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
