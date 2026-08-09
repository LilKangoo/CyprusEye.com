-- car-rental-threshold-daily-rate-precision-v1
-- Additive precision correction for exact-offer threshold daily rates.
-- The final customer-facing base price remains rounded to two EUR decimals.

begin;

do $$
declare
  v_daily_rate_type text;
begin
  if to_regclass('public.car_offer_daily_rate_tiers') is null then
    raise exception using
      errcode = '42P01',
      message = 'car_threshold_daily_rate_precision_required_table_missing';
  end if;

  select format_type(attribute.atttypid, attribute.atttypmod)
  into v_daily_rate_type
  from pg_attribute attribute
  where attribute.attrelid = 'public.car_offer_daily_rate_tiers'::regclass
    and attribute.attname = 'daily_rate'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if v_daily_rate_type not in ('numeric(12,2)', 'numeric(12,6)') then
    raise exception using
      errcode = '42804',
      message = 'car_threshold_daily_rate_precision_unexpected_source_type',
      detail = coalesce(v_daily_rate_type, '<missing>');
  end if;

  if to_regprocedure('public.resolve_car_threshold_daily_rate_quote(uuid,timestamptz,timestamptz,numeric)') is null
     or to_regprocedure(
       'public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)'
     ) is null then
    raise exception using
      errcode = '42883',
      message = 'car_threshold_daily_rate_precision_required_quote_function_missing';
  end if;

  if exists (
    select 1
    from public.site_settings setting
    where setting.car_threshold_daily_rates_enabled is true
       or setting.car_multi_city_mapped_enabled is true
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_daily_rate_precision_requires_inert_flags';
  end if;

  -- numeric(12,6) has six integer digits. Refuse the conversion rather than
  -- narrow an unexpected pre-existing value.
  if exists (
    select 1
    from public.car_offer_daily_rate_tiers tier
    where tier.daily_rate >= 1000000
       or tier.daily_rate <= 0
  ) then
    raise exception using
      errcode = '22003',
      message = 'car_threshold_daily_rate_precision_existing_value_out_of_range';
  end if;
end
$$;

lock table public.car_offer_daily_rate_tiers in access exclusive mode;

alter table public.car_offer_daily_rate_tiers
  alter column daily_rate type numeric(12,6)
  using daily_rate::numeric(12,6);

comment on column public.car_offer_daily_rate_tiers.daily_rate is
  'Exact daily rate stored to six decimals. Final base rental price is ROUND(daily_rate * complete rental days, 2); rates are never blended.';

do $$
declare
  v_daily_rate_type text;
  v_base_quote_source text;
  v_authoritative_quote_source text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
  into v_daily_rate_type
  from pg_attribute attribute
  where attribute.attrelid = 'public.car_offer_daily_rate_tiers'::regclass
    and attribute.attname = 'daily_rate'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if v_daily_rate_type <> 'numeric(12,6)' then
    raise exception using
      errcode = '42804',
      message = 'car_threshold_daily_rate_precision_postcondition_failed';
  end if;

  select procedure.prosrc
  into v_base_quote_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure(
    'public.resolve_car_threshold_daily_rate_quote(uuid,timestamptz,timestamptz,numeric)'
  );

  select procedure.prosrc
  into v_authoritative_quote_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure(
    'public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)'
  );

  -- PostgreSQL function argument metadata does not retain numeric typmods for
  -- TABLE OUT columns. Both functions read the tier row directly, preserve
  -- its six-decimal daily_rate in the snapshot/result, and round only the
  -- multiplied customer amount to two decimals.
  if position('round(v_tier.daily_rate * v_days, 2)' in coalesce(v_base_quote_source, '')) = 0
     or position('v_rental_base := round(v_tier.daily_rate * v_rental_days, 2)' in coalesce(v_authoritative_quote_source, '')) = 0
     or position('''daily_rate'', v_tier.daily_rate' in coalesce(v_authoritative_quote_source, '')) = 0 then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_daily_rate_precision_quote_contract_missing';
  end if;

  if exists (
    select 1
    from public.site_settings setting
    where setting.car_threshold_daily_rates_enabled is true
       or setting.car_multi_city_mapped_enabled is true
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_threshold_daily_rate_precision_changed_feature_flags';
  end if;
end
$$;

commit;
