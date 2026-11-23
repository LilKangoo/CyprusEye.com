import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const PILOT = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PARTNER = '11111111-1111-4111-8111-111111111111';
const ASSIGNMENT = '33333333-3333-4333-8333-333333333333';
const CORRELATION = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY = '55555555-5555-4555-8555-555555555555';
const source = readFileSync('js/hotels-v2-partner-workspace-repository.js', 'utf8');

function setup(hotelId = PILOT, options = {}) {
  const calls = [];
  const workspace = {
    hotel_id: hotelId,
    partner: { id: PARTNER },
    assignment: {
      id: ASSIGNMENT, permission_version: 1, access_snapshot_token: 'access',
      capabilities: { manage_availability: options.allowAvailability !== false },
    },
  };
  const core = {
    PUBLISHED_ARCHITECTURE_TARGET: PILOT,
    requireCanonicalUuid: (value) => value,
    requireIsoDate: (value) => value,
    validateWorkspace: (value) => value,
    validateWorkspace114492: (value) => value,
    validateSevenArchesReviewedPricingDraft: (value) => value,
    validateSevenArchesReviewedPricingPreview: (value) => value,
    validateSevenArchesReviewedPricingControl: (value) => value,
    validateSevenArchesReviewedPricingSubmit: (value) => value,
    normalizeExternalCalendarControl: (value) => value,
    buildExternalCalendarDraft: (control, intent) =>
      ({ hotel_id: control.hotel_id, partner_id: control.partner_id, intent }),
    validateExternalCalendarPreview: (value) => value,
    validateExternalCalendarPartnerProposalSubmit: (value) => value,
  };
  const rpc = async (name, payload) => {
    calls.push({ name, payload });
    if (options.deny === name) {
      return { data: null, status: 403, error: { code: '42501', message: 'access denied' } };
    }
    if (options.notFound === name) {
      return { data: null, status: 404, error: { code: 'PGRST202', message: 'Could not find the function in the schema cache' } };
    }
    if (name.startsWith('hotel_v2_partner_get_workspace')) return { data: workspace, error: null };
    if (name.startsWith('hotel_v2_partner_get_seven_arches_reviewed_pricing'))
      return { data: { hotel_id: hotelId, contract_version: 'control' }, error: null };
    if (name.startsWith('hotel_v2_partner_get_external_calendar_control'))
      return { data: { hotel_id: hotelId, partner_id: PARTNER }, error: null };
    if (name.startsWith('hotel_v2_partner_preview_seven_arches_pricing_proposal'))
      return { data: { reviewed_plan: { hotel_id: hotelId, plan_fingerprint: 'price-plan' } }, error: null };
    if (name.startsWith('hotel_v2_partner_preview_external_calendar_plan'))
      return {
        data: { reviewed_plan: {
          hotel_id: hotelId, plan_fingerprint: 'calendar-plan',
          operations: [{ entity: 'source', action: 'create', payload: {} }],
        } }, error: null,
      };
    return { data: { status: 'pending_admin_review' }, error: null };
  };
  const context = {
    HotelsV2PartnerWorkspaceCore: core,
    window: { getSupabase: () => ({ rpc }) },
    TextEncoder,
    console,
  };
  vm.runInNewContext(source, context, {
    filename: 'js/hotels-v2-partner-workspace-repository.js',
  });
  const repository = context.HotelsV2PartnerWorkspaceRepository;
  return { calls, workspace, repository, core };
}
const lastRpc = (h) => h.calls.at(-1)?.name;
async function open(h) {
  await h.repository.getWorkspace(PARTNER, h.workspace.hotel_id, '2026-11-23', '2026-11-30');
}
test('A2 route stays 114493 for converted pilot; generic route for another hotel', async () => {
  const a = setup();
  await open(a);
  assert.equal(lastRpc(a), 'hotel_v2_partner_get_workspace_114493');
  const b = setup(OTHER);
  await open(b);
  assert.equal(lastRpc(b), 'hotel_v2_partner_get_workspace');
});
test('pricing control is 114493 for pilot, old path for other hotel', async () => {
  for (const [id, expected] of [
    [PILOT, 'hotel_v2_partner_get_seven_arches_reviewed_pricing_114493'],
    [OTHER, 'hotel_v2_partner_get_seven_arches_reviewed_pricing_114488'],
  ]) {
    const h = setup(id);
    await open(h);
    await h.repository.getSevenArchesPricingControl(PARTNER, id);
    assert.equal(lastRpc(h), expected);
  }
});
test('pricing preview and submission use 114493 and cached plan identity', async () => {
  const h = setup();
  await open(h);
  const preview = await h.repository.previewSevenArchesPricingProposal({ partner_id: PARTNER, hotel_id: PILOT });
  assert.equal(lastRpc(h), 'hotel_v2_partner_preview_seven_arches_pricing_proposal_114493');
  await h.repository.submitSevenArchesPricingProposal(preview.reviewed_plan, CORRELATION, IDEMPOTENCY);
  assert.equal(lastRpc(h), 'hotel_v2_partner_submit_seven_arches_pricing_proposal_114493');
  await assert.rejects(h.repository.submitSevenArchesPricingProposal(preview.reviewed_plan, CORRELATION, IDEMPOTENCY), /Review again/);
  assert.equal(h.calls.filter(x => x.name.includes('submit_seven_arches')).length, 1);
});
test('external calendar read is 114493 for pilot and generic for other hotel', async () => {
  for (const [id, expected] of [
    [PILOT, 'hotel_v2_partner_get_external_calendar_control_114493'],
    [OTHER, 'hotel_v2_partner_get_external_calendar_control'],
  ]) {
    const h = setup(id);
    await open(h);
    await h.repository.getExternalCalendarControl(PARTNER, id);
    assert.equal(lastRpc(h), expected);
  }
});
test('calendar preview and proposal submission use 114493 and exactly one write', async () => {
  const h = setup();
  await open(h);
  const control = await h.repository.getExternalCalendarControl(PARTNER, PILOT);
  const intent = { entity: 'source', action: 'create' };
  const draft = h.core.buildExternalCalendarDraft(control, intent);
  const preview = await h.repository.previewExternalCalendarPlan(draft, { ...control });
  assert.equal(lastRpc(h), 'hotel_v2_partner_preview_external_calendar_plan_114493');
  await h.repository.submitExternalCalendarProposal(preview.reviewed_plan, CORRELATION, IDEMPOTENCY);
  assert.equal(lastRpc(h), 'hotel_v2_partner_apply_external_calendar_plan_114493');
  await assert.rejects(h.repository.submitExternalCalendarProposal(preview.reviewed_plan, CORRELATION, IDEMPOTENCY), /Review again/);
  assert.equal(h.calls.filter(x => x.name.includes('apply_external_calendar')).length, 1);
});
test('wrong Hotel/assignment capability cannot trigger calendar control', async () => {
  const h = setup(PILOT, { allowAvailability: false });
  await open(h);
  await assert.rejects(h.repository.getExternalCalendarControl(PARTNER, PILOT), /manage_availability/);
  assert.equal(h.calls.length, 1);
});
test('successor denial does not trigger old RPC fallback', async () => {
  const denied = 'hotel_v2_partner_get_external_calendar_control_114493';
  const h = setup(PILOT, { deny: denied });
  await open(h);
  await assert.rejects(h.repository.getExternalCalendarControl(PARTNER, PILOT), /denied/);
  assert.equal(h.calls.length, 2);
  assert.equal(lastRpc(h), denied);
});
test('missing successor does not trigger old RPC fallback', async () => {
  const missing = 'hotel_v2_partner_get_seven_arches_reviewed_pricing_114493';
  const h = setup(PILOT, { notFound: missing });
  await open(h);
  await assert.rejects(h.repository.getSevenArchesPricingControl(PARTNER, PILOT), /PGRST202/);
  assert.equal(h.calls.length, 2);
  assert.equal(lastRpc(h), missing);
});
test('nonpilot legacy external calendar preview and proposal submit remain unchanged', async () => {
  const h = setup(OTHER);
  await open(h);
  const control = await h.repository.getExternalCalendarControl(PARTNER, OTHER);
  const draft = h.core.buildExternalCalendarDraft(control, { entity: 'source', action: 'create' });
  const preview = await h.repository.previewExternalCalendarPlan(draft, control);
  assert.equal(lastRpc(h), 'hotel_v2_partner_preview_external_calendar_plan');
  await h.repository.submitExternalCalendarProposal(preview.reviewed_plan, CORRELATION, IDEMPOTENCY);
  assert.equal(lastRpc(h), 'hotel_v2_partner_apply_external_calendar_plan');
});
