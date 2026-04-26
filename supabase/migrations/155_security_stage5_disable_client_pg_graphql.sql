begin;

-- Stage 5: disable pg_graphql access for client-facing roles.
--
-- The application uses Supabase JS/PostgREST and Edge Functions, not the
-- /graphql/v1 endpoint. Revoking schema usage and function execution here
-- removes GraphQL introspection/query access without changing table grants,
-- RLS policies, REST access, or service-role backend behavior.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'graphql') then
    revoke usage on schema graphql from public;
    revoke usage on schema graphql from anon, authenticated;
    revoke execute on all functions in schema graphql from public;
    revoke execute on all functions in schema graphql from anon, authenticated;

    -- Keep GraphQL available to backend service-role callers if ever needed.
    grant usage on schema graphql to service_role;
    grant execute on all functions in schema graphql to service_role;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'graphql_public') then
    revoke usage on schema graphql_public from public;
    revoke usage on schema graphql_public from anon, authenticated;
    revoke execute on all functions in schema graphql_public from public;
    revoke execute on all functions in schema graphql_public from anon, authenticated;

    -- Keep GraphQL available to backend service-role callers if ever needed.
    grant usage on schema graphql_public to service_role;
    grant execute on all functions in schema graphql_public to service_role;
  end if;
end
$$;

commit;
