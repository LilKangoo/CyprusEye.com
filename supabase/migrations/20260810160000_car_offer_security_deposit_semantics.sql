begin;

do $$
declare
  v_type text;
  v_negative_count bigint;
  v_constraint_definition text;
begin
  if to_regclass('public.car_offers') is null then
    raise exception using errcode = '42P01', message = 'car_offers_required_for_security_deposit_semantics';
  end if;

  select format_type(attribute.atttypid, attribute.atttypmod)
  into v_type
  from pg_attribute attribute
  where attribute.attrelid = 'public.car_offers'::regclass
    and attribute.attname = 'deposit_amount'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if v_type is null or v_type not like 'numeric%'
  then
    raise exception using
      errcode = '42804',
      message = 'car_offers_deposit_amount_numeric_column_required',
      detail = coalesce(v_type, 'missing');
  end if;

  execute 'select count(*) from public.car_offers where deposit_amount < 0'
  into v_negative_count;

  if v_negative_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'negative_car_security_deposit_values_require_review',
      detail = format('negative_rows=%s', v_negative_count);
  end if;

  select pg_get_constraintdef(constraint_row.oid, true)
  into v_constraint_definition
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.car_offers'::regclass
    and constraint_row.conname = 'car_offers_security_deposit_amount_nonnegative';

  if v_constraint_definition is not null
     and lower(regexp_replace(v_constraint_definition, '[[:space:]]+', ' ', 'g'))
       not like '%deposit_amount is null%deposit_amount >= 0%'
  then
    raise exception using
      errcode = '23514',
      message = 'unexpected_existing_car_security_deposit_constraint',
      detail = v_constraint_definition;
  end if;
end
$$;

alter table public.car_offers
  alter column deposit_amount drop default,
  alter column deposit_amount drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.car_offers'::regclass
      and constraint_row.conname = 'car_offers_security_deposit_amount_nonnegative'
  ) then
    alter table public.car_offers
      add constraint car_offers_security_deposit_amount_nonnegative
      check (deposit_amount is null or deposit_amount >= 0);
  end if;
end
$$;

comment on column public.car_offers.deposit_amount is
  'Refundable vehicle security/damage deposit for this exact offer. NULL = not specified, 0 = explicitly no security deposit, positive = refundable amount in offer currency. Never used as payment due at booking; service_deposit_rules and service_deposit_overrides remain authoritative for part-payment.';

commit;
