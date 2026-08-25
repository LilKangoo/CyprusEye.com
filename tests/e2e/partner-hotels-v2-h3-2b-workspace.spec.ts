import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT_ID = '33333333-3333-4333-8333-333333333333';
const ROOM_ID = '44444444-4444-4444-8444-444444444444';
const PLAN_ID = '55555555-5555-4555-8555-555555555555';
const RATE_ID = '66666666-6666-4666-8666-666666666666';
const PROPOSAL_ID = '77777777-7777-4777-8777-777777777777';
const REVIEW_ID = '88888888-8888-4888-8888-888888888888';
const ACTIVITY_ID = '99999999-9999-4999-8999-999999999999';
const POLICY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOKEN = 'a'.repeat(64);
const NEXT_TOKEN = 'b'.repeat(64);
const PLAN_FINGERPRINT = 'c'.repeat(64);

type BrowserIssues = { console: string[]; page: string[]; requests: string[] };
const browserIssues = new WeakMap<Page, BrowserIssues>();

async function installHarness(page: Page, viewport: { width: number; height: number }, language = 'en'): Promise<void> {
  await page.route('**/__h3_2b_partner_workspace_harness__', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' });
  });
  await page.goto('/__h3_2b_partner_workspace_harness__');
  const issues: BrowserIssues = { console: [], page: [], requests: [] };
  browserIssues.set(page, issues);
  page.on('console', (message) => { if (message.type() === 'error') issues.console.push(message.text()); });
  page.on('pageerror', (error) => issues.page.push(error.message));
  page.on('requestfailed', (request) => issues.requests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  await page.route('https://example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
  });
  await page.setViewportSize(viewport);
  await page.setContent(`<!doctype html><html lang="${language}" dir="${language === 'he' ? 'rtl' : 'ltr'}"><head></head><body>
    <main id="partnerPortalView"><button id="workspaceOpener">Open</button></main>
    <section id="partnerHotelWorkspaceView" class="partner-hotel-workspace" aria-labelledby="partnerHotelWorkspaceTitle" hidden></section>
    <dialog id="partnerHotelWorkspaceReview" class="partner-hotel-workspace-review" aria-labelledby="partnerHotelWorkspaceReviewTitle"></dialog>
  </body></html>`);
  await page.addStyleTag({ path: path.join(process.cwd(), 'partners/hotels-v2-workspace.css') });
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js') });
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-partner-workspace-core.js') });
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-partner-workspace-repository.js') });
  await page.evaluate(({ hotelId, partnerId, assignmentId, roomId, planId, rateId, proposalId, reviewId, activityId, policyId, token, nextToken, planFingerprint }) => {
    const root = window as any;
    let uuidSequence = 1;
    Object.defineProperty(root.crypto, 'randomUUID', {
      configurable: true,
      value: () => `dddddddd-dddd-4ddd-8ddd-${String(uuidSequence++).padStart(12, '0')}`,
    });
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const capabilities = {
      edit_property_content: true, edit_property_photos: true, edit_room_content: true,
      edit_room_photos: true, create_rooms: true, edit_room_structure: true,
      manage_prices: true, manage_availability: false, process_bookings: true,
      request_booking_changes: true, view_payment_status: true, initiate_stripe_onboarding: true,
    };
    const section = (visible: boolean, available: boolean, status: string) => ({ visible, available, status });
    const property = {
      id: hotelId, slug: 'exact-partner-hotel',
      title_i18n: { pl: 'Hotel partnerski', en: 'Partner Hotel', he: 'מלון שותף' },
      description_i18n: { pl: 'Opis', en: 'Description', he: 'תיאור' },
      city: 'Paphos', address_line: '1 Harbour Street', district: 'Harbour', postal_code: '8041', country: 'Cyprus',
      latitude: 34.77, longitude: 32.42, google_maps_url: 'https://maps.google.com/example', amenities: ['wifi'],
      check_in_from: '14:00:00', check_out_until: '11:00:00', cover_image_url: 'https://example.test/property-a.webp',
      photos: ['https://example.test/property-a.webp'], architecture_version: 'legacy', status: 'active',
      is_published: true, updated_at: '2026-08-25T10:00:00Z',
    };
    const room = {
      id: roomId, hotel_id: hotelId, code: 'upper',
      name_i18n: { pl: 'Górny apartament', en: 'Upper Apartment', he: 'הדירה העליונה' },
      description_i18n: { pl: 'Opis pokoju', en: 'Room description', he: 'תיאור החדר' },
      gallery: ['https://example.test/property-a.webp'], capacity_adults: null, capacity_children: null,
      max_occupancy: 4, bed_configuration: [], bathrooms: 1, size_sqm: 42, amenities: ['wifi'],
      inventory_mode: 'pooled', base_inventory_count: 1, status: 'active', sort_order: 10,
      floor_label_i18n: { pl: 'Piętro', en: 'Upper floor', he: 'קומה עליונה' }, version: 3,
      updated_at: '2026-08-25T10:00:00Z',
    };
    const roomRate = {
      id: rateId, hotel_id: hotelId, room_type_id: roomId, rate_plan_id: planId,
      pricing_schedule_id: null, pricing_source: 'base_nightly_rate', base_nightly_rate: 120,
      base_nightly_rate_authoritative: true, currency: 'EUR', is_active: false,
      review_status: 'reviewed', sort_order: 10, version: 2, updated_at: '2026-08-25T10:00:00Z',
    };
    const policy = {
      id: policyId, code: 'CE10', commission_mode: 'percent_booking_total', amount: 10,
      currency: 'EUR', version: 1, updated_at: '2026-08-25T10:00:00Z', fingerprint: token, read_only: true,
    };
    const emptyDraft = { exists: false, id: null, status: null, version: 0, source_property_updated_at: null, content: {}, photos: {}, updated_at: null };
    const store: any = {
      rpcCalls: [], nextContent: 'changed', bookingEvents: 0, mediaCalls: 0,
      workspace: {
        contract_version: 'hotels_v2_h3_2b_partner_workspace_v1', partner: { id: partnerId, role: 'partner' }, hotel_id: hotelId,
        assignment: { id: assignmentId, permission_version: 1, capabilities, access_snapshot_token: token },
        feature_flags: { hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: false, hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false },
        content_snapshot_token: token, property, property_draft: emptyDraft, rooms: [room], units: [],
        pricing: {
          snapshot_token: token, currency: 'EUR',
          rate_plans: [{ id: planId, hotel_id: hotelId, code: 'STANDARD', name_i18n: { pl: 'Standard', en: 'Standard', he: 'סטנדרטי' }, is_active: false, review_status: 'reviewed', sort_order: 10, version: 1, updated_at: '2026-08-25T10:00:00Z' }],
          room_rates: [roomRate], schedules: [], schedule_tiers: [], room_rate_tiers: [], exact_date_prices: [], allocation_rules: [],
          commission_policy: policy, mutation_blocked_reasons: [],
        },
        availability: null,
        sections: {
          overview: section(true, true, 'available'), property_content: section(true, true, 'available'), property_photos: section(true, true, 'available'),
          rooms: section(true, true, 'available'), rates_pricing: section(true, true, 'available'), calendar_availability: section(false, false, 'unavailable'),
          bookings: section(true, true, 'existing_flow'), payments: section(true, true, 'existing_flow'),
          booking_changes: section(true, false, 'future_stage'), stripe_onboarding: section(true, false, 'future_stage'),
        },
        recent_activity: [], legacy_authoritative: true, public_change: false,
      },
    };
    const canonical = (value: any): string => Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : value && typeof value === 'object'
        ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
        : JSON.stringify(value);
    const contentSource = () => Object.keys(store.workspace.property_draft.content).length
      ? store.workspace.property_draft.content : store.workspace.property;
    const contentPreview = (draft: any) => {
      if (store.nextContent === 'stale') {
        store.nextContent = 'changed';
        return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_2b_stale_content_snapshot' } };
      }
      const fields = Object.keys(draft.intent.payload).sort();
      const before = Object.fromEntries(fields.map((field) => [field, clone(contentSource()[field])]));
      const after = Object.fromEntries(fields.map((field) => [field, clone(draft.intent.payload[field])]));
      if (store.nextContent === 'noop' || canonical(before) === canonical(after)) {
        store.nextContent = 'changed';
        return { data: { contract_version: 'hotels_v2_h3_2b_content_preview_v1', partner_id: partnerId, hotel_id: hotelId, changed: false, blocking_reasons: [], impacts: [], reviewed_plan: null }, error: null };
      }
      const operation = {
        entity: 'property_content', action: 'update', id: store.workspace.property_draft.id || proposalId,
        expected_version: store.workspace.property_draft.version, expected_original: clone(store.workspace.property_draft),
        payload: clone(draft.intent.payload), reason: draft.intent.reason,
      };
      const reviewedPlan = {
        contract_version: 'hotels_v2_h3_2b_content_plan_v1', review_id: reviewId, partner_id: partnerId, hotel_id: hotelId,
        assignment_id: assignmentId, permission_version: 1, access_snapshot_token: token,
        domain_snapshot_token: store.workspace.content_snapshot_token, reviewed_at: '2026-08-25T12:00:00Z',
        expires_at: '2026-08-25T12:05:00Z', operations: [operation], plan_fingerprint: planFingerprint,
      };
      return { data: {
        contract_version: 'hotels_v2_h3_2b_content_preview_v1', partner_id: partnerId, hotel_id: hotelId,
        changed: true, blocking_reasons: [], reviewed_plan: reviewedPlan,
        impacts: [{ entity: operation.entity, action: operation.action, id: operation.id, changed: true, fields, before, after, affected_room_type_ids: [], affected_room_rate_ids: [], from: null, to: null }],
      }, error: null };
    };
    const pricingPreview = (draft: any) => {
      const operation = { entity: 'room_rate_price', action: 'update', id: rateId, expected_version: roomRate.version, expected_original: clone(roomRate), payload: clone(draft.intent.payload), reason: draft.intent.reason };
      const commercial = (customer: number) => ({
        policy: clone(policy), calculation_basis: { code: 'booking_total', quantity: 1, unit_amount: 10, booking_total: customer },
        customer_price: customer, cypruseye_commission: customer / 10, partner_net: customer - customer / 10, currency: 'EUR',
      });
      return { data: {
        contract_version: 'hotels_v2_h3_2b_pricing_preview_v1', partner_id: partnerId, hotel_id: hotelId,
        changed: true, blocking_reasons: [],
        impacts: [{ entity: operation.entity, action: operation.action, id: rateId, changed: true, fields: ['nightly_rate'], before: { nightly_rate: 120 }, after: { nightly_rate: draft.intent.payload.nightly_rate }, affected_room_type_ids: [roomId], affected_room_rate_ids: [rateId], from: null, to: null }],
        reviewed_plan: { contract_version: 'hotels_v2_h3_2b_pricing_plan_v1', review_id: reviewId, partner_id: partnerId, hotel_id: hotelId, assignment_id: assignmentId, permission_version: 1, access_snapshot_token: token, domain_snapshot_token: token, reviewed_at: '2026-08-25T12:00:00Z', expires_at: '2026-08-25T12:05:00Z', operations: [operation], plan_fingerprint: planFingerprint },
        commercial_before: commercial(120), commercial_after: commercial(draft.intent.payload.nightly_rate), example_before: null, example_after: null,
      }, error: null };
    };
    root.__h32b = store;
    root.addEventListener('ce:partner-hotel-bookings', () => { store.bookingEvents += 1; });
    root.getSupabase = () => ({
      rpc: async (name: string, params: any) => {
        store.rpcCalls.push({ name, params: clone(params) });
        if (name === 'hotel_v2_partner_get_workspace') return { data: clone(store.workspace), error: null };
        if (name === 'hotel_v2_partner_preview_content_plan') return contentPreview(params.p_draft);
        if (name === 'hotel_v2_partner_preview_pricing_plan') return pricingPreview(params.p_draft);
        if (name === 'hotel_v2_partner_apply_content_plan') {
          const operation = params.p_reviewed_plan.operations[0];
          store.workspace.property_draft = {
            exists: true, id: operation.id, status: 'pending_admin_review', version: operation.expected_version + 1,
            source_property_updated_at: store.workspace.property.updated_at, content: clone(operation.payload), photos: {}, updated_at: '2026-08-25T12:01:00Z',
          };
          store.workspace.content_snapshot_token = nextToken;
          return { data: {
            contract_version: 'hotels_v2_h3_2b_content_apply_result_v1', partner_id: partnerId, hotel_id: hotelId,
            correlation_id: params.p_correlation_id, idempotency_key: params.p_idempotency_key, replayed: false, changed: true,
            activity: [{ id: activityId, hotel_id: hotelId, entity_type: 'property', entity_id: hotelId, action: 'update', actor_type: 'partner', source: 'hotels_v2_h3_2b_partner_workspace', correlation_id: params.p_correlation_id, created_at: '2026-08-25T12:01:00Z' }], workspace: null,
          }, error: null };
        }
        throw new Error(`Unexpected exact RPC ${name}`);
      },
    });
    root.HotelsV2PartnerMedia = {
      uploadProperty: async () => {
        store.mediaCalls += 1;
        throw Object.assign(new Error('Controlled partial upload'), { partialUpload: true, uploadedUrls: ['https://example.test/property-partial.webp'] });
      },
      uploadRoom: async () => [],
    };
  }, { hotelId: HOTEL_ID, partnerId: PARTNER_ID, assignmentId: ASSIGNMENT_ID, roomId: ROOM_ID, planId: PLAN_ID, rateId: RATE_ID, proposalId: PROPOSAL_ID, reviewId: REVIEW_ID, activityId: ACTIVITY_ID, policyId: POLICY_ID, token: TOKEN, nextToken: NEXT_TOKEN, planFingerprint: PLAN_FINGERPRINT });
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-partner-workspace.js') });
  await page.evaluate(async ({ partnerId, assignmentId, hotelId }) => {
    await (window as any).HotelsV2PartnerWorkspace.open({ partnerId, assignment: { assignment_id: assignmentId, hotel_id: hotelId } });
  }, { partnerId: PARTNER_ID, assignmentId: ASSIGNMENT_ID, hotelId: HOTEL_ID });
}

async function expectNoBrowserErrors(page: Page): Promise<void> {
  await page.waitForTimeout(20);
  expect(browserIssues.get(page)).toEqual({ console: [], page: [], requests: [] });
}

test.describe('Hotels V2 H3.2B Partner workspace', () => {
  test('desktop uses exact capability sections and Review/Save, no-op and stale flows without retry', async ({ page }) => {
    await installHarness(page, { width: 1440, height: 1000 }, 'en');
    const workspace = page.locator('#partnerHotelWorkspaceView');
    await expect(workspace).toBeVisible();
    await expect(workspace).toHaveAttribute('dir', 'ltr');
    await expect(workspace.locator('[data-phw-section]')).toHaveText(['Overview', 'Property', 'Rooms', 'Rates & Pricing', 'Bookings', 'Payments']);
    await expect(workspace.locator('[data-phw-section="calendar_availability"]')).toHaveCount(0);
    await expect(workspace).toContainText('Booking changes');
    await expect(workspace).toContainText('Stripe onboarding');
    await expect(workspace.getByRole('button', { name: /Stripe|calendar sync|external calendar/i })).toHaveCount(0);

    await workspace.locator('[data-phw-section="property_content"]').click();
    const content = workspace.locator('[data-phw-property-content]');
    await content.locator('input[name="city"]').fill('Larnaca');
    await content.locator('input[name="reason"]').fill('Reviewed partner content');
    await content.getByRole('button', { name: 'Review' }).click();
    const dialog = page.locator('#partnerHotelWorkspaceReview');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Review exact Hotel change');
    await dialog.getByRole('button', { name: 'Save reviewed change' }).click();
    await expect(dialog).toBeHidden();
    await expect(workspace.locator('[data-phw-status]')).toContainText('Reviewed change saved');
    await expect(workspace).toContainText('Pending Admin review');

    await workspace.locator('[data-phw-property-content] input[name="reason"]').fill('Reviewed semantic no-op');
    await workspace.locator('[data-phw-property-content]').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(workspace.locator('[data-phw-status]')).toContainText('No semantic change');

    await page.evaluate(() => { (window as any).__h32b.nextContent = 'stale'; });
    await workspace.locator('[data-phw-property-content] input[name="city"]').fill('Limassol');
    await workspace.locator('[data-phw-property-content] input[name="reason"]').fill('Reviewed stale content');
    await workspace.locator('[data-phw-property-content]').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(workspace.locator('[data-phw-status]')).toContainText('Reload it and prepare a fresh explicit Review');
    const audit = await page.evaluate(() => (window as any).__h32b.rpcCalls);
    expect(audit.filter((call: any) => call.name === 'hotel_v2_partner_apply_content_plan')).toHaveLength(1);

    await workspace.locator('[data-phw-section="rates_pricing"]').click();
    const priceForm = workspace.locator('[data-phw-pricing]');
    await priceForm.locator('input[name="nightly_rate"]').fill('130');
    await priceForm.locator('input[name="reason"]').fill('Reviewed authoritative rate');
    await priceForm.getByRole('button', { name: 'Review' }).click();
    await expect(dialog).toContainText('€120.00');
    await expect(dialog).toContainText('€130.00');
    await expect(dialog).toContainText('10% of booking total');
    await expect(dialog).toContainText('CyprusEye commission');
    await expect(dialog).toContainText('Partner net');
    await dialog.getByRole('button', { name: 'Cancel' }).last().click();

    await workspace.locator('[data-phw-section="property_content"]').click();
    const mediaForm = workspace.locator('[data-phw-property-photos]');
    await mediaForm.locator('input[type="file"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('synthetic') });
    await mediaForm.locator('[data-phw-upload-property]').click();
    await expect(workspace.locator('[data-phw-status]')).toContainText('Only some photos uploaded');
    await expect(mediaForm.locator('input[type="checkbox"][value="https://example.test/property-partial.webp"]')).toBeChecked();

    await workspace.locator('[data-phw-section="bookings"]').click();
    await workspace.locator('[data-phw-panel="bookings"] [data-phw-existing-flow]').click();
    expect(await page.evaluate(() => (window as any).__h32b.bookingEvents)).toBe(1);
    await page.evaluate(async ({ partnerId, assignmentId, hotelId }) => {
      await (window as any).HotelsV2PartnerWorkspace.open({ partnerId, assignment: { assignment_id: assignmentId, hotel_id: hotelId } });
    }, { partnerId: PARTNER_ID, assignmentId: ASSIGNMENT_ID, hotelId: HOTEL_ID });
    await workspace.locator('[data-phw-section="payments"]').click();
    await workspace.locator('[data-phw-panel="payments"] [data-phw-existing-flow]').click();
    expect(await page.evaluate(() => (window as any).__h32b.bookingEvents)).toBe(2);
    await expectNoBrowserErrors(page);
  });

  test('Polish mobile keeps primary workflow localized and unclipped', async ({ page }) => {
    await installHarness(page, { width: 390, height: 844 }, 'pl');
    const workspace = page.locator('#partnerHotelWorkspaceView');
    await expect(workspace).toHaveAttribute('dir', 'ltr');
    await expect(workspace).toContainText('Panel hotelu');
    await expect(workspace).toContainText('Publiczne działanie legacy pozostaje nadrzędne');
    await workspace.locator('[data-phw-section="property_content"]').click();
    await expect(workspace).toContainText('Propozycja treści obiektu');
    await expect(workspace).toContainText('Propozycja zdjęć obiektu');
    expect(await workspace.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expectNoBrowserErrors(page);
  });

  test('Hebrew mobile is RTL, localized and exposes no deferred action controls', async ({ page }) => {
    await installHarness(page, { width: 412, height: 915 }, 'he');
    const workspace = page.locator('#partnerHotelWorkspaceView');
    await expect(workspace).toHaveAttribute('dir', 'rtl');
    await expect(workspace).toContainText('סביבת עבודה למלון');
    await expect(workspace).toContainText('ההתנהגות הציבורית הישנה נשארת סמכותית');
    await expect(workspace).toContainText('שינויים בהזמנה');
    await expect(workspace).toContainText('הגדרת Stripe');
    await expect(workspace.getByRole('button', { name: /Stripe|סנכרון|לוח שנה חיצוני/i })).toHaveCount(0);
    await workspace.locator('[data-phw-section="rates_pricing"]').click();
    await expect(workspace).toContainText('מחיר בסיס ללילה');
    expect(await workspace.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expectNoBrowserErrors(page);
  });
});
