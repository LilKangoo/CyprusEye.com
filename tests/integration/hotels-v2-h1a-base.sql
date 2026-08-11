\set ON_ERROR_STOP on

-- Minimal isolated PostgreSQL fixture for the Hotels V2 H1A partner bridge
-- and booking-security lockdown migrations. Synthetic identities and contact
-- values only; this file must run in a disposable local database.

create extension if not exists pgcrypto;
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
end
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt()->>'sub', '')::uuid;
$$;

create table public.profiles (
  id uuid primary key,
  email text not null,
  is_admin boolean not null default false
);

create table public.partners (
  id uuid primary key,
  name text not null,
  status text not null default 'active'
);

create table public.partner_users (
  id uuid primary key,
  partner_id uuid not null references public.partners(id),
  user_id uuid not null,
  role text not null default 'member',
  unique (partner_id, user_id)
);

create table public.hotels (
  id uuid primary key,
  name text not null,
  owner_partner_id uuid references public.partners(id),
  is_active boolean not null default true
);

create table public.partner_resources (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  resource_type text not null,
  resource_id uuid not null,
  is_active boolean not null default true,
  unique (partner_id, resource_type, resource_id)
);

create table public.hotel_bookings (
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id),
  user_id uuid,
  created_by uuid,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  customer_notes text,
  arrival_date date not null,
  departure_date date not null,
  nights integer not null,
  num_adults integer not null default 1,
  num_children integer not null default 0,
  total_price numeric(12,2) not null,
  base_price numeric(12,2),
  final_price numeric(12,2),
  extras_price numeric(12,2),
  selected_extras jsonb not null default '[]'::jsonb,
  booking_details jsonb not null default '{}'::jsonb,
  room_type_id text,
  room_type_name jsonb,
  rate_plan_id text,
  rate_plan_name jsonb,
  cancellation_policy_type text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_service_fulfillments (
  id uuid primary key,
  partner_id uuid not null references public.partners(id),
  resource_type text not null,
  booking_id uuid not null,
  resource_id uuid,
  status text not null default 'pending_acceptance',
  accepted_at timestamptz,
  accepted_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  rejected_reason text,
  contact_revealed_at timestamptz,
  reference text,
  summary text,
  start_date date,
  end_date date,
  total_price numeric(12,2),
  currency text not null default 'EUR',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resource_type, booking_id, partner_id)
);

create table public.service_deposit_requests (
  id uuid primary key,
  resource_type text not null,
  booking_id uuid not null,
  amount numeric(12,2) not null,
  status text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.service_coupon_redemptions (
  id uuid primary key,
  service_type text not null,
  booking_id uuid not null,
  coupon_code text,
  discount_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_admin is true
  );
$$;

create or replace function public.is_partner_user(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.partner_users membership
    where membership.partner_id = p_partner_id
      and membership.user_id = auth.uid()
  );
$$;

-- Legacy referral RPC fixture. Its return contract intentionally contains
-- customer_name so the bridge can prove that the new Partner Portal wrapper
-- preserves operational attribution while redacting identity.
create or replace function public.partner_get_referral_attributed_orders(
  p_partner_id uuid,
  p_limit integer default 40
)
returns table (
  booking_id uuid,
  service_type text,
  service_id uuid,
  service_slug text,
  service_date text,
  customer_name text,
  booking_status text,
  payment_status text,
  total_amount numeric,
  currency text,
  referral_code text,
  referral_source text,
  referral_captured_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $$
begin
  if p_partner_id is null
     or not (
       public.is_current_user_admin()
       or public.is_partner_user(p_partner_id)
     ) then
    raise exception using
      errcode = '42501',
      message = 'synthetic_partner_referral_scope_forbidden';
  end if;

  return query
  select
    booking.id,
    'hotels'::text,
    booking.hotel_id,
    hotel.name,
    booking.arrival_date::text,
    booking.customer_name,
    booking.status,
    null::text,
    booking.total_price,
    coalesce(nullif(fulfillment.currency, ''), 'EUR'),
    ('REF-' || right(replace(booking.id::text, '-', ''), 6))::text,
    'fixture'::text,
    booking.created_at,
    booking.created_at
  from public.hotel_bookings booking
  join public.hotels hotel on hotel.id = booking.hotel_id
  join public.partner_service_fulfillments fulfillment
    on fulfillment.booking_id = booking.id
   and fulfillment.resource_type = 'hotels'
   and fulfillment.partner_id = p_partner_id
   and fulfillment.resource_id = booking.hotel_id
  order by booking.created_at desc, booking.id
  limit p_limit;
end;
$$;

create or replace function public.upsert_partner_service_fulfillment_from_booking_with_partner(
  p_partner_id uuid,
  p_resource_type text,
  p_booking_id uuid,
  p_resource_id uuid,
  p_start_date date,
  p_end_date date,
  p_total_price numeric,
  p_currency text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_reference text,
  p_summary text,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  insert into public.partner_service_fulfillments (
    id, partner_id, resource_type, booking_id, resource_id, status,
    reference, summary, start_date, end_date, total_price, currency, created_at
  ) values (
    gen_random_uuid(), p_partner_id, p_resource_type, p_booking_id, p_resource_id,
    'pending_acceptance', p_reference, p_summary, p_start_date, p_end_date,
    p_total_price, coalesce(nullif(p_currency, ''), 'EUR'), p_created_at
  )
  on conflict (resource_type, booking_id, partner_id) do update
    set resource_id = excluded.resource_id,
        reference = excluded.reference,
        summary = excluded.summary,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        total_price = excluded.total_price,
        currency = excluded.currency
  returning id into v_id;

  return v_id;
end;
$$;

-- Optional functions deliberately exist so the lockdown exercises both its
-- trigger-only and Admin-callable privilege branches.
create or replace function public.update_hotel_bookings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger hotel_bookings_updated_at_trigger
before update on public.hotel_bookings
for each row execute function public.update_hotel_bookings_updated_at();

create or replace function public.trg_notify_admin_new_hotel_booking()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;

create trigger hotel_bookings_fixture_notify_trigger
after insert on public.hotel_bookings
for each row execute function public.trg_notify_admin_new_hotel_booking();

create or replace function public.admin_apply_hotel_booking_manual_adjustment(p_booking_id uuid)
returns uuid
language plpgsql
security definer
as $$
begin
  if not public.is_current_user_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  return p_booking_id;
end;
$$;

alter table public.hotel_bookings enable row level security;

-- This intentionally reproduces the broad pre-H1A policy. The lockdown must
-- remove it and replace it with exact customer/Admin policies.
create policy "Authenticated users can view hotel bookings"
on public.hotel_bookings
for select
to authenticated
using (true);

grant usage on schema public, auth to anon, authenticated, service_role;
grant select, insert on public.hotel_bookings to anon;
grant select, insert, update, delete on public.hotel_bookings to authenticated;
grant execute on function public.partner_get_referral_attributed_orders(uuid, integer) to authenticated;
grant execute on function public.upsert_partner_service_fulfillment_from_booking_with_partner(
  uuid, text, uuid, uuid, date, date, numeric, text, text, text, text, text, text, timestamptz
) to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

insert into public.profiles (id, email, is_admin) values
  ('10000000-0000-4000-8000-000000000001', 'admin@example.test', true),
  ('20000000-0000-4000-8000-000000000001', 'customer-a@example.test', false),
  ('20000000-0000-4000-8000-000000000002', 'customer-b@example.test', false),
  ('30000000-0000-4000-8000-000000000001', 'partner-a@example.test', false),
  ('30000000-0000-4000-8000-000000000002', 'partner-b@example.test', false);

insert into public.partners (id, name, status) values
  ('40000000-0000-4000-8000-000000000001', 'Synthetic Hotel Partner A', 'active'),
  ('40000000-0000-4000-8000-000000000002', 'Synthetic Hotel Partner B', 'active');

insert into public.partner_users (id, partner_id, user_id, role) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'owner'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'owner');

insert into public.hotels (id, name, owner_partner_id) values
  ('50000000-0000-4000-8000-000000000001', 'Synthetic Hotel A', '40000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', 'Synthetic Hotel B', '40000000-0000-4000-8000-000000000002');

insert into public.partner_resources (partner_id, resource_type, resource_id, is_active) values
  ('40000000-0000-4000-8000-000000000001', 'hotels', '50000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', 'hotels', '50000000-0000-4000-8000-000000000002', true);

insert into public.hotel_bookings (
  id, hotel_id, user_id, created_by, customer_name, customer_email,
  customer_phone, customer_notes, arrival_date, departure_date, nights,
  num_adults, num_children, total_price, base_price, final_price,
  extras_price, selected_extras, booking_details, room_type_id,
  room_type_name, rate_plan_id, rate_plan_name, cancellation_policy_type,
  status, created_at, updated_at
) values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Synthetic Customer A', 'customer-a@example.test', '+35799000001',
    'Synthetic private note A', '2026-09-01', '2026-09-04', 3, 2, 1,
    420, 400, 420, 20, '[{"code":"breakfast"}]',
    '{"room_inventory_units":2,"private_note":"never expose"}',
    'room-a', '{"en":"Sea View"}', 'rate-a', '{"en":"Flexible"}',
    'flexible', 'pending', '2026-08-11 08:00:00+00', '2026-08-11 08:00:00+00'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'Synthetic Customer B', 'customer-b@example.test', '+35799000002',
    'Synthetic private note B', '2026-10-10', '2026-10-12', 2, 1, 0,
    250, 250, 250, 0, '[]', '{"room_inventory_units":1}',
    'room-b', '{"en":"Garden View"}', 'rate-b', '{"en":"Standard"}',
    'strict', 'pending', '2026-08-11 09:00:00+00', '2026-08-11 09:00:00+00'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000001',
    null, null,
    'Synthetic Historical Guest A', 'customer-a@example.test', '+35799000003',
    'Synthetic ownerless legacy note', '2026-12-01', '2026-12-03', 2, 1, 0,
    180, 180, 180, 0, '[]', '{"room_inventory_units":1}',
    'room-a', '{"en":"Sea View"}', 'rate-a', '{"en":"Flexible"}',
    'flexible', 'pending', '2026-08-10 07:00:00+00', '2026-08-10 07:00:00+00'
  );

insert into public.partner_service_fulfillments (
  id, partner_id, resource_type, booking_id, resource_id, status,
  accepted_at, rejected_at, contact_revealed_at, reference, summary,
  start_date, end_date, total_price, currency, details, created_at, updated_at
) values
  (
    '70000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001', 'hotels',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001', 'pending_acceptance',
    null, null, null, 'HOTEL-A', 'Synthetic stay A',
    '2026-09-01', '2026-09-04', 420, 'EUR',
    '{"operational":"fixture-a"}', '2026-08-11 08:00:01+00', '2026-08-11 08:00:01+00'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002', 'hotels',
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002', 'pending_acceptance',
    null, null, null, 'HOTEL-B', 'Synthetic stay B',
    '2026-10-10', '2026-10-12', 250, 'EUR',
    '{"operational":"fixture-b"}', '2026-08-11 09:00:01+00', '2026-08-11 09:00:01+00'
  );

insert into public.service_deposit_requests (
  id, resource_type, booking_id, amount, status, paid_at, created_at
) values (
  '80000000-0000-4000-8000-000000000001', 'hotels',
  '60000000-0000-4000-8000-000000000001', 42, 'pending', null,
  '2026-08-11 08:00:02+00'
);

insert into public.service_coupon_redemptions (
  id, service_type, booking_id, coupon_code, discount_amount, created_at
) values (
  '90000000-0000-4000-8000-000000000001', 'hotels',
  '60000000-0000-4000-8000-000000000001', 'SYNTHETIC10', 20,
  '2026-08-11 08:00:03+00'
);

create table public.hotels_h1a_fixture_fingerprints as
select
  (select md5(coalesce(string_agg(to_jsonb(booking_row)::text, '|' order by booking_row.id), ''))
   from public.hotel_bookings booking_row) as booking_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(fulfillment_row)::text, '|' order by fulfillment_row.id), ''))
   from public.partner_service_fulfillments fulfillment_row
   where fulfillment_row.resource_type = 'hotels') as fulfillment_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(deposit_row)::text, '|' order by deposit_row.id), ''))
   from public.service_deposit_requests deposit_row
   where deposit_row.resource_type = 'hotels') as deposit_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(coupon_row)::text, '|' order by coupon_row.id), ''))
   from public.service_coupon_redemptions coupon_row
   where coupon_row.service_type = 'hotels') as coupon_fingerprint;
