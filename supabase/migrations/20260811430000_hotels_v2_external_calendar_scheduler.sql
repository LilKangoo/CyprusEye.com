-- Hotels V2 Stage 2E: bounded inert queue/lease scheduler plumbing.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

do $preconditions$
begin
  if to_regclass('hotels_v2_private.hotel_external_calendar_sync_jobs') is null
     or to_regprocedure('public.hotel_v2_external_calendar_require_service_role()') is null
     or to_regclass('vault.decrypted_secrets') is null
     or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_scheduler_foundation_missing';
  end if;
end
$preconditions$;

create function public.hotel_v2_external_calendar_scheduler_enqueue_internal(p_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_queued integer:=0; v_stale record; v_failures integer;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_scheduler_invalid_limit';
  end if;
  if (select count(*) from public.site_settings)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_settings_cardinality';
  end if;
  if not (select hotel_external_sync_enabled from public.site_settings where id=1) then
    return jsonb_build_object('contract_version','hotels_v2_external_calendar_scheduler_enqueue_v1',
      'global_enabled',false,'queued_count',0);
  end if;

  -- A worker crash after begin must not strand the one-open-source invariant.
  -- Expired running leases are closed as sanitized failures and enter the same
  -- bounded retry/backoff path as an explicit worker failure.
  for v_stale in select job.id job_id,job.source_id,job.attempt_id,run.started_at
    from hotels_v2_private.hotel_external_calendar_sync_jobs job
    join hotels_v2_private.hotel_external_calendar_sync_runs run
      on run.id=job.attempt_id and run.job_id=job.id and run.status='running'
    where job.status='running' and job.leased_until<=clock_timestamp()
    order by job.leased_until,job.id limit p_limit for update of job,run skip locked
  loop
    select coalesce(state.consecutive_failures,0)+1 into v_failures
      from hotels_v2_private.hotel_external_calendar_source_state state
      where state.source_id=v_stale.source_id for update;
    v_failures:=coalesce(v_failures,1);
    update hotels_v2_private.hotel_external_calendar_sync_runs set status='failed',
      finished_at=clock_timestamp(),error_code='worker_lease_expired',
      error_message='Worker lease expired before completion.' where id=v_stale.attempt_id;
    update hotels_v2_private.hotel_external_calendar_sync_jobs set status='failed',
      error_code='worker_lease_expired',error_message='Worker lease expired before completion.',
      version=version+1,updated_at=clock_timestamp() where id=v_stale.job_id;
    insert into hotels_v2_private.hotel_external_calendar_source_state(source_id,last_run_id,
      last_attempt_at,last_failure_at,next_retry_at,consecutive_failures,last_error_code,last_error_message)
    values(v_stale.source_id,v_stale.attempt_id,v_stale.started_at,clock_timestamp(),
      clock_timestamp()+least(interval '24 hours',interval '5 minutes'*power(2,least(v_failures-1,8))),
      v_failures,'worker_lease_expired','Worker lease expired before completion.')
    on conflict(source_id) do update set last_run_id=excluded.last_run_id,
      last_attempt_at=excluded.last_attempt_at,last_failure_at=excluded.last_failure_at,
      next_retry_at=excluded.next_retry_at,consecutive_failures=excluded.consecutive_failures,
      last_error_code=excluded.last_error_code,last_error_message=excluded.last_error_message,
      version=hotel_external_calendar_source_state.version+1,updated_at=clock_timestamp();
  end loop;

  with candidates as(
    select source.id,source.hotel_id,source.room_type_id,source.version source_version,
      binding.version binding_version,
      case when state.next_retry_at is not null then 'retry' else 'scheduled' end trigger_type
    from public.hotel_calendar_source_configs source
    join public.hotel_room_types room on room.id=source.room_type_id
      and room.hotel_id=source.hotel_id and room.status='active'
    join hotels_v2_private.hotel_external_calendar_source_secrets binding
      on binding.source_id=source.id and binding.hotel_id=source.hotel_id
        and binding.room_type_id=source.room_type_id
    left join hotels_v2_private.hotel_external_calendar_source_state state on state.source_id=source.id
    where source.source_type='ical' and source.is_enabled and source.review_status='reviewed'
      and jsonb_typeof(source.configuration)='object'
      and public.hotel_v2_h2a_keys_allowed(source.configuration,array['sync_interval_minutes','units_per_event'])
      and source.configuration?&array['sync_interval_minutes','units_per_event']
      and jsonb_typeof(source.configuration->'sync_interval_minutes')='number'
      and source.configuration->>'sync_interval_minutes'~'^[1-9][0-9]*$'
      and (source.configuration->>'sync_interval_minutes')::integer between 15 and 1440
      and jsonb_typeof(source.configuration->'units_per_event')='number'
      and source.configuration->>'units_per_event'~'^[1-9][0-9]*$'
      and (source.configuration->>'units_per_event')::integer between 1 and 100
      and (source.configuration->>'units_per_event')::integer<=case
        when room.inventory_mode='unitized' then (select count(*)::integer
          from public.hotel_units unit where unit.room_type_id=room.id and unit.status='active')
        else room.base_inventory_count end
      and (state.next_retry_at is null or state.next_retry_at<=clock_timestamp())
      and (state.last_attempt_at is null or state.next_retry_at is not null
        or state.last_attempt_at+make_interval(mins=>(source.configuration->>'sync_interval_minutes')::integer)
          <=clock_timestamp())
      and not exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
        where job.source_id=source.id and job.status in('queued','leased','running'))
    order by coalesce(state.next_retry_at,'infinity'::timestamptz),source.priority desc,source.id
    limit p_limit
    for update of source skip locked
  ), inserted as(
    insert into hotels_v2_private.hotel_external_calendar_sync_jobs(
      id,source_id,hotel_id,room_type_id,trigger_type,source_version,binding_version,
      created_by_type,created_by,available_at)
    select gen_random_uuid(),id,hotel_id,room_type_id,trigger_type,source_version,binding_version,
      'system',null,clock_timestamp() from candidates
    on conflict do nothing returning 1
  ) select count(*)::integer into v_queued from inserted;
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_scheduler_enqueue_v1',
    'global_enabled',true,'queued_count',v_queued);
end
$function$;

create function public.hotel_v2_external_calendar_scheduler_enqueue(p_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
begin
  perform public.hotel_v2_external_calendar_require_service_role();
  return public.hotel_v2_external_calendar_scheduler_enqueue_internal(p_limit);
end
$function$;

create function public.hotel_v2_external_calendar_scheduler_lease(
  p_limit integer,p_lease_owner uuid,p_lease_seconds integer
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_jobs jsonb; v_enabled boolean;
begin
  perform public.hotel_v2_external_calendar_require_service_role();
  if p_limit is null or p_limit not between 1 and 25 or p_lease_owner is null
     or p_lease_seconds is null or p_lease_seconds not between 30 and 900 then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_scheduler_invalid_lease';
  end if;
  if (select count(*) from public.site_settings)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_settings_cardinality';
  end if;
  select hotel_external_sync_enabled into v_enabled from public.site_settings where id=1;
  if not v_enabled then
    return jsonb_build_object('contract_version','hotels_v2_external_calendar_scheduler_lease_v1',
      'global_enabled',false,'jobs','[]'::jsonb);
  end if;

  update hotels_v2_private.hotel_external_calendar_sync_jobs
    set status='queued',lease_owner=null,lease_token=null,leased_until=null,
      version=version+1,updated_at=clock_timestamp()
    where status='leased' and leased_until<=clock_timestamp();

  with candidates as(
    select job.id from hotels_v2_private.hotel_external_calendar_sync_jobs job
    join public.hotel_calendar_source_configs source on source.id=job.source_id
    join public.hotel_room_types room on room.id=source.room_type_id
      and room.hotel_id=source.hotel_id and room.status='active'
    join hotels_v2_private.hotel_external_calendar_source_secrets binding on binding.source_id=source.id
    where job.status='queued' and job.available_at<=clock_timestamp()
      and source.source_type='ical' and source.is_enabled and source.review_status='reviewed'
      and source.hotel_id=job.hotel_id and source.room_type_id=job.room_type_id
      and source.version=job.source_version and binding.version=job.binding_version
      and binding.hotel_id=job.hotel_id and binding.room_type_id=job.room_type_id
      and jsonb_typeof(source.configuration->'units_per_event')='number'
      and source.configuration->>'units_per_event'~'^[1-9][0-9]*$'
      and (source.configuration->>'units_per_event')::integer between 1 and 100
      and (source.configuration->>'units_per_event')::integer<=case
        when room.inventory_mode='unitized' then (select count(*)::integer
          from public.hotel_units unit where unit.room_type_id=room.id and unit.status='active')
        else room.base_inventory_count end
    order by job.available_at,job.created_at,job.id limit p_limit
    for update of job skip locked
  ), leased as(
    update hotels_v2_private.hotel_external_calendar_sync_jobs job set
      status='leased',lease_owner=p_lease_owner,lease_token=gen_random_uuid(),
      leased_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),
      version=job.version+1,updated_at=clock_timestamp()
    from candidates where job.id=candidates.id
    returning job.id,job.source_id,job.hotel_id,job.room_type_id,job.source_version,
      job.binding_version,job.trigger_type,job.lease_token,job.leased_until,job.created_at
  ) select coalesce(jsonb_agg(jsonb_build_object(
      'job_id',id,'source_id',source_id,'hotel_id',hotel_id,'room_type_id',room_type_id,
      'source_version',source_version,'binding_version',binding_version,'trigger_type',trigger_type,
      'lease_token',lease_token,'leased_until',leased_until) order by created_at,id),'[]'::jsonb)
    into v_jobs from leased;
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_scheduler_lease_v1',
    'global_enabled',true,'jobs',v_jobs);
end
$function$;

-- The cron-installed dispatcher is deliberately not granted to an API role.
-- It contains no literal secret: 2F verifies these exact Vault names before
-- enabling the feature and installing the 15-minute pg_cron invocation.
create function public.hotel_v2_external_calendar_scheduler_dispatch()
returns bigint language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_url text; v_shared_secret text; v_request_id bigint;
begin
  if not (select count(*)=1 and bool_and(hotel_external_sync_enabled) from public.site_settings) then
    return null;
  end if;
  select decrypted_secret into strict v_url from vault.decrypted_secrets
    where name='hotels-v2-external-calendar-worker-url';
  select decrypted_secret into strict v_shared_secret from vault.decrypted_secrets
    where name='hotels-v2-external-calendar-worker-shared-secret';
  if v_url<>'https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync'
     or length(v_shared_secret)<32
     or v_shared_secret~'[[:space:][:cntrl:]]' then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_scheduler_secret_invalid';
  end if;
  select net.http_post(url=>v_url,
    headers=>jsonb_build_object('content-type','application/json',
      'x-hotels-v2-ical-sync-secret',v_shared_secret),
    body=>jsonb_build_object('contract_version','hotels_v2_external_calendar_worker_request_v1',
      'enqueue_scheduled',true,'limit',8),timeout_milliseconds=>150000) into v_request_id;
  return v_request_id;
end
$function$;

alter function public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer) owner to postgres;
alter function public.hotel_v2_external_calendar_scheduler_enqueue(integer) owner to postgres;
alter function public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer) owner to postgres;
alter function public.hotel_v2_external_calendar_scheduler_dispatch() owner to postgres;
revoke all on function public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer),
  public.hotel_v2_external_calendar_scheduler_enqueue(integer),
  public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer),
  public.hotel_v2_external_calendar_scheduler_dispatch()
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_external_calendar_scheduler_enqueue(integer) to service_role;
grant execute on function public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer) to service_role;

do $postconditions$
begin
  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_scheduler_enqueue(integer)',true),
      ('public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',true),
      ('public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',false),
      ('public.hotel_v2_external_calendar_scheduler_dispatch()',false)) expected(signature,service_execute)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole or not procedure.prosecdef
      or procedure.proconfig is distinct from array['search_path=pg_catalog, public']::text[]
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE') is distinct from expected.service_execute) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_scheduler_security_mismatch';
  end if;
  if exists(select 1 from public.site_settings where hotel_rooms_v2_enabled or hotel_external_sync_enabled
      or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_scheduler_changed_flags';
  end if;
  if pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%timeout_milliseconds=>150000%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%''limit'',8%' then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_scheduler_dispatch_contract_mismatch';
  end if;
end
$postconditions$;

notify pgrst,'reload schema';
commit;
