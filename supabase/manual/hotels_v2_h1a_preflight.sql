-- Hotels 2.0 H1A production preflight (READ ONLY).
--
-- Run immediately before applying the H1A migration set.  This script is
-- pinned to the accepted 2026-08-11 production baseline and returns exactly
-- one summary row.  It performs no writes and intentionally fails the final
-- safety boolean when any protected identifier or row fingerprint drifts.

with
expected_property_ids(id) as (
  values
    ('9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
    ('f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid)
),
expected_booking_ids(id) as (
  values
    ('1f1bef2f-ba2b-4d6c-9c43-8714e0224bd1'::uuid),
    ('a2377882-4959-45ac-b311-3eb16afaa01d'::uuid),
    ('a509b9da-9fd6-4836-8525-1068e23303ca'::uuid)
),
expected_fulfillment_ids(id) as (
  values
    ('21114c8e-7d5c-4136-af18-a93ebd315618'::uuid),
    ('87dbd568-bd83-4bb1-9493-0c4942b7fb18'::uuid),
    ('aff7d13a-960f-48e3-8d93-72205ee18e76'::uuid),
    ('b981fda1-4879-49ec-b499-16161bafe1c1'::uuid),
    ('c857644b-2094-41eb-96d9-f735cdb681a4'::uuid)
),
expected_live_columns(table_name, column_name, formatted_type, not_null, default_expression) as (
  values
    ('hotels', 'sort_order', 'integer', true, '1000'),
    ('hotels', 'amenities', 'jsonb', false, '''[]''::jsonb'),
    ('hotels', 'title_i18n', 'jsonb', false, null),
    ('hotels', 'description_i18n', 'jsonb', false, null),
    ('hotel_cities', 'id', 'uuid', true, 'gen_random_uuid()'),
    ('hotel_cities', 'name', 'text', true, null),
    ('hotel_cities', 'name_pl', 'text', false, null),
    ('hotel_cities', 'name_en', 'text', false, null),
    ('hotel_cities', 'display_order', 'integer', false, '0'),
    ('hotel_cities', 'is_active', 'boolean', false, 'true'),
    ('hotel_cities', 'created_at', 'timestamp with time zone', false, 'now()'),
    ('hotel_cities', 'updated_at', 'timestamp with time zone', false, 'now()'),
    ('hotel_amenities', 'id', 'uuid', true, 'gen_random_uuid()'),
    ('hotel_amenities', 'code', 'text', true, null),
    ('hotel_amenities', 'category', 'text', true, null),
    ('hotel_amenities', 'icon', 'text', false, null),
    ('hotel_amenities', 'name_en', 'text', true, null),
    ('hotel_amenities', 'name_pl', 'text', true, null),
    ('hotel_amenities', 'display_order', 'integer', false, '0'),
    ('hotel_amenities', 'is_popular', 'boolean', false, 'false'),
    ('hotel_amenities', 'is_active', 'boolean', false, 'true'),
    ('hotel_amenities', 'created_at', 'timestamp with time zone', false, 'now()'),
    ('hotel_amenities', 'name_he', 'text', false, null)
),
actual_live_columns as (
  select
    attribute_table.relname::text as table_name,
    attribute.attname::text as column_name,
    format_type(attribute.atttypid, attribute.atttypmod) as formatted_type,
    attribute.attnotnull as not_null,
    pg_get_expr(default_value.adbin, default_value.adrelid) as default_expression
  from pg_catalog.pg_attribute attribute
  join pg_catalog.pg_class attribute_table
    on attribute_table.oid = attribute.attrelid
  join pg_catalog.pg_namespace namespace_info
    on namespace_info.oid = attribute_table.relnamespace
  left join pg_catalog.pg_attrdef default_value
    on default_value.adrelid = attribute.attrelid
   and default_value.adnum = attribute.attnum
  where namespace_info.nspname = 'public'
    and attribute_table.relname in ('hotels', 'hotel_cities', 'hotel_amenities')
    and attribute.attnum > 0
    and not attribute.attisdropped
),
live_column_contract as (
  select
    count(*) filter (
      where actual.column_name is null
         or actual.formatted_type is distinct from expected.formatted_type
         or actual.not_null is distinct from expected.not_null
         or actual.default_expression is distinct from expected.default_expression
    ) as mismatch_count
  from expected_live_columns expected
  left join actual_live_columns actual
    using (table_name, column_name)
),
property_state as (
  select
    count(*)::integer as property_count,
    coalesce(array_agg(hotel.id order by hotel.id), '{}'::uuid[]) as property_ids,
    count(*) filter (where hotel.id in (select id from expected_property_ids))::integer as expected_property_count,
    md5(coalesce(string_agg(to_jsonb(hotel)::text, '|' order by hotel.id), '')) as property_fingerprint
  from public.hotels hotel
),
booking_state as (
  select
    count(*)::integer as booking_count,
    count(*) filter (where booking.status = 'confirmed')::integer as confirmed_count,
    count(*) filter (where booking.status = 'cancelled')::integer as cancelled_count,
    coalesce(array_agg(booking.id order by booking.id), '{}'::uuid[]) as booking_ids,
    md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), '')) as booking_fingerprint
  from public.hotel_bookings booking
),
fulfillment_state as (
  select
    count(*)::integer as fulfillment_count,
    count(*) filter (where fulfillment.status = 'accepted')::integer as accepted_count,
    count(*) filter (where fulfillment.status = 'awaiting_payment')::integer as awaiting_payment_count,
    count(*) filter (where fulfillment.status = 'closed')::integer as closed_count,
    count(*) filter (
      where booking.id is null
         or fulfillment.resource_id is distinct from booking.hotel_id
    )::integer as relationship_mismatch_count,
    coalesce(array_agg(fulfillment.id order by fulfillment.id), '{}'::uuid[]) as fulfillment_ids,
    md5(coalesce(string_agg(to_jsonb(fulfillment)::text, '|' order by fulfillment.id), '')) as fulfillment_fingerprint
  from public.partner_service_fulfillments fulfillment
  left join public.hotel_bookings booking on booking.id = fulfillment.booking_id
  where fulfillment.resource_type = 'hotels'
),
relationship_state as (
  select
    (
      select md5(coalesce(string_agg(to_jsonb(deposit_row)::text, '|' order by deposit_row.id), ''))
      from public.service_deposit_requests deposit_row
      where deposit_row.resource_type = 'hotels'
    ) as deposit_fingerprint,
    (
      select md5(coalesce(string_agg(to_jsonb(coupon_row)::text, '|' order by coupon_row.id), ''))
      from public.service_coupon_redemptions coupon_row
      where coupon_row.service_type = 'hotels'
    ) as coupon_fingerprint
),
catalogue_state as (
  select
    (select count(*)::integer from public.hotel_cities) as city_count,
    (select md5(coalesce(string_agg(to_jsonb(city)::text, '|' order by city.id), '')) from public.hotel_cities city) as city_fingerprint,
    (select count(*)::integer from public.hotel_amenities) as amenity_count,
    (select md5(coalesce(string_agg(to_jsonb(amenity)::text, '|' order by amenity.id), '')) from public.hotel_amenities amenity) as amenity_fingerprint,
    (select count(*)::integer from public.hotel_categories) as category_count
),
security_state as (
  select
    coalesce((
      select relation.relrowsecurity
      from pg_catalog.pg_class relation
      where relation.oid = to_regclass('public.hotel_bookings')
    ), false) as hotel_bookings_rls_enabled,
    exists (
      select 1
      from pg_catalog.pg_policies policy_info
      where policy_info.schemaname = 'public'
        and policy_info.tablename = 'hotel_bookings'
        and policy_info.cmd = 'SELECT'
        and 'authenticated' = any(policy_info.roles)
        and lower(regexp_replace(coalesce(policy_info.qual, ''), '[()[:space:]]', '', 'g')) = 'true'
    ) as broad_authenticated_select_present,
    to_regprocedure('public.is_current_user_admin()') is not null as admin_helper_present,
    to_regprocedure('public.is_partner_user(uuid)') is not null as partner_helper_present,
    to_regprocedure('public.upsert_partner_service_fulfillment_from_booking_with_partner(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)') is not null
      as fulfillment_helper_present
),
foundation_state as (
  select
    count(*)::integer as existing_normalized_table_count
  from unnest(array[
    'public.hotel_room_types',
    'public.hotel_units',
    'public.hotel_rate_plans',
    'public.hotel_room_rates',
    'public.hotel_rate_rules',
    'public.hotel_daily_inventory',
    'public.hotel_daily_rates'
  ]::text[]) expected(object_name)
  where to_regclass(expected.object_name) is not null
),
flag_state as (
  select
    count(*)::integer as settings_row_count,
    bool_and(
      not coalesce((to_jsonb(setting)->>'hotel_rooms_v2_enabled')::boolean, false)
      and not coalesce((to_jsonb(setting)->>'hotel_external_sync_enabled')::boolean, false)
      and not coalesce((to_jsonb(setting)->>'hotel_instant_booking_enabled')::boolean, false)
      and not coalesce((to_jsonb(setting)->>'hotel_stripe_connect_enabled')::boolean, false)
    ) as hotel_v2_flags_absent_or_false
  from public.site_settings setting
),
expected_sets as (
  select
    (select coalesce(array_agg(id order by id), '{}'::uuid[]) from expected_property_ids) as property_ids,
    (select coalesce(array_agg(id order by id), '{}'::uuid[]) from expected_booking_ids) as booking_ids,
    (select coalesce(array_agg(id order by id), '{}'::uuid[]) from expected_fulfillment_ids) as fulfillment_ids
)
select
  property.property_count,
  property.property_ids,
  booking.booking_count,
  booking.confirmed_count,
  booking.cancelled_count,
  booking.booking_ids,
  fulfillment.fulfillment_count,
  fulfillment.accepted_count,
  fulfillment.awaiting_payment_count,
  fulfillment.closed_count,
  fulfillment.relationship_mismatch_count,
  fulfillment.fulfillment_ids,
  catalogue.city_count,
  catalogue.amenity_count,
  catalogue.category_count,
  security.hotel_bookings_rls_enabled,
  security.broad_authenticated_select_present,
  foundation.existing_normalized_table_count,
  flags.hotel_v2_flags_absent_or_false,
  property.property_fingerprint,
  booking.booking_fingerprint,
  fulfillment.fulfillment_fingerprint,
  relationships.deposit_fingerprint,
  relationships.coupon_fingerprint,
  catalogue.city_fingerprint,
  catalogue.amenity_fingerprint,
  (
    property.property_count = 2
    and property.property_ids = expected.property_ids
    and property.expected_property_count = 2
    and property.property_fingerprint = 'b3e3a9c5bda72a83e49d3095d175ab9c'
    and booking.booking_count = 3
    and booking.confirmed_count = 2
    and booking.cancelled_count = 1
    and booking.booking_ids = expected.booking_ids
    and booking.booking_fingerprint = 'fb5a4c508b0df32afbffe5b1594c7a50'
    and fulfillment.fulfillment_count = 5
    and fulfillment.accepted_count = 2
    and fulfillment.awaiting_payment_count = 1
    and fulfillment.closed_count = 2
    and fulfillment.relationship_mismatch_count = 0
    and fulfillment.fulfillment_ids = expected.fulfillment_ids
    and fulfillment.fulfillment_fingerprint = '1e01541853d87d26adccb8172074934b'
    and relationships.deposit_fingerprint = '42b5e1dc9726890e90014c3e89c2329d'
    and relationships.coupon_fingerprint = 'd41d8cd98f00b204e9800998ecf8427e'
    and catalogue.city_count = 9
    and catalogue.city_fingerprint = 'b7ae5a40bbafee23e7f05173f8bdaa33'
    and catalogue.amenity_count = 48
    and catalogue.amenity_fingerprint = '2286f8bd978e9b321f8191a6a3dbf8eb'
    and catalogue.category_count = 0
    and live_columns.mismatch_count = 0
    and security.hotel_bookings_rls_enabled
    and security.broad_authenticated_select_present
    and security.admin_helper_present
    and security.partner_helper_present
    and security.fulfillment_helper_present
    and foundation.existing_normalized_table_count = 0
    and flags.settings_row_count = 1
    and flags.hotel_v2_flags_absent_or_false
  ) as hotels_v2_h1a_preflight_safe
from property_state property
cross join booking_state booking
cross join fulfillment_state fulfillment
cross join relationship_state relationships
cross join catalogue_state catalogue
cross join security_state security
cross join foundation_state foundation
cross join flag_state flags
cross join live_column_contract live_columns
cross join expected_sets expected;
