\set ON_ERROR_STOP on

-- Disposable production-shaped ADMIN-A HTTP fixture: completed H3.2A plus
-- the already-deployed deferred-trigger authorization repair.
\ir hotels-v2-h3-2a-partner-access-postgrest-base.sql
\ir ../../supabase/migrations/20260811300000_hotels_v2_h3_1_deferred_room_inventory_trigger_auth_fix.sql

create function pg_temp.admin_a_initial_room_update_plan()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
    'expected_property_updated_at',hotel.updated_at,
    'reviewed_at',clock_timestamp(),
    'operation',jsonb_build_object(
      'type','update','id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      'expected_version',room.version,
      'payload','{"gallery":[]}'::jsonb
    )
  )
  from public.hotels hotel
  join public.hotel_room_types room
    on room.hotel_id=hotel.id
   and room.id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
$function$;

-- Reproduce the current production photo removal through the real Admin RPC.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_apply_room_type_plan(
  pg_temp.admin_a_initial_room_update_plan(),
  'a3310000-0000-4000-8000-000000000001'
);
commit;

-- Feed exact local values to the production-default read-only gates.
select set_config('hotels_v2.admin_a_expected_property_updated_at',
  (select updated_at::text from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),false);
select set_config('hotels_v2.admin_a_expected_property_gallery_fingerprint',
  (select md5(photos::text) from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),false);
select set_config('hotels_v2.admin_a_expected_upper_version',
  (select version::text from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),false);
select set_config('hotels_v2.admin_a_expected_upper_gallery_fingerprint',
  (select md5(gallery::text) from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),false);
select set_config('hotels_v2.admin_a_expected_ground_version',
  (select version::text from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),false);
select set_config('hotels_v2.admin_a_expected_ground_gallery_fingerprint',
  (select md5(gallery::text) from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),false);
select set_config('hotels_v2.admin_a_expected_schedule_version',
  (select version::text from public.hotel_pricing_schedules
    where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'),false);
select set_config('hotels_v2.admin_a_expected_party_schedule_version',
  (select version::text from public.hotel_pricing_schedules
    where id='443065c0-984a-5de3-a22a-d03042c41107'),false);
select set_config('hotels_v2.admin_a_expected_rate_plan_version',
  (select version::text from public.hotel_rate_plans
    where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'),false);
select set_config('hotels_v2.admin_a_expected_upper_rate_version',
  (select version::text from public.hotel_room_rates
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'),false);
select set_config('hotels_v2.admin_a_expected_ground_rate_version',
  (select version::text from public.hotel_room_rates
    where id='3320590d-632d-423f-80d0-fd021cba7293'),false);
select set_config('hotels_v2.admin_a_expected_target_fingerprint',
  (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{target,target_fingerprint}'),false);
select set_config('hotels_v2.admin_a_expected_booking_count',
  (select count(*)::text from public.hotel_bookings),false);
select set_config('hotels_v2.admin_a_expected_booking_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.hotel_bookings row_value),false);
select set_config('hotels_v2.admin_a_expected_fulfillment_count',
  (select count(*)::text from public.partner_service_fulfillments
    where resource_type='hotels'),false);
select set_config('hotels_v2.admin_a_expected_fulfillment_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.partner_service_fulfillments row_value where resource_type='hotels'),false);
select set_config('hotels_v2.admin_a_expected_deposit_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.service_deposit_requests row_value where resource_type='hotels'),false);
select set_config('hotels_v2.admin_a_expected_coupon_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.service_coupon_redemptions row_value where service_type='hotels'),false);

\ir ../../supabase/manual/hotels_v2_admin_a_room_gallery_post_promotion_preflight.sql
\ir ../../supabase/migrations/20260811330000_hotels_v2_admin_a_room_gallery_post_promotion_repair.sql
\ir ../../supabase/manual/hotels_v2_admin_a_room_gallery_post_promotion_verify.sql

notify pgrst,'reload schema';
