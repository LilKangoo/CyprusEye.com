-- Special Offers 3C.5C-6I verify - read only.
-- Verifies one-entry-per-user backend hardening.
-- Do not execute participant submit RPC from this file.

with fn as (
  select
    p.oid,
    p.prosecdef,
    coalesce(array_to_string(p.proconfig, ','), '') as proconfig,
    pg_get_userbyid(p.proowner) as owner_name,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as normalized_source
  from pg_proc p
  where p.oid = to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)')
),
entry_indexes as (
  select
    exists (
      select 1
      from pg_class idx
      join pg_namespace ns on ns.oid = idx.relnamespace
      join pg_index i on i.indexrelid = idx.oid
      join pg_class tbl on tbl.oid = i.indrelid
      where ns.nspname = 'public'
        and tbl.relname = 'special_offer_entries'
        and idx.relname = 'idx_special_offer_entries_offer_user_unique'
        and i.indisunique
        and pg_get_indexdef(i.indexrelid) ilike '%offer_id%'
        and pg_get_indexdef(i.indexrelid) ilike '%user_id%'
        and pg_get_expr(i.indpred, i.indrelid) ilike '%user_id is not null%'
    ) as offer_user_unique_index_exists,
    exists (
      select 1
      from pg_class idx
      join pg_namespace ns on ns.oid = idx.relnamespace
      join pg_index i on i.indexrelid = idx.oid
      join pg_class tbl on tbl.oid = i.indrelid
      where ns.nspname = 'public'
        and tbl.relname = 'special_offer_entries'
        and i.indisunique
        and pg_get_indexdef(i.indexrelid) ilike '%offer_id%'
        and pg_get_indexdef(i.indexrelid) ilike '%client_submission_id%'
    ) as offer_client_submission_unique_exists
),
duplicates as (
  select
    not exists (
      select 1
      from public.special_offer_entries e
      where e.user_id is not null
      group by e.offer_id, e.user_id
      having count(*) > 1
    ) as no_duplicate_offer_user_pairs
),
grants as (
  select
    not has_function_privilege('public', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as public_execute_absent,
    not has_function_privilege('anon', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as anon_execute_absent,
    has_function_privilege('authenticated', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as authenticated_execute_present,
    has_function_privilege('service_role', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE') as service_role_execute_present
),
table_writes as (
  select
    not exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'public'
        and table_name in ('special_offer_entries', 'special_offer_entry_answers')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as no_direct_entry_answer_write_grants
),
rls as (
  select
    coalesce((select relrowsecurity from pg_class where oid = 'public.special_offer_entries'::regclass), false) as entries_rls_enabled,
    coalesce((select relrowsecurity from pg_class where oid = 'public.special_offer_entry_answers'::regclass), false) as answers_rls_enabled
),
source_checks as (
  select
    coalesce(normalized_source like '%auth.uid()%', false) as auth_uid_required,
    coalesce(normalized_source like '%email_confirmed_at%' and normalized_source like '%email_not_confirmed%', false) as confirmed_email_required,
    coalesce(normalized_source like '%v_existing.user_id = v_uid%', false) as client_submission_id_ownership_check,
    coalesce(normalized_source like '%where e.offer_id = v_offer.id and e.user_id = v_uid order by e.created_at asc, e.id asc limit 1%', false) as existing_own_entry_lookup_present,
    coalesce(normalized_source like '%idempotent := true%', false) as existing_entry_idempotent_return_present,
    coalesce(normalized_source not like '%e.status <> ''withdrawn''%', false) as withdrawn_not_excluded_from_duplicate_check,
    coalesce(normalized_source like '%when unique_violation then%', false) as unique_violation_handled,
    coalesce(normalized_source like '%admin_entries_blocked%', false) as admin_entries_blocked_preserved,
    coalesce(normalized_source like '%partner_entries_blocked%', false) as partner_entries_blocked_preserved,
    coalesce(normalized_source like '%insert into public.special_offer_entry_answers%', false) as answer_insert_still_present,
    coalesce(normalized_source not like '%update public.special_offer_entries%', false) as no_entry_update_in_submit
  from fn
),
forbidden_objects as (
  select
    to_regclass('public.special_offer_tasks') is null as no_tasks,
    to_regclass('public.special_offer_draws') is null as no_draws,
    to_regclass('public.special_offer_winners') is null as no_winners
)
select
  (select count(*) from fn) = 1 as rpc_exists,
  coalesce((select prosecdef from fn), false) as rpc_security_definer,
  coalesce((select proconfig from fn), '') like '%search_path=pg_catalog, public%' as rpc_safe_search_path,
  coalesce((select owner_name from fn), '') = 'postgres' as rpc_owner_ok,
  ix.offer_user_unique_index_exists,
  ix.offer_client_submission_unique_exists,
  d.no_duplicate_offer_user_pairs,
  g.public_execute_absent,
  g.anon_execute_absent,
  g.authenticated_execute_present,
  g.service_role_execute_present,
  tw.no_direct_entry_answer_write_grants,
  r.entries_rls_enabled,
  r.answers_rls_enabled,
  sc.auth_uid_required,
  sc.confirmed_email_required,
  sc.client_submission_id_ownership_check,
  sc.existing_own_entry_lookup_present,
  sc.existing_entry_idempotent_return_present,
  sc.withdrawn_not_excluded_from_duplicate_check,
  sc.unique_violation_handled,
  sc.admin_entries_blocked_preserved,
  sc.partner_entries_blocked_preserved,
  sc.answer_insert_still_present,
  sc.no_entry_update_in_submit,
  fo.no_tasks,
  fo.no_draws,
  fo.no_winners,
  (
    (select count(*) from fn) = 1
    and coalesce((select prosecdef from fn), false)
    and coalesce((select proconfig from fn), '') like '%search_path=pg_catalog, public%'
    and coalesce((select owner_name from fn), '') = 'postgres'
    and ix.offer_user_unique_index_exists
    and ix.offer_client_submission_unique_exists
    and d.no_duplicate_offer_user_pairs
    and g.public_execute_absent
    and g.anon_execute_absent
    and g.authenticated_execute_present
    and g.service_role_execute_present
    and tw.no_direct_entry_answer_write_grants
    and r.entries_rls_enabled
    and r.answers_rls_enabled
    and sc.auth_uid_required
    and sc.confirmed_email_required
    and sc.client_submission_id_ownership_check
    and sc.existing_own_entry_lookup_present
    and sc.existing_entry_idempotent_return_present
    and sc.withdrawn_not_excluded_from_duplicate_check
    and sc.unique_violation_handled
    and sc.admin_entries_blocked_preserved
    and sc.partner_entries_blocked_preserved
    and sc.answer_insert_still_present
    and sc.no_entry_update_in_submit
    and fo.no_tasks
    and fo.no_draws
    and fo.no_winners
  ) as overall_pass
from entry_indexes ix
cross join duplicates d
cross join grants g
cross join table_writes tw
cross join rls r
cross join source_checks sc
cross join forbidden_objects fo;
