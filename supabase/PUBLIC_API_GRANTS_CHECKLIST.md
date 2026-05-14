# Supabase Public Data API Grants Checklist

Supabase is changing the default behavior for new tables in the `public` schema:
new objects are not exposed through the Data API unless the intended API roles
have explicit grants. Existing production objects were audited on 2026-05-14 and
no public table/view/materialized view was missing all API role grants.

This file is a guardrail for future migrations. It does not change production.

## When This Checklist Applies

Use this checklist whenever a migration creates a new object in `public`:

- `CREATE TABLE public...`
- `CREATE VIEW public...`
- `CREATE MATERIALIZED VIEW public...`
- any new sequence used by a client-side insert path

It is also required when a new frontend/admin/partner flow starts calling a table
through `supabase.from(...)`.

## Required Migration Pattern

Every new `public` table must make access explicit:

```sql
alter table public.your_table enable row level security;

-- Pick only the roles and privileges that match the product flow.
grant select on table public.your_table to anon;
grant select, insert, update, delete on table public.your_table to authenticated;
grant select, insert, update, delete on table public.your_table to service_role;

create policy your_table_policy_name
  on public.your_table
  for select
  to authenticated
  using (auth.uid() = user_id);
```

Do not copy this block blindly. The privileges must match the real access model.

## Access Rules We Use

- Public catalog data: usually `grant select ... to anon, authenticated`.
- Public booking forms: usually `grant insert ... to anon, authenticated`; only grant `select` if customers need to read their own records.
- Signed-in user data: usually `grant select, insert, update, delete ... to authenticated` with owner/admin RLS policies.
- Admin-only data: usually `grant ... to authenticated` plus admin-only RLS policies.
- Edge Function only/internal data: usually `grant ... to service_role`; avoid `anon` and avoid broad authenticated access.
- Tracking tables for anonymous events: usually only the exact operation needed, for example `grant insert ... to anon, authenticated`.

If a table uses a sequence and clients insert through PostgREST, also grant the
minimum sequence access needed by that role:

```sql
grant usage, select on sequence public.your_table_id_seq to authenticated;
```

## What Not To Do

- Do not use `grant all on all tables in schema public` as a shortcut.
- Do not add `anon` grants to admin, payment, partner, private customer, or internal tables.
- Do not rely on RLS policies alone; table privileges and RLS policies are both required.
- Do not deploy a new `public` table without running the audit query below.

## Audit Before Deploy

Run this read-only audit in Supabase SQL Editor after any migration that creates
or exposes a public object:

```sql
\i supabase/CHECK_PUBLIC_API_GRANTS.sql
```

If running from the Supabase dashboard, paste the contents of
`supabase/CHECK_PUBLIC_API_GRANTS.sql`.

Expected result:

```text
Success. No rows returned
```

If rows are returned, do not deploy until each object is intentionally classified
and given the correct grant/RLS policy combination.

## Review Checklist

- The migration enables RLS for every new public table.
- Every role that needs Data API access has an explicit table grant.
- Roles that should not access the object have no grant.
- RLS policies match the actual product flow.
- Anonymous insert policies do not expose select/update/delete.
- Edge Function/service-only tables are not exposed to `anon`.
- Any client-side sequence insert path has explicit sequence grants.
- `CHECK_PUBLIC_API_GRANTS.sql` returns no rows after the migration.

