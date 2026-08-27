\set ON_ERROR_STOP on
\set provider_install_external_enabled 1
\set seven_arches_owner_live_drift_fixture 1
\set seven_arches_owner_skip_task2 1
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
\ir ../../supabase/manual/hotels_v2_seven_arches_owner_operational_capabilities_verify.sql
select true as hotels_v2_seven_arches_owner_operational_capabilities_manual_verifier_passed;

begin;
set local statement_timeout='120s';

do $exact_state$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_snapshot jsonb;
begin
  if exists(select 1 from seven_arches_historical_receipts_before historical
      where historical.value is distinct from case historical.receipt_name
        when 'admin_d' then (select to_jsonb(receipt)
          from public.hotel_admin_availability_foundation_receipts receipt where receipt.id=1)
        when 'h3_2b' then (select to_jsonb(receipt)
          from public.hotel_partner_workspace_foundation_receipts receipt where receipt.id=1)
        when 'external_calendar' then (select to_jsonb(receipt)
          from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt where receipt.id=1)
        when 'stage2f_activation' then (select to_jsonb(receipt)
          from hotels_v2_private.hotel_external_calendar_activation_receipts receipt where receipt.id=1)
      end) then
    raise exception 'seven_arches_historical_receipt_changed';
  end if;
  v_snapshot:=public.hotel_v2_admin_d_current_foundation_snapshot();
  if not coalesce((v_snapshot->>'safe')::boolean,false)
     or v_snapshot->>'contract_version'<>'hotels_v2_admin_d_current_foundation_v1'
     or (v_snapshot->>'evolution_receipt_count')::integer<>1
     or not coalesce((v_snapshot->>'historical_receipts_intact')::boolean,false)
     or not coalesce((v_snapshot->>'frozen_contracts_exact')::boolean,false)
     or not coalesce((v_snapshot->>'supported_hotel_flags')::boolean,false)
     or not coalesce((v_snapshot->>'stage2f_function_compatibility_exact')::boolean,false)
     or not coalesce((v_snapshot->>'current_matches_latest')::boolean,false)
     or not coalesce((v_snapshot->>'stage2_current_matches_latest')::boolean,false)
     or not coalesce((v_snapshot->>'seven_arches_target_foundation_exact')::boolean,false)
     or not coalesce((v_snapshot->>'foreign_hotel_permissions_unchanged')::boolean,false) then
    raise exception 'seven_arches_evolution_snapshot_failed:%',v_snapshot;
  end if;
  if not exists(select 1
      from public.hotel_admin_availability_foundation_evolution_receipts receipt
      where receipt.id=1
        and receipt.before_current_protected_fingerprints is not distinct from
          (select value from seven_arches_live_drift_before)
        and receipt.before_current_protected_fingerprint=encode(extensions.digest(
          convert_to(receipt.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
        and receipt.current_protected_fingerprint=encode(extensions.digest(
          convert_to(receipt.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
        and receipt.current_protected_fingerprints is not distinct from
          public.hotel_v2_admin_d_protected_fingerprints()
        and receipt.stage2_before_current_protected_fingerprints is not distinct from
          (select value from seven_arches_live_drift_stage2_before)
        and receipt.stage2_before_current_protected_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(
            receipt.stage2_before_current_protected_fingerprints)
        and receipt.stage2_current_protected_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(
            receipt.stage2_current_protected_fingerprints)
        and receipt.stage2_current_protected_fingerprints is not distinct from
          public.hotel_v2_external_calendar_protected_fingerprints()
        and receipt.allowed_fingerprint_keys=array[
          'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
          'hotel_partner_event_outbox','non_admin_d_activity']::text[]
        and (receipt.current_protected_fingerprints-receipt.allowed_fingerprint_keys)
          is not distinct from
          (receipt.before_current_protected_fingerprints-receipt.allowed_fingerprint_keys)
        and not exists(select 1 from unnest(receipt.allowed_fingerprint_keys) changed(key)
          where receipt.current_protected_fingerprints->changed.key is not distinct from
            receipt.before_current_protected_fingerprints->changed.key)
        and receipt.stage2_allowed_fingerprint_keys=array[
          'hotel_partner_hotel_permissions','non_external_calendar_activity',
          'non_external_calendar_partner_receipts']::text[]
        and (receipt.stage2_current_protected_fingerprints-
          receipt.stage2_allowed_fingerprint_keys) is not distinct from
          (receipt.stage2_before_current_protected_fingerprints-
          receipt.stage2_allowed_fingerprint_keys)
        and not exists(select 1 from unnest(receipt.stage2_allowed_fingerprint_keys) changed(key)
          where receipt.stage2_current_protected_fingerprints->changed.key is not distinct from
            receipt.stage2_before_current_protected_fingerprints->changed.key)) then
    raise exception 'seven_arches_live_baseline_receipt_failed';
  end if;
  if (select count(*) from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel
        and permission.edit_property_content and permission.edit_property_photos
        and permission.edit_room_content and permission.edit_room_photos
        and permission.create_rooms and permission.edit_room_structure
        and permission.manage_prices and permission.manage_availability
        and permission.process_bookings and permission.view_payment_status
        and not permission.request_booking_changes
        and not permission.initiate_stripe_onboarding
        and permission.has_mutation_capability and permission.version=1)<>1
     or (select count(*) from public.hotel_partner_hotel_permissions permission
       where permission.hotel_id=c_hotel and permission.has_mutation_capability)<>1 then
    raise exception 'seven_arches_exact_capability_preset_failed';
  end if;
  if (select count(*) from public.hotel_activity_log activity
      where activity.source='hotels_v2_seven_arches_owner_capability_bootstrap'
        and activity.hotel_id=c_hotel and activity.actor_type='system'
        and activity.actor_id is null and activity.action='update')<>1
     or (select count(*) from public.hotel_partner_action_receipts receipt
       where receipt.action='bootstrap_7_arches_owner_capabilities'
         and receipt.hotel_id=c_hotel)<>1
     or (select count(*) from public.hotel_partner_event_outbox event
       where event.event_type='hotel.partner_permissions.updated'
         and event.hotel_id=c_hotel
         and event.dedupe_key='h3_2a:permission:37500000-0000-4000-8000-000000000001')<>1 then
    raise exception 'seven_arches_audit_receipt_outbox_failed';
  end if;
end
$exact_state$;

do $owner_discovery$
declare v_list jsonb; v_property jsonb; v_denied boolean:=false;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_list:=public.hotel_v2_partner_list_assigned_properties(
    '20000000-0000-4000-8000-000000000001');
  select property.value into strict v_property
  from jsonb_array_elements(v_list->'properties') property(value)
  where property.value->>'hotel_id'='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  if v_property#>'{permission,capabilities}' is distinct from
       jsonb_build_object('edit_property_content',true,'edit_property_photos',true,
         'edit_room_content',true,'edit_room_photos',true,'create_rooms',true,
         'edit_room_structure',true,'manage_prices',true,'manage_availability',true,
         'process_bookings',true,'request_booking_changes',false,
         'view_payment_status',true,'initiate_stripe_onboarding',false)
     or not (v_property#>>'{permission,has_mutation_capability}')::boolean then
    raise exception 'seven_arches_owner_effective_permissions_failed:%',v_property;
  end if;

  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
  begin
    perform public.hotel_v2_partner_list_assigned_properties(
      '20000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'seven_arches_foreign_owner_was_allowed'; end if;
  reset role;
end
$owner_discovery$;

do $acl_and_immutability$
declare v_denied boolean:=false;
begin
  set local role authenticated;
  begin
    perform 1 from public.hotel_admin_availability_foundation_evolution_receipts;
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'seven_arches_evolution_receipt_raw_read_allowed'; end if;
  reset role;

  v_denied:=false;
  begin
    update public.hotel_admin_availability_foundation_evolution_receipts
    set contract_version=contract_version where id=1;
  exception when sqlstate '55000' then v_denied:=true;
  end;
  if not v_denied then raise exception 'seven_arches_evolution_receipt_mutable'; end if;
end
$acl_and_immutability$;

-- Rollback-contained fail-closed checks for the exact owner boundary and all
-- unsupported Hotels lifecycle flags.
savepoint wrong_owner_assignment;
update public.hotels set owner_partner_id='20000000-0000-4000-8000-000000000002'
where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
do $$declare v_state jsonb:=public.hotel_v2_admin_d_current_foundation_snapshot(); begin
  if coalesce((v_state->>'safe')::boolean,false)
     or coalesce((v_state->>'seven_arches_assignment_exact')::boolean,true)
  then raise exception 'seven_arches_wrong_owner_assignment_accepted:%',v_state; end if;
end$$;
rollback to savepoint wrong_owner_assignment;

savepoint existing_permission_boundary;
insert into public.partner_resources(id,partner_id,resource_type,resource_id) values(
  '36000000-0000-4000-8000-000000000120','20000000-0000-4000-8000-000000000002',
  'hotels','9b6d99a0-923a-4fbc-be54-c066e856e6ca');
insert into public.hotel_partner_hotel_permissions(
  assignment_id,partner_id,hotel_id,view_payment_status
) values(
  '36000000-0000-4000-8000-000000000120','20000000-0000-4000-8000-000000000002',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',true);
do $$declare v_state jsonb:=public.hotel_v2_admin_d_current_foundation_snapshot(); begin
  if coalesce((v_state->>'safe')::boolean,false)
     or coalesce((v_state->>'seven_arches_assignment_exact')::boolean,true)
     or coalesce((v_state->>'seven_arches_owner_preset_exact')::boolean,true)
  then raise exception 'seven_arches_existing_permission_boundary_accepted:%',v_state; end if;
end$$;
rollback to savepoint existing_permission_boundary;

savepoint rooms_flag;
update public.site_settings set hotel_rooms_v2_enabled=true where id=1;
do $$declare v_state jsonb:=public.hotel_v2_admin_d_current_foundation_snapshot(); begin
  if coalesce((v_state->>'safe')::boolean,false)
     or coalesce((v_state->>'supported_hotel_flags')::boolean,true)
  then raise exception 'seven_arches_rooms_flag_accepted:%',v_state; end if;
end$$;
rollback to savepoint rooms_flag;

savepoint instant_flag;
update public.site_settings set hotel_instant_booking_enabled=true where id=1;
do $$declare v_state jsonb:=public.hotel_v2_admin_d_current_foundation_snapshot(); begin
  if coalesce((v_state->>'safe')::boolean,false)
     or coalesce((v_state->>'supported_hotel_flags')::boolean,true)
  then raise exception 'seven_arches_instant_flag_accepted:%',v_state; end if;
end$$;
rollback to savepoint instant_flag;

savepoint stripe_flag;
update public.site_settings set hotel_stripe_connect_enabled=true where id=1;
do $$declare v_state jsonb:=public.hotel_v2_admin_d_current_foundation_snapshot(); begin
  if coalesce((v_state->>'safe')::boolean,false)
     or coalesce((v_state->>'supported_hotel_flags')::boolean,true)
  then raise exception 'seven_arches_stripe_flag_accepted:%',v_state; end if;
end$$;
rollback to savepoint stripe_flag;

savepoint activation_function_drift;
create or replace function public.hotel_v2_h3_2b_flags_off()
returns boolean language sql stable security definer set search_path=pg_catalog,public
as $$select false$$;
do $$declare v_state jsonb:=public.hotel_v2_admin_d_current_foundation_snapshot(); begin
  if coalesce((v_state->>'safe')::boolean,false)
     or coalesce((v_state->>'stage2f_function_compatibility_exact')::boolean,true)
     or coalesce((v_state->>'frozen_contracts_exact')::boolean,true)
  then raise exception 'seven_arches_activation_function_drift_accepted:%',v_state; end if;
end$$;
rollback to savepoint activation_function_drift;

savepoint historical_receipt_corruption;
alter table public.hotel_admin_availability_foundation_receipts
  disable trigger hotel_admin_availability_foundation_immutable;
update public.hotel_admin_availability_foundation_receipts
set protected_fingerprint=repeat('0',64) where id=1;
do $$declare v_state jsonb:=public.hotel_v2_admin_d_current_foundation_snapshot(); begin
  if coalesce((v_state->>'safe')::boolean,false)
     or coalesce((v_state->>'original_receipt_intact')::boolean,true)
     or coalesce((v_state->>'historical_receipts_intact')::boolean,true)
  then raise exception 'seven_arches_historical_receipt_corruption_accepted:%',v_state; end if;
end$$;
rollback to savepoint historical_receipt_corruption;

-- A future unreviewed permission change must invalidate the evolved baseline.
update public.hotel_partner_hotel_permissions
set request_booking_changes=true
where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
do $future_drift$
declare v_state jsonb:=public.hotel_v2_admin_d_current_foundation_snapshot();
begin
  if coalesce((v_state->>'safe')::boolean,false)
     or coalesce((v_state->>'current_matches_latest')::boolean,true)
     or coalesce((v_state->>'seven_arches_owner_preset_exact')::boolean,true) then
    raise exception 'seven_arches_future_permission_drift_was_accepted:%',v_state;
  end if;
end
$future_drift$;

select true as hotels_v2_seven_arches_owner_operational_capabilities_postgres_gate_passed;
rollback;
