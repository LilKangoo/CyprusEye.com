-- Car Rental Multi-City Stage 2C real PostgREST integration base.
-- Isolated synthetic schema only. No production data or credentials.

begin;

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'stage2c-local-only';
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public, auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select coalesce(
    (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'user_metadata'
      ->> 'is_admin'
    )::boolean,
    false
  ) or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_admin
  );
$$;

create table public.partners (
  id uuid primary key,
  name text not null,
  status text not null check (status in ('active', 'suspended')),
  can_manage_cars boolean not null default false,
  cars_locations text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.car_offers (
  id uuid primary key default gen_random_uuid(),
  location text not null check (location in ('larnaca', 'paphos')),
  car_type jsonb not null,
  car_model jsonb not null,
  description jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  transmission text not null default 'manual',
  fuel_type text not null default 'petrol',
  max_passengers integer not null default 5,
  max_luggage integer not null default 2,
  stock_count integer not null default 1 check (stock_count >= 0),
  sort_order integer not null default 1000,
  image_url text,
  price_per_day numeric(12,2) not null check (price_per_day > 0),
  price_3days numeric(12,2),
  price_4_6days numeric(12,2),
  price_7_10days numeric(12,2),
  price_10plus_days numeric(12,2),
  currency text not null default 'EUR',
  deposit_amount numeric(12,2) not null default 0,
  insurance_per_day numeric(12,2) not null default 0,
  young_driver_fee boolean not null default false,
  young_driver_cost numeric(12,2) not null default 0,
  owner_partner_id uuid references public.partners(id) on delete set null,
  north_allowed boolean not null default false,
  is_available boolean not null default true,
  is_published boolean not null default true,
  submission_status text not null default 'approved',
  min_rental_days integer not null default 1,
  max_rental_days integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.car_bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.car_offers(id) on delete set null,
  location text,
  pickup_location text not null,
  return_location text not null,
  pickup_date date not null,
  return_date date not null,
  quote jsonb,
  breakdown jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_resources (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  unique (partner_id, resource_type, resource_id)
);

create table public.partner_service_fulfillments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  resource_type text not null,
  booking_id uuid not null,
  resource_id uuid,
  status text not null default 'pending_acceptance',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table public.car_location_fees (
  id uuid primary key default gen_random_uuid(),
  location_name text not null unique,
  pickup_fee numeric(12,2) not null default 0,
  return_fee numeric(12,2) not null default 0,
  is_active boolean not null default true
);

create table public.car_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null unique,
  rule_type text not null,
  price_per_day numeric(12,2),
  flat_fee numeric(12,2),
  is_active boolean not null default true
);

create table public.site_settings (
  id integer primary key check (id = 1),
  force_refresh_version integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.integration_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;

create trigger car_offers_set_updated_at
before update on public.car_offers
for each row execute function public.integration_set_updated_at();

create trigger partners_set_updated_at
before update on public.partners
for each row execute function public.integration_set_updated_at();

alter table public.car_offers enable row level security;
alter table public.car_bookings enable row level security;
alter table public.partners enable row level security;
alter table public.partner_resources enable row level security;
alter table public.partner_service_fulfillments enable row level security;
alter table public.service_deposit_rules enable row level security;
alter table public.service_deposit_overrides enable row level security;
alter table public.car_location_fees enable row level security;
alter table public.car_pricing_rules enable row level security;
alter table public.site_settings enable row level security;

create policy car_offers_public_read
on public.car_offers for select to anon, authenticated
using (is_available and is_published);

create policy car_offers_admin_all
on public.car_offers for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy car_bookings_admin_all
on public.car_bookings for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy partners_admin_all
on public.partners for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy partner_resources_admin_all
on public.partner_resources for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy partner_service_fulfillments_admin_all
on public.partner_service_fulfillments for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy service_deposit_rules_admin_all
on public.service_deposit_rules for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy service_deposit_overrides_admin_all
on public.service_deposit_overrides for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy car_location_fees_public_read
on public.car_location_fees for select to anon, authenticated
using (is_active);

create policy car_location_fees_admin_all
on public.car_location_fees for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy car_pricing_rules_public_read
on public.car_pricing_rules for select to anon, authenticated
using (is_active);

create policy car_pricing_rules_admin_all
on public.car_pricing_rules for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy site_settings_read
on public.site_settings for select to anon, authenticated
using (true);

create policy site_settings_admin_update
on public.site_settings for update to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

grant select on public.car_offers, public.car_location_fees, public.car_pricing_rules, public.site_settings to anon;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.car_offers, public.car_bookings, public.partners,
  public.partner_resources, public.partner_service_fulfillments, public.service_deposit_rules,
  public.service_deposit_overrides, public.car_location_fees, public.car_pricing_rules,
  public.site_settings to authenticated;
grant all privileges on all tables in schema public to service_role;

insert into auth.users (id, raw_user_meta_data)
values
  ('ca2c0000-0000-4000-8000-000000000001', '{"is_admin":true}'::jsonb),
  ('ca2c0000-0000-4000-8000-000000000002', '{"is_admin":false}'::jsonb);

insert into public.profiles (id, is_admin)
values
  ('ca2c0000-0000-4000-8000-000000000001', true),
  ('ca2c0000-0000-4000-8000-000000000002', false);

insert into public.partners (id, name, status, can_manage_cars, cars_locations)
values
  ('ca2f0000-0000-4000-8000-000000000001', 'Integration Larnaca Partner', 'active', true, array['larnaca']),
  ('ca2f0000-0000-4000-8000-000000000002', 'Integration Paphos Partner', 'active', true, array['paphos']);

insert into public.car_offers (
  id, location, car_type, car_model, description, features,
  transmission, fuel_type, max_passengers, max_luggage, stock_count, sort_order,
  price_per_day, price_3days, price_4_6days, price_7_10days, price_10plus_days,
  currency, deposit_amount, insurance_per_day, young_driver_fee, young_driver_cost,
  owner_partner_id, north_allowed, is_available, is_published, submission_status
)
values
  (
    'ca300001-0000-4000-8000-000000000001', 'larnaca',
    '{"pl":"Ekonomiczne","en":"Economy","he":"חסכוני"}'::jsonb,
    '{"pl":"Mazda 2 test","en":"Mazda 2 test","he":"מאזדה 2 בדיקה"}'::jsonb,
    '{"pl":"Fixture","en":"Fixture","he":"בדיקה"}'::jsonb,
    '{"pl":["Klimatyzacja"],"en":["Air conditioning"],"he":["מיזוג"]}'::jsonb,
    'automatic', 'petrol', 5, 2, 2, 10,
    35, 105, 34, 31, 29,
    'EUR', 200, 17, true, 10,
    'ca2f0000-0000-4000-8000-000000000001', true, true, true, 'approved'
  ),
  (
    'ca300001-0000-4000-8000-000000000002', 'paphos',
    '{"pl":"SUV","en":"SUV","he":"SUV"}'::jsonb,
    '{"pl":"Paphos SUV test","en":"Paphos SUV test","he":"רכב פאפוס בדיקה"}'::jsonb,
    '{"pl":"Fixture","en":"Fixture","he":"בדיקה"}'::jsonb,
    '{"pl":["Klimatyzacja"],"en":["Air conditioning"],"he":["מיזוג"]}'::jsonb,
    'automatic', 'petrol', 5, 4, 1, 20,
    65, 210, 65, 60, 55,
    'EUR', 350, 17, false, 0,
    'ca2f0000-0000-4000-8000-000000000002', false, true, true, 'approved'
  );

insert into public.partner_resources (id, partner_id, resource_type, resource_id)
values
  ('ca2e0000-0000-4000-8000-000000000001', 'ca2f0000-0000-4000-8000-000000000001', 'cars', 'ca300001-0000-4000-8000-000000000001'),
  ('ca2e0000-0000-4000-8000-000000000002', 'ca2f0000-0000-4000-8000-000000000002', 'cars', 'ca300001-0000-4000-8000-000000000002');

insert into public.car_location_fees (location_name, pickup_fee, return_fee)
values
  ('Larnaca', 0, 0),
  ('Nicosia', 15, 15),
  ('Ayia Napa', 15, 15),
  ('Protaras', 20, 20),
  ('Limassol', 20, 20),
  ('Paphos', 40, 40);

insert into public.car_pricing_rules (rule_name, rule_type, price_per_day, flat_fee)
values
  ('Full Insurance', 'addon', 17, 0),
  ('Young Driver Fee', 'addon', 10, 0);

insert into public.service_deposit_rules (
  id, resource_type, mode, amount, currency, include_children, enabled
)
values (
  'ca2d0000-0000-4000-8000-000000000001', 'cars', 'flat', 100, 'EUR', true, true
);

insert into public.site_settings (id, force_refresh_version)
values (1, 0);

commit;
