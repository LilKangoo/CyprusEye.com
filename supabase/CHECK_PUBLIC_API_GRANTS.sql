-- Read-only audit for Supabase Data API exposure on public schema objects.
-- Purpose:
--   Detect public tables/views/materialized views that have no explicit grant
--   for anon, authenticated, or service_role.
--
-- Safe to run in Supabase SQL Editor. This query does not modify anything.

with grants_audit as (
  select
    n.nspname as schema_name,
    c.relname as object_name,
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned_table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      else c.relkind::text
    end as object_type,
    c.relrowsecurity as rls_enabled,
    bool_or(g.grantee = 'anon') as has_anon_grant,
    bool_or(g.grantee = 'authenticated') as has_authenticated_grant,
    bool_or(g.grantee = 'service_role') as has_service_role_grant,
    coalesce(
      string_agg(
        distinct g.grantee || ':' || g.privilege_type,
        ', '
        order by g.grantee || ':' || g.privilege_type
      ),
      ''
    ) as api_role_grants
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join information_schema.role_table_grants g
    on g.table_schema = n.nspname
   and g.table_name = c.relname
   and g.grantee in ('anon', 'authenticated', 'service_role')
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
  group by n.nspname, c.relname, c.relkind, c.relrowsecurity
)
select *
from grants_audit
where not coalesce(has_anon_grant, false)
  and not coalesce(has_authenticated_grant, false)
  and not coalesce(has_service_role_grant, false)
order by object_name;

