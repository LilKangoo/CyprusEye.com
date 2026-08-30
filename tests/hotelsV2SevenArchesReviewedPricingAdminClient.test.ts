import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER_ROOM = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const UPPER_SCHEDULE = 'aec20731-7a56-35f0-334e-92b363351f02';
const TIER = '0e71e8dd-ed8b-a451-ffde-25b98e0f0d49';
const PROPOSAL = '22222222-2222-4222-8222-222222222222';
const PARTNER = '33333333-3333-4333-8333-333333333333';
const ASSIGNMENT = '44444444-4444-4444-8444-444444444444';
const REVIEW = '55555555-5555-4555-8555-555555555555';
const ADMIN = '66666666-6666-4666-8666-666666666666';
const CORRELATION = '77777777-7777-4777-8777-777777777777';
const IDEMPOTENCY = '88888888-8888-4888-8888-888888888888';
const HASH = 'a'.repeat(64);
const MD5 = 'b'.repeat(32);

function loadCore(): any {
  const context: any = { console, URL, TextEncoder, crypto: { randomUUID: () => CORRELATION } };
  context.globalThis = context; context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js'), 'utf8'), context);
  return context.HotelsV2WorkspaceCore;
}

function item(extra: Record<string, unknown> = {}): any {
  return {
    item_index: 1, room_key: 'upper', hotel_id: HOTEL,
    room_type_id: UPPER_ROOM, room_rate_id: UPPER_RATE,
    pricing_schedule_id: UPPER_SCHEDULE, schedule_tier_id: TIER,
    guest_count: 2, minimum_nights: 2, currency: 'EUR',
    before_price: 100, requested_price: 110, ...extra,
  };
}

function currentState(): any {
  return {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_state_v1',
    normalized_fingerprint: HASH, authority_fingerprint: HASH, legacy_fingerprint: HASH,
    oracle: {
      contract_version: 'hotels_v2_seven_arches_reviewed_pricing_oracle_v1',
      core_case_count: 100, core_mismatch_count: 0,
      guest_one_case_count: 20, guest_one_mismatch_count: 0,
      total_case_count: 120, fingerprint: MD5,
    },
    commission_fingerprint: HASH, payment_fingerprint: HASH,
    unrelated_fingerprint: HASH, room_fingerprints: { ground: HASH, upper: HASH },
    last_receipt_hash: HASH, receipt_count: 0, snapshot_token: HASH,
  };
}

function control(): any {
  return {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_control_v1',
    hotel_id: HOTEL,
    proposals: [{
      id: PROPOSAL, initiator_type: 'partner', partner_id: PARTNER,
      assignment_id: ASSIGNMENT, status: 'pending_admin_review', version: 1,
      reason: 'Partner requested an Upper tier change', item_count: 1,
      created_at: '2026-08-30T10:00:00.000000Z',
      expires_at: '2026-08-30T10:30:00.000000Z', fresh: true,
      items: [item()],
    }],
    commission_policy: {
      commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR',
    },
    current_state: currentState(),
  };
}

function request(): any {
  return {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
    hotel_id: HOTEL, proposal_id: PROPOSAL, proposal_version: 1,
    action: 'accept', reason: 'Admin accepts the exact server-priced impact',
  };
}

function impacts(): any[] {
  return [{
    scope: 'single_room', room_key: 'upper', guest_count: 2, minimum_nights: 2,
    customer_before: 100, customer_after: 110, cypruseye_commission: 10,
    partner_net_before: 90, partner_net_after: 100, currency: 'EUR',
  }, {
    scope: 'bundle', requested_guest_count: 5, minimum_nights: 2,
    customer_before: 200, customer_after: 210, cypruseye_commission: 20,
    partner_net_before: 180, partner_net_after: 190, currency: 'EUR',
  }];
}

function plan(): any {
  const canonical = item({ before_tier_version: 3 });
  delete canonical.item_index;
  return {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_plan_v1',
    review_id: REVIEW, hotel_id: HOTEL, proposal_id: PROPOSAL, proposal_version: 1,
    initiator_type: 'partner', partner_id: PARTNER, assignment_id: ASSIGNMENT,
    actor_id: ADMIN, action: 'accept', admin_reason: request().reason,
    proposal_reason: 'Partner requested an Upper tier change',
    canonical_items: [canonical], commercial_impacts: impacts(),
    commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
    evolution_snapshot_token: HASH,
    reviewed_at: '2026-08-30T10:01:00.000000Z',
    expires_at: '2026-08-30T10:31:00.000000Z', plan_fingerprint: HASH,
  };
}

function preview(): any {
  return {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_preview_v1',
    hotel_id: HOTEL, proposal_id: PROPOSAL, action: 'accept', changed: true,
    proposal_fresh: true, commercial_impacts: impacts(),
    commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
    reviewed_plan: plan(),
  };
}

describe('7 Arches reviewed independent pricing Admin client', () => {
  test('strictly validates pending proposal, server commercial impacts and exact reviewed plan', () => {
    const Core = loadCore();
    expect(Core.validateSevenArchesReviewedPricingControl(control(), HOTEL).proposals[0].fresh).toBe(true);
    expect(Core.validateSevenArchesReviewedPricingPreview(preview(), request(), control()).reviewed_plan.review_id)
      .toBe(REVIEW);
    expect(Core.validateSevenArchesReviewedPricingApplyResult({
      contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_apply_v1',
      hotel_id: HOTEL, proposal_id: PROPOSAL, review_id: REVIEW, action: 'accept',
      status: 'accepted', changed: true, replayed: false,
      correlation_id: CORRELATION, idempotency_key: IDEMPOTENCY,
      receipt_sequence: 1, receipt_id: '99999999-9999-4999-8999-999999999999',
      receipt_hash: HASH,
      changed_items: [{
        room_key: 'upper', room_type_id: UPPER_ROOM, room_rate_id: UPPER_RATE,
        pricing_schedule_id: UPPER_SCHEDULE, schedule_tier_id: TIER,
        pricing_occupancy: 2, minimum_nights: 2, currency: 'EUR',
        before_price: 100, after_price: 110, before_version: 3, after_version: 4,
      }],
      commercial_impacts: impacts(),
      commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
      activity_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    }, plan(), CORRELATION, IDEMPOTENCY).receipt_sequence).toBe(1);
    expect(() => Core.validateSevenArchesReviewedPricingControl({
      ...control(), commission_policy: { ...control().commission_policy, amount: 11 },
    }, HOTEL)).toThrow('commission policy');
    const forged = preview();
    forged.commercial_impacts[0].partner_net_after = 101;
    forged.reviewed_plan.commercial_impacts[0].partner_net_after = 101;
    expect(() => Core.validateSevenArchesReviewedPricingPreview(forged, request(), control()))
      .toThrow('commercial impact');
    const commissionForged = preview();
    commissionForged.commercial_impacts[0].cypruseye_commission = 11;
    commissionForged.commercial_impacts[0].partner_net_before = 89;
    commissionForged.commercial_impacts[0].partner_net_after = 99;
    commissionForged.reviewed_plan.commercial_impacts[0] = {
      ...commissionForged.commercial_impacts[0],
    };
    expect(() => Core.validateSevenArchesReviewedPricingPreview(
      commissionForged, request(), control(),
    )).toThrow('commercial impact');
  });

  test('keeps proposal and Admin-initiated request envelopes mutually exclusive', () => {
    const Core = loadCore();
    expect(Core.validateSevenArchesReviewedPricingAdminRequest(request(), control()).proposal_id).toBe(PROPOSAL);
    const directItem = item(); delete directItem.item_index; delete directItem.room_key;
    const direct = {
      contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      hotel_id: HOTEL, action: 'accept', reason: 'Admin changes one exact Upper tier',
      items: [directItem],
    };
    expect(Core.validateSevenArchesReviewedPricingAdminRequest(direct, control()).items).toHaveLength(1);
    expect(() => Core.validateSevenArchesReviewedPricingAdminRequest({
      ...direct,
      items: [{ ...direct.items[0], schedule_tier_id: TIER.toUpperCase() }],
    }, control())).toThrow('item');
    expect(() => Core.validateSevenArchesReviewedPricingAdminRequest({ ...direct, commission: 10 }, control()))
      .toThrow('request is invalid');
    expect(() => Core.validateSevenArchesReviewedPricingAdminRequest({ ...request(), items: [] }, control()))
      .toThrow('request is invalid');
  });

  test('burns one cached reviewed plan before a stale Apply and does not retry', async () => {
    const calls: any[] = [];
    const context: any = { console, URL, TextEncoder, crypto: { randomUUID: () => CORRELATION } };
    context.globalThis = context; context.window = context;
    context.getSupabase = () => ({
      rpc: async (name: string, payload: any) => {
        calls.push({ name, payload });
        if (name === 'hotel_v2_admin_preview_seven_arches_reviewed_pricing') {
          return { data: preview(), error: null };
        }
        if (name === 'hotel_v2_admin_apply_seven_arches_reviewed_pricing') {
          return { data: null, error: { code: 'PT409', message: 'hotels_v2_seven_arches_reviewed_pricing_tier_stale' } };
        }
        return { data: null, error: new Error(`Unexpected RPC ${name}`) };
      },
    });
    for (const file of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
      vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), file), 'utf8'), context, { filename: file });
    }
    const Repository = context.HotelsV2WorkspaceRepository;
    const reviewed = await Repository.previewSevenArchesReviewedPricing(request(), control());
    await expect(Repository.applySevenArchesReviewedPricing(
      reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY,
    )).rejects.toMatchObject({ isStale: true });
    await expect(Repository.applySevenArchesReviewedPricing(
      reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY,
    )).rejects.toThrow('exact server-reviewed plan');
    expect(calls.filter((call) => call.name === 'hotel_v2_admin_apply_seven_arches_reviewed_pricing'))
      .toHaveLength(1);
  });

  test('wires dedicated Admin UI while retaining the generic protected lock', () => {
    const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
    const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
    const css = fs.readFileSync('admin/admin.css', 'utf8');
    expect(repository).toContain("sevenArchesReviewedPricing: 'hotel_v2_admin_get_seven_arches_reviewed_pricing'");
    expect(repository).toContain('reviewedSevenArchesReviewedPricingPlans.delete(fingerprint);');
    expect(ui).toContain('data-start-reviewed-pricing');
    expect(ui).toContain('data-reviewed-pricing-action="accept"');
    expect(ui).toContain('sevenArchesCommercialImpactsMarkup(preview.commercial_impacts)');
    expect(ui).toContain('if (!pricingHotelMutationLocked()) return true;');
    expect(ui).toContain('The generic ADMIN-C pricing editor remains read-only');
    expect(css).toContain('.hotel-reviewed-pricing-control');
  });
});
