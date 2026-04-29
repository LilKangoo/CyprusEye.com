-- Manual/support-only SQL for moving PostGIS out of public.
--
-- Do not place this file in supabase/migrations as-is. Supabase CLI migrations
-- in this project do not have permission to update pg_extension:
--   permission denied for table pg_extension
--
-- Run this through Supabase Support or another Supabase-approved privileged
-- path. It is written as one transaction with validation.

begin;

select e.extname, n.nspname as schema_name, e.extversion, e.extrelocatable
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'postgis';

update pg_extension
   set extrelocatable = true
 where extname = 'postgis';

alter extension postgis set schema extensions;

-- Current production version checked on 2026-04-28:
-- POSTGIS="3.3.7 a0c7967"
alter extension postgis update to "3.3.7next";
alter extension postgis update;

update pg_extension
   set extrelocatable = false
 where extname = 'postgis';

select e.extname, n.nspname as schema_name, e.extversion, e.extrelocatable
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'postgis';

select extensions.postgis_full_version();

select extensions.st_distance(
  extensions.st_setsrid(extensions.st_makepoint(0, 0), 4326)::extensions.geography,
  extensions.st_setsrid(extensions.st_makepoint(1, 1), 4326)::extensions.geography
);

select 1
from public.get_recommendations_nearby(34.9000, 33.6000, 50000, 1)
limit 1;

commit;
