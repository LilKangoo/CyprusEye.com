import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_HOTEL_ID = '22222222-2222-4222-8222-222222222222';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';

function workspace(id = HOTEL_ID): any {
  return {
    property: {
      id,
      architecture_version: 'rooms_v2',
      title_i18n: { en: 'Fixture Hotel' },
      city: 'Lefkara',
      timezone: 'Europe/Nicosia',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      updated_at: '2026-08-11T10:00:00.000Z',
    },
    room_types: [],
    units: [],
    rate_plans: [],
    room_rates: [],
  };
}

function loadRepository(client: any): { Core: any; Repository: any } {
  const context: Record<string, any> = {
    console,
    crypto: { randomUUID: () => CORRELATION_ID },
    window: { getSupabase: () => client },
  };
  for (const relative of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return {
    Core: context.HotelsV2WorkspaceCore,
    Repository: context.HotelsV2WorkspaceRepository,
  };
}

describe('Hotels V2 H2A Property Workspace repository', () => {
  test('loads one property directory row through the Admin list RPC without raw table reads', async () => {
    const calls: any[] = [];
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        return {
          data: [{
            id: HOTEL_ID,
            title_i18n: { en: 'One Property' },
            room_type_count: 4,
            rate_plan_count: 3,
          }],
          error: null,
        };
      },
      from() { throw new Error('raw table access is forbidden'); },
    };
    const { Repository } = loadRepository(client);
    await expect(Repository.listProperties()).resolves.toEqual([
      expect.objectContaining({ id: HOTEL_ID, room_type_count: 4, rate_plan_count: 3 }),
    ]);
    expect(calls).toEqual([{ name: 'hotel_v2_admin_get_property_list', payload: {} }]);
  });

  test('fresh workspace read rejects a mismatched property ID', async () => {
    const client = {
      async rpc() { return { data: workspace(OTHER_HOTEL_ID), error: null }; },
    };
    const { Repository } = loadRepository(client);
    await expect(Repository.getWorkspace(HOTEL_ID)).rejects.toThrow('Property Workspace returned a different property ID.');
  });

  test('ADMIN-B content control rejects unknown private-profile and envelope fields', async () => {
    let response: any;
    const client = { async rpc() { return { data: response, error: null }; } };
    const { Core, Repository } = loadRepository(client);
    const snapshot = {
      contract_version: Core.H3_2A_PARTNER_PERMISSIONS_CONTRACT,
      property: {
        id: HOTEL_ID, updated_at: '2026-08-20T08:00:00.000Z', architecture_version: 'legacy',
        is_published: false, status: 'active',
      },
      feature_flags: {
        hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: false,
        hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false,
      },
      capability_catalog: [...Core.HOTEL_PARTNER_CAPABILITIES],
      assignment_fingerprint: 'assignment-fingerprint', permissions_fingerprint: 'permissions-fingerprint',
      snapshot_token: 'snapshot-token', assignments: [],
    };
    const valid = {
      contract_version: 'hotels_v2_admin_b_content_control_v1', hotel_id: HOTEL_ID,
      property_updated_at: '2026-08-20T08:00:00.000Z',
      architecture_version: 'legacy', feature_flags: { ...snapshot.feature_flags },
      commercial_owner: null,
      operational_profile: {
        exists: false, version: 0, updated_at: null, maximum_stay_nights: null,
        guest_instructions_i18n: {}, check_in_instructions_i18n: {}, check_out_instructions_i18n: {},
        internal_operational_notes: null,
      },
      assignment_snapshot: snapshot,
    };
    response = valid;
    await expect(Repository.getContentControl(HOTEL_ID)).resolves.toMatchObject({
      hotel_id: HOTEL_ID, operational_profile: { exists: false, version: 0 },
    });
    response = { ...valid, operational_profile: { ...valid.operational_profile, browser_visible_secret: 'no' } };
    await expect(Repository.getContentControl(HOTEL_ID)).rejects.toThrow('unsupported or cross-property snapshot');
    response = { ...valid, unexpected_envelope_field: true };
    await expect(Repository.getContentControl(HOTEL_ID)).rejects.toThrow('unsupported or cross-property snapshot');
  });

  test('applies one reviewed exact-property plan and preserves its concurrency snapshot', async () => {
    const calls: any[] = [];
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        return { data: { correlation_id: CORRELATION_ID, workspace: workspace() }, error: null };
      },
    };
    const { Repository } = loadRepository(client);
    const plan = {
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T10:00:00.000Z',
      reviewed_at: '2026-08-11T10:05:00.000Z',
      operations: [{
        type: 'update',
        entity: 'room_type',
        id: OTHER_HOTEL_ID,
        expected_version: 7,
        payload: { id: OTHER_HOTEL_ID, hotel_id: HOTEL_ID, base_inventory_count: 4 },
      }],
    };
    const result = await Repository.applyWorkspacePlan(plan, CORRELATION_ID);
    expect(result).toMatchObject({ correlation_id: CORRELATION_ID, workspace: { property: { id: HOTEL_ID } } });
    expect(calls).toEqual([{
      name: 'hotel_v2_admin_apply_workspace_plan',
      payload: { p_plan: plan, p_correlation_id: CORRELATION_ID },
    }]);
  });

  test('fails before any RPC when a reviewed exact-property plan is empty or malformed', async () => {
    let calls = 0;
    const client = {
      async rpc() { calls += 1; return { data: null, error: null }; },
    };
    const { Repository } = loadRepository(client);
    await expect(Repository.applyWorkspacePlan({ hotel_id: HOTEL_ID, operations: [] }, CORRELATION_ID))
      .rejects.toThrow('A reviewed exact-property save plan is required.');
    await expect(Repository.applyWorkspacePlan({ hotel_id: 'not-a-uuid', operations: [{}] }, CORRELATION_ID))
      .rejects.toThrow('A reviewed exact-property save plan is required.');
    expect(calls).toBe(0);
  });

  test('surfaces stale version failures as concurrency errors without a fallback write', async () => {
    let calls = 0;
    const client = {
      async rpc() {
        calls += 1;
        return { data: null, error: { code: '40001', message: 'Room changed after Review' } };
      },
    };
    const { Repository } = loadRepository(client);
    const plan = {
      hotel_id: HOTEL_ID,
      operations: [{ type: 'update', entity: 'room_type', id: OTHER_HOTEL_ID, expected_version: 2, payload: {} }],
    };
    await expect(Repository.applyWorkspacePlan(plan, CORRELATION_ID)).rejects.toMatchObject({
      code: '40001',
      isStale: true,
      isDefinitiveFailure: true,
      isAmbiguousOutcome: false,
    });
    expect(calls).toBe(1);
  });

  test('treats PostgREST PT409 optimistic conflicts as definitive stale failures', async () => {
    let calls = 0;
    const client = {
      async rpc() {
        calls += 1;
        return {
          data: null,
          error: {
            code: 'PT409',
            message: 'Reviewed operation conflict',
          },
        };
      },
    };
    const { Repository } = loadRepository(client);
    const plan = {
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T10:00:00.000Z',
      reviewed_at: '2026-08-11T10:01:00.000Z',
      source_contract: 'seven_arches_two_apartments_v1',
      expected_legacy_pricing_fingerprint: 'fixture',
      expected_versions: {},
      expected_property_policy: { children_policy: 'minimum_age', minimum_child_age: 15 },
      property_policy: { children_policy: 'minimum_age', minimum_child_age: 15 },
      rooms: [{ id: HOTEL_ID }, { id: OTHER_HOTEL_ID }],
      prepare_pricing_preview: true,
    };

    await expect(Repository.prepareLegacyShadowRooms(plan, CORRELATION_ID)).rejects.toMatchObject({
      code: 'PT409',
      isStale: true,
      isDefinitiveFailure: true,
      isAmbiguousOutcome: false,
    });
    expect(calls).toBe(1);
  });

  test('maps reviewed shadow policy, gallery, missing-room and relationship failures without retrying', async () => {
    const failures = [
      {
        code: 'PT409', message: 'hotels_v2_h2b1_property_policy_snapshot_mismatch',
        expected: 'children-policy snapshot changed after Review',
      },
      {
        code: '22023', message: 'hotels_v2_h2b2_shadow_property_policy_mismatch',
        expected: 'cannot replace the separately reviewed property children policy',
      },
      {
        code: '23514', message: 'hotels_v2_h2b1_room_photo_not_in_property_gallery',
        expected: 'selected room photo is not in the current 7 Arches property gallery',
      },
      {
        code: '22023', message: 'hotels_v2_h2b1_shadow_rooms_exact_set_required',
        expected: 'exactly the two expected 7 Arches apartments',
      },
      {
        code: 'PT409', message: 'hotels_v2_h2b1_stale_rate_plan',
        expected: 'one of its pricing relationships changed after Review',
      },
      {
        code: 'PT409', message: 'hotels_v2_h2b1_stale_shadow_room',
        expected: 'Current data must be refreshed and reviewed again',
      },
      {
        code: 'PT409', message: 'hotels_v2_h2b1_shadow_room_three_way_conflict',
        expected: 'compare the original, current and requested values',
      },
    ];
    let calls = 0;
    const client = {
      async rpc() {
        const failure = failures[calls];
        calls += 1;
        return { data: null, error: failure };
      },
    };
    const { Repository } = loadRepository(client);
    const plan = {
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T10:00:00.000Z',
      expected_property_policy: { children_policy: 'minimum_age', minimum_child_age: 15 },
      reviewed_at: '2026-08-11T10:01:00.000Z',
      source_contract: 'seven_arches_two_apartments_v1',
      expected_legacy_pricing_fingerprint: 'fixture',
      expected_versions: {},
      property_policy: { children_policy: 'minimum_age', minimum_child_age: 15 },
      rooms: [{ id: HOTEL_ID }, { id: OTHER_HOTEL_ID }],
      prepare_pricing_preview: true,
    };

    for (const failure of failures) {
      await expect(Repository.prepareLegacyShadowRooms(plan, CORRELATION_ID)).rejects.toMatchObject({
        code: failure.code,
        diagnosticReason: failure.message,
        userMessage: expect.stringContaining(failure.expected),
        isDefinitiveFailure: true,
        isAmbiguousOutcome: false,
      });
    }
    expect(calls).toBe(failures.length);
  });

  test('refuses a shadow save without the exact reviewed property-policy snapshot', async () => {
    let calls = 0;
    const client = {
      async rpc() {
        calls += 1;
        return { data: null, error: null };
      },
    };
    const { Repository } = loadRepository(client);
    await expect(Repository.prepareLegacyShadowRooms({
      hotel_id: HOTEL_ID,
      source_contract: 'seven_arches_two_apartments_v1',
      rooms: [{ id: HOTEL_ID }, { id: OTHER_HOTEL_ID }],
    }, CORRELATION_ID)).rejects.toThrow('A reviewed exact two-apartment shadow preparation plan is required.');
    expect(calls).toBe(0);
  });

  test('attaches a non-media diagnostic snapshot to a rejected shadow RPC without retrying', async () => {
    let calls = 0;
    const client = {
      async rpc() {
        calls += 1;
        return { data: null, error: { code: 'PT409', message: 'hotels_v2_h2b1_stale_property_policy' } };
      },
    };
    const { Repository } = loadRepository(client);
    const plan = {
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T10:00:00.000Z',
      expected_property_policy: { children_policy: 'minimum_age', minimum_child_age: 15 },
      reviewed_at: '2026-08-11T10:01:00.000Z',
      source_contract: 'seven_arches_two_apartments_v1',
      expected_legacy_pricing_fingerprint: 'fixture',
      expected_versions: { upper_room: 7, ground_room: 8 },
      property_policy: { children_policy: 'minimum_age', minimum_child_age: 10 },
      rooms: [
        { id: HOTEL_ID, expected_version: 7, gallery: ['https://private.example/upper.webp'] },
        { id: OTHER_HOTEL_ID, expected_version: 8, gallery: ['https://private.example/ground.webp'] },
      ],
      prepare_pricing_preview: true,
    };

    let rejected: any = null;
    try {
      await Repository.prepareLegacyShadowRooms(plan, CORRELATION_ID);
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toMatchObject({
      code: 'PT409',
      userMessage: expect.stringContaining('children-policy snapshot changed after Review'),
      diagnosticContext: {
        correlation_id: CORRELATION_ID,
        hotel_id: HOTEL_ID,
        expected_property_updated_at: '2026-08-11T10:00:00.000Z',
        expected_property_policy: { children_policy: 'minimum_age', minimum_child_age: 15 },
        rooms: [
          { id: HOTEL_ID, expected_version: 7 },
          { id: OTHER_HOTEL_ID, expected_version: 8 },
        ],
        expected_versions: { upper_room: 7, ground_room: 8 },
      },
    });
    expect(JSON.stringify(rejected.diagnosticContext)).not.toContain('private.example');
    expect(calls).toBe(1);
  });

  test('classifies a lost RPC response as ambiguous so committed media is never deleted blindly', async () => {
    const client = {
      async rpc() { throw new TypeError('Failed to fetch'); },
    };
    const { Repository } = loadRepository(client);
    const plan = {
      hotel_id: HOTEL_ID,
      operations: [{ type: 'update', entity: 'room_type', id: OTHER_HOTEL_ID, expected_version: 2, payload: {} }],
    };
    await expect(Repository.applyWorkspacePlan(plan, CORRELATION_ID)).rejects.toMatchObject({
      isDefinitiveFailure: false,
      isAmbiguousOutcome: true,
      message: expect.stringContaining('Failed to fetch'),
    });
  });

  test('classifies a structured PostgREST rejection as definitive', async () => {
    const client = {
      async rpc() {
        return { data: null, error: { code: 'PGRST202', message: 'Function was not found in the schema cache' } };
      },
    };
    const { Repository } = loadRepository(client);
    await expect(Repository.listProperties()).rejects.toMatchObject({
      code: 'PGRST202',
      isDefinitiveFailure: true,
      isAmbiguousOutcome: false,
    });
  });

  test('creates an exact unpublished Rooms V2 draft through its dedicated RPC', async () => {
    const calls: any[] = [];
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        return { data: { workspace: workspace() }, error: null };
      },
    };
    const { Repository } = loadRepository(client);
    const payload = {
      slug: 'fixture-hotel',
      title_i18n: { en: 'Fixture Hotel', pl: 'Hotel testowy', he: 'מלון בדיקה' },
      city: 'Lefkara',
      country: 'Cyprus',
      timezone: 'Europe/Nicosia',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      is_published: false,
    };
    await expect(Repository.createPropertyDraft(HOTEL_ID, payload, CORRELATION_ID))
      .resolves.toMatchObject({ workspace: { property: { id: HOTEL_ID, architecture_version: 'rooms_v2' } } });
    expect(calls).toEqual([{
      name: 'hotel_v2_admin_create_property_draft',
      payload: { p_id: HOTEL_ID, p_payload: payload, p_correlation_id: CORRELATION_ID },
    }]);
  });

  test('loads an exact authoritative Calendar range without raw normalized-table reads', async () => {
    const calls: any[] = [];
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        return {
          data: {
            hotel_id: HOTEL_ID,
            start_date: '2026-08-01',
            end_date: '2026-08-31',
            snapshot_token: 'calendar-snapshot-1',
            property: { id: HOTEL_ID },
            room_types: [{ id: OTHER_HOTEL_ID }],
            room_rates: [], rate_rules: [], occupancy_tiers: [], calendar_overrides: [],
            daily_inventory: [], daily_rates: [], effective_cells: [],
          },
          error: null,
        };
      },
      from() { throw new Error('raw table access is forbidden'); },
    };
    const { Repository } = loadRepository(client);
    await expect(Repository.getCalendar(HOTEL_ID, '2026-08-01', '2026-08-31')).resolves.toMatchObject({
      hotel_id: HOTEL_ID,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      snapshot_token: 'calendar-snapshot-1',
      room_types: [{ id: OTHER_HOTEL_ID }],
    });
    expect(calls).toEqual([{
      name: 'hotel_v2_admin_get_calendar',
      payload: {
        p_hotel_id: HOTEL_ID,
        p_start_date: '2026-08-01',
        p_end_date: '2026-08-31',
      },
    }]);
  });

  test('applies one reviewed exact-row Calendar plan and preserves the RPC transaction boundary', async () => {
    const calls: any[] = [];
    const plan = {
      hotel_id: HOTEL_ID,
      from: '2026-08-01',
      to: '2026-08-31',
      reviewed_at: '2026-08-11T12:00:00.000Z',
      snapshot_token: 'calendar-snapshot-1',
      operations: [{
        entity: 'daily_inventory', type: 'upsert', expected_version: 0,
        payload: { room_type_id: OTHER_HOTEL_ID, stay_date: '2026-08-01', sellable_units: 2, closed: false },
      }],
    };
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        return {
          data: {
            correlation_id: CORRELATION_ID,
            calendar: {
              hotel_id: HOTEL_ID,
              start_date: '2026-08-01',
              end_date: '2026-08-31',
              snapshot_token: 'calendar-snapshot-2',
              property: { id: HOTEL_ID },
            },
          }, error: null,
        };
      },
    };
    const { Repository } = loadRepository(client);
    await expect(Repository.applyCalendarPlan(plan, CORRELATION_ID)).resolves.toMatchObject({
      correlation_id: CORRELATION_ID,
      calendar: { hotel_id: HOTEL_ID, start_date: '2026-08-01', end_date: '2026-08-31', snapshot_token: 'calendar-snapshot-2' },
    });
    expect(calls).toEqual([{
      name: 'hotel_v2_admin_apply_calendar_plan',
      payload: { p_plan: plan, p_correlation_id: CORRELATION_ID },
    }]);
  });

  test('rejects a Calendar apply locally when the reviewed snapshot token is absent', async () => {
    const calls: any[] = [];
    const client = { async rpc(name: string, payload: any) { calls.push({ name, payload }); return { data: null, error: null }; } };
    const { Repository } = loadRepository(client);
    await expect(Repository.applyCalendarPlan({
      hotel_id: HOTEL_ID,
      from: '2026-08-01',
      to: '2026-08-31',
      reviewed_at: '2026-08-11T12:00:00.000Z',
      operations: [{ entity: 'daily_inventory', type: 'upsert', expected_version: 0, payload: {} }],
    }, CORRELATION_ID)).rejects.toThrow('A reviewed exact-property calendar plan is required.');
    expect(calls).toEqual([]);
  });

  test('calls the read-only authoritative stay resolver with exact product and stay context', async () => {
    const calls: any[] = [];
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        return { data: { room_rate_id: OTHER_HOTEL_ID, nights: 3, guest_count: 2, total: 360 }, error: null };
      },
    };
    const { Repository } = loadRepository(client);
    await expect(Repository.resolveRate(OTHER_HOTEL_ID, '2026-08-10', '2026-08-13', 2))
      .resolves.toMatchObject({ room_rate_id: OTHER_HOTEL_ID, total: 360 });
    expect(calls).toEqual([{
      name: 'hotel_v2_admin_resolve_rate',
      payload: { p_room_rate_id: OTHER_HOTEL_ID, p_check_in: '2026-08-10', p_check_out: '2026-08-13', p_guest_count: 2 },
    }]);
  });

  test('uses dedicated transactional RPCs for Room Types, children policy and two-apartment shadow preparation', async () => {
    const calls: any[] = [];
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        return { data: { correlation_id: CORRELATION_ID, workspace: workspace() }, error: null };
      },
      from() { throw new Error('raw table access is forbidden'); },
    };
    const { Repository } = loadRepository(client);
    const roomPlan = {
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T10:00:00.000Z',
      reviewed_at: '2026-08-11T11:00:00.000Z',
      operation: {
        type: 'create', id: OTHER_HOTEL_ID, expected_version: 0,
        payload: { code: 'apartment', max_occupancy: 4, capacity_adults: null, capacity_children: null },
      },
    };
    await Repository.applyRoomTypePlan(roomPlan, CORRELATION_ID);

    const childPlan = {
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T10:00:00.000Z',
      reviewed_at: '2026-08-11T11:00:00.000Z',
      property_policy: { children_policy: 'not_allowed', minimum_child_age: null },
      room_policies: [],
    };
    await Repository.applyGuestPolicyPlan(childPlan, CORRELATION_ID);

    const shadowPlan = {
      hotel_id: HOTEL_ID,
      expected_property_updated_at: '2026-08-11T10:00:00.000Z',
      reviewed_at: '2026-08-11T11:00:00.000Z',
      source_contract: 'seven_arches_two_apartments_v1',
      expected_property_policy: { children_policy: 'minimum_age', minimum_child_age: 15 },
      property_policy: { children_policy: 'minimum_age', minimum_child_age: 10 },
      rooms: [
        { id: 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94', expected_version: 0 },
        { id: '825c01b7-9f82-492a-9c81-9b1d5cd7acd3', expected_version: 0 },
      ],
      prepare_pricing_preview: true,
    };
    await Repository.prepareLegacyShadowRooms(shadowPlan, CORRELATION_ID);
    expect(calls).toEqual([
      { name: 'hotel_v2_admin_apply_room_type_plan', payload: { p_plan: roomPlan, p_correlation_id: CORRELATION_ID } },
      { name: 'hotel_v2_admin_apply_guest_policy_plan', payload: { p_plan: childPlan, p_correlation_id: CORRELATION_ID } },
      { name: 'hotel_v2_admin_prepare_legacy_shadow_rooms', payload: { p_plan: shadowPlan, p_correlation_id: CORRELATION_ID } },
    ]);
  });
});
