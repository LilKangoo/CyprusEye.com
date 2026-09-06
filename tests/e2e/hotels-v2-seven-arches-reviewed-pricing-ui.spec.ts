import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';
import { independentPricingControl, independentActivationSnapshot } from '../fixtures/hotels-v2-114415-client';

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
const ACTIVATION_PLAN = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const ACTIVATION_SHARED_SCHEDULE = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const ACTIVATION_PREVIEW_SCHEDULE = '443065c0-984a-5de3-a22a-d03042c41107';
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
      hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: true,
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
        pricing_schedule_id: identity.scheduleId, is_active: true, currency: 'EUR', review_status: 'reviewed',
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

function partnerWorkspaceAt114405() {
  const workspace = partnerWorkspace();
  const sharedSchedule = {
    ...workspace.pricing.schedules[0],
    id: ACTIVATION_SHARED_SCHEDULE,
    code: 'shared-apartment-occupancy-los',
    application_scope: 'room_occupancy',
    sharing_mode: 'shared',
    linked_room_rate_ids: [UPPER_RATE, GROUND_RATE],
    is_active: false,
    review_status: 'reviewed',
    lifecycle_status: 'inactive',
    tiers: workspace.pricing.schedules[0].tiers.map((tier: any) => ({
      ...tier,
      schedule_id: ACTIVATION_SHARED_SCHEDULE,
    })),
  };
  workspace.pricing.room_rates = workspace.pricing.room_rates.map((rate: any) => ({
    ...rate,
    pricing_schedule_id: ACTIVATION_SHARED_SCHEDULE,
    is_active: false,
  }));
  workspace.pricing.schedules = [sharedSchedule];
  workspace.pricing.schedule_tiers = sharedSchedule.tiers;
  return workspace;
}

async function installPartnerHarness(page: Page, options: { boundary114405?: boolean; language?: string } = {}) {
  const workspace = options.boundary114405 ? partnerWorkspaceAt114405() : partnerWorkspace();
  const control = {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_partner_control_v1',
    partner_id: PARTNER, hotel_id: HOTEL, assignment_id: ASSIGNMENT, assignment_version: 7,
    access_snapshot_token: HASH, pricing_snapshot_token: HASH, evolution_snapshot_token: HASH,
    commission_policy: { commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR' },
    current_items: currentItems(), proposals: [],
  };
  await page.setContent(`<!doctype html><html lang="${options.language || 'en'}"><body>
    <main id="partnerPortalView"></main>
    <section id="partnerHotelWorkspaceView" class="partner-hotel-workspace" hidden></section>
    <dialog id="partnerHotelWorkspaceReview" class="partner-hotel-workspace-review"></dialog>
  </body></html>`);
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js') });
  await page.addStyleTag({ path: path.join(process.cwd(), 'partners/hotels-v2-workspace.css') });
  await page.addStyleTag({ content: 'body { margin: 0; background: #090d18; }' });
  await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-partner-workspace-core.js') });
  await page.evaluate(({ workspaceValue, controlValue, proposalId, boundary114405 }) => {
    const root = window as any;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    let uuidSequence = 1;
    Object.defineProperty(root.crypto, 'randomUUID', {
      configurable: true,
      value: () => `dddddddd-dddd-4ddd-8ddd-${String(uuidSequence++).padStart(12, '0')}`,
    });
    const store: any = {
      calls: [], control: clone(controlValue), genericCalls: 0,
      stageClassification: boundary114405
        && root.HotelsV2PartnerWorkspaceCore.hasSevenArchesReviewedPricingIdentity(workspaceValue)
        && !root.HotelsV2PartnerWorkspaceCore.isSevenArchesReviewedPricingWorkspace(workspaceValue)
        ? 'FUTURE_STAGE_NOT_INSTALLED'
        : null,
    };
    root.__reviewedPartner = store;
    root.HotelsV2PartnerMedia = {};
    root.HotelsV2PartnerWorkspaceRepository = {
      getWorkspace: async (...args: any[]) => { store.calls.push({ name: 'get', args: clone(args) }); return clone(workspaceValue); },
      getSevenArchesPricingControl: async (...args: any[]) => {
        store.calls.push({ name: 'control', args: clone(args) });
        if (boundary114405) {
          const error: any = new Error('Independent reviewed Room pricing becomes available after the 114415 stage.');
          error.classification = 'FUTURE_STAGE_NOT_INSTALLED';
          throw error;
        }
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
  }, {
    workspaceValue: workspace, controlValue: control, proposalId: PROPOSAL,
    boundary114405: options.boundary114405 === true,
  });
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
      hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: true,
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

function readyActivationSnapshot(snapshotToken: string) {
  return {
    contract_version: 'hotels_v2_seven_arches_pricing_activation_snapshot_v1',
    hotel_id: HOTEL, status: 'ready', snapshot_token: snapshotToken,
    public_change: false, legacy_authoritative: true,
    feature_flags: {
      hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: true,
      hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false,
    },
    h3_1p: {
      promotion_review_id: PROPOSAL,
      source_fingerprint: '7208ab4ecc0e47abd64d87ca1ac53a03',
      parity: {
        threshold_case_count: 63, threshold_mismatch_count: 0,
        long_stay_case_count: 7, long_stay_mismatch_count: 0,
        total_case_count: 70, total_mismatch_count: 0, fingerprint: MD5,
      },
      allocation_exact: true,
    },
    rate_plan: {
      id: ACTIVATION_PLAN, version: 3, name_i18n: { en: 'Standard' },
      description_i18n: {}, cancellation_policy: { type: 'non_refundable' },
      is_active: false, review_status: 'reviewed',
    },
    room_rates: [
      { id: UPPER_RATE, room_type_id: UPPER_ROOM, base_nightly_rate: 0, currency: 'EUR', is_active: false, review_status: 'reviewed', version: 4 },
      { id: GROUND_RATE, room_type_id: GROUND_ROOM, base_nightly_rate: 0, currency: 'EUR', is_active: false, review_status: 'reviewed', version: 4 },
    ],
    shared_schedule: {
      id: ACTIVATION_SHARED_SCHEDULE, version: 3, name_i18n: { en: 'Shared apartment pricing' },
      is_active: false, review_status: 'reviewed', active_tier_count: 27,
    },
    preview_schedule: {
      id: ACTIVATION_PREVIEW_SCHEDULE, version: 2,
      is_active: false, review_status: 'requires_review',
    },
    payment_policy: {
      id: BOOKING, code: 'seven-kamares-request-confirmation', currency: 'EUR',
      is_active: true, review_status: 'reviewed', version: 3, terms_fingerprint: MD5,
    },
    commission_policy: {
      id: ADMIN, code: 'seven-kamares-room-night',
      commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR',
      version: 2, updated_at: '2026-08-30T10:00:00.000Z', read_only: true,
    },
    blocking_reasons: [],
  };
}

async function installAdminHarness(page: Page, real114415 = false) {
  const pricingControl = real114415 ? independentPricingControl(true) : adminPricingControl();
  const reviewedControl = reviewedAdminControl();
  const activation = independentActivationSnapshot(readyActivationSnapshot(HASH));
  activation.rate_plan.is_active = true;
  activation.rate_plan.name_i18n = { pl: 'Standard', en: 'Standard', he: 'סטנדרטי' };
  activation.rate_plan.description_i18n = { pl: 'Standard', en: 'Standard', he: 'Standard' };
  activation.room_rates.forEach((rate: any) => { rate.is_active = true; rate.base_nightly_rate = 100; });
  activation.shared_schedule.is_active = true;
  activation.shared_schedule.name_i18n = { pl: 'Wspólny cennik apartamentu', en: 'Shared apartment pricing', he: 'תמחור דירה משותף' };
  if (real114415) { reviewedControl.proposals = []; reviewedControl.current_state.receipt_count = 0; }
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
      hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: true,
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
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace-repository.js') });
  await page.evaluate(({ workspaceValue, pricingValue, reviewedValue, adminId, reviewId, hash, useReal, activationValue }) => {
    const root = window as any;
    const realRepository = root.HotelsV2WorkspaceRepository;
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
    if (useReal) {
      store.rpcCalls = [];
      root.getSupabase = () => ({ rpc: async (name: string, payload: any) => {
        store.rpcCalls.push({ name, payload: clone(payload) });
        if (name === 'hotel_v2_admin_preview_seven_arches_reviewed_pricing') {
          if (store.deferBuild) await new Promise<void>((resolve) => { store.releaseBuild = resolve; });
          if (store.buildFailure === 'transport') throw new TypeError('Failed to fetch private-response-marker');
          if (store.buildFailure) return { data: null, status: store.buildFailure, error: {
            code: store.buildFailure === 403 ? '42501' : 'PGRST000', message: 'Request rejected',
          } };
          const response = previewFor(payload.p_request);
          // 114415 creates an Admin proposal during Preview, even when the
          // request has no proposal_id; its Review lasts exactly 30 minutes.
          response.proposal_id = '99999999-9999-4999-8999-999999999999';
          response.reviewed_plan.proposal_id = response.proposal_id;
          response.reviewed_plan.proposal_version = 1;
          response.reviewed_plan.expires_at = '2026-08-30T10:31:00.000000Z';
          if (store.httpTransport) {
            store.httpResponse = response;
            const result = await fetch(`http://127.0.0.1:4317/rest/v1/rpc/${name}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            return { data: await result.json(), error: null, status: result.status };
          }
          return { data: response, error: null, status: 200 };
        }
        const responses: any = {
          hotel_v2_admin_get_pricing_control: store.pricing,
          hotel_v2_admin_get_seven_arches_reviewed_pricing: store.reviewed,
          hotel_v2_admin_get_seven_arches_pricing_activation: activationValue,
        };
        if (!Object.hasOwn(responses, name)) throw new Error(`Unexpected RPC: ${name}`);
        // Transport stub only: the actual repository and Core parser run.
        return { data: clone(responses[name]), error: null, status: 200 };
      } });
      for (const name of ['getPricingControl', 'getSevenArchesReviewedPricing', 'getSevenArchesPricingActivation',
        'getLegacyPricingPromotionPreview', 'previewSevenArchesReviewedPricing', 'applySevenArchesReviewedPricing']) {
        root.HotelsV2WorkspaceRepository[name] = realRepository[name];
      }
    }
  }, { workspaceValue: workspace, pricingValue: pricingControl, reviewedValue: reviewedControl, adminId: ADMIN, reviewId: REVIEW, hash: HASH, useReal: real114415, activationValue: activation });
  await page.addScriptTag({ path: path.join(process.cwd(), 'admin/hotels-v2-workspace.js') });
  await page.evaluate(async (hotelId) => {
    await (window as any).HotelsV2Workspace.openWorkspace(hotelId, { tab: 'pricing' });
  }, HOTEL);
}

test.describe('7 Arches reviewed pricing UI integration', () => {
  test('Admin no-op has an executed handler, inline explanation and zero requests', async ({ page }) => {
    let networkCalls = 0;
    page.on('request', (request) => { if (request.url().includes('/rest/v1/rpc/')) networkCalls += 1; });
    await installAdminHarness(page, true);
    await page.locator('[data-start-reviewed-pricing]').click();
    await page.locator('#sevenArchesReviewedPricingAdminForm [name="reason"]').fill('Test');
    const checks = page.locator('[data-reviewed-pricing-select]');
    await checks.nth(0).check(); await checks.nth(1).check();
    await page.locator('#sevenArchesReviewedPricingAdminForm').evaluate((form) => {
      (window as any).__formSubmits = 0;
      form.addEventListener('submit', () => { (window as any).__formSubmits += 1; }, true);
    });
    await page.getByRole('button', { name: 'Build server Review', exact: true }).click();
    const proof = await page.evaluate(() => ({ submits: (window as any).__formSubmits,
      calls: (window as any).__reviewedAdmin.rpcCalls.filter((c: any) => c.name.includes('preview')),
      toasts: (window as any).__reviewedAdmin.toasts }));
    expect(proof.submits).toBe(1); expect(proof.calls).toHaveLength(0);
    expect(networkCalls).toBe(0);
    expect(proof.toasts).toHaveLength(0);
    await expect(page.locator('[data-reviewed-pricing-feedback]')).toHaveText('Change at least one selected price before building the Review.');
    await expect(page.locator('[data-reviewed-pricing-counts]')).toHaveText('54 rows · 2 selected · 0 changed');
  });

  test('Admin bulk selection preserves 54 independent identities and every price value', async ({ page }) => {
    await installAdminHarness(page, true);
    await page.locator('[data-start-reviewed-pricing]').click();
    const rows = page.locator('[data-reviewed-pricing-tier]');
    const snapshot = () => rows.evaluateAll((elements) => elements.map((e) => ({
      identity: { ...(e as HTMLElement).dataset }, value: e.querySelector<HTMLInputElement>('[data-reviewed-pricing-price]')!.value,
    })));
    const initial = await snapshot();
    await page.getByRole('button', { name: 'Select all', exact: true }).click();
    await expect(page.locator('[data-reviewed-pricing-select]:checked')).toHaveCount(54);
    await expect(page.locator('[data-room-key="upper"] [data-reviewed-pricing-select]:checked')).toHaveCount(27);
    await expect(page.locator('[data-room-key="ground"] [data-reviewed-pricing-select]:checked')).toHaveCount(27);
    expect(await snapshot()).toEqual(initial);
    await expect(page.locator('[data-reviewed-pricing-counts]')).toHaveText('54 rows · 54 selected · 0 changed');
    const upperPrice = page.locator('[data-reviewed-pricing-tier][data-room-key="upper"]').first().locator('[data-reviewed-pricing-price]');
    await upperPrice.fill('100.00');
    await expect(page.locator('[data-reviewed-pricing-counts]')).toHaveText('54 rows · 54 selected · 0 changed');
    await page.locator('[data-reviewed-pricing-tier][data-room-key="upper"]').first().locator('[data-reviewed-pricing-price]').fill('101');
    const ground = page.locator('[data-reviewed-pricing-tier][data-room-key="ground"]').first();
    await ground.locator('[data-reviewed-pricing-price]').fill('102');
    const edited = await snapshot();
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(page.locator('[data-reviewed-pricing-select]:checked')).toHaveCount(0);
    await expect(page.locator('[data-reviewed-pricing-counts]')).toHaveText('54 rows · 0 selected · 2 changed');
    expect(await snapshot()).toEqual(edited);
    await page.getByRole('button', { name: 'Select changed', exact: true }).click();
    await expect(page.locator('[data-reviewed-pricing-select]:checked')).toHaveCount(2);
    await expect(page.locator('[data-reviewed-pricing-counts]')).toHaveText('54 rows · 2 selected · 2 changed');
    expect(await snapshot()).toEqual(edited);
    expect(await page.evaluate(() => (window as any).__reviewedAdmin.rpcCalls.filter((c: any) => /preview|apply/.test(c.name)))).toEqual([]);
  });

  for (const selection of ['upper', 'ground', 'both', 'multiple upper']) {
    test(`Admin changed-only ${selection} makes one HTTP Preview and one render, never Apply`, async ({ page }) => {
      await installAdminHarness(page, true);
      let networkCalls = 0;
      let wirePayload: any;
      await page.route('http://127.0.0.1:4317/rest/v1/rpc/hotel_v2_admin_preview_seven_arches_reviewed_pricing', async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' } });
          return;
        }
        networkCalls += 1;
        wirePayload = route.request().postDataJSON();
        const data = await page.evaluate(() => (window as any).__reviewedAdmin.httpResponse);
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) });
      });
      await page.evaluate(() => { (window as any).__reviewedAdmin.httpTransport = true; });
      await page.locator('[data-start-reviewed-pricing]').click();
      await page.getByRole('button', { name: 'Select all', exact: true }).click();
      const keys = selection === 'both' ? ['upper', 'ground'] : selection === 'multiple upper' ? ['upper', 'upper'] : [selection];
      for (const [i, key] of keys.entries()) {
        const row = page.locator(`[data-reviewed-pricing-tier][data-room-key="${key}"]`).nth(selection === 'multiple upper' ? i : 0);
        if (selection !== 'multiple upper') expect(Number(await row.getAttribute('data-before-price'))).toBe(100);
        await row.locator('[data-reviewed-pricing-price]').fill(String(Number(await row.getAttribute('data-before-price')) + 1));
      }
      await page.locator('#sevenArchesReviewedPricingAdminForm [name="reason"]').fill('Test');
      await page.locator('#sevenArchesReviewedPricingAdminForm').evaluate((form) => {
        (window as any).__realSubmits = 0;
        form.addEventListener('submit', () => { (window as any).__realSubmits += 1; }, true);
      });
      await page.getByRole('button', { name: 'Build server Review', exact: true }).click();
      await expect(page.locator('.hotel-reviewed-pricing-impact')).toHaveCount(1);
      await expect(page.locator('.hotel-reviewed-pricing-impact')).toBeVisible();
      expect(networkCalls).toBe(1);
      expect(wirePayload.p_request.items).toHaveLength(keys.length);
      expect(wirePayload.p_request.items.map((entry: any) => entry.pricing_schedule_id).sort()).toEqual(
        keys.map((key) => key === 'upper' ? UPPER_SCHEDULE : GROUND_SCHEDULE).sort());
      for (const entry of wirePayload.p_request.items) {
        expect(entry.requested_price).toBe(entry.before_price + 1);
        expect(entry.room_rate_id).toBe(entry.pricing_schedule_id === UPPER_SCHEDULE ? UPPER_RATE : GROUND_RATE);
      }
      const proof = await page.evaluate(() => ({ store: (window as any).__reviewedAdmin, submits: (window as any).__realSubmits }));
      expect(proof.submits).toBe(1);
      expect(proof.store.rpcCalls.filter((c: any) => c.name.includes('preview'))).toHaveLength(1);
      expect(proof.store.rpcCalls.filter((c: any) => /apply|submit/.test(c.name))).toHaveLength(0);
      expect(proof.store.genericCalls).toBe(0);
    });
  }

  test('Admin zero selection and invalid reason/price stay local with accessible explanations', async ({ page }) => {
    await installAdminHarness(page, true);
    await page.locator('[data-start-reviewed-pricing]').click();
    const reason = page.locator('#sevenArchesReviewedPricingAdminForm [name="reason"]');
    const feedback = page.locator('[data-reviewed-pricing-feedback]');
    const button = page.getByRole('button', { name: 'Build server Review', exact: true });
    await reason.fill('Test'); await button.click();
    await expect(feedback).toHaveText('Select at least one price.');
    const row = page.locator('[data-reviewed-pricing-tier]').first();
    await row.locator('[data-reviewed-pricing-select]').check();
    await row.locator('[data-reviewed-pricing-price]').fill('101');
    for (const value of ['', 'ab', '   ', 'Line\nbreak']) {
      await reason.fill(value); await button.click();
      await expect(feedback).toHaveText('Enter a reason of 3–500 characters on one line.');
    }
    await reason.fill('Test');
    for (const value of ['', '9', '100.001', '10000000000']) {
      await row.locator('[data-reviewed-pricing-price]').fill(value); await button.click();
      await expect(feedback).toContainText('Enter valid selected prices');
    }
    await expect(button).toHaveAttribute('aria-describedby', 'sevenArchesReviewedPricingEditorFeedback');
    expect(await page.evaluate(() => (window as any).__reviewedAdmin.rpcCalls.filter((c: any) => /preview|apply/.test(c.name)))).toEqual([]);
  });

  for (const [language, message, selectAll] of [
    ['pl', 'Zmień co najmniej jedną zaznaczoną cenę przed przygotowaniem Review.', 'Zaznacz wszystkie'],
    ['he', 'יש לשנות לפחות מחיר נבחר אחד לפני הכנת הבדיקה.', 'בחר הכול'],
  ]) {
    test(`Admin inline no-op and bulk controls are localized in ${language}`, async ({ page }) => {
      await installAdminHarness(page, true);
      await page.evaluate((lang) => { document.documentElement.lang = lang; }, language);
      await page.locator('[data-start-reviewed-pricing]').click();
      await page.locator('#sevenArchesReviewedPricingAdminForm [name="reason"]').fill('Test');
      await page.getByRole('button', { name: selectAll, exact: true }).click();
      await page.locator('button[form="sevenArchesReviewedPricingAdminForm"]').click();
      await expect(page.locator('[data-reviewed-pricing-feedback]')).toHaveText(message);
    });
  }
  test('functional completion Admin Build uses real parser/repository once despite repeated submit, without Apply', async ({ page }) => {
    await installAdminHarness(page, true);
    await page.locator('[data-start-reviewed-pricing]').click();
    const row = page.locator('[data-reviewed-pricing-tier][data-room-key="upper"]').first();
    await row.locator('[data-reviewed-pricing-select]').check();
    const before = Number(await row.getAttribute('data-before-price'));
    await row.locator('[data-reviewed-pricing-price]').fill(String(before + 5));
    await page.locator('#sevenArchesReviewedPricingAdminForm [name="reason"]').fill('Reviewed independent Upper change');
    await page.evaluate(() => { (window as any).__reviewedAdmin.deferBuild = true; });
    await page.locator('#sevenArchesReviewedPricingAdminForm').evaluate((form: HTMLFormElement) => {
      form.requestSubmit(); form.requestSubmit();
    });
    const calls = await page.evaluate(() => (window as any).__reviewedAdmin.rpcCalls.filter((c: any) => c.name.includes('preview')));
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('hotel_v2_admin_preview_seven_arches_reviewed_pricing');
    expect(calls[0].payload).toEqual({ p_request: {
      contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      hotel_id: HOTEL, action: 'accept', reason: 'Reviewed independent Upper change',
      items: [expect.objectContaining({ hotel_id: HOTEL, room_type_id: UPPER_ROOM,
        room_rate_id: UPPER_RATE, pricing_schedule_id: UPPER_SCHEDULE,
        before_price: before, requested_price: before + 5, currency: 'EUR' })],
    } });
    await page.evaluate(() => (window as any).__reviewedAdmin.releaseBuild());
    expect(await page.evaluate(() => (window as any).__reviewedAdmin.toasts)).toEqual([]);
    await expect(page.locator('.hotel-reviewed-pricing-impact')).toBeVisible();
    const state = await page.evaluate(() => (window as any).__reviewedAdmin);
    expect(state.rpcCalls.filter((c: any) => /apply|submit/.test(c.name))).toHaveLength(0);
    expect(state.genericCalls).toBe(0);
  });

  for (const failure of ['transport', 401, 403, 500]) {
    test(`functional completion Admin Build ${failure} fails closed without retries`, async ({ page }) => {
      await installAdminHarness(page, true);
      await page.locator('[data-start-reviewed-pricing]').click();
      const row = page.locator('[data-reviewed-pricing-tier]').first();
      await row.locator('[data-reviewed-pricing-select]').check();
      await row.locator('[data-reviewed-pricing-price]').fill(String(Number(await row.getAttribute('data-before-price')) + 5));
      await page.locator('#sevenArchesReviewedPricingAdminForm [name="reason"]').fill('Reviewed local failure path');
      await page.evaluate((value) => { (window as any).__reviewedAdmin.buildFailure = value; }, failure);
      await page.getByRole('button', { name: 'Build server Review', exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as any).__reviewedAdmin.toasts.length)).toBeGreaterThan(0);
      const store = await page.evaluate(() => (window as any).__reviewedAdmin);
      expect(store.rpcCalls.filter((c: any) => c.name.includes('preview'))).toHaveLength(1);
      expect(store.rpcCalls.filter((c: any) => /apply|submit/.test(c.name))).toHaveLength(0);
      expect(store.genericCalls).toBe(0);
      expect(store.toasts.map((t: any) => t.message).join(' ')).not.toContain('private-response-marker');
      await expect(page.locator('[data-apply-reviewed-pricing]')).toHaveCount(0);
      await expect(page.locator('[data-reviewed-pricing-feedback]')).toBeVisible();
      await expect(page.locator('[data-reviewed-pricing-feedback]')).toHaveText(store.toasts.at(-1).message);
      await expect(page.locator('[data-reviewed-pricing-feedback]')).toContainText(failure === 'transport'
        ? 'Check the request status' : 'The server rejected this Review');
      const build = page.getByRole('button', { name: 'Build server Review', exact: true });
      await expect(build).toBeEnabled();
      // A distinct explicit user action in a local fixture, not an automatic
      // retry. This proves the terminal failure released the per-form guard.
      await page.evaluate(() => { (window as any).__reviewedAdmin.buildFailure = null; });
      await build.click();
      await expect(page.locator('.hotel-reviewed-pricing-impact')).toHaveCount(1);
      const after = await page.evaluate(() => (window as any).__reviewedAdmin);
      expect(after.rpcCalls.filter((c: any) => c.name.includes('preview'))).toHaveLength(2);
      expect(after.rpcCalls.filter((c: any) => /apply|submit/.test(c.name))).toHaveLength(0);
    });
  }

  test('114415 real repository/parser retains independent topology and immutable activation before any Preview', async ({ page }) => {
    await installAdminHarness(page, true);
    const activation = page.locator('[data-seven-arches-pricing-activation]');
    await expect(activation).toContainText('ACTIVE');
    await expect(activation).toContainText('Activation is immutable');
    await expect(activation).toContainText('Independent Room schedules are active');
    await expect(activation).not.toContainText('Customer-price authority remains the reviewed 27-tier shared');
    await expect(page.locator('[data-open-seven-arches-pricing-activation]')).toHaveCount(0);
    await expect(page.locator('[data-review-seven-kamares-pricing]')).toHaveCount(0);
    await expect(page.locator('[data-seven-kamares-pricing-promotion-card]')).toContainText('ACTIVATED');
    await expect(page.getByText('Pricing control unavailable', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Legacy pricing Review unavailable', { exact: true })).toHaveCount(0);
    await expect(page.locator('.hotel-pricing-safety-banner')).toContainText('PUBLIC FLAGS OFF · EXTERNAL SYNC ON');
    await expect(page.locator('[data-add-pricing-plan]')).toHaveCount(0);
    await page.locator('[data-start-reviewed-pricing]').click();
    await expect(page.locator('#sevenArchesReviewedPricingAdminForm')).toBeVisible();
    await expect(page.locator('[data-reviewed-pricing-tier]')).toHaveCount(54);
    await expect(page.locator('[data-reviewed-pricing-tier][data-room-key="upper"]')).toHaveCount(27);
    await expect(page.locator('[data-reviewed-pricing-tier][data-room-key="ground"]')).toHaveCount(27);
    const calls = await page.evaluate(() => (window as any).__reviewedAdmin.rpcCalls.map((c: any) => c.name));
    expect(calls.filter((name: string) => name === 'hotel_v2_admin_get_pricing_control')).toHaveLength(1);
    expect(calls.filter((name: string) => /preview|apply|submit|promotion/.test(name))).toHaveLength(0);
    expect(await page.evaluate(() => (window as any).__reviewedAdmin.genericCalls)).toBe(0);
  });

  test('keeps ready activation independent at the 114405 boundary and builds exactly one fresh Review', async ({ page }) => {
    await installAdminHarness(page);
    const initialSnapshot = readyActivationSnapshot('c'.repeat(64));
    const freshSnapshot = readyActivationSnapshot('d'.repeat(64));
    await page.evaluate(async ({ hotelId, initial, fresh, reviewId, fingerprint }) => {
      const root = window as any;
      const clone = (value: any) => JSON.parse(JSON.stringify(value));
      const store = root.__reviewedAdmin;
      store.activationGets = 0;
      store.activationPreviews = [];
      store.activationApplies = [];
      store.legacyPromotionGets = 0;
      root.HotelsV2WorkspaceRepository.getPricingControl = async () => clone(store.pricing);
      root.HotelsV2WorkspaceRepository.getLegacyPricingPromotionPreview = async () => {
        store.legacyPromotionGets += 1;
        throw new Error('The historical H3.1P preparation must not be rerun after exact activation evidence exists.');
      };
      root.HotelsV2WorkspaceRepository.getSevenArchesReviewedPricing = async () => {
        const error: any = new Error('Load reviewed 7 Arches pricing control: exact future function absent');
        error.classification = 'FUTURE_STAGE_NOT_INSTALLED';
        throw error;
      };
      root.HotelsV2WorkspaceRepository.getSevenArchesPricingActivation = async () => {
        store.activationGets += 1;
        return clone(store.activationGets === 1 ? initial : fresh);
      };
      root.HotelsV2WorkspaceRepository.previewSevenArchesPricingActivation = async (draft: any, snapshot: any) => {
        store.activationPreviews.push({ draft: clone(draft), snapshot: clone(snapshot) });
        const before = {
          rate_plan: snapshot.rate_plan, room_rates: snapshot.room_rates,
          shared_schedule: snapshot.shared_schedule, preview_schedule: snapshot.preview_schedule,
        };
        const after = {
          rate_plan: {
            id: snapshot.rate_plan.id, name_i18n: draft.rate_plan_name_i18n,
            description_i18n: draft.rate_plan_description_i18n, is_active: true,
          },
          room_rates: [
            { id: snapshot.room_rates[0].id, base_nightly_rate: draft.upper_base_nightly_rate, is_active: true },
            { id: snapshot.room_rates[1].id, base_nightly_rate: draft.ground_base_nightly_rate, is_active: true },
          ],
          shared_schedule: { id: snapshot.shared_schedule.id, name_i18n: draft.schedule_name_i18n, is_active: true },
          preview_schedule: snapshot.preview_schedule,
        };
        return {
          contract_version: 'hotels_v2_seven_arches_pricing_activation_preview_v1',
          hotel_id: hotelId, changed: true, blocking_reasons: [],
          impact: {
            entity: 'pricing_activation', action: 'activate', id: hotelId, changed: true,
            fields: ['base_nightly_rates', 'is_active', 'rate_plan_description_i18n', 'rate_plan_name_i18n', 'schedule_name_i18n'],
            before, after,
            affected_room_type_ids: [snapshot.room_rates[1].room_type_id, snapshot.room_rates[0].room_type_id],
            affected_room_rate_ids: [snapshot.room_rates[1].id, snapshot.room_rates[0].id],
            from: null, to: null,
          },
          reviewed_plan: { review_id: reviewId, plan_fingerprint: fingerprint },
        };
      };
      root.HotelsV2WorkspaceRepository.applySevenArchesPricingActivation = async (...args: any[]) => {
        store.activationApplies.push(clone(args));
        throw new Error('Apply must remain behind separate explicit confirmation');
      };
      await root.HotelsV2Workspace.openWorkspace(hotelId, { tab: 'pricing' });
    }, { hotelId: HOTEL, initial: initialSnapshot, fresh: freshSnapshot, reviewId: REVIEW, fingerprint: HASH });

    const activationCard = page.locator('[data-seven-arches-pricing-activation]');
    await expect(activationCard).toBeVisible();
    await expect(activationCard).toContainText('Ready for one explicit activation Review');
    await expect(page.locator('.hotel-reviewed-pricing-control')).toContainText(
      'Independent reviewed Room pricing becomes available after the 114415 stage.',
    );
    await expect(page.getByText('PUBLIC FLAGS OFF · EXTERNAL SYNC ON', { exact: true })).toBeVisible();
    await expect(page.getByText('FLAGS DRIFT', { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-seven-kamares-pricing-promotion-card]')).toContainText('REVIEWED');
    await expect(page.locator('[data-seven-kamares-pricing-promotion-card]')).toContainText(
      'The completed 70/0 H3.1P Review is pinned by the exact activation snapshot.',
    );
    await expect(page.locator('[data-review-seven-kamares-pricing]')).toHaveCount(0);
    await expect(page.locator('[data-open-seven-arches-pricing-activation]')).toBeVisible();
    await expect(page.locator('[data-add-pricing-plan], [data-add-pricing-schedule]')).toHaveCount(0);

    await page.locator('[data-open-seven-arches-pricing-activation]').click();
    const form = page.locator('#sevenArchesPricingActivationForm');
    await form.locator('[name="upper_base_nightly_rate"]').fill('100.00');
    await form.locator('[name="ground_base_nightly_rate"]').fill('100.00');
    await form.locator('[name="rate_plan_name_pl"]').fill('Standard');
    await form.locator('[name="rate_plan_name_en"]').fill('Standard');
    await form.locator('[name="rate_plan_name_he"]').fill('סטנדרטי');
    await form.locator('[name="rate_plan_description_pl"]').fill('Standard');
    await form.locator('[name="rate_plan_description_en"]').fill('Standard');
    await form.locator('[name="rate_plan_description_he"]').fill('Standard');
    await form.locator('[name="schedule_name_pl"]').fill('Wspólny cennik apartamentu');
    await form.locator('[name="schedule_name_en"]').fill('Shared apartment pricing');
    await form.locator('[name="schedule_name_he"]').fill('תמחור דירה משותף');
    await form.locator('[name="reason"]').fill(
      'Reviewed activation using the existing authoritative minimum-stay price as the equal initial base rate for both apartments.',
    );
    await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
    await expect.poll(() => page.evaluate(
      () => (window as any).__reviewedAdmin.activationPreviews.length,
    )).toBe(1);
    await expect(page.getByText('Review 7 Arches pricing activation', { exact: true })).toBeVisible();
    const confirm = page.locator('[data-hotel-review-confirm]');
    await expect(confirm).toBeVisible();

    const store = await page.evaluate(() => (window as any).__reviewedAdmin);
    expect(store.activationGets).toBe(2);
    expect(store.activationPreviews).toHaveLength(1);
    expect(store.activationPreviews[0].draft).toMatchObject({
      snapshot_token: 'd'.repeat(64),
      upper_base_nightly_rate: 100,
      ground_base_nightly_rate: 100,
    });
    expect(store.activationPreviews[0].draft.snapshot_token).not.toBe('c'.repeat(64));
    expect(store.activationPreviews[0].snapshot.snapshot_token).toBe('d'.repeat(64));
    expect(store.activationApplies).toHaveLength(0);
    expect(store.genericCalls).toBe(0);
    expect(store.legacyPromotionGets).toBe(0);
  });

  test('Partner changes one Upper tier through dedicated Preview and Submit only', async ({ page }) => {
    await installPartnerHarness(page);
    await page.locator('[data-phw-section="rates_pricing"]:visible').first().click();
    const upper = page.locator('[data-phw-reviewed-room="upper"] [data-phw-reviewed-tier]').first();
    const ground = page.locator('[data-phw-reviewed-room="ground"] [data-phw-reviewed-tier]').first();
    const upperBefore = Number(await upper.getAttribute('data-before-price'));
    const groundBefore = await ground.inputValue();
    await upper.fill(String(upperBefore + 10));
    await page.locator('[data-phw-pricing-room="ground"]').click();
    await expect(ground).toHaveValue(groundBefore);
    await page.locator('[data-phw-pricing-room="upper"]').click();
    await expect(upper).toHaveValue(String(upperBefore + 10));
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

  for (const width of [1440, 1024, 768, 390]) {
    for (const language of ['en', 'pl', 'he']) {
      test(`Partner redesign independent 27/27 matrix ${language} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 950 });
        await installPartnerHarness(page, { language });
        await page.locator('[data-phw-section="rates_pricing"]:visible').first().click();
        for (const room of ['upper', 'ground']) {
          await page.locator(`[data-phw-pricing-room="${room}"]`).click();
          const matrix = page.locator(`[data-phw-reviewed-room="${room}"]`);
          await expect(matrix).toBeVisible();
          await expect(matrix.locator('[data-phw-reviewed-tier]')).toHaveCount(27);
          await expect(matrix.locator('tbody tr')).toHaveCount(9);
          if (width <= 820) {
            await expect(matrix.locator('[data-phw-reviewed-tier]:visible')).toHaveCount(9);
            await matrix.locator('[data-phw-guest-filter]').selectOption('4');
            await expect(matrix.locator('[data-phw-reviewed-tier]:visible')).toHaveCount(9);
            await expect(matrix.locator('[data-phw-reviewed-tier]:visible').first()).toHaveAttribute('aria-label', /4/);
          }
        }
        const ids = await page.locator('[data-phw-reviewed-tier]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-tier-id')));
        await page.locator('[data-phw-pricing-room="upper"]').click();
        expect(new Set(ids).size).toBe(54);
        await expect(page.locator('[data-phw-commission-policy]')).toContainText('10');
        await expect(page.locator('[data-phw-commission-policy]')).not.toContainText('%');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`pricing-${language}-${width}.png`), fullPage: true });
        const store = await page.evaluate(() => (window as any).__reviewedPartner);
        expect(store.calls.filter((entry: any) => ['preview', 'submit'].includes(entry.name))).toHaveLength(0);
        expect(store.genericCalls).toBe(0);
      });
    }
  }

  test('keeps Partner pricing unavailable and unrelated workspace sections usable at the 114405 boundary', async ({ page }) => {
    await installPartnerHarness(page, { boundary114405: true });
    await page.locator('[data-phw-section="rates_pricing"]:visible').first().click();

    const panel = page.locator('[data-phw-panel="rates_pricing"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Exact reviewed pricing control is unavailable. No proposal can be prepared.');
    await expect(page.locator('[data-phw-lifecycle]')).toContainText(
      'Exact reviewed pricing control is unavailable. No proposal can be prepared.',
    );
    await expect(page.locator('[data-phw-seven-arches-pricing], [data-phw-pricing]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /preview proposal|submit for admin review/i })).toHaveCount(0);

    await page.locator('[data-phw-section="overview"]:visible').first().click();
    await expect(page.locator('[data-phw-panel="overview"]')).toBeVisible();
    await expect(page.locator('#partnerHotelWorkspaceTitle')).toContainText('7 Arches Hotel');

    const store = await page.evaluate(() => (window as any).__reviewedPartner);
    expect(store.stageClassification).toBe('FUTURE_STAGE_NOT_INSTALLED');
    expect(store.calls.filter((entry: any) => entry.name === 'control')).toHaveLength(0);
    expect(store.calls.filter((entry: any) => ['preview', 'submit'].includes(entry.name))).toHaveLength(0);
    expect(store.genericCalls).toBe(0);
  });

  for (const failure of ['PGRST202', '42501', 'HTTP500', 'TRANSPORT']) {
    test(`Partner 114415 optional pricing failure ${failure} stays read-only without raw errors or retries`, async ({ page }) => {
      await installPartnerHarness(page);
      await page.evaluate(() => {
        const root = window as any;
        root.__savedPartnerRepository = root.HotelsV2PartnerWorkspaceRepository;
        // This UI fixture is deliberately partial; full workspace DTO validation has its own strict suites.
        root.HotelsV2PartnerWorkspaceCore = { ...root.HotelsV2PartnerWorkspaceCore, validateWorkspace: (value: any) => value };
      });
      await page.addScriptTag({ path: path.join(process.cwd(), 'js/hotels-v2-partner-workspace-repository.js') });
      await page.evaluate(async ({ code }) => {
        const root = window as any;
        const realGet = root.HotelsV2PartnerWorkspaceRepository.getSevenArchesPricingControl;
        const realWorkspaceGet = root.HotelsV2PartnerWorkspaceRepository.getWorkspace;
        const saved = root.__savedPartnerRepository;
        const workspace = await saved.getWorkspace();
        root.__optionalRpcCalls = [];
        root.getSupabase = () => ({ rpc: async (name: string) => {
          if (name === 'hotel_v2_partner_get_workspace') return { data: workspace, error: null };
          root.__optionalRpcCalls.push(name);
          if (code === 'TRANSPORT') throw new Error('fetch failed private-response-marker');
          return { data: null, status: code === 'PGRST202' ? 404 : code === '42501' ? 403 : 500,
            error: { code, message: 'Could not find the function public.hotel_v2_partner_get_seven_arches_reviewed_pricing in the schema cache private-response-marker' } };
        } });
        await realWorkspaceGet(workspace.partner.id, workspace.hotel_id, '2026-09-01', '2026-09-30');
        // Exercise the real repository RPC/error path while the workspace itself stays a local fixture.
        saved.getSevenArchesPricingControl = realGet;
        root.HotelsV2PartnerWorkspaceRepository = saved;
      }, { code: failure });
      await page.locator('[data-phw-refresh]:visible').first().click();
      await page.locator('[data-phw-section="rates_pricing"]:visible').first().click();
      const panel = page.locator('[data-phw-panel="rates_pricing"]');
      await expect(panel).toContainText('Exact reviewed pricing control is unavailable. No proposal can be prepared.');
      await expect(panel.locator('input:enabled, [data-phw-seven-arches-pricing]')).toHaveCount(0);
      await expect(panel.locator('input:disabled')).toHaveCount(54);
      expect(await panel.innerText()).not.toMatch(/PGRST202|404|schema cache|private-response-marker/);
      await expect(page.locator('#partnerHotelWorkspaceView')).not.toContainText('private-response-marker');
      await page.locator('[data-phw-section="overview"]:visible').first().click();
      await expect(page.locator('[data-phw-panel="overview"]')).toBeVisible();
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => (window as any).__optionalRpcCalls)).toEqual(['hotel_v2_partner_get_seven_arches_reviewed_pricing']);
      const store = await page.evaluate(() => (window as any).__reviewedPartner);
      expect(store.calls.filter((entry: any) => ['preview', 'submit'].includes(entry.name))).toHaveLength(0);
      expect(store.genericCalls).toBe(0);
    });
  }

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
