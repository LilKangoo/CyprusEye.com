-- Hotels V2 Stage 2D: reviewed Admin/Partner external-calendar control.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

do $preconditions$
begin
  if to_regclass('public.hotel_calendar_source_configs') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_sync_jobs') is null
     or to_regprocedure('public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)') is null
     or to_regprocedure('public.hotel_v2_h3_2b_access_snapshot(uuid,uuid,text)') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_control_foundation_missing';
  end if;
end
$preconditions$;

create function public.hotel_v2_external_calendar_protected_fingerprints()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select (public.hotel_v2_h3_2b_protected_fingerprints()-array[
    'hotel_calendar_source_configs','hotel_partner_action_receipts',
    'non_h3_2b_activity','non_h3_2b_partner_receipts'])||jsonb_build_object(
  'non_ical_calendar_sources',md5(pg_catalog.query_to_xml($query$
    select to_jsonb(source)::text from public.hotel_calendar_source_configs source
    where source.source_type<>'ical' order by source.id$query$,true,true,'')::text),
  'non_external_calendar_activity',md5(pg_catalog.query_to_xml($query$
    select to_jsonb(activity)::text from public.hotel_activity_log activity
    where activity.source is distinct from 'hotels_v2_external_calendar_control'
    order by activity.id$query$,true,true,'')::text),
  'non_external_calendar_partner_receipts',md5(pg_catalog.query_to_xml($query$
    select to_jsonb(receipt)::text from public.hotel_partner_action_receipts receipt
    where receipt.action is distinct from 'h3_2d_external_calendar'
    order by receipt.id$query$,true,true,'')::text))
$function$;

create table hotels_v2_private.hotel_external_calendar_foundation_receipts(
  id smallint primary key check(id=1),protected_fingerprints jsonb not null,
  protected_fingerprint text not null check(protected_fingerprint~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
insert into hotels_v2_private.hotel_external_calendar_foundation_receipts(
  id,protected_fingerprints,protected_fingerprint)
select 1,value,public.hotel_v2_external_calendar_worker_hash(value)
from (select public.hotel_v2_external_calendar_protected_fingerprints() value) captured;
create trigger hotel_external_calendar_foundation_receipt_immutable before update or delete
  on hotels_v2_private.hotel_external_calendar_foundation_receipts for each row
  execute function public.hotel_v2_h3_2a_reject_immutable_change();
revoke all on hotels_v2_private.hotel_external_calendar_foundation_receipts
  from public,anon,authenticated,service_role;

alter table hotels_v2_private.hotel_external_calendar_source_secrets
  add column url_fingerprint text;
update hotels_v2_private.hotel_external_calendar_source_secrets binding set
  url_fingerprint=encode(extensions.digest(convert_to(secret.decrypted_secret,'UTF8'),'sha256'),'hex')
from vault.decrypted_secrets secret where secret.id=binding.vault_secret_id;
alter table hotels_v2_private.hotel_external_calendar_source_secrets
  alter column url_fingerprint set not null,
  add constraint hotel_external_calendar_source_secrets_url_fingerprint_check
    check(url_fingerprint~'^[0-9a-f]{64}$');
revoke all on function public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_get_external_calendar_status(uuid)
  from public,anon,authenticated,service_role;

create table hotels_v2_private.hotel_external_calendar_plan_reviews(
  id uuid primary key,actor_type text not null check(actor_type in('admin','partner')),
  actor_id uuid not null,partner_id uuid,hotel_id uuid not null references public.hotels(id) on delete restrict,
  assignment_id uuid,permission_version bigint,access_snapshot_token text,
  snapshot_token text not null,reviewed_plan jsonb not null,plan_fingerprint text not null,
  expires_at timestamptz not null,consumed_at timestamptz,consumed_correlation_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  check(plan_fingerprint~'^[0-9a-f]{64}$' and snapshot_token~'^[0-9a-f]{64}$'),
  check(access_snapshot_token is null or access_snapshot_token~'^[0-9a-f]{64}$'),
  check((actor_type='admin' and partner_id is null and assignment_id is null
      and permission_version is null and access_snapshot_token is null)
    or (actor_type='partner' and partner_id is not null and assignment_id is not null
      and permission_version>0 and access_snapshot_token is not null)),
  check(jsonb_typeof(reviewed_plan)='object')
);

create table hotels_v2_private.hotel_external_calendar_admin_receipts(
  id uuid primary key default gen_random_uuid(),actor_id uuid not null,hotel_id uuid not null
    references public.hotels(id) on delete restrict,idempotency_key uuid not null,
  correlation_id uuid not null,request_hash text not null,result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(actor_id,idempotency_key),unique(correlation_id),
  check(request_hash~'^[0-9a-f]{64}$'),check(jsonb_typeof(result)='object')
);

create table hotels_v2_private.hotel_external_calendar_correlations(
  correlation_id uuid primary key,actor_type text not null check(actor_type in('admin','partner')),
  actor_id uuid not null,idempotency_key uuid not null,request_hash text not null,
  check(request_hash~'^[0-9a-f]{64}$')
);
revoke all on hotels_v2_private.hotel_external_calendar_plan_reviews,
  hotels_v2_private.hotel_external_calendar_admin_receipts,
  hotels_v2_private.hotel_external_calendar_correlations
  from public,anon,authenticated,service_role;

create function public.hotel_v2_external_calendar_guard_review()
returns trigger language plpgsql set search_path=pg_catalog,public
as $function$
begin
  if tg_op='INSERT' then
    if new.actor_type='partner' and not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.assignment_id=new.assignment_id and permission.partner_id=new.partner_id
        and permission.hotel_id=new.hotel_id and permission.version=new.permission_version
        and permission.manage_availability) then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_review_assignment_mismatch';
    end if;
    return new;
  end if;
  if tg_op='DELETE' or old.id is distinct from new.id or old.actor_type is distinct from new.actor_type
     or old.actor_id is distinct from new.actor_id or old.partner_id is distinct from new.partner_id
     or old.hotel_id is distinct from new.hotel_id or old.assignment_id is distinct from new.assignment_id
     or old.permission_version is distinct from new.permission_version
     or old.access_snapshot_token is distinct from new.access_snapshot_token
     or old.snapshot_token is distinct from new.snapshot_token
     or old.reviewed_plan is distinct from new.reviewed_plan
     or old.plan_fingerprint is distinct from new.plan_fingerprint
     or old.expires_at is distinct from new.expires_at or old.created_at is distinct from new.created_at
     or old.consumed_at is not null or new.consumed_at is null or new.consumed_correlation_id is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_invalid_review_transition';
  end if;
  return new;
end
$function$;
create trigger hotel_external_calendar_plan_reviews_guard before insert or update or delete
  on hotels_v2_private.hotel_external_calendar_plan_reviews for each row
  execute function public.hotel_v2_external_calendar_guard_review();
create trigger hotel_external_calendar_admin_receipts_immutable before update or delete
  on hotels_v2_private.hotel_external_calendar_admin_receipts for each row
  execute function public.hotel_v2_h3_2a_reject_immutable_change();
create trigger hotel_external_calendar_correlations_immutable before update or delete
  on hotels_v2_private.hotel_external_calendar_correlations for each row
  execute function public.hotel_v2_h3_2a_reject_immutable_change();

create function public.hotel_v2_external_calendar_guard_source()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_action text:=nullif(current_setting('hotels_v2.external_calendar_apply_action',true),'');
begin
  if tg_op='DELETE' then
    if old.source_type<>'manual' then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_source_history_immutable';
    end if;
    return old;
  end if;
  if tg_op='UPDATE' and old.source_type<>'manual' and (new.source_type<>'ical'
     or new.id is distinct from old.id or new.hotel_id is distinct from old.hotel_id
     or new.external_reference is distinct from old.external_reference
     or new.review_status is distinct from old.review_status
     or new.created_at is distinct from old.created_at
     or new.version<>old.version+1 or new.updated_at<=old.updated_at) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_source_field_scope_violation';
  end if;
  if new.source_type='manual' then return new; end if;
  if nullif(current_setting('hotels_v2.external_calendar_apply_context',true),'') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_reviewed_context_required';
  end if;
  if tg_op='INSERT' and (v_action is distinct from 'create' or new.source_type<>'ical'
       or new.is_enabled or new.review_status<>'reviewed' or new.version<>1) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_source_action_scope_violation';
  end if;
  if tg_op='UPDATE' and (
       (v_action='update' and new.is_enabled is distinct from old.is_enabled)
       or (v_action='enable' and (old.is_enabled or not new.is_enabled
         or new.room_type_id is distinct from old.room_type_id or new.code is distinct from old.code
         or new.configuration is distinct from old.configuration or new.priority is distinct from old.priority))
       or (v_action='disable' and (not old.is_enabled or new.is_enabled
         or new.room_type_id is distinct from old.room_type_id or new.code is distinct from old.code
         or new.configuration is distinct from old.configuration or new.priority is distinct from old.priority))
       or coalesce(v_action,'') not in('update','enable','disable')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_source_action_scope_violation';
  end if;
  if tg_op='UPDATE' and exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
      where job.source_id=old.id and job.status in('queued','leased','running'))
     and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_sync_in_progress';
  end if;
  if tg_op='UPDATE' and new.room_type_id is distinct from old.room_type_id and (old.is_enabled
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=old.id)
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_runs where source_id=old.id)
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_events where source_id=old.id)) then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_source_mapping_not_changeable';
  end if;
  if new.source_type<>'ical' or new.room_type_id is null
     or jsonb_typeof(new.configuration)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(new.configuration,array['sync_interval_minutes','units_per_event'])
     or not (new.configuration?&array['sync_interval_minutes','units_per_event'])
     or jsonb_typeof(new.configuration->'sync_interval_minutes')<>'number'
     or new.configuration->>'sync_interval_minutes'!~'^[1-9][0-9]*$'
     or (new.configuration->>'sync_interval_minutes')::integer not between 15 and 1440
     or jsonb_typeof(new.configuration->'units_per_event')<>'number'
     or new.configuration->>'units_per_event'!~'^[1-9][0-9]*$'
     or (new.configuration->>'units_per_event')::integer not between 1 and 100
     or not exists(select 1 from public.hotel_room_types room where room.id=new.room_type_id
       and room.hotel_id=new.hotel_id and room.status='active'
       and (new.configuration->>'units_per_event')::integer<=case
         when room.inventory_mode='unitized' then (select count(*)::integer from public.hotel_units unit
           where unit.room_type_id=room.id and unit.status='active')
         else room.base_inventory_count end) then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_source_invalid';
  end if;
  if new.is_enabled and (new.review_status<>'reviewed'
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets binding
       where binding.source_id=new.id and binding.hotel_id=new.hotel_id
         and binding.room_type_id=new.room_type_id)
     or not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
       and hotel_external_sync_enabled and not hotel_instant_booking_enabled
       and not hotel_stripe_connect_enabled) from public.site_settings)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_source_enable_guard';
  end if;
  return new;
end
$function$;
alter table public.hotel_calendar_source_configs
  drop constraint hotel_calendar_source_configs_external_inert_check;
create trigger hotel_calendar_source_configs_external_guard before insert or update or delete
  on public.hotel_calendar_source_configs for each row
  execute function public.hotel_v2_external_calendar_guard_source();

-- An enabled feed is an active capacity dependency.  Room/Unit lifecycle
-- changes must not invalidate its exact mapping or configured block size.
create function public.hotel_v2_external_calendar_guard_room_unit_capacity()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_room_id uuid; v_post_capacity integer; v_required integer;
begin
  if tg_table_name='hotel_room_types' then
    if not exists(select 1 from public.hotel_calendar_source_configs source
        where source.room_type_id=old.id and source.hotel_id=old.hotel_id
          and source.source_type='ical' and source.is_enabled and source.review_status='reviewed') then
      return case when tg_op='DELETE' then old else new end;
    end if;
    if tg_op='DELETE' or new.id is distinct from old.id or new.hotel_id is distinct from old.hotel_id
       or new.status<>'active' then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_enabled_source_room_lifecycle_blocked';
    end if;
    v_post_capacity:=case when new.inventory_mode='unitized' then
      (select count(*)::integer from public.hotel_units unit
       where unit.room_type_id=new.id and unit.status='active') else new.base_inventory_count end;
    select max((source.configuration->>'units_per_event')::integer) into v_required
      from public.hotel_calendar_source_configs source
      where source.room_type_id=new.id and source.hotel_id=new.hotel_id
        and source.source_type='ical' and source.is_enabled and source.review_status='reviewed';
    if v_post_capacity<coalesce(v_required,1) then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_enabled_source_capacity_blocked';
    end if;
    return new;
  end if;

  -- Only an active Unit leaving its old Room can lower that Room's capacity.
  if old.status='active' and (tg_op='DELETE' or new.status<>'active'
       or new.room_type_id is distinct from old.room_type_id) then
    v_room_id:=old.room_type_id;
    if exists(select 1 from public.hotel_calendar_source_configs source
        join public.hotel_room_types room on room.id=source.room_type_id
        where source.room_type_id=v_room_id and source.source_type='ical'
          and source.is_enabled and source.review_status='reviewed'
          and room.status='active' and room.inventory_mode='unitized') then
      select count(*)::integer-1 into v_post_capacity from public.hotel_units unit
        where unit.room_type_id=v_room_id and unit.status='active';
      select max((source.configuration->>'units_per_event')::integer) into v_required
        from public.hotel_calendar_source_configs source
        where source.room_type_id=v_room_id and source.source_type='ical'
          and source.is_enabled and source.review_status='reviewed';
      if v_post_capacity<coalesce(v_required,1) then
        raise exception using errcode='55000',message='hotels_v2_external_calendar_enabled_source_capacity_blocked';
      end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;
create trigger hotel_room_types_external_calendar_capacity_guard
before update or delete on public.hotel_room_types for each row
execute function public.hotel_v2_external_calendar_guard_room_unit_capacity();
create trigger hotel_units_external_calendar_capacity_guard
before update or delete on public.hotel_units for each row
execute function public.hotel_v2_external_calendar_guard_room_unit_capacity();

create function public.hotel_v2_external_calendar_source_projection(p_source_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_build_object('id',source.id,'hotel_id',source.hotel_id,
  'room_type_id',source.room_type_id,'code',source.code,'source_type',source.source_type,
  'is_enabled',source.is_enabled,'review_status',source.review_status,'priority',source.priority,
  'version',source.version,'updated_at',source.updated_at,
  'secret_configured',binding.source_id is not null,'binding_version',binding.version,
  'sync_interval_minutes',case when jsonb_typeof(source.configuration->'sync_interval_minutes')='number'
      and source.configuration->>'sync_interval_minutes'~'^[1-9][0-9]*$'
      then (source.configuration->>'sync_interval_minutes')::integer else 60 end,
  'units_per_event',case when jsonb_typeof(source.configuration->'units_per_event')='number'
      and source.configuration->>'units_per_event'~'^[1-9][0-9]*$'
      then (source.configuration->>'units_per_event')::integer else 1 end,
  'health',jsonb_build_object('status',case
    when exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
      where job.source_id=source.id and job.status in('leased','running')) then 'syncing'
    when coalesce(state.consecutive_failures,0)>0 then 'degraded'
    when state.last_success_at is not null then 'healthy' else 'never_synced' end,
    'last_attempt_at',state.last_attempt_at,'last_success_at',state.last_success_at,
    'last_failure_at',state.last_failure_at,'next_retry_at',state.next_retry_at,
    'consecutive_failures',coalesce(state.consecutive_failures,0),
    'last_event_count',coalesce(state.last_event_count,0),
    'last_active_event_count',coalesce(state.last_active_event_count,0),
    'last_block_count',(select count(*)::integer from hotels_v2_private.hotel_external_calendar_day_blocks block
      where block.source_id=source.id and block.is_active),
    'last_error_code',state.last_error_code,'last_error_message',state.last_error_message,
    'state_version',coalesce(state.version,0)))
from public.hotel_calendar_source_configs source
left join hotels_v2_private.hotel_external_calendar_source_secrets binding on binding.source_id=source.id
left join hotels_v2_private.hotel_external_calendar_source_state state on state.source_id=source.id
where source.id=p_source_id and source.source_type='ical'
$function$;

create function public.hotel_v2_external_calendar_control_common(
  p_actor_type text,p_partner_id uuid,p_hotel_id uuid
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth
as $function$
declare v_assignment uuid; v_permission bigint; v_access text; v_partner_access jsonb;
  v_sources jsonb; v_token text;
begin
  if p_hotel_id is null or not exists(select 1 from public.hotels hotel where hotel.id=p_hotel_id
      and hotel.architecture_version='legacy') then
    raise exception using errcode='PT404',message='hotels_v2_external_calendar_hotel_not_found';
  end if;
  if p_actor_type='admin' then perform public.hotel_v2_h2a_require_admin();
  elsif p_actor_type='partner' then
    v_partner_access:=public.hotel_v2_h3_2b_access_snapshot(
      p_partner_id,p_hotel_id,'manage_availability');
    v_assignment:=(v_partner_access->>'assignment_id')::uuid;
    v_permission:=(v_partner_access->>'permission_version')::bigint;
    v_access:=public.hotel_v2_external_calendar_worker_hash(v_partner_access);
  else raise exception using errcode='42501',message='hotels_v2_external_calendar_access_denied'; end if;
  if (select count(*) from public.site_settings)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_settings_cardinality'; end if;
  if (select count(*) from public.hotel_room_types room where room.hotel_id=p_hotel_id)>1000
     or (select count(*) from public.hotel_calendar_source_configs source
       where source.hotel_id=p_hotel_id and source.source_type='ical')>5000
     or (select count(*) from hotels_v2_private.hotel_external_calendar_day_blocks block
       join public.hotel_calendar_source_configs source on source.id=block.source_id
       where block.hotel_id=p_hotel_id and block.is_active and source.source_type='ical'
         and source.is_enabled and source.review_status='reviewed')>310000 then
    raise exception using errcode='54000',message='hotels_v2_external_calendar_control_limit_exceeded'; end if;
  select coalesce(jsonb_agg(public.hotel_v2_external_calendar_source_projection(source.id)
    order by source.room_type_id,source.priority desc,source.code,source.id),'[]'::jsonb)
    into v_sources from public.hotel_calendar_source_configs source
    where source.hotel_id=p_hotel_id and source.source_type='ical';
  v_token:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object('hotel_id',p_hotel_id,
    'hotel_external_sync_enabled',(select hotel_external_sync_enabled from public.site_settings where id=1),
    'rooms',coalesce((select jsonb_agg(jsonb_build_array(room.id,room.status,room.version)
      order by room.id) from public.hotel_room_types room where room.hotel_id=p_hotel_id),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(jsonb_build_array(source.id,source.room_type_id,
      source.code,source.source_type,source.configuration,source.is_enabled,source.review_status,
      source.priority,source.version,source.updated_at,binding.version,binding.url_fingerprint)
      order by source.id) from public.hotel_calendar_source_configs source
      left join hotels_v2_private.hotel_external_calendar_source_secrets binding on binding.source_id=source.id
      where source.hotel_id=p_hotel_id and source.source_type='ical'),'[]'::jsonb),
    'effective_external_blocks',coalesce((select jsonb_agg(jsonb_build_array(
      effective.room_type_id,effective.stay_date,effective.units_blocked)
      order by effective.room_type_id,effective.stay_date) from(
        select block.room_type_id,block.stay_date,least(sum(block.units_blocked)::integer,
          case when room.inventory_mode='unitized' then (select count(*)::integer
            from public.hotel_units unit where unit.room_type_id=room.id and unit.status='active')
          else room.base_inventory_count end) units_blocked
        from hotels_v2_private.hotel_external_calendar_day_blocks block
        join public.hotel_calendar_source_configs source on source.id=block.source_id
          and source.hotel_id=block.hotel_id and source.room_type_id=block.room_type_id
          and source.source_type='ical' and source.is_enabled and source.review_status='reviewed'
        join public.hotel_room_types room on room.id=block.room_type_id and room.hotel_id=block.hotel_id
        where block.hotel_id=p_hotel_id and block.is_active
        group by block.room_type_id,block.stay_date,room.id,room.inventory_mode,room.base_inventory_count
      ) effective),'[]'::jsonb)));
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_control_v1',
    'hotel_id',p_hotel_id,'partner_id',p_partner_id,'assignment_id',v_assignment,
    'permission_version',v_permission,'access_snapshot_token',v_access,'snapshot_token',v_token,
    'hotel_external_sync_enabled',(select hotel_external_sync_enabled from public.site_settings where id=1),
    'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',room.id,'name_i18n',room.name_i18n,
      'status',room.status,'version',room.version) order by room.sort_order,room.id)
      from public.hotel_room_types room where room.hotel_id=p_hotel_id),'[]'::jsonb),
    'sources',v_sources,'public_change',false);
end
$function$;

create function public.hotel_v2_admin_get_external_calendar_control(p_hotel_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,auth
as $$select public.hotel_v2_external_calendar_control_common('admin',null,p_hotel_id)$$;
create function public.hotel_v2_partner_get_external_calendar_control(p_partner_id uuid,p_hotel_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,auth
as $$select public.hotel_v2_external_calendar_control_common('partner',p_partner_id,p_hotel_id)$$;

create function public.hotel_v2_external_calendar_reason_valid(p_reason jsonb)
returns boolean language sql immutable set search_path=pg_catalog
as $$select coalesce(jsonb_typeof(p_reason)='string' and p_reason#>>'{}'=btrim(p_reason#>>'{}')
  and length(p_reason#>>'{}') between 3 and 500 and (p_reason#>>'{}')!~'[[:cntrl:]]',false)$$;

create function public.hotel_v2_external_calendar_preview_common(p_actor_type text,p_draft jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth
as $function$
declare v_actor uuid:=auth.uid(); v_hotel uuid; v_partner uuid; v_control jsonb; v_intent jsonb;
  v_entity text; v_action text; v_id uuid; v_expected bigint; v_payload jsonb; v_reason text;
  v_original jsonb; v_after jsonb; v_operation jsonb; v_impact jsonb; v_plan jsonb;
  v_review uuid:=gen_random_uuid(); v_reviewed timestamptz:=clock_timestamp();
  v_expires timestamptz:=clock_timestamp()+interval '30 minutes'; v_fingerprint text;
  v_changed boolean:=true; v_source public.hotel_calendar_source_configs%rowtype;
  v_url_fingerprint text; v_fields jsonb; v_access text; v_assignment uuid; v_permission bigint;
  v_impact_before jsonb; v_impact_after jsonb;
begin
  if v_actor is null or p_draft is null or jsonb_typeof(p_draft)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_draft,array['contract_version','hotel_id','partner_id',
       'assignment_id','permission_version','access_snapshot_token','snapshot_token','intent'])
     or not (p_draft?&array['contract_version','hotel_id','partner_id','assignment_id',
       'permission_version','access_snapshot_token','snapshot_token','intent'])
     or p_draft->>'contract_version'<>'hotels_v2_external_calendar_draft_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_draft)
     or jsonb_typeof(p_draft->'intent')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_draft'; end if;
  v_hotel:=(p_draft->>'hotel_id')::uuid;
  v_partner:=case when p_draft->>'partner_id' is null then null else (p_draft->>'partner_id')::uuid end;
  v_control:=public.hotel_v2_external_calendar_control_common(p_actor_type,v_partner,v_hotel);
  if p_draft->>'snapshot_token' is distinct from v_control->>'snapshot_token'
     or p_draft->'partner_id' is distinct from v_control->'partner_id'
     or p_draft->'assignment_id' is distinct from v_control->'assignment_id'
     or p_draft->'permission_version' is distinct from v_control->'permission_version'
     or p_draft->'access_snapshot_token' is distinct from v_control->'access_snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_stale_snapshot'; end if;
  v_assignment:=case when v_control->>'assignment_id' is null then null else (v_control->>'assignment_id')::uuid end;
  v_permission:=case when v_control->>'permission_version' is null then null else (v_control->>'permission_version')::bigint end;
  v_access:=v_control->>'access_snapshot_token'; v_intent:=p_draft->'intent';
  if not public.hotel_v2_h2a_keys_allowed(v_intent,array['entity','action','id','expected_version','payload','reason'])
     or not (v_intent?&array['entity','action','id','expected_version','payload','reason'])
     or not public.hotel_v2_external_calendar_reason_valid(v_intent->'reason')
     or jsonb_typeof(v_intent->'payload')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_intent'; end if;
  v_entity:=v_intent->>'entity';v_action:=v_intent->>'action';
  v_id:=case when v_intent->>'id' is null then null else (v_intent->>'id')::uuid end;
  if jsonb_typeof(v_intent->'expected_version')<>'number'
     or v_intent->>'expected_version'!~'^(0|[1-9][0-9]*)$' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_expected_version'; end if;
  v_expected:=(v_intent->>'expected_version')::bigint;v_payload:=v_intent->'payload';v_reason:=v_intent->>'reason';
  if v_entity='calendar_source' and v_action='create' then
    if v_id is not null then raise exception using errcode='22023',message='hotels_v2_external_calendar_create_id_must_be_null'; end if;
    v_id:=gen_random_uuid();
  elsif v_id is null then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_target_id_required';
  end if;

  if v_entity='calendar_source' and v_action in('create','update') then
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array['room_type_id','code','sync_interval_minutes','units_per_event','priority'])
       or not (v_payload?&array['room_type_id','code','sync_interval_minutes','units_per_event','priority'])
       or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_payload)
       or jsonb_typeof(v_payload->'code')<>'string' or v_payload->>'code'!~'^[a-z0-9][a-z0-9_-]{0,79}$'
       or jsonb_typeof(v_payload->'sync_interval_minutes')<>'number'
       or v_payload->>'sync_interval_minutes'!~'^[1-9][0-9]*$'
       or (v_payload->>'sync_interval_minutes')::integer not between 15 and 1440
       or jsonb_typeof(v_payload->'units_per_event')<>'number'
       or v_payload->>'units_per_event'!~'^[1-9][0-9]*$'
       or (v_payload->>'units_per_event')::integer not between 1 and 100
       or jsonb_typeof(v_payload->'priority')<>'number' or v_payload->>'priority'!~'^-?[0-9]+$'
       or (v_payload->>'priority')::integer not between -32768 and 32767
       or not exists(select 1 from public.hotel_room_types room
         where room.id=(v_payload->>'room_type_id')::uuid and room.hotel_id=v_hotel and room.status='active'
           and (v_payload->>'units_per_event')::integer<=case when room.inventory_mode='unitized'
             then (select count(*)::integer from public.hotel_units unit
               where unit.room_type_id=room.id and unit.status='active') else room.base_inventory_count end) then
      raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_source_payload'; end if;
    select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel;
    if v_action='create' then
      if found or v_expected<>0 then raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_exists'; end if;
      if exists(select 1 from public.hotel_calendar_source_configs where hotel_id=v_hotel and code=v_payload->>'code') then
        raise exception using errcode='23505',message='hotels_v2_external_calendar_source_code_conflict'; end if;
      v_original:=null;
      v_after:=jsonb_build_object('id',v_id,'hotel_id',v_hotel,'room_type_id',v_payload->'room_type_id',
        'code',v_payload->'code','source_type','ical','is_enabled',false,'review_status','reviewed',
        'priority',v_payload->'priority','version',1,'secret_configured',false,'binding_version',null,
        'sync_interval_minutes',v_payload->'sync_interval_minutes','units_per_event',v_payload->'units_per_event');
    else
      if not found or v_source.source_type<>'ical' then raise exception using errcode='PT404',message='hotels_v2_external_calendar_source_not_found'; end if;
      if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
          where job.source_id=v_id and job.status in('queued','leased','running')) then
        raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_sync_in_progress'; end if;
      if v_source.version<>v_expected then
        raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
      if v_source.room_type_id<>(v_payload->>'room_type_id')::uuid and (v_source.is_enabled
         or exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id)
         or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_runs where source_id=v_id)
         or exists(select 1 from hotels_v2_private.hotel_external_calendar_events where source_id=v_id)) then
        raise exception using errcode='23514',message='hotels_v2_external_calendar_source_mapping_not_changeable'; end if;
      v_original:=public.hotel_v2_external_calendar_source_projection(v_id);
      v_after:=v_original||jsonb_build_object('room_type_id',v_payload->'room_type_id',
        'code',v_payload->'code','priority',v_payload->'priority',
        'sync_interval_minutes',v_payload->'sync_interval_minutes','units_per_event',v_payload->'units_per_event',
        'version',v_expected+1);
      v_changed:=v_source.room_type_id<>(v_payload->>'room_type_id')::uuid
        or v_source.code<>v_payload->>'code' or v_source.priority<>(v_payload->>'priority')::smallint
        or coalesce((v_source.configuration->>'sync_interval_minutes')::integer,60)<>(v_payload->>'sync_interval_minutes')::integer
        or coalesce((v_source.configuration->>'units_per_event')::integer,1)<>(v_payload->>'units_per_event')::integer;
    end if;
  elsif v_entity='calendar_source' and v_action in('enable','disable') then
    if v_payload<>'{}'::jsonb then raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_source_payload'; end if;
    select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel;
    if not found or v_source.source_type<>'ical' then raise exception using errcode='PT404',message='hotels_v2_external_calendar_source_not_found'; end if;
    if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
        where job.source_id=v_id and job.status in('queued','leased','running')) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_sync_in_progress'; end if;
    if v_source.version<>v_expected then raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    v_original:=public.hotel_v2_external_calendar_source_projection(v_id);
    if v_action='enable' then
      if not (v_control->>'hotel_external_sync_enabled')::boolean then
        return jsonb_build_object('contract_version','hotels_v2_external_calendar_preview_v1',
          'hotel_id',v_hotel,'partner_id',v_partner,'changed',false,
          'blocking_reasons','["external_calendar_not_activated"]'::jsonb,'impacts','[]'::jsonb,'reviewed_plan',null);
      end if;
      if not exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id) then
        raise exception using errcode='23514',message='hotels_v2_external_calendar_secret_required'; end if;
      if exists(select 1 from public.hotel_calendar_source_configs other where other.hotel_id=v_hotel
          and other.room_type_id=v_source.room_type_id and other.is_enabled and other.id<>v_id) then
        raise exception using errcode='23505',message='hotels_v2_external_calendar_room_source_conflict'; end if;
      v_changed:=not v_source.is_enabled; v_after:=v_original||jsonb_build_object('is_enabled',true,'version',v_expected+1);
    else v_changed:=v_source.is_enabled; v_after:=v_original||jsonb_build_object('is_enabled',false,'version',v_expected+1); end if;
  elsif v_entity='ical_secret' and v_action in('set','rotate','clear') then
    if (v_action in('set','rotate') and (not public.hotel_v2_h2a_keys_allowed(v_payload,array['source_id','ical_url'])
       or not (v_payload?&array['source_id','ical_url']) or (v_payload->>'source_id')::uuid<>v_id
       or jsonb_typeof(v_payload->'ical_url')<>'string' or length(btrim(v_payload->>'ical_url')) not between 12 and 4096
       or btrim(v_payload->>'ical_url')!~'^https://[^[:space:][:cntrl:]]+$'))
       or (v_action='clear' and (v_payload<>jsonb_build_object('source_id',v_id))) then
      raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_secret_payload'; end if;
    select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel;
    if not found or v_source.source_type<>'ical' or v_source.is_enabled then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_secret_source_stale'; end if;
    if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
        where job.source_id=v_id and job.status in('queued','leased','running')) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_sync_in_progress'; end if;
    v_original:=jsonb_build_object('secret_configured',exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id),
      'binding_version',(select version from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id));
    if v_expected<>coalesce((v_original->>'binding_version')::bigint,0) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_binding_stale'; end if;
    if v_action='set' and (v_original->>'secret_configured')::boolean
       or v_action in('rotate','clear') and not (v_original->>'secret_configured')::boolean then
      raise exception using errcode='23514',message='hotels_v2_external_calendar_secret_action_mismatch'; end if;
    if v_action='clear' then
      v_payload:=jsonb_build_object('source_id',v_id,'secret_configured',false);
      v_after:=jsonb_build_object('secret_configured',false,'binding_version',null);
    else
      v_url_fingerprint:=encode(extensions.digest(convert_to(btrim(v_payload->>'ical_url'),'UTF8'),'sha256'),'hex');
      v_payload:=jsonb_build_object('source_id',v_id,'url_fingerprint',v_url_fingerprint,'secret_configured',true);
      v_after:=jsonb_build_object('secret_configured',true,'binding_version',coalesce((v_original->>'binding_version')::bigint,0)+1);
    end if;
  elsif v_entity='calendar_sync' and v_action='trigger' then
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array['source_id'])
       or not (v_payload?&array['source_id']) or (v_payload->>'source_id')::uuid<>v_id then
      raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_trigger_payload'; end if;
    select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel;
    if not found or v_source.source_type<>'ical' or not v_source.is_enabled
       or not (v_control->>'hotel_external_sync_enabled')::boolean then
      raise exception using errcode='23514',message='hotels_v2_external_calendar_source_not_triggerable'; end if;
    if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
        where job.source_id=v_id and job.status in('queued','leased','running')) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_sync_already_queued'; end if;
    v_original:=public.hotel_v2_external_calendar_source_projection(v_id);
    if v_expected<>coalesce((v_original#>>'{health,state_version}')::bigint,0) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_state_stale'; end if;
    v_after:=jsonb_build_object('queued',true);
  else raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_operation'; end if;

  if not v_changed then return jsonb_build_object('contract_version','hotels_v2_external_calendar_preview_v1',
    'hotel_id',v_hotel,'partner_id',v_partner,'changed',false,'blocking_reasons','[]'::jsonb,
    'impacts','[]'::jsonb,'reviewed_plan',null); end if;
  v_fields:=case when v_entity='calendar_source' and v_action in('create','update')
      then '["code","priority","room_type_id","sync_interval_minutes","units_per_event"]'::jsonb
    when v_entity='calendar_source' then '["is_enabled"]'::jsonb
    when v_entity='ical_secret' then '["secret_configured"]'::jsonb
    else '["queued"]'::jsonb end;
  select case when v_original is null then null else coalesce(jsonb_object_agg(field.value,
      case when field.value='queued' then 'false'::jsonb else v_original->field.value end
      order by field.value),'{}'::jsonb) end into v_impact_before
    from jsonb_array_elements_text(v_fields) field(value);
  select coalesce(jsonb_object_agg(field.value,v_after->field.value order by field.value),'{}'::jsonb)
    into v_impact_after from jsonb_array_elements_text(v_fields) field(value);
  v_operation:=jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,
    'expected_version',v_expected,'expected_original',v_original,'payload',v_payload,'reason',v_reason);
  v_impact:=jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,'changed',true,
    'fields',v_fields,'before',v_impact_before,'after',v_impact_after,
    'affected_room_type_ids',case
      when v_entity='calendar_source' and v_action='update' then
        (select jsonb_agg(room_id order by room_id) from (select distinct room_id from (values
          (v_source.room_type_id),((v_payload->>'room_type_id')::uuid)) rooms(room_id)
          where room_id is not null) affected)
      when v_source.room_type_id is not null then jsonb_build_array(v_source.room_type_id)
      when v_payload->>'room_type_id' is not null then jsonb_build_array(v_payload->'room_type_id')
      else '[]'::jsonb end,
    'from',null,'to',null);
  v_plan:=jsonb_build_object('contract_version','hotels_v2_external_calendar_plan_v1','review_id',v_review,
    'actor_type',p_actor_type,'partner_id',v_partner,'hotel_id',v_hotel,'assignment_id',v_assignment,
    'permission_version',v_permission,'access_snapshot_token',v_access,
    'snapshot_token',v_control->>'snapshot_token','reviewed_at',v_reviewed,'expires_at',v_expires,
    'operations',jsonb_build_array(v_operation));
  v_fingerprint:=public.hotel_v2_external_calendar_worker_hash(v_plan);
  v_plan:=v_plan||jsonb_build_object('plan_fingerprint',v_fingerprint);
  insert into hotels_v2_private.hotel_external_calendar_plan_reviews(id,actor_type,actor_id,partner_id,
    hotel_id,assignment_id,permission_version,access_snapshot_token,snapshot_token,reviewed_plan,
    plan_fingerprint,expires_at) values(v_review,p_actor_type,v_actor,v_partner,v_hotel,v_assignment,
    v_permission,v_access,v_control->>'snapshot_token',v_plan,v_fingerprint,v_expires);
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_preview_v1',
    'hotel_id',v_hotel,'partner_id',v_partner,'changed',true,'blocking_reasons','[]'::jsonb,
    'impacts',jsonb_build_array(v_impact),'reviewed_plan',v_plan);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_draft';
end
$function$;

create function public.hotel_v2_admin_preview_external_calendar_plan(p_draft jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  return public.hotel_v2_external_calendar_preview_common('admin',p_draft);
end
$function$;
create function public.hotel_v2_partner_preview_external_calendar_plan(p_draft jsonb)
returns jsonb language sql security definer set search_path=pg_catalog,public,auth
as $$select public.hotel_v2_external_calendar_preview_common('partner',p_draft)$$;

-- Exact Vault writer used only after a stored Review has bound the URL hash.
create function public.hotel_v2_external_calendar_set_secret_internal(
  p_source_id uuid,p_expected_binding_version bigint,p_url text,p_url_fingerprint text
) returns bigint language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;
  v_source public.hotel_calendar_source_configs%rowtype; v_secret uuid; v_name text; v_description text; v_key uuid;
begin
  if encode(extensions.digest(convert_to(btrim(p_url),'UTF8'),'sha256'),'hex')<>p_url_fingerprint then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_secret_hash_mismatch'; end if;
  select * into strict v_source from public.hotel_calendar_source_configs where id=p_source_id for update;
  if v_source.is_enabled or v_source.source_type<>'ical' then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_source_not_bindable'; end if;
  select * into v_binding from hotels_v2_private.hotel_external_calendar_source_secrets
    where source_id=p_source_id for update;
  if not found then
    if p_expected_binding_version<>0 then raise exception using errcode='PT409',message='hotels_v2_external_calendar_binding_stale'; end if;
    select vault.create_secret(btrim(p_url),'hotel-calendar-source-'||p_source_id||'-'||gen_random_uuid(),
      'Hotels V2 iCal source '||p_source_id,null) into v_secret;
    insert into hotels_v2_private.hotel_external_calendar_source_secrets(source_id,hotel_id,room_type_id,
      vault_secret_id,secret_kind,url_fingerprint) values(p_source_id,v_source.hotel_id,v_source.room_type_id,
      v_secret,'ical_url',p_url_fingerprint) returning version into p_expected_binding_version;
  else
    if v_binding.version<>p_expected_binding_version then raise exception using errcode='PT409',message='hotels_v2_external_calendar_binding_stale'; end if;
    select name,description,key_id into strict v_name,v_description,v_key from vault.secrets where id=v_binding.vault_secret_id;
    perform vault.update_secret(v_binding.vault_secret_id,btrim(p_url),v_name,v_description,v_key);
    update hotels_v2_private.hotel_external_calendar_source_secrets set version=version+1,
      url_fingerprint=p_url_fingerprint,updated_at=clock_timestamp() where source_id=p_source_id
      returning version into p_expected_binding_version;
  end if;
  return p_expected_binding_version;
end
$function$;

create function public.hotel_v2_external_calendar_apply_common(
  p_actor_type text,p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid,p_ical_url text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth
as $function$
declare v_actor uuid:=auth.uid(); v_review hotels_v2_private.hotel_external_calendar_plan_reviews%rowtype;
  v_hash text; v_request_hash text; v_operation jsonb; v_hotel uuid; v_partner uuid;
  v_control jsonb; v_before jsonb; v_after jsonb; v_source public.hotel_calendar_source_configs%rowtype;
  v_entity text;v_action text;v_id uuid;v_expected bigint;v_payload jsonb;v_activity jsonb;v_result jsonb;
  v_receipt jsonb; v_binding_version bigint; v_ledger_action text;
begin
  if v_actor is null or p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>'object'
     or p_correlation_id is null or p_idempotency_key is null
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan)
     or ((p_reviewed_plan#>>'{operations,0,entity}') is distinct from 'ical_secret'
        and p_ical_url is not null) then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_apply'; end if;
  v_request_hash:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'reviewed_plan',p_reviewed_plan,'url_fingerprint',case when p_ical_url is null then null
      else encode(extensions.digest(convert_to(btrim(p_ical_url),'UTF8'),'sha256'),'hex') end));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-external-calendar-key:'||
    p_actor_type||':'||v_actor::text||':'||p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-external-calendar:'||p_correlation_id,0));
  select result into v_receipt from hotels_v2_private.hotel_external_calendar_admin_receipts
    where p_actor_type='admin' and actor_id=v_actor and idempotency_key=p_idempotency_key;
  if v_receipt is null and p_actor_type='partner' then select receipt.result into v_receipt
    from public.hotel_partner_action_receipts receipt where receipt.actor_user_id=v_actor
      and receipt.partner_id=(p_reviewed_plan->>'partner_id')::uuid
      and receipt.action='h3_2d_external_calendar' and receipt.idempotency_key=p_idempotency_key; end if;
  if v_receipt is not null then
    if v_receipt->>'request_hash'<>v_request_hash or (v_receipt->>'correlation_id')::uuid<>p_correlation_id then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_idempotency_conflict'; end if;
    v_hotel:=(v_receipt->>'hotel_id')::uuid;v_partner:=case when v_receipt->>'partner_id' is null then null else (v_receipt->>'partner_id')::uuid end;
    v_control:=public.hotel_v2_external_calendar_control_common(p_actor_type,v_partner,v_hotel);
    return (v_receipt-'request_hash')||jsonb_build_object('replayed',true,'control',v_control);
  end if;
  if exists(select 1 from hotels_v2_private.hotel_external_calendar_correlations where correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log activity where activity.correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_partner_action_receipts receipt where receipt.correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_correlation_conflict'; end if;
  select * into v_review from hotels_v2_private.hotel_external_calendar_plan_reviews
    where id=(p_reviewed_plan->>'review_id')::uuid for update;
  if not found or v_review.actor_type<>p_actor_type or v_review.actor_id<>v_actor
     or v_review.reviewed_plan is distinct from p_reviewed_plan or v_review.expires_at<=clock_timestamp()
     or v_review.consumed_at is not null then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_review_stale'; end if;
  v_hash:=public.hotel_v2_external_calendar_worker_hash(p_reviewed_plan-'plan_fingerprint');
  if v_hash<>p_reviewed_plan->>'plan_fingerprint' or v_hash<>v_review.plan_fingerprint then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_plan_mismatch'; end if;
  v_hotel:=v_review.hotel_id;v_partner:=v_review.partner_id;
  perform 1 from public.hotels where id=v_hotel for update;
  v_control:=public.hotel_v2_external_calendar_control_common(p_actor_type,v_partner,v_hotel);
  if v_control->>'snapshot_token'<>v_review.snapshot_token
     or v_control->>'access_snapshot_token' is distinct from v_review.access_snapshot_token
     or (case when v_control->>'permission_version' is null then null
       else (v_control->>'permission_version')::bigint end) is distinct from v_review.permission_version then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_stale_snapshot'; end if;
  v_operation:=p_reviewed_plan#>'{operations,0}';v_entity:=v_operation->>'entity';v_action:=v_operation->>'action';
  v_id:=(v_operation->>'id')::uuid;v_expected:=(v_operation->>'expected_version')::bigint;v_payload:=v_operation->'payload';
  if jsonb_array_length(p_reviewed_plan->'operations')<>1 then raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_apply'; end if;
  select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel for update;
  v_before:=case when found then public.hotel_v2_external_calendar_source_projection(v_id) else null end;
  if v_entity='calendar_source' and v_action='create' then
    if v_before is not null or v_expected<>0 then raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    perform set_config('hotels_v2.external_calendar_apply_context',p_correlation_id::text,true);
    perform set_config('hotels_v2.external_calendar_apply_action','create',true);
    insert into public.hotel_calendar_source_configs(id,hotel_id,room_type_id,code,source_type,configuration,
      is_enabled,review_status,priority,version) values(v_id,v_hotel,(v_payload->>'room_type_id')::uuid,
      v_payload->>'code','ical',jsonb_build_object('sync_interval_minutes',v_payload->'sync_interval_minutes',
        'units_per_event',v_payload->'units_per_event'),false,'reviewed',(v_payload->>'priority')::smallint,1);
  elsif v_entity='calendar_source' and v_action='update' then
    if v_before is distinct from v_operation->'expected_original' or v_source.version<>v_expected then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    perform set_config('hotels_v2.external_calendar_apply_context',p_correlation_id::text,true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs set room_type_id=(v_payload->>'room_type_id')::uuid,code=v_payload->>'code',
      configuration=jsonb_build_object('sync_interval_minutes',v_payload->'sync_interval_minutes',
        'units_per_event',v_payload->'units_per_event'),priority=(v_payload->>'priority')::smallint,
      version=version+1,updated_at=clock_timestamp() where id=v_id;
  elsif v_entity='calendar_source' and v_action in('enable','disable') then
    if v_before is distinct from v_operation->'expected_original' or v_source.version<>v_expected then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    perform set_config('hotels_v2.external_calendar_apply_context',p_correlation_id::text,true);
    perform set_config('hotels_v2.external_calendar_apply_action',v_action,true);
    update public.hotel_calendar_source_configs set is_enabled=(v_action='enable'),version=version+1,
      updated_at=clock_timestamp() where id=v_id;
  elsif v_entity='ical_secret' and v_action in('set','rotate','clear') then
    if v_source.id is null or v_source.is_enabled
       or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
         where job.source_id=v_id and job.status in('queued','leased','running')) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_secret_source_stale'; end if;
    if v_action='clear' then
      if p_ical_url is not null then raise exception using errcode='22023',message='hotels_v2_external_calendar_unexpected_secret_url'; end if;
      if (select jsonb_build_object('secret_configured',true,'binding_version',binding.version)
          from hotels_v2_private.hotel_external_calendar_source_secrets binding where binding.source_id=v_id)
          is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_external_calendar_binding_stale'; end if;
      delete from vault.secrets secret using hotels_v2_private.hotel_external_calendar_source_secrets binding
        where binding.source_id=v_id and secret.id=binding.vault_secret_id;
      if not found then raise exception using errcode='55000',message='hotels_v2_external_calendar_vault_secret_missing'; end if;
      delete from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id;
      v_binding_version:=null;
    else
      if p_ical_url is null then raise exception using errcode='22023',message='hotels_v2_external_calendar_secret_url_required'; end if;
      v_binding_version:=public.hotel_v2_external_calendar_set_secret_internal(v_id,
        coalesce((v_operation#>>'{expected_original,binding_version}')::bigint,0),p_ical_url,v_payload->>'url_fingerprint');
    end if;
  elsif v_entity='calendar_sync' and v_action='trigger' then
    if p_ical_url is not null or v_before is distinct from v_operation->'expected_original'
       or v_expected<>coalesce((v_before#>>'{health,state_version}')::bigint,0) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    select version into strict v_binding_version from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id;
    insert into hotels_v2_private.hotel_external_calendar_sync_jobs(id,source_id,hotel_id,room_type_id,
      trigger_type,source_version,binding_version,created_by_type,created_by,correlation_id)
    values(gen_random_uuid(),v_id,v_hotel,v_source.room_type_id,'manual',v_source.version,
      v_binding_version,p_actor_type,v_actor,p_correlation_id);
  else raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_apply'; end if;
  if v_entity<>'ical_secret' and p_ical_url is not null then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_unexpected_secret_url'; end if;
  v_after:=case when v_entity='calendar_sync' then jsonb_build_object('queued',true)
    when v_entity='ical_secret' then jsonb_build_object('secret_configured',v_action<>'clear','binding_version',v_binding_version)
    else public.hotel_v2_external_calendar_source_projection(v_id) end;
  v_ledger_action:=case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end;
  insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,
    actor_type,actor_id,source,correlation_id) values(v_hotel,'calendar_source',v_id,v_ledger_action,
    nullif(v_operation->'expected_original','null'::jsonb),v_after,p_actor_type,v_actor,
    'hotels_v2_external_calendar_control',p_correlation_id)
    returning jsonb_build_object('id',id,'hotel_id',hotel_id,'entity_type',entity_type,'entity_id',entity_id,
      'action',action,'actor_type',actor_type,'source',source,'correlation_id',correlation_id,'created_at',created_at)
      into v_activity;
  update hotels_v2_private.hotel_external_calendar_plan_reviews set consumed_at=clock_timestamp(),
    consumed_correlation_id=p_correlation_id where id=v_review.id;
  insert into hotels_v2_private.hotel_external_calendar_correlations values(
    p_correlation_id,p_actor_type,v_actor,p_idempotency_key,v_request_hash);
  v_result:=jsonb_build_object('contract_version','hotels_v2_external_calendar_apply_result_v1',
    'hotel_id',v_hotel,'partner_id',v_partner,'correlation_id',p_correlation_id,
    'idempotency_key',p_idempotency_key,'replayed',false,'changed',true,
    'activity',jsonb_build_array(v_activity),'request_hash',v_request_hash);
  if p_actor_type='admin' then insert into hotels_v2_private.hotel_external_calendar_admin_receipts(
    actor_id,hotel_id,idempotency_key,correlation_id,request_hash,result)
    values(v_actor,v_hotel,p_idempotency_key,p_correlation_id,v_request_hash,v_result);
  else insert into public.hotel_partner_action_receipts(partner_id,hotel_id,actor_user_id,action,
    idempotency_key,request_hash,correlation_id,result) values(v_partner,v_hotel,v_actor,
      'h3_2d_external_calendar',p_idempotency_key,v_request_hash,p_correlation_id,v_result); end if;
  v_control:=public.hotel_v2_external_calendar_control_common(p_actor_type,v_partner,v_hotel);
  return (v_result-'request_hash')||jsonb_build_object('control',v_control);
exception when unique_violation then
  raise exception using errcode='PT409',message='hotels_v2_external_calendar_apply_conflict';
end
$function$;

create function public.hotel_v2_admin_apply_external_calendar_plan(p_reviewed_plan jsonb,
  p_correlation_id uuid,p_idempotency_key uuid,p_ical_url text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  return public.hotel_v2_external_calendar_apply_common(
    'admin',p_reviewed_plan,p_correlation_id,p_idempotency_key,p_ical_url);
end
$function$;
create function public.hotel_v2_partner_apply_external_calendar_plan(p_reviewed_plan jsonb,
  p_correlation_id uuid,p_idempotency_key uuid,p_ical_url text default null)
returns jsonb language sql security definer set search_path=pg_catalog,public,auth
as $$select public.hotel_v2_external_calendar_apply_common('partner',p_reviewed_plan,p_correlation_id,p_idempotency_key,p_ical_url)$$;

do $security$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.hotel_v2_admin_get_external_calendar_control(uuid)',
    'public.hotel_v2_admin_preview_external_calendar_plan(jsonb)',
    'public.hotel_v2_admin_apply_external_calendar_plan(jsonb,uuid,uuid,text)',
    'public.hotel_v2_partner_get_external_calendar_control(uuid,uuid)',
    'public.hotel_v2_partner_preview_external_calendar_plan(jsonb)',
    'public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)'] loop
    execute format('alter function %s owner to postgres',v_signature::regprocedure);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',v_signature::regprocedure);
    execute format('grant execute on function %s to authenticated',v_signature::regprocedure);
  end loop;
  foreach v_signature in array array[
    'public.hotel_v2_external_calendar_protected_fingerprints()',
    'public.hotel_v2_external_calendar_guard_review()',
    'public.hotel_v2_external_calendar_guard_source()',
    'public.hotel_v2_external_calendar_guard_room_unit_capacity()',
    'public.hotel_v2_external_calendar_source_projection(uuid)',
    'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
    'public.hotel_v2_external_calendar_reason_valid(jsonb)',
    'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
    'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
    'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)'] loop
    execute format('alter function %s owner to postgres',v_signature::regprocedure);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',v_signature::regprocedure);
  end loop;
  alter table hotels_v2_private.hotel_external_calendar_plan_reviews owner to postgres;
  alter table hotels_v2_private.hotel_external_calendar_admin_receipts owner to postgres;
  alter table hotels_v2_private.hotel_external_calendar_correlations owner to postgres;
  alter table hotels_v2_private.hotel_external_calendar_foundation_receipts owner to postgres;
end
$security$;

do $postconditions$
begin
  if exists(select 1 from (values
      ('public.hotel_v2_admin_get_external_calendar_control(uuid)'),
      ('public.hotel_v2_admin_preview_external_calendar_plan(jsonb)'),
      ('public.hotel_v2_admin_apply_external_calendar_plan(jsonb,uuid,uuid,text)'),
      ('public.hotel_v2_partner_get_external_calendar_control(uuid,uuid)'),
      ('public.hotel_v2_partner_preview_external_calendar_plan(jsonb)'),
      ('public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)')) expected(signature)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole or not procedure.prosecdef
      or procedure.proconfig is distinct from array['search_path=pg_catalog, public, auth']::text[]
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE')
      or not has_function_privilege('authenticated',procedure.oid,'EXECUTE')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_control_rpc_security_mismatch';
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_guard_review()',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_guard_source()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_guard_room_unit_capacity()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_source_projection(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_external_calendar_reason_valid(jsonb)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_external_calendar_preview_common(text,jsonb)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',true,array['search_path=pg_catalog, public, auth']::text[])
    ) expected(signature,security_definer,configuration)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole
      or procedure.prosecdef is distinct from expected.security_definer
      or procedure.proconfig is distinct from expected.configuration
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_control_internal_security_mismatch';
  end if;
  if exists(select 1 from public.site_settings where hotel_rooms_v2_enabled or hotel_external_sync_enabled
      or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_control_changed_flags'; end if;
  if has_function_privilege(0::oid,
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)','EXECUTE')
     or has_function_privilege(0::oid,
       'public.hotel_v2_admin_get_external_calendar_status(uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_legacy_rpc_not_retired';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.hotel_room_types'::regclass
       and tgname='hotel_room_types_external_calendar_capacity_guard' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid='public.hotel_units'::regclass
       and tgname='hotel_units_external_calendar_capacity_guard' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid='public.hotel_calendar_source_configs'::regclass
       and tgname='hotel_calendar_source_configs_external_guard' and not tgisinternal) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_control_trigger_mismatch';
  end if;
end
$postconditions$;

notify pgrst,'reload schema';
commit;
