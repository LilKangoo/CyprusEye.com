-- Read-only production preflight for the forward 7 Arches owner preset.
-- Supabase SQL Editor compatible. Run before migration 143.6.
begin;
set transaction read only;
set local statement_timeout='90s';

do $preflight$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_receipt constant uuid:='37500000-0000-4000-8000-000000000001';
  c_correlation constant uuid:='37500000-0000-4000-8000-000000000002';
  c_idempotency constant uuid:='37500000-0000-4000-8000-000000000003';
  c_activity constant uuid:='37500000-0000-4000-8000-000000000004';
  c_outbox constant uuid:='37500000-0000-4000-8000-000000000005';
  v_partner uuid;
  v_owner_count integer;
  v_external boolean;
  v_pricing jsonb;
begin
  if to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_admin_d_immutable_row()') is null
     or to_regprocedure('public.hotel_v2_h3_2a_permissions_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)') is null
     or to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()') is null
     or to_regprocedure('public.hotel_v2_h3_2b_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_h3_2b_immutable_row()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null
     or to_regprocedure('extensions.digest(bytea,text)') is null
     or to_regclass('public.hotel_admin_availability_foundation_receipts') is null
     or to_regclass('public.hotel_partner_workspace_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regclass('public.hotel_partner_hotel_permissions') is null
     or to_regclass('public.hotel_partner_action_receipts') is null
     or to_regclass('public.hotel_partner_event_outbox') is null
     or to_regclass('public.hotel_pricing_promotion_reviews') is null
     or to_regclass('public.hotel_activity_log') is null then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: prerequisite missing';
  end if;

  if to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is not null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is not null then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: migration boundary mismatch';
  end if;

  -- Historical receipts are immutable evidence. Validate their stored values,
  -- never by requiring current mutable business rows to equal old snapshots.
  if (select count(*) from public.hotel_admin_availability_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
         convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
     or (select count(*) from public.hotel_partner_workspace_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
     or (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints))
     or (select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1
         and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
         and jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
         and (select count(*)
           from jsonb_object_keys(receipt.compatibility_function_fingerprints))=20
         and receipt.compatibility_function_fingerprints ?& array[
           'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
           'public.hotel_v2_partner_list_assigned_properties(uuid)',
           'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
           'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
           'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
           'public.hotel_v2_admin_get_content_control(uuid)',
           'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
           'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
           'public.hotel_v2_h3_2b_flags_off()',
           'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
           'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)',
           'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)'
         ]::text[]
         and not exists(select 1
           from jsonb_each_text(receipt.compatibility_function_fingerprints) fingerprint(signature,value)
           where fingerprint.value!~'^[0-9a-f]{64}$')) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: historical receipt integrity mismatch';
  end if;

  -- Function source lineage is held by the immutable activation receipt.
  -- Ownership, search_path and ACLs are checked separately because they are
  -- not represented by a function-source fingerprint alone.
  if exists(select 1 from (values
      ('public.hotel_v2_admin_d_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4'),
      ('public.hotel_v2_admin_d_immutable_row()',false,
        array['search_path=pg_catalog']::text[],
        'bf10c8d2393ef28580dc1079c3b07f0985c6676cce1e5792460aedc6c1453bfa'),
      ('public.hotel_v2_h3_2a_permissions_snapshot(uuid)',true,
        array['search_path=pg_catalog, public']::text[],
        '2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3'),
      ('public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)',true,
        array['search_path=pg_catalog, public']::text[],
        'be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()',false,
        array['search_path=pg_catalog, public']::text[],
        '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',false,
        array['search_path=pg_catalog, public']::text[],
        '190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5'),
      ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',false,
        array['search_path=pg_catalog, public']::text[],
        '3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35'),
      ('public.hotel_v2_h3_2b_hash(jsonb)',false,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'),
      ('public.hotel_v2_h3_2b_immutable_row()',false,
        array['search_path=pg_catalog']::text[],
        'b461f8218dc31b9d5cce8ea6893593c9ce058a04dd38e5a2271c7aec2654cc3e'),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914')
    ) expected(signature,security_definer,path,source_hash)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        <>expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_class relation
       where relation.oid='public.hotel_admin_availability_foundation_receipts'::regclass
         and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or exists(select 1 from pg_policy policy
       where policy.polrelid in(
         'public.hotel_admin_availability_foundation_receipts'::regclass,
         'public.hotel_partner_workspace_foundation_receipts'::regclass))
     or not exists(select 1 from pg_class relation
       where relation.oid='public.hotel_partner_workspace_foundation_receipts'::regclass
         and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or not exists(select 1 from pg_class relation
       where relation.oid='hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass
         and relation.relowner='postgres'::regrole)
     or not exists(select 1 from pg_class relation
       where relation.oid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and relation.relowner='postgres'::regrole)
     or exists(select 1 from (values
        ('public.hotel_admin_availability_foundation_receipts'::regclass),
        ('public.hotel_partner_workspace_foundation_receipts'::regclass),
        ('hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass),
        ('hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass),
        ('public.hotel_partner_hotel_permissions'::regclass)
       ) protected(relation_oid),
       unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name),
       unnest(array['anon','authenticated','service_role']) role_name
       where has_table_privilege(role_name,protected.relation_oid,privilege.name)
          or has_table_privilege(0::oid,protected.relation_oid,privilege.name))
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid='public.hotel_admin_availability_foundation_receipts'::regclass
         and trigger_row.tgname='hotel_admin_availability_foundation_immutable'
         and trigger_row.tgfoid='public.hotel_v2_admin_d_immutable_row()'::regprocedure
         and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
         and trigger_row.tgtype=27)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid='public.hotel_partner_workspace_foundation_receipts'::regclass
         and trigger_row.tgname='hotel_partner_workspace_foundation_receipts_immutable'
         and trigger_row.tgfoid='public.hotel_v2_h3_2b_immutable_row()'::regprocedure
         and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
         and trigger_row.tgtype=27)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid='hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass
         and trigger_row.tgname='hotel_external_calendar_foundation_receipt_immutable'
         and trigger_row.tgfoid='public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure
         and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
         and trigger_row.tgtype=27)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable'
         and trigger_row.tgfoid='public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure
         and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
         and trigger_row.tgtype=27) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: frozen function/security topology mismatch';
  end if;

  if not (select count(*)=1 and bool_and(id=1
      and hotel_rooms_v2_enabled is false
      and hotel_instant_booking_enabled is false
      and hotel_stripe_connect_enabled is false
      and hotel_external_sync_enabled is not null) from public.site_settings) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: unsupported Hotels feature flag state';
  end if;
  select hotel_external_sync_enabled into strict v_external
  from public.site_settings where id=1;
  if v_external and not exists(select 1
      from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints
        is not distinct from public.hotel_v2_external_calendar_activation_function_fingerprints()) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: Stage2F function compatibility mismatch';
  end if;

  select hotel.owner_partner_id into v_partner
  from public.hotels hotel where hotel.id=c_hotel;
  select count(*)::integer into v_owner_count
  from public.partner_users member
  where member.partner_id=v_partner and member.role='owner';
  if v_partner is null
     or not exists(select 1 from public.hotels hotel where hotel.id=c_hotel
       and hotel.architecture_version='legacy'
       and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
       and jsonb_array_length(hotel.pricing_tiers->'rules')=63)
     or exists(select 1 from public.hotel_rate_plans where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_pricing_schedules where hotel_id=c_hotel and is_active)
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or (select count(*) from public.partner_resources assignment
       where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)<>1
     or not exists(select 1 from public.partner_resources assignment
       where assignment.partner_id=v_partner and assignment.resource_type='hotels'
         and assignment.resource_id=c_hotel)
     or not exists(select 1 from public.partners partner where partner.id=v_partner
       and partner.status='active' and partner.can_manage_hotels)
     or v_owner_count<1 then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: exact 7 Arches target/assignment boundary mismatch';
  end if;

  v_pricing:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if v_pricing#>>'{promotion,status}'<>'reviewed'
     or v_pricing#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or (v_pricing#>>'{source,rule_count}')::integer<>63
     or v_pricing->>'pricing_occupancy_mapping_fingerprint'<>'6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_pricing#>>'{parity,fingerprint}'<>'b3c915266ab060efaba522cf5587fb75'
     or (v_pricing#>>'{parity,total_case_count}')::integer<>70
     or (v_pricing#>>'{parity,total_mismatch_count}')::integer<>0
     or (v_pricing#>>'{target,room_schedule,tier_count}')::integer<>27
     or (v_pricing#>>'{source,property_party_preview,tier_count}')::integer<>63
     or not exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=c_hotel
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed'
         and review.acknowledged_pricing_occupancy_mapping
         and review.source_fingerprint=v_pricing#>>'{source,pricing_fingerprint}'
         and review.target_fingerprint=v_pricing#>>'{target,target_fingerprint}'
         and review.pricing_occupancy_mapping_fingerprint=
           v_pricing->>'pricing_occupancy_mapping_fingerprint'
         and review.parity_fingerprint=v_pricing#>>'{parity,fingerprint}'
         and review.parity_case_count=(v_pricing#>>'{parity,total_case_count}')::integer
         and review.parity_mismatch_count=(v_pricing#>>'{parity,total_mismatch_count}')::integer
         and review.result->>'target_fingerprint'=review.target_fingerprint) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: reviewed pricing/parity boundary mismatch';
  end if;

  if exists(select 1 from public.hotel_partner_hotel_permissions permission
       where permission.hotel_id=c_hotel) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: existing Hotel permission boundary mismatch';
  end if;
  if exists(select 1 from public.hotel_activity_log
       where id=c_activity or correlation_id=c_correlation)
     or exists(select 1 from public.hotel_partner_action_receipts
       where id=c_receipt or idempotency_key=c_idempotency or correlation_id=c_correlation)
     or exists(select 1 from public.hotel_partner_event_outbox
       where id=c_outbox or dedupe_key='h3_2a:permission:'||c_receipt::text) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: reserved audit identity boundary mismatch';
  end if;
end
$preflight$;

with constants as(
  select '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    '37500000-0000-4000-8000-000000000001'::uuid receipt_id,
    '37500000-0000-4000-8000-000000000002'::uuid correlation_id,
    '37500000-0000-4000-8000-000000000003'::uuid idempotency_key,
    '37500000-0000-4000-8000-000000000004'::uuid activity_id,
    '37500000-0000-4000-8000-000000000005'::uuid outbox_id
), target as(
  select hotel.id hotel_id,hotel.owner_partner_id,hotel.architecture_version,
    md5(hotel.pricing_tiers::text) pricing_fingerprint,
    jsonb_array_length(hotel.pricing_tiers->'rules') pricing_rule_count
  from public.hotels hotel cross join constants where hotel.id=constants.hotel_id
), owner_membership as(
  select count(*)::integer owner_count
  from public.partner_users member cross join target
  where member.partner_id=target.owner_partner_id and member.role='owner'
), pricing as(
  select public.hotel_v2_h3_1p_pricing_promotion_snapshot(constants.hotel_id) value
  from constants
), checks as(
  select
    (select count(*)=1 and bool_and(receipt.id=1 and receipt.protected_fingerprint=
      encode(extensions.digest(convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
      from public.hotel_admin_availability_foundation_receipts receipt)
    and (select count(*)=1 and bool_and(receipt.id=1 and receipt.protected_fingerprint=
      public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
      from public.hotel_partner_workspace_foundation_receipts receipt)
    and (select count(*)=1 and bool_and(receipt.id=1 and receipt.protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints))
      from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt)
    and (select count(*)=1 and bool_and(receipt.id=1
      and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
      and jsonb_typeof(receipt.compatibility_function_fingerprints)='object')
      from hotels_v2_private.hotel_external_calendar_activation_receipts receipt)
      as historical_receipts_intact,
    not exists(select 1 from (values
      ('public.hotel_v2_admin_d_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4'),
      ('public.hotel_v2_admin_d_immutable_row()',false,array['search_path=pg_catalog']::text[],
        'bf10c8d2393ef28580dc1079c3b07f0985c6676cce1e5792460aedc6c1453bfa'),
      ('public.hotel_v2_h3_2a_permissions_snapshot(uuid)',true,
        array['search_path=pg_catalog, public']::text[],
        '2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3'),
      ('public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)',true,
        array['search_path=pg_catalog, public']::text[],
        'be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()',false,
        array['search_path=pg_catalog, public']::text[],
        '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',false,
        array['search_path=pg_catalog, public']::text[],
        '190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5'),
      ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',false,
        array['search_path=pg_catalog, public']::text[],
        '3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35'),
      ('public.hotel_v2_h3_2b_hash(jsonb)',false,array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'),
      ('public.hotel_v2_h3_2b_immutable_row()',false,array['search_path=pg_catalog']::text[],
        'b461f8218dc31b9d5cce8ea6893593c9ce058a04dd38e5a2271c7aec2654cc3e'),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914')
      ) expected(signature,security_definer,path,source_hash)
      left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
      where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
        or procedure_row.prosecdef is distinct from expected.security_definer
        or procedure_row.proconfig is distinct from expected.path
        or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
          <>expected.source_hash
        or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
      and not exists(select 1 from (values
        ('public.hotel_admin_availability_foundation_receipts'::regclass),
        ('public.hotel_partner_workspace_foundation_receipts'::regclass),
        ('hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass),
        ('hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass),
        ('public.hotel_partner_hotel_permissions'::regclass)
      ) protected(relation_oid),
      unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name),
      unnest(array['anon','authenticated','service_role']) role_name
      where has_table_privilege(role_name,protected.relation_oid,privilege.name)
         or has_table_privilege(0::oid,protected.relation_oid,privilege.name))
      as frozen_function_security_exact,
    (select count(*)=1 and bool_and(id=1 and hotel_rooms_v2_enabled is false
      and hotel_instant_booking_enabled is false and hotel_stripe_connect_enabled is false
      and hotel_external_sync_enabled is not null) from public.site_settings)
      as supported_hotels_flags,
    not exists(select 1 from public.site_settings setting where setting.id=1
      and setting.hotel_external_sync_enabled and not exists(select 1
        from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
        where receipt.id=1 and receipt.compatibility_function_fingerprints
          is not distinct from public.hotel_v2_external_calendar_activation_function_fingerprints()))
      as stage2f_function_compatibility,
    exists(select 1 from target join public.partners partner on partner.id=target.owner_partner_id
      where target.architecture_version='legacy'
        and target.pricing_fingerprint='7208ab4ecc0e47abd64d87ca1ac53a03'
        and target.pricing_rule_count=63 and partner.status='active' and partner.can_manage_hotels)
      and (select count(*) from public.partner_resources assignment,constants
        where assignment.resource_type='hotels' and assignment.resource_id=constants.hotel_id)=1
      and exists(select 1 from public.partner_resources assignment,target
        where assignment.partner_id=target.owner_partner_id
          and assignment.resource_type='hotels' and assignment.resource_id=target.hotel_id)
      and (select owner_count from owner_membership)>=1
      as seven_arches_target_exact,
    (select value#>>'{promotion,status}'='reviewed'
      and value#>>'{source,pricing_fingerprint}'='7208ab4ecc0e47abd64d87ca1ac53a03'
      and (value#>>'{source,rule_count}')::integer=63
      and value->>'pricing_occupancy_mapping_fingerprint'='6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
      and value#>>'{parity,fingerprint}'='b3c915266ab060efaba522cf5587fb75'
      and (value#>>'{parity,total_case_count}')::integer=70
      and (value#>>'{parity,total_mismatch_count}')::integer=0
      and (value#>>'{target,room_schedule,tier_count}')::integer=27
      and (value#>>'{source,property_party_preview,tier_count}')::integer=63
      from pricing) and public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
      and not exists(select 1 from public.hotel_rate_plans plan,constants
        where plan.hotel_id=constants.hotel_id and plan.is_active)
      and not exists(select 1 from public.hotel_room_rates rate,constants
        where rate.hotel_id=constants.hotel_id and rate.is_active)
      and not exists(select 1 from public.hotel_pricing_schedules schedule,constants
        where schedule.hotel_id=constants.hotel_id and schedule.is_active)
      and exists(select 1 from public.hotel_pricing_promotion_reviews review
        cross join pricing cross join constants
        where review.hotel_id=constants.hotel_id
          and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
          and review.review_status='reviewed'
          and review.acknowledged_pricing_occupancy_mapping
          and review.source_fingerprint=pricing.value#>>'{source,pricing_fingerprint}'
          and review.target_fingerprint=pricing.value#>>'{target,target_fingerprint}'
          and review.pricing_occupancy_mapping_fingerprint=
            pricing.value->>'pricing_occupancy_mapping_fingerprint'
          and review.parity_fingerprint=pricing.value#>>'{parity,fingerprint}'
          and review.parity_case_count=
            (pricing.value#>>'{parity,total_case_count}')::integer
          and review.parity_mismatch_count=
            (pricing.value#>>'{parity,total_mismatch_count}')::integer
          and review.result->>'target_fingerprint'=review.target_fingerprint)
      as reviewed_pricing_boundary_exact,
    not exists(select 1 from public.hotel_partner_hotel_permissions permission,constants
      where permission.hotel_id=constants.hotel_id) as permission_boundary_exact,
    to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is null
      and to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
      as migration_boundary_exact,
    not exists(select 1 from public.hotel_activity_log activity,constants
      where activity.id=constants.activity_id or activity.correlation_id=constants.correlation_id)
      and not exists(select 1 from public.hotel_partner_action_receipts receipt,constants
        where receipt.id=constants.receipt_id or receipt.idempotency_key=constants.idempotency_key
          or receipt.correlation_id=constants.correlation_id)
      and not exists(select 1 from public.hotel_partner_event_outbox event,constants
        where event.id=constants.outbox_id
          or event.dedupe_key='h3_2a:permission:'||constants.receipt_id::text)
      as audit_identity_boundary_exact
)
select 'hotels_v2_seven_arches_owner_operational_capabilities_preflight_v2' contract_version,
  owner_membership.owner_count,
  (not historical_receipts_intact)::integer historical_receipt_integrity_mismatch,
  (not frozen_function_security_exact)::integer frozen_function_security_mismatch,
  (not supported_hotels_flags)::integer supported_hotels_flags_mismatch,
  (not stage2f_function_compatibility)::integer stage2f_compatibility_mismatch,
  (not seven_arches_target_exact)::integer seven_arches_target_mismatch,
  (not reviewed_pricing_boundary_exact)::integer reviewed_pricing_boundary_mismatch,
  (not permission_boundary_exact)::integer permission_boundary_mismatch,
  (not migration_boundary_exact)::integer migration_boundary_mismatch,
  (not audit_identity_boundary_exact)::integer audit_identity_boundary_mismatch,
  historical_receipts_intact and frozen_function_security_exact and supported_hotels_flags
    and stage2f_function_compatibility and seven_arches_target_exact
    and reviewed_pricing_boundary_exact and permission_boundary_exact
    and migration_boundary_exact and audit_identity_boundary_exact
    as hotels_v2_seven_arches_owner_operational_capabilities_preflight_safe
from checks cross join owner_membership;
commit;
