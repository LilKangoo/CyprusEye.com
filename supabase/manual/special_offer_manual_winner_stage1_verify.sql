-- Special Offers 3C.6A Manual Winner Selection verify.
-- Completely read-only. Does not execute RPC and does not modify data.

with required_tables as (
  select
    to_regclass('public.special_offer_winner_workflows') is not null as workflows_table_exists,
    to_regclass('public.special_offer_winner_shortlist') is not null as shortlist_table_exists,
    to_regclass('public.special_offer_winner_committee_notes') is not null as notes_table_exists,
    to_regclass('public.special_offer_winner_contact_events') is not null as contact_events_table_exists,
    to_regclass('public.special_offer_winner_publications') is not null as publications_table_exists
),
columns_present as (
  select
    count(*) filter (where table_name = 'special_offer_winner_workflows' and column_name in (
      'id','offer_id','status','started_by','started_at','decision_reason','confirmed_entry_id','confirmed_at','published_at','cancelled_at','cancelled_by','created_at','updated_at'
    )) = 13 as workflow_columns_ok,
    count(*) filter (where table_name = 'special_offer_winner_shortlist' and column_name in (
      'id','workflow_id','offer_id','entry_id','status','role','backup_rank','score_snapshot_json','entry_status_snapshot','added_by','added_at','rechecked_by','rechecked_at','removed_by','removed_at'
    )) = 15 as shortlist_columns_ok,
    count(*) filter (where table_name = 'special_offer_winner_committee_notes' and column_name in (
      'id','workflow_id','shortlist_id','entry_id','note_text','created_by','created_at','archived_at','archived_by'
    )) = 9 as note_columns_ok,
    count(*) filter (where table_name = 'special_offer_winner_contact_events' and column_name in (
      'id','workflow_id','shortlist_id','entry_id','status','contact_started_at','response_deadline_at','accepted_at','declined_at','no_response_at','replaced_at','note_text','created_by','created_at'
    )) = 14 as contact_columns_ok,
    count(*) filter (where table_name = 'special_offer_winner_publications' and column_name in (
      'id','workflow_id','offer_id','entry_id','public_name','publication_consent_confirmed','consent_confirmed_by','consent_confirmed_at','published_by','published_at','unpublished_at','unpublish_reason_present','created_at'
    )) = 13 as publication_columns_ok
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'special_offer_winner_workflows',
      'special_offer_winner_shortlist',
      'special_offer_winner_committee_notes',
      'special_offer_winner_contact_events',
      'special_offer_winner_publications'
    )
),
constraints_present as (
  select
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'special_offer_winner_workflows'
        and indexname = 'idx_special_offer_winner_workflows_one_active'
        and indexdef ilike '%unique%'
        and indexdef ilike '%where (status <> ''cancelled''%'
    ) as one_active_workflow_index_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_winner_shortlist'::regclass
        and conname = 'special_offer_winner_shortlist_workflow_entry_key'
    ) as shortlist_workflow_entry_unique_exists,
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'special_offer_winner_shortlist'
        and indexname = 'idx_special_offer_winner_shortlist_one_primary'
        and indexdef ilike '%unique%'
    ) as one_primary_index_exists,
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'special_offer_winner_shortlist'
        and indexname = 'idx_special_offer_winner_shortlist_backup_rank'
        and indexdef ilike '%unique%'
    ) as backup_rank_unique_index_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_winner_publications'::regclass
        and conname = 'special_offer_winner_publications_consent_check'
    ) as publication_consent_check_exists,
    exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join pg_class ref on ref.oid = con.confrelid
      join pg_namespace refns on refns.oid = ref.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'special_offer_winner_workflows'
        and refns.nspname = 'public'
        and ref.relname = 'special_offers'
        and con.contype = 'f'
        and con.confdeltype = 'r'
    ) as workflow_offer_delete_restrict,
    exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join pg_class ref on ref.oid = con.confrelid
      join pg_namespace refns on refns.oid = ref.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'special_offer_winner_publications'
        and refns.nspname = 'public'
        and ref.relname = 'special_offer_entries'
        and con.conname = 'special_offer_winner_publications_entry_offer_fkey'
        and con.contype = 'f'
        and con.confdeltype = 'r'
    ) as publication_entry_offer_fk_restrict,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_winner_contact_events'::regclass
        and conname = 'special_offer_winner_contact_events_terminal_check'
    ) as contact_exclusive_terminal_check_exists
),
rls_state as (
  select
    bool_and(c.relrowsecurity) as all_winner_tables_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'special_offer_winner_workflows',
      'special_offer_winner_shortlist',
      'special_offer_winner_committee_notes',
      'special_offer_winner_contact_events',
      'special_offer_winner_publications'
    )
),
table_grants as (
  select
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in (
          'special_offer_winner_workflows',
          'special_offer_winner_shortlist',
          'special_offer_winner_committee_notes',
          'special_offer_winner_contact_events',
          'special_offer_winner_publications'
        )
        and grantee in ('PUBLIC', 'anon')
        and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
    ) as no_public_or_anon_table_access,
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in (
          'special_offer_winner_workflows',
          'special_offer_winner_shortlist',
          'special_offer_winner_committee_notes',
          'special_offer_winner_contact_events',
          'special_offer_winner_publications'
        )
        and grantee = 'authenticated'
        and privilege_type in ('INSERT','UPDATE','DELETE')
    ) as no_authenticated_direct_writes,
    exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'special_offer_winner_workflows'
        and grantee = 'authenticated'
        and privilege_type = 'SELECT'
    ) as authenticated_select_present
),
fn as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    p.proowner::regrole::text as owner_name,
    p.prosecdef as security_definer,
    coalesce(p.proconfig::text, '') as config_text,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as source,
    coalesce(p.proacl, acldefault('f', p.proowner)) as acl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'special_offer_winner_score_snapshot',
      'special_offer_winner_workflow_readiness',
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
      'update_special_offer_entry_once',
      'admin_delete_special_offer_entry'
    )
),
fn_counts as (
  select
    count(*) filter (where proname = 'special_offer_winner_score_snapshot' and identity_arguments = 'p_offer_id uuid, p_entry_id uuid') = 1 as score_snapshot_rpc_exists,
    count(*) filter (where proname = 'special_offer_winner_workflow_readiness' and identity_arguments = 'p_offer_id uuid') = 1 as readiness_rpc_exists,
    count(*) filter (where proname = 'admin_start_special_offer_winner_workflow' and identity_arguments = 'p_offer_id uuid, p_reason text') = 1 as start_rpc_exists,
    count(*) filter (where proname = 'admin_add_special_offer_shortlist_entry' and identity_arguments = 'p_workflow_id uuid, p_entry_id uuid') = 1 as add_shortlist_rpc_exists,
    count(*) filter (where proname = 'admin_remove_special_offer_shortlist_entry' and identity_arguments = 'p_shortlist_id uuid, p_reason text') = 1 as remove_shortlist_rpc_exists,
    count(*) filter (where proname = 'admin_mark_special_offer_shortlist_rechecked' and identity_arguments = 'p_shortlist_id uuid') = 1 as recheck_rpc_exists,
    count(*) filter (where proname = 'admin_add_special_offer_committee_note' and identity_arguments = 'p_workflow_id uuid, p_shortlist_id uuid, p_entry_id uuid, p_note_text text') = 1 as add_note_rpc_exists,
    count(*) filter (where proname = 'admin_archive_special_offer_committee_note' and identity_arguments = 'p_note_id uuid, p_reason text') = 1 as archive_note_rpc_exists,
    count(*) filter (where proname = 'admin_set_special_offer_primary_candidate' and identity_arguments = 'p_shortlist_id uuid, p_reason text') = 1 as primary_rpc_exists,
    count(*) filter (where proname = 'admin_set_special_offer_backup_candidate' and identity_arguments = 'p_shortlist_id uuid, p_backup_rank integer, p_reason text') = 1 as backup_rpc_exists,
    count(*) filter (where proname = 'admin_start_special_offer_winner_contact' and identity_arguments = 'p_shortlist_id uuid, p_response_deadline_at timestamp with time zone, p_note_text text') = 1 as start_contact_rpc_exists,
    count(*) filter (where proname = 'admin_record_special_offer_winner_response' and identity_arguments = 'p_contact_event_id uuid, p_response_status text, p_note_text text') = 1 as response_rpc_exists,
    count(*) filter (where proname = 'admin_promote_special_offer_backup' and identity_arguments = 'p_backup_shortlist_id uuid, p_reason text') = 1 as promote_backup_rpc_exists,
    count(*) filter (where proname = 'admin_confirm_special_offer_winner' and identity_arguments = 'p_contact_event_id uuid, p_reason text') = 1 as confirm_winner_rpc_exists,
    count(*) filter (where proname = 'admin_publish_special_offer_winner' and identity_arguments = 'p_workflow_id uuid, p_public_name text, p_publication_consent_confirmed boolean, p_reason text') = 1 as publish_rpc_exists,
    count(*) filter (where proname = 'admin_unpublish_special_offer_winner' and identity_arguments = 'p_publication_id uuid, p_reason text') = 1 as unpublish_rpc_exists,
    count(*) filter (where proname = 'admin_cancel_special_offer_winner_workflow' and identity_arguments = 'p_workflow_id uuid, p_reason text') = 1 as cancel_rpc_exists,
    count(*) filter (where proname = 'admin_reopen_special_offer_winner_workflow' and identity_arguments = 'p_workflow_id uuid, p_reason text') = 1 as reopen_rpc_exists,
    count(*) filter (where proname = 'update_special_offer_entry_once' and identity_arguments = 'p_entry_id uuid, p_answers jsonb, p_client_correction_id uuid') = 1 as correction_rpc_preserved,
    count(*) filter (where proname = 'admin_delete_special_offer_entry' and identity_arguments = 'p_entry_id uuid, p_expected_reference text, p_reason text') = 1 as hard_delete_rpc_preserved
  from fn
),
fn_security as (
  select
    bool_and(security_definer) as all_rpc_security_definer,
    bool_and(owner_name = 'postgres') as all_rpc_owner_postgres,
    bool_and(config_text ilike '%search_path=pg_catalog, public%') as all_rpc_safe_search_path
  from fn
),
function_grants as (
  select
    not exists (
      select 1
      from fn
      cross join lateral aclexplode(fn.acl) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ) as public_execute_absent,
    not exists (
      select 1 from fn where has_function_privilege('anon', fn.oid, 'EXECUTE')
    ) as anon_execute_absent,
    not exists (
      select 1 from fn where has_function_privilege('service_role', fn.oid, 'EXECUTE')
    ) as service_role_execute_absent,
    not exists (
      select 1 from fn
      where proname like 'admin_%'
        and not has_function_privilege('authenticated', fn.oid, 'EXECUTE')
    ) as authenticated_admin_execute_present,
    exists (
      select 1 from fn
      where proname = 'special_offer_winner_workflow_readiness'
        and has_function_privilege('authenticated', fn.oid, 'EXECUTE')
    ) as authenticated_readiness_execute_present
),
source_checks as (
  select
    coalesce((select source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%winner_selection_mode_not_manual%' as start_blocks_wrong_winner_mode,
    coalesce((select source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%pending_entry_reviews%' as start_blocks_pending_entries,
    coalesce((select source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%pending_activity_reviews%' as start_blocks_pending_activities,
    coalesce((select source from fn where proname = 'admin_start_special_offer_winner_workflow'), '') like '%special_offer_winner_workflow_readiness%' as start_uses_readiness_summary,
    coalesce((select source from fn where proname = 'admin_add_special_offer_shortlist_entry'), '') like '%v_entry.status <> ''approved''%' as shortlist_approved_only,
    coalesce((select source from fn where proname = 'admin_add_special_offer_committee_note'), '') like '%committee_note_entry_mismatch%' as committee_note_entry_match_guard,
    coalesce((select source from fn where proname = 'admin_set_special_offer_primary_candidate'), '') like '%role = ''primary''%' as primary_role_present,
    coalesce((select source from fn where proname = 'admin_set_special_offer_backup_candidate'), '') like '%p_backup_rank is null or p_backup_rank <= 0%' as backup_rank_guard_present,
    coalesce((select source from fn where proname = 'admin_start_special_offer_winner_contact'), '') like '%p_response_deadline_at is null%' as contact_deadline_required,
    coalesce((select source from fn where proname = 'admin_record_special_offer_winner_response'), '') like '%accepted'', ''declined'', ''no_response''%' as response_status_guard_present,
    coalesce((select source from fn where proname = 'admin_promote_special_offer_backup'), '') like '%replacement_contact_required%' as promote_requires_declined_or_no_response,
    coalesce((select source from fn where proname = 'admin_confirm_special_offer_winner'), '') like '%v_contact.status <> ''accepted''%' as confirm_requires_accepted,
    coalesce((select source from fn where proname = 'admin_publish_special_offer_winner'), '') like '%publication_consent_required%' as publish_requires_consent,
    coalesce((select source from fn where proname = 'admin_publish_special_offer_winner'), '') like '%winner_not_confirmed%' as publish_requires_confirmed_winner,
    coalesce((select source from fn where proname = 'admin_unpublish_special_offer_winner'), '') like '%unpublish_reason_required%' as unpublish_requires_reason,
    coalesce((select source from fn where proname = 'admin_cancel_special_offer_winner_workflow'), '') like '%winner_workflow_not_cancellable%' as cancel_blocks_published,
    coalesce((select source from fn where proname = 'admin_reopen_special_offer_winner_workflow'), '') like '%winner_workflow_not_cancelled%' as reopen_cancelled_only,
    coalesce((select source from fn where proname = 'update_special_offer_entry_once'), '') like '%entry_locked_by_winner_workflow%' as correction_blocks_contacting_or_later,
    coalesce((select source from fn where proname = 'update_special_offer_entry_once'), '') like '%status = ''needs_recheck''%' as correction_marks_needs_recheck,
    coalesce((select source from fn where proname = 'update_special_offer_entry_once'), '') like '%role = ''shortlisted''%' as correction_removes_candidate_role,
    coalesce((select source from fn where proname = 'admin_delete_special_offer_entry'), '') like '%entry_has_winner_workflow_record%' as hard_delete_workflow_guard_present,
    coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%base_points%' as score_snapshot_base_present,
    coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%share_points%' as score_snapshot_share_present,
    coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%comment_points%' as score_snapshot_comment_present,
    coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%bonus_points%' as score_snapshot_bonus_present,
    coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%total_points%' as score_snapshot_total_present,
    coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%approved_activity_count%' as score_snapshot_activity_count_present,
    coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%snapshot_at%' as score_snapshot_at_present
),
pii_checks as (
  select
    coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') <> ''
      and coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%evidence_url%'
      and coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%email%'
      and coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%phone%'
      and coalesce((select source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%answers_json%' as score_snapshot_no_pii,
    coalesce((select string_agg(source, ' ' order by proname) from fn where proname like 'admin_%'), '') not like '%automatic%'
      and coalesce((select string_agg(source, ' ' order by proname) from fn where proname like 'admin_%'), '') not like '%random()%'
      and coalesce((select string_agg(source, ' ' order by proname) from fn where proname like 'admin_%'), '') not like '%draw%' as no_draw_or_random_selection,
    coalesce((select string_agg(source, ' ' order by proname) from fn where proname like 'admin_%'), '') not like '%evidence_url%'
      and coalesce((select string_agg(source, ' ' order by proname) from fn where proname like 'admin_%'), '') not like '%answers_json%'
      and coalesce((select string_agg(source, ' ' order by proname) from fn where proname like 'admin_%'), '') not like '%form_snapshot_json%'
      and coalesce((select string_agg(source, ' ' order by proname) from fn where proname like 'admin_%'), '') not like '%date_of_birth%' as admin_audit_no_form_pii
)
select
  rt.workflows_table_exists,
  rt.shortlist_table_exists,
  rt.notes_table_exists,
  rt.contact_events_table_exists,
  rt.publications_table_exists,
  cp.workflow_columns_ok,
  cp.shortlist_columns_ok,
  cp.note_columns_ok,
  cp.contact_columns_ok,
  cp.publication_columns_ok,
  c.one_active_workflow_index_exists,
  c.shortlist_workflow_entry_unique_exists,
  c.one_primary_index_exists,
  c.backup_rank_unique_index_exists,
  c.publication_consent_check_exists,
  c.workflow_offer_delete_restrict,
  c.publication_entry_offer_fk_restrict,
  c.contact_exclusive_terminal_check_exists,
  r.all_winner_tables_rls_enabled,
  tg.no_public_or_anon_table_access,
  tg.no_authenticated_direct_writes,
  tg.authenticated_select_present,
  fc.score_snapshot_rpc_exists,
  fc.readiness_rpc_exists,
  fc.start_rpc_exists,
  fc.add_shortlist_rpc_exists,
  fc.remove_shortlist_rpc_exists,
  fc.recheck_rpc_exists,
  fc.add_note_rpc_exists,
  fc.archive_note_rpc_exists,
  fc.primary_rpc_exists,
  fc.backup_rpc_exists,
  fc.start_contact_rpc_exists,
  fc.response_rpc_exists,
  fc.promote_backup_rpc_exists,
  fc.confirm_winner_rpc_exists,
  fc.publish_rpc_exists,
  fc.unpublish_rpc_exists,
  fc.cancel_rpc_exists,
  fc.reopen_rpc_exists,
  fc.correction_rpc_preserved,
  fc.hard_delete_rpc_preserved,
  fs.all_rpc_security_definer,
  fs.all_rpc_owner_postgres,
  fs.all_rpc_safe_search_path,
  fg.public_execute_absent,
  fg.anon_execute_absent,
  fg.service_role_execute_absent,
  fg.authenticated_admin_execute_present,
  fg.authenticated_readiness_execute_present,
  sc.start_blocks_wrong_winner_mode,
  sc.start_blocks_pending_entries,
  sc.start_blocks_pending_activities,
  sc.start_uses_readiness_summary,
  sc.shortlist_approved_only,
  sc.committee_note_entry_match_guard,
  sc.primary_role_present,
  sc.backup_rank_guard_present,
  sc.contact_deadline_required,
  sc.response_status_guard_present,
  sc.promote_requires_declined_or_no_response,
  sc.confirm_requires_accepted,
  sc.publish_requires_consent,
  sc.publish_requires_confirmed_winner,
  sc.unpublish_requires_reason,
  sc.cancel_blocks_published,
  sc.reopen_cancelled_only,
  sc.correction_blocks_contacting_or_later,
  sc.correction_marks_needs_recheck,
  sc.correction_removes_candidate_role,
  sc.hard_delete_workflow_guard_present,
  sc.score_snapshot_base_present,
  sc.score_snapshot_share_present,
  sc.score_snapshot_comment_present,
  sc.score_snapshot_bonus_present,
  sc.score_snapshot_total_present,
  sc.score_snapshot_activity_count_present,
  sc.score_snapshot_at_present,
  pc.score_snapshot_no_pii,
  pc.no_draw_or_random_selection,
  pc.admin_audit_no_form_pii,
  (
    rt.workflows_table_exists
    and rt.shortlist_table_exists
    and rt.notes_table_exists
    and rt.contact_events_table_exists
    and rt.publications_table_exists
    and cp.workflow_columns_ok
    and cp.shortlist_columns_ok
    and cp.note_columns_ok
    and cp.contact_columns_ok
    and cp.publication_columns_ok
    and c.one_active_workflow_index_exists
    and c.shortlist_workflow_entry_unique_exists
    and c.one_primary_index_exists
    and c.backup_rank_unique_index_exists
    and c.publication_consent_check_exists
    and c.workflow_offer_delete_restrict
    and c.publication_entry_offer_fk_restrict
    and c.contact_exclusive_terminal_check_exists
    and r.all_winner_tables_rls_enabled
    and tg.no_public_or_anon_table_access
    and tg.no_authenticated_direct_writes
    and tg.authenticated_select_present
    and fc.score_snapshot_rpc_exists
    and fc.readiness_rpc_exists
    and fc.start_rpc_exists
    and fc.add_shortlist_rpc_exists
    and fc.remove_shortlist_rpc_exists
    and fc.recheck_rpc_exists
    and fc.add_note_rpc_exists
    and fc.archive_note_rpc_exists
    and fc.primary_rpc_exists
    and fc.backup_rpc_exists
    and fc.start_contact_rpc_exists
    and fc.response_rpc_exists
    and fc.promote_backup_rpc_exists
    and fc.confirm_winner_rpc_exists
    and fc.publish_rpc_exists
    and fc.unpublish_rpc_exists
    and fc.cancel_rpc_exists
    and fc.reopen_rpc_exists
    and fc.correction_rpc_preserved
    and fc.hard_delete_rpc_preserved
    and fs.all_rpc_security_definer
    and fs.all_rpc_owner_postgres
    and fs.all_rpc_safe_search_path
    and fg.public_execute_absent
    and fg.anon_execute_absent
    and fg.service_role_execute_absent
    and fg.authenticated_admin_execute_present
    and fg.authenticated_readiness_execute_present
    and sc.start_blocks_wrong_winner_mode
    and sc.start_blocks_pending_entries
    and sc.start_blocks_pending_activities
    and sc.start_uses_readiness_summary
    and sc.shortlist_approved_only
    and sc.committee_note_entry_match_guard
    and sc.primary_role_present
    and sc.backup_rank_guard_present
    and sc.contact_deadline_required
    and sc.response_status_guard_present
    and sc.promote_requires_declined_or_no_response
    and sc.confirm_requires_accepted
    and sc.publish_requires_consent
    and sc.publish_requires_confirmed_winner
    and sc.unpublish_requires_reason
    and sc.cancel_blocks_published
    and sc.reopen_cancelled_only
    and sc.correction_blocks_contacting_or_later
    and sc.correction_marks_needs_recheck
    and sc.correction_removes_candidate_role
    and sc.hard_delete_workflow_guard_present
    and sc.score_snapshot_base_present
    and sc.score_snapshot_share_present
    and sc.score_snapshot_comment_present
    and sc.score_snapshot_bonus_present
    and sc.score_snapshot_total_present
    and sc.score_snapshot_activity_count_present
    and sc.score_snapshot_at_present
    and pc.score_snapshot_no_pii
    and pc.no_draw_or_random_selection
    and pc.admin_audit_no_form_pii
  ) as overall_pass
from required_tables rt
cross join columns_present cp
cross join constraints_present c
cross join rls_state r
cross join table_grants tg
cross join fn_counts fc
cross join fn_security fs
cross join function_grants fg
cross join source_checks sc
cross join pii_checks pc;
