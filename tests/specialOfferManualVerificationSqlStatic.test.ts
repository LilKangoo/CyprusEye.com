import fs from 'node:fs';
import path from 'node:path';

describe('Special Offers manual verification SQL stage', () => {
  const repoRoot = process.cwd();
  const baseSql = fs.readFileSync(
    path.join(repoRoot, 'supabase/manual/special_offer_manual_verification_stage1.sql'),
    'utf8',
  );
  const verifySql = fs.readFileSync(
    path.join(repoRoot, 'supabase/manual/special_offer_manual_verification_stage1_verify.sql'),
    'utf8',
  );
  const preflightSql = fs.readFileSync(
    path.join(repoRoot, 'supabase/manual/special_offer_manual_verification_stage1_preflight.sql'),
    'utf8',
  );

  it('creates only official posts, activity claims, review RPC and score backend objects', () => {
    expect(baseSql).toContain('create table if not exists public.special_offer_official_posts');
    expect(baseSql).toContain('create table if not exists public.special_offer_entry_activities');
    expect(baseSql).toContain('create or replace function public.submit_special_offer_activity_claim');
    expect(baseSql).toContain('create or replace function public.review_special_offer_activity');
    expect(baseSql).toContain('create or replace function public.special_offer_entry_score_summary');
    expect(baseSql).not.toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.special_offer_(tasks|draws|draw_entries|winners)\b/i);
    expect(baseSql).not.toMatch(/create\s+or\s+replace\s+function\s+public\..*(winner|draw)/i);
  });

  it('keeps entries and answers immutable in this stage', () => {
    expect(baseSql).not.toMatch(/insert\s+into\s+public\.special_offer_entries\b/i);
    expect(baseSql).not.toMatch(/insert\s+into\s+public\.special_offer_entry_answers\b/i);
    expect(baseSql).not.toMatch(/update\s+public\.special_offer_entries\b/i);
    expect(baseSql).not.toMatch(/update\s+public\.special_offer_entry_answers\b/i);
    expect(baseSql).not.toMatch(/delete\s+from\s+public\.special_offer_entries\b/i);
    expect(baseSql).not.toMatch(/delete\s+from\s+public\.special_offer_entry_answers\b/i);
    expect(baseSql).not.toMatch(/alter\s+table\s+public\.special_offer_entries\s+alter\s+column\s+user_id\s+set\s+not\s+null/i);
  });

  it('enforces ownership, confirmed auth, idempotency and duplicate prevention in claim RPC', () => {
    expect(baseSql).toContain('v_uid uuid := auth.uid()');
    expect(baseSql).toContain('from auth.users u');
    expect(baseSql).toContain('email_confirmed_at');
    expect(baseSql).toContain('v_entry.user_id is distinct from v_uid');
    expect(baseSql).toContain("v_entry.status not in ('submitted', 'pending_review', 'approved')");
    expect(baseSql).toContain('v_post.active is not true');
    expect(baseSql).toContain('coalesce(v_offer.allow_bonus_points, false) is not true');
    expect(baseSql).toContain('special_offer_entry_activities_entry_post_type_key unique');
    expect(baseSql).toContain('special_offer_entry_activities_entry_client_key unique');
    expect(baseSql).toContain('idempotent := true');
  });

  it('requires admin review RPC for points and applies comment 24h validation', () => {
    expect(baseSql).toContain('create or replace function public.review_special_offer_activity');
    expect(baseSql).toContain('public.is_current_user_admin()');
    expect(baseSql).toContain('for update');
    expect(baseSql).toContain("v_activity.status = 'pending'");
    expect(baseSql).toContain("v_new_status in ('approved', 'rejected', 'invalid')");
    expect(baseSql).toContain('rejection_reason_required');
    expect(baseSql).toContain('p_verified_activity_at < v_post.published_at');
    expect(baseSql).toContain('p_verified_activity_at > v_post.comment_deadline_at');
    expect(baseSql).toContain('participant_reported_at timestamptz');
  });

  it('calculates dynamic points without storing totals or selecting winners', () => {
    expect(baseSql).toContain("case when e.status = 'approved' then 1 else 0 end as base_points");
    expect(baseSql).toContain("a.activity_type = 'share'");
    expect(baseSql).toContain("a.activity_type = 'comment'");
    expect(baseSql).toContain('a.verified_activity_at <= p.comment_deadline_at');
    expect(baseSql).not.toMatch(/total_points\s+(integer|numeric|bigint)\s+not\s+null/i);
    expect(baseSql).not.toMatch(/create\s+(table|view|function)[\s\S]+special_offer_winners/i);
    expect(baseSql).not.toMatch(/create\s+(table|view|function)[\s\S]+draw_machine/i);
  });

  it('keeps audit metadata free from evidence and participant PII values', () => {
    expect(baseSql).toContain("'activity_claimed'");
    expect(baseSql).toContain("'activity_reviewed'");
    expect(baseSql).not.toContain("'evidence_url'");
    expect(baseSql).not.toContain("'evidence_text'");
    expect(baseSql).not.toContain("'answers_json'");
    expect(baseSql).not.toContain("'form_snapshot_json'");
    expect(baseSql).not.toContain("'phone'");
    expect(baseSql).not.toContain("'email'");
  });

  it('blocks direct public writes and verifies the same constraints read-only', () => {
    expect(baseSql).toContain('revoke all on table public.special_offer_official_posts from public');
    expect(baseSql).toContain('revoke all on table public.special_offer_entry_activities from authenticated');
    expect(baseSql).toContain('grant select on table public.special_offer_official_posts to anon, authenticated');
    expect(baseSql).toContain('grant select on table public.special_offer_entry_activities to authenticated');
    expect(verifySql).toContain('no_public_direct_write_grants');
    expect(verifySql).toContain('overall_pass');
    expect(preflightSql).toContain('preflight_safe_to_continue');
    expect(verifySql).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);
    expect(preflightSql).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);
  });
});
