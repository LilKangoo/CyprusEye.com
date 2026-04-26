begin;

-- Stage 5 follow-up: remove the unused pg_graphql extension.
--
-- The application does not call /graphql/v1 and PostgREST now exposes only the
-- public schema. Dropping pg_graphql removes GraphQL schema introspection from
-- Security Advisor without changing REST/PostgREST table grants or RLS.
--
-- Intentionally no CASCADE: if unexpected dependencies exist, this migration
-- must fail instead of dropping dependent objects.

drop extension if exists pg_graphql;

commit;
