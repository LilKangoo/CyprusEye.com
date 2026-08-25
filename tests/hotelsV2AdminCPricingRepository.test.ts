import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const DEFAULT_ID = '55555555-5555-4555-8555-555555555555';
const SNAPSHOT = 'a'.repeat(64);
const REVIEWED_AT = '2026-08-21T09:30:00.000Z';

function reviewedPlan(): any {
  return {
    contract_version: 'hotels_v2_admin_c_pricing_plan_v1',
    hotel_id: HOTEL_ID,
    snapshot_token: SNAPSHOT,
    reviewed_at: REVIEWED_AT,
    operations: [{
      entity: 'property_pricing_default', action: 'create', id: DEFAULT_ID,
      expected_version: 0, expected_children_fingerprint: null,
      expected_link_fingerprint: null, expected_linked_room_rate_ids: [],
      shared_impact_acknowledged: false, activation_acknowledged: false,
      expected_original: {},
      payload: { hotel_id: HOTEL_ID, nightly_rate: 100, currency: 'EUR', lifecycle_status: 'draft' },
    }],
  };
}

function loadRepository(response: any, options: { trustPricingSnapshot?: boolean } = {}): { Repository: any; calls: any[] } {
  const calls: any[] = [];
  const context: Record<string, any> = {
    crypto: { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    URL,
  };
  context.window = context;
  context.getSupabase = () => ({
    rpc: async (name: string, payload: any) => {
      calls.push({ name, payload });
      return typeof response === 'function' ? response(name, payload, calls) : response;
    },
  });
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js'), 'utf8'), context);
  if (options.trustPricingSnapshot) {
    context.HotelsV2WorkspaceCore = {
      ...context.HotelsV2WorkspaceCore,
      validatePricingControl: (value: any) => value,
    };
  }
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-repository.js'), 'utf8'), context);
  return { Repository: context.HotelsV2WorkspaceRepository, calls };
}

describe('Hotels V2 ADMIN-C pricing repository boundary', () => {
  test('never replaces explicitly malformed correlation or idempotency identities', async () => {
    const { Repository, calls } = loadRepository({ data: null, error: null });
    await expect(Repository.applyPricingControlPlan(reviewedPlan(), 'not-a-uuid', 'valid-key-123'))
      .rejects.toThrow(/invalid supplied ID is never replaced/i);
    await expect(Repository.applyPricingControlPlan(
      reviewedPlan(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { key: 'object' },
    )).rejects.toThrow(/exact reviewed string/i);
    await expect(Repository.applyPricingControlPlan(
      reviewedPlan(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ' short ',
    )).rejects.toThrow(/exact reviewed string/i);
    expect(calls).toHaveLength(0);
  });

  test.each([
    ['hotels_v2_admin_c_idempotency_conflict', /request identifier was already used/i],
    ['hotels_v2_admin_c_correlation_conflict', /request identifier was already used/i],
    ['hotels_v2_admin_c_rate_plan_original_mismatch', /changed after Review/i],
  ])('maps exact SQL diagnostic %s without exposing an opaque failure', async (message, userMessage) => {
    const { Repository, calls } = loadRepository({
      data: null,
      error: { code: 'PT409', message, details: 'controlled test detail', hint: null },
    });
    await expect(Repository.applyPricingControlPlan(
      reviewedPlan(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'review-key-123',
    )).rejects.toMatchObject({ isStale: true, userMessage: expect.stringMatching(userMessage) });
    expect(calls).toHaveLength(1);
  });

  test('maps the frozen server technical ceiling to a controlled no-retry message', async () => {
    const { Repository, calls } = loadRepository({
      data: null,
      error: { code: '54000', message: 'hotels_v2_admin_c_technical_limit_exceeded' },
    });
    await expect(Repository.applyPricingControlPlan(
      reviewedPlan(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'review-key-123',
    )).rejects.toMatchObject({ isDefinitiveFailure: true,
      userMessage: expect.stringMatching(/supported technical capacity.*nothing was retried/i) });
    expect(calls).toHaveLength(1);
  });

  test('validates a replay receipt, then performs one read-only GET before replacing current UI state', async () => {
    const correlationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const idempotencyKey = 'review-key-123';
    const target = {
      id: DEFAULT_ID, hotel_id: HOTEL_ID, nightly_rate: 100, currency: 'EUR',
      lifecycle_status: 'draft', version: 1,
    };
    const receiptControl = {
      property_pricing_default: target,
      rate_plans: [], room_rates: [], pricing_schedules: [], rate_rules: [],
      exact_date_prices: [], allocation_rules: [], recent_activity: [],
      snapshot_token: 'b'.repeat(64),
    };
    const freshControl = { ...receiptControl, snapshot_token: 'c'.repeat(64) };
    const activity = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      entity_type: 'property_pricing_default', entity_id: DEFAULT_ID,
      action: 'create', correlation_id: correlationId, actor_type: 'admin',
      actor_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      source: 'hotels_v2_admin_c_pricing_control', created_at: REVIEWED_AT,
      before_state: null,
      after_state: { nightly_rate: 100, currency: 'EUR', lifecycle_status: 'draft' },
    };
    const { Repository, calls } = loadRepository((name: string) => {
      if (name === 'hotel_v2_admin_get_pricing_control') return { data: freshControl, error: null };
      return { data: {
        contract_version: 'hotels_v2_admin_c_pricing_plan_v1', hotel_id: HOTEL_ID,
        correlation_id: correlationId, idempotency_key: idempotencyKey,
        replayed: true, changed: true, activity: [activity], pricing_control: receiptControl,
      }, error: null };
    }, { trustPricingSnapshot: true });

    const result = await Repository.applyPricingControlPlan(
      reviewedPlan(), correlationId, idempotencyKey,
    );
    expect(result.replayed).toBe(true);
    expect(result.pricing_control.snapshot_token).toBe('c'.repeat(64));
    expect(calls.map((call) => call.name)).toEqual([
      'hotel_v2_admin_apply_pricing_control_plan',
      'hotel_v2_admin_get_pricing_control',
    ]);
  });

  test('a failed replay refresh is explicit and never resends the mutation', async () => {
    const correlationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const idempotencyKey = 'review-key-123';
    const target = { id: DEFAULT_ID, hotel_id: HOTEL_ID, nightly_rate: 100,
      currency: 'EUR', lifecycle_status: 'draft', version: 1 };
    const receiptControl = { property_pricing_default: target, rate_plans: [], room_rates: [],
      pricing_schedules: [], rate_rules: [], exact_date_prices: [], allocation_rules: [],
      recent_activity: [], snapshot_token: 'b'.repeat(64) };
    const activity = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      entity_type: 'property_pricing_default', entity_id: DEFAULT_ID, action: 'create',
      correlation_id: correlationId, actor_type: 'admin',
      actor_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      source: 'hotels_v2_admin_c_pricing_control', created_at: REVIEWED_AT,
      before_state: null, after_state: { nightly_rate: 100, currency: 'EUR', lifecycle_status: 'draft' } };
    const { Repository, calls } = loadRepository((name: string) => (
      name === 'hotel_v2_admin_get_pricing_control'
        ? { data: null, error: { code: 'PGRST000', message: 'read unavailable' } }
        : { data: { contract_version: 'hotels_v2_admin_c_pricing_plan_v1', hotel_id: HOTEL_ID,
          correlation_id: correlationId, idempotency_key: idempotencyKey,
          replayed: true, changed: true, activity: [activity], pricing_control: receiptControl }, error: null }
    ), { trustPricingSnapshot: true });

    await expect(Repository.applyPricingControlPlan(reviewedPlan(), correlationId, idempotencyKey))
      .rejects.toMatchObject({ isAmbiguousOutcome: true,
        userMessage: expect.stringMatching(/will not be retried/i) });
    expect(calls.filter((call) => call.name === 'hotel_v2_admin_apply_pricing_control_plan')).toHaveLength(1);
    expect(calls.filter((call) => call.name === 'hotel_v2_admin_get_pricing_control')).toHaveLength(1);
  });
});
