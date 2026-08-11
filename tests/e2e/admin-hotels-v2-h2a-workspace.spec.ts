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
const SEVEN_ARCHES_UPPER_ID = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const SEVEN_ARCHES_GROUND_ID = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const SEVEN_ARCHES_RATE_PLAN_ID = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const SEVEN_ARCHES_UPPER_RATE_ID = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const SEVEN_ARCHES_GROUND_RATE_ID = '3320590d-632d-423f-80d0-fd021cba7293';
const SEVEN_ARCHES_SCHEDULE_ID = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const SEVEN_ARCHES_PARTY_PREVIEW_ID = '443065c0-984a-5de3-a22a-d03042c41107';

function seedHotelsV2H2aWorkspace() {
  return ({ adminId, hotelId, partnerId }: { adminId: string; hotelId: string; partnerId: string }) => {
    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const timestamp = () => '2026-08-11T12:00:00.000Z';
    // Keep deterministic IDs inside the serialized init-script closure. Values
    // declared only in the Playwright module are not visible in the browser.
    const SEVEN_ARCHES_UPPER_ID = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
    const SEVEN_ARCHES_GROUND_ID = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
    const SEVEN_ARCHES_RATE_PLAN_ID = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
    const SEVEN_ARCHES_UPPER_RATE_ID = '7e420964-9cbf-4f1b-abd3-09840af5240f';
    const SEVEN_ARCHES_GROUND_RATE_ID = '3320590d-632d-423f-80d0-fd021cba7293';
    const SEVEN_ARCHES_SCHEDULE_ID = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
    const SEVEN_ARCHES_PARTY_PREVIEW_ID = '443065c0-984a-5de3-a22a-d03042c41107';
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
      children_policy: null,
      minimum_child_age: null,
      owner_partner_id: partnerId,
      owner_partner: { id: partnerId, name: 'Fixture Hotels Partner', status: 'active', can_manage_hotels: true },
      room_types: [],
      pricing_tiers: { currency: 'EUR', rules: legacyPricingRules },
      pricing_extras: { currency: 'EUR', items: [] },
      pricing_model: 'tiered_by_nights',
      max_persons: 8,
      photos: Array.from({ length: 9 }, (_, index) => `https://example.test/7-arches-property-${index + 1}.webp`),
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
      pricing_schedules: [],
      pricing_schedule_tiers: [],
      rate_rules: [],
      occupancy_tiers: [],
      calendar_overrides: [],
      daily_inventory: [],
      calendar_apply_receipts: [],
      amenities_catalog: [
        { code: 'wifi', category: 'Connectivity', name_en: 'Wi-Fi', name_pl: 'Wi-Fi' },
        { code: 'air_conditioning', category: 'Comfort', name_en: 'Air conditioning', name_pl: 'Klimatyzacja' },
        { code: 'terrace', category: 'Outdoor', name_en: 'Terrace', name_pl: 'Taras' },
        { code: 'balcony', category: 'Outdoor', name_en: 'Balcony', name_pl: 'Balkon' },
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
          pricing_schedules: store.pricing_schedules,
          pricing_schedule_tiers: store.pricing_schedule_tiers,
          legacy_shadow_preview: {
            legacy_pricing_fingerprint: 'fixture-legacy-63-fingerprint',
            legacy_pricing_rule_count: 63,
            property_gallery_count: store.property.photos.length,
          },
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
        stub.setRpcHandler('hotel_v2_admin_apply_room_type_plan', (params: any) => {
          if ((window as any).__h2aFailNextApply) {
            (window as any).__h2aFailNextApply = false;
            return { data: null, error: { code: 'PT409', message: 'Room Type changed after Review' } };
          }
          const plan = params.p_plan || {};
          const operation = plan.operation || {};
          if (plan.hotel_id !== hotelId || plan.expected_property_updated_at !== store.property.updated_at
              || !['create', 'update', 'disable', 'duplicate'].includes(operation.type)
              || !operation.id || typeof operation.payload !== 'object') {
            return { data: null, error: { code: 'PT409', message: 'Room Type changed after Review' } };
          }
          const nextRooms = clone(store.room_types);
          const targetIndex = nextRooms.findIndex((row: any) => row.id === operation.id);
          if (operation.type === 'create') {
            if (targetIndex >= 0 || operation.expected_version !== 0) {
              return { data: null, error: { code: '23505', message: 'Room Type exact ID already exists' } };
            }
            nextRooms.push({ ...clone(operation.payload), id: operation.id, hotel_id: hotelId, version: 1, created_at: timestamp(), updated_at: timestamp() });
          } else if (operation.type === 'duplicate') {
            const sourceIndex = nextRooms.findIndex((row: any) => row.id === operation.payload.source_id);
            if (targetIndex >= 0 || sourceIndex < 0 || nextRooms[sourceIndex].version !== operation.expected_version) {
              return { data: null, error: { code: 'PT409', message: 'Room Type duplicate source changed after Review' } };
            }
            const { source_id: _sourceId, ...payload } = clone(operation.payload);
            nextRooms.push({ ...nextRooms[sourceIndex], ...payload, id: operation.id, hotel_id: hotelId, version: 1, created_at: timestamp(), updated_at: timestamp() });
          } else {
            if (targetIndex < 0 || nextRooms[targetIndex].version !== operation.expected_version) {
              return { data: null, error: { code: 'PT409', message: 'Room Type changed after Review' } };
            }
            nextRooms[targetIndex] = operation.type === 'disable'
              ? { ...nextRooms[targetIndex], status: 'disabled', version: nextRooms[targetIndex].version + 1, updated_at: timestamp() }
              : { ...nextRooms[targetIndex], ...clone(operation.payload), version: nextRooms[targetIndex].version + 1, updated_at: timestamp() };
          }
          store.room_types = nextRooms;
          store.apply_receipts.push(clone({ plan, correlation_id: params.p_correlation_id }));
          return { data: { correlation_id: params.p_correlation_id, workspace: snapshot() }, error: null };
        });
        stub.setRpcHandler('hotel_v2_admin_create_property_draft', () => ({
          data: null,
          error: { code: '42501', message: 'not used by this legacy shadow preparation fixture' },
        }));
        stub.setRpcHandler('hotel_v2_admin_apply_guest_policy_plan', (params: any) => {
          const plan = params.p_plan || {};
          if (plan.hotel_id !== hotelId || plan.expected_property_updated_at !== store.property.updated_at) {
            return { data: null, error: { code: 'PT409', message: 'guest policy changed after Review' } };
          }
          const nextProperty = clone(store.property);
          const nextRooms = clone(store.room_types);
          if (plan.property_policy) {
            nextProperty.children_policy = plan.property_policy.children_policy;
            nextProperty.minimum_child_age = plan.property_policy.minimum_child_age;
          }
          for (const roomPolicy of plan.room_policies || []) {
            const index = nextRooms.findIndex((room: any) => room.id === roomPolicy.room_type_id);
            if (index < 0 || nextRooms[index].version !== roomPolicy.expected_version) {
              return { data: null, error: { code: 'PT409', message: 'Room policy changed after Review' } };
            }
            nextRooms[index] = {
              ...nextRooms[index],
              children_policy_override: roomPolicy.children_policy_override,
              minimum_child_age_override: roomPolicy.minimum_child_age_override,
              version: nextRooms[index].version + 1,
              updated_at: timestamp(),
            };
          }
          nextProperty.updated_at = timestamp();
          store.property = nextProperty;
          store.room_types = nextRooms;
          return { data: { correlation_id: params.p_correlation_id, workspace: snapshot() }, error: null };
        });
        stub.setRpcHandler('hotel_v2_admin_prepare_legacy_shadow_rooms', (params: any) => {
          const plan = params.p_plan || {};
          if (plan.hotel_id !== hotelId || plan.source_contract !== 'seven_arches_two_apartments_v1'
              || plan.expected_property_updated_at !== store.property.updated_at
              || plan.expected_property_policy?.children_policy !== (store.property.children_policy ?? null)
              || plan.expected_property_policy?.minimum_child_age !== (store.property.minimum_child_age ?? null)
              || plan.expected_legacy_pricing_fingerprint !== 'fixture-legacy-63-fingerprint') {
            return { data: null, error: { code: 'PT409', message: 'legacy source changed after Review' } };
          }
          const versionFor = (rows: any[], id: string) => rows.find((row: any) => row.id === id)?.version || 0;
          const actualVersions = {
            upper_room: versionFor(store.room_types, SEVEN_ARCHES_UPPER_ID),
            ground_room: versionFor(store.room_types, SEVEN_ARCHES_GROUND_ID),
            pricing_schedule: versionFor(store.pricing_schedules, SEVEN_ARCHES_SCHEDULE_ID),
            property_party_preview: versionFor(store.pricing_schedules, SEVEN_ARCHES_PARTY_PREVIEW_ID),
            rate_plan: versionFor(store.rate_plans, SEVEN_ARCHES_RATE_PLAN_ID),
            upper_room_rate: versionFor(store.room_rates, SEVEN_ARCHES_UPPER_RATE_ID),
            ground_room_rate: versionFor(store.room_rates, SEVEN_ARCHES_GROUND_RATE_ID),
          };
          if (JSON.stringify(actualVersions) !== JSON.stringify(plan.expected_versions)) {
            return { data: null, error: { code: 'PT409', message: 'hotels_v2_h2b1_stale_shadow_room' } };
          }
          const working = clone({
            property: store.property, room_types: store.room_types, rate_plans: store.rate_plans,
            room_rates: store.room_rates, pricing_schedules: store.pricing_schedules,
            pricing_schedule_tiers: store.pricing_schedule_tiers,
          });
          const upsert = (collection: any[], id: string, value: any) => {
            const index = collection.findIndex((row: any) => row.id === id);
            const previous = index >= 0 ? collection[index] : null;
            const next = { ...previous, ...clone(value), id, version: previous ? previous.version + 1 : 1, updated_at: timestamp(), ...(previous ? {} : { created_at: timestamp() }) };
            if (index >= 0) collection[index] = next; else collection.push(next);
          };
          for (const room of plan.rooms) {
            const existingRoom = working.room_types.find((candidate: any) => candidate.id === room.id);
            upsert(working.room_types, room.id, {
              hotel_id: hotelId, code: room.code, name_i18n: room.name_i18n, description_i18n: room.description_i18n,
              gallery: room.gallery, capacity_adults: null, capacity_children: null, max_occupancy: 4,
              children_policy_override: existingRoom?.children_policy_override ?? null,
              minimum_child_age_override: existingRoom?.minimum_child_age_override ?? null,
              bed_configuration: [], bathrooms: null,
              size_sqm: null, amenities: room.amenities, inventory_mode: 'pooled', base_inventory_count: 1,
              status: existingRoom?.status || 'draft', sort_order: room.sort_order,
            });
          }
          if (!working.rate_plans.some((row: any) => row.id === SEVEN_ARCHES_RATE_PLAN_ID)) {
            upsert(working.rate_plans, SEVEN_ARCHES_RATE_PLAN_ID, {
              hotel_id: hotelId, code: 'standard', name_i18n: { en: 'Standard', pl: 'Standard', he: 'סטנדרט' },
              description_i18n: {}, cancellation_policy: {
                type: 'requires_review', reason: 'legacy_cancellation_terms_unconfirmed',
                summary_i18n: { en: 'Cancellation terms require confirmation' },
              }, booking_mode_override: null, is_active: false, sort_order: 100,
            });
          }
          if (!working.room_rates.some((row: any) => row.id === SEVEN_ARCHES_UPPER_RATE_ID)) {
            upsert(working.room_rates, SEVEN_ARCHES_UPPER_RATE_ID, {
              hotel_id: hotelId, room_type_id: SEVEN_ARCHES_UPPER_ID, rate_plan_id: SEVEN_ARCHES_RATE_PLAN_ID,
              pricing_schedule_id: SEVEN_ARCHES_SCHEDULE_ID,
              base_nightly_rate: 0, currency: 'EUR', is_active: false, sort_order: 100,
            });
          }
          if (!working.room_rates.some((row: any) => row.id === SEVEN_ARCHES_GROUND_RATE_ID)) {
            upsert(working.room_rates, SEVEN_ARCHES_GROUND_RATE_ID, {
              hotel_id: hotelId, room_type_id: SEVEN_ARCHES_GROUND_ID, rate_plan_id: SEVEN_ARCHES_RATE_PLAN_ID,
              pricing_schedule_id: SEVEN_ARCHES_SCHEDULE_ID,
              base_nightly_rate: 0, currency: 'EUR', is_active: false, sort_order: 200,
            });
          }
          if (!working.pricing_schedules.some((row: any) => row.id === SEVEN_ARCHES_SCHEDULE_ID)) {
            upsert(working.pricing_schedules, SEVEN_ARCHES_SCHEDULE_ID, { hotel_id: hotelId, application_scope: 'room_occupancy', is_active: false, requires_review: true });
          }
          if (!working.pricing_schedules.some((row: any) => row.id === SEVEN_ARCHES_PARTY_PREVIEW_ID)) {
            upsert(working.pricing_schedules, SEVEN_ARCHES_PARTY_PREVIEW_ID, { hotel_id: hotelId, application_scope: 'property_booking_party', is_active: false, requires_review: true });
          }
          if (!working.pricing_schedule_tiers.length) {
            working.pricing_schedule_tiers = Array.from({ length: 90 }, (_, index) => ({
              id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
              schedule_id: index < 27 ? SEVEN_ARCHES_SCHEDULE_ID : SEVEN_ARCHES_PARTY_PREVIEW_ID,
            }));
          }
          working.property.children_policy = 'minimum_age';
          working.property.minimum_child_age = 10;
          working.property.updated_at = timestamp();
          Object.assign(store, working);
          return { data: { correlation_id: params.p_correlation_id, workspace: snapshot() }, error: null };
        });
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

  // The exact reconstruction flow proposes two reviewed physical apartments,
  // but never chooses a Room Type photo or changes live legacy pricing.
  await page.locator('[data-prepare-seven-arches-apartments]').click();
  const shadowForm = page.locator('#hotelSevenArchesPreparationForm');
  await expect(shadowForm).toBeVisible();
  await expect(shadowForm).toContainText('Two real accommodation units');
  await expect(shadowForm).toContainText('Upper Floor Apartment');
  await expect(shadowForm).toContainText('Ground Floor Apartment');
  await expect(shadowForm).toContainText('Max 4 guests');
  await expect(shadowForm).toContainText('Adult/child split not confirmed');
  await expect(shadowForm).toContainText('Children allowed from age 10');
  await expect(shadowForm).toContainText('Shared pricing preparation');
  await expect(shadowForm.locator('[name="seven_room_0_name_he"]')).toHaveValue('דירה בקומה העליונה');
  await expect(shadowForm.locator('[name="seven_room_1_name_he"]')).toHaveValue('דירה בקומת הקרקע');
  await expect(shadowForm.locator('[name="seven_arches_room_0_photo"]:checked')).toHaveCount(0);
  await expect(shadowForm.locator('[name="seven_arches_room_1_photo"]:checked')).toHaveCount(0);
  await expect(shadowForm.locator('img')).toHaveCount(18);
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
  expect(audit.applyReceipts.flatMap((receipt: any) => receipt.plan.operations || [receipt.plan.operation]).filter(Boolean)
    .every((operation: any) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(operation.id))).toBe(true);
  expect(audit.persistedLegacyHotel.architecture_version).toBe('legacy');
  expect(audit.persistedLegacyHotel.is_published).toBe(true);
  expect(audit.rawHotelMutations).toEqual([]);
  expect(audit.rawPublicMutations).toEqual([]);
});

test('H2B.1 reviews child policy and prepares exactly two idempotent 7 Arches shadow apartments', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), { adminId: ADMIN_ID, hotelId: HOTEL_ID, partnerId: PARTNER_ID });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator('[data-hotel-open-workspace]').click();

  const guestCard = page.locator('.hotel-guest-policy-card').first();
  await expect(guestCard).toContainText('Not reviewed');
  await guestCard.locator('[data-edit-property-child-policy]').click();
  const childForm = page.locator('#hotelPropertyChildPolicyForm');
  await childForm.locator('[name="children_policy"]').selectOption('minimum_age');
  await childForm.locator('[name="minimum_child_age"]').fill('15');
  await expect(childForm.locator('[name="minimum_child_age"]')).toBeVisible();
  await page.locator('button[form="hotelPropertyChildPolicyForm"]').click();
  const childReview = page.locator('.hotel-workspace-modal--review');
  await expect(childReview).toContainText('minimum_age');
  await expect(childReview).toContainText('15');
  await childReview.locator('[data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-guest-policy-card').first()).toContainText('Children allowed from age 15');
  const propertyPolicyPayload = await page.evaluate(() => {
    const call = (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_apply_guest_policy_plan').at(-1);
    return call?.params?.p_plan?.property_policy;
  });
  expect(propertyPolicyPayload).toEqual({ children_policy: 'minimum_age', minimum_child_age: 15 });

  await page.locator('[data-prepare-seven-arches-apartments]').click();
  let prepareForm = page.locator('#hotelSevenArchesPreparationForm');
  await prepareForm.locator('[name="seven_arches_room_0_photo"]').first().check();
  await prepareForm.locator('[name="seven_arches_room_1_photo"]').nth(1).check();
  await page.locator('button[form="hotelSevenArchesPreparationForm"]').click();
  let review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('two-apartment shadow package');
  await expect(review).toContainText(SEVEN_ARCHES_UPPER_ID);
  await expect(review).toContainText(SEVEN_ARCHES_GROUND_ID);
  await expect(review).toContainText('property_minimum_child_age');
  await expect(review).toContainText('15');
  await expect(review).toContainText('10');
  await page.evaluate(() => {
    (window as any).__h2aE2eStore.property.updated_at = '2026-08-11T12:01:00.000Z';
  });
  await review.locator('[data-hotel-review-confirm]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review fresh 7 Arches two-apartment values');
  await expect(review).toContainText('Nothing was retried automatically');
  const afterStale = await page.evaluate(() => ({
    rooms: (window as any).__h2aE2eStore.room_types.length,
    plans: (window as any).__h2aE2eStore.rate_plans.length,
    rates: (window as any).__h2aE2eStore.room_rates.length,
    policy: (window as any).__h2aE2eStore.property.children_policy,
    shadowCalls: (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').length,
  }));
  expect(afterStale).toEqual({ rooms: 0, plans: 0, rates: 0, policy: 'minimum_age', shadowCalls: 1 });
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-guest-policy-card').first()).toContainText('Children allowed from age 10');
  const shadowPolicySnapshot = await page.evaluate(() => {
    const call = (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').at(-1);
    return call?.params?.p_plan?.expected_property_policy;
  });
  expect(shadowPolicySnapshot).toEqual({ children_policy: 'minimum_age', minimum_child_age: 15 });

  const firstSave = await page.evaluate(() => {
    const store = (window as any).__h2aE2eStore;
    return {
      roomIds: store.room_types.map((room: any) => room.id).sort(),
      roomFacts: store.room_types.map((room: any) => ({
        id: room.id, max: room.max_occupancy, adults: room.capacity_adults, children: room.capacity_children,
        inventory: room.base_inventory_count, amenities: room.amenities, photos: room.gallery.length,
      })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
      planCount: store.rate_plans.length,
      rateCount: store.room_rates.length,
      scheduleCount: store.pricing_schedules.length,
      scheduleTierCount: store.pricing_schedule_tiers.length,
      propertyPhotoCount: store.property.photos.length,
      legacyRuleCount: store.property.pricing_tiers.rules.length,
      architecture: store.property.architecture_version,
      flags: store.flags,
    };
  });
  expect(firstSave.roomIds).toEqual([SEVEN_ARCHES_GROUND_ID, SEVEN_ARCHES_UPPER_ID].sort());
  expect(firstSave.roomFacts).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: SEVEN_ARCHES_UPPER_ID, max: 4, adults: null, children: null, inventory: 1, amenities: ['air_conditioning', 'balcony', 'terrace'], photos: 1 }),
    expect.objectContaining({ id: SEVEN_ARCHES_GROUND_ID, max: 4, adults: null, children: null, inventory: 1, amenities: ['air_conditioning', 'terrace'], photos: 1 }),
  ]));
  expect(firstSave).toMatchObject({ planCount: 1, rateCount: 2, scheduleCount: 2, scheduleTierCount: 90, propertyPhotoCount: 9, legacyRuleCount: 63, architecture: 'legacy' });
  expect(Object.values(firstSave.flags).every((value) => value === false)).toBe(true);

  await page.locator('[data-hotel-workspace-tab="rooms"]').click();
  const upperCard = page.locator(`[data-room-id="${SEVEN_ARCHES_UPPER_ID}"]`);
  await expect(upperCard).toContainText('Shared schedule');
  await expect(upperCard).toContainText('Inactive shared schedule · 27 tiers · H3 allocation review required');
  const shadowRatePlan = page.locator('.hotel-rate-plan-card').filter({ hasText: 'Standard' });
  await expect(shadowRatePlan).toContainText('Cancellation terms require confirmation');
  await expect(shadowRatePlan).toContainText('INACTIVE');
  await upperCard.locator('[data-edit-room-rate]').click();
  const scheduleModal = page.locator('.hotel-workspace-modal');
  await expect(scheduleModal).toContainText('Dormant Rooms V2 shadow pricing');
  await expect(scheduleModal).toContainText('Its base rate is not an executable €0 price');
  await expect(scheduleModal.locator('#hotelRoomRateEditorForm')).toHaveCount(0);
  await scheduleModal.locator('[data-hotel-modal-close]').last().click();
  await upperCard.locator('[data-edit-room-child-policy]').click();
  const roomPolicyForm = page.locator('#hotelRoomChildPolicyForm');
  await roomPolicyForm.locator('[name="children_policy_override"]').selectOption('not_allowed');
  await page.locator('button[form="hotelRoomChildPolicyForm"]').click();
  const roomPolicyReview = page.locator('.hotel-workspace-modal--review');
  await expect(roomPolicyReview).toContainText(SEVEN_ARCHES_UPPER_ID);
  await expect(roomPolicyReview).toContainText('not_allowed');
  await roomPolicyReview.locator('[data-hotel-review-confirm]').click();
  const policyAudit = await page.evaluate((upperId) => {
    const store = (window as any).__h2aE2eStore;
    const upperRoom = store.room_types.find((room: any) => room.id === upperId);
    const call = (window as any).__supabaseStub.getRpcCalls().filter((entry: any) => entry.name === 'hotel_v2_admin_apply_guest_policy_plan').at(-1);
    return {
      propertyPolicy: store.property.children_policy,
      propertyAge: store.property.minimum_child_age,
      roomPolicy: upperRoom.children_policy_override,
      roomAge: upperRoom.minimum_child_age_override,
      roomVersion: upperRoom.version,
      payloadRoomId: call?.params?.p_plan?.room_policies?.[0]?.room_type_id,
    };
  }, SEVEN_ARCHES_UPPER_ID);
  expect(policyAudit).toMatchObject({ propertyPolicy: 'minimum_age', propertyAge: 10, roomPolicy: 'not_allowed', roomAge: null, roomVersion: 2, payloadRoomId: SEVEN_ARCHES_UPPER_ID });

  await page.evaluate(({ upperRateId, upperRoomId, groundRoomId }) => {
    const store = (window as any).__h2aE2eStore;
    store.calendar_overrides.push({
      id: '20000000-0000-4000-8000-000000000021',
      hotel_id: store.property.id,
      room_rate_id: upperRateId,
      stay_date: '2026-08-20',
      nightly_rate: 155,
      nightly_rate_mode: 'set',
      minimum_stay: 2,
      minimum_stay_mode: 'set',
      reason: 'Upper apartment shadow review',
      source: 'manual',
      is_active: true,
      version: 1,
    });
    store.daily_inventory.push(
      {
        room_type_id: upperRoomId,
        stay_date: '2026-08-20',
        sellable_units: 0,
        sellable_units_mode: 'set',
        closed: true,
        closed_mode: 'set',
        reason: 'Upper apartment maintenance preview',
        source: 'manual',
        version: 1,
      },
      {
        room_type_id: groundRoomId,
        stay_date: '2026-08-20',
        sellable_units: 1,
        sellable_units_mode: 'set',
        closed: false,
        closed_mode: 'set',
        reason: 'Ground apartment inventory preview',
        source: 'manual',
        version: 1,
      },
    );
  }, {
    upperRateId: SEVEN_ARCHES_UPPER_RATE_ID,
    upperRoomId: SEVEN_ARCHES_UPPER_ID,
    groundRoomId: SEVEN_ARCHES_GROUND_ID,
  });

  await page.locator('[data-hotel-workspace-tab="calendar"]').click();
  await expect(page.locator('.hotel-calendar-grid')).toContainText('Upper Floor Apartment');
  await expect(page.locator('.hotel-calendar-grid')).toContainText('Ground Floor Apartment');
  await expect(page.locator('.hotel-calendar-grid')).toContainText('Shared 27-tier shadow schedule');
  await expect(page.locator('.hotel-calendar-grid [data-calendar-product-row]')).toHaveCount(2);
  const upperShadowCell = page.locator(`.hotel-calendar-grid [data-calendar-cell][data-product-id="${SEVEN_ARCHES_UPPER_RATE_ID}"][data-date="2026-08-20"]`);
  const groundShadowCell = page.locator(`.hotel-calendar-grid [data-calendar-cell][data-product-id="${SEVEN_ARCHES_GROUND_RATE_ID}"][data-date="2026-08-20"]`);
  await expect(upperShadowCell).toContainText('Shared schedule · H3 pending');
  await expect(upperShadowCell).toContainText('Exact date draft rate: €155.00');
  await expect(upperShadowCell).toContainText('Exact room inventory: 0 rooms');
  await expect(upperShadowCell).toContainText('Min 2');
  await expect(upperShadowCell).toContainText('Shadow only · not requestable until occupancy/allocation is resolved');
  await expect(upperShadowCell).not.toContainText('Not resolved');
  await expect(groundShadowCell).toContainText('Shared schedule · H3 pending');
  await expect(groundShadowCell).toContainText('No exact date price override');
  await expect(groundShadowCell).toContainText('Exact room inventory: 1 room');
  await expect(groundShadowCell).not.toContainText('€155.00');
  await expect(groundShadowCell).not.toContainText('Not resolved');

  await page.locator('[data-hotel-workspace-tab="rooms"]').click();
  await page.locator('[data-prepare-seven-arches-apartments]').click();
  prepareForm = page.locator('#hotelSevenArchesPreparationForm');
  await expect(prepareForm.locator('[name="seven_arches_room_0_photo"]:checked')).toHaveCount(1);
  await expect(prepareForm.locator('[name="seven_arches_room_1_photo"]:checked')).toHaveCount(1);
  await page.locator('button[form="hotelSevenArchesPreparationForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await review.locator('[data-hotel-review-confirm]').click();
  const repeatedCounts = await page.evaluate(() => {
    const store = (window as any).__h2aE2eStore;
    return {
      rooms: store.room_types.length, plans: store.rate_plans.length, rates: store.room_rates.length,
      schedules: store.pricing_schedules.length, propertyPhotos: store.property.photos.length,
      planVersion: store.rate_plans[0].version,
      rateVersions: store.room_rates.map((rate: any) => rate.version),
      scheduleVersions: store.pricing_schedules.map((schedule: any) => schedule.version),
    };
  });
  expect(repeatedCounts).toEqual({
    rooms: 2, plans: 1, rates: 2, schedules: 2, propertyPhotos: 9,
    planVersion: 1, rateVersions: [1, 1], scheduleVersions: [1, 1],
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await page.locator('[data-prepare-seven-arches-apartments]').click();
  await expect(page.locator('.hotel-seven-arches-room')).toHaveCount(2);
  const mobile = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth, dir: document.documentElement.dir }));
  expect(mobile.dir).toBe('rtl');
  expect(mobile.documentWidth).toBeLessThanOrEqual(mobile.viewportWidth + 1);
});

test('H2B.1 reviewed save preserves existing ACTIVE v4/v5 apartments while changing reviewed age 15 to 10', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), { adminId: ADMIN_ID, hotelId: HOTEL_ID, partnerId: PARTNER_ID });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);

  await page.evaluate(({ hotelId, upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    store.property.children_policy = 'minimum_age';
    store.property.minimum_child_age = 15;
    store.room_types = [{
      id: upperId,
      hotel_id: hotelId,
      legacy_source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: { pl: 'Apartament na piętrze', en: 'Upper Floor Apartment', he: 'דירה בקומה העליונה' },
      description_i18n: {},
      gallery: [],
      capacity_adults: null,
      capacity_children: null,
      max_occupancy: 4,
      children_policy_override: null,
      minimum_child_age_override: null,
      bed_configuration: [],
      bathrooms: null,
      size_sqm: null,
      amenities: ['air_conditioning', 'balcony', 'terrace'],
      inventory_mode: 'pooled',
      base_inventory_count: 1,
      status: 'active',
      sort_order: 100,
      version: 4,
      created_at: '2026-08-11T09:00:00.000Z',
      updated_at: '2026-08-11T09:00:00.000Z',
    }, {
      id: groundId,
      hotel_id: hotelId,
      legacy_source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: { pl: 'Apartament na parterze', en: 'Ground Floor Apartment', he: 'דירה בקומת הקרקע' },
      description_i18n: {},
      gallery: [],
      capacity_adults: null,
      capacity_children: null,
      max_occupancy: 4,
      children_policy_override: null,
      minimum_child_age_override: null,
      bed_configuration: [],
      bathrooms: null,
      size_sqm: null,
      amenities: ['air_conditioning', 'terrace'],
      inventory_mode: 'pooled',
      base_inventory_count: 1,
      status: 'active',
      sort_order: 200,
      version: 5,
      created_at: '2026-08-11T09:00:00.000Z',
      updated_at: '2026-08-11T09:00:00.000Z',
    }];
  }, { hotelId: HOTEL_ID, upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });

  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  await page.locator('[data-prepare-seven-arches-apartments]').click();
  const form = page.locator('#hotelSevenArchesPreparationForm');
  await expect(form.locator('[name="seven_arches_room_0_photo"]:checked')).toHaveCount(0);
  await expect(form.locator('[name="seven_arches_room_1_photo"]:checked')).toHaveCount(0);
  await form.locator('[name="seven_arches_room_0_photo"]').nth(2).check();
  await form.locator('[name="seven_arches_room_1_photo"]').nth(3).check();
  await page.locator('button[form="hotelSevenArchesPreparationForm"]').click();
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('property_minimum_child_age');
  await expect(review).toContainText('15');
  await expect(review).toContainText('10');
  await review.locator('[data-hotel-review-confirm]').click();

  const audit = await page.evaluate(({ upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    const call = (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').at(-1);
    const room = (id: string) => store.room_types.find((candidate: any) => candidate.id === id);
    return {
      expectedPolicy: call?.params?.p_plan?.expected_property_policy,
      expectedRoomVersions: call?.params?.p_plan?.rooms?.map((candidate: any) => [candidate.id, candidate.expected_version]),
      savedPolicy: { children_policy: store.property.children_policy, minimum_child_age: store.property.minimum_child_age },
      upper: { status: room(upperId).status, version: room(upperId).version, gallery: room(upperId).gallery },
      ground: { status: room(groundId).status, version: room(groundId).version, gallery: room(groundId).gallery },
    };
  }, { upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });

  expect(audit).toEqual({
    expectedPolicy: { children_policy: 'minimum_age', minimum_child_age: 15 },
    expectedRoomVersions: [[SEVEN_ARCHES_UPPER_ID, 4], [SEVEN_ARCHES_GROUND_ID, 5]],
    savedPolicy: { children_policy: 'minimum_age', minimum_child_age: 10 },
    upper: { status: 'active', version: 5, gallery: ['https://example.test/7-arches-property-3.webp'] },
    ground: { status: 'active', version: 6, gallery: ['https://example.test/7-arches-property-4.webp'] },
  });
});

test('H2B.1 stale apartment review refreshes versions, preserves 5+5 photos, and waits for a second explicit Save', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), { adminId: ADMIN_ID, hotelId: HOTEL_ID, partnerId: PARTNER_ID });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);

  await page.evaluate(({ hotelId, upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    store.property.children_policy = 'minimum_age';
    store.property.minimum_child_age = 15;
    store.room_types = [{
      id: upperId, hotel_id: hotelId, legacy_source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: { pl: 'Apartament na piętrze', en: 'Upper Floor Apartment', he: 'דירה בקומה העליונה' },
      description_i18n: {}, gallery: [], capacity_adults: null, capacity_children: null, max_occupancy: 4,
      children_policy_override: null, minimum_child_age_override: null, bed_configuration: [], bathrooms: null,
      size_sqm: null, amenities: ['air_conditioning', 'balcony', 'terrace'], inventory_mode: 'pooled',
      base_inventory_count: 1, status: 'active', sort_order: 100, version: 4,
      created_at: '2026-08-11T09:00:00.000Z', updated_at: '2026-08-11T09:00:00.000Z',
    }, {
      id: groundId, hotel_id: hotelId, legacy_source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: { pl: 'Apartament na parterze', en: 'Ground Floor Apartment', he: 'דירה בקומת הקרקע' },
      description_i18n: {}, gallery: [], capacity_adults: null, capacity_children: null, max_occupancy: 4,
      children_policy_override: null, minimum_child_age_override: null, bed_configuration: [], bathrooms: null,
      size_sqm: null, amenities: ['air_conditioning', 'terrace'], inventory_mode: 'pooled',
      base_inventory_count: 1, status: 'active', sort_order: 200, version: 5,
      created_at: '2026-08-11T09:00:00.000Z', updated_at: '2026-08-11T09:00:00.000Z',
    }];
  }, { hotelId: HOTEL_ID, upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });

  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  await page.locator('[data-prepare-seven-arches-apartments]').click();
  const preparation = page.locator('#hotelSevenArchesPreparationForm');
  for (let index = 0; index < 5; index += 1) {
    await preparation.locator('[name="seven_arches_room_0_photo"]').nth(index).check();
    await preparation.locator('[name="seven_arches_room_1_photo"]').nth(index + 4).check();
  }
  await page.locator('button[form="hotelSevenArchesPreparationForm"]').click();
  let review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('selected_photo_count');

  await page.evaluate(({ upperId }) => {
    const store = (window as any).__h2aE2eStore;
    const upper = store.room_types.find((room: any) => room.id === upperId);
    upper.version += 1;
    upper.updated_at = '2026-08-11T09:05:00.000Z';
  }, { upperId: SEVEN_ARCHES_UPPER_ID });

  await review.locator('[data-hotel-review-confirm]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review fresh 7 Arches two-apartment values');
  await expect(review).toContainText('Nothing was retried automatically');
  await expect(review).toContainText('"selected_photo_count": 5');

  const afterConflict = await page.evaluate(() => ({
    shadowCalls: (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').length,
    galleries: (window as any).__h2aE2eStore.room_types.map((room: any) => room.gallery.length),
    policyAge: (window as any).__h2aE2eStore.property.minimum_child_age,
  }));
  expect(afterConflict).toEqual({ shadowCalls: 1, galleries: [0, 0], policyAge: 15 });

  await review.locator('[data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-workspace-modal--review')).toHaveCount(0);
  const afterExplicitSave = await page.evaluate(({ upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    const room = (id: string) => store.room_types.find((candidate: any) => candidate.id === id);
    return {
      shadowCalls: (window as any).__supabaseStub.getRpcCalls()
        .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').length,
      roomCount: store.room_types.length,
      versions: [room(upperId).version, room(groundId).version],
      galleries: [room(upperId).gallery.length, room(groundId).gallery.length],
      statuses: [room(upperId).status, room(groundId).status],
      propertyPhotos: store.property.photos.length,
      policy: [store.property.children_policy, store.property.minimum_child_age],
      architecture: store.property.architecture_version,
      flags: store.flags,
    };
  }, { upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });
  expect(afterExplicitSave).toMatchObject({
    shadowCalls: 2,
    roomCount: 2,
    versions: [6, 6],
    galleries: [5, 5],
    statuses: ['active', 'active'],
    propertyPhotos: 9,
    policy: ['minimum_age', 10],
    architecture: 'legacy',
    flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
  });
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
