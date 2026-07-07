-- Special Offers 3C.4A entries verify draft.
-- Read-only checks for entry storage tables before submit RPC stage.

select
  'required parent tables/helpers' as check_name,
  to_regclass('public.special_offers') is not null as has_special_offers,
  to_regclass('public.special_offer_form_fields') is not null as has_form_fields,
  to_regclass('public.special_offer_form_field_translations') is not null as has_form_field_translations,
  to_regprocedure('public.special_offers_set_updated_at()') is not null as has_updated_at_helper,
  to_regprocedure('public.is_current_user_admin()') is not null as has_admin_helper;

select
  'tables exist' as check_name,
  to_regclass('public.special_offer_entries') is not null as entries_table_exists,
  to_regclass('public.special_offer_entry_answers') is not null as entry_answers_table_exists;

select
  'entry_columns_exist' as check_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'special_offer_entries'
  and c.column_name in (
    'id',
    'offer_id',
    'user_id',
    'status',
    'submitted_lang',
    'normalized_email',
    'first_name',
    'last_name',
    'phone',
    'answers_json',
    'form_snapshot_json',
    'client_submission_id',
    'reference',
    'reviewed_at',
    'reviewed_by',
    'review_note',
    'rejection_reason',
    'created_at',
    'updated_at'
  )
order by c.ordinal_position;

select
  'answer_columns_exist' as check_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'special_offer_entry_answers'
  and c.column_name in (
    'id',
    'entry_id',
    'field_id',
    'field_key',
    'value_text',
    'value_json',
    'field_snapshot_json',
    'created_at'
  )
order by c.ordinal_position;

select
  'rls enabled' as check_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('special_offer_entries', 'special_offer_entry_answers')
order by c.relname;

select
  'policies exist' as check_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('special_offer_entries', 'special_offer_entry_answers')
order by tablename, policyname;

select
  'policy command counts' as check_name,
  tablename,
  count(*) filter (where cmd = 'SELECT') as select_policy_count,
  count(*) filter (where cmd = 'UPDATE') as update_policy_count,
  count(*) filter (where cmd = 'INSERT') as insert_policy_count,
  count(*) filter (where cmd = 'DELETE') as delete_policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('special_offer_entries', 'special_offer_entry_answers')
group by tablename
order by tablename;

select
  'grants' as check_name,
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and grantee in ('authenticated', 'anon', 'service_role', 'PUBLIC')
order by table_name, grantee, privilege_type;

select
  'anon_public_writes_should_be_absent' as check_name,
  table_name,
  grantee,
  count(*) as direct_write_grant_count
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and grantee in ('anon', 'PUBLIC')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
group by table_name, grantee
order by table_name, grantee;

select
  'authenticated_insert_delete_should_be_absent' as check_name,
  table_name,
  grantee,
  privilege_type,
  count(*) as direct_write_grant_count
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
group by table_name, grantee, privilege_type
order by table_name, grantee, privilege_type;

select
  'authenticated_update_columns_should_be_review_only' as check_name,
  table_name,
  grantee,
  privilege_type,
  column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'special_offer_entries'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;

select
  'authenticated_update_columns_exact_match' as check_name,
  coalesce(array_agg(column_name::text order by column_name::text), ARRAY[]::text[]) = ARRAY[
    'rejection_reason',
    'review_note',
    'reviewed_at',
    'reviewed_by',
    'status',
    'updated_at'
  ]::text[] as ok,
  coalesce(array_agg(column_name::text order by column_name::text), ARRAY[]::text[]) as actual_columns
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'special_offer_entries'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE';

select
  'entry_answers_update_grants_should_be_absent' as check_name,
  not exists (
    select 1
    from information_schema.table_privileges tp
    where tp.table_schema = 'public'
      and tp.table_name = 'special_offer_entry_answers'
      and tp.grantee in ('anon', 'authenticated', 'PUBLIC')
      and tp.privilege_type = 'UPDATE'
  )
  and not exists (
    select 1
    from information_schema.column_privileges cp
    where cp.table_schema = 'public'
      and cp.table_name = 'special_offer_entry_answers'
      and cp.grantee in ('anon', 'authenticated', 'PUBLIC')
      and cp.privilege_type = 'UPDATE'
  ) as ok;

select
  'user_update_policy_should_be_absent' as check_name,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('special_offer_entries', 'special_offer_entry_answers')
      and cmd = 'UPDATE'
      and policyname ilike '%user%'
  ) as ok;

select
  'admin_update_policy_should_exist_for_entries_only' as check_name,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'special_offer_entries'
      and cmd = 'UPDATE'
      and policyname = 'Admins can update special offer entries'
  ) as entry_admin_update_policy_exists,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'special_offer_entry_answers'
      and cmd = 'UPDATE'
  ) as no_answer_update_policy;

select
  'indexes' as check_name,
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('special_offer_entries', 'special_offer_entry_answers')
order by tablename, indexname;

select
  'foreign keys' as check_name,
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns,
  ccu.table_schema as foreign_table_schema,
  ccu.table_name as foreign_table_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_schema = tc.constraint_schema
 and ccu.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and tc.constraint_type = 'FOREIGN KEY'
group by tc.table_name, tc.constraint_name, ccu.table_schema, ccu.table_name
order by tc.table_name, tc.constraint_name;

select
  'field_id_fk_should_set_null' as check_name,
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
  'unique constraints' as check_name,
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
where tc.table_schema = 'public'
  and tc.table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and tc.constraint_type = 'UNIQUE'
group by tc.table_name, tc.constraint_name
order by tc.table_name, tc.constraint_name;

select
  'check constraints' as check_name,
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
from information_schema.table_constraints tc
join information_schema.check_constraints cc
  on cc.constraint_schema = tc.constraint_schema
 and cc.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('special_offer_entries', 'special_offer_entry_answers')
  and tc.constraint_type = 'CHECK'
  and tc.constraint_name in (
    'special_offer_entries_status_check',
    'special_offer_entries_submitted_lang_check',
    'special_offer_entries_normalized_email_not_blank',
    'special_offer_entries_normalized_email_format',
    'special_offer_entries_phone_format',
    'special_offer_entries_answers_json_object_check',
    'special_offer_entries_form_snapshot_json_object_check',
    'special_offer_entries_reference_not_blank',
    'special_offer_entry_answers_field_key_not_blank',
    'special_offer_entry_answers_field_key_format',
    'special_offer_entry_answers_field_snapshot_json_object_check'
  )
order by tc.table_name, tc.constraint_name;

select
  'updated_at triggers' as check_name,
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'special_offer_entries'
  and trigger_name = 'trg_special_offer_entries_set_updated_at'
order by event_object_table, trigger_name;

select
  'row counts should be zero after table creation' as check_name,
  (select count(*) from public.special_offer_entries) as entry_rows,
  (select count(*) from public.special_offer_entry_answers) as answer_rows;

select
  'future workflow tables should not exist yet' as check_name,
  to_regclass('public.special_offer_tasks') is null as no_special_offer_tasks,
  to_regclass('public.special_offer_entry_tasks') is null as no_special_offer_entry_tasks,
  to_regclass('public.special_offer_draws') is null as no_special_offer_draws,
  to_regclass('public.special_offer_draw_entries') is null as no_special_offer_draw_entries,
  to_regclass('public.special_offer_winners') is null as no_special_offer_winners;
