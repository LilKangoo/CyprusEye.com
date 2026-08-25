-- Hotels V2 Stage 2B: service-role-only external calendar worker runtime.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

do $preconditions$
begin
  if to_regclass('hotels_v2_private.hotel_external_calendar_sync_runs') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_events') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_day_blocks') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_get_source(uuid)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_require_service_role()') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_worker_foundation_missing';
  end if;
  if to_regclass('hotels_v2_private.hotel_external_calendar_sync_jobs') is not null then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_worker_runtime_already_present';
  end if;
end
$preconditions$;

create table hotels_v2_private.hotel_external_calendar_sync_jobs(
  id uuid primary key,
  source_id uuid not null references public.hotel_calendar_source_configs(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  room_type_id uuid not null,
  trigger_type text not null check(trigger_type in('manual','scheduled','retry')),
  status text not null default 'queued' check(status in('queued','leased','running','succeeded','failed','cancelled')),
  available_at timestamptz not null default clock_timestamp(),
  lease_owner uuid,lease_token uuid,leased_until timestamptz,attempt_id uuid,
  source_version bigint not null check(source_version>0),
  binding_version bigint not null check(binding_version>0),
  created_by_type text not null check(created_by_type in('admin','partner','system')),
  created_by uuid,correlation_id uuid,
  error_code text,error_message text,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_external_calendar_sync_jobs_room_hotel_fkey foreign key(room_type_id,hotel_id)
    references public.hotel_room_types(id,hotel_id) on delete restrict,
  constraint hotel_external_calendar_sync_jobs_lease_check check(
    (status='leased' and lease_owner is not null and lease_token is not null and leased_until is not null)
    or status<>'leased'),
  constraint hotel_external_calendar_sync_jobs_error_check check(
    (error_code is null or (error_code=btrim(error_code) and length(error_code) between 1 and 120 and error_code!~'[[:cntrl:]]'))
    and (error_message is null or (error_message=btrim(error_message) and length(error_message) between 1 and 500 and error_message!~'[[:cntrl:]]')))
);
create unique index hotel_external_calendar_sync_jobs_one_open_source_uidx
  on hotels_v2_private.hotel_external_calendar_sync_jobs(source_id)
  where status in('queued','leased','running');
create index hotel_external_calendar_sync_jobs_queue_idx
  on hotels_v2_private.hotel_external_calendar_sync_jobs(status,available_at,created_at,id);

alter table hotels_v2_private.hotel_external_calendar_sync_runs
  add column job_id uuid references hotels_v2_private.hotel_external_calendar_sync_jobs(id) on delete restrict,
  add column lease_token uuid,
  add column source_version bigint,
  add column binding_version bigint,
  add column request_fingerprint text,
  add constraint hotel_external_calendar_sync_runs_request_fingerprint_check
    check(request_fingerprint is null or request_fingerprint~'^[0-9a-f]{64}$');

revoke all on hotels_v2_private.hotel_external_calendar_sync_jobs from public,anon,authenticated,service_role;

create function public.hotel_v2_external_calendar_worker_hash(p_value jsonb)
returns text language sql immutable security definer set search_path=pg_catalog
as $$select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex')$$;

-- Stage 2B extends the trusted Stage 2A source envelope with the Hotel's
-- authoritative IANA timezone.  Workers must normalize DTSTART/DTEND to these
-- property-local stay dates; UTC-day truncation is not a supported contract.
alter function public.hotel_v2_external_calendar_worker_get_source(uuid)
  rename to hotel_v2_external_calendar_worker_get_source_stage2a;
revoke all on function public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_external_calendar_worker_get_source(p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_source jsonb; v_timezone text;
begin
  perform public.hotel_v2_external_calendar_require_service_role();
  v_source:=public.hotel_v2_external_calendar_worker_get_source_stage2a(p_source_id);
  if not coalesce((v_source->>'hotel_external_sync_enabled')::boolean,false)
     or not coalesce((v_source->>'is_enabled')::boolean,false)
     or v_source->>'review_status'<>'reviewed' then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_worker_source_not_runnable';
  end if;
  if not exists(select 1 from public.hotel_room_types room
      join public.hotel_calendar_source_configs source on source.room_type_id=room.id
      where source.id=p_source_id and room.hotel_id=source.hotel_id and room.status='active'
        and coalesce((source.configuration->>'units_per_event')::integer,1)<=case
          when room.inventory_mode='unitized' then (select count(*)::integer from public.hotel_units unit
            where unit.room_type_id=room.id and unit.status='active') else room.base_inventory_count end) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_worker_room_not_runnable';
  end if;
  select hotel.timezone into strict v_timezone from public.hotels hotel
    where hotel.id=(v_source->>'hotel_id')::uuid;
  if not exists(select 1 from pg_catalog.pg_timezone_names zone where zone.name=v_timezone) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_hotel_timezone_invalid';
  end if;
  return jsonb_set(jsonb_set(v_source,'{contract_version}',
    to_jsonb('hotels_v2_external_calendar_worker_source_v2'::text),false),
    '{hotel_timezone}',to_jsonb(v_timezone),true);
end
$function$;

create function public.hotel_v2_external_calendar_worker_list_sources(p_limit integer)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_sources jsonb:='[]'::jsonb; v_row record;
begin
  perform public.hotel_v2_external_calendar_require_service_role();
  if p_limit is null or p_limit not between 1 and 25 then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_limit';
  end if;
  if (select count(*) from public.site_settings)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_settings_cardinality';
  end if;
  if not (select hotel_external_sync_enabled from public.site_settings where id=1) then
    return jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_source_list_v1',
      'global_enabled',false,'sources','[]'::jsonb);
  end if;
  for v_row in select source.id from public.hotel_calendar_source_configs source
    join public.hotel_room_types room on room.id=source.room_type_id
      and room.hotel_id=source.hotel_id and room.status='active'
    join hotels_v2_private.hotel_external_calendar_source_secrets binding on binding.source_id=source.id
    left join hotels_v2_private.hotel_external_calendar_source_state state on state.source_id=source.id
    where source.source_type='ical' and source.is_enabled and source.review_status='reviewed'
      and coalesce((source.configuration->>'units_per_event')::integer,1)<=case
        when room.inventory_mode='unitized' then (select count(*)::integer from public.hotel_units unit
          where unit.room_type_id=room.id and unit.status='active') else room.base_inventory_count end
      and source.room_type_id is not null and (state.next_retry_at is null or state.next_retry_at<=clock_timestamp())
    order by source.priority desc,source.id limit p_limit
  loop
    v_sources:=v_sources||jsonb_build_array(public.hotel_v2_external_calendar_worker_get_source(v_row.id));
  end loop;
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_source_list_v1',
    'global_enabled',true,'sources',v_sources);
end
$function$;

create function public.hotel_v2_external_calendar_worker_begin_sync(p_payload jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_job hotels_v2_private.hotel_external_calendar_sync_jobs%rowtype;
  v_source public.hotel_calendar_source_configs%rowtype;
  v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;
  v_attempt uuid; v_started timestamptz; v_existing hotels_v2_private.hotel_external_calendar_sync_runs%rowtype;
begin
  perform public.hotel_v2_external_calendar_require_service_role();
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_payload,array['contract_version','job_id','lease_token','source_id','hotel_id','room_type_id','source_version','binding_version','trigger_type','attempt_id','started_at'])
     or not (p_payload?&array['contract_version','job_id','lease_token','source_id','hotel_id','room_type_id','source_version','binding_version','trigger_type','attempt_id','started_at'])
     or p_payload->>'contract_version'<>'hotels_v2_external_calendar_worker_begin_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_payload)
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(p_payload->>'started_at')
     or jsonb_typeof(p_payload->'source_version')<>'number' or p_payload->>'source_version'!~'^[1-9][0-9]*$'
     or jsonb_typeof(p_payload->'binding_version')<>'number' or p_payload->>'binding_version'!~'^[1-9][0-9]*$'
     or p_payload->>'trigger_type' not in('manual','scheduled','retry') then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_begin';
  end if;
  v_attempt:=(p_payload->>'attempt_id')::uuid; v_started:=(p_payload->>'started_at')::timestamptz;
  select * into v_existing from hotels_v2_private.hotel_external_calendar_sync_runs where id=v_attempt;
  if found then
    if v_existing.status<>'running' or v_existing.source_id<>(p_payload->>'source_id')::uuid
       or v_existing.job_id<>(p_payload->>'job_id')::uuid
       or v_existing.lease_token is distinct from (p_payload->>'lease_token')::uuid
       or v_existing.hotel_id<>(p_payload->>'hotel_id')::uuid
       or v_existing.room_type_id<>(p_payload->>'room_type_id')::uuid
       or v_existing.source_version<>(p_payload->>'source_version')::bigint
       or v_existing.binding_version<>(p_payload->>'binding_version')::bigint
       or v_existing.trigger_type<>p_payload->>'trigger_type'
       or v_existing.started_at is distinct from v_started then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_attempt_conflict'; end if;
    return jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_begin_result_v1',
      'attempt_id',v_existing.id,'job_id',v_existing.job_id,'source_id',v_existing.source_id,
      'status',v_existing.status,'replayed',true);
  end if;
  if v_started<clock_timestamp()-interval '5 minutes'
     or v_started>clock_timestamp()+interval '1 minute' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_begin';
  end if;
  if not (select count(*)=1 and bool_and(hotel_external_sync_enabled) from public.site_settings) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_not_activated'; end if;
  select * into v_job from hotels_v2_private.hotel_external_calendar_sync_jobs
    where id=(p_payload->>'job_id')::uuid for update;
  if not found or v_job.status<>'leased' or v_job.lease_token is distinct from (p_payload->>'lease_token')::uuid
     or v_job.leased_until<=clock_timestamp() then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_job_lease_stale'; end if;
  select * into v_source from public.hotel_calendar_source_configs where id=(p_payload->>'source_id')::uuid for share;
  select * into v_binding from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_source.id for share;
  if v_source.id is null or v_binding.source_id is null
     or not v_source.is_enabled or v_source.review_status<>'reviewed'
     or v_source.source_type<>'ical' or v_source.hotel_id<>(p_payload->>'hotel_id')::uuid
     or v_source.room_type_id<>(p_payload->>'room_type_id')::uuid
     or v_source.version<>(p_payload->>'source_version')::bigint
     or v_binding.version<>(p_payload->>'binding_version')::bigint
     or v_job.source_id<>v_source.id or v_job.hotel_id<>v_source.hotel_id
     or v_job.room_type_id<>v_source.room_type_id or v_job.trigger_type<>p_payload->>'trigger_type'
     or v_job.source_version<>(p_payload->>'source_version')::bigint
     or v_job.binding_version<>(p_payload->>'binding_version')::bigint
     or not exists(select 1 from public.hotel_room_types room where room.id=v_source.room_type_id
       and room.hotel_id=v_source.hotel_id and room.status='active'
       and coalesce((v_source.configuration->>'units_per_event')::integer,1)<=case
         when room.inventory_mode='unitized' then (select count(*)::integer from public.hotel_units unit
           where unit.room_type_id=room.id and unit.status='active') else room.base_inventory_count end) then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_worker_source_stale'; end if;
  insert into hotels_v2_private.hotel_external_calendar_sync_runs(
    id,job_id,lease_token,source_id,hotel_id,room_type_id,source_version,binding_version,
    trigger_type,status,started_at)
  values(v_attempt,v_job.id,v_job.lease_token,v_source.id,v_source.hotel_id,v_source.room_type_id,
    v_source.version,v_binding.version,v_job.trigger_type,'running',v_started);
  update hotels_v2_private.hotel_external_calendar_sync_jobs set status='running',attempt_id=v_attempt,
    version=version+1,updated_at=clock_timestamp() where id=v_job.id;
  insert into hotels_v2_private.hotel_external_calendar_source_state(source_id,last_run_id,last_attempt_at)
    values(v_source.id,v_attempt,v_started) on conflict(source_id) do update set
      last_run_id=excluded.last_run_id,last_attempt_at=excluded.last_attempt_at,
      version=hotel_external_calendar_source_state.version+1,updated_at=clock_timestamp();
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_begin_result_v1',
    'attempt_id',v_attempt,'job_id',v_job.id,'source_id',v_source.id,'status','running','replayed',false);
exception when invalid_text_representation or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_begin';
end
$function$;

create function public.hotel_v2_external_calendar_worker_finalize_sync(p_payload jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_run hotels_v2_private.hotel_external_calendar_sync_runs%rowtype;
  v_job hotels_v2_private.hotel_external_calendar_sync_jobs%rowtype;
  v_source public.hotel_calendar_source_configs%rowtype;
  v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype; v_event jsonb;
  v_event_id uuid; v_attempt uuid; v_fingerprint text; v_finished timestamptz;
  v_event_count integer; v_active_count integer; v_block_count integer; v_days integer;
  v_units_per_event integer;
begin
  perform public.hotel_v2_external_calendar_require_service_role();
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_payload,array['contract_version','job_id','lease_token','source_id','hotel_id','room_type_id','source_version','binding_version','trigger_type','attempt_id','started_at','finished_at','http_status','content_fingerprint','events'])
     or not (p_payload?&array['contract_version','job_id','lease_token','source_id','hotel_id','room_type_id','source_version','binding_version','trigger_type','attempt_id','started_at','finished_at','http_status','content_fingerprint','events'])
     or p_payload->>'contract_version'<>'hotels_v2_external_calendar_worker_finalize_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_payload)
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(p_payload->>'started_at')
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(p_payload->>'finished_at')
     or jsonb_typeof(p_payload->'events')<>'array' or jsonb_array_length(p_payload->'events')>500
     or p_payload->>'content_fingerprint'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_payload->'http_status')<>'number' or p_payload->>'http_status'!~'^[1-5][0-9][0-9]$' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_finalize'; end if;
  v_attempt:=(p_payload->>'attempt_id')::uuid; v_finished:=(p_payload->>'finished_at')::timestamptz;
  if v_finished>clock_timestamp()+interval '1 minute' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_finalize'; end if;
  v_fingerprint:=public.hotel_v2_external_calendar_worker_hash(p_payload);
  select * into v_run from hotels_v2_private.hotel_external_calendar_sync_runs where id=v_attempt for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_external_calendar_run_not_found'; end if;
  if v_run.status='succeeded' then
    if v_run.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_attempt_conflict'; end if;
    return jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_finalize_result_v1',
      'attempt_id',v_run.id,'job_id',v_run.job_id,'source_id',v_run.source_id,'status','succeeded',
      'event_count',v_run.event_count,'active_event_count',v_run.active_event_count,
      'active_day_block_count',(select count(*)::integer from hotels_v2_private.hotel_external_calendar_day_blocks
        where source_id=v_run.source_id and is_active),'replayed',true);
  end if;
  select * into v_job from hotels_v2_private.hotel_external_calendar_sync_jobs
    where id=v_run.job_id for update;
  if v_job.id is null or v_run.status<>'running' or v_run.job_id<>(p_payload->>'job_id')::uuid
     or v_run.lease_token is distinct from (p_payload->>'lease_token')::uuid
     or v_job.lease_token is distinct from (p_payload->>'lease_token')::uuid
     or v_run.source_id<>(p_payload->>'source_id')::uuid or v_run.hotel_id<>(p_payload->>'hotel_id')::uuid
     or v_run.room_type_id<>(p_payload->>'room_type_id')::uuid or v_run.trigger_type<>p_payload->>'trigger_type'
     or v_run.source_version<>(p_payload->>'source_version')::bigint
     or v_run.binding_version<>(p_payload->>'binding_version')::bigint
     or v_run.started_at is distinct from (p_payload->>'started_at')::timestamptz
     or v_job.source_id<>v_run.source_id or v_job.hotel_id<>v_run.hotel_id
     or v_job.room_type_id<>v_run.room_type_id or v_job.trigger_type<>v_run.trigger_type
     or v_job.source_version<>v_run.source_version or v_job.binding_version<>v_run.binding_version
     or v_job.attempt_id<>v_run.id or v_job.status<>'running'
     or v_finished<v_run.started_at then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_run_stale'; end if;
  if not (select count(*)=1 and bool_and(hotel_external_sync_enabled) from public.site_settings) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_not_activated'; end if;
  select * into v_source from public.hotel_calendar_source_configs where id=v_run.source_id for update;
  select * into v_binding from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_run.source_id for share;
  if v_source.id is null or v_binding.source_id is null
     or not v_source.is_enabled or v_source.review_status<>'reviewed'
     or v_source.source_type<>'ical' or v_source.hotel_id<>v_run.hotel_id
     or v_source.room_type_id<>v_run.room_type_id
     or v_source.version<>(p_payload->>'source_version')::bigint
     or v_binding.version<>(p_payload->>'binding_version')::bigint
     or v_binding.hotel_id<>v_run.hotel_id or v_binding.room_type_id<>v_run.room_type_id
     or not exists(select 1 from public.hotel_room_types room where room.id=v_source.room_type_id
       and room.hotel_id=v_source.hotel_id and room.status='active'
       and coalesce((v_source.configuration->>'units_per_event')::integer,1)<=case
         when room.inventory_mode='unitized' then (select count(*)::integer from public.hotel_units unit
           where unit.room_type_id=room.id and unit.status='active') else room.base_inventory_count end) then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_worker_source_stale'; end if;
  if jsonb_typeof(v_source.configuration)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(v_source.configuration,array['sync_interval_minutes','units_per_event'])
     or not (v_source.configuration?&array['sync_interval_minutes','units_per_event'])
     or jsonb_typeof(v_source.configuration->'units_per_event')<>'number'
     or v_source.configuration->>'units_per_event'!~'^[1-9][0-9]*$'
     or (v_source.configuration->>'units_per_event')::integer not between 1 and 100 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_source_configuration_invalid';
  end if;
  v_units_per_event:=(v_source.configuration->>'units_per_event')::integer;
  if exists(select 1 from jsonb_array_elements(p_payload->'events') item(value)
      where jsonb_typeof(item.value)<>'object'
        or not public.hotel_v2_h2a_keys_allowed(item.value,array['external_uid_hash','recurrence_id_hash','event_fingerprint','starts_on','ends_on','event_status','source_sequence','source_last_modified_at'])
        or not (item.value?&array['external_uid_hash','recurrence_id_hash','event_fingerprint','starts_on','ends_on','event_status','source_sequence','source_last_modified_at'])
        or item.value->>'external_uid_hash'!~'^[0-9a-f]{64}$'
        or (jsonb_typeof(item.value->'recurrence_id_hash') not in('string','null'))
        or (jsonb_typeof(item.value->'recurrence_id_hash')='string' and item.value->>'recurrence_id_hash'!~'^[0-9a-f]{64}$')
        or item.value->>'event_fingerprint'!~'^[0-9a-f]{64}$'
        or item.value->>'event_status' not in('active','cancelled')
        or not public.hotel_v2_admin_c_date_is_canonical(item.value->>'starts_on')
        or not public.hotel_v2_admin_c_date_is_canonical(item.value->>'ends_on')
        or (item.value->>'ends_on')::date<=(item.value->>'starts_on')::date
        or (item.value->>'ends_on')::date-(item.value->>'starts_on')::date>366
        or jsonb_typeof(item.value->'source_sequence') not in('number','null')
        or (jsonb_typeof(item.value->'source_sequence')='number' and item.value->>'source_sequence'!~'^(0|[1-9][0-9]*)$')
        or jsonb_typeof(item.value->'source_last_modified_at') not in('string','null')
        or (jsonb_typeof(item.value->'source_last_modified_at')='string'
          and not public.hotel_v2_admin_c_timestamptz_is_canonical(item.value->>'source_last_modified_at'))) then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_event'; end if;
  if (select count(*) from jsonb_array_elements(p_payload->'events'))<>(select count(*) from(
      select distinct item.value->>'external_uid_hash',coalesce(item.value->>'recurrence_id_hash','')
      from jsonb_array_elements(p_payload->'events') item(value)) unique_events) then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_duplicate_event'; end if;
  select coalesce(sum((value->>'ends_on')::date-(value->>'starts_on')::date),0)::integer
    into v_days from jsonb_array_elements(p_payload->'events') item(value) where value->>'event_status'='active';
  if v_days>50000 then raise exception using errcode='54000',message='hotels_v2_external_calendar_worker_day_limit_exceeded'; end if;
  update hotels_v2_private.hotel_external_calendar_day_blocks set is_active=false,
    version=version+1,updated_at=clock_timestamp() where source_id=v_run.source_id and is_active;
  for v_event in select value from jsonb_array_elements(p_payload->'events') item(value) loop
    select id into v_event_id from hotels_v2_private.hotel_external_calendar_events
      where source_id=v_run.source_id and external_uid_hash=v_event->>'external_uid_hash'
        and coalesce(recurrence_id_hash,'')=coalesce(v_event->>'recurrence_id_hash','') for update;
    if v_event_id is null then v_event_id:=gen_random_uuid();
      insert into hotels_v2_private.hotel_external_calendar_events(id,source_id,hotel_id,room_type_id,
        external_uid_hash,recurrence_id_hash,event_fingerprint,starts_on,ends_on,event_status,
        source_sequence,source_last_modified_at,first_seen_run_id,last_seen_run_id,cancelled_at)
      values(v_event_id,v_run.source_id,v_run.hotel_id,v_run.room_type_id,v_event->>'external_uid_hash',
        nullif(v_event->>'recurrence_id_hash',''),v_event->>'event_fingerprint',(v_event->>'starts_on')::date,
        (v_event->>'ends_on')::date,v_event->>'event_status',(v_event->>'source_sequence')::integer,
        (v_event->>'source_last_modified_at')::timestamptz,v_run.id,v_run.id,
        case when v_event->>'event_status'='cancelled' then v_finished end);
    else
      update hotels_v2_private.hotel_external_calendar_events set event_fingerprint=v_event->>'event_fingerprint',
        starts_on=(v_event->>'starts_on')::date,ends_on=(v_event->>'ends_on')::date,
        event_status=v_event->>'event_status',source_sequence=(v_event->>'source_sequence')::integer,
        source_last_modified_at=(v_event->>'source_last_modified_at')::timestamptz,
        last_seen_run_id=v_run.id,last_seen_at=v_finished,
        cancelled_at=case when v_event->>'event_status'='cancelled' then coalesce(cancelled_at,v_finished) end,
        version=version+1 where id=v_event_id;
    end if;
    if v_event->>'event_status'='active' then
      insert into hotels_v2_private.hotel_external_calendar_day_blocks(event_id,source_id,hotel_id,room_type_id,
        stay_date,units_blocked,is_active,first_seen_run_id,last_seen_run_id)
      select v_event_id,v_run.source_id,v_run.hotel_id,v_run.room_type_id,day_value::date,
        v_units_per_event,true,v_run.id,v_run.id
      from generate_series((v_event->>'starts_on')::date,(v_event->>'ends_on')::date-1,interval '1 day') day_value
      on conflict(event_id,stay_date) do update set is_active=true,last_seen_run_id=excluded.last_seen_run_id,
        version=hotel_external_calendar_day_blocks.version+1,updated_at=clock_timestamp();
    end if;
  end loop;
  update hotels_v2_private.hotel_external_calendar_events set event_status='cancelled',cancelled_at=v_finished,
    version=version+1 where source_id=v_run.source_id and event_status='active' and last_seen_run_id<>v_run.id;
  select jsonb_array_length(p_payload->'events'),
    count(*) filter(where value->>'event_status'='active')::integer into v_event_count,v_active_count
    from jsonb_array_elements(p_payload->'events') item(value);
  select count(*)::integer into v_block_count from hotels_v2_private.hotel_external_calendar_day_blocks
    where source_id=v_run.source_id and is_active;
  update hotels_v2_private.hotel_external_calendar_sync_runs set status='succeeded',finished_at=v_finished,
    http_status=(p_payload->>'http_status')::smallint,content_fingerprint=p_payload->>'content_fingerprint',
    event_count=v_event_count,active_event_count=v_active_count,request_fingerprint=v_fingerprint where id=v_run.id;
  update hotels_v2_private.hotel_external_calendar_sync_jobs set status='succeeded',version=version+1,
    updated_at=clock_timestamp() where id=v_run.job_id;
  insert into hotels_v2_private.hotel_external_calendar_source_state(source_id,last_run_id,last_attempt_at,last_success_at,
    next_retry_at,consecutive_failures,last_content_fingerprint,last_event_count,last_active_event_count,
    last_error_code,last_error_message)
  values(v_run.source_id,v_run.id,v_run.started_at,v_finished,null,0,p_payload->>'content_fingerprint',
    v_event_count,v_active_count,null,null) on conflict(source_id) do update set
    last_run_id=excluded.last_run_id,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,
    next_retry_at=null,consecutive_failures=0,last_content_fingerprint=excluded.last_content_fingerprint,
    last_event_count=excluded.last_event_count,last_active_event_count=excluded.last_active_event_count,
    last_error_code=null,last_error_message=null,version=hotel_external_calendar_source_state.version+1,
    updated_at=clock_timestamp();
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_finalize_result_v1',
    'attempt_id',v_run.id,'job_id',v_run.job_id,'source_id',v_run.source_id,'status','succeeded',
    'event_count',v_event_count,'active_event_count',v_active_count,'active_day_block_count',v_block_count,'replayed',false);
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_finalize';
end
$function$;

create function public.hotel_v2_external_calendar_worker_fail_sync(p_payload jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_run hotels_v2_private.hotel_external_calendar_sync_runs%rowtype;
  v_job hotels_v2_private.hotel_external_calendar_sync_jobs%rowtype;
  v_source public.hotel_calendar_source_configs%rowtype;
  v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;
  v_fingerprint text; v_finished timestamptz; v_failures integer;
begin
  perform public.hotel_v2_external_calendar_require_service_role();
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_payload,array['contract_version','job_id','lease_token','source_id','hotel_id','room_type_id','source_version','binding_version','trigger_type','attempt_id','started_at','finished_at','http_status','error_code','error_message'])
     or not (p_payload?&array['contract_version','job_id','lease_token','source_id','hotel_id','room_type_id','source_version','binding_version','trigger_type','attempt_id','started_at','finished_at','http_status','error_code','error_message'])
     or p_payload->>'contract_version'<>'hotels_v2_external_calendar_worker_fail_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_payload)
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(p_payload->>'started_at')
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(p_payload->>'finished_at')
     or jsonb_typeof(p_payload->'error_code')<>'string' or p_payload->>'error_code'<>btrim(p_payload->>'error_code')
     or length(p_payload->>'error_code') not between 1 and 120 or p_payload->>'error_code'~'[[:cntrl:]]'
     or jsonb_typeof(p_payload->'error_message')<>'string' or p_payload->>'error_message'<>btrim(p_payload->>'error_message')
     or length(p_payload->>'error_message') not between 1 and 500 or p_payload->>'error_message'~'[[:cntrl:]]'
     or jsonb_typeof(p_payload->'http_status') not in('number','null') then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_failure'; end if;
  v_fingerprint:=public.hotel_v2_external_calendar_worker_hash(p_payload);
  v_finished:=(p_payload->>'finished_at')::timestamptz;
  if v_finished>clock_timestamp()+interval '1 minute' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_failure'; end if;
  select * into v_run from hotels_v2_private.hotel_external_calendar_sync_runs
    where id=(p_payload->>'attempt_id')::uuid for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_external_calendar_run_not_found'; end if;
  if v_run.status='failed' then
    if v_run.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_attempt_conflict'; end if;
    return jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_fail_result_v1',
      'attempt_id',v_run.id,'job_id',v_run.job_id,'source_id',v_run.source_id,'status','failed',
      'next_retry_at',(select next_retry_at from hotels_v2_private.hotel_external_calendar_source_state
        where source_id=v_run.source_id),'replayed',true);
  end if;
  select * into v_job from hotels_v2_private.hotel_external_calendar_sync_jobs where id=v_run.job_id for update;
  select * into v_source from public.hotel_calendar_source_configs where id=v_run.source_id for share;
  select * into v_binding from hotels_v2_private.hotel_external_calendar_source_secrets
    where source_id=v_run.source_id for share;
  if v_job.id is null or v_source.id is null or v_binding.source_id is null
     or v_run.status<>'running' or v_run.job_id<>(p_payload->>'job_id')::uuid
     or v_run.lease_token is distinct from (p_payload->>'lease_token')::uuid
     or v_job.lease_token is distinct from (p_payload->>'lease_token')::uuid
     or v_run.source_id<>(p_payload->>'source_id')::uuid
     or v_run.hotel_id<>(p_payload->>'hotel_id')::uuid
     or v_run.room_type_id<>(p_payload->>'room_type_id')::uuid
     or v_run.source_version<>(p_payload->>'source_version')::bigint
     or v_run.binding_version<>(p_payload->>'binding_version')::bigint
     or v_run.trigger_type<>p_payload->>'trigger_type'
     or v_run.started_at is distinct from (p_payload->>'started_at')::timestamptz
     or v_job.source_id<>v_run.source_id or v_job.hotel_id<>v_run.hotel_id
     or v_job.room_type_id<>v_run.room_type_id or v_job.trigger_type<>v_run.trigger_type
     or v_job.source_version<>v_run.source_version or v_job.binding_version<>v_run.binding_version
     or v_job.attempt_id<>v_run.id or v_job.status<>'running'
     or v_source.hotel_id<>v_run.hotel_id or v_source.room_type_id<>v_run.room_type_id
     or v_binding.hotel_id<>v_run.hotel_id or v_binding.room_type_id<>v_run.room_type_id
     or v_finished<v_run.started_at then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_run_stale'; end if;
  select coalesce(consecutive_failures,0)+1 into v_failures
    from hotels_v2_private.hotel_external_calendar_source_state where source_id=v_run.source_id for update;
  v_failures:=coalesce(v_failures,1);
  update hotels_v2_private.hotel_external_calendar_sync_runs set status='failed',finished_at=v_finished,
    http_status=(p_payload->>'http_status')::smallint,error_code=p_payload->>'error_code',
    error_message=p_payload->>'error_message',request_fingerprint=v_fingerprint where id=v_run.id;
  update hotels_v2_private.hotel_external_calendar_sync_jobs set status='failed',error_code=p_payload->>'error_code',
    error_message=p_payload->>'error_message',version=version+1,updated_at=clock_timestamp() where id=v_run.job_id;
  insert into hotels_v2_private.hotel_external_calendar_source_state(source_id,last_run_id,last_attempt_at,
    last_failure_at,next_retry_at,consecutive_failures,last_error_code,last_error_message)
  values(v_run.source_id,v_run.id,v_run.started_at,v_finished,
    v_finished+least(interval '24 hours',interval '5 minutes'*power(2,least(v_failures-1,8))),
    v_failures,p_payload->>'error_code',p_payload->>'error_message')
  on conflict(source_id) do update set last_run_id=excluded.last_run_id,last_attempt_at=excluded.last_attempt_at,
    last_failure_at=excluded.last_failure_at,next_retry_at=excluded.next_retry_at,
    consecutive_failures=excluded.consecutive_failures,last_error_code=excluded.last_error_code,
    last_error_message=excluded.last_error_message,version=hotel_external_calendar_source_state.version+1,
    updated_at=clock_timestamp();
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_fail_result_v1',
    'attempt_id',v_run.id,'job_id',v_run.job_id,'source_id',v_run.source_id,'status','failed',
    'next_retry_at',(select next_retry_at from hotels_v2_private.hotel_external_calendar_source_state where source_id=v_run.source_id),
    'replayed',false);
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_external_calendar_worker_invalid_failure';
end
$function$;

do $security$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.hotel_v2_external_calendar_worker_hash(jsonb)',
    'public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
    'public.hotel_v2_external_calendar_worker_get_source(uuid)',
    'public.hotel_v2_external_calendar_worker_list_sources(integer)',
    'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_fail_sync(jsonb)'] loop
    execute format('alter function %s owner to postgres',v_signature::regprocedure);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',v_signature::regprocedure);
  end loop;
end
$security$;
grant execute on function public.hotel_v2_external_calendar_worker_list_sources(integer) to service_role;
grant execute on function public.hotel_v2_external_calendar_worker_get_source(uuid) to service_role;
grant execute on function public.hotel_v2_external_calendar_worker_begin_sync(jsonb) to service_role;
grant execute on function public.hotel_v2_external_calendar_worker_finalize_sync(jsonb) to service_role;
grant execute on function public.hotel_v2_external_calendar_worker_fail_sync(jsonb) to service_role;

do $postconditions$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.hotel_v2_external_calendar_worker_get_source(uuid)',
    'public.hotel_v2_external_calendar_worker_list_sources(integer)',
    'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_fail_sync(jsonb)'] loop
    if not exists(select 1 from pg_proc where oid=v_signature::regprocedure and proowner='postgres'::regrole
      and prosecdef and proconfig=array['search_path=pg_catalog, public']::text[])
      or not has_function_privilege('service_role',v_signature,'EXECUTE')
      or has_function_privilege(0::oid,v_signature,'EXECUTE')
      or has_function_privilege('anon',v_signature,'EXECUTE')
      or has_function_privilege('authenticated',v_signature,'EXECUTE') then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_worker_rpc_security_mismatch';
    end if;
  end loop;
  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',array['search_path=pg_catalog, public']::text[])
    ) expected(signature,configuration)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole or not procedure.prosecdef
      or procedure.proconfig is distinct from expected.configuration
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_worker_internal_security_mismatch';
  end if;
  if has_schema_privilege('service_role','hotels_v2_private','USAGE')
     or has_table_privilege('service_role','hotels_v2_private.hotel_external_calendar_sync_jobs','SELECT') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_worker_private_access_exposed'; end if;
  if exists(select 1 from public.site_settings where hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_worker_changed_flags'; end if;
end
$postconditions$;
notify pgrst,'reload schema';
commit;
