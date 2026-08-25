import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const CORRELATION_ID = '88888888-8888-4888-8888-888888888888';
const FINGERPRINT = 'a'.repeat(64);
// Raw md5(room:2026-09-01) has an invalid UUID variant nibble (4). The server
// deterministically canonicalizes it to version 5 / RFC variant 8.
const CANONICAL_DAILY_ID = 'b25d21d6-a02f-595f-8636-80b6a3e78526';

function draft(): any {
  return {
    contract_version: 'hotels_v2_admin_d_availability_draft_v1',
    hotel_id: HOTEL_ID,
    from: '2026-09-01',
    to: '2026-09-02',
    snapshot_token: 'b'.repeat(64),
    intents: [{
      entity: 'daily_inventory', action: 'upsert', id: null,
      payload: { room_type_id: '22222222-2222-4222-8222-222222222222', stay_date: '2026-09-01' },
    }],
  };
}

function plan(): any {
  return {
    contract_version: 'hotels_v2_admin_d_availability_plan_v1',
    hotel_id: HOTEL_ID,
    from: '2026-09-01',
    to: '2026-09-02',
    snapshot_token: 'b'.repeat(64),
    reviewed_at: '2026-08-24T12:00:00.000Z',
    operations: [{ entity: 'daily_inventory', action: 'upsert', id: CANONICAL_DAILY_ID }],
    plan_fingerprint: FINGERPRINT,
  };
}

function loadRepository(response: any): { Repository: any; calls: any[] } {
  const calls: any[] = [];
  const context: Record<string, any> = { crypto: { randomUUID: () => CORRELATION_ID }, URL };
  context.window = context;
  context.getSupabase = () => ({
    rpc: async (name: string, payload: any) => {
      calls.push({ name, payload });
      if (typeof response === 'function') return response(name, payload, calls);
      return response;
    },
  });
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js'), 'utf8'), context);
  context.HotelsV2WorkspaceCore = {
    ...context.HotelsV2WorkspaceCore,
    normalizeAvailabilityControl: (value: any) => value,
    validateAvailabilityDraft: (value: any) => value,
    validateAvailabilityPlan: (value: any) => value,
    validateAvailabilityPlanPreview: (value: any) => value,
    validateAvailabilityApplyResult: (value: any) => value,
  };
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-repository.js'), 'utf8'), context);
  return { Repository: context.HotelsV2WorkspaceRepository, calls };
}

describe('Hotels V2 ADMIN-D availability repository boundary', () => {
  test('uses the exact frozen read RPC and p_from/p_to argument names', async () => {
    const result = { hotel_id: HOTEL_ID, from: '2026-09-01', to: '2026-09-02' };
    const { Repository, calls } = loadRepository({ data: result, error: null });
    await expect(Repository.getAvailabilityControl(HOTEL_ID, result.from, result.to)).resolves.toBe(result);
    expect(calls).toEqual([{
      name: 'hotel_v2_admin_get_availability_control',
      payload: { p_hotel_id: HOTEL_ID, p_from: result.from, p_to: result.to },
    }]);
  });

  test('applies only the exact plan cached by the immediately preceding server Review', async () => {
    const reviewedPlan = plan();
    const { Repository, calls } = loadRepository((name: string) => {
      if (name === 'hotel_v2_admin_preview_availability_plan') {
        return { data: { hotel_id: HOTEL_ID, plan_fingerprint: FINGERPRINT, reviewed_plan: reviewedPlan }, error: null };
      }
      return { data: { changed: true }, error: null };
    });
    await Repository.previewAvailabilityPlan(draft());
    await expect(Repository.applyAvailabilityControlPlan(
      structuredClone(reviewedPlan), CORRELATION_ID, 'review.key-123',
    )).resolves.toEqual({ changed: true });
    expect(calls.map((entry) => entry.name)).toEqual([
      'hotel_v2_admin_preview_availability_plan',
      'hotel_v2_admin_apply_availability_control_plan',
    ]);
    expect(calls[1].payload).toEqual({
      p_plan: reviewedPlan,
      p_correlation_id: CORRELATION_ID,
      p_idempotency_key: 'review.key-123',
    });
    expect(calls[1].payload.p_plan.operations[0].id).toBe(CANONICAL_DAILY_ID);
  });

  test('rejects a locally synthesized plan and never calls the mutation RPC', async () => {
    const { Repository, calls } = loadRepository({ data: null, error: null });
    await expect(Repository.applyAvailabilityControlPlan(
      plan(), CORRELATION_ID, 'review.key-123',
    )).rejects.toThrow(/exact server-reviewed plan/i);
    expect(calls).toHaveLength(0);
  });

  test.each([
    ['uppercase correlation', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', 'review.key-123'],
    ['trimmed key', CORRELATION_ID, ' review.key-123 '],
    ['too long', CORRELATION_ID, `x${'a'.repeat(120)}`],
    ['object key', CORRELATION_ID, { key: 'review.key-123' }],
  ])('rejects %s before transport', async (_label, correlation: any, key: any) => {
    const reviewedPlan = plan();
    const { Repository, calls } = loadRepository({
      data: { hotel_id: HOTEL_ID, plan_fingerprint: FINGERPRINT, reviewed_plan: reviewedPlan }, error: null,
    });
    await Repository.previewAvailabilityPlan(draft());
    await expect(Repository.applyAvailabilityControlPlan(reviewedPlan, correlation, key)).rejects.toThrow(/exact reviewed/i);
    expect(calls).toHaveLength(1);
  });

  test('an ambiguous transport failure makes one mutation call and does not retry', async () => {
    const reviewedPlan = plan();
    const { Repository, calls } = loadRepository((name: string) => {
      if (name === 'hotel_v2_admin_preview_availability_plan') {
        return { data: { hotel_id: HOTEL_ID, plan_fingerprint: FINGERPRINT, reviewed_plan: reviewedPlan }, error: null };
      }
      throw new Error('connection dropped after request');
    });
    await Repository.previewAvailabilityPlan(draft());
    await expect(Repository.applyAvailabilityControlPlan(
      reviewedPlan, CORRELATION_ID, 'review.key-123',
    )).rejects.toMatchObject({ isAmbiguousOutcome: true });
    expect(calls.filter((entry) => entry.name === 'hotel_v2_admin_apply_availability_control_plan')).toHaveLength(1);
    await expect(Repository.applyAvailabilityControlPlan(
      reviewedPlan, CORRELATION_ID, 'review.key-123',
    )).rejects.toThrow(/exact server-reviewed plan/i);
    expect(calls.filter((entry) => entry.name === 'hotel_v2_admin_apply_availability_control_plan')).toHaveLength(1);
  });

  test.each([
    ['hotels_v2_admin_d_correlation_conflict', /request identifier/i],
    ['hotels_v2_admin_d_concurrent_availability_conflict', /changed after Review/i],
    ['hotels_v2_admin_d_review_required', /changed after Review/i],
    ['hotels_v2_admin_d_expiry_elapsed_since_review', /changed after Review/i],
    ['hotels_v2_admin_d_reviewed_operation_state_changed', /changed after Review/i],
    ['hotels_v2_admin_d_stale_daily_inventory', /changed after Review/i],
    ['hotels_v2_admin_d_stale_unit_calendar_block', /changed after Review/i],
    ['hotels_v2_admin_d_stale_operational_override', /changed after Review/i],
    ['hotels_v2_admin_d_stale_rate_rule_operational_restriction', /changed after Review/i],
    ['hotels_v2_admin_d_stale_booking_allocation', /changed after Review/i],
    ['hotels_v2_admin_d_capacity_below_commitments', /committed bookings or active holds/i],
    ['hotels_v2_admin_d_unit_blocked', /committed bookings or active holds/i],
    ['hotels_v2_admin_d_unit_already_committed', /committed bookings or active holds/i],
    ['hotels_v2_admin_d_rate_rule_scope_locked', /availability restrictions.*Calendar first/i],
  ])('maps controlled ADMIN-D failure %s without retrying', async (reason, expected) => {
    const { Repository, calls } = loadRepository({ data: null, error: { code: 'PT409', message: reason } });
    let caught: any;
    try {
      await Repository.getAvailabilityControl(HOTEL_ID, '2026-09-01', '2026-09-02');
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ diagnosticReason: reason, isAmbiguousOutcome: false });
    expect(caught.userMessage).toMatch(expected);
    expect(calls).toHaveLength(1);
  });
});
