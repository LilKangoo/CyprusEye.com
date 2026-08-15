-- Hotels V2 H3.1P legacy pricing promotion preflight (READ ONLY).
-- Run immediately before 20260811310000.  It accepts only the reviewed,
-- public-inert 7 Kamares H3.1 graph and never changes production state.
\set ON_ERROR_STOP on

\if :{?h3_1p_expected_booking_count}
\else
\set h3_1p_expected_booking_count 3
\set h3_1p_expected_booking_fingerprint fb5a4c508b0df32afbffe5b1594c7a50
\set h3_1p_expected_fulfillment_count 5
\set h3_1p_expected_fulfillment_fingerprint 1e01541853d87d26adccb8172074934b
\endif

select set_config('hotels_v2.h3_1p_expected_booking_count',
  :'h3_1p_expected_booking_count',false);
select set_config('hotels_v2.h3_1p_expected_booking_fingerprint',
  :'h3_1p_expected_booking_fingerprint',false);
select set_config('hotels_v2.h3_1p_expected_fulfillment_count',
  :'h3_1p_expected_fulfillment_count',false);
select set_config('hotels_v2.h3_1p_expected_fulfillment_fingerprint',
  :'h3_1p_expected_fulfillment_fingerprint',false);

do $preflight$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_plan constant uuid:='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  c_room_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_party_schedule constant uuid:='443065c0-984a-5de3-a22a-d03042c41107';
begin
  if to_regclass('public.hotel_room_allocation_rule_items') is null
     or to_regprocedure('public.hotel_v2_admin_get_h3_1_configuration(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)') is null
     or exists(select 1 from information_schema.columns
       where table_schema='public' and table_name='hotel_room_allocation_rule_items'
         and column_name='pricing_guest_count')
     or to_regclass('public.hotel_pricing_promotion_reviews') is not null then
    raise exception 'HOTELS_V2_H3_1P_PREFLIGHT_FAIL: migration boundary mismatch';
  end if;

  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
     )) then
    raise exception 'HOTELS_V2_H3_1P_PREFLIGHT_FAIL: public inert guard mismatch';
  end if;

  if (select count(*) from public.hotel_bookings)<>
       current_setting('hotels_v2.h3_1p_expected_booking_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
       from public.hotel_bookings row_value)<>
         current_setting('hotels_v2.h3_1p_expected_booking_fingerprint')
     or (select count(*) from public.partner_service_fulfillments
       where resource_type='hotels')<>
         current_setting('hotels_v2.h3_1p_expected_fulfillment_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
       from public.partner_service_fulfillments row_value
       where resource_type='hotels')<>
         current_setting('hotels_v2.h3_1p_expected_fulfillment_fingerprint') then
    raise exception 'HOTELS_V2_H3_1P_PREFLIGHT_FAIL: booking/fulfillment history drift';
  end if;

  if not exists(select 1 from public.hotels hotel where hotel.id=c_hotel
       and hotel.architecture_version='legacy' and hotel.is_published
       and hotel.pricing_model='tiered_by_nights'
       and hotel.pricing_tiers->>'currency'='EUR'
       and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
       and jsonb_array_length(hotel.pricing_tiers->'rules')=63
       and hotel.minimum_stay_nights=2
       and hotel.booking_mode='request_confirmation'
       and btrim(hotel.currency::text)='EUR'
       and hotel.children_policy='minimum_age' and hotel.minimum_child_age=15)
     or (select count(*) from public.hotel_room_types where hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_room_types where id=c_upper
       and hotel_id=c_hotel and status='active' and max_occupancy=4
       and inventory_mode='pooled' and base_inventory_count=1)
     or not exists(select 1 from public.hotel_room_types where id=c_ground
       and hotel_id=c_hotel and status='active' and max_occupancy=4
       and inventory_mode='pooled' and base_inventory_count=1)
     or (select count(*) from public.hotel_rate_plans where hotel_id=c_hotel)<>1
     or not exists(select 1 from public.hotel_rate_plans where id=c_plan
       and hotel_id=c_hotel and code='standard' and not is_active
       and cancellation_policy='{"type":"non_refundable"}'::jsonb
       and price_inclusions=array['cleaning','taxes']::text[])
     or (select count(*) from public.hotel_room_rates where hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_room_rates where id=c_upper_rate
       and hotel_id=c_hotel and room_type_id=c_upper and rate_plan_id=c_plan
       and pricing_schedule_id=c_room_schedule and base_nightly_rate=0
       and btrim(currency::text)='EUR' and not is_active)
     or not exists(select 1 from public.hotel_room_rates where id=c_ground_rate
       and hotel_id=c_hotel and room_type_id=c_ground and rate_plan_id=c_plan
       and pricing_schedule_id=c_room_schedule and base_nightly_rate=0
       and btrim(currency::text)='EUR' and not is_active) then
    raise exception 'HOTELS_V2_H3_1P_PREFLIGHT_FAIL: exact commercial graph mismatch';
  end if;

  if (select count(*) from public.hotel_pricing_schedules where hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_pricing_schedules where id=c_room_schedule
       and hotel_id=c_hotel and code='shared-apartment-occupancy-los'
       and application_scope='room_occupancy' and btrim(currency::text)='EUR'
       and maximum_party_size=4 and minimum_billable_occupancy=2
       and not is_active and review_status='requires_review' and source='legacy_preview'
       and source_reference->>'pricing_fingerprint'='7208ab4ecc0e47abd64d87ca1ac53a03')
     or not exists(select 1 from public.hotel_pricing_schedules where id=c_party_schedule
       and hotel_id=c_hotel and code='legacy-property-party-preview'
       and application_scope='property_booking_party' and btrim(currency::text)='EUR'
       and maximum_party_size=8 and not is_active and review_status='requires_review'
       and source='legacy_preview'
       and source_reference->>'pricing_fingerprint'='7208ab4ecc0e47abd64d87ca1ac53a03')
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
       where schedule_id=c_room_schedule and is_active)<>27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
       where schedule_id=c_party_schedule and is_active)<>63
     or exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers
       where schedule_id=c_room_schedule and guest_count=1) then
    raise exception 'HOTELS_V2_H3_1P_PREFLIGHT_FAIL: schedule contract mismatch';
  end if;

  if exists(
    (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,
       (rule->>'price_per_night')::numeric
     from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     where hotel.id=c_hotel and (rule->>'persons')::integer between 2 and 4
     except
     select guest_count,threshold_nights,nightly_rate
     from public.hotel_pricing_schedule_occupancy_tiers
     where schedule_id=c_room_schedule and is_active)
    union all
    (select guest_count,threshold_nights,nightly_rate
     from public.hotel_pricing_schedule_occupancy_tiers
     where schedule_id=c_room_schedule and is_active
     except
     select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,
       (rule->>'price_per_night')::numeric
     from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     where hotel.id=c_hotel and (rule->>'persons')::integer between 2 and 4)
  ) or exists(
    (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,
       (rule->>'price_per_night')::numeric
     from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     where hotel.id=c_hotel
     except
     select guest_count,threshold_nights,nightly_rate
     from public.hotel_pricing_schedule_occupancy_tiers
     where schedule_id=c_party_schedule and is_active)
    union all
    (select guest_count,threshold_nights,nightly_rate
     from public.hotel_pricing_schedule_occupancy_tiers
     where schedule_id=c_party_schedule and is_active
     except
     select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,
       (rule->>'price_per_night')::numeric
     from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     where hotel.id=c_hotel)
  ) then
    raise exception 'HOTELS_V2_H3_1P_PREFLIGHT_FAIL: legacy/normalized tier mismatch';
  end if;

  if (select count(*) from public.hotel_room_allocation_rules where hotel_id=c_hotel)<>5
     or (select count(*) from public.hotel_room_allocation_rule_items item
       join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
       where rule.hotel_id=c_hotel)<>10
     or exists(select 1 from public.hotel_room_allocation_rules rule
       where rule.hotel_id=c_hotel and (
         not rule.is_active or rule.review_status<>'reviewed'
         or not (
           (rule.code='guests-1-4-choice' and rule.allocation_mode='customer_choice'
             and rule.min_guest_count=1 and rule.max_guest_count=4)
           or (rule.code='guests-5-bundle' and rule.allocation_mode='required_bundle'
             and rule.min_guest_count=5 and rule.max_guest_count=5)
           or (rule.code='guests-6-bundle' and rule.allocation_mode='required_bundle'
             and rule.min_guest_count=6 and rule.max_guest_count=6)
           or (rule.code='guests-7-bundle' and rule.allocation_mode='required_bundle'
             and rule.min_guest_count=7 and rule.max_guest_count=7)
           or (rule.code='guests-8-bundle' and rule.allocation_mode='required_bundle'
             and rule.min_guest_count=8 and rule.max_guest_count=8)
         )
       ))
     or exists(select 1 from public.hotel_room_allocation_rules rule
       join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
       where rule.hotel_id=c_hotel and (
         item.units_required is distinct from 1
         or item.room_type_id not in(c_upper,c_ground)
         or (rule.code='guests-1-4-choice' and item.allocated_guest_count is not null)
         or (rule.code='guests-5-bundle' and (
           (item.room_type_id=c_upper and item.allocated_guest_count is distinct from 3)
           or (item.room_type_id=c_ground and item.allocated_guest_count is distinct from 2)))
         or (rule.code='guests-6-bundle' and item.allocated_guest_count is distinct from 3)
         or (rule.code='guests-7-bundle' and (
           (item.room_type_id=c_upper and item.allocated_guest_count is distinct from 4)
           or (item.room_type_id=c_ground and item.allocated_guest_count is distinct from 3)))
         or (rule.code='guests-8-bundle' and item.allocated_guest_count is distinct from 4)
       )) then
    raise exception 'HOTELS_V2_H3_1P_PREFLIGHT_FAIL: physical allocation mismatch';
  end if;
end
$preflight$;

select set_config('hotels_v2.h3_1p_expected_booking_count','',false);
select set_config('hotels_v2.h3_1p_expected_booking_fingerprint','',false);
select set_config('hotels_v2.h3_1p_expected_fulfillment_count','',false);
select set_config('hotels_v2.h3_1p_expected_fulfillment_fingerprint','',false);

select
  '7208ab4ecc0e47abd64d87ca1ac53a03' legacy_pricing_fingerprint,
  63 legacy_tier_count,
  27 room_tier_count,
  0 as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  0 as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true hotels_v2_h3_1_legacy_pricing_promotion_preflight_safe;
