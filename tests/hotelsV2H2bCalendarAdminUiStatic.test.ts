import fs from 'node:fs';

const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
const css = fs.readFileSync('admin/admin.css', 'utf8');

describe('Hotels V2 H2B Calendar & Rates Admin UI contract', () => {
  test('uses dedicated Admin RPCs and retains effective plus raw Calendar rows', () => {
    expect(repository).toContain("calendar: 'hotel_v2_admin_get_calendar'");
    expect(repository).toContain("applyCalendar: 'hotel_v2_admin_apply_calendar_plan'");
    expect(repository).toContain("resolveRate: 'hotel_v2_admin_resolve_rate'");
    expect(repository).toContain('effective_cells');
    expect(repository).toContain('activity: Core.asArray(payload.activity)');
    expect(repository).toContain('calendar_overrides');
    expect(repository).toContain('occupancy_tiers');
    expect(repository).not.toMatch(/\.from\(['"]hotel_(?:daily|calendar|rate)/);
  });

  test('renders a sticky month/week grid and a separate mobile product list', () => {
    expect(ui).toContain('Monthly room rate and inventory calendar');
    expect(ui).toContain('data-calendar-today');
    expect(ui).toContain('data-calendar-view');
    expect(ui).toContain('function calendarTwoMonthRange');
    expect(ui).toContain('option value="two_months"');
    expect(ui).toContain('data-calendar-cell');
    expect(ui).toContain('data-calendar-mobile-product');
    expect(ui).toContain('Room × Rate Plan');
    expect(ui).toContain('function calendarBlockingReasonLabel');
    expect(ui).toContain('Not requestable');
    expect(ui).toContain('Checkout ${source.stay_date}: closed to departure');
    expect(ui).toContain('serverCell.requestable ?? resolved.requestable ?? resolved.bookable');
    expect(css).toContain('.hotel-calendar-cell__blocker');
    expect(css).toContain('.hotel-calendar-grid thead th { position:sticky');
    expect(css).toContain('.hotel-calendar-grid .hotel-calendar-grid__product { position:sticky; left:0');
    expect(css).toContain('[dir="rtl"] .hotel-calendar-grid .hotel-calendar-grid__product { right:0; left:auto;');
    expect(css).toContain('.hotel-calendar-mobile { display:none; }');
    expect(css).toMatch(/@media \(max-width:760px\)[\s\S]*\.hotel-calendar-grid-shell \{ display:none; \}/);
    expect(css).toMatch(/@media \(max-width:760px\)[\s\S]*\.hotel-calendar-mobile \{ display:grid;/);
  });

  test('supports exact range, seasonal rule, occupancy tier and authoritative preview workflows', () => {
    expect(ui).toContain('function openCalendarRangeEditor');
    expect(ui).toContain('function openCalendarRuleEditor');
    expect(ui).toContain('function openOccupancyTierEditor');
    expect(ui).toContain('function openAuthoritativeRatePreview');
    expect(ui).toContain("entity: 'calendar_override'");
    expect(ui).toContain("entity: 'daily_inventory'");
    expect(ui).toContain("entity: 'rate_rule'");
    expect(ui).toContain("entity: 'occupancy_tier'");
    expect(ui).toContain('Repository.resolveRate');
    expect(ui).toContain('Unresolved — reload required');
    expect(ui).not.toContain("?? rateRow?.nightly_rate ?? product.base_nightly_rate");
  });

  test('expands range writes to exact rows, dedupes room inventory, and reviews once', () => {
    expect(ui).toContain('function calendarOverrideOperations');
    expect(ui).toContain('function dailyInventoryOperations');
    expect(ui).toContain('if (!roomById.has(product.room_type_id))');
    expect(ui).toContain("expected_version: existing ? Number(existing.version) : 0");
    expect(ui).toContain('Repository.applyCalendarPlan(plan)');
    expect(ui).toContain('One exact-property Calendar transaction');
    expect(ui).toContain('function calendarExactReviewRows');
    expect(ui).toContain('const snapshotStart = state.calendar.data?.start_date');
    expect(ui).toContain('from: snapshotStart || range.start');
    expect(ui).toContain('...calendarExactReviewRows(operations)');
    expect(ui).toContain('payload[`${field}_mode`] = change.mode');
    expect(ui).toContain("!Object.hasOwn(payload, 'sellable_units')");
    expect(ui).toContain("payload.sellable_units_mode = 'clear'");
    expect(ui).toContain("!Object.hasOwn(payload, 'closed')");
    expect(ui).toContain("payload.closed_mode = 'clear'");
    expect(ui).toContain('Clear override / inherit');
    expect(ui).not.toContain("type: 'range_patch'");
  });

  test('requires an audit reason and carries real expiry/source fields plus provenance', () => {
    expect(ui).toContain('name="reason"');
    expect(ui).toContain('name="expires_at"');
    expect(ui).toContain('payload.reason = provenance.reason');
    expect(ui).toContain('payload.expires_at = provenance.expires_at');
    expect(ui).toContain("payload.source = 'manual'");
    expect(ui).toContain('A concise audit reason is required.');
  });

  test('does not publish, migrate, book or touch public Hotels from Calendar UI', () => {
    expect(ui).toContain('This remains inert V2 configuration.');
    expect(ui).toContain('does not publish the property');
    expect(ui).not.toContain('hotel_rooms_v2_enabled = true');
    expect(ui).not.toContain('hotel_instant_booking_enabled = true');
  });
});
