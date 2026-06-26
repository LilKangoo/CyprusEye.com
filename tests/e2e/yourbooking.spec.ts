import { expect, test } from './fixtures';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FUNCTION_ROUTE = '**/functions/v1/booking-access';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const configSource = fs.readFileSync(path.join(repoRoot, 'js/config.js'), 'utf8');
const SUPABASE_ANON_KEY = /anonKey:\s*'([^']+)'/.exec(configSource)?.[1] || '';

async function routeBookingAccess(
  page: any,
  payload: Record<string, unknown>,
  status = 200,
  onRequest?: (request: any) => void,
) {
  await page.route(FUNCTION_ROUTE, async (route) => {
    onRequest?.(route.request());
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(payload),
      headers: {
        'access-control-allow-origin': '*',
      },
    });
  });
}

const publicPayload = {
  ok: true,
  access_level: 'public_preview',
  is_owner: false,
  booking: {
    reference: 'TR-123',
    type: 'transport',
    type_label: 'Transport',
    status: 'confirmed',
    payment_status: 'paid',
  },
  schedule: {
    date: '2026-07-01',
    time: '10:30',
  },
  location: {
    summary: 'Larnaca Airport -> Limassol Marina',
    pickup: 'Larnaca Airport',
    dropoff: 'Limassol Marina',
  },
  money: {
    paid: 30,
    total: 120,
    remaining: 90,
    currency: 'EUR',
  },
  customer: {
    name: 'Anna',
  },
  actions: {
    contact_url: 'mailto:hello@cypruseye.com',
    login_url: '/auth/?lang=en',
    all_bookings_url: null,
  },
};

test.describe('yourbooking public preview', () => {
  test('shows a safe missing-token state', async ({ page }) => {
    await page.goto('/yourbooking.html?lang=en');
    await expect(page.locator('#errorState')).toBeVisible();
    await expect(page.locator('#errorTitle')).toHaveText('Booking link unavailable');
  });

  test('shows a generic invalid-token state', async ({ page }) => {
    await routeBookingAccess(page, { ok: false, error: 'booking_link_unavailable' }, 404);

    await page.goto('/yourbooking.html?lang=en&token=invalid-token');

    await expect(page.locator('#errorState')).toBeVisible();
    await expect(page.locator('#errorTitle')).toHaveText('Booking link unavailable');
    await expect(page.locator('#errorMessage')).not.toContainText('invalid-token');
  });

  test('renders one booking public preview without sensitive contact fields', async ({ page }) => {
    let authorizationHeader = '';
    let apiKeyHeader = '';
    await routeBookingAccess(page, publicPayload, 200, (request) => {
      authorizationHeader = request.headers().authorization || '';
      apiKeyHeader = request.headers().apikey || '';
    });

    await page.goto('/yourbooking.html?lang=en&token=valid-token');

    await expect(page.locator('#bookingPanel')).toBeVisible();
    await expect(page.locator('#bookingTitle')).toContainText('Transport');
    await expect(page.locator('#detailsGrid')).toContainText('TR-123');
    await expect(page.locator('#detailsGrid')).toContainText('Anna');
    await expect(page.locator('#valuePaid')).toContainText('€30.00');
    await expect(page.locator('#ownerNote')).toBeHidden();
    await expect(page.locator('#detailsGrid')).not.toContainText('anna@example.com');
    await expect(page.locator('#detailsGrid')).not.toContainText('+357 99 000 000');
    expect(authorizationHeader).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
    expect(apiKeyHeader).toBe(SUPABASE_ANON_KEY);
  });

  test('renders Polish copy and booking data', async ({ page }) => {
    await routeBookingAccess(page, publicPayload);

    await page.goto('/yourbooking.html?lang=pl&token=valid-token');

    await expect(page.locator('#bookingTitle')).toContainText('Transport');
    await expect(page.locator('#loginLink')).toHaveText('Zaloguj się, aby zobaczyć więcej');
    await expect(page.locator('#detailsGrid')).toContainText('Typ usługi');
  });

  test('shows owner details and all-bookings link for owner access', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('__supabaseStubState', JSON.stringify({
        currentSession: {
          access_token: 'owner-session-token',
          user: {
            id: 'owner-user',
            email: 'anna@example.com',
            user_metadata: { name: 'Anna Kowalska' },
          },
        },
        users: {},
        profiles: {},
        tables: {},
        storageObjects: {},
        xpEvents: {},
        lastResetRequests: [],
        lastVerificationRequests: [],
      }));
    });

    let authorizationHeader = '';
    await routeBookingAccess(page, {
      ...publicPayload,
      access_level: 'owner',
      is_owner: true,
      customer: {
        name: 'Anna Kowalska',
        email: 'anna@example.com',
        phone: '+357 99 000 000',
      },
      owner_details: {
        notes: 'Please call on arrival.',
        passengers: 2,
      },
      actions: {
        contact_url: 'mailto:hello@cypruseye.com',
        login_url: '/auth/?lang=en',
        all_bookings_url: '/achievements.html?lang=en&section=reservations',
      },
    }, 200, (request) => {
      authorizationHeader = request.headers().authorization || '';
    });

    await page.goto('/yourbooking.html?lang=en&token=owner-token');

    await expect(page.locator('#ownerNote')).toBeVisible();
    await expect(page.locator('#detailsGrid')).toContainText('anna@example.com');
    await expect(page.locator('#detailsGrid')).toContainText('+357 99 000 000');
    await expect(page.locator('#allBookingsLink')).toBeVisible();
    await expect(page.locator('#allBookingsLink')).toHaveAttribute('href', /achievements\.html\?lang=en&section=reservations/);
    expect(authorizationHeader).toBe('Bearer owner-session-token');
  });

  test('renders Hebrew UI in RTL via query param without using /he/ route', async ({ page }) => {
    await routeBookingAccess(page, publicPayload);

    await page.goto('/yourbooking.html?lang=he&token=valid-token');

    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#loginLink')).toHaveText('התחברות לפרטים נוספים');
    await expect(page.locator('#detailsGrid')).toContainText('סוג שירות');
    await expect(page.locator('#detailsGrid')).not.toContainText('undefined');
    await expect(page.locator('#detailsGrid')).not.toContainText('null');
    expect(new URL(page.url()).pathname).toBe('/yourbooking.html');
  });

  test('renders Hebrew safe error state in RTL', async ({ page }) => {
    await page.goto('/yourbooking.html?lang=he');

    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#errorState')).toBeVisible();
    await expect(page.locator('#errorTitle')).toHaveText('קישור ההזמנה אינו זמין');
    await expect(page.locator('#errorMessage')).not.toContainText('undefined');
    await expect(page.locator('#errorMessage')).not.toContainText('null');
  });
});
