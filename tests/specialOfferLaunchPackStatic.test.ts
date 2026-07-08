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
    expect(preflight).toContain('entry_collection_currently_ready');
    expect(preflight).toContain('activity_claims_currently_ready');
    expect(preflight).toContain('official_post_required_only_for_activity_claims');
    expect(preflight).toContain('manual_auth_gate_pending');
    expect(preflight).toContain('manual_legal_gate_pending');

    expect(verify).toContain('entry_collection_ready');
    expect(verify).toContain('activity_claims_ready');
    expect(verify).toContain('full_promotion_ready');
    expect(verify).toMatch(/entry_collection_ready\s+as\s+overall_pass/i);

    const entryReadyDefinition = verify.match(/\)\s+as entry_collection_ready/i)?.index ?? -1;
    const activityReadyDefinition = verify.match(/\)\s+as activity_claims_ready/i)?.index ?? -1;
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
});
