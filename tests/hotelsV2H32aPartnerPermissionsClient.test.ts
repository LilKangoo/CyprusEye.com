import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '11111111-1111-4111-8111-111111111111';
const ASSIGNMENT = '22222222-2222-4222-8222-222222222222';
const OTHER_ASSIGNMENT = '33333333-3333-4333-8333-333333333333';
const PARTNER = '44444444-4444-4444-8444-444444444444';
const OTHER_PARTNER = '55555555-5555-4555-8555-555555555555';
const CORRELATION = '66666666-6666-4666-8666-666666666666';
const IDEMPOTENCY = '77777777-7777-4777-8777-777777777777';

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js');
  const context: Record<string, any> = { console, crypto: { randomUUID: () => CORRELATION } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.HotelsV2WorkspaceCore;
}

function capabilities(enabled: string[] = []): Record<string, boolean> {
  return Object.fromEntries([
    'edit_property_content', 'edit_property_photos', 'edit_room_content', 'edit_room_photos',
    'create_rooms', 'edit_room_structure', 'manage_prices', 'manage_availability',
    'process_bookings', 'request_booking_changes', 'view_payment_status', 'initiate_stripe_onboarding',
  ].map((key) => [key, enabled.includes(key)]));
}

function assignment(overrides: Record<string, any> = {}): any {
  const caps = overrides.capabilities || capabilities();
  return {
    assignment_id: ASSIGNMENT,
    partner_id: PARTNER,
    hotel_id: HOTEL,
    assignment_active: true,
    partner: { id: PARTNER, name: 'Exact Hotel Partner', status: 'active', can_manage_hotels: true },
    permission: {
      exists: overrides.exists ?? false,
      version: overrides.version ?? 0,
      updated_at: null,
      has_mutation_capability: Object.entries(caps).some(([key, value]) => key !== 'view_payment_status' && value),
      capabilities: caps,
    },
    ...overrides,
  };
}

function snapshot(assignments = [assignment()]): any {
  return {
    contract_version: 'hotels_v2_h3_2a_partner_permissions_v1',
    property: { id: HOTEL, updated_at: '2026-08-15T12:00:00Z', architecture_version: 'legacy', is_published: true, status: 'approved' },
    feature_flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
    capability_catalog: Object.keys(capabilities()),
    assignment_fingerprint: 'assignments-fingerprint',
    permissions_fingerprint: 'permissions-fingerprint',
    snapshot_token: 'snapshot-token',
    assignments,
  };
}

function loadRepository(client: any): { Core: any; Repository: any } {
  const context: Record<string, any> = {
    console,
    crypto: { randomUUID: jest.fn().mockReturnValueOnce(CORRELATION).mockReturnValueOnce(IDEMPOTENCY) },
    window: { getSupabase: () => client },
  };
  for (const relative of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return { Core: context.HotelsV2WorkspaceCore, Repository: context.HotelsV2WorkspaceRepository };
}

describe('Hotels V2 H3.2A exact-assignment Partner permissions client', () => {
  const Core = loadCore();

  test('normalizes a missing permission row to version zero with every capability denied', () => {
    const value = Core.validatePartnerHotelPermissions(snapshot(), HOTEL);
    expect(value.assignments[0].permission).toMatchObject({ exists: false, version: 0, has_mutation_capability: false });
    expect(Object.values(value.assignments[0].permission.capabilities)).toEqual(Array(12).fill(false));
  });

  test('builds the frozen one-assignment reviewed plan without owner, routing or public mutations', () => {
    const plan = Core.buildPartnerHotelPermissionsPlan(snapshot(), ASSIGNMENT, capabilities(['view_payment_status']), {
      hotelId: HOTEL,
      reviewedAt: '2026-08-15T12:05:00Z',
    });
    expect(plan).toEqual({
      contract_version: 'hotels_v2_h3_2a_partner_permissions_v1',
      decision: 'apply_partner_hotel_permissions',
      hotel_id: HOTEL,
      assignment_id: ASSIGNMENT,
      partner_id: PARTNER,
      reviewed_at: '2026-08-15T12:05:00Z',
      snapshot_token: 'snapshot-token',
      expected_assignment_fingerprint: 'assignments-fingerprint',
      expected_permission_version: 0,
      capabilities: capabilities(['view_payment_status']),
    });
    expect(JSON.stringify(plan)).not.toMatch(/owner|architecture|published|payment_policy/);
  });

  test('allows harmless CURRENT == TARGET rebase and stops a real third-way conflict', () => {
    const original = assignment({ exists: true, version: 1, capabilities: capabilities() });
    const target = capabilities(['view_payment_status']);
    const alreadyTarget = assignment({ exists: true, version: 2, capabilities: target });
    expect(Core.reconcilePartnerHotelPermission(original, alreadyTarget, target)).toMatchObject({ safe: true, conflicts: [] });

    const thirdWay = assignment({ exists: true, version: 2, capabilities: capabilities(['edit_room_photos']) });
    expect(Core.reconcilePartnerHotelPermission(original, thirdWay, target)).toMatchObject({
      safe: false,
      conflicts: [expect.objectContaining({ field: 'capabilities' })],
    });
  });

  test('fails client preflight when a second exact assignment already owns mutation access', () => {
    const writerCaps = capabilities(['manage_prices']);
    const other = assignment({
      assignment_id: OTHER_ASSIGNMENT,
      partner_id: OTHER_PARTNER,
      partner: { id: OTHER_PARTNER, name: 'Current writer', status: 'active', can_manage_hotels: true },
      exists: true,
      version: 3,
      capabilities: writerCaps,
      permission: { exists: true, version: 3, updated_at: null, has_mutation_capability: true, capabilities: writerCaps },
    });
    expect(() => Core.buildPartnerHotelPermissionsPlan(snapshot([assignment(), other]), ASSIGNMENT, capabilities(['edit_property_content']), { hotelId: HOTEL }))
      .toThrow('Another exact Hotel assignment already holds mutation capabilities');
  });

  test('allows only all-OFF revocation for a suspended or non-managing partner', () => {
    const suspended = assignment({ partner: { id: PARTNER, name: 'Suspended', status: 'suspended', can_manage_hotels: true } });
    expect(() => Core.buildPartnerHotelPermissionsPlan(snapshot([suspended]), ASSIGNMENT, capabilities(['manage_availability']), { hotelId: HOTEL }))
      .toThrow('Capabilities cannot be granted');
    expect(() => Core.buildPartnerHotelPermissionsPlan(snapshot([suspended]), ASSIGNMENT, capabilities(['view_payment_status']), { hotelId: HOTEL }))
      .toThrow('Capabilities cannot be granted');
    expect(Core.buildPartnerHotelPermissionsPlan(snapshot([suspended]), ASSIGNMENT, capabilities(), { hotelId: HOTEL }).capabilities)
      .toEqual(capabilities());
  });

  test('uses only frozen Admin RPCs and sends correlation plus idempotency UUIDs', async () => {
    const calls: any[] = [];
    const fresh = snapshot();
    const savedCapabilities = capabilities(['view_payment_status']);
    const saved = snapshot([assignment({
      exists: true,
      version: 1,
      capabilities: savedCapabilities,
      permission: {
        exists: true,
        version: 1,
        updated_at: '2026-08-15T12:06:00Z',
        has_mutation_capability: false,
        capabilities: savedCapabilities,
      },
    })]);
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === 'hotel_v2_admin_get_partner_hotel_permissions') return { data: fresh, error: null };
        return {
          data: {
            ok: true,
            hotel_id: HOTEL,
            assignment_id: ASSIGNMENT,
            partner_id: PARTNER,
            correlation_id: CORRELATION,
            idempotency_key: IDEMPOTENCY,
            contract_version: 'hotels_v2_h3_2a_partner_permissions_v1',
            decision: 'apply_partner_hotel_permissions',
            snapshot: saved,
          },
          error: null,
        };
      },
      from() { throw new Error('raw table fallback is forbidden'); },
    };
    const { Core: RepositoryCore, Repository } = loadRepository(client);
    const loaded = await Repository.getPartnerHotelPermissions(HOTEL);
    const plan = RepositoryCore.buildPartnerHotelPermissionsPlan(loaded, ASSIGNMENT, savedCapabilities, { hotelId: HOTEL });
    await Repository.applyPartnerHotelPermissionsPlan(plan);
    expect(calls).toEqual([
      { name: 'hotel_v2_admin_get_partner_hotel_permissions', payload: { p_hotel_id: HOTEL } },
      {
        name: 'hotel_v2_admin_apply_partner_hotel_permissions',
        payload: { p_plan: plan, p_correlation_id: CORRELATION, p_idempotency_key: IDEMPOTENCY },
      },
    ]);
  });

  test('classifies frozen stale conflicts and never retries them', async () => {
    const calls: any[] = [];
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_2a_stale_partner_permissions' } };
      },
    };
    const { Repository } = loadRepository(client);
    const plan = Core.buildPartnerHotelPermissionsPlan(snapshot(), ASSIGNMENT, capabilities(['view_payment_status']), { hotelId: HOTEL });
    await expect(Repository.applyPartnerHotelPermissionsPlan(plan, CORRELATION, IDEMPOTENCY)).rejects.toMatchObject({
      code: 'PT409', isStale: true, isDefinitiveFailure: true, isAmbiguousOutcome: false,
    });
    expect(calls).toHaveLength(1);
  });

  test('Admin and Partner foundation UI remain reviewed/inert with no raw Hotel fallback', () => {
    const admin = fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace.js'), 'utf8');
    const partner = fs.readFileSync(path.join(process.cwd(), 'js/partners.js'), 'utf8');
    const html = fs.readFileSync(path.join(process.cwd(), 'partners/index.html'), 'utf8');
    const dashboard = fs.readFileSync(path.join(process.cwd(), 'admin/dashboard.html'), 'utf8');
    expect(admin).toContain('Review exact Partner & Access permissions');
    expect(admin).toContain('Only the permission row for this exact existing Hotel assignment changes.');
    expect(admin).toContain('Nothing was retried automatically.');
    expect(partner).toContain("state.sb.rpc('hotel_v2_partner_list_assigned_properties'");
    expect(partner).toContain('No raw-table fallback was used.');
    expect(partner).toContain("hasExactKeys(source, ['contract_version', 'partner', 'foundation_only', 'workspace_available', 'properties'])");
    expect(partner).toContain("hasExactKeys(row, ['assignment_id', 'hotel_id', 'slug', 'name_i18n', 'city', 'cover_image_url'");
    expect(html).toContain('id="partnerAssignedHotelsCard"');
    expect(html).toContain('Foundation only');
    expect(html).not.toContain('data-assigned-hotel-workspace');
    expect(dashboard).toContain('/admin/admin.css?v=20260820_1');
    expect(dashboard).toContain('/admin/hotels-v2-workspace-core.js?v=20260820_1');
    expect(dashboard).toContain('/admin/hotels-v2-workspace-repository.js?v=20260820_1');
    expect(dashboard).toContain('/admin/hotels-v2-workspace.js?v=20260820_1');
    expect(html).toContain('/js/partners.js?v=37');
  });
});
