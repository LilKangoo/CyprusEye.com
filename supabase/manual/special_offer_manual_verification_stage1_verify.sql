-- Special Offers 3C.5C-2 verify.
-- Completely read-only checks for official posts, activity claims and dynamic scores.
-- Does not execute RPC functions and does not modify data.

with required_tables as (
  select
    to_regclass('public.special_offer_official_posts') is not null as official_posts_exists,
    to_regclass('public.special_offer_entry_activities') is not null as activities_exists,
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_entries') is not null as entries_exists,
    to_regclass('public.special_offer_audit_log') is not null as audit_log_exists
),
column_checks as (
  select
    (
      select coalesce(array_agg(column_name::text order by column_name::text), array[]::text[])
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_official_posts'
        and column_name in (
          'active',
          'admin_title',
          'comment_deadline_at',
          'created_at',
          'created_by',
          'external_post_id',
          'id',
          'offer_id',
          'official_url',
          'platform',
          'post_order',
          'published_at',
          'updated_at',
          'updated_by',
          'week_number'
        )
    ) = array[
      'active',
      'admin_title',
      'comment_deadline_at',
      'created_at',
      'created_by',
      'external_post_id',
      'id',
      'offer_id',
      'official_url',
      'platform',
      'post_order',
      'published_at',
      'updated_at',
      'updated_by',
      'week_number'
    ]::text[] as official_posts_columns_ok,
    (
      select coalesce(array_agg(column_name::text order by column_name::text), array[]::text[])
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entry_activities'
        and column_name in (
          'activity_type',
          'client_submission_id',
          'created_at',
          'created_by',
          'entry_id',
          'evidence_text',
          'evidence_url',
          'id',
          'offer_id',
          'official_post_id',
          'participant_reported_at',
          'points_awarded',
          'rejection_reason',
          'review_note',
          'status',
          'updated_at',
          'verified_activity_at',
          'verified_at',
          'verified_by'
        )
    ) = array[
      'activity_type',
      'client_submission_id',
      'created_at',
      'created_by',
      'entry_id',
      'evidence_text',
      'evidence_url',
      'id',
      'offer_id',
      'official_post_id',
      'participant_reported_at',
      'points_awarded',
      'rejection_reason',
      'review_note',
      'status',
      'updated_at',
      'verified_activity_at',
      'verified_at',
      'verified_by'
    ]::text[] as activities_columns_ok
),
constraint_checks as (
  select
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entries'::regclass
        and conname = 'special_offer_entries_id_offer_key'
        and contype = 'u'
    ) as entries_id_offer_unique_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_official_posts'::regclass
        and conname = 'special_offer_official_posts_offer_id_id_key'
        and contype = 'u'
    ) as official_posts_id_offer_unique_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_official_posts'::regclass
        and conname = 'special_offer_official_posts_offer_url_key'
        and contype = 'u'
    ) as official_posts_offer_url_unique_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_official_posts'::regclass
        and conname = 'special_offer_official_posts_offer_order_key'
        and contype = 'u'
    ) as official_posts_offer_order_unique_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entry_activities'::regclass
        and conname = 'special_offer_entry_activities_entry_offer_fkey'
        and contype = 'f'
    ) as activity_entry_offer_fk_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entry_activities'::regclass
        and conname = 'special_offer_entry_activities_post_offer_fkey'
        and contype = 'f'
    ) as activity_post_offer_fk_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entry_activities'::regclass
        and conname = 'special_offer_entry_activities_entry_post_type_key'
        and contype = 'u'
    ) as activity_entry_post_type_unique_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entry_activities'::regclass
        and conname = 'special_offer_entry_activities_entry_client_key'
        and contype = 'u'
    ) as activity_entry_client_unique_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_official_posts'::regclass
        and conname = 'special_offer_official_posts_platform_check'
        and pg_get_constraintdef(oid) like '%facebook%'
    ) as platform_check_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entry_activities'::regclass
        and conname = 'special_offer_entry_activities_type_check'
        and pg_get_constraintdef(oid) like '%share%'
        and pg_get_constraintdef(oid) like '%comment%'
    ) as activity_type_check_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entry_activities'::regclass
        and conname = 'special_offer_entry_activities_status_check'
        and pg_get_constraintdef(oid) like '%pending%'
        and pg_get_constraintdef(oid) like '%approved%'
        and pg_get_constraintdef(oid) like '%rejected%'
        and pg_get_constraintdef(oid) like '%invalid%'
    ) as activity_status_check_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entry_activities'::regclass
        and conname = 'special_offer_entry_activities_status_points_check'
        and pg_get_constraintdef(oid) like '%approved%'
        and pg_get_constraintdef(oid) like '%points_awarded%'
    ) as status_points_check_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.special_offer_entry_activities'::regclass
        and conname = 'special_offer_entry_activities_comment_approved_time_check'
    ) as comment_approved_time_check_exists
),
index_checks as (
  select
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_special_offer_official_posts_offer_order') as official_posts_offer_order_index_exists,
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_special_offer_official_posts_offer_active') as official_posts_offer_active_index_exists,
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_special_offer_entry_activities_offer_status') as activities_offer_status_index_exists,
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_special_offer_entry_activities_entry') as activities_entry_index_exists,
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_special_offer_entry_activities_post') as activities_post_index_exists
),
rls_checks as (
  select
    coalesce((select relrowsecurity from pg_class where oid = 'public.special_offer_official_posts'::regclass), false) as official_posts_rls_enabled,
    coalesce((select relrowsecurity from pg_class where oid = 'public.special_offer_entry_activities'::regclass), false) as activities_rls_enabled,
    exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'special_offer_official_posts'
        and policyname = 'special_offer_official_posts_admin_select'
        and cmd = 'SELECT'
    ) as official_posts_admin_select_policy_exists,
    exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'special_offer_official_posts'
        and policyname = 'special_offer_official_posts_public_active_select'
        and cmd = 'SELECT'
    ) as official_posts_public_active_policy_exists,
    exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'special_offer_entry_activities'
        and policyname = 'special_offer_activities_admin_select'
        and cmd = 'SELECT'
    ) as activities_admin_select_policy_exists,
    exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'special_offer_entry_activities'
        and policyname = 'special_offer_activities_user_select_own'
        and cmd = 'SELECT'
    ) as activities_user_select_policy_exists
),
grant_checks as (
  select
    not exists (
      select 1 from information_schema.table_privileges
      where table_schema = 'public'
        and table_name in ('special_offer_official_posts', 'special_offer_entry_activities')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    ) as no_public_direct_write_grants,
    exists (
      select 1 from information_schema.table_privileges
      where table_schema = 'public'
        and table_name = 'special_offer_official_posts'
        and grantee = 'anon'
        and privilege_type = 'SELECT'
    ) as official_posts_anon_select_granted,
    exists (
      select 1 from information_schema.table_privileges
      where table_schema = 'public'
        and table_name = 'special_offer_entry_activities'
        and grantee = 'authenticated'
        and privilege_type = 'SELECT'
    ) as activities_authenticated_select_granted,
    not exists (
      select 1 from information_schema.table_privileges
      where table_schema = 'public'
        and table_name = 'special_offer_entry_activities'
        and grantee = 'anon'
        and privilege_type = 'SELECT'
    ) as activities_anon_select_absent,
    exists (
      select 1 from information_schema.table_privileges
      where table_schema = 'public'
        and table_name in ('special_offer_official_posts', 'special_offer_entry_activities')
        and grantee = 'service_role'
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) as service_role_table_access_present
),
function_sources as (
  select
    p.proname::text as function_name,
    pg_get_function_identity_arguments(p.oid)::text as identity_arguments,
    p.prosecdef,
    r.rolname::text as owner_name,
    coalesce(p.proconfig, array[]::text[]) as proconfig,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as fn,
    p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname in (
      'special_offer_official_post_is_public',
      'admin_upsert_special_offer_official_post',
      'admin_deactivate_special_offer_official_post',
      'submit_special_offer_activity_claim',
      'review_special_offer_activity',
      'special_offer_entry_score_summary'
    )
),
function_security_checks as (
  select
    count(*) filter (where function_name = 'special_offer_official_post_is_public' and identity_arguments = 'p_offer_id uuid') = 1 as public_helper_exists,
    count(*) filter (where function_name = 'admin_upsert_special_offer_official_post' and identity_arguments = 'p_post_id uuid, p_offer_id uuid, p_post_order integer, p_week_number integer, p_admin_title text, p_platform text, p_official_url text, p_external_post_id text, p_published_at timestamp with time zone, p_comment_deadline_at timestamp with time zone, p_active boolean') = 1 as admin_upsert_rpc_exists,
    count(*) filter (where function_name = 'admin_deactivate_special_offer_official_post' and identity_arguments = 'p_post_id uuid') = 1 as admin_deactivate_rpc_exists,
    count(*) filter (where function_name = 'submit_special_offer_activity_claim' and identity_arguments = 'p_entry_id uuid, p_official_post_id uuid, p_activity_type text, p_evidence_url text, p_client_submission_id uuid, p_evidence_text text, p_participant_reported_at timestamp with time zone') = 1 as claim_rpc_exists,
    count(*) filter (where function_name = 'review_special_offer_activity' and identity_arguments = 'p_activity_id uuid, p_new_status text, p_verified_activity_at timestamp with time zone, p_review_note text, p_rejection_reason text') = 1 as review_activity_rpc_exists,
    count(*) filter (where function_name = 'special_offer_entry_score_summary' and identity_arguments = 'p_offer_id uuid, p_entry_id uuid') = 1 as score_function_exists,
    bool_and(prosecdef) as all_functions_security_definer,
    bool_and(proconfig @> array['search_path=pg_catalog, public']) as all_functions_safe_search_path,
    bool_and(owner_name = 'postgres') as all_functions_owner_postgres
  from function_sources
),
function_grant_checks as (
  select
    not has_function_privilege('anon', 'public.admin_upsert_special_offer_official_post(uuid, uuid, integer, integer, text, text, text, text, timestamptz, timestamptz, boolean)', 'EXECUTE') as anon_admin_upsert_execute_absent,
    has_function_privilege('authenticated', 'public.admin_upsert_special_offer_official_post(uuid, uuid, integer, integer, text, text, text, text, timestamptz, timestamptz, boolean)', 'EXECUTE') as authenticated_admin_upsert_execute_present,
    has_function_privilege('service_role', 'public.admin_upsert_special_offer_official_post(uuid, uuid, integer, integer, text, text, text, text, timestamptz, timestamptz, boolean)', 'EXECUTE') as service_role_admin_upsert_execute_present,
    not has_function_privilege('anon', 'public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz)', 'EXECUTE') as anon_claim_execute_absent,
    has_function_privilege('authenticated', 'public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz)', 'EXECUTE') as authenticated_claim_execute_present,
    not has_function_privilege('anon', 'public.review_special_offer_activity(uuid, text, timestamptz, text, text)', 'EXECUTE') as anon_review_activity_execute_absent,
    has_function_privilege('authenticated', 'public.review_special_offer_activity(uuid, text, timestamptz, text, text)', 'EXECUTE') as authenticated_review_activity_execute_present,
    has_function_privilege('service_role', 'public.review_special_offer_activity(uuid, text, timestamptz, text, text)', 'EXECUTE') as service_role_review_activity_execute_present,
    not has_function_privilege('anon', 'public.special_offer_entry_score_summary(uuid, uuid)', 'EXECUTE') as anon_score_execute_absent,
    has_function_privilege('authenticated', 'public.special_offer_entry_score_summary(uuid, uuid)', 'EXECUTE') as authenticated_score_execute_present
),
rpc_logic_checks as (
  select
    exists (
      select 1 from function_sources
      where function_name = 'admin_upsert_special_offer_official_post'
        and fn like '%is_current_user_admin%'
        and fn like '%for update%'
        and fn like '%invalid_platform%'
        and fn like '%invalid_official_url%'
        and fn like '%official_post_created%'
        and fn like '%official_post_updated%'
    ) as admin_upsert_logic_ok,
    exists (
      select 1 from function_sources
      where function_name = 'admin_deactivate_special_offer_official_post'
        and fn like '%is_current_user_admin%'
        and fn like '%for update%'
        and fn like '%official_post_deactivated%'
        and fn like '%idempotent := true%'
    ) as admin_deactivate_logic_ok,
    exists (
      select 1 from function_sources
      where function_name = 'submit_special_offer_activity_claim'
        and fn like '%auth.uid%'
        and fn like '%auth.users%'
        and fn like '%email_confirmed_at%'
        and fn like '%v_entry.user_id is distinct from v_uid%'
        and fn like '%allow_bonus_points%'
        and fn like '%v_post.active is not true%'
        and fn like '%v_entry.status not in (''submitted'', ''pending_review'', ''approved'')%'
        and fn like '%client_submission_id%'
        and fn like '%activity_claimed%'
        and fn like '%''pending'', 0,%'
    ) as claim_logic_ok,
    exists (
      select 1 from function_sources
      where function_name = 'review_special_offer_activity'
        and fn like '%is_current_user_admin%'
        and fn like '%for update%'
        and fn like '%v_activity.status = v_new_status%'
        and fn like '%idempotent := true%'
        and fn like '%rejection_reason_required%'
        and fn like '%comment_time_not_eligible%'
        and fn like '%p_verified_activity_at < v_post.published_at%'
        and fn like '%p_verified_activity_at > v_post.comment_deadline_at%'
        and fn like '%v_activity.activity_type = ''comment''%'
        and fn like '%activity_reviewed%'
    ) as review_activity_logic_ok,
    exists (
      select 1 from function_sources
      where function_name = 'special_offer_entry_score_summary'
        and fn like '%case when e.status = ''approved'' then 1 else 0 end%'
        and fn like '%a.activity_type = ''share''%'
        and fn like '%a.activity_type = ''comment''%'
        and fn like '%a.verified_activity_at <= p.comment_deadline_at%'
        and fn like '%v_is_admin or e.user_id = v_uid%'
    ) as score_logic_ok
),
audit_safety_checks as (
  select
    exists (
      select 1 from function_sources
      where function_name = 'submit_special_offer_activity_claim'
        and fn like '%insert into public.special_offer_audit_log%'
        and fn like '%''activity_type'', v_activity.activity_type%'
        and fn not like '%''evidence_url''%'
        and fn not like '%''evidence_text''%'
        and fn not like '%''email''%'
        and fn not like '%''phone''%'
        and fn not like '%answers_json%'
        and fn not like '%form_snapshot_json%'
    ) as claim_audit_no_pii,
    exists (
      select 1 from function_sources
      where function_name = 'review_special_offer_activity'
        and fn like '%insert into public.special_offer_audit_log%'
        and fn like '%''old_points'', v_activity.points_awarded%'
        and fn not like '%''evidence_url''%'
        and fn not like '%''evidence_text''%'
        and fn not like '%''email''%'
        and fn not like '%''phone''%'
        and fn not like '%answers_json%'
        and fn not like '%form_snapshot_json%'
    ) as review_audit_no_pii
),
forbidden_object_checks as (
  select
    not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'special_offer_tasks',
          'special_offer_draws',
          'special_offer_draw_entries',
          'special_offer_winners'
        )
    ) as no_tasks_draws_winners,
    not exists (
      select 1 from function_sources
      where fn like '%special_offer_winners%'
         or fn like '%special_offer_draws%'
         or fn like '%special_offer_draw_entries%'
         or fn like '%winner%'
    ) as no_auto_winner_logic
)
select
  r.official_posts_exists,
  r.activities_exists,
  r.special_offers_exists,
  r.entries_exists,
  r.audit_log_exists,
  c.official_posts_columns_ok,
  c.activities_columns_ok,
  k.entries_id_offer_unique_exists,
  k.official_posts_id_offer_unique_exists,
  k.official_posts_offer_url_unique_exists,
  k.official_posts_offer_order_unique_exists,
  k.activity_entry_offer_fk_exists,
  k.activity_post_offer_fk_exists,
  k.activity_entry_post_type_unique_exists,
  k.activity_entry_client_unique_exists,
  k.platform_check_exists,
  k.activity_type_check_exists,
  k.activity_status_check_exists,
  k.status_points_check_exists,
  k.comment_approved_time_check_exists,
  i.official_posts_offer_order_index_exists,
  i.official_posts_offer_active_index_exists,
  i.activities_offer_status_index_exists,
  i.activities_entry_index_exists,
  i.activities_post_index_exists,
  s.official_posts_rls_enabled,
  s.activities_rls_enabled,
  s.official_posts_admin_select_policy_exists,
  s.official_posts_public_active_policy_exists,
  s.activities_admin_select_policy_exists,
  s.activities_user_select_policy_exists,
  g.no_public_direct_write_grants,
  g.official_posts_anon_select_granted,
  g.activities_authenticated_select_granted,
  g.activities_anon_select_absent,
  g.service_role_table_access_present,
  fs.public_helper_exists,
  fs.admin_upsert_rpc_exists,
  fs.admin_deactivate_rpc_exists,
  fs.claim_rpc_exists,
  fs.review_activity_rpc_exists,
  fs.score_function_exists,
  fs.all_functions_security_definer,
  fs.all_functions_safe_search_path,
  fs.all_functions_owner_postgres,
  fg.anon_admin_upsert_execute_absent,
  fg.authenticated_admin_upsert_execute_present,
  fg.service_role_admin_upsert_execute_present,
  fg.anon_claim_execute_absent,
  fg.authenticated_claim_execute_present,
  fg.anon_review_activity_execute_absent,
  fg.authenticated_review_activity_execute_present,
  fg.service_role_review_activity_execute_present,
  fg.anon_score_execute_absent,
  fg.authenticated_score_execute_present,
  l.admin_upsert_logic_ok,
  l.admin_deactivate_logic_ok,
  l.claim_logic_ok,
  l.review_activity_logic_ok,
  l.score_logic_ok,
  a.claim_audit_no_pii,
  a.review_audit_no_pii,
  x.no_tasks_draws_winners,
  x.no_auto_winner_logic,
  (
    r.official_posts_exists
    and r.activities_exists
    and r.special_offers_exists
    and r.entries_exists
    and r.audit_log_exists
    and c.official_posts_columns_ok
    and c.activities_columns_ok
    and k.entries_id_offer_unique_exists
    and k.official_posts_id_offer_unique_exists
    and k.official_posts_offer_url_unique_exists
    and k.official_posts_offer_order_unique_exists
    and k.activity_entry_offer_fk_exists
    and k.activity_post_offer_fk_exists
    and k.activity_entry_post_type_unique_exists
    and k.activity_entry_client_unique_exists
    and k.platform_check_exists
    and k.activity_type_check_exists
    and k.activity_status_check_exists
    and k.status_points_check_exists
    and k.comment_approved_time_check_exists
    and i.official_posts_offer_order_index_exists
    and i.official_posts_offer_active_index_exists
    and i.activities_offer_status_index_exists
    and i.activities_entry_index_exists
    and i.activities_post_index_exists
    and s.official_posts_rls_enabled
    and s.activities_rls_enabled
    and s.official_posts_admin_select_policy_exists
    and s.official_posts_public_active_policy_exists
    and s.activities_admin_select_policy_exists
    and s.activities_user_select_policy_exists
    and g.no_public_direct_write_grants
    and g.official_posts_anon_select_granted
    and g.activities_authenticated_select_granted
    and g.activities_anon_select_absent
    and g.service_role_table_access_present
    and fs.public_helper_exists
    and fs.admin_upsert_rpc_exists
    and fs.admin_deactivate_rpc_exists
    and fs.claim_rpc_exists
    and fs.review_activity_rpc_exists
    and fs.score_function_exists
    and fs.all_functions_security_definer
    and fs.all_functions_safe_search_path
    and fs.all_functions_owner_postgres
    and fg.anon_admin_upsert_execute_absent
    and fg.authenticated_admin_upsert_execute_present
    and fg.service_role_admin_upsert_execute_present
    and fg.anon_claim_execute_absent
    and fg.authenticated_claim_execute_present
    and fg.anon_review_activity_execute_absent
    and fg.authenticated_review_activity_execute_present
    and fg.service_role_review_activity_execute_present
    and fg.anon_score_execute_absent
    and fg.authenticated_score_execute_present
    and l.admin_upsert_logic_ok
    and l.admin_deactivate_logic_ok
    and l.claim_logic_ok
    and l.review_activity_logic_ok
    and l.score_logic_ok
    and a.claim_audit_no_pii
    and a.review_audit_no_pii
    and x.no_tasks_draws_winners
    and x.no_auto_winner_logic
  ) as overall_pass
from required_tables r
cross join column_checks c
cross join constraint_checks k
cross join index_checks i
cross join rls_checks s
cross join grant_checks g
cross join function_security_checks fs
cross join function_grant_checks fg
cross join rpc_logic_checks l
cross join audit_safety_checks a
cross join forbidden_object_checks x;
