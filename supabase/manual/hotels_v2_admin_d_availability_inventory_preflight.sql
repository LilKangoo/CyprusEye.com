-- Hotels V2 ADMIN-D availability/inventory preflight.
-- READ ONLY. Supabase Dashboard SQL Editor compatible.
-- Run immediately before 20260811360000_hotels_v2_admin_d_availability_inventory_control.sql.

do $admin_d_preflight$
declare v_missing text[]; v_existing text[]; v_snapshot jsonb;
begin
  select coalesce(array_agg(name order by name),'{}') into v_missing from unnest(array[
    'public.hotels','public.hotel_room_types','public.hotel_units','public.hotel_property_pricing_defaults',
    'public.hotel_rate_plans','public.hotel_room_rates','public.hotel_pricing_schedules',
    'public.hotel_pricing_schedule_occupancy_tiers','public.hotel_room_rate_occupancy_tiers',
    'public.hotel_rate_rules','public.hotel_room_allocation_rules','public.hotel_room_allocation_rule_items',
    'public.hotel_daily_inventory','public.hotel_daily_rates','public.hotel_calendar_overrides',
    'public.hotel_pricing_promotion_reviews','public.hotel_admin_pricing_action_receipts',
    'public.hotel_calendar_source_configs','public.hotel_payment_policies','public.hotel_payment_policy_terms',
    'public.hotel_commission_policies','public.hotel_bookings','public.hotel_activity_log',
    'public.partner_service_fulfillments','public.partner_service_fulfillment_form_snapshots',
    'public.service_deposit_requests','public.service_deposit_rules','public.service_deposit_overrides',
    'public.service_coupons','public.service_coupon_redemptions','public.referrals',
    'public.affiliate_commission_events','public.affiliate_payouts','public.affiliate_adjustments',
    'public.affiliate_program_settings','public.affiliate_referrer_overrides','public.affiliate_cashout_requests',
    'public.profile_referral_code_aliases','public.site_settings','public.partners','public.partner_users',
    'public.partner_resources','public.partner_user_resources','public.hotel_partner_hotel_permissions',
    'public.hotel_partner_action_receipts','public.hotel_partner_event_outbox',
    'public.hotel_property_operational_profiles'
  ]) required(name) where to_regclass(name) is null;
  if cardinality(v_missing)>0 then raise exception 'HOTELS_V2_ADMIN_D_PREFLIGHT_FAIL missing relations: %',v_missing; end if;
  select coalesce(array_agg(name order by name),'{}') into v_missing from unnest(array[
    'public.hotel_v2_h2a_require_admin()','public.hotel_v2_admin_get_pricing_control(uuid)',
    'public.hotel_v2_admin_preview_pricing_quote(jsonb)',
    'extensions.digest(bytea,text)',
    'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',
    'public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',
    'public.hotel_v2_admin_c_date_is_canonical(text)',
    'public.hotel_v2_admin_c_timestamptz_is_canonical(text)'
  ]) required(name) where to_regprocedure(name) is null;
  if cardinality(v_missing)>0 then raise exception 'HOTELS_V2_ADMIN_D_PREFLIGHT_FAIL missing functions: %',v_missing; end if;
  select coalesce(array_agg(name order by name),'{}') into v_existing from unnest(array[
    'public.hotel_unit_calendar_blocks','public.hotel_inventory_day_locks',
    'public.hotel_inventory_holds','public.hotel_booking_room_allocations',
    'public.hotel_inventory_commitments','public.hotel_admin_availability_action_receipts',
    'public.hotel_admin_availability_plan_reviews','public.hotel_admin_availability_foundation_receipts'
  ]) expected(name) where to_regclass(name) is not null;
  if cardinality(v_existing)>0 or to_regprocedure('public.hotel_v2_admin_get_availability_control(uuid,date,date)') is not null then
    raise exception 'HOTELS_V2_ADMIN_D_PREFLIGHT_FAIL ADMIN-D already present: %',v_existing;
  end if;
  if (select count(*) from public.site_settings)<>1 or not exists(select 1 from public.site_settings where id=1
    and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
    and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception 'HOTELS_V2_ADMIN_D_PREFLIGHT_FAIL Hotels V2 flags are not all OFF'; end if;
  if not exists(select 1 from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
    and architecture_version='legacy' and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03') then
    raise exception 'HOTELS_V2_ADMIN_D_PREFLIGHT_FAIL accepted legacy pricing drift'; end if;
  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or v_snapshot#>>'{target,target_fingerprint}'<>'baeaae09e1775f28f39695696084f5a1'
     or v_snapshot->>'pricing_occupancy_mapping_fingerprint'<>'6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_snapshot#>>'{parity,fingerprint}'<>'b3c915266ab060efaba522cf5587fb75'
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or (v_snapshot#>>'{target,room_schedule,tier_count}')::integer<>27
     or (v_snapshot#>>'{source,property_party_preview,tier_count}')::integer<>63
     or not exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed' and review.acknowledged_pricing_occupancy_mapping
         and review.source_fingerprint=v_snapshot#>>'{source,pricing_fingerprint}'
         and review.target_fingerprint=v_snapshot#>>'{target,target_fingerprint}'
         and review.pricing_occupancy_mapping_fingerprint=v_snapshot->>'pricing_occupancy_mapping_fingerprint'
         and review.parity_fingerprint=v_snapshot#>>'{parity,fingerprint}'
         and review.parity_case_count=(v_snapshot#>>'{parity,total_case_count}')::integer
         and review.parity_mismatch_count=(v_snapshot#>>'{parity,total_mismatch_count}')::integer
         and review.result->>'target_fingerprint'=review.target_fingerprint)
     or exists(select 1 from public.hotel_rate_plans where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from public.hotel_pricing_schedules where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active) then
    raise exception 'HOTELS_V2_ADMIN_D_PREFLIGHT_FAIL accepted H3.1P 70/0 contract drift'; end if;
end
$admin_d_preflight$;

with relation_specs(relation_name,excluded_columns) as(values
  ('hotels','{}'::text[]),('hotel_room_types','{}'::text[]),('hotel_units','{}'::text[]),
  ('hotel_property_pricing_defaults','{}'::text[]),('hotel_rate_plans','{}'::text[]),
  ('hotel_room_rates','{}'::text[]),('hotel_pricing_schedules','{}'::text[]),
  ('hotel_pricing_schedule_occupancy_tiers','{}'::text[]),
  ('hotel_room_rate_occupancy_tiers','{}'::text[]),
  ('hotel_rate_rules',array['closed_to_arrival','closed_to_departure','version','updated_at',
    'availability_version','availability_reason','availability_actor_id',
    'availability_correlation_id','availability_updated_at']::text[]),
  ('hotel_room_allocation_rules','{}'::text[]),
  ('hotel_room_allocation_rule_items','{}'::text[]),('hotel_daily_rates','{}'::text[]),
  ('hotel_pricing_promotion_reviews','{}'::text[]),
  ('hotel_admin_pricing_action_receipts','{}'::text[]),
  ('hotel_calendar_source_configs','{}'::text[]),('hotel_payment_policies','{}'::text[]),
  ('hotel_payment_policy_terms','{}'::text[]),('hotel_commission_policies','{}'::text[]),
  ('hotel_bookings','{}'::text[]),('partner_service_fulfillments','{}'::text[]),
  ('partner_service_fulfillment_form_snapshots','{}'::text[]),
  ('service_deposit_requests','{}'::text[]),('service_deposit_rules','{}'::text[]),
  ('service_deposit_overrides','{}'::text[]),('service_coupons','{}'::text[]),
  ('service_coupon_redemptions','{}'::text[]),('referrals','{}'::text[]),
  ('affiliate_commission_events','{}'::text[]),('affiliate_payouts','{}'::text[]),
  ('affiliate_adjustments','{}'::text[]),('affiliate_program_settings','{}'::text[]),
  ('affiliate_referrer_overrides','{}'::text[]),('affiliate_cashout_requests','{}'::text[]),
  ('profile_referral_code_aliases','{}'::text[]),('site_settings','{}'::text[]),
  ('partners','{}'::text[]),('partner_users','{}'::text[]),('partner_resources','{}'::text[]),
  ('partner_user_resources','{}'::text[]),('hotel_partner_hotel_permissions','{}'::text[]),
  ('hotel_partner_action_receipts','{}'::text[]),('hotel_partner_event_outbox','{}'::text[]),
  ('hotel_property_operational_profiles','{}'::text[])
), fingerprints as(
  select coalesce(jsonb_object_agg(spec.relation_name,md5(pg_catalog.query_to_xml(format(
    'select (to_jsonb(row_value)-%L::text[])::text from public.%I row_value order by (to_jsonb(row_value)-%L::text[])::text',
    spec.excluded_columns,spec.relation_name,spec.excluded_columns),true,true,'')::text)
    order by spec.relation_name),'{}') value from relation_specs spec
  where to_regclass('public.'||spec.relation_name) is not null
), calendar_pricing as(select md5(pg_catalog.query_to_xml(
  'select id,hotel_id,room_rate_id,stay_date,nightly_rate,nightly_rate_mode,minimum_stay,minimum_stay_mode,maximum_stay,maximum_stay_mode,reason,expires_at,actor_id,actor_type,source,source_timestamp,is_active,provenance,created_at,pricing_source,pricing_reason,pricing_expires_at,pricing_actor_type,pricing_actor_id,pricing_updated_at,pricing_correlation_id from public.hotel_calendar_overrides where nightly_rate_mode is not null or minimum_stay_mode is not null or maximum_stay_mode is not null order by id',true,true,'')::text) value),
non_d_activity as(select md5(pg_catalog.query_to_xml(
  $query$select to_jsonb(row_value)::text from public.hotel_activity_log row_value where source is distinct from 'hotels_v2_admin_d_availability_control' order by row_value.id$query$,true,true,'')::text) value)
select fingerprints.value||jsonb_build_object('hotel_calendar_pricing_state',calendar_pricing.value,
    'non_admin_d_activity',non_d_activity.value)
    as protected_relation_fingerprints,
  true as hotels_v2_admin_d_availability_inventory_preflight_safe
from fingerprints cross join calendar_pricing cross join non_d_activity;
