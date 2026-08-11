import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dashboard = fs.readFileSync('admin/dashboard.html', 'utf8');
const admin = fs.readFileSync('admin/admin.js', 'utf8');
const core = fs.readFileSync('admin/hotels-v2-workspace-core.js', 'utf8');
const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
const publicFiles = ['index.html', 'hotels.html', 'hotel.html', 'js/home-hotels.js', 'js/hotel-booking-ui.js']
  .map((filename) => fs.readFileSync(filename, 'utf8'))
  .join('\n');

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const RGB_HOTEL_ID = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';

const SEVEN_ARCHES_THRESHOLDS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SEVEN_ARCHES_RATE_MATRIX = [
  { persons: 2, rates: [100, 90, 88, 84, 80, 76, 74, 72, 70] },
  { persons: 3, rates: [130, 113, 113, 104, 100, 95, 94, 90, 90] },
  { persons: 4, rates: [155, 135, 135, 120, 118, 114, 111, 107, 107] },
  { persons: 5, rates: [200, 180, 176, 168, 160, 152, 148, 144, 140] },
  { persons: 6, rates: [260, 226, 226, 208, 200, 190, 188, 180, 180] },
  { persons: 7, rates: [310, 270, 270, 240, 236, 228, 222, 214, 214] },
  { persons: 8, rates: [310, 270, 270, 240, 236, 228, 222, 214, 214] },
] as const;

const SEVEN_ARCHES_RULES = SEVEN_ARCHES_RATE_MATRIX.flatMap((matrixRow) =>
  SEVEN_ARCHES_THRESHOLDS.map((minNights, index) => ({
    persons: matrixRow.persons,
    min_nights: minNights,
    price_per_night: matrixRow.rates[index],
  })),
);

class FakeElement {
  innerHTML = '';
  value = '';
  hidden = false;
  dataset: Record<string, string> = {};
  addEventListener(): void {}
  querySelectorAll(): any[] { return []; }
  querySelector(): any { return null; }
  scrollIntoView(): void {}
  focus(): void {}
}

function loadUiForDirectoryRender(): { api: any; elements: Record<string, FakeElement> } {
  const elements: Record<string, FakeElement> = {
    hotelPropertyList: new FakeElement(),
    hotelPropertySearch: new FakeElement(),
    hotelPropertyArchitectureFilter: new FakeElement(),
    hotelPropertyReadinessFilter: new FakeElement(),
  };
  elements.hotelPropertyArchitectureFilter.value = 'all';
  elements.hotelPropertyReadinessFilter.value = 'all';
  const document = {
    getElementById: (id: string) => elements[id] || null,
    addEventListener: () => undefined,
    activeElement: null,
  };
  const context: Record<string, any> = {
    console,
    document,
    crypto: { randomUUID: () => '99999999-9999-4999-8999-999999999999' },
    Intl,
    window: {
      showToast: () => undefined,
      editHotel: () => undefined,
      toggleHotelPublish: () => undefined,
    },
  };
  for (const relative of [
    'js/hotel-pricing.js',
    'admin/hotels-v2-workspace-core.js',
    'admin/hotels-v2-workspace-repository.js',
    'admin/hotels-v2-workspace.js',
  ]) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return { api: context.HotelsV2Workspace, elements };
}

describe('Hotels V2 H2A Property Workspace UI/static contract', () => {
  test('loads Workspace dependencies before Admin and exposes one property directory', () => {
    const coreIndex = dashboard.indexOf('/admin/hotels-v2-workspace-core.js');
    const repositoryIndex = dashboard.indexOf('/admin/hotels-v2-workspace-repository.js');
    const uiIndex = dashboard.indexOf('/admin/hotels-v2-workspace.js');
    const adminIndex = dashboard.indexOf('/admin/admin.js');
    expect(coreIndex).toBeGreaterThan(0);
    expect(repositoryIndex).toBeGreaterThan(coreIndex);
    expect(uiIndex).toBeGreaterThan(repositoryIndex);
    expect(adminIndex).toBeGreaterThan(uiIndex);
    expect(dashboard).toContain('id="hotelPropertyDirectory"');
    expect(dashboard).toContain('id="hotelPropertyList"');
    expect(dashboard).toContain('id="hotelPropertyWorkspace"');
  });

  test('renders one property card even when summary contains many rooms and rate plans', () => {
    const { api, elements } = loadUiForDirectoryRender();
    api.state.properties = [{
      id: HOTEL_ID,
      slug: 'one-property',
      architecture_version: 'rooms_v2',
      title_i18n: { en: 'One Property' },
      city: 'Lefkara',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      is_published: false,
      room_type_count: 4,
      total_inventory: 12,
      rate_plan_count: 3,
      price_from: 105,
      readiness: { state: 'READY_FOR_CALENDAR', preparation_state: 'READY_FOR_CALENDAR' },
    }];
    api.renderPropertyList();
    const html = elements.hotelPropertyList.innerHTML;
    expect((html.match(/<article\b/g) || [])).toHaveLength(1);
    expect(html).toContain('data-property-id="11111111-1111-4111-8111-111111111111"');
    expect(html).toContain('<strong>4</strong> room types');
    expect(html).toContain('<strong>3</strong> rate plans');
    expect((html.match(/Open workspace/g) || [])).toHaveLength(1);
  });

  test('shows accepted legacy price inputs separately from empty Rooms V2 preparation', () => {
    const { api, elements } = loadUiForDirectoryRender();
    api.state.properties = [{
      id: HOTEL_ID,
      slug: '7-ukow',
      architecture_version: 'legacy',
      title_i18n: { en: '7 Arches' },
      city: 'Lefkara',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      is_published: true,
      room_type_count: 0,
      total_inventory: 0,
      rate_plan_count: 0,
      room_rate_count: 0,
      price_from: null,
      legacy_configuration: {
        pricing_model: 'tiered_by_nights',
        pricing_tiers: { currency: 'EUR', rules: SEVEN_ARCHES_RULES },
        pricing_extras: { currency: 'EUR', items: [] },
        room_types: [],
        max_persons: 8,
        currency: 'EUR',
      },
      readiness: { state: 'LEGACY', preparation_state: 'DRAFT' },
    }, {
      id: RGB_HOTEL_ID,
      slug: 'rgb-cabins-larnaka-centrum',
      architecture_version: 'legacy',
      title_i18n: { en: 'RGB Cabins – Larnaca City Centre' },
      city: 'Larnaca',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      is_published: false,
      room_type_count: 0,
      total_inventory: 0,
      rate_plan_count: 0,
      room_rate_count: 0,
      price_from: null,
      legacy_configuration: {
        pricing_model: 'flat_per_night',
        pricing_tiers: {
          currency: 'EUR',
          rules: [{
            persons: 2,
            min_nights: 2,
            price_per_night: 45,
            month_prices: {
              jan: 45, feb: 45, mar: 45, apr: 45, may: 50, jun: 60,
              jul: 60, aug: 60, sep: 50, oct: 45, nov: 45, dec: 45,
            },
          }],
        },
        pricing_extras: { currency: 'EUR', items: [] },
        room_types: [],
        max_persons: 2,
        currency: 'EUR',
      },
      readiness: { state: 'LEGACY', preparation_state: 'DRAFT' },
    }];

    api.renderPropertyList();
    const cards = elements.hotelPropertyList.innerHTML.split('<article').slice(1);
    expect(cards).toHaveLength(2);

    expect(SEVEN_ARCHES_RULES).toHaveLength(63);
    expect(cards[0]).toContain('Current public pricing');
    expect(cards[0]).toContain('€70.00');
    expect(cards[0]).toContain('63 legacy pricing rules');
    expect(cards[0]).toContain('Rooms V2 preparation');
    expect(cards[0]).toContain('Not configured');
    expect(cards[0]).not.toContain('— configured from');

    expect(cards[1]).toContain('Current public pricing');
    expect(cards[1]).toContain('€45.00');
    expect(cards[1]).toContain('1 legacy pricing rule');
    expect(cards[1]).toContain('Rooms V2 preparation');
    expect(cards[1]).toContain('Not configured');
    expect(cards[1]).not.toContain('— configured from');
  });

  test('uses normalized price_from only for Rooms V2 and never falls back to legacy JSON', () => {
    const { api, elements } = loadUiForDirectoryRender();
    api.state.properties = [{
      id: HOTEL_ID,
      slug: 'rooms-v2-draft',
      architecture_version: 'rooms_v2',
      title_i18n: { en: 'Rooms V2 Draft' },
      city: 'Lefkara',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      is_published: false,
      room_type_count: 1,
      total_inventory: 4,
      rate_plan_count: 1,
      room_rate_count: 1,
      price_from: 105,
      legacy_configuration: null,
      // Stale compatibility-looking fields must never become the Rooms V2
      // price source even if a malformed client response contains them.
      pricing_model: 'flat_per_night',
      pricing_tiers: { rules: [{ persons: 2, min_nights: 1, price_per_night: 1 }] },
      readiness: { state: 'READY_FOR_CALENDAR', preparation_state: 'READY_FOR_CALENDAR' },
    }];

    api.renderPropertyList();
    const html = elements.hotelPropertyList.innerHTML;
    expect(html).toContain('Rooms V2');
    expect(html).toContain('€105.00');
    expect(html).toContain('configured from');
    expect(html).not.toContain('Current public pricing');
    expect(html).not.toContain('€1.00');
  });

  test('keeps structured legacy room pricing visible without copying it into Rooms V2', () => {
    expect(ui).toContain('Current legacy rooms / pricing');
    expect(ui).toContain('Capacity not specified');
    expect(ui).toContain('Inventory not specified');
    expect(ui).toContain('Pricing inherited');
    expect(ui).toContain('selectedRoomTypeId: roomId');
    expect(ui).toContain('This is the current legacy configuration. Rooms V2 preparation below is separate and cannot overwrite it.');
    expect(ui).not.toMatch(/JSON\.stringify\(summary\.rooms\)/);
  });

  test('presents one Room Type with several property Rate Plans rather than duplicate room semantics', () => {
    expect(ui).toContain('One Room Type may use several Rate Plans.');
    expect(ui).toContain('Create once and connect to one or many Room Types.');
    expect(ui).toContain("state.workspace.room_rates.filter((rate) => rate.room_type_id === room.id)");
    expect(ui).toContain("state.workspace.room_rates.filter((rate) => rate.rate_plan_id === plan.id)");
    expect(core).toContain('This Room Type and Rate Plan are already connected.');
    expect(core).toContain('Cross-property room-rate combinations are not allowed.');
  });

  test('keeps PL/EN/HE fields structured and Hebrew RTL-safe', () => {
    expect(core).toContain("Object.freeze(['pl', 'en', 'he'])");
    expect(ui).toContain("language === 'he' ? 'rtl' : 'ltr'");
    expect(ui).toContain("readI18n(fd, 'title')");
    expect(ui).toContain("readI18n(fd, 'description')");
    expect(ui).not.toContain('JSON.stringify(name_i18n');
  });

  test('uses reviewed exact-ID operations and a single transactional repository save path', () => {
    expect(core).toContain("throw new Error('Every workspace operation requires an exact UUID.')");
    expect(core).toContain("expected_version: entity === 'property' ? null : (before ? Math.max(1, asInteger(before.version, 1)) : null)");
    expect(core).toContain('expected_property_updated_at: options.expectedPropertyUpdatedAt || normalized.property.updated_at || null');
    expect(repository).toContain("RPC.apply");
    expect(repository).toContain('p_plan: reviewedPlan');
    expect(repository).toContain('p_correlation_id: correlation');
    expect(repository).not.toContain('executeHotelMutationWithFallback');
    expect(repository).not.toMatch(/\.from\(['"]hotel_(?:room_types|units|rate_plans|room_rates)['"]\)/);
    expect(ui).toContain('function openReview');
    expect(ui).toContain('Repository.applyWorkspacePlan');
  });

  test('provides Room, Unit, Rate Plan, Room Rate and safe duplicate Review flows', () => {
    for (const declaration of [
      'function openRoomEditor',
      'function openUnitEditor',
      'function openRatePlanEditor',
      'function openRoomRateEditor',
      'function duplicateRoom',
      'function disableRoom',
    ]) expect(ui).toContain(declaration);
    expect(ui).toContain('Core.buildDuplicateRoom');
    expect(ui).toContain("Core.operationForEntity('room_type'");
    expect(ui).toContain("Core.operationForEntity('unit'");
    expect(ui).toContain("Core.operationForEntity('rate_plan'");
    expect(ui).toContain("Core.operationForEntity('room_rate'");
  });

  test('keeps legacy/public Hotels inert and never publishes Rooms V2 from H2A', () => {
    expect(ui).toContain("architecture === 'legacy'");
    expect(ui).toContain('Rooms V2 publication is not available in H2A');
    expect(ui).toContain('This is Admin readiness only. It never means the property is publicly live.');
    expect(ui).toContain('Migration preview · read only');
    expect(ui).toContain('Not migrated');
    expect(repository).not.toContain('hotel_rooms_v2_enabled');
    expect(repository).not.toContain('site_settings');
    expect(repository).not.toContain('is_published: true');
    expect(publicFiles).not.toContain('hotels-v2-workspace');
    expect(admin).toContain('HotelsV2Workspace');
    expect(admin).toContain("originalHotel?.architecture_version === 'rooms_v2'");
    expect(admin).toContain('isRoomsV2Draft ? false : !!hotel.is_published');
    expect(ui).toContain('Legacy editor unavailable');
    expect(ui).toContain("property.architecture_version === 'legacy'");
  });

  test('reviews final media URLs and keeps legacy editor dependencies initialized', () => {
    expect(admin).toContain('ensureHotelsAdminLegacyDependencies');
    expect(admin).toContain('uploadPropertyGallery');
    expect(admin).toContain('removePropertyGalleryUploads');
    expect(ui).toContain('openPropertyMediaEditor');
    expect(ui).toContain('uploadRoomGallery');
    expect(ui).not.toContain('prepareOperations: files.length');
    expect(ui).toContain('after: validated');
    expect(ui).toContain('onCancel: files.length ? cleanupUploaded : null');
    expect(ui).toContain('onApplyError: files.length ? cleanupRejectedUpload : null');
    expect(ui).toContain('if (error?.isDefinitiveFailure) await cleanupUploaded();');
    expect(ui).toContain('Uploaded media was preserved. Refresh Property Workspace before retrying');
    expect(ui).toContain('setModalSaving(overlay, true)');
    expect(admin).toContain('hotelAmenitiesCatalogueLoaded');
    expect(admin).toContain('Existing amenities will be preserved on save.');
  });

  test('deep-links exact Hotel payment settings through the existing central subsystem', () => {
    expect(ui).toContain('window.openHotelDepositSettings(propertyId)');
    expect(admin).toContain('async function openHotelDepositSettings(exactHotelId)');
    expect(admin).toContain("searchPartnerResources('hotels', hotelId)");
    expect(admin).toContain('resource.value = hotelId');
    expect(admin).toContain('applySelectedOverrideToForm();');
  });

  test('never grants browser code direct normalized-table access', () => {
    for (const table of ['hotel_room_types', 'hotel_units', 'hotel_rate_plans', 'hotel_room_rates']) {
      expect(repository).not.toContain(`from('${table}')`);
      expect(repository).not.toContain(`from("${table}")`);
    }
    expect(repository).toContain("list: 'hotel_v2_admin_get_property_list'");
    expect(repository).toContain("workspace: 'hotel_v2_admin_get_property_workspace'");
    expect(repository).toContain("apply: 'hotel_v2_admin_apply_workspace_plan'");
    expect(repository).toContain("createProperty: 'hotel_v2_admin_create_property_draft'");
  });
});
