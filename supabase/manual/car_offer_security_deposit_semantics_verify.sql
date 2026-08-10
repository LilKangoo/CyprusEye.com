-- Read-only verification for 20260810160000_car_offer_security_deposit_semantics.sql.
-- Expected final row: car_offer_security_deposit_semantics_safe = true.

with column_contract as (
  select
    column_info.data_type = 'numeric' as numeric_type,
    column_info.is_nullable = 'YES' as nullable,
    column_info.column_default is null as no_implicit_no_deposit_default
  from information_schema.columns column_info
  where column_info.table_schema = 'public'
    and column_info.table_name = 'car_offers'
    and column_info.column_name = 'deposit_amount'
),
constraint_contract as (
  select coalesce(bool_or(
    lower(regexp_replace(pg_get_constraintdef(constraint_row.oid, true), '[[:space:]]+', ' ', 'g'))
      like '%deposit_amount is null%deposit_amount >= 0%'
  ), false) as nonnegative_or_null_check
  from pg_constraint constraint_row
  where constraint_row.conrelid = to_regclass('public.car_offers')
    and constraint_row.conname = 'car_offers_security_deposit_amount_nonnegative'
),
comment_contract as (
  select coalesce(
    col_description(to_regclass('public.car_offers'), attribute.attnum)
      like 'Refundable vehicle security/damage deposit%Never used as payment due at booking%',
    false
  ) as semantic_comment_present
  from pg_attribute attribute
  where attribute.attrelid = to_regclass('public.car_offers')
    and attribute.attname = 'deposit_amount'
    and attribute.attnum > 0
    and not attribute.attisdropped
),
data_contract as (
  select
    count(*) filter (where offer.deposit_amount < 0) as negative_values,
    count(*) filter (where offer.deposit_amount is null) as unspecified_values,
    count(*) filter (where offer.deposit_amount = 0) as explicit_no_deposit_values,
    count(*) filter (where offer.deposit_amount > 0) as positive_security_deposit_values
  from public.car_offers offer
),
payment_contract as (
  select
    to_regclass('public.service_deposit_rules') is not null as payment_rules_present,
    to_regclass('public.service_deposit_overrides') is not null as payment_overrides_present
)
select
  'car-offer-security-deposit-semantics-v1' as verify_version,
  coalesce(column_contract.numeric_type, false) as numeric_type,
  coalesce(column_contract.nullable, false) as nullable,
  coalesce(column_contract.no_implicit_no_deposit_default, false) as no_implicit_no_deposit_default,
  constraint_contract.nonnegative_or_null_check,
  coalesce(comment_contract.semantic_comment_present, false) as semantic_comment_present,
  data_contract.negative_values,
  data_contract.unspecified_values,
  data_contract.explicit_no_deposit_values,
  data_contract.positive_security_deposit_values,
  payment_contract.payment_rules_present,
  payment_contract.payment_overrides_present,
  (
    coalesce(column_contract.numeric_type, false)
    and coalesce(column_contract.nullable, false)
    and coalesce(column_contract.no_implicit_no_deposit_default, false)
    and constraint_contract.nonnegative_or_null_check
    and coalesce(comment_contract.semantic_comment_present, false)
    and data_contract.negative_values = 0
    and payment_contract.payment_rules_present
    and payment_contract.payment_overrides_present
  ) as car_offer_security_deposit_semantics_safe
from column_contract
cross join constraint_contract
cross join comment_contract
cross join data_contract
cross join payment_contract;
