\set ON_ERROR_STOP on
begin;

create function pg_temp.external_calendar_room_status(p_room_id uuid)
returns text language sql security definer set search_path=pg_catalog,public
as $$select status from public.hotel_room_types where id=p_room_id$$;

create function pg_temp.external_calendar_snapshot(
  p_hotel_id uuid,p_from date,p_to date,p_include_activity boolean
) returns jsonb language sql security definer set search_path=pg_catalog,public
as $$select public.hotel_v2_admin_d_snapshot(p_hotel_id,p_from,p_to,p_include_activity)$$;

insert into public.hotel_room_types(id,hotel_id,code,name_i18n,description_i18n,
  capacity_adults,capacity_children,inventory_mode,base_inventory_count,status,sort_order)
values('c1100000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001',
  'gate-second-room','{"pl":"Pokój testowy","en":"Gate room","he":"חדר בדיקה"}',
  '{"pl":"Pokój testowy","en":"Gate room","he":"חדר בדיקה"}',2,0,'pooled',1,'active',999);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);

do $admin_control$
declare c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_room constant uuid:='c1100000-0000-4000-8000-000000000001';
  c_room_two constant uuid:='c1100000-0000-4000-8000-000000000002';
  v_control jsonb; v_draft jsonb; v_preview jsonb; v_result jsonb; v_source uuid; v_remap_source uuid;
  v_failed boolean:=false;
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  if v_control->>'contract_version'<>'hotels_v2_external_calendar_control_v1'
     or (v_control->>'hotel_external_sync_enabled')::boolean
     or v_control::text~'(ical_url|external_reference|configuration|vault_secret)' then
    raise exception 'external_calendar_redacted_control_failed'; end if;
  v_draft:=jsonb_build_object('contract_version','hotels_v2_external_calendar_draft_v1',
    'hotel_id',c_hotel,'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token',
    'intent',jsonb_build_object('entity','calendar_source','action','create','id',null,
      'expected_version',0,'payload',jsonb_build_object('room_type_id',c_room_two,'code','gate-ical',
        'sync_interval_minutes',15,'units_per_event',1,'priority',10),
      'reason','Create reviewed gate source'));
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(v_draft);
  if not (v_preview->>'changed')::boolean
     or v_preview#>'{impacts,0,fields}'<>'["code","priority","room_type_id","sync_interval_minutes","units_per_event"]'::jsonb
     or v_preview#>>'{reviewed_plan,operations,0,id}' is null then
    raise exception 'external_calendar_create_review_failed'; end if;
  v_source:=(v_preview#>>'{reviewed_plan,operations,0,id}')::uuid;
  v_result:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',null);
  if jsonb_array_length(v_result->'activity')<>1 then raise exception 'external_calendar_create_apply_failed'; end if;

  v_control:=v_result->'control';
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,'access_snapshot_token',null,
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_room,'code','gate-remap',
        'sync_interval_minutes',15,'units_per_event',1,'priority',9),
      'reason','Create remap impact probe')));
  v_remap_source:=(v_preview#>>'{reviewed_plan,operations,0,id}')::uuid;
  v_result:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e1000000-0000-4000-8000-000000000009','e2000000-0000-4000-8000-000000000009',null);
  v_control:=v_result->'control';
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,'access_snapshot_token',null,
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','update','id',v_remap_source,'expected_version',1,
      'payload',jsonb_build_object('room_type_id',c_room_two,'code','gate-remap',
        'sync_interval_minutes',15,'units_per_event',1,'priority',9),
      'reason','Review exact remap impact')));
  if v_preview#>'{impacts,0,affected_room_type_ids}'<>
       jsonb_build_array(c_room,c_room_two) then
    raise exception 'external_calendar_remap_impact_scope_failed'; end if;

  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,'access_snapshot_token',null,
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','ical_secret','action','set','id',v_source,'expected_version',0,
      'payload',jsonb_build_object('source_id',v_source,'ical_url','https://calendar.example.test/gate.ics'),
      'reason','Bind reviewed gate secret')));
  if v_preview::text~'calendar\.example|gate\.ics'
     or v_preview#>'{impacts,0,fields}'<>'["secret_configured"]'::jsonb then
    raise exception 'external_calendar_secret_redaction_failed'; end if;
  v_result:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002',
    'https://calendar.example.test/gate.ics');
  begin
    perform public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
      'partner_id',null,'assignment_id',null,'permission_version',null,'access_snapshot_token',null,
      'snapshot_token',v_result#>>'{control,snapshot_token}','intent',jsonb_build_object(
        'entity','calendar_source','action','update','id',v_source,'expected_version',1,
        'payload',jsonb_build_object('room_type_id',c_room,'code','gate-ical',
          'sync_interval_minutes',15,'units_per_event',1,'priority',10),
        'reason','Reject bound source remap')));
  exception when sqlstate '23514' then v_failed:=true; end;
  if not v_failed then raise exception 'external_calendar_bound_source_remap_allowed'; end if;
  perform set_config('hotels_v2.gate_source_id',v_source::text,true);
end
$admin_control$;
reset role;

-- Simulate the separately acknowledged 2F flag flip inside this rolled-back gate.
update public.site_settings set hotel_external_sync_enabled=true where id=1;
do $compatibility_receipt$
begin
  if not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints=
        public.hotel_v2_external_calendar_activation_function_fingerprints()) then
    raise exception 'external_calendar_activation_source_receipt_failed'; end if;
end
$compatibility_receipt$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $enable_source$
declare c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_room constant uuid:='c1100000-0000-4000-8000-000000000002';
  v_source uuid:=current_setting('hotels_v2.gate_source_id')::uuid;
  v_control jsonb; v_preview jsonb; v_result jsonb; v_snapshot jsonb; v_cell jsonb;
begin
  if public.hotel_v2_admin_get_content_control(c_hotel) is null
     or public.hotel_v2_admin_get_partner_hotel_permissions(c_hotel) is null then
    raise exception 'external_calendar_admin_activation_compatibility_failed'; end if;
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,'access_snapshot_token',null,
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','enable','id',v_source,'expected_version',1,
      'payload','{}'::jsonb,'reason','Enable reviewed gate source')));
  if v_preview#>'{impacts,0,fields}'<>'["is_enabled"]'::jsonb then
    raise exception 'external_calendar_enable_impact_failed'; end if;
  v_result:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e1000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000003',null);
  v_snapshot:=pg_temp.external_calendar_snapshot(c_hotel,current_date+20,current_date+21,false);
  select cell.value into strict v_cell from jsonb_array_elements(v_snapshot->'cells') cell(value)
    where (cell.value->>'room_type_id')::uuid=c_room
      and (cell.value->>'stay_date')::date=current_date+20;
  perform set_config('hotels_v2.gate_before_available',v_cell->>'available_units',true);
  perform set_config('hotels_v2.gate_before_token',v_snapshot->>'snapshot_token',true);
end
$enable_source$;
reset role;

set local role service_role;
select set_config('request.jwt.claims',
  '{"role":"service_role","sub":"10000000-0000-4000-8000-000000000009"}',true);
do $worker$
declare v_source uuid:=current_setting('hotels_v2.gate_source_id')::uuid;
  v_enqueued jsonb; v_leased jsonb; v_job jsonb; v_started timestamptz:=clock_timestamp();
  v_attempt uuid:='e3000000-0000-4000-8000-000000000001'; v_payload jsonb; v_result jsonb;
begin
  v_enqueued:=public.hotel_v2_external_calendar_scheduler_enqueue(8);
  if (v_enqueued->>'queued_count')::integer<>1 then raise exception 'external_calendar_enqueue_failed'; end if;
  v_leased:=public.hotel_v2_external_calendar_scheduler_lease(8,
    'e4000000-0000-4000-8000-000000000001',180);
  v_job:=v_leased#>'{jobs,0}';
  if v_job is null or (v_job->>'leased_until')::timestamptz<=clock_timestamp() then
    raise exception 'external_calendar_lease_failed'; end if;
  v_payload:=jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_begin_v1',
    'job_id',v_job->'job_id','lease_token',v_job->'lease_token','source_id',v_job->'source_id',
    'hotel_id',v_job->'hotel_id','room_type_id',v_job->'room_type_id',
    'source_version',v_job->'source_version','binding_version',v_job->'binding_version',
    'trigger_type',v_job->'trigger_type','attempt_id',v_attempt,'started_at',v_started);
  v_result:=public.hotel_v2_external_calendar_worker_begin_sync(v_payload);
  if v_result->>'status'<>'running' then raise exception 'external_calendar_begin_failed'; end if;
  v_payload:=jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_finalize_v1',
    'job_id',v_job->'job_id','lease_token',v_job->'lease_token','source_id',v_job->'source_id',
    'hotel_id',v_job->'hotel_id','room_type_id',v_job->'room_type_id',
    'source_version',v_job->'source_version','binding_version',v_job->'binding_version',
    'trigger_type',v_job->'trigger_type','attempt_id',v_attempt,'started_at',v_started,
    'finished_at',clock_timestamp(),'http_status',200,'content_fingerprint',repeat('a',64),
    'events',jsonb_build_array(jsonb_build_object('external_uid_hash',repeat('b',64),
      'recurrence_id_hash',null,'event_fingerprint',repeat('c',64),'starts_on',current_date+20,
      'ends_on',current_date+22,'event_status','active','source_sequence',1,
      'source_last_modified_at',null)));
  v_result:=public.hotel_v2_external_calendar_worker_finalize_sync(v_payload);
  if v_result->>'status'<>'succeeded' or (v_result->>'active_day_block_count')::integer<>2 then
    raise exception 'external_calendar_finalize_failed'; end if;
  if not (public.hotel_v2_external_calendar_worker_finalize_sync(v_payload)->>'replayed')::boolean then
    raise exception 'external_calendar_finalize_replay_failed'; end if;
end
$worker$;
reset role;

do $availability_lifecycle_security$
declare c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_room constant uuid:='c1100000-0000-4000-8000-000000000002';
  v_after jsonb; v_cell jsonb; v_failed boolean:=false;
begin
  v_after:=pg_temp.external_calendar_snapshot(c_hotel,current_date+20,current_date+21,false);
  select cell.value into strict v_cell from jsonb_array_elements(v_after->'cells') cell(value)
    where (cell.value->>'room_type_id')::uuid=c_room
      and (cell.value->>'stay_date')::date=current_date+20;
  if (v_cell->>'available_units')::integer>=current_setting('hotels_v2.gate_before_available')::integer
     or v_after->>'snapshot_token'=current_setting('hotels_v2.gate_before_token') then
    raise exception 'external_calendar_availability_projection_failed'; end if;
  begin update public.hotel_room_types set status='disabled',version=version+1,
      updated_at=clock_timestamp() where id=c_room;
  exception when sqlstate '55000' then v_failed:=true; end;
  if not v_failed or pg_temp.external_calendar_room_status(c_room)<>'active' then
    raise exception 'external_calendar_room_lifecycle_guard_failed'; end if;
  if has_function_privilege('authenticated',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_get_external_calendar_control(uuid)','EXECUTE') then
    raise exception 'external_calendar_acl_matrix_failed'; end if;
end
$availability_lifecycle_security$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);
do $partner_activation_compatibility$
declare v_workspace jsonb;
begin
  if public.hotel_v2_partner_list_assigned_properties(
       '20000000-0000-4000-8000-000000000001') is null then
    raise exception 'external_calendar_partner_list_activation_compatibility_failed'; end if;
  v_workspace:=public.hotel_v2_partner_get_workspace(
    '20000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
    current_date+20,current_date+21);
  if not (v_workspace#>>'{feature_flags,hotel_external_sync_enabled}')::boolean then
    raise exception 'external_calendar_partner_activation_compatibility_failed'; end if;
end
$partner_activation_compatibility$;
reset role;

rollback;
\ir ../../supabase/manual/hotels_v2_external_calendar_stage2b_2e_verify.sql
select true as hotels_v2_external_calendar_stage2b_2e_postgres_gate_pass;
