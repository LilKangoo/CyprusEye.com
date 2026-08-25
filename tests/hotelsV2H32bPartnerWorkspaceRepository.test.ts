import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT = '33333333-3333-4333-8333-333333333333';
const TARGET = '44444444-4444-4444-8444-444444444444';
const REVIEW = '55555555-5555-4555-8555-555555555555';
const CORRELATION = '66666666-6666-4666-8666-666666666666';
const IDEMPOTENCY = '77777777-7777-4777-8777-777777777777';
const ACTIVITY = '88888888-8888-4888-8888-888888888888';
const TOKEN = 'a'.repeat(64);
const FINGERPRINT = 'b'.repeat(64);

function loadRepository(client: any): any {
  const context: Record<string, any> = {
    console, TextEncoder, crypto: { randomUUID: () => CORRELATION }, window: { getSupabase: () => client },
  };
  for (const relative of [
    'admin/hotels-v2-workspace-core.js',
    'js/hotels-v2-partner-workspace-core.js',
    'js/hotels-v2-partner-workspace-repository.js',
  ]) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return context.HotelsV2PartnerWorkspaceRepository;
}

function capabilities(): Record<string, boolean> {
  return Object.fromEntries([
    'edit_property_content', 'edit_property_photos', 'edit_room_content', 'edit_room_photos',
    'create_rooms', 'edit_room_structure', 'manage_prices', 'manage_availability',
    'process_bookings', 'request_booking_changes', 'view_payment_status', 'initiate_stripe_onboarding',
  ].map((key) => [key, key === 'edit_property_content']));
}

function workspace(): any {
  const caps = capabilities();
  const section = (visible: boolean, available: boolean, status: string) => ({ visible, available, status });
  return {
    contract_version: 'hotels_v2_h3_2b_partner_workspace_v1', partner: { id: PARTNER, role: 'partner' }, hotel_id: HOTEL,
    assignment: { id: ASSIGNMENT, permission_version: 1, capabilities: caps, access_snapshot_token: TOKEN },
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
      overview: section(true, true, 'available'), property_content: section(true, true, 'available'), property_photos: section(false, false, 'unavailable'),
      rooms: section(false, false, 'unavailable'), rates_pricing: section(false, false, 'unavailable'), calendar_availability: section(false, false, 'unavailable'),
      bookings: section(false, false, 'existing_flow'), payments: section(false, false, 'existing_flow'),
      booking_changes: section(false, false, 'future_stage'), stripe_onboarding: section(false, false, 'future_stage'),
    },
    recent_activity: [], legacy_authoritative: true, public_change: false,
  };
}

function draft(): any {
  return {
    contract_version: 'hotels_v2_h3_2b_content_draft_v1', partner_id: PARTNER, hotel_id: HOTEL,
    access_snapshot_token: TOKEN, content_snapshot_token: TOKEN,
    intent: { entity: 'property_content', action: 'update', id: HOTEL, payload: { city: 'Limassol' }, reason: 'Reviewed exact proposal' },
  };
}

function preview(): any {
  const operation = {
    entity: 'property_content', action: 'update', id: TARGET, expected_version: 0,
    expected_original: workspace().property_draft, payload: draft().intent.payload, reason: draft().intent.reason,
  };
  return {
    contract_version: 'hotels_v2_h3_2b_content_preview_v1', partner_id: PARTNER, hotel_id: HOTEL,
    changed: true, blocking_reasons: [],
    impacts: [{
      entity: operation.entity, action: operation.action, id: TARGET, changed: true, fields: ['city'],
      before: { city: 'Paphos' }, after: { city: 'Limassol' }, affected_room_type_ids: [], affected_room_rate_ids: [], from: null, to: null,
    }],
    reviewed_plan: {
      contract_version: 'hotels_v2_h3_2b_content_plan_v1', review_id: REVIEW, partner_id: PARTNER, hotel_id: HOTEL,
      assignment_id: ASSIGNMENT, permission_version: 1, access_snapshot_token: TOKEN, domain_snapshot_token: TOKEN,
      reviewed_at: '2026-08-25T12:01:00Z', expires_at: '2026-08-25T12:31:00Z', operations: [operation], plan_fingerprint: FINGERPRINT,
    },
  };
}

describe('Hotels V2 H3.2B independent Partner workspace repository', () => {
  test('exposes the H3.2B RPCs plus the three reviewed Stage 2D external-calendar RPCs', () => {
    const repository = loadRepository({ rpc: jest.fn() });
    expect(repository.RPC).toEqual({
      workspace: 'hotel_v2_partner_get_workspace',
      previewContent: 'hotel_v2_partner_preview_content_plan',
      applyContent: 'hotel_v2_partner_apply_content_plan',
      previewPricing: 'hotel_v2_partner_preview_pricing_plan',
      applyPricing: 'hotel_v2_partner_apply_pricing_plan',
      previewCommercialStay: 'hotel_v2_partner_preview_commercial_stay',
      previewAvailability: 'hotel_v2_partner_preview_availability_plan',
      applyAvailability: 'hotel_v2_partner_apply_availability_plan',
      externalCalendarControl: 'hotel_v2_partner_get_external_calendar_control',
      previewExternalCalendar: 'hotel_v2_partner_preview_external_calendar_plan',
      applyExternalCalendar: 'hotel_v2_partner_apply_external_calendar_plan',
    });
  });

  test('burns the exact reviewed plan before one mutation call and treats failed refresh as post-commit ambiguity', async () => {
    const calls: Array<{ name: string; payload: any }> = [];
    let workspaceCalls = 0;
    const value = preview();
    const repository = loadRepository({
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === 'hotel_v2_partner_get_workspace') {
          workspaceCalls += 1;
          if (workspaceCalls === 1) return { data: workspace(), error: null };
          return { data: null, error: { message: 'network connection lost during refresh' } };
        }
        if (name === 'hotel_v2_partner_preview_content_plan') return { data: value, error: null };
        if (name === 'hotel_v2_partner_apply_content_plan') {
          return {
            data: {
              contract_version: 'hotels_v2_h3_2b_content_apply_result_v1', partner_id: PARTNER, hotel_id: HOTEL,
              correlation_id: CORRELATION, idempotency_key: IDEMPOTENCY, replayed: false, changed: true,
              activity: [{
                id: ACTIVITY, hotel_id: HOTEL, entity_type: 'property', entity_id: HOTEL, action: 'update',
                actor_type: 'partner', source: 'hotels_v2_h3_2b_partner_workspace', correlation_id: CORRELATION,
                created_at: '2026-08-25T12:02:00Z',
              }],
              workspace: null,
            },
            error: null,
          };
        }
        throw new Error(`Unexpected RPC ${name}`);
      },
    });

    await repository.getWorkspace(PARTNER, HOTEL, '2026-08-25', '2026-09-24');
    const reviewed = await repository.previewContentPlan(draft());
    await expect(repository.applyContentPlan(reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY))
      .rejects.toMatchObject({ saveSucceeded: true, isAmbiguousOutcome: false });
    await expect(repository.applyContentPlan(reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY))
      .rejects.toThrow('Only the exact unchanged server-reviewed');
    expect(calls.filter((call) => call.name === 'hotel_v2_partner_apply_content_plan')).toHaveLength(1);
  });

  test('never retries a definitive stale Apply failure', async () => {
    const calls: string[] = [];
    const value = preview();
    const repository = loadRepository({
      async rpc(name: string) {
        calls.push(name);
        if (name === 'hotel_v2_partner_get_workspace') return { data: workspace(), error: null };
        if (name === 'hotel_v2_partner_preview_content_plan') return { data: value, error: null };
        return { data: null, error: { code: 'PT409', message: 'hotels_v2_h3_2b_content_stale' } };
      },
    });
    await repository.getWorkspace(PARTNER, HOTEL, '2026-08-25', '2026-09-24');
    const reviewed = await repository.previewContentPlan(draft());
    await expect(repository.applyContentPlan(reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY))
      .rejects.toMatchObject({ isStale: true, isDefinitiveFailure: true, isAmbiguousOutcome: false });
    expect(calls.filter((name) => name === 'hotel_v2_partner_apply_content_plan')).toHaveLength(1);
  });
});
