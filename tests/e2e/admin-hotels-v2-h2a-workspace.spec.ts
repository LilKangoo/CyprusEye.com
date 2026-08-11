import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const HOTEL_ID = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PARTNER_ID = '70000000-0000-4000-8000-000000000001';
const ROOM_ID = '20000000-0000-4000-8000-000000000001';
const UNIT_ID = '20000000-0000-4000-8000-000000000002';
const RATE_PLAN_ID = '20000000-0000-4000-8000-000000000003';
const ROOM_RATE_ID = '20000000-0000-4000-8000-000000000004';
const DUPLICATE_ROOM_ID = '20000000-0000-4000-8000-000000000005';
const SHADOW_PREVIEW_ID = '20000000-0000-4000-8000-000000000006';
const CALENDAR_OVERRIDE_1_ID = '20000000-0000-4000-8000-000000000007';
const CALENDAR_OVERRIDE_2_ID = '20000000-0000-4000-8000-000000000008';
const OCCUPANCY_TIER_ID = '20000000-0000-4000-8000-000000000009';
const RATE_RULE_ID = '20000000-0000-4000-8000-000000000010';
const CORRELATION_ID = '30000000-0000-4000-8000-000000000001';
const CALENDAR_CORRELATION_ID = '30000000-0000-4000-8000-000000000002';
const TIER_CORRELATION_ID = '30000000-0000-4000-8000-000000000003';
const OPEN_CORRELATION_ID = '30000000-0000-4000-8000-000000000004';
const RATE_RULE_CORRELATION_ID = '30000000-0000-4000-8000-000000000005';
const STALE_CALENDAR_CORRELATION_ID = '30000000-0000-4000-8000-000000000006';
const DEPARTURE_CORRELATION_ID = '30000000-0000-4000-8000-000000000007';

function seedHotelsV2H2aWorkspace() {
  return ({ adminId, hotelId, partnerId }: { adminId: string; hotelId: string; partnerId: string }) => {
    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const timestamp = () => '2026-08-11T12:00:00.000Z';
    const thresholdNights = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const legacyRateMatrix = [
      { persons: 2, rates: [100, 90, 88, 84, 80, 76, 74, 72, 70] },
      { persons: 3, rates: [130, 113, 113, 104, 100, 95, 94, 90, 90] },
      { persons: 4, rates: [155, 135, 135, 120, 118, 114, 111, 107, 107] },
      { persons: 5, rates: [200, 180, 176, 168, 160, 152, 148, 144, 140] },
      { persons: 6, rates: [260, 226, 226, 208, 200, 190, 188, 180, 180] },
      { persons: 7, rates: [310, 270, 270, 240, 236, 228, 222, 214, 214] },
      { persons: 8, rates: [310, 270, 270, 240, 236, 228, 222, 214, 214] },
    ];
    const legacyPricingRules = legacyRateMatrix.flatMap((matrixRow) =>
      thresholdNights.map((minNights, index) => ({
        persons: matrixRow.persons,
        min_nights: minNights,
        price_per_night: matrixRow.rates[index],
      })),
    );
    const property = {
      id: hotelId,
      slug: '7-ukow',
      architecture_version: 'legacy',
      title: { en: '7 Arches', pl: '7 Łuków', he: '7 קשתות' },
      title_i18n: { en: '7 Arches', pl: '7 Łuków', he: '7 קשתות' },
      description: { en: 'Accepted legacy property' },
      description_i18n: { en: 'Accepted legacy property' },
      city: 'Lefkara',
      district: 'Larnaca',
      country: 'Cyprus',
      timezone: 'Europe/Nicosia',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      owner_partner_id: partnerId,
      owner_partner: { id: partnerId, name: 'Fixture Hotels Partner', status: 'active', can_manage_hotels: true },
      room_types: [],
      pricing_tiers: { currency: 'EUR', rules: legacyPricingRules },
      pricing_extras: { currency: 'EUR', items: [] },
      pricing_model: 'tiered_by_nights',
      max_persons: 8,
      photos: [],
      amenities: [],
      is_published: true,
      status: 'active',
      submission_status: 'approved',
      sort_order: 10,
      updated_at: '2026-08-11T08:00:00.000Z',
    };
    const store: any = {
      property,
      legacy_baseline: {
        pricing_tiers: clone(property.pricing_tiers),
        pricing_extras: clone(property.pricing_extras),
        room_types: clone(property.room_types),
      },
      room_types: [],
      units: [],
      rate_plans: [],
      room_rates: [],
      rate_rules: [],
      occupancy_tiers: [],
      calendar_overrides: [],
      daily_inventory: [],
      calendar_apply_receipts: [],
      amenities_catalog: [
        { code: 'wifi', category: 'Connectivity', name_en: 'Wi-Fi', name_pl: 'Wi-Fi' },
        { code: 'air-conditioning', category: 'Comfort', name_en: 'Air conditioning', name_pl: 'Klimatyzacja' },
      ],
      partners: [{ id: partnerId, name: 'Fixture Hotels Partner', status: 'active', can_manage_hotels: true }],
      operational_partners: [{ id: partnerId, name: 'Fixture Hotels Partner' }],
      payment_due: { enabled: true, mode: 'percent_total', amount: 15, currency: 'EUR' },
      counts: { upcoming_bookings: 0, daily_inventory_by_room: {} },
      flags: {
        hotel_rooms_v2_enabled: false,
        hotel_external_sync_enabled: false,
        hotel_instant_booking_enabled: false,
        hotel_stripe_connect_enabled: false,
      },
      activity: [],
      apply_receipts: [],
    };
    (window as any).__h2aE2eStore = store;
    (window as any).__h2aFailNextApply = false;
    (window as any).__h2aUuidQueue = [];

    const nativeRandomUuid = window.crypto.randomUUID.bind(window.crypto);
    try {
      Object.defineProperty(window.crypto, 'randomUUID', {
        configurable: true,
        value: () => (window as any).__h2aUuidQueue.shift() || nativeRandomUuid(),
      });
    } catch {
      // Chromium permits this override. Falling back still preserves exact IDs
      // through the values captured by the test if a future browser does not.
    }

    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        const profile = {
          id: adminId,
          email: 'hotels-h2a-admin@example.test',
          username: 'hotels-h2a-admin',
          name: 'Hotels H2A Admin',
          is_admin: true,
          xp: 100,
          level: 5,
        };
        stub.seedUser({ email: profile.email, password: 'admin-password', profile });
        stub.setSession({ id: adminId, email: profile.email, user_metadata: { username: profile.username } });
        stub.seedTable('profiles', [profile]);
        stub.seedTable('admin_users_overview', [{
          ...profile,
          created_at: '2026-08-01T08:00:00.000Z',
          updated_at: '2026-08-11T08:00:00.000Z',
          banned_until: null,
        }]);
        stub.seedTable('admin_system_diagnostics', []);
        stub.seedTable('hotel_cities', []);
        stub.seedTable('hotel_amenities', clone(store.amenities_catalog));
        stub.seedTable('hotel_categories', []);
        stub.seedTable('hotels', [clone(property)]);
        stub.seedTable('hotel_bookings', []);

        const snapshot = () => clone({
          property: store.property,
          owner_partner: store.property.owner_partner,
          room_types: store.room_types,
          units: store.units,
          rate_plans: store.rate_plans,
          room_rates: store.room_rates,
          amenities_catalog: store.amenities_catalog,
          partners: store.partners,
          operational_partners: store.operational_partners,
          payment_due: store.payment_due,
          counts: store.counts,
          flags: store.flags,
          activity: store.activity,
        });
        const preparationState = () => {
          if (!store.room_types.length && !store.rate_plans.length && !store.room_rates.length) return 'DRAFT';
          const activeRoom = store.room_types.some((room: any) => room.status === 'active');
          const activePlan = store.rate_plans.some((plan: any) => plan.is_active);
          const activeRate = store.room_rates.some((rate: any) => rate.is_active && Number(rate.base_nightly_rate) > 0);
          return activeRoom && activePlan && activeRate ? 'READY_FOR_CALENDAR' : 'BLOCKED';
        };
        const directory = () => [{
          ...clone(store.property),
          owner_partner_name: 'Fixture Hotels Partner',
          room_type_count: store.room_types.length,
          total_inventory: store.room_types.reduce((total: number, room: any) => {
            if (room.status === 'disabled') return total;
            if (room.inventory_mode === 'unitized') {
              return total + store.units.filter((unit: any) => unit.room_type_id === room.id && unit.status === 'active').length;
            }
            return total + Number(room.base_inventory_count || 0);
          }, 0),
          rate_plan_count: store.rate_plans.length,
          price_from: store.room_rates.length
            ? Math.min(...store.room_rates.map((rate: any) => Number(rate.base_nightly_rate)))
            : null,
          legacy_configuration: store.property.architecture_version === 'legacy'
            ? {
              pricing_model: store.property.pricing_model,
              pricing_tiers: clone(store.property.pricing_tiers),
              room_types: clone(store.property.room_types),
              pricing_extras: clone(store.property.pricing_extras),
              max_persons: store.property.max_persons,
              currency: store.property.currency,
            }
            : null,
          upcoming_booking_count: 0,
          readiness: {
            state: 'LEGACY',
            preparation_state: preparationState(),
            has_configuration: store.room_types.length > 0 || store.rate_plans.length > 0 || store.room_rates.length > 0,
            blockers: [],
            warnings: [],
          },
        }];
        const entityCollection: Record<string, string> = {
          room_type: 'room_types',
          unit: 'units',
          rate_plan: 'rate_plans',
          room_rate: 'room_rates',
        };
        const calendarSnapshotToken = (from: string, to: string) => JSON.stringify({
          hotel_id: hotelId,
          start_date: from,
          end_date: to,
          room_types: store.room_types.map((row: any) => [row.id, row.version]),
          room_rates: store.room_rates.map((row: any) => [row.id, row.version]),
          rate_rules: store.rate_rules.filter((row: any) => row.valid_from <= to && row.valid_to >= from).map((row: any) => [row.id, row.version]),
          calendar_overrides: store.calendar_overrides.filter((row: any) => row.stay_date >= from && row.stay_date <= to).map((row: any) => [row.id, row.version]),
          occupancy_tiers: store.occupancy_tiers.map((row: any) => [row.id, row.version]),
          daily_inventory: store.daily_inventory.filter((row: any) => row.stay_date >= from && row.stay_date <= to).map((row: any) => [row.room_type_id, row.stay_date, row.version]),
        });
        const calendarSnapshot = (from: string, to: string) => {
          const dates: string[] = [];
          for (let cursor = new Date(`${from}T00:00:00.000Z`); cursor.toISOString().slice(0, 10) <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
            dates.push(cursor.toISOString().slice(0, 10));
          }
          return clone({
            hotel_id: hotelId,
            start_date: from,
            end_date: to,
            snapshot_token: calendarSnapshotToken(from, to),
            property: store.property,
            range: { from, to, guest_count: 2, stay_nights: 1 },
            room_types: store.room_types,
            room_rates: store.room_rates.map((rate: any) => ({
              ...rate,
              rate_plan_name_i18n: store.rate_plans.find((plan: any) => plan.id === rate.rate_plan_id)?.name_i18n || {},
            })),
            rate_rules: store.rate_rules,
            occupancy_tiers: store.occupancy_tiers,
            calendar_overrides: store.calendar_overrides.filter((row: any) => row.stay_date >= from && row.stay_date <= to),
            daily_inventory: store.daily_inventory.filter((row: any) => row.stay_date >= from && row.stay_date <= to),
            daily_rates: [],
            activity: store.activity,
            effective_cells: store.room_rates.flatMap((rate: any) => dates.map((stayDate) => {
              const room = store.room_types.find((entry: any) => entry.id === rate.room_type_id);
              const override = store.calendar_overrides.find((entry: any) => entry.room_rate_id === rate.id && entry.stay_date === stayDate && entry.is_active !== false);
              const inventory = store.daily_inventory.find((entry: any) => entry.room_type_id === rate.room_type_id && entry.stay_date === stayDate);
              const effectiveRate = override?.nightly_rate_mode === 'set' ? override.nightly_rate : rate.base_nightly_rate;
              const effectiveInventory = inventory?.sellable_units_mode === 'set' ? inventory.sellable_units : room?.base_inventory_count ?? 0;
              const effectiveClosed = inventory?.closed_mode === 'set' ? Boolean(inventory.closed) : false;
              const departure = new Date(`${stayDate}T00:00:00.000Z`);
              departure.setUTCDate(departure.getUTCDate() + 1);
              const departureDate = departure.toISOString().slice(0, 10);
              const departureOverride = store.calendar_overrides.find((entry: any) => entry.room_rate_id === rate.id && entry.stay_date === departureDate && entry.is_active !== false);
              const departureClosed = departureOverride?.closed_to_departure_mode === 'set' && Boolean(departureOverride.closed_to_departure);
              const blockingReasons = [
                ...(effectiveClosed || Number(effectiveInventory) <= 0 ? ['insufficient_or_closed_inventory'] : []),
                ...(departureClosed ? [{ code: 'closed_to_departure', stay_date: departureDate }] : []),
              ];
              return {
                room_rate_id: rate.id,
                stay_date: stayDate,
                requestable: blockingReasons.length === 0,
                blocking_reasons: blockingReasons,
                resolved: {
                  total: effectiveRate,
                  nights: 1,
                  bookable: blockingReasons.length === 0,
                  requestable: blockingReasons.length === 0,
                  blocking_reasons: blockingReasons,
                  nightly_breakdown: [{
                    stay_date: stayDate,
                    nightly_rate: effectiveRate,
                    sellable_units: effectiveInventory,
                    closed: effectiveClosed,
                    minimum_stay: override?.minimum_stay_mode === 'set' ? override.minimum_stay : null,
                    maximum_stay: override?.maximum_stay_mode === 'set' ? override.maximum_stay : null,
                    closed_to_arrival: override?.closed_to_arrival_mode === 'set' ? Boolean(override.closed_to_arrival) : false,
                    closed_to_departure: override?.closed_to_departure_mode === 'set' ? Boolean(override.closed_to_departure) : false,
                    source: override ? 'calendar_override' : 'room_rate_base',
                    provenance: override?.provenance || {},
                  }],
                },
              };
            })),
          });
        };

        stub.setRpcHandler('hotel_v2_admin_get_property_list', () => ({ data: directory(), error: null }));
        stub.setRpcHandler('hotel_v2_admin_get_property_workspace', (params: any) => {
          if (params.p_hotel_id !== hotelId) return { data: null, error: { code: 'P0002', message: 'property_not_found' } };
          return { data: snapshot(), error: null };
        });
        stub.setRpcHandler('hotel_v2_admin_apply_workspace_plan', (params: any) => {
          if ((window as any).__h2aFailNextApply) {
            (window as any).__h2aFailNextApply = false;
            return { data: null, error: { code: '40001', message: 'configuration changed after Review' } };
          }
          const plan = params.p_plan || {};
          if (plan.hotel_id !== hotelId || !Array.isArray(plan.operations) || !plan.operations.length) {
            return { data: null, error: { code: '22023', message: 'invalid_reviewed_plan' } };
          }
          for (const operation of plan.operations) {
            if (operation.entity === 'property') {
              if (plan.expected_property_updated_at !== store.property.updated_at) {
                return { data: null, error: { code: '40001', message: 'property changed after Review' } };
              }
              store.property = { ...store.property, ...clone(operation.payload), updated_at: timestamp() };
              continue;
            }
            const collectionName = entityCollection[operation.entity];
            if (!collectionName) return { data: null, error: { code: '22023', message: 'unsupported_entity' } };
            const collection = store[collectionName];
            const index = collection.findIndex((row: any) => row.id === operation.id);
            if (operation.type === 'create') {
              if (index >= 0 || operation.expected_version != null) {
                return { data: null, error: { code: '23505', message: 'duplicate_or_invalid_create' } };
              }
              collection.push({
                ...clone(operation.payload),
                id: operation.id,
                ...(operation.entity === 'room_type' || operation.entity === 'rate_plan' || operation.entity === 'room_rate'
                  ? { hotel_id: hotelId }
                  : {}),
                version: 1,
                created_at: timestamp(),
                updated_at: timestamp(),
              });
              continue;
            }
            if (operation.type === 'duplicate') {
              const source = collection.find((row: any) => row.id === operation.payload.source_id);
              if (!source || index >= 0 || source.version !== operation.expected_version) {
                return { data: null, error: { code: '40001', message: 'duplicate source changed after Review' } };
              }
              const { source_id: _sourceId, ...duplicatePayload } = clone(operation.payload);
              collection.push({
                ...source,
                ...duplicatePayload,
                id: operation.id,
                hotel_id: hotelId,
                version: 1,
                created_at: timestamp(),
                updated_at: timestamp(),
              });
              continue;
            }
            if (index < 0 || collection[index].version !== operation.expected_version) {
              return { data: null, error: { code: '40001', message: 'row changed after Review' } };
            }
            if (operation.type === 'disable') {
              collection[index] = { ...collection[index], status: 'disabled', version: collection[index].version + 1, updated_at: timestamp() };
            } else {
              collection[index] = {
                ...collection[index],
                ...clone(operation.payload),
                version: collection[index].version + 1,
                updated_at: timestamp(),
              };
            }
          }
          store.apply_receipts.push(clone({ plan, correlation_id: params.p_correlation_id }));
          return { data: { correlation_id: params.p_correlation_id, workspace: snapshot() }, error: null };
        });
        stub.setRpcHandler('hotel_v2_admin_create_property_draft', () => ({
          data: null,
          error: { code: '42501', message: 'not used by this legacy shadow preparation fixture' },
        }));
        stub.setRpcHandler('hotel_v2_admin_get_calendar', (params: any) => {
          if (params.p_hotel_id !== hotelId || !params.p_start_date || !params.p_end_date) {
            return { data: null, error: { code: '22023', message: 'invalid_calendar_query' } };
          }
          return { data: calendarSnapshot(params.p_start_date, params.p_end_date), error: null };
        });
        stub.setRpcHandler('hotel_v2_admin_apply_calendar_plan', (params: any) => {
          const plan = params.p_plan;
          if (plan?.hotel_id !== hotelId || !plan.from || !plan.to || !plan.reviewed_at || !plan.snapshot_token
              || !Array.isArray(plan.operations) || !plan.operations.length) {
            return { data: null, error: { code: '22023', message: 'invalid_calendar_plan' } };
          }
          if (plan.snapshot_token !== calendarSnapshotToken(plan.from, plan.to)) {
            return { data: null, error: { code: '40001', message: 'hotels_v2_h2b_stale_calendar_snapshot' } };
          }
          // Work only against staged copies. Any stale row or invalid operation
          // aborts before the fixture commits a single calendar change.
          const working: any = {
            calendar_overrides: clone(store.calendar_overrides),
            daily_inventory: clone(store.daily_inventory),
            rate_rules: clone(store.rate_rules),
            occupancy_tiers: clone(store.occupancy_tiers),
          };
          const pendingActivity: any[] = [];
          for (const operation of plan.operations) {
            const collections: Record<string, string> = {
              calendar_override: 'calendar_overrides', daily_inventory: 'daily_inventory',
              rate_rule: 'rate_rules', occupancy_tier: 'occupancy_tiers',
            };
            const collection = working[collections[operation.entity]];
            if (!collection) return { data: null, error: { code: '22023', message: 'unsupported_calendar_entity' } };
            const index = operation.entity === 'daily_inventory'
              ? collection.findIndex((row: any) => row.room_type_id === operation.payload.room_type_id && row.stay_date === operation.payload.stay_date)
              : collection.findIndex((row: any) => row.id === operation.id);
            const before = index >= 0 ? clone(collection[index]) : null;
            if (operation.type === 'delete') {
              if (index < 0 || collection[index].version !== operation.expected_version) return { data: null, error: { code: '40001', message: 'stale_calendar_row' } };
              collection.splice(index, 1);
            } else if (operation.type === 'create' || (operation.type === 'upsert' && operation.expected_version === 0)) {
              if (index >= 0) return { data: null, error: { code: '23505', message: 'calendar_key_exists' } };
              collection.push({ ...clone(operation.payload), ...(operation.id ? { id: operation.id } : {}), hotel_id: hotelId, version: 1, created_at: timestamp(), updated_at: timestamp() });
            } else {
              if (index < 0 || collection[index].version !== operation.expected_version) return { data: null, error: { code: '40001', message: 'stale_calendar_row' } };
              collection[index] = operation.type === 'disable'
                ? { ...collection[index], is_active: false, version: collection[index].version + 1, updated_at: timestamp() }
                : { ...collection[index], ...clone(operation.payload), version: collection[index].version + 1, updated_at: timestamp() };
            }
            const afterIndex = operation.entity === 'daily_inventory'
              ? collection.findIndex((row: any) => row.room_type_id === operation.payload.room_type_id && row.stay_date === operation.payload.stay_date)
              : collection.findIndex((row: any) => row.id === operation.id);
            const activityOrdinal = store.activity.length + pendingActivity.length + 1;
            pendingActivity.push({
              id: `40000000-0000-4000-8000-${String(activityOrdinal).padStart(12, '0')}`,
              hotel_id: hotelId,
              entity_type: operation.entity,
              entity_id: operation.id || operation.payload.room_type_id,
              action: `${operation.entity}_${operation.type}`,
              before_state: before,
              after_state: afterIndex >= 0 ? clone(collection[afterIndex]) : null,
              actor_type: 'admin', actor_id: adminId, source: 'admin',
              correlation_id: params.p_correlation_id,
              created_at: timestamp(),
            });
          }
          store.calendar_overrides = working.calendar_overrides;
          store.daily_inventory = working.daily_inventory;
          store.rate_rules = working.rate_rules;
          store.occupancy_tiers = working.occupancy_tiers;
          store.activity = [...pendingActivity.reverse(), ...store.activity];
          store.calendar_apply_receipts.push(clone({ plan, correlation_id: params.p_correlation_id }));
          return { data: { correlation_id: params.p_correlation_id, calendar: calendarSnapshot(plan.from, plan.to) }, error: null };
        });
        stub.setRpcHandler('hotel_v2_admin_resolve_rate', (params: any) => {
          const rate = store.room_rates.find((entry: any) => entry.id === params.p_room_rate_id);
          const nights = Math.round((Date.parse(`${params.p_check_out}T00:00:00Z`) - Date.parse(`${params.p_check_in}T00:00:00Z`)) / 86_400_000);
          return { data: { room_rate_id: rate?.id, nights, guest_count: params.p_guest_count, total: Number(rate?.base_nightly_rate || 0) * nights, bookable: true, status: 'Resolved' }, error: null };
        });
      },
    };
  };
}

async function queueUuid(page: Page, id: string): Promise<void> {
  await page.evaluate((nextId) => (window as any).__h2aUuidQueue.push(nextId), id);
}

async function saveReviewedChanges(page: Page, expectedEntityId: string): Promise<void> {
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toBeVisible();
  await expect(review).toContainText(HOTEL_ID);
  await expect(review).toContainText('Public Hotels V2 remains disabled');
  const reviewedExactIds = await page.evaluate(() => (window as any).HotelsV2Workspace.state.pendingReview
    .reviewedOperations.map((operation: any) => operation.id));
  expect(reviewedExactIds).toEqual([expectedEntityId]);
  await queueUuid(page, CORRELATION_ID);
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toBeHidden();
}

async function openRoomsTab(page: Page): Promise<void> {
  await page.locator('[data-hotel-workspace-tab="rooms"]').click();
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Rooms & Rates');
}

test('H2A Property Workspace keeps one legacy property inert while Rooms, Units and Rates use reviewed exact-ID RPCs', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), {
    adminId: ADMIN_ID,
    hotelId: HOTEL_ID,
    partnerId: PARTNER_ID,
  });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);

  await expect(page.locator('#adminContainer')).toBeVisible();
  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await expect(page.locator('#hotelPropertyList .hotel-property-card')).toHaveCount(1);
  const propertyCard = page.locator('#hotelPropertyList .hotel-property-card');
  await expect(propertyCard).toContainText('7 Arches');
  await expect(propertyCard).toContainText('0 normalized room types');
  await expect(propertyCard).toContainText('1 configured accommodation product');
  await expect(propertyCard).toContainText('Legacy');
  await expect(propertyCard).toContainText('Current public pricing');
  await expect(propertyCard).toContainText('€70.00');
  await expect(propertyCard).toContainText('63 legacy pricing rules');
  await expect(propertyCard).toContainText('Rooms V2 preparation');
  await expect(propertyCard).toContainText('Not configured');
  await expect(propertyCard).not.toContainText('— configured from');

  await propertyCard.locator('[data-hotel-open-workspace]').click();
  await expect(page.locator('#hotelPropertyWorkspace')).toBeVisible();
  await expect(page.locator('.hotel-workspace-header')).toContainText('LEGACY PROPERTY');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Migration preview');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Not migrated');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Legacy room rows');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Current live legacy product');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Tiered legacy pricing');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('€70.00');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('63');
  await expect(page.locator('#hotelWorkspaceActivePanel')).toContainText('Rooms V2 preparation');

  // The dedicated reconstruction flow carries no unconfirmed room facts or
  // pricing into V2. It only opens an inert exact-ID draft for explicit review.
  await queueUuid(page, SHADOW_PREVIEW_ID);
  await page.locator('[data-prepare-legacy-accommodation]').click();
  const shadowForm = page.locator('#hotelRoomEditorForm');
  await expect(shadowForm).toBeVisible();
  await expect(shadowForm).toContainText('Legacy source · read only');
  await expect(shadowForm).toContainText('Pricing is not copied in this operation');
  await expect(shadowForm.locator('input[readonly]').first()).toHaveValue(SHADOW_PREVIEW_ID);
  await expect(shadowForm.locator('[name="code"]')).toHaveValue('');
  await expect(shadowForm.locator('[name="name_en"]')).toHaveValue('');
  await expect(shadowForm.locator('[name="capacity_adults"]')).toHaveValue('');
  await expect(shadowForm.locator('[name="capacity_children"]')).toHaveValue('');
  await expect(shadowForm.locator('[name="inventory_mode"]')).toHaveValue('');
  await expect(shadowForm.locator('[name="base_inventory_count"]')).toHaveValue('');
  await expect(shadowForm.locator('[name="status"]')).toHaveValue('draft');
  await expect(shadowForm.locator('[name="room_amenity"]:checked')).toHaveCount(0);
  await expect(shadowForm.locator('[name="legacy_property_photo"]:checked')).toHaveCount(0);
  await expect(shadowForm).not.toContainText('Base nightly rate');
  await page.locator('.hotel-workspace-modal [data-hotel-modal-close]').last().click();

  const preCreateShadowAudit = await page.evaluate(() => ({
    architectureVersion: (window as any).__h2aE2eStore.property.architecture_version,
    publicState: (window as any).__h2aE2eStore.property.is_published,
    roomCount: (window as any).__h2aE2eStore.room_types.length,
    legacyRuleCount: (window as any).__h2aE2eStore.property.pricing_tiers.rules.length,
  }));
  expect(preCreateShadowAudit).toEqual({
    architectureVersion: 'legacy',
    publicState: true,
    roomCount: 0,
    legacyRuleCount: 63,
  });

  await openRoomsTab(page);

  // Create a pooled Room Type in shadow configuration.
  await queueUuid(page, ROOM_ID);
  await page.locator('[data-add-room]').click();
  const roomForm = page.locator('#hotelRoomEditorForm');
  await expect(roomForm).toBeVisible();
  await expect(roomForm.locator('input[readonly]')).toHaveValue(ROOM_ID);
  await roomForm.locator('[name="code"]').fill('deluxe-double');
  await roomForm.locator('[name="name_pl"]').fill('Pokój Deluxe');
  await roomForm.locator('[name="name_en"]').fill('Deluxe Double');
  await roomForm.locator('[name="name_he"]').fill('חדר דלוקס');
  await expect(roomForm.locator('[name="name_he"]')).toHaveAttribute('dir', 'rtl');
  await roomForm.locator('[name="capacity_adults"]').fill('2');
  await roomForm.locator('[name="capacity_children"]').fill('1');
  await roomForm.locator('[name="inventory_mode"]').selectOption('pooled');
  await roomForm.locator('[name="base_inventory_count"]').fill('4');
  await roomForm.locator('[name="status"]').selectOption('active');
  await roomForm.locator('[data-add-bed]').click();
  await roomForm.locator('[data-bed-type]').selectOption('king');
  await roomForm.locator('[data-bed-quantity]').fill('1');
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  await saveReviewedChanges(page, ROOM_ID);
  let roomCard = page.locator(`.hotel-room-card[data-room-id="${ROOM_ID}"]`);
  await expect(roomCard).toContainText('Deluxe Double');
  await expect(roomCard).toContainText('4 pooled units');

  // Edit the exact room and move it to unitized mode without auto-generating units.
  await roomCard.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  await page.locator('#hotelRoomEditorForm [name="name_en"]').fill('Deluxe Double Updated');
  await page.locator('#hotelRoomEditorForm [name="inventory_mode"]').selectOption('unitized');
  await expect(page.locator('#hotelRoomEditorForm [data-inventory-note]')).toContainText('never creates or deletes units');
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  await saveReviewedChanges(page, ROOM_ID);
  roomCard = page.locator(`.hotel-room-card[data-room-id="${ROOM_ID}"]`);
  await expect(roomCard).toContainText('Deluxe Double Updated');
  await expect(roomCard).toContainText('0 active physical units');

  // Add, edit and disable an exact physical unit.
  await roomCard.locator('summary').click();
  await queueUuid(page, UNIT_ID);
  await roomCard.locator(`[data-add-unit="${ROOM_ID}"]`).click();
  let unitForm = page.locator('#hotelUnitEditorForm');
  await unitForm.locator('[name="code"]').fill('101');
  await unitForm.locator('[name="name_en"]').fill('Room 101');
  await unitForm.locator('[name="name_he"]').fill('חדר 101');
  await unitForm.locator('[name="status"]').selectOption('active');
  await page.locator('button[form="hotelUnitEditorForm"]').click();
  await saveReviewedChanges(page, UNIT_ID);
  roomCard = page.locator(`.hotel-room-card[data-room-id="${ROOM_ID}"]`);
  await roomCard.locator('summary').click();
  await expect(roomCard).toContainText('Room 101');

  await roomCard.locator(`[data-edit-unit="${UNIT_ID}"]`).click();
  unitForm = page.locator('#hotelUnitEditorForm');
  await unitForm.locator('[name="name_en"]').fill('Room 101 East');
  await page.locator('button[form="hotelUnitEditorForm"]').click();
  await saveReviewedChanges(page, UNIT_ID);
  roomCard = page.locator(`.hotel-room-card[data-room-id="${ROOM_ID}"]`);
  await roomCard.locator('summary').click();
  await expect(roomCard).toContainText('Room 101 East');

  await roomCard.locator(`[data-edit-unit="${UNIT_ID}"]`).click();
  unitForm = page.locator('#hotelUnitEditorForm');
  await unitForm.locator('[name="status"]').selectOption('disabled');
  await page.locator('button[form="hotelUnitEditorForm"]').click();
  await saveReviewedChanges(page, UNIT_ID);
  roomCard = page.locator(`.hotel-room-card[data-room-id="${ROOM_ID}"]`);
  await roomCard.locator('summary').click();
  await expect(roomCard).toContainText('disabled');

  // Create and edit one reusable property Rate Plan.
  await queueUuid(page, RATE_PLAN_ID);
  await page.locator('[data-add-rate-plan]').click();
  let planForm = page.locator('#hotelRatePlanEditorForm');
  await planForm.locator('[name="code"]').fill('flexible');
  await planForm.locator('[name="name_en"]').fill('Standard Flexible');
  await planForm.locator('[name="name_he"]').fill('גמיש');
  await planForm.locator('[name="is_active"]').check();
  await page.locator('button[form="hotelRatePlanEditorForm"]').click();
  await saveReviewedChanges(page, RATE_PLAN_ID);
  let ratePlanCard = page.locator('.hotel-rate-plan-card').filter({ hasText: 'Standard Flexible' });
  await expect(ratePlanCard).toHaveCount(1);

  await ratePlanCard.locator(`[data-edit-rate-plan="${RATE_PLAN_ID}"]`).click();
  planForm = page.locator('#hotelRatePlanEditorForm');
  await planForm.locator('[name="name_en"]').fill('Flexible Breakfast');
  await planForm.locator('[name="meal_plan_code"]').fill('breakfast');
  await page.locator('button[form="hotelRatePlanEditorForm"]').click();
  await saveReviewedChanges(page, RATE_PLAN_ID);
  ratePlanCard = page.locator('.hotel-rate-plan-card').filter({ hasText: 'Flexible Breakfast' });
  await expect(ratePlanCard).toHaveCount(1);

  // Connect the same Room Type to the reusable Rate Plan as one product.
  roomCard = page.locator(`.hotel-room-card[data-room-id="${ROOM_ID}"]`);
  await queueUuid(page, ROOM_RATE_ID);
  await roomCard.locator(`[data-connect-room-rate="${ROOM_ID}"]`).click();
  const rateForm = page.locator('#hotelRoomRateEditorForm');
  await expect(rateForm.locator('[name="room_type_id"]')).toHaveValue(ROOM_ID);
  await expect(rateForm.locator('[name="rate_plan_id"]')).toHaveValue(RATE_PLAN_ID);
  await rateForm.locator('[name="base_nightly_rate"]').fill('120');
  await rateForm.locator('[name="is_active"]').check();
  await page.locator('button[form="hotelRoomRateEditorForm"]').click();
  await saveReviewedChanges(page, ROOM_RATE_ID);
  roomCard = page.locator(`.hotel-room-card[data-room-id="${ROOM_ID}"]`);
  await expect(roomCard).toContainText('Flexible Breakfast');
  await expect(roomCard).toContainText('€120.00');

  // Duplicate only the Room Type, then disable that exact draft copy.
  await queueUuid(page, DUPLICATE_ROOM_ID);
  await roomCard.locator(`[data-duplicate-room="${ROOM_ID}"]`).click();
  await saveReviewedChanges(page, DUPLICATE_ROOM_ID);
  let duplicateCard = page.locator(`.hotel-room-card[data-room-id="${DUPLICATE_ROOM_ID}"]`);
  await expect(duplicateCard).toContainText('Deluxe Double Updated copy');
  await expect(duplicateCard).toContainText('No Rate Plans connected');
  await expect(duplicateCard).toContainText('0 physical units');
  await duplicateCard.locator(`[data-disable-room="${DUPLICATE_ROOM_ID}"]`).click();
  await saveReviewedChanges(page, DUPLICATE_ROOM_ID);
  duplicateCard = page.locator(`.hotel-room-card[data-room-id="${DUPLICATE_ROOM_ID}"]`);
  await expect(duplicateCard).toContainText('DISABLED');

  // A reviewed stale edit fails closed and remains visible to the Admin.
  roomCard = page.locator(`.hotel-room-card[data-room-id="${ROOM_ID}"]`);
  await roomCard.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  await page.locator('#hotelRoomEditorForm [name="name_en"]').fill('Must Not Persist');
  await page.locator('button[form="hotelRoomEditorForm"]').click();
  const staleReview = page.locator('.hotel-workspace-modal--review');
  await expect(staleReview).toBeVisible();
  const preStaleName = await page.evaluate(() => (window as any).__h2aE2eStore.room_types
    .find((room: any) => room.id === '20000000-0000-4000-8000-000000000001').name_i18n.en);
  await page.evaluate(() => { (window as any).__h2aFailNextApply = true; });
  await queueUuid(page, CORRELATION_ID);
  await staleReview.locator('[data-hotel-review-confirm]').click();
  await expect(page.getByText('Save stopped: this configuration changed after Review. Refresh and review the fresh values.')).toBeVisible();
  await expect(staleReview).toBeVisible();
  await expect(staleReview.locator('[data-hotel-review-confirm]')).toBeEnabled();
  const postStaleName = await page.evaluate(() => (window as any).__h2aE2eStore.room_types
    .find((room: any) => room.id === '20000000-0000-4000-8000-000000000001').name_i18n.en);
  expect(postStaleName).toBe(preStaleName);
  await staleReview.locator('.hotel-workspace-modal__close').click();

  // Mobile and RTL remain usable without horizontal overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  await roomCard.locator(`[data-edit-room="${ROOM_ID}"]`).click();
  await expect(page.locator('#hotelRoomEditorForm [name="name_he"]')).toHaveAttribute('dir', 'rtl');
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector('.hotel-workspace-modal__dialog')?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      dialogLeft: dialog?.left ?? -1,
      dialogRight: dialog?.right ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.dialogLeft).toBeGreaterThanOrEqual(0);
  expect(layout.dialogRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  await page.locator('.hotel-workspace-modal [data-hotel-modal-close]').last().click();

  const audit = await page.evaluate(({ hotelId, expectedRoomIds }) => {
    const stub = (window as any).__supabaseStub;
    const store = (window as any).__h2aE2eStore;
    return {
      property: {
        id: store.property.id,
        architecture_version: store.property.architecture_version,
        is_published: store.property.is_published,
        pricing_model: store.property.pricing_model,
        legacy_pricing_rule_count: store.property.pricing_tiers?.rules?.length || 0,
        legacy_configuration_unchanged: JSON.stringify({
          pricing_tiers: store.property.pricing_tiers,
          pricing_extras: store.property.pricing_extras,
          room_types: store.property.room_types,
        }) === JSON.stringify(store.legacy_baseline),
      },
      flags: store.flags,
      roomIds: store.room_types.map((room: any) => room.id).sort(),
      units: store.units.map((unit: any) => ({ id: unit.id, room_type_id: unit.room_type_id, status: unit.status })),
      ratePlans: store.rate_plans.map((plan: any) => ({ id: plan.id, hotel_id: plan.hotel_id })),
      roomRates: store.room_rates.map((rate: any) => ({
        id: rate.id,
        hotel_id: rate.hotel_id,
        room_type_id: rate.room_type_id,
        rate_plan_id: rate.rate_plan_id,
      })),
      applyReceipts: cloneForAudit(store.apply_receipts),
      persistedLegacyHotel: stub.getTableRows('hotels').find((hotel: any) => hotel.id === hotelId),
      rawHotelMutations: stub.getMutationCalls().filter((call: any) => call.table === 'hotels'),
      rawPublicMutations: stub.getMutationCalls().filter((call: any) => [
        'hotel_bookings', 'partner_service_fulfillments', 'site_settings',
      ].includes(call.table)),
      expectedRoomIds,
    };

    function cloneForAudit(value: any) {
      return JSON.parse(JSON.stringify(value));
    }
  }, { hotelId: HOTEL_ID, expectedRoomIds: [ROOM_ID, DUPLICATE_ROOM_ID].sort() });

  expect(audit.property).toEqual({
    id: HOTEL_ID,
    architecture_version: 'legacy',
    is_published: true,
    pricing_model: 'tiered_by_nights',
    legacy_pricing_rule_count: 63,
    legacy_configuration_unchanged: true,
  });
  expect(audit.flags).toEqual({
    hotel_rooms_v2_enabled: false,
    hotel_external_sync_enabled: false,
    hotel_instant_booking_enabled: false,
    hotel_stripe_connect_enabled: false,
  });
  expect(audit.roomIds).toEqual(audit.expectedRoomIds);
  expect(audit.units).toEqual([{ id: UNIT_ID, room_type_id: ROOM_ID, status: 'disabled' }]);
  expect(audit.ratePlans).toEqual([{ id: RATE_PLAN_ID, hotel_id: HOTEL_ID }]);
  expect(audit.roomRates).toEqual([{
    id: ROOM_RATE_ID,
    hotel_id: HOTEL_ID,
    room_type_id: ROOM_ID,
    rate_plan_id: RATE_PLAN_ID,
  }]);
  expect(audit.applyReceipts.length).toBeGreaterThanOrEqual(10);
  expect(audit.applyReceipts.every((receipt: any) => receipt.plan.hotel_id === HOTEL_ID)).toBe(true);
  expect(audit.applyReceipts.flatMap((receipt: any) => receipt.plan.operations)
    .every((operation: any) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(operation.id))).toBe(true);
  expect(audit.persistedLegacyHotel.architecture_version).toBe('legacy');
  expect(audit.persistedLegacyHotel.is_published).toBe(true);
  expect(audit.rawHotelMutations).toEqual([]);
  expect(audit.rawPublicMutations).toEqual([]);
});

test('H2B Calendar edits exact dates atomically, exposes occupancy tiers, and switches to a mobile product list', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), {
    adminId: ADMIN_ID,
    hotelId: HOTEL_ID,
    partnerId: PARTNER_ID,
  });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);

  await page.evaluate(({ roomId, ratePlanId, roomRateId, hotelId }) => {
    const store = (window as any).__h2aE2eStore;
    store.room_types.push({
      id: roomId, hotel_id: hotelId, code: 'deluxe-double', name_i18n: { en: 'Deluxe Double' },
      capacity_adults: 2, capacity_children: 1, inventory_mode: 'pooled', base_inventory_count: 4,
      status: 'active', sort_order: 10, version: 1,
    });
    store.rate_plans.push({ id: ratePlanId, hotel_id: hotelId, code: 'flexible', name_i18n: { en: 'Standard Flexible' }, is_active: true, sort_order: 10, version: 1 });
    store.room_rates.push({ id: roomRateId, hotel_id: hotelId, room_type_id: roomId, rate_plan_id: ratePlanId, base_nightly_rate: 120, currency: 'EUR', is_active: true, sort_order: 10, version: 1 });
  }, { roomId: ROOM_ID, ratePlanId: RATE_PLAN_ID, roomRateId: ROOM_RATE_ID, hotelId: HOTEL_ID });

  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  await page.locator('[data-hotel-workspace-tab="calendar"]').click();
  await expect(page.locator('.hotel-calendar-grid')).toBeVisible();
  await expect(page.locator('.hotel-calendar-grid')).toContainText('Deluxe Double');
  await expect(page.locator('.hotel-calendar-grid')).toContainText('Standard Flexible');
  await expect(page.locator('.hotel-calendar-grid')).toContainText('€120.00');

  await page.locator(`input[data-calendar-product-check][value="${ROOM_RATE_ID}"]`).first().check();
  // A single click is a deliberate one-day selection; clear it before the
  // next two-click range selection.
  await page.locator(`.hotel-calendar-grid [data-calendar-cell][data-product-id="${ROOM_RATE_ID}"][data-date="2026-08-09"]`).click();
  await expect(page.locator('.hotel-calendar-selection')).toContainText('2026-08-09');
  await expect(page.locator('.hotel-calendar-selection')).not.toContainText('2026-08-09 →');
  await page.locator('[data-calendar-clear-selection]').click();
  await page.locator(`.hotel-calendar-grid [data-calendar-cell][data-product-id="${ROOM_RATE_ID}"][data-date="2026-08-10"]`).click();
  await page.locator(`.hotel-calendar-grid [data-calendar-cell][data-product-id="${ROOM_RATE_ID}"][data-date="2026-08-11"]`).click();
  await expect(page.locator('.hotel-calendar-selection')).toContainText('2026-08-10 → 2026-08-11');
  await page.locator('[data-calendar-edit-range]').click();

  const rangeForm = page.locator('#hotelCalendarRangeForm');
  await rangeForm.locator('[name="nightly_rate_mode"]').selectOption('set');
  await rangeForm.locator('[name="nightly_rate"]').fill('150');
  await rangeForm.locator('[name="sellable_units_mode"]').selectOption('set');
  await rangeForm.locator('[name="sellable_units"]').fill('2');
  await rangeForm.locator('[name="minimum_stay_mode"]').selectOption('set');
  await rangeForm.locator('[name="minimum_stay"]').fill('2');
  await rangeForm.locator('[name="closed_mode"]').selectOption('true');
  await rangeForm.locator('[name="reason"]').fill('August demand review');
  await rangeForm.locator('[name="expires_at"]').fill('2026-09-01T00:00');
  await queueUuid(page, CALENDAR_OVERRIDE_1_ID);
  await queueUuid(page, CALENDAR_OVERRIDE_2_ID);
  await page.locator('button[form="hotelCalendarRangeForm"]').click();

  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('One exact-property Calendar transaction');
  await expect(review).toContainText('August demand review');
  await expect(review).toContainText('Inherited / base value');
  await expect(review).toContainText('nightly_rate_mode');
  await queueUuid(page, CALENDAR_CORRELATION_ID);
  await review.locator('[data-calendar-review-confirm]').click();
  await expect(review).toBeHidden();
  const august10Cell = page.locator(`.hotel-calendar-grid [data-calendar-cell][data-date="2026-08-10"]`).first();
  await expect(august10Cell).toContainText('Closed');
  await expect(august10Cell).toContainText('2 rooms');
  await expect(august10Cell).toContainText('Min 2');

  const rangeAudit = await page.evaluate(() => {
    const store = (window as any).__h2aE2eStore;
    return {
      overrides: store.calendar_overrides.map((row: any) => ({ stay_date: row.stay_date, nightly_rate: row.nightly_rate, reason: row.reason, source: row.source, expires_at: row.expires_at })),
      inventory: store.daily_inventory.map((row: any) => ({ stay_date: row.stay_date, sellable_units: row.sellable_units, sellable_units_mode: row.sellable_units_mode, closed: row.closed, closed_mode: row.closed_mode })),
      operations: store.calendar_apply_receipts[0].plan.operations,
      planBounds: {
        from: store.calendar_apply_receipts[0].plan.from,
        to: store.calendar_apply_receipts[0].plan.to,
        snapshot_token: store.calendar_apply_receipts[0].plan.snapshot_token,
      },
      legacyRules: store.property.pricing_tiers.rules.length,
      architecture: store.property.architecture_version,
      published: store.property.is_published,
      flags: store.flags,
    };
  });
  expect(rangeAudit.overrides).toHaveLength(2);
  expect(rangeAudit.overrides.map((row: any) => row.stay_date)).toEqual(['2026-08-10', '2026-08-11']);
  expect(rangeAudit.overrides.every((row: any) => row.nightly_rate === 150 && row.reason === 'August demand review' && row.source === 'manual')).toBe(true);
  expect(rangeAudit.inventory).toEqual([
    { stay_date: '2026-08-10', sellable_units: 2, sellable_units_mode: 'set', closed: true, closed_mode: 'set' },
    { stay_date: '2026-08-11', sellable_units: 2, sellable_units_mode: 'set', closed: true, closed_mode: 'set' },
  ]);
  expect(rangeAudit.operations.filter((operation: any) => operation.entity === 'calendar_override')
    .every((operation: any) => operation.type === 'create' && operation.expected_version === 0
      && operation.payload.nightly_rate_mode === 'set' && operation.payload.minimum_stay_mode === 'set')).toBe(true);
  expect(rangeAudit.operations.filter((operation: any) => operation.entity === 'daily_inventory')
    .every((operation: any) => operation.type === 'upsert' && operation.expected_version === 0
      && operation.payload.sellable_units_mode === 'set' && operation.payload.closed_mode === 'set')).toBe(true);
  expect(rangeAudit.planBounds).toMatchObject({ from: '2026-08-01', to: '2026-08-31' });
  expect(rangeAudit.planBounds.snapshot_token).toContain('"start_date":"2026-08-01"');
  expect(rangeAudit).toMatchObject({ legacyRules: 63, architecture: 'legacy', published: true });
  expect(Object.values(rangeAudit.flags).every((value) => value === false)).toBe(true);

  // Reopen one exact day while preserving its reviewed inventory and minimum
  // stay. This covers the independent Set open operation.
  await page.locator('[data-calendar-clear-selection]').click();
  await august10Cell.click();
  await expect(page.locator('.hotel-calendar-selection')).toContainText('2026-08-10');
  await page.locator('[data-calendar-edit-range]').click();
  const openForm = page.locator('#hotelCalendarRangeForm');
  await openForm.locator('[name="closed_mode"]').selectOption('false');
  await openForm.locator('[name="reason"]').fill('Reopen exact day after review');
  await page.locator('button[form="hotelCalendarRangeForm"]').click();
  const openReview = page.locator('.hotel-workspace-modal--review');
  await expect(openReview).toContainText('Reopen exact day after review');
  await queueUuid(page, OPEN_CORRELATION_ID);
  await openReview.locator('[data-calendar-review-confirm]').click();
  await expect(openReview).toBeHidden();
  await expect(august10Cell).toContainText('€150.00');
  await expect(august10Cell).toContainText('2 rooms');
  await expect(august10Cell).toContainText('Min 2');
  await expect(august10Cell).not.toContainText('Closed');

  // A checkout-day CTD restriction belongs to 11 August but must visibly
  // block the authoritative one-night cell starting on 10 August.
  await page.locator('[data-calendar-clear-selection]').click();
  await page.locator(`.hotel-calendar-grid [data-calendar-cell][data-product-id="${ROOM_RATE_ID}"][data-date="2026-08-11"]`).click();
  await page.locator('[data-calendar-edit-range]').click();
  const departureForm = page.locator('#hotelCalendarRangeForm');
  await departureForm.locator('[name="closed_to_departure_mode"]').selectOption('true');
  await departureForm.locator('[name="reason"]').fill('Close departures on exact checkout date');
  await page.locator('button[form="hotelCalendarRangeForm"]').click();
  const departureReview = page.locator('.hotel-workspace-modal--review');
  await queueUuid(page, DEPARTURE_CORRELATION_ID);
  await departureReview.locator('[data-calendar-review-confirm]').click();
  await expect(departureReview).toBeHidden();
  await expect(august10Cell).toContainText('€150.00');
  await expect(august10Cell).toContainText('Not requestable');
  await expect(august10Cell).toContainText('Checkout 2026-08-11: closed to departure');
  await expect(august10Cell).not.toContainText('Not resolved');

  // One seasonal rule limited to explicit weekdays is created for the exact
  // selected Room × Rate Plan product.
  await page.locator('[data-add-calendar-rule]').click();
  const ruleForm = page.locator('#hotelCalendarRuleForm');
  await ruleForm.locator('[name="valid_from"]').fill('2026-08-15');
  await ruleForm.locator('[name="valid_to"]').fill('2026-08-31');
  await ruleForm.locator('[name="nightly_rate"]').fill('175');
  await ruleForm.locator('[name="minimum_stay"]').fill('3');
  await ruleForm.locator('[name="priority"]').fill('20');
  for (const checkbox of await ruleForm.locator('[name="weekday"]').all()) await checkbox.uncheck();
  await ruleForm.locator('[name="weekday"][value="1"]').check();
  await ruleForm.locator('[name="weekday"][value="5"]').check();
  await queueUuid(page, RATE_RULE_ID);
  await page.locator('button[form="hotelCalendarRuleForm"]').click();
  const ruleReview = page.locator('.hotel-workspace-modal--review');
  await expect(ruleReview).toContainText('Review seasonal / weekday rule');
  await queueUuid(page, RATE_RULE_CORRELATION_ID);
  await ruleReview.locator('[data-calendar-review-confirm]').click();
  await expect(ruleReview).toBeHidden();
  await expect(page.locator('.hotel-calendar-rules')).toContainText('€175.00');
  const storedRule = await page.evaluate(() => (window as any).__h2aE2eStore.rate_rules[0]);
  expect(storedRule).toMatchObject({ id: RATE_RULE_ID, room_rate_id: ROOM_RATE_ID, valid_from: '2026-08-15', valid_to: '2026-08-31', weekdays: [1, 5], nightly_rate: 175, minimum_stay: 3, priority: 20 });

  await page.locator('[data-add-occupancy-tier]').click();
  const tierForm = page.locator('#hotelOccupancyTierForm');
  await tierForm.locator('[name="guest_count"]').fill('2');
  await tierForm.locator('[name="threshold_nights"]').fill('3');
  await tierForm.locator('[name="nightly_rate"]').fill('105');
  await queueUuid(page, OCCUPANCY_TIER_ID);
  await page.locator('button[form="hotelOccupancyTierForm"]').click();
  const tierReview = page.locator('.hotel-workspace-modal--review');
  await expect(tierReview).toContainText('occupancy / stay tier');
  await queueUuid(page, TIER_CORRELATION_ID);
  await tierReview.locator('[data-calendar-review-confirm]').click();
  await expect(tierReview).toBeHidden();
  await expect(page.locator('.hotel-calendar-rules')).toContainText('2 guests · 3+ nights');

  await page.locator('[data-preview-authoritative-rate]').click();
  await page.locator('#hotelRatePreviewForm [name="check_in"]').fill('2026-08-10');
  await page.locator('#hotelRatePreviewForm [name="check_out"]').fill('2026-08-13');
  await page.locator('button[form="hotelRatePreviewForm"]').click();
  await expect(page.locator('[data-rate-preview-result]')).toContainText('€360.00');
  await page.locator('.hotel-workspace-modal [data-hotel-modal-close]').last().click();

  // Every successful exact operation is returned in the Calendar snapshot and
  // becomes visible in the shared property Activity panel.
  await page.locator('[data-hotel-workspace-tab="activity"]').click();
  const activityPanel = page.locator('#hotelWorkspaceActivePanel');
  await expect(activityPanel).toContainText('calendar override create');
  await expect(activityPanel).toContainText('calendar override update');
  await expect(activityPanel).toContainText('daily inventory upsert');
  await expect(activityPanel).toContainText('rate rule create');
  await expect(activityPanel).toContainText('occupancy tier create');

  // A changed snapshot rejects the complete reviewed multi-entity plan before
  // either its rate or inventory operation can mutate persisted state.
  await page.locator('[data-hotel-workspace-tab="calendar"]').click();
  await expect(page.locator('.hotel-calendar-grid')).toBeVisible();
  await page.locator('[data-calendar-edit-range]').click();
  const staleForm = page.locator('#hotelCalendarRangeForm');
  await staleForm.locator('[name="nightly_rate_mode"]').selectOption('set');
  await staleForm.locator('[name="nightly_rate"]').fill('999');
  await staleForm.locator('[name="sellable_units_mode"]').selectOption('set');
  await staleForm.locator('[name="sellable_units"]').fill('1');
  await staleForm.locator('[name="reason"]').fill('Must fail stale and atomically');
  await page.locator('button[form="hotelCalendarRangeForm"]').click();
  const staleCalendarReview = page.locator('.hotel-workspace-modal--review');
  await expect(staleCalendarReview).toContainText('Must fail stale and atomically');
  const beforeStale = await page.evaluate(() => {
    const store = (window as any).__h2aE2eStore;
    return {
      overrides: JSON.stringify(store.calendar_overrides),
      inventory: JSON.stringify(store.daily_inventory),
      receiptCount: store.calendar_apply_receipts.length,
      activityCount: store.activity.length,
    };
  });
  await page.evaluate(() => { (window as any).__h2aE2eStore.room_rates[0].version += 1; });
  await queueUuid(page, STALE_CALENDAR_CORRELATION_ID);
  await staleCalendarReview.locator('[data-calendar-review-confirm]').click();
  await expect(page.getByText('Save stopped: Calendar data changed after Review. Reload the exact range and review again.')).toBeVisible();
  await expect(staleCalendarReview).toBeVisible();
  const afterStale = await page.evaluate(() => {
    const store = (window as any).__h2aE2eStore;
    return {
      overrides: JSON.stringify(store.calendar_overrides),
      inventory: JSON.stringify(store.daily_inventory),
      receiptCount: store.calendar_apply_receipts.length,
      activityCount: store.activity.length,
    };
  });
  expect(afterStale).toEqual(beforeStale);
  await staleCalendarReview.getByRole('button', { name: 'Back', exact: true }).click();

  // The configurable two-month window remains bounded by the SQL 62-day
  // contract and navigation reloads one matching authoritative snapshot.
  await page.locator('[data-calendar-view]').selectOption('two_months');
  await expect(page.locator('[data-calendar-view]')).toHaveValue('two_months');
  await expect(page.locator('.hotel-calendar-toolbar')).toContainText('August 2026 – September 2026');
  await expect(page.locator(`.hotel-calendar-grid [data-calendar-cell][data-date="2026-09-30"]`)).toHaveCount(1);
  const twoMonthQuery = await page.evaluate(() => {
    const calls = (window as any).__supabaseStub.getRpcCalls().filter((call: any) => call.name === 'hotel_v2_admin_get_calendar');
    return calls.at(-1)?.params;
  });
  expect(twoMonthQuery).toMatchObject({ p_hotel_id: HOTEL_ID, p_start_date: '2026-08-01', p_end_date: '2026-09-30' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await expect(page.locator('.hotel-calendar-grid-shell')).toBeHidden();
  await expect(page.locator('.hotel-calendar-mobile')).toBeVisible();
  await expect(page.locator('[data-calendar-mobile-product]')).toHaveValue(ROOM_RATE_ID);
  await expect(page.locator(`.hotel-calendar-mobile [data-calendar-cell][data-date="2026-09-30"]`)).toBeVisible();
  const mobileLayout = await page.evaluate(() => ({
    direction: document.documentElement.dir,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(mobileLayout.direction).toBe('rtl');
  expect(mobileLayout.documentWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth + 1);
});
