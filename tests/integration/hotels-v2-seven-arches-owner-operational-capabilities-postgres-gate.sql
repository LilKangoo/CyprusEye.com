\set ON_ERROR_STOP on
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql

create temporary table seven_arches_admin_d_receipt_before on commit preserve rows as
select to_jsonb(receipt) value
from public.hotel_admin_availability_foundation_receipts receipt where receipt.id=1;

begin;
set local statement_timeout='120s';

do $exact_state$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_snapshot jsonb;
begin
  if (select to_jsonb(receipt) from public.hotel_admin_availability_foundation_receipts receipt where id=1)
       is distinct from (select value from seven_arches_admin_d_receipt_before) then
    raise exception 'seven_arches_original_admin_d_receipt_changed';
  end if;
  v_snapshot:=public.hotel_v2_admin_d_current_foundation_snapshot();
  if not coalesce((v_snapshot->>'safe')::boolean,false)
     or v_snapshot->>'contract_version'<>'hotels_v2_admin_d_current_foundation_v1'
     or (v_snapshot->>'evolution_receipt_count')::integer<>1 then
    raise exception 'seven_arches_evolution_snapshot_failed:%',v_snapshot;
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

-- A future unreviewed permission change must invalidate the evolved baseline.
update public.hotel_partner_hotel_permissions
set request_booking_changes=true
where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
do $future_drift$
begin
  if coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'safe')::boolean,false) then
    raise exception 'seven_arches_future_permission_drift_was_accepted';
  end if;
end
$future_drift$;

select true as hotels_v2_seven_arches_owner_operational_capabilities_postgres_gate_passed;
rollback;
