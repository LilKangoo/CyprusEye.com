import fs from 'node:fs';
import path from 'node:path';

describe('Special Offers manual winner selection SQL stage', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const stripSqlStringsAndComments = (value: string) =>
    value
      .replace(/--.*$/gm, '')
      .replace(/'([^']|'')*'/g, "''");

  const preflight = read('supabase/manual/special_offer_manual_winner_stage1_preflight.sql');
  const sql = read('supabase/manual/special_offer_manual_winner_stage1.sql');
  const verify = read('supabase/manual/special_offer_manual_winner_stage1_verify.sql');

  test('preflight and verify are read-only and expose clear pass flags', () => {
    expect(preflight).toContain('preflight_safe_to_continue');
    expect(preflight).toContain('approved_entries');
    expect(preflight).toContain('pending_activities');
    expect(preflight).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(verify).toContain('overall_pass');
    expect(verify).toContain('one_active_workflow_index_exists');
    expect(verify).toContain('publish_requires_consent');
    expect(verify).toContain('hard_delete_workflow_guard_present');
    expect(verify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);
  });

  test('preflight is safe before manual winner tables exist', () => {
    const parsedPreflight = stripSqlStringsAndComments(preflight);
    expect(preflight).toContain("to_regclass('public.special_offer_winner_workflows')");
    expect(preflight).toContain('winner_workflows_status_column_exists');
    expect(preflight).toContain('case when not eo.winner_workflows_exists then 0');
    expect(preflight).toContain('when not eo.winner_workflows_status_column_exists then null');
    expect(preflight).toContain('query_to_xml');
    expect(preflight).toContain('active_or_published_workflow_count');
    expect(parsedPreflight).not.toMatch(/\bfrom\s+public\.special_offer_winner_/i);
    expect(parsedPreflight).not.toMatch(/\bjoin\s+public\.special_offer_winner_/i);
    expect(parsedPreflight).not.toMatch(/\bfrom\s+public\.special_offer(s|_entries|_entry_activities)\b/i);
    expect(parsedPreflight).not.toMatch(/\bjoin\s+public\.special_offer(s|_entries|_entry_activities)\b/i);
  });

  test('preflight final select resolves every CTE alias and returns one diagnostic row', () => {
    const parsedPreflight = stripSqlStringsAndComments(preflight).replace(/\s+/g, ' ');
    expect(parsedPreflight).toMatch(
      /from required_objects ro cross join existing_objects eo cross join offer_counts oc cross join entry_counts ec cross join activity_counts ac cross join existing_active_workflows eaw;/i,
    );
    ['ro.', 'eo.', 'oc.', 'ec.', 'ac.', 'eaw.'].forEach((alias) => {
      expect(parsedPreflight).toContain(alias);
    });
  });

  test('creates manual winner workflow tables without draw machine or public ranking', () => {
    expect(sql).toContain('create table if not exists public.special_offer_winner_workflows');
    expect(sql).toContain('create table if not exists public.special_offer_winner_shortlist');
    expect(sql).toContain('create table if not exists public.special_offer_winner_committee_notes');
    expect(sql).toContain('create table if not exists public.special_offer_winner_contact_events');
    expect(sql).toContain('create table if not exists public.special_offer_winner_publications');
    expect(sql).toContain('idx_special_offer_winner_workflows_one_active');
    expect(sql).toContain('idx_special_offer_winner_shortlist_one_primary');
    expect(sql).toContain('idx_special_offer_winner_shortlist_backup_rank');
    expect(sql).not.toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.special_offer_.*draw/i);
    expect(sql).not.toMatch(/random\s*\(/i);
    expect(sql).not.toMatch(/public_rank|leaderboard/i);
    expect(sql).not.toMatch(/create\s+(table|view|materialized\s+view)\s+if\s+not\s+exists\s+public\.[^\s;]*(rank|ranking|leaderboard)/i);
  });

  test('defines explicit admin RPC instead of a generic status updater', () => {
    [
      'admin_start_special_offer_winner_workflow',
      'admin_add_special_offer_shortlist_entry',
      'admin_remove_special_offer_shortlist_entry',
      'admin_mark_special_offer_shortlist_rechecked',
      'admin_add_special_offer_committee_note',
      'admin_archive_special_offer_committee_note',
      'admin_set_special_offer_primary_candidate',
      'admin_set_special_offer_backup_candidate',
      'admin_start_special_offer_winner_contact',
      'admin_record_special_offer_winner_response',
      'admin_promote_special_offer_backup',
      'admin_confirm_special_offer_winner',
      'admin_publish_special_offer_winner',
      'admin_unpublish_special_offer_winner',
      'admin_cancel_special_offer_winner_workflow',
      'admin_reopen_special_offer_winner_workflow',
    ].forEach((name) => {
      expect(sql).toContain(`create or replace function public.${name}`);
      expect(sql).toContain(`grant execute on function public.${name}`);
    });
    expect(sql).not.toMatch(/admin_update_special_offer_winner_status/i);
  });

  test('enforces manual workflow rules and winner publication consent', () => {
    expect(sql).toContain("v_offer.winner_selection_mode <> 'manual_selection'");
    expect(sql).toContain('pending_entry_reviews');
    expect(sql).toContain('pending_activity_reviews');
    expect(sql).toContain("v_entry.status <> 'approved'");
    expect(sql).toContain("role = 'primary'");
    expect(sql).toContain('backup_rank_duplicate');
    expect(sql).toContain('accepted_contact_required');
    expect(sql).toContain('winner_not_confirmed');
    expect(sql).toContain('publication_consent_required');
    expect(sql).toContain('unpublish_reason_required');
    expect(sql).toContain('winner_workflow_not_cancellable');
    expect(sql).toContain('winner_workflow_not_cancelled');
  });

  test('keeps score snapshots limited and prevents automatic winner selection by score', () => {
    expect(sql).toContain('special_offer_winner_score_snapshot');
    expect(sql).toContain("'base_points'");
    expect(sql).toContain("'share_points'");
    expect(sql).toContain("'comment_points'");
    expect(sql).toContain("'bonus_points'");
    expect(sql).toContain("'total_points'");
    expect(sql).toContain("'approved_activity_count'");
    expect(sql).toContain("'snapshot_at'");
    const snapshotFn = sql.slice(
      sql.indexOf('create or replace function public.special_offer_winner_score_snapshot'),
      sql.indexOf('create or replace function public.special_offer_winner_workflow_readiness'),
    );
    expect(snapshotFn).not.toMatch(/email|phone|date_of_birth|answers_json|form_snapshot_json|evidence_url|evidence_text/i);
    expect(sql).not.toMatch(/order\s+by\s+total_points\s+desc[\s\S]{0,240}(insert|update)\s+public\.special_offer_winner/i);
  });

  test('integrates correction needs_recheck and hard-delete workflow guards', () => {
    expect(sql).toContain('create or replace function public.update_special_offer_entry_once');
    expect(sql).toContain('entry_locked_by_winner_workflow');
    expect(sql).toContain("w.status in ('contacting', 'winner_confirmed', 'published')");
    expect(sql).toContain("set status = 'needs_recheck'");
    expect(sql).toContain("role = 'shortlisted'");
    expect(sql).toContain('create or replace function public.admin_delete_special_offer_entry');
    expect(sql).toContain('entry_has_winner_workflow_record');
    expect(sql).toContain('special_offer_winner_shortlist');
    expect(sql).toContain('special_offer_winner_contact_events');
    expect(sql).toContain('special_offer_winner_publications');
  });

  test('locks access to admin-only tables and RPC without direct public writes', () => {
    expect(sql).toContain('alter table public.special_offer_winner_workflows enable row level security');
    expect(sql).toContain('revoke all on table public.special_offer_winner_workflows from public, anon, authenticated');
    expect(sql).toContain('grant select on table public.special_offer_winner_workflows to authenticated');
    expect(sql).toContain('using (public.is_current_user_admin())');
    expect(sql).toContain('revoke all on function public.admin_publish_special_offer_winner');
    expect(sql).toContain('from public, anon, authenticated, service_role');
    expect(sql).toContain('grant execute on function public.admin_publish_special_offer_winner');
    expect(sql).not.toMatch(/grant\s+(insert|update|delete).*special_offer_winner_.*to authenticated/i);
    expect(sql).not.toMatch(/grant\s+select.*special_offer_winner_.*to anon/i);
  });

  test('keeps system audit free from notes, reason text and participant PII', () => {
    expect(sql).toContain('winner_committee_note_added');
    expect(sql).toContain('note_present');
    expect(sql).toContain('reason_present');
    expect(sql).toContain('public_name_logged');
    const auditSegments = Array.from(sql.matchAll(/perform public\.special_offer_winner_audit\([\s\S]{0,900}?\);/g))
      .map((match) => match[0])
      .join('\n');
    expect(auditSegments).not.toMatch(/p_note_text|p_reason|v_reason|v_public_name|p_public_name/i);
    expect(auditSegments).not.toMatch(/email|phone|date_of_birth|answers_json|form_snapshot_json|evidence_url|evidence_text/i);
  });
});
