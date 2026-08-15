-- Hotels V2 ADMIN-A Room Type gallery repair foundation verification (READ ONLY).
-- Supabase SQL Editor compatible. Run immediately after migration
-- 20260811330000 and before the manual Admin gallery repair Save.

select set_config('hotels_v2.admin_a_expected_property_updated_at',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_property_updated_at',true),''),
    '2026-08-15 13:04:21.648955+00'),false);
select set_config('hotels_v2.admin_a_expected_property_gallery_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_property_gallery_fingerprint',true),''),
    'f56efe166beedfa231540592a1c73cc6'),false);
select set_config('hotels_v2.admin_a_expected_upper_version',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_upper_version',true),''),'20'),false);
select set_config('hotels_v2.admin_a_expected_upper_gallery_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_upper_gallery_fingerprint',true),''),
    'd751713988987e9331980363e24189ce'),false);
select set_config('hotels_v2.admin_a_expected_ground_version',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_ground_version',true),''),'20'),false);
select set_config('hotels_v2.admin_a_expected_ground_gallery_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_ground_gallery_fingerprint',true),''),
    '1e90ead9d89f58757eebae5268cb50d2'),false);
select set_config('hotels_v2.admin_a_expected_schedule_version',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_schedule_version',true),''),'3'),false);
select set_config('hotels_v2.admin_a_expected_party_schedule_version',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_party_schedule_version',true),''),'2'),false);
select set_config('hotels_v2.admin_a_expected_rate_plan_version',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_rate_plan_version',true),''),'4'),false);
select set_config('hotels_v2.admin_a_expected_target_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_a_expected_target_fingerprint',true),''),
    'baeaae09e1775f28f39695696084f5a1'),false);
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

do $admin_a_foundation_verify$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_party constant uuid:='443065c0-984a-5de3-a22a-d03042c41107';
  v_definition text;
  v_snapshot jsonb;
begin
  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  if v_definition not like '%hotels_v2_admin_a_reviewed_schedule_v1%'
     or v_definition not like '%hotels_v2_admin_a_noop_room_upsert_v1%'
     or v_definition not like '%hotels_v2_admin_a_field_scoped_room_version_v1%'
     or v_definition not like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
     or v_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition not like '%perform 1 from public.site_settings where id=1 for share%'
     or v_definition not like '%if v_after is not null then%'
     or v_definition like '%or v_room.version<>v_existing_version then%'
     or v_definition like '%review_status from public.hotel_pricing_schedules where id=c_schedule)<>''requires_review''%' then
    raise exception 'HOTELS_V2_ADMIN_A_VERIFY_FAIL: repaired function definition mismatch';
  end if;

  if not (select prosecdef from pg_catalog.pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
     or (select prokind from pg_catalog.pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)<>'f'
     or (select proowner::regrole::text from pg_catalog.pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)<>'postgres'
     or not coalesce((select proconfig @> array['search_path=pg_catalog, public, auth']
       from pg_catalog.pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure),false)
     or has_function_privilege(0::oid,
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE') then
    raise exception 'HOTELS_V2_ADMIN_A_VERIFY_FAIL: repaired RPC security mismatch';
  end if;

  if not coalesce((select relrowsecurity from pg_catalog.pg_class
       where oid='public.hotels'::regclass),false)
     or exists(
       select required.name from unnest(array[
         'Anyone can view published hotels','hotels_admin_all','hotels_authenticated_select',
         'hotels_partner_delete','hotels_partner_insert','hotels_partner_update'
       ]) required(name)
       where not exists(select 1 from pg_catalog.pg_policies policy
         where policy.schemaname='public' and policy.tablename='hotels'
           and policy.policyname=required.name)
     )
     or (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception 'HOTELS_V2_ADMIN_A_VERIFY_FAIL: flags/RLS drift';
  end if;

  if not exists(select 1 from public.hotels hotel where hotel.id=c_hotel
       and hotel.architecture_version='legacy'
       and hotel.updated_at=current_setting('hotels_v2.admin_a_expected_property_updated_at')::timestamptz
       and md5(hotel.photos::text)=current_setting(
         'hotels_v2.admin_a_expected_property_gallery_fingerprint')
       and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03')
     or not exists(select 1 from public.hotel_room_types where id=c_upper
       and version=current_setting('hotels_v2.admin_a_expected_upper_version')::bigint
       and md5(gallery::text)=current_setting(
         'hotels_v2.admin_a_expected_upper_gallery_fingerprint'))
     or not exists(select 1 from public.hotel_room_types where id=c_ground
       and version=current_setting('hotels_v2.admin_a_expected_ground_version')::bigint
       and md5(gallery::text)=current_setting(
         'hotels_v2.admin_a_expected_ground_gallery_fingerprint')) then
    raise exception 'HOTELS_V2_ADMIN_A_VERIFY_FAIL: migration changed property/Room Type data';
  end if;

  if not exists(select 1 from public.hotel_pricing_schedules where id=c_schedule
       and version=current_setting('hotels_v2.admin_a_expected_schedule_version')::bigint
       and review_status='reviewed' and not is_active)
     or not exists(select 1 from public.hotel_pricing_schedules where id=c_party
       and version=current_setting('hotels_v2.admin_a_expected_party_schedule_version')::bigint
       and review_status='requires_review' and not is_active)
     or not exists(select 1 from public.hotel_rate_plans
       where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'
       and version=current_setting('hotels_v2.admin_a_expected_rate_plan_version')::bigint
       and not is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id=c_hotel and is_active)
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
       where schedule_id=c_schedule and is_active)<>27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
       where schedule_id=c_party and is_active)<>63 then
    raise exception 'HOTELS_V2_ADMIN_A_VERIFY_FAIL: migration changed inactive pricing graph';
  end if;

  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{target,target_fingerprint}'<>
       current_setting('hotels_v2.admin_a_expected_target_fingerprint')
     or v_snapshot->>'pricing_occupancy_mapping_fingerprint'<>
       '6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_snapshot#>>'{parity,fingerprint}'<>'b3c915266ab060efaba522cf5587fb75'
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or v_snapshot#>>'{target,room_schedule,tier_fingerprint}'<>
       '49df574ed79950df08c2dd9d9ecb278c' then
    raise exception 'HOTELS_V2_ADMIN_A_VERIFY_FAIL: H3.1P pricing contract drift: %',
      v_snapshot->'blockers';
  end if;

  if (select count(*) from public.hotel_bookings)<>
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
    raise exception 'HOTELS_V2_ADMIN_A_VERIFY_FAIL: protected history drift';
  end if;
end
$admin_a_foundation_verify$;

-- Must match the preflight protected_relation_fingerprints output exactly.
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
  (select version from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94') upper_version,
  (select md5(gallery::text) from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94') upper_gallery_fingerprint,
  (select version from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3') ground_version,
  (select md5(gallery::text) from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3') ground_gallery_fingerprint,
  protected_relations.fingerprints protected_relation_fingerprints,
  0 as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  0 as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true as hotels_v2_admin_a_room_gallery_post_promotion_foundation_safe
from protected_relations;
