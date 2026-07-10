import fs from 'node:fs';
import path from 'node:path';

describe('Special Offers Lefkara launch pack', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('activation SQL requires explicit dates and only updates campaign launch fields', () => {
    const sql = read('supabase/manual/special_offer_lefkara_activate_stage1.sql');

    expect(sql).toContain('v_use_existing_dates boolean := false');
    expect(sql).toContain('set v_use_existing_dates=true or replace v_start_at_text/v_end_at_text');
    expect(sql).toContain('Cannot use existing dates because start_at or end_at is null');
    expect(sql).toContain('__REPLACE_WITH_FINAL_START_AT__');
    expect(sql).toContain('__REPLACE_WITH_FINAL_END_AT__');
    expect(sql).toMatch(/v_start_at\s*:=\s*v_offer\.start_at/i);
    expect(sql).toMatch(/v_end_at\s*:=\s*v_offer\.end_at/i);
    expect(sql).toContain("v_offer.status in ('ended', 'locked', 'archived')");
    expect(sql).toContain("v_offer.status not in ('draft', 'scheduled', 'active')");
    expect(sql).toMatch(/and v_offer\.start_at = v_start_at/i);
    expect(sql).toMatch(/return;/i);
    expect(sql).toMatch(/status\s*=\s*'active'/);
    expect(sql).toMatch(/visibility\s*=\s*'public'/);
    expect(sql).toMatch(/requires_form\s+is\s+not\s+true/i);
    expect(sql).toMatch(/allow_bonus_points\s+is\s+not\s+true/i);
    expect(sql).not.toMatch(/special_offer_entries\s+set/i);
    expect(sql).not.toMatch(/special_offer_entry_answers\s+set/i);
    expect(sql).not.toMatch(/special_offer_entry_activities\s+set/i);
    expect(sql).not.toMatch(/special_offer_winners/i);
    expect(sql).not.toMatch(/special_offer_draws/i);
  });

  test('emergency pause blocks public access without deleting participant data', () => {
    const sql = read('supabase/manual/special_offer_lefkara_emergency_pause.sql');

    expect(sql).toMatch(/status\s*=\s*'locked'/);
    expect(sql).toMatch(/visibility\s*=\s*'private'/);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.special_offer_entries\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.special_offer_entry_answers\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.special_offer_entry_activities\b/i);
    expect(sql).toContain('campaign_emergency_paused');
  });

  test('dynamic sitemap includes only active public Special Offers', () => {
    const source = read('functions/_utils/sitemap.js');

    expect(source).toContain('fetchPublishedSpecialOfferEntries');
    expect(source).toContain(".from('special_offers')");
    expect(source).toContain(".eq('status', 'active')");
    expect(source).toContain(".eq('visibility', 'public')");
    expect(source).toContain('buildSpecialOfferUrl');
    expect(source).toContain('/special-offers/');
  });

  test('launch readiness separates entry collection from activity claims', () => {
    const preflight = read('supabase/manual/special_offer_lefkara_launch_preflight.sql');
    const verify = read('supabase/manual/special_offer_lefkara_activate_stage1_verify.sql');

    expect(preflight).toContain('activation_structure_ready');
    expect(preflight).toContain('dates_present_and_valid');
    expect(preflight).toContain('now_in_campaign_window');
    expect(preflight).toContain('entry_collection_currently_ready');
    expect(preflight).toContain('activity_claims_currently_ready');
    expect(preflight).toContain('official_post_required_only_for_activity_claims');
    expect(preflight).toContain('manual_auth_gate_pending');
    expect(preflight).toContain('manual_legal_gate_pending');

    expect(verify).toContain('activation_configured');
    expect(verify).toContain('entry_collection_currently_ready');
    expect(verify).toContain('activity_claims_currently_ready');
    expect(verify).toContain('full_promotion_ready');
    expect(verify).toMatch(/entry_collection_currently_ready\s+as\s+overall_pass/i);

    const entryReadyDefinition = verify.match(/\)\s+as entry_collection_currently_ready/i)?.index ?? -1;
    const activityReadyDefinition = verify.match(/\)\s+as activity_claims_currently_ready/i)?.index ?? -1;
    expect(entryReadyDefinition).toBeGreaterThan(-1);
    expect(activityReadyDefinition).toBeGreaterThan(entryReadyDefinition);

    const entryReadyStart = verify.lastIndexOf('(\n      coalesce(c.offer_count', entryReadyDefinition);
    const entryReadyBlock = verify.slice(entryReadyStart, entryReadyDefinition);
    expect(entryReadyBlock).not.toContain('active_official_posts_count');
    expect(entryReadyBlock).not.toContain('activity_claim_rpc_exists');

    const activityReadyStart = verify.lastIndexOf('(\n      coalesce(c.offer_count', activityReadyDefinition);
    const activityReadyBlock = verify.slice(activityReadyStart, activityReadyDefinition);
    expect(activityReadyBlock).toContain('activity_claim_rpc_exists');
    expect(activityReadyBlock).toContain('active_official_posts_count');
  });

  test('activity claim corrective SQL enforces campaign date window before insert', () => {
    const sql = read('supabase/manual/special_offer_activity_claim_date_guard_stage1.sql');
    const verify = read('supabase/manual/special_offer_activity_claim_date_guard_stage1_verify.sql');

    expect(sql).toContain('create or replace function public.submit_special_offer_activity_claim');
    expect(sql).toContain('v_now timestamptz := now()');
    expect(sql).toContain('v_offer.start_at is null');
    expect(sql).toContain('v_offer.end_at is null');
    expect(sql).toContain('v_now < v_offer.start_at');
    expect(sql).toContain('v_now > v_offer.end_at');
    expect(sql).toMatch(/insert into public\.special_offer_entry_activities/i);
    expect(sql.indexOf('idempotent := true')).toBeLessThan(sql.indexOf('v_offer.start_at is null'));
    expect(sql.indexOf('v_offer.start_at is null')).toBeLessThan(sql.indexOf('insert into public.special_offer_entry_activities'));
    expect(verify).toContain('campaign_start_required_present');
    expect(verify).toContain('campaign_end_required_present');
    expect(verify).toContain('campaign_start_lower_bound_present');
    expect(verify).toContain('campaign_end_upper_bound_present');
    expect(verify).toContain('idempotent_before_date_guard');
    expect(verify).toContain('date_guard_before_insert');
    expect(verify).toContain('overall_pass');
  });

  test('Special Offers reuses existing Auth callback and stores only safe internal return path', () => {
    const auth = read('js/auth.js');
    const specialOffer = read('js/special-offer.js');

    expect(auth).toContain("const POST_AUTH_REDIRECT_STORAGE_KEY = 'ce_auth_return_to_v1'");
    expect(auth).toContain('ceAuthGlobal.setReturnTo');
    expect(auth).toMatch(/function resolveVerificationRedirectTo\([^)]*\)\s*\{[\s\S]*return VERIFICATION_REDIRECT;/);
    expect(auth).not.toMatch(/return new URL\(redirectTarget, URLS\.base\)\.toString\(\)/);
    expect(specialOffer).toContain('window.CE_AUTH.setReturnTo(redirect)');
    expect(specialOffer).toContain("window.sessionStorage.setItem('ce_auth_return_to_v1', redirect)");
    expect(specialOffer).not.toContain('emailRedirectTo');
  });

  test('public landing RPC exposes only active public campaign content without participant data', () => {
    const sql = read('supabase/manual/special_offer_public_landing_stage1.sql');
    const verify = read('supabase/manual/special_offer_public_landing_stage1_verify.sql');
    const specialOffer = read('js/special-offer.js');

    expect(sql).toContain('create or replace function public.get_public_special_offer_landing');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = pg_catalog, public');
    expect(sql).toContain("o.status = 'active'");
    expect(sql).toContain("o.visibility = 'public'");
    expect(sql).toContain('o.start_at is not null');
    expect(sql).toContain('o.end_at is not null');
    expect(sql).toContain('now() >= o.start_at');
    expect(sql).toContain('now() <= o.end_at');
    expect(sql).toContain("grant execute on function public.get_public_special_offer_landing(text) to anon, authenticated");
    expect(sql).toContain('revoke all on function public.get_public_special_offer_landing(text) from service_role');
    expect(sql).not.toMatch(/grant\s+select\s+on\s+(table\s+)?public\.special_offers\s+to\s+anon/i);
    expect(sql).not.toMatch(/from\s+public\.special_offer_entries/i);
    expect(sql).not.toMatch(/from\s+public\.special_offer_entry_answers/i);
    expect(sql).not.toMatch(/from\s+public\.special_offer_entry_activities/i);
    expect(sql).not.toMatch(/auth\.users/i);
    expect(sql).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from)\b/i);
    expect(verify).toContain('overall_pass');
    expect(verify).toContain('no_entries_read');
    expect(verify).toContain('no_answers_read');
    expect(verify).toContain('no_activities_read');
    expect(verify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);
    expect(specialOffer).toContain("supabase.rpc('get_public_special_offer_landing'");
  });

  test('single entry hardening adds backend uniqueness without touching participant data', () => {
    const preflight = read('supabase/manual/special_offer_single_entry_per_user_stage1_preflight.sql');
    const sql = read('supabase/manual/special_offer_single_entry_per_user_stage1.sql');
    const verify = read('supabase/manual/special_offer_single_entry_per_user_stage1_verify.sql');
    const specialOffer = read('js/special-offer.js');

    expect(preflight).toContain('duplicate_offer_user_pairs');
    expect(preflight).toContain('max_entries_per_offer_user');
    expect(preflight).toContain('preflight_safe_to_continue');
    expect(preflight).not.toMatch(/\b(email|phone|reference|answers_json)\b/i);

    expect(sql).toContain('single_entry_duplicates_exist');
    expect(sql).toContain('create unique index if not exists idx_special_offer_entries_offer_user_unique');
    expect(sql).toContain('where user_id is not null');
    expect(sql).toContain('create or replace function public.submit_special_offer_entry');
    expect(sql).toContain('where e.offer_id = v_offer.id');
    expect(sql).toContain('and e.user_id = v_uid');
    expect(sql).toContain('idempotent := true');
    expect(sql).toContain('when unique_violation then');
    expect(sql).not.toContain("e.status <> 'withdrawn'");
    expect(sql).not.toMatch(/\b(update|delete)\s+public\.special_offer_entries\b/i);
    expect(sql).not.toMatch(/\b(update|delete)\s+public\.special_offer_entry_answers\b/i);
    expect(sql).not.toMatch(/special_offer_winners|special_offer_draws/i);

    expect(verify).toContain('offer_user_unique_index_exists');
    expect(verify).toContain('existing_own_entry_lookup_present');
    expect(verify).toContain('withdrawn_not_excluded_from_duplicate_check');
    expect(verify).toContain('unique_violation_handled');
    expect(verify).toContain('overall_pass');
    expect(verify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(specialOffer).toContain('data-special-offer-existing-entry');
    expect(specialOffer).toContain('refreshOwnEntryData');
  });

  test('entry lifecycle SQL adds one correction and admin hard delete without PII audit', () => {
    const preflight = read('supabase/manual/special_offer_entry_lifecycle_stage1_preflight.sql');
    const sql = read('supabase/manual/special_offer_entry_lifecycle_stage1.sql');
    const verify = read('supabase/manual/special_offer_entry_lifecycle_stage1_verify.sql');
    const specialOffer = read('js/special-offer.js');
    const admin = read('admin/special-offers.js');

    expect(preflight).toContain('lifecycle_preflight_safe_to_continue');
    expect(preflight).not.toMatch(/\b(email|phone|reference|answers_json|evidence_url)\b/i);

    expect(sql).toContain('add column if not exists correction_count smallint not null default 0');
    expect(sql).toContain('special_offer_entries_correction_count_check');
    expect(sql).toContain('create or replace function public.update_special_offer_entry_once');
    expect(sql).toContain('create or replace function public.admin_delete_special_offer_entry');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = pg_catalog, public');
    expect(sql).toContain('for update');
    expect(sql).toContain("v_entry.status not in ('submitted', 'pending_review', 'approved', 'rejected')");
    expect(sql).toContain("set status = 'pending_review'");
    expect(sql).toContain('correction_count = 1');
    expect(sql).toContain('correction_client_submission_id = p_client_correction_id');
    expect(sql).toContain('unknown_or_inactive_field');
    expect(sql).toContain('update public.special_offer_entry_answers');
    expect(sql).toContain("v_key = 'email'");
    expect(sql).toContain('to_jsonb(v_auth_email)');
    expect(sql).toContain("action = 'entry_hard_deleted'");
    expect(sql).toContain('entry_reference_mismatch');
    expect(sql).toContain('delete_reason_required');
    expect(sql).toContain('delete from public.special_offer_entries');
    expect(sql).not.toMatch(/delete\s+from\s+(auth\.users|public\.profiles|public\.special_offers|public\.special_offer_official_posts)/i);
    expect(sql).not.toMatch(/special_offer_draws/i);

    const correctionAudit = sql.slice(sql.indexOf("'entry_corrected'"), sql.indexOf('entry_id := v_entry.id;'));
    expect(correctionAudit).not.toMatch(/v_auth_email|v_phone|v_new_answers|answers_json|form_snapshot_json|shared_post_url/i);
    const deleteAuditStart = sql.indexOf('insert into public.special_offer_audit_log', sql.indexOf('create or replace function public.admin_delete_special_offer_entry'));
    const deleteAudit = sql.slice(deleteAuditStart, sql.indexOf('delete from public.special_offer_entries'));
    expect(deleteAudit).not.toMatch(/v_reason|p_reason|reference|user_id|email|phone|evidence_url|evidence_text|answers_json|form_snapshot_json/i);

    expect(verify).toContain('correction_rpc_exists');
    expect(verify).toContain('delete_rpc_exists');
    expect(verify).toContain('second_correction_blocked');
    expect(verify).toContain('correction_status_matrix_present');
    expect(verify).toContain('delete_reference_confirmation_required');
    expect(verify).toContain('delete_idempotent_retry_present');
    expect(verify).toContain('correction_audit_no_pii_values');
    expect(verify).toContain('delete_audit_no_pii_values');
    expect(verify).toContain('overall_pass');
    expect(verify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(specialOffer).toContain("supabase.rpc('update_special_offer_entry_once'");
    expect(specialOffer).toContain('data-special-offer-entry-view');
    expect(specialOffer).toContain('data-special-offer-entry-edit');
    expect(admin).toContain("client.rpc('admin_delete_special_offer_entry'");
    expect(admin).not.toMatch(/from\('special_offer_entries'\)\.delete/i);
  });
});
