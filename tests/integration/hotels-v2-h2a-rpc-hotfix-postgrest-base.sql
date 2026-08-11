\set ON_ERROR_STOP on

-- Disposable local-only PostgREST fixture. It deliberately uses the two exact
-- production property identifiers/slugs so the repaired directory contract is
-- tested without copying any production row, booking, fulfillment, or PII.
\ir hotels-v2-h2a-base.sql

do $fixture_partner_resources_contract$
declare
  v_columns text[];
begin
  select array_agg(column_name order by ordinal_position)
  into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'partner_resources';

  if v_columns is distinct from array[
    'id', 'partner_id', 'resource_type', 'resource_id', 'created_at'
  ]::text[] then
    raise exception using
      errcode = '42703',
      message = 'hotels_v2_h2a_hotfix_fixture_partner_resources_contract_mismatch',
      detail = coalesce(array_to_string(v_columns, ','), '<missing>');
  end if;
end
$fixture_partner_resources_contract$;

delete from public.hotel_bookings;
delete from public.partner_resources;
delete from public.hotels;

insert into public.hotels(
  id, slug, title, description, title_i18n, description_i18n, city,
  owner_partner_id, is_published, status, submission_status, photos
) values
  (
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca', '7-ukow',
    '{"en":"7 Arches"}', '{"en":"Local PostgREST fixture"}',
    '{"en":"7 Arches","pl":"7 Łuków","he":"7 Arches"}',
    '{"en":"Local PostgREST fixture"}', 'Lefkara',
    '20000000-0000-4000-8000-000000000001', true, 'published', 'approved',
    '["/images/hotels/h2a-fixture-a.webp"]'
  ),
  (
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1', 'rgb-cabins-larnaka-centrum',
    '{"en":"RGB Cabins"}', '{"en":"Local PostgREST fixture"}',
    '{"en":"RGB Cabins","pl":"RGB Cabins","he":"RGB Cabins"}',
    '{"en":"Local PostgREST fixture"}', 'Larnaca',
    null, false, 'draft', 'draft',
    '["/images/hotels/h2a-fixture-b.webp"]'
  );

insert into public.partner_resources(partner_id, resource_type, resource_id)
values (
  '20000000-0000-4000-8000-000000000001',
  'hotels',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
);

insert into public.hotel_bookings(id, hotel_id, arrival_date, departure_date, status, total_price)
values (
  '40000000-0000-4000-8000-000000000001',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  current_date + 10,
  current_date + 12,
  'confirmed',
  200
);

insert into public.profiles(id, email, is_admin)
values ('10000000-0000-4000-8000-000000000003', 'customer@example.test', false);

create table public.partner_users (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  unique (partner_id, user_id)
);

insert into public.partner_users(partner_id, user_id, role)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'owner'
);

create or replace function public.is_partner_user(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public.partner_users partner_user
    where partner_user.partner_id = p_partner_id
      and partner_user.user_id = auth.uid()
  )
$function$;

do $authenticator_role$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login
      password 'hotels-h2a-hotfix-local-only';
  end if;
end
$authenticator_role$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public, auth to anon, authenticated, service_role;

\ir ../../supabase/migrations/20260811170000_hotels_v2_h1a_core.sql
\ir ../../supabase/migrations/20260811200000_hotels_v2_h2a_admin_workspace_foundation.sql
\ir ../../supabase/migrations/20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql

notify pgrst, 'reload schema';

