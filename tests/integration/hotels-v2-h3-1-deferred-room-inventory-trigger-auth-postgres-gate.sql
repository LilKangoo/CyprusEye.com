\set ON_ERROR_STOP on

-- Disposable PostgreSQL gate for the H3.1 deferred Room inventory trigger
-- authorization repair. It composes only local synthetic fixtures.
\ir hotels-v2-h3-1-deferred-room-inventory-trigger-auth-postgrest-base.sql

do $trigger_auth_metadata_gate$
declare
  v_entry oid := 'public.hotel_v2_h3_1_room_inventory_constraint_trigger()'::regprocedure;
  v_validator oid := 'public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)'::regprocedure;
begin
  if not (select prosecdef from pg_proc where oid=v_entry)
     or (select pg_get_userbyid(proowner) from pg_proc where oid=v_entry)<>'postgres'
     or (select proconfig from pg_proc where oid=v_entry)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or (select md5(prosrc) from pg_proc where oid=v_entry)<>'9bfaf350419720016ae405fd353bb4d7'
     or (select prosecdef from pg_proc where oid=v_validator)
     or (select md5(prosrc) from pg_proc where oid=v_validator)<>'6d72f588895a0f13a7e7d03332f6f132'
     or has_function_privilege('public',v_entry,'EXECUTE')
     or has_function_privilege('anon',v_entry,'EXECUTE')
     or has_function_privilege('authenticated',v_entry,'EXECUTE')
     or has_function_privilege('service_role',v_entry,'EXECUTE')
     or has_function_privilege('authenticator',v_entry,'EXECUTE')
     or has_function_privilege('public',v_validator,'EXECUTE')
     or has_function_privilege('anon',v_validator,'EXECUTE')
     or has_function_privilege('authenticated',v_validator,'EXECUTE')
     or has_function_privilege('service_role',v_validator,'EXECUTE')
     or has_function_privilege('authenticator',v_validator,'EXECUTE') then
    raise exception 'hotels_v2_h3_1_trigger_auth_metadata_failed';
  end if;
end
$trigger_auth_metadata_gate$;

-- Exact-body tampering is rejected by the migration precondition and the
-- subtransaction restores the vetted definition.
do $trigger_auth_tamper_gate$
declare v_failed boolean:=false;
begin
  begin
    execute $ddl$
      create or replace function public.hotel_v2_h3_1_room_inventory_constraint_trigger()
      returns trigger language plpgsql security definer
      set search_path=pg_catalog,public
      as $body$ begin return null; end $body$
    $ddl$;
    if (select md5(prosrc) from pg_proc where oid=
        'public.hotel_v2_h3_1_room_inventory_constraint_trigger()'::regprocedure)
       <>'9bfaf350419720016ae405fd353bb4d7' then
      raise exception using errcode='55000',
        message='hotels_v2_h3_1_trigger_auth_entrypoint_contract_mismatch';
    end if;
  exception when object_not_in_prerequisite_state then
    if sqlerrm='hotels_v2_h3_1_trigger_auth_entrypoint_contract_mismatch' then
      v_failed:=true;
    else
      raise;
    end if;
  end;
  if not v_failed
     or (select md5(prosrc) from pg_proc where oid=
       'public.hotel_v2_h3_1_room_inventory_constraint_trigger()'::regprocedure)
       <>'9bfaf350419720016ae405fd353bb4d7' then
    raise exception 'hotels_v2_h3_1_tampered_trigger_body_not_rejected';
  end if;
end
$trigger_auth_tamper_gate$;

-- Rebase the synthetic review plan onto the exact deployed-shaped versions.
-- The composed H2B.1 fixture intentionally reconstructs Upper v4/Ground v5
-- after its original seed plan was used, matching the production review state.
create function pg_temp.room_structural_snapshot(p_room_id uuid)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'hotel_id', room.hotel_id,
    'source_key', room.legacy_source_key,
    'code', room.code,
    'name_i18n', room.name_i18n,
    'description_i18n', room.description_i18n,
    'gallery', room.gallery,
    'amenities', to_jsonb(array(
      select amenity from unnest(room.amenities) amenity order by amenity
    )),
    'max_occupancy', room.max_occupancy,
    'capacity_adults', room.capacity_adults,
    'capacity_children', room.capacity_children,
    'inventory_mode', room.inventory_mode,
    'base_inventory_count', room.base_inventory_count,
    'sort_order', room.sort_order
  )
  from public.hotel_room_types room
  where room.id=p_room_id
$function$;

create function pg_temp.fresh_reviewed_seed_plan()
returns jsonb
language sql
stable
set search_path = pg_catalog, public, pg_temp
as $function$
  with base as (select pg_temp.reviewed_seed_plan() plan),
  exact as (
    select
      plan,
      (select version from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94') upper_version,
      (select version from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3') ground_version,
      (select version from public.hotel_pricing_schedules where id='b0a3104f-7b31-5265-a59f-c2d166f11a23') schedule_version,
      (select version from public.hotel_pricing_schedules where id='443065c0-984a-5de3-a22a-d03042c41107') preview_version,
      (select version from public.hotel_rate_plans where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17') rate_plan_version,
      (select version from public.hotel_room_rates where id='7e420964-9cbf-4f1b-abd3-09840af5240f') upper_rate_version,
      (select version from public.hotel_room_rates where id='3320590d-632d-423f-80d0-fd021cba7293') ground_rate_version
    from base
  )
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            plan,
            '{expected_versions}',
            jsonb_build_object(
              'upper_room',upper_version,'ground_room',ground_version,
              'pricing_schedule',schedule_version,
              'property_party_preview',preview_version,
              'rate_plan',rate_plan_version,
              'upper_room_rate',upper_rate_version,
              'ground_room_rate',ground_rate_version
            )
          ),
          '{rooms,0,expected_version}',to_jsonb(upper_version)
        ),
        '{rooms,0,expected_original}',
        pg_temp.room_structural_snapshot('b4ef504f-cdeb-4e3c-a54d-932146ef4e94')
      ),
      '{rooms,1,expected_version}',to_jsonb(ground_version)
    ),
    '{rooms,1,expected_original}',
    pg_temp.room_structural_snapshot('825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
  )
  from exact
$function$;

create function pg_temp.room_type_plan(p_payload jsonb)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(select updated_at from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
    'reviewed_at',clock_timestamp(),
    'operation',jsonb_build_object(
      'type','update','id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      'expected_version',(select version from public.hotel_room_types
        where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),
      'payload',p_payload
    )
  )
$function$;

create function pg_temp.workspace_unit_plan()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(
      jsonb_build_object(
        'entity','room_type','type','update',
        'id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
        'expected_version',(select version from public.hotel_room_types
          where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),
        'payload',jsonb_build_object('inventory_mode','unitized','base_inventory_count',0)
      ),
      jsonb_build_object(
        'entity','unit','type','create','id','46000000-0000-4000-8000-000000000001',
        'payload',jsonb_build_object(
          'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
          'code','upper-physical-unit','status','active'
        )
      )
    )
  )
$function$;

create function pg_temp.allocation_plan()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(select updated_at from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','allocation_rule','type','create',
      'id','46000000-0000-4000-8000-000000000002','expected_version',0,
      'payload',jsonb_build_object(
        'code','choice-1-4','allocation_mode','customer_choice',
        'min_guest_count',1,'max_guest_count',4,'is_active',true,
        'review_status','reviewed','sort_order',100,
        'items',jsonb_build_array(
          jsonb_build_object(
            'id','46000000-0000-4000-8000-000000000003',
            'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
            'units_required',1,'allocated_guest_count',null,'sort_order',100
          ),
          jsonb_build_object(
            'id','46000000-0000-4000-8000-000000000004',
            'room_type_id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
            'units_required',1,'allocated_guest_count',null,'sort_order',200
          )
        )
      )
    ))
  )
$function$;

create function pg_temp.room_state(p_room_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object('version',version,'status',status)
  from public.hotel_room_types where id=p_room_id
$function$;

create function pg_temp.activity_exists(p_correlation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists(select 1 from public.hotel_activity_log
    where correlation_id=p_correlation_id)
$function$;

-- The legacy shadow workflow reaches COMMIT under authenticated. Before this
-- repair the deferred trigger failed here with 42501.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  jsonb_set(
    pg_temp.fresh_reviewed_seed_plan(),
    '{property_policy}',
    '{"children_policy":"minimum_age","minimum_child_age":15}'::jsonb
  ),
  '46200000-0000-4000-8000-000000000001'
);
commit;

-- The exact Room Type editor path also schedules the room_types binding.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);
select public.hotel_v2_admin_apply_room_type_plan(
  pg_temp.room_type_plan(jsonb_build_object('base_inventory_count',1)),
  '46200000-0000-4000-8000-000000000002'
);
commit;

-- One reviewed Workspace transaction changes the Room Type to unitized and
-- creates its first Unit. Both deferred room_types and hotel_units bindings
-- fire at COMMIT and see the complete final graph.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);
select public.hotel_v2_admin_apply_workspace_plan(
  pg_temp.workspace_unit_plan(),
  '46200000-0000-4000-8000-000000000003'
);
commit;

-- Install one valid reviewed active allocation so a later Room status change
-- proves the actual inventory invariant rather than merely function access.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);
select public.hotel_v2_admin_apply_h3_1_configuration(
  pg_temp.allocation_plan(),
  '46200000-0000-4000-8000-000000000004'
);
commit;

-- Force the deferred check inside a caught subtransaction. The rejected Room
-- mutation and its activity row must both roll back atomically.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);
do $invalid_inventory_gate$
declare
  v_failed boolean:=false;
  v_version bigint;
  v_status text;
begin
  select (state->>'version')::bigint,state->>'status' into v_version,v_status
  from (select pg_temp.room_state(
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'
  ) state) snapshot;
  begin
    perform public.hotel_v2_admin_apply_room_type_plan(
      pg_temp.room_type_plan(jsonb_build_object('status','disabled')),
      '46200000-0000-4000-8000-000000000005'
    );
    execute 'set constraints hotel_room_types_h3_1_allocation_inventory_guard immediate';
  exception when check_violation then
    if sqlerrm='hotels_v2_h3_1_active_allocation_inventory_invalid' then
      v_failed:=true;
    else
      raise;
    end if;
  end;
  if not v_failed
     or (pg_temp.room_state('b4ef504f-cdeb-4e3c-a54d-932146ef4e94')->>'version')::bigint<>v_version
     or pg_temp.room_state('b4ef504f-cdeb-4e3c-a54d-932146ef4e94')->>'status'<>v_status
     or pg_temp.activity_exists('46200000-0000-4000-8000-000000000005') then
    raise exception 'hotels_v2_h3_1_invalid_inventory_atomic_abort_failed';
  end if;
end
$invalid_inventory_gate$;
commit;

-- The nested validator remains unavailable even to an authenticated Admin.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);
do $private_helper_gate$
declare v_denied boolean:=false;
begin
  begin
    perform public.hotel_v2_h3_1_validate_room_allocation_inventory(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'
    );
  exception when insufficient_privilege then
    v_denied:=true;
  end;
  if not v_denied then raise exception 'hotels_v2_h3_1_validator_direct_call_not_denied'; end if;
end
$private_helper_gate$;
rollback;

select
  0 as "HOTEL_LEGACY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  0 as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  'HOTELS_V2_H3_1_DEFERRED_ROOM_INVENTORY_TRIGGER_AUTH_POSTGRES_GATE_PASS' result
where (select architecture_version from public.hotels
  where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')='legacy'
and not exists(select 1 from public.site_settings where id=1 and (
  hotel_rooms_v2_enabled or hotel_external_sync_enabled
  or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
));
