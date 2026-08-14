\set ON_ERROR_STOP on

-- Disposable PostgreSQL-only reconstruction of the current H2B.1 function
-- chain.  No production connection or row is used by this gate.
\ir hotels-v2-h2b1-postgrest-base.sql

update public.hotels
set children_policy='minimum_age',minimum_child_age=15
where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';

create function pg_temp.h2b2_plan()
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,
    'expected_property_updated_at',hotel.updated_at,
    'expected_property_policy',jsonb_build_object(
      'children_policy',hotel.children_policy,
      'minimum_child_age',hotel.minimum_child_age
    ),
    'reviewed_at',clock_timestamp(),
    'source_contract','seven_arches_two_apartments_v1',
    'expected_legacy_pricing_fingerprint',md5(hotel.pricing_tiers::text),
    'expected_versions',jsonb_build_object(
      'upper_room',coalesce((select version from public.hotel_room_types
        where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),0),
      'ground_room',coalesce((select version from public.hotel_room_types
        where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),0),
      'pricing_schedule',coalesce((select version from public.hotel_pricing_schedules
        where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'),0),
      'property_party_preview',coalesce((select version from public.hotel_pricing_schedules
        where id='443065c0-984a-5de3-a22a-d03042c41107'),0),
      'rate_plan',coalesce((select version from public.hotel_rate_plans
        where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'),0),
      'upper_room_rate',coalesce((select version from public.hotel_room_rates
        where id='7e420964-9cbf-4f1b-abd3-09840af5240f'),0),
      'ground_room_rate',coalesce((select version from public.hotel_room_rates
        where id='3320590d-632d-423f-80d0-fd021cba7293'),0)
    ),
    'property_policy',jsonb_build_object(
      'children_policy',hotel.children_policy,
      'minimum_child_age',hotel.minimum_child_age
    ),
    'rooms',jsonb_build_array(
      jsonb_build_object(
        'id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
        'expected_version',coalesce((select version from public.hotel_room_types
          where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),0),
        'source_key','upper_floor_apartment','code','upper-floor-apartment',
        'name_i18n',jsonb_build_object(
          'pl','Apartament na piętrze','en','Upper Floor Apartment','he','דירה בקומה העליונה'
        ),
        'description_i18n','{}'::jsonb,
        'gallery',jsonb_build_array(hotel.photos->>0,hotel.photos->>1),
        'amenities',jsonb_build_array('air_conditioning','balcony','terrace'),
        'max_occupancy',4,'sort_order',100
      ),
      jsonb_build_object(
        'id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
        'expected_version',coalesce((select version from public.hotel_room_types
          where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),0),
        'source_key','ground_floor_apartment','code','ground-floor-apartment',
        'name_i18n',jsonb_build_object(
          'pl','Apartament na parterze','en','Ground Floor Apartment','he','דירה בקומת הקרקע'
        ),
        'description_i18n','{}'::jsonb,
        'gallery',jsonb_build_array(hotel.photos->>2,hotel.photos->>3),
        'amenities',jsonb_build_array('air_conditioning','terrace'),
        'max_occupancy',4,'sort_order',200
      )
    ),
    'prepare_pricing_preview',true
  )
  from public.hotels hotel
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
$function$;

-- Install and safely reapply the exact repair before any workflow mutation.
\ir ../../supabase/migrations/20260811280000_hotels_v2_h2b2_shadow_property_policy_preservation.sql
\ir ../../supabase/migrations/20260811280000_hotels_v2_h2b2_shadow_property_policy_preservation.sql

do $h2b2_install_contract$
declare v_definition text;
begin
  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  if v_definition not like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
     or v_definition not like '%hotels_v2_h2b2_shadow_property_policy_mismatch%'
     or v_definition like '%update public.hotels set children_policy=''minimum_age'',minimum_child_age=10%'
     or has_function_privilege('anon',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE') then
    raise exception 'hotels_v2_h2b2_repair_install_contract_failed';
  end if;
end
$h2b2_install_contract$;

create temporary table h2b2_before_first_save as
select hotel.updated_at property_updated_at,hotel.children_policy,hotel.minimum_child_age,
  (select count(*) from public.hotel_activity_log) activity_count,
  md5(hotel.pricing_tiers::text) legacy_pricing_fingerprint,
  hotel.architecture_version
from public.hotels hotel
where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  pg_temp.h2b2_plan(),'82000000-0000-4000-8000-000000000001'
);
commit;

do $h2b2_first_save_contract$
declare v_before h2b2_before_first_save%rowtype;
begin
  select * into v_before from h2b2_before_first_save;
  if (select children_policy from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca') is distinct from 'minimum_age'
     or (select minimum_child_age from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca') is distinct from 15
     or (select updated_at from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca') is distinct from v_before.property_updated_at then
    raise exception 'hotels_v2_h2b2_property_policy_changed_by_shadow_prepare';
  end if;
  if exists(select 1 from public.hotel_activity_log
    where correlation_id='82000000-0000-4000-8000-000000000001'
      and entity_type='property') then
    raise exception 'hotels_v2_h2b2_property_activity_written_by_shadow_prepare';
  end if;
  if (select count(*) from public.hotel_room_types
      where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>2
     or (select amenities from public.hotel_room_types
      where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')
        is distinct from array['air_conditioning','balcony','terrace']::text[]
     or (select amenities from public.hotel_room_types
      where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
        is distinct from array['air_conditioning','terrace']::text[]
     or (select jsonb_array_length(gallery) from public.hotel_room_types
      where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')<>2
     or (select jsonb_array_length(gallery) from public.hotel_room_types
      where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')<>2 then
    raise exception 'hotels_v2_h2b2_shadow_graph_not_prepared';
  end if;
  if (select architecture_version from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca') is distinct from v_before.architecture_version
     or md5((select pricing_tiers::text from public.hotels
       where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'))
        is distinct from v_before.legacy_pricing_fingerprint
     or exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
     )) then
    raise exception 'hotels_v2_h2b2_public_inert_contract_failed';
  end if;
end
$h2b2_first_save_contract$;

-- The payload may not select another policy even with an otherwise fresh
-- exact plan.  Its transaction must leave every row and activity unchanged.
create temporary table h2b2_before_mismatch as
select
  md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|' order by row_value.id)
    from public.hotels row_value),'')) hotel_fingerprint,
  md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|' order by row_value.id)
    from public.hotel_room_types row_value),'')) room_fingerprint,
  md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|' order by row_value.id)
    from public.hotel_rate_plans row_value),'')) plan_fingerprint,
  md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|' order by row_value.id)
    from public.hotel_activity_log row_value),'')) activity_fingerprint;

do $h2b2_mismatch_abort$
declare v_failed boolean:=false; v_plan jsonb; v_before h2b2_before_mismatch%rowtype;
begin
  select * into v_before from h2b2_before_mismatch;
  v_plan:=jsonb_set(
    pg_temp.h2b2_plan(),'{property_policy}',
    '{"children_policy":"minimum_age","minimum_child_age":10}'::jsonb
  );
  begin
    perform set_config(
      'request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
      true
    );
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      v_plan,'82000000-0000-4000-8000-000000000002'
    );
  exception when sqlstate '22023' then
    if sqlerrm='hotels_v2_h2b2_shadow_property_policy_mismatch' then v_failed:=true; else raise; end if;
  end;
  if not v_failed
     or md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|' order by row_value.id)
       from public.hotels row_value),'')) is distinct from v_before.hotel_fingerprint
     or md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|' order by row_value.id)
       from public.hotel_room_types row_value),'')) is distinct from v_before.room_fingerprint
     or md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|' order by row_value.id)
       from public.hotel_rate_plans row_value),'')) is distinct from v_before.plan_fingerprint
     or md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|' order by row_value.id)
       from public.hotel_activity_log row_value),'')) is distinct from v_before.activity_fingerprint then
    raise exception 'hotels_v2_h2b2_policy_mismatch_atomic_abort_failed';
  end if;
end
$h2b2_mismatch_abort$;

-- The existing expected-property snapshot remains an independent optimistic
-- guard and still returns PT409 before any write.
do $h2b2_stale_expected_policy_abort$
declare v_failed boolean:=false; v_plan jsonb;
begin
  v_plan:=jsonb_set(
    pg_temp.h2b2_plan(),'{expected_property_policy}',
    '{"children_policy":"minimum_age","minimum_child_age":10}'::jsonb
  );
  begin
    perform set_config(
      'request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
      true
    );
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      v_plan,'82000000-0000-4000-8000-000000000003'
    );
  exception when sqlstate 'PT409' then
    if sqlerrm='hotels_v2_h2b1_stale_property_policy' then v_failed:=true; else raise; end if;
  end;
  if not v_failed then raise exception 'hotels_v2_h2b2_stale_policy_guard_failed'; end if;
  if exists(select 1 from public.hotel_activity_log
    where correlation_id='82000000-0000-4000-8000-000000000003') then
    raise exception 'hotels_v2_h2b2_stale_policy_partial_write';
  end if;
end
$h2b2_stale_expected_policy_abort$;

select 'HOTELS_V2_H2B2_POLICY_PRESERVATION_POSTGRES_GATE_PASS' result;
