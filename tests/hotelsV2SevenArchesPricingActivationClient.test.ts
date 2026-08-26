import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PLAN = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const UPPER_ROOM = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND_ROOM = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const SCHEDULE = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const PARTY_SCHEDULE = '443065c0-984a-5de3-a22a-d03042c41107';
const PROMOTION = '11111111-1111-4111-8111-111111111111';
const PAYMENT = '22222222-2222-4222-8222-222222222222';
const COMMISSION = '33333333-3333-4333-8333-333333333333';
const REVIEW = '44444444-4444-4444-8444-444444444444';
const CORRELATION = '55555555-5555-4555-8555-555555555555';
const IDEMPOTENCY = 'seven-arches.activation-1';
const TOKEN = 'a'.repeat(64);
const FINGERPRINT = 'b'.repeat(64);
const MD5 = 'c'.repeat(32);
const UPDATED = '2026-08-26T10:00:00Z';

function loadCore(): any {
  const context: any = { console, URL, TextEncoder, crypto: { randomUUID: () => CORRELATION } };
  context.globalThis = context; context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js'), 'utf8'), context);
  return context.HotelsV2WorkspaceCore;
}

function snapshot(status: 'ready' | 'active' = 'ready'): any {
  const active = status === 'active';
  return {
    contract_version: 'hotels_v2_seven_arches_pricing_activation_snapshot_v1',
    hotel_id: HOTEL, status, snapshot_token: TOKEN, public_change: false,
    legacy_authoritative: true,
    feature_flags: {
      hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false,
    },
    h3_1p: {
      promotion_review_id: PROMOTION,
      source_fingerprint: '7208ab4ecc0e47abd64d87ca1ac53a03',
      parity: {
        threshold_case_count: 63, threshold_mismatch_count: 0,
        long_stay_case_count: 7, long_stay_mismatch_count: 0,
        total_case_count: 70, total_mismatch_count: 0, fingerprint: MD5,
      },
      allocation_exact: true,
    },
    rate_plan: {
      id: PLAN, version: active ? 4 : 3,
      name_i18n: active ? { pl: 'Standardowa', en: 'Standard', he: 'סטנדרטית' } : { en: 'Standard' },
      description_i18n: active ? { pl: 'Opis', en: 'Description', he: 'תיאור' } : {},
      cancellation_policy: { type: 'non_refundable' }, is_active: active, review_status: 'reviewed',
    },
    room_rates: [
      { id: UPPER_RATE, room_type_id: UPPER_ROOM, base_nightly_rate: active ? 120 : 0, currency: 'EUR', is_active: active, review_status: 'reviewed', version: active ? 5 : 4 },
      { id: GROUND_RATE, room_type_id: GROUND_ROOM, base_nightly_rate: active ? 110 : 0, currency: 'EUR', is_active: active, review_status: 'reviewed', version: active ? 5 : 4 },
    ],
    shared_schedule: {
      id: SCHEDULE, version: active ? 4 : 3,
      name_i18n: active ? { pl: 'Wspólny', en: 'Shared', he: 'משותף' } : { en: 'Shared' },
      is_active: active, review_status: 'reviewed', active_tier_count: 27,
    },
    preview_schedule: { id: PARTY_SCHEDULE, version: 2, is_active: false, review_status: 'requires_review' },
    payment_policy: {
      id: PAYMENT, code: 'seven-kamares-request-confirmation', currency: 'EUR',
      is_active: true, review_status: 'reviewed', version: 2, terms_fingerprint: MD5,
    },
    commission_policy: {
      id: COMMISSION, code: 'seven-kamares-room-night',
      commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR',
      version: 2, updated_at: UPDATED, read_only: true,
    },
    blocking_reasons: [],
  };
}

function draft(): any {
  return {
    contract_version: 'hotels_v2_seven_arches_pricing_activation_draft_v1',
    hotel_id: HOTEL, snapshot_token: TOKEN,
    upper_base_nightly_rate: 120, ground_base_nightly_rate: 110,
    rate_plan_name_i18n: { pl: 'Standardowa', en: 'Standard', he: 'סטנדרטית' },
    rate_plan_description_i18n: { pl: 'Opis', en: 'Description', he: 'תיאור' },
    schedule_name_i18n: { pl: 'Wspólny', en: 'Shared', he: 'משותף' },
    reason: 'Activate the reviewed 70-case pricing graph',
  };
}

function expectedOriginal(): any {
  const current = snapshot();
  return {
    rate_plan: current.rate_plan, room_rates: current.room_rates,
    shared_schedule: current.shared_schedule, preview_schedule: current.preview_schedule,
  };
}

function afterState(): any {
  const payload = draft();
  return {
    rate_plan: {
      id: PLAN, name_i18n: payload.rate_plan_name_i18n,
      description_i18n: payload.rate_plan_description_i18n, is_active: true,
    },
    room_rates: [
      { id: UPPER_RATE, base_nightly_rate: 120, is_active: true },
      { id: GROUND_RATE, base_nightly_rate: 110, is_active: true },
    ],
    shared_schedule: { id: SCHEDULE, name_i18n: payload.schedule_name_i18n, is_active: true },
    preview_schedule: snapshot().preview_schedule,
  };
}

function reviewedPlan(): any {
  const payload = draft();
  delete payload.contract_version; delete payload.hotel_id; delete payload.snapshot_token;
  return {
    contract_version: 'hotels_v2_seven_arches_pricing_activation_plan_v1',
    review_id: REVIEW, hotel_id: HOTEL, snapshot_token: TOKEN,
    reviewed_at: '2026-08-26T10:01:00.000000Z', expires_at: '2026-08-26T10:31:00.000000Z',
    operation: {
      entity: 'pricing_activation', action: 'activate', id: HOTEL,
      expected_original: expectedOriginal(), payload,
    },
    plan_fingerprint: FINGERPRINT,
  };
}

function preview(): any {
  return {
    contract_version: 'hotels_v2_seven_arches_pricing_activation_preview_v1',
    hotel_id: HOTEL, changed: true, blocking_reasons: [],
    impact: {
      entity: 'pricing_activation', action: 'activate', id: HOTEL, changed: true,
      fields: ['base_nightly_rates', 'is_active', 'rate_plan_description_i18n', 'rate_plan_name_i18n', 'schedule_name_i18n'],
      before: expectedOriginal(), after: afterState(),
      affected_room_type_ids: [GROUND_ROOM, UPPER_ROOM],
      affected_room_rate_ids: [GROUND_RATE, UPPER_RATE], from: null, to: null,
    },
    reviewed_plan: reviewedPlan(),
  };
}

describe('7 Arches pricing activation Admin client', () => {
  test('strictly binds the ready snapshot, complete PL/EN/HE draft, Review impact and receipt', () => {
    const Core = loadCore();
    expect(Core.validateSevenArchesPricingActivationSnapshot(snapshot()).status).toBe('ready');
    expect(Core.validateSevenArchesPricingActivationDraft(draft(), snapshot()).upper_base_nightly_rate).toBe(120);
    expect(Core.validateSevenArchesPricingActivationPreview(preview(), draft(), snapshot()).reviewed_plan.review_id).toBe(REVIEW);

    const receipt = {
      contract_version: 'hotels_v2_seven_arches_pricing_activation_apply_result_v1',
      hotel_id: HOTEL, changed: true, replayed: false, review_id: REVIEW,
      correlation_id: CORRELATION, idempotency_key: IDEMPOTENCY,
      activity_ids: [
        '61111111-1111-4111-8111-111111111111', '62222222-2222-4222-8222-222222222222',
        '63333333-3333-4333-8333-333333333333', '64444444-4444-4444-8444-444444444444',
      ],
      public_change: false, legacy_authoritative: true,
    };
    expect(Core.validateSevenArchesPricingActivationApplyResult(receipt, reviewedPlan(), CORRELATION, IDEMPOTENCY).activity_ids).toHaveLength(4);
    expect(Core.validateSevenArchesPricingActivationSnapshot(snapshot('active')).status).toBe('active');
  });

  test('fails closed for missing translations, zero prices, smuggling and sibling impact changes', () => {
    const Core = loadCore();
    const missingLocale = draft(); delete missingLocale.rate_plan_description_i18n.he;
    expect(() => Core.validateSevenArchesPricingActivationDraft(missingLocale, snapshot())).toThrow('invalid, incomplete or stale');
    expect(() => Core.validateSevenArchesPricingActivationDraft({ ...draft(), upper_base_nightly_rate: 0 }, snapshot())).toThrow('invalid, incomplete or stale');
    expect(() => Core.validateSevenArchesPricingActivationDraft({ ...draft(), commission_amount: 10 }, snapshot())).toThrow('invalid, incomplete or stale');
    const changedSibling = preview();
    changedSibling.impact.after.preview_schedule.is_active = true;
    expect(() => Core.validateSevenArchesPricingActivationPreview(changedSibling, draft(), snapshot())).toThrow('impact is incomplete');
  });

  test('burns the reviewed plan before one Apply and marks an invalid post-RPC receipt ambiguous', async () => {
    const calls: any[] = [];
    const context: any = { console, URL, TextEncoder, crypto: { randomUUID: () => CORRELATION } };
    context.globalThis = context; context.window = context;
    context.getSupabase = () => ({
      rpc: async (name: string, payload: any) => {
        calls.push({ name, payload });
        if (name === 'hotel_v2_admin_preview_seven_arches_pricing_activation') return { data: preview(), error: null };
        if (name === 'hotel_v2_admin_apply_seven_arches_pricing_activation') return { data: { committed_but_invalid: true }, error: null };
        return { data: null, error: new Error(`Unexpected RPC ${name}`) };
      },
    });
    for (const file of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
      vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), file), 'utf8'), context, { filename: file });
    }
    const Repository = context.HotelsV2WorkspaceRepository;
    const reviewed = await Repository.previewSevenArchesPricingActivation(draft(), snapshot());
    await expect(Repository.applySevenArchesPricingActivation(
      reviewed.reviewed_plan, 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', IDEMPOTENCY,
    )).rejects.toThrow('exact lowercase canonical UUID');
    await expect(Repository.applySevenArchesPricingActivation(reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY))
      .rejects.toMatchObject({ saveSucceeded: true, isAmbiguousOutcome: true, isDefinitiveFailure: false });
    await expect(Repository.applySevenArchesPricingActivation(reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY))
      .rejects.toThrow('exact server-reviewed plan');
    expect(calls.filter((call) => call.name === 'hotel_v2_admin_apply_seven_arches_pricing_activation')).toHaveLength(1);
  });

  test('renders a server-gated Admin-only activation card without browser pricing arithmetic', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace.js'), 'utf8');
    const repository = fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-repository.js'), 'utf8');
    const partnerFiles = [
      'js/hotels-v2-partner-workspace.js', 'js/hotels-v2-partner-workspace-core.js',
      'js/hotels-v2-partner-workspace-repository.js',
    ].map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')).join('\n');
    expect(ui).toContain('data-open-seven-arches-pricing-activation');
    expect(ui).toContain("requiredActivationI18nFields('rate_plan_name'");
    expect(ui).toContain("requiredActivationI18nFields('rate_plan_description'");
    expect(ui).toContain("requiredActivationI18nFields('schedule_name'");
    expect(ui).toContain('shared 27-tier schedule remains customer-price authoritative');
    expect(repository).toContain("sevenArchesPricingActivation: 'hotel_v2_admin_get_seven_arches_pricing_activation'");
    expect(repository).toContain('reviewedSevenArchesPricingActivationPlans.delete(fingerprint);');
    expect(partnerFiles).not.toContain('hotel_v2_admin_apply_seven_arches_pricing_activation');
    expect(ui).not.toMatch(/upper_base_nightly_rate\s*[+*\/-]\s*ground_base_nightly_rate/);
  });
});
