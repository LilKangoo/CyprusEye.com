\set ON_ERROR_STOP on
\ir hotels-v2-admin-b-content-room-assignment-postgrest-base.sql

create temporary table admin_b_protected_before(
  relation_name text primary key,
  fingerprint text not null
) on commit preserve rows;

do $capture$
declare v_relation text;
begin
  foreach v_relation in array array[
    'hotel_bookings','partner_service_fulfillments',
    'partner_service_fulfillment_form_snapshots','service_deposit_requests',
    'service_deposit_rules','service_deposit_overrides','service_coupons',
    'service_coupon_redemptions','referrals','affiliate_commission_events',
    'affiliate_payouts','affiliate_adjustments','affiliate_program_settings',
    'affiliate_referrer_overrides','affiliate_cashout_requests',
    'profile_referral_code_aliases','site_settings'
  ] loop
    if to_regclass('public.'||v_relation) is not null then
      execute format(
        'insert into admin_b_protected_before select %L,md5(coalesce(string_agg('
        ||'to_jsonb(row_value)::text,''|'' order by to_jsonb(row_value)::text),'''')) '
        ||'from public.%I row_value',v_relation,v_relation
      );
    end if;
  end loop;
end
$capture$;

create function pg_temp.admin_b_property_plan(p_payload jsonb)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  with source as (
    select hotel.*,
      public.hotel_v2_admin_get_content_control(hotel.id) content
    from public.hotels hotel
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  ), original as (
    select coalesce(jsonb_object_agg(key_name,
      case
        when key_name in(
          'maximum_stay_nights','guest_instructions_i18n',
          'check_in_instructions_i18n','check_out_instructions_i18n',
          'internal_operational_notes'
        ) then source.content#>array['operational_profile',key_name]
        when key_name='check_in_from' then to_jsonb(to_char(source.check_in_from,'HH24:MI'))
        when key_name='check_out_until' then to_jsonb(to_char(source.check_out_until,'HH24:MI'))
        when key_name='amenities' then coalesce((select jsonb_agg(code order by code)
          from jsonb_array_elements_text(source.amenities) code),'[]'::jsonb)
        else to_jsonb(source)->key_name
      end),'{}'::jsonb) value
    from source cross join lateral jsonb_object_keys(p_payload) key_name
  )
  select jsonb_build_object(
    'contract_version','hotels_v2_admin_b_property_control_v1',
    'hotel_id',source.id,
    'expected_property_updated_at',source.updated_at,
    'expected_operational_profile_version',
      (source.content#>>'{operational_profile,version}')::integer,
    'reviewed_at',clock_timestamp(),
    'expected_original',original.value,
    'payload',p_payload
  )
  from source cross join original
$function$;

create function pg_temp.admin_b_room_plan(
  p_room_id uuid,
  p_payload jsonb
)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  with source as (
    select hotel.updated_at property_updated_at,room.*
    from public.hotels hotel
    join public.hotel_room_types room on room.hotel_id=hotel.id
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and room.id=p_room_id
  ), original as (
    select coalesce(jsonb_object_agg(key_name,
      case when key_name='amenities' then coalesce((select jsonb_agg(code order by code)
        from unnest(source.amenities) code),'[]'::jsonb)
      else to_jsonb(source)->key_name end),'{}'::jsonb) value
    from source cross join lateral jsonb_object_keys(p_payload) key_name
  )
  select jsonb_build_object(
    'contract_version','hotels_v2_admin_b_room_control_v1',
    'hotel_id',source.hotel_id,
    'expected_property_updated_at',source.property_updated_at,
    'reviewed_at',clock_timestamp(),
    'operation',jsonb_build_object(
      'type','update','id',source.id,'expected_version',source.version,
      'expected_original',original.value,'payload',p_payload
    )
  )
  from source cross join original
$function$;

create function pg_temp.admin_b_room_action_plan(
  p_action text,
  p_room_id uuid,
  p_expected_version bigint,
  p_original jsonb,
  p_payload jsonb
)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'contract_version','hotels_v2_admin_b_room_control_v1',
    'hotel_id',hotel.id,'expected_property_updated_at',hotel.updated_at,
    'reviewed_at',clock_timestamp(),
    'operation',jsonb_build_object(
      'type',p_action,'id',p_room_id,'expected_version',p_expected_version,
      'expected_original',p_original,'payload',p_payload
    )
  )
  from public.hotels hotel
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
$function$;

create function pg_temp.admin_b_guest_noop_plan()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,'expected_property_updated_at',hotel.updated_at,
    'reviewed_at',clock_timestamp(),
    'property_policy',jsonb_build_object(
      'children_policy',hotel.children_policy,
      'minimum_child_age',hotel.minimum_child_age
    )
  )
  from public.hotels hotel
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
$function$;

create function pg_temp.admin_b_assignment_plan(
  p_hotel_id uuid,
  p_action text,
  p_assignment_id uuid,
  p_partner_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $function$
declare v_content jsonb; v_assignment jsonb;
begin
  v_content:=public.hotel_v2_admin_get_content_control(p_hotel_id);
  select item into v_assignment
  from jsonb_array_elements(v_content#>'{assignment_snapshot,assignments}') item
  where item->>'assignment_id'=p_assignment_id::text
    and item->>'partner_id'=p_partner_id::text;
  return jsonb_build_object(
    'contract_version','hotels_v2_admin_b_operational_assignment_v1',
    'hotel_id',p_hotel_id,'reviewed_at',clock_timestamp(),
    'snapshot_token',v_content#>>'{assignment_snapshot,snapshot_token}',
    'expected_assignment_fingerprint',
      v_content#>>'{assignment_snapshot,assignment_fingerprint}',
    'operation',jsonb_build_object(
      'type',p_action,'assignment_id',p_assignment_id,'partner_id',p_partner_id,
      'expected_staff_scope_count',coalesce((v_assignment->>'staff_scope_count')::integer,0),
      'expected_staff_scope_ids',coalesce(v_assignment->'staff_scope_ids','[]'::jsonb),
      'expected_permission_exists',coalesce((v_assignment->>'permission_exists')::boolean,false)
    )
  );
end
$function$;

-- Authorization, raw-table boundary, and retired writer paths.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $security$
declare v_denied boolean;
begin
  v_denied:=false;
  begin perform public.hotel_v2_admin_get_content_control(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'admin_b_non_admin_read_allowed'; end if;

  v_denied:=false;
  begin perform 1 from public.hotel_room_types limit 1;
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'admin_b_raw_select_allowed'; end if;

  v_denied:=false;
  begin update public.hotel_room_types set sort_order=sort_order where false;
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'admin_b_raw_update_allowed'; end if;

  v_denied:=false;
  begin perform public.hotel_v2_admin_apply_room_type_plan(
    '{}'::jsonb,'b4100000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'admin_b_retired_room_rpc_allowed'; end if;
end
$security$;
rollback;

-- Property/private profile, Room CRUD/media/lifecycle, and child-policy no-op.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $property_room$
declare
  v_initial jsonb;
  v_result jsonb;
  v_plan jsonb;
  v_stale jsonb;
  v_room jsonb;
  v_version bigint;
  v_property_before timestamptz;
  v_upper_before bigint;
  v_failed boolean;
begin
  v_initial:=public.hotel_v2_admin_get_content_control(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if v_initial->>'contract_version'<>'hotels_v2_admin_b_content_control_v1'
     or v_initial->>'architecture_version'<>'legacy'
     or v_initial#>>'{operational_profile,exists}'<>'false'
     or v_initial#>'{operational_profile,guest_instructions_i18n}'<>'{}'::jsonb
     or v_initial#>>'{feature_flags,hotel_rooms_v2_enabled}'<>'false' then
    raise exception 'admin_b_content_control_shape_invalid';
  end if;

  v_stale:=pg_temp.admin_b_property_plan(jsonb_build_object(
    'internal_operational_notes','First reviewed private note'
  ));
  v_result:=public.hotel_v2_admin_apply_property_control_plan(
    v_stale,'b4100000-0000-4000-8000-000000000010');
  if v_result->>'changed'<>'true'
     or v_result->>'property_changed'<>'false'
     or v_result->>'operational_profile_changed'<>'true'
     or v_result#>>'{content_control,operational_profile,version}'<>'1'
     or v_result#>>'{content_control,property_updated_at}'<>
        v_initial->>'property_updated_at'
     or jsonb_array_length(v_result->'activity')<>1 then
    raise exception 'admin_b_private_profile_write_invalid';
  end if;

  v_plan:=pg_temp.admin_b_property_plan(jsonb_build_object(
    'internal_operational_notes','First reviewed private note'
  ));
  v_result:=public.hotel_v2_admin_apply_property_control_plan(
    v_plan,'b4100000-0000-4000-8000-000000000011');
  if v_result->>'changed'<>'false' or jsonb_array_length(v_result->'activity')<>0
     or v_result#>>'{content_control,operational_profile,version}'<>'1' then
    raise exception 'admin_b_property_noop_churned';
  end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_property_control_plan(
      jsonb_set(v_stale,'{payload,internal_operational_notes}',
        '"stale overwrite"'::jsonb),
      'b4100000-0000-4000-8000-000000000012');
  exception when sqlstate 'PT409' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_b_stale_profile_was_applied'; end if;

  v_result:=public.hotel_v2_admin_apply_property_control_plan(
    pg_temp.admin_b_property_plan(jsonb_build_object('city','Lefkara')),
    'b4100000-0000-4000-8000-000000000013');
  if v_result->>'changed'<>'false' or jsonb_array_length(v_result->'activity')<>0 then
    raise exception 'admin_b_public_property_noop_churned';
  end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_property_control_plan(
      pg_temp.admin_b_property_plan(jsonb_build_object(
        'google_maps_url','https://google.com.evil.example/maps/7k')),
      'b4100000-0000-4000-8000-000000000014');
  exception when sqlstate '22023' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_b_maps_suffix_smuggling_allowed'; end if;

  -- Exact grandfathered property media is selectable in the normal Room editor.
  v_result:=public.hotel_v2_admin_apply_room_control_plan(
    pg_temp.admin_b_room_plan(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      jsonb_build_object('gallery',jsonb_build_array('/images/7a-1.webp'))
    ),'b4100000-0000-4000-8000-000000000020');
  if v_result->>'changed'<>'true' or jsonb_array_length(v_result->'activity')<>1 then
    raise exception 'admin_b_room_gallery_first_write_failed';
  end if;
  select item into v_room from jsonb_array_elements(v_result#>'{workspace,room_types}') item
    where item->>'id'='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  v_version:=(v_room->>'version')::bigint;
  if v_room->'gallery'<>jsonb_build_array('/images/7a-1.webp') then
    raise exception 'admin_b_room_gallery_not_persisted';
  end if;

  v_result:=public.hotel_v2_admin_apply_room_control_plan(
    pg_temp.admin_b_room_plan(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      jsonb_build_object('gallery',jsonb_build_array('/images/7a-1.webp'))
    ),'b4100000-0000-4000-8000-000000000021');
  select item into v_room from jsonb_array_elements(v_result#>'{workspace,room_types}') item
    where item->>'id'='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  if v_result->>'changed'<>'false' or jsonb_array_length(v_result->'activity')<>0
     or (v_room->>'version')::bigint<>v_version then
    raise exception 'admin_b_room_gallery_noop_churned';
  end if;

  v_result:=public.hotel_v2_admin_apply_room_control_plan(
    pg_temp.admin_b_room_plan(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      jsonb_build_object('gallery',jsonb_build_array('/images/7a-1.webp','/images/7a-2.webp'))
    ),'b4100000-0000-4000-8000-000000000022');
  if v_result->>'changed'<>'true' then raise exception 'admin_b_room_second_gallery_edit_failed'; end if;

  v_stale:=pg_temp.admin_b_room_plan(
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
    jsonb_build_object('gallery',jsonb_build_array('/images/7a-1.webp'))
  );
  perform public.hotel_v2_admin_apply_room_control_plan(
    pg_temp.admin_b_room_plan(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      jsonb_build_object('gallery',jsonb_build_array('/images/7a-2.webp'))
    ),'b4100000-0000-4000-8000-000000000023');
  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_room_control_plan(
      v_stale,'b4100000-0000-4000-8000-000000000024');
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_admin_b_room_field_conflict';
  end;
  if not v_failed then raise exception 'admin_b_true_gallery_conflict_not_controlled'; end if;
  v_result:=public.hotel_v2_admin_apply_room_control_plan(
    pg_temp.admin_b_room_plan(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      jsonb_build_object('gallery',jsonb_build_array('/images/7a-1.webp'))
    ),'b4100000-0000-4000-8000-000000000025');
  if v_result->>'changed'<>'true' then raise exception 'admin_b_fresh_explicit_gallery_save_failed'; end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_room_control_plan(
      pg_temp.admin_b_room_plan(
        'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
        jsonb_build_object('gallery',jsonb_build_array('https://evil.example/room.webp'))
      ),'b4100000-0000-4000-8000-000000000026');
  exception when sqlstate '22023' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_b_foreign_room_media_allowed'; end if;

  -- Create is always draft, then an exact dependency-free draft can disable.
  v_result:=public.hotel_v2_admin_apply_room_control_plan(
    pg_temp.admin_b_room_action_plan(
      'create','b4200000-0000-4000-8000-000000000001',0,'{}'::jsonb,
      jsonb_build_object(
        'code','admin-b-created','name_i18n',jsonb_build_object('en','ADMIN-B Created'),
        'bed_configuration','[]'::jsonb,'amenities','[]'::jsonb,
        'inventory_mode','pooled','base_inventory_count',0,
        'capacity_adults',null,'capacity_children',null,'max_occupancy',2
      )
    ),'b4100000-0000-4000-8000-000000000030');
  select item into v_room from jsonb_array_elements(v_result#>'{workspace,room_types}') item
    where item->>'id'='b4200000-0000-4000-8000-000000000001';
  if v_room->>'status'<>'draft' or v_room->>'base_inventory_count'<>'0' then
    raise exception 'admin_b_created_room_not_inert';
  end if;

  v_result:=public.hotel_v2_admin_apply_room_control_plan(
    pg_temp.admin_b_room_action_plan(
      'duplicate','b4200000-0000-4000-8000-000000000002',
      (select (item->>'version')::bigint from jsonb_array_elements(
        public.hotel_v2_admin_get_property_workspace(
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>'{room_types}') item
       where item->>'id'='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),
      '{}'::jsonb,jsonb_build_object(
        'source_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
        'code','admin-b-duplicate'
      )
    ),'b4100000-0000-4000-8000-000000000031');
  select item into v_room from jsonb_array_elements(v_result#>'{workspace,room_types}') item
    where item->>'id'='b4200000-0000-4000-8000-000000000002';
  if v_room->>'status'<>'draft' or v_room->'gallery'<>'[]'::jsonb
     or v_room->>'inventory_mode'<>'pooled'
     or v_room->>'base_inventory_count'<>'0' then
    raise exception 'admin_b_duplicate_copied_live_state';
  end if;

  v_result:=public.hotel_v2_admin_apply_room_control_plan(
    pg_temp.admin_b_room_action_plan(
      'disable','b4200000-0000-4000-8000-000000000001',
      (select (item->>'version')::bigint from jsonb_array_elements(
        public.hotel_v2_admin_get_property_workspace(
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>'{room_types}') item
       where item->>'id'='b4200000-0000-4000-8000-000000000001'),
      jsonb_build_object('status','draft'),'{}'::jsonb
    ),'b4100000-0000-4000-8000-000000000032');
  select item into v_room from jsonb_array_elements(v_result#>'{workspace,room_types}') item
    where item->>'id'='b4200000-0000-4000-8000-000000000001';
  if v_room->>'status'<>'disabled' then raise exception 'admin_b_room_disable_failed'; end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_room_control_plan(
      pg_temp.admin_b_room_action_plan(
        'disable','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
        (select (item->>'version')::bigint from jsonb_array_elements(
          public.hotel_v2_admin_get_property_workspace(
            '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>'{room_types}') item
         where item->>'id'='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),
        jsonb_build_object('status','active'),'{}'::jsonb
      ),'b4100000-0000-4000-8000-000000000033');
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_admin_b_room_disable_has_live_dependencies';
  end;
  if not v_failed then raise exception 'admin_b_live_room_disable_allowed'; end if;

  v_property_before:=(public.hotel_v2_admin_get_content_control(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca')->>'property_updated_at')::timestamptz;
  select (item->>'version')::bigint into v_upper_before
  from jsonb_array_elements(public.hotel_v2_admin_get_property_workspace(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>'{room_types}') item
  where item->>'id'='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  v_result:=public.hotel_v2_admin_apply_guest_policy_plan(
    pg_temp.admin_b_guest_noop_plan(),
    'b4100000-0000-4000-8000-000000000040');
  if v_result->>'property_changed'<>'false'
     or v_result->>'updated_room_policy_count'<>'0'
     or jsonb_array_length(v_result->'activity')<>0
     or (public.hotel_v2_admin_get_content_control(
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca')->>'property_updated_at')::timestamptz
          <>v_property_before
     or (select (item->>'version')::bigint
          from jsonb_array_elements(public.hotel_v2_admin_get_property_workspace(
            '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>'{room_types}') item
          where item->>'id'='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')<>v_upper_before then
    raise exception 'admin_b_guest_policy_noop_churned';
  end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_workspace_plan(
      '{"operations":[{"entity":"property"}]}'::jsonb,
      'b4100000-0000-4000-8000-000000000041');
  exception when insufficient_privilege then
    v_failed:=sqlerrm='hotels_v2_admin_b_use_control_plane_rpc';
  end;
  if not v_failed then raise exception 'admin_b_generic_property_writer_allowed'; end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_guest_policy_plan(
      jsonb_set(pg_temp.admin_b_guest_noop_plan(),'{room_policies}',jsonb_build_array(
        jsonb_build_object(
          'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
          'expected_version',1,'children_policy_override',null,
          'minimum_child_age_override',null,'max_occupancy',99
        )),true),
      'b4100000-0000-4000-8000-000000000042');
  exception when sqlstate '22023' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_b_guest_capacity_smuggling_allowed'; end if;
end
$property_room$;
-- Force every DEFERRABLE ADMIN-B invariant before rolling the synthetic
-- mutations back; otherwise a deferred trigger defect can hide behind ROLLBACK.
set constraints all immediate;
set constraints all deferred;
rollback;

-- Exact assignment Review, staff-scope revocation, permission cascade, and
-- closed historical-backfill context.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $assign$
declare v_result jsonb;
begin
  v_result:=public.hotel_v2_admin_apply_operational_assignment_plan(
    pg_temp.admin_b_assignment_plan(
      'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1','assign',
      'b4300000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000004'
    ),'b4100000-0000-4000-8000-000000000050');
  if v_result->>'changed'<>'true' or v_result->>'operation'<>'assign'
     or jsonb_array_length(v_result->'activity')<>1 then
    raise exception 'admin_b_assignment_insert_failed';
  end if;
end
$assign$;
reset role;

do $assignment_raw_setup$
declare v_failed boolean:=false;
begin
  if exists(select 1 from public.hotels_v2_admin_b_test_assignment_backfill_calls
      where assignment_id='b4300000-0000-4000-8000-000000000001') then
    raise exception 'admin_b_reviewed_assignment_backfilled_history';
  end if;
  if exists(select 1 from public.hotel_admin_assignment_transaction_context) then
    raise exception 'admin_b_assignment_context_leaked';
  end if;

  insert into public.profiles(id,email,is_admin) values(
    'b4400000-0000-4000-8000-000000000001','admin-b-scope@example.test',false
  );
  insert into public.partner_users(id,partner_id,user_id,role) values(
    'b4500000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    'b4400000-0000-4000-8000-000000000001','staff'
  );
  insert into public.partner_user_resources(
    id,partner_user_id,resource_type,resource_id
  ) values(
    'b4600000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000005','hotels',
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'
  );
  insert into public.hotel_partner_hotel_permissions(
    assignment_id,partner_id,hotel_id,view_payment_status
  ) values(
    'b4300000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',true
  );

  begin
    delete from public.partner_resources
    where id='b4300000-0000-4000-8000-000000000001';
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_admin_b_assignment_has_staff_scopes';
  end;
  if not v_failed then raise exception 'admin_b_raw_assignment_delete_orphaned_scope'; end if;

  v_failed:=false;
  begin
    update public.partner_users
    set partner_id='20000000-0000-4000-8000-000000000005'
    where id='33000000-0000-4000-8000-000000000005';
  exception when sqlstate 'PT409' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_b_membership_scope_reassignment_allowed'; end if;
end
$assignment_raw_setup$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('hotels_v2.admin_b_stale_remove_plan',
  pg_temp.admin_b_assignment_plan(
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1','remove',
    'b4300000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004'
  )::text,false);
reset role;

delete from public.partner_user_resources
where id='b4600000-0000-4000-8000-000000000001';
insert into public.partner_user_resources(
  id,partner_user_id,resource_type,resource_id
) values(
  'b4600000-0000-4000-8000-000000000002',
  'b4500000-0000-4000-8000-000000000001','hotels',
  'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $assignment_stale_and_remove$
declare v_failed boolean:=false; v_result jsonb;
begin
  begin
    perform public.hotel_v2_admin_apply_operational_assignment_plan(
      current_setting('hotels_v2.admin_b_stale_remove_plan')::jsonb,
      'b4100000-0000-4000-8000-000000000051');
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_admin_b_stale_assignment_dependents';
  end;
  if not v_failed then raise exception 'admin_b_same_count_scope_swap_not_stale'; end if;

  v_result:=public.hotel_v2_admin_apply_operational_assignment_plan(
    pg_temp.admin_b_assignment_plan(
      'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1','remove',
      'b4300000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000004'
    ),'b4100000-0000-4000-8000-000000000052');
  if v_result->>'removed_staff_scope_count'<>'1'
     or v_result->>'removed_permission'<>'true'
     or v_result->>'operation'<>'remove' then
    raise exception 'admin_b_assignment_remove_result_invalid';
  end if;

  -- A suspended assignment remains revocable.
  v_result:=public.hotel_v2_admin_apply_operational_assignment_plan(
    pg_temp.admin_b_assignment_plan(
      'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1','remove',
      '32000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000003'
    ),'b4100000-0000-4000-8000-000000000053');
  if v_result->>'operation'<>'remove' then
    raise exception 'admin_b_suspended_assignment_not_revocable';
  end if;
end
$assignment_stale_and_remove$;
reset role;

do $legacy_assignment_backfill$
declare v_failed boolean:=false;
begin
  if exists(select 1 from public.partner_resources
      where id='b4300000-0000-4000-8000-000000000001')
     or exists(select 1 from public.partner_user_resources
      where id='b4600000-0000-4000-8000-000000000002')
     or exists(select 1 from public.hotel_partner_hotel_permissions
      where assignment_id='b4300000-0000-4000-8000-000000000001')
     or exists(select 1 from public.hotel_admin_assignment_transaction_context) then
    raise exception 'admin_b_assignment_cleanup_incomplete';
  end if;

  insert into public.partner_resources(id,partner_id,resource_type,resource_id)
  values(
    'b4300000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000004','hotels',
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
  );
  if not exists(select 1 from public.hotels_v2_admin_b_test_assignment_backfill_calls
      where assignment_id='b4300000-0000-4000-8000-000000000002') then
    raise exception 'admin_b_legacy_assignment_backfill_regressed';
  end if;
  delete from public.partner_resources
  where id='b4300000-0000-4000-8000-000000000002';

  begin
    insert into public.partner_user_resources(
      id,partner_user_id,resource_type,resource_id
    ) values(
      'b4600000-0000-4000-8000-000000000003',
      '33000000-0000-4000-8000-000000000005','hotels',
      'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'
    );
  exception when foreign_key_violation then v_failed:=true; end;
  if not v_failed then raise exception 'admin_b_scope_without_assignment_allowed'; end if;
end
$legacy_assignment_backfill$;
rollback;

-- All mutation tests rolled back. Protected history, pricing, flags, and
-- architecture must still match the original production-shaped fixture.
do $final_safety$
declare v_relation text; v_actual text; v_expected text; v_snapshot jsonb;
begin
  for v_relation in select relation_name from admin_b_protected_before order by relation_name loop
    execute format(
      'select md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' '
      ||'order by to_jsonb(row_value)::text),'''')) from public.%I row_value',
      v_relation
    ) into v_actual;
    select fingerprint into v_expected from admin_b_protected_before
    where relation_name=v_relation;
    if v_actual is distinct from v_expected then
      raise exception 'admin_b_protected_fingerprint_changed: %',v_relation;
    end if;
  end loop;

  if (select architecture_version from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>'legacy'
     or (select md5(pricing_tiers::text) from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')
       <>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or jsonb_array_length((select pricing_tiers->'rules' from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'))<>63
     or exists(select 1 from public.site_settings where id<>1
       or hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception 'admin_b_legacy_or_flags_changed';
  end if;
  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or (v_snapshot#>>'{target,rate_plan,is_active}')::boolean
     or exists(select 1 from jsonb_array_elements(v_snapshot#>'{target,room_rates}') rate
       where (rate->>'is_active')::boolean) then
    raise exception 'admin_b_h3_1p_pricing_contract_changed';
  end if;
end
$final_safety$;

select
  true as hotels_v2_admin_b_content_room_assignment_postgres_safe,
  'legacy'::text as architecture_version,
  false as public_activation,
  70 as pricing_cases,
  0 as pricing_mismatches;
