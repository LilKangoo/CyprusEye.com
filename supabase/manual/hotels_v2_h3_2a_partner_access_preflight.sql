-- Hotels V2 H3.2A Partner access foundation preflight (READ ONLY).
-- Run immediately before migration 20260811320000. This script creates no
-- permission rows and changes no application data.

select set_config('hotels_v2.h3_2a_expected_booking_count',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_booking_count', true), ''), '3'), false);
select set_config('hotels_v2.h3_2a_expected_booking_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_booking_fingerprint', true), ''),
    'fb5a4c508b0df32afbffe5b1594c7a50'), false);
select set_config('hotels_v2.h3_2a_expected_fulfillment_count',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_fulfillment_count', true), ''), '5'), false);
select set_config('hotels_v2.h3_2a_expected_fulfillment_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_fulfillment_fingerprint', true), ''),
    '1e01541853d87d26adccb8172074934b'), false);
select set_config('hotels_v2.h3_2a_expected_deposit_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_deposit_fingerprint', true), ''),
    '42b5e1dc9726890e90014c3e89c2329d'), false);
select set_config('hotels_v2.h3_2a_expected_coupon_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_coupon_fingerprint', true), ''),
    'd41d8cd98f00b204e9800998ecf8427e'), false);
select set_config('hotels_v2.h3_2a_expected_rgb_pricing_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_rgb_pricing_fingerprint', true), ''),
    'e272ec40b78069a1e2e49ac6b0956f11'), false);

do $preflight$
declare
  c_seven_kamares constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_rgb_cabins constant uuid := 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';
  v_scope_columns text[];
  v_policy_names text[];
  v_pricing_snapshot jsonb;
begin
  if to_regclass('public.partners') is null
     or to_regclass('public.partner_users') is null
     or to_regclass('public.partner_resources') is null
     or to_regclass('public.partner_user_resources') is null
     or to_regclass('public.hotels') is null
     or to_regclass('public.hotel_bookings') is null
     or to_regclass('public.partner_service_fulfillments') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regclass('public.hotel_pricing_promotion_reviews') is null
     or to_regclass('public.service_deposit_requests') is null
     or to_regclass('public.service_coupon_redemptions') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is null
     or to_regprocedure('public.hotel_v2_admin_get_h3_1_configuration(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: prerequisite contract missing';
  end if;

  if to_regclass('public.hotel_partner_hotel_permissions') is not null
     or to_regclass('public.hotel_partner_action_receipts') is not null
     or to_regclass('public.hotel_partner_event_outbox') is not null
     or to_regclass('public.hotel_partner_property_drafts') is not null
     or to_regclass('public.hotel_media_assets') is not null
     or to_regclass('public.hotel_booking_change_requests') is not null
     or to_regclass('public.partner_payment_accounts') is not null
     or to_regclass('public.partner_payment_account_events') is not null
     or to_regprocedure('public.hotel_v2_admin_get_partner_hotel_permissions(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)') is not null
     or to_regprocedure('public.hotel_v2_partner_list_assigned_properties(uuid)') is not null then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: migration boundary mismatch';
  end if;

  select array_agg(column_name order by ordinal_position)
  into v_scope_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'partner_user_resources';
  if v_scope_columns is distinct from array[
       'id','partner_user_id','resource_type','resource_id','created_at'
     ]::text[] then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: staff scope contract mismatch';
  end if;

  if (select count(*) from public.site_settings) <> 1
     or not exists (
       select 1 from public.site_settings where id = 1
         and not hotel_rooms_v2_enabled
         and not hotel_external_sync_enabled
         and not hotel_instant_booking_enabled
         and not hotel_stripe_connect_enabled
     ) then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: Hotels V2 flags are not all OFF';
  end if;

  if not exists (
       select 1 from public.hotels
       where id = c_seven_kamares
         and architecture_version = 'legacy'
         and pricing_model = 'tiered_by_nights'
         and md5(pricing_tiers::text) = '7208ab4ecc0e47abd64d87ca1ac53a03'
         and jsonb_array_length(pricing_tiers->'rules') = 63
     )
     or not exists (
       select 1 from public.hotels
       where id = c_rgb_cabins
         and architecture_version = 'legacy'
         and md5(pricing_tiers::text)
           = current_setting('hotels_v2.h3_2a_expected_rgb_pricing_fingerprint')
     ) then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: legacy Hotel fingerprint mismatch';
  end if;

  if (select count(*) from public.hotel_bookings)
       <> current_setting('hotels_v2.h3_2a_expected_booking_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
         from public.hotel_bookings row_value)
        <> current_setting('hotels_v2.h3_2a_expected_booking_fingerprint')
     or (select count(*) from public.partner_service_fulfillments where resource_type = 'hotels')
       <> current_setting('hotels_v2.h3_2a_expected_fulfillment_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
         from public.partner_service_fulfillments row_value where resource_type = 'hotels')
        <> current_setting('hotels_v2.h3_2a_expected_fulfillment_fingerprint') then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: booking/fulfillment history drift';
  end if;

  if (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
      from public.service_deposit_requests row_value where row_value.resource_type = 'hotels')
       <> current_setting('hotels_v2.h3_2a_expected_deposit_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
         from public.service_coupon_redemptions row_value where row_value.service_type = 'hotels')
       <> current_setting('hotels_v2.h3_2a_expected_coupon_fingerprint') then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: deposit/coupon history drift';
  end if;

  if not exists (
       select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id = c_seven_kamares
         and review.contract_version = 'seven_kamares_legacy_to_h3_pricing_v1'
         and review.source_fingerprint = '7208ab4ecc0e47abd64d87ca1ac53a03'
         and review.parity_case_count = 70
         and review.parity_mismatch_count = 0
         and review.review_status = 'reviewed'
     )
     or (select count(*) from public.hotel_room_types where hotel_id = c_seven_kamares) <> 2
     or (select count(*) from public.hotel_rate_plans where hotel_id = c_seven_kamares) <> 1
     or (select count(*) from public.hotel_room_rates where hotel_id = c_seven_kamares) <> 2
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
         where schedule_id = 'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid) <> 27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
         where schedule_id = '443065c0-984a-5de3-a22a-d03042c41107'::uuid) <> 63
     or (select count(*) from public.hotel_room_allocation_rule_items
         where pricing_guest_count is not null) <> 8 then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: H3.1/H3.1P reviewed graph drift';
  end if;

  v_pricing_snapshot := public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_seven_kamares);
  if not coalesce((v_pricing_snapshot->>'supported')::boolean, false)
     or v_pricing_snapshot#>>'{promotion,status}' <> 'reviewed'
     or v_pricing_snapshot#>>'{source,pricing_fingerprint}' <> '7208ab4ecc0e47abd64d87ca1ac53a03'
     or (v_pricing_snapshot#>>'{source,rule_count}')::integer <> 63
     or (v_pricing_snapshot#>>'{target,room_schedule,tier_count}')::integer <> 27
     or (v_pricing_snapshot#>>'{source,property_party_preview,tier_count}')::integer <> 63
     or (v_pricing_snapshot#>>'{parity,total_case_count}')::integer <> 70
     or (v_pricing_snapshot#>>'{parity,total_mismatch_count}')::integer <> 0 then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: exact H3.1P pricing snapshot drift: %',
      v_pricing_snapshot->'blockers';
  end if;

  if exists (
       select 1 from public.partner_resources assignment
       left join public.partners partner on partner.id = assignment.partner_id
       left join public.hotels hotel
         on assignment.resource_type = 'hotels' and hotel.id = assignment.resource_id
       where assignment.resource_type = 'hotels'
         and (partner.id is null or hotel.id is null)
     ) then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: orphan Hotel assignment';
  end if;

  select array_agg(policyname order by policyname)
  into v_policy_names
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'hotels';
  if v_policy_names is distinct from array[
       'Anyone can view published hotels',
       'hotels_admin_all',
       'hotels_authenticated_select',
       'hotels_partner_delete',
       'hotels_partner_insert',
       'hotels_partner_update'
     ]::text[] then
    raise exception 'HOTELS_V2_H3_2A_PREFLIGHT_FAIL: legacy raw Hotel RLS policy set drift';
  end if;
end
$preflight$;

select set_config('hotels_v2.h3_2a_expected_booking_count', '', false);
select set_config('hotels_v2.h3_2a_expected_booking_fingerprint', '', false);
select set_config('hotels_v2.h3_2a_expected_fulfillment_count', '', false);
select set_config('hotels_v2.h3_2a_expected_fulfillment_fingerprint', '', false);
select set_config('hotels_v2.h3_2a_expected_deposit_fingerprint', '', false);
select set_config('hotels_v2.h3_2a_expected_coupon_fingerprint', '', false);
select set_config('hotels_v2.h3_2a_expected_rgb_pricing_fingerprint', '', false);

with policy_contract as (
  select md5(coalesce(string_agg(jsonb_build_object(
    'policyname', policyname,
    'permissive', permissive,
    'roles', roles,
    'cmd', cmd,
    'qual', qual,
    'with_check', with_check
  )::text, '|' order by policyname), '')) fingerprint
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'hotels'
),
protected_relations as (
  select jsonb_object_agg(relation.relname, md5(pg_catalog.query_to_xml(format(
    'select to_jsonb(row_value)::text as row_value from public.%I row_value order by to_jsonb(row_value)::text',
    relation.relname
  ), true, true, '')::text) order by relation.relname) fingerprints
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r','p')
    and relation.relname in (
      'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
      'service_coupons','service_coupon_redemptions',
      'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
      'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
      'hotel_room_rate_occupancy_tiers','hotel_calendar_overrides',
      'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
      'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
      'hotel_payment_policies','hotel_payment_policy_terms','hotel_commission_policies',
      'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
      'referrals','affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
      'affiliate_program_settings','affiliate_referrer_overrides',
      'affiliate_cashout_requests','profile_referral_code_aliases'
    )
)
select
  '7208ab4ecc0e47abd64d87ca1ac53a03' as seven_kamares_legacy_pricing_fingerprint,
  'e272ec40b78069a1e2e49ac6b0956f11' as rgb_cabins_legacy_pricing_fingerprint,
  policy_contract.fingerprint as legacy_hotels_rls_fingerprint,
  protected_relations.fingerprints as protected_relation_fingerprints,
  0 as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  0 as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true as hotels_v2_h3_2a_partner_access_preflight_safe
from policy_contract cross join protected_relations;
