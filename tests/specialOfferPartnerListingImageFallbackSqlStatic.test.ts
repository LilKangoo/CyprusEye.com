import fs from 'node:fs';
import path from 'node:path';

describe('Partner Special Offers image fallback SQL patch static guards', () => {
  const root = process.cwd();
  const baseSql = fs.readFileSync(path.join(root, 'supabase/manual/special_offer_partner_listing_image_fallback_stage1.sql'), 'utf8');
  const verifySql = fs.readFileSync(path.join(root, 'supabase/manual/special_offer_partner_listing_image_fallback_stage1_verify.sql'), 'utf8');

  test('keeps the existing RPC signature and return type', () => {
    expect(baseSql).toContain('create or replace function public.get_partner_active_special_offers');
    expect(baseSql).toContain('p_lang text');
    expect(baseSql).toContain('cover_image_url text');
    expect(baseSql).not.toMatch(/returns table \([\s\S]*meta_image_url text/i);
    expect(baseSql).not.toMatch(/drop function/i);
  });

  test('adds cover to hero to meta image fallback without widening private data', () => {
    expect(baseSql).toContain('o.meta_image_url');
    expect(baseSql).toContain("coalesce(eo.cover_image_url, eo.hero_image_url, eo.meta_image_url, '')");
    expect(baseSql).not.toContain('special_offer_entries');
    expect(baseSql).not.toContain('special_offer_entry_referrals');
    expect(baseSql).not.toContain('special_offer_winner_');
    expect(baseSql).not.toContain('special_offer_audit_log');
  });

  test('preserves partner auth, active-only window and ACL verify coverage', () => {
    expect(baseSql).toContain('auth.uid()');
    expect(baseSql).toContain('public.is_partner_user(p.id)');
    expect(baseSql).toContain("o.status = 'active'");
    expect(baseSql).toContain("o.visibility = 'public'");
    expect(baseSql).toContain('now() <= o.end_at');
    expect(baseSql).toContain('o.archived_at is null');
    expect(verifySql).toContain('image_fallback_order_present');
    expect(verifySql).toContain('service_role_execute_absent');
    expect(verifySql).toContain('overall_pass');
  });
});
