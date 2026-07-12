-- Transport Price 4.0B RPC ambiguity hotfix.
-- Minimal repair for PostgreSQL 42702 in admin_adjust_transport_booking_price.
-- Does not modify bookings, payments, Stripe objects, refunds, commissions, payouts or fulfillment totals.

begin;

do $$
begin
  if to_regprocedure('public.admin_adjust_transport_booking_price(uuid,numeric,text,text,integer,uuid)') is null then
    raise exception 'missing public.admin_adjust_transport_booking_price(uuid,numeric,text,text,integer,uuid)';
  end if;
end;
$$;

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
  v_current_price_revision integer;
  v_new_price_revision integer;
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

  select tb.*
  into v_booking
  from public.transport_bookings tb
  where tb.id = p_booking_id
  for update;

  if not found then
    raise exception 'transport_booking_not_found';
  end if;

  select a.*
  into v_existing
  from public.transport_booking_price_adjustments a
  where a.idempotency_key = p_idempotency_key
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

  v_current_price_revision := coalesce(v_booking.price_revision, 0);
  v_new_price_revision := v_current_price_revision + 1;

  if v_current_price_revision <> coalesce(p_expected_revision, -1) then
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
    v_current_price_revision,
    v_new_price_revision,
    v_reason,
    v_customer_note,
    v_uid,
    p_idempotency_key
  )
  returning id into v_adjustment_id;

  update public.transport_bookings tb
  set
    adjusted_total_price = v_new_total,
    price_revision = v_new_price_revision,
    price_adjusted_at = now(),
    updated_at = now()
  where tb.id = v_booking.id;

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

alter function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) owner to postgres;
revoke all on function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) from public;
revoke all on function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) from anon;
grant execute on function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) to authenticated;

comment on function public.admin_adjust_transport_booking_price(uuid, numeric, text, text, integer, uuid) is
  'Admin-only transport final price adjustment. Does not mutate payments, Stripe objects, refunds, commissions, payouts or fulfillment total_price snapshots.';

commit;
