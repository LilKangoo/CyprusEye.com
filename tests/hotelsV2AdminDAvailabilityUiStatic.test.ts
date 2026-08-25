import fs from 'node:fs';
import path from 'node:path';

const read = (file: string): string => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Hotels V2 ADMIN-D availability UI static boundary', () => {
  const workspace = read('admin/hotels-v2-workspace.js');
  const repository = read('admin/hotels-v2-workspace-repository.js');
  const core = read('admin/hotels-v2-workspace-core.js');
  const css = read('admin/admin.css');

  test('retires the revoked H2B Calendar transport from the active workspace', () => {
    expect(workspace).not.toContain('Repository.getCalendar(');
    expect(workspace).not.toContain('Repository.applyCalendarPlan(');
    expect(workspace).toContain('Repository.getAvailabilityControl(');
    expect(workspace).toContain('Repository.previewAvailabilityPlan(');
    expect(workspace).toContain('Repository.applyAvailabilityControlPlan(');
    expect(workspace).toContain('Repository.previewAvailabilityStay(');
    expect(repository).toContain("availabilityControl: 'hotel_v2_admin_get_availability_control'");
    expect(repository).toContain("previewAvailabilityPlan: 'hotel_v2_admin_preview_availability_plan'");
    expect(repository).toContain("applyAvailabilityControl: 'hotel_v2_admin_apply_availability_control_plan'");
  });

  test('renders hierarchical Room inventory, product restrictions, Units, holds and booking blockers', () => {
    for (const marker of [
      'hotel-availability-room', 'Room Rate restrictions', 'Physical units',
      'Daily inventory overrides', 'data-availability-delete-daily',
      'Bookings requiring mapping', 'Active holds', 'Recent activity',
      'data-availability-map-booking', 'data-availability-release-hold',
      'data-availability-block-unit', 'departure_boundary_product',
      "unit.status === 'active'", 'data-availability-reactivate-unit-block',
      'availabilityUnitBlockCanReactivate(control, block)',
    ]) expect(workspace).toContain(marker);
    expect(css).toContain('.hotel-availability-control');
    expect(css).toContain("[dir='rtl'] .hotel-availability-room");
    expect(css).toContain('@media (max-width: 760px)');
  });

  test('uses explicit PL/HE chrome without translating business-authored names', () => {
    expect(workspace).toContain('const AVAILABILITY_UI_TEXT');
    expect(workspace).toContain("pl: Object.freeze({");
    expect(workspace).toContain("he: Object.freeze({");
    expect(workspace).toContain("Core.i18nText(row?.name_i18n, pricingUiLanguage(), '')");
    expect(workspace).not.toMatch(/localizeAvailabilityUi|TreeWalker/);
    for (const marker of [
      "availabilityUiHtml('Exact-date operational overrides')",
      "availabilityUiHtml(preview.changed ? 'The server built the only plan eligible for Save.'",
      "availabilityUiHtml('Sellable units')",
      "availabilityUiText(existing ? 'Edit physical Unit block'",
      "availabilityUiText('Edit shared Rate Rule availability fields')",
      "availabilityUiHtml('Server stay preview')",
    ]) expect(workspace).toContain(marker);
    expect(workspace).toContain("'Sellable units': 'Jednostki do sprzedaży'");
    expect(workspace).toContain("'Sellable units': 'יחידות למכירה'");
    expect(css).toContain("[dir='rtl'] .hotel-availability-room");
    expect(workspace).toContain("availabilityUiHtml('Allocation rule (optional)')");
    expect(workspace).not.toContain("availabilityUiHtml('Allocation rule ID (optional)')");
    expect(workspace).toContain("openAvailabilityReasonIntent('unit_calendar_block', 'disable'");
    expect(workspace).toContain("openAvailabilityReasonIntent('daily_inventory', 'delete', null");
    expect(workspace).toContain("availabilityUiText('Expiry must be a valid future instant.')");
    expect(workspace).toContain("availabilityCodeText(impact.entity)");
    expect(workspace).toContain("'stale booking allocation': 'nieaktualne przypisanie rezerwacji'");
    expect(workspace).toContain("'stale booking allocation': 'שיוך הזמנה לא עדכני'");
    expect(workspace).toContain("'Daily inventory overrides': 'Dzienne nadpisania zapasu'");
    expect(workspace).toContain("'Daily inventory overrides': 'חריגות מלאי יומיות'");
    expect(workspace).toContain('availabilityRateLabel(control, rate)');
    const availabilitySource = workspace.slice(workspace.lastIndexOf('function openCalendarRangeEditor'), workspace.indexOf('function h3ExactId'));
    expect(availabilitySource).not.toContain('<textarea name="reason"');
    expect(availabilitySource).toContain('<input name="reason" type="text" maxlength="500" required');
    expect(availabilitySource).not.toContain("get('reason') || '').trim()");
  });

  test('browser builds draft intent only and cannot mutate pricing, public flags or hold creation', () => {
    const start = workspace.indexOf('async function previewAvailabilityDraft');
    const end = workspace.indexOf('function h3ExactId', start);
    const availabilityUi = workspace.slice(start, end);
    expect(availabilityUi).toContain('Core.buildAvailabilityDraft');
    expect(availabilityUi).toContain("entity: 'operational_override_range', action: 'expand'");
    expect(availabilityUi).toContain("openAvailabilityReasonIntent('hold', 'release'");
    expect(workspace).toContain('async function openAvailabilityBookingRelease(bookingId)');
    expect(workspace).toContain('row.active_commitment_from');
    expect(workspace).toContain('viewportControl.hotel_id, from, to');
    expect(workspace).toContain("{ booking_id: bookingId }, { control, restoreViewport: true }");
    expect(workspace).toContain('async function openAvailabilityHoldRelease(holdId)');
    expect(workspace).toContain('viewportHold.active_commitment_from, viewportHold.active_commitment_to');
    expect(availabilityUi).not.toMatch(/commission|payment_policy|partner_id|feature_flag/);
    expect(availabilityUi).not.toMatch(/entity:\s*['"]hold['"],\s*action:\s*['"]create/);
    expect(core).not.toContain('buildAvailabilityPlan,');
    expect(repository).toContain('reviewedAvailabilityPlans.delete');
  });
});
