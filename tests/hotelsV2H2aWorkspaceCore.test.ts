import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';
const UNIT_ID = '33333333-3333-4333-8333-333333333333';
const PLAN_ID = '44444444-4444-4444-8444-444444444444';
const SECOND_PLAN_ID = '55555555-5555-4555-8555-555555555555';
const RATE_ID = '66666666-6666-4666-8666-666666666666';
const PARTNER_ID = '77777777-7777-4777-8777-777777777777';
const DUPLICATE_ID = '88888888-8888-4888-8888-888888888888';

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js');
  const context: Record<string, any> = {
    crypto: { randomUUID: () => DUPLICATE_ID },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.HotelsV2WorkspaceCore;
}

function workspace(overrides: Record<string, any> = {}): any {
  const base = {
    property: {
      id: HOTEL_ID,
      slug: 'rooms-v2-fixture',
      architecture_version: 'rooms_v2',
      title_i18n: { pl: 'Hotel testowy', en: 'Fixture Hotel', he: 'מלון בדיקה' },
      description_i18n: { pl: 'Opis', en: 'Description', he: 'תיאור' },
      city: 'Lefkara',
      timezone: 'Europe/Nicosia',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      children_policy: 'allowed',
      minimum_child_age: null,
      owner_partner_id: PARTNER_ID,
      updated_at: '2026-08-11T10:00:00.000Z',
      is_published: false,
    },
    room_types: [{
      id: ROOM_ID,
      hotel_id: HOTEL_ID,
      code: 'deluxe-double',
      name_i18n: { pl: 'Pokój Deluxe', en: 'Deluxe Double', he: 'דלוקס זוגי' },
      description_i18n: { en: 'A test room' },
      gallery: ['https://example.test/room.webp'],
      capacity_adults: 2,
      capacity_children: 1,
      max_occupancy: null,
      bed_configuration: [
        { type: 'king', quantity: 1 },
        { type: 'sofa', quantity: 1 },
      ],
      bathrooms: 1,
      size_sqm: 31.5,
      amenities: ['air-conditioning', 'wifi'],
      inventory_mode: 'pooled',
      base_inventory_count: 4,
      status: 'active',
      sort_order: 10,
      version: 3,
    }],
    units: [],
    rate_plans: [{
      id: PLAN_ID,
      hotel_id: HOTEL_ID,
      code: 'flexible',
      name_i18n: { pl: 'Elastyczna', en: 'Standard Flexible', he: 'גמיש' },
      description_i18n: {},
      cancellation_policy: { type: 'flexible' },
      booking_mode_override: null,
      is_active: true,
      sort_order: 10,
      version: 2,
    }],
    room_rates: [{
      id: RATE_ID,
      hotel_id: HOTEL_ID,
      room_type_id: ROOM_ID,
      rate_plan_id: PLAN_ID,
      base_nightly_rate: 120,
      currency: 'EUR',
      is_active: true,
      sort_order: 10,
      version: 4,
    }],
    partners: [{ id: PARTNER_ID, name: 'Fixture Partner', status: 'active', can_manage_hotels: true }],
    operational_partners: [],
    amenities_catalog: [],
    payment_due: {},
    counts: {},
    flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
  };
  return { ...base, ...overrides };
}

describe('Hotels V2 H2A Property Workspace core', () => {
  const Core = loadCore();

  test('normalizes one Room Type independently from its reusable Rate Plans and products', () => {
    const input = workspace({
      rate_plans: [
        ...workspace().rate_plans,
        {
          id: SECOND_PLAN_ID,
          hotel_id: HOTEL_ID,
          code: 'non-refundable',
          name_i18n: { en: 'Non-refundable' },
          cancellation_policy: { type: 'non_refundable' },
          is_active: true,
          version: 1,
        },
      ],
      room_rates: [
        ...workspace().room_rates,
        {
          id: '99999999-9999-4999-8999-999999999999',
          hotel_id: HOTEL_ID,
          room_type_id: ROOM_ID,
          rate_plan_id: SECOND_PLAN_ID,
          base_nightly_rate: 105,
          currency: 'EUR',
          is_active: true,
          version: 1,
        },
      ],
    });
    const normalized = Core.normalizeWorkspace(input);
    expect(normalized.room_types).toHaveLength(1);
    expect(normalized.rate_plans).toHaveLength(2);
    expect(normalized.room_rates).toHaveLength(2);
    expect(normalized.room_rates.every((rate: any) => rate.room_type_id === ROOM_ID)).toBe(true);
    expect(Core.priceFrom(normalized)).toBe(105);
  });

  test('keeps PL/EN/HE values and structured bed rows without raw JSON editing semantics', () => {
    const normalized = Core.normalizeWorkspace(workspace());
    expect(normalized.property.title).toEqual({
      pl: 'Hotel testowy',
      en: 'Fixture Hotel',
      he: 'מלון בדיקה',
    });
    expect(Core.i18nText(normalized.room_types[0].name_i18n, 'he')).toBe('דלוקס זוגי');
    expect(normalized.room_types[0].bed_configuration).toEqual([
      { type: 'king', quantity: 1 },
      { type: 'sofa', quantity: 1 },
    ]);
    expect(Core.formatBedConfiguration(normalized.room_types[0].bed_configuration)).toBe('1 × King bed · 1 × Sofa bed');
  });

  test('validates pooled and unitized inventory without generating or deleting physical units', () => {
    const current = workspace();
    expect(Core.validateRoomType(current.room_types[0], current)).toMatchObject({
      id: ROOM_ID,
      inventory_mode: 'pooled',
      base_inventory_count: 4,
    });
    expect(() => Core.validateUnit({
      id: UNIT_ID,
      room_type_id: ROOM_ID,
      code: '101',
      status: 'active',
    }, current)).toThrow('Physical units are available only for unitized Room Types.');

    const unitizedRoom = { ...current.room_types[0], inventory_mode: 'unitized', base_inventory_count: 0 };
    const unitized = workspace({ room_types: [unitizedRoom] });
    expect(Core.validateUnit({
      id: UNIT_ID,
      room_type_id: ROOM_ID,
      code: '101',
      name_i18n: { en: 'Room 101', he: 'חדר 101' },
      status: 'active',
      version: 1,
    }, unitized)).toMatchObject({ id: UNIT_ID, room_type_id: ROOM_ID, code: '101' });

    const existingUnits = workspace({
      room_types: [unitizedRoom],
      units: [{ id: UNIT_ID, room_type_id: ROOM_ID, code: '101', status: 'active', version: 1 }],
    });
    expect(() => Core.validateRoomType({ ...unitizedRoom, inventory_mode: 'pooled' }, existingUnits))
      .toThrow('Inventory mode cannot be changed after units, inventory or bookings exist.');
  });

  test('readiness is Admin-only, blocks incomplete inventory, and never reports public live', () => {
    expect(Core.deriveWorkspaceReadiness(workspace())).toMatchObject({
      state: 'READY_FOR_CALENDAR',
      preparation_state: 'READY_FOR_CALENDAR',
      ready_for_calendar: true,
      public_live: false,
      room_type_count: 1,
      active_rate_plan_count: 1,
      active_room_rate_count: 1,
      total_inventory: 4,
    });

    const blocked = workspace({
      room_types: [{ ...workspace().room_types[0], inventory_mode: 'unitized', base_inventory_count: 0 }],
      units: [{ id: UNIT_ID, room_type_id: ROOM_ID, code: '101', status: 'maintenance', version: 1 }],
    });
    const result = Core.deriveWorkspaceReadiness(blocked);
    expect(result.ready_for_calendar).toBe(false);
    expect(result.public_live).toBe(false);
    expect(result.blockers).toContain('Deluxe Double needs at least one active physical unit.');

    const operationalOnly = workspace({
      property: { ...workspace().property, owner_partner_id: null },
      partners: [],
      operational_partners: [{
        partner_id: PARTNER_ID,
        is_active: true,
        status: 'active',
        can_manage_hotels: true,
      }],
    });
    expect(Core.deriveWorkspaceReadiness(operationalOnly)).toMatchObject({
      preparation_state: 'READY_FOR_CALENDAR',
      ready_for_calendar: true,
    });

    const noEligiblePartner = workspace({
      property: { ...workspace().property, owner_partner_id: null },
      partners: [],
      operational_partners: [],
    });
    expect(Core.deriveWorkspaceReadiness(noEligiblePartner).blockers)
      .toContain('Assign an active Hotel partner before Calendar readiness.');
  });

  test('builds review-first exact-ID operations with optimistic concurrency snapshots', () => {
    const current = workspace();
    const before = current.room_types[0];
    const after = { ...before, base_inventory_count: 5 };
    const operation = Core.operationForEntity('room_type', after, before);
    expect(operation).toMatchObject({
      type: 'update',
      entity: 'room_type',
      id: ROOM_ID,
      expected_version: 3,
      payload: expect.objectContaining({ base_inventory_count: 5 }),
    });
    expect(operation.payload).not.toHaveProperty('id');
    expect(operation.payload).not.toHaveProperty('hotel_id');
    const plan = Core.buildWorkspacePlan(current, [operation], {
      reviewedAt: '2026-08-11T10:05:00.000Z',
    });
    expect(plan).toEqual({
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T10:00:00.000Z',
      reviewed_at: '2026-08-11T10:05:00.000Z',
      operations: [operation],
    });
    expect(Core.buildReviewRows('room_type', before, after)).toEqual([
      expect.objectContaining({
        entity: 'room_type',
        entity_id: ROOM_ID,
        field: 'base_inventory_count',
        before: 4,
        after: 5,
      }),
    ]);
  });

  test('duplicates only the Room Type as a new draft exact ID, not Units or products', () => {
    const current = workspace({
      units: [{ id: UNIT_ID, room_type_id: ROOM_ID, code: '101', status: 'active', version: 1 }],
    });
    const duplicate = Core.buildDuplicateRoom(current.room_types[0], current);
    expect(duplicate).toMatchObject({
      id: DUPLICATE_ID,
      hotel_id: HOTEL_ID,
      code: 'deluxe-double-copy',
      status: 'draft',
      version: 1,
    });
    expect(duplicate.id).not.toBe(ROOM_ID);
    expect(duplicate.name_i18n.en).toBe('Deluxe Double copy');
    expect(duplicate).not.toHaveProperty('units');
    expect(duplicate).not.toHaveProperty('room_rates');
  });

  test('rejects duplicate codes, invalid capacities and cross-property Room × Rate products', () => {
    const current = workspace();
    expect(() => Core.validateRoomType({
      ...current.room_types[0],
      id: DUPLICATE_ID,
      capacity_adults: 0,
    }, current)).toThrow('Adults capacity must be at least 1.');
    expect(() => Core.validateRoomType({
      ...current.room_types[0],
      id: DUPLICATE_ID,
    }, current)).toThrow('Room code already exists in this property.');
    expect(() => Core.validateRoomRate({
      ...current.room_rates[0],
      id: DUPLICATE_ID,
      hotel_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }, current)).toThrow('Cross-property room-rate combinations are not allowed.');
    expect(() => Core.validateRoomRate({
      ...current.room_rates[0],
      id: DUPLICATE_ID,
      base_nightly_rate: 0,
      is_active: true,
    }, current)).toThrow('An active Room + Rate Plan product needs a positive base nightly rate.');
  });

  test('legacy migration preview is explicitly read-only and does not change architecture', () => {
    const legacy = workspace({
      property: {
        ...workspace().property,
        architecture_version: 'legacy',
        room_types: [{ id: 'standard', name: { en: 'Legacy Standard' } }],
        pricing_tiers: { rules: [{ from: 1, price: 120 }, { from: 7, price: 100 }] },
      },
      room_types: [],
      rate_plans: [],
      room_rates: [],
    });
    const preview = Core.migrationPreview(legacy);
    expect(preview).toMatchObject({
      property_id: HOTEL_ID,
      architecture_version: 'legacy',
      legacy_room_count: 1,
      legacy_pricing_rule_count: 2,
      status: 'NOT_MIGRATED',
    });
    expect(legacy.property.architecture_version).toBe('legacy');
    expect(legacy.room_types).toHaveLength(0);
  });

  test('reconstructs one property-level legacy product without pretending it is a normalized Room Type', () => {
    const rules = [2, 3, 4, 5, 6, 7, 8].flatMap((persons) =>
      [2, 3, 4, 5, 6, 7, 8, 9, 10].map((minNights) => ({
        persons,
        min_nights: minNights,
        price_per_night: 100,
      })),
    );
    const legacy = workspace({
      property: {
        ...workspace().property,
        id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
        slug: '7-ukow',
        architecture_version: 'legacy',
        pricing_model: 'tiered_by_nights',
        pricing_tiers: { currency: 'EUR', rules },
        room_types: [],
        max_persons: 8,
        photos: Array.from({ length: 9 }, (_, index) => `https://example.test/property-${index + 1}.webp`),
        amenities: ['wifi', 'terrace'],
      },
      room_types: [],
      rate_plans: [],
      room_rates: [],
    });

    const preview = Core.migrationPreview(legacy);
    expect(preview).toMatchObject({
      architecture_version: 'legacy',
      legacy_room_count: 0,
      legacy_live_product_count: 1,
      legacy_pricing_rule_count: 63,
      property_gallery_count: 9,
      can_prepare_existing_accommodation: true,
      status: 'NOT_MIGRATED',
      legacy_product: {
        kind: 'property_level_accommodation',
        status: 'AWAITING_ADMIN_CONFIRMATION',
        max_persons: 8,
      },
      pricing_preview: {
        rule_count: 63,
        guest_counts: [2, 3, 4, 5, 6, 7, 8],
        stay_thresholds: [2, 3, 4, 5, 6, 7, 8, 9, 10],
        requires_occupancy_los_model: true,
        h1_rate_rules_compatible: false,
        oracle: 'HOTEL_7_ARCHES_ROOM1_PRICE_MISMATCH',
        conversion_status: 'BLOCKED_PENDING_H2B_MODEL',
      },
    });
    expect(preview.messages[0]).toContain('not a normalized Room Type');
    expect(preview.legacy_product.field_classifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'Property relationship', classification: 'SAFE_TO_COPY' }),
      expect.objectContaining({ field: 'Currency', classification: 'SAFE_TO_COPY' }),
      expect.objectContaining({ field: 'Guest capacity', classification: 'REQUIRES_REVIEW' }),
      expect.objectContaining({ field: 'Property gallery', classification: 'REQUIRES_REVIEW' }),
      expect.objectContaining({ field: 'Physical inventory', classification: 'UNKNOWN' }),
      expect.objectContaining({ field: 'Beds, bathrooms and size', classification: 'UNKNOWN' }),
    ]));
    const seed = Core.buildLegacyShadowRoomSeed(legacy, DUPLICATE_ID);
    expect(seed).toEqual({
      id: DUPLICATE_ID,
      hotel_id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      legacy_source_key: null,
      code: '',
      name_i18n: {},
      description_i18n: {},
      gallery: [],
      capacity_adults: 0,
      capacity_children: 0,
      max_occupancy: null,
      effective_max_occupancy: 0,
      children_policy_override: null,
      minimum_child_age_override: null,
      bed_configuration: [],
      bathrooms: null,
      size_sqm: null,
      amenities: [],
      inventory_mode: 'pooled',
      base_inventory_count: 0,
      status: 'draft',
      sort_order: 1000,
      version: 1,
      created_at: null,
      updated_at: null,
    });
    expect(seed).not.toHaveProperty('pricing_model');
    expect(seed).not.toHaveProperty('pricing_tiers');
    expect(seed).not.toHaveProperty('rate_plan_id');
    expect(legacy.property.architecture_version).toBe('legacy');
    expect(legacy.room_types).toHaveLength(0);
  });

  test('keeps a simple single-occupancy/single-stay legacy rule compatible with the H1 rate-rule shape', () => {
    const preview = Core.migrationPreview(workspace({
      property: {
        ...workspace().property,
        architecture_version: 'legacy',
        pricing_model: 'flat_per_night',
        pricing_tiers: { currency: 'EUR', rules: [{ persons: 2, min_nights: 2, price_per_night: 45 }] },
        room_types: [],
      },
      room_types: [],
      rate_plans: [],
      room_rates: [],
    }));
    expect(preview.pricing_preview).toMatchObject({
      guest_counts: [2],
      stay_thresholds: [2],
      requires_occupancy_los_model: false,
      h1_rate_rules_compatible: true,
      oracle: 'HOTEL_LEGACY_SHADOW_PRICE_MISMATCH',
    });
  });
});
