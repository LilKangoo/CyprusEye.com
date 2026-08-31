import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '22222222-2222-4222-8222-222222222222';
const UPPER_ROOM_ID = '33333333-3333-4333-8333-333333333333';
const GROUND_ROOM_ID = '44444444-4444-4444-8444-444444444444';

const HELP_FIELDS = [
  'title',
  'what_this_is',
  'what_it_changes',
  'how_to_use',
  'example',
  'review_or_activation_behavior',
  'important_note',
] as const;

const SECTION_TOPICS = [
  'section.overview',
  'section.property',
  'section.rooms',
  'section.pricing',
  'section.calendar',
  'section.bookings',
  'section.payments',
] as const;

const CONTROL_TOPICS = [
  'controls.property',
  'controls.rooms',
  'controls.pricing',
  'controls.calendar',
  'controls.bookings',
  'controls.payments',
] as const;

function source(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}

function loadHelp(): any {
  const context: Record<string, any> = {
    console,
    Intl,
    URL,
    TextEncoder,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  vm.runInNewContext(source('js/hotels-v2-workspace-help.js'), context, {
    filename: 'js/hotels-v2-workspace-help.js',
  });
  return context.HotelsV2WorkspaceHelp;
}

function topic(api: any, id: string, language: string, role: 'partner' | 'admin'): any {
  const resolver = api?.getTopic || api?.topic;
  if (typeof resolver !== 'function') throw new Error('HotelsV2WorkspaceHelp must expose getTopic (or topic)');
  return resolver.call(api, id, language, role);
}

function presentation(overrides: Record<string, unknown> = {}): any {
  return {
    contract_version: 'hotels_v2_workspace_bookings_payments_presentation_v1',
    scope: 'partner',
    hotel_id: HOTEL_ID,
    generated_at: '2026-08-31T09:15:00.000Z',
    capabilities: {
      bookings_visible: true,
      payments_visible: true,
      full_booking_management: true,
      full_payment_management: true,
    },
    summary: {
      total_bookings: 1,
      upcoming_bookings: 1,
      current_recent_bookings: 0,
    },
    bookings: [{
      booking_id: BOOKING_ID,
      reference: 'CE-7A-2042',
      arrival_date: '2026-09-12',
      departure_date: '2026-09-15',
      status: 'confirmed',
      guest_count: 6,
      currency: 'EUR',
      customer_total: 720,
      allocation: [
        { room_type_id: UPPER_ROOM_ID, room_name_i18n: { en: 'Upper Room', pl: 'Górny apartament', he: 'החדר העליון' }, units: 1 },
        { room_type_id: GROUND_ROOM_ID, room_name_i18n: { en: 'Ground Room', pl: 'Dolny apartament', he: 'החדר התחתון' }, units: 1 },
      ],
      payment: {
        state: 'partially_paid',
        currency: 'EUR',
        paid: 200,
        remaining: 520,
        cypruseye_commission: 60,
        partner_net: 660,
      },
    }],
    ...overrides,
  };
}

describe('Hotels V2 centralized contextual help and presentation contract', () => {
  test('provides one complete data-driven EN/PL/HE registry for every required section and control topic', () => {
    const Help = loadHelp();
    expect(Help).toBeDefined();
    expect(typeof Help.helpButton).toBe('function');
    expect(typeof Help.createController).toBe('function');
    expect(typeof Help.validatePresentation).toBe('function');

    for (const language of ['en', 'pl', 'he']) {
      expect(Help.direction(language)).toBe(language === 'he' ? 'rtl' : 'ltr');
      for (const role of ['partner', 'admin'] as const) {
        for (const id of [...SECTION_TOPICS, ...CONTROL_TOPICS]) {
          const entry = topic(Help, id, language, role);
          expect(entry).toBeDefined();
          expect(Object.keys(entry).sort()).toEqual([...HELP_FIELDS].sort());
          for (const field of HELP_FIELDS) {
            expect(typeof entry[field]).toBe('string');
            expect(entry[field].trim().length).toBeGreaterThan(2);
          }
        }
      }
    }

    const polish = [...SECTION_TOPICS, ...CONTROL_TOPICS]
      .map((id) => Object.values(topic(Help, id, 'pl', 'partner')).join(' ')).join(' ');
    const hebrew = [...SECTION_TOPICS, ...CONTROL_TOPICS]
      .map((id) => Object.values(topic(Help, id, 'he', 'partner')).join(' ')).join(' ');
    expect(polish).toMatch(/[ąćęłńóśźż]/i);
    expect(hebrew).toMatch(/[\u0590-\u05ff]/);
    expect(topic(Help, 'section.overview', 'unsupported-language', 'partner'))
      .toEqual(topic(Help, 'section.overview', 'en', 'partner'));
  });

  test('states the accepted pricing, commission and inbound-calendar behavior without technical or secret material', () => {
    const Help = loadHelp();
    const allText: string[] = [];
    for (const language of ['en', 'pl', 'he']) {
      for (const role of ['partner', 'admin'] as const) {
        for (const id of [...SECTION_TOPICS, ...CONTROL_TOPICS]) {
          allText.push(Object.values(topic(Help, id, language, role)).join(' '));
        }
      }
    }
    const rendered = allText.join('\n');
    expect(rendered).not.toMatch(/https?:\/\/|www\./i);
    expect(rendered).not.toMatch(/\b(?:RPC|Vault|receipt|secret|secret_id)\b|hotel_v2_|hotels_v2_|private_schema|supabase|HOTELS_V2_ICAL_SYNC_SECRET/i);

    const pricing = Object.values(topic(Help, 'controls.pricing', 'en', 'partner')).join(' ');
    expect(pricing).toMatch(/Preview/i);
    expect(pricing).toMatch(/reason/i);
    expect(pricing).toMatch(/Admin review/i);
    expect(pricing).toMatch(/Accept|accepted/i);
    expect(pricing).toMatch(/Reject|rejected/i);
    expect(pricing).toMatch(/only an accepted proposal|accepted proposal.*live/i);
    expect(pricing).toMatch(/Upper/i);
    expect(pricing).toMatch(/Ground/i);
    expect(pricing).toMatch(/independent/i);

    expect(pricing).toMatch(/EUR\s*10/i);
    expect(pricing).toMatch(/allocated Room/i);
    expect(pricing).toMatch(/rental night/i);
    expect(pricing).toMatch(/both Rooms|two commission units/i);
    expect(pricing).toMatch(/server-derived|calculated by the server/i);
    expect(pricing).toMatch(/read-only/i);

    const calendar = Object.values(topic(Help, 'controls.calendar', 'en', 'partner')).join(' ');
    expect(calendar).toMatch(/Booking\.com/);
    expect(calendar).toMatch(/Airbnb/);
    expect(calendar).toMatch(/Generic iCal/);
    expect(calendar).toMatch(/inbound|imports? availability/i);
    expect(calendar).not.toMatch(/bidirectional|two-way/i);
    expect(calendar).toMatch(/private/i);
    expect(calendar).toMatch(/never (?:shown|displayed|returned)/i);
    expect(calendar).toMatch(/review/i);
    expect(calendar).toMatch(/enable|activation/i);
    expect(calendar).toMatch(/manual sync/i);
  });

  test('strictly validates the Hotel-scoped read presentation and preserves authoritative values', () => {
    const Help = loadHelp();
    const exact = presentation();
    const value = Help.validatePresentation(exact, { hotelId: HOTEL_ID, scope: 'partner' });
    expect(value.hotel_id).toBe(HOTEL_ID);
    expect(value.generated_at).toBe(exact.generated_at);
    expect(value.bookings[0].guest_count).toBe(6);
    expect(value.bookings[0].allocation.map((row: any) => row.room_name_i18n.en))
      .toEqual(['Upper Room', 'Ground Room']);
    expect(value.bookings[0].customer_total).toBe(720);
    expect(value.bookings[0].currency).toBe('EUR');
    expect(value.bookings[0].payment).toEqual(expect.objectContaining({
      paid: 200,
      remaining: 520,
      cypruseye_commission: 60,
      partner_net: 660,
    }));

    expect(() => Help.validatePresentation({ ...exact, raw_booking: {} }, { hotelId: HOTEL_ID, scope: 'partner' })).toThrow();
    const unknownBooking = presentation(); unknownBooking.bookings[0].email = 'not-authorized@example.test';
    expect(() => Help.validatePresentation(unknownBooking, { hotelId: HOTEL_ID, scope: 'partner' })).toThrow();
    const unknownAllocation = presentation(); unknownAllocation.bookings[0].allocation[0].unit_id = UPPER_ROOM_ID;
    expect(() => Help.validatePresentation(unknownAllocation, { hotelId: HOTEL_ID, scope: 'partner' })).toThrow();
    const unknownPayment = presentation(); unknownPayment.bookings[0].payment.secret = 'never';
    expect(() => Help.validatePresentation(unknownPayment, { hotelId: HOTEL_ID, scope: 'partner' })).toThrow();
    expect(() => Help.validatePresentation(exact, { hotelId: GROUND_ROOM_ID, scope: 'partner' })).toThrow();
    expect(() => Help.validatePresentation(exact, { hotelId: HOTEL_ID, scope: 'admin' })).toThrow();
    const missingCurrency = presentation(); missingCurrency.bookings[0].currency = null;
    expect(() => Help.validatePresentation(missingCurrency, { hotelId: HOTEL_ID, scope: 'partner' }))
      .toThrow(/exact currency/i);

    const unavailable = Help.unavailablePresentation({
      hotelId: HOTEL_ID,
      scope: 'partner',
      bookingsVisible: false,
      paymentsVisible: false,
      fullBookingManagement: true,
      fullPaymentManagement: true,
      upcomingBookings: null,
    });
    expect(unavailable.summary).toEqual({
      total_bookings: null,
      upcoming_bookings: null,
      current_recent_bookings: null,
    });
    expect(unavailable.bookings).toEqual([]);

    const nullable = presentation();
    nullable.bookings[0].reference = null;
    nullable.bookings[0].customer_total = null;
    nullable.bookings[0].payment = {
      state: null,
      currency: 'EUR',
      paid: null,
      remaining: null,
      cypruseye_commission: null,
      partner_net: null,
    };
    const nullSafe = Help.validatePresentation(nullable, { hotelId: HOTEL_ID, scope: 'partner' });
    expect(nullSafe.bookings[0].reference).toBeNull();
    expect(nullSafe.bookings[0].customer_total).toBeNull();
    expect(nullSafe.bookings[0].payment.paid).toBeNull();
    expect(nullSafe.bookings[0].payment.state).toBeNull();
  });

  test('wires the same help and strict read validator into both workspaces without presentation mutations', () => {
    const help = source('js/hotels-v2-workspace-help.js');
    const partner = source('js/hotels-v2-partner-workspace.js');
    const admin = source('admin/hotels-v2-workspace.js');
    const partnerRepository = source('js/hotels-v2-partner-workspace-repository.js');
    const adminRepository = source('admin/hotels-v2-workspace-repository.js');
    const partnerHtml = source('partners/index.html');
    const adminHtml = source('admin/dashboard.html');

    expect(partnerHtml).toContain('/js/hotels-v2-workspace-help.js');
    expect(adminHtml).toContain('/js/hotels-v2-workspace-help.js');
    expect(help).toContain('data-hv2-help-topic');
    expect(help).toContain('data-hv2-section-help');
    expect(help).toContain('aria-expanded');
    expect(help).toContain('aria-controls');
    expect(help).toContain('aria-modal');
    expect(help).toMatch(/Escape/);
    expect(help).toMatch(/focus\(/);
    expect(help).toMatch(/lastFocused|trigger|opener/i);

    for (const id of SECTION_TOPICS) {
      expect(partner).toContain(`'${id}'`);
      expect(admin).toContain(`'${id}'`);
    }
    for (const id of CONTROL_TOPICS) {
      expect(partner).toContain(`'${id}'`);
      expect(admin).toContain(`'${id}'`);
    }
    expect(partner).toContain('Help.helpButton');
    expect(partner).toContain('Help.createController');
    expect(admin).toContain('HotelsV2WorkspaceHelp?.helpButton');
    expect(admin).toContain('HotelsV2WorkspaceHelp?.createController');

    expect(partnerRepository).toContain('getBookingsPaymentsPresentation');
    expect(adminRepository).toContain('getBookingsPaymentsPresentation');
    expect(partnerRepository).toContain('Presentation.unavailablePresentation');
    expect(adminRepository).toContain('Presentation.unavailablePresentation');
    expect(partnerRepository).not.toMatch(/hotel_v2_partner_get_bookings_payments_presentation|partner_get_hotel_booking_operational_context/);
    expect(adminRepository).not.toMatch(/hotel_v2_admin_get_bookings_payments_presentation|partner_get_hotel_booking_operational_context/);
    expect(`${partnerRepository}\n${adminRepository}`).not.toMatch(/\.from\(['"](?:hotel_bookings|service_deposit_requests|partner_service_fulfillments)['"]\)/);
    expect(partner).toContain('Repository.getBookingsPaymentsPresentation');
    expect(admin).toContain('Repository.getBookingsPaymentsPresentation');
    expect(partner).toContain('renderBookings');
    expect(partner).toContain('renderPayments');
    expect(admin).toMatch(/renderBookingsPanel|renderBookingsPresentation/);
    expect(admin).toMatch(/renderPaymentsPanel|renderPaymentsPresentation/);
    expect(partner).toContain('data-phw-lifecycle');
    expect(admin).toMatch(/data-(?:hotel-)?workspace-lifecycle/);

    expect(partner).not.toMatch(/name=["'](?:commission|cypruseye_commission|partner_net|customer_total|paid|remaining|payment_status|booking_status)["']/);
    expect(admin).not.toMatch(/name=["'](?:commission|cypruseye_commission|partner_net|customer_total|paid|remaining)["']/);
    expect(partner).toMatch(/CustomEvent\(['"]ce:partner-hotel-bookings['"]/);
    expect(admin).toMatch(/openCentralHotelDepositSettings|data-tab=["']bookings["']/);
    expect(partner).toContain("booking.guest_count == null ? html(text('unavailableValue'))");
    expect(admin).toContain("booking.guest_count == null ? escapeHtml(workspacePresentationText('unavailable'))");
  });

  test('ships responsive RTL and reduced-motion help styling and build-generated mirrors', () => {
    const partnerCss = source('partners/hotels-v2-workspace.css');
    const adminCss = source('admin/admin.css');
    const build = source('scripts/build.js');
    expect(`${partnerCss}\n${adminCss}`).toMatch(/data-hv2-help|hotels-v2-help/);
    expect(`${partnerCss}\n${adminCss}`).toMatch(/prefers-reduced-motion/);
    expect(`${partnerCss}\n${adminCss}`).toMatch(/\[dir=["']?rtl|:dir\(rtl\)/);
    expect(`${partnerCss}\n${adminCss}`).toMatch(/max-width:\s*(?:820|768|640|480)px/);
    expect(build).toContain("'js'");
    expect(build).toContain("'admin'");
    expect(build).toContain("'partners'");
  });
});
