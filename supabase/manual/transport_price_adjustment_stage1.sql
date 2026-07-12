-- Transport Price 4.0B - draft additive price adjustment foundation.
--
-- DO NOT RUN until Transport Price 4.0A/4.0A-2 results are reviewed and this
-- draft is explicitly approved.
--
-- Intent:
-- - Preserve transport_bookings.total_price as the original quoted total.
-- - Add optional adjusted final total and revision metadata.
-- - Add append-only price adjustment history.
-- - Guard the transport coupon trigger so unrelated adjustment metadata updates
--   do not recalculate total_price, coupon fields or deposit_amount.
-- - Provide an admin-only adjustment RPC.
-- - Provide a role-safe financial summary RPC using confirmed_paid_gross.
--
-- Non-goals:
-- - No service_deposit_requests mutation.
-- - No Stripe mutation.
-- - No refunds.
-- - No affiliate commission or payout mutation.
-- - No partner_service_fulfillments.total_price overwrite.
-- - No top-up payment model.

begin;

do $$
begin
  if to_regclass('public.transport_bookings') is null then
    raise exception 'Missing required table public.transport_bookings';
  end if;

  if to_regclass('public.service_deposit_requests') is null then
    raise exception 'Missing required table public.service_deposit_requests';
  end if;

  if to_regclass('public.partner_service_fulfillments') is null then
    raise exception 'Missing required table public.partner_service_fulfillments';
  end if;

  if to_regclass('public.affiliate_commission_events') is null then
    raise exception 'Missing required table public.affiliate_commission_events';
  end if;

  if to_regclass('public.affiliate_payouts') is null then
    raise exception 'Missing required table public.affiliate_payouts';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;

  if to_regprocedure('auth.uid()') is null then
    raise exception 'Missing required auth helper auth.uid()';
  end if;
end $$;

alter table public.transport_bookings
  add column if not exists adjusted_total_price numeric(12,2),
  add column if not exists price_revision integer not null default 0,
  add column if not exists price_adjusted_at timestamptz;

alter table public.transport_bookings
  drop constraint if exists transport_bookings_adjusted_total_price_check;

alter table public.transport_bookings
  add constraint transport_bookings_adjusted_total_price_check
  check (adjusted_total_price is null or adjusted_total_price > 0);

alter table public.transport_bookings
  drop constraint if exists transport_bookings_price_revision_check;

alter table public.transport_bookings
  add constraint transport_bookings_price_revision_check
  check (price_revision >= 0);

create table if not exists public.transport_booking_price_adjustments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.transport_bookings(id) on delete cascade,
  original_total_price numeric(12,2) not null,
  previous_effective_total numeric(12,2) not null,
  new_effective_total numeric(12,2) not null,
  currency text not null,
  previous_revision integer not null,
  new_revision integer not null,
  internal_reason text not null,
  customer_note text,
  adjusted_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint transport_booking_price_adjustments_amounts_check
    check (
      original_total_price > 0
      and previous_effective_total > 0
      and new_effective_total > 0
    ),
  constraint transport_booking_price_adjustments_revision_check
    check (
      previous_revision >= 0
      and new_revision = previous_revision + 1
    ),
  constraint transport_booking_price_adjustments_reason_check
    check (length(btrim(internal_reason)) between 3 and 2000),
  constraint transport_booking_price_adjustments_customer_note_check
    check (customer_note is null or length(customer_note) <= 1000),
  constraint transport_booking_price_adjustments_currency_check
    check (length(nullif(btrim(currency), '')) between 3 and 12)
);

create unique index if not exists transport_booking_price_adjustments_booking_revision_uidx
  on public.transport_booking_price_adjustments (booking_id, new_revision);

create unique index if not exists transport_booking_price_adjustments_idempotency_uidx
  on public.transport_booking_price_adjustments (idempotency_key);

create index if not exists transport_booking_price_adjustments_booking_created_idx
  on public.transport_booking_price_adjustments (booking_id, created_at desc);

alter table public.transport_booking_price_adjustments enable row level security;

drop policy if exists transport_booking_price_adjustments_admin_select
  on public.transport_booking_price_adjustments;

create policy transport_booking_price_adjustments_admin_select
  on public.transport_booking_price_adjustments
  for select
  to authenticated
  using (public.is_current_user_admin());

revoke all on table public.transport_booking_price_adjustments from public;
revoke all on table public.transport_booking_price_adjustments from anon;
revoke all on table public.transport_booking_price_adjustments from authenticated;
grant select on table public.transport_booking_price_adjustments to authenticated;

-- Guarded replacement of the existing coupon trigger function.
-- INSERT behavior remains unchanged. UPDATE returns immediately when none of
-- the quote/coupon source columns used by the function changed.
create or replace function public.trg_apply_service_coupon_transport_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(NEW.coupon_code, '')));
  v_base numeric;
  v_quote record;
  v_origin_name text;
  v_origin_code text;
  v_destination_name text;
  v_destination_code text;
  v_service_at timestamptz;
  v_categories text[];
begin
  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  if TG_OP = 'UPDATE'
     and NEW.total_price is not distinct from OLD.total_price
     and NEW.base_price is not distinct from OLD.base_price
     and NEW.extras_price is not distinct from OLD.extras_price
     and NEW.coupon_id is not distinct from OLD.coupon_id
     and NEW.coupon_code is not distinct from OLD.coupon_code
     and NEW.coupon_discount_amount is not distinct from OLD.coupon_discount_amount
     and NEW.coupon_partner_id is not distinct from OLD.coupon_partner_id
     and NEW.coupon_partner_commission_bps is not distinct from OLD.coupon_partner_commission_bps
     and NEW.route_id is not distinct from OLD.route_id
     and NEW.travel_date is not distinct from OLD.travel_date
     and NEW.customer_email is not distinct from OLD.customer_email
     and NEW.deposit_amount is not distinct from OLD.deposit_amount
  then
    return NEW;
  end if;

  v_base := round(greatest(coalesce(
    NEW.total_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.base_price + coalesce(NEW.extras_price, 0),
    NEW.total_price,
    0
  ), 0), 2);

  if v_code = '' and NEW.coupon_id is not null then
    select upper(trim(coalesce(code, '')))
    into v_code
    from public.service_coupons
    where id = NEW.coupon_id
      and service_type = 'transport'
    limit 1;
  end if;

  if v_code = '' then
    NEW.coupon_id := null;
    NEW.coupon_code := null;
    NEW.coupon_discount_amount := 0;
    NEW.coupon_partner_id := null;
    NEW.coupon_partner_commission_bps := null;
    NEW.total_price := coalesce(NEW.total_price, v_base);
    if NEW.deposit_amount is not null then
      NEW.deposit_amount := round(least(greatest(NEW.deposit_amount, 0), coalesce(NEW.total_price, 0)), 2);
    end if;
    return NEW;
  end if;

  if NEW.route_id is not null then
    select
      lo.name,
      lo.code,
      ld.name,
      ld.code
    into v_origin_name, v_origin_code, v_destination_name, v_destination_code
    from public.transport_routes r
    left join public.transport_locations lo on lo.id = r.origin_location_id
    left join public.transport_locations ld on ld.id = r.destination_location_id
    where r.id = NEW.route_id
    limit 1;
  end if;

  v_categories := array_remove(array[
    lower(nullif(v_origin_name, '')),
    lower(nullif(v_origin_code, '')),
    lower(nullif(v_destination_name, '')),
    lower(nullif(v_destination_code, ''))
  ], null);

  v_service_at := coalesce(
    NEW.travel_date::timestamptz,
    NEW.created_at,
    now()
  );

  select *
  into v_quote
  from public.service_coupon_quote(
    'transport',
    v_code,
    v_base,
    v_service_at,
    NEW.route_id,
    v_categories,
    public.try_uuid(to_jsonb(NEW)->>'user_id'),
    NEW.customer_email
  );

  if coalesce(v_quote.is_valid, false) is not true then
    raise exception '%', coalesce(v_quote.message, 'Invalid coupon');
  end if;

  NEW.coupon_id := v_quote.coupon_id;
  NEW.coupon_code := v_quote.coupon_code;
  NEW.coupon_discount_amount := round(coalesce(v_quote.discount_amount, 0), 2);
  NEW.coupon_partner_id := v_quote.partner_id;
  NEW.coupon_partner_commission_bps := v_quote.partner_commission_bps_override;
  NEW.total_price := round(coalesce(v_quote.final_total, v_base), 2);
  if NEW.deposit_amount is not null then
    NEW.deposit_amount := round(least(greatest(NEW.deposit_amount, 0), NEW.total_price), 2);
  end if;

  return NEW;
end;
$$;

-- Guarded replacement of coupon-redemption sync. Adjustment metadata updates
-- must not rewrite service_coupon_redemptions.
create or replace function public.trg_service_coupon_redemption_from_transport_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_base numeric;
  v_discount numeric;
  v_final numeric;
  v_user_id uuid;
  v_source text;
  v_currency text;
begin
  if TG_OP = 'DELETE' then
    delete from public.service_coupon_redemptions
    where service_type = 'transport'
      and booking_id = OLD.id;
    return OLD;
  end if;

  if TG_OP = 'UPDATE'
     and NEW.total_price is not distinct from OLD.total_price
     and NEW.base_price is not distinct from OLD.base_price
     and NEW.extras_price is not distinct from OLD.extras_price
     and NEW.coupon_id is not distinct from OLD.coupon_id
     and NEW.coupon_code is not distinct from OLD.coupon_code
     and NEW.coupon_discount_amount is not distinct from OLD.coupon_discount_amount
     and NEW.customer_email is not distinct from OLD.customer_email
     and NEW.currency is not distinct from OLD.currency
  then
    return NEW;
  end if;

  if NEW.coupon_id is null then
    delete from public.service_coupon_redemptions
    where service_type = 'transport'
      and booking_id = NEW.id;
    return NEW;
  end if;

  v_email := lower(trim(coalesce(NEW.customer_email, '')));
  v_base := coalesce(
    NEW.total_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.base_price + coalesce(NEW.extras_price, 0),
    NEW.total_price
  );
  v_discount := coalesce(
    NEW.coupon_discount_amount,
    greatest(coalesce(v_base, 0) - coalesce(NEW.total_price, 0), 0)
  );
  v_final := coalesce(
    NEW.total_price,
    greatest(coalesce(v_base, 0) - coalesce(v_discount, 0), 0)
  );
  v_user_id := public.try_uuid(to_jsonb(NEW)->>'user_id');
  v_source := case
    when lower(coalesce(to_jsonb(NEW)->>'source', '')) like 'admin%' then 'admin'
    else 'booking'
  end;
  v_currency := coalesce(nullif(NEW.currency, ''), 'EUR');

  delete from public.service_coupon_redemptions
  where service_type = 'transport'
    and booking_id = NEW.id
    and coupon_id <> NEW.coupon_id;

  insert into public.service_coupon_redemptions(
    coupon_id,
    service_type,
    booking_id,
    booking_reference,
    user_id,
    user_email,
    base_total,
    discount_amount,
    final_total,
    currency,
    source
  )
  values (
    NEW.coupon_id,
    'transport',
    NEW.id,
    concat('TRANSPORT-', substring(NEW.id::text, 1, 8)),
    v_user_id,
    nullif(v_email, ''),
    round(coalesce(v_base, 0), 2),
    round(coalesce(v_discount, 0), 2),
    round(coalesce(v_final, 0), 2),
    v_currency,
    v_source
  )
  on conflict (coupon_id, booking_id)
  do update set
    service_type = excluded.service_type,
    booking_reference = excluded.booking_reference,
    user_id = excluded.user_id,
    user_email = excluded.user_email,
    base_total = excluded.base_total,
    discount_amount = excluded.discount_amount,
    final_total = excluded.final_total,
    currency = excluded.currency,
    source = excluded.source;

  return NEW;
end;
$$;

-- Guarded replacement of the coupon-to-fulfillment sync trigger function.
-- It must not touch partner_service_fulfillments when only price adjustment
-- metadata changes on transport_bookings.
create or replace function public.trg_sync_transport_coupon_to_fulfillment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  if TG_OP = 'UPDATE'
     and NEW.total_price is not distinct from OLD.total_price
     and NEW.base_price is not distinct from OLD.base_price
     and NEW.extras_price is not distinct from OLD.extras_price
     and NEW.coupon_id is not distinct from OLD.coupon_id
     and NEW.coupon_code is not distinct from OLD.coupon_code
     and NEW.coupon_discount_amount is not distinct from OLD.coupon_discount_amount
  then
    return NEW;
  end if;

  update public.partner_service_fulfillments f
  set
    total_price = NEW.total_price,
    details = jsonb_strip_nulls(
      coalesce(f.details, '{}'::jsonb)
      || jsonb_build_object(
        'coupon_id', NEW.coupon_id,
        'coupon_code', NEW.coupon_code,
        'coupon_discount_amount', NEW.coupon_discount_amount,
        'base_price', NEW.base_price,
        'extras_price', NEW.extras_price,
        'final_price', NEW.total_price
      )
    ),
    updated_at = now()
  where f.resource_type = 'transport'
    and f.booking_id = NEW.id;

  return NEW;
end;
$$;

create or replace function public.transport_booking_financial_summary_core(p_booking_id uuid)
returns table (
  booking_id uuid,
  original_total numeric,
  adjusted_total numeric,
  effective_total numeric,
  currency text,
  confirmed_paid_gross numeric,
  balance_due numeric,
  overpayment numeric,
  refund_review_required boolean,
  price_revision integer,
  price_adjusted_at timestamptz,
  derived_payment_state text
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  with booking as (
    select
      tb.id,
      coalesce(tb.total_price, 0)::numeric(12,2) as original_total,
      tb.adjusted_total_price::numeric(12,2) as adjusted_total,
      coalesce(tb.adjusted_total_price, tb.total_price, 0)::numeric(12,2) as effective_total,
      coalesce(nullif(tb.currency, ''), 'EUR')::text as currency,
      coalesce(tb.price_revision, 0)::integer as price_revision,
      tb.price_adjusted_at
    from public.transport_bookings tb
    where tb.id = p_booking_id
  ),
  paid as (
    select
      coalesce(sum(r.amount) filter (
        where r.resource_type in ('transport', 'transports', 'transfer', 'transfers')
          and r.status = 'paid'
          and r.paid_at is not null
      ), 0)::numeric(12,2) as confirmed_paid_gross
    from public.service_deposit_requests r
    where r.booking_id = p_booking_id
  )
  select
    b.id as booking_id,
    b.original_total,
    b.adjusted_total,
    b.effective_total,
    b.currency,
    p.confirmed_paid_gross,
    greatest(b.effective_total - p.confirmed_paid_gross, 0)::numeric(12,2) as balance_due,
    greatest(p.confirmed_paid_gross - b.effective_total, 0)::numeric(12,2) as overpayment,
    (p.confirmed_paid_gross > b.effective_total) as refund_review_required,
    b.price_revision,
    b.price_adjusted_at,
    case
      when p.confirmed_paid_gross > b.effective_total then 'overpaid_refund_review'
      when p.confirmed_paid_gross = b.effective_total and b.effective_total > 0 then 'paid_in_full'
      when p.confirmed_paid_gross > 0 and p.confirmed_paid_gross < b.effective_total then 'partially_paid'
      when b.effective_total > 0 then 'unpaid'
      else 'unknown'
    end as derived_payment_state
  from booking b
  cross join paid p;
$$;

revoke all on function public.transport_booking_financial_summary_core(uuid) from public;
revoke all on function public.transport_booking_financial_summary_core(uuid) from anon;
revoke all on function public.transport_booking_financial_summary_core(uuid) from authenticated;

create or replace function public.get_transport_booking_financial_summary(p_booking_id uuid)
returns table (
  booking_id uuid,
  original_total numeric,
  adjusted_total numeric,
  effective_total numeric,
  currency text,
  confirmed_paid_gross numeric,
  balance_due numeric,
  overpayment numeric,
  refund_review_required boolean,
  price_revision integer,
  price_adjusted_at timestamptz,
  derived_payment_state text,
  latest_customer_note text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_allowed boolean := false;
begin
  if p_booking_id is null then
    raise exception 'missing_booking_id';
  end if;

  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if coalesce(public.is_current_user_admin(), false) then
    v_allowed := true;
  end if;

  if not v_allowed then
    select lower(trim(coalesce(p.email, '')))
    into v_email
    from public.profiles p
    where p.id = v_uid
    limit 1;

    select exists (
      select 1
      from public.transport_bookings tb
      where tb.id = p_booking_id
        and lower(trim(coalesce(tb.customer_email, ''))) = v_email
    )
    into v_allowed;
  end if;

  if not v_allowed then
    select exists (
      select 1
      from public.partner_service_fulfillments f
      where f.resource_type in ('transport', 'transports', 'transfer', 'transfers')
        and f.booking_id = p_booking_id
        and public.is_partner_user(f.partner_id)
    )
    into v_allowed;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    s.booking_id,
    s.original_total,
    s.adjusted_total,
    s.effective_total,
    s.currency,
    s.confirmed_paid_gross,
    s.balance_due,
    s.overpayment,
    s.refund_review_required,
    s.price_revision,
    s.price_adjusted_at,
    s.derived_payment_state,
    (
      select a.customer_note
      from public.transport_booking_price_adjustments a
      where a.booking_id = s.booking_id
        and a.customer_note is not null
      order by a.created_at desc
      limit 1
    ) as latest_customer_note
  from public.transport_booking_financial_summary_core(p_booking_id) s;
end;
$$;

revoke all on function public.get_transport_booking_financial_summary(uuid) from public;
revoke all on function public.get_transport_booking_financial_summary(uuid) from anon;
grant execute on function public.get_transport_booking_financial_summary(uuid) to authenticated;

create or replace function public.admin_get_transport_booking_price_adjustments(p_booking_id uuid)
returns table (
  id uuid,
  booking_id uuid,
  original_total_price numeric,
  previous_effective_total numeric,
  new_effective_total numeric,
  currency text,
  previous_revision integer,
  new_revision integer,
  internal_reason text,
  customer_note text,
  adjusted_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    a.id,
    a.booking_id,
    a.original_total_price,
    a.previous_effective_total,
    a.new_effective_total,
    a.currency,
    a.previous_revision,
    a.new_revision,
    a.internal_reason,
    a.customer_note,
    a.adjusted_by,
    a.created_at
  from public.transport_booking_price_adjustments a
  where a.booking_id = p_booking_id
  order by a.created_at desc, a.id desc;
end;
$$;

revoke all on function public.admin_get_transport_booking_price_adjustments(uuid) from public;
revoke all on function public.admin_get_transport_booking_price_adjustments(uuid) from anon;
grant execute on function public.admin_get_transport_booking_price_adjustments(uuid) to authenticated;

create or replace function public.admin_adjust_transport_booking_price(
  p_booking_id uuid,
  p_new_total numeric,
  p_reason text,
  p_customer_note text,
  p_expected_revision integer,
  p_idempotency_key uuid
)
returns table (
  adjustment_id uuid,
  booking_id uuid,
  original_total numeric,
  adjusted_total numeric,
  effective_total numeric,
  currency text,
  confirmed_paid_gross numeric,
  balance_due numeric,
  overpayment numeric,
  refund_review_required boolean,
  price_revision integer,
  price_adjusted_at timestamptz,
  derived_payment_state text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.transport_bookings%rowtype;
  v_previous_effective numeric(12,2);
  v_new_total numeric(12,2);
  v_reason text := btrim(coalesce(p_reason, ''));
  v_customer_note text := nullif(btrim(coalesce(p_customer_note, '')), '');
  v_adjustment_id uuid;
  v_existing public.transport_booking_price_adjustments%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'not_authorized';
  end if;

  if p_booking_id is null then
    raise exception 'missing_booking_id';
  end if;

  if p_idempotency_key is null then
    raise exception 'missing_idempotency_key';
  end if;

  if length(v_reason) < 3 then
    raise exception 'adjustment_reason_required';
  end if;

  if length(v_reason) > 2000 then
    raise exception 'adjustment_reason_too_long';
  end if;

  if v_customer_note is not null and length(v_customer_note) > 1000 then
    raise exception 'customer_note_too_long';
  end if;

  if p_new_total is null or p_new_total <= 0 then
    raise exception 'new_total_must_be_positive';
  end if;

  v_new_total := round(p_new_total, 2);

  select *
  into v_booking
  from public.transport_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'transport_booking_not_found';
  end if;

  select *
  into v_existing
  from public.transport_booking_price_adjustments
  where idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if v_existing.booking_id <> p_booking_id then
      raise exception 'idempotency_key_conflict';
    end if;

    return query
    select
      v_existing.id as adjustment_id,
      s.booking_id,
      s.original_total,
      s.adjusted_total,
      s.effective_total,
      s.currency,
      s.confirmed_paid_gross,
      s.balance_due,
      s.overpayment,
      s.refund_review_required,
      s.price_revision,
      s.price_adjusted_at,
      s.derived_payment_state,
      true as idempotent_replay
    from public.transport_booking_financial_summary_core(p_booking_id) s;
    return;
  end if;

  if coalesce(v_booking.price_revision, 0) <> coalesce(p_expected_revision, -1) then
    raise exception 'price_revision_mismatch';
  end if;

  v_previous_effective := round(coalesce(v_booking.adjusted_total_price, v_booking.total_price), 2);

  if v_previous_effective = v_new_total then
    raise exception 'price_adjustment_noop';
  end if;

  insert into public.transport_booking_price_adjustments (
    booking_id,
    original_total_price,
    previous_effective_total,
    new_effective_total,
    currency,
    previous_revision,
    new_revision,
    internal_reason,
    customer_note,
    adjusted_by,
    idempotency_key
  ) values (
    v_booking.id,
    round(coalesce(v_booking.total_price, 0), 2),
    v_previous_effective,
    v_new_total,
    coalesce(nullif(v_booking.currency, ''), 'EUR'),
    coalesce(v_booking.price_revision, 0),
    coalesce(v_booking.price_revision, 0) + 1,
    v_reason,
    v_customer_note,
    v_uid,
    p_idempotency_key
  )
  returning id into v_adjustment_id;

  update public.transport_bookings
  set
    adjusted_total_price = v_new_total,
    price_revision = coalesce(price_revision, 0) + 1,
    price_adjusted_at = now(),
    updated_at = now()
  where id = v_booking.id;

  return query
  select
    v_adjustment_id as adjustment_id,
    s.booking_id,
    s.original_total,
    s.adjusted_total,
    s.effective_total,
    s.currency,
    s.confirmed_paid_gross,
    s.balance_due,
    s.overpayment,
    s.refund_review_required,
    s.price_revision,
    s.price_adjusted_at,
    s.derived_payment_state,
    false as idempotent_replay
  from public.transport_booking_financial_summary_core(p_booking_id) s;
end;
$$;

revoke all on function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) from public;
revoke all on function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) from anon;
grant execute on function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) to authenticated;

comment on column public.transport_bookings.adjusted_total_price is
  'Optional admin-adjusted final customer total. Does not replace original quoted total_price.';
comment on column public.transport_bookings.price_revision is
  'Optimistic revision counter for admin transport price adjustments.';
comment on column public.transport_bookings.price_adjusted_at is
  'Timestamp of the latest admin transport price adjustment.';
comment on table public.transport_booking_price_adjustments is
  'Append-only audit history for admin transport final price adjustments. Does not store payment secrets or participant PII.';
comment on function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) is
  'Admin-only transport final price adjustment. Does not mutate payments, Stripe objects, refunds, commissions, payouts or fulfillment total_price snapshots.';
comment on function public.get_transport_booking_financial_summary(uuid) is
  'Role-safe transport financial summary using confirmed_paid_gross from paid service_deposit_requests and no refund subtraction until a transport/service refund ledger exists.';

commit;
