\set ON_ERROR_STOP on

-- Disposable local-only production-shaped H3.1P fixture. It composes the
-- established H3.1 chain, then creates the exact reviewed 7 Kamares inert
-- commercial graph before applying the additive promotion migration.
\ir hotels-v2-h3-1-postgrest-base.sql

with matrices(guest_count,rates) as (
  values
    (2,array[100,90,88,84,80,76,74,72,70]::numeric[]),
    (3,array[130,113,113,104,100,95,94,90,90]::numeric[]),
    (4,array[155,135,135,120,118,114,111,107,107]::numeric[]),
    (5,array[200,180,176,168,160,152,148,144,140]::numeric[]),
    (6,array[260,226,226,208,200,190,188,180,180]::numeric[]),
    (7,array[310,270,270,240,236,228,222,214,214]::numeric[]),
    (8,array[310,270,270,240,236,228,222,214,214]::numeric[])
), thresholds(threshold_nights,ordinality) as (
  values (2,1),(3,2),(4,3),(5,4),(6,5),(7,6),(8,7),(9,8),(10,9)
), pricing as (
  select jsonb_build_object(
    'currency','EUR',
    'rules',jsonb_agg(jsonb_build_object(
      'persons',matrices.guest_count,
      'min_nights',thresholds.threshold_nights,
      'price_per_night',matrices.rates[thresholds.ordinality]
    ) order by matrices.guest_count,thresholds.threshold_nights)
  ) value
  from matrices cross join thresholds
)
update public.hotels hotel set
  pricing_model='tiered_by_nights',pricing_tiers=pricing.value,max_persons=8,
  minimum_stay_nights=2,booking_mode='request_confirmation',currency='EUR',
  check_in_from='14:00',check_out_until='11:00',
  children_policy='minimum_age',minimum_child_age=15,
  architecture_version='legacy'
from pricing
where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';

update public.hotel_room_types set status='active'
where id in(
  'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
  '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'
);

update public.hotel_room_types room set gallery=case room.id
  when 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid then (
    select jsonb_agg(photo.value order by photo.ordinal)
    from public.hotels hotel
    cross join lateral jsonb_array_elements(hotel.photos) with ordinality photo(value,ordinal)
    where hotel.id=room.hotel_id and photo.ordinal<=6
  )
  else (
    select jsonb_agg(photo.value order by photo.ordinal)
    from public.hotels hotel
    cross join lateral jsonb_array_elements(hotel.photos) with ordinality photo(value,ordinal)
    where hotel.id=room.hotel_id and photo.ordinal between 5 and 9
  ) end
where room.id in(
  'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
  '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'
);

update public.hotel_pricing_schedules set
  code='shared-apartment-occupancy-los',application_scope='room_occupancy',
  currency='EUR',maximum_party_size=4,minimum_billable_occupancy=2,
  is_active=false,review_status='requires_review',source='legacy_preview',
  source_reference='{"pricing_fingerprint":"7208ab4ecc0e47abd64d87ca1ac53a03"}'::jsonb
where id='b0a3104f-7b31-5265-a59f-c2d166f11a23';

update public.hotel_rate_plans set
  code='standard',cancellation_policy='{"type":"non_refundable"}'::jsonb,
  price_inclusions=array['cleaning','taxes']::text[],is_active=false
where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';

insert into public.hotel_pricing_schedules(
  id,hotel_id,code,name_i18n,application_scope,currency,maximum_party_size,
  minimum_billable_occupancy,is_active,review_status,source,source_reference
) values(
  '443065c0-984a-5de3-a22a-d03042c41107',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'legacy-property-party-preview','{"en":"Legacy property party preview"}'::jsonb,
  'property_booking_party','EUR',8,2,false,'requires_review','legacy_preview',
  '{"pricing_fingerprint":"7208ab4ecc0e47abd64d87ca1ac53a03"}'::jsonb
);

insert into public.hotel_room_rates(
  id,hotel_id,room_type_id,rate_plan_id,base_nightly_rate,currency,
  is_active,sort_order,pricing_schedule_id
) values
  ('7e420964-9cbf-4f1b-abd3-09840af5240f',
   '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
   '22e47a63-a630-4fb6-8f43-816f2d3fdc17',0,'EUR',false,100,
   'b0a3104f-7b31-5265-a59f-c2d166f11a23'),
  ('3320590d-632d-423f-80d0-fd021cba7293',
   '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
   '22e47a63-a630-4fb6-8f43-816f2d3fdc17',0,'EUR',false,200,
   'b0a3104f-7b31-5265-a59f-c2d166f11a23');

with matrices(guest_count,rates) as (
  values
    (2,array[100,90,88,84,80,76,74,72,70]::numeric[]),
    (3,array[130,113,113,104,100,95,94,90,90]::numeric[]),
    (4,array[155,135,135,120,118,114,111,107,107]::numeric[]),
    (5,array[200,180,176,168,160,152,148,144,140]::numeric[]),
    (6,array[260,226,226,208,200,190,188,180,180]::numeric[]),
    (7,array[310,270,270,240,236,228,222,214,214]::numeric[]),
    (8,array[310,270,270,240,236,228,222,214,214]::numeric[])
), thresholds(threshold_nights,ordinality) as (
  values (2,1),(3,2),(4,3),(5,4),(6,5),(7,6),(8,7),(9,8),(10,9)
)
insert into public.hotel_pricing_schedule_occupancy_tiers(
  id,schedule_id,guest_count,threshold_nights,nightly_rate,is_active
)
select gen_random_uuid(),schedule.id,matrices.guest_count,
  thresholds.threshold_nights,matrices.rates[thresholds.ordinality],true
from matrices cross join thresholds
cross join lateral (values
  ('443065c0-984a-5de3-a22a-d03042c41107'::uuid),
  ('b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid)
) schedule(id)
where schedule.id='443065c0-984a-5de3-a22a-d03042c41107'::uuid
   or matrices.guest_count between 2 and 4;

begin;
set constraints hotel_room_allocation_rules_contract_guard,
  hotel_room_allocation_rule_items_contract_guard deferred;

insert into public.hotel_room_allocation_rules(
  id,hotel_id,code,allocation_mode,min_guest_count,max_guest_count,
  is_active,review_status,sort_order
) values
  ('31000000-0000-4000-8000-000000000014','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   'guests-1-4-choice','customer_choice',1,4,true,'reviewed',100),
  ('31000000-0000-4000-8000-000000000015','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   'guests-5-bundle','required_bundle',5,5,true,'reviewed',500),
  ('31000000-0000-4000-8000-000000000016','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   'guests-6-bundle','required_bundle',6,6,true,'reviewed',600),
  ('31000000-0000-4000-8000-000000000017','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   'guests-7-bundle','required_bundle',7,7,true,'reviewed',700),
  ('31000000-0000-4000-8000-000000000018','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   'guests-8-bundle','required_bundle',8,8,true,'reviewed',800);

insert into public.hotel_room_allocation_rule_items(
  id,hotel_id,allocation_rule_id,room_type_id,units_required,
  allocated_guest_count,sort_order
) values
  ('31100000-0000-4000-8000-000000000001','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000014','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',1,null,100),
  ('31100000-0000-4000-8000-000000000002','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000014','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',1,null,200),
  ('31500000-0000-4000-8000-000000000001','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000015','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',1,3,100),
  ('31500000-0000-4000-8000-000000000002','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000015','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',1,2,200),
  ('31600000-0000-4000-8000-000000000001','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000016','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',1,3,100),
  ('31600000-0000-4000-8000-000000000002','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000016','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',1,3,200),
  ('31700000-0000-4000-8000-000000000001','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000017','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',1,4,100),
  ('31700000-0000-4000-8000-000000000002','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000017','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',1,3,200),
  ('31800000-0000-4000-8000-000000000001','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000018','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',1,4,100),
  ('31800000-0000-4000-8000-000000000002','9b6d99a0-923a-4fbc-be54-c066e856e6ca','31000000-0000-4000-8000-000000000018','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',1,4,200);

commit;

select
  (select count(*) from public.hotel_bookings)::integer h3_1p_expected_booking_count,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.hotel_bookings row_value) h3_1p_expected_booking_fingerprint,
  (select count(*) from public.partner_service_fulfillments
    where resource_type='hotels')::integer h3_1p_expected_fulfillment_count,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.partner_service_fulfillments row_value
    where resource_type='hotels') h3_1p_expected_fulfillment_fingerprint
\gset

select set_config(
  'hotels_v2.h3_1p_expected_booking_count',
  :'h3_1p_expected_booking_count',
  false
);
select set_config(
  'hotels_v2.h3_1p_expected_booking_fingerprint',
  :'h3_1p_expected_booking_fingerprint',
  false
);
select set_config(
  'hotels_v2.h3_1p_expected_fulfillment_count',
  :'h3_1p_expected_fulfillment_count',
  false
);
select set_config(
  'hotels_v2.h3_1p_expected_fulfillment_fingerprint',
  :'h3_1p_expected_fulfillment_fingerprint',
  false
);

\ir ../../supabase/manual/hotels_v2_h3_1_legacy_pricing_promotion_preflight.sql
\ir ../../supabase/migrations/20260811310000_hotels_v2_h3_1_legacy_pricing_promotion.sql

notify pgrst,'reload schema';
