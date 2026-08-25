\set ON_ERROR_STOP on
\ir hotels-v2-admin-d-availability-inventory-postgrest-base.sql

do $admin_d_owner_invariant_gate$
declare v_failed boolean; v_d_state jsonb;
begin
  v_failed:=false;
  begin update public.hotel_rate_rules set nightly_rate=nightly_rate+1,closed_to_arrival=true,
    availability_reason='Cross-domain smuggle',availability_actor_id='10000000-0000-4000-8000-000000000001',
    availability_correlation_id='d9000000-0000-4000-8000-000000000001',
    availability_updated_at=clock_timestamp(),availability_version=availability_version+1
    where id='c1700000-0000-4000-8000-000000000001';
  exception when sqlstate '55000' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_shared_cross_domain_write_allowed'; end if;
  update public.hotel_rate_rules set closed_to_arrival=true,
    availability_reason='Scope freeze probe',availability_actor_id='10000000-0000-4000-8000-000000000001',
    availability_correlation_id='d9000000-0000-4000-8000-000000000002',
    availability_updated_at=clock_timestamp(),availability_version=availability_version+1
    where id='c1700000-0000-4000-8000-000000000001';
  v_failed:=false;
  begin update public.hotel_rate_rules set valid_to=valid_to+1 where id='c1700000-0000-4000-8000-000000000001';
  exception when sqlstate '55000' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_active_rule_scope_change_allowed'; end if;
  select jsonb_build_object('closed_to_arrival',closed_to_arrival,'closed_to_departure',closed_to_departure,
    'availability_reason',availability_reason,'availability_actor_id',availability_actor_id,
    'availability_correlation_id',availability_correlation_id,'availability_updated_at',availability_updated_at,
    'availability_version',availability_version) into v_d_state from public.hotel_rate_rules
    where id='c1700000-0000-4000-8000-000000000001';
  update public.hotel_rate_rules set nightly_rate=nightly_rate+1 where id='c1700000-0000-4000-8000-000000000001';
  if v_d_state is distinct from (select jsonb_build_object('closed_to_arrival',closed_to_arrival,
      'closed_to_departure',closed_to_departure,'availability_reason',availability_reason,
      'availability_actor_id',availability_actor_id,'availability_correlation_id',availability_correlation_id,
      'availability_updated_at',availability_updated_at,'availability_version',availability_version)
      from public.hotel_rate_rules where id='c1700000-0000-4000-8000-000000000001') then
    raise exception 'admin_d_c_price_edit_changed_d_fields'; end if;
  update public.hotel_rate_rules set nightly_rate=90 where id='c1700000-0000-4000-8000-000000000001';
  v_failed:=false;
  begin delete from public.hotel_rate_rules where id='c1700000-0000-4000-8000-000000000001';
  exception when sqlstate '55000' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_rate_rule_history_delete_allowed'; end if;
  update public.hotel_rate_rules set closed_to_arrival=false,
    availability_reason='Scope freeze cleanup',availability_actor_id='10000000-0000-4000-8000-000000000001',
    availability_correlation_id='d9000000-0000-4000-8000-000000000003',
    availability_updated_at=clock_timestamp(),availability_version=availability_version+1
    where id='c1700000-0000-4000-8000-000000000001';
  v_failed:=false;
  begin update public.hotel_calendar_overrides set is_active=false
    where id='c1800000-0000-4000-8000-000000000002';
  exception when sqlstate '55000' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_legacy_operational_scope_change_allowed'; end if;
  v_failed:=false;
  begin delete from public.hotel_calendar_overrides where id='c1800000-0000-4000-8000-000000000002';
  exception when sqlstate '55000' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_operational_history_delete_allowed'; end if;
  v_failed:=false;
  begin update public.hotel_inventory_holds set status='released',released_at=clock_timestamp(),
    release_reason='Invalid direct release',version=version+1,updated_at=clock_timestamp()
    where id='c1b00000-0000-4000-8000-000000000001';
  exception when sqlstate '55000' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_source_released_with_active_child'; end if;
  v_failed:=false;
  begin update public.hotel_room_types set inventory_mode='pooled',base_inventory_count=1
    where id='c1100000-0000-4000-8000-000000000001';
  exception when sqlstate 'PT409' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_room_mode_changed_with_active_commitment'; end if;
  v_failed:=false;
  begin update public.hotel_units set status='inactive' where id='c1600000-0000-4000-8000-000000000001';
  exception when sqlstate 'PT409' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_unit_disabled_with_active_commitment'; end if;
end
$admin_d_owner_invariant_gate$;

create function pg_temp.admin_d_move_booking(p_booking_id uuid,p_arrival date,p_departure date)
returns void language sql security definer set search_path=pg_catalog,public
as $$update public.hotel_bookings set arrival_date=p_arrival,departure_date=p_departure,
  updated_at=clock_timestamp() where id=p_booking_id$$;
create function pg_temp.admin_d_direct_release_allocation(p_booking_id uuid)
returns void language sql security definer set search_path=pg_catalog,public
as $$update public.hotel_booking_room_allocations set status='released',released_at=clock_timestamp(),
  release_reason='Invalid direct allocation release',version=version+1,updated_at=clock_timestamp()
  where booking_id=p_booking_id and status='active'$$;
create function pg_temp.admin_d_daily_inventory_row_exists(p_room_type_id uuid,p_stay_date date)
returns boolean language sql stable security definer set search_path=pg_catalog,public
as $$select exists(select 1 from public.hotel_daily_inventory
  where room_type_id=p_room_type_id and stay_date=p_stay_date)$$;
create function pg_temp.admin_d_calendar_override_pricing_state(p_override_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $$select jsonb_build_object('nightly_rate',nightly_rate,'nightly_rate_mode',nightly_rate_mode,
  'minimum_stay',minimum_stay,'minimum_stay_mode',minimum_stay_mode,'maximum_stay',maximum_stay,
  'maximum_stay_mode',maximum_stay_mode,'pricing_source',pricing_source,'pricing_reason',pricing_reason,
  'pricing_actor_id',pricing_actor_id,'pricing_correlation_id',pricing_correlation_id)
from public.hotel_calendar_overrides where id=p_override_id$$;
create function pg_temp.admin_d_rate_rule_availability_price_state(p_rule_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $$select jsonb_build_object('closed_to_arrival',closed_to_arrival,'nightly_rate',nightly_rate)
from public.hotel_rate_rules where id=p_rule_id$$;
create function pg_temp.admin_d_hold_release_state(p_hold_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $$select jsonb_build_object('status',hold_row.status,
  'active_commitment_count',(select count(*) from public.hotel_inventory_commitments commitment
    where commitment.hold_id=hold_row.id and commitment.status='active'))
from public.hotel_inventory_holds hold_row where hold_row.id=p_hold_id$$;
create function pg_temp.admin_d_booking_active_commitment_state(p_booking_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $$select coalesce(jsonb_agg(jsonb_build_object('allocation_status',allocation.status,
  'stay_date',commitment.stay_date) order by commitment.id),'[]'::jsonb)
from public.hotel_inventory_commitments commitment
join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
where allocation.booking_id=p_booking_id and commitment.status='active'$$;

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $admin_d_pg_gate$
declare
  c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_room constant uuid:='c1100000-0000-4000-8000-000000000001';
  c_unit constant uuid:='c1600000-0000-4000-8000-000000000001';
  c_rate constant uuid:='c1300000-0000-4000-8000-000000000001';
  c_rule constant uuid:='c1700000-0000-4000-8000-000000000001';
  c_booking constant uuid:='c1a00000-0000-4000-8000-000000000001';
  v_control jsonb; v_preview jsonb; v_plan jsonb; v_result jsonb; v_date date:=current_date+30;
  v_updated_at text; v_failed boolean; v_price jsonb; v_hold_state jsonb; v_commitments jsonb;
begin
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date,v_date+2);
  if v_control->>'contract_version'<>'hotels_v2_admin_d_availability_control_v1'
     or jsonb_typeof(v_control->'cells')<>'array' or (v_control->>'public_change')::boolean then
    raise exception 'admin_d_get_contract_failed'; end if;
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,
    'from',v_date,'to',v_date+2,'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(
      jsonb_build_object('entity','daily_inventory','action','upsert','id',null,'payload',jsonb_build_object(
        'room_type_id',c_room,'stay_date',v_date,'sellable_units',0,'sellable_units_mode','set',
        'closed',false,'closed_mode','set','reason','Different audit context must remain a no-op','expires_at',null)))));
  v_plan:=v_preview->'reviewed_plan';
  if not (v_preview->>'changed')::boolean or jsonb_array_length(v_plan->'operations')<>1 then
    raise exception 'admin_d_preview_failed'; end if;
  if v_plan#>>'{operations,0,id}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'admin_d_server_id_not_canonical: %',v_plan#>>'{operations,0,id}'; end if;
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_plan,
    'd0000000-0000-4000-8000-000000000001','admin-d-pg-gate-0001');
  if not (v_result->>'changed')::boolean or (v_result->>'replayed')::boolean
     or jsonb_array_length(v_result->'activity')<>1 then raise exception 'admin_d_apply_failed'; end if;
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_plan,
    'd0000000-0000-4000-8000-000000000001','admin-d-pg-gate-0001');
  if not (v_result->>'replayed')::boolean then raise exception 'admin_d_replay_failed'; end if;
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date,v_date+2);
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,
    'from',v_date,'to',v_date+2,'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(
      jsonb_build_object('entity','daily_inventory','action','upsert','id',null,'payload',jsonb_build_object(
        'room_type_id',c_room,'stay_date',v_date,'sellable_units',0,'sellable_units_mode','set',
        'closed',false,'closed_mode','set','reason','ADMIN-D PostgreSQL gate','expires_at',null)))));
  if (v_preview->>'changed')::boolean or jsonb_array_length(v_preview#>'{reviewed_plan,operations}')<>0 then
    raise exception 'admin_d_semantic_noop_failed'; end if;
  begin perform public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,
    'from',v_date,'to',v_date+2,'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(
      jsonb_build_object('entity','daily_inventory','action','upsert','id',gen_random_uuid(),'payload',jsonb_build_object(
        'room_type_id',c_room,'stay_date',v_date,'sellable_units',1,'reason','smuggle')))));
    raise exception 'admin_d_arbitrary_daily_id_accepted';
  exception when sqlstate '22023' then null; end;

  -- A CLEAR against inherited state is a true no-op and creates no storage row.
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+1,v_date+1);
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,
    'from',v_date+1,'to',v_date+1,'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(
      jsonb_build_object('entity','daily_inventory','action','upsert','id',null,'payload',jsonb_build_object(
        'room_type_id',c_room,'stay_date',v_date+1,'closed',null,'closed_mode','clear',
        'reason','Explicit clear of inherited availability')))));
  if (v_preview->>'changed')::boolean is distinct from false
     or coalesce(jsonb_array_length(v_preview#>'{reviewed_plan,operations}'),-1)<>0
     or coalesce(jsonb_array_length(v_preview->'impacts'),-1)<>0 then
    raise exception 'admin_d_absent_clear_not_noop'; end if;
  if pg_temp.admin_d_daily_inventory_row_exists(c_room,v_date+1) then
    raise exception 'admin_d_absent_clear_materialized'; end if;

  -- Reviewed Unit block changes room capacity once, with exact audit and no overlap.
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+1,v_date+1);
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,
    'from',v_date+1,'to',v_date+1,'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(
      jsonb_build_object('entity','unit_calendar_block','action','create','id','d2000000-0000-4000-8000-000000000001',
        'payload',jsonb_build_object('unit_id',c_unit,'room_type_id',c_room,'from_date',v_date+1,'to_date',v_date+1,
          'blocked',true,'reason','Maintenance block','expires_at',null,'is_active',true)))));
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_preview->'reviewed_plan',
    'd0000000-0000-4000-8000-000000000002','admin-d-pg-unit-block-0002');
  if not (v_result->>'changed')::boolean or v_result#>>'{availability_control,cells,0,blocked_unit_count}'<>'1' then
    raise exception 'admin_d_unit_block_failed: %',v_result; end if;
  v_failed:=false;
  begin perform public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,
    'from',v_date+1,'to',v_date+1,'snapshot_token',v_result#>>'{availability_control,snapshot_token}','intents',jsonb_build_array(
      jsonb_build_object('entity','unit_calendar_block','action','create','id','d2000000-0000-4000-8000-000000000002',
        'payload',jsonb_build_object('unit_id',c_unit,'room_type_id',c_room,'from_date',v_date+1,'to_date',v_date+1,
          'blocked',true,'reason','Overlapping block','expires_at',null,'is_active',true)))));
  exception when sqlstate '23514' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_overlapping_unit_block_allowed'; end if;

  -- Reuse an ADMIN-C price-only exact row without changing a pricing byte.
  v_price:=pg_temp.admin_d_calendar_override_pricing_state('c1800000-0000-4000-8000-000000000001');
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+2,v_date+2);
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,'from',v_date+2,'to',v_date+2,
    'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(jsonb_build_object(
      'entity','operational_override','action','update','id','c1800000-0000-4000-8000-000000000001',
      'payload',jsonb_build_object('room_rate_id',c_rate,'stay_date',v_date+2,'closed',true,'closed_mode','set',
        'reason','Reviewed product closure','availability_active',true)))));
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_preview->'reviewed_plan',
    'd0000000-0000-4000-8000-000000000003','admin-d-pg-exact-closure-0003');
  if not exists(select 1 from jsonb_array_elements(v_result#>'{availability_control,product_cells,0,blocking_reasons}') reason
      where reason#>>'{}'='operational_closed')
     or v_price is distinct from pg_temp.admin_d_calendar_override_pricing_state(
       'c1800000-0000-4000-8000-000000000001') then
    raise exception 'admin_d_shared_exact_price_preservation_failed'; end if;

  -- Existing shared Rate Rule CTA mutation binds exact scope and never changes price.
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date,current_date+45);
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,'from',v_date,'to',current_date+45,
    'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(jsonb_build_object(
      'entity','rate_rule_operational_restriction','action','update','id',c_rule,
      'payload',jsonb_build_object('closed_to_arrival',true,'reason','Reviewed shared CTA')))));
  if (v_preview#>>'{impacts,0,from}')::date<>v_date or (v_preview#>>'{impacts,0,to}')::date<>current_date+45 then
    raise exception 'admin_d_rule_scope_impact_failed'; end if;
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_preview->'reviewed_plan',
    'd0000000-0000-4000-8000-000000000004','admin-d-pg-rule-cta-0004');
  if pg_temp.admin_d_rate_rule_availability_price_state(c_rule) is distinct from
      jsonb_build_object('closed_to_arrival',true,'nightly_rate',90::numeric) then
    raise exception 'admin_d_rule_cta_failed'; end if;

  -- Trusted-backend hold infrastructure is read-only to Admin except reviewed release.
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+6,v_date+6);
  if v_control#>>'{cells,0,held_units}'<>'1' then raise exception 'admin_d_hold_not_counted'; end if;
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,'from',v_date+6,'to',v_date+6,
    'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(jsonb_build_object(
      'entity','hold','action','release','id','c1b00000-0000-4000-8000-000000000001',
      'payload',jsonb_build_object('reason','Reviewed hold release')))));
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_preview->'reviewed_plan',
    'd0000000-0000-4000-8000-000000000007','admin-d-pg-hold-release-0007');
  v_hold_state:=pg_temp.admin_d_hold_release_state('c1b00000-0000-4000-8000-000000000001');
  if v_hold_state->>'status' is distinct from 'released'
     or coalesce((v_hold_state->>'active_commitment_count')::integer,-1)<>0 then
    raise exception 'admin_d_hold_release_failed'; end if;

  -- Exact booking mapping creates one Unit commitment per stay night, then release removes it.
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+3,v_date+4);
  select blocker->>'booking_updated_at' into v_updated_at from jsonb_array_elements(v_control->'unmapped_booking_blockers') blocker
    where blocker->>'booking_id'=c_booking::text;
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,'from',v_date+3,'to',v_date+4,
    'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(jsonb_build_object(
      'entity','booking_allocation','action','map','id',null,'payload',jsonb_build_object('booking_id',c_booking,
        'booking_updated_at',v_updated_at,'allocations',jsonb_build_array(jsonb_build_object(
          'id','d4000000-0000-4000-8000-000000000001','room_type_id',c_room,
          'rate_plan_id','c1200000-0000-4000-8000-000000000001','room_rate_id',c_rate,
          'unit_ids',jsonb_build_array(c_unit),'units_required',1,
          'allocated_guest_counts',jsonb_build_array(1),'pricing_guest_counts',jsonb_build_array(1))))))));
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_preview->'reviewed_plan',
    'd0000000-0000-4000-8000-000000000005','admin-d-pg-booking-map-0005');
  v_commitments:=pg_temp.admin_d_booking_active_commitment_state(c_booking);
  if jsonb_array_length(v_commitments)<>2 then
    raise exception 'admin_d_booking_commitments_failed'; end if;
  v_failed:=false;
  begin perform pg_temp.admin_d_direct_release_allocation(c_booking);
  exception when sqlstate '55000' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_allocation_released_with_active_child'; end if;
  perform pg_temp.admin_d_move_booking(c_booking,v_date+4,v_date+6);
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+3,v_date+3);
  if not exists(select 1 from jsonb_array_elements(v_control->'booking_allocations') allocation(value)
      where allocation.value->>'booking_id'=c_booking::text
        and (allocation.value->>'active_commitment_from')::date=v_date+3
        and (allocation.value->>'active_commitment_to')::date=v_date+4
        and jsonb_array_length(allocation.value->'active_commitments')=2) then
    raise exception 'admin_d_stale_allocation_old_only_viewport_not_observable'; end if;
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+4,v_date+5);
  v_failed:=false;
  begin perform public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,'from',v_date+4,'to',v_date+5,
    'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(jsonb_build_object(
      'entity','booking_allocation','action','release','id',c_booking,
      'payload',jsonb_build_object('booking_id',c_booking,'reason','Narrow stale mapping release')))));
  exception when sqlstate '22023' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_d_old_commitment_outside_review_not_rejected'; end if;
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+3,v_date+5);
  if not exists(select 1 from jsonb_array_elements(v_control->'booking_allocations') allocation(value)
      where allocation.value->>'booking_id'=c_booking::text
        and (allocation.value->>'active_commitment_from')::date=v_date+3
        and (allocation.value->>'active_commitment_to')::date=v_date+4
        and jsonb_array_length(allocation.value->'active_commitments')=2) then
    raise exception 'admin_d_stale_allocation_old_viewport_not_observable'; end if;
  select blocker->>'booking_updated_at' into v_updated_at from jsonb_array_elements(v_control->'unmapped_booking_blockers') blocker
    where blocker->>'booking_id'=c_booking::text;
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,'from',v_date+3,'to',v_date+5,
    'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(jsonb_build_object(
      'entity','booking_allocation','action','map','id',null,'payload',jsonb_build_object('booking_id',c_booking,
        'booking_updated_at',v_updated_at,'allocations',jsonb_build_array(jsonb_build_object(
          'id','d4000000-0000-4000-8000-000000000002','room_type_id',c_room,
          'rate_plan_id','c1200000-0000-4000-8000-000000000001','room_rate_id',c_rate,
          'unit_ids',jsonb_build_array(c_unit),'units_required',1,
          'allocated_guest_counts',jsonb_build_array(1),'pricing_guest_counts',jsonb_build_array(1))))))));
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_preview->'reviewed_plan',
    'd0000000-0000-4000-8000-000000000008','admin-d-pg-booking-remap-0008');
  v_commitments:=pg_temp.admin_d_booking_active_commitment_state(c_booking);
  if exists(select 1 from jsonb_array_elements(v_commitments) commitment(value)
      where (commitment.value->>'stay_date')::date=v_date+3)
     or (select count(*) from jsonb_array_elements(v_commitments) commitment(value)
       where commitment.value->>'allocation_status'='active'
         and (commitment.value->>'stay_date')::date in(v_date+4,v_date+5))<>2 then
    raise exception 'admin_d_stale_same_shape_remap_failed'; end if;
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+3,v_date+5);
  v_preview:=public.hotel_v2_admin_preview_availability_plan(jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,'from',v_date+3,'to',v_date+5,
    'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(jsonb_build_object(
      'entity','booking_allocation','action','release','id',c_booking,
      'payload',jsonb_build_object('booking_id',c_booking,'reason','Reviewed mapping release')))));
  v_result:=public.hotel_v2_admin_apply_availability_control_plan(v_preview->'reviewed_plan',
    'd0000000-0000-4000-8000-000000000006','admin-d-pg-booking-release-0006');
  v_commitments:=pg_temp.admin_d_booking_active_commitment_state(c_booking);
  if jsonb_array_length(v_commitments)<>0 then
    raise exception 'admin_d_booking_release_failed'; end if;

  -- Canonical transport and scalar typing fail closed before casts.
  v_control:=public.hotel_v2_admin_get_availability_control(c_hotel,v_date+3,v_date+4);
  foreach v_plan in array array[
    jsonb_set(v_control,'{hotel_id}',to_jsonb(upper(c_hotel::text))),
    jsonb_build_object('contract_version','hotels_v2_admin_d_availability_draft_v1','hotel_id',c_hotel,
      'from',v_date+3,'to',v_date+4,'snapshot_token',v_control->>'snapshot_token','intents',jsonb_build_array(
        jsonb_build_object('entity','daily_inventory','action','upsert','id',null,'payload',jsonb_build_object(
          'room_type_id',c_room,'stay_date',v_date+3,'sellable_units','1','sellable_units_mode','set','reason','Typed rejection'))))
  ] loop
    v_failed:=false; begin perform public.hotel_v2_admin_preview_availability_plan(v_plan);
    exception when sqlstate '22023' then v_failed:=true; end;
    if not v_failed then raise exception 'admin_d_transport_smuggling_allowed: %',v_plan; end if;
  end loop;
end
$admin_d_pg_gate$;
rollback;

select true as hotels_v2_admin_d_availability_inventory_postgres_gate_safe;
