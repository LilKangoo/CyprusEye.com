-- Special Offers 3C.7C - entry partner attribution verify.
-- Read-only diagnostics. Expected overall_pass = true after stage1 SQL is applied.

with table_info as (
  select
    to_regclass('public.special_offer_entry_referrals') is not null as attribution_table_exists,
    coalesce((select relrowsecurity from pg_class where oid = 'public.special_offer_entry_referrals'::regclass), false) as attribution_rls_enabled
),
columns as (
  select
    count(*) filter (where column_name = 'entry_id' and data_type = 'uuid') > 0 as entry_id_column,
    count(*) filter (where column_name = 'offer_id' and data_type = 'uuid') > 0 as offer_id_column,
    count(*) filter (where column_name = 'partner_id' and data_type = 'uuid') > 0 as partner_id_column,
    count(*) filter (where column_name = 'referrer_user_id' and data_type = 'uuid') > 0 as referrer_user_id_column,
    count(*) filter (where column_name = 'referral_code_snapshot' and data_type = 'text') > 0 as code_snapshot_column,
    count(*) filter (where column_name = 'referral_source' and data_type = 'text') > 0 as source_column,
    count(*) filter (where column_name = 'referral_captured_at' and data_type = 'timestamp with time zone') > 0 as captured_at_column,
    count(*) filter (where column_name = 'created_at' and data_type = 'timestamp with time zone') > 0 as created_at_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'special_offer_entry_referrals'
),
constraints as (
  select
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.contype = 'p'
        and pg_get_constraintdef(c.oid) ilike '%primary key (entry_id)%'
    ) as entry_primary_key,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.conname = 'special_offer_entry_referrals_entry_offer_fkey'
        and c.confrelid = 'public.special_offer_entries'::regclass
        and pg_get_constraintdef(c.oid) ilike '%foreign key (entry_id, offer_id)%'
        and pg_get_constraintdef(c.oid) ilike '%on delete cascade%'
    ) as entry_offer_fk_cascade,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.confrelid = 'public.partners'::regclass
    ) as partner_fk_exists,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.confrelid = 'public.profiles'::regclass
        and pg_get_constraintdef(c.oid) ilike '%on delete set null%'
    ) as referrer_profile_fk_set_null,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.conname = 'special_offer_entry_referrals_source_check'
        and pg_get_constraintdef(c.oid) ilike '%profile_first_touch%'
        and pg_get_constraintdef(c.oid) ilike '%url%'
        and pg_get_constraintdef(c.oid) ilike '%stored%'
        and pg_get_constraintdef(c.oid) ilike '%manual%'
    ) as source_check_exists
),
policies as (
  select
    exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'special_offer_entry_referrals'
        and p.policyname = 'special_offer_entry_referrals_admin_select'
        and p.cmd = 'SELECT'
        and p.qual ilike '%is_current_user_admin%'
    ) as admin_select_policy_exists
),
table_grants as (
  select
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'special_offer_entry_referrals'
        and grantee in ('PUBLIC', 'anon')
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) as no_public_anon_table_access,
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'special_offer_entry_referrals'
        and grantee = 'authenticated'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as no_authenticated_direct_writes,
    exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'special_offer_entry_referrals'
        and grantee = 'authenticated'
        and privilege_type = 'SELECT'
    ) as authenticated_select_granted_for_admin_policy
),
fns as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    p.proowner,
    p.prosecdef,
    p.proconfig,
    p.proacl,
    p.proowner::regrole::text as owner_name,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('submit_special_offer_entry', 'special_offer_resolve_entry_referral', 'update_special_offer_entry_once', 'review_special_offer_entry', 'admin_delete_special_offer_entry')
),
submit_fn as (
  select *
  from fns
  where proname = 'submit_special_offer_entry'
    and identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid, p_referral_code text, p_referral_source text'
  limit 1
),
resolver_fn as (
  select *
  from fns
  where proname = 'special_offer_resolve_entry_referral'
    and identity_args = 'p_user_id uuid, p_referral_code text, p_referral_source text'
  limit 1
),
correction_fn as (
  select *
  from fns
  where proname = 'update_special_offer_entry_once'
    and identity_args = 'p_entry_id uuid, p_answers jsonb, p_client_correction_id uuid'
  limit 1
),
review_fn as (
  select *
  from fns
  where proname = 'review_special_offer_entry'
    and identity_args = 'p_entry_id uuid, p_new_status text, p_review_note text, p_rejection_reason text'
  limit 1
),
delete_fn as (
  select *
  from fns
  where proname = 'admin_delete_special_offer_entry'
    and identity_args = 'p_entry_id uuid, p_expected_reference text, p_reason text'
  limit 1
),
trigger_sources as (
  select
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'public'
    and c.relname in ('special_offer_entries', 'special_offer_entry_answers', 'special_offer_entry_referrals')
    and not t.tgisinternal
),
submit_acl as (
  select a.grantee, a.privilege_type
  from submit_fn fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a
),
resolver_acl as (
  select a.grantee, coalesce(r.rolname, 'PUBLIC') as grantee_name, a.privilege_type
  from resolver_fn fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a
  left join pg_roles r on r.oid = a.grantee
),
checks as (
  select
    ti.attribution_table_exists,
    ti.attribution_rls_enabled,
    c.entry_id_column,
    c.offer_id_column,
    c.partner_id_column,
    c.referrer_user_id_column,
    c.code_snapshot_column,
    c.source_column,
    c.captured_at_column,
    c.created_at_column,
    con.entry_primary_key,
    con.entry_offer_fk_cascade,
    con.partner_fk_exists,
    con.referrer_profile_fk_set_null,
    con.source_check_exists,
    pol.admin_select_policy_exists,
    tg.no_public_anon_table_access,
    tg.no_authenticated_direct_writes,
    tg.authenticated_select_granted_for_admin_policy,
    exists(select 1 from submit_fn) as submit_six_arg_exists,
    coalesce((select prosecdef from submit_fn), false) as submit_security_definer,
    coalesce((select owner_name = 'postgres' from submit_fn), false) as submit_owner_ok,
    coalesce((select proconfig::text from submit_fn), '') like '%search_path=pg_catalog, public%' as submit_safe_search_path,
    coalesce((select result_type like '%referral_attributed boolean%' from submit_fn), false) as submit_returns_referral_attributed,
    not exists (select 1 from submit_acl where grantee = 0 and privilege_type = 'EXECUTE') as submit_public_execute_absent,
    not exists (select 1 from submit_acl join pg_roles r on r.oid = submit_acl.grantee where r.rolname = 'anon' and privilege_type = 'EXECUTE') as submit_anon_execute_absent,
    exists (select 1 from submit_acl join pg_roles r on r.oid = submit_acl.grantee where r.rolname = 'authenticated' and privilege_type = 'EXECUTE') as submit_authenticated_execute_present,
    not exists (select 1 from submit_acl join pg_roles r on r.oid = submit_acl.grantee where r.rolname = 'service_role' and privilege_type = 'EXECUTE') as submit_service_role_execute_absent,
    exists(select 1 from resolver_fn) as resolver_exists,
    coalesce((select prosecdef from resolver_fn), false) as resolver_security_definer,
    coalesce((select owner_name = 'postgres' from resolver_fn), false) as resolver_owner_ok,
    coalesce((select proconfig::text from resolver_fn), '') like '%search_path=pg_catalog, public%' as resolver_safe_search_path,
    not exists (select 1 from resolver_acl where grantee = 0 and privilege_type = 'EXECUTE') as resolver_public_execute_absent,
    not exists (select 1 from resolver_acl where grantee_name = 'anon' and privilege_type = 'EXECUTE') as resolver_anon_execute_absent,
    not exists (select 1 from resolver_acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE') as resolver_authenticated_execute_absent,
    not exists (select 1 from resolver_acl where grantee_name = 'service_role' and privilege_type = 'EXECUTE') as resolver_service_role_execute_absent,
    coalesce((select source like '%from public.profiles p where p.id = p_user_id for update%' from resolver_fn), false) as resolver_profile_for_update,
    coalesce((select source like '%if v_profile.referred_by is not null%' from resolver_fn), false) as first_touch_profile_guard,
    coalesce((select source like '%update public.profiles p set referred_by = v_match.referrer_user_id%' from resolver_fn), false) as missing_profile_assignment_only,
    coalesce((select source like '%and p.referred_by is null%' from resolver_fn), false) as no_overwrite_existing_referral,
    coalesce((select source like '%resolve_referral_code(v_code)%' from resolver_fn), false) as referral_code_resolved_backend_side,
    coalesce((select source like '%generate_profile_referral_code%' from resolver_fn), false) as referral_code_snapshot_fallback_present,
    coalesce((select source like '%v_match.referrer_user_id = p_user_id%' from resolver_fn), false) as self_referral_blocked,
    coalesce((select source like '%p.status = ''active''%' from resolver_fn), false) as active_partner_required,
    coalesce((select source like '%public.submit_special_offer_entry( p_offer_slug, p_lang, p_answers, p_client_submission_id )%' from submit_fn), false) as existing_submit_wrapped,
    coalesce((select source like '%coalesce(v_result.idempotent, false) is false%' from submit_fn), false) as attribution_only_on_new_entry,
    coalesce((select source like '%on conflict (entry_id) do nothing%' from submit_fn), false) as attribution_idempotent,
    coalesce((select source like '%special_offer.entry_referral_attributed%' from submit_fn), false) as attribution_audit_present,
    coalesce((select source not like '%referral_code_snapshot%' and source not like '%p_referral_code%' from correction_fn), false) as correction_does_not_touch_attribution,
    exists(select 1 from review_fn) as review_rpc_exists,
    exists(select 1 from review_fn) as review_rpc_exact_overload_selected,
    coalesce((select source not like '%insert into public.special_offer_entry_referrals%' from review_fn), false) as review_no_direct_attribution_insert,
    coalesce((select source not like '%update public.special_offer_entry_referrals%' from review_fn), false) as review_no_direct_attribution_update,
    coalesce((select source not like '%delete from public.special_offer_entry_referrals%' from review_fn), false) as review_no_direct_attribution_delete,
    coalesce((
      select source not like '%special_offer_resolve_entry_referral%'
        and source not like '%submit_special_offer_entry%'
        and source not like '%resolve_referral_code%'
        and source not like '%normalize_referral_code%'
        and source not like '%affiliate_get_user_partner_id%'
      from review_fn
    ), false)
    and not exists (
      select 1
      from trigger_sources ts
      where ts.source like '%insert into public.special_offer_entry_referrals%'
         or ts.source like '%update public.special_offer_entry_referrals%'
         or ts.source like '%delete from public.special_offer_entry_referrals%'
    ) as review_no_indirect_attribution_write,
    coalesce((select source not like '%special_offer_entry_referrals%' and source not like '%referral_code_snapshot%' and source not like '%p_referral_code%' from review_fn), false) as review_does_not_touch_attribution,
    coalesce((select source like '%delete from public.special_offer_entries%' from delete_fn), false) as hard_delete_entry_delete_present,
    coalesce((select source not like '%delete from public.special_offer_entry_referrals%' from delete_fn), false) as hard_delete_uses_fk_cascade_not_manual_referral_delete,
    coalesce((select source not like '%affiliate_commission%' and source not like '%payout%' and source not like '%winner%' and source not like '%ranking%' from submit_fn), false) as no_commission_winner_ranking_in_submit,
    coalesce((select source not like '%email%' and source not like '%phone%' and source not like '%answers_json%' and source not like '%evidence%' from submit_fn), false) as attribution_audit_no_pii_terms
  from table_info ti
  cross join columns c
  cross join constraints con
  cross join policies pol
  cross join table_grants tg
)
select
  *,
  (
    attribution_table_exists
    and attribution_rls_enabled
    and entry_id_column
    and offer_id_column
    and partner_id_column
    and referrer_user_id_column
    and code_snapshot_column
    and source_column
    and captured_at_column
    and created_at_column
    and entry_primary_key
    and entry_offer_fk_cascade
    and partner_fk_exists
    and referrer_profile_fk_set_null
    and source_check_exists
    and admin_select_policy_exists
    and no_public_anon_table_access
    and no_authenticated_direct_writes
    and authenticated_select_granted_for_admin_policy
    and submit_six_arg_exists
    and submit_security_definer
    and submit_owner_ok
    and submit_safe_search_path
    and submit_returns_referral_attributed
    and submit_public_execute_absent
    and submit_anon_execute_absent
    and submit_authenticated_execute_present
    and submit_service_role_execute_absent
    and resolver_exists
    and resolver_security_definer
    and resolver_owner_ok
    and resolver_safe_search_path
    and resolver_public_execute_absent
    and resolver_anon_execute_absent
    and resolver_authenticated_execute_absent
    and resolver_service_role_execute_absent
    and resolver_profile_for_update
    and first_touch_profile_guard
    and missing_profile_assignment_only
    and no_overwrite_existing_referral
    and referral_code_resolved_backend_side
    and referral_code_snapshot_fallback_present
    and self_referral_blocked
    and active_partner_required
    and existing_submit_wrapped
    and attribution_only_on_new_entry
    and attribution_idempotent
    and attribution_audit_present
    and correction_does_not_touch_attribution
    and review_rpc_exists
    and review_rpc_exact_overload_selected
    and review_no_direct_attribution_insert
    and review_no_direct_attribution_update
    and review_no_direct_attribution_delete
    and review_no_indirect_attribution_write
    and review_does_not_touch_attribution
    and hard_delete_entry_delete_present
    and hard_delete_uses_fk_cascade_not_manual_referral_delete
    and no_commission_winner_ranking_in_submit
    and attribution_audit_no_pii_terms
  ) as overall_pass
from checks;
