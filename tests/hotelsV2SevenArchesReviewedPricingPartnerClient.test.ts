import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'a'.repeat(64);

function loadCore(): any {
  const context: Record<string, any> = { console, TextEncoder };
  for (const relative of ['admin/hotels-v2-workspace-core.js', 'js/hotels-v2-partner-workspace-core.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return context.HotelsV2PartnerWorkspaceCore;
}

function loadRepository(client: any): any {
  const exactUuid = (value: string): string => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) throw new Error('invalid UUID');
    return value;
  };
  const core = {
    requireCanonicalUuid: exactUuid,
    requireIsoDate: (value: string) => value,
    validateWorkspace: (value: any) => value,
    validateSevenArchesReviewedPricingDraft: (value: any) => value,
    validateSevenArchesReviewedPricingPreview: (value: any) => value,
    validateSevenArchesReviewedPricingSubmit: (value: any) => value,
    validateSevenArchesReviewedPricingControl: (value: any) => value,
  };
  const context: Record<string, any> = { console, TextEncoder, HotelsV2PartnerWorkspaceCore: core, window: { getSupabase: () => client } };
  const filename = path.join(process.cwd(), 'js/hotels-v2-partner-workspace-repository.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.HotelsV2PartnerWorkspaceRepository;
}

function reviewedWorkspace(): any {
  const identities = {
    upper: {
      roomTypeId: 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      roomRateId: '7e420964-9cbf-4f1b-abd3-09840af5240f',
      scheduleId: 'aec20731-7a56-35f0-334e-92b363351f02',
    },
    ground: {
      roomTypeId: '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
      roomRateId: '3320590d-632d-423f-80d0-fd021cba7293',
      scheduleId: '9d109336-64f3-3c57-4684-968b59c94c3b',
    },
  };
  let serial = 1;
  const scheduleTiers: any[] = [];
  Object.values(identities).forEach((identity) => {
    [2, 3, 4].forEach((guestCount) => {
      for (let threshold = 2; threshold <= 10; threshold += 1) {
        scheduleTiers.push({
          id: `00000000-0000-0000-0000-${String(serial++).padStart(12, '0')}`,
          schedule_id: identity.scheduleId,
          guest_count: guestCount,
          threshold_nights: threshold,
          nightly_rate: 100 + guestCount + threshold,
          is_active: true,
          version: 1,
        });
      }
    });
  });
  return {
    partner: { id: PARTNER }, hotel_id: HOTEL,
    assignment: { id: ASSIGNMENT, permission_version: 7, access_snapshot_token: TOKEN, capabilities: { manage_prices: true } },
    rooms: Object.entries(identities).map(([key, identity]) => ({ id: identity.roomTypeId, code: key, name_i18n: { en: `${key} room` }, status: 'active' })),
    pricing: {
      snapshot_token: TOKEN,
      room_rates: Object.values(identities).map((identity) => ({ id: identity.roomRateId, room_type_id: identity.roomTypeId, pricing_schedule_id: identity.scheduleId, is_active: true })),
      schedules: Object.entries(identities).map(([key, identity]) => ({ id: identity.scheduleId, code: key, name_i18n: { en: `${key} schedule` }, sharing_mode: 'independent', is_active: true, currency: 'EUR' })),
      schedule_tiers: scheduleTiers,
    },
  };
}

describe('7 Arches reviewed Partner pricing client', () => {
  const Core = loadCore();

  test('recognizes the exact two independent Room matrices and builds only changed typed items', () => {
    const workspace = reviewedWorkspace();
    const targets = Core.sevenArchesReviewedPricingTargets(workspace);
    expect(targets.map((target: any) => [target.roomKey, target.tiers.length])).toEqual([['upper', 27], ['ground', 27]]);
    const tier = targets[0].tiers[0];
    const draft = Core.buildSevenArchesReviewedPricingDraft(workspace, [{ schedule_tier_id: tier.id, requested_price: tier.nightly_rate + 5 }], 'Partner reviewed price update');
    expect(draft).toEqual({
      contract_version: 'hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
      partner_id: PARTNER,
      hotel_id: HOTEL,
      access_snapshot_token: TOKEN,
      pricing_snapshot_token: TOKEN,
      items: [{
        hotel_id: HOTEL,
        room_type_id: targets[0].room.id,
        room_rate_id: targets[0].rate.id,
        pricing_schedule_id: targets[0].schedule.id,
        schedule_tier_id: tier.id,
        guest_count: tier.guest_count,
        minimum_nights: tier.threshold_nights,
        currency: 'EUR',
        before_price: tier.nightly_rate,
        requested_price: tier.nightly_rate + 5,
      }],
      reason: 'Partner reviewed price update',
    });
    expect(() => Core.buildSevenArchesReviewedPricingDraft(workspace, [{ schedule_tier_id: tier.id, requested_price: tier.nightly_rate }], 'Partner reviewed price update')).toThrow('real price change');
  });

  test('accepts scoped PostgreSQL UUIDs but rejects extra commercial input', () => {
    const workspace = reviewedWorkspace();
    const tier = Core.sevenArchesReviewedPricingTargets(workspace)[0].tiers[0];
    expect(Core.requirePostgresUuid('aec20731-7a56-35f0-334e-92b363351f02')).toBe('aec20731-7a56-35f0-334e-92b363351f02');
    expect(() => Core.requireCanonicalUuid('aec20731-7a56-35f0-334e-92b363351f02')).toThrow('canonical UUID');
    const draft = Core.buildSevenArchesReviewedPricingDraft(workspace, [{ schedule_tier_id: tier.id, requested_price: tier.nightly_rate + 1 }], 'Partner reviewed price update');
    expect(() => Core.validateSevenArchesReviewedPricingDraft({ ...draft, commission: 10 }, workspace)).toThrow('unexpected field envelope');
  });

  test('validates an exact 54-row Partner control and proposal lifecycle without actor data', () => {
    const workspace = reviewedWorkspace();
    const currentItems = Core.sevenArchesReviewedPricingTargets(workspace).flatMap((target: any) => target.tiers.map((tier: any) => ({
      room_key: target.roomKey,
      hotel_id: HOTEL,
      room_type_id: target.room.id,
      room_rate_id: target.rate.id,
      pricing_schedule_id: target.schedule.id,
      schedule_tier_id: tier.id,
      guest_count: tier.guest_count,
      minimum_nights: tier.threshold_nights,
      currency: 'EUR',
      current_price: tier.nightly_rate,
      tier_version: tier.version,
    })));
    const control = {
      contract_version: 'hotels_v2_seven_arches_reviewed_pricing_partner_control_v1',
      partner_id: PARTNER,
      hotel_id: HOTEL,
      assignment_id: ASSIGNMENT,
      assignment_version: 7,
      access_snapshot_token: TOKEN,
      pricing_snapshot_token: TOKEN,
      evolution_snapshot_token: TOKEN,
      commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
      current_items: currentItems,
      proposals: [{
        proposal_id: '77777777-7777-4777-8777-777777777777',
        status: 'pending_admin_review',
        reason: 'Partner reviewed price update',
        item_count: 1,
        created_at: '2026-08-30T10:00:00.000000Z',
        expires_at: '2026-08-30T10:30:00.000000Z',
        consumed_at: null,
      }],
    };
    expect(Core.validateSevenArchesReviewedPricingControl(control, workspace).current_items).toHaveLength(54);
    expect(() => Core.validateSevenArchesReviewedPricingControl({ ...control, proposals: [{ ...control.proposals[0], status: 'accepted' }] }, workspace)).toThrow('consumption state');
    expect(() => Core.validateSevenArchesReviewedPricingControl({ ...control, actor_id: PARTNER }, workspace)).toThrow('unexpected field envelope');
  });

  test('wires Preview and Submit to dedicated reviewed RPCs without using generic pricing Apply', () => {
    const repository = fs.readFileSync(path.join(process.cwd(), 'js/hotels-v2-partner-workspace-repository.js'), 'utf8');
    const ui = fs.readFileSync(path.join(process.cwd(), 'js/hotels-v2-partner-workspace.js'), 'utf8');
    expect(repository).toContain("previewSevenArchesPricingProposal: 'hotel_v2_partner_preview_seven_arches_pricing_proposal'");
    expect(repository).toContain("submitSevenArchesPricingProposal: 'hotel_v2_partner_submit_seven_arches_pricing_proposal'");
    expect(repository).toContain("sevenArchesPricingControl: 'hotel_v2_partner_get_seven_arches_reviewed_pricing'");
    expect(repository).toContain('Core.validateSevenArchesReviewedPricingPreview');
    expect(repository).toContain('Core.validateSevenArchesReviewedPricingSubmit');
    expect(ui).toContain('data-phw-seven-arches-pricing');
    expect(ui).toContain("await review('seven_arches_pricing', draft, opener)");
    expect(ui).toContain('Repository.submitSevenArchesPricingProposal');
    expect(ui).toContain('commissionReadOnly');
    expect(ui).toContain('proposalSubmitted');
  });

  test('uses one dedicated Preview and one Submit request, then burns the transient reviewed plan', async () => {
    const correlation = '44444444-4444-4444-8444-444444444444';
    const idempotency = '55555555-5555-4555-8555-555555555555';
    const proposal = '66666666-6666-4666-8666-666666666666';
    const plan = { partner_id: PARTNER, hotel_id: HOTEL, plan_fingerprint: TOKEN, items: [] };
    const preview = { changed: true, reviewed_plan: plan, commercial_impacts: [] };
    const calls: Array<{ name: string; payload: any }> = [];
    const repository = loadRepository({
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === 'hotel_v2_partner_get_workspace') return { data: { partner: { id: PARTNER }, hotel_id: HOTEL }, error: null };
        if (name === 'hotel_v2_partner_preview_seven_arches_pricing_proposal') return { data: preview, error: null };
        if (name === 'hotel_v2_partner_submit_seven_arches_pricing_proposal') {
          return { data: { proposal_id: proposal, status: 'pending_admin_review' }, error: null };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
    });
    await repository.getWorkspace(PARTNER, HOTEL, '2026-08-30', '2026-09-29');
    const reviewed = await repository.previewSevenArchesPricingProposal({ partner_id: PARTNER, hotel_id: HOTEL });
    await expect(repository.submitSevenArchesPricingProposal(reviewed.reviewed_plan, correlation, idempotency)).resolves.toEqual({ proposal_id: proposal, status: 'pending_admin_review' });
    await expect(repository.submitSevenArchesPricingProposal(reviewed.reviewed_plan, correlation, idempotency)).rejects.toThrow('Run Preview again');
    expect(calls.slice(1).map((call) => call.name)).toEqual([
      'hotel_v2_partner_preview_seven_arches_pricing_proposal',
      'hotel_v2_partner_submit_seven_arches_pricing_proposal',
    ]);
    expect(calls[2].payload).toEqual({ p_reviewed_plan: plan, p_correlation_id: correlation, p_idempotency_key: idempotency });
  });
});
