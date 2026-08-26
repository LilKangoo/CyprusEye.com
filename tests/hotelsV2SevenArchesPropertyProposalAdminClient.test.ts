import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PROPOSAL = '11111111-1111-4111-8111-111111111111';
const ASSIGNMENT = '22222222-2222-4222-8222-222222222222';
const PARTNER = '33333333-3333-4333-8333-333333333333';
const REVIEW = '44444444-4444-4444-8444-444444444444';
const ACTIVITY = '55555555-5555-4555-8555-555555555555';
const ADMIN = '66666666-6666-4666-8666-666666666666';
const CORRELATION = '77777777-7777-4777-8777-777777777777';
const TOKEN = 'a'.repeat(64);
const UPDATED = '2026-08-26T10:00:00Z';

function loadCore(): any {
  const context: any = { console, URL, TextEncoder, crypto: { randomUUID: () => CORRELATION } };
  context.globalThis = context; context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js'), 'utf8'), context);
  return context.HotelsV2WorkspaceCore;
}

function proposal(): any {
  return {
    id: PROPOSAL, assignment_id: ASSIGNMENT, partner_id: PARTNER, hotel_id: HOTEL,
    status: 'pending_admin_review', version: 3, source_property_updated_at: UPDATED,
    content: {
      title_i18n: { en: '7 Arches reviewed proposal' }, description_i18n: {}, city: 'Paphos',
      address_line: '7 Arches Street', district: null, postal_code: null, country: 'Cyprus',
      latitude: 34.77, longitude: 32.42, google_maps_url: null, amenities: ['wifi'],
      check_in_from: '14:00:00', check_out_until: '11:00:00',
    },
    photos: {}, created_at: '2026-08-26T09:00:00Z', updated_at: UPDATED,
  };
}

function control(): any {
  return {
    contract_version: 'hotels_v2_seven_arches_property_proposals_admin_v1',
    hotel_id: HOTEL, property_updated_at: UPDATED, proposals: [proposal()], public_change: false,
  };
}

function request(action = 'accept'): any {
  return {
    contract_version: 'hotels_v2_seven_arches_property_proposal_review_request_v1',
    hotel_id: HOTEL, proposal_id: PROPOSAL, proposal_version: 3, action,
    reason: action === 'accept' ? 'Admin accepted reviewed proposal' : 'Admin rejected reviewed proposal',
  };
}

function expectedOriginal(): any {
  const row = proposal();
  return {
    status: row.status, version: row.version, source_property_updated_at: row.source_property_updated_at,
    content: row.content, photos: row.photos, updated_at: row.updated_at,
  };
}

function reviewedPlan(action = 'accept'): any {
  const row = proposal();
  const payload = { ...row.content, ...row.photos };
  return {
    contract_version: 'hotels_v2_seven_arches_property_proposal_admin_plan_v1',
    review_id: REVIEW, hotel_id: HOTEL, proposal_id: PROPOSAL, proposal_version: 3,
    action, reason: request(action).reason, expected_property_updated_at: UPDATED,
    reviewed_at: '2026-08-26T10:01:00Z', expires_at: '2026-08-26T10:31:00Z',
    expected_original: expectedOriginal(),
    property_plan: action === 'accept' ? {
      contract_version: 'hotels_v2_admin_b_property_control_v1', hotel_id: HOTEL,
      expected_property_updated_at: UPDATED, expected_operational_profile_version: 1,
      reviewed_at: '2026-08-26T10:01:00Z',
      expected_original: Object.fromEntries(Object.keys(payload).map((key) => [key, null])), payload,
    } : null,
    plan_fingerprint: TOKEN,
  };
}

function preview(action = 'accept'): any {
  const row = proposal();
  return {
    contract_version: 'hotels_v2_seven_arches_property_proposal_admin_preview_v1',
    hotel_id: HOTEL, changed: true, blocking_reasons: [],
    impact: {
      entity: 'property_proposal', action, id: PROPOSAL, changed: true,
      before: expectedOriginal(), after: action === 'accept' ? { ...row.content, ...row.photos } : { status: 'rejected' },
    },
    reviewed_plan: reviewedPlan(action),
  };
}

describe('7 Arches Partner property proposal Admin client', () => {
  test('strictly binds partial i18n proposal, exact Review and terminal activity', () => {
    const Core = loadCore();
    expect(Core.validatePartnerPropertyProposalsControl(control(), HOTEL).proposals[0].content.title_i18n)
      .toEqual({ en: '7 Arches reviewed proposal' });
    expect(Core.validatePartnerPropertyProposalPreview(preview(), request(), control()).reviewed_plan.review_id).toBe(REVIEW);

    const plan = reviewedPlan();
    const receipt = {
      contract_version: 'hotels_v2_seven_arches_property_proposal_admin_apply_v1', hotel_id: HOTEL,
      proposal_id: PROPOSAL, action: 'accept', status: 'accepted', correlation_id: CORRELATION, replayed: false,
      admin_b_result: {
        ok: true, contract_version: 'hotels_v2_admin_b_property_control_v1', hotel_id: HOTEL,
        changed: true, property_changed: true, operational_profile_changed: false,
        correlation_id: CORRELATION, workspace: {}, content_control: {}, activity: [{}],
      },
      terminal_activity: {
        id: ACTIVITY, hotel_id: HOTEL, entity_type: 'property', entity_id: HOTEL, action: 'update',
        before_state: { proposal_id: PROPOSAL, status: 'pending_admin_review', version: 3 },
        after_state: { proposal_id: PROPOSAL, status: 'accepted', version: 4, review_id: REVIEW, reason: request().reason },
        actor_type: 'admin', actor_id: ADMIN, source: 'hotels_v2_h3_2b_property_proposal_admin_review',
        correlation_id: CORRELATION, created_at: '2026-08-26T10:02:00Z',
      },
      control: { ...control(), proposals: [], property_updated_at: '2026-08-26T10:02:00Z' },
    };
    expect(Core.validatePartnerPropertyProposalApplyResult(receipt, plan, CORRELATION).status).toBe('accepted');
    expect(() => Core.validatePartnerPropertyProposalApplyResult({ ...receipt, terminal_activity: { ...receipt.terminal_activity, source: 'other' } }, plan, CORRELATION))
      .toThrow('terminal activity');
  });

  test('fails closed for stale property timestamp, uppercase IDs and payload smuggling', () => {
    const Core = loadCore();
    const stale = control(); stale.property_updated_at = '2026-08-26T10:00:01Z';
    expect(Core.validatePartnerPropertyProposalsControl(stale, HOTEL).proposals).toHaveLength(1);
    expect(() => Core.validatePartnerPropertyProposalReviewRequest(request(), stale)).toThrow('stale or missing');
    expect(Core.validatePartnerPropertyProposalReviewRequest(request('reject'), stale).action).toBe('reject');
    const uppercase = control(); uppercase.proposals[0].id = 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF';
    expect(() => Core.validatePartnerPropertyProposalsControl(uppercase, HOTEL)).toThrow('identity');
    const smuggled = control(); smuggled.proposals[0].content.payment_policy = { mode: 'replace' };
    expect(() => Core.validatePartnerPropertyProposalsControl(smuggled, HOTEL)).toThrow('exact safe Admin projection');
  });

  test('burns the reviewed cache before a stale Apply and never retries it', async () => {
    const calls: any[] = [];
    const context: any = { console, URL, TextEncoder, crypto: { randomUUID: () => CORRELATION } };
    context.globalThis = context; context.window = context;
    context.getSupabase = () => ({
      rpc: async (name: string, payload: any) => {
        calls.push({ name, payload });
        if (name === 'hotel_v2_admin_preview_partner_property_proposal_plan') return { data: preview(), error: null };
        if (name === 'hotel_v2_admin_apply_partner_property_proposal_plan') return { data: null, error: { code: 'PT409', message: 'hotels_v2_seven_arches_property_proposal_stale' } };
        return { data: null, error: new Error(`Unexpected RPC ${name}`) };
      },
    });
    for (const file of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
      vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), file), 'utf8'), context, { filename: file });
    }
    const Repository = context.HotelsV2WorkspaceRepository;
    const reviewed = await Repository.previewPartnerPropertyProposalPlan(request(), control());
    await expect(Repository.applyPartnerPropertyProposalPlan(reviewed.reviewed_plan, CORRELATION)).rejects.toMatchObject({ isStale: true });
    await expect(Repository.applyPartnerPropertyProposalPlan(reviewed.reviewed_plan, CORRELATION)).rejects.toThrow('exact server-reviewed plan');
    expect(calls.filter((call) => call.name === 'hotel_v2_admin_apply_partner_property_proposal_plan')).toHaveLength(1);
  });
});
