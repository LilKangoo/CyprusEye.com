import fs from 'node:fs';
import path from 'node:path';

describe('Special Offers partner listing SQL stage', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const stripSqlStringsAndComments = (value: string) =>
    value
      .replace(/--.*$/gm, '')
      .replace(/'([^']|'')*'/g, "''")
      .toLowerCase();

  const preflight = read('supabase/manual/special_offer_partner_listing_stage1_preflight.sql');
  const sql = read('supabase/manual/special_offer_partner_listing_stage1.sql');
  const verify = read('supabase/manual/special_offer_partner_listing_stage1_verify.sql');
  const functionSource = sql.slice(sql.indexOf('create or replace function public.get_partner_active_special_offers'));
  const strippedFunction = stripSqlStringsAndComments(functionSource);

  test('preflight and verify are read-only diagnostics', () => {
    expect(preflight).toContain('preflight_safe_to_continue');
    expect(preflight).toContain('partner_helper_exists');
    expect(preflight).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(verify).toContain('overall_pass');
    expect(verify).toContain('partner_authorization_guard_present');
    expect(verify).toContain('archived_and_ended_locked_excluded');
    expect(verify).toContain('aclexplode(coalesce');
    expect(verify).not.toMatch(/has_function_privilege\(\s*'PUBLIC'/i);
    expect(verify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+table|create\s+|drop\s+|grant\s+|revoke\s+)/i);
  });

  test('defines a single active partner listing RPC instead of N+1 public landing calls', () => {
    expect(sql).toContain('create or replace function public.get_partner_active_special_offers');
    expect(sql).toContain('returns table');
    expect(sql).toContain('stable');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = pg_catalog, public');
    expect(sql).not.toContain('get_public_special_offer_landing');
  });

  test('requires authenticated active partner authorization inside the RPC', () => {
    expect(sql).toContain('v_user_id uuid := auth.uid()');
    expect(sql).toContain('not_authenticated');
    expect(sql).toContain('from public.partners p');
    expect(sql).toContain("p.status = 'active'");
    expect(sql).toContain('public.is_partner_user(p.id)');
    expect(sql).toContain('partner_required');
  });

  test('enforces active public in-window campaigns and excludes ended or locked listing rules', () => {
    expect(sql).toContain("o.status = 'active'");
    expect(sql).toContain("o.visibility = 'public'");
    expect(sql).toContain('o.start_at is not null');
    expect(sql).toContain('o.end_at is not null');
    expect(sql).toContain('now() >= o.start_at');
    expect(sql).toContain('now() <= o.end_at');
    expect(sql).toContain('o.archived_at is null');
    expect(sql).not.toContain("o.status in ('active', 'ended', 'locked')");
    expect(sql).not.toMatch(/status\s+in\s*\([^)]*ended/i);
    expect(sql).not.toMatch(/status\s+in\s*\([^)]*locked/i);
  });

  test('validates PL EN HE language and resolves only existing translations', () => {
    expect(sql).toContain("v_requested_lang not in ('pl', 'en', 'he')");
    expect(sql).toContain('invalid_language');
    expect(sql).toContain('left join public.special_offer_translations req');
    expect(sql).toContain('req.lang = v_requested_lang');
    expect(sql).toContain('coalesce(req.lang, en.lang, pl.lang, he.lang) as resolved_lang');
    expect(sql).toContain('coalesce(req.title, en.title, pl.title, he.title) as title');
  });

  test('returns minimal public card payload and never referral URLs or private identifiers', () => {
    const returnsTable = sql.slice(sql.indexOf('returns table'), sql.indexOf('language plpgsql'));
    [
      'slug text',
      'requested_lang text',
      'resolved_lang text',
      'title text',
      'short_description text',
      'cover_image_url text',
      'start_at timestamptz',
      'end_at timestamptz',
    ].forEach((fragment) => expect(returnsTable).toContain(fragment));

    expect(returnsTable).not.toMatch(/offer_id|entry_id|user_id|partner_id|email|phone|dob|date_of_birth|reference|score|referral/i);
    expect(sql).not.toMatch(/referral_code|buildReferralLink|ref=/i);
  });

  test('does not read entries, activities, audit or winner data', () => {
    [
      'special_offer_entries',
      'special_offer_entry_answers',
      'special_offer_entry_activities',
      'special_offer_audit_log',
      'special_offer_winner_workflows',
      'special_offer_winner_shortlist',
      'special_offer_winner_committee_notes',
      'special_offer_winner_contact_events',
      'special_offer_winner_publications',
    ].forEach((table) => {
      expect(strippedFunction).not.toContain(table);
    });
  });

  test('uses no direct writes or raw table grants for Partner Portal', () => {
    expect(strippedFunction).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from|merge\s+into|truncate\s+|drop\s+|alter\s+table)\b/i);
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all).*on\s+(table\s+)?public\.special_offers\s+to/i);
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all).*on\s+(table\s+)?public\.special_offer_translations\s+to/i);
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all).*on\s+(table\s+)?public\.partners\s+to/i);
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all).*on\s+(table\s+)?public\.partner_users\s+to/i);
  });

  test('function ACL allows authenticated only and excludes public anon service role', () => {
    expect(sql).toContain('revoke all on function public.get_partner_active_special_offers(text) from public');
    expect(sql).toContain('revoke all on function public.get_partner_active_special_offers(text) from anon');
    expect(sql).toContain('revoke all on function public.get_partner_active_special_offers(text) from authenticated');
    expect(sql).toContain('revoke all on function public.get_partner_active_special_offers(text) from service_role');
    expect(sql).toContain('grant execute on function public.get_partner_active_special_offers(text) to authenticated');
    expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.get_partner_active_special_offers\(text\)\s+to\s+(public|anon|service_role)/i);
  });
});
