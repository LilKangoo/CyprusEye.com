begin;

-- A successful service-deposit payment updates only financial payment state.
-- Partner acceptance remains an independent, authoritative workflow and this
-- migration never promotes a Cars booking to confirmed. Existing booking rows
-- are not backfilled or modified by this migration.

do $$
begin
  if to_regclass('public.service_deposit_requests') is null
     or to_regclass('public.car_bookings') is null
     or to_regclass('public.transport_bookings') is null then
    raise exception using
      errcode = '42P01',
      message = 'car_partial_payment_required_object_missing';
  end if;
  if to_regprocedure('public.try_numeric(text)') is null then
    raise exception using
      errcode = '42883',
      message = 'car_partial_payment_try_numeric_missing';
  end if;

  if exists (
    select 1
    from unnest(array[
      'car_bookings.id',
      'car_bookings.status',
      'car_bookings.payment_status',
      'service_deposit_requests.resource_type',
      'service_deposit_requests.booking_id',
      'service_deposit_requests.amount',
      'service_deposit_requests.status',
      'service_deposit_requests.paid_at',
      'transport_bookings.id',
      'transport_bookings.status',
      'transport_bookings.payment_status',
      'transport_bookings.paid_at'
    ]::text[]) required(contract)
    where not exists (
      select 1
      from information_schema.columns column_contract
      where column_contract.table_schema = 'public'
        and column_contract.table_name = split_part(required.contract, '.', 1)
        and column_contract.column_name = split_part(required.contract, '.', 2)
    )
  ) then
    raise exception using
      errcode = '42703',
      message = 'car_partial_payment_required_column_missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_contract
    where trigger_contract.tgrelid = 'public.service_deposit_requests'::regclass
      and trigger_contract.tgname = 'trg_sync_car_booking_status_from_deposit_paid'
      and not trigger_contract.tgisinternal
  ) then
    raise exception using
      errcode = '42704',
      message = 'car_partial_payment_status_trigger_missing';
  end if;
end
$$;

create or replace function public.sync_car_booking_status_from_deposit_paid()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_booking jsonb;
  v_total numeric;
  v_payment_status text;
begin
  if new.resource_type not in ('cars', 'transport')
     or new.booking_id is null
     or (coalesce(new.status, '') <> 'paid' and new.paid_at is null) then
    return new;
  end if;

  if new.resource_type = 'cars' then
    select to_jsonb(booking) into v_booking
    from public.car_bookings booking
    where booking.id = new.booking_id;

    if not found then return new; end if;

    v_total := coalesce(
      public.try_numeric(v_booking ->> 'final_price'),
      public.try_numeric(v_booking ->> 'total_price'),
      public.try_numeric(v_booking ->> 'quoted_price')
    );

    -- Unknown legacy totals retain the old paid classification. A known total
    -- is paid in full only when the captured amount covers it.
    v_payment_status := case
      when v_total is not null
       and v_total > 0
       and round(coalesce(new.amount, 0), 2) < round(v_total, 2)
        then 'partial'
      else 'paid'
    end;

    update public.car_bookings booking
    set payment_status = v_payment_status
    where booking.id = new.booking_id;

    return new;
  end if;

  -- Transport semantics remain byte-for-byte equivalent to the prior trigger.
  update public.transport_bookings booking
  set
    payment_status = 'paid',
    paid_at = coalesce(booking.paid_at, new.paid_at, now()),
    status = case
      when coalesce(booking.status, '') in ('pending', 'awaiting_payment') then 'confirmed'
      else booking.status
    end
  where booking.id = new.booking_id;

  return new;
end
$$;

revoke all on function public.sync_car_booking_status_from_deposit_paid() from public, anon, authenticated;
grant execute on function public.sync_car_booking_status_from_deposit_paid() to service_role;

commit;
