import fs from 'node:fs';

const core = fs.readFileSync('admin/hotels-v2-workspace-core.js', 'utf8');
const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
const css = fs.readFileSync('admin/admin.css', 'utf8');
const publicHotel = [
  fs.readFileSync('hotels.html', 'utf8'),
  fs.readFileSync('hotel.html', 'utf8'),
  fs.readFileSync('js/hotel-booking-ui.js', 'utf8'),
].join('\n');

describe('Hotels H2B.1 Admin UX static safety', () => {
  test('offers structural property and exact-room children policies through dedicated reviewed RPCs', () => {
    expect(core).toContain("const CHILDREN_POLICIES = Object.freeze(['allowed', 'not_allowed', 'minimum_age'])");
    expect(core).toContain('Property children policy has not been reviewed.');
    expect(ui).toContain('Adults only / No children');
    expect(ui).toContain('Children allowed from minimum age');
    expect(ui).toContain('Use property policy');
    expect(repository).toContain("applyGuestPolicy: 'hotel_v2_admin_apply_guest_policy_plan'");
    expect(repository).toContain("applyRoomType: 'hotel_v2_admin_apply_room_type_plan'");
    expect(ui).toContain('Core.buildRoomTypePlan(state.workspace, reviewedOperations[0])');
    expect(ui).toContain('Repository.applyRoomTypePlan(plan)');
    expect(ui).toContain('room_type_id: room.id, expected_version: room.version');
  });

  test('prepares exact two-apartment IDs with editable PL/EN/HE names and no automatic photos', () => {
    expect(core).toContain("upper_room_type: 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'");
    expect(core).toContain("ground_room_type: '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'");
    expect(core).toContain("pl: 'Apartament na piętrze'");
    expect(core).toContain("en: 'Upper Floor Apartment'");
    expect(core).toContain("he: 'דירה בקומה העליונה'");
    expect(core).toContain("pl: 'Apartament na parterze'");
    expect(core).toContain("he: 'דירה בקומת הקרקע'");
    expect(ui).toContain('Prepare 2 existing apartments');
    expect(ui).toContain('No photo is selected automatically');
    expect(ui).toContain('Adult/child split not confirmed');
    expect(repository).toContain("prepareLegacyShadowRooms: 'hotel_v2_admin_prepare_legacy_shadow_rooms'");
  });

  test('keeps the package shadow-only and explicitly separates legacy public pricing', () => {
    expect(ui).toContain('Legacy pricing remains live');
    expect(ui).toContain('Public: no change');
    expect(ui).toContain('Cancellation and payment terms remain BLOCKED for Review');
    expect(core).toContain("source_contract: SEVEN_ARCHES_SOURCE_CONTRACT");
    expect(core).toContain('expected_legacy_pricing_fingerprint');
    expect(core).toContain('expected_property_policy');
    expect(ui).toContain('property_minimum_child_age');
    expect(repository).toContain('normalized.userMessage = reviewedShadowUserMessage(message)');
    expect(repository).toContain('error.diagnosticContext = diagnosticContext');
    expect(ui).toContain("console.error('Reviewed Hotel save rejected.'");
    expect(ui).toContain('The reviewed save was rejected safely.');
    expect(core).toContain('prepare_pricing_preview: true');
    expect(publicHotel).not.toContain('hotel_v2_admin_prepare_legacy_shadow_rooms');
    expect(publicHotel).not.toContain('children_policy_override');
  });

  test('refreshes stale shadow reviews without silently retrying or losing selected photos', () => {
    expect(core).toContain('function sevenArchesShadowReconciliation');
    expect(core).toContain('property_gallery: normalizeGallery(workspaceValue.property.photos)');
    expect(ui).toContain('const freshWorkspace = await Repository.getWorkspace(plan.hotel_id)');
    expect(ui).toContain('Current data has been refreshed and your selected photos were preserved');
    expect(ui).toContain('nothing was retried automatically');
    expect(ui).toContain('retainedSevenArchesRoomReviews');
    expect(repository).toContain('Current data must be refreshed and reviewed again');
    expect(ui).not.toContain('Repository.prepareLegacyShadowRooms(plan).catch');
  });

  test('shows unresolved cancellation and shared shadow pricing without a fake Flexible or EUR 0 fallback', () => {
    expect(core).toContain("'requires_review'");
    expect(core).toContain('Cancellation terms require review');
    expect(core).toContain('pricing_schedule_id: normalizeUuid(source.pricing_schedule_id) || null');
    expect(core).toContain('Confirm cancellation terms before activating this Rate Plan.');
    expect(ui).toContain('Requires confirmation');
    expect(ui).toContain('Shared schedule');
    expect(ui).toContain('Shared ${scheduleTierCount}-tier shadow schedule');
    expect(ui).toContain('Its base rate is not an executable €0 price.');
    expect(ui).toContain('Generic Room Rate editing is locked until H3');
  });

  test('shows shared schedules as shadow configuration with exact room/date rows instead of a generic unresolved cell', () => {
    expect(core).toContain('function sharedScheduleCalendarDisplayState');
    expect(core).toContain("authoritative: false");
    expect(core).toContain("blocker: 'shared_room_pricing_schedule_requires_h3_resolution'");
    expect(ui).toContain('const overrideRow = maps.overrides.get(`${product.id}:${date}`) || null');
    expect(ui).toContain('Core.sharedScheduleCalendarDisplayState(product, date, overrideRow, inventoryRow)');
    expect(ui).toContain('Shared schedule · H3 pending');
    expect(ui).toContain('Exact date draft rate:');
    expect(ui).toContain('Exact room inventory:');
    expect(ui).toContain('Shadow only · not requestable until occupancy/allocation is resolved');
    expect(css).toContain('.hotel-calendar-cell.is-shadow-schedule');
  });

  test('provides responsive, RTL-safe apartment and policy layouts', () => {
    expect(css).toContain('.hotel-seven-arches-room-grid');
    expect(css).toContain('.hotel-child-policy-options');
    expect(css).toMatch(/@media \(max-width:760px\)[\s\S]*\.hotel-child-policy-options,\.hotel-seven-arches-room-grid,\.hotel-seven-arches-facts \{ grid-template-columns:1fr; \}/);
    expect(ui).toContain('dir="${language === \'he\' ? \'rtl\' : \'ltr\'}"');
  });
});
