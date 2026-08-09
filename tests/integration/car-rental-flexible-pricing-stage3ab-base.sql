-- Stage 3A/3B additions to the isolated Cars PostgREST fixture.
-- Synthetic identifiers only; no production credentials, bookings or PII.

begin;

create or replace function public.is_partner_user(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select false;
$$;

create or replace function public.try_numeric(p_text text)
returns numeric
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_text is null or nullif(btrim(p_text), '') is null then
    return null;
  end if;
  begin
    return p_text::numeric;
  exception when others then
    return null;
  end;
end
$$;

alter table public.car_bookings
  add column if not exists final_price numeric(12,2),
  add column if not exists total_price numeric(12,2),
  add column if not exists quoted_price numeric(12,2),
  add column if not exists status text not null default 'pending',
  add column if not exists payment_status text not null default 'unpaid';

alter table public.car_bookings
  drop constraint if exists car_bookings_payment_status_check,
  add constraint car_bookings_payment_status_check
    check (payment_status in ('unpaid', 'partial', 'paid', 'refunded'));

create table public.transport_bookings (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_deposit_requests (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('cars', 'transport')),
  booking_id uuid,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.sync_car_booking_status_from_deposit_paid()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return new;
end
$$;

create trigger trg_sync_car_booking_status_from_deposit_paid
after insert or update of status, paid_at
on public.service_deposit_requests
for each row execute function public.sync_car_booking_status_from_deposit_paid();

alter table public.transport_bookings enable row level security;
alter table public.service_deposit_requests enable row level security;

grant all privileges on table public.transport_bookings to service_role;
grant all privileges on table public.service_deposit_requests to service_role;

commit;
