import fs from 'node:fs';
import path from 'node:path';

describe('Special Offers SEO & Social SQL stage', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const stripSqlStringsAndComments = (value: string) =>
    value
      .replace(/--.*$/gm, '')
      .replace(/'([^']|'')*'/g, "''")
      .toLowerCase();

  const preflight = read('supabase/manual/special_offer_seo_social_stage1_preflight.sql');
  const sql = read('supabase/manual/special_offer_seo_social_stage1.sql');
  const verify = read('supabase/manual/special_offer_seo_social_stage1_verify.sql');
  const functionStart = sql.indexOf('create or replace function public.get_public_special_offer_seo');
  const functionEnd = sql.indexOf('alter function public.get_public_special_offer_seo');
  const functionSource = sql.slice(functionStart, functionEnd);
  const strippedFunction = stripSqlStringsAndComments(functionSource);

  test('preflight and verify are read-only diagnostics', () => {
    expect(preflight).toContain('preflight_safe_to_continue');
    expect(preflight).toContain('meta_image_url_exists');
    expect(preflight).toContain('meta_image_alt_exists');
    expect(preflight).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(verify).toContain('overall_pass');
    expect(verify).toContain('public_execute_absent');
    expect(verify).toContain('active_ended_locked_guard_present');
    expect(verify).toContain('image_fallback_present');
    expect(verify).not.toMatch(/has_function_privilege\(\s*'PUBLIC'/i);
    expect(verify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);
  });

  test('reuses existing SEO title and description columns and adds only image fields', () => {
    expect(sql).toContain('add column if not exists meta_image_url text');
    expect(sql).toContain('add column if not exists meta_image_alt text');
    expect(sql).not.toMatch(/add\s+column\s+if\s+not\s+exists\s+(meta_title|meta_description)\b/i);
    expect(sql).not.toMatch(/add\s+column\s+if\s+not\s+exists\s+(seo_title|seo_description)\b/i);
    expect(verify).toContain('existing_seo_title_reused');
    expect(verify).toContain('existing_seo_description_reused');
  });

  test('creates a separate public-safe SEO RPC without replacing the landing RPC', () => {
    expect(sql).toContain('create or replace function public.get_public_special_offer_seo');
    expect(sql).toContain('p_slug text');
    expect(sql).toContain('p_lang text');
    expect(sql).toContain('returns jsonb');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = pg_catalog, public');
    expect(sql).not.toMatch(/create\s+or\s+replace\s+function\s+public\.get_public_special_offer_landing/i);
    expect(sql).toContain("to_regprocedure('public.get_public_special_offer_landing(text)')");
  });

  test('enforces public readable campaign status and language rules', () => {
    expect(functionSource).toContain("v_requested_lang not in ('pl', 'en', 'he')");
    expect(functionSource).toContain("o.visibility = 'public'");
    expect(functionSource).toContain('o.archived_at is null');
    expect(functionSource).toContain('o.start_at is not null');
    expect(functionSource).toContain('now() >= o.start_at');
    expect(functionSource).toContain("o.status in ('active', 'ended', 'locked')");
    expect(functionSource).not.toContain('now() <= o.end_at');
    expect(functionSource).not.toMatch(/status\s*=\s*'draft'|status\s*=\s*'scheduled'|visibility\s*=\s*'private'|visibility\s*=\s*'unlisted'/i);
  });

  test('implements localized fallback order and minimal public payload', () => {
    expect(functionSource).toContain('when t.lang = v_requested_lang then 0');
    expect(functionSource).toContain("when t.lang = 'en' then 1");
    expect(functionSource).toContain("when t.lang = 'pl' then 2");
    expect(functionSource).toContain("when t.lang = 'he' then 3");
    expect(functionSource).toContain('v_translation.seo_title, v_translation.title, v_offer.slug');
    expect(functionSource).toContain('v_translation.seo_description');
    expect(functionSource).toContain('v_translation.short_description');
    expect(functionSource).toContain('v_translation.full_description');
    expect(functionSource).toContain('regexp_replace');
    expect(functionSource).toContain('v_offer.meta_image_url');
    expect(functionSource).toContain('v_offer.cover_image_url');
    expect(functionSource).toContain('v_offer.hero_image_url');
    expect(functionSource).toContain('v_translation.meta_image_alt');

    [
      'campaign_slug',
      'requested_lang',
      'resolved_lang',
      'meta_title',
      'meta_description',
      'meta_image_url',
      'meta_image_alt',
      'campaign_status',
      'start_at',
      'end_at',
    ].forEach((field) => expect(functionSource).toContain(`'${field}'`));
  });

  test('does not expose private Special Offers data or perform writes', () => {
    [
      'special_offer_entries',
      'special_offer_entry_answers',
      'special_offer_entry_activities',
      'special_offer_entry_referrals',
      'special_offer_audit_log',
      'special_offer_winner_workflows',
      'special_offer_winner_shortlist',
      'special_offer_winner_committee_notes',
      'special_offer_winner_contact_events',
      'special_offer_winner_publications',
    ].forEach((table) => {
      expect(strippedFunction).not.toContain(table);
    });

    expect(functionSource).not.toMatch(/'offer_id'|'entry_id'|'user_id'|'partner_id'|'email'|'phone'|'dob'|'date_of_birth'|'reference'|'score'|'workflow_id'|'shortlist_id'|'contact'/i);
    expect(strippedFunction).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from|merge\s+into|truncate\s+|drop\s+|alter\s+table)\b/i);
  });

  test('uses function ACL only and adds no raw public table grants', () => {
    expect(sql).toContain('revoke all on function public.get_public_special_offer_seo(text,text) from public');
    expect(sql).toContain('revoke all on function public.get_public_special_offer_seo(text,text) from anon');
    expect(sql).toContain('revoke all on function public.get_public_special_offer_seo(text,text) from authenticated');
    expect(sql).toContain('revoke all on function public.get_public_special_offer_seo(text,text) from service_role');
    expect(sql).toContain('grant execute on function public.get_public_special_offer_seo(text,text) to anon, authenticated');
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all).*on\s+(table\s+)?public\.special_offers\s+to\s+(public|anon|authenticated)/i);
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all).*on\s+(table\s+)?public\.special_offer_translations\s+to\s+(public|anon|authenticated)/i);
  });
});
