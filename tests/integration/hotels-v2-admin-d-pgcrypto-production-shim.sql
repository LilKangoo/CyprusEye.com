\set ON_ERROR_STOP on

-- Disposable-test compatibility only.
-- Production Supabase exposes pgcrypto.digest in schema "extensions".
-- Earlier local Hotels fixtures install pgcrypto in "public" and still depend
-- on public.digest(), so ADMIN-D mirrors production by adding qualified wrappers
-- without relocating or changing the pgcrypto extension.

create schema if not exists extensions;

create or replace function extensions.digest(p_data bytea, p_type text)
returns bytea
language sql
immutable
strict
parallel safe
set search_path=pg_catalog,public
as $$select public.digest(p_data,p_type)$$;

create or replace function extensions.digest(p_data text, p_type text)
returns bytea
language sql
immutable
strict
parallel safe
set search_path=pg_catalog,public
as $$select public.digest(p_data,p_type)$$;
