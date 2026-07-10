-- Special Offers 3C.5C-6K entry hard delete repair verify.
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
    and p.proname = 'admin_delete_special_offer_entry'
    and pg_get_function_identity_arguments(p.oid) = 'p_entry_id uuid, p_expected_reference text, p_reason text'
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
       and position('delete from public.special_offer_entries' in source) > position('insert into public.special_offer_audit_log' in source)
      then substr(
        source,
        position('insert into public.special_offer_audit_log' in source),
        position('delete from public.special_offer_entries' in source) - position('insert into public.special_offer_audit_log' in source)
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
    coalesce((select identity_arguments from fn), '') = 'p_entry_id uuid, p_expected_reference text, p_reason text' as rpc_signature_ok,
    not exists (
      select 1 from acl_rows
      where grantee = 0
        and privilege_type = 'EXECUTE'
    ) as public_execute_absent,
    not has_function_privilege('anon', 'public.admin_delete_special_offer_entry(uuid,text,text)', 'EXECUTE') as anon_execute_absent,
    has_function_privilege('authenticated', 'public.admin_delete_special_offer_entry(uuid,text,text)', 'EXECUTE') as authenticated_execute_present,
    not has_function_privilege('service_role', 'public.admin_delete_special_offer_entry(uuid,text,text)', 'EXECUTE') as service_role_execute_absent,
    coalesce((select source from fn), '') like '%v_actor uuid := auth.uid()%' as auth_uid_present,
    coalesce((select source from fn), '') like '%is_current_user_admin%' as admin_check_present,
    coalesce((select source from fn), '') like '%for update%' as entry_for_update_present,
    coalesce((select source from fn), '') like '%delete_reason_required%' as reason_required,
    coalesce((select source from fn), '') like '%entry_reference_mismatch%' as reference_confirmation_required,
    coalesce((select source from fn), '') like '%entry_has_winner_record%' as winner_guard_present,
    coalesce((select source from fn), '') like '%entry_winner_guard_unverifiable%' as winner_guard_unverifiable_fails_closed,
    coalesce((select source from fn), '') like '%from public.special_offer_entry_answers ans%' as answer_count_aliased,
    coalesce((select source from fn), '') like '%ans.entry_id = v_entry.id%' as answer_entry_id_qualified,
    coalesce((select source from fn), '') like '%from public.special_offer_entry_activities act%' as activity_count_aliased,
    coalesce((select source from fn), '') like '%act.entry_id = v_entry.id%' as activity_entry_id_qualified,
    coalesce((select source from fn), '') not like '%where entry_id = v_entry.id%' as ambiguous_entry_id_pattern_absent,
    coalesce((select source from fn), '') like '%insert into public.special_offer_audit_log%' as tombstone_audit_present,
    coalesce((select source from fn), '') like '%''entry_hard_deleted''%' as tombstone_action_present,
    coalesce((select source from audit_block), '') not like '%v_reason%'
      and coalesce((select source from audit_block), '') not like '%p_reason%' as audit_reason_value_not_logged,
    coalesce((select source from fn), '') not like '%delete from public.profiles%'
      and coalesce((select source from fn), '') not like '%delete from auth.users%'
      and coalesce((select source from fn), '') not like '%delete from public.special_offers%'
      and coalesce((select source from fn), '') not like '%delete from public.special_offer_official_posts%' as user_profile_campaign_post_preserved,
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('special_offer_entries', 'special_offer_entry_answers', 'special_offer_entry_activities')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as no_direct_user_table_writes,
    to_regclass('public.special_offer_draws') is null as no_draws_table
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
    and entry_for_update_present
    and reason_required
    and reference_confirmation_required
    and winner_guard_present
    and winner_guard_unverifiable_fails_closed
    and answer_count_aliased
    and answer_entry_id_qualified
    and activity_count_aliased
    and activity_entry_id_qualified
    and ambiguous_entry_id_pattern_absent
    and tombstone_audit_present
    and tombstone_action_present
    and audit_reason_value_not_logged
    and user_profile_campaign_post_preserved
    and no_direct_user_table_writes
    and no_draws_table
  ) as overall_pass
from diagnostics;
