-- =====================================================
-- Special Offers activity claim campaign date guard verify - read only
-- =====================================================
-- Purpose:
-- - verify submit_special_offer_activity_claim enforces campaign start_at/end_at
-- - verify grants, security definer and existing safety invariants remain intact
--
-- This script is read-only. It does not execute the RPC and does not modify data.
-- =====================================================

with rpc as (
  select
    p.oid,
    p.prosecdef,
    p.proowner,
    p.proconfig,
    p.prosrc,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as normalized_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_special_offer_activity_claim'
    and p.oid = to_regprocedure('public.submit_special_offer_activity_claim(uuid,uuid,text,text,uuid,text,timestamp with time zone)')
),
grants as (
  select
    has_function_privilege('public', 'public.submit_special_offer_activity_claim(uuid,uuid,text,text,uuid,text,timestamp with time zone)', 'EXECUTE') as public_execute,
    has_function_privilege('anon', 'public.submit_special_offer_activity_claim(uuid,uuid,text,text,uuid,text,timestamp with time zone)', 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', 'public.submit_special_offer_activity_claim(uuid,uuid,text,text,uuid,text,timestamp with time zone)', 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', 'public.submit_special_offer_activity_claim(uuid,uuid,text,text,uuid,text,timestamp with time zone)', 'EXECUTE') as service_role_execute
),
table_write_grants as (
  select exists (
    select 1
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name in ('special_offer_entries', 'special_offer_entry_answers', 'special_offer_entry_activities')
      and g.grantee in ('PUBLIC', 'anon', 'authenticated')
      and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) as public_user_table_writes_present
),
source_checks as (
  select
    normalized_source like '%auth.uid()%' as auth_uid_present,
    normalized_source like '%email_confirmed_at%' and normalized_source like '%confirmed_at%' as confirmed_email_present,
    normalized_source like '%v_entry.user_id is distinct from v_uid%' as ownership_present,
    normalized_source like '%v_offer.status <> ''active''%' as active_status_guard_present,
    normalized_source like '%v_offer.visibility <> ''public''%' as public_visibility_guard_present,
    normalized_source like '%allow_bonus_points%' as bonus_points_guard_present,
    normalized_source like '%v_offer.start_at is null%' as campaign_start_required_present,
    normalized_source like '%v_offer.end_at is null%' as campaign_end_required_present,
    normalized_source like '%v_now < v_offer.start_at%' as campaign_start_lower_bound_present,
    normalized_source like '%v_now > v_offer.end_at%' as campaign_end_upper_bound_present,
    normalized_source like '%v_post.active is not true%' as official_post_active_guard_present,
    normalized_source like '%client_submission_id%' and normalized_source like '%idempotent := true%' as idempotency_present,
    normalized_source like '%activity_claimed%' as audit_present,
    normalized_source not like '%update public.special_offer_entry_activities%' as no_activity_update_in_claim,
    normalized_source not like '%update public.special_offer_entries%' as no_entry_update_in_claim,
    position('idempotent := true' in normalized_source) > 0 as idempotent_position_found,
    position('v_offer.start_at is null' in normalized_source) > 0 as date_guard_position_found,
    position('insert into public.special_offer_entry_activities' in normalized_source) > 0 as insert_position_found,
    position('idempotent := true' in normalized_source) < position('v_offer.start_at is null' in normalized_source) as idempotent_before_date_guard,
    position('v_offer.start_at is null' in normalized_source) < position('insert into public.special_offer_entry_activities' in normalized_source) as date_guard_before_insert
  from rpc
),
table_state as (
  select
    to_regclass('public.special_offer_entries') is not null as entries_table_exists,
    to_regclass('public.special_offer_entry_answers') is not null as answers_table_exists,
    to_regclass('public.special_offer_official_posts') is not null as official_posts_table_exists,
    to_regclass('public.special_offer_entry_activities') is not null as activities_table_exists,
    to_regclass('public.special_offer_draws') is null as no_draws_table,
    to_regclass('public.special_offer_winners') is null as no_winners_table
),
summary as (
  select
    exists(select 1 from rpc) as rpc_exists,
    coalesce((select prosecdef from rpc), false) as rpc_security_definer,
    coalesce((select proconfig @> array['search_path=pg_catalog, public'] from rpc), false) as rpc_safe_search_path,
    coalesce((select pg_get_userbyid(proowner) = 'postgres' from rpc), false) as rpc_owner_postgres,
    coalesce((select not public_execute from grants), false) as public_execute_absent,
    coalesce((select not anon_execute from grants), false) as anon_execute_absent,
    coalesce((select authenticated_execute from grants), false) as authenticated_execute_present,
    coalesce((select not service_role_execute from grants), false) as service_role_execute_absent,
    coalesce((select not public_user_table_writes_present from table_write_grants), false) as no_public_user_direct_table_writes,
    coalesce((select auth_uid_present from source_checks), false) as auth_uid_present,
    coalesce((select confirmed_email_present from source_checks), false) as confirmed_email_present,
    coalesce((select ownership_present from source_checks), false) as ownership_present,
    coalesce((select active_status_guard_present from source_checks), false) as active_status_guard_present,
    coalesce((select public_visibility_guard_present from source_checks), false) as public_visibility_guard_present,
    coalesce((select bonus_points_guard_present from source_checks), false) as bonus_points_guard_present,
    coalesce((select campaign_start_required_present from source_checks), false) as campaign_start_required_present,
    coalesce((select campaign_end_required_present from source_checks), false) as campaign_end_required_present,
    coalesce((select campaign_start_lower_bound_present from source_checks), false) as campaign_start_lower_bound_present,
    coalesce((select campaign_end_upper_bound_present from source_checks), false) as campaign_end_upper_bound_present,
    coalesce((select official_post_active_guard_present from source_checks), false) as official_post_active_guard_present,
    coalesce((select idempotency_present from source_checks), false) as idempotency_present,
    coalesce((select audit_present from source_checks), false) as audit_present,
    coalesce((select no_activity_update_in_claim from source_checks), false) as no_activity_update_in_claim,
    coalesce((select no_entry_update_in_claim from source_checks), false) as no_entry_update_in_claim,
    coalesce((select idempotent_position_found and date_guard_position_found and idempotent_before_date_guard from source_checks), false) as idempotent_before_date_guard,
    coalesce((select date_guard_position_found and insert_position_found and date_guard_before_insert from source_checks), false) as date_guard_before_insert,
    coalesce((select entries_table_exists from table_state), false) as entries_table_exists,
    coalesce((select answers_table_exists from table_state), false) as answers_table_exists,
    coalesce((select official_posts_table_exists from table_state), false) as official_posts_table_exists,
    coalesce((select activities_table_exists from table_state), false) as activities_table_exists,
    coalesce((select no_draws_table from table_state), false) as no_draws_table,
    coalesce((select no_winners_table from table_state), false) as no_winners_table
)
select
  *,
  (
    rpc_exists
    and rpc_security_definer
    and rpc_safe_search_path
    and rpc_owner_postgres
    and public_execute_absent
    and anon_execute_absent
    and authenticated_execute_present
    and service_role_execute_absent
    and no_public_user_direct_table_writes
    and auth_uid_present
    and confirmed_email_present
    and ownership_present
    and active_status_guard_present
    and public_visibility_guard_present
    and bonus_points_guard_present
    and campaign_start_required_present
    and campaign_end_required_present
    and campaign_start_lower_bound_present
    and campaign_end_upper_bound_present
    and official_post_active_guard_present
    and idempotency_present
    and audit_present
    and no_activity_update_in_claim
    and no_entry_update_in_claim
    and idempotent_before_date_guard
    and date_guard_before_insert
    and entries_table_exists
    and answers_table_exists
    and official_posts_table_exists
    and activities_table_exists
    and no_draws_table
    and no_winners_table
  ) as overall_pass
from summary;
