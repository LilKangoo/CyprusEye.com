import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT = '33333333-3333-4333-8333-333333333333';
const ADMIN = '44444444-4444-4444-8444-444444444444';
const PROPOSAL = '55555555-5555-4555-8555-555555555555';
const REVIEW = '66666666-6666-4666-8666-666666666666';
const BOOKING = '77777777-7777-4777-8777-777777777777';
const UPPER_ROOM = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const UPPER_SCHEDULE = 'aec20731-7a56-35f0-334e-92b363351f02';
const GROUND_ROOM = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const GROUND_SCHEDULE = '9d109336-64f3-3c57-4684-968b59c94c3b';
const HASH = 'a'.repeat(64);
const MD5 = 'b'.repeat(32);

type RoomKey = 'upper' | 'ground';

const identities = {
  upper: { roomTypeId: UPPER_ROOM, roomRateId: UPPER_RATE, scheduleId: UPPER_SCHEDULE },
  ground: { roomTypeId: GROUND_ROOM, roomRateId: GROUND_RATE, scheduleId: GROUND_SCHEDULE },
} as const;

function tierRows() {
  let sequence = 1;
  return (Object.entries(identities) as Array<[RoomKey, typeof identities.upper]>).flatMap(([roomKey, identity]) => (
    [2, 3, 4].flatMap((guestCount) => Array.from({ length: 9 }, (_unused, index) => {
      const minimumNights = index + 2;
      return {
        roomKey,
        identity,
        id: `10000000-0000-0000-0000-${String(sequence++).padStart(12, '0')}`,
        guest_count: guestCount,
        threshold_nights: minimumNights,
        nightly_rate: 100 + guestCount + minimumNights,
        is_active: true,
        version: 1,
      };
    }))
  ));
}

function schedules() {
  const tiers = tierRows();
  return (Object.entries(identities) as Array<[RoomKey, typeof identities.upper]>).map(([roomKey, identity]) => ({
    id: identity.scheduleId,
    hotel_id: HOTEL,
    code: `${roomKey}-independent`,
    name_i18n: { en: `${roomKey === 'upper' ? 'Upper' : 'Ground'} independent schedule` },
    application_scope: 'room_occupancy',
    currency: 'EUR',
    maximum_party_size: 4,
    minimum_billable_occupancy: 2,
    is_active: true,
    review_status: 'reviewed',
    lifecycle_status: 'active',
    source: 'manual',
    source_reference: {
      kind: 'manual', cloned_from_schedule_id: null, pricing_model: null,
      pricing_fingerprint: null, rule_count: null, guest_counts: null, migration_blocker: null,
    },
    sharing_mode: 'independent',
    linked_room_rate_ids: [identity.roomRateId],
    tiers: tiers.filter((tier) => tier.roomKey === roomKey).map(({ roomKey: _roomKey, identity: _identity, ...tier }) => ({
      ...tier,
      schedule_id: identity.scheduleId,
    })),
    tiers_fingerprint: MD5,
    link_fingerprint: MD5,
    immutable_contract: { locked: true },
    activation_blockers: [],
    version: 1,
    updated_at: '2026-08-30T10:00:00.000Z',
  }));
}

function currentItems() {
  return tierRows().map((tier) => ({
    room_key: tier.roomKey,
    hotel_id: HOTEL,
    room_type_id: tier.identity.roomTypeId,
    room_rate_id: tier.identity.roomRateId,
    pricing_schedule_id: tier.identity.scheduleId,
    schedule_tier_id: tier.id,
    guest_count: tier.guest_count,
    minimum_nights: tier.threshold_nights,
    currency: 'EUR',
    current_price: tier.nightly_rate,
    tier_version: tier.version,
  }));
}

function commercialImpacts(roomKey: RoomKey = 'upper') {
  return [{
    scope: 'single_room', room_key: roomKey, guest_count: 2, minimum_nights: 2,
    customer_before: 104, customer_after: 114, cypruseye_commission: 10,
    partner_net_before: 94, partner_net_after: 104, currency: 'EUR',
  }, {
    scope: 'bundle', requested_guest_count: 5, minimum_nights: 2,
    customer_before: 208, customer_after: 218, cypruseye_commission: 20,
    partner_net_before: 188, partner_net_after: 198, currency: 'EUR',
  }];
}

function partnerWorkspace() {
  const scheduleRows = schedules();
  const room = (roomKey: RoomKey) => ({
    id: identities[roomKey].roomTypeId,
    hotel_id: HOTEL,
    code: roomKey,
    name_i18n: { en: `${roomKey === 'upper' ? 'Upper' : 'Ground'} Floor Apartment` },
    description_i18n: { en: 'Exact apartment' },
    gallery: [], capacity_adults: null, capacity_children: null, max_occupancy: 4,
    bed_configuration: [], bathrooms: 1, size_sqm: 40, amenities: [],
    inventory_mode: 'pooled', base_inventory_count: 1, status: 'active', sort_order: 10,
    floor_label_i18n: {}, version: 1, updated_at: '2026-08-30T10:00:00.000Z',
  });
  return {
    contract_version: 'hotels_v2_h3_2b_partner_workspace_v1',
    partner: { id: PARTNER, role: 'partner' },
    hotel_id: HOTEL,
    assignment: {
      id: ASSIGNMENT, permission_version: 7, access_snapshot_token: HASH,
      capabilities: {
        edit_property_content: false, edit_property_photos: false, edit_room_content: false,
        edit_room_photos: false, create_rooms: false, edit_room_structure: false,
        manage_prices: true, manage_availability: false, process_bookings: false,
        request_booking_changes: false, view_payment_status: false, initiate_stripe_onboarding: false,
      },
    },
    feature_flags: {
      hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false,
    },
    content_snapshot_token: HASH,
    property: {
      id: HOTEL, slug: 'seven-arches-hotel', title_i18n: { en: '7 Arches Hotel' },
      description_i18n: { en: 'Two exact apartments' }, city: 'Paphos', address_line: '',
      district: '', postal_code: '', country: 'Cyprus', latitude: null, longitude: null,
      google_maps_url: null, amenities: [], check_in_from: '14:00:00', check_out_until: '11:00:00',
      cover_image_url: null, photos: [], architecture_version: 'legacy', status: 'active',
      is_published: true, updated_at: '2026-08-30T10:00:00.000Z',
    },
    property_draft: { exists: false, id: null, status: null, version: 0, content: {}, photos: {} },
    rooms: [room('upper'), room('ground')],
    units: [],
    pricing: {
      snapshot_token: HASH,
      currency: 'EUR',
      rate_plans: [],
      room_rates: (Object.entries(identities) as Array<[RoomKey, typeof identities.upper]>).map(([_roomKey, identity]) => ({
        id: identity.roomRateId, hotel_id: HOTEL, room_type_id: identity.roomTypeId,
        pricing_schedule_id: identity.scheduleId, is_active: true, currency: 'EUR',
        base_nightly_rate_authoritative: false,
      })),
      schedules: scheduleRows,
      schedule_tiers: scheduleRows.flatMap((schedule) => schedule.tiers),
      room_rate_tiers: [], exact_date_prices: [], allocation_rules: [],
      commission_policy: {
        id: '88888888-8888-4888-8888-888888888888', code: 'CE10',
        commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR',
      },
      mutation_blocked_reasons: [],
    },
    availability: null,
    sections: {
      overview: { visible: true, available: true, status: 'available' },
      property_content: { visible: false, available: false, status: 'unavailable' },
      property_photos: { visible: false, available: false, status: 'unavailable' },
      rooms: { visible: false, available: false, status: 'unavailable' },
      rates_pricing: { visible: true, available: true, status: 'available' },
      calendar_availability: { visible: false, available: false, status: 'unavailable' },
      bookings: { visible: false, available: false, status: 'unavailable' },
      payments: { visible: false, available: false, status: 'unavailable' },
    },
    recent_activity: [], legacy_authoritative: true, public_change: false,
  };
}

async function installPartnerHarness(page: Page) {
  const workspace = partnerWorkspace();
  const control = {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_partner_control_v1',
    partner_id: PARTNER, hotel_id: HOTEL, assignment_id: ASSIGNMENT, assignment_version: 7,
    access_snapshot_token: HASH, pricing_snapshot_token: HASH, evolution_snapshot_token: HASH,
    commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
    current_items: currentItems(), proposals: [],
  };
  await page.setContent(`<!doctype html><html lang="en"><body>
    <main id="partnerPortalView"></main>
    <section id="partnerHotelWorkspaceView" hidden></section>
    <dialog id="partnerHotelWorkspaceReview"></dialog>
  </body></html>`);
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js') });
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-partner-workspace-core.js') });
  await page.evaluate(({ workspaceValue, controlValue, proposalId }) => {
    const root = window as any;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    let uuidSequence = 1;
    Object.defineProperty(root.crypto, 'randomUUID', {
      configurable: true,
      value: () => `dddddddd-dddd-4ddd-8ddd-${String(uuidSequence++).padStart(12, '0')}`,
    });
    const store: any = { calls: [], control: clone(controlValue), genericCalls: 0 };
    root.__reviewedPartner = store;
    root.HotelsV2PartnerMedia = {};
    root.HotelsV2PartnerWorkspaceRepository = {
      getWorkspace: async (...args: any[]) => { store.calls.push({ name: 'get', args: clone(args) }); return clone(workspaceValue); },
      getSevenArchesPricingControl: async (...args: any[]) => {
        store.calls.push({ name: 'control', args: clone(args) });
        return clone(store.control);
      },
      previewSevenArchesPricingProposal: async (draft: any) => {
        store.calls.push({ name: 'preview', draft: clone(draft) });
        const changed = draft.items[0];
        return {
          changed: true,
          commercial_impacts: [{
            scope: 'single_room', room_key: 'upper', guest_count: changed.guest_count,
            minimum_nights: changed.minimum_nights, customer_before: changed.before_price,
            customer_after: changed.requested_price, cypruseye_commission: 10,
            partner_net_before: changed.before_price - 10,
            partner_net_after: changed.requested_price - 10, currency: 'EUR',
          }],
          reviewed_plan: {
            contract_version: 'hotels_v2_seven_arches_reviewed_pricing_partner_plan_v1',
            partner_id: draft.partner_id, hotel_id: draft.hotel_id, items: clone(draft.items),
            reason: draft.reason, plan_fingerprint: 'a'.repeat(64),
            commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
          },
        };
      },
      submitSevenArchesPricingProposal: async (plan: any, correlationId: string, idempotencyKey: string) => {
        store.calls.push({ name: 'submit', plan: clone(plan), correlationId, idempotencyKey });
        const result = { proposal_id: proposalId, status: 'pending_admin_review' };
        store.control.proposals = [{ ...result, reason: plan.reason, item_count: plan.items.length,
          created_at: '2099-09-01T10:00:00.000000Z', expires_at: '2099-09-01T10:30:00.000000Z', consumed_at: null }];
        return clone(result);
      },
      previewPricingPlan: async () => { store.genericCalls += 1; throw new Error('generic pricing must remain locked'); },
      applyPricingPlan: async () => { store.genericCalls += 1; throw new Error('generic pricing must remain locked'); },
      clearReviewedPlans: () => {},
    };
  }, { workspaceValue: workspace, controlValue: control, proposalId: PROPOSAL });
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-partner-workspace.js') });
  await page.evaluate(async ({ partnerId, assignmentId, hotelId }) => {
    await (window as any).HotelsV2PartnerWorkspace.open({
      partnerId,
      assignment: { assignment_id: assignmentId, hotel_id: hotelId },
    });
  }, { partnerId: PARTNER, assignmentId: ASSIGNMENT, hotelId: HOTEL });
}

function adminPricingControl() {
  return {
    contract_version: 'hotels_v2_admin_c_pricing_control_v1', hotel_id: HOTEL,
    property: {
      id: HOTEL, updated_at: '2026-08-30T10:00:00.000Z', architecture_version: 'legacy',
      currency: 'EUR', minimum_stay_nights: 2, maximum_stay_nights: 30,
      children_policy: 'allowed', minimum_child_age: null, booking_mode: 'request_confirmation',
    },
    feature_flags: {
      hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false,
    },
    legacy_safety: {
      architecture_version: 'legacy', legacy_pricing_authoritative: false,
      legacy_pricing_rule_count: 63, legacy_pricing_fingerprint: MD5, public_change: false,
    },
    snapshot_token: HASH, rate_plans: [], room_types: [], room_rates: [],
    pricing_schedules: schedules(), rate_rules: [], exact_date_prices: [], allocation_rules: [],
    property_pricing_default: null, recent_activity: [],
  };
}

function reviewedAdminControl() {
  const first = currentItems()[0];
  return {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_control_v1', hotel_id: HOTEL,
    proposals: [{
      id: PROPOSAL, initiator_type: 'partner', partner_id: PARTNER, assignment_id: ASSIGNMENT,
      status: 'pending_admin_review', version: 1, reason: 'Partner requests one Upper tier change',
      item_count: 1, created_at: '2026-08-30T10:00:00.000000Z',
      expires_at: '2099-09-01T10:30:00.000000Z', fresh: true,
      items: [{
        item_index: 1, room_key: first.room_key, hotel_id: HOTEL,
        room_type_id: first.room_type_id, room_rate_id: first.room_rate_id,
        pricing_schedule_id: first.pricing_schedule_id, schedule_tier_id: first.schedule_tier_id,
        guest_count: first.guest_count, minimum_nights: first.minimum_nights,
        currency: 'EUR', before_price: first.current_price, requested_price: first.current_price + 10,
      }],
    }],
    commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
    current_state: {
      contract_version: 'hotels_v2_seven_arches_reviewed_pricing_state_v1',
      normalized_fingerprint: HASH, authority_fingerprint: HASH, legacy_fingerprint: HASH,
      oracle: {
        contract_version: 'hotels_v2_seven_arches_reviewed_pricing_oracle_v1',
        core_case_count: 100, core_mismatch_count: 0, guest_one_case_count: 20,
        guest_one_mismatch_count: 0, total_case_count: 120, fingerprint: MD5,
      },
      commission_fingerprint: HASH, payment_fingerprint: HASH, unrelated_fingerprint: HASH,
      room_fingerprints: { ground: HASH, upper: HASH }, last_receipt_hash: HASH,
      receipt_count: 1, snapshot_token: HASH,
    },
  };
}

async function installAdminHarness(page: Page) {
  const pricingControl = adminPricingControl();
  const reviewedControl = reviewedAdminControl();
  const workspace = {
    property: {
      id: HOTEL, slug: 'seven-arches-hotel', architecture_version: 'legacy',
      title: { en: '7 Arches Hotel' }, title_i18n: { en: '7 Arches Hotel' },
      description: { en: 'Two apartments' }, city: 'Paphos', timezone: 'Europe/Nicosia',
      currency: 'EUR', booking_mode: 'request_confirmation', children_policy: 'allowed',
      pricing_tiers: { rules: [] }, room_types: [], photos: [], amenities: [],
      status: 'active', is_published: true, updated_at: '2026-08-30T10:00:00.000Z',
    },
    room_types: [], units: [], rate_plans: [], room_rates: [], pricing_schedules: [],
    pricing_schedule_tiers: [], amenities_catalog: [], partners: [], operational_partners: [],
    payment_due: {}, counts: { upcoming_bookings: 0, daily_inventory_by_room: {} },
    flags: {
      hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false,
    },
    activity: [], readiness: {},
  };
  await page.setContent(`<!doctype html><html lang="en"><body>
    <section id="hotelPropertyDirectory"></section>
    <section id="hotelPropertyWorkspace" hidden></section>
    <div id="hotelPropertyList"></div>
  </body></html>`);
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js') });
  await page.evaluate(({ workspaceValue, pricingValue, reviewedValue, adminId, reviewId, hash }) => {
    const root = window as any;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    let uuidSequence = 1;
    Object.defineProperty(root.crypto, 'randomUUID', {
      configurable: true,
      value: () => `eeeeeeee-eeee-4eee-8eee-${String(uuidSequence++).padStart(12, '0')}`,
    });
    const store: any = {
      previews: [], applies: [], genericCalls: 0, toasts: [],
      pricing: clone(pricingValue), reviewed: clone(reviewedValue),
    };
    root.__reviewedAdmin = store;
    root.showToast = (message: string, type: string) => store.toasts.push({ message, type });
    root.CE_HOTEL_PRICING = { normalizeHotelRoomTypes: () => [], getHotelMinPricePerNight: () => null };
    const previewFor = (request: any) => {
      const proposal = store.reviewed.proposals.find((entry: any) => entry.id === request.proposal_id);
      const sourceItems = proposal ? proposal.items.map(({ item_index: _index, room_key: _roomKey, ...item }: any) => item) : request.items;
      const roomKeyFor = (item: any) => item.room_type_id === 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94' ? 'upper' : 'ground';
      const canonicalItems = sourceItems.map((item: any) => ({
        ...clone(item), room_key: roomKeyFor(item), before_tier_version: 1,
      }));
      const impacts = sourceItems.map((item: any) => ({
        scope: 'single_room', room_key: roomKeyFor(item), guest_count: item.guest_count,
        minimum_nights: item.minimum_nights, customer_before: item.before_price,
        customer_after: item.requested_price, cypruseye_commission: 10,
        partner_net_before: item.before_price - 10, partner_net_after: item.requested_price - 10,
        currency: 'EUR',
      }));
      return {
        contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_preview_v1',
        hotel_id: request.hotel_id, proposal_id: request.proposal_id || null,
        action: request.action, changed: request.action === 'accept', proposal_fresh: true,
        commercial_impacts: impacts,
        commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
        reviewed_plan: {
          contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_plan_v1',
          review_id: reviewId, hotel_id: request.hotel_id, proposal_id: request.proposal_id || null,
          proposal_version: request.proposal_version || null,
          initiator_type: proposal ? 'partner' : 'admin', partner_id: proposal?.partner_id || null,
          assignment_id: proposal?.assignment_id || null, actor_id: adminId,
          action: request.action, admin_reason: request.reason,
          proposal_reason: proposal?.reason || request.reason, canonical_items: canonicalItems,
          commercial_impacts: impacts,
          commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
          evolution_snapshot_token: hash, reviewed_at: '2026-08-30T10:01:00.000000Z',
          expires_at: '2099-09-01T10:31:00.000000Z', plan_fingerprint: hash,
        },
      };
    };
    root.HotelsV2WorkspaceRepository = {
      listProperties: async () => [],
      getWorkspace: async () => clone(workspaceValue),
      getH3Configuration: async () => { throw new Error('not needed by focused pricing harness'); },
      getContentControl: async () => { throw new Error('not needed by focused pricing harness'); },
      getPartnerPropertyProposals: async () => [],
      getSevenArchesPricingActivation: async () => { throw new Error('not needed by focused pricing harness'); },
      getPartnerHotelPermissions: async () => ({}),
      getPricingControl: async () => clone(store.pricing),
      getSevenArchesReviewedPricing: async () => clone(store.reviewed),
      previewSevenArchesReviewedPricing: async (request: any) => {
        store.previews.push(clone(request));
        return previewFor(request);
      },
      applySevenArchesReviewedPricing: async (plan: any, correlationId: string, idempotencyKey: string) => {
        store.applies.push({ plan: clone(plan), correlationId, idempotencyKey });
        store.reviewed.proposals = store.reviewed.proposals.filter((entry: any) => entry.id !== plan.proposal_id);
        const accepted = plan.action === 'accept';
        return {
          contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_apply_v1',
          hotel_id: plan.hotel_id, proposal_id: plan.proposal_id, review_id: plan.review_id,
          action: plan.action, status: accepted ? 'accepted' : 'rejected', changed: accepted, replayed: false,
          correlation_id: correlationId, idempotency_key: idempotencyKey,
          receipt_sequence: accepted ? store.applies.length + 1 : null,
          receipt_id: accepted ? '99999999-9999-4999-8999-999999999999' : null,
          receipt_hash: accepted ? hash : null,
          changed_items: [], commercial_impacts: clone(plan.commercial_impacts),
          commission_policy: clone(plan.commission_policy), activity_ids: [],
          control: clone(store.reviewed), pricing_control: clone(store.pricing),
        };
      },
      applyPricingControlPlan: async () => { store.genericCalls += 1; throw new Error('generic pricing must remain locked'); },
    };
  }, { workspaceValue: workspace, pricingValue: pricingControl, reviewedValue: reviewedControl, adminId: ADMIN, reviewId: REVIEW, hash: HASH });
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace.js') });
  await page.evaluate(async (hotelId) => {
    await (window as any).HotelsV2Workspace.openWorkspace(hotelId, { tab: 'pricing' });
  }, HOTEL);
}

test.describe('7 Arches reviewed pricing UI integration', () => {
  test('Partner changes one Upper tier through dedicated Preview and Submit only', async ({ page }) => {
    await installPartnerHarness(page);
    await page.locator('[data-phw-section="rates_pricing"]').click();
    const upper = page.locator('[data-phw-reviewed-room="upper"] [data-phw-reviewed-tier]').first();
    const ground = page.locator('[data-phw-reviewed-room="ground"] [data-phw-reviewed-tier]').first();
    const upperBefore = Number(await upper.getAttribute('data-before-price'));
    const groundBefore = await ground.inputValue();
    await upper.fill(String(upperBefore + 10));
    await page.locator('[data-phw-seven-arches-pricing] [name="reason"]').fill('Partner requests one Upper tier change');
    await page.locator('[data-phw-seven-arches-pricing]').evaluate((form: HTMLFormElement) => form.requestSubmit());

    const review = page.locator('#partnerHotelWorkspaceReview');
    await expect(review).toBeVisible();
    await expect(review).toContainText('CyprusEye');
    await expect(review).toContainText('10.00');
    await page.locator('[data-phw-review-save]').click();
    await expect(page.locator('[data-phw-reviewed-pricing-status]')).toContainText('pending admin review', { ignoreCase: true });
    expect(await ground.inputValue()).toBe(groundBefore);

    const calls = await page.evaluate(() => (window as any).__reviewedPartner);
    const preview = calls.calls.find((entry: any) => entry.name === 'preview');
    expect(preview.draft.items).toHaveLength(1);
    expect(preview.draft.items[0]).toMatchObject({
      room_type_id: UPPER_ROOM, room_rate_id: UPPER_RATE,
      pricing_schedule_id: UPPER_SCHEDULE, requested_price: upperBefore + 10,
    });
    expect(calls.calls.filter((entry: any) => entry.name === 'submit')).toHaveLength(1);
    expect(calls.genericCalls).toBe(0);
  });

  test('Admin reviews a Partner proposal and an explicit two-Room plan through the same planner', async ({ page }) => {
    await installAdminHarness(page);
    const panel = page.locator('.hotel-reviewed-pricing-control');
    await expect(panel).toContainText('Pending proposals');
    await expect(panel).toContainText('€10.00');
    await expect(page.getByText('The generic ADMIN-C pricing editor remains read-only', { exact: true })).toBeVisible();

    await page.locator('[data-reviewed-pricing-action="accept"]').click();
    await page.locator('#sevenArchesReviewedPricingReasonForm [name="reason"]').fill('Admin accepts exact server impact');
    await page.locator('#sevenArchesReviewedPricingReasonForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('.hotel-reviewed-pricing-impact')).toContainText('Partner net');
    await expect(page.locator('.hotel-reviewed-pricing-impact')).toContainText('€10.00');
    await page.locator('[data-apply-reviewed-pricing]').click();
    await expect(page.locator('.hotel-reviewed-pricing-control')).toContainText('No Partner or Admin pricing proposal');

    await page.locator('[data-start-reviewed-pricing]').click();
    const upperRow = page.locator('[data-reviewed-pricing-tier][data-room-key="upper"]').first();
    const groundRow = page.locator('[data-reviewed-pricing-tier][data-room-key="ground"]').first();
    await upperRow.locator('[data-reviewed-pricing-select]').check();
    await groundRow.locator('[data-reviewed-pricing-select]').check();
    const upperCurrent = Number(await upperRow.getAttribute('data-before-price'));
    const groundCurrent = Number(await groundRow.getAttribute('data-before-price'));
    await upperRow.locator('[data-reviewed-pricing-price]').fill(String(upperCurrent + 5));
    await groundRow.locator('[data-reviewed-pricing-price]').fill(String(groundCurrent + 7));
    await page.locator('#sevenArchesReviewedPricingAdminForm [name="reason"]').fill('Admin changes one exact tier in both Rooms');
    await page.locator('#sevenArchesReviewedPricingAdminForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('.hotel-reviewed-pricing-impact')).toContainText('Upper Room');
    await expect(page.locator('.hotel-reviewed-pricing-impact')).toContainText('Ground Room');
    await page.locator('[data-apply-reviewed-pricing]').click();

    const store = await page.evaluate(() => (window as any).__reviewedAdmin);
    expect(store.previews).toHaveLength(2);
    expect(store.previews[0]).toMatchObject({ proposal_id: PROPOSAL, action: 'accept' });
    expect(store.previews[1].proposal_id).toBeUndefined();
    expect(store.previews[1].items).toHaveLength(2);
    expect(store.previews[1].items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        room_type_id: UPPER_ROOM, room_rate_id: UPPER_RATE,
        pricing_schedule_id: UPPER_SCHEDULE, requested_price: upperCurrent + 5,
      }),
      expect.objectContaining({
        room_type_id: GROUND_ROOM, room_rate_id: GROUND_RATE,
        pricing_schedule_id: GROUND_SCHEDULE, requested_price: groundCurrent + 7,
      }),
    ]));
    expect(store.applies).toHaveLength(2);
    expect(store.genericCalls).toBe(0);
  });

  test('Admin rejects a Partner proposal without pricing or receipt mutation', async ({ page }) => {
    await installAdminHarness(page);
    await page.locator('[data-reviewed-pricing-action="reject"]').click();
    await page.locator('#sevenArchesReviewedPricingReasonForm [name="reason"]')
      .fill('Admin rejects this exact Partner proposal');
    await page.locator('#sevenArchesReviewedPricingReasonForm')
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('.hotel-workspace-modal')).toContainText('Rejection is terminal');
    await page.locator('[data-apply-reviewed-pricing]').click();
    await expect(page.locator('.hotel-reviewed-pricing-control'))
      .toContainText('No Partner or Admin pricing proposal');

    const store = await page.evaluate(() => (window as any).__reviewedAdmin);
    expect(store.previews).toHaveLength(1);
    expect(store.previews[0]).toMatchObject({ proposal_id: PROPOSAL, action: 'reject' });
    expect(store.applies).toHaveLength(1);
    expect(store.applies[0].plan).toMatchObject({ proposal_id: PROPOSAL, action: 'reject' });
    expect(store.genericCalls).toBe(0);
    expect(store.toasts.some((entry: any) => /rejected/i.test(entry.message))).toBe(true);
  });

  test('public Hotel form selects an exact Room, switches to bundle capacity, and coalesces booking submit', async ({ page }) => {
    const hotel = {
      id: HOTEL, slug: 'seven-arches-hotel', title: { en: '7 Arches Hotel' },
      description: { en: 'Two exact independent apartments' }, city: 'Paphos',
      cover_image_url: '/assets/cyprus_logo-128.png', photos: [], pricing_model: 'per_person_per_night',
      pricing_tiers: { rules: [{ persons: 2, price_per_night: 100, min_nights: 2 }] },
      max_persons: 8, is_published: true, sort_order: 1,
      created_at: '2026-08-30T10:00:00.000Z', updated_at: '2026-08-30T10:00:00.000Z',
      room_types: [{
        id: UPPER_ROOM, name: { en: 'Upper Floor Apartment' }, max_persons: 4, is_default: true,
        pricing_model: 'per_person_per_night', pricing_tiers: { rules: [{ persons: 2, price_per_night: 100, min_nights: 2 }] },
        rate_plans: [{ id: UPPER_RATE, name: { en: 'Upper reviewed rate' }, is_default: true }],
      }, {
        id: GROUND_ROOM, name: { en: 'Ground Floor Apartment' }, max_persons: 4,
        pricing_model: 'per_person_per_night', pricing_tiers: { rules: [{ persons: 2, price_per_night: 100, min_nights: 2 }] },
        rate_plans: [{ id: GROUND_RATE, name: { en: 'Ground reviewed rate' }, is_default: true }],
      }],
    };
    await page.addInitScript((seed) => {
      window.localStorage.removeItem('ce_cache_home_hotels_v1');
      (window as any).__supabaseStub = {
        ...(window as any).__supabaseStub,
        onReady: (stub: any) => {
          stub.clearPersistence?.();
          stub.reset?.();
          stub.seedTable('hotels', [seed.hotel]);
          stub.seedTable('hotel_amenities', []);
          stub.seedTable('hotel_bookings', []);
          let bookingCalls = 0;
          const allocation = (request: any, roomKey: 'upper' | 'ground') => {
            const upper = roomKey === 'upper';
            const nights = Math.round((Date.parse(`${request.departure_date}T00:00:00Z`) - Date.parse(`${request.arrival_date}T00:00:00Z`)) / 86400000);
            const pricingGuests = request.guest_count === 1 ? 2 : request.guest_count <= 4
              ? request.guest_count : request.guest_count === 5 ? 2 : request.guest_count === 6 ? 3 : 4;
            return {
              room_key: roomKey,
              room_type_id: upper ? seed.upperRoom : seed.groundRoom,
              room_rate_id: upper ? seed.upperRate : seed.groundRate,
              pricing_schedule_id: upper ? seed.upperSchedule : seed.groundSchedule,
              schedule_tier_id: upper ? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              pricing_guest_count: pricingGuests, minimum_nights: Math.min(nights, 10), tier_version: 1,
              nightly_price: 100, nights, stay_total: 100 * nights, currency: 'EUR',
            };
          };
          stub.setRpcHandler('hotel_v2_public_quote_seven_arches', async ({ p_request: request }: any) => {
            const nights = Math.round((Date.parse(`${request.departure_date}T00:00:00Z`) - Date.parse(`${request.arrival_date}T00:00:00Z`)) / 86400000);
            const rooms = request.guest_count <= 4
              ? [allocation(request, request.room_type_id === seed.upperRoom ? 'upper' : 'ground')]
              : [allocation(request, 'upper'), allocation(request, 'ground')];
            const roomTotal = rooms.length * nights * 100;
            return { data: {
              contract_version: 'hotels_v2_seven_arches_public_quote_v1', hotel_id: seed.hotel.id,
              room_required: request.guest_count <= 4, room_type_id: request.room_type_id,
              room_rate_id: request.room_rate_id, arrival_date: request.arrival_date,
              departure_date: request.departure_date, nights, guest_count: request.guest_count,
              currency: 'EUR', allocation: rooms, selected_extras: [], extras_total: 0,
              room_total: roomTotal, customer_total: roomTotal, authority_token: seed.hash,
              quote_fingerprint: seed.hash, quoted_at: '2099-09-01T10:00:00.000000Z',
              expires_at: '2099-09-01T10:15:00.000000Z',
            }, error: null };
          });
          stub.setRpcHandler('hotel_v2_public_create_seven_arches_booking', async ({ p_request: request }: any) => {
            bookingCalls += 1;
            await new Promise((resolve) => setTimeout(resolve, 80));
            return { data: {
              contract_version: 'hotels_v2_seven_arches_public_booking_result_v1',
              booking_id: seed.booking, status: 'pending', currency: 'EUR',
              room_total: request.quote.room_total, extras_total: request.quote.extras_total,
              coupon_discount: 0, customer_total: request.quote.customer_total,
              quote_fingerprint: request.quote.quote_fingerprint,
              created_at: '2099-09-01T10:01:00.000000Z', replayed: bookingCalls > 1,
            }, error: null };
          });
        },
      };
    }, {
      hotel, upperRoom: UPPER_ROOM, upperRate: UPPER_RATE, upperSchedule: UPPER_SCHEDULE,
      groundRoom: GROUND_ROOM, groundRate: GROUND_RATE, groundSchedule: GROUND_SCHEDULE,
      booking: BOOKING, hash: HASH,
    });
    await enableSupabaseStub(page);
    await page.goto('/hotel.html?slug=seven-arches-hotel&lang=en');
    await waitForSupabaseStub(page);
    await expect(page.locator('#viewHotel')).toBeVisible({ timeout: 15_000 });

    await page.locator('#arrival').fill('2099-09-10');
    await page.locator('#departure').fill('2099-09-13');
    const roomSelect = page.locator('[name="hotel_room_type_id"]');
    await expect(roomSelect).toBeVisible();
    await roomSelect.selectOption(UPPER_ROOM);
    await expect(page.locator('#priceLive')).toContainText('300.00', { timeout: 10_000 });

    await page.locator('#adults').fill('5');
    await expect(roomSelect).toBeDisabled();
    await expect(page.locator('[data-seven-arches-room-mode]')).toContainText('Upper + Ground');
    await expect(page.locator('#priceLive')).toContainText('600.00', { timeout: 10_000 });
    await page.locator('#adults').fill('8');
    await expect(page.locator('#children')).toHaveAttribute('max', '0');
    await page.waitForFunction(() => (window as any).__supabaseStub.getRpcCalls()
      .some((call: any) => call.name === 'hotel_v2_public_quote_seven_arches' && call.params.p_request.guest_count === 8));

    await page.locator('#adults').fill('2');
    await expect(roomSelect).toBeEnabled();
    await roomSelect.selectOption(UPPER_ROOM);
    await page.locator('#hotelBookingName').fill('Ada Lovelace');
    await page.locator('#hotelBookingEmail').fill('ada@example.com');
    await expect(page.locator('#priceLive')).toContainText('300.00', { timeout: 10_000 });
    await page.locator('#bookForm').evaluate((form) => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#bookMsg')).toContainText('Booking received', { timeout: 15_000 });

    const evidence = await page.evaluate(() => ({
      calls: (window as any).__supabaseStub.getRpcCalls(),
      bookings: (window as any).__supabaseStub.getTableRows('hotel_bookings'),
    }));
    const bookingCalls = evidence.calls.filter((call: any) => call.name === 'hotel_v2_public_create_seven_arches_booking');
    expect(bookingCalls).toHaveLength(1);
    expect(bookingCalls[0].params.p_request.quote).toMatchObject({
      room_type_id: UPPER_ROOM, room_rate_id: UPPER_RATE, customer_total: 300,
    });
    expect(evidence.bookings).toHaveLength(0);
  });
});
