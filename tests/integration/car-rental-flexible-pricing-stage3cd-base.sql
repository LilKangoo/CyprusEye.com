-- Stage 3C/3D additions for the isolated PostgreSQL/PostgREST fixture only.
-- Synthetic schema and workflow; no production data or credentials.

begin;

-- Supabase exposes auth.jwt() in production. The standalone PostgREST fixture
-- provides the same read-only claim accessor so authoritative quote checks run
-- under the real JWT role/user context rather than a service-only shortcut.
create schema if not exists auth;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;

alter table public.car_bookings
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists car_model text,
  add column if not exists pickup_time time without time zone default '10:00',
  add column if not exists return_time time without time zone default '10:00',
  add column if not exists full_insurance boolean default false,
  add column if not exists young_driver boolean default false,
  add column if not exists base_rental_price numeric(12,2),
  add column if not exists final_rental_price numeric(12,2),
  add column if not exists coupon_id uuid,
  add column if not exists coupon_code text,
  add column if not exists coupon_discount_amount numeric(12,2) default 0,
  add column if not exists coupon_partner_id uuid,
  add column if not exists coupon_partner_commission_bps integer;

drop policy if exists car_bookings_public_insert on public.car_bookings;
create policy car_bookings_public_insert
on public.car_bookings
for insert
to anon, authenticated
with check (coalesce(status, 'pending') = 'pending');

grant insert on table public.car_bookings to anon, authenticated;

-- Deterministic coupon oracle for the isolated authoritative-pricing gate.
-- SAVE10 is a 10% coupon; all other non-empty values fail closed.
create or replace function public.car_coupon_quote(
  p_coupon_code text,
  p_base_rental_price numeric,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_offer_id uuid default null,
  p_location text default null,
  p_car_model text default null,
  p_car_type text default null,
  p_user_id uuid default auth.uid(),
  p_user_email text default null
)
returns table (
  is_valid boolean,
  message text,
  coupon_id uuid,
  coupon_code text,
  discount_type text,
  discount_value numeric,
  base_rental_price numeric,
  discount_amount numeric,
  final_rental_price numeric,
  currency text,
  partner_id uuid,
  partner_commission_bps_override integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_code text := upper(btrim(coalesce(p_coupon_code, '')));
  v_discount numeric(12,2);
begin
  is_valid := v_code = 'SAVE10'
    and p_offer_id is not null
    and p_base_rental_price > 0
    and p_return_at > p_pickup_at;
  message := case when is_valid then 'Coupon applied' else 'Invalid coupon' end;
  coupon_id := case when is_valid then 'ca3c0000-0000-4000-8000-000000000010'::uuid else null end;
  coupon_code := case when is_valid then 'SAVE10' else null end;
  discount_type := case when is_valid then 'percent' else null end;
  discount_value := case when is_valid then 10 else null end;
  base_rental_price := case when is_valid then round(p_base_rental_price, 2) else null end;
  v_discount := case when is_valid then round(p_base_rental_price * 0.10, 2) else 0 end;
  discount_amount := v_discount;
  final_rental_price := case when is_valid then round(p_base_rental_price - v_discount, 2) else null end;
  currency := 'EUR';
  partner_id := null;
  partner_commission_bps_override := null;
  return next;
end
$$;

revoke all on function public.car_coupon_quote(text,numeric,timestamptz,timestamptz,uuid,text,text,text,uuid,text) from public;
grant execute on function public.car_coupon_quote(text,numeric,timestamptz,timestamptz,uuid,text,text,text,uuid,text) to anon, authenticated, service_role;

-- Isolated representation of the existing exact-offer partner workflow. A
-- request creates pending_acceptance only; neither quote validity nor payment
-- is allowed to accept it automatically.
create or replace function public.stage3cd_create_pending_partner_fulfillment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_partner_id uuid;
begin
  select coalesce(offer.owner_partner_id, resource.partner_id)
  into v_partner_id
  from public.car_offers offer
  left join lateral (
    select assignment.partner_id
    from public.partner_resources assignment
    where assignment.resource_type = 'cars'
      and assignment.resource_id = offer.id
    order by assignment.created_at, assignment.id
    limit 1
  ) resource on true
  where offer.id = new.offer_id;

  if v_partner_id is not null then
    insert into public.partner_service_fulfillments (
      partner_id,
      resource_type,
      booking_id,
      resource_id,
      status
    ) values (
      v_partner_id,
      'cars',
      new.id,
      new.offer_id,
      'pending_acceptance'
    );
  end if;
  return new;
end
$$;

drop trigger if exists stage3cd_create_pending_partner_fulfillment
on public.car_bookings;
create trigger stage3cd_create_pending_partner_fulfillment
after insert on public.car_bookings
for each row execute function public.stage3cd_create_pending_partner_fulfillment();

revoke all on function public.stage3cd_create_pending_partner_fulfillment() from public, anon, authenticated;
grant execute on function public.stage3cd_create_pending_partner_fulfillment() to service_role;

commit;
