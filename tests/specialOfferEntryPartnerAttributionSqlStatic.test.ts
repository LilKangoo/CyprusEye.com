import fs from 'node:fs';
import path from 'node:path';

describe('Special Offers entry partner attribution SQL stage', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const stripSqlStringsAndComments = (value: string) =>
    value
      .replace(/--.*$/gm, '')
      .replace(/'([^']|'')*'/g, "''")
      .toLowerCase();

  const preflight = read('supabase/manual/special_offer_entry_partner_attribution_stage1_preflight.sql');
  const sql = read('supabase/manual/special_offer_entry_partner_attribution_stage1.sql');
  const verify = read('supabase/manual/special_offer_entry_partner_attribution_stage1_verify.sql');
  const diagnostics = read('supabase/manual/special_offer_entry_partner_attribution_stage1_verify_diagnostics.sql');
  const stripped = stripSqlStringsAndComments(sql);

  test('preflight and verify are read-only diagnostics', () => {
    expect(preflight).toContain('preflight_safe_to_continue');
    expect(preflight).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+public\.|delete\s+from|merge\s+into|truncate\s+|alter\s+table|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(verify).toContain('overall_pass');
    expect(verify).toContain('aclexplode(coalesce');
    expect(verify).toContain('resolver_public_execute_absent');
    expect(verify).toContain('resolver_anon_execute_absent');
    expect(verify).toContain('resolver_authenticated_execute_absent');
    expect(verify).toContain('resolver_service_role_execute_absent');
    expect(verify).not.toContain('resolver_execute_absent');
    expect(verify).toContain('review_rpc_exists');
    expect(verify).toContain('review_rpc_exact_overload_selected');
    expect(verify).toContain('review_no_direct_attribution_insert');
    expect(verify).toContain('review_no_direct_attribution_update');
    expect(verify).toContain('review_no_direct_attribution_delete');
    expect(verify).toContain('review_no_indirect_attribution_write');
    expect(verify).toContain('review_does_not_touch_attribution');
    expect(verify).not.toMatch(/has_function_privilege\(\s*'PUBLIC'/i);
    expect(verify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+public\.|delete\s+from|merge\s+into|truncate\s+|alter\s+table|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(diagnostics).toContain('check_name');
    expect(diagnostics).toContain('pass');
    expect(diagnostics).toContain('details');
    expect(diagnostics).toContain('sort_group');
    expect(diagnostics).toContain('resolver_public_execute_absent');
    expect(diagnostics).toContain('review_rpc_exact_overload_selected');
    expect(diagnostics).toContain('review_no_direct_attribution_insert');
    expect(diagnostics).toContain('review_no_direct_attribution_update');
    expect(diagnostics).toContain('review_no_direct_attribution_delete');
    expect(diagnostics).toContain('review_no_indirect_attribution_write');
    expect(diagnostics).toContain('review_does_not_touch_attribution');
    expect(diagnostics).not.toMatch(/has_function_privilege\(\s*'PUBLIC'/i);
    expect(diagnostics).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+public\.|delete\s+from|merge\s+into|truncate\s+|alter\s+table|create\s+|drop\s+|grant\s+|revoke\s+)/i);
  });

  test('main verify and diagnostics reconcile review attribution immutability', () => {
    const requiredReviewChecks = [
      'review_rpc_exact_overload_selected',
      'review_no_direct_attribution_insert',
      'review_no_direct_attribution_update',
      'review_no_direct_attribution_delete',
      'review_no_indirect_attribution_write',
      'review_does_not_touch_attribution',
    ];

    for (const check of requiredReviewChecks) {
      expect(verify).toContain(check);
      expect(diagnostics).toContain(check);
    }

    expect(verify).toContain("identity_args = 'p_entry_id uuid, p_new_status text, p_review_note text, p_rejection_reason text'");
    expect(diagnostics).toContain("identity_args = 'p_entry_id uuid, p_new_status text, p_review_note text, p_rejection_reason text'");
    expect(diagnostics).not.toContain("identity_args = 'p_entry_id uuid, p_decision text, p_note text, p_reason text'");
  });

  test('creates a one-to-one attribution table with entry cascade and no raw partner access', () => {
    expect(sql).toContain('create table if not exists public.special_offer_entry_referrals');
    expect(sql).toContain('entry_id uuid primary key');
    expect(sql).toContain('foreign key (entry_id, offer_id)');
    expect(sql).toContain('references public.special_offer_entries(id, offer_id)');
    expect(sql).toContain('on delete cascade');
    expect(sql).toContain('partner_id uuid not null references public.partners(id) on delete restrict');
    expect(sql).toContain('referrer_user_id uuid references public.profiles(id) on delete set null');
    expect(sql).toContain('alter table public.special_offer_entry_referrals enable row level security');
    expect(sql).toContain('special_offer_entry_referrals_admin_select');
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all).*special_offer_entry_referrals\s+to\s+(public|anon|authenticated)/i);
  });

  test('uses backend first-touch resolution and never accepts partner id from the client', () => {
    expect(sql).toContain('create or replace function public.special_offer_resolve_entry_referral');
    expect(sql).toContain('from public.profiles p');
    expect(sql).toContain('where p.id = p_user_id');
    expect(sql).toContain('for update');
    expect(sql).toContain('if v_profile.referred_by is not null');
    expect(sql).toContain('public.resolve_referral_code(v_code)');
    expect(sql).toContain('public.generate_profile_referral_code(referrer.id, null)');
    expect(sql).toContain('and p.referred_by is null');
    expect(sql).toContain("p.status = 'active'");
    expect(sql).not.toMatch(/p_partner_id|client_partner/i);
  });

  test('adds a non-ambiguous submit overload that preserves the existing submit RPC', () => {
    expect(sql).toContain('create or replace function public.submit_special_offer_entry(');
    expect(sql).toContain('p_client_submission_id uuid,');
    expect(sql).toContain('p_referral_code text,');
    expect(sql).toContain('p_referral_source text');
    expect(sql).toContain('referral_attributed boolean');
    expect(sql).toContain('from public.submit_special_offer_entry(');
    expect(sql).toContain('p_offer_slug,');
    expect(sql).toContain('p_client_submission_id');
    expect(sql).toContain('coalesce(v_result.idempotent, false) is false');
    expect(sql).toContain('on conflict (entry_id) do nothing');
    expect(sql).not.toContain('drop function public.submit_special_offer_entry(text, text, jsonb, uuid)');
  });

  test('does not change correction, score, commissions, payouts, winner workflow or public ranking', () => {
    expect(stripped).not.toMatch(/\baffiliate_commission\b|\bpayout\b|\bscore_summary\b|\branking\b/);
    expect(sql).not.toMatch(/create\s+table\s+.*winner|special_offer_winner_workflows|draw machine|automatic winner/i);
    expect(sql).not.toMatch(/update\s+public\.special_offer_entry_activities|points_awarded|bonus_points/i);
  });

  test('audit metadata avoids participant PII and full referral URL/session data', () => {
    const auditStart = sql.indexOf("'special_offer.entry_referral_attributed'");
    expect(auditStart).toBeGreaterThan(0);
    const auditBlock = sql.slice(auditStart, sql.indexOf('end if;', auditStart));
    expect(auditBlock).toContain('pii_logged');
    expect(auditBlock).toContain('referral_code_logged');
    expect(auditBlock).toContain('answers_logged');
    expect(auditBlock).not.toMatch(/email|phone|dob|date_of_birth|answers_json|evidence|cookie|token|session|referral_url/i);
  });
});
