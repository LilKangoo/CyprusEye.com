import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT = '33333333-3333-4333-8333-333333333333';
const TARGET = '44444444-4444-4444-8444-444444444444';
const REVIEW = '55555555-5555-4555-8555-555555555555';
const TOKEN = 'a'.repeat(64);
const FINGERPRINT = 'b'.repeat(64);

function loadCore(): any {
  const context: Record<string, any> = { console, TextEncoder, crypto: { randomUUID: () => REVIEW } };
  for (const relative of ['admin/hotels-v2-workspace-core.js', 'js/hotels-v2-partner-workspace-core.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return context.HotelsV2PartnerWorkspaceCore;
}

function capabilities(enabled: string[] = []): Record<string, boolean> {
  return Object.fromEntries([
    'edit_property_content', 'edit_property_photos', 'edit_room_content', 'edit_room_photos',
    'create_rooms', 'edit_room_structure', 'manage_prices', 'manage_availability',
    'process_bookings', 'request_booking_changes', 'view_payment_status', 'initiate_stripe_onboarding',
  ].map((key) => [key, enabled.includes(key)]));
}

function workspace(): any {
  const caps = capabilities(['edit_property_content']);
  const section = (visible: boolean, available: boolean, status: string) => ({ visible, available, status });
  return {
    contract_version: 'hotels_v2_h3_2b_partner_workspace_v1',
    partner: { id: PARTNER, role: 'partner' },
    hotel_id: HOTEL,
    assignment: { id: ASSIGNMENT, permission_version: 1, capabilities: caps, access_snapshot_token: TOKEN },
    feature_flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
    content_snapshot_token: TOKEN,
    property: {
      id: HOTEL, slug: 'exact-hotel', title_i18n: { pl: 'Obiekt', en: 'Property', he: 'נכס' },
      description_i18n: { pl: '', en: '', he: '' }, city: 'Paphos', address_line: null,
      district: null, postal_code: null, country: 'Cyprus', latitude: null, longitude: null,
      google_maps_url: null, amenities: [], check_in_from: '14:00', check_out_until: '11:00',
      cover_image_url: null, photos: [], architecture_version: 'legacy', status: 'approved',
      is_published: true, updated_at: '2026-08-25T12:00:00Z',
    },
    property_draft: {
      exists: false, id: null, status: null, version: 0, source_property_updated_at: null,
      content: {}, photos: {}, updated_at: null,
    },
    rooms: [], units: [], pricing: null, availability: null,
    sections: {
      overview: section(true, true, 'available'),
      property_content: section(true, true, 'available'),
      property_photos: section(false, false, 'unavailable'),
      rooms: section(false, false, 'unavailable'),
      rates_pricing: section(false, false, 'unavailable'),
      calendar_availability: section(false, false, 'unavailable'),
      bookings: section(false, false, 'existing_flow'),
      payments: section(false, false, 'existing_flow'),
      booking_changes: section(false, false, 'future_stage'),
      stripe_onboarding: section(false, false, 'future_stage'),
    },
    recent_activity: [], legacy_authoritative: true, public_change: false,
  };
}

function contentReview(Core: any, original = workspace().property_draft): { draft: any; preview: any } {
  const draft = Core.validateDraft('content', {
    contract_version: Core.CONTRACTS.contentDraft,
    partner_id: PARTNER,
    hotel_id: HOTEL,
    access_snapshot_token: TOKEN,
    content_snapshot_token: TOKEN,
    intent: {
      entity: 'property_content', action: 'update', id: HOTEL,
      payload: { city: 'Limassol' }, reason: 'Reviewed exact property proposal',
    },
  });
  const operation = {
    entity: 'property_content', action: 'update', id: TARGET, expected_version: 0,
    expected_original: original, payload: draft.intent.payload, reason: draft.intent.reason,
  };
  return {
    draft,
    preview: {
      contract_version: Core.CONTRACTS.contentPreview,
      partner_id: PARTNER, hotel_id: HOTEL, changed: true, blocking_reasons: [],
      impacts: [{
        entity: operation.entity, action: operation.action, id: operation.id, changed: true,
        fields: ['city'], before: { city: 'Paphos' }, after: { city: 'Limassol' },
        affected_room_type_ids: [], affected_room_rate_ids: [], from: null, to: null,
      }],
      reviewed_plan: {
        contract_version: Core.CONTRACTS.contentPlan,
        review_id: REVIEW, partner_id: PARTNER, hotel_id: HOTEL, assignment_id: ASSIGNMENT,
        permission_version: 1, access_snapshot_token: TOKEN, domain_snapshot_token: TOKEN,
        reviewed_at: '2026-08-25T12:01:00Z', expires_at: '2026-08-25T12:31:00Z',
        operations: [operation], plan_fingerprint: FINGERPRINT,
      },
    },
  };
}

function commercial(mode: string, amount: number, quantity: number, customer: number, commission: number): any {
  return {
    policy: {
      id: TARGET, code: 'EXACT', commission_mode: mode, amount, currency: 'EUR', version: 1,
      updated_at: '2026-08-25T12:00:00Z', fingerprint: TOKEN, read_only: true,
    },
    calculation_basis: {
      code: mode === 'percent_booking_total' ? 'booking_total' : 'allocated_room_nights',
      quantity, unit_amount: amount, booking_total: customer,
    },
    customer_price: customer,
    cypruseye_commission: commission,
    partner_net: customer - commission,
    currency: 'EUR',
  };
}

function pricingReview(Core: any, summary: any): { draft: any; preview: any } {
  const draft = Core.validateDraft('pricing', {
    contract_version: Core.CONTRACTS.pricingDraft,
    partner_id: PARTNER, hotel_id: HOTEL, access_snapshot_token: TOKEN, pricing_snapshot_token: TOKEN,
    intent: {
      entity: 'room_rate_price', action: 'update', id: TARGET,
      payload: { nightly_rate: 100 }, reason: 'Reviewed exact nightly rate',
    },
    example_stay: null,
  });
  const operation = {
    entity: 'room_rate_price', action: 'update', id: TARGET, expected_version: 1,
    expected_original: {}, payload: draft.intent.payload, reason: draft.intent.reason,
  };
  return {
    draft,
    preview: {
      contract_version: Core.CONTRACTS.pricingPreview,
      partner_id: PARTNER, hotel_id: HOTEL, changed: true, blocking_reasons: [],
      impacts: [{
        entity: operation.entity, action: operation.action, id: TARGET, changed: true,
        fields: ['nightly_rate'], before: { nightly_rate: 80 }, after: { nightly_rate: 100 },
        affected_room_type_ids: [], affected_room_rate_ids: [TARGET], from: null, to: null,
      }],
      reviewed_plan: {
        contract_version: Core.CONTRACTS.pricingPlan,
        review_id: REVIEW, partner_id: PARTNER, hotel_id: HOTEL, assignment_id: ASSIGNMENT,
        permission_version: 1, access_snapshot_token: TOKEN, domain_snapshot_token: TOKEN,
        reviewed_at: '2026-08-25T12:01:00Z', expires_at: '2026-08-25T12:31:00Z',
        operations: [operation], plan_fingerprint: FINGERPRINT,
      },
      commercial_before: summary, commercial_after: summary, example_before: null, example_after: null,
    },
  };
}

describe('Hotels V2 H3.2B independent Partner workspace Core contract', () => {
  const Core = loadCore();

  test('requires canonical supported UUIDs and all four Hotels V2 flags OFF', () => {
    expect(Core.requireCanonicalUuid(TARGET)).toBe(TARGET);
    expect(() => Core.requireCanonicalUuid('ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF')).toThrow('lowercase canonical UUID');
    expect(() => Core.requireCanonicalUuid('44444444-4444-6444-8444-444444444444')).toThrow('lowercase canonical UUID');
    expect(Core.validateWorkspace(workspace(), { partnerId: PARTNER, hotelId: HOTEL }).legacy_authoritative).toBe(true);
    expect(() => Core.validateWorkspace({
      ...workspace(), feature_flags: { ...workspace().feature_flags, hotel_rooms_v2_enabled: true },
    }, { partnerId: PARTNER, hotelId: HOTEL })).toThrow('must remain OFF');
  });

  test('binds the exact property-proposal GET projection and reviewed-field impact map', () => {
    const { draft, preview } = contentReview(Core);
    expect(Core.validatePlanPreview('content', preview, draft, workspace()).reviewed_plan.operations[0].expected_original)
      .toEqual(workspace().property_draft);
    const withRawField = JSON.parse(JSON.stringify(preview));
    withRawField.reviewed_plan.operations[0].expected_original.hotel_id = HOTEL;
    expect(() => Core.validatePlanPreview('content', withRawField, draft, workspace())).toThrow('original/version differs');
    const widenedImpact = JSON.parse(JSON.stringify(preview));
    widenedImpact.impacts[0].fields.push('country');
    widenedImpact.impacts[0].after.country = 'Cyprus';
    expect(() => Core.validatePlanPreview('content', widenedImpact, draft, workspace())).toThrow('exact reviewed field map');
  });

  test('accepts exact percent and allocated-Room-night commission arithmetic', () => {
    const percent = pricingReview(Core, commercial('percent_booking_total', 10, 1, 100, 10));
    expect(Core.validatePlanPreview('pricing', percent.preview, percent.draft).commercial_after.partner_net).toBe(90);
    const roomNights = pricingReview(Core, commercial('per_allocated_room_per_night', 12.5, 4, 200, 50));
    expect(Core.validatePlanPreview('pricing', roomNights.preview, roomNights.draft).commercial_after.partner_net).toBe(150);
  });

  test('fails closed for unsupported, missing, fabricated, or negative commission results', () => {
    const unsupported = pricingReview(Core, commercial('per_person', 10, 1, 100, 10));
    expect(() => Core.validatePlanPreview('pricing', unsupported.preview, unsupported.draft)).toThrow('commission policy is invalid');

    const missing = pricingReview(Core, commercial('percent_booking_total', 10, 1, 100, 10));
    missing.preview.commercial_after = null;
    expect(() => Core.validatePlanPreview('pricing', missing.preview, missing.draft)).toThrow('must include exact before/after');

    const fabricated = pricingReview(Core, commercial('per_allocated_room_per_night', 12.5, 4, 200, 49));
    expect(() => Core.validatePlanPreview('pricing', fabricated.preview, fabricated.draft)).toThrow('internally inconsistent');

    const negative = pricingReview(Core, commercial('per_allocated_room_per_night', 60, 2, 100, 120));
    expect(() => Core.validatePlanPreview('pricing', negative.preview, negative.draft)).toThrow();
  });
});
