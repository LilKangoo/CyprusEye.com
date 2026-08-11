\set ON_ERROR_STOP on

-- Synthetic disposable PostgreSQL baseline immediately before H1A core.
-- It intentionally contains no production identifiers or customer data.

create extension if not exists pgcrypto;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;

create or replace function auth.jwt()
returns jsonb language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(auth.jwt()->>'sub', '')::uuid $$;

create table public.profiles (
  id uuid primary key,
  email text not null,
  is_admin boolean not null default false
);

create table public.partners (
  id uuid primary key,
  name text not null,
  status text not null default 'active',
  can_manage_hotels boolean not null default false
);

create table public.partner_resources (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  created_at timestamptz default now(),
  unique (partner_id, resource_type, resource_id)
);
alter table public.partner_resources enable row level security;

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title jsonb,
  description jsonb,
  title_i18n jsonb,
  description_i18n jsonb,
  city text,
  address_line text,
  district text,
  postal_code text,
  country text default 'Cyprus',
  latitude double precision,
  longitude double precision,
  google_maps_url text,
  google_place_id text,
  amenities jsonb default '[]'::jsonb,
  room_types jsonb default '[]'::jsonb,
  cover_image_url text,
  photos jsonb default '[]'::jsonb,
  pricing_model text default 'flat_per_night',
  pricing_tiers jsonb default '{"currency":"EUR","rules":[]}'::jsonb,
  max_persons integer check (max_persons is null or max_persons >= 1),
  booking_settings jsonb default '{}'::jsonb,
  pricing_extras jsonb default '{"currency":"EUR","items":[]}'::jsonb,
  owner_partner_id uuid references public.partners(id),
  submission_status text default 'draft' check (submission_status in ('draft','pending','approved','rejected')),
  is_published boolean default false,
  status text default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.hotels_h2a_fixture_updated_at()
returns trigger language plpgsql
as $$ begin new.updated_at := clock_timestamp(); return new; end $$;
create trigger hotels_h2a_fixture_updated_at
before update on public.hotels
for each row execute function public.hotels_h2a_fixture_updated_at();

create table public.hotel_bookings (
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id),
  arrival_date date not null,
  departure_date date not null,
  status text not null default 'pending',
  total_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_service_fulfillments (
  id uuid primary key,
  resource_type text not null,
  booking_id uuid not null,
  resource_id uuid,
  partner_id uuid references public.partners(id),
  status text not null default 'pending_acceptance'
);

create table public.hotel_categories (
  id uuid primary key default gen_random_uuid(),
  name text
);

create table public.hotel_amenities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null,
  icon text,
  name_en text not null,
  name_pl text not null,
  display_order integer default 0,
  is_popular boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  name_he text
);

create table public.service_deposit_rules (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null unique,
  mode text not null,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  include_children boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_deposit_overrides (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_id uuid not null,
  mode text not null,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  include_children boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resource_type, resource_id)
);

-- Empty relationship ledgers mirror the objects inspected by the manual H2A
-- verifier.  No synthetic customer/payment data is needed for this gate.
create table public.service_deposit_requests (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_id uuid,
  created_at timestamptz not null default now()
);

create table public.service_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  service_type text not null,
  resource_id uuid,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  id integer primary key check (id = 1)
);
insert into public.site_settings(id) values (1);

create or replace function public.is_current_user_admin()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_admin
  )
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

insert into public.profiles(id, email, is_admin) values
  ('10000000-0000-4000-8000-000000000001', 'admin@example.test', true),
  ('10000000-0000-4000-8000-000000000002', 'partner@example.test', false);

insert into public.partners(id, name, status, can_manage_hotels) values
  ('20000000-0000-4000-8000-000000000001', 'Synthetic Hotel Partner', 'active', true),
  ('20000000-0000-4000-8000-000000000002', 'Synthetic Other Partner', 'active', false);

insert into public.hotels(
  id, slug, title, description, title_i18n, description_i18n, city,
  owner_partner_id, is_published, status, submission_status, photos,
  pricing_model, pricing_tiers, room_types, pricing_extras, max_persons
) values
  (
    '30000000-0000-4000-8000-000000000001', 'synthetic-legacy-a',
    '{"en":"Synthetic Legacy A"}', '{"en":"Legacy property A"}',
    '{"en":"Synthetic Legacy A"}', '{"en":"Legacy property A"}', 'Lefkara',
    '20000000-0000-4000-8000-000000000001', true, 'published', 'approved',
    '["/images/a.webp"]', 'tiered_by_nights',
    '{"currency":"EUR","rules":[{"persons":2,"min_nights":2,"price_per_night":100},{"persons":2,"min_nights":7,"price_per_night":70}]}',
    '[{"id":"legacy-suite","name":{"en":"Legacy Suite"},"pricing_model":"flat_per_night","pricing_tiers":{"currency":"EUR","rules":[{"persons":2,"min_nights":2,"price_per_night":90}]}}]',
    '{"currency":"EUR","items":[]}', 8
  ),
  (
    '30000000-0000-4000-8000-000000000002', 'synthetic-legacy-b',
    '{"en":"Synthetic Legacy B"}', '{"en":"Legacy property B"}',
    '{"en":"Synthetic Legacy B"}', '{"en":"Legacy property B"}', 'Larnaca',
    null, false, 'draft', 'draft', '["/images/b.webp"]', 'flat_per_night',
    '{"currency":"EUR","rules":[{"persons":2,"min_nights":2,"price_per_night":45,"month_prices":{"jul":60}}]}',
    '[]', '{"currency":"EUR","items":[]}', 2
  );

insert into public.partner_resources(partner_id, resource_type, resource_id)
values ('20000000-0000-4000-8000-000000000001', 'hotels', '30000000-0000-4000-8000-000000000001');

insert into public.hotel_bookings(id, hotel_id, arrival_date, departure_date, status, total_price)
values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  current_date + 10, current_date + 12, 'confirmed', 200
);

insert into public.hotel_amenities(code, category, icon, name_en, name_pl, name_he, display_order, is_popular)
values
  ('wifi', 'general', 'wifi', 'Wi-Fi', 'Wi-Fi', 'Wi-Fi', 1, true),
  ('air-conditioning', 'room', 'snowflake', 'Air conditioning', 'Klimatyzacja', 'מיזוג אוויר', 2, true);

insert into public.service_deposit_rules(resource_type, mode, amount, currency, include_children, enabled)
values ('hotels', 'per_day', 10, 'EUR', true, true);

create temporary table hotels_v2_h2a_fixture_pre_h1 on commit preserve rows as
select
  (select md5(coalesce(string_agg(to_jsonb(hotel)::text, '|' order by hotel.id), '')) from public.hotels hotel) as hotels_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), '')) from public.hotel_bookings booking) as bookings_fingerprint;
