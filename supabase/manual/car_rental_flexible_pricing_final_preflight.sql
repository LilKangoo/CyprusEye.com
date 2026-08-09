-- car-rental-flexible-pricing-final-preflight-v1
-- READ ONLY. Run once on production immediately before the four Stage 3
-- migrations. Returns exactly one summary row and reads no booking/customer
-- records or PII.

with
required_objects(object_name) as (
  values
    ('public.car_offers'::text),
    ('public.car_bookings'),
    ('public.car_offer_city_availability'),
    ('public.car_rental_cities'),
    ('public.car_pricing_profiles'),
    ('public.car_pricing_profile_cities'),
    ('public.car_vehicle_kinds'),
    ('public.site_settings'),
    ('public.service_deposit_requests'),
    ('public.transport_bookings')
),
object_state as (
  select
    count(*)::integer as expected_count,
    count(*) filter (where to_regclass(object_name) is not null)::integer as present_count,
    coalesce(array_agg(object_name order by object_name)
      filter (where to_regclass(object_name) is null), '{}'::text[]) as missing_objects
  from required_objects
),
required_columns(table_name, column_name) as (
  values
    ('car_offers'::text, 'id'::text),
    ('car_offers', 'location'),
    ('car_offers', 'pricing_profile_id'),
    ('car_offers', 'availability_mode'),
    ('car_offers', 'min_rental_days'),
    ('car_offers', 'max_rental_days'),
    ('car_offers', 'is_available'),
    ('car_offers', 'is_published'),
    ('car_offers', 'currency'),
    ('car_offers', 'insurance_per_day'),
    ('car_offers', 'young_driver_fee'),
    ('car_offers', 'young_driver_cost'),
    ('car_offer_city_availability', 'offer_id'),
    ('car_offer_city_availability', 'city_id'),
    ('car_offer_city_availability', 'pickup_enabled'),
    ('car_offer_city_availability', 'return_enabled'),
    ('car_offer_city_availability', 'is_active'),
    ('car_offer_city_availability', 'fee_mode'),
    ('car_offer_city_availability', 'fee_per_direction'),
    ('site_settings', 'car_multi_city_mapped_enabled'),
    ('car_bookings', 'id'),
    ('car_bookings', 'offer_id'),
    ('car_bookings', 'status'),
    ('car_bookings', 'payment_status'),
    ('car_bookings', 'location'),
    ('car_bookings', 'pickup_date'),
    ('car_bookings', 'pickup_time'),
    ('car_bookings', 'pickup_location'),
    ('car_bookings', 'return_date'),
    ('car_bookings', 'return_time'),
    ('car_bookings', 'return_location'),
    ('car_bookings', 'quoted_price'),
    ('car_bookings', 'total_price'),
    ('car_bookings', 'final_price'),
    ('car_bookings', 'base_rental_price'),
    ('car_bookings', 'final_rental_price'),
    ('car_bookings', 'full_insurance'),
    ('car_bookings', 'young_driver'),
    ('car_bookings', 'coupon_id'),
    ('car_bookings', 'coupon_code'),
    ('car_bookings', 'coupon_discount_amount'),
    ('car_bookings', 'coupon_partner_id'),
    ('car_bookings', 'coupon_partner_commission_bps'),
    ('service_deposit_requests', 'resource_type'),
    ('service_deposit_requests', 'booking_id'),
    ('service_deposit_requests', 'amount'),
    ('service_deposit_requests', 'status'),
    ('service_deposit_requests', 'paid_at')
),
column_state as (
  select
    count(*)::integer as expected_count,
    count(actual.column_name)::integer as present_count,
    coalesce(array_agg(expected.table_name || '.' || expected.column_name
      order by expected.table_name, expected.column_name)
      filter (where actual.column_name is null), '{}'::text[]) as missing_columns
  from required_columns expected
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = expected.table_name
   and actual.column_name = expected.column_name
),
required_functions(function_name, present) as (
  values
    ('public.is_current_user_admin()', to_regprocedure('public.is_current_user_admin()') is not null),
    ('public.is_partner_user(uuid)', to_regprocedure('public.is_partner_user(uuid)') is not null),
    ('public.car_multicity_set_updated_at()', to_regprocedure('public.car_multicity_set_updated_at()') is not null),
    ('public.try_numeric(text)', to_regprocedure('public.try_numeric(text)') is not null),
    (
      'public.car_coupon_quote(text,numeric,timestamptz,timestamptz,uuid,text,text,text,uuid,text)',
      to_regprocedure('public.car_coupon_quote(text,numeric,timestamptz,timestamptz,uuid,text,text,text,uuid,text)') is not null
    ),
    (
      'public.sync_car_booking_status_from_deposit_paid()',
      to_regprocedure('public.sync_car_booking_status_from_deposit_paid()') is not null
    )
),
function_state as (
  select
    count(*)::integer as expected_count,
    count(*) filter (where present)::integer as present_count,
    coalesce(array_agg(function_name order by function_name)
      filter (where not present), '{}'::text[]) as missing_functions
  from required_functions
),
trigger_state as (
  select exists (
    select 1
    from pg_trigger trigger_record
    where trigger_record.tgrelid = to_regclass('public.service_deposit_requests')
      and trigger_record.tgname = 'trg_sync_car_booking_status_from_deposit_paid'
      and not trigger_record.tgisinternal
  ) as deposit_payment_trigger_present
),
stage3_absence as (
  select
    to_regclass('public.car_offer_daily_rate_tiers') is null as tier_table_absent,
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'car_offers' and column_name in (
            'pricing_strategy', 'engine_capacity_cc', 'required_licence_category',
            'minimum_driver_age', 'insurance_mode'
          ))
          or (table_name = 'site_settings' and column_name = 'car_threshold_daily_rates_enabled')
          or (table_name = 'car_bookings' and column_name in (
            'pickup_city_code', 'return_city_code', 'pricing_snapshot', 'pricing_validated_at'
          ))
        )
    ) as stage3_columns_absent,
    to_regprocedure(
      'public.resolve_car_threshold_authoritative_quote(uuid,date,time without time zone,date,time without time zone,text,text,text,text,boolean,boolean,text,uuid,text)'
    ) is null as authoritative_quote_absent
),
offer_state as (
  select
    count(*)::integer as offer_count,
    count(*) filter (where lower(btrim(location)) = 'larnaca')::integer as larnaca_count,
    count(*) filter (where lower(btrim(location)) = 'paphos')::integer as paphos_count,
    count(*) filter (where is_available and is_published)::integer as public_offer_count,
    count(*) filter (where availability_mode = 'legacy')::integer as legacy_offer_count,
    count(*) filter (where availability_mode = 'mapped')::integer as mapped_offer_count,
    count(*) filter (where min_rental_days is null)::integer as null_minimum_count,
    md5(coalesce(string_agg(
      jsonb_build_array(
        offer.id,
        offer.price_per_day,
        offer.price_3days,
        offer.price_4_6days,
        offer.price_7_10days,
        offer.price_10plus_days,
        offer.currency,
        offer.location,
        offer.owner_partner_id,
        offer.deposit_amount,
        offer.insurance_per_day,
        offer.young_driver_fee,
        offer.young_driver_cost,
        offer.stock_count,
        offer.north_allowed,
        offer.is_available,
        offer.is_published,
        offer.submission_status
      )::text,
      E'\n' order by offer.id
    ), '')) as protected_fingerprint,
    array_agg(offer.id order by offer.id) as exact_offer_ids
  from public.car_offers offer
),
availability_state as (
  select
    count(*)::integer as row_count,
    count(*) filter (where is_active)::integer as active_count,
    count(*) filter (
      where is_active and pickup_enabled and return_enabled
    )::integer as paired_active_count,
    count(*) filter (where fee_mode = 'inherit')::integer as inherit_count,
    count(*) filter (where fee_mode = 'override')::integer as override_count,
    count(*) filter (where fee_per_direction is not null)::integer as explicit_fee_count
  from public.car_offer_city_availability
),
flag_state as (
  select
    count(*) filter (where id = 1)::integer as canonical_setting_count,
    coalesce(bool_or(car_multi_city_mapped_enabled), false) as mapped_enabled
  from public.site_settings
),
profile_state as (
  select count(*) filter (
    where offer.pricing_profile_id is null
       or profile.id is null
       or profile.legacy_booking_location <> lower(btrim(offer.location))
  )::integer as incompatible_profile_count
  from public.car_offers offer
  left join public.car_pricing_profiles profile on profile.id = offer.pricing_profile_id
)
select
  'car-rental-flexible-pricing-final-preflight-v1'::text as preflight_version,
  now() as inspected_at,
  offers.offer_count,
  offers.larnaca_count,
  offers.paphos_count,
  offers.public_offer_count,
  offers.legacy_offer_count,
  offers.mapped_offer_count,
  offers.protected_fingerprint,
  offers.exact_offer_ids,
  availability.row_count as availability_rows,
  availability.active_count as active_availability_rows,
  availability.paired_active_count as paired_active_availability_rows,
  availability.inherit_count as inherit_fee_rows,
  availability.override_count as override_fee_rows,
  availability.explicit_fee_count,
  flags.mapped_enabled as car_multi_city_mapped_enabled,
  profiles.incompatible_profile_count,
  objects.missing_objects,
  columns.missing_columns,
  functions.missing_functions,
  triggers.deposit_payment_trigger_present,
  absence.tier_table_absent,
  absence.stage3_columns_absent,
  absence.authoritative_quote_absent,
  (
    objects.present_count = objects.expected_count
    and columns.present_count = columns.expected_count
    and functions.present_count = functions.expected_count
    and triggers.deposit_payment_trigger_present
    and absence.tier_table_absent
    and absence.stage3_columns_absent
    and absence.authoritative_quote_absent
    and offers.offer_count = 27
    and offers.larnaca_count = 18
    and offers.paphos_count = 9
    and offers.public_offer_count = 26
    and offers.legacy_offer_count = 27
    and offers.mapped_offer_count = 0
    and offers.null_minimum_count = 0
    and offers.protected_fingerprint = 'aa1abc7ce187779927838bafb706cf3b'
    and availability.row_count = 12
    and availability.active_count = 12
    and availability.paired_active_count = 12
    and availability.inherit_count = 12
    and availability.override_count = 0
    and availability.explicit_fee_count = 0
    and flags.canonical_setting_count = 1
    and flags.mapped_enabled is false
    and profiles.incompatible_profile_count = 0
  ) as stage3_final_preflight_pass
from object_state objects
cross join column_state columns
cross join function_state functions
cross join trigger_state triggers
cross join stage3_absence absence
cross join offer_state offers
cross join availability_state availability
cross join flag_state flags
cross join profile_state profiles;
