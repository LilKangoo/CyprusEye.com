-- Special Offers 3C.5C-0 verify only.
-- Read-only checks for authenticated, confirmed-email submit_special_offer_entry.

with rpc as (
  select
    p.oid,
    p.prosecdef,
    p.proowner,
    coalesce(p.proconfig, array[]::text[]) as proconfig,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_special_offer_entry'
    and pg_get_function_identity_arguments(p.oid) = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'
),
source_checks as (
  select
    exists (select 1 from rpc) as rpc_exists,
    coalesce((select prosecdef from rpc), false) as rpc_security_definer,
    coalesce((select 'search_path=pg_catalog, public' = any(proconfig) from rpc), false) as rpc_safe_search_path,
    coalesce((select pg_get_userbyid(proowner) = 'postgres' from rpc), false) as rpc_owner_ok,
    coalesce((select source like '%auth.uid()%' from rpc), false) as auth_uid_present,
    coalesce((select source like '%login_required%' from rpc), false) as login_required_present,
    coalesce((select source like '%from auth.users%' from rpc), false) as auth_users_email_source_present,
    coalesce((select source like '%email_confirmed_at%' and source like '%confirmed_at%' from rpc), false) as email_confirmation_check_present,
    coalesce((select source like '%email_not_confirmed%' from rpc), false) as email_not_confirmed_error_present,
    coalesce((select source like '%v_existing.user_id = v_uid%' from rpc), false) as idempotency_owner_check_present,
    coalesce((select source not like '%v_existing.user_id is null%' from rpc), false) as idempotency_no_anon_owner_branch,
    coalesce((select source like '%and e.user_id = v_uid%' from rpc), false) as duplicate_check_uses_user_id,
    coalesce((select source like '%v_identity_key := ''user:'' || v_uid::text%' from rpc), false) as identity_key_uses_user_id,
    coalesce((select source like '%v_normalized_email := v_auth_email%' from rpc), false) as canonical_email_from_auth,
    coalesce((select source like '%v_value := to_jsonb(v_normalized_email)%' from rpc), false) as email_answer_overridden_by_auth,
    coalesce((select source like '%insert into public.special_offer_entries%' and source like '%user_id%' and source like '%v_uid%' from rpc), false) as entry_user_id_inserted_from_auth,
    coalesce((select source like '%to_regclass(''public.profiles'')%' and source like '%profile_enriched_fields%' from rpc), false) as profile_enrichment_present,
    coalesce((select source like '%where id = $2%' and source like '%using v_profile_name, v_uid%' from rpc), false) as profile_enrichment_uses_auth_uid,
    coalesce((select source like '%nullif(btrim(coalesce(name%' and source like '%nullif(btrim(coalesce(phone%' from rpc), false) as profile_enrichment_only_empty_fields,
    coalesce((select source not like '%set contest_answer%' and source not like '%set shared_post_url%' from rpc), false) as profile_enrichment_no_campaign_answer_update,
    coalesce((select source like '%answers_logged%' and source like '%false%' and source like '%profile_enriched_fields%' from rpc), false) as audit_no_answers_logged,
    coalesce((select source not like '%update public.special_offer_entries%' from rpc), false) as no_entry_update_in_submit,
    coalesce((select source not like '%update public.special_offer_entry_answers%' from rpc), false) as no_answers_update_in_submit
),
grant_checks as (
  select
    not has_function_privilege('public', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as public_execute_absent,
    not has_function_privilege('anon', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as anon_execute_absent,
    has_function_privilege('authenticated', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as authenticated_execute_present,
    not has_function_privilege('service_role', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as service_role_execute_absent
),
direct_update_checks as (
  select
    not exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'public'
        and table_name in ('special_offer_entries', 'special_offer_entry_answers')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
    )
    and not exists (
      select 1
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name in ('special_offer_entries', 'special_offer_entry_answers')
        and privilege_type in ('INSERT', 'UPDATE')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
    ) as no_direct_public_entry_answer_writes
),
rls_checks as (
  select
    coalesce((select relrowsecurity from pg_class where oid = 'public.special_offer_entries'::regclass), false) as entries_rls_enabled,
    coalesce((select relrowsecurity from pg_class where oid = 'public.special_offer_entry_answers'::regclass), false) as answers_rls_enabled
),
profile_columns as (
  select
    to_regclass('public.profiles') is not null as profiles_table_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'name'
    ) as profile_name_column_known,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
    ) as profile_phone_column_available,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferred_language'
    ) as profile_preferred_language_column_available
),
structure_checks as (
  select
    to_regclass('public.special_offers') is not null
    and to_regclass('public.special_offer_form_fields') is not null
    and to_regclass('public.special_offer_entries') is not null
    and to_regclass('public.special_offer_entry_answers') is not null
    and to_regprocedure('public.is_current_user_admin()') is not null as required_objects_exist,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'special_offer_entries' and column_name = 'user_id'
    ) as entry_user_id_column_exists,
    exists (
      select 1 from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and constraint_name = 'special_offer_entries_offer_client_submission_key'
        and constraint_type = 'UNIQUE'
    ) as client_submission_unique_exists,
    not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'special_offer_tasks',
          'special_offer_entry_tasks',
          'special_offer_draws',
          'special_offer_draw_entries',
          'special_offer_winners'
        )
    ) as no_tasks_draws_winners
)
select
  s.required_objects_exist,
  s.entry_user_id_column_exists,
  s.client_submission_unique_exists,
  sc.rpc_exists,
  sc.rpc_security_definer,
  sc.rpc_safe_search_path,
  sc.rpc_owner_ok,
  g.public_execute_absent,
  g.anon_execute_absent,
  g.authenticated_execute_present,
  g.service_role_execute_absent,
  sc.auth_uid_present,
  sc.login_required_present,
  sc.auth_users_email_source_present,
  sc.email_confirmation_check_present,
  sc.email_not_confirmed_error_present,
  sc.idempotency_owner_check_present,
  sc.idempotency_no_anon_owner_branch,
  sc.duplicate_check_uses_user_id,
  sc.identity_key_uses_user_id,
  sc.canonical_email_from_auth,
  sc.email_answer_overridden_by_auth,
  sc.entry_user_id_inserted_from_auth,
  sc.profile_enrichment_present,
  sc.profile_enrichment_uses_auth_uid,
  sc.profile_enrichment_only_empty_fields,
  sc.profile_enrichment_no_campaign_answer_update,
  sc.audit_no_answers_logged,
  sc.no_entry_update_in_submit,
  sc.no_answers_update_in_submit,
  d.no_direct_public_entry_answer_writes,
  r.entries_rls_enabled,
  r.answers_rls_enabled,
  p.profiles_table_exists,
  p.profile_name_column_known,
  p.profile_phone_column_available,
  p.profile_preferred_language_column_available,
  s.no_tasks_draws_winners,
  (
    s.required_objects_exist
    and s.entry_user_id_column_exists
    and s.client_submission_unique_exists
    and sc.rpc_exists
    and sc.rpc_security_definer
    and sc.rpc_safe_search_path
    and sc.rpc_owner_ok
    and g.public_execute_absent
    and g.anon_execute_absent
    and g.authenticated_execute_present
    and g.service_role_execute_absent
    and sc.auth_uid_present
    and sc.login_required_present
    and sc.auth_users_email_source_present
    and sc.email_confirmation_check_present
    and sc.email_not_confirmed_error_present
    and sc.idempotency_owner_check_present
    and sc.idempotency_no_anon_owner_branch
    and sc.duplicate_check_uses_user_id
    and sc.identity_key_uses_user_id
    and sc.canonical_email_from_auth
    and sc.email_answer_overridden_by_auth
    and sc.entry_user_id_inserted_from_auth
    and sc.profile_enrichment_present
    and sc.profile_enrichment_uses_auth_uid
    and sc.profile_enrichment_only_empty_fields
    and sc.profile_enrichment_no_campaign_answer_update
    and sc.audit_no_answers_logged
    and sc.no_entry_update_in_submit
    and sc.no_answers_update_in_submit
    and d.no_direct_public_entry_answer_writes
    and r.entries_rls_enabled
    and r.answers_rls_enabled
    and p.profiles_table_exists
    and p.profile_name_column_known
    and s.no_tasks_draws_winners
  ) as overall_pass
from source_checks sc
cross join grant_checks g
cross join direct_update_checks d
cross join rls_checks r
cross join profile_columns p
cross join structure_checks s;
