-- Special Offers 3C.7C-1 - production verify diagnostics.
-- Read-only. Returns failing/NULL checks first, then selected passing context.
-- Do not execute any data-changing RPC from this file.

with rel as (
  select to_regclass('public.special_offer_entry_referrals') as oid
),
table_info as (
  select
    rel.oid is not null as attribution_table_exists,
    coalesce((select c.relrowsecurity from pg_class c where c.oid = rel.oid), false) as attribution_rls_enabled
  from rel
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
    count(*) filter (where column_name = 'created_at' and data_type = 'timestamp with time zone') > 0 as created_at_column,
    string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) as details
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'special_offer_entry_referrals'
),
constraints as (
  select
    exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.contype = 'p'
        and pg_get_constraintdef(c.oid) ilike '%primary key (entry_id)%'
    ) as entry_primary_key,
    exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.conname = 'special_offer_entry_referrals_entry_offer_fkey'
        and c.confrelid = 'public.special_offer_entries'::regclass
        and pg_get_constraintdef(c.oid) ilike '%foreign key (entry_id, offer_id)%'
        and pg_get_constraintdef(c.oid) ilike '%on delete cascade%'
    ) as entry_offer_fk_cascade,
    exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.confrelid = 'public.partners'::regclass
    ) as partner_fk_exists,
    exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.confrelid = 'public.profiles'::regclass
        and pg_get_constraintdef(c.oid) ilike '%on delete set null%'
    ) as referrer_profile_fk_set_null,
    exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.special_offer_entry_referrals'::regclass
        and c.conname = 'special_offer_entry_referrals_source_check'
        and pg_get_constraintdef(c.oid) ilike '%profile_first_touch%'
        and pg_get_constraintdef(c.oid) ilike '%url%'
        and pg_get_constraintdef(c.oid) ilike '%stored%'
        and pg_get_constraintdef(c.oid) ilike '%manual%'
    ) as source_check_exists,
    coalesce(string_agg(c.conname || '=' || pg_get_constraintdef(c.oid), ' | ' order by c.conname), '') as details
  from pg_constraint c
  where c.conrelid = 'public.special_offer_entry_referrals'::regclass
),
duplicates as (
  select
    not exists (
      select 1
      from public.special_offer_entry_referrals r
      group by r.entry_id
      having count(*) > 1
    ) as no_duplicate_entry_id,
    count(*)::integer as attribution_rows
  from public.special_offer_entry_referrals
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
    ) as admin_select_policy_exists,
    coalesce(string_agg(policyname || ':' || cmd || ':' || coalesce(qual, ''), ' | ' order by policyname), '') as details
  from pg_policies
  where schemaname = 'public'
    and tablename = 'special_offer_entry_referrals'
),
table_grants as (
  select
    not exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'special_offer_entry_referrals'
        and grantee in ('PUBLIC', 'anon')
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) as no_public_anon_table_access,
    not exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'special_offer_entry_referrals'
        and grantee = 'authenticated'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as no_authenticated_direct_writes,
    exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'special_offer_entry_referrals'
        and grantee = 'authenticated'
        and privilege_type = 'SELECT'
    ) as authenticated_select_granted_for_admin_policy,
    coalesce(string_agg(grantee || ':' || privilege_type, ', ' order by grantee, privilege_type), '') as details
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'special_offer_entry_referrals'
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
    and p.proname in (
      'submit_special_offer_entry',
      'special_offer_resolve_entry_referral',
      'update_special_offer_entry_once',
      'review_special_offer_entry',
      'admin_delete_special_offer_entry'
    )
),
submit_fn as (
  select * from fns
  where proname = 'submit_special_offer_entry'
    and identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid, p_referral_code text, p_referral_source text'
  limit 1
),
submit4_fn as (
  select * from fns
  where proname = 'submit_special_offer_entry'
    and identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'
  limit 1
),
resolver_fn as (
  select * from fns
  where proname = 'special_offer_resolve_entry_referral'
    and identity_args = 'p_user_id uuid, p_referral_code text, p_referral_source text'
  limit 1
),
correction_fn as (
  select * from fns
  where proname = 'update_special_offer_entry_once'
    and identity_args = 'p_entry_id uuid, p_answers jsonb, p_client_correction_id uuid'
  limit 1
),
review_fn as (
  select * from fns
  where proname = 'review_special_offer_entry'
    and identity_args = 'p_entry_id uuid, p_decision text, p_note text, p_reason text'
  limit 1
),
delete_fn as (
  select * from fns
  where proname = 'admin_delete_special_offer_entry'
    and identity_args = 'p_entry_id uuid, p_expected_reference text, p_reason text'
  limit 1
),
submit_acl as (
  select a.grantee, coalesce(r.rolname, 'PUBLIC') as grantee_name, a.privilege_type
  from submit_fn fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a
  left join pg_roles r on r.oid = a.grantee
),
resolver_acl as (
  select a.grantee, coalesce(r.rolname, 'PUBLIC') as grantee_name, a.privilege_type
  from resolver_fn fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a
  left join pg_roles r on r.oid = a.grantee
),
fn_counts as (
  select
    count(*) filter (where proname = 'submit_special_offer_entry' and identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid, p_referral_code text, p_referral_source text') = 1 as submit_six_arg_exactly_once,
    count(*) filter (where proname = 'submit_special_offer_entry' and identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid') = 1 as submit_four_arg_exactly_once,
    count(*) filter (where proname = 'special_offer_resolve_entry_referral' and identity_args = 'p_user_id uuid, p_referral_code text, p_referral_source text') = 1 as resolver_exactly_once,
    string_agg(proname || '(' || identity_args || ')', ' | ' order by proname, identity_args) as details
  from fns
),
checks as (
  select * from (
    values
      ('attribution_table_exists', (select attribution_table_exists from table_info), 'table=' || coalesce((select oid::text from rel), 'NULL')),
      ('attribution_rls_enabled', (select attribution_rls_enabled from table_info), 'relrowsecurity check'),
      ('entry_id_column', (select entry_id_column from columns), coalesce((select details from columns), '')),
      ('offer_id_column', (select offer_id_column from columns), coalesce((select details from columns), '')),
      ('partner_id_column', (select partner_id_column from columns), coalesce((select details from columns), '')),
      ('referrer_user_id_column', (select referrer_user_id_column from columns), coalesce((select details from columns), '')),
      ('code_snapshot_column', (select code_snapshot_column from columns), coalesce((select details from columns), '')),
      ('source_column', (select source_column from columns), coalesce((select details from columns), '')),
      ('captured_at_column', (select captured_at_column from columns), coalesce((select details from columns), '')),
      ('created_at_column', (select created_at_column from columns), coalesce((select details from columns), '')),
      ('entry_primary_key', (select entry_primary_key from constraints), coalesce((select details from constraints), '')),
      ('entry_offer_fk_cascade', (select entry_offer_fk_cascade from constraints), coalesce((select details from constraints), '')),
      ('partner_fk_exists', (select partner_fk_exists from constraints), coalesce((select details from constraints), '')),
      ('referrer_profile_fk_set_null', (select referrer_profile_fk_set_null from constraints), coalesce((select details from constraints), '')),
      ('source_check_exists', (select source_check_exists from constraints), coalesce((select details from constraints), '')),
      ('no_duplicate_entry_id', (select no_duplicate_entry_id from duplicates), 'attribution_rows=' || coalesce((select attribution_rows::text from duplicates), 'NULL')),
      ('admin_select_policy_exists', (select admin_select_policy_exists from policies), coalesce((select details from policies), '')),
      ('no_public_anon_table_access', (select no_public_anon_table_access from table_grants), coalesce((select details from table_grants), '')),
      ('no_authenticated_direct_writes', (select no_authenticated_direct_writes from table_grants), coalesce((select details from table_grants), '')),
      ('authenticated_select_granted_for_admin_policy', (select authenticated_select_granted_for_admin_policy from table_grants), coalesce((select details from table_grants), '')),
      ('submit_six_arg_exactly_once', (select submit_six_arg_exactly_once from fn_counts), coalesce((select details from fn_counts), '')),
      ('submit_four_arg_exactly_once', (select submit_four_arg_exactly_once from fn_counts), coalesce((select details from fn_counts), '')),
      ('resolver_exactly_once', (select resolver_exactly_once from fn_counts), coalesce((select details from fn_counts), '')),
      ('submit_security_definer', coalesce((select prosecdef from submit_fn), false), coalesce((select owner_name || ' ' || coalesce(proconfig::text, '') from submit_fn), 'submit fn missing')),
      ('submit_owner_ok', coalesce((select owner_name = 'postgres' from submit_fn), false), coalesce((select owner_name from submit_fn), 'submit fn missing')),
      ('submit_safe_search_path', coalesce((select proconfig::text from submit_fn), '') like '%search_path=pg_catalog, public%', coalesce((select proconfig::text from submit_fn), 'submit fn missing')),
      ('submit_returns_referral_attributed', coalesce((select result_type like '%referral_attributed boolean%' from submit_fn), false), coalesce((select result_type from submit_fn), 'submit fn missing')),
      ('submit_public_execute_absent', not exists (select 1 from submit_acl where grantee = 0 and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name) from submit_acl), 'no acl rows')),
      ('submit_anon_execute_absent', not exists (select 1 from submit_acl where grantee_name = 'anon' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name) from submit_acl), 'no acl rows')),
      ('submit_authenticated_execute_present', exists (select 1 from submit_acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name) from submit_acl), 'no acl rows')),
      ('submit_service_role_execute_absent', not exists (select 1 from submit_acl where grantee_name = 'service_role' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name) from submit_acl), 'no acl rows')),
      ('resolver_security_definer', coalesce((select prosecdef from resolver_fn), false), coalesce((select owner_name || ' ' || coalesce(proconfig::text, '') from resolver_fn), 'resolver fn missing')),
      ('resolver_owner_ok', coalesce((select owner_name = 'postgres' from resolver_fn), false), coalesce((select owner_name from resolver_fn), 'resolver fn missing')),
      ('resolver_safe_search_path', coalesce((select proconfig::text from resolver_fn), '') like '%search_path=pg_catalog, public%', coalesce((select proconfig::text from resolver_fn), 'resolver fn missing')),
      ('resolver_public_execute_absent', not exists (select 1 from resolver_acl where grantee = 0 and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name) from resolver_acl), 'no acl rows')),
      ('resolver_anon_execute_absent', not exists (select 1 from resolver_acl where grantee_name = 'anon' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name) from resolver_acl), 'no acl rows')),
      ('resolver_authenticated_execute_absent', not exists (select 1 from resolver_acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name) from resolver_acl), 'no acl rows')),
      ('resolver_service_role_execute_absent', not exists (select 1 from resolver_acl where grantee_name = 'service_role' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name) from resolver_acl), 'no acl rows')),
      ('resolver_profile_for_update', coalesce((select source like '%from public.profiles p where p.id = p_user_id for update%' from resolver_fn), false), 'requires locked participant profile row'),
      ('first_touch_profile_guard', coalesce((select source like '%if v_profile.referred_by is not null%' from resolver_fn), false), 'existing referred_by wins'),
      ('missing_profile_assignment_only', coalesce((select source like '%update public.profiles p set referred_by = v_match.referrer_user_id%' from resolver_fn), false), 'assignment only when missing'),
      ('no_overwrite_existing_referral', coalesce((select source like '%and p.referred_by is null%' from resolver_fn), false), 'guards first-touch immutability'),
      ('normalize_referral_code_present', coalesce((select source like '%normalize_referral_code(p_referral_code)%' from resolver_fn), false), 'normalizes untrusted code'),
      ('referral_code_resolved_backend_side', coalesce((select source like '%resolve_referral_code(v_code)%' from resolver_fn), false), 'resolves code server-side'),
      ('referral_code_snapshot_fallback_present', coalesce((select source like '%generate_profile_referral_code%' from resolver_fn), false), 'snapshot survives future code change'),
      ('self_referral_blocked', coalesce((select source like '%v_match.referrer_user_id = p_user_id%' from resolver_fn), false), 'blocks self referral'),
      ('active_partner_required', coalesce((select source like '%p.status = ''active''%' from resolver_fn), false), 'partner status guard'),
      ('client_partner_id_not_accepted', coalesce((select source not like '%p_partner_id%' and source not like '%client_partner%' from submit_fn), false), 'submit wrapper has no partner id parameter'),
      ('existing_submit_wrapped', coalesce((select source like '%public.submit_special_offer_entry( p_offer_slug, p_lang, p_answers, p_client_submission_id )%' from submit_fn), false), 'wrapper calls four-arg submit'),
      ('no_direct_second_entry_insert', coalesce((select source not like '%insert into public.special_offer_entries%' from submit_fn), false), 'wrapper does not insert entry rows'),
      ('attribution_only_on_new_entry', coalesce((select source like '%coalesce(v_result.idempotent, false) is false%' from submit_fn), false), 'existing/idempotent entries do not get new attribution'),
      ('attribution_idempotent', coalesce((select source like '%on conflict (entry_id) do nothing%' from submit_fn), false), 'one attribution row per entry'),
      ('invalid_code_does_not_raise', coalesce((select source like '%if v_match.referrer_user_id is null%' and source like '%return%' from resolver_fn), false), 'invalid code returns no row, does not raise'),
      ('inactive_partner_not_attributed', coalesce((select source like '%v_match.partner_id%' and source like '%p.status = ''active''%' and source like '%return%' from resolver_fn), false), 'inactive/missing partner returns no row'),
      ('attribution_audit_present', coalesce((select source like '%special_offer.entry_referral_attributed%' from submit_fn), false), 'minimal audit action'),
      ('correction_does_not_touch_attribution', coalesce((select source not like '%special_offer_entry_referrals%' and source not like '%referral_code_snapshot%' and source not like '%p_referral_code%' from correction_fn), false), 'correction fn must not alter attribution'),
      ('review_does_not_touch_attribution', coalesce((select source not like '%special_offer_entry_referrals%' and source not like '%referral_code_snapshot%' and source not like '%p_referral_code%' from review_fn), false), 'review fn must not alter attribution'),
      ('hard_delete_entry_delete_present', coalesce((select source like '%delete from public.special_offer_entries%' from delete_fn), false), 'FK cascade removes attribution'),
      ('hard_delete_uses_fk_cascade_not_manual_referral_delete', coalesce((select source not like '%delete from public.special_offer_entry_referrals%' from delete_fn), false), 'no manual referral delete required'),
      ('no_commission_winner_ranking_in_submit', coalesce((select source not like '%affiliate_commission%' and source not like '%payout%' and source not like '%winner%' and source not like '%ranking%' from submit_fn), false), 'no commissions/winner/ranking side effects'),
      ('attribution_audit_no_pii_terms', coalesce((select source not like '%email%' and source not like '%phone%' and source not like '%answers_json%' and source not like '%evidence%' and source not like '%cookie%' and source not like '%token%' and source not like '%session%' from submit_fn), false), 'submit wrapper audit/source PII scan')
  ) as v(check_name, pass, details)
),
prioritized as (
  select
    check_name,
    pass,
    details,
    case when pass is false or pass is null then 0 else 1 end as sort_group
  from checks
)
select check_name, pass, details
from (
  select check_name, pass, details, sort_group
  from prioritized
  where sort_group = 0
  union all
  select check_name, pass, details, sort_group
  from prioritized
  where sort_group = 1
    and check_name in (
      'submit_six_arg_exactly_once',
      'resolver_exactly_once',
      'resolver_public_execute_absent',
      'resolver_authenticated_execute_absent',
      'existing_submit_wrapped',
      'attribution_idempotent',
      'no_commission_winner_ranking_in_submit'
    )
) diagnostics
order by sort_group, check_name;
