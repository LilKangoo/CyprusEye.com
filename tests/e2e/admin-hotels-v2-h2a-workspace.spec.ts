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
    const H32_ASSIGNMENT_ID = '70000000-0000-4000-8000-000000000032';
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
      h32_permission: {
        exists: false,
        version: 0,
        updated_at: null,
        capabilities: {
          edit_property_content: false,
          edit_property_photos: false,
          edit_room_content: false,
          edit_room_photos: false,
          create_rooms: false,
          edit_room_structure: false,
          manage_prices: false,
          manage_availability: false,
          process_bookings: false,
          request_booking_changes: false,
          view_payment_status: false,
          initiate_stripe_onboarding: false,
        },
      },
      h32_apply_receipts: [],
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
        const h32CapabilityKeys = Object.keys(store.h32_permission.capabilities);
        const h32PermissionSnapshot = () => {
          const hasMutation = h32CapabilityKeys.some((key) => key !== 'view_payment_status' && store.h32_permission.capabilities[key] === true);
          return clone({
            contract_version: 'hotels_v2_h3_2a_partner_permissions_v1',
            property: {
              id: hotelId,
              updated_at: store.property.updated_at,
              architecture_version: store.property.architecture_version,
              is_published: store.property.is_published,
              status: store.property.status,
            },
            feature_flags: store.flags,
            capability_catalog: h32CapabilityKeys,
            assignment_fingerprint: 'h32-exact-assignment-v1',
            permissions_fingerprint: `h32-permission-v${store.h32_permission.version}`,
            snapshot_token: `h32-snapshot-v${store.h32_permission.version}`,
            assignments: [{
              assignment_id: H32_ASSIGNMENT_ID,
              partner_id: partnerId,
              hotel_id: hotelId,
              assignment_active: true,
              partner: { id: partnerId, name: 'Fixture Hotels Partner', status: 'active', can_manage_hotels: true },
              permission: {
                ...store.h32_permission,
                has_mutation_capability: hasMutation,
              },
            }],
          });
        };
        stub.setRpcHandler('hotel_v2_admin_get_partner_hotel_permissions', (params: any) => (
          params.p_hotel_id === hotelId
            ? { data: h32PermissionSnapshot(), error: null }
            : { data: null, error: { code: 'P0002', message: 'property_not_found' } }
        ));
        stub.setRpcHandler('hotel_v2_admin_apply_partner_hotel_permissions', (params: any) => {
          const plan = clone(params.p_plan || {});
          if ((window as any).__h32FailNextApply) {
            (window as any).__h32FailNextApply = false;
            store.h32_permission.version += 1;
            store.h32_permission.exists = true;
            store.h32_permission.updated_at = timestamp();
            return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_2a_stale_partner_permissions' } };
          }
          if (plan.contract_version !== 'hotels_v2_h3_2a_partner_permissions_v1'
              || plan.decision !== 'apply_partner_hotel_permissions'
              || plan.hotel_id !== hotelId || plan.assignment_id !== H32_ASSIGNMENT_ID || plan.partner_id !== partnerId
              || plan.snapshot_token !== `h32-snapshot-v${store.h32_permission.version}`
              || plan.expected_assignment_fingerprint !== 'h32-exact-assignment-v1'
              || Number(plan.expected_permission_version) !== Number(store.h32_permission.version)
              || h32CapabilityKeys.some((key) => typeof plan.capabilities?.[key] !== 'boolean')) {
            return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_2a_stale_partner_permissions' } };
          }
          store.h32_permission.exists = true;
          store.h32_permission.version += 1;
          store.h32_permission.updated_at = timestamp();
          store.h32_permission.capabilities = clone(plan.capabilities);
          store.h32_apply_receipts.push(clone({ plan, correlation_id: params.p_correlation_id, idempotency_key: params.p_idempotency_key }));
          return {
            data: {
              ok: true,
              contract_version: plan.contract_version,
              decision: plan.decision,
              hotel_id: hotelId,
              assignment_id: H32_ASSIGNMENT_ID,
              partner_id: partnerId,
              changed: true,
              permission: clone(store.h32_permission),
              correlation_id: params.p_correlation_id,
              idempotency_key: params.p_idempotency_key,
              snapshot: h32PermissionSnapshot(),
            },
            error: null,
          };
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
          if (plan.property_policy?.children_policy !== (store.property.children_policy ?? null)
              || plan.property_policy?.minimum_child_age !== (store.property.minimum_child_age ?? null)) {
            return {
              data: null,
              error: { code: '22023', message: 'hotels_v2_h2b2_shadow_property_policy_mismatch' },
            };
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
          // Mirror the production three-way write guard. Each locked CURRENT
          // field may be replaced only when it still equals the snapshot the
          // Admin originally reviewed, or when it already equals TARGET.
          for (const reviewedRoom of plan.rooms || []) {
            const currentRoom = store.room_types.find((room: any) => room.id === reviewedRoom.id);
            if (!currentRoom || !reviewedRoom.expected_original) continue;
            const original = reviewedRoom.expected_original;
            const current: Record<string, any> = {
              hotel_id: currentRoom.hotel_id,
              source_key: currentRoom.legacy_source_key ?? null,
              code: currentRoom.code,
              name_i18n: clone(currentRoom.name_i18n),
              description_i18n: clone(currentRoom.description_i18n || {}),
              gallery: clone(currentRoom.gallery || []),
              amenities: [...(currentRoom.amenities || [])].sort(),
              max_occupancy: currentRoom.max_occupancy,
              capacity_adults: currentRoom.capacity_adults,
              capacity_children: currentRoom.capacity_children,
              inventory_mode: currentRoom.inventory_mode,
              base_inventory_count: currentRoom.base_inventory_count,
              sort_order: currentRoom.sort_order,
            };
            const target: Record<string, any> = {
              hotel_id: hotelId,
              source_key: reviewedRoom.source_key,
              code: reviewedRoom.code,
              name_i18n: clone(reviewedRoom.name_i18n),
              description_i18n: clone(reviewedRoom.description_i18n || {}),
              gallery: clone(reviewedRoom.gallery || []),
              amenities: [...(reviewedRoom.amenities || [])].sort(),
              max_occupancy: 4,
              capacity_adults: null,
              capacity_children: null,
              inventory_mode: 'pooled',
              base_inventory_count: 1,
              sort_order: reviewedRoom.sort_order ?? 1000,
            };
            for (const field of Object.keys(target)) {
              const currentValue = JSON.stringify(current[field]);
              const originalValue = JSON.stringify(original[field]);
              const targetValue = JSON.stringify(target[field]);
              if (currentValue !== originalValue && currentValue !== targetValue) {
                return {
                  data: null,
                  error: {
                    code: 'PT409',
                    message: 'hotels_v2_h2b1_shadow_room_three_way_conflict',
                    details: JSON.stringify({ room_id: currentRoom.id, field, original: original[field], current: current[field], target: target[field] }),
                  },
                };
              }
            }
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
          // Room/photo preparation validates but never writes the separately
          // reviewed property policy or its optimistic-concurrency timestamp.
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

async function setExistingSevenArchesShadowRooms(page: Page, options: {
  upperAmenities: string[];
  groundAmenities: string[];
}): Promise<void> {
  await page.evaluate(({ hotelId, upperId, groundId, upperAmenities, groundAmenities }) => {
    const store = (window as any).__h2aE2eStore;
    store.property.children_policy = 'minimum_age';
    store.property.minimum_child_age = 15;
    store.room_types = [{
      id: upperId, hotel_id: hotelId, legacy_source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: { pl: 'Apartament na piętrze', en: 'Upper Floor Apartment', he: 'דירה בקומה העליונה' },
      description_i18n: {}, gallery: [], capacity_adults: null, capacity_children: null, max_occupancy: 4,
      children_policy_override: null, minimum_child_age_override: null, bed_configuration: [], bathrooms: null,
      size_sqm: null, amenities: upperAmenities, inventory_mode: 'pooled', base_inventory_count: 1,
      status: 'active', sort_order: 100, version: 4,
      created_at: '2026-08-11T09:00:00.000Z', updated_at: '2026-08-11T09:00:00.000Z',
    }, {
      id: groundId, hotel_id: hotelId, legacy_source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: { pl: 'Apartament na parterze', en: 'Ground Floor Apartment', he: 'דירה בקומת הקרקע' },
      description_i18n: {}, gallery: [], capacity_adults: null, capacity_children: null, max_occupancy: 4,
      children_policy_override: null, minimum_child_age_override: null, bed_configuration: [], bathrooms: null,
      size_sqm: null, amenities: groundAmenities, inventory_mode: 'pooled', base_inventory_count: 1,
      status: 'active', sort_order: 200, version: 5,
      created_at: '2026-08-11T09:00:00.000Z', updated_at: '2026-08-11T09:00:00.000Z',
    }];
  }, {
    hotelId: HOTEL_ID,
    upperId: SEVEN_ARCHES_UPPER_ID,
    groundId: SEVEN_ARCHES_GROUND_ID,
    upperAmenities: options.upperAmenities,
    groundAmenities: options.groundAmenities,
  });
}

async function prepareSevenKamaresPricingPromotionFixture(page: Page): Promise<void> {
  await page.evaluate(({ hotelId, upperId, groundId, planId, upperRateId, groundRateId, scheduleId, partyScheduleId }) => {
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const store = (window as any).__h2aE2eStore;
    const thresholds = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const durations = [...thresholds, 14];
    const matrices: Record<number, number[]> = {
      2: [100, 90, 88, 84, 80, 76, 74, 72, 70],
      3: [130, 113, 113, 104, 100, 95, 94, 90, 90],
      4: [155, 135, 135, 120, 118, 114, 111, 107, 107],
      5: [200, 180, 176, 168, 160, 152, 148, 144, 140],
      6: [260, 226, 226, 208, 200, 190, 188, 180, 180],
      7: [310, 270, 270, 240, 236, 228, 222, 214, 214],
      8: [310, 270, 270, 240, 236, 228, 222, 214, 214],
    };
    const allTiers = Object.entries(matrices).flatMap(([guestCount, rates]) => thresholds.map((threshold, index) => ({
      guest_count: Number(guestCount), threshold_nights: threshold, nightly_rate: rates[index], is_active: true,
    })));
    const roomTiers = allTiers.filter((tier) => tier.guest_count <= 4);
    const rateFor = (guestCount: number, nights: number) => {
      const threshold = Math.min(nights, 10);
      return matrices[guestCount][thresholds.indexOf(threshold)];
    };
    const roomRateId = (roomTypeId: string) => roomTypeId === upperId ? upperRateId : groundRateId;
    const comparison = (requestedGuests: number, allocations: any[], nights: number) => {
      const roomNightlyRates = allocations.map((item) => ({
        room_type_id: item.room_type_id,
        room_rate_id: item.room_rate_id,
        pricing_guest_count: item.pricing_guest_count,
        nightly_rate: rateFor(item.pricing_guest_count, nights),
      }));
      const roomRateSum = roomNightlyRates.reduce((total: number, item: any) => total + item.nightly_rate, 0);
      const legacyNightlyRate = rateFor(Math.max(2, requestedGuests), nights);
      return {
        requested_guest_count: requestedGuests,
        priced_occupancy: allocations.length === 1 ? allocations[0].pricing_guest_count : null,
        nights,
        threshold_nights: Math.min(nights, 10),
        room_nightly_rates: roomNightlyRates,
        room_rate_sum: roomRateSum,
        legacy_nightly_rate: legacyNightlyRate,
        stay_total: roomRateSum * nights,
        delta_from_legacy: roomRateSum - legacyNightlyRate,
        currency: 'EUR',
      };
    };
    const choiceRows = [1, 2, 3, 4].map((guestCount) => ({
      guest_count: guestCount,
      allocation_mode: 'customer_choice',
      options: [upperId, groundId].map((roomTypeId) => {
        const resolved = [{
          room_type_id: roomTypeId,
          room_rate_id: roomRateId(roomTypeId),
          allocated_guest_count: guestCount,
          pricing_guest_count: Math.max(2, guestCount),
        }];
        return {
          allocation: [{
            room_type_id: roomTypeId,
            room_rate_id: roomRateId(roomTypeId),
            allocated_guest_count: null,
            pricing_guest_count: null,
            units_required: 1,
          }],
          nightly_comparisons: durations.map((nights) => comparison(guestCount, resolved, nights)),
        };
      }),
    }));
    const bundleMap: Record<number, { physical: number[]; pricing: number[] }> = {
      5: { physical: [3, 2], pricing: [2, 2] },
      6: { physical: [3, 3], pricing: [3, 3] },
      7: { physical: [4, 3], pricing: [4, 4] },
      8: { physical: [4, 4], pricing: [4, 4] },
    };
    const bundleRows = [5, 6, 7, 8].map((guestCount) => {
      const mapping = bundleMap[guestCount];
      const allocations = [upperId, groundId].map((roomTypeId, index) => ({
        room_type_id: roomTypeId,
        room_rate_id: roomRateId(roomTypeId),
        allocated_guest_count: mapping.physical[index],
        pricing_guest_count: mapping.pricing[index],
        units_required: 1,
      }));
      return {
        guest_count: guestCount,
        allocation_mode: 'required_bundle',
        options: [{ allocation: allocations, nightly_comparisons: durations.map((nights) => comparison(guestCount, allocations, nights)) }],
      };
    });

    store.room_types = [{
      id: upperId, hotel_id: hotelId, code: 'upper-floor-apartment', name_i18n: { en: 'Upper Floor Apartment' },
      max_occupancy: 4, capacity_adults: null, capacity_children: null, inventory_mode: 'pooled',
      base_inventory_count: 1, amenities: ['air_conditioning', 'balcony', 'terrace'], gallery: [],
      status: 'active', sort_order: 100, version: 13,
    }, {
      id: groundId, hotel_id: hotelId, code: 'ground-floor-apartment', name_i18n: { en: 'Ground Floor Apartment' },
      max_occupancy: 4, capacity_adults: null, capacity_children: null, inventory_mode: 'pooled',
      base_inventory_count: 1, amenities: ['air_conditioning', 'terrace'], gallery: [],
      status: 'active', sort_order: 200, version: 14,
    }];
    store.rate_plans = [{
      id: planId, hotel_id: hotelId, code: 'standard', name_i18n: { en: 'Standard' },
      cancellation_policy: { type: 'non_refundable' }, price_inclusions: ['cleaning', 'taxes'],
      is_active: false, review_status: 'reviewed', sort_order: 100, version: 2,
    }];
    store.room_rates = [upperId, groundId].map((roomTypeId, index) => ({
      id: roomRateId(roomTypeId), hotel_id: hotelId, room_type_id: roomTypeId, rate_plan_id: planId,
      pricing_schedule_id: scheduleId, base_nightly_rate: 0, currency: 'EUR', is_active: false,
      sort_order: (index + 1) * 100, version: 1,
    }));
    store.pricing_schedules = [{
      id: scheduleId, hotel_id: hotelId, code: 'shared-apartment-occupancy-los', name_i18n: { en: 'Shared room schedule' },
      application_scope: 'room_occupancy', currency: 'EUR', maximum_party_size: 4,
      minimum_billable_occupancy: 2, is_active: false, review_status: 'requires_review', source: 'legacy_preview',
      version: 4,
    }, {
      id: partyScheduleId, hotel_id: hotelId, code: 'legacy-property-party-preview', name_i18n: { en: 'Legacy party preview' },
      application_scope: 'property_booking_party', currency: 'EUR', maximum_party_size: 8,
      minimum_billable_occupancy: 2, is_active: false, review_status: 'requires_review', source: 'legacy_preview',
      version: 5,
    }];
    store.pricing_schedule_tiers = [
      ...roomTiers.map((tier, index) => ({ ...tier, id: `41000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, schedule_id: scheduleId, version: 1 })),
      ...allTiers.map((tier, index) => ({ ...tier, id: `42000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, schedule_id: partyScheduleId, version: 1 })),
    ];
    const allocationRules = [
      { guests: 1, mode: 'customer_choice', physical: [null, null], pricing: [null, null] },
      { guests: 5, mode: 'required_bundle', physical: [3, 2], pricing: [2, 2] },
      { guests: 6, mode: 'required_bundle', physical: [3, 3], pricing: [3, 3] },
      { guests: 7, mode: 'required_bundle', physical: [4, 3], pricing: [4, 4] },
      { guests: 8, mode: 'required_bundle', physical: [4, 4], pricing: [4, 4] },
    ].map((rule, ruleIndex) => ({
      id: `43000000-0000-4000-8000-${String(ruleIndex + 1).padStart(12, '0')}`,
      hotel_id: hotelId,
      code: rule.mode === 'customer_choice' ? 'guests-1-4-choice' : `guests-${rule.guests}-bundle`,
      min_guest_count: rule.guests,
      max_guest_count: rule.mode === 'customer_choice' ? 4 : rule.guests,
      allocation_mode: rule.mode,
      is_active: true,
      review_status: 'reviewed',
      sort_order: (ruleIndex + 1) * 100,
      version: 1,
      items_fingerprint: `items-${ruleIndex + 1}`,
      items: [upperId, groundId].map((roomTypeId, itemIndex) => ({
        id: `44000000-0000-4000-8${ruleIndex}0${itemIndex}-${String(ruleIndex * 2 + itemIndex + 1).padStart(12, '0')}`,
        room_type_id: roomTypeId,
        units_required: 1,
        allocated_guest_count: rule.physical[itemIndex],
        // H3.1P starts with the physical split only. The reviewed promotion
        // writes this separate pricing occupancy atomically.
        pricing_guest_count: null,
        sort_order: (itemIndex + 1) * 100,
      })),
    }));
    store.h3_configuration = {
      hotel_id: hotelId,
      property: { id: hotelId, architecture_version: 'legacy', minimum_stay_nights: 2, updated_at: store.property.updated_at },
      pricing_schedules: clone(store.pricing_schedules),
      rate_plans: clone(store.rate_plans),
      allocation_rules: allocationRules,
      payment_policies: [], commission_policies: [], calendar_sources: [], flags: clone(store.flags),
    };
    store.promotion_receipts = [];
    store.promotion_legacy_baseline = JSON.stringify(store.property.pricing_tiers);
    (window as any).__promotionFailNextApply = false;

    const buildPreview = () => ({
      hotel_id: hotelId,
      contract_version: 'seven_kamares_legacy_to_h3_pricing_v1',
      supported: true,
      public_change: false,
      property: { id: hotelId, architecture_version: 'legacy', updated_at: store.property.updated_at },
      flags: clone(store.flags),
      source: {
        pricing_model: 'tiered_by_nights', currency: 'EUR', rule_count: 63,
        pricing_fingerprint: '7208ab4ecc0e47abd64d87ca1ac53a03', tier_fingerprint: 'legacy-tier-fingerprint',
        tiers: clone(allTiers),
        property_party_preview: {
          ...clone(store.pricing_schedules.find((row: any) => row.id === partyScheduleId)),
          tier_count: 63, tier_fingerprint: 'party-tier-fingerprint', tiers: clone(allTiers),
        },
      },
      target: {
        rate_plan: clone(store.rate_plans[0]), rooms: clone(store.room_types), room_rates: clone(store.room_rates),
        room_schedule: {
          ...clone(store.pricing_schedules.find((row: any) => row.id === scheduleId)),
          tier_count: 27, tier_fingerprint: 'room-tier-fingerprint', tiers: clone(roomTiers),
        },
        allocation_fingerprint: 'allocation-fingerprint', target_fingerprint: 'target-fingerprint',
      },
      allocation_previews: clone([...choiceRows, ...bundleRows]),
      pricing_occupancy_mapping_fingerprint: 'pricing-occupancy-mapping-fingerprint',
      parity: {
        threshold_case_count: 63, threshold_mismatch_count: 0,
        long_stay_case_count: 7, long_stay_mismatch_count: 0,
        total_case_count: 70, total_mismatch_count: 0, fingerprint: 'parity-fingerprint',
      },
      expected: {
        property_updated_at: store.property.updated_at,
        legacy_pricing_fingerprint: '7208ab4ecc0e47abd64d87ca1ac53a03',
        room_schedule_version: store.pricing_schedules.find((row: any) => row.id === scheduleId).version,
        room_schedule_tier_fingerprint: 'room-tier-fingerprint',
        allocation_fingerprint: 'allocation-fingerprint',
      },
      snapshot_token: `pricing-promotion-v${store.pricing_schedules.find((row: any) => row.id === scheduleId).version}`,
      promotion: {
        status: store.pricing_schedules.find((row: any) => row.id === scheduleId).review_status === 'reviewed'
          ? 'reviewed'
          : 'not_reviewed',
        decision: 'promote_room_schedule_to_reviewed',
      },
      safety: { legacy_unchanged: true, public_change: false }, blockers: [],
    });
    (window as any).__installPricingPromotionHandlers = () => {
      const stub = (window as any).__supabaseStub;
      stub.setRpcHandler('hotel_v2_admin_get_legacy_pricing_promotion_preview', (params: any) => (
        params.p_hotel_id === hotelId
          ? { data: buildPreview(), error: null }
          : { data: null, error: { code: 'P0002', message: 'property_not_found' } }
      ));
      stub.setRpcHandler('hotel_v2_admin_get_h3_1_configuration', () => ({ data: clone(store.h3_configuration), error: null }));
      stub.setRpcHandler('hotel_v2_admin_apply_legacy_pricing_promotion', (params: any) => {
        const plan = clone(params.p_plan || {});
        const schedule = store.pricing_schedules.find((row: any) => row.id === scheduleId);
        if ((window as any).__promotionFailNextApply) {
          (window as any).__promotionFailNextApply = false;
          schedule.version += 1;
          store.h3_configuration.pricing_schedules.find((row: any) => row.id === scheduleId).version = schedule.version;
          return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_pricing_promotion_stale_review' } };
        }
        if (plan.hotel_id !== hotelId || plan.acknowledge_pricing_occupancy_mapping !== true
            || plan.snapshot_token !== `pricing-promotion-v${schedule.version}`
            || Number(plan.expected?.room_schedule_version) !== Number(schedule.version)) {
          return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_pricing_promotion_stale_review' } };
        }
        const reviewedPricingByCode: Record<string, number[]> = {
          'guests-5-bundle': [2, 2],
          'guests-6-bundle': [3, 3],
          'guests-7-bundle': [4, 4],
          'guests-8-bundle': [4, 4],
        };
        store.h3_configuration.allocation_rules.forEach((rule: any) => {
          const reviewedPricing = reviewedPricingByCode[rule.code];
          if (!reviewedPricing) return;
          rule.items.forEach((item: any, index: number) => {
            item.pricing_guest_count = reviewedPricing[index];
          });
        });
        schedule.review_status = 'reviewed';
        schedule.version += 1;
        const h3Schedule = store.h3_configuration.pricing_schedules.find((row: any) => row.id === scheduleId);
        h3Schedule.review_status = 'reviewed';
        h3Schedule.version = schedule.version;
        store.promotion_receipts.push({ plan, correlation_id: params.p_correlation_id });
        return { data: { hotel_id: hotelId, review_status: 'reviewed', correlation_id: params.p_correlation_id }, error: null };
      });
    };
  }, {
    hotelId: HOTEL_ID,
    upperId: SEVEN_ARCHES_UPPER_ID,
    groundId: SEVEN_ARCHES_GROUND_ID,
    planId: SEVEN_ARCHES_RATE_PLAN_ID,
    upperRateId: SEVEN_ARCHES_UPPER_RATE_ID,
    groundRateId: SEVEN_ARCHES_GROUND_RATE_ID,
    scheduleId: SEVEN_ARCHES_SCHEDULE_ID,
    partyScheduleId: SEVEN_ARCHES_PARTY_PREVIEW_ID,
  });
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

  await page.evaluate(() => {
    // This broad workspace test opens shadow preparation before exercising
    // other editors. H2B.2 requires the property policy to have been reviewed
    // independently first.
    (window as any).__h2aE2eStore.property.children_policy = 'minimum_age';
    (window as any).__h2aE2eStore.property.minimum_child_age = 15;
  });

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
  await expect(shadowForm).toContainText('Children allowed from age 15');
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
  await expect(page.locator('.hotel-guest-policy-card').first()).toContainText('Children allowed from age 15');
  const shadowPolicySnapshot = await page.evaluate(() => {
    const call = (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').at(-1);
    return {
      expected: call?.params?.p_plan?.expected_property_policy,
      reviewed: call?.params?.p_plan?.property_policy,
    };
  });
  expect(shadowPolicySnapshot).toEqual({
    expected: { children_policy: 'minimum_age', minimum_child_age: 15 },
    reviewed: { children_policy: 'minimum_age', minimum_child_age: 15 },
  });

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
      propertyUpdatedAt: store.property.updated_at,
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
  expect(firstSave).toMatchObject({
    planCount: 1,
    rateCount: 2,
    scheduleCount: 2,
    scheduleTierCount: 90,
    propertyPhotoCount: 9,
    propertyUpdatedAt: '2026-08-11T12:01:00.000Z',
    legacyRuleCount: 63,
    architecture: 'legacy',
  });
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
  expect(policyAudit).toMatchObject({ propertyPolicy: 'minimum_age', propertyAge: 15, roomPolicy: 'not_allowed', roomAge: null, roomVersion: 2, payloadRoomId: SEVEN_ARCHES_UPPER_ID });

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

test('H2B.2 reviewed save preserves existing ACTIVE v4/v5 apartments and separately reviewed age 15', async ({ page }) => {
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
    savedPolicy: { children_policy: 'minimum_age', minimum_child_age: 15 },
    upper: { status: 'active', version: 5, gallery: ['https://example.test/7-arches-property-3.webp'] },
    ground: { status: 'active', version: 6, gallery: ['https://example.test/7-arches-property-4.webp'] },
  });
});

test('H2B.2 reviews property age 15 and clears both exact Room Type overrides atomically', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), {
    adminId: ADMIN_ID,
    hotelId: HOTEL_ID,
    partnerId: PARTNER_ID,
  });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await setExistingSevenArchesShadowRooms(page, {
    upperAmenities: ['air_conditioning', 'balcony', 'terrace'],
    groundAmenities: ['air_conditioning', 'terrace'],
  });
  const before = await page.evaluate(({ upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    store.property.children_policy = 'minimum_age';
    store.property.minimum_child_age = 10;
    store.property.updated_at = '2026-08-14T09:00:00.000Z';
    const upper = store.room_types.find((room: any) => room.id === upperId);
    const ground = store.room_types.find((room: any) => room.id === groundId);
    upper.children_policy_override = 'minimum_age';
    upper.minimum_child_age_override = 15;
    upper.gallery = store.property.photos.slice(0, 6);
    ground.children_policy_override = 'minimum_age';
    ground.minimum_child_age_override = 15;
    ground.gallery = store.property.photos.slice(4, 9);
    return {
      propertyUpdatedAt: store.property.updated_at,
      roomVersions: [upper.version, ground.version],
      pricing: JSON.stringify({
        plans: store.rate_plans,
        rates: store.room_rates,
        schedules: store.pricing_schedules,
        tiers: store.pricing_schedule_tiers,
      }),
    };
  }, { upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });

  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  const guestCard = page.locator('.hotel-guest-policy-card').first();
  await expect(guestCard).toContainText('Children allowed from age 10');
  await guestCard.locator('[data-edit-property-child-policy]').click();

  const form = page.locator('#hotelPropertyChildPolicyForm');
  await form.locator('[name="children_policy"]').selectOption('minimum_age');
  await form.locator('[name="minimum_child_age"]').fill('15');
  const clearOverrides = form.locator('[name="clear_room_policy_overrides"]');
  await expect(clearOverrides).toBeEnabled();
  await expect(form).toContainText('Clear 2 exact Room Type overrides');
  await clearOverrides.check();
  await page.locator('button[form="hotelPropertyChildPolicyForm"]').click();

  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review property policy and Room Type inheritance');
  await expect(review).toContainText(SEVEN_ARCHES_UPPER_ID);
  await expect(review).toContainText(SEVEN_ARCHES_GROUND_ID);
  await expect(review).toContainText('Property policy');
  const preConfirmCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls()
    .filter((entry: any) => entry.name === 'hotel_v2_admin_apply_guest_policy_plan').length);
  expect(preConfirmCalls).toBe(0);

  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  await expect(page.locator('.hotel-guest-policy-card').first()).toContainText('Children allowed from age 15');
  await page.locator('[data-hotel-workspace-tab="rooms"]').click();
  await expect(page.locator('.hotel-room-card__guest-policy')).toHaveCount(2);
  await expect(page.locator('.hotel-room-card__guest-policy').nth(0)).toContainText('property default');
  await expect(page.locator('.hotel-room-card__guest-policy').nth(1)).toContainText('property default');

  const audit = await page.evaluate(({ upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    const call = (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_apply_guest_policy_plan').at(-1);
    const room = (id: string) => store.room_types.find((candidate: any) => candidate.id === id);
    return {
      callCount: (window as any).__supabaseStub.getRpcCalls()
        .filter((entry: any) => entry.name === 'hotel_v2_admin_apply_guest_policy_plan').length,
      plan: call?.params?.p_plan,
      property: {
        policy: store.property.children_policy,
        age: store.property.minimum_child_age,
        architecture: store.property.architecture_version,
      },
      upper: {
        policy: room(upperId).children_policy_override,
        age: room(upperId).minimum_child_age_override,
        version: room(upperId).version,
        galleryCount: room(upperId).gallery.length,
      },
      ground: {
        policy: room(groundId).children_policy_override,
        age: room(groundId).minimum_child_age_override,
        version: room(groundId).version,
        galleryCount: room(groundId).gallery.length,
      },
      pricing: JSON.stringify({
        plans: store.rate_plans,
        rates: store.room_rates,
        schedules: store.pricing_schedules,
        tiers: store.pricing_schedule_tiers,
      }),
      flags: store.flags,
    };
  }, { upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });

  expect(audit.callCount).toBe(1);
  expect(audit.plan).toMatchObject({
    hotel_id: HOTEL_ID,
    expected_property_updated_at: before.propertyUpdatedAt,
    property_policy: { children_policy: 'minimum_age', minimum_child_age: 15 },
    room_policies: [{
      room_type_id: SEVEN_ARCHES_UPPER_ID,
      expected_version: before.roomVersions[0],
      children_policy_override: null,
      minimum_child_age_override: null,
    }, {
      room_type_id: SEVEN_ARCHES_GROUND_ID,
      expected_version: before.roomVersions[1],
      children_policy_override: null,
      minimum_child_age_override: null,
    }],
  });
  expect(audit.property).toEqual({ policy: 'minimum_age', age: 15, architecture: 'legacy' });
  expect(audit.upper).toEqual({ policy: null, age: null, version: before.roomVersions[0] + 1, galleryCount: 6 });
  expect(audit.ground).toEqual({ policy: null, age: null, version: before.roomVersions[1] + 1, galleryCount: 5 });
  expect(audit.pricing).toBe(before.pricing);
  expect(Object.values(audit.flags).every((value) => value === false)).toBe(true);
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
    plans: (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms')
      .map((entry: any) => entry.params.p_plan),
    galleries: (window as any).__h2aE2eStore.room_types.map((room: any) => room.gallery.length),
    policyAge: (window as any).__h2aE2eStore.property.minimum_child_age,
  }));
  expect(afterConflict.shadowCalls).toBe(1);
  expect(afterConflict.galleries).toEqual([0, 0]);
  expect(afterConflict.policyAge).toBe(15);
  const [firstPlan] = afterConflict.plans;
  expect(firstPlan.expected_versions).toMatchObject({ upper_room: 4, ground_room: 5 });
  expect(firstPlan.rooms.map((room: any) => room.expected_version)).toEqual([4, 5]);
  expect(firstPlan.rooms.map((room: any) => room.expected_original.amenities)).toEqual([
    ['air_conditioning', 'balcony', 'terrace'],
    ['air_conditioning', 'terrace'],
  ]);

  await review.locator('[data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-workspace-modal--review')).toHaveCount(0);
  const afterExplicitSave = await page.evaluate(({ upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    const room = (id: string) => store.room_types.find((candidate: any) => candidate.id === id);
    const plans = (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms')
      .map((entry: any) => entry.params.p_plan);
    return {
      shadowCalls: (window as any).__supabaseStub.getRpcCalls()
        .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').length,
      plans,
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
    policy: ['minimum_age', 15],
    architecture: 'legacy',
    flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
  });
  const [stalePlan, refreshedPlan] = afterExplicitSave.plans;
  expect(refreshedPlan.expected_property_updated_at).toBe(stalePlan.expected_property_updated_at);
  expect(refreshedPlan.expected_property_policy).toEqual(stalePlan.expected_property_policy);
  expect(refreshedPlan.expected_legacy_pricing_fingerprint).toBe(stalePlan.expected_legacy_pricing_fingerprint);
  expect(refreshedPlan.expected_versions).toEqual({
    ...stalePlan.expected_versions,
    upper_room: stalePlan.expected_versions.upper_room + 1,
  });
  expect(refreshedPlan.rooms.map((room: any) => room.expected_version)).toEqual([5, 5]);
  expect(refreshedPlan.rooms.map((room: any) => room.expected_original)).toEqual([
    expect.objectContaining({ amenities: ['air_conditioning', 'balcony', 'terrace'], gallery: [] }),
    expect.objectContaining({ amenities: ['air_conditioning', 'terrace'], gallery: [] }),
  ]);
  expect(refreshedPlan.rooms.map((room: any) => room.gallery.length)).toEqual([5, 5]);
});

test('H2B.1 a second concurrent edit after refreshed Review returns another controlled 409 with no auto retry', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), { adminId: ADMIN_ID, hotelId: HOTEL_ID, partnerId: PARTNER_ID });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await setExistingSevenArchesShadowRooms(page, {
    upperAmenities: ['air_conditioning', 'balcony', 'terrace'],
    groundAmenities: ['air_conditioning', 'terrace'],
  });

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

  await page.evaluate(({ upperId }) => {
    const store = (window as any).__h2aE2eStore;
    const upper = store.room_types.find((room: any) => room.id === upperId);
    upper.version += 1;
    upper.updated_at = '2026-08-11T09:05:00.000Z';
  }, { upperId: SEVEN_ARCHES_UPPER_ID });
  await review.locator('[data-hotel-review-confirm]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review fresh 7 Arches two-apartment values');

  await page.evaluate(({ groundId }) => {
    const store = (window as any).__h2aE2eStore;
    const ground = store.room_types.find((room: any) => room.id === groundId);
    ground.version += 1;
    ground.updated_at = '2026-08-11T09:06:00.000Z';
  }, { groundId: SEVEN_ARCHES_GROUND_ID });
  await review.locator('[data-hotel-review-confirm]').click();

  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Review fresh 7 Arches two-apartment values');
  const audit = await page.evaluate(() => ({
    calls: (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms')
      .map((entry: any) => entry.params.p_plan),
    galleries: (window as any).__h2aE2eStore.room_types.map((room: any) => room.gallery.length),
    policyAge: (window as any).__h2aE2eStore.property.minimum_child_age,
  }));
  expect(audit.calls).toHaveLength(2);
  expect(audit.calls[0].expected_versions).toMatchObject({ upper_room: 4, ground_room: 5 });
  expect(audit.calls[1].expected_versions).toMatchObject({ upper_room: 5, ground_room: 5 });
  expect(audit.calls[1].rooms.map((room: any) => room.gallery.length)).toEqual([5, 5]);
  expect(audit.galleries).toEqual([0, 0]);
  expect(audit.policyAge).toBe(15);
  await expect(review).toContainText('"selected_photo_count": 5');
});

test('H2B.1 harmless amenities rebase preserves 5+5 photos and saves when fresh values already equal target', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), { adminId: ADMIN_ID, hotelId: HOTEL_ID, partnerId: PARTNER_ID });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);

  // The modal opens from an older snapshot which does not yet contain the
  // complete confirmed amenity set.
  await setExistingSevenArchesShadowRooms(page, {
    upperAmenities: ['air_conditioning', 'terrace'],
    groundAmenities: ['air_conditioning'],
  });
  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  await page.locator('[data-prepare-seven-arches-apartments]').click();
  const preparation = page.locator('#hotelSevenArchesPreparationForm');
  for (let index = 0; index < 5; index += 1) {
    await preparation.locator('[name="seven_arches_room_0_photo"]').nth(index).check();
    await preparation.locator('[name="seven_arches_room_1_photo"]').nth(index + 4).check();
  }

  // Before final Review, the Admin-safe fresh read reports exactly the values
  // requested by this source-backed preparation. This is CURRENT == TARGET,
  // not a conflict, even though CURRENT != ORIGINAL.
  await page.evaluate(({ upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    const upper = store.room_types.find((room: any) => room.id === upperId);
    const ground = store.room_types.find((room: any) => room.id === groundId);
    upper.amenities = ['terrace', 'balcony', 'air_conditioning'];
    upper.version += 1;
    upper.updated_at = '2026-08-11T09:05:00.000Z';
    ground.amenities = ['terrace', 'air_conditioning'];
    ground.version += 1;
    ground.updated_at = '2026-08-11T09:05:00.000Z';
  }, { upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });

  await page.locator('button[form="hotelSevenArchesPreparationForm"]').click();
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toBeVisible();
  await expect(review).toContainText('selected_photo_count');
  await expect(review).toContainText('"selected_photo_count": 5');
  await expect(page.getByText('Fresh review required', { exact: true })).toHaveCount(0);

  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  const audit = await page.evaluate(({ upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    const room = (id: string) => store.room_types.find((candidate: any) => candidate.id === id);
    return {
      shadowCalls: (window as any).__supabaseStub.getRpcCalls()
        .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').length,
      roomCount: store.room_types.length,
      upper: { amenities: room(upperId).amenities, gallery: room(upperId).gallery.length },
      ground: { amenities: room(groundId).amenities, gallery: room(groundId).gallery.length },
      propertyPhotos: store.property.photos.length,
      policy: [store.property.children_policy, store.property.minimum_child_age],
      architecture: store.property.architecture_version,
      flags: store.flags,
    };
  }, { upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });
  expect(audit).toMatchObject({
    shadowCalls: 1,
    roomCount: 2,
    upper: { amenities: ['air_conditioning', 'balcony', 'terrace'], gallery: 5 },
    ground: { amenities: ['air_conditioning', 'terrace'], gallery: 5 },
    propertyPhotos: 9,
    policy: ['minimum_age', 15],
    architecture: 'legacy',
    flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
  });
});

test('H2B.1 genuine third-value amenities conflict needs an explicit choice and separate reviewed Save', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), { adminId: ADMIN_ID, hotelId: HOTEL_ID, partnerId: PARTNER_ID });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);

  await setExistingSevenArchesShadowRooms(page, {
    upperAmenities: ['air_conditioning', 'terrace'],
    groundAmenities: ['air_conditioning', 'terrace'],
  });
  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  await page.locator('[data-prepare-seven-arches-apartments]').click();
  const preparation = page.locator('#hotelSevenArchesPreparationForm');
  for (let index = 0; index < 5; index += 1) {
    await preparation.locator('[name="seven_arches_room_0_photo"]').nth(index).check();
    await preparation.locator('[name="seven_arches_room_1_photo"]').nth(index + 4).check();
  }

  await page.evaluate(({ upperId }) => {
    const store = (window as any).__h2aE2eStore;
    const upper = store.room_types.find((room: any) => room.id === upperId);
    upper.amenities = ['air_conditioning', 'private_pool', 'terrace'];
    upper.version += 1;
    upper.updated_at = '2026-08-11T09:05:00.000Z';
  }, { upperId: SEVEN_ARCHES_UPPER_ID });

  await page.locator('button[form="hotelSevenArchesPreparationForm"]').click();
  const conflict = page.locator('[data-seven-arches-conflict-review]');
  await expect(conflict).toBeVisible();
  await expect(conflict).toContainText('Upper Floor Apartment');
  await expect(conflict).toContainText('confirmed amenities');
  await expect(conflict).toContainText('private_pool');
  await expect(conflict.getByRole('button', { name: 'Keep current' })).toBeVisible();
  await expect(conflict.getByRole('button', { name: 'Use reviewed value' })).toBeVisible();
  await expect(conflict.getByRole('button', { name: 'Cancel' })).toBeVisible();

  const beforeChoice = await page.evaluate(() => ({
    shadowCalls: (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').length,
    galleries: (window as any).__h2aE2eStore.room_types.map((room: any) => room.gallery.length),
    policyAge: (window as any).__h2aE2eStore.property.minimum_child_age,
  }));
  expect(beforeChoice).toEqual({ shadowCalls: 0, galleries: [0, 0], policyAge: 15 });

  await conflict.getByRole('button', { name: 'Use reviewed value' }).click();
  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toBeVisible();
  await expect(review).toContainText('Review fresh 7 Arches two-apartment values');
  await expect(review).toContainText('"selected_photo_count": 5');

  const beforeExplicitSave = await page.evaluate(() => ({
    shadowCalls: (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').length,
    upperAmenities: (window as any).__h2aE2eStore.room_types[0].amenities,
    galleries: (window as any).__h2aE2eStore.room_types.map((room: any) => room.gallery.length),
    policyAge: (window as any).__h2aE2eStore.property.minimum_child_age,
  }));
  expect(beforeExplicitSave).toEqual({
    shadowCalls: 0,
    upperAmenities: ['air_conditioning', 'private_pool', 'terrace'],
    galleries: [0, 0],
    policyAge: 15,
  });

  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toHaveCount(0);
  const afterExplicitSave = await page.evaluate(({ upperId, groundId }) => {
    const store = (window as any).__h2aE2eStore;
    const room = (id: string) => store.room_types.find((candidate: any) => candidate.id === id);
    const lastCall = (window as any).__supabaseStub.getRpcCalls()
      .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').at(-1);
    return {
      shadowCalls: (window as any).__supabaseStub.getRpcCalls()
        .filter((entry: any) => entry.name === 'hotel_v2_admin_prepare_legacy_shadow_rooms').length,
      originalAmenities: lastCall?.params?.p_plan?.rooms?.[0]?.expected_original?.amenities,
      targetAmenities: lastCall?.params?.p_plan?.rooms?.[0]?.amenities,
      roomCount: store.room_types.length,
      upper: { amenities: room(upperId).amenities, gallery: room(upperId).gallery.length },
      ground: { amenities: room(groundId).amenities, gallery: room(groundId).gallery.length },
      propertyPhotos: store.property.photos.length,
      policy: [store.property.children_policy, store.property.minimum_child_age],
      architecture: store.property.architecture_version,
      flags: store.flags,
    };
  }, { upperId: SEVEN_ARCHES_UPPER_ID, groundId: SEVEN_ARCHES_GROUND_ID });
  expect(afterExplicitSave).toMatchObject({
    shadowCalls: 1,
    originalAmenities: ['air_conditioning', 'private_pool', 'terrace'],
    targetAmenities: ['air_conditioning', 'balcony', 'terrace'],
    roomCount: 2,
    upper: { amenities: ['air_conditioning', 'balcony', 'terrace'], gallery: 5 },
    ground: { amenities: ['air_conditioning', 'terrace'], gallery: 5 },
    propertyPhotos: 9,
    policy: ['minimum_age', 15],
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
  const afterStale = await page.evaluate((scheduleId) => {
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

test('H3.1 saves reviewed 7 Kamares booking setup atomically while public legacy behavior stays inert', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), {
    adminId: ADMIN_ID,
    hotelId: HOTEL_ID,
    partnerId: PARTNER_ID,
  });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);

  await page.evaluate(({ hotelId, partnerId, upperId, groundId, planId, upperRateId, groundRateId, scheduleId, partyPreviewId, externalSourceId }) => {
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const store = (window as any).__h2aE2eStore;
    store.property.children_policy = 'minimum_age';
    store.property.minimum_child_age = 15;
    store.property.owner_partner_id = partnerId;
    store.room_types = [{
      id: upperId, hotel_id: hotelId, code: 'upper-floor-apartment',
      name_i18n: { en: 'Upper Floor Apartment' }, max_occupancy: 4,
      capacity_adults: null, capacity_children: null, children_policy_override: null,
      minimum_child_age_override: null, inventory_mode: 'pooled', base_inventory_count: 1,
      amenities: ['air_conditioning', 'balcony', 'terrace'], gallery: ['https://example.test/upper.webp'],
      status: 'active', sort_order: 100, version: 9, updated_at: '2026-08-15T08:00:00.000Z',
    }, {
      id: groundId, hotel_id: hotelId, code: 'ground-floor-apartment',
      name_i18n: { en: 'Ground Floor Apartment' }, max_occupancy: 4,
      capacity_adults: null, capacity_children: null, children_policy_override: null,
      minimum_child_age_override: null, inventory_mode: 'pooled', base_inventory_count: 1,
      amenities: ['air_conditioning', 'terrace'], gallery: ['https://example.test/ground.webp'],
      status: 'active', sort_order: 200, version: 10, updated_at: '2026-08-15T08:00:00.000Z',
    }];
    store.rate_plans = [{
      id: planId, hotel_id: hotelId, code: 'standard', name_i18n: { en: 'Standard' },
      cancellation_policy: { type: 'non_refundable' }, price_inclusions: ['private_transfer'],
      is_active: false, sort_order: 100, version: 2,
    }];
    store.room_rates = [{
      id: upperRateId, hotel_id: hotelId, room_type_id: upperId, rate_plan_id: planId,
      base_nightly_rate: 0, currency: 'EUR', is_active: false, version: 1,
    }, {
      id: groundRateId, hotel_id: hotelId, room_type_id: groundId, rate_plan_id: planId,
      base_nightly_rate: 0, currency: 'EUR', is_active: false, version: 1,
    }];
    store.pricing_schedules = [{
      id: scheduleId, hotel_id: hotelId, code: 'shared-apartment-occupancy-los',
      name: 'Shared room schedule', application_scope: 'room_occupancy', maximum_party_size: 4,
      minimum_billable_occupancy: 1, is_active: false, review_status: 'requires_review', version: 3,
    }, {
      id: partyPreviewId, hotel_id: hotelId, code: 'legacy-property-party-preview',
      name: 'Legacy property party preview', application_scope: 'property_booking_party', maximum_party_size: 8,
      minimum_billable_occupancy: 1, is_active: false, review_status: 'requires_review', version: 5,
    }];

    const configuration: any = {
      hotel_id: hotelId,
      property: {
        id: hotelId, architecture_version: 'legacy', minimum_stay_nights: null,
        updated_at: store.property.updated_at,
      },
      pricing_schedules: clone(store.pricing_schedules),
      rate_plans: clone(store.rate_plans),
      allocation_rules: [], payment_policies: [], commission_policies: [], calendar_sources: [{
        id: externalSourceId, hotel_id: hotelId, code: 'booking-com-future', source_type: 'booking_com',
        is_enabled: true, review_status: 'reviewed', priority: 50, configuration: {}, version: 2,
      }],
      flags: clone(store.flags),
    };
    store.h3_configuration = configuration;
    store.h3_apply_receipts = [];
    (window as any).__h3FailNextApply = false;

    const snapshot = () => clone(store.h3_configuration);
    const collectionByEntity: Record<string, string> = {
      pricing_schedule: 'pricing_schedules',
      rate_plan: 'rate_plans',
      allocation_rule: 'allocation_rules',
      payment_policy: 'payment_policies',
      commission_policy: 'commission_policies',
      calendar_source: 'calendar_sources',
    };
    const stub = (window as any).__supabaseStub;
    stub.setRpcHandler('hotel_v2_admin_get_h3_1_configuration', (params: any) => {
      if (params.p_hotel_id !== hotelId) return { data: null, error: { code: 'P0002', message: 'property_not_found' } };
      return { data: snapshot(), error: null };
    });
    stub.setRpcHandler('hotel_v2_admin_apply_h3_1_configuration', (params: any) => {
      const plan = clone(params.p_plan || {});
      if ((window as any).__h3FailNextApply) {
        (window as any).__h3FailNextApply = false;
        return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_1_stale_pricing_schedule' } };
      }
      if (plan.hotel_id !== hotelId || plan.expected_property_updated_at !== store.h3_configuration.property.updated_at) {
        return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_1_stale_property' } };
      }
      if ((plan.operations || []).some((operation: any) => (
        operation.entity === 'allocation_rule'
        && (operation.payload?.items || []).some((item: any) => item.pricing_guest_count != null)
      ))) {
        return { data: null, error: { code: '22023', message: 'hotels_v2_h3_1p_dedicated_pricing_review_required' } };
      }
      for (const operation of plan.operations || []) {
        if (operation.entity === 'property_configuration') {
          if (operation.id !== hotelId || operation.expected_version !== 0) {
            return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_1_stale_property' } };
          }
          continue;
        }
        const collection = store.h3_configuration[collectionByEntity[operation.entity]];
        const current = collection?.find((row: any) => row.id === operation.id);
        const actualVersion = Number(current?.version || 0);
        if (!collection || actualVersion !== Number(operation.expected_version || 0)
            || (operation.type === 'create' && current)) {
          return { data: null, error: { code: 'PT409', message: `hotels_v2_h3_1_stale_${operation.entity}` } };
        }
      }
      const working = snapshot();
      for (const operation of plan.operations) {
        if (operation.entity === 'property_configuration') {
          working.property.minimum_stay_nights = operation.payload.minimum_stay_nights;
          working.property.updated_at = '2026-08-15T08:10:00.000Z';
          continue;
        }
        const collection = working[collectionByEntity[operation.entity]];
        const index = collection.findIndex((row: any) => row.id === operation.id);
        const next = {
          ...(index >= 0 ? collection[index] : {}), ...clone(operation.payload),
          id: operation.id, hotel_id: hotelId,
          version: index >= 0 ? Number(collection[index].version) + 1 : 1,
        };
        if (operation.type === 'disable') {
          if ('is_active' in next) next.is_active = false;
          if ('is_enabled' in next) next.is_enabled = false;
        }
        if (index >= 0) collection[index] = next;
        else collection.push(next);
      }
      store.h3_configuration = working;
      store.property.minimum_stay_nights = working.property.minimum_stay_nights;
      store.property.updated_at = working.property.updated_at;
      store.pricing_schedules = clone(working.pricing_schedules);
      store.rate_plans = store.rate_plans.map((planRow: any) => {
        const updated = working.rate_plans.find((entry: any) => entry.id === planRow.id);
        return updated ? { ...planRow, ...clone(updated) } : planRow;
      });
      store.h3_apply_receipts.push({ plan, correlation_id: params.p_correlation_id });
      return { data: { configuration: snapshot(), correlation_id: params.p_correlation_id }, error: null };
    });
  }, {
    hotelId: HOTEL_ID,
    partnerId: PARTNER_ID,
    upperId: SEVEN_ARCHES_UPPER_ID,
    groundId: SEVEN_ARCHES_GROUND_ID,
    planId: SEVEN_ARCHES_RATE_PLAN_ID,
    upperRateId: SEVEN_ARCHES_UPPER_RATE_ID,
    groundRateId: SEVEN_ARCHES_GROUND_RATE_ID,
    scheduleId: SEVEN_ARCHES_SCHEDULE_ID,
    partyPreviewId: SEVEN_ARCHES_PARTY_PREVIEW_ID,
    externalSourceId: '34000000-0000-4000-8000-000000000001',
  });

  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  await page.locator('[data-hotel-workspace-tab="booking_setup"]').click();
  const bookingPanel = page.locator('#hotelWorkspaceActivePanel');
  await expect(bookingPanel).toContainText('Public Hotels V2 flags stay OFF');

  await bookingPanel.locator('[data-apply-seven-kamares-h3-template]').click();
  const editor = page.locator('#hotelH3ConfigurationForm');
  await expect(editor).toBeVisible();
  await expect(editor).toContainText('Reviewed 7 Kamares template');
  await expect(editor.locator('[name="minimum_stay_nights"]')).toHaveValue('2');
  await expect(editor).toContainText('Customer chooses one room');
  await expect(editor).toContainText('Required bundle · exact rooms');
  await expect(editor).toContainText('Taxes included');
  await expect(editor).toContainText('Cleaning included');
  await expect(editor).toContainText('Preserved custom inclusions: private_transfer');
  await expect(editor).toContainText('Required for H3 readiness: check-in 14:00 · check-out 11:00');
  await expect(editor).toContainText('template does not invent account details');
  await expect(editor).toContainText('Future customer pricing is the sum of exact allocated Room Rates using the room_occupancy schedule');
  await expect(editor).toContainText('inactive 63-tier property_booking_party schedule remains a legacy parity preview only');
  await expect(editor).toContainText('Only the dedicated 70-case legacy pricing Review may write it.');
  await expect(editor).toContainText('Pricing occupancy is pending and locked.');
  await expect(editor.locator('[data-h3-pricing-locked="1"]')).toHaveCount(10);
  await expect(editor.locator('[data-h3-pricing-locked="1"]').first()).toHaveAttribute('readonly', '');
  const pendingFiveGuestPricing = editor.locator('[data-rule-code="guests-5-bundle"] [data-h3-room-pricing-guests]');
  await expect(pendingFiveGuestPricing).toHaveCount(2);
  await expect(pendingFiveGuestPricing.nth(0)).toHaveValue('');
  await expect(pendingFiveGuestPricing.nth(1)).toHaveValue('');
  await expect(editor.locator('[data-h3-open-overview]')).toHaveText('Review times in Overview');
  await expect(editor).toContainText('Public: no change');
  await page.locator('button[form="hotelH3ConfigurationForm"]').click();

  const review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toBeVisible();
  await expect(review).toContainText('Review Hotel booking setup');
  await expect(review).toContainText('One atomic, version-checked plan');
  await expect(review).toContainText('current public booking remain unchanged');
  await expect(review).toContainText('Future customer pricing will sum the exact allocated Room Rates using the room_occupancy schedule');
  await expect(review).toContainText('property_booking_party schedule is legacy preview only and never customer pricing');
  await expect(review).toContainText('This generic plan cannot promote or change the legacy pricing-occupancy mapping');
  await expect(review).toContainText('Separately review 14:00 check-in and 11:00 check-out in Overview');
  const receiptCountBeforeConfirm = await page.evaluate(
    () => (window as any).__h2aE2eStore.h3_apply_receipts.length,
  );
  expect(receiptCountBeforeConfirm).toBe(0);

  await review.locator('[data-hotel-review-confirm]').click();
  await expect(review).toBeHidden();
  await expect(bookingPanel).toContainText('2 night minimum');
  await expect(bookingPanel).toContainText('5 active rules');
  await expect(bookingPanel).toContainText('50%');
  await expect(bookingPanel).toContainText('€10.00 / allocated room / night');
  await expect(bookingPanel).toContainText('Manual Calendar');
  await expect(bookingPanel).toContainText('BLOCKED');
  await expect(bookingPanel).toContainText('Complete the dedicated legacy pricing Review before H3 shadow pricing can be ready.');
  await expect(bookingPanel).toContainText('Review and save 7 Kamares check-in 14:00 in Overview.');
  await expect(bookingPanel).toContainText('Review and save 7 Kamares check-out 11:00 in Overview.');
  await expect(bookingPanel).toContainText('Add reviewed partner bank-transfer instructions before H3 shadow booking can be operational.');
  await expect(bookingPanel).toContainText('Activate one reviewed Rate Plan before H3 activation.');
  await expect(bookingPanel).toContainText('Activate the reviewed Room Rate products before H3 activation.');

  const saved = await page.evaluate(() => {
    const store = (window as any).__h2aE2eStore;
    const receipt = store.h3_apply_receipts[0];
    return {
      configuration: store.h3_configuration,
      receipt,
      legacyRuleCount: store.property.pricing_tiers.rules.length,
      architecture: store.property.architecture_version,
      published: store.property.is_published,
      flags: store.flags,
      roomRatesActive: store.room_rates.filter((row: any) => row.is_active).length,
      ratePlansActive: store.rate_plans.filter((row: any) => row.is_active).length,
    };
  });
  expect(saved.configuration.property.minimum_stay_nights).toBe(2);
  expect(saved.configuration.pricing_schedules.map((schedule: any) => [
    schedule.application_scope, schedule.minimum_billable_occupancy,
  ])).toEqual([
    ['room_occupancy', 2],
    ['property_booking_party', 2],
  ]);
  expect(saved.configuration.rate_plans[0].price_inclusions).toEqual([
    'cleaning', 'private_transfer', 'taxes',
  ]);
  expect(saved.configuration.allocation_rules.map((rule: any) => [rule.min_guest_count, rule.max_guest_count])).toEqual([
    [1, 4], [5, 5], [6, 6], [7, 7], [8, 8],
  ]);
  expect(saved.configuration.allocation_rules.slice(1).map((rule: any) => (
    rule.items.map((item: any) => item.pricing_guest_count)
  ))).toEqual([[null, null], [null, null], [null, null], [null, null]]);
  expect(saved.configuration.payment_policies[0].terms).toEqual([
    expect.objectContaining({ due_event: 'after_partner_acceptance', amount_mode: 'percent_total', amount_value: 50, payment_methods: ['bank_transfer'] }),
    expect.objectContaining({ due_event: 'on_arrival', amount_mode: 'remaining_balance', payment_methods: ['card', 'cash'] }),
  ]);
  expect(saved.configuration.commission_policies[0]).toMatchObject({
    commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR',
  });
  expect(saved.configuration.calendar_sources).toEqual(expect.arrayContaining([
    expect.objectContaining({ source_type: 'manual', is_enabled: true, review_status: 'reviewed' }),
    expect.objectContaining({ source_type: 'booking_com', is_enabled: false }),
  ]));
  expect(saved.configuration.calendar_sources.filter((source: any) => source.source_type !== 'manual')
    .every((source: any) => source.is_enabled === false)).toBe(true);
  expect(saved.receipt.plan.operations.find((operation: any) => operation.entity === 'property_configuration'))
    .toMatchObject({ id: HOTEL_ID, expected_version: 0, payload: { minimum_stay_nights: 2 } });
  expect(saved.receipt.plan.operations.filter((operation: any) => operation.entity === 'allocation_rule')
    .flatMap((operation: any) => operation.payload.items)
    .every((item: any) => item.pricing_guest_count == null)).toBe(true);
  expect(JSON.stringify(saved.receipt.plan)).not.toMatch(/architecture_version|is_published|hotel_rooms_v2_enabled/);
  expect(saved).toMatchObject({
    legacyRuleCount: 63, architecture: 'legacy', published: true,
    roomRatesActive: 0, ratePlansActive: 0,
  });
  expect(Object.values(saved.flags).every((value) => value === false)).toBe(true);

  // A controlled stale response must leave the first reviewed configuration
  // untouched and prepare a fresh Review without an automatic second submit.
  await bookingPanel.locator('[data-edit-h3-configuration]').click();
  await page.locator('#hotelH3ConfigurationForm [name="minimum_stay_nights"]').fill('3');
  await page.locator('button[form="hotelH3ConfigurationForm"]').click();
  const staleReview = page.locator('.hotel-workspace-modal--review');
  await expect(staleReview).toBeVisible();
  await page.evaluate(() => { (window as any).__h3FailNextApply = true; });
  await staleReview.locator('[data-hotel-review-confirm]').click();
  await expect(page.getByText(/stale booking setup save was stopped/i)).toBeVisible();
  await expect(page.locator('.hotel-workspace-modal--review')).toBeVisible();
  const staleAudit = await page.evaluate(() => ({
    receiptCount: (window as any).__h2aE2eStore.h3_apply_receipts.length,
    minimumStay: (window as any).__h2aE2eStore.h3_configuration.property.minimum_stay_nights,
    applyCalls: (window as any).__supabaseStub.getRpcCalls()
      .filter((call: any) => call.name === 'hotel_v2_admin_apply_h3_1_configuration').length,
  }));
  expect(staleAudit).toEqual({ receiptCount: 1, minimumStay: 2, applyCalls: 2 });
});

test('H3.1P reviews exact legacy pricing parity, rebases one stale save, and stays public-inert', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), {
    adminId: ADMIN_ID,
    hotelId: HOTEL_ID,
    partnerId: PARTNER_ID,
  });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await prepareSevenKamaresPricingPromotionFixture(page);

  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  await openRoomsTab(page);
  const panel = page.locator('#hotelWorkspaceActivePanel');

  // Missing RPC/schema is fail-closed: the action cannot synthesize a browser
  // price preview or expose Review from raw legacy fields.
  await expect(panel.locator('[data-seven-kamares-pricing-promotion-card]')).toContainText(
    'Legacy pricing Review unavailable',
  );
  await expect(panel.locator('[data-seven-kamares-pricing-promotion-card]')).toContainText('FAIL CLOSED');
  await expect(panel.locator('[data-review-seven-kamares-pricing]')).toHaveCount(0);
  await expect(page.locator('[data-legacy-pricing-promotion-preview]')).toHaveCount(0);
  const missingFoundationAudit = await page.evaluate(() => ({
    previewCalls: (window as any).__supabaseStub.getRpcCalls()
      .filter((call: any) => call.name === 'hotel_v2_admin_get_legacy_pricing_promotion_preview').length,
    applyCalls: (window as any).__supabaseStub.getRpcCalls()
      .filter((call: any) => call.name === 'hotel_v2_admin_apply_legacy_pricing_promotion').length,
  }));
  expect(missingFoundationAudit).toEqual({ previewCalls: 1, applyCalls: 0 });

  await page.evaluate(() => { (window as any).__installPricingPromotionHandlers(); });
  await page.evaluate(async (hotelId) => {
    await (window as any).HotelsV2Workspace.openWorkspace(hotelId, { tab: 'rooms' });
  }, HOTEL_ID);
  const prePromotionState = await page.evaluate(() => {
    const configuration = (window as any).__h2aE2eStore.h3_configuration;
    return {
      roomScheduleCode: configuration.pricing_schedules[0].code,
      partyPreviewStatus: configuration.pricing_schedules[1].review_status,
      allocationCodes: configuration.allocation_rules.map((rule: any) => rule.code),
      bundlePricingCounts: configuration.allocation_rules.slice(1).map((rule: any) => (
        rule.items.map((item: any) => item.pricing_guest_count)
      )),
    };
  });
  expect(prePromotionState).toEqual({
    roomScheduleCode: 'shared-apartment-occupancy-los',
    partyPreviewStatus: 'requires_review',
    allocationCodes: [
      'guests-1-4-choice',
      'guests-5-bundle',
      'guests-6-bundle',
      'guests-7-bundle',
      'guests-8-bundle',
    ],
    bundlePricingCounts: [[null, null], [null, null], [null, null], [null, null]],
  });
  const action = panel.locator('[data-review-seven-kamares-pricing]');
  await expect(action).toHaveText('Review legacy → H3 pricing');
  await action.click();
  let promotionModal = page.locator('.hotel-pricing-promotion-modal');
  await expect(promotionModal).toBeVisible();
  await expect(promotionModal.locator('[data-pricing-source-rule-count]')).toHaveText('63');
  await expect(promotionModal.locator('[data-pricing-target-tier-count]')).toHaveText('27');
  await expect(promotionModal.locator('[data-pricing-parity-mismatch-count]')).toHaveText('0');
  await expect(promotionModal.locator('[data-pricing-allocation-preview]')).toContainText(
    'Upper Floor Apartment: 1 physical → 2 pricing',
  );
  await expect(promotionModal.locator('[data-pricing-allocation-preview]')).toContainText(
    'Upper Floor Apartment: 3 physical → 2 pricing',
  );
  await expect(promotionModal.locator('[data-pricing-allocation-preview]')).toContainText(
    'Ground Floor Apartment: 3 physical → 4 pricing',
  );
  await expect(promotionModal).toContainText('70-case parity replay');
  await expect(promotionModal).toContainText('7208ab4ecc0e47abd64d87ca1ac53a03');
  await expect(promotionModal).toContainText('Legacy pricing, public pages, booking payloads, bookings and fulfillments are not mutation targets.');
  const acknowledgement = promotionModal.locator('[data-pricing-occupancy-ack]');
  const buildReview = promotionModal.locator('[data-pricing-promotion-review]');
  await expect(buildReview).toBeDisabled();
  await acknowledgement.check();
  await expect(buildReview).toBeEnabled();
  await buildReview.click();

  promotionModal = page.locator('.hotel-pricing-promotion-modal');
  await expect(promotionModal).toContainText('Final Review · legacy → H3 pricing');
  await expect(promotionModal).toContainText('Reviewed normalized fields only');
  await expect(promotionModal).toContainText('Room schedule review status');
  await expect(promotionModal).toContainText('Legacy pricing, public pages, booking payloads, bookings and fulfillments are not mutation targets.');
  await expect(promotionModal.locator('[data-pricing-occupancy-ack]')).toBeChecked();
  await page.evaluate(() => { (window as any).__promotionFailNextApply = true; });
  await promotionModal.locator('[data-pricing-promotion-save]').click();

  // A PT409 fetches fresh exact fingerprints and constructs a new plan, but
  // does not submit it. The Admin must explicitly inspect and click Save again.
  promotionModal = page.locator('.hotel-pricing-promotion-modal');
  await expect(promotionModal).toContainText('Review fresh 7 Kamares pricing values');
  await expect(promotionModal).toContainText('Nothing was retried; inspect this Review and click Save explicitly again.');
  await expect(promotionModal.locator('[data-pricing-occupancy-ack]')).toBeChecked();
  const afterStale = await page.evaluate((scheduleId) => {
    const calls = (window as any).__supabaseStub.getRpcCalls()
      .filter((call: any) => call.name === 'hotel_v2_admin_apply_legacy_pricing_promotion');
    const store = (window as any).__h2aE2eStore;
    return {
      applyCalls: calls.length,
      receipts: store.promotion_receipts.length,
      firstExpectedVersion: calls[0]?.params?.p_plan?.expected?.room_schedule_version,
      firstSnapshot: calls[0]?.params?.p_plan?.snapshot_token,
      currentScheduleVersion: store.pricing_schedules.find((row: any) => row.id === scheduleId).version,
      bundlePricingCounts: store.h3_configuration.allocation_rules.slice(1).map((rule: any) => (
        rule.items.map((item: any) => item.pricing_guest_count)
      )),
    };
  }, SEVEN_ARCHES_SCHEDULE_ID);
  expect(afterStale).toEqual({
    applyCalls: 1,
    receipts: 0,
    firstExpectedVersion: 4,
    firstSnapshot: 'pricing-promotion-v4',
    currentScheduleVersion: 5,
    bundlePricingCounts: [[null, null], [null, null], [null, null], [null, null]],
  });

  await promotionModal.locator('[data-pricing-promotion-save]').click();
  await expect(promotionModal).toBeHidden();
  await expect(panel.locator('[data-review-seven-kamares-pricing]')).toHaveText('View pricing mapping');

  const finalState = await page.evaluate((scheduleId) => {
    const store = (window as any).__h2aE2eStore;
    const calls = (window as any).__supabaseStub.getRpcCalls()
      .filter((call: any) => call.name === 'hotel_v2_admin_apply_legacy_pricing_promotion');
    const schedule = store.pricing_schedules.find((row: any) => row.id === scheduleId);
    return {
      applyCalls: calls.length,
      expectedVersions: calls.map((call: any) => call.params.p_plan.expected.room_schedule_version),
      snapshotTokens: calls.map((call: any) => call.params.p_plan.snapshot_token),
      receiptCount: store.promotion_receipts.length,
      schedule: { review_status: schedule.review_status, is_active: schedule.is_active, version: schedule.version },
      roomCount: store.room_types.length,
      ratePlanActive: store.rate_plans[0].is_active,
      roomRatesActive: store.room_rates.map((row: any) => row.is_active),
      pricingGuestCounts: store.h3_configuration.allocation_rules.slice(1).map((rule: any) => (
        rule.items.map((item: any) => item.pricing_guest_count)
      )),
      legacyUnchanged: JSON.stringify(store.property.pricing_tiers) === store.promotion_legacy_baseline,
      architecture: store.property.architecture_version,
      flagsOff: Object.values(store.flags).every((value) => value === false),
    };
  }, SEVEN_ARCHES_SCHEDULE_ID);
  expect(finalState).toEqual({
    applyCalls: 2,
    expectedVersions: [4, 5],
    snapshotTokens: ['pricing-promotion-v4', 'pricing-promotion-v5'],
    receiptCount: 1,
    schedule: { review_status: 'reviewed', is_active: false, version: 6 },
    roomCount: 2,
    ratePlanActive: false,
    roomRatesActive: [false, false],
    pricingGuestCounts: [[2, 2], [3, 3], [4, 4], [4, 4]],
    legacyUnchanged: true,
    architecture: 'legacy',
    flagsOff: true,
  });

  // CURRENT==reviewed is display-only. It exposes the mapping but no second
  // mutation control, duplicate operation or automatic promotion.
  await panel.locator('[data-review-seven-kamares-pricing]').click();
  promotionModal = page.locator('.hotel-pricing-promotion-modal');
  await expect(promotionModal).toContainText('Reviewed legacy → H3 pricing mapping');
  await expect(promotionModal.locator('[data-pricing-promotion-save]')).toHaveCount(0);
  await expect(promotionModal.locator('[data-pricing-occupancy-ack]')).toHaveCount(0);
  await promotionModal.locator('footer [data-hotel-modal-close]').click();

  // Once the dedicated receipt exists, generic Booking setup may display and
  // preserve the exact mapping, but it remains read-only there.
  await page.locator('[data-hotel-workspace-tab="booking_setup"]').click();
  await page.locator('#hotelWorkspaceActivePanel [data-edit-h3-configuration]').click();
  const reviewedSetup = page.locator('#hotelH3ConfigurationForm');
  await expect(reviewedSetup).toContainText('Pricing occupancy is reviewed and locked.');
  const reviewedFiveGuestPricing = reviewedSetup.locator(
    '[data-rule-code="guests-5-bundle"] [data-h3-room-pricing-guests]',
  );
  await expect(reviewedFiveGuestPricing).toHaveCount(2);
  await expect(reviewedFiveGuestPricing.nth(0)).toHaveValue('2');
  await expect(reviewedFiveGuestPricing.nth(1)).toHaveValue('2');
  await expect(reviewedFiveGuestPricing.nth(0)).toHaveAttribute('readonly', '');
});

test('H3.2A reviews one exact Partner assignment, rebases stale versions explicitly, and remains foundation-only', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(seedHotelsV2H2aWorkspace(), {
    adminId: ADMIN_ID,
    hotelId: HOTEL_ID,
    partnerId: PARTNER_ID,
  });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await page.locator(`[data-hotel-open-workspace="${HOTEL_ID}"]`).click();
  await page.locator('[data-hotel-workspace-tab="partner"]').click();

  const panel = page.locator('#hotelWorkspaceActivePanel');
  await expect(panel).toContainText('Reviewed exact-assignment capabilities');
  await expect(panel).toContainText('All capabilities OFF');
  await panel.locator('[data-edit-partner-permission]').click();
  const editor = page.locator('#hotelPartnerPermissionForm');
  await editor.locator('[name="manage_availability"]').check();
  await page.locator('button[form="hotelPartnerPermissionForm"]').click();

  let review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toContainText('Only the permission row for this exact existing Hotel assignment changes.');
  await expect(review).toContainText('Public Hotels V2 remains disabled');
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(panel).toContainText('Availability');

  const firstSave = await page.evaluate(() => {
    const store = (window as any).__h2aE2eStore;
    const receipt = store.h32_apply_receipts[0];
    return {
      receipts: store.h32_apply_receipts.length,
      plan: receipt.plan,
      architecture: store.property.architecture_version,
      published: store.property.is_published,
      flags: store.flags,
    };
  });
  expect(firstSave.receipts).toBe(1);
  expect(firstSave.plan.assignment_id).toBe('70000000-0000-4000-8000-000000000032');
  expect(firstSave.plan.expected_permission_version).toBe(0);
  expect(firstSave.plan.capabilities.manage_availability).toBe(true);
  expect(firstSave.plan).not.toHaveProperty('owner_partner_id');
  expect(firstSave.architecture).toBe('legacy');
  expect(firstSave.published).toBe(true);
  expect(Object.values(firstSave.flags).every((value) => value === false)).toBe(true);

  await panel.locator('[data-edit-partner-permission]').click();
  await page.locator('#hotelPartnerPermissionForm [name="manage_prices"]').check();
  await page.locator('button[form="hotelPartnerPermissionForm"]').click();
  review = page.locator('.hotel-workspace-modal--review');
  await expect(review).toBeVisible();
  await page.evaluate(() => { (window as any).__h32FailNextApply = true; });
  await review.locator('[data-hotel-review-confirm]').click();
  await expect(page.locator('.hotel-workspace-modal--review')).toBeVisible();
  await expect(page.getByText(/fresh exact assignment values are shown/i)).toBeVisible();

  const afterStale = await page.evaluate(() => ({
    committedReceipts: (window as any).__h2aE2eStore.h32_apply_receipts.length,
    applyCalls: (window as any).__supabaseStub.getRpcCalls()
      .filter((call: any) => call.name === 'hotel_v2_admin_apply_partner_hotel_permissions').length,
  }));
  expect(afterStale).toEqual({ committedReceipts: 1, applyCalls: 2 });

  await page.locator('.hotel-workspace-modal--review [data-hotel-review-confirm]').click();
  await expect(panel).toContainText('Prices and rate rules');
  const finalSave = await page.evaluate(() => {
    const store = (window as any).__h2aE2eStore;
    return {
      receipts: store.h32_apply_receipts.length,
      versions: store.h32_apply_receipts.map((entry: any) => entry.plan.expected_permission_version),
      capabilities: store.h32_permission.capabilities,
      roomCount: store.room_types.length,
      architecture: store.property.architecture_version,
      flags: store.flags,
    };
  });
  expect(finalSave.receipts).toBe(2);
  expect(finalSave.versions).toEqual([0, 2]);
  expect(finalSave.capabilities).toMatchObject({ manage_availability: true, manage_prices: true });
  expect(finalSave.roomCount).toBe(0);
  expect(finalSave.architecture).toBe('legacy');
  expect(Object.values(finalSave.flags).every((value) => value === false)).toBe(true);
});
