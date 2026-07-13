-- Special Offer entry submit ambiguity hotfix preflight.
-- Read-only. Do not run the full Special Offers migrations again.

with fn as (
  select
    p.oid,
    p.proowner::regrole::text as owner_name,
    p.prosecdef,
    coalesce(array_to_string(p.proconfig, ','), '') as proconfig_text,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as normalized_source
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
  select
    (select count(*) filter (where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid') = 1 from fn) as four_arg_exists,
    (select count(*) = 1 from target) as six_arg_exists,
    coalesce((select owner_name = 'postgres' from target), false) as owner_postgres,
    coalesce((select prosecdef from target), false) as security_definer,
    coalesce((select proconfig_text like '%search_path=pg_catalog, public%' from target), false) as safe_search_path,
    coalesce((select result_type = 'TABLE(entry_id uuid, status text, reference text, idempotent boolean, referral_attributed boolean)' from target), false) as return_type_ok,
    coalesce((select normalized_source like '%on conflict (entry_id) do nothing%' from target), false) as old_ambiguous_conflict_present,
    coalesce((select normalized_source like '%on conflict on constraint special_offer_entry_referrals_pkey do nothing%' from target), false) as already_fixed,
    coalesce((select normalized_source like '%from public.submit_special_offer_entry( p_offer_slug, p_lang, p_answers, p_client_submission_id )%' from target), false) as wrapper_calls_four_arg_submit,
    coalesce((select not public_execute from acl), true) as public_execute_absent,
    coalesce((select not anon_execute from acl), true) as anon_execute_absent,
    coalesce((select authenticated_execute from acl), false) as authenticated_execute_present,
    coalesce((select execute_grants from acl), '') as execute_grants
)
select
  four_arg_exists,
  six_arg_exists,
  owner_postgres,
  security_definer,
  safe_search_path,
  return_type_ok,
  old_ambiguous_conflict_present,
  already_fixed,
  wrapper_calls_four_arg_submit,
  public_execute_absent,
  anon_execute_absent,
  authenticated_execute_present,
  execute_grants,
  (
    four_arg_exists
    and six_arg_exists
    and owner_postgres
    and security_definer
    and safe_search_path
    and return_type_ok
    and (old_ambiguous_conflict_present or already_fixed)
    and wrapper_calls_four_arg_submit
    and public_execute_absent
    and anon_execute_absent
    and authenticated_execute_present
  ) as preflight_safe_to_continue
from checks;
