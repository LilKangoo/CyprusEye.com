create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$$;

create schema if not exists auth;
create table public.car_offers (
  id uuid primary key,
  car_model text not null,
  is_available boolean not null default true,
  is_published boolean not null default true
);

create table public.car_bookings (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  country text,
  car_model text not null,
  offer_id uuid references public.car_offers(id),
  pickup_date date not null,
  pickup_time time without time zone not null default '10:00',
  pickup_location text not null,
  pickup_address text,
  pickup_city_code text,
  return_date date not null,
  return_time time without time zone not null default '10:00',
  return_location text not null,
  return_address text,
  return_city_code text,
  num_passengers integer default 1,
  child_seats integer default 0,
  full_insurance boolean default false,
  flight_number text,
  special_requests text,
  lang text,
  location text not null,
  status text not null default 'pending',
  source text default 'website',
  payment_status text not null default 'unpaid',
  quoted_price numeric(12,2),
  total_price numeric(12,2),
  currency text default 'EUR',
  base_rental_price numeric(12,2),
  final_rental_price numeric(12,2),
  pickup_location_fee numeric(12,2),
  return_location_fee numeric(12,2),
  insurance_added boolean default false,
  insurance_cost numeric(12,2),
  young_driver boolean default false,
  young_driver_fee boolean default false,
  young_driver_cost numeric(12,2),
  coupon_id uuid,
  coupon_code text,
  coupon_discount_amount numeric(12,2),
  coupon_partner_id uuid,
  coupon_partner_commission_bps integer,
  pricing_snapshot jsonb,
  referral_code text,
  referral_source text,
  referral_captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_bookings_status_check check (status in ('pending','message_sent','confirmed','active','completed','cancelled')),
  constraint car_bookings_payment_status_check check (payment_status in ('unpaid','partial','paid','refunded'))
);

create table public.partner_service_fulfillments (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  booking_id uuid not null,
  status text not null default 'pending_acceptance',
  reference text not null,
  created_at timestamptz not null default now(),
  unique(resource_type, booking_id)
);

create or replace function public.car_validate_threshold_booking_financials()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;

create trigger car_bookings_validate_threshold_financials
before insert or update on public.car_bookings
for each row execute function public.car_validate_threshold_booking_financials();

create or replace function public.car_booking_fixture_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;

create trigger car_bookings_updated_at_trigger
before update on public.car_bookings
for each row execute function public.car_booking_fixture_set_updated_at();

create or replace function public.car_booking_fixture_create_fulfillment()
returns trigger
language plpgsql
as $$
begin
  insert into public.partner_service_fulfillments(resource_type, booking_id, status, reference)
  values ('cars', new.id, 'pending_acceptance', 'CAR-' || substring(new.id::text, 1, 8))
  on conflict (resource_type, booking_id) do nothing;
  return new;
end
$$;

create trigger car_booking_fixture_fulfillment
after insert or update on public.car_bookings
for each row execute function public.car_booking_fixture_create_fulfillment();

alter table public.car_bookings enable row level security;
grant usage on schema public to anon, authenticated, service_role;
grant insert on public.car_bookings to anon, authenticated;
grant select, insert, update, delete on public.car_bookings to service_role;
create policy car_bookings_anon_insert on public.car_bookings
  for insert to anon, authenticated with check (true);

insert into public.car_offers(id, car_model, is_available, is_published)
values
  ('11111111-1111-4111-8111-111111111111', 'Threshold vehicle', true, true),
  ('22222222-2222-4222-8222-222222222222', 'Hidden vehicle', true, false);

insert into public.car_bookings(
  id, full_name, email, phone, car_model, offer_id,
  pickup_date, pickup_time, pickup_location,
  return_date, return_time, return_location,
  location, status, payment_status, total_price, created_at, updated_at
) values (
  '12345678-1234-4234-8234-123456789012',
  'Historical Customer', 'historical@example.test', '+35799000000',
  'Historical vehicle', '11111111-1111-4111-8111-111111111111',
  '2026-08-11', '10:00', 'ayia-napa',
  '2026-08-12', '10:00', 'ayia-napa',
  'larnaca', 'pending', 'unpaid', 50,
  '2026-08-10 08:00:00+00', '2026-08-10 08:00:00+00'
);
