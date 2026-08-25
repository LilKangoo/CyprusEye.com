import fs from 'node:fs';

const dashboard = fs.readFileSync('admin/dashboard.html', 'utf8');
const admin = fs.readFileSync('admin/admin.js', 'utf8');
const core = fs.readFileSync('admin/hotels-v2-workspace-core.js', 'utf8');
const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
const css = fs.readFileSync('admin/admin.css', 'utf8');

function functionBody(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf(`async function ${nextName}(`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Hotels V2 ADMIN-B Admin client/static gate', () => {
  test('loads the frozen content-control client with a new cache generation', () => {
    expect(repository).toContain("contentControl: 'hotel_v2_admin_get_content_control'");
    expect(repository).toContain("'architecture_version', 'assignment_snapshot', 'commercial_owner', 'contract_version'");
    expect(repository).toContain("requiredOffFlags.some((key) => featureFlags[key] !== false)");
    expect(repository).toContain("applyPropertyControl: 'hotel_v2_admin_apply_property_control_plan'");
    expect(repository).toContain("applyRoomControl: 'hotel_v2_admin_apply_room_control_plan'");
    expect(repository).toContain("applyOperationalAssignment: 'hotel_v2_admin_apply_operational_assignment_plan'");
    for (const asset of [
      '/admin/admin.css?v=20260821_1',
      '/admin/hotels-v2-workspace-core.js?v=20260821_1',
      '/admin/hotels-v2-workspace-repository.js?v=20260821_1',
      '/admin/hotels-v2-workspace.js?v=20260821_1',
      '/admin/admin.js?v=20260821_1',
    ]) expect(dashboard).toContain(asset);
  });

  test('uses structured PL/EN/HE property and Room controls with private profile concurrency', () => {
    expect(ui).toContain("i18nFields('title', 'Property name'");
    expect(ui).toContain("i18nFields('guest_instructions', 'Guest information'");
    expect(ui).toContain("i18nFields('check_in_instructions', 'Check-in instructions'");
    expect(ui).toContain("i18nFields('check_out_instructions', 'Check-out instructions'");
    expect(ui).toContain("i18nFields('floor_label', 'Floor / location label'");
    expect(ui).toContain('dir="${language === \'he\' ? \'rtl\' : \'ltr\'}"');
    expect(core).toContain('expected_operational_profile_version');
    expect(core).toContain('expected_original: expectedOriginal');
    expect(ui).toContain('state.contentControl = result.content_control');
    expect(ui).toContain('Core.reconcilePropertyControl(currentProperty, freshProperty, validated)');
    expect(ui).not.toContain("property.country || 'Cyprus'");
    expect(ui).not.toContain("property.timezone || 'Europe/Nicosia'");
    expect(ui).toContain('name="currency" maxlength="3" value="${escapeAttr(property.currency || \'\')}"');
    expect(ui).toContain("'textarea', 8000");
    expect(ui).toContain('name="address_line" maxlength="500"');
    expect(ui).toContain('name="country" maxlength="100" placeholder="Enter reviewed country" required');
    expect(ui).toContain("country: String(fd.get('country') || '').trim()");
    expect(ui).not.toContain("timezone: String(fd.get('timezone') || '').trim() || 'Europe/Nicosia'");
    expect(repository).toContain("const requiredText = ['slug', 'city', 'country', 'timezone', 'currency']");
    expect(core).toContain('isSupportedGoogleMapsUrl(nextState.google_maps_url)');
    expect(ui).toContain('Google Maps URL must use a supported Google Maps domain.');
    expect(ui).toContain('name="code" maxlength="80"');
    expect(ui).toContain("'input', 160");
  });

  test('keeps normal Room media exact, optimized and independent from legacy preparation', () => {
    const uploadBatch = functionBody(admin, 'uploadHotelPhotosBatch', 'uploadHotelRoomGallery');
    expect(ui).toContain('data-edit-room=');
    expect(ui).toContain('Select existing property photos');
    expect(ui).toContain('bindOrderedGalleryEditor(form)');
    expect(ui).toContain('window.HotelsV2AdminMedia?.uploadRoomGallery');
    expect(repository).toContain('No raw Storage upload was attempted.');
    expect(repository).not.toContain(".from('hotel-media')");
    expect(admin).toContain('removeHotelPropertyGalleryUploads(safeSlug, results)');
    expect(admin).toContain('removeHotelRoomGalleryUploads(safeSlug, roomTypeId, results)');
    expect(admin).toContain('candidate.origin !== trustedPrefix.origin');
    expect(admin).toContain('candidate.search || candidate.hash');
    expect(admin).toContain('`rooms/${exactRoomId}`');
    expect(uploadBatch).toContain("new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])");
    expect(uploadBatch).toContain('const maximumBytes = 20 * 1024 * 1024');
    expect(uploadBatch).toContain('reviewedFiles.length > 30');
    expect(uploadBatch).not.toContain("file.type.startsWith('image/')");
    expect(admin).toContain('uploadHotelPhotosBatch(propertySlug, Array.from(files || []), { roomTypeId })');
    expect(admin).toContain('uploadHotelPhotosBatch(propertySlug, Array.from(files || []))');
    expect(core).toContain("inventory_mode: 'pooled'");
    expect(core).toContain('base_inventory_count: 0');
    expect(ui).toContain('inert draft with pooled inventory set to 0');
    expect(ui).toContain('Disabled · choose a reviewed reactivation state');
    expect(ui).toContain('Use the separate Disable action for dependency-aware removal');
    expect(ui).toContain('if (reviewOpened === false) await cleanupUploaded()');
    expect(ui).toContain('Pending uploads were removed.');
  });

  test('routes every normal Hotel assignment mutation away from raw Partner resource DML', () => {
    const remove = functionBody(admin, 'removePartnerResourceAssignment', 'backfillPartnerResourceFulfillments');
    const backfill = functionBody(admin, 'backfillPartnerResourceFulfillments', 'addPartnerResourceAssignment');
    const addStart = admin.indexOf('async function addPartnerResourceAssignment(');
    const addEnd = admin.indexOf('async function searchPartnerResources(', addStart);
    const add = admin.slice(addStart, addEnd);
    expect(remove.indexOf("if (t === 'hotels')")).toBeLessThan(remove.indexOf(".from('partner_resources')"));
    expect(backfill.indexOf("if (t === 'hotels')")).toBeLessThan(backfill.indexOf("admin_backfill_partner_service_fulfillments_for_resource"));
    expect(add.indexOf("if (t === 'hotels')")).toBeLessThan(add.indexOf(".from('partner_resources')"));
    expect(admin).toContain('openHotelPartnerAccessControl');
    expect(admin).toContain('Hotel assignments are Review-only in the Hotel Workspace');
    expect(ui).toContain('expected_staff_scope_ids');
    expect(ui).toContain('Historical bookings and fulfillment routing are never rewritten.');
  });

  test('keeps responsive, keyboard-safe, dark and structured Review UX', () => {
    expect(ui).toContain("if (event.key !== 'Tab') return");
    expect(ui).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(ui).toContain('aria-controls="hotelWorkspaceActivePanel"');
    expect(ui).toContain('tabindex="${state.activeTab === key ? \'0\' : \'-1\'}"');
    expect(ui).toContain('input.disabled = !isOther');
    expect(ui).toContain('reviewValueMarkup');
    expect(ui).not.toContain('displayReviewValue');
    expect(ui).not.toContain('accept="image/*"');
    expect(ui).toContain('image/jpeg,image/png,image/webp,image/avif');
    expect(css).toContain('.hotel-workspace-modal__dialog');
    expect(css).toContain('max-height:min(92dvh,960px)');
    expect(css).toMatch(/@media \(max-width:760px\)[\s\S]*\.hotel-room-control-conflict > div \{ grid-template-columns:1fr; \}/);
    expect(ui).not.toContain('pattern="[a-z0-9_-]*"');
    expect(ui).not.toContain('pattern="[a-z0-9-]*"');
    expect(ui).toContain('pattern="[a-z0-9](?:[a-z0-9_]|-)*"');
  });
});
