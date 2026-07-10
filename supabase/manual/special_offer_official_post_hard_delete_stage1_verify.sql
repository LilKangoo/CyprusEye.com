-- Special Offers 3C.5C-6K official post hard delete verify.
-- Read-only. Prepared for manual execution only. Do not run from Codex.

with fn as (
  select
    p.oid,
    p.proowner::regrole::text as owner,
    p.prosecdef,
    p.proconfig,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as source,
    coalesce(p.proacl, acldefault('f', p.proowner)) as acl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_delete_special_offer_official_post'
    and pg_get_function_identity_arguments(p.oid) = 'p_official_post_id uuid, p_expected_admin_title text, p_reason text'
),
acl_rows as (
  select
    fn.oid,
    acl.grantee,
    acl.privilege_type
  from fn
  cross join lateral aclexplode(fn.acl) acl
),
audit_block as (
  select
    case
      when position('insert into public.special_offer_audit_log' in source) > 0
       and position('delete from public.special_offer_official_posts' in source) > position('insert into public.special_offer_audit_log' in source)
      then substr(
        source,
        position('insert into public.special_offer_audit_log' in source),
        position('delete from public.special_offer_official_posts' in source) - position('insert into public.special_offer_audit_log' in source)
      )
      else ''
    end as source
  from fn
),
diagnostics as (
  select
    exists(select 1 from fn) as rpc_exists,
    coalesce((select prosecdef from fn), false) as rpc_security_definer,
    coalesce((select owner from fn), '') = 'postgres' as rpc_owner_ok,
    coalesce((select proconfig::text from fn), '') like '%search_path=pg_catalog, public%' as rpc_safe_search_path,
    coalesce((select identity_arguments from fn), '') = 'p_official_post_id uuid, p_expected_admin_title text, p_reason text' as rpc_signature_ok,
    not exists (
      select 1 from acl_rows
      where grantee = 0
        and privilege_type = 'EXECUTE'
    ) as public_execute_absent,
    not has_function_privilege('anon', 'public.admin_delete_special_offer_official_post(uuid,text,text)', 'EXECUTE') as anon_execute_absent,
    has_function_privilege('authenticated', 'public.admin_delete_special_offer_official_post(uuid,text,text)', 'EXECUTE') as authenticated_execute_present,
    not has_function_privilege('service_role', 'public.admin_delete_special_offer_official_post(uuid,text,text)', 'EXECUTE') as service_role_execute_absent,
    coalesce((select source from fn), '') like '%v_actor uuid := auth.uid()%' as auth_uid_present,
    coalesce((select source from fn), '') like '%is_current_user_admin%' as admin_check_present,
    coalesce((select source from fn), '') like '%for update%' as post_for_update_present,
    coalesce((select source from fn), '') like '%delete_reason_required%' as reason_required,
    coalesce((select source from fn), '') like '%official_post_title_mismatch%' as title_confirmation_required,
    coalesce((select source from fn), '') like '%official_post_must_be_inactive%' as inactive_guard_present,
    coalesce((select source from fn), '') like '%official_post_has_activities%' as zero_activity_guard_present,
    coalesce((select source from fn), '') like '%act.official_post_id = v_post.id%' as activity_count_qualified,
    coalesce((select source from fn), '') like '%insert into public.special_offer_audit_log%' as tombstone_audit_present,
    coalesce((select source from fn), '') like '%''official_post_hard_deleted''%' as tombstone_action_present,
    coalesce((select source from audit_block), '') not like '%official_url%' as audit_official_url_not_logged,
    coalesce((select source from audit_block), '') not like '%external_post_id%' as audit_external_id_not_logged,
    coalesce((select source from audit_block), '') not like '%admin_title%' as audit_admin_title_not_logged,
    coalesce((select source from audit_block), '') not like '%v_reason%'
      and coalesce((select source from audit_block), '') not like '%p_reason%' as audit_reason_value_not_logged,
    coalesce((select source from fn), '') not like '%delete from public.special_offer_entry_activities%' as no_activity_cascade_delete_in_rpc,
    coalesce((select source from fn), '') not like '%delete from public.special_offers%'
      and coalesce((select source from fn), '') not like '%delete from public.special_offer_entries%'
      and coalesce((select source from fn), '') not like '%delete from public.profiles%'
      and coalesce((select source from fn), '') not like '%delete from auth.users%' as campaign_entry_user_preserved,
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('special_offer_official_posts', 'special_offer_entry_activities')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as no_direct_user_table_writes,
    to_regclass('public.special_offer_draws') is null as no_draws_table,
    to_regclass('public.special_offer_winners') is null as no_winners_table
)
select
  *,
  (
    rpc_exists
    and rpc_security_definer
    and rpc_owner_ok
    and rpc_safe_search_path
    and rpc_signature_ok
    and public_execute_absent
    and anon_execute_absent
    and authenticated_execute_present
    and service_role_execute_absent
    and auth_uid_present
    and admin_check_present
    and post_for_update_present
    and reason_required
    and title_confirmation_required
    and inactive_guard_present
    and zero_activity_guard_present
    and activity_count_qualified
    and tombstone_audit_present
    and tombstone_action_present
    and audit_official_url_not_logged
    and audit_external_id_not_logged
    and audit_admin_title_not_logged
    and audit_reason_value_not_logged
    and no_activity_cascade_delete_in_rpc
    and campaign_entry_user_preserved
    and no_direct_user_table_writes
    and no_draws_table
    and no_winners_table
  ) as overall_pass
from diagnostics;
