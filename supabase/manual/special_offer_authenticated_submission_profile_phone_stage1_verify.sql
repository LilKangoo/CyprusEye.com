-- Special Offers 3C.5C-1C corrective verify.
-- Read-only checks for public.profiles.phone support and effective write grants.

with column_checks as (
  select
    to_regclass('public.profiles') is not null as profiles_table_exists,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'phone'
    ) as phone_column_exists,
    coalesce((
      select data_type::text = 'text'
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'phone'
      limit 1
    ), false) as phone_column_is_text,
    coalesce((
      select is_nullable = 'YES'
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'phone'
      limit 1
    ), false) as phone_column_is_nullable,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'updated_at'
    ) as profile_updated_at_exists
),
constraint_checks as (
  select
    exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'profiles'
        and con.conname = 'profiles_phone_safe_check'
        and con.contype = 'c'
    ) as phone_constraint_exists,
    coalesce((
      select con.convalidated
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'profiles'
        and con.conname = 'profiles_phone_safe_check'
        and con.contype = 'c'
      limit 1
    ), false) as phone_constraint_validated
),
grant_checks as (
  select
    not coalesce(has_table_privilege('authenticated', 'public.profiles', 'INSERT'), false) as authenticated_table_insert_absent,
    not coalesce(has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), false) as authenticated_table_update_absent,
    not coalesce(has_table_privilege('authenticated', 'public.profiles', 'DELETE'), false) as authenticated_table_delete_absent,
    not coalesce(has_table_privilege('anon', 'public.profiles', 'INSERT'), false) as anon_table_insert_absent,
    not coalesce(has_table_privilege('anon', 'public.profiles', 'UPDATE'), false) as anon_table_update_absent,
    not coalesce(has_table_privilege('anon', 'public.profiles', 'DELETE'), false) as anon_table_delete_absent,
    not exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
        and grantee = 'PUBLIC'
    ) as public_table_write_absent,
    not coalesce(has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE'), false) as authenticated_phone_update_absent,
    not coalesce(has_column_privilege('authenticated', 'public.profiles', 'phone', 'INSERT'), false) as authenticated_phone_insert_absent,
    not coalesce(has_column_privilege('anon', 'public.profiles', 'phone', 'UPDATE'), false) as anon_phone_update_absent,
    not coalesce(has_column_privilege('anon', 'public.profiles', 'phone', 'INSERT'), false) as anon_phone_insert_absent,
    not exists (
      select 1
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'phone'
        and privilege_type in ('INSERT', 'UPDATE')
        and grantee = 'PUBLIC'
    ) as public_phone_write_absent,
    (
      select coalesce(
        array_agg(column_name::text order by column_name::text),
        array[]::text[]
      )
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee = 'authenticated'
        and privilege_type = 'UPDATE'
    ) as authenticated_update_columns
),
profile_ui_grant_checks as (
  select
    not exists (
      select 1
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee = 'authenticated'
        and privilege_type = 'UPDATE'
        and column_name in ('phone', 'email', 'is_admin', 'is_banned', 'banned_until', 'total_xp')
    ) as sensitive_update_columns_absent,
    not exists (
      select 1
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee = 'authenticated'
        and privilege_type = 'INSERT'
        and column_name = 'phone'
    ) as phone_insert_column_absent,
    exists (
      select 1
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee = 'authenticated'
        and privilege_type = 'UPDATE'
        and column_name = 'name'
    ) as profile_name_update_still_available,
    not exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
        and grantee in ('PUBLIC', 'anon')
    ) as anon_public_table_writes_absent
),
submit_rpc_checks as (
  select
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'submit_special_offer_entry'
        and pg_get_function_identity_arguments(p.oid) = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'
        and p.prosecdef
        and lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) like '%update public.profiles%'
        and lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) like '%set phone = $1%'
        and lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) like '%where id = $2%'
        and lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) like '%using v_phone, v_uid%'
        and lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) like '%nullif(btrim(coalesce(phone,%'
    ) as submit_rpc_phone_enrichment_present
),
data_safety_checks as (
  select
    (select count(*) from public.special_offer_entries) >= 0 as entries_untouched_readable,
    (select count(*) from public.special_offer_entry_answers) >= 0 as answers_untouched_readable,
    not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'special_offer_tasks',
          'special_offer_entry_tasks',
          'special_offer_draws',
          'special_offer_draw_entries',
          'special_offer_winners'
        )
    ) as no_tasks_draws_winners
)
select
  c.profiles_table_exists,
  c.phone_column_exists,
  c.phone_column_is_text,
  c.phone_column_is_nullable,
  c.profile_updated_at_exists,
  k.phone_constraint_exists,
  k.phone_constraint_validated,
  (
    g.authenticated_table_insert_absent
    and g.authenticated_table_update_absent
    and g.authenticated_table_delete_absent
    and g.anon_table_insert_absent
    and g.anon_table_update_absent
    and g.anon_table_delete_absent
    and g.public_table_write_absent
  ) as no_profile_table_write_grants,
  (
    g.authenticated_phone_update_absent
    and g.authenticated_phone_insert_absent
    and g.anon_phone_update_absent
    and g.anon_phone_insert_absent
    and g.public_phone_write_absent
  ) as no_phone_column_write_grants,
  g.authenticated_table_insert_absent,
  g.authenticated_table_update_absent,
  g.authenticated_table_delete_absent,
  g.anon_table_insert_absent,
  g.anon_table_update_absent,
  g.anon_table_delete_absent,
  g.public_table_write_absent,
  g.authenticated_phone_update_absent,
  g.authenticated_phone_insert_absent,
  g.anon_phone_update_absent,
  g.anon_phone_insert_absent,
  g.public_phone_write_absent,
  g.authenticated_update_columns,
  u.sensitive_update_columns_absent,
  u.phone_insert_column_absent,
  u.profile_name_update_still_available,
  u.anon_public_table_writes_absent,
  r.submit_rpc_phone_enrichment_present,
  d.entries_untouched_readable,
  d.answers_untouched_readable,
  d.no_tasks_draws_winners,
  (
    c.profiles_table_exists
    and c.phone_column_exists
    and c.phone_column_is_text
    and c.phone_column_is_nullable
    and c.profile_updated_at_exists
    and k.phone_constraint_exists
    and k.phone_constraint_validated
    and g.authenticated_table_insert_absent
    and g.authenticated_table_update_absent
    and g.authenticated_table_delete_absent
    and g.anon_table_insert_absent
    and g.anon_table_update_absent
    and g.anon_table_delete_absent
    and g.public_table_write_absent
    and g.authenticated_phone_update_absent
    and g.authenticated_phone_insert_absent
    and g.anon_phone_update_absent
    and g.anon_phone_insert_absent
    and g.public_phone_write_absent
    and u.sensitive_update_columns_absent
    and u.phone_insert_column_absent
    and u.profile_name_update_still_available
    and u.anon_public_table_writes_absent
    and r.submit_rpc_phone_enrichment_present
    and d.entries_untouched_readable
    and d.answers_untouched_readable
    and d.no_tasks_draws_winners
  ) as overall_pass
from column_checks c
cross join constraint_checks k
cross join grant_checks g
cross join profile_ui_grant_checks u
cross join submit_rpc_checks r
cross join data_safety_checks d;
