\set ON_ERROR_STOP on

\ir hotels-v2-h2a-base.sql
\ir ../../supabase/migrations/20260811170000_hotels_v2_h1a_core.sql
\ir ../../supabase/migrations/20260811200000_hotels_v2_h2a_admin_workspace_foundation.sql
\ir ../../supabase/migrations/20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql
\ir ../../supabase/migrations/20260811220000_hotels_v2_h2a_legacy_price_visibility.sql
\ir ../../supabase/migrations/20260811230000_hotels_v2_h2b_calendar_rates_foundation.sql

insert into public.hotel_amenities(code,category,name_en,name_pl,name_he,is_active)
values
  ('air_conditioning','general','Air conditioning','Klimatyzacja','מיזוג אוויר',true),
  ('terrace','outdoor','Terrace','Taras','טרסה',true),
  ('balcony','room','Balcony','Balkon','מרפסת',true)
on conflict(code) do update set is_active=true;

insert into public.hotels(
  id,slug,title,description,city,photos,amenities,pricing_model,pricing_tiers,max_persons,
  is_published,status,submission_status,architecture_version
)
select
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca','7-ukow',jsonb_build_object('en','7 Arches'),
  jsonb_build_object('en','All apartments are air-conditioned. The property accepts children from 10 years old. For bookings above 4 people accommodation uses 2 apartments.'),
  'Lefkara',(select jsonb_agg('/images/7a-'||number||'.webp' order by number) from generate_series(1,9) number),
  jsonb_build_array('wifi','air_conditioning','terrace','balcony'),
  'tiered_by_nights',jsonb_build_object(
    'currency','EUR','rules',(
      select jsonb_agg(jsonb_build_object(
        'persons',guest_count,'min_nights',nights,'price_per_night',guest_count*25+(10-nights)*2
      ) order by guest_count,nights)
      from generate_series(2,8) guest_count cross join generate_series(2,10) nights
    )
  ),8,false,'draft','draft','legacy';

\ir ../../supabase/migrations/20260811240000_hotels_v2_h2b1_children_shadow_rooms.sql
\ir ../../supabase/migrations/20260811250000_hotels_v2_h2b1_shadow_policy_review_fix.sql
\ir ../../supabase/migrations/20260811260000_hotels_v2_h2b1_shadow_three_way_merge.sql

-- CHECK predicates must reject invalid NULL/UNKNOWN combinations, not merely
-- return UNKNOWN (which PostgreSQL CHECK would otherwise accept).
do $h2b1_null_guard_contract$
declare v_failed boolean;
begin
  v_failed:=false;
  begin update public.hotels set children_policy='minimum_age',minimum_child_age=null
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_property_minimum_age_null_guard_failed'; end if;

  v_failed:=false;
  begin update public.hotels set children_policy=null,minimum_child_age=10
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_property_inherit_age_null_guard_failed'; end if;

  v_failed:=false;
  begin insert into public.hotel_room_types(id,hotel_id,code,name_i18n,capacity_adults,capacity_children,max_occupancy)
    values('70000000-0000-4000-8000-000000000091','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      'invalid-all-null-capacity',jsonb_build_object('en','Invalid'),null,null,null);
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_all_null_capacity_guard_failed'; end if;

  v_failed:=false;
  begin insert into public.hotel_room_types(id,hotel_id,code,name_i18n,capacity_adults,capacity_children,max_occupancy)
    values('70000000-0000-4000-8000-000000000092','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      'invalid-partial-capacity',jsonb_build_object('en','Invalid'),2,null,null);
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_partial_capacity_guard_failed'; end if;

  v_failed:=false;
  begin insert into public.hotel_room_types(
    id,hotel_id,code,name_i18n,capacity_adults,capacity_children,max_occupancy,
    children_policy_override,minimum_child_age_override
  ) values(
    '70000000-0000-4000-8000-000000000093','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'invalid-minimum-age-override',jsonb_build_object('en','Invalid'),null,null,4,'minimum_age',null
  );
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_room_minimum_age_null_guard_failed'; end if;

  v_failed:=false;
  begin insert into public.hotel_room_types(
    id,hotel_id,code,name_i18n,capacity_adults,capacity_children,max_occupancy,
    children_policy_override,minimum_child_age_override
  ) values(
    '70000000-0000-4000-8000-000000000094','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'invalid-inherit-age-override',jsonb_build_object('en','Invalid'),null,null,4,null,10
  );
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_room_inherit_age_null_guard_failed'; end if;

  if exists(select 1 from public.hotel_room_types where id in (
    '70000000-0000-4000-8000-000000000091','70000000-0000-4000-8000-000000000092',
    '70000000-0000-4000-8000-000000000093','70000000-0000-4000-8000-000000000094'
  )) then raise exception 'hotels_v2_h2b1_null_guard_partial_insert'; end if;
end
$h2b1_null_guard_contract$;

create function pg_temp.seven_arches_plan()
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,'expected_property_updated_at',hotel.updated_at,'reviewed_at',clock_timestamp(),
    'source_contract','seven_arches_two_apartments_v1',
    'expected_legacy_pricing_fingerprint',md5(hotel.pricing_tiers::text),
    'expected_property_policy',jsonb_build_object(
      'children_policy',hotel.children_policy,'minimum_child_age',hotel.minimum_child_age
    ),
    'expected_versions',jsonb_build_object(
      'upper_room',coalesce((select version from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),0),
      'ground_room',coalesce((select version from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),0),
      'pricing_schedule',coalesce((select version from public.hotel_pricing_schedules where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'),0),
      'property_party_preview',coalesce((select version from public.hotel_pricing_schedules where id='443065c0-984a-5de3-a22a-d03042c41107'),0),
      'rate_plan',coalesce((select version from public.hotel_rate_plans where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'),0),
      'upper_room_rate',coalesce((select version from public.hotel_room_rates where id='7e420964-9cbf-4f1b-abd3-09840af5240f'),0),
      'ground_room_rate',coalesce((select version from public.hotel_room_rates where id='3320590d-632d-423f-80d0-fd021cba7293'),0)
    ),
    'property_policy',jsonb_build_object('children_policy','minimum_age','minimum_child_age',10),
    'rooms',jsonb_build_array(
      jsonb_build_object(
        'id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
        'expected_version',coalesce((select version from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),0),
        'source_key','upper_floor_apartment',
        'code','upper-floor-apartment','name_i18n',jsonb_build_object(
          'pl','Apartament na piętrze','en','Upper Floor Apartment','he','דירה בקומה העליונה'
        ),'description_i18n','{}'::jsonb,'gallery',jsonb_build_array('/images/7a-1.webp'),
        'amenities',jsonb_build_array('air_conditioning','terrace','balcony'),'max_occupancy',4,'sort_order',100
      ),
      jsonb_build_object(
        'id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
        'expected_version',coalesce((select version from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),0),
        'source_key','ground_floor_apartment',
        'code','ground-floor-apartment','name_i18n',jsonb_build_object(
          'pl','Apartament na parterze','en','Ground Floor Apartment','he','דירה בקומת הקרקע'
        ),'description_i18n','{}'::jsonb,'gallery',jsonb_build_array('/images/7a-2.webp'),
        'amenities',jsonb_build_array('air_conditioning','terrace'),'max_occupancy',4,'sort_order',200
      )
    ),'prepare_pricing_preview',true
  ) from public.hotels hotel where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
$function$;

create function pg_temp.shadow_room_original(p_room_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $function$
  select jsonb_build_object(
    'hotel_id',room_type.hotel_id,
    'source_key',room_type.legacy_source_key,
    'code',room_type.code,
    'name_i18n',room_type.name_i18n,
    'description_i18n',room_type.description_i18n,
    'gallery',room_type.gallery,
    'amenities',to_jsonb(array(select amenity from unnest(room_type.amenities) amenity order by amenity)),
    'max_occupancy',room_type.max_occupancy,
    'capacity_adults',room_type.capacity_adults,
    'capacity_children',room_type.capacity_children,
    'inventory_mode',room_type.inventory_mode,
    'base_inventory_count',room_type.base_inventory_count,
    'sort_order',room_type.sort_order
  )
  from public.hotel_room_types room_type where room_type.id=p_room_id
$function$;

create function pg_temp.with_shadow_originals(p_plan jsonb)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $function$
  select jsonb_set(
    jsonb_set(p_plan,'{rooms,0,expected_original}',coalesce(pg_temp.shadow_room_original(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'
    ),'null'::jsonb),true),
    '{rooms,1,expected_original}',coalesce(pg_temp.shadow_room_original(
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'
    ),'null'::jsonb),true
  )
$function$;

-- Reproduce the deployed reviewed-policy state. The exact two-apartment
-- Review is allowed to change 15 -> source-confirmed 10 only because it sends
-- this freshly read value as expected_property_policy.
update public.hotels
set children_policy='minimum_age',minimum_child_age=15
where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';

create function pg_temp.upper_guest_policy_plan()
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,'expected_property_updated_at',hotel.updated_at,'reviewed_at',clock_timestamp(),
    'room_policies',jsonb_build_array(jsonb_build_object(
      'room_type_id',room_type.id,'expected_version',room_type.version,
      'children_policy_override','not_allowed','minimum_child_age_override',null
    ))
  ) from public.hotels hotel cross join public.hotel_room_types room_type
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
    and room_type.id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'
$function$;

create function pg_temp.room_type_plan(p_operation jsonb)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,'expected_property_updated_at',hotel.updated_at,
    'reviewed_at',clock_timestamp(),'operation',p_operation
  )
  from public.hotels hotel
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
$function$;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  pg_temp.with_shadow_originals(pg_temp.seven_arches_plan()),
  '71000000-0000-4000-8000-000000000001'
);
commit;

do $h2b1_first_save$
declare v_calendar jsonb; v_quote jsonb;
begin
  if (select children_policy from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>'minimum_age'
     or (select minimum_child_age from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>10
     or (select architecture_version from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>'legacy'
     or (select count(*) from public.hotel_room_types where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>2
     or exists(select 1 from public.hotel_room_types where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
       and (max_occupancy<>4 or capacity_adults is not null or capacity_children is not null
         or base_inventory_count<>1 or inventory_mode<>'pooled' or status<>'draft'))
     or (select amenities from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')
        is distinct from array['air_conditioning','terrace','balcony']::text[]
     or (select amenities from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
        is distinct from array['air_conditioning','terrace']::text[]
     or (select legacy_source_key from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')
        is distinct from 'upper_floor_apartment'
     or (select legacy_source_key from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
        is distinct from 'ground_floor_apartment'
     or (select photos from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')->>0<>'/images/7a-1.webp'
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23')<>27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers where schedule_id='443065c0-984a-5de3-a22a-d03042c41107')<>63
     or exists(
       (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
        from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
        where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and (rule->>'persons')::integer between 2 and 4
        except select guest_count,threshold_nights,nightly_rate from public.hotel_pricing_schedule_occupancy_tiers
        where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23' and is_active)
       union all
       (select guest_count,threshold_nights,nightly_rate from public.hotel_pricing_schedule_occupancy_tiers
        where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23' and is_active
        except select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
        from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
        where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and (rule->>'persons')::integer between 2 and 4)
     )
     or exists(
       (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
        from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
        where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
        except select guest_count,threshold_nights,nightly_rate from public.hotel_pricing_schedule_occupancy_tiers
        where schedule_id='443065c0-984a-5de3-a22a-d03042c41107' and is_active)
       union all
       (select guest_count,threshold_nights,nightly_rate from public.hotel_pricing_schedule_occupancy_tiers
        where schedule_id='443065c0-984a-5de3-a22a-d03042c41107' and is_active
        except select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
        from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
        where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')
     )
     or (select count(*) from public.hotel_room_rates where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
       and pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23' and not is_active)<>2
     or (select cancellation_policy->>'type' from public.hotel_rate_plans where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17')<>'requires_review'
     or exists(select 1 from public.site_settings where hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception 'hotels_v2_h2b1_first_save_contract_failed';
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_calendar:=public.hotel_v2_admin_get_calendar('9b6d99a0-923a-4fbc-be54-c066e856e6ca','2032-01-01','2032-01-02');
  if jsonb_array_length(v_calendar->'room_rates')<>2 or jsonb_array_length(v_calendar->'effective_cells')<>4 then
    raise exception 'hotels_v2_h2b1_calendar_two_rows_failed'; end if;
  v_quote:=public.hotel_v2_admin_resolve_rate('7e420964-9cbf-4f1b-abd3-09840af5240f','2032-01-01','2032-01-03',5);
  if v_quote->>'reason'<>'occupancy_exceeds_capacity' then raise exception 'hotels_v2_h2b1_capacity_resolver_failed'; end if;
  reset role;
end
$h2b1_first_save$;

-- A historical deterministic row may predate legacy_source_key. NULL is not
-- a competing identity: a fresh reviewed snapshot may populate only the
-- exact deterministic source key.
update public.hotel_room_types
set legacy_source_key=null
where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  pg_temp.with_shadow_originals(pg_temp.seven_arches_plan()),
  '71000000-0000-4000-8000-000000000030'
);
commit;

do $h2b1_three_way_null_source_population$
begin
  if (select legacy_source_key from public.hotel_room_types
      where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')
       is distinct from 'upper_floor_apartment' then
    raise exception 'hotels_v2_h2b1_three_way_null_source_population_failed';
  end if;
end
$h2b1_three_way_null_source_population$;

-- Per reviewed field, a fresh target change is safe when CURRENT still equals
-- ORIGINAL. A field already equal to TARGET is a safe no-op even when the old
-- ORIGINAL differed. A third value is a real conflict and aborts atomically.
update public.hotel_room_types
set amenities=array['air_conditioning','terrace']::text[]
where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  pg_temp.with_shadow_originals(pg_temp.seven_arches_plan()),
  '71000000-0000-4000-8000-000000000031'
);
commit;

do $h2b1_three_way_current_original$
begin
  if (select amenities from public.hotel_room_types
      where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')
       is distinct from array['air_conditioning','terrace','balcony']::text[] then
    raise exception 'hotels_v2_h2b1_three_way_current_original_failed';
  end if;
end
$h2b1_three_way_current_original$;

do $h2b1_three_way_target_noop$
declare v_plan jsonb;
begin
  v_plan:=pg_temp.with_shadow_originals(pg_temp.seven_arches_plan());
  v_plan:=jsonb_set(v_plan,'{rooms,0,expected_original,amenities}',
    '["air_conditioning","terrace"]'::jsonb,false);
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
    v_plan,'71000000-0000-4000-8000-000000000032'
  );
  reset role;
end
$h2b1_three_way_target_noop$;

do $h2b1_three_way_real_conflict$
declare
  v_plan jsonb;
  v_failed boolean:=false;
  v_message text;
  v_activity_count integer;
  v_ground_fingerprint text;
begin
  update public.hotel_room_types
  set amenities=array['air_conditioning','terrace','private_pool']::text[]
  where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  v_plan:=pg_temp.with_shadow_originals(pg_temp.seven_arches_plan());
  v_plan:=jsonb_set(v_plan,'{rooms,0,expected_original,amenities}',
    '["air_conditioning","terrace"]'::jsonb,false);
  select count(*) into v_activity_count from public.hotel_activity_log;
  select md5(to_jsonb(room_type)::text) into v_ground_fingerprint
  from public.hotel_room_types room_type
  where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      v_plan,'71000000-0000-4000-8000-000000000033'
    );
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_h2b1_shadow_room_three_way_conflict';
  end;
  reset role;
  if not v_failed
     or (select count(*) from public.hotel_activity_log)<>v_activity_count
     or (select amenities from public.hotel_room_types
       where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')
          is distinct from array['air_conditioning','terrace','private_pool']::text[]
     or (select md5(to_jsonb(room_type)::text) from public.hotel_room_types room_type
       where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3') is distinct from v_ground_fingerprint then
    raise exception 'hotels_v2_h2b1_three_way_real_conflict_atomic_abort_failed';
  end if;
  -- Restore the deterministic fixture after proving the RPC made no change.
  update public.hotel_room_types
  set amenities=array['air_conditioning','terrace','balcony']::text[]
  where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
end
$h2b1_three_way_real_conflict$;

-- Identity is never a mergeable business field. A forged ORIGINAL source or
-- code fails validation even if another mutable field would otherwise satisfy
-- the three-way rule.
do $h2b1_three_way_identity_locked$
declare
  v_plan jsonb;
  v_failed boolean:=false;
  v_message text;
  v_room_fingerprint text;
  v_activity_count integer;
begin
  v_plan:=pg_temp.with_shadow_originals(pg_temp.seven_arches_plan());
  v_plan:=jsonb_set(v_plan,'{rooms,0,expected_original,source_key}',
    '"forged_source"'::jsonb,false);
  select md5(to_jsonb(room_type)::text) into v_room_fingerprint
  from public.hotel_room_types room_type
  where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  select count(*) into v_activity_count from public.hotel_activity_log;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      v_plan,'71000000-0000-4000-8000-000000000034'
    );
  exception when sqlstate '22023' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_h2b1_invalid_expected_original';
  end;
  reset role;
  if not v_failed
     or (select md5(to_jsonb(room_type)::text) from public.hotel_room_types room_type
       where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94') is distinct from v_room_fingerprint
     or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_three_way_identity_lock_failed';
  end if;
end
$h2b1_three_way_identity_locked$;

-- A reviewed plan cannot overwrite a property policy that differs from its
-- exact snapshot, even when the property updated_at value is otherwise fresh.
do $h2b1_stale_property_policy$
declare
  v_plan jsonb:=pg_temp.seven_arches_plan();
  v_failed boolean:=false;
  v_message text;
  v_activity_count integer;
  v_rooms_fingerprint text;
begin
  select count(*) into v_activity_count from public.hotel_activity_log;
  select md5(string_agg(to_jsonb(room_type)::text,'|' order by room_type.id))
    into v_rooms_fingerprint from public.hotel_room_types room_type
    where room_type.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_plan:=jsonb_set(v_plan,'{expected_property_policy,minimum_child_age}','15'::jsonb,false);
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      v_plan,'71000000-0000-4000-8000-000000000022'
    );
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_h2b1_stale_property_policy';
  end;
  reset role;
  if not v_failed
     or (select count(*) from public.hotel_activity_log)<>v_activity_count
     or (select md5(string_agg(to_jsonb(room_type)::text,'|' order by room_type.id))
       from public.hotel_room_types room_type
       where room_type.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca') is distinct from v_rooms_fingerprint then
    raise exception 'hotels_v2_h2b1_stale_property_policy_atomic_abort_failed';
  end if;
end
$h2b1_stale_property_policy$;

-- Room override and a repeated preparation preserve the individual override.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_apply_guest_policy_plan(
  pg_temp.upper_guest_policy_plan(),'71000000-0000-4000-8000-000000000002'
);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  pg_temp.seven_arches_plan(),'71000000-0000-4000-8000-000000000003'
);
commit;

do $h2b1_idempotency$
begin
  if (select count(*) from public.hotel_room_types where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>2
     or (select children_policy_override from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')<>'not_allowed'
     or (select count(*) from public.hotel_rate_plans where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>1
     or (select count(*) from public.hotel_room_rates where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>2
     or (select count(*) from public.hotel_pricing_schedules where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>2 then
    raise exception 'hotels_v2_h2b1_idempotency_failed'; end if;
end
$h2b1_idempotency$;

-- A direct RPC caller cannot prepare the deterministic pair beside an
-- unrelated normalized Room Type. The reviewed migration set must be exact.
begin;
insert into public.hotel_room_types(
  id,hotel_id,code,name_i18n,capacity_adults,capacity_children,max_occupancy,
  inventory_mode,base_inventory_count,status
) values(
  '70000000-0000-4000-8000-000000000095','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'unexpected-third-room',jsonb_build_object('en','Unexpected third room'),null,null,4,
  'pooled',1,'draft'
);
do $h2b1_exact_existing_room_set$
declare v_failed boolean:=false; v_message text; v_activity_count integer;
begin
  select count(*) into v_activity_count from public.hotel_activity_log;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      pg_temp.seven_arches_plan(),'71000000-0000-4000-8000-000000000021'
    );
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_h2b1_unexpected_existing_room_type';
  end;
  reset role;
  if not v_failed or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_exact_existing_room_set_failed'; end if;
end
$h2b1_exact_existing_room_set$;
rollback;

-- Accepted source provenance is exact: English content confirms that all
-- apartments are air-conditioned and the property source contains all three
-- reused amenity codes. Either source drift aborts before shadow mutation.
begin;
update public.hotels set amenities=amenities-'balcony'
where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
do $h2b1_amenity_provenance$
declare v_failed boolean:=false; v_message text; v_activity_count integer;
begin
  select count(*) into v_activity_count from public.hotel_activity_log;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      pg_temp.seven_arches_plan(),'71000000-0000-4000-8000-000000000019'
    );
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_h2b1_legacy_source_contract_mismatch';
  end;
  reset role;
  if not v_failed or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_amenity_source_provenance_failed'; end if;
end
$h2b1_amenity_provenance$;
rollback;

begin;
update public.hotels set description=jsonb_set(description,'{en}',
  to_jsonb(replace(description->>'en','All apartments are air-conditioned','All apartments are comfortable')))
where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
do $h2b1_description_provenance$
declare v_failed boolean:=false; v_message text; v_activity_count integer;
begin
  select count(*) into v_activity_count from public.hotel_activity_log;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      pg_temp.seven_arches_plan(),'71000000-0000-4000-8000-000000000020'
    );
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_h2b1_legacy_source_contract_mismatch';
  end;
  reset role;
  if not v_failed or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_description_source_provenance_failed'; end if;
end
$h2b1_description_provenance$;
rollback;

-- The per-room expected_version emitted by the real Admin plan must match the
-- reviewed top-level snapshot. A mismatched room aborts before any write.
do $h2b1_room_review_version$
declare
  v_failed boolean:=false;
  v_activity_count integer;
  v_upper_version bigint;
  v_plan jsonb;
begin
  select count(*) into v_activity_count from public.hotel_activity_log;
  select version into v_upper_version from public.hotel_room_types
  where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  v_plan:=pg_temp.seven_arches_plan();
  v_plan:=jsonb_set(v_plan,'{rooms,0,expected_version}',to_jsonb(v_upper_version+1),false);
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      v_plan,'71000000-0000-4000-8000-000000000016'
    );
  exception when sqlstate 'PT409' then v_failed:=true; end;
  reset role;
  if not v_failed
     or (select version from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')<>v_upper_version
     or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_room_review_version_abort_failed';
  end if;
end
$h2b1_room_review_version$;

-- Existing H2A/H2B implementations use true serialization SQLSTATE 40001.
-- H2B.1 facades must return a non-retrying PT409 and preserve atomic state.
do $h2b1_transport_conflicts$
declare
  v_calendar_failed boolean:=false;
  v_workspace_failed boolean:=false;
  v_activity_count integer;
  v_upper_version bigint;
begin
  select count(*) into v_activity_count from public.hotel_activity_log;
  select version into v_upper_version from public.hotel_room_types
  where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
      'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca','from','2032-01-01','to','2032-01-01',
      'reviewed_at',clock_timestamp(),'snapshot_token','definitely-stale',
      'operations',jsonb_build_array('{}'::jsonb)
    ),'71000000-0000-4000-8000-000000000017');
  exception when sqlstate 'PT409' then v_calendar_failed:=true; end;
  reset role;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_workspace_plan(jsonb_build_object(
      'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca','reviewed_at',clock_timestamp(),
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','room_type','type','update','id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
        'expected_version',v_upper_version+1,'payload','{}'::jsonb
      ))
    ),'71000000-0000-4000-8000-000000000018');
  exception when sqlstate 'PT409' then v_workspace_failed:=true; end;
  reset role;

  if not v_calendar_failed or not v_workspace_failed
     or (select version from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')<>v_upper_version
     or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_transport_conflict_translation_failed';
  end if;
end
$h2b1_transport_conflicts$;

-- A later Admin-reviewed cancellation/rate edit is never reset by reopening
-- the room/photo preparation. The entire repeat plan aborts before writes.
begin;
update public.hotel_rate_plans set cancellation_policy=jsonb_build_object('type','flexible')
where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
update public.hotel_room_rates set base_nightly_rate=123
where id='7e420964-9cbf-4f1b-abd3-09840af5240f';
do $h2b1_reviewed_pricing_preserved$
declare v_failed boolean:=false; v_activity_count integer; v_plan jsonb;
begin
  select count(*) into v_activity_count from public.hotel_activity_log;
  v_plan:=pg_temp.seven_arches_plan();
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(v_plan,'71000000-0000-4000-8000-000000000006');
  exception when sqlstate 'PT409' then v_failed:=true; end;
  reset role;
  if not v_failed
     or (select cancellation_policy->>'type' from public.hotel_rate_plans where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17')<>'flexible'
     or (select base_nightly_rate from public.hotel_room_rates where id='7e420964-9cbf-4f1b-abd3-09840af5240f')<>123
     or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_repeat_save_overwrote_reviewed_pricing'; end if;
end
$h2b1_reviewed_pricing_preserved$;
rollback;

-- DB invariants prevent generic workspace/direct activation of placeholders.
do $h2b1_inert_activation_guards$
declare v_failed boolean:=false; v_plan jsonb; v_activity_count integer;
begin
  begin update public.hotel_rate_plans set is_active=true
    where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_requires_review_plan_activation_guard_failed'; end if;
  v_failed:=false;
  begin update public.hotel_pricing_schedules set is_active=true
    where id='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_schedule_review_activation_guard_failed'; end if;
  v_failed:=false;
  begin update public.hotel_room_rates set is_active=true
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f';
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_schedule_product_activation_guard_failed'; end if;

  select count(*) into v_activity_count from public.hotel_activity_log;
  v_plan:=jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca','reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','rate_plan','type','update','id','22e47a63-a630-4fb6-8f43-816f2d3fdc17',
      'expected_version',(select version from public.hotel_rate_plans where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'),
      'payload',jsonb_build_object('is_active',true)
    ))
  );
  v_failed:=false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_workspace_plan(v_plan,'71000000-0000-4000-8000-000000000007');
  exception when check_violation then v_failed:=true; end;
  reset role;
  if not v_failed or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_generic_rpc_activation_guard_failed'; end if;
end
$h2b1_inert_activation_guards$;

-- Readiness exposes effective child policy and both inert financial blockers.
insert into public.hotel_room_types(
  id,hotel_id,code,name_i18n,capacity_adults,capacity_children,status,inventory_mode,base_inventory_count
) values(
  '74000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','unreviewed-policy',
  jsonb_build_object('en','Unreviewed policy'),2,0,'active','pooled',1
);
do $h2b1_children_readiness$
begin
  if not (public.hotel_v2_h2a_readiness('30000000-0000-4000-8000-000000000001')->'preparation_blockers'
    @> '["unreviewed_children_policy"]'::jsonb) then
    raise exception 'hotels_v2_h2b1_children_readiness_failed'; end if;
end
$h2b1_children_readiness$;
delete from public.hotel_room_types where id='74000000-0000-4000-8000-000000000001';

begin;
alter table public.hotel_rate_plans drop constraint hotel_rate_plans_h2b1_review_activation_check;
alter table public.hotel_room_rates drop constraint hotel_room_rates_h2b1_schedule_inert_check;
update public.hotel_rate_plans set is_active=true where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
update public.hotel_room_rates set is_active=true where id='7e420964-9cbf-4f1b-abd3-09840af5240f';
do $h2b1_financial_readiness$
declare v_readiness jsonb;
begin
  v_readiness:=public.hotel_v2_h2a_readiness('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if not (v_readiness->'preparation_blockers' @> '["unreviewed_cancellation_policy"]'::jsonb)
     or not (v_readiness->'preparation_blockers' @> '["h2b1_schedule_product_not_executable"]'::jsonb) then
    raise exception 'hotels_v2_h2b1_financial_readiness_failed'; end if;
end
$h2b1_financial_readiness$;
rollback;

-- Duplicate room IDs and malicious extra amenities fail before mutation.
do $h2b1_fail_closed$
declare v_plan jsonb; v_failed boolean:=false; v_room_count integer; v_activity_count integer;
begin
  select count(*) into v_room_count from public.hotel_room_types;
  select count(*) into v_activity_count from public.hotel_activity_log;
  v_plan:=pg_temp.seven_arches_plan();
  v_plan:=jsonb_set(v_plan,'{rooms,1}',v_plan->'rooms'->0);
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(v_plan,'71000000-0000-4000-8000-000000000004');
  exception when sqlstate '22023' then v_failed:=true; end;
  reset role;
  if not v_failed or (select count(*) from public.hotel_room_types)<>v_room_count
     or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_duplicate_plan_atomic_abort_failed'; end if;

  v_failed:=false; v_plan:=pg_temp.seven_arches_plan();
  v_plan:=jsonb_set(v_plan,'{rooms,0,amenities}',
    '["air_conditioning","terrace","balcony","wifi"]'::jsonb);
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(v_plan,'71000000-0000-4000-8000-000000000005');
  exception when check_violation then v_failed:=true;
             when sqlstate '22023' then v_failed:=true; end;
  reset role;
  if not v_failed or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_extra_amenity_abort_failed'; end if;
end
$h2b1_fail_closed$;

-- DB invariants independently reject impossible capacity/schedule rows.
do $h2b1_db_guards$
declare v_failed boolean:=false;
begin
  begin
    update public.hotel_room_types set capacity_adults=2 where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_mixed_capacity_guard_failed'; end if;
  v_failed:=false;
  begin
    insert into public.hotel_pricing_schedule_occupancy_tiers(
      id,schedule_id,guest_count,threshold_nights,nightly_rate
    ) values('72000000-0000-4000-8000-000000000001','b0a3104f-7b31-5265-a59f-c2d166f11a23',5,20,1);
  exception when check_violation then v_failed:=true; end;
  if not v_failed then raise exception 'hotels_v2_h2b1_schedule_capacity_guard_failed'; end if;
end
$h2b1_db_guards$;

-- Dedicated Room Type RPC covers total-only create/update, exact-source
-- duplicate, stale abort and disable without falling back to the H2A split
-- capacity writer.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_apply_room_type_plan(pg_temp.room_type_plan(jsonb_build_object(
    'type','create','id','73000000-0000-4000-8000-000000000001','expected_version',0,
    'payload',jsonb_build_object(
      'code','rpc-total-capacity','name_i18n',jsonb_build_object('en','RPC Total Capacity'),
      'description_i18n','{}'::jsonb,'gallery','[]'::jsonb,
      'capacity_adults',null,'capacity_children',null,'max_occupancy',4,
      'children_policy_override','minimum_age','minimum_child_age_override',12,
      'bed_configuration','[]'::jsonb,'amenities',jsonb_build_array('terrace'),
      'inventory_mode','pooled','base_inventory_count',1,'status','draft','sort_order',900
    )
  )),'73000000-0000-4000-8000-000000000011');
select public.hotel_v2_admin_apply_room_type_plan(pg_temp.room_type_plan(jsonb_build_object(
    'type','update','id','73000000-0000-4000-8000-000000000001','expected_version',1,
    'payload',jsonb_build_object('name_i18n',jsonb_build_object('en','RPC Updated Capacity'))
  )),'73000000-0000-4000-8000-000000000012');
select public.hotel_v2_admin_apply_room_type_plan(pg_temp.room_type_plan(jsonb_build_object(
    'type','duplicate','id','73000000-0000-4000-8000-000000000002','expected_version',2,
    'payload',jsonb_build_object('source_id','73000000-0000-4000-8000-000000000001','code','rpc-total-capacity-copy')
  )),'73000000-0000-4000-8000-000000000013');
select public.hotel_v2_admin_apply_room_type_plan(pg_temp.room_type_plan(jsonb_build_object(
    'type','disable','id','73000000-0000-4000-8000-000000000002','expected_version',1,'payload','{}'::jsonb
  )),'73000000-0000-4000-8000-000000000014');
commit;

do $h2b1_room_type_rpc_contract$
declare v_failed boolean:=false; v_activity_count integer;
begin
  if (select max_occupancy from public.hotel_room_types where id='73000000-0000-4000-8000-000000000001')<>4
     or (select capacity_adults from public.hotel_room_types where id='73000000-0000-4000-8000-000000000001') is not null
     or (select minimum_child_age_override from public.hotel_room_types where id='73000000-0000-4000-8000-000000000001')<>12
     or (select max_occupancy from public.hotel_room_types where id='73000000-0000-4000-8000-000000000002')<>4
     or (select children_policy_override from public.hotel_room_types where id='73000000-0000-4000-8000-000000000002')<>'minimum_age'
     or (select legacy_source_key from public.hotel_room_types where id='73000000-0000-4000-8000-000000000002') is not null
     or (select status from public.hotel_room_types where id='73000000-0000-4000-8000-000000000002')<>'disabled' then
    raise exception 'hotels_v2_h2b1_room_type_rpc_create_update_duplicate_disable_failed'; end if;

  select count(*) into v_activity_count from public.hotel_activity_log;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_room_type_plan(pg_temp.room_type_plan(jsonb_build_object(
        'type','update','id','73000000-0000-4000-8000-000000000001','expected_version',1,
        'payload',jsonb_build_object('name_i18n',jsonb_build_object('en','Stale Must Fail'))
      )),'73000000-0000-4000-8000-000000000015');
  exception when sqlstate 'PT409' then v_failed:=true; end;
  reset role;
  if not v_failed
     or (select name_i18n->>'en' from public.hotel_room_types where id='73000000-0000-4000-8000-000000000001')<>'RPC Updated Capacity'
     or (select count(*) from public.hotel_activity_log)<>v_activity_count then
    raise exception 'hotels_v2_h2b1_room_type_rpc_stale_abort_failed'; end if;
end
$h2b1_room_type_rpc_contract$;

do $h2b1_security$
begin
  if has_table_privilege('anon','public.hotel_pricing_schedules','SELECT')
     or has_table_privilege('authenticated','public.hotel_pricing_schedules','INSERT')
     or not has_table_privilege('authenticated','public.hotel_pricing_schedules','SELECT')
     or has_function_privilege('anon','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE') then
    raise exception 'hotels_v2_h2b1_security_contract_failed'; end if;
end
$h2b1_security$;

select 'HOTELS_V2_H2B1_POSTGRES_GATE_PASS' as result;
