\set ON_ERROR_STOP on
-- LOCAL DIAGNOSTIC ONLY, not an activation implementation or production gate.
-- Requires the synthetic 114450 fixture plus the local 114460 package.
-- Every flag/permission probe is rolled back, including on assertion failure.
begin;
set local statement_timeout='180s';
do $local_only$
begin
  if current_database() <> 'hotels_functional_lifecycle_20260907'
     or inet_server_addr() is distinct from '127.0.0.1'::inet
     or inet_server_port() is distinct from 55479 then
    raise exception 'isolated lifecycle fixture required';
  end if;
end
$local_only$;

do $matrix$
declare
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_case record;
  v_current boolean;
  v_topology boolean;
  v_scoped boolean;
  v_external boolean;
  v_quote_error text;
  v_request jsonb;
  v_cases integer := 0;
  v_actor uuid;
  v_partner uuid;
  v_assignment uuid;
  v_error text;
begin
  if public.hotel_v2_external_calendar_provider_evolution_is_safe() is not true
     or (select count(*) from public.site_settings) <> 1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or exists(select 1 from hotel_stripe_connect_private.accounts)
     or exists(select 1 from hotel_stripe_connect_private.oauth_states)
     or exists(select 1 from hotel_stripe_connect_private.events) then
    raise exception 'accepted inactive fixture required';
  end if;
  v_request := jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_public_quote_request_v1',
    'hotel_id',c_hotel,'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
    'room_rate_id','7e420964-9cbf-4f1b-abd3-09840af5240f',
    'arrival_date',current_date+45,'departure_date',current_date+47,
    'guest_count',2,'selected_extra_ids','[]'::jsonb);
  for v_case in select rooms, stripe, instant
    from unnest(array[false,true]) r(rooms)
    cross join unnest(array[false,true]) s(stripe)
    cross join unnest(array[false,true]) i(instant)
    order by rooms,stripe,instant
  loop
    update public.site_settings set hotel_rooms_v2_enabled=v_case.rooms,
      hotel_stripe_connect_enabled=v_case.stripe,
      hotel_instant_booking_enabled=v_case.instant where id=1;
    v_current := not v_case.rooms and not v_case.stripe and not v_case.instant;
    v_topology := public.hotel_v2_seven_arches_independent_pricing_topology_is_exact();
    v_scoped := public.hotel_v2_seven_arches_pricing_scoped_lineage() is not null;
    v_external := public.hotel_v2_external_calendar_site_settings_fingerprint() is not null;
    if v_topology is distinct from v_current or v_scoped is distinct from v_current
       or v_external is distinct from v_current then
      raise exception 'unexpected current-boundary leaf: rooms %, stripe %, instant %, topology %, scoped %, external %',
        v_case.rooms,v_case.stripe,v_case.instant,v_topology,v_scoped,v_external;
    end if;
    v_quote_error := null;
    begin
      perform public.hotel_v2_public_quote_seven_arches(v_request);
    exception when others then v_quote_error := sqlstate||':'||sqlerrm;
    end;
    if v_quote_error is distinct from (case when v_case.rooms
      then '55000:hotels_v2_seven_arches_public_quote_authority_invalid'
      else '42501:hotels_v2_public_booking_disabled' end) then
      raise exception 'unexpected public boundary: %',v_quote_error;
    end if;
    raise notice 'LIFECYCLE_BOUNDARY rooms=% stripe=% instant=% external=true topology=% scoped=% external_fingerprint=% public=%',
      v_case.rooms,v_case.stripe,v_case.instant,v_topology,v_scoped,v_external,v_quote_error;
    v_cases := v_cases+1;
  end loop;

  update public.site_settings set hotel_rooms_v2_enabled=false,
    hotel_stripe_connect_enabled=false,hotel_instant_booking_enabled=false where id=1;
  select r.partner_id,r.assignment_id into strict v_partner,v_assignment
    from public.hotel_admin_availability_foundation_evolution_receipts r where r.hotel_id=c_hotel;
  select m.user_id into v_actor from public.partner_users m
    where m.partner_id=v_partner and m.role='owner' order by m.user_id limit 1;
  if v_actor is null or not exists(select 1 from public.hotel_partner_hotel_permissions
    where assignment_id=v_assignment and initiate_stripe_onboarding is false and version=1) then
    raise exception 'accepted owner preset required';
  end if;

  update public.site_settings set hotel_stripe_connect_enabled=true where id=1;
  begin
    perform hotel_stripe_connect_private.scope(v_actor,v_partner,c_hotel);
  exception when others then v_error := sqlstate||':'||sqlerrm;
  end;
  if v_error is distinct from '42501:hotel_stripe_connect_access_denied' then
    raise exception 'unexpected owner-scope result: %',v_error;
  end if;
  raise notice 'STRIPE_FLAG_ALONE_DOES_NOT_GRANT_OWNER_PERMISSION=PASS';
  update public.site_settings set hotel_stripe_connect_enabled=false where id=1;

  -- Isolate the permission from the flags. This is a deliberate negative, not
  -- a proposed grant or authorization to edit the historical owner receipt.
  update public.hotel_partner_hotel_permissions set initiate_stripe_onboarding=true
    where assignment_id=v_assignment;
  if public.hotel_v2_seven_arches_pricing_scoped_lineage() is not null then
    raise exception 'unattributed permission change was accepted';
  end if;
  if hotel_stripe_connect_private.scope(v_actor,v_partner,c_hotel) is not false then
    raise exception 'disabled platform must remain disabled even with permission';
  end if;
  raise notice 'OWNER_PERMISSION_CHANGE_INDEPENDENTLY_INVALIDATES_LINEAGE=PASS';
  if v_cases<>8 then raise exception 'matrix incomplete';end if;
  raise notice 'LIFECYCLE_BOUNDARY_DIAGNOSIS=PASS matrix=8 permission_negatives=2 remediation=NOT_IMPLEMENTED';
end
$matrix$;
rollback;

begin;
set transaction read only;
do $containment$
begin
  if public.hotel_v2_external_calendar_provider_evolution_is_safe() is not true
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or exists(select 1 from hotel_stripe_connect_private.accounts)
     or exists(select 1 from hotel_stripe_connect_private.oauth_states)
     or exists(select 1 from hotel_stripe_connect_private.events)
     or exists(select 1 from public.hotel_partner_hotel_permissions p
       join public.hotel_admin_availability_foundation_evolution_receipts r
       on r.assignment_id=p.assignment_id where p.initiate_stripe_onboarding or p.version<>1)
  then raise exception 'lifecycle diagnostic rollback containment failed';end if;
  raise notice 'LIFECYCLE_BOUNDARY_ROLLBACK_CONTAINMENT=PASS';
end
$containment$;
rollback;
