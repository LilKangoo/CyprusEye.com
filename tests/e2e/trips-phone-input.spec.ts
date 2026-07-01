import { test, expect } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const TRIP_ROW = {
  id: 'trip-phone-1',
  slug: 'phone-test-trip',
  title: {
    pl: 'Testowa wycieczka telefon',
    en: 'Phone Test Trip',
    he: 'טיול בדיקת טלפון',
  },
  description: {
    pl: 'Opis testowej wycieczki.',
    en: 'Test trip description.',
    he: 'תיאור טיול בדיקה.',
  },
  cover_image_url: '/assets/cyprus_logo-128.png',
  photos: [],
  pricing_model: 'per_person',
  price_per_person: 50,
  price_base: 50,
  start_city: 'Larnaca',
  is_published: true,
  is_bestseller: false,
  sort_order: 1,
  public_ready: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

async function prepareTripsStub(page: any) {
  await page.addInitScript((seed) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        stub.seedTable('trips', [seed.trip]);
        stub.seedTable('trip_bookings', []);
      },
    };
  }, { trip: TRIP_ROW });
  await enableSupabaseStub(page);
}

async function openTripsList(page: any, lang = 'en') {
  await prepareTripsStub(page);
  await page.goto(`/trips.html?lang=${lang}`);
  await waitForSupabaseStub(page);
  await expect(page.locator('.city-card')).toHaveCount(1, { timeout: 10000 });
  await page.locator('.city-card').first().click();
  await expect(page.locator('#bookingPhoneCountryButton')).toBeVisible();
}

async function openTripDetail(page: any, lang = 'en') {
  await prepareTripsStub(page);
  await page.goto(`/trip.html?slug=${TRIP_ROW.slug}&lang=${lang}`);
  await waitForSupabaseStub(page);
  await expect(page.locator('#viewTrip')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#bookingPhoneCountryButton')).toBeVisible();
}

async function openHomeTrips(page: any, lang = 'en') {
  await prepareTripsStub(page);
  await page.goto(`/index.html?lang=${lang}`);
  await waitForSupabaseStub(page);
  await page.locator('#tripsHomeGrid').scrollIntoViewIfNeeded();
  await expect(page.locator('#tripsHomeGrid .trip-home-card, #tripsHomeGrid .city-card').first()).toBeVisible({ timeout: 15000 });
  await page.locator('#tripsHomeGrid .trip-home-card, #tripsHomeGrid .city-card').first().click();
  await expect(page.locator('#bookingPhoneCountryButton')).toBeVisible({ timeout: 10000 });
}

async function searchAndSelectCountry(page: any, query: string, expectedText: string) {
  await page.locator('#bookingPhoneCountryButton').click();
  await page.locator('#bookingPhoneCountrySearch').fill(query);
  const option = page.locator('#bookingPhoneCountryResults [data-phone-country-option]', {
    hasText: expectedText,
  }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('#bookingPhoneCountryButton')).toContainText(/\+\d+/);
}

async function completeTripsBookingForm(page: any) {
  await page.fill('#bookingName', 'Trip Guest');
  await page.fill('#bookingEmail', 'trip.guest@example.com');
  await searchAndSelectCountry(page, 'Poland', '+48');
  await page.fill('#bookingPhoneLocal', '+48 123456789');
  await page.fill('#arrivalDate', '2026-08-10');
  await page.fill('#departureDate', '2026-08-17');
}

test.describe('Trips booking phone country selector', () => {
  test('renders searchable selector on trips listing modal', async ({ page }) => {
    await openTripsList(page, 'en');

    const row = page.locator('.trip-phone-field .ce-phone-input');
    await expect(row).toBeVisible();
    await page.locator('#bookingPhoneCountryButton').click();
    const countryOptionCount = await page.locator('#bookingPhoneCountryResults [data-phone-country-option]').count();
    expect(countryOptionCount).toBeGreaterThan(4);
    await page.locator('#bookingPhoneCountrySearch').fill('Cyprus');
    await expect(page.locator('#bookingPhoneCountryResults [data-phone-country-option]', { hasText: '+357' }).first()).toBeVisible();
    await page.locator('#bookingPhoneCountrySearch').fill('+44');
    await expect(page.locator('#bookingPhoneCountryResults [data-phone-country-option]', { hasText: 'United Kingdom' }).first()).toBeVisible();
    await page.locator('#bookingPhoneCountrySearch').fill('Germany');
    await expect(page.locator('#bookingPhoneCountryResults [data-phone-country-option]', { hasText: '+49' }).first()).toBeVisible();
  });

  test('renders selector on trip detail page', async ({ page }) => {
    await openTripDetail(page, 'en');

    await expect(page.locator('#bookingPhoneCountryButton')).toContainText('+357');
    await searchAndSelectCountry(page, 'PL', '+48');
  });

  test('renders selector on home trips modal without affecting other sections', async ({ page }) => {
    await openHomeTrips(page, 'en');

    await expect(page.locator('#bookingPhoneCountryButton')).toBeVisible();
    await searchAndSelectCountry(page, 'Cyprus', '+357');
  });

  test('submits full customer_phone while keeping phone optional when blank', async ({ page }) => {
    await openTripsList(page, 'en');
    await completeTripsBookingForm(page);

    await page.locator('#bookingForm button[type="submit"]').click();
    await expect(page.locator('#bookingMessage')).toBeVisible();

    const inserted = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('trip_bookings'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0].customer_phone).toBe('+48 123456789');
  });

  test('keeps compact phone row inside mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await openTripsList(page, 'en');

    const fitsViewport = await page.locator('.trip-phone-field .ce-phone-input').evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= -1 && box.right <= window.innerWidth + 1;
    });
    expect(fitsViewport).toBe(true);
  });

  test('supports Hebrew RTL copy on trips page', async ({ page }) => {
    await openTripsList(page, 'he');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#bookingPhoneCountryButton')).toBeVisible();
    await page.locator('#bookingPhoneCountryButton').click();
    await expect(page.locator('#bookingPhoneCountrySearch')).toHaveAttribute('placeholder', /מדינה|קוד/);
  });
});
