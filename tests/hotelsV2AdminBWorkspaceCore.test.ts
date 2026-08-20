import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const ASSIGNMENT_ID = '44444444-4444-4444-8444-444444444444';
const STAFF_SCOPE_A = '55555555-5555-4555-8555-555555555555';
const STAFF_SCOPE_B = '66666666-6666-4666-8666-666666666666';

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js');
  const context: Record<string, any> = {
    crypto: { randomUUID: () => '99999999-9999-4999-8999-999999999999' },
    URL,
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.HotelsV2WorkspaceCore;
}

function workspace(): any {
  return {
    property: {
      id: HOTEL_ID,
      slug: 'fixture-hotel',
      architecture_version: 'legacy',
      title: { pl: 'Hotel', en: 'Hotel live', he: 'מלון' },
      title_i18n: { pl: 'Stare', en: 'Stale shadow', he: 'ישן' },
      description: { pl: 'Opis', en: 'Live description', he: 'תיאור' },
      description_i18n: { en: 'Stale description' },
      city: 'Lefkara',
      address_line: '1 Main Street',
      country: 'Cyprus',
      timezone: 'Europe/Nicosia',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      check_in_from: '14:00:00',
      check_out_until: '11:00:00',
      minimum_stay_nights: 2,
      children_policy: 'minimum_age',
      minimum_child_age: 15,
      photos: ['https://cdn.test/property/shared.webp'],
      amenities: ['wifi'],
      updated_at: '2026-08-20T08:00:00.000Z',
    },
    room_types: [{
      id: ROOM_ID,
      hotel_id: HOTEL_ID,
      code: 'upper',
      name_i18n: { en: 'Upper' },
      description_i18n: { en: 'Room' },
      gallery: ['https://cdn.test/property/shared.webp', `https://cdn.test/rooms/${ROOM_ID}/one.webp`],
      capacity_adults: 2,
      capacity_children: 1,
      max_occupancy: null,
      bed_configuration: [{ type: 'double', quantity: 1 }],
      bathrooms: 1,
      size_sqm: 30,
      floor_label_i18n: { en: 'Upper floor' },
      amenities: ['balcony'],
      inventory_mode: 'pooled',
      base_inventory_count: 1,
      status: 'active',
      sort_order: 10,
      version: 7,
    }],
    units: [], rate_plans: [], room_rates: [], partners: [], operational_partners: [],
    amenities_catalog: [], counts: {}, flags: {},
  };
}

function contentControl(scopeIds = [STAFF_SCOPE_A, STAFF_SCOPE_B]): any {
  const capabilities = Object.fromEntries(Core.HOTEL_PARTNER_CAPABILITIES.map((key: string) => [key, key === 'edit_property_content']));
  return {
    contract_version: 'hotels_v2_admin_b_content_control_v1',
    hotel_id: HOTEL_ID,
    assignment_snapshot: {
      snapshot_token: 'snapshot-token',
      assignment_fingerprint: 'assignment-fingerprint',
      assignments: [{
        assignment_id: ASSIGNMENT_ID,
        partner_id: PARTNER_ID,
        staff_scope_count: scopeIds.length,
        staff_scope_ids: scopeIds,
        permission_exists: true,
        permission: { capabilities },
      }],
    },
  };
}

const Core = loadCore();

describe('Hotels V2 ADMIN-B client contracts', () => {
  test('builds a field-scoped property plan from live legacy content and private profile version', () => {
    const current = {
      ...Core.normalizeWorkspace(workspace()).property,
      maximum_stay_nights: 14,
      guest_instructions_i18n: { en: 'Welcome' },
      check_in_instructions_i18n: {},
      check_out_instructions_i18n: {},
      internal_operational_notes: 'Private',
      operational_profile_version: 3,
    };
    const plan = Core.buildPropertyControlPlan(workspace(), {
      ...current,
      title_i18n: { ...current.title_i18n, en: 'Hotel reviewed' },
      internal_operational_notes: 'Private reviewed',
    }, { currentProperty: current, expectedOperationalProfileVersion: 3, reviewedAt: '2026-08-20T09:00:00.000Z' });

    expect(plan).toEqual({
      contract_version: 'hotels_v2_admin_b_property_control_v1',
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-20T08:00:00.000Z',
      expected_operational_profile_version: 3,
      reviewed_at: '2026-08-20T09:00:00.000Z',
      expected_original: {
        title_i18n: { pl: 'Hotel', en: 'Hotel live', he: 'מלון' },
        internal_operational_notes: 'Private',
      },
      payload: {
        title_i18n: { pl: 'Hotel', en: 'Hotel reviewed', he: 'מלון' },
        internal_operational_notes: 'Private reviewed',
      },
    });
    expect(plan.payload).not.toHaveProperty('children_policy');
    expect(plan.payload).not.toHaveProperty('google_place_id');
    expect(plan.payload).not.toHaveProperty('sort_order');
  });

  test('rebases non-overlapping property edits and identifies a genuine overlapping private edit', () => {
    const original = { id: HOTEL_ID, city: 'Lefkara', internal_operational_notes: 'A' };
    const current = { ...original, city: 'Paphos' };
    const requested = { ...original, internal_operational_notes: 'B' };
    expect(Core.reconcilePropertyControl(original, current, requested)).toMatchObject({
      safe: true,
      merged: { city: 'Paphos', internal_operational_notes: 'B' },
    });
    expect(Core.reconcilePropertyControl(original, { ...original, internal_operational_notes: 'C' }, requested)).toMatchObject({
      safe: false,
      conflicts: [{ field: 'internal_operational_notes', original: 'A', current: 'C', requested: 'B' }],
    });
  });

  test('sends only a changed ordered gallery with its exact original and groups capacity fields atomically', () => {
    const currentWorkspace = workspace();
    const room = Core.normalizeWorkspace(currentWorkspace).room_types[0];
    const galleryOperation = Core.operationForEntity('room_type', {
      ...room,
      gallery: [...room.gallery].reverse(),
    }, room);
    const galleryPlan = Core.buildRoomTypePlan(currentWorkspace, galleryOperation, { reviewedAt: '2026-08-20T09:00:00.000Z' });
    expect(galleryPlan.operation).toMatchObject({
      expected_version: 7,
      expected_original: { gallery: room.gallery },
      payload: { gallery: [...room.gallery].reverse() },
    });
    expect(Object.keys(galleryPlan.operation.payload)).toEqual(['gallery']);

    const capacityOperation = Core.operationForEntity('room_type', {
      ...room, max_occupancy: 4, capacity_adults: null, capacity_children: null,
    }, room);
    const capacityPlan = Core.buildRoomTypePlan(currentWorkspace, capacityOperation);
    expect(capacityPlan.operation.payload).toMatchObject({ max_occupancy: 4, capacity_adults: null, capacity_children: null });
    expect(capacityPlan.operation.expected_original).toMatchObject({ max_occupancy: null, capacity_adults: 2, capacity_children: 1 });
  });

  test('duplicates as draft without copying exact source-Room uploads', () => {
    const source = Core.normalizeWorkspace(workspace()).room_types[0];
    const duplicate = Core.buildDuplicateRoom(source, workspace());
    expect(duplicate.status).toBe('draft');
    expect(duplicate.inventory_mode).toBe('pooled');
    expect(duplicate.base_inventory_count).toBe(0);
    expect(duplicate.gallery).toEqual(['https://cdn.test/property/shared.webp']);
    expect(duplicate.gallery).not.toContain(`https://cdn.test/rooms/${ROOM_ID}/one.webp`);
  });

  test('binds assignment removal to exact sorted staff scopes and rejects malformed scope snapshots', () => {
    const plan = Core.buildOperationalAssignmentPlan(contentControl(), {
      type: 'remove', assignment_id: ASSIGNMENT_ID, partner_id: PARTNER_ID,
    }, { hotelId: HOTEL_ID, reviewedAt: '2026-08-20T09:00:00.000Z' });
    expect(plan).toMatchObject({
      contract_version: 'hotels_v2_admin_b_operational_assignment_v1',
      hotel_id: HOTEL_ID,
      snapshot_token: 'snapshot-token',
      expected_assignment_fingerprint: 'assignment-fingerprint',
      operation: {
        type: 'remove', assignment_id: ASSIGNMENT_ID, partner_id: PARTNER_ID,
        expected_staff_scope_count: 2,
        expected_staff_scope_ids: [STAFF_SCOPE_A, STAFF_SCOPE_B],
        expected_permission_exists: true,
      },
    });
    expect(() => Core.normalizeOperationalAssignmentSnapshot(contentControl([STAFF_SCOPE_B, STAFF_SCOPE_A]), HOTEL_ID))
      .toThrow('invalid exact staff-scope set');
    expect(() => Core.normalizeOperationalAssignmentSnapshot(contentControl([STAFF_SCOPE_A, STAFF_SCOPE_A]), HOTEL_ID))
      .toThrow('invalid exact staff-scope set');
  });

  test('rejects property and Room values beyond the frozen database limits before Review', () => {
    const current = {
      ...Core.normalizeWorkspace(workspace()).property,
      maximum_stay_nights: null,
      guest_instructions_i18n: {},
      check_in_instructions_i18n: {},
      check_out_instructions_i18n: {},
      internal_operational_notes: null,
      operational_profile_version: 0,
    };
    expect(() => Core.buildPropertyControlPlan(workspace(), {
      ...current,
      guest_instructions_i18n: { en: 'x'.repeat(8001) },
    }, { currentProperty: current, expectedOperationalProfileVersion: 0 }))
      .toThrow('Guest information (EN) must be 8000 characters or fewer');
    expect(() => Core.buildPropertyControlPlan(workspace(), {
      ...current,
      address_line: 'x'.repeat(501),
    }, { currentProperty: current, expectedOperationalProfileVersion: 0 }))
      .toThrow('Address must be 500 characters or fewer');

    const currentWorkspace = workspace();
    const source = currentWorkspace.room_types[0];
    expect(() => Core.validateRoomType({ ...source, floor_label_i18n: { he: 'א'.repeat(161) } }, currentWorkspace))
      .toThrow('Room floor label (HE) must be 160 characters or fewer');
    expect(() => Core.validateRoomType({
      ...source,
      gallery: Array.from({ length: 51 }, (_, index) => `https://cdn.test/${index}.webp`),
    }, currentWorkspace)).toThrow('Room gallery may contain at most 50 photos');
    expect(() => Core.validateRoomType({ ...source, bed_configuration: [{ type: 'sofa', quantity: 21 }] }, currentWorkspace))
      .toThrow('quantity from 1 to 20');
  });

  test('rejects changed non-Google map URLs but preserves an unchanged grandfathered URL', () => {
    const currentWorkspace = workspace();
    currentWorkspace.property.google_maps_url = 'https://grandfathered.example.test/map';
    const current = {
      ...Core.normalizeWorkspace(currentWorkspace).property,
      maximum_stay_nights: null,
      guest_instructions_i18n: {}, check_in_instructions_i18n: {}, check_out_instructions_i18n: {},
      internal_operational_notes: null, operational_profile_version: 0,
    };
    const unrelated = Core.buildPropertyControlPlan(currentWorkspace, { ...current, city: 'Paphos' }, {
      currentProperty: current, expectedOperationalProfileVersion: 0,
    });
    expect(unrelated.payload).toEqual({ city: 'Paphos' });
    expect(() => Core.buildPropertyControlPlan(currentWorkspace, {
      ...current, google_maps_url: 'https://evil.example/maps',
    }, { currentProperty: current, expectedOperationalProfileVersion: 0 }))
      .toThrow(/supported Google Maps domain/i);
    expect(Core.buildPropertyControlPlan(currentWorkspace, {
      ...current, google_maps_url: 'https://www.google.com/maps/place/Reviewed',
    }, { currentProperty: current, expectedOperationalProfileVersion: 0 }).payload.google_maps_url)
      .toBe('https://www.google.com/maps/place/Reviewed');
    for (const rejected of [
      'http://maps.google.com/maps/place/Reviewed',
      'https://maps.google.com:8443/maps/place/Reviewed',
      'https://maps.google.xyz/maps/place/Reviewed',
      'https://maps.google.com.evil.example/maps/place/Reviewed',
      'https://user@maps.google.com/maps/place/Reviewed',
    ]) {
      expect(() => Core.buildPropertyControlPlan(currentWorkspace, {
        ...current, google_maps_url: rejected,
      }, { currentProperty: current, expectedOperationalProfileVersion: 0 }))
        .toThrow(/supported Google Maps domain/i);
    }
    for (const accepted of [
      'https://maps.google.com/maps/place/Reviewed',
      'https://www.google.com/maps/place/Reviewed',
      'https://maps.google.com.cy/maps/place/Reviewed',
      'https://maps.google.co.uk/maps/place/Reviewed',
      'https://maps.app.goo.gl/Reviewed',
      'https://goo.gl/maps/Reviewed',
    ]) {
      expect(Core.buildPropertyControlPlan(currentWorkspace, {
        ...current, google_maps_url: accepted,
      }, { currentProperty: current, expectedOperationalProfileVersion: 0 }).payload.google_maps_url)
        .toBe(accepted);
    }
  });

  test('rejects clearing reviewed country or timezone while preserving unchanged legacy blanks', () => {
    const completeWorkspace = workspace();
    const complete = {
      ...Core.normalizeWorkspace(completeWorkspace).property,
      maximum_stay_nights: null,
      guest_instructions_i18n: {}, check_in_instructions_i18n: {}, check_out_instructions_i18n: {},
      internal_operational_notes: null, operational_profile_version: 0,
    };
    expect(() => Core.buildPropertyControlPlan(completeWorkspace, {
      ...complete, country: null,
    }, { currentProperty: complete, expectedOperationalProfileVersion: 0 }))
      .toThrow(/Country cannot be cleared/i);
    expect(() => Core.buildPropertyControlPlan(completeWorkspace, {
      ...complete, timezone: '',
    }, { currentProperty: complete, expectedOperationalProfileVersion: 0 }))
      .toThrow(/Timezone cannot be cleared/i);

    const legacyWorkspace = workspace();
    legacyWorkspace.property.country = null;
    legacyWorkspace.property.timezone = null;
    const legacy = {
      ...Core.normalizeWorkspace(legacyWorkspace).property,
      maximum_stay_nights: null,
      guest_instructions_i18n: {}, check_in_instructions_i18n: {}, check_out_instructions_i18n: {},
      internal_operational_notes: null, operational_profile_version: 0,
    };
    const plan = Core.buildPropertyControlPlan(legacyWorkspace, {
      ...legacy, city: 'Paphos',
    }, { currentProperty: legacy, expectedOperationalProfileVersion: 0 });
    expect(plan.payload).toEqual({ city: 'Paphos' });
    expect(plan.payload).not.toHaveProperty('country');
    expect(plan.payload).not.toHaveProperty('timezone');

    const changed = Core.buildPropertyControlPlan(legacyWorkspace, {
      ...legacy, country: 'Cyprus', timezone: 'Europe/Nicosia',
    }, { currentProperty: legacy, expectedOperationalProfileVersion: 0 });
    expect(changed.payload).toMatchObject({ country: 'Cyprus', timezone: 'Europe/Nicosia' });
  });
});
