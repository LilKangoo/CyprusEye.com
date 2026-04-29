begin;

-- Stage 17: remove public API execution from PostGIS st_estimatedextent.
--
-- Supabase Security Advisor reports these PostGIS SECURITY DEFINER functions
-- because the extension still lives in the exposed public schema. The app does
-- not call st_estimatedextent; it uses ST_MakePoint, ST_SetSRID, ST_Distance,
-- and ST_DWithin for recommendations. Revoking these specific overloads avoids
-- exposing unnecessary SECURITY DEFINER RPCs without moving PostGIS itself.

do $$
declare
  target_signature text;
  target_function regprocedure;
begin
  foreach target_signature in array array[
    'public.st_estimatedextent(text,text)',
    'public.st_estimatedextent(text,text,text)',
    'public.st_estimatedextent(text,text,text,boolean)'
  ]
  loop
    target_function := to_regprocedure(target_signature);

    if target_function is not null then
      execute format('revoke execute on function %s from public', target_function);
      execute format('revoke execute on function %s from anon', target_function);
      execute format('revoke execute on function %s from authenticated', target_function);
      execute format('grant execute on function %s to service_role', target_function);
    end if;
  end loop;
end
$$;

-- Validate the PostGIS functions used by the app still execute.
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
