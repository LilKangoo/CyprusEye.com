-- Hotels V2 Stage 2C: subtractive external-calendar availability projection.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

do $preconditions$
begin
  if to_regprocedure('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_day_blocks') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_sync_jobs') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_availability_foundation_missing';
  end if;
  if to_regprocedure('public.hotel_v2_admin_d_snapshot_external_base(uuid,date,date,boolean)') is not null
     or to_regprocedure('public.hotel_v2_admin_d_snapshot_stage1(uuid,date,date,boolean)') is not null then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_availability_already_present';
  end if;
end
$preconditions$;

-- Reuse the accepted ADMIN-D snapshot byte-for-byte.  The sole cloned-source
-- change permits the external flag while the original guard continues to
-- require the other three flags OFF.  The wrapper below only lowers capacity.
do $clone_admin_d$
declare v_definition text; v_stage1 text; v_external text;
  v_needle text:='not hotel_external_sync_enabled';
begin
  v_definition:=pg_get_functiondef('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)'::regprocedure);
  if (length(v_definition)-length(replace(v_definition,v_needle,'')))/length(v_needle)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_admin_d_source_drift';
  end if;
  v_stage1:=regexp_replace(v_definition,
    'FUNCTION public\.hotel_v2_admin_d_snapshot\(',
    'FUNCTION public.hotel_v2_admin_d_snapshot_stage1(',1,1,'i');
  v_external:=regexp_replace(v_definition,
    'FUNCTION public\.hotel_v2_admin_d_snapshot\(',
    'FUNCTION public.hotel_v2_admin_d_snapshot_external_base(',1,1,'i');
  if v_stage1=v_definition or v_external=v_definition then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_admin_d_signature_drift';
  end if;
  v_external:=replace(v_external,v_needle,'hotel_external_sync_enabled in(false,true)');
  execute v_stage1;
  execute v_external;
end
$clone_admin_d$;

create or replace function public.hotel_v2_admin_d_snapshot(
  p_hotel_id uuid,p_from date,p_to date,p_require_admin boolean default true
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_control jsonb;
  v_cells jsonb;
  v_blocks jsonb;
  v_global_enabled boolean;
begin
  if (select count(*) from public.site_settings)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_settings_cardinality';
  end if;
  select setting.hotel_external_sync_enabled into v_global_enabled
    from public.site_settings setting where setting.id=1;

  v_control:=public.hotel_v2_admin_d_snapshot_external_base(
    p_hotel_id,p_from,p_to,p_require_admin);

  -- While Stage 2F has not been explicitly activated the accepted ADMIN-D
  -- snapshot remains byte-for-byte unchanged.
  if not v_global_enabled then return v_control; end if;

  if (select count(*) from hotels_v2_private.hotel_external_calendar_day_blocks block
      join public.hotel_calendar_source_configs source on source.id=block.source_id
      where block.hotel_id=p_hotel_id and block.stay_date between p_from and p_to
        and block.is_active and source.hotel_id=block.hotel_id
        and source.room_type_id=block.room_type_id and source.source_type='ical'
        and source.is_enabled and source.review_status='reviewed')>62000 then
    raise exception using errcode='54000',message='hotels_v2_external_calendar_availability_limit_exceeded';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(room_type_id,stay_date,units_blocked)
      order by room_type_id,stay_date),'[]'::jsonb)
  into v_blocks
  from (
    select block.room_type_id,block.stay_date,
      least(sum(block.units_blocked)::integer,greatest(0,
        (cell.value->>'physical_capacity')::integer-case
          when cell.value->>'inventory_mode'='unitized'
          then (cell.value->>'blocked_unit_count')::integer else 0 end)) units_blocked
    from hotels_v2_private.hotel_external_calendar_day_blocks block
    join public.hotel_calendar_source_configs source on source.id=block.source_id
    join lateral jsonb_array_elements(v_control->'cells') cell(value)
      on cell.value->>'room_type_id'=block.room_type_id::text
        and cell.value->>'stay_date'=block.stay_date::text
    where block.hotel_id=p_hotel_id and block.stay_date between p_from and p_to
      and block.is_active and source.hotel_id=block.hotel_id
      and source.room_type_id=block.room_type_id and source.source_type='ical'
      and source.is_enabled and source.review_status='reviewed'
    group by block.room_type_id,block.stay_date,cell.value
  ) effective;

  select coalesce(jsonb_agg(
    case when coalesce(blocked.units_blocked,0)=0 then cell.value else
      jsonb_set(jsonb_set(cell.value,'{available_units}',to_jsonb(greatest(0,
        (cell.value->>'available_units')::integer-blocked.units_blocked)),false),
        '{blocking_reasons}',case when (cell.value->>'available_units')::integer-blocked.units_blocked<=0
          and not (cell.value->'blocking_reasons' ? 'inventory_exhausted')
          then (cell.value->'blocking_reasons')||'["inventory_exhausted"]'::jsonb
          else cell.value->'blocking_reasons' end,false)
    end order by cell.value->>'room_type_id',cell.value->>'stay_date'),'[]'::jsonb)
  into v_cells
  from jsonb_array_elements(v_control->'cells') cell(value)
  left join lateral (
    select (item->>2)::integer units_blocked
    from jsonb_array_elements(v_blocks) item
    where item->>0=cell.value->>'room_type_id'
      and item->>1=cell.value->>'stay_date'
  ) blocked on true;

  v_control:=jsonb_set(v_control,'{cells}',v_cells,false);
  v_control:=jsonb_set(v_control,'{snapshot_token}',to_jsonb(public.hotel_v2_admin_d_hash(
    jsonb_build_object('admin_d_snapshot_token',v_control->>'snapshot_token',
      'external_calendar_effective_blocks',v_blocks))),false);
  return v_control;
end
$function$;

alter function public.hotel_v2_admin_d_snapshot_external_base(uuid,date,date,boolean) owner to postgres;
alter function public.hotel_v2_admin_d_snapshot_stage1(uuid,date,date,boolean) owner to postgres;
alter function public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean) owner to postgres;
revoke all on function public.hotel_v2_admin_d_snapshot_external_base(uuid,date,date,boolean)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_snapshot_stage1(uuid,date,date,boolean)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)
  from public,anon,authenticated,service_role;

do $postconditions$
declare v_stage1 text; v_external text;
begin
  select pg_get_functiondef('public.hotel_v2_admin_d_snapshot_stage1(uuid,date,date,boolean)'::regprocedure)
    into v_stage1;
  select pg_get_functiondef('public.hotel_v2_admin_d_snapshot_external_base(uuid,date,date,boolean)'::regprocedure)
    into v_external;
  v_stage1:=regexp_replace(v_stage1,'FUNCTION public\.hotel_v2_admin_d_snapshot_stage1\(',
    'FUNCTION public.hotel_v2_admin_d_snapshot_external_base(',1,1,'i');
  v_stage1:=replace(v_stage1,'not hotel_external_sync_enabled',
    'hotel_external_sync_enabled in(false,true)');
  if v_stage1 is distinct from v_external then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_admin_d_clone_mismatch';
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_admin_d_snapshot_stage1(uuid,date,date,boolean)'),
      ('public.hotel_v2_admin_d_snapshot_external_base(uuid,date,date,boolean)'),
      ('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)')) expected(signature)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole
      or not procedure.prosecdef
      or procedure.proconfig is distinct from array['search_path=pg_catalog, public, auth']::text[]
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_availability_security_mismatch';
  end if;
  if exists(select 1 from public.site_settings where hotel_rooms_v2_enabled or hotel_external_sync_enabled
      or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_availability_changed_flags';
  end if;
end
$postconditions$;

notify pgrst,'reload schema';
commit;
