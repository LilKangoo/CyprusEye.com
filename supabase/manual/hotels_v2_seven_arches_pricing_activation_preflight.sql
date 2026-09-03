-- Read-only production preflight. Run before migration 20260811440000.
-- It proves the exact inactive H3.1P/Task2 baseline and emits no prices or
-- translations: those are explicit reviewed operator inputs to Preview.

do $preflight$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_parity jsonb;
  v_property jsonb;
  v_stage2 jsonb;
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_property_receipt
    public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_expected_property jsonb;
  v_authorized_property jsonb;
  v_actual_property jsonb;
  v_owner_user_ids uuid[];
  v_owner_state jsonb;
  v_lifecycle jsonb:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false);
  v_lifecycle_fingerprint text;
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
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null
     or to_regclass('public.hotel_admin_availability_foundation_receipts') is null
     or to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: Task2/H3.1P dependency missing';
  end if;
  if to_regclass('public.hotel_seven_arches_pricing_activation_reviews') is not null
     or to_regclass('public.hotel_seven_arches_pricing_activation_transaction_context') is not null
     or to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') is not null then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: activation package already present';
  end if;
  v_lifecycle_fingerprint:=
    public.hotel_v2_external_calendar_worker_hash(v_lifecycle);
  v_property:=
    public.hotel_v2_seven_arches_property_proposal_protected_fingerprints();
  v_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_owner_state:=public.hotel_v2_admin_d_current_foundation_snapshot();
  select * into strict v_owner
  from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select * into strict v_property_receipt
  from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  select array_agg(member.user_id order by member.user_id) into v_owner_user_ids
  from public.partner_users member
  where member.partner_id=v_owner.partner_id and member.role='owner';
  v_expected_property:=v_property_receipt.proposal_fields_baseline-'updated_at';
  select activity.after_state->'property' into v_authorized_property
  from public.hotel_activity_log activity
  where activity.hotel_id=c_hotel and activity.entity_type='property'
    and activity.source='hotels_v2_admin_b_property_control'
    and activity.created_at>=v_property_receipt.created_at
  order by activity.created_at desc,activity.id desc limit 1;
  if v_authorized_property is not null then
    v_expected_property:=jsonb_build_object(
      'title',v_authorized_property->'title','title_i18n',v_authorized_property->'title_i18n',
      'description',v_authorized_property->'description',
      'description_i18n',v_authorized_property->'description_i18n',
      'city',v_authorized_property->'city','address_line',v_authorized_property->'address_line',
      'district',v_authorized_property->'district','postal_code',v_authorized_property->'postal_code',
      'country',v_authorized_property->'country','latitude',v_authorized_property->'latitude',
      'longitude',v_authorized_property->'longitude',
      'google_maps_url',v_authorized_property->'google_maps_url',
      'amenities',v_authorized_property->'amenities',
      'check_in_from',v_authorized_property->'check_in_from',
      'check_out_until',v_authorized_property->'check_out_until',
      'cover_image_url',v_authorized_property->'cover_image_url',
      'photos',v_authorized_property->'photos');
  end if;
  select jsonb_build_object(
    'title',hotel.title,'title_i18n',hotel.title_i18n,
    'description',hotel.description,'description_i18n',hotel.description_i18n,
    'city',hotel.city,'address_line',hotel.address_line,'district',hotel.district,
    'postal_code',hotel.postal_code,'country',hotel.country,
    'latitude',hotel.latitude,'longitude',hotel.longitude,
    'google_maps_url',hotel.google_maps_url,'amenities',hotel.amenities,
    'check_in_from',hotel.check_in_from,'check_out_until',hotel.check_out_until,
    'cover_image_url',hotel.cover_image_url,'photos',hotel.photos)
    into v_actual_property from public.hotels hotel where hotel.id=c_hotel;
  if (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or v_lifecycle_fingerprint is null
     or v_property is null or v_stage2 is null
     or v_property->'site_settings' is null
     or v_stage2->'site_settings' is null
     or v_owner.contract_version<>'hotels_v2_admin_d_foundation_evolution_v2'
     or v_owner.before_current_protected_fingerprint<>
       public.hotel_v2_h3_2b_hash(v_owner.before_current_protected_fingerprints)
     or v_owner.current_protected_fingerprint<>
       public.hotel_v2_h3_2b_hash(v_owner.current_protected_fingerprints)
     or v_owner.stage2_before_current_protected_fingerprint<>
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_before_current_protected_fingerprints)
     or v_owner.stage2_current_protected_fingerprint<>
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_current_protected_fingerprints)
     or v_property_receipt.protected_fingerprint<>
       public.hotel_v2_h3_2b_hash(v_property_receipt.protected_fingerprints)
     or v_property_receipt.owner_evolution_receipt_id<>v_owner.id
     or v_property_receipt.owner_evolution_receipt_fingerprint<>
       public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),'{created_at}',
         to_jsonb(extract(epoch from v_owner.created_at)),false))
     or not exists(select 1 from pg_class relation where relation.oid=
       'public.hotel_admin_availability_foundation_evolution_receipts'::regclass
       and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_admin_availability_foundation_evolution_receipts'::regclass
       and trigger_row.tgname='hotel_admin_availability_foundation_evolution_immutable'
       and trigger_row.tgfoid=to_regprocedure('public.hotel_v2_admin_d_immutable_row()')
       and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_class relation where relation.oid=
       'public.hotel_partner_property_proposal_foundation_receipts'::regclass
       and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_partner_property_proposal_foundation_receipts'::regclass
       and trigger_row.tgname='hotel_partner_property_proposal_foundation_receipts_immutable'
       and trigger_row.tgfoid=to_regprocedure('public.hotel_v2_h3_2b_immutable_row()')
       and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name) where has_table_privilege(0::oid,
         'public.hotel_partner_property_proposal_foundation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('anon',
         'public.hotel_partner_property_proposal_foundation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('authenticated',
         'public.hotel_partner_property_proposal_foundation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('service_role',
         'public.hotel_partner_property_proposal_foundation_receipts'::regclass,
         privilege.name))
     or v_owner.hotel_id<>c_hotel
     or v_owner.owner_user_ids is distinct from v_owner_user_ids
     or v_actual_property is null or v_actual_property is distinct from v_expected_property
     or not exists(select 1 from public.partner_resources assignment
       where assignment.id=v_owner.assignment_id and assignment.partner_id=v_owner.partner_id
         and assignment.resource_type='hotels' and assignment.resource_id=c_hotel)
     or (select count(*) from public.partner_resources assignment
       where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)<>1
     or not exists(select 1 from public.hotel_partner_hotel_permissions permission
       where permission.assignment_id=v_owner.assignment_id
         and permission.partner_id=v_owner.partner_id and permission.hotel_id=c_hotel
         and permission.version=1 and permission.has_mutation_capability
         and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
           is not distinct from v_owner.after_permission) then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_PREFLIGHT_FAIL: Task2 protected state drift';
  end if;
  if (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints)
         and receipt.protected_fingerprints is not null)
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or not coalesce((v_owner_state->>'original_receipt_intact')::boolean,false)
     or not coalesce((v_owner_state->>'seven_arches_assignment_exact')::boolean,false)
     or not coalesce((v_owner_state->>'seven_arches_owner_preset_exact')::boolean,false)
     or not coalesce((v_owner_state->>'audit_chain_exact')::boolean,false)
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1
         and receipt.created_at is not null and isfinite(receipt.created_at)
         and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
         and jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
         and not exists(select 1 from jsonb_each_text(
           receipt.compatibility_function_fingerprints) fingerprint(signature,value)
           where (fingerprint.value~'^[0-9a-f]{64}$') is distinct from true)) then
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
       or hotel_rooms_v2_enabled
       or hotel_external_sync_enabled is null
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)
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
