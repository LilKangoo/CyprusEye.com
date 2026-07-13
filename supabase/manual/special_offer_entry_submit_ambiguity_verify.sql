-- Special Offer entry submit ambiguity hotfix verify.
-- Read-only. Returns a vertical table: check_name, pass, details.

with fn as (
  select
    p.oid,
    p.proowner::regrole::text as owner_name,
    p.prosecdef,
    coalesce(array_to_string(p.proconfig, ','), '') as proconfig_text,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as normalized_source,
    pg_get_functiondef(p.oid) as function_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_special_offer_entry'
),
target as (
  select *
  from fn
  where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid, p_referral_code text, p_referral_source text'
),
acl as (
  select
    coalesce(string_agg(coalesce(r.rolname, 'PUBLIC') || ':' || e.privilege_type, ', ' order by coalesce(r.rolname, 'PUBLIC'), e.privilege_type), '') as execute_grants,
    bool_or(e.grantee = 0 and e.privilege_type = 'EXECUTE') as public_execute,
    bool_or(r.rolname = 'anon' and e.privilege_type = 'EXECUTE') as anon_execute,
    bool_or(r.rolname = 'authenticated' and e.privilege_type = 'EXECUTE') as authenticated_execute,
    bool_or(r.rolname = 'service_role' and e.privilege_type = 'EXECUTE') as service_role_execute
  from target
  cross join aclexplode(coalesce((select p.proacl from pg_proc p where p.oid = target.oid), acldefault('f', (select p.proowner from pg_proc p where p.oid = target.oid)))) e
  left join pg_roles r on r.oid = e.grantee
  where e.privilege_type = 'EXECUTE'
),
checks as (
  select * from (values
    ('exact_rpc_signature', (select count(*) = 1 from target), 'public.submit_special_offer_entry(text,text,jsonb,uuid,text,text)'),
    ('four_arg_base_rpc_exists', (select count(*) filter (where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid') = 1 from fn), 'base submit RPC remains present'),
    ('return_type_preserved', coalesce((select result_type = 'TABLE(entry_id uuid, status text, reference text, idempotent boolean, referral_attributed boolean)' from target), false), coalesce((select result_type from target), '<missing>')),
    ('owner_postgres', coalesce((select owner_name = 'postgres' from target), false), coalesce((select owner_name from target), '<missing>')),
    ('security_definer', coalesce((select prosecdef from target), false), 'submit wrapper must remain SECURITY DEFINER'),
    ('safe_search_path', coalesce((select proconfig_text like '%search_path=pg_catalog, public%' from target), false), coalesce((select proconfig_text from target), '<missing>')),
    ('public_execute_absent', coalesce((select not public_execute from acl), true), coalesce((select execute_grants from acl), '<none>')),
    ('anon_execute_absent', coalesce((select not anon_execute from acl), true), coalesce((select execute_grants from acl), '<none>')),
    ('authenticated_execute_present', coalesce((select authenticated_execute from acl), false), coalesce((select execute_grants from acl), '<none>')),
    ('auth_uid_guard_present', coalesce((select normalized_source like '%v_uid uuid := auth.uid()%' and normalized_source like '%if v_uid is null then raise exception ''login_required''%' from target), false), 'auth.uid() guard remains present'),
    ('confirmed_email_guard_preserved_in_base_submit', coalesce((select normalized_source like '%email_not_confirmed%' from fn where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'), false), 'four-arg base submit still enforces confirmed email'),
    ('one_entry_guard_preserved_in_base_submit', coalesce((select normalized_source like '%duplicate_entry%' and normalized_source like '%max_entries_reached%' from fn where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'), false), 'base submit keeps one-entry/max-entry guards'),
    ('campaign_guard_preserved_in_base_submit', coalesce((select normalized_source like '%campaign_not_available%' and normalized_source like '%campaign_closed%' and normalized_source like '%campaign_not_open%' from fn where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'), false), 'base submit keeps campaign guards'),
    ('wrapper_calls_base_submit', coalesce((select normalized_source like '%from public.submit_special_offer_entry( p_offer_slug, p_lang, p_answers, p_client_submission_id )%' from target), false), 'wrapper delegates entry creation to existing base submit'),
    ('old_on_conflict_entry_id_removed', coalesce((select normalized_source not like '%on conflict (entry_id) do nothing%' from target), false), 'old ambiguous ON CONFLICT column pattern must be absent'),
    ('constraint_conflict_target_used', coalesce((select normalized_source like '%on conflict on constraint special_offer_entry_referrals_pkey do nothing%' from target), false), 'ON CONFLICT must target named PK constraint'),
    ('local_return_entry_variable_used', coalesce((select normalized_source like '%v_return_entry_id uuid%' and normalized_source like '%v_return_entry_id := v_result.entry_id%' from target), false), 'return entry id stored in explicitly named local variable'),
    ('entry_referral_lookup_qualified', coalesce((select normalized_source like '%from public.special_offer_entry_referrals r where r.entry_id = v_return_entry_id%' from target), false), 'referral lookup uses qualified r.entry_id'),
    ('entry_select_qualified', coalesce((select normalized_source like '%from public.special_offer_entries e where e.id = v_return_entry_id and e.user_id = v_uid%' from target), false), 'entry lookup uses qualified e.id/e.user_id'),
    ('no_points_activity_or_winner_changes', coalesce((select normalized_source not like '%points_awarded%' and normalized_source not like '%special_offer_entry_activities%' and normalized_source not like '%special_offer_winner%' from target), false), 'wrapper does not alter points, activities or winner workflow')
  ) as v(check_name, pass, details)
),
overall as (
  select 'overall_pass' as check_name, bool_and(pass) as pass, 'all visible checks must pass' as details
  from checks
)
select check_name, pass, details
from (
  select check_name, pass, details, 0 as sort_group from checks
  union all
  select check_name, pass, details, 1 as sort_group from overall
) rows
order by sort_group, case when pass is false or pass is null then 0 else 1 end, check_name;
