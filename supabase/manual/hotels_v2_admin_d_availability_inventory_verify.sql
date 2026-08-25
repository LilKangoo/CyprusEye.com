-- Hotels V2 ADMIN-D foundation verification.
-- READ ONLY. Supabase Dashboard SQL Editor compatible.

do $admin_d_foundation$
declare v_missing text[]; v_snapshot jsonb;
begin
  select coalesce(array_agg(name order by name),'{}') into v_missing from unnest(array[
    'public.hotel_unit_calendar_blocks','public.hotel_inventory_day_locks',
    'public.hotel_inventory_holds','public.hotel_booking_room_allocations',
    'public.hotel_inventory_commitments','public.hotel_admin_availability_action_receipts',
    'public.hotel_admin_availability_plan_reviews','public.hotel_admin_availability_foundation_receipts'
  ]) required(name) where to_regclass(name) is null;
  if cardinality(v_missing)>0 then raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL missing relations: %',v_missing; end if;
  select coalesce(array_agg(name order by name),'{}') into v_missing from unnest(array[
    'public.hotel_v2_admin_get_availability_control(uuid,date,date)',
    'public.hotel_v2_admin_preview_availability_plan(jsonb)',
    'public.hotel_v2_admin_apply_availability_control_plan(jsonb,uuid,text)',
    'public.hotel_v2_admin_preview_stay(jsonb)'
  ]) required(name) where to_regprocedure(name) is null;
  if cardinality(v_missing)>0 then raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL missing RPCs: %',v_missing; end if;
  if exists(select 1 from (values
      ('public.hotel_v2_admin_d_keys_allowed(jsonb,text[])',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_hash(jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_uuid_is_canonical(text)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_deterministic_uuid(text)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_reason_is_valid(jsonb)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_json_dates_are_canonical(jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_shared_availability_fields()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_audit_state(text,jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_immutable_row()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_plan_review_consume_guard()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_validate_unit_block()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_allocation()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_commitment()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_allocation_topology()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_hold_topology()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_hold_update()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_validate_room_availability_change()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_unit_availability_change()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_admin_d_review_plan(jsonb)',true,array['search_path=pg_catalog, public, auth']::text[])
    ) expected(signature,security_definer,configuration)
    left join pg_proc p on p.oid=to_regprocedure(expected.signature)
    where p.oid is null or p.proowner<>(select oid from pg_roles where rolname='postgres')
      or p.prosecdef is distinct from expected.security_definer
      or p.proconfig is distinct from expected.configuration
      or has_function_privilege(0::oid,p.oid,'EXECUTE')
      or has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE')) then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL internal function metadata/ACL mismatch'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in('hotel_v2_admin_get_availability_control',
      'hotel_v2_admin_preview_availability_plan','hotel_v2_admin_apply_availability_control_plan',
      'hotel_v2_admin_preview_stay') and (p.proowner<>(select oid from pg_roles where rolname='postgres')
        or not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog, public, auth']::text[]
        or has_function_privilege(0::oid,p.oid,'EXECUTE')
        or has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('service_role',p.oid,'EXECUTE')
        or not has_function_privilege('authenticated',p.oid,'EXECUTE'))) then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL public RPC metadata/ACL mismatch'; end if;
  if exists(select 1 from unnest(array[
      'hotel_unit_calendar_blocks_admin_d_guard','hotel_booking_room_allocations_admin_d_guard',
      'hotel_inventory_commitments_admin_d_guard','hotel_inventory_holds_admin_d_guard',
      'hotel_rate_rules_admin_d_availability_guard','hotel_calendar_overrides_admin_d_availability_guard',
      'hotel_booking_room_allocations_admin_d_topology','hotel_inventory_commitments_admin_d_allocation_topology',
      'hotel_inventory_holds_admin_d_topology','hotel_inventory_commitments_admin_d_hold_topology',
      'hotel_room_types_admin_d_capacity_guard','hotel_units_admin_d_capacity_guard',
      'hotel_admin_availability_receipts_immutable',
      'hotel_admin_availability_reviews_no_delete',
      'hotel_admin_availability_reviews_consume_guard',
      'hotel_admin_availability_foundation_immutable','hotel_unit_calendar_blocks_no_delete',
      'hotel_inventory_holds_no_delete','hotel_booking_room_allocations_no_delete',
      'hotel_inventory_commitments_no_delete']) expected(trigger_name)
    where not exists(select 1 from pg_trigger where tgname=expected.trigger_name and not tgisinternal)) then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL required invariant trigger missing'; end if;
  if exists(select 1 from public.hotel_unit_calendar_blocks)
     or exists(select 1 from public.hotel_inventory_day_locks)
     or exists(select 1 from public.hotel_inventory_holds)
     or exists(select 1 from public.hotel_booking_room_allocations)
     or exists(select 1 from public.hotel_inventory_commitments)
     or exists(select 1 from public.hotel_admin_availability_action_receipts)
     or exists(select 1 from public.hotel_admin_availability_plan_reviews)
     or (select count(*) from public.hotel_admin_availability_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprints=public.hotel_v2_admin_d_protected_fingerprints()
         and receipt.protected_fingerprint=encode(extensions.digest(convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex')) then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL inert foundation is not empty'; end if;
  if exists(select 1 from unnest(array['hotel_unit_calendar_blocks','hotel_inventory_day_locks',
      'hotel_inventory_holds','hotel_booking_room_allocations','hotel_inventory_commitments',
      'hotel_admin_availability_action_receipts','hotel_admin_availability_plan_reviews',
      'hotel_admin_availability_foundation_receipts']) v(name)
    cross join unnest(array['anon','authenticated','service_role']) role_name(name)
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
    where has_table_privilege(role_name.name,'public.'||v.name,privilege_name.name)) then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL raw D table exposed'; end if;
  if exists(select 1 from unnest(array['hotel_room_types','hotel_units','hotel_rate_plans',
      'hotel_room_rates','hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
      'hotel_calendar_overrides']) v(name)
    cross join unnest(array['anon','authenticated']) role_name(name)
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
    where has_table_privilege(role_name.name,'public.'||v.name,privilege_name.name)) then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL normalized availability relation exposed'; end if;
  if not has_function_privilege('authenticated','public.hotel_v2_admin_get_availability_control(uuid,date,date)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_preview_availability_plan(jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_apply_availability_control_plan(jsonb,uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_preview_stay(jsonb)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_admin_get_availability_control(uuid,date,date)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_admin_get_calendar(uuid,date,date)','EXECUTE') then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL RPC ACL mismatch'; end if;
  if (select count(*) from public.site_settings)<>1 or not exists(select 1 from public.site_settings where id=1
    and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
    and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL flags changed'; end if;
  if not exists(select 1 from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
    and architecture_version='legacy' and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03') then
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL legacy pricing drift'; end if;
  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
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
    raise exception 'HOTELS_V2_ADMIN_D_VERIFY_FAIL accepted H3.1P 70/0 contract drift'; end if;
end
$admin_d_foundation$;

select public.hotel_v2_admin_d_protected_fingerprints() as protected_relation_fingerprints,
  true as hotels_v2_admin_d_availability_inventory_foundation_safe
;
