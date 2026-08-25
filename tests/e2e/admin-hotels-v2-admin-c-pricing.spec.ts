import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const SEVEN_KAMARES_ID = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const ROOM_1 = '22222222-2222-4222-8222-222222222221';
const ROOM_2 = '22222222-2222-4222-8222-222222222222';
const ROOM_3 = '22222222-2222-4222-8222-222222222223';
const PLAN_ID = '33333333-3333-4333-8333-333333333333';
const PLAN_2 = '33333333-3333-4333-8333-333333333334';
const RATE_1 = '44444444-4444-4444-8444-444444444441';
const RATE_2 = '44444444-4444-4444-8444-444444444442';
const RATE_3 = '44444444-4444-4444-8444-444444444443';
const DEFAULT_ID = '55555555-5555-4555-8555-555555555555';
const ALLOCATION_ID = '66666666-6666-4666-8666-666666666666';
const ALLOCATION_ITEM_ID = '66666666-6666-4666-8666-666666666667';
const SCHEDULE_1 = '77777777-7777-4777-8777-777777777771';
const SCHEDULE_2 = '77777777-7777-4777-8777-777777777772';
const SCHEDULE_3 = '77777777-7777-4777-8777-777777777773';
const TIER_1 = '88888888-8888-4888-8888-888888888881';
const TIER_2 = '88888888-8888-4888-8888-888888888882';
const TIER_3 = '88888888-8888-4888-8888-888888888883';
const RULE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const EXACT_PRICE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const PRICE_CORRELATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
const UPDATED_AT = '2026-08-21T09:30:00.000Z';
const SNAPSHOT = 'a'.repeat(64);
const MD5_A = 'b'.repeat(32);
const MD5_B = 'c'.repeat(32);
const MD5_C = 'd'.repeat(32);

type BrowserIssues = { console: string[]; page: string[]; requests: string[] };
const browserIssues = new WeakMap<Page, BrowserIssues>();

async function expectNoBrowserIssues(page: Page): Promise<void> {
  await page.waitForTimeout(20);
  expect(browserIssues.get(page)).toEqual({ console: [], page: [], requests: [] });
}

async function installPricingHarness(page: Page, options: {
  width?: number;
  height?: number;
  rtl?: boolean;
  locale?: 'en' | 'pl' | 'he';
  sevenKamares?: boolean;
} = {}): Promise<void> {
  const issues: BrowserIssues = { console: [], page: [], requests: [] };
  browserIssues.set(page, issues);
  page.on('console', (message) => { if (message.type() === 'error') issues.console.push(message.text()); });
  page.on('pageerror', (error) => issues.page.push(error.message));
  page.on('requestfailed', (request) => issues.requests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  await page.setViewportSize({ width: options.width || 1366, height: options.height || 900 });
  const locale = options.locale || (options.rtl ? 'he' : 'en');
  const direction = options.rtl || locale === 'he' ? 'rtl' : 'ltr';
  await page.setContent(`<!doctype html><html lang="${locale}" dir="${direction}"><head></head><body>
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
  await page.evaluate((fixture) => {
    const root = window as any;
    const Core = root.HotelsV2WorkspaceCore;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const hotelId = fixture.sevenKamares ? fixture.sevenKamaresId : fixture.hotelId;
    const architecture = fixture.sevenKamares ? 'legacy' : 'rooms_v2';
    const flags = {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    };
    const room = (id: string, code: string, en: string, he: string) => ({
      id, hotel_id: hotelId, code, name_i18n: { pl: en, en, he },
      status: 'draft', max_occupancy: 4, capacity_adults: 4, capacity_children: 0,
      children_policy_override: null, minimum_child_age_override: null,
      inventory_mode: 'pooled', base_inventory_count: 1,
      active_unit_count: 0,
      version: 2, updated_at: fixture.updatedAt,
    });
    const rate = (id: string, roomTypeId: string, scheduleId: string | null) => ({
      id, hotel_id: hotelId, room_type_id: roomTypeId, rate_plan_id: fixture.planId,
      pricing_schedule_id: scheduleId, base_nightly_rate: 0, currency: 'EUR',
      external_redirect_url: null, is_active: false, review_status: 'reviewed',
      lifecycle_status: 'inactive', review_basis: 'stored', sort_order: 100,
      version: 4, updated_at: fixture.updatedAt,
      pricing_source: scheduleId ? 'pricing_schedule' : 'property_default',
      base_nightly_rate_authoritative: false, independent_tiers: [],
      independent_tiers_fingerprint: fixture.md5a, immutable_contract: null,
      activation_blockers: [],
    });
    const schedule = (id: string, tierId: string, code: string, linked: string[]) => ({
      id, hotel_id: hotelId, code,
      name_i18n: { pl: 'Wspólny', en: code === 'shared' ? 'Shared schedule' : 'Alternative schedule', he: 'תעריף משותף' },
      application_scope: 'room_occupancy', currency: 'EUR', maximum_party_size: 4,
      minimum_billable_occupancy: 2, is_active: false, review_status: 'reviewed',
      lifecycle_status: 'inactive', source: 'manual', source_reference: {
        kind: 'manual', cloned_from_schedule_id: null, pricing_model: null,
        pricing_fingerprint: null, rule_count: null, guest_counts: null,
        migration_blocker: null,
      },
      version: 3, updated_at: fixture.updatedAt, linked_room_rate_ids: linked,
      link_fingerprint: fixture.md5b, sharing_mode: 'shared',
      tiers: [{ id: tierId, schedule_id: id, guest_count: 2, threshold_nights: 1,
        nightly_rate: 120, is_active: true, version: 2, updated_at: fixture.updatedAt }],
      tiers_fingerprint: fixture.md5c, immutable_contract: null, activation_blockers: [],
    });
    const control: any = {
      contract_version: 'hotels_v2_admin_c_pricing_control_v1', hotel_id: hotelId,
      property: { id: hotelId, updated_at: fixture.updatedAt, architecture_version: architecture,
        currency: 'EUR', minimum_stay_nights: 2, maximum_stay_nights: 30,
        children_policy: 'allowed', minimum_child_age: null,
        booking_mode: 'request_confirmation' },
      feature_flags: clone(flags),
      legacy_safety: { architecture_version: architecture,
        legacy_pricing_authoritative: architecture === 'legacy',
        legacy_pricing_rule_count: fixture.sevenKamares ? 63 : null,
        legacy_pricing_fingerprint: fixture.sevenKamares ? '7208ab4ecc0e47abd64d87ca1ac53a03' : null,
        public_change: false },
      snapshot_token: fixture.snapshot,
      rate_plans: [{ id: fixture.planId, hotel_id: hotelId, code: 'standard',
        name_i18n: { pl: 'Standard', en: 'Standard', he: 'סטנדרט' },
        description_i18n: { pl: 'Opis', en: 'Reviewed description', he: 'תיאור' },
        meal_plan_code: null, cancellation_policy: { type: 'flexible' },
        booking_mode_override: null, price_inclusions: ['taxes'], is_active: false,
        review_status: 'reviewed', lifecycle_status: 'inactive', review_basis: 'stored',
        sort_order: 100, version: 3, updated_at: fixture.updatedAt,
        immutable_contract: null, activation_blockers: [] },
        { id: fixture.plan2, hotel_id: hotelId, code: 'flexible-draft',
          name_i18n: { pl: 'Elastyczny', en: 'Flexible draft', he: 'טיוטה גמישה' },
          description_i18n: { pl: 'Opis', en: 'Draft description', he: 'תיאור' },
          meal_plan_code: null, cancellation_policy: { type: 'requires_review', reason: 'Commercial terms need review' },
          booking_mode_override: null, price_inclusions: [], is_active: false,
          review_status: 'requires_review', lifecycle_status: 'draft', review_basis: 'stored',
          sort_order: 200, version: 1, updated_at: fixture.updatedAt,
          immutable_contract: null, activation_blockers: ['cancellation_policy_requires_review'] }],
      room_types: [
        room(fixture.room1, 'upper', 'Upper Room', 'חדר עליון'),
        room(fixture.room2, 'studio', 'Studio', 'סטודיו'),
        room(fixture.room3, 'ground', 'Ground Room', 'חדר תחתון'),
      ],
      room_rates: [
        rate(fixture.rate1, fixture.room1, fixture.schedule1),
        rate(fixture.rate2, fixture.room2, null),
        rate(fixture.rate3, fixture.room3, fixture.schedule1),
      ],
      pricing_schedules: [
        schedule(fixture.schedule1, fixture.tier1, 'shared', [fixture.rate1, fixture.rate3]),
        schedule(fixture.schedule2, fixture.tier2, 'alternative', []),
        ...(fixture.sevenKamares ? [] : [{
          ...schedule(fixture.schedule3, fixture.tier3, 'provider', []),
          source: 'system',
          source_reference: { kind: 'system', cloned_from_schedule_id: null,
            pricing_model: null, pricing_fingerprint: null, rule_count: null,
            guest_counts: null, migration_blocker: null },
          immutable_contract: { locked: true, contract_version: 'pricing_source_provenance_v1', reason: 'nonmanual_source_read_only' },
          activation_blockers: ['nonmanual_source_read_only'],
        }]),
      ],
      rate_rules: [], exact_date_prices: [],
      allocation_rules: [{ id: fixture.allocationId, hotel_id: hotelId, code: 'two-guests',
        allocation_mode: 'required_bundle', min_guest_count: 2, max_guest_count: 2,
        is_active: true, review_status: 'reviewed', lifecycle_status: 'active', sort_order: 100,
        version: 2, updated_at: fixture.updatedAt, items_fingerprint: fixture.md5a,
        items: [{ id: fixture.allocationItemId, hotel_id: hotelId,
          allocation_rule_id: fixture.allocationId, room_type_id: fixture.room2,
          units_required: 1, allocated_guest_count: 2, pricing_guest_count: 2,
          allocated_guest_counts: [2], pricing_guest_counts: [2], sort_order: 100, version: 1 }],
        immutable_contract: null, activation_blockers: [] }],
      property_pricing_default: { id: fixture.defaultId, hotel_id: hotelId,
        nightly_rate: 100, currency: 'EUR', is_active: true, review_status: 'reviewed',
        lifecycle_status: 'active', version: 2, updated_at: fixture.updatedAt,
        immutable_contract: null, activation_blockers: [] },
      recent_activity: [],
    };
    const workspace = Core.normalizeWorkspace({
      property: { id: hotelId, slug: fixture.sevenKamares ? '7-ukow' : 'future-hotel',
        architecture_version: architecture,
        title: { pl: 'Hotel', en: fixture.sevenKamares ? '7 Kamares' : 'Future Hotel', he: 'מלון' },
        title_i18n: { pl: 'Hotel', en: fixture.sevenKamares ? '7 Kamares' : 'Future Hotel', he: 'מלון' },
        description: { en: 'Description' }, description_i18n: { en: 'Description' },
        city: 'Lefkara', timezone: 'Europe/Nicosia', currency: 'EUR',
        booking_mode: 'request_confirmation', children_policy: 'allowed',
        pricing_tiers: { rules: [] }, room_types: [], photos: [], amenities: [],
        status: 'draft', is_published: false, updated_at: fixture.updatedAt },
      room_types: control.room_types.map((entry: any) => ({ ...entry,
        description_i18n: { en: 'Room' }, gallery: [], bed_configuration: [], bathrooms: null,
        size_sqm: null, floor_label_i18n: {}, amenities: [], inventory_mode: 'pooled',
        base_inventory_count: 0, sort_order: 100, created_at: fixture.updatedAt })),
      units: [], rate_plans: clone(control.rate_plans), room_rates: clone(control.room_rates),
      pricing_schedules: clone(control.pricing_schedules),
      pricing_schedule_tiers: control.pricing_schedules.flatMap((entry: any) => clone(entry.tiers)),
      amenities_catalog: [], partners: [], operational_partners: [], payment_due: {},
      counts: { upcoming_bookings: 0, daily_inventory_by_room: {} }, flags: clone(flags), activity: [],
    });
    const store: any = { control, workspace, applyCalls: [], previewCalls: [], toasts: [] };
    root.__adminC = store;
    root.CE_HOTEL_PRICING = { normalizeHotelRoomTypes: () => [], getHotelMinPricePerNight: () => null };
    root.showToast = (message: string, type: string) => store.toasts.push({ message, type });
    root.HotelsV2WorkspaceRepository = {
      listProperties: async () => [],
      getPricingControl: async () => clone(store.control),
      applyPricingControlPlan: async (plan: any, correlationId: string, idempotencyKey: string) => {
        store.applyCalls.push({ plan: clone(plan), correlationId, idempotencyKey });
        return { contract_version: plan.contract_version, hotel_id: hotelId,
          correlation_id: correlationId, idempotency_key: idempotencyKey,
          replayed: false, changed: true, activity: [], pricing_control: clone(store.control) };
      },
      previewPricingQuote: async (request: any) => {
        store.previewCalls.push(clone(request));
        return {
          contract_version: request.contract_version, hotel_id: hotelId,
          snapshot_token: request.snapshot_token, ok: true, requestable: false,
          blocking_reasons: [], currency: 'EUR', check_in: request.check_in,
          check_out: request.check_out, nights: 1, adults: request.adults,
          child_ages: clone(request.child_ages), guest_count: request.adults + request.child_ages.length,
          allocation: [{ allocation_rule_id: fixture.allocationId, allocation_mode: 'required_bundle',
            room_type_id: fixture.room2, units_required: 1, allocated_guest_count: 2,
            pricing_guest_count: 2, allocated_guest_counts: [2], pricing_guest_counts: [2] }],
          products: [{ room_type_id: fixture.room2, room_rate_id: fixture.rate2,
            rate_plan_id: fixture.planId, unit_sequence: 1, allocated_guest_count: 2,
            requested_pricing_guest_count: 2, resolved_pricing_guest_count: 2,
            minimum_billable_occupancy: 2, base_pricing_source: 'property_default',
            base_pricing_source_id: fixture.defaultId, los_threshold_nights: null,
            subtotal: 100, currency: 'EUR', booking_mode: 'request_confirmation',
            cancellation_policy: { type: 'flexible' }, price_inclusions: ['taxes'],
            effective_minimum_stay: 2, effective_maximum_stay: 30, stay_allowed: true }],
          nightly_breakdown: [{ stay_date: request.check_in, room_type_id: fixture.room2,
            room_rate_id: fixture.rate2, rate_plan_id: fixture.planId, unit_sequence: 1,
            allocated_guest_count: 2, requested_pricing_guest_count: 2,
            resolved_pricing_guest_count: 2, minimum_billable_occupancy: 2,
            base_pricing_source: 'property_default', base_pricing_source_id: fixture.defaultId,
            los_threshold_nights: null, weekday_rule_id: null, seasonal_range_rule_id: null,
            exact_date_price_id: null, final_pricing_source: 'property_default',
            nightly_rate: 100, currency: 'EUR', effective_minimum_stay: 2,
            effective_maximum_stay: 30, minimum_stay_source: 'property',
            minimum_stay_source_id: hotelId, maximum_stay_source: 'property',
            maximum_stay_source_id: hotelId }],
          customer_total: 100,
          pricing_precedence: ['exact_date_price', 'seasonal_range_rule', 'weekday_rule',
            'pricing_schedule_tier', 'independent_occupancy_tier',
            'room_rate_base_nightly_rate', 'property_default'],
          legacy_authoritative: architecture === 'legacy', public_change: false,
        };
      },
    };
  }, {
    hotelId: HOTEL_ID, sevenKamaresId: SEVEN_KAMARES_ID, sevenKamares: Boolean(options.sevenKamares),
    room1: ROOM_1, room2: ROOM_2, room3: ROOM_3, planId: PLAN_ID, plan2: PLAN_2,
    rate1: RATE_1, rate2: RATE_2, rate3: RATE_3, defaultId: DEFAULT_ID,
    allocationId: ALLOCATION_ID, allocationItemId: ALLOCATION_ITEM_ID,
    schedule1: SCHEDULE_1, schedule2: SCHEDULE_2, schedule3: SCHEDULE_3,
    tier1: TIER_1, tier2: TIER_2, tier3: TIER_3,
    updatedAt: UPDATED_AT, snapshot: SNAPSHOT, md5a: MD5_A, md5b: MD5_B, md5c: MD5_C,
  });
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace.js') });
  await page.evaluate(() => {
    const root = window as any;
    const api = root.HotelsV2Workspace;
    api.state.workspace = root.__adminC.workspace;
    api.state.pricingControl = root.__adminC.control;
    api.state.pricingControlError = null;
    api.state.pricingControlLoading = false;
    api.state.activeTab = 'pricing';
    api.init();
    api.renderWorkspace();
  });
}

async function closeModal(page: Page): Promise<void> {
  await page.locator('.hotel-workspace-modal button[data-hotel-modal-close]').first().click();
  await expect(page.locator('.hotel-workspace-modal')).toHaveCount(0);
}

test('ADMIN-C desktop pricing uses explicit blank drafts and a focused server preview', async ({ page }) => {
  await installPricingHarness(page);
  await expect(page.locator('[data-hotel-workspace-tab="pricing"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Rates & Pricing');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Shared schedule authoritative');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Property fallback authoritative');
  await expect(page.locator('#hotelWorkspaceActivePanel')).not.toContainText('[object Object]');
  await expect(page.locator(`[data-edit-pricing-schedule="${SCHEDULE_3}"]`)).toHaveText('View read-only source');
  await expect(page.locator(`[data-clone-pricing-schedule="${SCHEDULE_3}"]`)).toHaveText('Clone as new manual draft');
  await page.locator(`[data-edit-pricing-schedule="${SCHEDULE_3}"]`).click();
  await expect(page.locator('.hotel-workspace-modal')).toContainText('protected object cannot be edited');
  await closeModal(page);
  await page.locator(`[data-clone-pricing-schedule="${SCHEDULE_3}"]`).click();
  await expect(page.locator('#hotelPricingScheduleCloneForm')).toContainText('new unlinked draft');
  await closeModal(page);
  await page.evaluate((scheduleId) => {
    const root = window as any;
    const schedule = root.__adminC.control.pricing_schedules.find((entry: any) => entry.id === scheduleId);
    schedule.code = 'x'.repeat(80);
    schedule.name_i18n = { pl: 'p'.repeat(240), en: 'e'.repeat(240), he: 'א'.repeat(240) };
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  }, SCHEDULE_3);
  await page.locator(`[data-clone-pricing-schedule="${SCHEDULE_3}"]`).click();
  await expect(page.locator('#hotelPricingScheduleCloneForm [name="code"]')).not.toHaveValue('x'.repeat(80));
  expect((await page.locator('#hotelPricingScheduleCloneForm [name="code"]').inputValue()).length).toBeLessThanOrEqual(80);
  expect((await page.locator('#hotelPricingScheduleCloneForm [name="name_en"]').inputValue()).length).toBeLessThanOrEqual(240);
  await closeModal(page);

  await page.locator('[data-add-pricing-plan]').click();
  await expect(page.locator('#hotelPricingPlanForm [name="code"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingPlanForm [name="name_en"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingPlanForm [name="cancellation_type"]')).toHaveValue('requires_review');
  await expect(page.locator('#hotelPricingPlanForm [name="cancellation_reason"]')).toHaveValue('');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('.hotel-workspace-modal--review')).toHaveCount(0);
  await closeModal(page);

  await page.locator('[data-add-pricing-schedule]').click();
  await expect(page.locator('#hotelPricingScheduleForm [name="sharing_mode"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingScheduleForm [name="maximum_party_size"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingScheduleForm [name="minimum_billable_occupancy"]')).toHaveValue('');
  await closeModal(page);

  await page.locator('[data-add-pricing-product]').click();
  await expect(page.locator('#hotelPricingProductForm [name="room_type_id"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingProductForm [name="rate_plan_id"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingProductForm [name="base_nightly_rate"]')).toHaveValue('');
  await expect(page.locator(`#hotelPricingProductForm [name="pricing_schedule_id"] option[value="${SCHEDULE_3}"]`)).toHaveAttribute('disabled', '');
  await closeModal(page);

  await page.locator('[data-add-pricing-rule]').click();
  await expect(page.locator('#hotelPricingRuleForm [name="room_rate_id"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingRuleForm [name="valid_from"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingRuleForm [name="nightly_rate"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingRuleForm [name="weekday"]:checked')).toHaveCount(0);
  await closeModal(page);

  await page.locator('[data-add-exact-price]').click();
  await expect(page.locator('#hotelExactDatePriceForm [name="room_rate_id"]')).toHaveValue('');
  await expect(page.locator('#hotelExactDatePriceForm [name="stay_date"]')).toHaveValue('');
  await expect(page.locator('#hotelExactDatePriceForm [name="nightly_rate_mode"]')).toHaveValue('');
  await expect(page.locator('#hotelExactDatePriceForm [name="reason"]')).toHaveValue('');
  await closeModal(page);

  await page.locator('[data-add-allocation-rule]').click();
  await expect(page.locator('#hotelPricingAllocationForm [name="allocation_mode"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingAllocationForm [name="min_guest_count"]')).toHaveValue('');
  await expect(page.locator('#hotelPricingAllocationForm [data-allocation-room]')).toHaveCount(0);
  await page.locator('#hotelPricingAllocationForm [data-add-allocation-item]').click();
  await expect(page.locator('#hotelPricingAllocationForm [data-allocation-room]').first()).toHaveValue('');
  await expect(page.locator(`#hotelPricingAllocationForm [data-allocation-room] option[value="${ROOM_1}"]`))
    .toContainText('capacity 4 · 1 pooled unit · child policy inherited');
  await closeModal(page);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(0);

  await page.locator('[data-preview-pricing]').click();
  await page.locator('#hotelPricingPreviewForm [name="check_in"]').fill('2026-09-01');
  await page.locator('#hotelPricingPreviewForm [name="check_out"]').fill('2026-09-02');
  await page.locator('#hotelPricingPreviewForm [name="adults"]').fill('2');
  await page.locator('#hotelPricingPreviewForm [name="rate_plan_id"]').selectOption(PLAN_ID);
  await page.locator('#hotelPricingPreviewForm [name="allocation_rule_id"]').selectOption(ALLOCATION_ID);
  await page.locator('button[form="hotelPricingPreviewForm"]').click();
  const resultHeading = page.locator('.hotel-pricing-preview-result h4');
  await expect(resultHeading).toHaveText(/€100/);
  await expect(resultHeading).toBeFocused();
  await expect(page.locator('.hotel-pricing-preview-result')).toContainText('exact date price → seasonal range rule → weekday rule → pricing schedule tier → independent occupancy tier → room rate base nightly rate → property default');
  expect(await page.evaluate(() => (window as any).__adminC.previewCalls.length)).toBe(1);
  await expectNoBrowserIssues(page);
});

test('ADMIN-C clone-for-product is one reviewed two-operation save and direct relink is blocked', async ({ page }) => {
  await installPricingHarness(page);
  await page.locator(`[data-clone-schedule-for-product="${RATE_1}"]`).click();
  const cloneForm = page.locator('#hotelPricingCloneForProductForm');
  await expect(cloneForm).toContainText('Ground Room · Standard');
  await cloneForm.locator('[name="shared_impact_acknowledged"]').check();
  await cloneForm.evaluate((form: HTMLFormElement) => form.requestSubmit());
  const cloneReview = page.locator('.hotel-workspace-modal--review');
  expect(await cloneReview.count(), JSON.stringify(await page.evaluate(() => ({
    toasts: (window as any).__adminC.toasts,
    planKeys: Object.keys((window as any).__adminC.control.rate_plans[0]).sort(),
  })))).toBe(1);
  await expect(cloneReview).toContainText('One atomic transaction');
  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  const cloneReceipt = await page.evaluate(() => (window as any).__adminC.applyCalls[0]);
  expect(cloneReceipt.plan.operations).toHaveLength(2);
  expect(cloneReceipt.plan.operations.map((operation: any) => [operation.entity, operation.action])).toEqual([
    ['pricing_schedule', 'clone'], ['room_rate', 'update'],
  ]);
  expect(cloneReceipt.plan.operations[1].payload.pricing_schedule_id).not.toBe(SCHEDULE_1);

  await page.locator(`[data-edit-pricing-product="${RATE_1}"]`).click();
  await page.locator('#hotelPricingProductForm [name="pricing_schedule_id"]').selectOption(SCHEDULE_2);
  await page.locator('#hotelPricingProductForm [name="shared_impact_acknowledged"]').check();
  await page.locator('#hotelPricingProductForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('.hotel-workspace-modal--review')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminC.toasts.at(-1)?.message)).toMatch(/Detach and Save/i);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(1);
  await closeModal(page);

  await page.locator(`[data-edit-pricing-product="${RATE_1}"]`).click();
  await page.locator('#hotelPricingProductForm [name="pricing_schedule_id"]').selectOption('');
  await page.locator('#hotelPricingProductForm [name="shared_impact_acknowledged"]').check();
  await page.locator('#hotelPricingProductForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('.hotel-workspace-modal--review')).toContainText('Schedule link impact reviewed');
  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  const detachReceipt = await page.evaluate(() => (window as any).__adminC.applyCalls[1]);
  expect(detachReceipt.plan.operations).toHaveLength(1);
  expect(detachReceipt.plan.operations[0]).toMatchObject({ entity: 'room_rate', action: 'update', payload: { pricing_schedule_id: null } });
  await expectNoBrowserIssues(page);
});

test('ADMIN-C schedule create, complete edit, standalone clone and direct tiers all reach one reviewed save', async ({ page }) => {
  await installPricingHarness(page);
  const confirm = async () => {
    await expect(page.locator('.hotel-workspace-modal--review')).toBeVisible();
    await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  };

  await page.locator('[data-add-pricing-schedule]').click();
  const create = page.locator('#hotelPricingScheduleForm');
  await create.locator('[name="code"]').fill('explicit-schedule');
  await create.locator('[name="sharing_mode"]').selectOption('independent');
  await create.locator('[name="maximum_party_size"]').fill('4');
  await create.locator('[name="minimum_billable_occupancy"]').fill('2');
  for (const [language, value] of [['pl', 'Cennik'], ['en', 'Explicit schedule'], ['he', 'תעריף מפורש']] as const) {
    await create.locator(`[name="name_${language}"]`).fill(value);
  }
  await create.locator('[data-add-pricing-tier]').click();
  const newTier = create.locator('[data-pricing-tier-row]');
  await newTier.locator('[data-tier-guest]').fill('2');
  await newTier.locator('[data-tier-threshold]').fill('1');
  await newTier.locator('[data-tier-rate]').fill('115.50');
  await create.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  let operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'pricing_schedule', action: 'create', payload: {
    code: 'explicit-schedule', sharing_mode: 'independent', maximum_party_size: 4,
    minimum_billable_occupancy: 2, lifecycle_status: 'draft',
  } });
  expect(operation.payload.tiers).toHaveLength(1);

  await page.locator(`[data-edit-pricing-schedule="${SCHEDULE_2}"]`).click();
  const edit = page.locator('#hotelPricingScheduleForm');
  await edit.locator('[name="name_en"]').fill('Alternative reviewed');
  await edit.locator('[name="maximum_party_size"]').fill('5');
  await edit.locator('[data-tier-rate]').fill('121');
  await edit.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'pricing_schedule', action: 'update', payload: {
    name_i18n: { en: 'Alternative reviewed' }, maximum_party_size: 5,
  } });
  expect(operation.payload.tiers[0].nightly_rate).toBe(121);

  await page.locator(`[data-clone-pricing-schedule="${SCHEDULE_2}"]`).click();
  await page.locator('#hotelPricingScheduleCloneForm [name="sharing_mode"]').selectOption('shared');
  await page.locator('#hotelPricingScheduleCloneForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'pricing_schedule', action: 'clone', payload: {
    source_schedule_id: SCHEDULE_2, sharing_mode: 'shared',
  } });
  expect(operation.payload.code).not.toBe('alternative');

  await page.locator(`[data-edit-product-tiers="${RATE_2}"]`).click();
  const tiers = page.locator('#hotelProductTierForm');
  await tiers.locator('[data-add-pricing-tier]').click();
  const directTier = tiers.locator('[data-pricing-tier-row]').last();
  await directTier.locator('[data-tier-guest]').fill('2');
  await directTier.locator('[data-tier-threshold]').fill('1');
  await directTier.locator('[data-tier-rate]').fill('125');
  await tiers.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'room_rate_tier_set', action: 'update', id: RATE_2 });
  expect(operation.payload.tiers).toHaveLength(1);
  await expectNoBrowserIssues(page);
});

test('ADMIN-C range, exact-date and allocation editors create and update exact reviewed rows', async ({ page }) => {
  await installPricingHarness(page);
  const confirm = async () => {
    await expect(page.locator('.hotel-workspace-modal--review')).toBeVisible();
    await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  };

  await page.locator('[data-add-pricing-rule]').click();
  const newRule = page.locator('#hotelPricingRuleForm');
  await newRule.locator('[name="room_rate_id"]').selectOption(RATE_2);
  await newRule.locator('[name="valid_from"]').fill('2026-10-01');
  await newRule.locator('[name="valid_to"]').fill('2026-10-31');
  await newRule.locator('[name="nightly_rate"]').fill('150');
  await newRule.locator('[name="priority"]').fill('25');
  await newRule.locator('[name="minimum_stay"]').fill('3');
  await newRule.locator('[name="weekday"][value="5"]').check();
  await newRule.locator('[name="weekday"][value="6"]').check();
  await newRule.locator('[name="is_active"]').check();
  await newRule.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  let operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'rate_rule', action: 'create', payload: {
    room_rate_id: RATE_2, valid_from: '2026-10-01', valid_to: '2026-10-31',
    weekdays: [5, 6], nightly_rate: 150, minimum_stay: 3, priority: 25, is_active: true,
  } });

  await page.evaluate((fixture) => {
    const root = window as any;
    root.__adminC.control.rate_rules = [{
      id: fixture.ruleId, hotel_id: fixture.hotelId, room_rate_id: fixture.rateId,
      valid_from: '2026-10-01', valid_to: '2026-10-31', weekdays: [5, 6],
      nightly_rate: 150, minimum_stay: 3, maximum_stay: null,
      closed_to_arrival: false, closed_to_departure: false, priority: 25,
      is_active: true, source: 'manual', version: 1, updated_at: fixture.updatedAt,
      immutable_contract: null,
    }];
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  }, { ruleId: RULE_ID, hotelId: HOTEL_ID, rateId: RATE_2, updatedAt: UPDATED_AT });
  await page.locator(`[data-edit-pricing-rule="${RULE_ID}"]`).click();
  await page.locator('#hotelPricingRuleForm [name="nightly_rate"]').fill('155');
  await page.locator('#hotelPricingRuleForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'rate_rule', action: 'update', id: RULE_ID,
    payload: { nightly_rate: 155, closed_to_arrival: false, closed_to_departure: false } });

  await page.locator('[data-add-exact-price]').click();
  const newExact = page.locator('#hotelExactDatePriceForm');
  await newExact.locator('[name="room_rate_id"]').selectOption(RATE_2);
  await newExact.locator('[name="stay_date"]').fill('2026-11-05');
  await newExact.locator('[name="nightly_rate_mode"]').selectOption('set');
  await newExact.locator('[name="nightly_rate"]').fill('165');
  await newExact.locator('[name="reason"]').fill('Reviewed event selling price');
  await newExact.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'exact_date_price', action: 'create', payload: {
    room_rate_id: RATE_2, stay_date: '2026-11-05', nightly_rate_mode: 'set',
    nightly_rate: 165, minimum_stay_mode: null, maximum_stay_mode: null,
    reason: 'Reviewed event selling price',
  } });

  await page.evaluate((fixture) => {
    const root = window as any;
    root.__adminC.control.exact_date_prices = [{
      id: fixture.exactId, hotel_id: fixture.hotelId, room_rate_id: fixture.rateId,
      stay_date: '2026-11-05', nightly_rate: 165, nightly_rate_mode: 'set',
      minimum_stay: 3, minimum_stay_mode: 'set', maximum_stay: null,
      maximum_stay_mode: null, pricing_active: true, pricing_source: 'manual',
      pricing_reason: 'Reviewed event selling price', pricing_expires_at: null,
      pricing_actor_type: 'admin', pricing_actor_id: fixture.adminId,
      pricing_updated_at: fixture.updatedAt, pricing_correlation_id: fixture.correlationId,
      shared_with_calendar: true, pricing_configured: true, version: 1,
      updated_at: fixture.updatedAt, immutable_contract: null,
    }];
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  }, { exactId: EXACT_PRICE_ID, hotelId: HOTEL_ID, rateId: RATE_2,
    adminId: ADMIN_ID, correlationId: PRICE_CORRELATION_ID, updatedAt: UPDATED_AT });
  await page.locator(`[data-edit-exact-price="${EXACT_PRICE_ID}"]`).click();
  await page.locator('#hotelExactDatePriceForm [name="nightly_rate"]').fill('170');
  await page.locator('#hotelExactDatePriceForm [name="minimum_stay_mode"]').selectOption('clear');
  await page.locator('#hotelExactDatePriceForm [name="reason"]').fill('Reviewed SET and CLEAR update');
  await page.locator('#hotelExactDatePriceForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'exact_date_price', action: 'update', id: EXACT_PRICE_ID,
    payload: { nightly_rate_mode: 'set', nightly_rate: 170,
      minimum_stay_mode: 'clear', minimum_stay: null, reason: 'Reviewed SET and CLEAR update' } });

  await page.locator(`[data-edit-exact-price="${EXACT_PRICE_ID}"]`).click();
  await page.locator('[data-disable-exact-price]').click();
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'exact_date_price', action: 'disable', id: EXACT_PRICE_ID, payload: {} });
  expect(operation.expected_original).toMatchObject({ reason: 'Reviewed event selling price' });

  await page.locator('[data-add-allocation-rule]').click();
  const allocation = page.locator('#hotelPricingAllocationForm');
  await allocation.locator('[name="code"]').fill('choice-1-2');
  await allocation.locator('[name="allocation_mode"]').selectOption('customer_choice');
  await allocation.locator('[name="min_guest_count"]').fill('1');
  await allocation.locator('[name="max_guest_count"]').fill('2');
  await allocation.locator('[data-add-allocation-item]').click();
  const allocationItem = allocation.locator('[data-pricing-allocation-item]');
  await allocationItem.locator('[data-allocation-room]').selectOption(ROOM_1);
  await allocationItem.locator('[data-allocation-units]').fill('1');
  await allocation.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'allocation_rule', action: 'create', payload: {
    code: 'choice-1-2', allocation_mode: 'customer_choice', min_guest_count: 1,
    max_guest_count: 2, lifecycle_status: 'draft',
  } });
  expect(operation.payload.items[0]).toMatchObject({ room_type_id: ROOM_1, units_required: 1,
    allocated_guest_counts: null, pricing_guest_counts: null });

  await page.locator(`[data-edit-allocation-rule="${ALLOCATION_ID}"]`).click();
  await page.locator('#hotelPricingAllocationForm [name="code"]').fill('two-guests-reviewed');
  await page.locator('#hotelPricingAllocationForm [name="activation_acknowledged"]').check();
  await page.locator('#hotelPricingAllocationForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'allocation_rule', action: 'update', id: ALLOCATION_ID,
    payload: { code: 'two-guests-reviewed', lifecycle_status: 'active' } });
  await expectNoBrowserIssues(page);
});

test('ADMIN-C lifecycle disable is explicit, empty-payload and reactivation is a reviewed update', async ({ page }) => {
  await installPricingHarness(page);
  await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
  await page.locator('#hotelPricingPlanForm [name="lifecycle_status"]').selectOption('disabled');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('.hotel-workspace-modal--review')).toContainText('disabled');
  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  const disableOperation = await page.evaluate(() => (window as any).__adminC.applyCalls[0].plan.operations[0]);
  expect(disableOperation.action).toBe('disable');
  expect(disableOperation.payload).toEqual({});
  expect(disableOperation.expected_original).toMatchObject({ code: 'standard', lifecycle_status: 'inactive' });

  await page.evaluate(() => {
    const root = window as any;
    const plan = root.__adminC.control.rate_plans[0];
    plan.lifecycle_status = 'disabled';
    plan.is_active = false;
    plan.version += 1;
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  });
  await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
  await page.locator('#hotelPricingPlanForm [name="lifecycle_status"]').selectOption('inactive');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  const reactivateOperation = await page.evaluate(() => (window as any).__adminC.applyCalls[1].plan.operations[0]);
  expect(reactivateOperation.action).toBe('update');
  expect(reactivateOperation.payload.lifecycle_status).toBe('inactive');
  await expectNoBrowserIssues(page);
});

test('ADMIN-C visible Rate Plan, Room Rate and property fallback actions all reach reviewed saves', async ({ page }) => {
  await installPricingHarness(page);
  const confirm = async () => {
    const review = page.locator('.hotel-workspace-modal--review');
    expect(await review.count(), JSON.stringify(await page.evaluate(() => ({
      toasts: (window as any).__adminC.toasts,
      modalText: document.querySelector('.hotel-workspace-modal')?.textContent,
      formEntries: document.querySelector('#hotelPricingPlanForm')
        ? Array.from(new FormData(document.querySelector('#hotelPricingPlanForm') as HTMLFormElement).entries())
        : null,
    })))).toBe(1);
    await expect(review).toBeVisible();
    await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  };

  await page.locator('[data-add-pricing-plan]').click();
  const planForm = page.locator('#hotelPricingPlanForm');
  await planForm.locator('[name="code"]').fill('reviewed-plan');
  for (const [language, value] of [['pl', 'Plan PL'], ['en', 'Plan EN'], ['he', 'תכנית']] as const) {
    await planForm.locator(`[name="name_${language}"]`).fill(value);
    await planForm.locator(`[name="description_${language}"]`).fill(`${value} description`);
  }
  await planForm.locator('[name="cancellation_reason"]').fill('Commercial terms intentionally remain under review');
  await planForm.locator('[name="price_inclusion"][value="taxes"]').check();
  await planForm.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  let operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'rate_plan', action: 'create', payload: {
    code: 'reviewed-plan', lifecycle_status: 'draft', price_inclusions: ['taxes'],
  } });

  await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
  await page.locator('#hotelPricingPlanForm [name="description_en"]').fill('Updated reviewed description');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'rate_plan', action: 'update' });
  expect(operation.payload.description_i18n.en).toBe('Updated reviewed description');

  await page.evaluate(() => {
    const root = window as any;
    root.__adminC.control.rate_plans[0].code = 'x'.repeat(80);
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  });
  await page.locator(`[data-duplicate-pricing-plan="${PLAN_ID}"]`).click();
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'rate_plan', action: 'create', payload: { lifecycle_status: 'draft' } });
  expect(operation.payload.code).toHaveLength(80);
  expect(operation.payload.code).not.toBe('x'.repeat(80));

  await page.locator('[data-add-pricing-product]').click();
  const createProduct = page.locator('#hotelPricingProductForm');
  await createProduct.locator('[name="room_type_id"]').selectOption(ROOM_1);
  await createProduct.locator('[name="rate_plan_id"]').selectOption(PLAN_2);
  await createProduct.locator('[name="base_nightly_rate"]').fill('135.50');
  await createProduct.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'room_rate', action: 'create', payload: {
    room_type_id: ROOM_1, rate_plan_id: PLAN_2, base_nightly_rate: 135.5,
    lifecycle_status: 'draft',
  } });

  await page.locator(`[data-edit-pricing-product="${RATE_2}"]`).click();
  await page.locator('#hotelPricingProductForm [name="base_nightly_rate"]').fill('140');
  await page.locator('#hotelPricingProductForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'room_rate', action: 'update', payload: { base_nightly_rate: 140 } });

  await page.locator(`[data-duplicate-pricing-product="${RATE_2}"]`).click();
  await page.locator('#hotelDuplicatePricingProductForm [name="pair"]').selectOption(`${ROOM_3}:${PLAN_2}`);
  await page.locator('#hotelDuplicatePricingProductForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'room_rate', action: 'create', payload: {
    room_type_id: ROOM_3, rate_plan_id: PLAN_2, pricing_schedule_id: null,
    lifecycle_status: 'draft',
  } });

  await page.locator(`[data-edit-pricing-product="${RATE_2}"]`).click();
  await page.locator('#hotelPricingProductForm [name="lifecycle_status"]').selectOption('disabled');
  await page.locator('#hotelPricingProductForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'room_rate', action: 'disable', payload: {} });

  await page.evaluate(() => {
    const root = window as any;
    root.__adminC.control.room_rates[1].lifecycle_status = 'disabled';
    root.__adminC.control.room_rates[1].review_status = 'disabled';
    root.__adminC.control.room_rates[1].version += 1;
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  });
  await page.locator(`[data-edit-pricing-product="${RATE_2}"]`).click();
  await page.locator('#hotelPricingProductForm [name="lifecycle_status"]').selectOption('inactive');
  await page.locator('#hotelPricingProductForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'room_rate', action: 'update', payload: { lifecycle_status: 'inactive' } });

  await page.locator('[data-edit-property-pricing-default]').click();
  await page.locator('#hotelPropertyPricingDefaultForm [name="nightly_rate"]').fill('105');
  await page.locator('#hotelPropertyPricingDefaultForm [name="activation_acknowledged"]').check();
  await page.locator('#hotelPropertyPricingDefaultForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'property_pricing_default', action: 'update', payload: { nightly_rate: 105 } });

  await page.locator('[data-edit-property-pricing-default]').click();
  await page.locator('#hotelPropertyPricingDefaultForm [name="lifecycle_status"]').selectOption('disabled');
  await page.locator('#hotelPropertyPricingDefaultForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'property_pricing_default', action: 'disable', payload: {} });

  await page.evaluate(() => {
    const root = window as any;
    root.__adminC.control.property_pricing_default.lifecycle_status = 'disabled';
    root.__adminC.control.property_pricing_default.review_status = 'disabled';
    root.__adminC.control.property_pricing_default.is_active = false;
    root.__adminC.control.property_pricing_default.version += 1;
    root.__adminC.control.room_rates.forEach((rate: any) => {
      if (rate.pricing_source === 'property_default') rate.pricing_source = 'missing';
    });
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  });
  await page.locator('[data-edit-property-pricing-default]').click();
  await page.locator('#hotelPropertyPricingDefaultForm [name="lifecycle_status"]').selectOption('inactive');
  await page.locator('#hotelPropertyPricingDefaultForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await confirm();
  operation = await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0]);
  expect(operation).toMatchObject({ entity: 'property_pricing_default', action: 'update', payload: { lifecycle_status: 'inactive' } });
  await expectNoBrowserIssues(page);
});

test('ADMIN-C semantic no-op and stale save require a fresh explicit Review with no hidden retry', async ({ page }) => {
  await installPricingHarness(page);

  await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('.hotel-workspace-modal--review')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(0);
  expect(await page.evaluate(() => (window as any).__adminC.toasts.some((entry: any) => (
    /No pricing fields changed/i.test(entry.message)
  )))).toBe(true);
  await closeModal(page);

  await page.evaluate((fixture) => {
    const root = window as any;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const store = root.__adminC;
    store.applyCalls = [];
    store.getCalls = 0;
    root.HotelsV2WorkspaceRepository.getPricingControl = async () => {
      store.getCalls += 1;
      const fresh = clone(store.control);
      fresh.snapshot_token = 'e'.repeat(64);
      const plan = fresh.rate_plans.find((entry: any) => entry.id === fixture.planId);
      plan.version += 1;
      plan.updated_at = '2026-08-21T10:30:00.000Z';
      plan.name_i18n.pl = 'Standard po niezależnej korekcie';
      store.control = fresh;
      return clone(fresh);
    };
    root.HotelsV2WorkspaceRepository.applyPricingControlPlan = async (plan: any, correlationId: string, idempotencyKey: string) => {
      store.applyCalls.push({ plan: clone(plan), correlationId, idempotencyKey });
      if (store.applyCalls.length === 1) {
        const error: any = new Error('hotels_v2_admin_c_rate_plan_original_mismatch');
        error.isStale = true;
        error.isDefinitiveFailure = true;
        error.isAmbiguousOutcome = false;
        error.userMessage = 'The Rate Plan changed after Review.';
        throw error;
      }
      const next = clone(store.control);
      const operation = plan.operations[0];
      const saved = next.rate_plans.find((entry: any) => entry.id === operation.id);
      Object.assign(saved, clone(operation.payload));
      saved.version += 1;
      next.snapshot_token = 'f'.repeat(64);
      store.control = next;
      return { contract_version: 'hotels_v2_admin_c_pricing_control_v1', hotel_id: fixture.hotelId,
        correlation_id: correlationId, idempotency_key: idempotencyKey,
        replayed: false, changed: true, activity: [], pricing_control: clone(next) };
    };
  }, { planId: PLAN_ID, hotelId: HOTEL_ID });

  await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
  await page.locator('#hotelPricingPlanForm [name="description_en"]').fill('Fresh explicit stale-safe description');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();

  await expect(page.locator('.hotel-workspace-modal--review')).toContainText('Fresh non-overlapping values were preserved');
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__adminC.getCalls)).toBe(1);
  expect(await page.evaluate(() => (window as any).__adminC.toasts.some((entry: any) => (
    /nothing was retried automatically/i.test(entry.message)
  )))).toBe(true);
  await page.waitForTimeout(40);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(1);

  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-workspace-modal--review')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(2);
  const secondPlan = await page.evaluate(() => (window as any).__adminC.applyCalls[1].plan);
  expect(secondPlan.snapshot_token).toBe('e'.repeat(64));
  expect(secondPlan.operations[0].expected_version).toBe(4);
  expect(secondPlan.operations[0].payload.name_i18n.pl).toBe('Standard po niezależnej korekcie');
  await expectNoBrowserIssues(page);
});

test('ADMIN-C ambiguous saves reconcile before and after commit without automatic mutation retry', async ({ page }) => {
  await installPricingHarness(page);
  await page.evaluate((fixture) => {
    const root = window as any;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const store = root.__adminC;
    store.applyCalls = [];
    store.getCalls = 0;
    store.ambiguousMode = 'before';
    root.HotelsV2WorkspaceRepository.getPricingControl = async () => {
      store.getCalls += 1;
      return clone(store.control);
    };
    root.HotelsV2WorkspaceRepository.applyPricingControlPlan = async (plan: any, correlationId: string, idempotencyKey: string) => {
      store.applyCalls.push({ plan: clone(plan), correlationId, idempotencyKey });
      if (store.applyCalls.length === 1 || store.ambiguousMode === 'after') {
        if (store.ambiguousMode === 'after') {
          const operation = plan.operations[0];
          const saved = store.control.rate_plans.find((entry: any) => entry.id === operation.id);
          Object.assign(saved, clone(operation.payload));
          saved.version += 1;
          store.control.snapshot_token = 'd'.repeat(64);
        }
        const error: any = new Error('Connection ended before the response was confirmed.');
        error.isAmbiguousOutcome = true;
        error.isDefinitiveFailure = false;
        error.isStale = false;
        throw error;
      }
      const operation = plan.operations[0];
      const saved = store.control.rate_plans.find((entry: any) => entry.id === operation.id);
      Object.assign(saved, clone(operation.payload));
      saved.version += 1;
      store.control.snapshot_token = 'c'.repeat(64);
      return { contract_version: 'hotels_v2_admin_c_pricing_control_v1', hotel_id: fixture.hotelId,
        correlation_id: correlationId, idempotency_key: idempotencyKey,
        replayed: false, changed: true, activity: [], pricing_control: clone(store.control) };
    };
  }, { hotelId: HOTEL_ID });

  await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
  await page.locator('#hotelPricingPlanForm [name="description_en"]').fill('Ambiguous before commit target');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-workspace-modal--review')).toContainText('Ambiguous before commit target');
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__adminC.getCalls)).toBe(1);
  await page.waitForTimeout(40);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(1);
  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-workspace-modal--review')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(2);

  await page.evaluate(() => {
    const root = window as any;
    root.__adminC.applyCalls = [];
    root.__adminC.getCalls = 0;
    root.__adminC.ambiguousMode = 'after';
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  });
  await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
  await page.locator('#hotelPricingPlanForm [name="description_en"]').fill('Ambiguous after commit target');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-workspace-modal--review')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__adminC.getCalls)).toBe(1);
  expect(await page.evaluate(() => (window as any).__adminC.toasts.some((entry: any) => (
    /database already matches.*No mutation was retried/i.test(entry.message)
  )))).toBe(true);
  await expectNoBrowserIssues(page);
});

test('ADMIN-C tablet pricing Review traps focus and Calendar labels exact pricing authority', async ({ page }) => {
  await installPricingHarness(page, { width: 768, height: 1024 });
  await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
  await page.locator('#hotelPricingPlanForm [name="description_en"]').fill('Tablet keyboard-reviewed description');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toBeVisible();
  await expect(review.locator('.hotel-workspace-modal__close')).toBeFocused();
  const confirm = review.locator('[data-hotel-review-confirm]');
  await confirm.focus();
  await confirm.press('Tab');
  await expect(review.locator('.hotel-workspace-modal__close')).toBeFocused();
  await review.locator('.hotel-workspace-modal__close').press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await confirm.press('Enter');
  await expect(review).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

  await page.evaluate((fixture) => {
    const root = window as any;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    root.HotelsV2Workspace.state.calendar.anchor_date = '2026-09-01';
    root.HotelsV2Workspace.state.calendar.view = 'week';
    root.HotelsV2Workspace.state.calendar.data = {
      hotel_id: fixture.hotelId, start_date: '2026-08-31', end_date: '2026-09-06',
      snapshot_token: 'b'.repeat(64), room_rates: clone(root.__adminC.control.room_rates),
      daily_rates: [], daily_inventory: [], calendar_overrides: [], effective_cells: [],
      rate_rules: [], occupancy_tiers: [],
    };
    root.HotelsV2Workspace.state.activeTab = 'calendar';
    root.HotelsV2Workspace.renderWorkspace();
  }, { hotelId: HOTEL_ID });
  await expect(page.locator(`[data-calendar-product-row="${RATE_1}"]`)).toContainText('Shared 1-tier schedule authoritative');
  await expect(page.locator(`[data-calendar-product-row="${RATE_2}"]`)).toContainText('€100.00 Property fallback authoritative');

  await page.evaluate((fixture) => {
    const root = window as any;
    const rate = root.__adminC.control.room_rates.find((entry: any) => entry.id === fixture.rateId);
    rate.pricing_source = 'independent_tiers';
    rate.independent_tiers = [{ id: fixture.tierId, hotel_id: fixture.hotelId,
      room_rate_id: fixture.rateId, guest_count: 2, threshold_nights: 1,
      nightly_rate: 140, is_active: true, version: 1, updated_at: fixture.updatedAt,
      source: 'manual', immutable_contract: null }];
    root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
    root.HotelsV2Workspace.renderWorkspace();
  }, { rateId: RATE_2, tierId: TIER_3, hotelId: HOTEL_ID, updatedAt: UPDATED_AT });
  await expect(page.locator(`[data-calendar-product-row="${RATE_2}"]`)).toContainText('Independent 1-tier occupancy pricing authoritative');
  await expect(page.locator(`[data-calendar-product-row="${RATE_2}"]`)).not.toContainText('€0.00 base');
  await expectNoBrowserIssues(page);
});

test('ADMIN-C mobile Hebrew RTL keeps structured localized fields and viewport-safe controls', async ({ page }) => {
  await installPricingHarness(page, { width: 390, height: 844, locale: 'he' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const pricingTab = page.locator('[data-hotel-workspace-tab="pricing"]');
  await expect(pricingTab).toHaveText('תמחור ותוכניות מחיר');
  await expect(page.locator('#hotelWorkspaceActivePanel .hotel-workspace-panel-header h3')).toHaveText('תמחור ותוכניות מחיר');
  await expect(page.locator('[data-preview-pricing]')).toHaveText('תצוגה מקדימה לשהייה');
  await pricingTab.focus();
  await pricingTab.press('ArrowRight');
  await expect(page.locator('[data-hotel-workspace-tab="rooms"]')).toBeFocused();
  await page.locator('[data-hotel-workspace-tab="pricing"]').click();
  await page.locator('[data-add-pricing-plan]').click();
  await expect(page.locator('#hotelWorkspaceModalTitle')).toHaveText('צור טיוטת תוכנית מחיר');
  await expect(page.locator('#hotelPricingPlanForm')).toContainText('קוד פנימי');
  await expect(page.locator('#hotelPricingPlanForm')).toContainText('שם תוכנית מחיר');
  await expect(page.locator('#hotelPricingPlanForm [name="name_pl"]')).toBeVisible();
  await expect(page.locator('#hotelPricingPlanForm [name="name_en"]')).toBeVisible();
  await expect(page.locator('#hotelPricingPlanForm [name="name_he"]')).toBeVisible();
  await expect(page.locator('#hotelPricingPlanForm [name="name_he"]')).toHaveAttribute('dir', 'rtl');
  await page.locator('#hotelPricingPlanForm [name="code"]').fill('he-reviewed-plan');
  await page.locator('#hotelPricingPlanForm [name="name_en"]').fill('Hebrew reviewed plan');
  await page.locator('#hotelPricingPlanForm [name="name_he"]').fill('תוכנית שנבדקה');
  await page.locator('#hotelPricingPlanForm [name="cancellation_reason"]').fill('התנאים המסחריים עדיין דורשים בדיקה');
  await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review.locator('#hotelWorkspaceModalTitle')).toHaveText('בדוק תוכנית מחיר חדשה');
  await expect(review.locator('[data-hotel-review-confirm]')).toHaveText('שמור שינויים שנבדקו');
  const bounds = await page.locator('.hotel-workspace-modal').boundingBox();
  expect(bounds).not.toBeNull();
  expect((bounds?.x || 0) + (bounds?.width || 0)).toBeLessThanOrEqual(391);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.at(-1).plan.operations[0])).toMatchObject({
    entity: 'rate_plan', action: 'create', payload: { code: 'he-reviewed-plan', lifecycle_status: 'draft' },
  });
  expect(await page.evaluate(() => (window as any).__adminC.toasts.some((entry: any) => (
    entry.message === 'תוכנית המחיר נוצרה כתצורת צל שנבדקה.'
  )))).toBe(true);
  await expectNoBrowserIssues(page);
});

for (const locale of ['pl', 'he'] as const) {
  test(`ADMIN-C ${locale.toUpperCase()} localization never rewrites reviewed names equal to chrome keys`, async ({ page }) => {
    const expected = locale === 'pl' ? {
      sellingPrice: 'Cena sprzedaży dla klienta', currency: 'Waluta', review: 'Weryfikacja',
      dormant: 'Zachowane, ale uśpione',
      dormantDetail: 'Obecnie połączony harmonogram wielokrotnego użytku pozostaje wiążący. Te progi są zachowane do przyszłego sprawdzonego odłączenia; ich edycja nie zmienia bieżącego źródła.',
      flexible: 'Elastyczne', customerChoice: 'Klient wybiera jeden typ pokoju',
      requiredBundle: 'Wymagany pakiet wielu pokoi',
      monday: 'Pon.', field: 'Pole', before: 'Przed', after: 'Po',
      autoPlan: 'Automatycznie tylko wtedy, gdy istnieje dokładnie jeden aktywny sprawdzony plan',
      autoAllocation: 'Automatycznie tylko wtedy, gdy dokładnie jedna aktywna sprawdzona reguła obejmuje grupę',
      fallback: 'Ostatnia znormalizowana zapasowa cena sprzedaży',
      lockedCurrency: 'Zablokowana na sprawdzonej walucie obiektu.',
      chooseRoom: 'Wybierz dokładny typ pokoju', choosePlan: 'Wybierz dokładny plan taryfowy',
      cloneSuffix: 'przed połączeniem sklonuj jako ręczny',
      duplicateDetail: 'Kopiowane są tylko zapisana cena bazowa i waluta. Nowy produkt rozpoczyna jako nieaktywna wersja robocza bez połączenia harmonogramu, niezależnych progów, przekierowania zewnętrznego, zapasów, rezerwacji ani aktywacji.',
      chooseUnused: 'Wybierz dokładną nieużywaną parę',
      scheduleOwnership: 'Niezależny · maksymalnie jeden produkt pokoju',
      scheduleTierDetail: 'Wybrana cena obowiązuje przez cały pobyt. Próg jednej nocy konfiguruj tylko wtedy, gdy kontrakt handlowy wyraźnie dopuszcza jedną noc.',
      chooseRate: 'Wybierz dokładny produkt stawki pokoju',
    } : {
      sellingPrice: 'מחיר המכירה ללקוח', currency: 'מטבע', review: 'בדיקה',
      dormant: 'נשמר אך רדום',
      dormantDetail: 'לוח לשימוש חוזר מקושר כעת ונשאר מקור הסמכות. מדרגות אלה נשמרות לניתוק עתידי שנבדק; עריכתן אינה משנה את המקור הנוכחי.',
      flexible: 'גמישה', customerChoice: 'הלקוח בוחר סוג חדר אחד',
      requiredBundle: 'חבילת מספר חדרים נדרשת',
      monday: 'ב׳', field: 'שדה', before: 'לפני', after: 'אחרי',
      autoPlan: 'אוטומטי רק כשקיימת תוכנית אחת פעילה ומאושרת',
      autoAllocation: 'אוטומטי רק כשכלל פעיל ומאושר אחד מכסה את הקבוצה',
      fallback: 'ברירת המחדל המנורמלת האחרונה למחיר מכירה',
      lockedCurrency: 'נעול למטבע הנכס שנבדק.',
      chooseRoom: 'בחר סוג חדר מדויק', choosePlan: 'בחר תוכנית מחיר מדויקת',
      cloneSuffix: 'שכפל לידני לפני הקישור',
      duplicateDetail: 'רק מחיר הבסיס השמור והמטבע מועתקים. המוצר החדש מתחיל כטיוטה לא פעילה ללא קישור לוח, מדרגות עצמאיות, הפניה חיצונית, מלאי, הזמנות או הפעלה.',
      chooseUnused: 'בחר צמד מדויק שאינו בשימוש',
      scheduleOwnership: 'עצמאי · מוצר חדר אחד לכל היותר',
      scheduleTierDetail: 'המחיר שנבחר חל על כל השהייה. הגדר סף של לילה אחד רק כאשר החוזה המסחרי תומך בכך במפורש.',
      chooseRate: 'בחר מוצר מחיר חדר מדויק',
    };
    await installPricingHarness(page, { locale });
    await page.evaluate(({ language, planId, roomId, scheduleId }) => {
      const root = window as any;
      const plan = root.__adminC.control.rate_plans.find((entry: any) => entry.id === planId);
      const room = root.__adminC.control.room_types.find((entry: any) => entry.id === roomId);
      const schedule = root.__adminC.control.pricing_schedules.find((entry: any) => entry.id === scheduleId);
      plan.name_i18n[language] = 'Rates & Pricing';
      room.name_i18n[language] = 'Create Rate Plan draft';
      schedule.name_i18n[language] = 'Save reviewed changes';
      root.HotelsV2Workspace.state.pricingControl = root.__adminC.control;
      root.HotelsV2Workspace.renderWorkspace();
    }, { language: locale, planId: PLAN_ID, roomId: ROOM_1, scheduleId: SCHEDULE_1 });

    await expect(page.locator('.hotel-rate-plan-card h5').first()).toHaveText('Rates & Pricing');
    await expect(page.locator('.hotel-pricing-product-card header .hotel-workspace-eyebrow').first())
      .toHaveText('Create Rate Plan draft');
    await expect(page.locator('.hotel-pricing-schedule-card h4').first())
      .toHaveText('Save reviewed changes');

    const productTerms = await page.locator('.hotel-pricing-product-card').first().locator('dt').allTextContents();
    expect(productTerms).toEqual([expected.sellingPrice, expected.currency, expected.review]);

    await page.locator('[data-preview-pricing]').click();
    await expect(page.locator('#hotelPricingPreviewForm [name="rate_plan_id"] option[value=""]'))
      .toHaveText(expected.autoPlan);
    await expect(page.locator('#hotelPricingPreviewForm [name="allocation_rule_id"] option[value=""]'))
      .toHaveText(expected.autoAllocation);
    await closeModal(page);

    await page.locator('[data-edit-property-pricing-default]').click();
    await expect(page.locator('#hotelPropertyPricingDefaultForm h4')).toHaveText(expected.fallback);
    await expect(page.locator('#hotelPropertyPricingDefaultForm .admin-form-field small'))
      .toContainText(expected.lockedCurrency);
    await closeModal(page);

    await page.locator('[data-add-pricing-product]').click();
    await expect(page.locator('#hotelPricingProductForm [name="room_type_id"] option[value=""]'))
      .toHaveText(expected.chooseRoom);
    await expect(page.locator('#hotelPricingProductForm [name="rate_plan_id"] option[value=""]'))
      .toHaveText(expected.choosePlan);
    await expect(page.locator(`#hotelPricingProductForm [name="pricing_schedule_id"] option[value="${SCHEDULE_3}"]`))
      .toContainText(expected.cloneSuffix);
    await closeModal(page);

    await page.locator(`[data-duplicate-pricing-product="${RATE_1}"]`).click();
    await expect(page.locator('#hotelDuplicatePricingProductForm section > p'))
      .toHaveText(expected.duplicateDetail);
    await expect(page.locator('#hotelDuplicatePricingProductForm [name="pair"] option[value=""]'))
      .toHaveText(expected.chooseUnused);
    await closeModal(page);

    await page.locator('[data-add-pricing-schedule]').click();
    await expect(page.locator('#hotelPricingScheduleForm [name="sharing_mode"] option[value="independent"]'))
      .toHaveText(expected.scheduleOwnership);
    await expect(page.locator('#hotelPricingScheduleForm fieldset > p'))
      .toHaveText(expected.scheduleTierDetail);
    await closeModal(page);

    await page.locator(`[data-edit-product-tiers="${RATE_1}"]`).click();
    await expect(page.locator('#hotelProductTierForm h4')).toHaveText(expected.dormant);
    await expect(page.locator('#hotelProductTierForm section > p')).toHaveText(expected.dormantDetail);
    await closeModal(page);

    await page.locator(`[data-edit-pricing-plan="${PLAN_ID}"]`).click();
    await expect(page.locator(`#hotelPricingPlanForm [name="name_${locale}"]`))
      .toHaveValue('Rates & Pricing');
    await expect(page.locator('#hotelPricingPlanForm [name="cancellation_type"] option[value="flexible"]'))
      .toHaveText(expected.flexible);
    await page.locator('#hotelPricingPlanForm [name="sort_order"]').fill('101');
    await page.locator('#hotelPricingPlanForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('.hotel-workspace-modal--review .hotel-review-table thead th'))
      .toHaveText([expected.field, expected.before, expected.after]);
    await closeModal(page);

    await page.locator('[data-add-allocation-rule]').click();
    await expect(page.locator('#hotelPricingAllocationForm [name="allocation_mode"] option[value="customer_choice"]'))
      .toHaveText(expected.customerChoice);
    await expect(page.locator('#hotelPricingAllocationForm [name="allocation_mode"] option[value="required_bundle"]'))
      .toHaveText(expected.requiredBundle);
    await closeModal(page);

    await page.locator('[data-add-pricing-rule]').click();
    await expect(page.locator('#hotelPricingRuleForm [name="room_rate_id"] option[value=""]'))
      .toHaveText(expected.chooseRate);
    await expect(page.locator('#hotelPricingRuleForm .hotel-calendar-weekdays label').first())
      .toContainText(expected.monday);
    await closeModal(page);

    await page.locator('[data-add-exact-price]').click();
    await expect(page.locator('#hotelExactDatePriceForm [name="room_rate_id"] option[value=""]'))
      .toHaveText(expected.chooseRate);
    await closeModal(page);
    await expectNoBrowserIssues(page);
  });
}

test('ADMIN-C keeps the accepted 7 Kamares pricing graph read-only while preview remains available', async ({ page }) => {
  await installPricingHarness(page, { sevenKamares: true, locale: 'pl' });
  await expect(page.locator('[data-hotel-workspace-tab="pricing"]')).toHaveText('Ceny i plany taryfowe');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Panel cen 7 Kamares jest tylko do odczytu');
  await expect(page.locator('[data-preview-pricing]')).toHaveText('Podgląd pobytu');
  await expect(page.locator('[data-add-pricing-plan]')).toHaveCount(0);
  await expect(page.locator('[data-add-pricing-product]')).toHaveCount(0);
  await expect(page.locator('[data-add-pricing-schedule]')).toHaveCount(0);
  await expect(page.locator('[data-add-pricing-rule]')).toHaveCount(0);
  await expect(page.locator('[data-add-exact-price]')).toHaveCount(0);
  await expect(page.locator('[data-add-allocation-rule]')).toHaveCount(0);
  await page.evaluate((fixture) => {
    const root = window as any;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    root.HotelsV2WorkspaceRepository.previewPricingQuote = async (request: any) => {
      root.__adminC.previewCalls.push(clone(request));
      const milliseconds = Date.parse(`${request.check_out}T00:00:00Z`) - Date.parse(`${request.check_in}T00:00:00Z`);
      const nights = milliseconds / 86400000;
      const base = {
        contract_version: request.contract_version, hotel_id: fixture.hotelId,
        snapshot_token: request.snapshot_token, requestable: false, currency: 'EUR',
        check_in: request.check_in, check_out: request.check_out, nights,
        adults: request.adults, child_ages: clone(request.child_ages),
        guest_count: request.adults + request.child_ages.length,
        pricing_precedence: ['exact_date_price', 'seasonal_range_rule', 'weekday_rule',
          'pricing_schedule_tier', 'independent_occupancy_tier',
          'room_rate_base_nightly_rate', 'property_default'],
        legacy_authoritative: true, public_change: false,
      };
      if (nights < 2) return { ...base, ok: false,
        blocking_reasons: [{ code: 'below_minimum_stay', entity: 'property',
          entity_id: fixture.hotelId, stay_date: null, detail: 'Reviewed minimum is 2 nights.' }],
        allocation: [], products: [], nightly_breakdown: [], customer_total: null };
      const allocation = [{ allocation_rule_id: fixture.allocationId,
        allocation_mode: 'required_bundle', room_type_id: fixture.roomId,
        units_required: 1, allocated_guest_count: 1, pricing_guest_count: 2,
        allocated_guest_counts: [1], pricing_guest_counts: [2] }];
      const products = [{ room_type_id: fixture.roomId, room_rate_id: fixture.rateId,
        rate_plan_id: fixture.planId, unit_sequence: 1, allocated_guest_count: 1,
        requested_pricing_guest_count: 2, resolved_pricing_guest_count: 2,
        minimum_billable_occupancy: 2, base_pricing_source: 'pricing_schedule_tier',
        base_pricing_source_id: fixture.scheduleId, los_threshold_nights: 1,
        subtotal: nights * 100, currency: 'EUR', booking_mode: 'request_confirmation',
        cancellation_policy: { type: 'flexible' }, price_inclusions: ['taxes'],
        effective_minimum_stay: 2, effective_maximum_stay: 30, stay_allowed: true }];
      const nightly_breakdown = Array.from({ length: nights }, (_, index) => {
        const stay = new Date(Date.parse(`${request.check_in}T00:00:00Z`) + index * 86400000)
          .toISOString().slice(0, 10);
        return { stay_date: stay, room_type_id: fixture.roomId, room_rate_id: fixture.rateId,
          rate_plan_id: fixture.planId, unit_sequence: 1, allocated_guest_count: 1,
          requested_pricing_guest_count: 2, resolved_pricing_guest_count: 2,
          minimum_billable_occupancy: 2, base_pricing_source: 'pricing_schedule_tier',
          base_pricing_source_id: fixture.scheduleId, los_threshold_nights: 1,
          weekday_rule_id: null, seasonal_range_rule_id: null, exact_date_price_id: null,
          final_pricing_source: 'pricing_schedule_tier', nightly_rate: 100, currency: 'EUR',
          effective_minimum_stay: 2, effective_maximum_stay: 30,
          minimum_stay_source: 'property', minimum_stay_source_id: fixture.hotelId,
          maximum_stay_source: 'property', maximum_stay_source_id: fixture.hotelId };
      });
      return { ...base, ok: true, blocking_reasons: [], allocation, products,
        nightly_breakdown, customer_total: nights * 100 };
    };
  }, { hotelId: SEVEN_KAMARES_ID, allocationId: ALLOCATION_ID, roomId: ROOM_2,
    rateId: RATE_2, planId: PLAN_ID, scheduleId: SCHEDULE_1 });

  await page.locator('[data-preview-pricing]').click();
  await expect(page.locator('#hotelWorkspaceModalTitle')).toHaveText('Podgląd cen obliczanych przez serwer');
  const preview = page.locator('#hotelPricingPreviewForm');
  await preview.locator('[name="check_in"]').fill('2026-09-01');
  await preview.locator('[name="check_out"]').fill('2026-09-03');
  await preview.locator('[name="adults"]').fill('1');
  await preview.locator('[name="rate_plan_id"]').selectOption(PLAN_ID);
  await preview.locator('[name="allocation_rule_id"]').selectOption(ALLOCATION_ID);
  await page.locator('button[form="hotelPricingPreviewForm"]').click();
  await expect(page.locator('.hotel-pricing-preview-result h4')).toHaveText(/€200/);
  await expect(page.locator('.hotel-pricing-preview-result')).toContainText('Kolejność cen · od najwyższego priorytetu do wartości zapasowej');
  expect(await page.evaluate(() => (window as any).__adminC.previewCalls.at(-1))).toMatchObject({
    check_in: '2026-09-01', check_out: '2026-09-03', adults: 1, child_ages: [],
  });
  await preview.locator('[name="check_out"]').fill('2026-09-02');
  await page.locator('button[form="hotelPricingPreviewForm"]').click();
  await expect(page.locator('.hotel-pricing-preview-result h4')).toHaveText('Cena niedostępna do zamówienia');
  await expect(page.locator('.hotel-pricing-preview-result')).toContainText('Blokady oferty i komunikaty bezpieczeństwa');
  await expect(page.locator('.hotel-pricing-preview-result')).toContainText('Żądany pobyt jest krótszy niż obowiązujące minimum biznesowe.');
  expect(await page.evaluate(() => (window as any).__adminC.previewCalls.length)).toBe(2);
  expect(await page.evaluate(() => (window as any).__adminC.applyCalls.length)).toBe(0);
  await expectNoBrowserIssues(page);
});
