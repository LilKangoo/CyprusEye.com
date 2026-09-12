import fs from 'node:fs';
import vm from 'node:vm';
import {content114485, HOTEL_114485 as HOTEL} from './fixtures/hotels-114485-content';

const PARTNER = '0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
const ASSIGNMENT = 'a082c085-a6ea-46fd-8548-c8d9c6ee2c34';
const FOREIGN = '85000000-0000-4000-8000-000000000999';
const READ_ONLY = {postStripeContentReadOnly: true};

function harness(): any {
  const c: any = {console, URL, TextEncoder}; c.window = c; c.globalThis = c;
  for (const name of ['core', 'repository']) {
    vm.runInNewContext(fs.readFileSync(`admin/hotels-v2-workspace-${name}.js`, 'utf8'), c);
  }
  c.Core = c.HotelsV2WorkspaceCore;
  c.Repository = c.HotelsV2WorkspaceRepository;
  c.dto = content114485(c.Core);
  c.dto.feature_flags.hotel_stripe_connect_enabled = true;
  c.dto.assignment_snapshot.feature_flags = {...c.dto.feature_flags};
  const snapshot = c.dto.assignment_snapshot;
  snapshot.snapshot_token = 'a'.repeat(32);
  snapshot.assignment_fingerprint = 'b'.repeat(32);
  snapshot.permissions_fingerprint = 'c'.repeat(32);
  snapshot.assignments = [{
    assignment_id: ASSIGNMENT, partner_id: PARTNER, hotel_id: HOTEL, assignment_active: true,
    partner: {id: PARTNER, name: 'Synthetic Partner', status: 'active', can_manage_hotels: true},
    permission: {exists: true, version: 2, updated_at: '2026-09-11T00:00:00Z',
      capabilities: Object.fromEntries(c.Core.HOTEL_PARTNER_CAPABILITIES.map((key: string) => [key, false])),
      has_mutation_capability: false},
    permission_exists: true, staff_scope_count: 0, staff_scope_ids: [],
  }];
  c.calls = [];
  c.getSupabase = () => ({rpc: async (name: string, args: any) => {
    c.calls.push({name, args});
    return {data: name === 'hotel_v2_admin_get_partner_hotel_permissions' ? c.dto.assignment_snapshot : c.dto, error: null};
  }});
  return c;
}

test('114487 current Content Control accepts exact post-Stripe DTO and verified operational assignment', async () => {
  const c = harness();
  const before = JSON.stringify(c.dto);
  const result = await c.Repository.getContentControl(HOTEL);
  expect(result.feature_flags).toEqual({hotel_rooms_v2_enabled: true, hotel_external_sync_enabled: true,
    hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: true});
  expect(c.Core.normalizeOperationalAssignmentSnapshot(result, HOTEL)).toMatchObject({
    hotel_id: HOTEL, snapshot_token: 'a'.repeat(32), assignment_fingerprint: 'b'.repeat(32),
    assignments: [{assignment_id: ASSIGNMENT, partner_id: PARTNER, hotel_id: HOTEL}],
  });
  expect(c.calls).toEqual([{name: 'hotel_v2_admin_get_content_control_114487', args: {p_hotel_id: HOTEL}}]);
  expect(JSON.stringify(c.dto)).toBe(before);
});

for (const [field, value] of [
  ['hotel_rooms_v2_enabled', false], ['hotel_external_sync_enabled', false],
  ['hotel_instant_booking_enabled', true], ['hotel_stripe_connect_enabled', false],
] as const) {
  test(`114487 rejects exact audited state mismatch ${field}=${value}`, async () => {
    const c = harness();
    c.dto.feature_flags[field] = value;
    c.dto.assignment_snapshot.feature_flags[field] = value;
    await expect(c.Repository.getContentControl(HOTEL)).rejects.toThrow();
    expect(() => c.Core.validatePartnerHotelPermissions(c.dto.assignment_snapshot, HOTEL, READ_ONLY)).toThrow();
  });
  for (const invalid of [undefined, null, 'true', 1]) {
    test(`114487 rejects malformed ${field}=${String(invalid)}`, async () => {
      const c = harness();
      c.dto.feature_flags[field] = invalid;
      c.dto.assignment_snapshot.feature_flags[field] = invalid;
      await expect(c.Repository.getContentControl(HOTEL)).rejects.toThrow();
    });
  }
  test(`114487 rejects inconsistent nested ${field}`, async () => {
    const c = harness();
    c.dto.assignment_snapshot.feature_flags[field] = value;
    await expect(c.Repository.getContentControl(HOTEL)).rejects.toThrow();
  });
}

const mutations: Array<[string, (dto: any) => void]> = [
  ['foreign outer Hotel', d => { d.hotel_id = FOREIGN; }],
  ['foreign nested Hotel', d => { d.assignment_snapshot.property.id = FOREIGN; }],
  ['foreign assignment Hotel', d => { d.assignment_snapshot.assignments[0].hotel_id = FOREIGN; }],
  ['missing assignment Hotel', d => { delete d.assignment_snapshot.assignments[0].hotel_id; }],
  ['invalid assignment UUID', d => { d.assignment_snapshot.assignments[0].assignment_id = 'bad'; }],
  ['foreign nested Partner', d => { d.assignment_snapshot.assignments[0].partner.id = FOREIGN; }],
  ['missing Partner identity', d => { delete d.assignment_snapshot.assignments[0].partner_id; }],
  ['duplicate assignment', d => { d.assignment_snapshot.assignments.push({...d.assignment_snapshot.assignments[0]}); }],
  ['inactive assignment', d => { d.assignment_snapshot.assignments[0].assignment_active = false; }],
  ['invalid permission version', d => { d.assignment_snapshot.assignments[0].permission.version = 0; }],
  ['nonboolean capability', d => { d.assignment_snapshot.assignments[0].permission.capabilities.manage_prices = 'false'; }],
  ['false mutation summary', d => { d.assignment_snapshot.assignments[0].permission.has_mutation_capability = true; }],
  ['missing scope list', d => { d.assignment_snapshot.assignments[0].staff_scope_count = 1; }],
  ['malformed staff scope', d => { d.assignment_snapshot.assignments[0].staff_scope_ids = ['bad']; d.assignment_snapshot.assignments[0].staff_scope_count = 1; }],
  ['extra outer flag', d => { d.feature_flags.public_booking_enabled = false; }],
  ['extra nested flag', d => { d.assignment_snapshot.feature_flags.public_booking_enabled = false; }],
  ['invalid architecture', d => { d.assignment_snapshot.property.architecture_version = 'rooms_v2'; }],
  ['inconsistent timestamp', d => { d.assignment_snapshot.property.updated_at = '2026-09-12T00:00:00Z'; }],
  ['unsupported outer contract', d => { d.contract_version = 'unreviewed'; }],
  ['unsupported nested contract', d => { d.assignment_snapshot.contract_version = 'unreviewed'; }],
];
for (const field of ['snapshot_token', 'assignment_fingerprint', 'permissions_fingerprint']) {
  for (const value of ['', 'invalid', 'a'.repeat(31), 'A'.repeat(32), 123, null]) {
    mutations.push([`${field} malformed ${String(value)}`, d => { d.assignment_snapshot[field] = value; }]);
  }
}
test.each(mutations)('114487 fail closed: %s', async (_name, mutate) => {
  const c = harness(); mutate(c.dto);
  await expect(c.Repository.getContentControl(HOTEL)).rejects.toThrow();
  expect(c.calls.every((call: any) => call.name === 'hotel_v2_admin_get_content_control_114487')).toBe(true);
});

test('default and historical pre-Stripe permissions validators still reject Stripe ON', () => {
  const c = harness();
  // Isolate Stripe as the only unsupported default flag.
  c.dto.assignment_snapshot.feature_flags.hotel_rooms_v2_enabled = false;
  expect(() => c.Core.validatePartnerHotelPermissions(c.dto.assignment_snapshot, HOTEL)).toThrow(/flags OFF/);
  expect(() => c.Core.validatePartnerHotelPermissions(c.dto.assignment_snapshot, HOTEL, {contentReadOnly: true})).toThrow(/flags OFF/);
});

test('read-only mode cannot be injected into the legacy permission mutation builder', () => {
  const c = harness();
  const snapshot = c.Core.validatePartnerHotelPermissions(c.dto.assignment_snapshot, HOTEL, READ_ONLY);
  expect(() => c.Core.buildPartnerHotelPermissionsPlan(snapshot, ASSIGNMENT,
    snapshot.assignments[0].permission.capabilities, {hotelId: HOTEL, ...READ_ONLY})).toThrow(/flags OFF/);
  expect(c.calls).toEqual([]);
});

test('legacy Partner permissions repository remains separate and fail closed after Stripe activation', async () => {
  const c = harness();
  await expect(c.Repository.getPartnerHotelPermissions(HOTEL)).rejects.toThrow(/flags OFF/);
  expect(c.calls).toEqual([{name: 'hotel_v2_admin_get_partner_hotel_permissions', args: {p_hotel_id: HOTEL}}]);
  expect(c.calls.some((call: any) => call.name.startsWith('hotel_v2_admin_apply_'))).toBe(false);
});

test('read-only mode is explicit, rejects combined modes and never rewrites flags', () => {
  const c = harness(); const snapshot = c.dto.assignment_snapshot; const before = JSON.stringify(snapshot);
  expect(() => c.Core.validatePartnerHotelPermissions(snapshot, HOTEL, {contentReadOnly: true, ...READ_ONLY})).toThrow();
  expect(() => c.Core.validatePartnerHotelPermissions(snapshot, HOTEL, {postStripeContentReadOnly: 'true'})).toThrow(/flags OFF/);
  expect(JSON.stringify(snapshot)).toBe(before);
});

test('only the current read call uses post-Stripe normalization; writer response paths keep the default', () => {
  const source = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
  expect(source).toContain("}, 'Load Admin property content control'), id, { postStripeContentReadOnly: true });");
  expect(source.match(/normalizeContentControl\(payload.content_control, id\)/g)).toHaveLength(2);
  expect(source).toContain("partnerHotelPermissions: 'hotel_v2_admin_get_partner_hotel_permissions'");
});
