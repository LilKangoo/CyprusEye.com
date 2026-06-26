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
  auth_mode: 'login',
  masked_customer_email: 'an***@gmail.com',
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
    await expect(page.locator('#loginLink')).toBeVisible();
    await expect(page.locator('#contactLink')).toHaveAttribute('href', 'mailto:kontakt@wakacjecypr.com');
    await expect(page.locator('#contactLink')).not.toHaveAttribute('href', /hello@cypruseye\.com/);
    await expect(page.locator('#detailsGrid')).not.toContainText('anna@example.com');
    await expect(page.locator('#detailsGrid')).not.toContainText('+357 99 000 000');
    expect(authorizationHeader).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
    expect(apiKeyHeader).toBe(SUPABASE_ANON_KEY);
  });

  test('opens the login modal without redirecting away from the token URL', async ({ page }) => {
    await routeBookingAccess(page, publicPayload);

    await page.goto('/yourbooking.html?lang=en&token=valid-token');
    const urlBeforeLoginClick = page.url();

    await page.locator('#loginLink').click();

    await expect(page.locator('#authModal')).toBeVisible();
    await expect(page.locator('#authTitle')).toHaveText('Log in');
    await expect(page.locator('#authMaskedEmail')).toHaveText('an***@gmail.com');
    await expect(page.locator('#authEmail')).toHaveCount(0);
    await expect(page.locator('#authPassword')).toBeFocused();
    expect(page.url()).toBe(urlBeforeLoginClick);
    expect(new URL(page.url()).pathname).toBe('/yourbooking.html');
    expect(new URL(page.url()).searchParams.get('token')).toBe('valid-token');
    expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
  });

  test('renders register mode without editable email and sends confirmation state without redirect', async ({ page }) => {
    let authRequestBody: Record<string, unknown> | null = null;
    await page.route(FUNCTION_ROUTE, async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'auth') {
        authRequestBody = body;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            auth_mode: 'register',
            requires_confirmation: true,
            masked_customer_email: 'an***@gmail.com',
          }),
          headers: { 'access-control-allow-origin': '*' },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...publicPayload,
          auth_mode: 'register',
          masked_customer_email: 'an***@gmail.com',
        }),
        headers: { 'access-control-allow-origin': '*' },
      });
    });

    await page.goto('/yourbooking.html?lang=en&token=valid-token');
    const urlBeforeRegister = page.url();
    await page.locator('#loginLink').click();

    await expect(page.locator('#authTitle')).toHaveText('Create account');
    await expect(page.locator('#authMaskedEmail')).toHaveText('an***@gmail.com');
    await expect(page.locator('#authEmail')).toHaveCount(0);
    await expect(page.locator('#authConfirmWrap')).toBeVisible();

    await page.locator('#authPassword').fill('new-secret-password');
    await page.locator('#authConfirmPassword').fill('new-secret-password');
    await page.locator('#authSubmit').click();

    await expect(page.locator('#authStatus')).toContainText('Check the booking email');
    expect(authRequestBody).toMatchObject({
      action: 'auth',
      auth_mode: 'register',
      token: 'valid-token',
      lang: 'en',
    });
    expect(authRequestBody).not.toHaveProperty('email');
    expect(page.url()).toBe(urlBeforeRegister);
  });

  test('refreshes booking access after a successful modal login', async ({ page }) => {
    let resolveCount = 0;
    let authCount = 0;
    await page.route(FUNCTION_ROUTE, async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'auth') {
        authCount += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            auth_mode: 'owner',
            masked_customer_email: 'an***@gmail.com',
            session: {
              access_token: 'owner-session-token',
              refresh_token: 'owner-refresh-token',
            },
          }),
          headers: {
            'access-control-allow-origin': '*',
          },
        });
        return;
      }
      resolveCount += 1;
      const payload = resolveCount === 1
        ? publicPayload
        : {
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
            },
            actions: {
              contact_url: 'mailto:hello@cypruseye.com',
              login_url: '/auth/?lang=en',
              all_bookings_url: '/achievements.html?lang=en&section=reservations',
            },
          };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
        headers: {
          'access-control-allow-origin': '*',
        },
      });
    });

    await page.goto('/yourbooking.html?lang=en&token=valid-token');
    const urlBeforeLogin = page.url();

    await page.locator('#loginLink').click();
    await page.locator('#authPassword').fill('secret-password');
    await page.locator('#authSubmit').click();

    await expect(page.locator('#ownerNote')).toBeVisible();
    await expect(page.locator('#allBookingsLink')).toBeVisible();
    await expect(page.locator('#loginLink')).toBeHidden();
    expect(resolveCount).toBe(2);
    expect(authCount).toBe(1);
    expect(page.url()).toBe(urlBeforeLogin);
  });

  test('renders Polish copy and booking data', async ({ page }) => {
    await routeBookingAccess(page, publicPayload);

    await page.goto('/yourbooking.html?lang=pl&token=valid-token');

    await expect(page.locator('#bookingTitle')).toContainText('Transport');
    await expect(page.locator('#loginLink')).toHaveText('Zaloguj się, aby zobaczyć więcej');
    await expect(page.locator('#detailsGrid')).toContainText('Typ usługi');

    await page.locator('#loginLink').click();
    await expect(page.locator('#authModal')).toBeVisible();
    await expect(page.locator('#authTitle')).toHaveText('Logowanie');
    await expect(page.locator('#authMaskedEmail')).toHaveText('an***@gmail.com');
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
      auth_mode: 'owner',
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
        contact_url: 'mailto:kontakt@wakacjecypr.com',
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
    await expect(page.locator('#loginLink')).toBeHidden();
    expect(authorizationHeader).toBe('Bearer owner-session-token');
  });

  test('shows mismatch mode with safe message and sign-out option', async ({ page }) => {
    await routeBookingAccess(page, {
      ...publicPayload,
      auth_mode: 'mismatch',
      auth_email_mismatch: true,
      message: 'This booking belongs to a different email address.',
    });

    await page.goto('/yourbooking.html?lang=en&token=valid-token');

    await expect(page.locator('#mismatchNote')).toBeVisible();
    await expect(page.locator('#detailsGrid')).not.toContainText('anna@example.com');
    await page.locator('#loginLink').click();
    await expect(page.locator('#authTitle')).toHaveText('Use the booking email');
    await expect(page.locator('#authSignOut')).toBeVisible();
    await expect(page.locator('#authSubmit')).toBeHidden();
    expect(new URL(page.url()).pathname).toBe('/yourbooking.html');
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

    await page.locator('#loginLink').click();
    await expect(page.locator('#authModal')).toBeVisible();
    await expect(page.locator('#authTitle')).toHaveText('התחברות');
    await expect(page.locator('#authEmailLabel')).toHaveText('אימייל');
    await expect(page.locator('#authMaskedEmail')).toHaveText('an***@gmail.com');
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
