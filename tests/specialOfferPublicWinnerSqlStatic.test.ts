import fs from 'node:fs';
import path from 'node:path';

describe('Special Offers public winner result SQL stage', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  const preflight = read('supabase/manual/special_offer_public_winner_stage1_preflight.sql');
  const sql = read('supabase/manual/special_offer_public_winner_stage1.sql');
  const verify = read('supabase/manual/special_offer_public_winner_stage1_verify.sql');

  test('preflight and verify are read-only diagnostics', () => {
    expect(preflight).toContain('preflight_safe_to_continue');
    expect(preflight).toContain('winner_publications_exists');
    expect(preflight).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(verify).toContain('overall_pass');
    expect(verify).toContain('winner_requires_publication_consent');
    expect(verify).toContain('winner_does_not_return_score');
    expect(verify).toContain("coalesce((select source");
    expect(verify).not.toMatch(/has_function_privilege\(\s*'PUBLIC'/i);
    expect(verify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);
  });

  test('base SQL keeps ended public campaigns readable while leaving writes to existing guarded RPC', () => {
    expect(sql).toContain('create or replace function public.get_public_special_offer_landing');
    expect(sql).toContain("o.status in ('active', 'ended', 'locked')");
    expect(sql).toContain("o.visibility = 'public'");
    expect(sql).toContain('o.archived_at is null');
    expect(sql).toContain('now() >= o.start_at');
    expect(sql).not.toContain('now() <= o.end_at');
    expect(sql).not.toContain('create or replace function public.submit_special_offer_entry');
    expect(sql).not.toContain('create or replace function public.submit_special_offer_activity_claim');
  });

  test('public winner RPC exposes only safe fields through function grants', () => {
    expect(sql).toContain('create or replace function public.get_public_special_offer_winner');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = pg_catalog, public');
    expect(sql).toContain("'winner_published'");
    expect(sql).toContain("'public_name'");
    expect(sql).toContain("'published_at'");
    expect(sql).toContain("'campaign_slug'");
    expect(sql).toContain("w.status = 'published'");
    expect(sql).toContain('p.publication_consent_confirmed is true');
    expect(sql).toContain('p.unpublished_at is null');
    expect(sql).toContain('nullif(btrim(p.public_name), \'\') is not null');
    expect(sql).toContain('revoke all on function public.get_public_special_offer_winner(text) from service_role');
    expect(sql).toContain('grant execute on function public.get_public_special_offer_winner(text) to anon, authenticated');
    expect(sql).not.toMatch(/grant\s+select\s+on\s+(table\s+)?public\.special_offer_winner_/i);
    expect(sql).not.toMatch(/'entry_id'|'workflow_id'|'shortlist_id'|'user_id'|'email'|'phone'|'date_of_birth'|'score'|'total_points'|'evidence_url'|'committee_notes'|'contact_notes'/i);
  });

  test('frontend uses public winner RPC without local winner persistence or raw table reads', () => {
    const source = read('js/special-offer.js');
    expect(source).toContain("supabase.rpc('get_public_special_offer_winner'");
    expect(source).not.toMatch(/from\(['"]special_offer_winner_(workflows|shortlist|committee_notes|contact_events|publications)['"]\)/);
    expect(source).not.toMatch(/localStorage\.setItem\([^)]*winner|sessionStorage\.setItem\([^)]*winner/i);
    expect(source).toContain('renderWinnerSection');
    expect(source).toContain('isCampaignOpenForSubmissions');
  });
});
