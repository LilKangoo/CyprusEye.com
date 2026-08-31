import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT = '33333333-3333-4333-8333-333333333333';
const TARGET = '44444444-4444-4444-8444-444444444444';
const REVIEW = '55555555-5555-4555-8555-555555555555';
const IDEMPOTENCY = '66666666-6666-4666-8666-666666666666';
const TOKEN = 'a'.repeat(64);
const PLAN_TOKEN = 'b'.repeat(64);

function loadCore(): any {
  const context: Record<string, any> = { console, TextEncoder, crypto: { randomUUID: () => REVIEW } };
  for (const relative of ['admin/hotels-v2-workspace-core.js', 'js/hotels-v2-partner-workspace-core.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return context.HotelsV2PartnerWorkspaceCore;
}

function loadRepository(client: any): any {
  const context: Record<string, any> = { console, TextEncoder, crypto: { randomUUID: () => REVIEW }, window: { getSupabase: () => client } };
  for (const relative of ['admin/hotels-v2-workspace-core.js', 'js/hotels-v2-partner-workspace-core.js', 'js/hotels-v2-partner-workspace-repository.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return context.HotelsV2PartnerWorkspaceRepository;
}

function caps(enabled: string[] = []): Record<string, boolean> {
  return Object.fromEntries([
    'edit_property_content', 'edit_property_photos', 'edit_room_content', 'edit_room_photos',
    'create_rooms', 'edit_room_structure', 'manage_prices', 'manage_availability',
    'process_bookings', 'request_booking_changes', 'view_payment_status', 'initiate_stripe_onboarding',
  ].map((key) => [key, enabled.includes(key)]));
}

function section(visible: boolean, available: boolean, status: string): any { return { visible, available, status }; }

function emptyWorkspace(enabled: string[] = []): any {
  const capabilitySet = caps(enabled);
  return {
    contract_version: 'hotels_v2_h3_2b_partner_workspace_v1',
    partner: { id: PARTNER, role: 'partner' }, hotel_id: HOTEL,
    assignment: { id: ASSIGNMENT, permission_version: 1, capabilities: capabilitySet, access_snapshot_token: TOKEN },
    feature_flags: { hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: false, hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false },
    content_snapshot_token: TOKEN,
    property: {
      id: HOTEL, slug: 'exact-hotel', title_i18n: { pl: 'Obiekt', en: 'Property', he: 'נכס' }, description_i18n: { pl: '', en: '', he: '' },
      city: 'Paphos', address_line: null, district: null, postal_code: null, country: 'Cyprus', latitude: null, longitude: null,
      google_maps_url: null, amenities: [], check_in_from: '14:00', check_out_until: '11:00', cover_image_url: null, photos: [],
      architecture_version: 'legacy', status: 'approved', is_published: true, updated_at: '2026-08-25T12:00:00Z',
    },
    property_draft: { exists: false, id: null, status: null, version: 0, source_property_updated_at: null, content: {}, photos: {}, updated_at: null },
    rooms: [], units: [], pricing: null, availability: null,
    sections: {
      overview: section(true, true, 'available'), property_content: section(capabilitySet.edit_property_content, capabilitySet.edit_property_content, capabilitySet.edit_property_content ? 'available' : 'unavailable'), property_photos: section(false, false, 'unavailable'),
      rooms: section(false, false, 'unavailable'), rates_pricing: section(false, false, 'unavailable'), calendar_availability: section(false, false, 'unavailable'),
      bookings: section(false, false, 'existing_flow'), payments: section(false, false, 'existing_flow'), booking_changes: section(false, false, 'future_stage'), stripe_onboarding: section(false, false, 'future_stage'),
    },
    recent_activity: [], legacy_authoritative: true, public_change: false,
  };
}

describe('Hotels V2 H3.2B Partner workspace client', () => {
  const Core = loadCore();

  test('accepts the exact inert no-capability workspace and rejects unexpected envelopes', () => {
    const workspace = {
      contract_version: Core.CONTRACTS.workspace,
      partner: { id: PARTNER, role: 'partner' }, hotel_id: HOTEL,
      assignment: { id: ASSIGNMENT, permission_version: 1, capabilities: caps(), access_snapshot_token: TOKEN },
      feature_flags: { hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: false, hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false },
      content_snapshot_token: TOKEN,
      property: {
        id: HOTEL, slug: 'exact-hotel', title_i18n: { pl: 'Obiekt', en: 'Property', he: 'נכס' }, description_i18n: { pl: '', en: '', he: '' },
        city: 'Paphos', address_line: null, district: null, postal_code: null, country: 'Cyprus', latitude: null, longitude: null,
        google_maps_url: null, amenities: [], check_in_from: '14:00', check_out_until: '11:00', cover_image_url: null, photos: [],
        architecture_version: 'legacy', status: 'approved', is_published: true, updated_at: '2026-08-25T12:00:00Z',
      },
      property_draft: { exists: false, id: null, status: null, version: 0, source_property_updated_at: null, content: {}, photos: {}, updated_at: null },
      rooms: [], units: [], pricing: null, availability: null,
      sections: {
        overview: section(true, true, 'available'), property_content: section(false, false, 'unavailable'), property_photos: section(false, false, 'unavailable'),
        rooms: section(false, false, 'unavailable'), rates_pricing: section(false, false, 'unavailable'), calendar_availability: section(false, false, 'unavailable'),
        bookings: section(false, false, 'existing_flow'), payments: section(false, false, 'existing_flow'),
        booking_changes: section(false, false, 'future_stage'), stripe_onboarding: section(false, false, 'future_stage'),
      },
      recent_activity: [], legacy_authoritative: true, public_change: false,
    };
    expect(Core.validateWorkspace(workspace, { partnerId: PARTNER, hotelId: HOTEL })).toEqual(workspace);
    expect(() => Core.validateWorkspace({ ...workspace, raw_bookings: [] }, { partnerId: PARTNER, hotelId: HOTEL })).toThrow('unexpected field envelope');
  });

  test('binds a server-generated property proposal target while comparing reordered payload keys canonically', () => {
    const draft = Core.validateDraft('content', {
      contract_version: Core.CONTRACTS.contentDraft, partner_id: PARTNER, hotel_id: HOTEL,
      access_snapshot_token: TOKEN, content_snapshot_token: TOKEN,
      intent: { entity: 'property_content', action: 'update', id: HOTEL, payload: { city: 'Paphos', amenities: ['wifi'] }, reason: 'Reviewed content proposal' },
    });
    const operation = { entity: 'property_content', action: 'update', id: TARGET, expected_version: 0, expected_original: {}, payload: { amenities: ['wifi'], city: 'Paphos' }, reason: draft.intent.reason };
    const preview = {
      contract_version: Core.CONTRACTS.contentPreview, partner_id: PARTNER, hotel_id: HOTEL, changed: true, blocking_reasons: [],
      impacts: [{ entity: 'property_content', action: 'update', id: TARGET, changed: true, fields: ['amenities', 'city'], before: {}, after: operation.payload, affected_room_type_ids: [], affected_room_rate_ids: [], from: null, to: null }],
      reviewed_plan: {
        contract_version: Core.CONTRACTS.contentPlan, review_id: REVIEW, partner_id: PARTNER, hotel_id: HOTEL, assignment_id: ASSIGNMENT,
        permission_version: 1, access_snapshot_token: TOKEN, domain_snapshot_token: TOKEN, reviewed_at: '2026-08-25T12:01:00Z',
        expires_at: '2026-08-25T12:06:00Z', operations: [operation], plan_fingerprint: PLAN_TOKEN,
      },
    };
    expect(Core.validatePlanPreview('content', preview, draft).reviewed_plan.operations[0].id).toBe(TARGET);
  });

  test('validates exact non-negative server commercial arithmetic and rejects a fabricated commission', () => {
    const summary = {
      policy: { id: TARGET, code: 'CE10', commission_mode: 'percent_booking_total', amount: 10, currency: 'EUR', version: 1, fingerprint: TOKEN, read_only: true },
      calculation_basis: { code: 'booking_total', quantity: 1, unit_amount: 10, booking_total: 100 },
      customer_price: 100, cypruseye_commission: 10, partner_net: 90, currency: 'EUR',
    };
    const draft = Core.validateDraft('pricing', {
      contract_version: Core.CONTRACTS.pricingDraft, partner_id: PARTNER, hotel_id: HOTEL, access_snapshot_token: TOKEN,
      pricing_snapshot_token: TOKEN, intent: { entity: 'room_rate_price', action: 'update', id: TARGET, payload: { nightly_rate: 100 }, reason: 'Reviewed exact price' }, example_stay: null,
    });
    const operation = { entity: 'room_rate_price', action: 'update', id: TARGET, expected_version: 1, expected_original: {}, payload: { nightly_rate: 100 }, reason: draft.intent.reason };
    const preview: any = {
      contract_version: Core.CONTRACTS.pricingPreview, partner_id: PARTNER, hotel_id: HOTEL, changed: true, blocking_reasons: [],
      impacts: [{ entity: operation.entity, action: operation.action, id: TARGET, changed: true, fields: ['nightly_rate'], before: {}, after: operation.payload, affected_room_type_ids: [], affected_room_rate_ids: [TARGET], from: null, to: null }],
      reviewed_plan: { contract_version: Core.CONTRACTS.pricingPlan, review_id: REVIEW, partner_id: PARTNER, hotel_id: HOTEL, assignment_id: ASSIGNMENT, permission_version: 1, access_snapshot_token: TOKEN, domain_snapshot_token: TOKEN, reviewed_at: '2026-08-25T12:01:00Z', expires_at: '2026-08-25T12:06:00Z', operations: [operation], plan_fingerprint: PLAN_TOKEN },
      commercial_before: summary, commercial_after: summary, example_before: null, example_after: null,
    };
    expect(Core.validatePlanPreview('pricing', preview, draft).commercial_after.partner_net).toBe(90);
    expect(() => Core.validatePlanPreview('pricing', { ...preview, commercial_after: { ...summary, cypruseye_commission: 11, partner_net: 89 } }, draft)).toThrow('internally inconsistent');

    const halfCent = { ...summary, calculation_basis: { ...summary.calculation_basis, booking_total: 10.05 }, customer_price: 10.05, cypruseye_commission: 1.01, partner_net: 9.04 };
    expect(Core.validatePlanPreview('pricing', { ...preview, commercial_before: halfCent, commercial_after: halfCent }, draft).commercial_after.cypruseye_commission).toBe(1.01);

    const exampleStay = { contract_version: Core.CONTRACTS.commercialRequest, partner_id: PARTNER, hotel_id: HOTEL, pricing_snapshot_token: TOKEN, rate_plan_id: null, allocation_rule_id: null, selected_room_type_id: null, check_in: '2026-09-01', check_out: '2026-09-03', adults: 2, child_ages: [] };
    const draftWithExample = Core.validateDraft('pricing', { ...draft, example_stay: exampleStay });
    const noOp = { contract_version: Core.CONTRACTS.pricingPreview, partner_id: PARTNER, hotel_id: HOTEL, changed: false, blocking_reasons: [], impacts: [], reviewed_plan: null, commercial_before: null, commercial_after: null, example_before: null, example_after: null };
    expect(Core.validatePlanPreview('pricing', noOp, draftWithExample).changed).toBe(false);
    expect(() => Core.validatePlanPreview('pricing', preview, draftWithExample)).toThrow('exact requested example stay');
  });

  test('rejects an availability date outside its exact snapshot range before RPC', () => {
    expect(() => Core.validateDraft('availability', {
      contract_version: Core.CONTRACTS.availabilityDraft, partner_id: PARTNER, hotel_id: HOTEL, access_snapshot_token: TOKEN,
      from: '2026-08-25', to: '2026-09-24', availability_snapshot_token: TOKEN,
      intent: { entity: 'daily_inventory', action: 'upsert', id: null, payload: { room_type_id: TARGET, stay_date: '2026-09-25', closed: true, closed_mode: 'set' }, reason: 'Reviewed daily closure' },
    })).toThrow('outside the exact reviewed range');
  });

  test('keeps primary PL/HE and media/review controls source-scoped', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'js/hotels-v2-partner-workspace.js'), 'utf8');
    const media = fs.readFileSync(path.join(process.cwd(), 'js/hotels-v2-partner-media.js'), 'utf8');
    const html = fs.readFileSync(path.join(process.cwd(), 'partners/index.html'), 'utf8');
    expect(ui).toContain("he: {");
    expect(ui).toContain("state.root.dir = state.language === 'he' ? 'rtl' : 'ltr'");
    expect(ui).toContain('data-phw-upload-property');
    expect(ui).toContain('data-phw-upload-room');
    expect(ui).toContain('orderedPhotos(form');
    expect(media).toContain('3840'); expect(media).toContain('2160'); expect(media).toContain('upsert: false');
    expect(media).toContain('MAX_WEBP_BYTES = 10 * 1024 * 1024');
    expect(media).toContain('webp.size > MAX_WEBP_BYTES');
    expect(media).not.toContain('.remove('); expect(media).not.toMatch(/retry/i);
    expect(html).toContain('/admin/hotels-v2-workspace-core.js?v=20260826_1');
    expect(html).toContain('/js/hotels-v2-partner-media.js?v=20260825_1');
    expect(ui).toContain("`${text('bedConfiguration')}: ${room.bed_configuration.length");
    expect(ui).toContain("room.bathrooms == null ? `${text('missingUnknown')}");
    expect(ui).toContain("room.size_sqm == null ? `${text('missingUnknown')}");
    expect(ui).toContain('data-phw-add-bed');
    expect(ui).toContain('data-phw-remove-bed');
    expect(ui).toContain('bed_configuration: beds, bathrooms: nullableNumber');
    expect(ui).toContain("bed_configuration: [], bathrooms: Number(data.get('bathrooms'))");
    expect(ui).toContain('Core.compactI18n');
    expect(ui).toContain('floor_label_i18n: {}');
    expect(ui).toContain("text('missingUnknown')");
    expect(ui).toContain("text('confirmed')");
    expect(ui).toContain('data-phw-room-rate-product');
    expect(ui).toContain('data-phw-commission-policy');
    expect(ui).toContain("text(row.is_active ? 'active' : 'inactive')");
    expect(ui).toContain("row.base_nightly_rate_authoritative ? 'editableBasePrice' : 'tierOwnedPrice'");
    expect(ui).toContain("commercialColumns(commercial, true)");
    expect(ui).toContain("text(exactStay ? 'exactStayCustomerTotal' : 'customerSellingPrice')");
    expect(ui).toContain("`${amount} ${text('perRoomNight')}`");
    expect(ui).not.toMatch(/name=["'](?:commission|commission_mode|commission_amount|partner_net|customer_price)["']/);

    const adminUi = fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace.js'), 'utf8');
    expect(adminUi).toContain("pricingLifecycleLabel(rate.lifecycle_status)");
    expect(adminUi).toContain("pricingUiHtml('Customer selling price')");
    expect(adminUi).toContain('h3CommissionLabel(commission)');
    expect(adminUi).toContain("policy.commission_mode === 'percent_booking_total'");
  });

  test('uses one exact reviewed RPC request and never retries a stale preview', async () => {
    const calls: any[] = [];
    const repository = loadRepository({
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === 'hotel_v2_partner_get_workspace') return { data: emptyWorkspace(['edit_property_content']), error: null };
        return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_2b_stale_content_snapshot' } };
      },
    });
    const draft = {
      contract_version: 'hotels_v2_h3_2b_content_draft_v1', partner_id: PARTNER, hotel_id: HOTEL,
      access_snapshot_token: TOKEN, content_snapshot_token: TOKEN,
      intent: { entity: 'property_content', action: 'update', id: HOTEL, payload: { city: 'Paphos' }, reason: 'Reviewed content proposal' },
    };
    await repository.getWorkspace(PARTNER, HOTEL, '2026-08-25', '2026-09-24');
    await expect(repository.previewContentPlan(draft)).rejects.toMatchObject({ isStale: true, isAmbiguousOutcome: false });
    expect(calls.filter((call) => call.name === 'hotel_v2_partner_preview_content_plan')).toEqual([{ name: 'hotel_v2_partner_preview_content_plan', payload: { p_draft: draft } }]);
  });

  test('treats an invalid success receipt as possibly committed and never retries Save', async () => {
    const calls: any[] = [];
    const draft = {
      contract_version: 'hotels_v2_h3_2b_content_draft_v1', partner_id: PARTNER, hotel_id: HOTEL,
      access_snapshot_token: TOKEN, content_snapshot_token: TOKEN,
      intent: { entity: 'property_content', action: 'update', id: HOTEL, payload: { city: 'Paphos' }, reason: 'Reviewed content proposal' },
    };
    const exactWorkspace = emptyWorkspace(['edit_property_content']);
    const operation = { entity: 'property_content', action: 'update', id: TARGET, expected_version: 0, expected_original: exactWorkspace.property_draft, payload: draft.intent.payload, reason: draft.intent.reason };
    const reviewedPlan = { contract_version: 'hotels_v2_h3_2b_content_plan_v1', review_id: REVIEW, partner_id: PARTNER, hotel_id: HOTEL, assignment_id: ASSIGNMENT, permission_version: 1, access_snapshot_token: TOKEN, domain_snapshot_token: TOKEN, reviewed_at: '2026-08-25T12:01:00Z', expires_at: '2026-08-25T12:06:00Z', operations: [operation], plan_fingerprint: PLAN_TOKEN };
    const preview = { contract_version: 'hotels_v2_h3_2b_content_preview_v1', partner_id: PARTNER, hotel_id: HOTEL, changed: true, blocking_reasons: [], impacts: [{ entity: operation.entity, action: operation.action, id: TARGET, changed: true, fields: ['city'], before: { city: 'Paphos' }, after: operation.payload, affected_room_type_ids: [], affected_room_rate_ids: [], from: null, to: null }], reviewed_plan: reviewedPlan };
    const repository = loadRepository({
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === 'hotel_v2_partner_get_workspace') return { data: exactWorkspace, error: null };
        if (name === 'hotel_v2_partner_preview_content_plan') return { data: preview, error: null };
        return { data: { invalid_success_receipt: true }, error: null };
      },
    });
    await repository.getWorkspace(PARTNER, HOTEL, '2026-08-25', '2026-09-24');
    const reviewed = await repository.previewContentPlan(draft);
    await expect(repository.applyContentPlan(reviewed.reviewed_plan, REVIEW, IDEMPOTENCY)).rejects.toMatchObject({ saveSucceeded: true, isAmbiguousOutcome: false });
    expect(calls.filter((call) => call.name === 'hotel_v2_partner_apply_content_plan')).toHaveLength(1);
  });
});
