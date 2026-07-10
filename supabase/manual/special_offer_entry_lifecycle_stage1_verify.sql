-- Special Offers 3C.5C-6J entry lifecycle verify - read only.
-- Verifies one saved correction and admin hard-delete backend controls.

with functions_state as (
  select
    to_regprocedure('public.update_special_offer_entry_once(uuid,jsonb,uuid)') is not null as correction_rpc_exists,
    to_regprocedure('public.admin_delete_special_offer_entry(uuid,text,text)') is not null as delete_rpc_exists
),
rpc_meta as (
  select
    p.proname,
    p.prosecdef,
    pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
    coalesce(p.proconfig, array[]::text[]) as proconfig,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('update_special_offer_entry_once', 'admin_delete_special_offer_entry')
),
correction_rpc as (
  select
    source,
    proseCdef as security_definer,
    owner_name = 'postgres' as owner_ok,
    exists (
      select 1 from unnest(proconfig) cfg
      where cfg = 'search_path=pg_catalog, public'
    ) as safe_search_path
  from rpc_meta
  where proname = 'update_special_offer_entry_once'
),
delete_rpc as (
  select
    source,
    proseCdef as security_definer,
    owner_name = 'postgres' as owner_ok,
    exists (
      select 1 from unnest(proconfig) cfg
      where cfg = 'search_path=pg_catalog, public'
    ) as safe_search_path
  from rpc_meta
  where proname = 'admin_delete_special_offer_entry'
),
columns_state as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'correction_count'
        and data_type = 'smallint'
        and coalesce(column_default, '') like '0%'
        and is_nullable = 'NO'
    ) as correction_count_column_ok,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'corrected_at'
        and data_type = 'timestamp with time zone'
    ) as corrected_at_column_ok,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'correction_client_submission_id'
        and data_type = 'uuid'
    ) as correction_client_id_column_ok
),
constraints_state as (
  select
    exists (
      select 1
      from pg_constraint con
      where con.conrelid = 'public.special_offer_entries'::regclass
        and con.conname = 'special_offer_entries_correction_count_check'
        and pg_get_constraintdef(con.oid) ilike '%correction_count%'
        and pg_get_constraintdef(con.oid) ilike '%0%'
        and pg_get_constraintdef(con.oid) ilike '%1%'
    ) as correction_count_check_exists,
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'special_offer_entries'
        and indexname = 'idx_special_offer_entries_correction_client'
        and indexdef ilike '%unique%'
        and indexdef ilike '%correction_client_submission_id%'
    ) as correction_client_unique_exists,
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'special_offer_entries'
        and indexname = 'idx_special_offer_entries_offer_user_unique'
        and indexdef ilike '%unique%'
        and indexdef ilike '%offer_id%'
        and indexdef ilike '%user_id%'
        and indexdef ilike '%user_id is not null%'
    ) as offer_user_unique_index_exists
),
fk_state as (
  select
    exists (
      select 1
      from pg_constraint con
      where con.conrelid = 'public.special_offer_entry_answers'::regclass
        and con.confrelid = 'public.special_offer_entries'::regclass
        and con.confdeltype = 'c'
    ) as answers_cascade_to_entry,
    exists (
      select 1
      from pg_constraint con
      where con.conrelid = 'public.special_offer_entry_activities'::regclass
        and con.confrelid = 'public.special_offer_entries'::regclass
        and con.confdeltype = 'c'
    ) as activities_cascade_to_entry
),
grants_state as (
  select
    not coalesce(has_function_privilege('PUBLIC', 'public.update_special_offer_entry_once(uuid,jsonb,uuid)', 'EXECUTE'), false) as correction_public_execute_absent,
    not coalesce(has_function_privilege('anon', 'public.update_special_offer_entry_once(uuid,jsonb,uuid)', 'EXECUTE'), false) as correction_anon_execute_absent,
    coalesce(has_function_privilege('authenticated', 'public.update_special_offer_entry_once(uuid,jsonb,uuid)', 'EXECUTE'), false) as correction_authenticated_execute_present,
    not coalesce(has_function_privilege('service_role', 'public.update_special_offer_entry_once(uuid,jsonb,uuid)', 'EXECUTE'), false) as correction_service_role_execute_absent,
    not coalesce(has_function_privilege('PUBLIC', 'public.admin_delete_special_offer_entry(uuid,text,text)', 'EXECUTE'), false) as delete_public_execute_absent,
    not coalesce(has_function_privilege('anon', 'public.admin_delete_special_offer_entry(uuid,text,text)', 'EXECUTE'), false) as delete_anon_execute_absent,
    coalesce(has_function_privilege('authenticated', 'public.admin_delete_special_offer_entry(uuid,text,text)', 'EXECUTE'), false) as delete_authenticated_execute_present,
    not coalesce(has_function_privilege('service_role', 'public.admin_delete_special_offer_entry(uuid,text,text)', 'EXECUTE'), false) as delete_service_role_execute_absent
),
table_grants as (
  select
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('special_offer_entries', 'special_offer_entry_answers', 'special_offer_entry_activities')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as no_public_direct_entry_writes
),
correction_source as (
  select
    coalesce(source like '%v_uid uuid := auth.uid()%', false) as correction_auth_uid_required,
    coalesce(source like '%email_confirmed_at%' and source like '%confirmed_at%', false) as correction_confirmed_email_required,
    coalesce(source like '%from public.special_offer_entries e where e.id = p_entry_id for update%', false) as correction_for_update_present,
    coalesce(source like '%v_entry.user_id is distinct from v_uid%', false) as correction_ownership_check_present,
    coalesce(source like '%v_entry.correction_count = 1%' and source like '%v_entry.correction_client_submission_id = p_client_correction_id%', false) as correction_idempotent_retry_present,
    coalesce(source like '%v_entry.correction_count >= 1%', false) as second_correction_blocked,
    coalesce(source like '%v_entry.status not in (''submitted'', ''pending_review'', ''approved'', ''rejected'')%', false) as correction_status_matrix_present,
    coalesce(source like '%v_offer.status <> ''active''%' and source like '%v_offer.visibility <> ''public''%', false) as correction_active_public_required,
    coalesce(source like '%v_offer.start_at is null%' and source like '%v_offer.end_at is null%' and source like '%v_now < v_offer.start_at%' and source like '%v_now > v_offer.end_at%', false) as correction_date_window_required,
    coalesce(source like '%unknown_or_inactive_field%', false) as unknown_fields_blocked,
    coalesce(source like '%field_snapshot_json%' and source like '%update public.special_offer_entry_answers%', false) as snapshot_based_answers_update_present,
    coalesce(source like '%v_key = ''email''%' and source like '%to_jsonb(v_auth_email)%', false) as canonical_email_preserved,
    coalesce(source like '%set status = ''pending_review''%' and source like '%reviewed_at = null%' and source like '%reviewed_by = null%' and source like '%review_note = null%' and source like '%rejection_reason = null%', false) as correction_resets_review_state,
    coalesce(source like '%insert into public.special_offer_audit_log%' and source like '%''entry_corrected''%', false) as correction_audit_present,
    coalesce(source like '%set name = $1%' and source like '%or name = $3%' and source like '%set phone = $1%' and source like '%or phone = $3%' and source like '%preferred_language = $1%' and source like '%preferred_language is null or preferred_language = $1%', false) as profile_sync_guarded
  from (select coalesce((select source from correction_rpc limit 1), '') as source) rpc
),
correction_audit_source as (
  select
    substring(source from position('insert into public.special_offer_audit_log' in source) for 1200) as audit_segment
  from (select coalesce((select source from correction_rpc limit 1), '') as source) rpc
),
delete_source as (
  select
    coalesce(source like '%v_actor uuid := auth.uid()%', false) as delete_auth_uid_required,
    coalesce(source like '%public.is_current_user_admin()%', false) as delete_admin_check_present,
    coalesce(source like '%from public.special_offer_entries e where e.id = p_entry_id for update%', false) as delete_for_update_present,
    coalesce(source like '%delete_reason_required%', false) as delete_reason_required,
    coalesce(source like '%entry_reference_mismatch%', false) as delete_reference_confirmation_required,
    coalesce(source like '%a.action = ''entry_hard_deleted''%' and source like '%deleted := false%', false) as delete_idempotent_retry_present,
    coalesce(source like '%to_regclass(''public.special_offer_winners'')%', false) as winner_relation_blocks_delete,
    coalesce(source like '%where entry_id = v_entry.id%', false) as child_counts_present,
    coalesce(source like '%delete from public.special_offer_entries where id = v_entry.id%', false) as controlled_entry_delete_present,
    coalesce(source not like '%delete from public.profiles%' and source not like '%delete from auth.users%' and source not like '%delete from public.special_offers%' and source not like '%delete from public.special_offer_official_posts%', false) as user_profile_campaign_posts_preserved,
    coalesce(source like '%insert into public.special_offer_audit_log%' and source like '%''entry_hard_deleted''%', false) as delete_tombstone_audit_present
  from (select coalesce((select source from delete_rpc limit 1), '') as source) rpc
),
delete_audit_source as (
  select
    substring(source from position('insert into public.special_offer_audit_log' in source) for 1000) as audit_segment
  from (select coalesce((select source from delete_rpc limit 1), '') as source) rpc
),
audit_safety as (
  select
    coalesce(c.audit_segment not like '%v_auth_email%' and c.audit_segment not like '%v_phone%' and c.audit_segment not like '%v_new_answers%' and c.audit_segment not like '%answers_json%' and c.audit_segment not like '%form_snapshot_json%' and c.audit_segment not like '%shared_post_url%', false) as correction_audit_no_pii_values,
    coalesce(d.audit_segment not like '%v_reason%' and d.audit_segment not like '%p_reason%' and d.audit_segment not like '%reference%' and d.audit_segment not like '%user_id%' and d.audit_segment not like '%email%' and d.audit_segment not like '%phone%' and d.audit_segment not like '%evidence_url%' and d.audit_segment not like '%evidence_text%' and d.audit_segment not like '%answers_json%' and d.audit_segment not like '%form_snapshot_json%', false) as delete_audit_no_pii_values
  from correction_audit_source c
  cross join delete_audit_source d
),
data_state as (
  select
    count(*) filter (where user_id is not null)::bigint as entries_with_user_id,
    count(*) filter (where user_id is null)::bigint as entries_without_user_id,
    (
      select count(*)::bigint
      from (
        select offer_id, user_id
        from public.special_offer_entries
        where user_id is not null
        group by offer_id, user_id
        having count(*) > 1
      ) d
    ) as duplicate_offer_user_pairs
  from public.special_offer_entries
),
future_objects as (
  select
    to_regclass('public.special_offer_draws') is null as no_draws_table,
    to_regclass('public.special_offer_winners') is null as no_winners_table
)
select
  fs.correction_rpc_exists,
  fs.delete_rpc_exists,
  coalesce(cr.security_definer, false) as correction_security_definer,
  coalesce(cr.safe_search_path, false) as correction_safe_search_path,
  coalesce(cr.owner_ok, false) as correction_owner_ok,
  coalesce(dr.security_definer, false) as delete_security_definer,
  coalesce(dr.safe_search_path, false) as delete_safe_search_path,
  coalesce(dr.owner_ok, false) as delete_owner_ok,
  cs.correction_count_column_ok,
  cs.corrected_at_column_ok,
  cs.correction_client_id_column_ok,
  ks.correction_count_check_exists,
  ks.correction_client_unique_exists,
  ks.offer_user_unique_index_exists,
  fk.answers_cascade_to_entry,
  fk.activities_cascade_to_entry,
  gs.correction_public_execute_absent,
  gs.correction_anon_execute_absent,
  gs.correction_authenticated_execute_present,
  gs.correction_service_role_execute_absent,
  gs.delete_public_execute_absent,
  gs.delete_anon_execute_absent,
  gs.delete_authenticated_execute_present,
  gs.delete_service_role_execute_absent,
  tg.no_public_direct_entry_writes,
  csrc.correction_auth_uid_required,
  csrc.correction_confirmed_email_required,
  csrc.correction_for_update_present,
  csrc.correction_ownership_check_present,
  csrc.correction_idempotent_retry_present,
  csrc.second_correction_blocked,
  csrc.correction_status_matrix_present,
  csrc.correction_active_public_required,
  csrc.correction_date_window_required,
  csrc.unknown_fields_blocked,
  csrc.snapshot_based_answers_update_present,
  csrc.canonical_email_preserved,
  csrc.correction_resets_review_state,
  csrc.correction_audit_present,
  csrc.profile_sync_guarded,
  dsrc.delete_auth_uid_required,
  dsrc.delete_admin_check_present,
  dsrc.delete_for_update_present,
  dsrc.delete_reason_required,
  dsrc.delete_reference_confirmation_required,
  dsrc.delete_idempotent_retry_present,
  dsrc.winner_relation_blocks_delete,
  dsrc.child_counts_present,
  dsrc.controlled_entry_delete_present,
  dsrc.user_profile_campaign_posts_preserved,
  dsrc.delete_tombstone_audit_present,
  a.correction_audit_no_pii_values,
  a.delete_audit_no_pii_values,
  ds.entries_with_user_id,
  ds.entries_without_user_id,
  ds.duplicate_offer_user_pairs,
  fo.no_draws_table,
  fo.no_winners_table,
  (
    fs.correction_rpc_exists
    and fs.delete_rpc_exists
    and coalesce(cr.security_definer, false)
    and coalesce(cr.safe_search_path, false)
    and coalesce(cr.owner_ok, false)
    and coalesce(dr.security_definer, false)
    and coalesce(dr.safe_search_path, false)
    and coalesce(dr.owner_ok, false)
    and cs.correction_count_column_ok
    and cs.corrected_at_column_ok
    and cs.correction_client_id_column_ok
    and ks.correction_count_check_exists
    and ks.correction_client_unique_exists
    and ks.offer_user_unique_index_exists
    and fk.answers_cascade_to_entry
    and fk.activities_cascade_to_entry
    and gs.correction_public_execute_absent
    and gs.correction_anon_execute_absent
    and gs.correction_authenticated_execute_present
    and gs.correction_service_role_execute_absent
    and gs.delete_public_execute_absent
    and gs.delete_anon_execute_absent
    and gs.delete_authenticated_execute_present
    and gs.delete_service_role_execute_absent
    and tg.no_public_direct_entry_writes
    and csrc.correction_auth_uid_required
    and csrc.correction_confirmed_email_required
    and csrc.correction_for_update_present
    and csrc.correction_ownership_check_present
    and csrc.correction_idempotent_retry_present
    and csrc.second_correction_blocked
    and csrc.correction_status_matrix_present
    and csrc.correction_active_public_required
    and csrc.correction_date_window_required
    and csrc.unknown_fields_blocked
    and csrc.snapshot_based_answers_update_present
    and csrc.canonical_email_preserved
    and csrc.correction_resets_review_state
    and csrc.correction_audit_present
    and csrc.profile_sync_guarded
    and dsrc.delete_auth_uid_required
    and dsrc.delete_admin_check_present
    and dsrc.delete_for_update_present
    and dsrc.delete_reason_required
    and dsrc.delete_reference_confirmation_required
    and dsrc.delete_idempotent_retry_present
    and dsrc.winner_relation_blocks_delete
    and dsrc.child_counts_present
    and dsrc.controlled_entry_delete_present
    and dsrc.user_profile_campaign_posts_preserved
    and dsrc.delete_tombstone_audit_present
    and a.correction_audit_no_pii_values
    and a.delete_audit_no_pii_values
    and ds.duplicate_offer_user_pairs = 0
    and fo.no_draws_table
    and fo.no_winners_table
  ) as overall_pass
from functions_state fs
left join correction_rpc cr on true
left join delete_rpc dr on true
cross join columns_state cs
cross join constraints_state ks
cross join fk_state fk
cross join grants_state gs
cross join table_grants tg
cross join correction_source csrc
cross join delete_source dsrc
cross join audit_safety a
cross join data_state ds
cross join future_objects fo;
