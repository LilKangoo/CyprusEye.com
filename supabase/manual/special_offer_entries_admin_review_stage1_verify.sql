-- Special Offers 3C.5A verify only.
-- Read-only checks for review_special_offer_entry RPC.
-- Do not execute the RPC from this verify script.

with required as (
  select *
  from (values
    ('public.special_offer_entries'),
    ('public.special_offer_entry_answers'),
    ('public.special_offer_audit_log')
  ) as items(regclass_name)
)
select
  'required_tables_exist' as check_name,
  bool_and(to_regclass(regclass_name) is not null) as pass,
  jsonb_object_agg(regclass_name, to_regclass(regclass_name) is not null order by regclass_name) as details
from required;

select
  'admin_helper_exists' as check_name,
  to_regprocedure('public.is_current_user_admin()') is not null as pass;

select
  'rpc_metadata' as check_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') as settings,
  owner_role.rolname as owner_role,
  l.lanname as language
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles owner_role on owner_role.oid = p.proowner
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname = 'review_special_offer_entry'
  and pg_get_function_identity_arguments(p.oid) = 'p_entry_id uuid, p_new_status text, p_review_note text, p_rejection_reason text';

with rpc as (
  select p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'review_special_offer_entry'
    and pg_get_function_identity_arguments(p.oid) = 'p_entry_id uuid, p_new_status text, p_review_note text, p_rejection_reason text'
)
select
  'rpc_execute_grants' as check_name,
  r.rolname as role_name,
  coalesce((select has_function_privilege(r.rolname, rpc.oid, 'EXECUTE') from rpc), false) as has_execute
from pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role')
order by r.rolname;

select
  'direct_update_grants' as check_name,
  'table_privileges' as source,
  table_name,
  grantee,
  privilege_type,
  null::text as column_name
from information_schema.table_privileges
where table_schema = 'public'
  and table_name = 'special_offer_entries'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege_type = 'UPDATE'
union all
select
  'direct_update_grants' as check_name,
  'column_privileges' as source,
  table_name,
  grantee,
  privilege_type,
  column_name::text
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'special_offer_entries'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege_type = 'UPDATE'
order by source, grantee, column_name;

select
  'rls_state' as check_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('special_offer_entries', 'special_offer_entry_answers', 'special_offer_audit_log')
order by c.relname;

select
  'status_constraint' as check_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition,
  coalesce(array_agg(m.match[1] order by m.match[1]), ARRAY[]::text[]) as allowed_statuses,
  coalesce(array_agg(m.match[1] order by m.match[1]), ARRAY[]::text[]) = ARRAY[
    'approved',
    'disqualified',
    'pending_review',
    'rejected',
    'submitted',
    'withdrawn'
  ]::text[] as exact_status_set
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
left join lateral regexp_matches(pg_get_constraintdef(con.oid), '''([^'']+)''', 'g') as m(match) on true
where ns.nspname = 'public'
  and rel.relname = 'special_offer_entries'
  and con.conname = 'special_offer_entries_status_check'
group by con.oid, con.conname;

select
  'answer_table_fk_delete_behavior' as check_name,
  con.conname as constraint_name,
  con.confdeltype = 'n' as on_delete_set_null,
  con.confdeltype as raw_confdeltype
from pg_constraint con
join pg_class child on child.oid = con.conrelid
join pg_namespace child_ns on child_ns.oid = child.relnamespace
join pg_class parent on parent.oid = con.confrelid
join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
where con.contype = 'f'
  and child_ns.nspname = 'public'
  and child.relname = 'special_offer_entry_answers'
  and parent_ns.nspname = 'public'
  and parent.relname = 'special_offer_form_fields'
  and exists (
    select 1
    from pg_attribute a
    where a.attrelid = child.oid
      and a.attname = 'field_id'
      and a.attnum = any(con.conkey)
  );

select
  'future_workflow_tables_absent' as check_name,
  table_name,
  to_regclass('public.' || table_name) is null as absent
from (
  values
    ('special_offer_tasks'),
    ('special_offer_entry_tasks'),
    ('special_offer_draws'),
    ('special_offer_draw_entries'),
    ('special_offer_winners')
) as future(table_name)
order by table_name;

with rpc_source as (
  select
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as normalized_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'review_special_offer_entry'
    and pg_get_function_identity_arguments(p.oid) = 'p_entry_id uuid, p_new_status text, p_review_note text, p_rejection_reason text'
),
positions as (
  select
    normalized_source,
    position('if v_entry.status = v_new_status then' in normalized_source) as idempotent_pos,
    position('if v_review_note is not null and char_length(v_review_note) > 2000 then' in normalized_source) as review_note_length_pos,
    position('if v_rejection_reason is not null and char_length(v_rejection_reason) > 1000 then' in normalized_source) as rejection_reason_length_pos,
    position('if v_new_status in (''rejected'', ''disqualified'') and v_rejection_reason is null then' in normalized_source) as reason_required_pos
  from rpc_source
),
checks as (
  select
    coalesce(normalized_source like '%v_review_note text := nullif(%'
      and normalized_source like '%btrim(coalesce(p_review_note,%', false) as review_note_normalization_present,
    coalesce(normalized_source like '%v_rejection_reason text := nullif(%'
      and normalized_source like '%btrim(coalesce(p_rejection_reason,%', false) as rejection_reason_normalization_present,
    coalesce(normalized_source like '%rejection_reason_required%', false) as rejection_reason_required_present,
    coalesce(idempotent_pos > 0, false) as idempotent_branch_present,
    coalesce(review_note_length_pos > 0, false) as review_note_length_check_present,
    coalesce(rejection_reason_length_pos > 0, false) as rejection_reason_length_check_present,
    coalesce(reason_required_pos > 0, false) as reason_required_check_present,
    coalesce(idempotent_pos > 0 and review_note_length_pos > 0 and idempotent_pos < review_note_length_pos, false) as idempotent_before_note_length,
    coalesce(idempotent_pos > 0 and rejection_reason_length_pos > 0 and idempotent_pos < rejection_reason_length_pos, false) as idempotent_before_reason_length,
    coalesce(idempotent_pos > 0 and reason_required_pos > 0 and idempotent_pos < reason_required_pos, false) as idempotent_before_reason_required
  from (select 1) anchor
  left join positions on true
)
select
  'rpc_static_review_flow_diagnostics' as check_name,
  review_note_normalization_present,
  rejection_reason_normalization_present,
  rejection_reason_required_present,
  idempotent_branch_present,
  review_note_length_check_present,
  rejection_reason_length_check_present,
  reason_required_check_present,
  idempotent_before_note_length,
  idempotent_before_reason_length,
  idempotent_before_reason_required
from checks;

with rpc as (
  select
    p.oid,
    p.prosecdef,
    coalesce(array_to_string(p.proconfig, ','), '') as settings,
    owner_role.rolname as owner_role,
    pg_get_functiondef(p.oid) as fn,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as normalized_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles owner_role on owner_role.oid = p.proowner
  where n.nspname = 'public'
    and p.proname = 'review_special_offer_entry'
    and pg_get_function_identity_arguments(p.oid) = 'p_entry_id uuid, p_new_status text, p_review_note text, p_rejection_reason text'
),
checks as (
  select
    exists (select 1 from rpc) as rpc_exists,
    coalesce((select prosecdef from rpc), false) as rpc_security_definer,
    coalesce((select settings like '%search_path=pg_catalog, public%' from rpc), false) as rpc_safe_search_path,
    coalesce((select owner_role = 'postgres' from rpc), false) as rpc_owner_ok,
    not exists (
      select 1
      from information_schema.routine_privileges rp
      where rp.specific_schema = 'public'
        and rp.routine_name = 'review_special_offer_entry'
        and rp.grantee = 'PUBLIC'
        and rp.privilege_type = 'EXECUTE'
    ) as public_execute_absent,
    not coalesce((select has_function_privilege('anon', oid, 'EXECUTE') from rpc), false) as anon_execute_absent,
    coalesce((select has_function_privilege('authenticated', oid, 'EXECUTE') from rpc), false) as authenticated_execute_present,
    not coalesce((select has_function_privilege('service_role', oid, 'EXECUTE') from rpc), false) as service_role_execute_expected,
    not exists (
      select 1
      from information_schema.table_privileges tp
      where tp.table_schema = 'public'
        and tp.table_name = 'special_offer_entries'
        and tp.grantee in ('PUBLIC', 'anon', 'authenticated')
        and tp.privilege_type = 'UPDATE'
    )
    and not exists (
      select 1
      from information_schema.column_privileges cp
      where cp.table_schema = 'public'
        and cp.table_name = 'special_offer_entries'
        and cp.grantee in ('PUBLIC', 'anon', 'authenticated')
        and cp.privilege_type = 'UPDATE'
    ) as authenticated_direct_update_absent,
    coalesce((
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'special_offer_entries'
    ), false) as entries_rls_enabled,
    coalesce((
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'special_offer_entry_answers'
    ), false) as answers_rls_enabled,
    coalesce((
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'special_offer_audit_log'
    ), false) as audit_log_rls_state_expected,
    coalesce((
      select array_agg(m.match[1] order by m.match[1]) = ARRAY[
        'approved',
        'disqualified',
        'pending_review',
        'rejected',
        'submitted',
        'withdrawn'
      ]::text[]
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      left join lateral regexp_matches(pg_get_constraintdef(con.oid), '''([^'']+)''', 'g') as m(match) on true
      where ns.nspname = 'public'
        and rel.relname = 'special_offer_entries'
        and con.conname = 'special_offer_entries_status_check'
      group by con.oid
    ), false) as status_constraint_unchanged,
    exists (
      select 1
      from pg_constraint con
      join pg_class child on child.oid = con.conrelid
      join pg_namespace child_ns on child_ns.oid = child.relnamespace
      join pg_class parent on parent.oid = con.confrelid
      join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
      where con.contype = 'f'
        and child_ns.nspname = 'public'
        and child.relname = 'special_offer_entry_answers'
        and parent_ns.nspname = 'public'
        and parent.relname = 'special_offer_form_fields'
        and con.confdeltype = 'n'
        and exists (
          select 1
          from pg_attribute a
          where a.attrelid = child.oid
            and a.attname = 'field_id'
            and a.attnum = any(con.conkey)
        )
    )
    and not exists (
      select 1
      from information_schema.table_privileges tp
      where tp.table_schema = 'public'
        and tp.table_name = 'special_offer_entry_answers'
        and tp.grantee in ('PUBLIC', 'anon', 'authenticated')
        and tp.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    )
    and not exists (
      select 1
      from information_schema.column_privileges cp
      where cp.table_schema = 'public'
        and cp.table_name = 'special_offer_entry_answers'
        and cp.grantee in ('PUBLIC', 'anon', 'authenticated')
        and cp.privilege_type in ('INSERT', 'UPDATE')
    ) as answers_table_unchanged,
    coalesce((
      select fn like '%auth.uid()%'
        and fn like '%public.is_current_user_admin()%'
        and fn ilike '%for update%'
        and fn like '%invalid_status_transition%'
        and fn like '%insert into public.special_offer_audit_log%'
        and fn not ilike '%update public.special_offer_entry_answers%'
        and fn not ilike '%delete from public.special_offer_entry_answers%'
        and fn not ilike '%insert into public.special_offer_entry_answers%'
        and fn not ilike '%answers_json =%'
        and fn not ilike '%form_snapshot_json =%'
        and fn not ilike '%normalized_email =%'
        and fn not ilike '%user_id =%'
        and fn not ilike '%client_submission_id =%'
      from rpc
    ), false) as no_entries_modified,
    coalesce((
      select normalized_source like '%v_review_note text := nullif(%'
        and normalized_source like '%btrim(coalesce(p_review_note,%'
        and normalized_source like '%v_rejection_reason text := nullif(%'
        and normalized_source like '%btrim(coalesce(p_rejection_reason,%'
        and normalized_source like '%rejection_reason_required%'
        and position('if v_entry.status = v_new_status then' in normalized_source) > 0
        and position('if v_review_note is not null and char_length(v_review_note) > 2000 then' in normalized_source) > 0
        and position('if v_rejection_reason is not null and char_length(v_rejection_reason) > 1000 then' in normalized_source) > 0
        and position('if v_new_status in (''rejected'', ''disqualified'') and v_rejection_reason is null then' in normalized_source) > 0
        and position('if v_entry.status = v_new_status then' in normalized_source)
          < position('if v_review_note is not null and char_length(v_review_note) > 2000 then' in normalized_source)
        and position('if v_entry.status = v_new_status then' in normalized_source)
          < position('if v_rejection_reason is not null and char_length(v_rejection_reason) > 1000 then' in normalized_source)
        and position('if v_entry.status = v_new_status then' in normalized_source)
          < position('if v_new_status in (''rejected'', ''disqualified'') and v_rejection_reason is null then' in normalized_source)
      from rpc
    ), false) as rpc_static_review_flow_ok,
    not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'review_special_offer_entry'
        and pg_get_functiondef(p.oid) ilike '%special_offer_entry_answers%'
        and (
          pg_get_functiondef(p.oid) ilike '%update public.special_offer_entry_answers%'
          or pg_get_functiondef(p.oid) ilike '%delete from public.special_offer_entry_answers%'
          or pg_get_functiondef(p.oid) ilike '%insert into public.special_offer_entry_answers%'
        )
    ) as no_answers_modified,
    to_regclass('public.special_offer_tasks') is null
      and to_regclass('public.special_offer_entry_tasks') is null
      and to_regclass('public.special_offer_draws') is null
      and to_regclass('public.special_offer_draw_entries') is null
      and to_regclass('public.special_offer_winners') is null as no_tasks_draws_winners,
    to_regclass('public.special_offer_entries') is not null
      and to_regclass('public.special_offer_entry_answers') is not null
      and to_regclass('public.special_offer_audit_log') is not null as required_tables_exist,
    to_regprocedure('public.is_current_user_admin()') is not null as admin_helper_exists
)
select
  required_tables_exist,
  admin_helper_exists,
  rpc_exists,
  rpc_security_definer,
  rpc_safe_search_path,
  rpc_owner_ok,
  public_execute_absent,
  anon_execute_absent,
  authenticated_execute_present,
  service_role_execute_expected,
  authenticated_direct_update_absent,
  entries_rls_enabled,
  answers_rls_enabled,
  audit_log_rls_state_expected,
  status_constraint_unchanged,
  answers_table_unchanged,
  rpc_static_review_flow_ok,
  no_entries_modified,
  no_answers_modified,
  no_tasks_draws_winners,
  (
    required_tables_exist
    and admin_helper_exists
    and rpc_exists
    and rpc_security_definer
    and rpc_safe_search_path
    and rpc_owner_ok
    and public_execute_absent
    and anon_execute_absent
    and authenticated_execute_present
    and service_role_execute_expected
    and authenticated_direct_update_absent
    and entries_rls_enabled
    and answers_rls_enabled
    and audit_log_rls_state_expected
    and status_constraint_unchanged
    and answers_table_unchanged
    and rpc_static_review_flow_ok
    and no_entries_modified
    and no_answers_modified
    and no_tasks_draws_winners
  ) as all_checks_pass
from checks;
