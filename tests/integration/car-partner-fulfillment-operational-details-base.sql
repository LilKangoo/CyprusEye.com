-- Minimal isolated PostgreSQL fixture for the Cars fulfillment operational
-- details migration. Synthetic data only; no production credentials or PII.

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

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub'
  ), '')::uuid;
$$;

create table public.partners (
  id uuid primary key,
  name text not null,
  status text not null,
  can_manage_cars boolean not null default false
);

create table public.partner_users (
  id uuid primary key,
  partner_id uuid not null references public.partners(id),
  user_id uuid not null,
  role text not null
);

create table public.car_offers (
  id uuid primary key,
  car_model text,
  location text,
  pricing_strategy text not null,
  owner_partner_id uuid references public.partners(id)
);

create table public.car_bookings (
  id uuid primary key,
  offer_id uuid references public.car_offers(id),
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  pickup_date date,
  pickup_time time without time zone,
  return_date date,
  return_time time without time zone,
  location text,
  pickup_location text,
  return_location text,
  car_model text,
  car_type text,
  quoted_price numeric(12,2),
  total_price numeric(12,2),
  final_price numeric(12,2),
  currency text default 'EUR',
  customer_name text,
  customer_email text,
  customer_phone text,
  full_name text,
  email text,
  phone text,
  country text,
  pickup_address text,
  return_address text,
  num_passengers integer,
  child_seats integer,
  full_insurance boolean default false,
  flight_number text,
  special_requests text,
  airport_pickup jsonb,
  airport_return jsonb,
  airport_pickup_fee numeric(12,2),
  airport_return_fee numeric(12,2),
  pickup_location_fee numeric(12,2),
  return_location_fee numeric(12,2),
  insurance_cost numeric(12,2),
  young_driver_cost numeric(12,2),
  insurance_added boolean,
  young_driver_fee boolean,
  coupon_id uuid,
  coupon_code text,
  base_rental_price numeric(12,2),
  coupon_discount_amount numeric(12,2),
  final_rental_price numeric(12,2),
  coupon_partner_id uuid,
  coupon_partner_commission_bps integer,
  created_at timestamptz not null default now()
);

create table public.partner_service_fulfillments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  resource_type text not null,
  booking_id uuid not null,
  resource_id uuid,
  status text not null default 'pending_acceptance',
  sla_deadline_at timestamptz,
  sla_alerted_at timestamptz,
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
  currency text default 'EUR',
  details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index partner_service_fulfillments_unique_cars
  on public.partner_service_fulfillments(resource_type, booking_id)
  where resource_type = 'cars';

create table public.partner_service_fulfillment_contacts (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null unique references public.partner_service_fulfillments(id),
  customer_name text,
  customer_email text,
  customer_phone text,
  created_at timestamptz not null default now()
);

create table public.partner_service_fulfillment_form_snapshots (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null unique references public.partner_service_fulfillments(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.update_partner_service_fulfillments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;

create trigger partner_service_fulfillments_updated_at_trigger
before update on public.partner_service_fulfillments
for each row execute function public.update_partner_service_fulfillments_updated_at();

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

alter table public.partner_service_fulfillments enable row level security;
alter table public.partner_service_fulfillment_contacts enable row level security;
alter table public.partner_service_fulfillment_form_snapshots enable row level security;

create policy partner_service_fulfillments_partner_read
on public.partner_service_fulfillments
for select to authenticated
using (public.is_partner_user(partner_id));

create policy partner_service_fulfillment_contacts_partner_read
on public.partner_service_fulfillment_contacts
for select to authenticated
using (
  exists (
    select 1
    from public.partner_service_fulfillments fulfillment
    where fulfillment.id = fulfillment_id
      and public.is_partner_user(fulfillment.partner_id)
      and fulfillment.contact_revealed_at is not null
  )
);

create policy partner_service_fulfillment_form_snapshots_partner_read
on public.partner_service_fulfillment_form_snapshots
for select to authenticated
using (
  exists (
    select 1
    from public.partner_service_fulfillments fulfillment
    where fulfillment.id = fulfillment_id
      and public.is_partner_user(fulfillment.partner_id)
      and fulfillment.contact_revealed_at is not null
  )
);

grant usage on schema public, auth to authenticated, service_role;
grant select on public.partner_service_fulfillments to authenticated;
grant select on public.partner_service_fulfillment_contacts to authenticated;
grant select on public.partner_service_fulfillment_form_snapshots to authenticated;
grant all on all tables in schema public to service_role;

create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return nullif(btrim(p_text), '')::uuid;
exception when others then
  return null;
end
$$;

create or replace function public.try_numeric(p_text text)
returns numeric
language plpgsql
immutable
as $$
begin
  return nullif(btrim(p_text), '')::numeric;
exception when others then
  return null;
end
$$;

create or replace function public.match_car_offer_id(p_location text, p_model text)
returns uuid
language sql
stable
as $$
  select offer.id
  from public.car_offers offer
  where lower(offer.location) = lower(p_location)
    and lower(offer.car_model) = lower(p_model)
  order by offer.id
  limit 1;
$$;

create or replace function public.car_booking_rental_days(
  p_pickup_date date,
  p_pickup_time text,
  p_return_date date,
  p_return_time text
)
returns integer
language sql
immutable
as $$
  select ceil(extract(epoch from (
    (p_return_date::text || ' ' || p_return_time)::timestamp
    - (p_pickup_date::text || ' ' || p_pickup_time)::timestamp
  )) / 86400.0)::integer;
$$;

create or replace function public.partner_service_fulfillment_partner_id_for_car_booking(
  p_offer_id uuid,
  p_location text
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select partner.id
  from public.car_offers offer
  join public.partners partner
    on partner.id = offer.owner_partner_id
   and partner.status = 'active'
   and partner.can_manage_cars
  where offer.id = p_offer_id
  limit 1;
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
  v_fulfillment_id uuid;
begin
  insert into public.partner_service_fulfillments (
    partner_id, resource_type, booking_id, resource_id, status,
    reference, summary, start_date, end_date, total_price, currency, created_at
  ) values (
    p_partner_id, p_resource_type, p_booking_id, p_resource_id, 'pending_acceptance',
    p_reference, p_summary, p_start_date, p_end_date, p_total_price,
    coalesce(nullif(p_currency, ''), 'EUR'), coalesce(p_created_at, now())
  )
  on conflict (resource_type, booking_id) where resource_type = 'cars'
  do update set
    partner_id = excluded.partner_id,
    resource_id = excluded.resource_id,
    reference = excluded.reference,
    summary = excluded.summary,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    total_price = excluded.total_price,
    currency = excluded.currency
  returning id into v_fulfillment_id;

  insert into public.partner_service_fulfillment_contacts (
    fulfillment_id, customer_name, customer_email, customer_phone, created_at
  ) values (
    v_fulfillment_id, p_customer_name, p_customer_email, p_customer_phone,
    coalesce(p_created_at, now())
  )
  on conflict (fulfillment_id) do update set
    customer_name = excluded.customer_name,
    customer_email = excluded.customer_email,
    customer_phone = excluded.customer_phone;

  return v_fulfillment_id;
end
$$;

-- Pre-migration trigger contract: the real migration replaces this function.
create or replace function public.trg_partner_service_fulfillment_from_car_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_fulfillment_id uuid;
begin
  v_partner_id := public.partner_service_fulfillment_partner_id_for_car_booking(
    new.offer_id, new.location
  );
  select public.upsert_partner_service_fulfillment_from_booking_with_partner(
    v_partner_id, 'cars', new.id, new.offer_id, new.pickup_date, new.return_date,
    new.total_price, new.currency, new.full_name, new.email, new.phone,
    'CAR-' || left(new.id::text, 8), new.car_model, new.created_at
  ) into v_fulfillment_id;
  insert into public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload)
  values (v_fulfillment_id, '{}'::jsonb)
  on conflict (fulfillment_id) do nothing;
  return new;
end
$$;

create trigger trg_partner_service_fulfillment_from_car_booking_ins
after insert on public.car_bookings
for each row execute function public.trg_partner_service_fulfillment_from_car_booking();

create trigger trg_partner_service_fulfillment_from_car_booking_upd
after update on public.car_bookings
for each row execute function public.trg_partner_service_fulfillment_from_car_booking();

insert into public.partners(id, name, status, can_manage_cars) values
  ('583ee90b-d77c-47ff-97a4-76657a87809f', 'Speed Bikes', 'active', true),
  ('ca2f0000-0000-4000-8000-000000000099', 'Other partner', 'active', true);

insert into public.partner_users(id, partner_id, user_id, role) values
  (
    'ca2f1000-0000-4000-8000-000000000001',
    '583ee90b-d77c-47ff-97a4-76657a87809f',
    '5c3ab931-af5c-4bab-a7ab-9474afab339e',
    'owner'
  );

insert into public.car_offers(id, car_model, location, pricing_strategy, owner_partner_id) values
  (
    '2817e6de-25ba-5237-b721-dbc0460a7de4',
    'Kymco UVX',
    'larnaca',
    'threshold_daily_rate',
    '583ee90b-d77c-47ff-97a4-76657a87809f'
  );

-- Existing pending row lacks exact timing and must be backfilled.
alter table public.car_bookings disable trigger user;
insert into public.car_bookings (
  id, offer_id, status, payment_status, pickup_date, pickup_time,
  return_date, return_time, location, pickup_location, return_location,
  car_model, total_price, quoted_price, final_price, currency, full_name, email, phone,
  base_rental_price, final_rental_price
) values (
  'cffce74a-0617-44a2-b6d8-481043c95d8f',
  '2817e6de-25ba-5237-b721-dbc0460a7de4',
  'pending', 'unpaid', '2026-08-11', '10:00', '2026-08-14', '10:30',
  'larnaca', 'ayia-napa', 'ayia-napa', 'Kymco UVX', 270, 270, 270, 'EUR',
  'Synthetic Customer', 'synthetic@example.test', '+35700000000', 270, 270
);
alter table public.car_bookings enable trigger user;

insert into public.partner_service_fulfillments (
  id, partner_id, resource_type, booking_id, resource_id, status,
  reference, summary, start_date, end_date, total_price, currency, details
) values (
  '1569af6f-f98a-4f1b-95cc-055963c75c98',
  '583ee90b-d77c-47ff-97a4-76657a87809f',
  'cars',
  'cffce74a-0617-44a2-b6d8-481043c95d8f',
  '2817e6de-25ba-5237-b721-dbc0460a7de4',
  'pending_acceptance',
  'CAR-cffce74a', 'Kymco UVX', '2026-08-11', '2026-08-14', 270, 'EUR',
  '{"duration_days":4,"pickup_location":"ayia-napa","return_location":"ayia-napa","base_rental_price":270,"final_rental_price":270}'::jsonb
);

insert into public.partner_service_fulfillment_contacts (
  fulfillment_id, customer_name, customer_email, customer_phone
) values (
  '1569af6f-f98a-4f1b-95cc-055963c75c98',
  'Synthetic Customer', 'synthetic@example.test', '+35700000000'
);

insert into public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload) values (
  '1569af6f-f98a-4f1b-95cc-055963c75c98',
  '{"full_name":"Synthetic Customer","email":"synthetic@example.test"}'::jsonb
);
