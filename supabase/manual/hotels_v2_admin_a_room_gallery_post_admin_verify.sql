-- Hotels V2 ADMIN-A post-Admin gallery repair verification (READ ONLY).
-- Supabase SQL Editor compatible. Run only after one fresh Review + Save has
-- restored the approved six-photo Upper Floor gallery.

select set_config('hotels_v2.admin_a_expected_booking_count',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_booking_count',true),''),'3'),false);
select set_config('hotels_v2.admin_a_expected_booking_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_booking_fingerprint',true),''),
    'fb5a4c508b0df32afbffe5b1594c7a50'),false);
select set_config('hotels_v2.admin_a_expected_fulfillment_count',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_fulfillment_count',true),''),'5'),false);
select set_config('hotels_v2.admin_a_expected_fulfillment_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_fulfillment_fingerprint',true),''),
    '1e01541853d87d26adccb8172074934b'),false);
select set_config('hotels_v2.admin_a_expected_deposit_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_deposit_fingerprint',true),''),
    '42b5e1dc9726890e90014c3e89c2329d'),false);
select set_config('hotels_v2.admin_a_expected_coupon_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_coupon_fingerprint',true),''),
    'd41d8cd98f00b204e9800998ecf8427e'),false);

do $admin_a_post_admin_verify$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_correlation uuid;
  v_snapshot jsonb;
  v_definition text;
begin
  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  if v_definition not like '%hotels_v2_admin_a_reviewed_schedule_v1%'
     or v_definition not like '%hotels_v2_admin_a_noop_room_upsert_v1%'
     or v_definition not like '%hotels_v2_admin_a_field_scoped_room_version_v1%' then
    raise exception 'HOTELS_V2_ADMIN_A_POST_ADMIN_FAIL: repair function missing';
  end if;

  if not exists(select 1 from public.hotel_room_types where id=c_upper
       and hotel_id=c_hotel and version=21
       and jsonb_array_length(gallery)=6
       and md5(gallery::text)='939828b55bd9467be64b3b28cabbf598')
     or not exists(select 1 from public.hotel_room_types where id=c_ground
       and hotel_id=c_hotel and version=20
       and jsonb_array_length(gallery)=5
       and md5(gallery::text)='1e90ead9d89f58757eebae5268cb50d2') then
    raise exception 'HOTELS_V2_ADMIN_A_POST_ADMIN_FAIL: exact Room Type gallery/version mismatch';
  end if;

  select activity.correlation_id into v_correlation
  from public.hotel_activity_log activity
  where activity.hotel_id=c_hotel
    and activity.entity_type='room_type' and activity.entity_id=c_upper
    and activity.action='update' and activity.source='hotels_v2_h2b1_shadow_prepare'
    and (activity.before_state->>'version')::bigint=20
    and md5((activity.before_state->'gallery')::text)=
      'd751713988987e9331980363e24189ce'
    and (activity.after_state->>'version')::bigint=21
    and md5((activity.after_state->'gallery')::text)=
      '939828b55bd9467be64b3b28cabbf598'
  order by activity.created_at desc,activity.id desc
  limit 1;
  if v_correlation is null
     or (select count(*) from public.hotel_activity_log
       where correlation_id=v_correlation)<>1
     or exists(select 1 from public.hotel_activity_log
       where correlation_id=v_correlation and entity_id=c_ground) then
    raise exception 'HOTELS_V2_ADMIN_A_POST_ADMIN_FAIL: exact one-room activity contract mismatch';
  end if;

  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{source,pricing_fingerprint}'<>
       '7208ab4ecc0e47abd64d87ca1ac53a03'
     or v_snapshot#>>'{target,target_fingerprint}'<>
       'baeaae09e1775f28f39695696084f5a1'
     or v_snapshot->>'pricing_occupancy_mapping_fingerprint'<>
       '6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_snapshot#>>'{parity,fingerprint}'<>
       'b3c915266ab060efaba522cf5587fb75'
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or v_snapshot#>>'{target,room_schedule,review_status}'<>'reviewed'
     or coalesce((v_snapshot#>>'{target,room_schedule,is_active}')::boolean,true)
     or not coalesce((v_snapshot#>>'{safety,rate_plan_inactive}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,room_rates_inactive}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,all_flags_off}')::boolean,false) then
    raise exception 'HOTELS_V2_ADMIN_A_POST_ADMIN_FAIL: reviewed pricing contract drift: %',
      v_snapshot->'blockers';
  end if;

  if not exists(select 1 from public.hotels where id=c_hotel
       and architecture_version='legacy'
       and md5(photos::text)='f56efe166beedfa231540592a1c73cc6'
       and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03')
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or (select count(*) from public.hotel_bookings)<>
       current_setting('hotels_v2.admin_a_expected_booking_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
       from public.hotel_bookings row_value)<>
       current_setting('hotels_v2.admin_a_expected_booking_fingerprint')
     or (select count(*) from public.partner_service_fulfillments
       where resource_type='hotels')<>
       current_setting('hotels_v2.admin_a_expected_fulfillment_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
       from public.partner_service_fulfillments row_value where resource_type='hotels')<>
       current_setting('hotels_v2.admin_a_expected_fulfillment_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
       from public.service_deposit_requests row_value where resource_type='hotels')<>
       current_setting('hotels_v2.admin_a_expected_deposit_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
       from public.service_coupon_redemptions row_value where service_type='hotels')<>
       current_setting('hotels_v2.admin_a_expected_coupon_fingerprint') then
    raise exception 'HOTELS_V2_ADMIN_A_POST_ADMIN_FAIL: legacy/history/flags drift';
  end if;
end
$admin_a_post_admin_verify$;

-- Must match both preflight and foundation protected_relation_fingerprints.
with protected_relations as (
  select coalesce(jsonb_object_agg(
    relation.relname,
    md5(pg_catalog.query_to_xml(format(
      'select to_jsonb(row_value)::text as row_value from public.%I row_value order by to_jsonb(row_value)::text',
      relation.relname
    ),true,true,'')::text)
    order by relation.relname
  ),'{}'::jsonb) fingerprints
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname='public' and relation.relkind in ('r','p')
    and relation.relname in (
      'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
      'service_coupons','service_coupon_redemptions','referrals',
      'affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
      'affiliate_program_settings','affiliate_referrer_overrides',
      'affiliate_cashout_requests','profile_referral_code_aliases'
    )
)
select
  '939828b55bd9467be64b3b28cabbf598' upper_gallery_fingerprint,
  '1e90ead9d89f58757eebae5268cb50d2' ground_gallery_fingerprint,
  protected_relations.fingerprints protected_relation_fingerprints,
  0 as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  0 as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true as hotels_v2_admin_a_room_gallery_post_admin_safe
from protected_relations;
