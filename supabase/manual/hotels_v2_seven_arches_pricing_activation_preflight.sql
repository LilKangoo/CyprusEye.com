-- Read-only production preflight. Run before migration 20260811440000.
-- It proves the exact inactive H3.1P/Task2 baseline and emits no prices or
-- translations: those are explicit reviewed operator inputs to Preview.

do $preflight$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_parity jsonb;
begin
  if to_regprocedure('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') is null
     or to_regprocedure('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
     or to_regprocedure('public.hotel_v2_h3_1p_parity_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: Task2/H3.1P dependency missing';
  end if;
  if to_regclass('public.hotel_seven_arches_pricing_activation_reviews') is not null
     or to_regclass('public.hotel_seven_arches_pricing_activation_transaction_context') is not null
     or to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') is not null then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: activation package already present';
  end if;
  if (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or public.hotel_v2_h3_2b_hash(
       public.hotel_v2_seven_arches_property_proposal_protected_fingerprints())
       is distinct from (select protected_fingerprint
         from public.hotel_partner_property_proposal_foundation_receipts where id=1)
     or not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: Task2 protected state drift';
  end if;
  if (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints)
         and receipt.protected_fingerprints is not null)
     or public.hotel_v2_external_calendar_stage2_compatible_fingerprints() is distinct from
       (select stage2_current_protected_fingerprints
        from public.hotel_admin_availability_foundation_evolution_receipts where id=1)
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_external_sync_enabled and not exists(select 1
         from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
         where receipt.id=setting.id
           and receipt.site_settings_without_external_fingerprint=
             public.hotel_v2_external_calendar_worker_hash(
               to_jsonb(setting)-'hotel_external_sync_enabled'))) then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: Stage2 protected state drift';
  end if;
  v_parity:=public.hotel_v2_h3_1p_parity_snapshot(c_hotel);
  if (v_parity->>'total_case_count')::integer<>70
     or (v_parity->>'total_mismatch_count')::integer<>0
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or not exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=c_hotel
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed' and review.parity_case_count=70
         and review.parity_mismatch_count=0
         and review.parity_fingerprint=v_parity->>'fingerprint') then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: H3.1P 70/0 or 5/10 drift';
  end if;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1
       or hotel_rooms_v2_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)
     or not exists(select 1 from public.hotels where id=c_hotel
       and architecture_version='legacy' and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
       and currency='EUR' and minimum_stay_nights=2 and booking_mode='request_confirmation') then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: flags/legacy authority drift';
  end if;
  if (select count(*) from public.hotel_rate_plans where hotel_id=c_hotel)<>1
     or not exists(select 1 from public.hotel_rate_plans where
       id='22e47a63-a630-4fb6-8f43-816f2d3fdc17' and hotel_id=c_hotel
       and code='standard' and review_status='reviewed' and not is_active
       and cancellation_policy='{"type":"non_refundable"}'::jsonb
       and price_inclusions=array['cleaning','taxes']::text[])
     or (select count(*) from public.hotel_room_rates where hotel_id=c_hotel)<>2
     or (select count(*) from public.hotel_room_rates where hotel_id=c_hotel
       and id in('7e420964-9cbf-4f1b-abd3-09840af5240f','3320590d-632d-423f-80d0-fd021cba7293')
       and review_status='reviewed' and not is_active and base_nightly_rate=0 and currency='EUR')<>2
     or (select count(*) from public.hotel_pricing_schedules where hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_pricing_schedules where
       id='b0a3104f-7b31-5265-a59f-c2d166f11a23' and review_status='reviewed'
       and not is_active and application_scope='room_occupancy'
       and minimum_billable_occupancy=2 and maximum_party_size=4)
     or not exists(select 1 from public.hotel_pricing_schedules where
       id='443065c0-984a-5de3-a22a-d03042c41107' and review_status='requires_review'
       and not is_active and application_scope='property_booking_party')
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
       where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23' and is_active)<>27 then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: inactive pricing graph drift';
  end if;
  if (select count(*) from public.hotel_payment_policies where hotel_id=c_hotel)<>1
     or not exists(select 1 from public.hotel_payment_policies where hotel_id=c_hotel
       and code='seven-kamares-request-confirmation' and currency='EUR'
       and is_active and review_status='reviewed')
     or (select count(*) from public.hotel_payment_policy_terms where hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_payment_policy_terms where hotel_id=c_hotel
       and sequence=1 and due_event='after_partner_acceptance' and amount_mode='percent_total'
       and amount_value=50 and recipient='partner' and payment_methods=array['bank_transfer']::text[])
     or not exists(select 1 from public.hotel_payment_policy_terms where hotel_id=c_hotel
       and sequence=2 and due_event='on_arrival' and amount_mode='remaining_balance'
       and amount_value is null and recipient='partner' and payment_methods=array['card','cash']::text[])
     or (select count(*) from public.hotel_commission_policies where hotel_id=c_hotel
       and is_active and review_status='reviewed')<>1
     or not exists(select 1 from public.hotel_commission_policies where hotel_id=c_hotel
       and is_active and review_status='reviewed'
       and commission_mode='per_allocated_room_per_night' and amount=10 and currency='EUR') then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: payment/commission drift';
  end if;
end
$preflight$;

select
  'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_OK' as sentinel,
  public.hotel_v2_h3_1p_parity_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca')->>'total_case_count' as parity_cases,
  public.hotel_v2_h3_1p_parity_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca')->>'total_mismatch_count' as parity_mismatches,
  public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() as allocation_5_10_exact,
  jsonb_build_array('upper_base_nightly_rate','ground_base_nightly_rate',
    'rate_plan_name_i18n.pl','rate_plan_name_i18n.en','rate_plan_name_i18n.he',
    'rate_plan_description_i18n.pl','rate_plan_description_i18n.en',
    'rate_plan_description_i18n.he','schedule_name_i18n.pl',
    'schedule_name_i18n.en','schedule_name_i18n.he','reason') as required_operator_inputs,
  'shared_schedule' as pricing_authority,
  false as public_change;
