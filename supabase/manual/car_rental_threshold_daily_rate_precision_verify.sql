-- car-rental-threshold-daily-rate-precision-verify-v1
-- READ ONLY. Run after 20260810120000_car_rental_threshold_daily_rate_precision.sql.
-- Returns exactly one summary row.

with
column_state as (
  select exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = to_regclass('public.car_offer_daily_rate_tiers')
      and attribute.attname = 'daily_rate'
      and attribute.attnum > 0
      and not attribute.attisdropped
      and format_type(attribute.atttypid, attribute.atttypmod) = 'numeric(12,6)'
      and attribute.attnotnull
  ) as daily_rate_numeric_12_6
),
function_state as (
  select
    coalesce((
      select position('round(v_tier.daily_rate * v_days, 2)' in procedure.prosrc) > 0
      from pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.resolve_car_threshold_daily_rate_quote(uuid,timestamptz,timestamptz,numeric)'
      )
    ), false) as base_quote_rounds_after_multiplication,
    coalesce((
      select position('v_rental_base := round(v_tier.daily_rate * v_rental_days, 2)' in procedure.prosrc) > 0
        and position('''daily_rate'', v_tier.daily_rate' in procedure.prosrc) > 0
      from pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)'
      )
    ), false) as authoritative_quote_preserves_rate_and_rounds_total
),
flag_state as (
  select
    count(*)::integer as canonical_setting_count,
    coalesce(bool_or(car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings
),
tier_state as (
  select
    count(*)::integer as tier_count,
    count(*) filter (where daily_rate <= 0 or daily_rate >= 1000000)::integer as invalid_rate_count
  from public.car_offer_daily_rate_tiers
),
parity_oracle as (
  select
    round(93.333333::numeric(12,6) * 3, 2) = 280.00::numeric as repeating_280_over_3_matches,
    round(5.285714::numeric(12,6) * 7, 2) = 37.00::numeric as repeating_37_over_7_matches,
    round(50.000000::numeric(12,6) * 4, 2) = 200.00::numeric as ordinary_rate_matches
)
select
  columns.daily_rate_numeric_12_6,
  functions.base_quote_rounds_after_multiplication,
  functions.authoritative_quote_preserves_rate_and_rounds_total,
  flags.canonical_setting_count,
  flags.mapped_enabled as car_multi_city_mapped_enabled,
  flags.threshold_enabled as car_threshold_daily_rates_enabled,
  tiers.tier_count,
  tiers.invalid_rate_count,
  oracle.repeating_280_over_3_matches,
  oracle.repeating_37_over_7_matches,
  oracle.ordinary_rate_matches,
  (
    columns.daily_rate_numeric_12_6
    and functions.base_quote_rounds_after_multiplication
    and functions.authoritative_quote_preserves_rate_and_rounds_total
    and flags.canonical_setting_count = 1
    and flags.mapped_enabled is false
    and flags.threshold_enabled is false
    and tiers.invalid_rate_count = 0
    and oracle.repeating_280_over_3_matches
    and oracle.repeating_37_over_7_matches
    and oracle.ordinary_rate_matches
  ) as threshold_daily_rate_precision_safe
from column_state columns
cross join function_state functions
cross join flag_state flags
cross join tier_state tiers
cross join parity_oracle oracle;
