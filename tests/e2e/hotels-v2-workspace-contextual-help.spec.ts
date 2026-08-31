import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT_ID = '33333333-3333-4333-8333-333333333333';
const BOOKING_ID = '44444444-4444-4444-8444-444444444444';
const UPPER_ROOM_ID = '55555555-5555-4555-8555-555555555555';
const GROUND_ROOM_ID = '66666666-6666-4666-8666-666666666666';
const TOKEN = 'a'.repeat(64);

const SECTION_TOPICS: Record<string, string> = {
  overview: 'section.overview',
  property_content: 'section.property',
  rooms: 'section.rooms',
  rates_pricing: 'section.pricing',
  calendar_availability: 'section.calendar',
  bookings: 'section.bookings',
  payments: 'section.payments',
};

async function installPartnerHarness(
  page: Page,
  options: { language?: 'en' | 'pl' | 'he'; viewport?: { width: number; height: number } } = {},
): Promise<void> {
  const language = options.language || 'en';
  await page.setViewportSize(options.viewport || { width: 1280, height: 900 });
  await page.setContent(`<!doctype html><html lang="${language}" dir="${language === 'he' ? 'rtl' : 'ltr'}"><head></head><body>
    <main id="partnerPortalView"><button id="workspaceOpener">Open workspace</button></main>
    <section id="partnerHotelWorkspaceView" class="partner-hotel-workspace" aria-labelledby="partnerHotelWorkspaceTitle" hidden></section>
    <dialog id="partnerHotelWorkspaceReview" class="partner-hotel-workspace-review" aria-labelledby="partnerHotelWorkspaceReviewTitle"></dialog>
  </body></html>`);
  await page.addStyleTag({ path: path.join(process.cwd(), 'admin/admin.css') });
  await page.addStyleTag({ path: path.join(process.cwd(), 'partners/hotels-v2-workspace.css') });
  await page.evaluate(({ hotelId, bookingId, upperRoomId, groundRoomId, token }) => {
    const root = window as any;
    const localized = (value: Record<string, string> | null | undefined, language: string, fallback = '') =>
      value?.[language] || value?.en || value?.pl || value?.he || fallback;
    const capabilities = {
      edit_property_content: true,
      edit_property_photos: false,
      edit_room_content: false,
      edit_room_photos: false,
      create_rooms: false,
      edit_room_structure: false,
      manage_prices: false,
      manage_availability: false,
      process_bookings: true,
      request_booking_changes: false,
      view_payment_status: true,
      initiate_stripe_onboarding: false,
    };
    const visibleSection = { visible: true, available: true, status: 'available' };
    const workspace = {
      hotel_id: hotelId,
      assignment: { id: '33333333-3333-4333-8333-333333333333', capabilities, access_snapshot_token: token },
      property: {
        id: hotelId,
        slug: 'reviewed-hotel',
        title_i18n: { en: 'Reviewed Hotel', pl: 'Sprawdzony hotel', he: 'מלון שנבדק' },
        description_i18n: { en: '', pl: '', he: '' },
        city: 'Paphos',
        address_line: null,
        district: null,
        postal_code: null,
        country: 'Cyprus',
        latitude: null,
        longitude: null,
        google_maps_url: null,
        amenities: [],
        check_in_from: '14:00',
        check_out_until: '11:00',
        cover_image_url: null,
        photos: [],
      },
      property_draft: { exists: false, content: {}, photos: {} },
      rooms: [],
      pricing: {
        snapshot_token: token,
        currency: 'EUR',
        rate_plans: [],
        room_rates: [],
        schedules: [],
        schedule_tiers: [],
        room_rate_tiers: [],
        exact_date_prices: [],
        allocation_rules: [],
        commission_policy: null,
        mutation_blocked_reasons: [],
      },
      availability: { from: '2026-08-31', to: '2026-09-30', snapshot_token: token },
      sections: {
        overview: visibleSection,
        property_content: visibleSection,
        property_photos: { visible: false, available: false, status: 'unavailable' },
        rooms: visibleSection,
        rates_pricing: visibleSection,
        calendar_availability: visibleSection,
        bookings: visibleSection,
        payments: visibleSection,
      },
    };
    const presentation = {
      contract_version: 'hotels_v2_workspace_bookings_payments_presentation_v1',
      scope: 'partner',
      hotel_id: hotelId,
      generated_at: '2026-08-31T09:15:00.000Z',
      capabilities: {
        bookings_visible: true,
        payments_visible: true,
        full_booking_management: true,
        full_payment_management: false,
      },
      summary: { total_bookings: 1, upcoming_bookings: 1, current_recent_bookings: 0 },
      bookings: [{
        booking_id: bookingId,
        reference: 'CE-7A-2042',
        arrival_date: '2026-09-12',
        departure_date: '2026-09-15',
        status: 'confirmed',
        guest_count: 6,
        currency: 'EUR',
        customer_total: 720,
        allocation: [
          { room_type_id: upperRoomId, room_name_i18n: { en: 'Upper Room', pl: 'Górny apartament', he: 'החדר העליון' }, units: 1 },
          { room_type_id: groundRoomId, room_name_i18n: { en: 'Ground Room', pl: 'Dolny apartament', he: 'החדר התחתון' }, units: 1 },
        ],
        payment: {
          state: 'partially_paid',
          currency: 'EUR',
          paid: 200,
          remaining: 520,
          cypruseye_commission: 60,
          partner_net: 660,
        },
      }],
    };
    root.__workspaceCalls = [];
    root.__bookingManagementEvents = 0;
    root.addEventListener('ce:partner-hotel-bookings', () => { root.__bookingManagementEvents += 1; });
    root.HotelsV2PartnerWorkspaceCore = {
      CAPABILITIES: [],
      CONTRACTS: {},
      requireCanonicalUuid(value: string, label: string) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) throw new Error(`Invalid ${label}`);
        return value;
      },
      localized,
      compactI18n(value: Record<string, string>) { return value; },
      isSevenArchesReviewedPricingWorkspace() { return false; },
      sevenArchesReviewedPricingTargets() { return null; },
      hasSevenArchesReviewedPricingIdentity() { return false; },
    };
    root.HotelsV2PartnerWorkspaceRepository = {
      async getWorkspace() { root.__workspaceCalls.push('getWorkspace'); return workspace; },
      async getBookingsPaymentsPresentation() {
        root.__workspaceCalls.push('getBookingsPaymentsPresentation');
        return presentation;
      },
      clearReviewedPlans() { root.__workspaceCalls.push('clearReviewedPlans'); },
    };
    root.HotelsV2PartnerMedia = null;
  }, { hotelId: HOTEL_ID, bookingId: BOOKING_ID, upperRoomId: UPPER_ROOM_ID, groundRoomId: GROUND_ROOM_ID, token: TOKEN });
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-workspace-help.js') });
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-partner-workspace.js') });
  await page.locator('#workspaceOpener').focus();
  await page.evaluate(({ partnerId, assignmentId, hotelId }) => (window as any).HotelsV2PartnerWorkspace.open({
    partnerId,
    assignment: { assignment_id: assignmentId, hotel_id: hotelId, slug: 'reviewed-hotel', name_i18n: { en: 'Reviewed Hotel' } },
  }), { partnerId: PARTNER_ID, assignmentId: ASSIGNMENT_ID, hotelId: HOTEL_ID });
  await expect(page.locator('[data-phw-panel="overview"]')).toBeVisible();
}

function visibleHelpDialog(page: Page) {
  return page.locator('[role="dialog"]:visible, dialog[open]:visible').last();
}

test('Partner renders exactly one section help trigger per main section and one shared accessible help surface', async ({ page }) => {
  await installPartnerHarness(page);

  for (const [section, topic] of Object.entries(SECTION_TOPICS)) {
    const triggers = page.locator(`[data-phw-panel="${section}"] [data-hv2-section-help]`);
    await expect(triggers).toHaveCount(1);
    await expect(triggers).toHaveAttribute('data-hv2-help-topic', topic);
    await expect(triggers).toHaveAttribute('type', 'button');
    await expect(triggers).toHaveAttribute('aria-expanded', 'false');
    await expect(triggers).toHaveAttribute('aria-controls', /.+/);
    await expect(triggers).toHaveAttribute('aria-label', /.+/);
  }
  for (const topic of ['controls.property', 'controls.rooms', 'controls.pricing', 'controls.calendar', 'controls.bookings', 'controls.payments']) {
    await expect(page.locator(`[data-hv2-help-topic="${topic}"]:not([data-hv2-section-help])`)).toHaveCount(1);
  }

  const overview = page.locator('[data-hv2-help-topic="section.overview"]');
  await overview.click();
  await expect(overview).toHaveAttribute('aria-expanded', 'true');
  const dialog = visibleHelpDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toContainText(/Overview/);
  await expect(dialog.locator('[data-hv2-help-close]')).toBeVisible();
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(overview).toHaveAttribute('aria-expanded', 'false');
  await expect(overview).toBeFocused();

  await overview.focus();
  await page.keyboard.press('Enter');
  await expect(visibleHelpDialog(page)).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(visibleHelpDialog(page)).toBeHidden();
  await expect(overview).toBeFocused();

  await page.locator('[data-phw-section="rooms"]').click();
  const rooms = page.locator('[data-hv2-help-topic="section.rooms"]');
  const roomControls = page.locator('[data-hv2-help-topic="controls.rooms"]');
  await rooms.click();
  await page.keyboard.press('Escape');
  await roomControls.click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(rooms).toHaveAttribute('aria-expanded', 'false');
  await expect(roomControls).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(roomControls).toBeFocused();

  await expect(page.locator('[data-phw-lifecycle]')).toBeVisible();
  await expect(page.locator('[data-phw-lifecycle]')).not.toHaveText('');
  await expect(page.locator('[data-phw-status]')).toHaveText('');
});

test('mobile Hebrew help is RTL, scrollable, closable and restores focus', async ({ page }) => {
  await installPartnerHarness(page, { language: 'he', viewport: { width: 390, height: 520 } });
  await expect(page.locator('#partnerHotelWorkspaceView')).toHaveAttribute('dir', 'rtl');
  await page.locator('[data-phw-section="bookings"]').click();
  const trigger = page.locator('[data-hv2-help-topic="section.bookings"]');
  await trigger.focus();
  await page.keyboard.press('Space');
  const dialog = visibleHelpDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('dir', 'rtl');
  await expect(dialog).toContainText(/[\u0590-\u05ff]/);
  await expect(dialog.locator('[data-hv2-help-close]')).toBeVisible();
  const mobileGeometry = await dialog.evaluate((node) => {
    const style = getComputedStyle(node);
    const body = node.querySelector('.hotels-v2-help-dialog__body');
    const bodyStyle = body ? getComputedStyle(body) : null;
    return {
      width: node.getBoundingClientRect().width,
      viewport: window.innerWidth,
      bodyOverflowY: bodyStyle?.overflowY,
      maxHeight: style.maxHeight,
      borderRadius: style.borderRadius,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    };
  });
  expect(mobileGeometry.width).toBeGreaterThanOrEqual(mobileGeometry.viewport - 2);
  expect(mobileGeometry.width).toBeLessThanOrEqual(mobileGeometry.viewport);
  expect(mobileGeometry.bodyOverflowY).toBe('auto');
  expect(mobileGeometry.maxHeight).not.toBe('none');
  expect(mobileGeometry.borderRadius).toContain('18px');
  await dialog.locator('[data-hv2-help-close]').click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Bookings and Payments render only server values, exact multi-Room allocation and secure existing-flow CTAs', async ({ page }) => {
  await installPartnerHarness(page);
  await page.locator('[data-phw-section="bookings"]').click();
  const bookings = page.locator('[data-phw-panel="bookings"]');
  await expect(bookings).toBeVisible();
  await expect(bookings).toContainText('CE-7A-2042');
  await expect(bookings).toContainText('Upper Room');
  await expect(bookings).toContainText('Ground Room');
  await expect(bookings).toContainText('6');
  await expect(bookings).toContainText(/€720\.00|EUR\s*720/);
  await expect(bookings.locator('[data-booking-id]')).toHaveCount(1);
  await expect(bookings.locator('input')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Foreign Hotel');

  const bookingCta = bookings.locator('[data-phw-existing-flow="bookings"]');
  await expect(bookingCta).toBeVisible();
  await bookingCta.click();
  await expect(page.locator('#partnerHotelWorkspaceView')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__bookingManagementEvents)).toBe(1);
  expect(await page.evaluate(() => (window as any).__workspaceCalls.filter((name: string) => /apply|update|save|mutate|refund|payout/i.test(name)))).toEqual([]);

  await page.evaluate(({ partnerId, assignmentId, hotelId }) => (window as any).HotelsV2PartnerWorkspace.open({
    partnerId,
    assignment: { assignment_id: assignmentId, hotel_id: hotelId, slug: 'reviewed-hotel', name_i18n: { en: 'Reviewed Hotel' } },
  }), { partnerId: PARTNER_ID, assignmentId: ASSIGNMENT_ID, hotelId: HOTEL_ID });
  await page.locator('[data-phw-section="payments"]').click();
  const payments = page.locator('[data-phw-panel="payments"]');
  await expect(payments).toBeVisible();
  for (const exact of ['200', '520', '60', '660']) await expect(payments).toContainText(exact);
  await expect(payments).toContainText(/Partially paid/);
  await expect(payments).toContainText(/read-only/i);
  await expect(payments.locator('input[name="commission"], input[name="customer_total"], input[name="payment_status"], input[name="partner_net"]')).toHaveCount(0);
  await expect(payments.locator('[data-phw-existing-flow="payments"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__bookingManagementEvents)).toBe(1);
  expect(await page.evaluate(() => (window as any).__workspaceCalls.filter((name: string) => /apply|update|save|mutate|refund|payout/i.test(name)))).toEqual([]);
});

test('Admin role help explains review decisions while retaining a single shared surface', async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><body><main id="adminHelp"></main></body></html>');
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-workspace-help.js') });
  await page.evaluate(() => {
    const root = document.getElementById('adminHelp') as HTMLElement;
    const Help = (window as any).HotelsV2WorkspaceHelp;
    root.innerHTML = `${Help.helpButton('controls.pricing')}${Help.helpButton('controls.calendar')}`;
    (window as any).__adminHelpController = Help.createController({ root, language: 'en', role: 'admin' });
  });
  const pricing = page.locator('[data-hv2-help-topic="controls.pricing"]');
  await pricing.click();
  await expect(visibleHelpDialog(page)).toContainText(/Accept/i);
  await expect(visibleHelpDialog(page)).toContainText(/Reject/i);
  await page.keyboard.press('Escape');
  const calendar = page.locator('[data-hv2-help-topic="controls.calendar"]');
  await calendar.click();
  await expect(visibleHelpDialog(page)).toContainText(/review/i);
  await expect(visibleHelpDialog(page)).toContainText(/private/i);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(calendar).toBeFocused();
});
