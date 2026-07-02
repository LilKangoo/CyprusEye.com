import { test, expect } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const HOTEL_ROW = {
  id: 'hotel-phone-1',
  slug: 'phone-test-hotel',
  title: {
    pl: 'Testowy hotel telefon',
    en: 'Phone Test Hotel',
    he: 'מלון בדיקת טלפון',
  },
  description: {
    pl: 'Opis testowego hotelu.',
    en: 'Test hotel description.',
    he: 'תיאור מלון בדיקה.',
  },
  city: 'Larnaca',
  cover_image_url: '/assets/cyprus_logo-128.png',
  photos: [],
  pricing_model: 'per_person_per_night',
  pricing_tiers: {
    rules: [
      { persons: 1, price_per_night: 80, min_nights: 1 },
      { persons: 2, price_per_night: 95, min_nights: 1 },
    ],
  },
  max_persons: 4,
  is_published: true,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

async function prepareHotelsStub(page: any) {
  await page.addInitScript((seed) => {
    window.localStorage.removeItem('ce_cache_home_hotels_v1');
    window.localStorage.removeItem('ce_cache_hotel_amenities_v1');
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        stub.seedTable('hotels', [seed.hotel]);
        stub.seedTable('hotel_amenities', []);
        stub.seedTable('hotel_bookings', []);
      },
    };
  }, { hotel: HOTEL_ROW });
  await enableSupabaseStub(page);
}

async function openHotelsList(page: any, lang = 'en') {
  await prepareHotelsStub(page);
  await page.goto(`/hotels.html?lang=${lang}`);
  await waitForSupabaseStub(page);
  await expect(page.locator('.city-card')).toHaveCount(1, { timeout: 10000 });
  await page.locator('.city-card').first().click();
  await expect(page.locator('#hotelBookingPhoneCountryButton')).toBeVisible();
}

async function openHotelDetail(page: any, lang = 'en') {
  await prepareHotelsStub(page);
  await page.goto(`/hotel.html?slug=${HOTEL_ROW.slug}&lang=${lang}`);
  await waitForSupabaseStub(page);
  await expect(page.locator('#viewHotel')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#hotelBookingPhoneCountryButton')).toBeVisible();
}

async function openHomeHotels(page: any, lang = 'en') {
  await prepareHotelsStub(page);
  await page.goto(`/index.html?lang=${lang}`);
  await waitForSupabaseStub(page);
  await page.locator('#hotelsHomeGrid').scrollIntoViewIfNeeded();
  const card = page.locator('#hotelsHomeGrid .hotel-home-card').first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await expect(page.locator('#hotelBookingPhoneCountryButton')).toBeVisible({ timeout: 10000 });
}

async function searchAndSelectCountry(page: any, query: string, expectedText: string) {
  await page.locator('#hotelBookingPhoneCountryButton').click();
  await page.locator('#hotelBookingPhoneCountrySearch').fill(query);
  const option = page.locator('#hotelBookingPhoneCountryResults [data-phone-country-option]', {
    hasText: expectedText,
  }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('#hotelBookingPhoneCountryButton')).toContainText(/\+\d+/);
}

async function completeHotelsBookingForm(page: any) {
  await page.fill('#hotelBookingForm [name="name"]', 'Hotel Guest');
  await page.fill('#hotelBookingForm [name="email"]', 'hotel.guest@example.com');
  await searchAndSelectCountry(page, 'Poland', '+48');
  await page.fill('#hotelBookingPhoneLocal', '+48 123456789');
  await page.fill('#hotelBookingForm [name="arrival_date"]', '2026-08-10');
  await page.fill('#hotelBookingForm [name="departure_date"]', '2026-08-17');
}

test.describe('Hotel booking phone country selector', () => {
  test('renders searchable selector on hotels listing modal', async ({ page }) => {
    await openHotelsList(page, 'en');

    const row = page.locator('.hotel-phone-field .ce-phone-input');
    await expect(row).toBeVisible();
    await page.locator('#hotelBookingPhoneCountryButton').click();
    const countryOptionCount = await page.locator('#hotelBookingPhoneCountryResults [data-phone-country-option]').count();
    expect(countryOptionCount).toBeGreaterThan(4);
    await page.locator('#hotelBookingPhoneCountrySearch').fill('Cyprus');
    await expect(page.locator('#hotelBookingPhoneCountryResults [data-phone-country-option]', { hasText: '+357' }).first()).toBeVisible();
    await page.locator('#hotelBookingPhoneCountrySearch').fill('+44');
    await expect(page.locator('#hotelBookingPhoneCountryResults [data-phone-country-option]', { hasText: 'United Kingdom' }).first()).toBeVisible();
    await page.locator('#hotelBookingPhoneCountrySearch').fill('Germany');
    await expect(page.locator('#hotelBookingPhoneCountryResults [data-phone-country-option]', { hasText: '+49' }).first()).toBeVisible();
  });

  test('renders selector on hotel detail page', async ({ page }) => {
    await openHotelDetail(page, 'en');

    await expect(page.locator('#hotelBookingPhoneCountryButton')).toContainText('+357');
    await searchAndSelectCountry(page, 'PL', '+48');
  });

  test('renders selector on home hotels modal', async ({ page }) => {
    await openHomeHotels(page, 'en');

    await expect(page.locator('#hotelBookingPhoneCountryButton')).toBeVisible();
    await searchAndSelectCountry(page, 'Cyprus', '+357');
  });

  test('submits full customer_phone while keeping phone optional when blank', async ({ page }) => {
    await openHotelsList(page, 'en');
    await completeHotelsBookingForm(page);

    await page.locator('#hotelBookingForm button[type="submit"]').click();
    await expect(page.locator('#hotelBookingMessage')).toBeVisible();

    const inserted = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('hotel_bookings'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0].customer_phone).toBe('+48 123456789');
  });

  test('keeps compact phone row inside mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await openHotelsList(page, 'en');

    const fitsViewport = await page.locator('.hotel-phone-field .ce-phone-input').evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= -1 && box.right <= window.innerWidth + 1;
    });
    expect(fitsViewport).toBe(true);
  });

  test('supports Hebrew RTL copy on hotels page', async ({ page }) => {
    await openHotelsList(page, 'he');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#hotelBookingPhoneCountryButton')).toBeVisible();
    await page.locator('#hotelBookingPhoneCountryButton').click();
    await expect(page.locator('#hotelBookingPhoneCountrySearch')).toHaveAttribute('placeholder', /מדינה|קוד/);
  });
});
