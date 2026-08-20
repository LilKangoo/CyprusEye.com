import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20260811340000_hotels_v2_admin_b_content_room_assignment_control.sql',
  'utf8',
);
const core = fs.readFileSync('admin/hotels-v2-workspace-core.js', 'utf8');
const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
const admin = fs.readFileSync('admin/admin.js', 'utf8');
const preflight = fs.readFileSync(
  'supabase/manual/hotels_v2_admin_b_content_room_assignment_preflight.sql',
  'utf8',
);
const foundationVerify = fs.readFileSync(
  'supabase/manual/hotels_v2_admin_b_content_room_assignment_verify.sql',
  'utf8',
);
const postAdminVerify = fs.readFileSync(
  'supabase/manual/hotels_v2_admin_b_content_room_assignment_post_admin_verify.sql',
  'utf8',
);

function sqlFunction(name: string): string {
  const start = migration.indexOf(`create function public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf('\n$function$;', start);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end + '\n$function$;'.length);
}

function section(startMarker: string, endMarker: string): string {
  const start = migration.indexOf(startMarker);
  const end = migration.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

const normalizedPrivateRelations = [
  'hotel_room_types',
  'hotel_units',
  'hotel_rate_plans',
  'hotel_room_rates',
  'hotel_rate_rules',
  'hotel_daily_inventory',
  'hotel_daily_rates',
  'hotel_room_rate_occupancy_tiers',
  'hotel_calendar_overrides',
  'hotel_pricing_schedules',
  'hotel_pricing_schedule_occupancy_tiers',
  'hotel_room_allocation_rules',
  'hotel_room_allocation_rule_items',
  'hotel_payment_policies',
  'hotel_payment_policy_terms',
  'hotel_commission_policies',
  'hotel_calendar_source_configs',
  'hotel_pricing_promotion_reviews',
  'hotel_activity_log',
  'hotel_property_operational_profiles',
];

describe('Hotels V2 ADMIN-B independent adversarial security contract', () => {
  test('keeps the private content response envelope exact across SQL and the browser repository', () => {
    const getContent = sqlFunction('hotel_v2_admin_get_content_control');
    for (const key of [
      'architecture_version',
      'assignment_snapshot',
      'commercial_owner',
      'contract_version',
      'feature_flags',
      'hotel_id',
      'operational_profile',
      'property_updated_at',
    ]) expect(getContent).toContain(`'${key}'`);
    for (const key of [
      'exists',
      'version',
      'updated_at',
      'maximum_stay_nights',
      'guest_instructions_i18n',
      'check_in_instructions_i18n',
      'check_out_instructions_i18n',
      'internal_operational_notes',
    ]) expect(getContent).toContain(`'${key}'`);

    expect(repository).toContain("'architecture_version', 'assignment_snapshot', 'commercial_owner', 'contract_version'");
    expect(repository).toContain("'feature_flags', 'hotel_id', 'operational_profile', 'property_updated_at'");
    expect(repository).toContain("JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(envelopeKeys)");
    expect(repository).toContain("JSON.stringify(Object.keys(profile).sort()) !== JSON.stringify(profileKeys)");
    expect(repository).toContain("payload.contract_version !== 'hotels_v2_admin_b_content_control_v1'");
    expect(repository).toContain("requiredOffFlags.some((key) => featureFlags[key] !== false)");
    expect(repository).toContain('assignmentSnapshot.property.updated_at !== String(payload.property_updated_at)');
    expect(repository).toContain('assignmentSnapshot.property.architecture_version !== architectureVersion');
  });

  test('stores instructions and internal notes only in a denied-by-default private profile', () => {
    expect(migration).toContain('create table public.hotel_property_operational_profiles(');
    for (const column of [
      'maximum_stay_nights integer',
      'guest_instructions_i18n jsonb',
      'check_in_instructions_i18n jsonb',
      'check_out_instructions_i18n jsonb',
      'internal_operational_notes text',
      'version bigint',
    ]) expect(migration).toContain(column);
    expect(migration).toContain('alter table public.hotel_property_operational_profiles enable row level security');
    expect(migration).toContain('revoke all on table public.hotel_property_operational_profiles\n  from public,anon,authenticated,service_role');
    expect(migration).toContain('hotels_v2_admin_b_private_table_acl_failed');
    expect(migration).toContain("has_table_privilege('service_role','public.hotel_property_operational_profiles','SELECT')");
    expect(migration).not.toMatch(/alter\s+table\s+public\.hotels[\s\S]{0,300}add\s+column[\s\S]{0,120}(?:guest_instructions|check_in_instructions|check_out_instructions|internal_operational_notes)/i);

    const propertyApply = sqlFunction('hotel_v2_admin_apply_property_control_plan');
    expect(propertyApply).toContain('c_private_keys constant text[]');
    expect(propertyApply).toContain('insert into public.hotel_property_operational_profiles');
    expect(propertyApply).toContain('update public.hotel_property_operational_profiles');
    expect(propertyApply).toContain("'admin',auth.uid(),'hotels_v2_admin_b_property_control'");
    expect(propertyApply).not.toMatch(/update\s+public\.hotel_(?:bookings|rate_plans|room_rates|pricing_schedules|payment_policies|commission_policies)\b/i);
  });

  test('closes normalized raw SELECT and DML while preserving the live shared amenity catalogue', () => {
    const revokeBlock = section(
      'do $admin_b_raw_authenticated_revoke$',
      '$admin_b_raw_authenticated_revoke$;',
    );
    for (const relation of normalizedPrivateRelations) expect(revokeBlock).toContain(`'${relation}'`);
    expect(revokeBlock).toContain("'revoke all privileges on table public.%I from public,anon,authenticated'");
    expect(revokeBlock).not.toContain("'hotel_amenities'");
    expect(revokeBlock).not.toContain('service_role');
    expect(migration).toContain("values('hotel_amenities_authenticated_acl',1,");
    expect(migration).toContain('hotels_v2_admin_b_shared_amenities_catalog_regressed');
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(migration).toContain(`has_table_privilege('authenticated','public.'||v_table_name,'${privilege}')`);
    }
    for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      expect(migration).toContain(`has_table_privilege('authenticated','public.'||v_table_name,'${privilege}')`);
    }
  });

  test('retires every pre-ADMIN-B property and Room writer without blocking ADMIN-C entities', () => {
    const generic = sqlFunction('hotel_v2_admin_apply_workspace_plan');
    expect(migration).toContain('rename to hotel_v2_admin_apply_workspace_plan_admin_b_core');
    expect(migration).toContain('revoke all on function public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)');
    expect(generic).toContain("operation.value->>'entity' in('property','room_type')");
    expect(generic).toContain("message='hotels_v2_admin_b_use_control_plane_rpc'");
    expect(generic).toContain('hotel_v2_admin_apply_workspace_plan_admin_b_core(p_plan,p_correlation_id)');
    expect(generic).not.toMatch(/in\('unit','rate_plan','room_rate'\)/);

    expect(migration).toContain('revoke all on function public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)\n  from public,anon,authenticated,service_role');
    expect(migration).toContain('rename to hotel_v2_admin_apply_guest_policy_plan_admin_b_core');
    expect(migration).toContain('rename to hotel_v2_admin_create_property_draft_admin_b_core');
    expect(migration).toContain('hotels_v2_admin_b_legacy_writer_still_executable');

    const guestPolicy = sqlFunction('hotel_v2_admin_apply_guest_policy_plan');
    expect(guestPolicy).toContain("'children_policy','minimum_child_age'");
    expect(guestPolicy).toContain("'children_policy_override',");
    expect(guestPolicy).not.toContain("'capacity_adults'");
    expect(guestPolicy).not.toContain("'capacity_children'");
    expect(guestPolicy).not.toContain("'max_occupancy'");

    const createProperty = sqlFunction('hotel_v2_admin_create_property_draft');
    expect(createProperty).toContain('public.hotel_v2_admin_b_i18n_is_valid');
    expect(createProperty).toContain('public.hotel_v2_admin_b_storage_url_is_exact');
    expect(createProperty).toContain("||v_slug||'/gallery/'");
    expect(createProperty).toContain('public.hotel_v2_admin_b_google_maps_url_is_valid');
    expect(createProperty).toContain('perform 1 from public.site_settings where id=1 for share');
  });

  test('rejects deceptive Maps hosts and numeric/scalar smuggling on both control planes', () => {
    const maps = sqlFunction('hotel_v2_admin_b_google_maps_url_is_valid');
    expect(maps).toContain("'^https://maps\\.app\\.goo\\.gl/");
    expect(maps).toContain("'^https://goo\\.gl/maps");
    expect(maps).toContain("maps\\.google\\.(?:com|[a-z]{2}|com\\.[a-z]{2}|co\\.[a-z]{2})");
    expect(maps).toContain("google\\.(?:com|[a-z]{2}|com\\.[a-z]{2}|co\\.[a-z]{2})/maps");
    expect(maps).not.toContain('[A-Za-z.]+');
    expect(core).toContain("url.protocol !== 'https:' || url.username || url.password || url.port");
    expect(core).toContain("host === 'maps.app.goo.gl'");
    expect(core).toContain("host === 'goo.gl'");
    expect(core).toContain("!/^google\\.(?:com|[a-z]{2}|com\\.[a-z]{2}|co\\.[a-z]{2})$/.test(googleHost)");
    expect(core).toContain("JSON.stringify(nextState.country) !== JSON.stringify(currentState.country)");
    expect(core).toContain("Country cannot be cleared once it is configured.");
    expect(core).toContain("JSON.stringify(nextState.timezone) !== JSON.stringify(currentState.timezone)");
    expect(core).toContain("Timezone cannot be cleared once it is configured.");
    expect(ui).toContain("mapsUrl.protocol === 'https:' && !mapsUrl.username && !mapsUrl.password && !mapsUrl.port");
    expect(ui).toContain("/^google\\.(?:com|[a-z]{2}|com\\.[a-z]{2}|co\\.[a-z]{2})$/.test(googleHost)");
    expect(ui).not.toContain('[a-z]{2,3}');

    const roomApply = sqlFunction('hotel_v2_admin_apply_room_control_plan');
    expect(roomApply).toContain("jsonb_typeof(v_operation->'expected_version')<>'number'");
    expect(roomApply).toContain("v_operation->>'expected_version'!~'^[0-9]+$'");
    expect(roomApply).toContain("entry.value#>>'{}'!~'^[0-9]+$'");
    expect(roomApply).toContain("message='hotels_v2_admin_b_invalid_room_numeric_value'");
    const propertyApply = sqlFunction('hotel_v2_admin_apply_property_control_plan');
    expect(propertyApply).toContain("jsonb_typeof(p_plan->'expected_operational_profile_version')<>'number'");
    expect(propertyApply).toContain("p_plan->>'expected_operational_profile_version'!~'^[0-9]+$'");
    expect(propertyApply).toContain("message='hotels_v2_admin_b_invalid_property_numeric_value'");
    const beds = sqlFunction('hotel_v2_admin_b_beds_are_valid');
    expect(beds).toContain("jsonb_typeof(v_item->'quantity')<>'number'");
    expect(beds).toContain("v_item->>'quantity'!~'^[0-9]+$'");
  });

  test('binds new media to exact property/Room provenance and constrains browser cleanup', () => {
    const storageUrl = sqlFunction('hotel_v2_admin_b_storage_url_is_exact');
    expect(storageUrl).toContain('left(p_url,length(p_prefix))=p_prefix');
    expect(storageUrl).toContain("~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,200}\\.(webp|jpg|jpeg|png|avif)$'");
    expect(storageUrl).toContain("strpos(substring(p_url from length(p_prefix)+1),'..')=0");

    const roomGallery = sqlFunction('hotel_v2_admin_b_room_gallery_is_valid');
    expect(roomGallery).toContain("from jsonb_array_elements_text(coalesce(p_current,'[]'::jsonb))");
    expect(roomGallery).toContain("from jsonb_array_elements_text(coalesce(hotel.photos,'[]'::jsonb))");
    expect(roomGallery).toContain("||hotel.slug||'/rooms/'||p_room_id::text||'/'");
    const propertyGallery = sqlFunction('hotel_v2_admin_b_property_gallery_is_valid');
    expect(propertyGallery).toContain("from jsonb_array_elements_text(coalesce(p_current,'[]'::jsonb))");
    expect(propertyGallery).toContain("||hotel.slug||'/gallery/'");

    expect(admin).toContain("new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])");
    expect(admin).toContain('const maximumBytes = 20 * 1024 * 1024');
    expect(admin).toContain('candidate.origin !== trustedPrefix.origin');
    expect(admin).toContain('candidate.search || candidate.hash');
    expect(admin).toContain('`rooms/${exactRoomId}`');
    expect(ui).toContain('if (error?.isDefinitiveFailure) await cleanupUploaded()');
    expect(ui).toContain('Uploaded media was preserved. Refresh Property Workspace before retrying; do not upload the same files again.');
  });

  test('reconciles ambiguous uploaded-media saves read-only and retains the only recovery closure', () => {
    expect(ui).toContain('const reviewedPropertyFields = Core.PROPERTY_CONTROL_BUSINESS_FIELDS.filter');
    expect(ui).toContain('reviewedPropertyFields.every((field) =>');
    expect(ui).toContain('const reviewedRoomFields = Core.ROOM_CONTROL_BUSINESS_FIELDS.filter');
    expect(ui).toContain('reviewedRoomFields.every((field) =>');
    expect(ui).toContain('if (acceptMatchingTarget && reviewedPropertyFields.every');
    expect(ui).toContain('if (acceptMatchingTarget && reviewedRoomFields.every');
    expect(ui).toContain('if (ambiguousPending) {\n              await reconcileAmbiguousOutcome(button);\n              return;');
    expect(ui).toContain('ambiguousPending = true;\n            overlay.hotelWorkspaceOnClose = null;');
    expect(ui).toContain('setModalSaving(overlay, true);\n            button.disabled = false;\n            button.textContent = \'Check current state\'');
    expect(ui).toContain('closeModal({ restoreFocus: false, skipCleanup: true, force: true });');
    expect(ui).toContain('nothing was retried automatically');
  });

  test('keeps ADMIN-B technical identifiers out of the primary Property/Room/access workflow', () => {
    for (const forbidden of [
      '<span>Exact property ID</span>',
      '<span>Exact Room Type ID</span>',
      '<span>Exact unit ID</span>',
      '<dt>Property ID</dt><dd><code>',
      "${owner.id ? `<code>${escapeHtml(owner.id)}</code>` : ''}",
      '<div><dt>Assignment</dt><dd><code>${escapeHtml(assignment?.assignment_id',
      '<div><dt>Assignment</dt><dd><code>${escapeHtml(operation.assignment_id)',
    ]) expect(ui).not.toContain(forbidden);
    expect(ui).toContain('<details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary>');
    expect(ui).toContain("owner.id ? `<details class=\"hotel-review-diagnostics\"><summary>Technical diagnostics</summary><code>${escapeHtml(owner.id)}</code></details>`");
    expect(ui).toContain('<details class="hotel-review-diagnostics"><summary>Assignment diagnostics</summary>');
    expect(ui).toContain('<details class="hotel-review-diagnostics"><summary>Exact Room diagnostics</summary>');
    expect(ui).toContain('diagnostics: [{ label: \'Room Type ID\', value: room.id }]');
    expect(ui).not.toContain('contextMessage: `Exact Room Type ${room.id}');
  });

  test('serializes exact assignment/scopes and prevents spoofing the historical-backfill bypass', () => {
    expect(migration).toContain('create table public.hotel_admin_assignment_transaction_context(');
    expect(migration).toContain('primary key(backend_pid,transaction_id,assignment_id)');
    expect(migration).toContain('unique(correlation_id)');
    expect(migration).toContain('revoke all on table public.hotel_admin_assignment_transaction_context\n  from public,anon,authenticated,service_role');

    const assignmentLock = sqlFunction('hotel_v2_admin_b_partner_assignment_lock_trigger');
    expect(assignmentLock).toContain('perform 1 from public.hotels hotel where hotel.id=v_hotel_id for update');
    expect(assignmentLock).toContain("message='hotels_v2_admin_b_assignment_has_staff_scopes'");
    const scopeGuard = sqlFunction('hotel_v2_admin_b_partner_scope_integrity_trigger');
    expect(scopeGuard).toContain('from public.hotels where id=new.resource_id for key share');
    expect(scopeGuard).toContain('from public.partner_users membership');
    expect(scopeGuard).toContain('for update');
    expect(scopeGuard).toContain("message='hotels_v2_admin_b_staff_scope_requires_assignment'");
    const membershipGuard = sqlFunction('hotel_v2_admin_b_membership_scope_reassignment_guard');
    expect(membershipGuard).toContain('new.partner_id is distinct from old.partner_id');
    expect(membershipGuard).toContain("message='hotels_v2_admin_b_membership_reassignment_has_hotel_scopes'");

    const patch = section('do $admin_b_patch_assignment_backfill$', '$admin_b_patch_assignment_backfill$;');
    for (const condition of [
      'public.is_current_user_admin()',
      'context_row.backend_pid=pg_backend_pid()',
      'context_row.transaction_id=txid_current()',
      'context_row.assignment_id=NEW.id',
      'context_row.hotel_id=NEW.resource_id',
      'context_row.partner_id=NEW.partner_id',
      'context_row.actor_user_id=auth.uid()',
    ]) expect(patch).toContain(condition);

    const assignmentApply = sqlFunction('hotel_v2_admin_apply_operational_assignment_plan');
    expect(assignmentApply).toContain("v_operation->'expected_staff_scope_ids'");
    expect(assignmentApply).toContain("jsonb_agg(scope_row.id order by scope_row.id)");
    expect(assignmentApply).toContain('v_current_scope_ids is distinct from v_expected_scope_ids');
    expect(assignmentApply).toContain("'expected_staff_scope_ids',v_expected_scope_ids");
    expect(assignmentApply).toContain("'current_staff_scope_ids',v_current_scope_ids");
    expect(assignmentApply.indexOf('delete from public.partner_user_resources'))
      .toBeLessThan(assignmentApply.indexOf('delete from public.partner_resources'));
    expect(assignmentApply).toContain("'assignment_snapshot',public.hotel_v2_admin_get_content_control(v_hotel_id)->'assignment_snapshot'");
    expect(assignmentApply).toContain("'removed_staff_scope_ids',case when v_action='remove' then v_expected_scope_ids");
    expect(assignmentApply).toContain("'permission_removed',case when v_action='remove' then v_permission_exists");
  });

  test('pins H3.1P pricing, protected history, floor-only schema drift and every public flag OFF', () => {
    for (const relation of [
      'hotel_bookings',
      'partner_service_fulfillments',
      'partner_service_fulfillment_form_snapshots',
      'service_deposit_requests',
      'service_coupons',
      'service_coupon_redemptions',
      'referrals',
      'affiliate_commission_events',
      'hotel_rate_plans',
      'hotel_room_rates',
      'hotel_pricing_schedules',
      'hotel_payment_policies',
      'hotel_commission_policies',
      'hotel_partner_hotel_permissions',
      'site_settings',
    ]) expect(migration).toContain(`'${relation}'`);
    expect(migration).toContain('hotels_v2_admin_b_protected_before');
    expect(migration).toContain("to_jsonb(row_value)-'floor_label_i18n'");
    expect(migration).toContain("message='hotels_v2_admin_b_existing_room_rows_changed_beyond_floor'");
    expect(migration).toContain("(v_snapshot#>>'{parity,total_case_count}')::integer<>70");
    expect(migration).toContain("(v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0");
    expect(migration).toContain("v_snapshot#>>'{property,architecture_version}'<>'legacy'");
    expect(migration).toContain("(v_snapshot#>>'{target,rate_plan,is_active}')::boolean");
    expect(migration).toContain("where (rate->>'is_active')::boolean");
    for (const flag of [
      'hotel_rooms_v2_enabled',
      'hotel_external_sync_enabled',
      'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ]) expect(migration).toContain(flag);
    expect(migration).not.toMatch(/update\s+public\.site_settings\b/i);
    expect(migration).not.toMatch(/update\s+public\.hotel_(?:bookings|rate_plans|room_rates|pricing_schedules|payment_policies|commission_policies)\b/i);
  });

  test('keeps manual SQL Editor gates comparable without treating the additive Room floor column as drift', () => {
    const comparableMarker = 'with protected_relations as (';
    const preflightComparable = preflight.slice(preflight.lastIndexOf(comparableMarker));
    const verifyComparable = foundationVerify.slice(foundationVerify.lastIndexOf(comparableMarker));
    const relationNames = (value: string) => Array.from(value.matchAll(/'([a-z][a-z0-9_]+)'/g), (match) => match[1])
      .filter((name) => !name.startsWith('hotel_v2_'));
    const preflightRelations = relationNames(preflightComparable.split('),\nseven_kamares_expected')[0]);
    const verifyRelations = relationNames(verifyComparable.split('),\nseven_kamares_expected')[0]);
    expect(preflightRelations).toEqual(verifyRelations);
    expect(preflightRelations).not.toContain('hotel_room_types');
    expect(preflightComparable).toContain("to_jsonb(row_value) - 'floor_label_i18n'");
    expect(verifyComparable).toContain("to_jsonb(row_value) - 'floor_label_i18n'");
    expect(postAdminVerify).toContain('protected_history_fingerprints');
    expect(postAdminVerify).toContain('reviewed_admin_state_fingerprints');
    for (const sql of [preflight, foundationVerify, postAdminVerify]) {
      expect(sql).not.toMatch(/^\\(?:set|if|else|endif)\b/m);
      for (const counter of [
        'HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH',
        'HOTEL_LEGACY_PRICE_MISMATCH',
        'HOTEL_LEGACY_PUBLIC_MISMATCH',
        'HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE',
      ]) expect(sql).toContain(counter);
    }
  });
});
