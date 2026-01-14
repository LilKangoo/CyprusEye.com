-- TODO: implementacja pełna – szkielety tabel, RLS i helpera is_admin()

-- Extensions (if not enabled)
create extension if not exists pgcrypto;

-- Helper: check admin flag from JWT user_metadata.is_admin
create or replace function public.is_admin() returns boolean language sql stable as $$
  select coalesce(((auth.jwt() ->> 'user_metadata')::jsonb ->> 'is_admin')::boolean, false);
$$;

-- Cars table
create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text,
  class text,
  location text not null check (location in ('larnaka','paphos')),
  seats int,
  luggage int,
  transmission text,
  ac boolean default true,
  daily_price numeric, -- TODO: docelowe przeliczniki dostarczysz później
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bookings table
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete restrict,
  name text not null,
  email text not null,
  whatsapp text not null,
  location text not null check (location in ('larnaka','paphos')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  days int,
  status text not null default 'pending' check (status in ('pending','waiting_payment','paid','approved','cancelled')),
  stripe_session_id text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric not null,
  currency text not null default 'EUR',
  status text not null default 'unpaid',
  stripe_session_id text,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_cars_location on public.cars(location) where active;
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_car on public.bookings(car_id);
create index if not exists idx_payments_booking on public.payments(booking_id);

-- RLS
alter table public.cars enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;

-- Policies: cars public select
drop policy if exists cars_select_public on public.cars;
create policy cars_select_public on public.cars for select using (true);

-- Policies: bookings
-- Public insert allowed (no read). Admin full access.
drop policy if exists bookings_insert_public on public.bookings;
create policy bookings_insert_public on public.bookings for insert with check (true);
drop policy if exists bookings_all_admin on public.bookings;
create policy bookings_all_admin on public.bookings for all using (public.is_admin()) with check (public.is_admin());

-- Policies: payments admin only
drop policy if exists payments_all_admin on public.payments;
create policy payments_all_admin on public.payments for all using (public.is_admin()) with check (public.is_admin());

-- Triggers updated_at
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

create trigger set_cars_updated_at before update on public.cars
for each row execute procedure public.set_updated_at();

create trigger set_bookings_updated_at before update on public.bookings
for each row execute procedure public.set_updated_at();
