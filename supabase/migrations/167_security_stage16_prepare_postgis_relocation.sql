begin;

-- Stage 16 preparation: make app-owned PostGIS-dependent functions ready for
-- a later PostGIS move from public to extensions.
--
-- The actual extension relocation requires updating pg_extension
-- extrelocatable, which Supabase managed migrations cannot do in this project.
-- This migration only applies safe prerequisites that are allowed here.

create schema if not exists extensions;

grant usage on schema extensions to anon;
grant usage on schema extensions to authenticated;
grant usage on schema extensions to service_role;

-- These functions use unqualified PostGIS symbols. Keep public first for table
-- references, then extensions for the future PostGIS location.
alter function public.sync_recommendation_geography()
  set search_path = public, extensions;

alter function public.get_recommendations_nearby(numeric, numeric, numeric, integer)
  set search_path = public, extensions;

-- Validate that the functions still resolve while PostGIS is currently in
-- public and will also resolve after PostGIS moves to extensions.
do $$
begin
  perform public.st_distance(
    public.st_setsrid(public.st_makepoint(0, 0), 4326)::public.geography,
    public.st_setsrid(public.st_makepoint(1, 1), 4326)::public.geography
  );

  perform 1
  from public.get_recommendations_nearby(34.9000, 33.6000, 50000, 1)
  limit 1;
end
$$;

commit;
