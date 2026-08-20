import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_A = '33333333-3333-4333-8333-333333333333';
const PARTNER_B = '44444444-4444-4444-8444-444444444444';
const ASSIGNMENT_A = '55555555-5555-4555-8555-555555555555';

type BrowserIssues = { console: string[]; page: string[]; requests: string[] };
const browserIssues = new WeakMap<Page, BrowserIssues>();

async function expectNoUnexplainedBrowserErrors(page: Page): Promise<void> {
  await page.waitForTimeout(20);
  expect(browserIssues.get(page)).toEqual({ console: [], page: [], requests: [] });
}

async function installAdminBHarness(page: Page, options: { width: number; height: number; rtl?: boolean }): Promise<void> {
  const issues: BrowserIssues = { console: [], page: [], requests: [] };
  browserIssues.set(page, issues);
  page.on('console', (message) => { if (message.type() === 'error') issues.console.push(message.text()); });
  page.on('pageerror', (error) => issues.page.push(error.message));
  page.on('requestfailed', (request) => issues.requests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  await page.route('https://example.test/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
  });
  await page.setViewportSize({ width: options.width, height: options.height });
  await page.setContent(`<!doctype html><html dir="${options.rtl ? 'rtl' : 'ltr'}"><head></head><body>
    <section id="hotelPropertyDirectory"></section><section id="hotelPropertyWorkspace"></section>
    <input id="hotelPropertySearch"><select id="hotelPropertyArchitectureFilter"><option value="all">all</option></select>
    <select id="hotelPropertyReadinessFilter"><option value="all">all</option></select><button id="btnAddHotel"></button>
  </body></html>`);
  await page.evaluate(() => {
    let sequence = 100;
    Object.defineProperty(window.crypto, 'randomUUID', {
      configurable: true,
      value: () => `99999999-9999-4999-8999-${String(sequence++).padStart(12, '0')}`,
    });
  });
  await page.addStyleTag({ path: path.join(process.cwd(), 'admin/admin.css') });
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js') });
  await page.evaluate(({ hotelId, roomId, partnerA, partnerB, assignmentA }) => {
    const root = window as any;
    const Core = root.HotelsV2WorkspaceCore;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const flags = {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    };
    const capabilities = Object.fromEntries(Core.HOTEL_PARTNER_CAPABILITIES.map((key: string) => [key, false]));
    capabilities.edit_property_content = true;
    const store: any = {
      tick: 0,
      propertyPlans: [], roomPlans: [], assignmentPlans: [], createdPropertyPlans: [], toasts: [],
      mediaUploads: [], mediaCleanup: [], failNextPropertyUpload: false, failNextRoomUpload: false,
      nextPropertyStale: null, nextRoomStale: null, nextPropertyAmbiguous: null, nextRoomAmbiguous: null,
      failNextWorkspaceRead: false,
      workspace: Core.normalizeWorkspace({
        property: {
          id: hotelId, slug: 'reviewed-hotel', architecture_version: 'legacy',
          title: { pl: 'Hotel', en: 'Reviewed Hotel', he: 'מלון' },
          title_i18n: { pl: 'Hotel', en: 'Reviewed Hotel', he: 'מלון' },
          description: { pl: 'Opis', en: 'Description', he: 'תיאור' },
          description_i18n: { pl: 'Opis', en: 'Description', he: 'תיאור' },
          address_line: '1 Main Street', city: 'Lefkara', district: 'Larnaca', postal_code: '7700', country: 'Cyprus',
          latitude: 34.87, longitude: 33.30, google_maps_url: 'https://maps.google.com/example',
          timezone: 'Europe/Nicosia', currency: 'EUR', booking_mode: 'request_confirmation',
          check_in_from: '14:00:00', check_out_until: '11:00:00', minimum_stay_nights: 2,
          children_policy: 'minimum_age', minimum_child_age: 15,
          amenities: ['wifi'], photos: ['https://example.test/shared-a.webp', 'https://example.test/shared-b.webp'],
          cover_image_url: 'https://example.test/shared-a.webp', owner_partner_id: partnerA,
          owner_partner: { id: partnerA, name: 'Commercial Owner A', status: 'active', can_manage_hotels: true },
          status: 'active', is_published: true, updated_at: '2026-08-20T08:00:00.000Z',
          pricing_tiers: { rules: [] }, room_types: [],
        },
        room_types: [{
          id: roomId, hotel_id: hotelId, code: 'upper', name_i18n: { pl: 'Górny', en: 'Upper Room', he: 'חדר עליון' },
          description_i18n: { en: 'Room description' }, gallery: ['https://example.test/shared-a.webp', 'https://example.test/shared-b.webp'],
          capacity_adults: 2, capacity_children: 1, max_occupancy: null,
          bed_configuration: [{ type: 'double', quantity: 1 }, { type: 'sofa', quantity: 1 }], bathrooms: 1, size_sqm: 32,
          floor_label_i18n: { en: 'Upper floor' }, amenities: ['balcony', 'wifi'], inventory_mode: 'pooled',
          base_inventory_count: 1, status: 'active', sort_order: 10, version: 7,
          created_at: '2026-08-20T08:00:00.000Z', updated_at: '2026-08-20T08:00:00.000Z',
        }],
        units: [], rate_plans: [], room_rates: [], pricing_schedules: [], pricing_schedule_tiers: [],
        amenities_catalog: [
          { code: 'wifi', category: 'Connectivity', name_en: 'Wi-Fi' },
          { code: 'balcony', category: 'Outdoor', name_en: 'Balcony' },
          { code: 'terrace', category: 'Outdoor', name_en: 'Terrace' },
        ],
        partners: [
          { id: partnerA, name: 'Commercial Owner A', status: 'active', can_manage_hotels: true },
          { id: partnerB, name: 'Operational Partner B', status: 'active', can_manage_hotels: true },
        ],
        operational_partners: [{ id: partnerA, name: 'Commercial Owner A' }],
        payment_due: {}, counts: { upcoming_bookings: 0, daily_inventory_by_room: {} }, flags, activity: [],
      }),
      profile: {
        exists: true, version: 2, updated_at: '2026-08-20T08:00:00.000Z', maximum_stay_nights: 21,
        guest_instructions_i18n: { en: 'Welcome' }, check_in_instructions_i18n: { en: 'Use the front door' },
        check_out_instructions_i18n: {}, internal_operational_notes: 'Private note',
      },
      assignments: [{
        assignment_id: assignmentA, partner_id: partnerA, staff_scope_count: 1,
        staff_scope_ids: ['66666666-6666-4666-8666-666666666666'], permission_exists: true,
        permission: { exists: true, version: 1, updated_at: '2026-08-20T08:00:00.000Z', capabilities, has_mutation_capability: true },
      }],
    };
    const timestamp = () => `2026-08-20T09:00:${String(++store.tick).padStart(2, '0')}.000Z`;
    const partnerFor = (id: string) => store.workspace.partners.find((partner: any) => partner.id === id);
    const permissionSnapshot = () => ({
      contract_version: Core.H3_2A_PARTNER_PERMISSIONS_CONTRACT,
      property: {
        id: hotelId, updated_at: store.workspace.property.updated_at, architecture_version: 'legacy',
        is_published: true, status: 'active',
      },
      feature_flags: clone(flags), capability_catalog: [...Core.HOTEL_PARTNER_CAPABILITIES],
      assignment_fingerprint: `assignment-${store.assignments.length}-${store.tick}`,
      permissions_fingerprint: `permissions-${store.assignments.length}-${store.tick}`,
      snapshot_token: `snapshot-${store.assignments.length}-${store.tick}`,
      assignments: store.assignments.map((assignment: any) => ({
        ...clone(assignment), hotel_id: hotelId, assignment_active: true,
        partner: { ...clone(partnerFor(assignment.partner_id)), id: assignment.partner_id },
      })),
    });
    const contentControl = () => ({
      contract_version: 'hotels_v2_admin_b_content_control_v1', hotel_id: hotelId,
      property_updated_at: store.workspace.property.updated_at, architecture_version: 'legacy',
      feature_flags: clone(flags),
      commercial_owner: {
        partner_id: partnerA, name: 'Commercial Owner A', status: 'active', can_manage_hotels: true,
      },
      operational_profile: clone(store.profile),
      assignment_snapshot: permissionSnapshot(),
    });
    root.__adminB = store;
    root.CE_HOTEL_PRICING = { normalizeHotelRoomTypes: () => [], getHotelMinPricePerNight: () => null };
    root.showToast = (message: string, type: string) => store.toasts.push({ message, type });
    root.editHotel = () => undefined;
    root.toggleHotelPublish = () => undefined;
    root.HotelsV2AdminMedia = {
      uploadPropertyGallery: async (propertySlug: string, files: File[]) => {
        store.mediaUploads.push({ type: 'property', propertySlug, files: Array.from(files).map((file) => file.name) });
        if (store.failNextPropertyUpload) { store.failNextPropertyUpload = false; throw new Error('Controlled property optimizer failure'); }
        return Array.from(files).map((_file, index) => `https://example.test/property-upload-${store.tick}-${index}.webp`);
      },
      uploadRoomGallery: async (propertySlug: string, exactRoomId: string, files: File[]) => {
        store.mediaUploads.push({ type: 'room', propertySlug, exactRoomId, files: Array.from(files).map((file) => file.name) });
        if (store.failNextRoomUpload) { store.failNextRoomUpload = false; throw new Error('Controlled room optimizer failure'); }
        return Array.from(files).map((_file, index) => `https://example.test/hotels/${propertySlug}/rooms/${exactRoomId}/room-upload-${store.tick}-${index}.webp`);
      },
      removeRoomGalleryUploads: async (propertySlug: string, exactRoomId: string, urls: string[]) => {
        store.mediaCleanup.push({ type: 'room', propertySlug, exactRoomId, urls: clone(urls) });
      },
      removePropertyGalleryUploads: async (propertySlug: string, urls: string[]) => {
        store.mediaCleanup.push({ type: 'property', propertySlug, urls: clone(urls) });
      },
    };
    root.HotelsV2WorkspaceRepository = {
      listProperties: async () => [],
      getWorkspace: async () => {
        if (store.failNextWorkspaceRead) {
          store.failNextWorkspaceRead = false;
          throw Object.assign(new Error('Controlled recovery read interruption'), {
            isAmbiguousOutcome: true, isDefinitiveFailure: false,
          });
        }
        return clone(store.workspace);
      },
      getContentControl: async () => contentControl(),
      getPartnerHotelPermissions: async () => permissionSnapshot(),
      createPropertyDraft: async (id: string, payload: any, correlationId: string) => {
        store.createdPropertyPlans.push({ id, payload: clone(payload), correlationId });
        return { ok: true, correlation_id: correlationId, workspace: clone(store.workspace) };
      },
      applyPropertyControlPlan: async (plan: any, correlationId: string) => {
        store.propertyPlans.push({ plan: clone(plan), correlationId });
        const ambiguousMode = store.nextPropertyAmbiguous;
        store.nextPropertyAmbiguous = null;
        if (ambiguousMode === 'before') {
          throw Object.assign(new Error('Controlled transport interruption before property commit'), {
            isAmbiguousOutcome: true, isDefinitiveFailure: false,
          });
        }
        if (store.nextPropertyStale) {
          const staleMode = store.nextPropertyStale;
          store.nextPropertyStale = null;
          if (staleMode === 'overlap') store.workspace.property.city = 'Concurrent City';
          else store.workspace.property.address_line = 'Concurrent address';
          store.workspace.property.updated_at = timestamp();
          throw Object.assign(new Error('Controlled stale property snapshot'), { code: 'PT409', isStale: true, isDefinitiveFailure: true });
        }
        const privateFields = new Set([
          'maximum_stay_nights', 'guest_instructions_i18n', 'check_in_instructions_i18n',
          'check_out_instructions_i18n', 'internal_operational_notes',
        ]);
        let publicChanged = false;
        let privateChanged = false;
        for (const [field, value] of Object.entries(plan.payload)) {
          if (privateFields.has(field)) { store.profile[field] = clone(value); privateChanged = true; }
          else { store.workspace.property[field] = clone(value); publicChanged = true; }
          if (field === 'title_i18n') store.workspace.property.title = clone(value);
          if (field === 'description_i18n') store.workspace.property.description = clone(value);
        }
        if (publicChanged) store.workspace.property.updated_at = timestamp();
        if (privateChanged) {
          store.profile.exists = true; store.profile.version += 1; store.profile.updated_at = timestamp();
        }
        if (ambiguousMode === 'after') {
          throw Object.assign(new Error('Controlled transport interruption after property commit'), {
            isAmbiguousOutcome: true, isDefinitiveFailure: false,
          });
        }
        return {
          ok: true, contract_version: plan.contract_version, hotel_id: hotelId, correlation_id: correlationId,
          workspace: clone(store.workspace), content_control: contentControl(),
        };
      },
      applyRoomControlPlan: async (plan: any, correlationId: string) => {
        store.roomPlans.push({ plan: clone(plan), correlationId });
        const operation = plan.operation;
        const rooms = store.workspace.room_types;
        const existingIndex = rooms.findIndex((room: any) => room.id === operation.id);
        const ambiguousMode = store.nextRoomAmbiguous;
        store.nextRoomAmbiguous = null;
        if (ambiguousMode === 'before') {
          throw Object.assign(new Error('Controlled transport interruption before Room commit'), {
            isAmbiguousOutcome: true, isDefinitiveFailure: false,
          });
        }
        if (store.nextRoomStale && operation.type === 'update') {
          const staleMode = store.nextRoomStale;
          store.nextRoomStale = null;
          if (staleMode === 'overlap') rooms[existingIndex].floor_label_i18n = { en: 'Concurrent floor' };
          else rooms[existingIndex].description_i18n = { en: 'Concurrent room description' };
          rooms[existingIndex].version += 1;
          rooms[existingIndex].updated_at = timestamp();
          throw Object.assign(new Error('Controlled stale Room snapshot'), { code: 'PT409', isStale: true, isDefinitiveFailure: true });
        }
        if (operation.type === 'disable') {
          rooms[existingIndex] = { ...rooms[existingIndex], status: 'disabled', version: rooms[existingIndex].version + 1, updated_at: timestamp() };
        } else if (operation.type === 'update') {
          rooms[existingIndex] = { ...rooms[existingIndex], ...clone(operation.payload), version: rooms[existingIndex].version + 1, updated_at: timestamp() };
        } else if (operation.type === 'duplicate') {
          const source = rooms.find((room: any) => room.id === operation.payload.source_id);
          const { source_id: _sourceId, ...payload } = clone(operation.payload);
          rooms.push({ ...clone(source), ...payload, id: operation.id, hotel_id: hotelId, status: 'draft', inventory_mode: 'pooled', base_inventory_count: 0, version: 1, created_at: timestamp(), updated_at: timestamp() });
        } else {
          rooms.push({ ...clone(operation.payload), id: operation.id, hotel_id: hotelId, status: 'draft', version: 1, created_at: timestamp(), updated_at: timestamp() });
        }
        if (ambiguousMode === 'after' || ambiguousMode === 'after-unrelated') {
          if (ambiguousMode === 'after-unrelated') {
            rooms[existingIndex].description_i18n = { en: 'Independent concurrent description' };
            rooms[existingIndex].version += 1;
            rooms[existingIndex].updated_at = timestamp();
          }
          throw Object.assign(new Error('Controlled transport interruption after Room commit'), {
            isAmbiguousOutcome: true, isDefinitiveFailure: false,
          });
        }
        return {
          ok: true, contract_version: plan.contract_version, hotel_id: hotelId, room_type_id: operation.id,
          correlation_id: correlationId, workspace: clone(store.workspace),
        };
      },
      applyOperationalAssignmentPlan: async (plan: any, correlationId: string) => {
        store.assignmentPlans.push({ plan: clone(plan), correlationId });
        const operation = plan.operation;
        if (operation.type === 'assign') {
          store.assignments.push({
            assignment_id: operation.assignment_id, partner_id: operation.partner_id, staff_scope_count: 0,
            staff_scope_ids: [], permission_exists: false,
            permission: { exists: false, version: 0, updated_at: null, capabilities: clone(capabilities), has_mutation_capability: false },
          });
        } else store.assignments = store.assignments.filter((entry: any) => entry.assignment_id !== operation.assignment_id);
        store.tick += 1;
        return {
          ok: true, contract_version: plan.contract_version, hotel_id: hotelId,
          assignment_id: operation.assignment_id, partner_id: operation.partner_id, operation: operation.type,
          correlation_id: correlationId, content_control: contentControl(),
        };
      },
    };
  }, { hotelId: HOTEL_ID, roomId: ROOM_ID, partnerA: PARTNER_A, partnerB: PARTNER_B, assignmentA: ASSIGNMENT_A });
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace.js') });
  await page.evaluate(() => {
    const root = window as any;
    const api = root.HotelsV2Workspace;
    api.state.workspace = root.__adminB.workspace;
    api.state.contentControl = {
      contract_version: 'hotels_v2_admin_b_content_control_v1', hotel_id: api.state.workspace.property.id,
      property_updated_at: api.state.workspace.property.updated_at,
      architecture_version: 'legacy', feature_flags: JSON.parse(JSON.stringify(api.state.workspace.flags)),
      commercial_owner: {
        partner_id: api.state.workspace.property.owner_partner_id,
        name: 'Commercial Owner A', status: 'active', can_manage_hotels: true,
      },
      operational_profile: JSON.parse(JSON.stringify(root.__adminB.profile)),
      assignment_snapshot: {
        contract_version: root.HotelsV2WorkspaceCore.H3_2A_PARTNER_PERMISSIONS_CONTRACT,
        property: { id: api.state.workspace.property.id, updated_at: api.state.workspace.property.updated_at, architecture_version: 'legacy', is_published: true, status: 'active' },
        feature_flags: JSON.parse(JSON.stringify(api.state.workspace.flags)),
        capability_catalog: [...root.HotelsV2WorkspaceCore.HOTEL_PARTNER_CAPABILITIES],
        assignment_fingerprint: 'initial-assignment', permissions_fingerprint: 'initial-permissions', snapshot_token: 'initial-snapshot',
        assignments: root.__adminB.assignments.map((entry: any) => ({
          ...JSON.parse(JSON.stringify(entry)), hotel_id: api.state.workspace.property.id, assignment_active: true,
          partner: api.state.workspace.partners.find((partner: any) => partner.id === entry.partner_id),
        })),
      },
    };
    api.state.partnerPermissions = api.state.contentControl.assignment_snapshot;
    api.state.activeTab = 'overview';
    api.init();
    api.renderWorkspace();
  });
}

test('ADMIN-B desktop property Review persists private content and tabs support roving keyboard focus', async ({ page }) => {
  await installAdminBHarness(page, { width: 1366, height: 900 });
  const overviewTab = page.locator('[data-hotel-workspace-tab="overview"]');
  await expect(overviewTab).toHaveAttribute('tabindex', '0');
  await overviewTab.focus();
  await overviewTab.press('ArrowRight');
  await expect(page.locator('[data-hotel-workspace-tab="rooms"]')).toBeFocused();
  await expect(page.locator('#hotelWorkspaceActivePanel')).toHaveAttribute('aria-labelledby', 'hotelWorkspaceTab-rooms');
  await page.locator('[data-hotel-workspace-tab="rooms"]').press('Home');
  await expect(page.locator('[data-hotel-workspace-tab="overview"]')).toBeFocused();

  await expect(page.locator('[name="title_he"]')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#hotelWorkspaceOverviewForm .hotel-workspace-locked-fields')).not.toContainText(HOTEL_ID);
  await expect(page.locator('#hotelWorkspaceOverviewForm details.hotel-review-diagnostics')).toContainText(HOTEL_ID);
  for (const invalidMapsUrl of ['https://maps.google.com:444/maps/x', 'https://maps.google.abc/maps/x']) {
    await page.locator('[name="google_maps_url"]').fill(invalidMapsUrl);
    await page.locator('button[form="hotelWorkspaceOverviewForm"]').click();
    await expect(page.locator('.hotel-workspace-modal')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__adminB.propertyPlans.length)).toBe(0);
    expect(await page.evaluate(() => (window as any).__adminB.toasts.at(-1)?.message)).toMatch(/supported Google Maps domain/i);
  }
  await page.locator('[name="google_maps_url"]').fill('https://maps.google.com/example');
  await page.evaluate(() => { (window as any).__adminB.toasts = []; });
  await page.locator('[name="city"]').fill('Paphos');
  await page.locator('[name="guest_instructions_en"]').fill('Welcome after Review');
  await page.locator('button[form="hotelWorkspaceOverviewForm"]').click();
  expect(await page.evaluate(() => (window as any).__adminB.toasts)).toEqual([]);
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review property changes');
  await expect(review).toContainText('guest instructions');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  await expect(page.locator('[name="city"]')).toHaveValue('Paphos');
  await expect(page.locator('[name="guest_instructions_en"]')).toHaveValue('Welcome after Review');
  const result = await page.evaluate(() => {
    const store = (window as any).__adminB;
    return { receipt: store.propertyPlans[0], architecture: store.workspace.property.architecture_version, flags: store.workspace.flags };
  });
  expect(result.receipt.plan.payload).toMatchObject({ city: 'Paphos', guest_instructions_i18n: { en: 'Welcome after Review' } });
  expect(result.receipt.plan.expected_original).toMatchObject({ city: 'Lefkara', guest_instructions_i18n: { en: 'Welcome' } });
  expect(result.receipt.plan.expected_operational_profile_version).toBe(2);
  expect(result.architecture).toBe('legacy');
  expect(Object.values(result.flags).every((value) => value === false)).toBe(true);
  await expectNoUnexplainedBrowserErrors(page);
});

test('ADMIN-B mobile/RTL Room editor persists ordered gallery, duplicates inertly, disables and explicitly reactivates', async ({ page }) => {
  await installAdminBHarness(page, { width: 390, height: 844, rtl: true });
  await page.locator('[data-hotel-workspace-tab="rooms"]').click();
  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  const editor = page.locator('.hotel-workspace-modal');
  await expect(editor.locator('[name="name_he"]')).toHaveAttribute('dir', 'rtl');
  const bounds = await editor.locator('.hotel-workspace-modal__dialog').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await editor.locator('[name="floor_label_he"]').fill('קומה עליונה');
  await editor.locator('[data-gallery-move="1"]').first().click();
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  let review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('floor label');
  await expect(review.locator('img')).toHaveCount(4);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  let result = await page.evaluate(() => (window as any).__adminB.roomPlans[0].plan.operation);
  expect(result.payload.floor_label_i18n.he).toBe('קומה עליונה');
  expect(result.payload.gallery).toEqual(['https://example.test/shared-b.webp', 'https://example.test/shared-a.webp']);
  expect(result.expected_original.gallery).toEqual(['https://example.test/shared-a.webp', 'https://example.test/shared-b.webp']);

  await page.locator(`[data-duplicate-room="${ROOM_ID}"]`).click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('pooled inventory set to 0');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  result = await page.evaluate(() => (window as any).__adminB.roomPlans[1].plan.operation);
  expect(result.type).toBe('duplicate');
  expect(result.payload.status).toBe('draft');
  expect(result.payload.inventory_mode).toBe('pooled');
  expect(result.payload.base_inventory_count).toBe(0);

  await page.locator(`[data-disable-room="${ROOM_ID}"]`).click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('server will recheck exact allocations');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  await expect(page.locator(`[data-room-id="${ROOM_ID}"]`)).toContainText('DISABLED');

  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  const status = page.locator('#hotelRoomEditorForm [name="status"]');
  await expect(status).toHaveValue('');
  await status.selectOption('draft');
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('status');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(page.locator(`[data-room-id="${ROOM_ID}"]`)).toContainText('DRAFT');
  await expectNoUnexplainedBrowserErrors(page);
});

test('ADMIN-B operational assignment Review separates owner and binds zero scopes/capabilities', async ({ page }) => {
  await installAdminBHarness(page, { width: 1180, height: 820 });
  await page.locator('[data-hotel-workspace-tab="partner"]').click();
  const panel = page.locator('#hotelWorkspaceActivePanel');
  await expect(panel).toContainText('Commercial owner');
  await expect(panel).toContainText('Operational assignments');
  await panel.locator('[data-add-operational-assignment]').click();
  await page.locator('#hotelOperationalAssignmentForm [name="partner_id"]').selectOption(PARTNER_B);
  await page.locator('button[form="hotelOperationalAssignmentForm"]').click();
  expect(await page.evaluate(() => (window as any).__adminB.toasts)).toEqual([]);
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('No scope granted automatically');
  await expect(review).toContainText('No capability row or capability is granted automatically');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  await expect(panel).toContainText('2 assignments');
  const result = await page.evaluate(() => (window as any).__adminB.assignmentPlans[0].plan);
  expect(result.operation).toMatchObject({
    type: 'assign', partner_id: PARTNER_B, expected_staff_scope_count: 0,
    expected_staff_scope_ids: [], expected_permission_exists: false,
  });

  await panel.locator(`[data-remove-operational-assignment="${ASSIGNMENT_A}"]`).click();
  const removalReview = page.locator('.hotel-workspace-modal--review');
  await expect(removalReview).toContainText('Removal revokes exactly 1 staff Hotel scope');
  await expect(removalReview).toContainText('Property content');
  await expect(removalReview).toContainText('Historical bookings and fulfillment routing are never rewritten');
  await removalReview.locator('[data-hotel-review-confirm]').click();
  await expect(removalReview).toHaveCount(0);
  const removal = await page.evaluate(() => (window as any).__adminB.assignmentPlans[1].plan.operation);
  expect(removal).toMatchObject({
    type: 'remove', assignment_id: ASSIGNMENT_A, partner_id: PARTNER_A,
    expected_staff_scope_count: 1,
    expected_staff_scope_ids: ['66666666-6666-4666-8666-666666666666'],
    expected_permission_exists: true,
  });
  await expect(panel).toContainText('1 assignment');
  await expectNoUnexplainedBrowserErrors(page);
});

test('ADMIN-B normal Room create and repeated gallery remove, restore and reorder stay in the Room editor', async ({ page }) => {
  await installAdminBHarness(page, { width: 1280, height: 860 });
  await page.locator('[data-hotel-workspace-tab="rooms"]').click();

  await page.locator('[data-add-room]').click();
  let editor = page.locator('#hotelRoomEditorForm');
  await editor.locator('[name="code"]').fill('garden-suite');
  await editor.locator('[name="name_en"]').fill('Garden Suite');
  await editor.locator('[name="name_pl"]').fill('Apartament ogrodowy');
  await editor.locator('[name="name_he"]').fill('סוויטת גן');
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  let review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review new Room Type');
  await expect(review).toContainText('draft');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  const created = await page.evaluate(() => (window as any).__adminB.roomPlans[0].plan.operation);
  expect(created.type).toBe('create');
  expect(created.payload).toMatchObject({ code: 'garden-suite', status: 'draft' });
  expect(created.expected_original).toEqual({});

  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  editor = page.locator('#hotelRoomEditorForm');
  await editor.locator('[data-gallery-remove]').first().click();
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('gallery');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);

  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  editor = page.locator('#hotelRoomEditorForm');
  await editor.locator('.hotel-property-photo-picker summary').click();
  await editor.locator('input[name="property_gallery_photo"][value="https://example.test/shared-a.webp"]').check();
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review.locator('img')).toHaveCount(3);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);

  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  editor = page.locator('#hotelRoomEditorForm');
  await editor.locator('[data-gallery-move="-1"]').last().click();
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  const galleryPlans = await page.evaluate(() => (window as any).__adminB.roomPlans.slice(1).map((entry: any) => entry.plan.operation));
  expect(galleryPlans.map((operation: any) => operation.payload.gallery)).toEqual([
    ['https://example.test/shared-b.webp'],
    ['https://example.test/shared-b.webp', 'https://example.test/shared-a.webp'],
    ['https://example.test/shared-a.webp', 'https://example.test/shared-b.webp'],
  ]);
  expect(galleryPlans.every((operation: any) => operation.type === 'update')).toBe(true);
  await expectNoUnexplainedBrowserErrors(page);
});

test('ADMIN-B exact Room upload retains the editor on optimizer failure and persists only after explicit retry', async ({ page }) => {
  await installAdminBHarness(page, { width: 1180, height: 820 });
  await page.locator('[data-hotel-workspace-tab="rooms"]').click();
  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  const editor = page.locator('#hotelRoomEditorForm');
  await editor.locator('input[name="room_gallery_files"]').setInputFiles({
    name: 'reviewed-room.png', mimeType: 'image/png', buffer: Buffer.from('reviewed room image bytes'),
  });
  await page.evaluate(() => { (window as any).__adminB.failNextRoomUpload = true; });
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  await expect(editor).toBeVisible();
  await expect(editor.locator('input[name="room_gallery_files"]')).toHaveValue(/reviewed-room\.png/);
  expect(await page.evaluate(() => (window as any).__adminB.roomPlans.length)).toBe(0);

  await page.locator('button[form="hotelRoomEditorForm"]').click();
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('room-upload-0-0.webp');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  const uploadResult = await page.evaluate(() => {
    const store = (window as any).__adminB;
    return {
      uploads: store.mediaUploads.filter((entry: any) => entry.type === 'room'),
      cleanup: store.mediaCleanup,
      operation: store.roomPlans[0].plan.operation,
    };
  });
  expect(uploadResult.uploads).toEqual([
    { type: 'room', propertySlug: 'reviewed-hotel', exactRoomId: ROOM_ID, files: ['reviewed-room.png'] },
    { type: 'room', propertySlug: 'reviewed-hotel', exactRoomId: ROOM_ID, files: ['reviewed-room.png'] },
  ]);
  expect(uploadResult.cleanup).toEqual([]);
  const uploadedRoomUrl = uploadResult.operation.payload.gallery.at(-1);
  expect(uploadedRoomUrl).toMatch(new RegExp(`/hotels/reviewed-hotel/rooms/${ROOM_ID}/room-upload-[0-9]+-0\\.webp$`));
  expect(uploadResult.operation.expected_original.gallery).toEqual(['https://example.test/shared-a.webp', 'https://example.test/shared-b.webp']);
  await expectNoUnexplainedBrowserErrors(page);
});

test('ADMIN-B property media upload failure retains the editor, then reviewed reorder/remove/upload persists', async ({ page }) => {
  await installAdminBHarness(page, { width: 1180, height: 820 });
  await page.locator('[data-hotel-workspace-tab="content"]').click();
  await page.locator('[data-edit-property-media]').click();
  const form = page.locator('#hotelPropertyMediaForm');
  await form.locator('[data-gallery-move="1"]').first().click();
  await form.locator('[data-gallery-remove]').last().click();
  await form.locator('input[name="property_gallery_files"]').setInputFiles({
    name: 'reviewed-property.png', mimeType: 'image/png', buffer: Buffer.from('reviewed image bytes'),
  });
  await page.evaluate(() => { (window as any).__adminB.failNextPropertyUpload = true; });
  await page.locator('button[form="hotelPropertyMediaForm"]').click();
  await expect(form).toBeVisible();
  await expect(form.locator('[data-gallery-item].is-removed')).toHaveCount(1);
  await expect(form.locator('input[name="property_gallery_files"]')).toHaveValue(/reviewed-property\.png/);
  expect(await page.evaluate(() => (window as any).__adminB.propertyPlans.length)).toBe(0);

  await page.locator('button[form="hotelPropertyMediaForm"]').click();
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review property media changes');
  await expect(review.locator('img')).toHaveCount(6);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  const result = await page.evaluate(() => {
    const store = (window as any).__adminB;
    return { plan: store.propertyPlans[0].plan, uploads: store.mediaUploads, cleanup: store.mediaCleanup };
  });
  expect(result.uploads).toHaveLength(2);
  expect(result.cleanup).toEqual([]);
  expect(result.plan.payload.photos).toEqual([
    'https://example.test/shared-b.webp',
    'https://example.test/property-upload-0-0.webp',
  ]);
  expect(result.plan.payload.cover_image_url).toBe('https://example.test/shared-b.webp');
  await expectNoUnexplainedBrowserErrors(page);
});

test('ADMIN-B ambiguous media saves reconcile before and after commit without retrying or orphaning uploads', async ({ page }) => {
  await installAdminBHarness(page, { width: 1180, height: 820 });

  await page.locator('[data-hotel-workspace-tab="content"]').click();
  await page.locator('[data-edit-property-media]').click();
  await page.locator('#hotelPropertyMediaForm input[name="property_gallery_files"]').setInputFiles({
    name: 'ambiguous-property.png', mimeType: 'image/png', buffer: Buffer.from('ambiguous property image'),
  });
  await page.locator('button[form="hotelPropertyMediaForm"]').click();
  let review = page.locator('.hotel-workspace-modal--review');
  await expect(page.locator('.hotel-workspace-modal')).toHaveCount(1);
  await page.evaluate(() => {
    (window as any).__adminB.nextPropertyAmbiguous = 'before';
    (window as any).__adminB.failNextWorkspaceRead = true;
  });
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review.locator('[data-hotel-review-confirm]')).toHaveText('Check current state');
  await expect(review.locator('[data-hotel-modal-close]').first()).toHaveAttribute('aria-disabled', 'true');
  await expect(review.locator('button[data-hotel-modal-close]').first()).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(review).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__adminB.propertyPlans.length)).toBe(1);
  await review.locator('[data-hotel-review-confirm]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review fresh property changes');
  expect(await page.evaluate(() => (window as any).__adminB.propertyPlans.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__adminB.mediaCleanup)).toEqual([]);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  const propertyResult = await page.evaluate(() => ({
    plans: (window as any).__adminB.propertyPlans.length,
    uploads: (window as any).__adminB.mediaUploads.filter((entry: any) => entry.type === 'property').length,
    cleanup: (window as any).__adminB.mediaCleanup,
    photos: (window as any).__adminB.workspace.property.photos,
  }));
  expect(propertyResult.plans).toBe(2);
  expect(propertyResult.uploads).toBe(1);
  expect(propertyResult.cleanup).toEqual([]);
  expect(propertyResult.photos).toContain('https://example.test/property-upload-0-0.webp');

  await page.locator('[data-hotel-workspace-tab="rooms"]').click();
  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  await expect(page.locator('#hotelRoomEditorForm label').filter({ hasText: 'Exact Room Type ID' })).toHaveCount(0);
  await expect(page.locator('#hotelRoomEditorForm details.hotel-review-diagnostics')).toContainText(ROOM_ID);
  await page.locator('#hotelRoomEditorForm input[name="room_gallery_files"]').setInputFiles({
    name: 'ambiguous-room.png', mimeType: 'image/png', buffer: Buffer.from('ambiguous room image'),
  });
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(page.locator('.hotel-workspace-modal')).toHaveCount(1);
  await page.evaluate(() => { (window as any).__adminB.nextRoomAmbiguous = 'after-unrelated'; });
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  const roomResult = await page.evaluate(() => ({
    plans: (window as any).__adminB.roomPlans.length,
    uploads: (window as any).__adminB.mediaUploads.filter((entry: any) => entry.type === 'room').length,
    cleanup: (window as any).__adminB.mediaCleanup,
    room: (window as any).__adminB.workspace.room_types.find((room: any) => room.id === '22222222-2222-4222-8222-222222222222'),
  }));
  expect(roomResult.plans).toBe(1);
  expect(roomResult.uploads).toBe(1);
  expect(roomResult.cleanup).toEqual([]);
  expect(roomResult.room.gallery.some((url: string) => url.includes(`/rooms/${ROOM_ID}/room-upload-`))).toBe(true);
  expect(roomResult.room.description_i18n).toEqual({ en: 'Independent concurrent description' });
  await expectNoUnexplainedBrowserErrors(page);
});

test('ADMIN-B property and Room stale paths require a fresh explicit Review and never auto retry', async ({ page }) => {
  await installAdminBHarness(page, { width: 1280, height: 860 });
  await page.locator('[name="city"]').fill('Paphos');
  await page.locator('button[form="hotelWorkspaceOverviewForm"]').click();
  let review = page.locator('.hotel-workspace-modal--review');
  await page.evaluate(() => { (window as any).__adminB.nextPropertyStale = 'overlap'; });
  await review.locator('[data-hotel-review-confirm]').click();
  let conflict = page.locator('.hotel-workspace-modal--review').filter({ hasText: 'Resolve property conflict' });
  await expect(conflict).toContainText('Concurrent City');
  expect(await page.evaluate(() => (window as any).__adminB.propertyPlans.length)).toBe(1);
  await conflict.locator('[data-property-conflict-use-reviewed]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review fresh property changes');
  expect(await page.evaluate(() => (window as any).__adminB.propertyPlans.length)).toBe(1);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminB.propertyPlans.length)).toBe(2);
  await expect(page.locator('[name="city"]')).toHaveValue('Paphos');

  await page.locator('[data-hotel-workspace-tab="rooms"]').click();
  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  await page.locator('#hotelRoomEditorForm [name="floor_label_en"]').fill('Reviewed non-overlap floor');
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await page.evaluate(() => { (window as any).__adminB.nextRoomStale = 'nonoverlap'; });
  await review.locator('[data-hotel-review-confirm]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review fresh Room Type changes');
  expect(await page.evaluate(() => (window as any).__adminB.roomPlans.length)).toBe(1);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminB.roomPlans.length)).toBe(2);

  await page.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  await page.locator('#hotelRoomEditorForm [name="floor_label_en"]').fill('My overlapping floor');
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await page.evaluate(() => { (window as any).__adminB.nextRoomStale = 'overlap'; });
  await review.locator('[data-hotel-review-confirm]').click();
  conflict = page.locator('.hotel-workspace-modal--review').filter({ hasText: 'Resolve Room Type conflict' });
  await expect(conflict).toContainText('Concurrent floor');
  expect(await page.evaluate(() => (window as any).__adminB.roomPlans.length)).toBe(3);
  await conflict.locator('[data-room-conflict-use-reviewed]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review fresh Room Type changes');
  expect(await page.evaluate(() => (window as any).__adminB.roomPlans.length)).toBe(3);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminB.roomPlans.length)).toBe(4);
  await expectNoUnexplainedBrowserErrors(page);
});

test('ADMIN-B new Property Review includes exact country, timezone and currency without submit fallbacks', async ({ page }) => {
  await installAdminBHarness(page, { width: 1024, height: 768 });
  await page.locator('#btnAddHotel').click();
  const form = page.locator('#hotelNewPropertyForm');
  await expect(form.locator('label').filter({ hasText: 'Exact property ID' })).toHaveCount(0);
  await expect(form.locator('details.hotel-review-diagnostics')).toContainText(/99999999-9999-4999-8999-/);
  await expect(form.locator('[name="timezone"]')).toHaveValue('');
  await expect(form.locator('[name="currency"]')).toHaveValue('');
  await form.locator('[name="title_en"]').fill('Exact Location Hotel');
  await form.locator('[name="city"]').fill('Warsaw');
  await form.locator('[name="country"]').fill('Poland');
  await form.locator('[name="timezone"]').fill('Europe/Warsaw');
  await form.locator('[name="currency"]').fill('PLN');
  await page.locator('button[form="hotelNewPropertyForm"]').click();
  const review = page.locator('.hotel-workspace-modal');
  await expect(review).toContainText('Review new property draft');
  await expect(review).toContainText('Poland');
  await expect(review).toContainText('Europe/Warsaw');
  await expect(review).toContainText('PLN');
  await expectNoUnexplainedBrowserErrors(page);
});
