import fs from 'node:fs';
import vm from 'node:vm';
import { independentPricingControl } from './fixtures/hotels-v2-114415-client';

function runtime(rpc?: any): any {
  const context: any = { console, TextEncoder, URL, crypto: { randomUUID: () => '48000000-0000-4000-8000-000000000001' } };
  context.window = context; context.globalThis = context;
  context.getSupabase = () => ({ rpc });
  for (const file of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context;
}
function lifecycle(rooms = false, stripe = false, controls = false): any {
  const flags = { hotel_rooms_v2_enabled: rooms, hotel_external_sync_enabled: true,
    hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: stripe };
  const value: any = { contract_version: 'hotels_v2_capability_lifecycle_v1', version: rooms || stripe ? 1 : 0,
    feature_flags: flags, public_booking_enabled: false, architecture: 'legacy', expected_public_change: false, audit_chain_exact: true };
  if (controls) value.capabilities = [
    { key: 'rooms', enabled: rooms, blocked_reasons: [], requires_confirmation: true },
    { key: 'external', enabled: true, blocked_reasons: ['external_calendar_has_separate_reviewed_source_lifecycle'], requires_confirmation: true },
    { key: 'stripe', enabled: stripe, blocked_reasons: [], requires_confirmation: true },
    { key: 'instant', enabled: false, blocked_reasons: ['instant_booking_contract_not_installed'], requires_confirmation: true },
    { key: 'public_booking', enabled: false, blocked_reasons: ['public_booking_release_contract_not_installed'], requires_confirmation: true },
  ];
  return value;
}
describe('Audited capability lifecycle', () => {
  test.each([[false, false], [true, false], [true, true], [false, true]])('exact backend flags rooms=%s stripe=%s keep public OFF', (rooms, stripe) => {
    const core = runtime().HotelsV2WorkspaceCore;
    const value = independentPricingControl(true);
    value.capability_lifecycle = lifecycle(rooms, stripe);
    value.feature_flags = value.capability_lifecycle.feature_flags;
    expect(core.validateCapabilityLifecycle(value.capability_lifecycle).public_booking_enabled).toBe(false);
    expect(core.validatePricingControl(value, value.hotel_id).room_rates).toHaveLength(2);
    expect(core.validatePricingControl(value, value.hotel_id).pricing_schedules[0].tiers).toHaveLength(27);
  });
  test.each([
    (v: any) => { delete v.feature_flags.hotel_rooms_v2_enabled; },
    (v: any) => { v.feature_flags.hotel_rooms_v2_enabled = 'true'; },
    (v: any) => { v.feature_flags.hotel_stripe_connect_enabled = null; },
    (v: any) => { v.feature_flags.hotel_external_sync_enabled = 1; },
    (v: any) => { v.feature_flags.hotel_instant_booking_enabled = true; },
    (v: any) => { v.feature_flags.unexpected = false; },
    (v: any) => { v.public_booking_enabled = true; },
    (v: any) => { v.expected_public_change = true; },
    (v: any) => { v.architecture = 'rooms_v2'; },
    (v: any) => { v.audit_chain_exact = false; },
    (v: any) => { v.version = -1; },
    (v: any) => { v.version = 0; },
    (v: any) => { v.extra = true; },
    (v: any) => { delete v.contract_version; },
  ])('malformed/unapproved lifecycle %s remains fail-closed', (mutate) => {
    const value = lifecycle(true, true); mutate(value);
    expect(() => runtime().HotelsV2WorkspaceCore.validateCapabilityLifecycle(value)).toThrow();
  });
  test('changed real flag cannot be disguised by an independent lifecycle envelope', () => {
    const value = independentPricingControl(); value.feature_flags.hotel_rooms_v2_enabled = true;
    value.capability_lifecycle = lifecycle(false, false);
    expect(() => runtime().HotelsV2WorkspaceCore.validatePricingControl(value)).toThrow();
    delete value.capability_lifecycle;
    expect(() => runtime().HotelsV2WorkspaceCore.validatePricingControl(value)).toThrow();
  });
  test('fresh version, one mutation, no retry after an ambiguous transport error', async () => {
    const calls: string[] = [];
    const context = runtime(async (name: string) => {
      calls.push(name);
      if (name === 'hotel_v2_admin_get_capability_lifecycle') return { data: lifecycle(false, false, true), error: null };
      throw Error('simulated lost response');
    });
    const draft = { capability: 'rooms', enabled: true, expectedVersion: 0, reason: 'Explicit synthetic test decision', confirmed: true };
    await expect(context.HotelsV2WorkspaceRepository.setCapabilityLifecycle(draft)).rejects.toThrow();
    expect(calls).toEqual(['hotel_v2_admin_get_capability_lifecycle', 'hotel_v2_admin_set_capability_lifecycle']);
  });
  test('no confirmation and stale version never call mutation', async () => {
    const calls: string[] = [];
    const context = runtime(async (name: string) => { calls.push(name); return { data: lifecycle(true, true, true), error: null }; });
    const draft = { capability: 'rooms', enabled: false, expectedVersion: 0, reason: 'Explicit synthetic test decision', confirmed: false };
    await expect(context.HotelsV2WorkspaceRepository.setCapabilityLifecycle(draft)).rejects.toThrow();
    expect(calls).toHaveLength(0);
    await expect(context.HotelsV2WorkspaceRepository.setCapabilityLifecycle({ ...draft, confirmed: true })).rejects.toThrow();
    expect(calls).toEqual(['hotel_v2_admin_get_capability_lifecycle']);
  });
  test.each(['wrong target', 'another flag changed', 'wrong version'])('rejects valid-shaped but wrong decision response: %s', async (fault) => {
    const calls: string[] = [];
    const context = runtime(async (name: string) => {
      calls.push(name);
      if (name.startsWith('hotel_v2_admin_get')) return { data: lifecycle(false, false, true), error: null };
      const current = lifecycle(fault !== 'wrong target', fault === 'another flag changed', true);
      current.version = fault === 'wrong version' ? 2 : 1;
      return { data: { replayed: false, decision_version: 1, current }, error: null };
    });
    await expect(context.HotelsV2WorkspaceRepository.setCapabilityLifecycle({ capability: 'rooms', enabled: true,
      expectedVersion: 0, reason: 'Explicit synthetic test decision', confirmed: true })).rejects.toThrow();
    expect(calls).toEqual(['hotel_v2_admin_get_capability_lifecycle', 'hotel_v2_admin_set_capability_lifecycle']);
  });
});
