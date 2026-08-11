import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER_ID = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND_ID = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const UPPER_RATE_ID = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_RATE_ID = '3320590d-632d-423f-80d0-fd021cba7293';
const SHARED_SCHEDULE_ID = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js');
  const context: Record<string, any> = { crypto: { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.HotelsV2WorkspaceCore;
}

function sevenArches(overrides: Record<string, any> = {}): any {
  const photos = Array.from({ length: 9 }, (_, index) => `https://example.test/7-arches-${index + 1}.webp`);
  return {
    property: {
      id: HOTEL_ID,
      slug: '7-ukow',
      architecture_version: 'legacy',
      title_i18n: { pl: '7 Kamares', en: '7 Arches', he: '7 קשתות' },
      city: 'Lefkara', timezone: 'Europe/Nicosia', currency: 'EUR',
      booking_mode: 'request_confirmation',
      children_policy: null, minimum_child_age: null,
      photos,
      room_types: [],
      pricing_model: 'tiered_by_nights',
      pricing_tiers: {
        rules: [2, 3, 4, 5, 6, 7, 8].flatMap((persons) =>
          [2, 3, 4, 5, 6, 7, 8, 9, 10].map((minNights) => ({ persons, min_nights: minNights, price_per_night: 100 }))),
      },
      updated_at: '2026-08-11T15:00:00.000Z',
      is_published: true,
    },
    room_types: [], units: [], rate_plans: [], room_rates: [],
    pricing_schedules: [], pricing_schedule_tiers: [],
    legacy_shadow_preview: { legacy_pricing_fingerprint: 'legacy-fingerprint-63', legacy_pricing_rule_count: 63, property_gallery_count: 9 },
    amenities_catalog: [
      { code: 'air_conditioning' }, { code: 'balcony' }, { code: 'terrace' },
    ],
    partners: [], operational_partners: [], counts: {}, flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
    ...overrides,
  };
}

describe('Hotels H2B.1 children policy and 7 Arches shadow preparation', () => {
  const Core = loadCore();

  test('validates allowed, adults-only and minimum-age policies without inventing a legal age boundary', () => {
    expect(Core.normalizeChildrenPolicy('allowed', null)).toEqual({ policy: 'allowed', minimum_age: null });
    expect(Core.normalizeChildrenPolicy('not_allowed', null)).toEqual({ policy: 'not_allowed', minimum_age: null });
    expect(Core.normalizeChildrenPolicy('minimum_age', 10)).toEqual({ policy: 'minimum_age', minimum_age: 10 });
    expect(Core.childrenPolicyLabel('minimum_age', 10)).toBe('Children allowed from age 10');
    expect(() => Core.normalizeChildrenPolicy('minimum_age', null)).toThrow('whole number');
    expect(() => Core.normalizeChildrenPolicy('minimum_age', 18)).toThrow('0 to 17');
    expect(() => Core.normalizeChildrenPolicy('not_allowed', 10)).toThrow('only with Allowed from age');
  });

  test('preserves an unreviewed legacy property policy and resolves an exact Room Type override first', () => {
    const normalized = Core.normalizeWorkspace(sevenArches());
    expect(normalized.property.children_policy).toBeNull();
    expect(() => Core.resolveChildrenPolicy(normalized.property)).toThrow('has not been reviewed');
    expect(Core.resolveChildrenPolicy(normalized.property, {
      children_policy_override: 'not_allowed', minimum_child_age_override: null,
    })).toEqual({ policy: 'not_allowed', minimum_age: null, source: 'room_type' });
    expect(Core.resolveChildrenPolicy(normalized.property, {
      children_policy_override: 'allowed', minimum_child_age_override: null,
    })).toEqual({ policy: 'allowed', minimum_age: null, source: 'room_type' });
    expect(Core.resolveChildrenPolicy(normalized.property, {
      children_policy_override: 'minimum_age', minimum_child_age_override: 12,
    })).toEqual({ policy: 'minimum_age', minimum_age: 12, source: 'room_type' });
    expect(Core.resolveChildrenPolicy({ children_policy: 'minimum_age', minimum_child_age: 10 }, {
      children_policy_override: null,
    })).toEqual({ policy: 'minimum_age', minimum_age: 10, source: 'property' });
  });

  test('preserves unresolved cancellation and shared-schedule metadata instead of presenting executable fallback pricing', () => {
    const unresolved = {
      type: 'requires_review',
      reason: 'legacy_cancellation_terms_unconfirmed',
      summary_i18n: { en: 'Cancellation terms require confirmation' },
    };
    expect(Core.normalizeCancellationPolicy(unresolved)).toEqual(unresolved);
    expect(Core.cancellationPolicyLabel(unresolved)).toBe('Cancellation terms require confirmation');
    expect(() => Core.validateRatePlan({
      id: '22e47a63-a630-4fb6-8f43-816f2d3fdc17', hotel_id: HOTEL_ID,
      code: 'standard', name_i18n: { en: 'Standard' }, cancellation_policy: unresolved,
      is_active: true, version: 1,
    }, sevenArches())).toThrow('Confirm cancellation terms');

    const rate = Core.normalizeRoomRate({
      id: '7e420964-9cbf-4f1b-abd3-09840af5240f', hotel_id: HOTEL_ID,
      room_type_id: UPPER_ID, rate_plan_id: '22e47a63-a630-4fb6-8f43-816f2d3fdc17',
      pricing_schedule_id: 'b0a3104f-7b31-5265-a59f-c2d166f11a23', base_nightly_rate: 0,
      currency: 'EUR', is_active: false, version: 1,
    });
    expect(rate.pricing_schedule_id).toBe('b0a3104f-7b31-5265-a59f-c2d166f11a23');

    const readiness = Core.deriveWorkspaceReadiness(sevenArches({
      property: { ...sevenArches().property, children_policy: 'allowed', minimum_child_age: null },
      room_types: [{
        id: UPPER_ID, hotel_id: HOTEL_ID, code: 'upper-floor-apartment', name_i18n: { en: 'Upper Floor Apartment' },
        capacity_adults: null, capacity_children: null, max_occupancy: 4,
        inventory_mode: 'pooled', base_inventory_count: 1, status: 'active', version: 1,
      }],
      rate_plans: [{
        id: '22e47a63-a630-4fb6-8f43-816f2d3fdc17', hotel_id: HOTEL_ID, code: 'standard',
        name_i18n: { en: 'Standard' }, cancellation_policy: unresolved, is_active: true, version: 1,
      }],
      room_rates: [{ ...rate, base_nightly_rate: 100, is_active: true }],
    }));
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      'Confirm cancellation terms before activating the Rate Plan.',
      'Shared pricing schedules require the H3 allocation review before activation.',
    ]));
  });

  test('keeps a shared shadow schedule fail-closed while representing each apartment exact-date configuration independently', () => {
    const stayDate = '2026-08-20';
    const upperProduct = {
      id: UPPER_RATE_ID,
      room_type_id: UPPER_ID,
      pricing_schedule_id: SHARED_SCHEDULE_ID,
      base_inventory_count: 1,
    };
    const groundProduct = {
      id: GROUND_RATE_ID,
      room_type_id: GROUND_ID,
      pricing_schedule_id: SHARED_SCHEDULE_ID,
      base_inventory_count: 1,
    };
    const upperOverride = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      room_rate_id: UPPER_RATE_ID,
      stay_date: stayDate,
      nightly_rate_mode: 'set',
      nightly_rate: 155,
      minimum_stay_mode: 'set',
      minimum_stay: 2,
      is_active: true,
      version: 3,
    };
    const upperInventory = {
      room_type_id: UPPER_ID,
      stay_date: stayDate,
      sellable_units_mode: 'set',
      sellable_units: 0,
      closed_mode: 'set',
      closed: true,
      version: 4,
    };
    const groundInventory = {
      room_type_id: GROUND_ID,
      stay_date: stayDate,
      sellable_units_mode: 'set',
      sellable_units: 1,
      closed_mode: 'set',
      closed: false,
      version: 5,
    };

    const upper = Core.sharedScheduleCalendarDisplayState(
      upperProduct, stayDate, upperOverride, upperInventory, { asOf: '2026-08-11T12:00:00.000Z' },
    );
    expect(upper).toMatchObject({
      kind: 'shared_schedule_shadow',
      authoritative: false,
      requestable: false,
      blocker: 'shared_room_pricing_schedule_requires_h3_resolution',
      room_rate_id: UPPER_RATE_ID,
      room_type_id: UPPER_ID,
      pricing_schedule_id: SHARED_SCHEDULE_ID,
      nightly_rate: { mode: 'set', value: 155 },
      minimum_stay: { mode: 'set', value: 2 },
      configured_inventory: 0,
      inventory_source: 'exact_room_date',
      explicitly_closed: true,
    });
    expect(upper).not.toHaveProperty('total');
    expect(upper).not.toHaveProperty('effective_nightly_rate');

    // Rows belonging to the upper apartment are deliberately ignored for the
    // ground apartment; its room-level inventory remains an independent key.
    const groundWithoutOwnRows = Core.sharedScheduleCalendarDisplayState(
      groundProduct, stayDate, upperOverride, upperInventory, { asOf: '2026-08-11T12:00:00.000Z' },
    );
    expect(groundWithoutOwnRows).toMatchObject({
      authoritative: false,
      exact_override_id: null,
      nightly_rate: { mode: null, value: null },
      configured_inventory: 1,
      inventory_source: 'room_base',
      explicitly_closed: false,
    });
    const ground = Core.sharedScheduleCalendarDisplayState(
      groundProduct, stayDate, null, groundInventory, { asOf: '2026-08-11T12:00:00.000Z' },
    );
    expect(ground).toMatchObject({
      room_rate_id: GROUND_RATE_ID,
      room_type_id: GROUND_ID,
      exact_override_id: null,
      configured_inventory: 1,
      inventory_source: 'exact_room_date',
      explicitly_closed: false,
    });
  });

  test('builds the dedicated exact Room Type RPC plan with create version zero and reviewed child metadata', () => {
    const workspace = sevenArches();
    const room = Core.validateRoomType({
      id: UPPER_ID,
      hotel_id: HOTEL_ID,
      code: 'upper-floor-apartment',
      name_i18n: { en: 'Upper Floor Apartment' },
      description_i18n: {}, gallery: [],
      capacity_adults: null, capacity_children: null, max_occupancy: 4,
      children_policy_override: 'not_allowed', minimum_child_age_override: null,
      bed_configuration: [], amenities: ['air_conditioning', 'balcony', 'terrace'],
      inventory_mode: 'pooled', base_inventory_count: 1, status: 'draft', sort_order: 100,
    }, workspace);
    const operation = Core.operationForEntity('room_type', room);
    expect(operation.payload).toMatchObject({
      max_occupancy: 4,
      capacity_adults: null,
      capacity_children: null,
      children_policy_override: 'not_allowed',
      minimum_child_age_override: null,
    });
    expect(Core.buildRoomTypePlan(workspace, operation, { reviewedAt: '2026-08-11T16:00:00.000Z' })).toEqual({
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T15:00:00.000Z',
      reviewed_at: '2026-08-11T16:00:00.000Z',
      operation: {
        type: 'create', id: UPPER_ID, expected_version: 0, payload: operation.payload,
      },
    });
  });

  test('builds exactly two confirmed apartment drafts with no invented capacity split or room photos', () => {
    const preparation = Core.sevenArchesShadowPreparation(sevenArches());
    expect(preparation).toMatchObject({
      eligible: true,
      hotel_id: HOTEL_ID,
      source_contract: 'seven_arches_two_apartments_v1',
      property_policy: { children_policy: 'minimum_age', minimum_child_age: 10 },
      public_change: false,
      pricing: { source_rule_count: 63, legacy_public_unchanged: true },
    });
    expect(preparation.rooms).toHaveLength(2);
    expect(preparation.rooms[0]).toMatchObject({
      id: UPPER_ID,
      code: 'upper-floor-apartment',
      name_i18n: { pl: 'Apartament na piętrze', en: 'Upper Floor Apartment', he: 'דירה בקומה העליונה' },
      gallery: [], capacity_adults: null, capacity_children: null, max_occupancy: 4,
      inventory_mode: 'pooled', base_inventory_count: 1,
      amenities: ['air_conditioning', 'balcony', 'terrace'], status: 'draft',
    });
    expect(preparation.rooms[1]).toMatchObject({
      id: GROUND_ID,
      code: 'ground-floor-apartment',
      name_i18n: { pl: 'Apartament na parterze', en: 'Ground Floor Apartment', he: 'דירה בקומת הקרקע' },
      gallery: [], capacity_adults: null, capacity_children: null, max_occupancy: 4,
      inventory_mode: 'pooled', base_inventory_count: 1,
      amenities: ['air_conditioning', 'terrace'], status: 'draft',
    });
    expect(preparation.rooms[1].amenities).not.toContain('balcony');
    expect(preparation.rooms.every((room: any) => room.bed_configuration.length === 0 && room.bathrooms == null && room.size_sqm == null)).toBe(true);
  });

  test('fails closed when any third normalized Room Type already exists, even if its ID matches another reserved shadow entity', () => {
    const preparation = Core.sevenArchesShadowPreparation(sevenArches({
      room_types: [{
        id: SHARED_SCHEDULE_ID,
        hotel_id: HOTEL_ID,
        code: 'unexpected-room',
        name_i18n: { en: 'Unexpected room' },
        capacity_adults: 1,
        capacity_children: 0,
        inventory_mode: 'pooled',
        base_inventory_count: 1,
        status: 'draft',
        version: 1,
      }],
    }));
    expect(preparation).toMatchObject({
      eligible: false,
      unexpected_room_ids: [SHARED_SCHEDULE_ID],
    });
  });

  test('requires reviewed photos, keeps them inside the property gallery and creates an idempotent exact-ID plan', () => {
    const workspace = sevenArches();
    const preparation = Core.sevenArchesShadowPreparation(workspace);
    expect(() => Core.buildSevenArchesShadowPlan(workspace, preparation.rooms.map((room: any) => ({
      id: room.id, name_i18n: room.name_i18n, gallery: [],
    })))).toThrow('needs at least one reviewed room photo');

    const reviews = preparation.rooms.map((room: any, index: number) => ({
      id: room.id,
      name_i18n: room.name_i18n,
      gallery: [preparation.property_gallery[index]],
    }));
    const plan = Core.buildSevenArchesShadowPlan(workspace, reviews, { reviewedAt: '2026-08-11T16:00:00.000Z' });
    expect(plan).toMatchObject({
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T15:00:00.000Z',
      reviewed_at: '2026-08-11T16:00:00.000Z',
      source_contract: 'seven_arches_two_apartments_v1',
      expected_legacy_pricing_fingerprint: 'legacy-fingerprint-63',
      expected_versions: {
        upper_room: 0, ground_room: 0, pricing_schedule: 0, property_party_preview: 0,
        rate_plan: 0, upper_room_rate: 0, ground_room_rate: 0,
      },
      property_policy: { children_policy: 'minimum_age', minimum_child_age: 10 },
      prepare_pricing_preview: true,
    });
    expect(plan.rooms.map((room: any) => [room.id, room.expected_version])).toEqual([[UPPER_ID, 0], [GROUND_ID, 0]]);
    expect(workspace.property.photos).toHaveLength(9);

    const repeatedWorkspace = sevenArches({
      room_types: preparation.rooms.map((room: any, index: number) => ({
        ...room, gallery: [preparation.property_gallery[index]], version: 4 + index,
        created_at: '2026-08-11T16:01:00.000Z',
      })),
      pricing_schedules: [
        { id: 'b0a3104f-7b31-5265-a59f-c2d166f11a23', version: 6 },
        { id: '443065c0-984a-5de3-a22a-d03042c41107', version: 7 },
      ],
      rate_plans: [{ id: '22e47a63-a630-4fb6-8f43-816f2d3fdc17', hotel_id: HOTEL_ID, code: 'standard', name_i18n: { en: 'Standard' }, cancellation_policy: { type: 'custom' }, version: 8 }],
      room_rates: [
        { id: '7e420964-9cbf-4f1b-abd3-09840af5240f', hotel_id: HOTEL_ID, room_type_id: UPPER_ID, rate_plan_id: '22e47a63-a630-4fb6-8f43-816f2d3fdc17', version: 9 },
        { id: '3320590d-632d-423f-80d0-fd021cba7293', hotel_id: HOTEL_ID, room_type_id: GROUND_ID, rate_plan_id: '22e47a63-a630-4fb6-8f43-816f2d3fdc17', version: 10 },
      ],
    });
    const repeated = Core.sevenArchesShadowPreparation(repeatedWorkspace);
    const repeatedPlan = Core.buildSevenArchesShadowPlan(repeatedWorkspace, repeated.rooms.map((room: any) => ({
      id: room.id, name_i18n: room.name_i18n, gallery: room.gallery,
    })));
    expect(repeatedPlan.rooms.map((room: any) => [room.id, room.expected_version])).toEqual([[UPPER_ID, 4], [GROUND_ID, 5]]);
    expect(repeatedPlan.expected_versions).toEqual({
      upper_room: 4, ground_room: 5, pricing_schedule: 6, property_party_preview: 7,
      rate_plan: 8, upper_room_rate: 9, ground_room_rate: 10,
    });
    expect(new Set(repeatedPlan.rooms.map((room: any) => room.id)).size).toBe(2);
  });

  test('fails closed when an unexpected normalized room or required amenity contract exists', () => {
    expect(Core.sevenArchesShadowPreparation(sevenArches({
      room_types: [{
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hotel_id: HOTEL_ID, code: 'unknown',
        name_i18n: { en: 'Unknown' }, capacity_adults: 1, capacity_children: 0,
        inventory_mode: 'pooled', base_inventory_count: 1, status: 'draft', version: 1,
      }],
    }))).toMatchObject({ eligible: false, unexpected_room_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] });
    expect(Core.sevenArchesShadowPreparation(sevenArches({ amenities_catalog: [{ code: 'terrace' }] })))
      .toMatchObject({ eligible: false, missing_amenities: ['air_conditioning', 'balcony'] });
  });
});
