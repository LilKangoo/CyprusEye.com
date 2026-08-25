-- H3.2B Partner Hotel workspace production preflight (READ ONLY).
-- Supabase SQL Editor compatible. A failure aborts before the migration is run.

do $preflight$
declare v_h3 jsonb;
begin
  if exists(select 1 from unnest(array[
      'hotels','hotel_room_types','hotel_units','hotel_amenities','hotel_rate_plans','hotel_room_rates',
      'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers','hotel_room_rate_occupancy_tiers',
      'hotel_rate_rules','hotel_calendar_overrides','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_daily_inventory','hotel_inventory_day_locks',
      'hotel_inventory_commitments','hotel_unit_calendar_blocks','hotel_inventory_holds',
      'hotel_booking_room_allocations','hotel_commission_policies','hotel_activity_log','hotel_bookings',
      'partner_service_fulfillments','partner_service_fulfillment_form_snapshots',
      'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
      'service_coupons','service_coupon_redemptions','referrals','affiliate_commission_events',
      'affiliate_payouts','affiliate_adjustments','affiliate_program_settings',
      'affiliate_referrer_overrides','affiliate_cashout_requests','profile_referral_code_aliases',
      'partners','partner_users','partner_resources','partner_user_resources',
      'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
      'hotel_admin_availability_foundation_receipts','site_settings'
    ]) required(relation_name)
    where to_regclass('public.'||required.relation_name) is null)
     or to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null
     or to_regprocedure('public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)') is null
     or to_regprocedure('public.hotel_v2_admin_c_pricing_control_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)') is null
     or to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null then
    raise exception 'HOTELS_V2_H3_2B_PREFLIGHT_FAIL: prerequisite contract missing';
  end if;
  if to_regclass('public.hotel_partner_property_drafts') is not null
     or to_regclass('public.hotel_partner_workspace_plan_reviews') is not null
     or to_regclass('public.hotel_partner_workspace_foundation_receipts') is not null
     or to_regprocedure('public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)') is not null then
    raise exception 'HOTELS_V2_H3_2B_PREFLIGHT_FAIL: migration boundary mismatch';
  end if;
  if (select count(*) from public.site_settings)<>1 or not exists(select 1 from public.site_settings
      where id=1 and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
        and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception 'HOTELS_V2_H3_2B_PREFLIGHT_FAIL: Hotels V2 flags are not all OFF';
  end if;
  if exists(select 1 from public.partner_resources assignment
      left join public.partners partner on partner.id=assignment.partner_id
      left join public.hotels hotel on assignment.resource_type='hotels' and hotel.id=assignment.resource_id
      where assignment.resource_type='hotels'
        and (partner.id is null or hotel.id is null or hotel.architecture_version<>'legacy')) then
    raise exception 'HOTELS_V2_H3_2B_PREFLIGHT_FAIL: Partner Hotel assignment/legacy drift';
  end if;
  if not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
      where receipt.id=1
        and receipt.protected_fingerprint=encode(extensions.digest(
          convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex')) then
    raise exception 'HOTELS_V2_H3_2B_PREFLIGHT_FAIL: ADMIN-D foundation receipt integrity drift';
  end if;
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid);
  if not coalesce((v_h3->>'supported')::boolean,false)
     or v_h3#>>'{promotion,status}'<>'reviewed'
     or (v_h3#>>'{parity,total_case_count}')::integer<>70
     or (v_h3#>>'{parity,total_mismatch_count}')::integer<>0
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or exists(select 1 from public.hotel_rate_plans where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from public.hotel_pricing_schedules where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active) then
    raise exception 'HOTELS_V2_H3_2B_PREFLIGHT_FAIL: accepted H3.1P 70/0 foundation drift';
  end if;
  if not exists(select 1 from storage.buckets where id='poi-photos') then
    raise exception 'HOTELS_V2_H3_2B_PREFLIGHT_FAIL: poi-photos bucket missing';
  end if;
end
$preflight$;

with protected as(select public.hotel_v2_admin_d_protected_fingerprints() value),
diagnostics as(select
  case when (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_case_count}')::integer=70
    and (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_mismatch_count}')::integer=0
    and public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() then 0 else 1 end occupancy_mismatch,
  case when exists(select 1 from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and architecture_version='legacy'
        and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03') then 0 else 1 end legacy_mismatch,
  case when (select count(*) from public.site_settings)=1 and exists(select 1 from public.site_settings
      where id=1 and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
        and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
      and not exists(select 1 from public.partner_resources assignment join public.hotels hotel
        on assignment.resource_type='hotels' and hotel.id=assignment.resource_id
        where hotel.architecture_version<>'legacy') then 0 else 1 end public_mismatch,
  case when exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
      where receipt.id=1
        and receipt.protected_fingerprint=encode(extensions.digest(
          convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex')) then 0 else 1 end booking_mismatch
  from protected)
select protected.value as protected_relation_fingerprints,
  public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>'{parity}' as h3_1p_parity,
  diagnostics.occupancy_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  diagnostics.legacy_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  diagnostics.public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  diagnostics.booking_mismatch as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  diagnostics.occupancy_mismatch=0 and diagnostics.legacy_mismatch=0
    and diagnostics.public_mismatch=0 and diagnostics.booking_mismatch=0
    as hotels_v2_h3_2b_partner_hotel_workspace_preflight_safe
from protected cross join diagnostics;
