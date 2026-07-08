-- Special Offers 3C.5C-1C diagnostics.
-- Read-only inspection for public.profiles grants, column grants and policies.
-- Prepared for manual execution only. Does not expose profile row data or PII.

with profiles_relation as (
  select
    c.oid as table_oid,
    c.relacl,
    n.nspname as table_schema,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'profiles'
    and c.relkind in ('r', 'p')
),
table_grants as (
  select
    grantee::text as grantee,
    privilege_type::text as privilege_type,
    is_grantable::text as is_grantable
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'profiles'
),
column_grants as (
  select
    grantee::text as grantee,
    column_name::text as column_name,
    privilege_type::text as privilege_type,
    is_grantable::text as is_grantable
  from information_schema.role_column_grants
  where table_schema = 'public'
    and table_name = 'profiles'
),
column_acl as (
  select
    a.attname::text as column_name,
    a.attacl::text[] as attacl
  from profiles_relation p
  join pg_attribute a on a.attrelid = p.table_oid
  where a.attnum > 0
    and not a.attisdropped
),
policies as (
  select
    schemaname::text,
    tablename::text,
    policyname::text,
    permissive::text,
    roles::text[] as roles,
    cmd::text,
    qual::text,
    with_check::text
  from pg_policies
  where schemaname = 'public'
    and tablename = 'profiles'
),
profile_columns as (
  select
    column_name::text,
    data_type::text,
    is_nullable::text,
    ordinal_position
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
),
effective_checks as (
  select
    coalesce(has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), false) as authenticated_table_update_profiles,
    coalesce(has_table_privilege('authenticated', 'public.profiles', 'INSERT'), false) as authenticated_table_insert_profiles,
    coalesce(has_table_privilege('anon', 'public.profiles', 'UPDATE'), false) as anon_table_update_profiles,
    coalesce(has_table_privilege('anon', 'public.profiles', 'INSERT'), false) as anon_table_insert_profiles,
    coalesce(has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE'), false) as authenticated_effective_update_phone,
    coalesce(has_column_privilege('authenticated', 'public.profiles', 'phone', 'INSERT'), false) as authenticated_effective_insert_phone,
    coalesce(has_column_privilege('anon', 'public.profiles', 'phone', 'UPDATE'), false) as anon_effective_update_phone,
    coalesce(has_column_privilege('anon', 'public.profiles', 'phone', 'INSERT'), false) as anon_effective_insert_phone,
    exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee = 'PUBLIC'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as public_table_write_profiles,
    exists (
      select 1
      from information_schema.role_column_grants
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'phone'
        and grantee = 'PUBLIC'
        and privilege_type in ('INSERT', 'UPDATE')
    ) as public_phone_write_profiles
)
select
  to_regclass('public.profiles') is not null as profiles_table_exists,
  coalesce((select rls_enabled from profiles_relation limit 1), false) as profiles_rls_enabled,
  coalesce((select relacl from profiles_relation limit 1), array[]::aclitem[])::text[] as profiles_relacl,
  coalesce((
    select jsonb_agg(to_jsonb(t) order by t.grantee, t.privilege_type)
    from table_grants t
  ), '[]'::jsonb) as table_level_grants,
  coalesce((
    select jsonb_agg(to_jsonb(c) order by c.grantee, c.column_name, c.privilege_type)
    from column_grants c
  ), '[]'::jsonb) as column_level_grants,
  coalesce((
    select jsonb_agg(to_jsonb(a) order by a.column_name)
    from column_acl a
  ), '[]'::jsonb) as column_acl,
  coalesce((
    select jsonb_agg(to_jsonb(p) order by p.policyname)
    from policies p
  ), '[]'::jsonb) as policies,
  coalesce((
    select jsonb_agg(to_jsonb(c) order by c.ordinal_position)
    from profile_columns c
  ), '[]'::jsonb) as profile_columns,
  coalesce((
    select array_agg(column_name::text order by column_name::text)
    from column_grants
    where grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ), array[]::text[]) as authenticated_update_columns,
  e.authenticated_table_update_profiles,
  e.authenticated_table_insert_profiles,
  e.anon_table_update_profiles,
  e.anon_table_insert_profiles,
  e.public_table_write_profiles,
  e.authenticated_effective_update_phone,
  e.authenticated_effective_insert_phone,
  e.anon_effective_update_phone,
  e.anon_effective_insert_phone,
  e.public_phone_write_profiles,
  not (
    e.authenticated_table_update_profiles
    or e.authenticated_effective_update_phone
    or e.anon_table_update_profiles
    or e.anon_effective_update_phone
    or e.public_table_write_profiles
    or e.public_phone_write_profiles
  ) as direct_phone_update_blocked_for_public_roles
from effective_checks e;
