import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '11111111-1111-4111-8111-111111111111';
const BOOKING = '22222222-2222-4222-8222-222222222222';
const UPPER = '33333333-3333-4333-8333-333333333333';
const GROUND = '44444444-4444-4444-8444-444444444444';
const RATE_PLAN = '55555555-5555-4555-8555-555555555555';
const UPPER_RATE = '66666666-6666-4666-8666-666666666666';
const GROUND_RATE = '77777777-7777-4777-8777-777777777777';
const ALLOCATION_A = '88888888-8888-4888-8888-888888888888';
const ALLOCATION_B = '99999999-9999-4999-8999-999999999999';

const HELP_FIELDS = [
  'title', 'what_this_is', 'what_it_changes', 'how_to_use', 'example',
  'review_or_activation_behavior', 'important_note',
];
const TOPIC_IDS = [
  'section.overview', 'section.property', 'section.rooms', 'section.pricing',
  'section.calendar', 'section.bookings', 'section.payments',
  'controls.property', 'controls.rooms', 'controls.pricing', 'controls.calendar',
  'controls.bookings', 'controls.payments',
];

function moduleSource(): string {
  return fs.readFileSync(path.join(process.cwd(), 'js/hotels-v2-workspace-help.js'), 'utf8');
}

function loadHelp(): any {
  const context: Record<string, any> = { console };
  context.globalThis = context;
  vm.runInNewContext(moduleSource(), context, { filename: 'js/hotels-v2-workspace-help.js' });
  return context.HotelsV2WorkspaceHelp;
}

function exactPresentation(): any {
  return {
    contract_version: 'hotels_v2_workspace_bookings_payments_presentation_v1',
    scope: 'partner',
    hotel_id: HOTEL,
    generated_at: '2026-08-31T09:15:00.000Z',
    capabilities: {
      bookings_visible: true,
      payments_visible: true,
      full_booking_management: true,
      full_payment_management: true,
    },
    summary: { total_bookings: 1, upcoming_bookings: 1, current_recent_bookings: 0 },
    bookings: [{
      booking_id: BOOKING,
      reference: 'CE-7A-2042',
      status: 'confirmed',
      arrival_date: '2026-09-12',
      departure_date: '2026-09-15',
      guest_count: 6,
      allocation: [
        { room_type_id: UPPER, room_name_i18n: { en: 'Upper Room', pl: 'Górny apartament', he: 'החדר העליון' }, units: 1 },
        { room_type_id: GROUND, room_name_i18n: { en: 'Ground Room', pl: 'Dolny apartament', he: 'חדר הקרקע' }, units: 1 },
      ],
      customer_total: 720,
      currency: 'EUR',
      payment: {
        state: 'partially_paid', paid: 200, remaining: 520,
        cypruseye_commission: 60, partner_net: 660, currency: 'EUR',
      },
    }],
  };
}

function availabilityAllocation(
  id: string,
  roomTypeId: string,
  roomRateId: string,
  guests: number,
): any {
  return {
    id,
    booking_id: BOOKING,
    arrival_date: '2026-09-12',
    departure_date: '2026-09-15',
    current_booking_updated_at: '2026-08-31T09:10:00.000Z',
    current_booking_status: 'confirmed',
    room_type_id: roomTypeId,
    rate_plan_id: RATE_PLAN,
    room_rate_id: roomRateId,
    unit_ids: [],
    units_required: 1,
    allocated_guest_counts: [guests],
    pricing_guest_counts: [guests],
    booking_updated_at: '2026-08-31T09:00:00.000Z',
    status: 'active',
    version: 1,
    updated_at: '2026-08-31T09:10:00.000Z',
    active_commitment_from: '2026-09-12',
    active_commitment_to: '2026-09-14',
    active_commitments: [],
  };
}

function availability(): any {
  return {
    contract_version: 'hotels_v2_admin_d_availability_control_v1',
    hotel_id: HOTEL,
    from: '2026-08-31',
    to: '2026-09-30',
    snapshot_token: 'a'.repeat(64),
    snapshot_as_of: '2026-08-31T09:15:00.000Z',
    snapshot_valid_until: null,
    property: {},
    room_types: [],
    room_rates: [],
    units: [],
    cells: [],
    product_cells: [],
    daily_inventory: [],
    unit_calendar_blocks: [],
    operational_overrides: [],
    rate_rule_operational_restrictions: [],
    booking_allocations: [
      availabilityAllocation(ALLOCATION_A, UPPER, UPPER_RATE, 4),
      availabilityAllocation(ALLOCATION_B, GROUND, GROUND_RATE, 2),
    ],
    holds: [],
    unmapped_booking_blockers: [],
    recent_activity: [],
    public_change: false,
  };
}

function availabilityOptions(overrides: Record<string, unknown> = {}): any {
  return {
    hotelId: HOTEL,
    scope: 'partner',
    availability: availability(),
    rooms: [
      { id: UPPER, hotel_id: HOTEL, name_i18n: { en: 'Upper Room', pl: 'Górny apartament', he: 'החדר העליון' } },
      { id: GROUND, hotel_id: HOTEL, name_i18n: { en: 'Ground Room', pl: 'Dolny apartament', he: 'חדר הקרקע' } },
    ],
    bookingsVisible: true,
    paymentsVisible: false,
    fullBookingManagement: true,
    fullPaymentManagement: true,
    upcomingBookings: null,
    ...overrides,
  };
}

describe('Hotels V2 centralized workspace help', () => {
  test('has complete native EN/PL/HE structured content for every section and grouped control topic', () => {
    const Help = loadHelp();
    expect(Help.LANGUAGES).toEqual(['en', 'pl', 'he']);
    expect(Object.keys(Help.TOPICS).sort()).toEqual([...TOPIC_IDS].sort());
    for (const language of Help.LANGUAGES) {
      for (const id of TOPIC_IDS) {
        const value = Help.topic(id, language);
        expect(Object.keys(value).sort()).toEqual([...HELP_FIELDS].sort());
        HELP_FIELDS.forEach((field) => expect(value[field].trim().length).toBeGreaterThan(2));
        expect(Object.isFrozen(value)).toBe(true);
      }
    }
    expect(Help.direction('he')).toBe('rtl');
    expect(Help.direction('pl')).toBe('ltr');
    expect(Help.topic('section.overview', 'unsupported')).toEqual(Help.topic('section.overview', 'en'));
    expect(() => Help.topic('section.unknown', 'en')).toThrow(/Unknown help topic/);

    const polish = TOPIC_IDS.map((id) => Object.values(Help.topic(id, 'pl')).join(' ')).join(' ');
    const hebrew = TOPIC_IDS.map((id) => Object.values(Help.topic(id, 'he')).join(' ')).join(' ');
    expect(polish).toMatch(/[ąćęłńóśźż]/i);
    expect(hebrew).toMatch(/[\u0590-\u05ff]/);
  });

  test('states accepted pricing, commission, proposal and inbound-calendar behavior without technical material', () => {
    const Help = loadHelp();
    const allHelp = TOPIC_IDS.flatMap((id) => Help.LANGUAGES
      .map((language: string) => Object.values(Help.topic(id, language)).join(' '))).join('\n');
    expect(allHelp).not.toMatch(/https?:\/\/|www\./i);
    expect(allHelp).not.toMatch(/\b(?:RPC|Vault|receipt|secret|secret_id)\b|hotel_v2_|hotels_v2_|private_schema|supabase|HOTELS_V2_ICAL_SYNC_SECRET/i);

    const pricing = Object.values(Help.topic('controls.pricing', 'en')).join(' ');
    expect(pricing).toMatch(/Upper.*Ground|Ground.*Upper/i);
    expect(pricing).toMatch(/Preview/i);
    expect(pricing).toMatch(/reason/i);
    expect(pricing).toMatch(/Admin review/i);
    expect(pricing).toMatch(/Accept/i);
    expect(pricing).toMatch(/Reject/i);
    expect(pricing).toMatch(/only an accepted proposal changes the live customer price/i);
    expect(pricing).toMatch(/EUR 10.*allocated Room.*rental night/i);
    expect(pricing).toMatch(/both Rooms.*two commission units/i);
    expect(pricing).toMatch(/server-derived/i);
    expect(pricing).toMatch(/read-only/i);

    const calendar = Object.values(Help.topic('controls.calendar', 'en')).join(' ');
    expect(calendar).toMatch(/Booking\.com/);
    expect(calendar).toMatch(/Airbnb/);
    expect(calendar).toMatch(/Generic iCal/);
    expect(calendar).toMatch(/inbound/i);
    expect(calendar).not.toMatch(/bidirectional|two-way/i);
    expect(calendar).toMatch(/never returned/i);
    expect(calendar).toMatch(/manual sync/i);
    expect(calendar).toMatch(/Admin Preview/i);
    expect(calendar).toMatch(/Accept/i);
    expect(calendar).toMatch(/Reject/i);

    const bookings = Object.values(Help.topic('controls.bookings', 'en')).join(' ');
    expect(bookings).toMatch(/Pending.*Confirmed.*Completed.*Cancelled/i);
  });

  test('builds a real localized section button with the shared accessible hooks', () => {
    const Help = loadHelp();
    const button = Help.helpButton('section.bookings', { language: 'he', section: true });
    expect(button).toContain('<button');
    expect(button).toContain('type="button"');
    expect(button).toContain('class="hotels-v2-help-trigger"');
    expect(button).toContain('data-hv2-help-topic="section.bookings"');
    expect(button).toContain('data-hv2-section-help');
    expect(button).toContain('aria-expanded="false"');
    expect(button).toContain('aria-controls="hotels-v2-workspace-help-dialog"');
    expect(button).toMatch(/[\u0590-\u05ff]/);
    expect(() => Help.helpButton('section.bookings', { unexpected: true })).toThrow();
  });

  test('strictly validates the exact Hotel-scoped read presentation while preserving nullable values', () => {
    const Help = loadHelp();
    const result = Help.validatePresentation(exactPresentation(), { hotelId: HOTEL, scope: 'partner' });
    expect(result.bookings[0].allocation.map((row: any) => row.room_type_id)).toEqual([UPPER, GROUND]);
    expect(result.bookings[0].payment).toEqual(expect.objectContaining({
      paid: 200, remaining: 520, cypruseye_commission: 60, partner_net: 660,
    }));
    expect(Object.isFrozen(result)).toBe(true);

    const unavailableFields = exactPresentation();
    unavailableFields.bookings[0].reference = null;
    unavailableFields.bookings[0].status = null;
    unavailableFields.bookings[0].guest_count = null;
    unavailableFields.bookings[0].customer_total = null;
    unavailableFields.bookings[0].currency = null;
    unavailableFields.bookings[0].payment = null;
    expect(Help.validatePresentation(unavailableFields, { hotelId: HOTEL, scope: 'partner' })
      .bookings[0].guest_count).toBeNull();

    const foreign = exactPresentation(); foreign.hotel_id = GROUND;
    expect(() => Help.validatePresentation(foreign, { hotelId: HOTEL, scope: 'partner' })).toThrow();
    const unknownBooking = exactPresentation(); unknownBooking.bookings[0].email = 'private@example.test';
    expect(() => Help.validatePresentation(unknownBooking, { hotelId: HOTEL, scope: 'partner' })).toThrow();
    const unknownPayment = exactPresentation(); unknownPayment.bookings[0].payment.secret = 'no';
    expect(() => Help.validatePresentation(unknownPayment, { hotelId: HOTEL, scope: 'partner' })).toThrow();
    const hiddenPayment = exactPresentation(); hiddenPayment.capabilities.payments_visible = false;
    expect(() => Help.validatePresentation(hiddenPayment, { hotelId: HOTEL, scope: 'partner' })).toThrow();
  });

  test('creates an unavailable presentation without fabricating zero or Partner counts', () => {
    const Help = loadHelp();
    const partner = Help.unavailablePresentation({
      hotelId: HOTEL,
      scope: 'partner',
      bookingsVisible: false,
      paymentsVisible: false,
      fullBookingManagement: true,
      fullPaymentManagement: true,
      upcomingBookings: null,
    });
    expect(partner.summary).toEqual({
      total_bookings: null, upcoming_bookings: null, current_recent_bookings: null,
    });
    expect(partner.bookings).toEqual([]);
    expect(() => Help.unavailablePresentation({
      hotelId: HOTEL,
      scope: 'partner',
      bookingsVisible: true,
      paymentsVisible: false,
      fullBookingManagement: true,
      fullPaymentManagement: true,
      upcomingBookings: 0,
    })).toThrow(/cannot synthesize/i);

    const admin = Help.unavailablePresentation({
      hotelId: HOTEL,
      scope: 'admin',
      bookingsVisible: true,
      paymentsVisible: false,
      fullBookingManagement: true,
      fullPaymentManagement: true,
      upcomingBookings: 3,
    });
    expect(admin.summary).toEqual({
      total_bookings: null, upcoming_bookings: 3, current_recent_bookings: null,
    });
  });

  test('maps only exact range-limited availability allocations and never invents commercial data', () => {
    const Help = loadHelp();
    const result = Help.presentationFromAvailability(availabilityOptions());
    expect(result.summary).toEqual({
      total_bookings: null, upcoming_bookings: null, current_recent_bookings: null,
    });
    expect(result.capabilities.payments_visible).toBe(false);
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]).toEqual(expect.objectContaining({
      booking_id: BOOKING,
      reference: null,
      status: 'confirmed',
      guest_count: 6,
      customer_total: null,
      currency: null,
      payment: null,
    }));
    expect(result.bookings[0].allocation.map((row: any) => [row.room_type_id, row.units]))
      .toEqual([[UPPER, 1], [GROUND, 1]]);

    const foreignRoom = availabilityOptions(); foreignRoom.rooms[0].hotel_id = GROUND;
    expect(() => Help.presentationFromAvailability(foreignRoom)).toThrow(/another Hotel/i);
    const smuggled = availabilityOptions(); smuggled.availability.booking_allocations[0].customer_email = 'private@example.test';
    expect(() => Help.presentationFromAvailability(smuggled)).toThrow(/unexpected field envelope/i);
    const payments = availabilityOptions({ paymentsVisible: true });
    expect(() => Help.presentationFromAvailability(payments)).toThrow(/cannot provide a payment/i);

    const commercial = exactPresentation();
    expect(Help.validatePresentation(commercial, { hotelId: HOTEL, scope: 'partner' })
      .bookings[0].currency).toBe('EUR');
    commercial.bookings[0].currency = null;
    expect(() => Help.validatePresentation(commercial, { hotelId: HOTEL, scope: 'partner' }))
      .toThrow(/customer total requires an exact currency/i);
  });

  test('controller source enforces one modal surface, Escape/outside close and focus restoration', () => {
    const source = moduleSource();
    expect(source).toContain("documentObject.createElement('dialog')");
    expect(source).toContain("dialog.setAttribute('aria-modal', 'true')");
    expect(source).toContain("closeButton.setAttribute('data-hv2-help-close', '')");
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('event.target === shared.dialog');
    expect(source).toContain('!shared.surface.contains(event.target)');
    expect(source).toContain('shared.closeButton.focus()');
    expect(source).toContain('trigger.focus()');
    expect(source).toContain('SHARED_SURFACES');
  });
});
