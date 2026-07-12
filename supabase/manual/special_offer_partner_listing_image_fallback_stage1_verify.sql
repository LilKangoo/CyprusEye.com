-- =====================================================
-- Special Offers 3C.8E - Partner listing image fallback verify
-- =====================================================
-- Read-only diagnostics. Expected overall_pass = true after patch.
-- =====================================================

with fn as (
  select
    p.oid,
    p.proowner,
    p.prosecdef,
    p.proconfig,
    p.proacl,
    r.rolname as owner_name,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname = 'get_partner_active_special_offers'
),
target as (
  select *
  from fn
  where identity_args = 'p_lang text'
  limit 1
),
acl as (
  select
    a.grantee,
    a.privilege_type
  from target t
  cross join lateral aclexplode(coalesce(t.proacl, acldefault('f', t.proowner))) a
),
checks as (
  select
    exists (select 1 from target) as rpc_exists,
    coalesce((select identity_args = 'p_lang text' from target), false) as rpc_signature_ok,
    coalesce((select result_type like 'TABLE(%slug text%requested_lang text%resolved_lang text%title text%short_description text%cover_image_url text%start_at timestamp with time zone%end_at timestamp with time zone%)' from target), false) as rpc_return_type_unchanged,
    coalesce((select prosecdef from target), false) as rpc_security_definer,
    coalesce((select owner_name = 'postgres' from target), false) as rpc_owner_ok,
    coalesce((
      select exists (
        select 1
        from unnest(coalesce(proconfig, array[]::text[])) cfg
        where cfg = 'search_path=pg_catalog, public'
      )
      from target
    ), false) as rpc_safe_search_path,
    coalesce((select source like '%auth.uid()%' from target), false) as auth_uid_guard_present,
    coalesce((select source like '%is_partner_user(p.id)%' and source like '%p.status = ''active''%' from target), false) as partner_authorization_guard_present,
    coalesce((select source like '%o.status = ''active''%' from target), false) as active_status_guard_present,
    coalesce((select source like '%o.visibility = ''public''%' from target), false) as public_visibility_guard_present,
    coalesce((select source like '%now() >= o.start_at%' and source like '%now() <= o.end_at%' from target), false) as active_window_enforced,
    coalesce((select source like '%o.archived_at is null%' and source not like '%status in (''active'', ''ended'', ''locked'')%' from target), false) as archived_and_ended_locked_excluded,
    coalesce((select source like '%eo.cover_image_url, eo.hero_image_url, eo.meta_image_url%' from target), false) as image_fallback_order_present,
    coalesce((select source like '%o.meta_image_url%' from target), false) as meta_image_source_present,
    coalesce((select source not like '%special_offer_entries%' and source not like '%special_offer_entry_answers%' and source not like '%special_offer_entry_activities%' from target), false) as no_entries_answers_activities_reads,
    coalesce((select source not like '%special_offer_entry_referrals%' and source not like '%special_offer_audit_log%' and source not like '%special_offer_winner_%' from target), false) as no_referral_audit_or_winner_reads,
    coalesce((select result_type not like '%offer_id%' and result_type not like '%entry_id%' and result_type not like '%user_id%' and result_type not like '%partner_id%' from target), false) as no_private_identifiers_returned,
    coalesce((select result_type not like '%email%' and result_type not like '%phone%' and result_type not like '%dob%' and result_type not like '%date_of_birth%' and result_type not like '%reference%' and result_type not like '%score%' from target), false) as no_pii_or_score_returned,
    coalesce((select source !~* '(^|[^a-z])(insert\\s+into|update\\s+public\\.|delete\\s+from|merge\\s+into|truncate\\s+|drop\\s+|alter\\s+table)' from target), false) as no_data_modification,
    not exists (
      select 1
      from acl
      where grantee = 0
        and privilege_type = 'EXECUTE'
    ) as public_execute_absent,
    not exists (
      select 1
      from acl
      join pg_roles r on r.oid = acl.grantee
      where r.rolname = 'anon'
        and acl.privilege_type = 'EXECUTE'
    ) as anon_execute_absent,
    exists (
      select 1
      from acl
      join pg_roles r on r.oid = acl.grantee
      where r.rolname = 'authenticated'
        and acl.privilege_type = 'EXECUTE'
    ) as authenticated_execute_present,
    not exists (
      select 1
      from acl
      join pg_roles r on r.oid = acl.grantee
      where r.rolname = 'service_role'
        and acl.privilege_type = 'EXECUTE'
    ) as service_role_execute_absent
)
select
  *,
  (
    rpc_exists
    and rpc_signature_ok
    and rpc_return_type_unchanged
    and rpc_security_definer
    and rpc_owner_ok
    and rpc_safe_search_path
    and auth_uid_guard_present
    and partner_authorization_guard_present
    and active_status_guard_present
    and public_visibility_guard_present
    and active_window_enforced
    and archived_and_ended_locked_excluded
    and image_fallback_order_present
    and meta_image_source_present
    and no_entries_answers_activities_reads
    and no_referral_audit_or_winner_reads
    and no_private_identifiers_returned
    and no_pii_or_score_returned
    and no_data_modification
    and public_execute_absent
    and anon_execute_absent
    and authenticated_execute_present
    and service_role_execute_absent
  ) as overall_pass
from checks;
