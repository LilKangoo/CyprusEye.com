import fs from 'node:fs';
import path from 'node:path';

describe('Special Offer entry submit ambiguity hotfix SQL', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const preflight = read('supabase/manual/special_offer_entry_submit_ambiguity_preflight.sql');
  const fix = read('supabase/manual/special_offer_entry_submit_ambiguity_fix.sql');
  const verify = read('supabase/manual/special_offer_entry_submit_ambiguity_verify.sql');
  const strippedVerify = verify.replace(/--.*$/gm, '').toLowerCase();

  test('preflight and verify are read-only', () => {
    for (const sql of [preflight, verify]) {
      expect(sql).toContain('submit_special_offer_entry');
      expect(sql).toContain('entry_id');
      expect(sql).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+public\.|delete\s+from|merge\s+into|truncate\s+|alter\s+table|create\s+|drop\s+|grant\s+|revoke\s+)/i);
    }
    expect(preflight).toContain('preflight_safe_to_continue');
    expect(preflight).toContain('target as (');
    expect(preflight).toContain('from target');
    expect(preflight).toContain("(select count(*) filter (where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid') = 1 from fn)");
    expect(preflight).not.toContain("count(*) filter (where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid') = 1 as four_arg_exists");
    expect(verify).toContain('overall_pass');
  });

  test('fix only replaces the six-argument submit wrapper contract', () => {
    expect(fix).toContain('create or replace function public.submit_special_offer_entry(');
    expect(fix).toContain('p_client_submission_id uuid,');
    expect(fix).toContain('p_referral_code text,');
    expect(fix).toContain('p_referral_source text');
    expect(fix).toContain('returns table(entry_id uuid, status text, reference text, idempotent boolean, referral_attributed boolean)');
    expect(fix).toContain('from public.submit_special_offer_entry(');
    expect(fix).toContain('p_client_submission_id');
    expect(fix).not.toContain('drop function public.submit_special_offer_entry');
    expect(fix).not.toMatch(/create\s+or\s+replace\s+function\s+public\.submit_special_offer_entry\s*\(\s*p_offer_slug\s+text,\s*p_lang\s+text,\s*p_answers\s+jsonb,\s*p_client_submission_id\s+uuid\s*\)/i);
  });

  test('fix removes ambiguous entry_id conflict target and keeps table aliases', () => {
    expect(fix).toContain('v_return_entry_id uuid');
    expect(fix).toContain('v_return_entry_id := v_result.entry_id');
    expect(fix).toContain('where e.id = v_return_entry_id');
    expect(fix).toContain('and e.user_id = v_uid');
    expect(fix).toContain('on conflict on constraint special_offer_entry_referrals_pkey do nothing');
    expect(fix).not.toContain('on conflict (entry_id) do nothing');
    expect(fix).toContain('where r.entry_id = v_return_entry_id');
  });

  test('verify checks ambiguity removal, ACL and existing guards', () => {
    const requiredChecks = [
      'exact_rpc_signature',
      'return_type_preserved',
      'owner_postgres',
      'security_definer',
      'safe_search_path',
      'public_execute_absent',
      'anon_execute_absent',
      'authenticated_execute_present',
      'auth_uid_guard_present',
      'confirmed_email_guard_preserved_in_base_submit',
      'one_entry_guard_preserved_in_base_submit',
      'campaign_guard_preserved_in_base_submit',
      'old_on_conflict_entry_id_removed',
      'constraint_conflict_target_used',
      'entry_referral_lookup_qualified',
      'entry_select_qualified',
      'overall_pass',
    ];
    for (const check of requiredChecks) {
      expect(verify).toContain(check);
    }
    expect(strippedVerify).not.toMatch(/has_function_privilege\(\s*'public'/i);
  });

  test('fix does not alter points, activities, winner workflow, RLS or table schema', () => {
    expect(fix).not.toMatch(/\bspecial_offer_entry_activities\b|\bpoints_awarded\b|\bspecial_offer_winner\b|\bdraw machine\b/i);
    expect(fix).not.toMatch(/\balter\s+table\b|\bcreate\s+table\b|\bdrop\s+table\b/i);
    expect(fix).not.toMatch(/\bdelete\s+from\b|\btruncate\s+\b/i);
  });
});
