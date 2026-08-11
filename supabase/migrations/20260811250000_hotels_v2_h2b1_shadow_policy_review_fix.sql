begin;
set transaction isolation level repeatable read;

-- Hotels 2.0 H2B.1 narrow repair: a reviewed two-apartment package may change
-- an already reviewed property children policy only when the browser supplies
-- the exact locked policy snapshot. No property/data row is changed by this
-- migration itself.
lock table public.site_settings in share mode;

do $h2b1_reviewed_policy_fix_preconditions$
declare v_definition text;
begin
  if to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is null
     or to_regclass('public.hotel_pricing_schedules') is null
     or to_regclass('public.hotel_pricing_schedule_occupancy_tiers') is null
     or not exists(select 1 from information_schema.columns
       where table_schema='public' and table_name='hotels' and column_name='children_policy')
     or not exists(select 1 from information_schema.columns
       where table_schema='public' and table_name='hotels' and column_name='minimum_child_age') then
    raise exception using errcode='55000',message='hotels_v2_h2b1_reviewed_policy_fix_prerequisite_missing';
  end if;
  select pg_get_functiondef('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
    into v_definition;
  if not (
      (v_definition like '%hotels_v2_h2b1_guest_policy_already_reviewed%'
        and v_definition not like '%expected_property_policy%')
      or
      (v_definition not like '%hotels_v2_h2b1_guest_policy_already_reviewed%'
        and v_definition like '%expected_property_policy%'
        and v_definition like '%hotels_v2_h2b1_stale_property_policy%')
    )
     or v_definition not like '%hotels_v2_h2b1_unexpected_existing_room_type%'
     or v_definition not like '%All apartments are air-conditioned%' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_reviewed_policy_fix_function_drift';
  end if;
  if exists(select 1 from public.site_settings where hotel_rooms_v2_enabled
    or hotel_external_sync_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_reviewed_policy_fix_capability_enabled';
  end if;
end
$h2b1_reviewed_policy_fix_preconditions$;

create temporary table hotels_v2_h2b1_reviewed_policy_fix_snapshot(
  relation_name text primary key,row_count bigint not null,fingerprint text not null
) on commit drop;

insert into hotels_v2_h2b1_reviewed_policy_fix_snapshot
select 'hotels',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotels row_value
union all select 'hotel_room_types',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_types row_value
union all select 'hotel_rate_plans',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_rate_plans row_value
union all select 'hotel_room_rates',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_rates row_value
union all select 'hotel_pricing_schedules',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_pricing_schedules row_value
union all select 'hotel_pricing_schedule_occupancy_tiers',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_pricing_schedule_occupancy_tiers row_value
union all select 'hotel_activity_log',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_activity_log row_value
union all select 'site_settings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.site_settings row_value;

create or replace function public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_plan constant uuid:='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  c_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_party_preview constant uuid:='443065c0-984a-5de3-a22a-d03042c41107';
  v_hotel public.hotels%rowtype; v_room_json jsonb; v_room public.hotel_room_types%rowtype;
  v_before jsonb; v_after jsonb; v_expected jsonb; v_reviewed_at timestamptz;
  v_gallery_item jsonb; v_amenity text; v_existing_version bigint; v_rule jsonb;
  v_schedule_before jsonb; v_schedule_after jsonb; v_price_fingerprint text;
  v_expected_policy jsonb; v_expected_policy_value text; v_expected_minimum_age integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'hotel_id','expected_property_updated_at','reviewed_at','source_contract',
       'expected_legacy_pricing_fingerprint','expected_property_policy','expected_versions','property_policy','rooms','prepare_pricing_preview'
     ]) or not (p_plan ?& array[
       'hotel_id','expected_property_updated_at','reviewed_at','source_contract',
       'expected_legacy_pricing_fingerprint','expected_property_policy','expected_versions','property_policy','rooms','prepare_pricing_preview'
     ]) or (p_plan->>'hotel_id')::uuid<>c_hotel
     or p_plan->>'source_contract'<>'seven_arches_two_apartments_v1'
     or coalesce((p_plan->>'prepare_pricing_preview')::boolean,false) is not true
     or jsonb_typeof(p_plan->'expected_property_policy')<>'object'
     or jsonb_typeof(p_plan->'expected_versions')<>'object'
     or jsonb_typeof(p_plan->'rooms')<>'array' or jsonb_array_length(p_plan->'rooms')<>2 then
    raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_shadow_plan';
  end if;
  v_expected_policy:=p_plan->'expected_property_policy';
  if not public.hotel_v2_h2a_keys_allowed(v_expected_policy,array['children_policy','minimum_child_age'])
     or not (v_expected_policy ?& array['children_policy','minimum_child_age'])
     or (v_expected_policy->>'minimum_child_age' is not null
       and v_expected_policy->>'minimum_child_age' !~ '^[0-9]{1,2}$') then
    raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_expected_property_policy';
  end if;
  v_expected_policy_value:=v_expected_policy->>'children_policy';
  v_expected_minimum_age:=case when v_expected_policy->>'minimum_child_age' is null
    then null else (v_expected_policy->>'minimum_child_age')::integer end;
  if not public.hotel_v2_h2b1_children_policy_valid(
    v_expected_policy_value,v_expected_minimum_age,true
  ) then
    raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_expected_property_policy';
  end if;
  v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  if v_reviewed_at<clock_timestamp()-interval '30 minutes' or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_h2b1_shadow_review_expired';
  end if;
  select * into v_hotel from public.hotels where id=c_hotel for update;
  if not found or v_hotel.architecture_version<>'legacy' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_legacy_property_contract_mismatch';
  end if;
  if v_hotel.updated_at is distinct from (p_plan->>'expected_property_updated_at')::timestamptz then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property';
  end if;
  if v_hotel.children_policy is distinct from v_expected_policy_value
     or v_hotel.minimum_child_age is distinct from v_expected_minimum_age then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property_policy';
  end if;
  if exists(select 1 from public.site_settings where id=1 and (hotel_rooms_v2_enabled
    or hotel_external_sync_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_capability_flag_enabled';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_h2b1_correlation_id_already_used';
  end if;
  if v_hotel.pricing_model is distinct from 'tiered_by_nights'
     or v_hotel.max_persons is distinct from 8
     or jsonb_typeof(v_hotel.photos) is distinct from 'array'
     or jsonb_array_length(v_hotel.photos)<>9
     or coalesce(v_hotel.description->>'en','') not like '%All apartments are air-conditioned%'
     or coalesce(v_hotel.description->>'en','') not like '%accepts children from 10 years old%'
     or coalesce(v_hotel.description->>'en','') not like '%For bookings above 4 people%2 apartments%'
     or not (coalesce(v_hotel.amenities,'[]'::jsonb)
       @> '["air_conditioning","terrace","balcony"]'::jsonb)
     or jsonb_typeof(v_hotel.pricing_tiers->'rules')<>'array'
     or jsonb_array_length(v_hotel.pricing_tiers->'rules')<>63
     or v_hotel.pricing_tiers->>'currency' is distinct from 'EUR' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_legacy_source_contract_mismatch';
  end if;
  v_price_fingerprint:=md5(v_hotel.pricing_tiers::text);
  if p_plan->>'expected_legacy_pricing_fingerprint'<>v_price_fingerprint then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_legacy_pricing';
  end if;
  if exists(select 1 from public.hotel_room_types room_type
    where room_type.hotel_id=c_hotel and room_type.id not in (c_upper,c_ground)) then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_unexpected_existing_room_type';
  end if;
  if (select count(*) from (
      select (rule->>'persons')::integer persons,(rule->>'min_nights')::integer nights,count(*)
      from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule
      group by 1,2 having count(*)<>1
    ) duplicate_rule)<>0
     or (select count(*) from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule
       where (rule->>'persons')::integer not between 2 and 8
          or (rule->>'min_nights')::integer not between 2 and 10
          or (rule->>'price_per_night')::numeric<0)<>0
     or (select count(distinct (rule->>'persons')::integer)*count(distinct (rule->>'min_nights')::integer)
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule)<>63 then
    raise exception using errcode='55000',message='hotels_v2_h2b1_legacy_pricing_grid_mismatch';
  end if;
  if not public.hotel_v2_h2b1_children_policy_valid(
    p_plan->'property_policy'->>'children_policy',
    case when p_plan->'property_policy'->>'minimum_child_age' is null then null else (p_plan->'property_policy'->>'minimum_child_age')::integer end,false
  ) or p_plan->'property_policy'->>'children_policy'<>'minimum_age'
     or (p_plan->'property_policy'->>'minimum_child_age')::integer<>10 then
    raise exception using errcode='22023',message='hotels_v2_h2b1_seven_arches_child_policy_mismatch';
  end if;
  v_expected:=p_plan->'expected_versions';
  if not public.hotel_v2_h2a_keys_allowed(v_expected,array[
    'upper_room','ground_room','pricing_schedule','property_party_preview','rate_plan','upper_room_rate','ground_room_rate'
  ]) or not (v_expected ?& array[
    'upper_room','ground_room','pricing_schedule','property_party_preview','rate_plan','upper_room_rate','ground_room_rate'
  ]) then raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_expected_versions'; end if;
  if (select count(distinct (room_value->>'id')::uuid) from jsonb_array_elements(p_plan->'rooms') room_value)<>2
     or not exists(select 1 from jsonb_array_elements(p_plan->'rooms') room_value where (room_value->>'id')::uuid=c_upper)
     or not exists(select 1 from jsonb_array_elements(p_plan->'rooms') room_value where (room_value->>'id')::uuid=c_ground) then
    raise exception using errcode='22023',message='hotels_v2_h2b1_shadow_rooms_exact_set_required';
  end if;

  -- Validate and lock every exact target before the first write.
  for v_room_json in select value from jsonb_array_elements(p_plan->'rooms') loop
    if jsonb_typeof(v_room_json)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_room_json,array[
         'id','expected_version','source_key','code','name_i18n','description_i18n','gallery','amenities','max_occupancy','sort_order'
       ]) or not (v_room_json ?& array['id','expected_version','source_key','code','name_i18n','gallery','amenities','max_occupancy'])
       or (v_room_json->>'id')::uuid not in (c_upper,c_ground)
       or coalesce(v_room_json->>'expected_version','') !~ '^[0-9]+$'
       or ((v_room_json->>'id')::uuid=c_upper and v_room_json->>'source_key'<>'upper_floor_apartment')
       or ((v_room_json->>'id')::uuid=c_ground and v_room_json->>'source_key'<>'ground_floor_apartment')
       or ((v_room_json->>'id')::uuid=c_upper and v_room_json->>'code'<>'upper-floor-apartment')
       or ((v_room_json->>'id')::uuid=c_ground and v_room_json->>'code'<>'ground-floor-apartment')
       or (v_room_json->>'max_occupancy')::integer<>4
       or not public.hotel_v2_h2a_i18n_is_valid(v_room_json->'name_i18n',true)
       or jsonb_typeof(v_room_json->'gallery')<>'array' or jsonb_array_length(v_room_json->'gallery')<1
       or (select count(*) from jsonb_array_elements(v_room_json->'gallery'))<>
          (select count(distinct value) from jsonb_array_elements(v_room_json->'gallery'))
       or jsonb_typeof(v_room_json->'amenities')<>'array' then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_shadow_room';
    end if;
    for v_gallery_item in select value from jsonb_array_elements(v_room_json->'gallery') loop
      if not exists(select 1 from jsonb_array_elements(coalesce(v_hotel.photos,'[]'::jsonb)) property_photo where property_photo.value=v_gallery_item) then
        raise exception using errcode='23514',message='hotels_v2_h2b1_room_photo_not_in_property_gallery';
      end if;
    end loop;
    for v_amenity in select value#>>'{}' from jsonb_array_elements(v_room_json->'amenities') loop
      if not exists(select 1 from public.hotel_amenities where code=v_amenity and is_active) then
        raise exception using errcode='23503',message='hotels_v2_h2b1_unknown_room_amenity';
      end if;
    end loop;
    if not (v_room_json->'amenities' @> '["air_conditioning"]'::jsonb)
       or not (v_room_json->'amenities' @> '["terrace"]'::jsonb)
       or ((v_room_json->>'id')::uuid=c_upper and not (v_room_json->'amenities' @> '["balcony"]'::jsonb))
       or ((v_room_json->>'id')::uuid=c_ground and (v_room_json->'amenities' @> '["balcony"]'::jsonb))
       or ((v_room_json->>'id')::uuid=c_upper and jsonb_array_length(v_room_json->'amenities')<>3)
       or ((v_room_json->>'id')::uuid=c_ground and jsonb_array_length(v_room_json->'amenities')<>2) then
      raise exception using errcode='23514',message='hotels_v2_h2b1_confirmed_room_amenity_mismatch';
    end if;
    select * into v_room from public.hotel_room_types where id=(v_room_json->>'id')::uuid for update;
    v_existing_version:=case when (v_room_json->>'id')::uuid=c_upper then (v_expected->>'upper_room')::bigint else (v_expected->>'ground_room')::bigint end;
    if (v_room_json->>'expected_version')::bigint<>v_existing_version then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_room_expected_version_mismatch';
    end if;
    if found then
      if v_room.hotel_id<>c_hotel or v_room.legacy_source_key<>v_room_json->>'source_key'
         or v_room.code<>v_room_json->>'code' or v_room.version<>v_existing_version
         or v_room.max_occupancy<>4 or v_room.capacity_adults is not null or v_room.capacity_children is not null
         or v_room.inventory_mode<>'pooled' or v_room.base_inventory_count<>1
         or cardinality(v_room.amenities)<>jsonb_array_length(v_room_json->'amenities')
         or not (v_room.amenities @> array(select value#>>'{}' from jsonb_array_elements(v_room_json->'amenities'))) then
        raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_shadow_room';
      end if;
    elsif v_existing_version<>0 or exists(select 1 from public.hotel_room_types where hotel_id=c_hotel and legacy_source_key=v_room_json->>'source_key') then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_shadow_room_identity_conflict';
    end if;
  end loop;

  perform 1 from public.hotel_pricing_schedules where id=c_schedule for update;
  if found then
    if (select hotel_id from public.hotel_pricing_schedules where id=c_schedule)<>c_hotel
       or (select version from public.hotel_pricing_schedules where id=c_schedule)<>(v_expected->>'pricing_schedule')::bigint
       or (select code from public.hotel_pricing_schedules where id=c_schedule)<>'shared-apartment-occupancy-los'
       or (select application_scope from public.hotel_pricing_schedules where id=c_schedule)<>'room_occupancy'
       or (select source from public.hotel_pricing_schedules where id=c_schedule)<>'legacy_preview'
       or (select maximum_party_size from public.hotel_pricing_schedules where id=c_schedule)<>4
       or (select is_active from public.hotel_pricing_schedules where id=c_schedule)
       or (select review_status from public.hotel_pricing_schedules where id=c_schedule)<>'requires_review'
       or (select source_reference->>'pricing_fingerprint' from public.hotel_pricing_schedules where id=c_schedule)<>v_price_fingerprint
       or exists(
         (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
          from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule where (rule->>'persons')::integer between 2 and 4
          except
          select tier.guest_count,tier.threshold_nights,tier.nightly_rate
          from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_schedule and tier.is_active)
         union all
         (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
          from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_schedule and tier.is_active
          except
          select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
          from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule where (rule->>'persons')::integer between 2 and 4)
       ) then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_pricing_schedule'; end if;
  elsif (v_expected->>'pricing_schedule')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_pricing_schedule_missing'; end if;
  perform 1 from public.hotel_pricing_schedules where id=c_party_preview for update;
  if found then
    if (select hotel_id from public.hotel_pricing_schedules where id=c_party_preview)<>c_hotel
       or (select version from public.hotel_pricing_schedules where id=c_party_preview)<>(v_expected->>'property_party_preview')::bigint
       or (select code from public.hotel_pricing_schedules where id=c_party_preview)<>'legacy-property-party-preview'
       or (select application_scope from public.hotel_pricing_schedules where id=c_party_preview)<>'property_booking_party'
       or (select source from public.hotel_pricing_schedules where id=c_party_preview)<>'legacy_preview'
       or (select maximum_party_size from public.hotel_pricing_schedules where id=c_party_preview)<>8
       or (select is_active from public.hotel_pricing_schedules where id=c_party_preview)
       or (select review_status from public.hotel_pricing_schedules where id=c_party_preview)<>'requires_review'
       or (select source_reference->>'pricing_fingerprint' from public.hotel_pricing_schedules where id=c_party_preview)<>v_price_fingerprint
       or exists(
         (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
          from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule
          except
          select tier.guest_count,tier.threshold_nights,tier.nightly_rate
          from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_party_preview and tier.is_active)
         union all
         (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
          from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_party_preview and tier.is_active
          except
          select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
          from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule)
       ) then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property_party_preview'; end if;
  elsif (v_expected->>'property_party_preview')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_property_party_preview_missing'; end if;
  perform 1 from public.hotel_rate_plans where id=c_plan for update;
  if found then
    if (select hotel_id from public.hotel_rate_plans where id=c_plan)<>c_hotel
       or (select version from public.hotel_rate_plans where id=c_plan)<>(v_expected->>'rate_plan')::bigint
       or (select code from public.hotel_rate_plans where id=c_plan)<>'standard'
       or (select is_active from public.hotel_rate_plans where id=c_plan)
       or (select cancellation_policy->>'type' from public.hotel_rate_plans where id=c_plan)<>'requires_review'
       or (select cancellation_policy->>'reason' from public.hotel_rate_plans where id=c_plan)<>'legacy_cancellation_terms_unconfirmed' then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_rate_plan'; end if;
  elsif (v_expected->>'rate_plan')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_rate_plan_missing'; end if;
  perform 1 from public.hotel_room_rates where id=c_upper_rate for update;
  if found then
    if (select hotel_id from public.hotel_room_rates where id=c_upper_rate)<>c_hotel
       or (select version from public.hotel_room_rates where id=c_upper_rate)<>(v_expected->>'upper_room_rate')::bigint
       or (select room_type_id from public.hotel_room_rates where id=c_upper_rate)<>c_upper
       or (select rate_plan_id from public.hotel_room_rates where id=c_upper_rate)<>c_plan
       or (select pricing_schedule_id from public.hotel_room_rates where id=c_upper_rate)<>c_schedule
       or (select base_nightly_rate from public.hotel_room_rates where id=c_upper_rate)<>0
       or (select currency from public.hotel_room_rates where id=c_upper_rate)<>'EUR'
       or (select is_active from public.hotel_room_rates where id=c_upper_rate) then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_upper_room_rate'; end if;
  elsif (v_expected->>'upper_room_rate')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_upper_room_rate_missing'; end if;
  perform 1 from public.hotel_room_rates where id=c_ground_rate for update;
  if found then
    if (select hotel_id from public.hotel_room_rates where id=c_ground_rate)<>c_hotel
       or (select version from public.hotel_room_rates where id=c_ground_rate)<>(v_expected->>'ground_room_rate')::bigint
       or (select room_type_id from public.hotel_room_rates where id=c_ground_rate)<>c_ground
       or (select rate_plan_id from public.hotel_room_rates where id=c_ground_rate)<>c_plan
       or (select pricing_schedule_id from public.hotel_room_rates where id=c_ground_rate)<>c_schedule
       or (select base_nightly_rate from public.hotel_room_rates where id=c_ground_rate)<>0
       or (select currency from public.hotel_room_rates where id=c_ground_rate)<>'EUR'
       or (select is_active from public.hotel_room_rates where id=c_ground_rate) then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_ground_room_rate'; end if;
  elsif (v_expected->>'ground_room_rate')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_ground_room_rate_missing'; end if;

  select to_jsonb(hotel) into v_before from public.hotels hotel where id=c_hotel;
  if v_hotel.children_policy is distinct from 'minimum_age'
     or v_hotel.minimum_child_age is distinct from 10 then
    update public.hotels set children_policy='minimum_age',minimum_child_age=10
    where id=c_hotel
      and updated_at=v_hotel.updated_at
      and children_policy is not distinct from v_expected_policy_value
      and minimum_child_age is not distinct from v_expected_minimum_age
    returning to_jsonb(hotels.*) into v_after;
    if v_after is null then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property_policy';
    end if;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'property',c_hotel,'update',v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;

  for v_room_json in select value from jsonb_array_elements(p_plan->'rooms') loop
    select to_jsonb(room_type) into v_before from public.hotel_room_types room_type where id=(v_room_json->>'id')::uuid;
    insert into public.hotel_room_types(
      id,hotel_id,code,name_i18n,description_i18n,gallery,capacity_adults,capacity_children,max_occupancy,
      bed_configuration,bathrooms,size_sqm,amenities,inventory_mode,base_inventory_count,status,sort_order,
      children_policy_override,minimum_child_age_override,legacy_source_key
    ) values(
      (v_room_json->>'id')::uuid,c_hotel,lower(btrim(v_room_json->>'code')),v_room_json->'name_i18n',
      coalesce(v_room_json->'description_i18n','{}'::jsonb),v_room_json->'gallery',null,null,4,
      '[]'::jsonb,null,null,array(select value#>>'{}' from jsonb_array_elements(v_room_json->'amenities')),
      'pooled',1,'draft',coalesce((v_room_json->>'sort_order')::integer,1000),null,null,v_room_json->>'source_key'
    ) on conflict(id) do update set
      code=excluded.code,name_i18n=excluded.name_i18n,description_i18n=excluded.description_i18n,
      gallery=excluded.gallery,capacity_adults=null,capacity_children=null,max_occupancy=4,
      amenities=excluded.amenities,inventory_mode='pooled',base_inventory_count=1,sort_order=excluded.sort_order
    returning to_jsonb(hotel_room_types.*) into v_after;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'room_type',(v_room_json->>'id')::uuid,case when v_before is null then 'create' else 'update' end,
      v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end loop;

  select to_jsonb(schedule) into v_schedule_before from public.hotel_pricing_schedules schedule where id=c_schedule;
  if v_schedule_before is null then
    insert into public.hotel_pricing_schedules(
      id,hotel_id,code,name_i18n,application_scope,currency,maximum_party_size,is_active,review_status,source,source_reference
    ) values(
      c_schedule,c_hotel,'shared-apartment-occupancy-los',
      jsonb_build_object('pl','Wspólny cennik apartamentu','en','Shared apartment pricing','he','תמחור דירה משותף'),
      'room_occupancy','EUR',4,false,'requires_review','legacy_preview',
      jsonb_build_object('pricing_model',v_hotel.pricing_model,'pricing_fingerprint',v_price_fingerprint,'rule_count',27,
        'guest_counts',jsonb_build_array(2,3,4),'migration_blocker','requires_h3_shared_schedule_resolution')
    ) returning to_jsonb(hotel_pricing_schedules.*) into v_schedule_after;
    for v_rule in select value from jsonb_array_elements(v_hotel.pricing_tiers->'rules') loop
      continue when (v_rule->>'persons')::integer>4;
      insert into public.hotel_pricing_schedule_occupancy_tiers(
        id,schedule_id,guest_count,threshold_nights,nightly_rate,is_active
      ) values(
        md5(c_schedule::text||':'||(v_rule->>'persons')||':'||(v_rule->>'min_nights'))::uuid,c_schedule,
        (v_rule->>'persons')::smallint,(v_rule->>'min_nights')::integer,(v_rule->>'price_per_night')::numeric,true
      );
    end loop;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'pricing_schedule',c_schedule,'create',null,
      v_schedule_after||jsonb_build_object('tier_count',27),'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;

  select to_jsonb(schedule) into v_schedule_before from public.hotel_pricing_schedules schedule where id=c_party_preview;
  if v_schedule_before is null then
    insert into public.hotel_pricing_schedules(
      id,hotel_id,code,name_i18n,application_scope,currency,maximum_party_size,is_active,review_status,source,source_reference
    ) values(
      c_party_preview,c_hotel,'legacy-property-party-preview',
      jsonb_build_object('pl','Pełny cennik legacy','en','Full legacy pricing preview','he','תצוגת תמחור מורשת מלאה'),
      'property_booking_party','EUR',8,false,'requires_review','legacy_preview',
      jsonb_build_object('pricing_model',v_hotel.pricing_model,'pricing_fingerprint',v_price_fingerprint,'rule_count',63,
        'migration_blocker','requires_h3_multi_room_allocation')
    ) returning to_jsonb(hotel_pricing_schedules.*) into v_schedule_after;
    for v_rule in select value from jsonb_array_elements(v_hotel.pricing_tiers->'rules') loop
      insert into public.hotel_pricing_schedule_occupancy_tiers(
        id,schedule_id,guest_count,threshold_nights,nightly_rate,is_active
      ) values(
        md5(c_party_preview::text||':'||(v_rule->>'persons')||':'||(v_rule->>'min_nights'))::uuid,c_party_preview,
        (v_rule->>'persons')::smallint,(v_rule->>'min_nights')::integer,(v_rule->>'price_per_night')::numeric,true
      );
    end loop;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'pricing_schedule',c_party_preview,'create',null,
      v_schedule_after||jsonb_build_object('tier_count',63),'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;

  select to_jsonb(rate_plan) into v_before from public.hotel_rate_plans rate_plan where id=c_plan;
  if v_before is null then
    insert into public.hotel_rate_plans(id,hotel_id,code,name_i18n,description_i18n,cancellation_policy,is_active,sort_order)
    values(c_plan,c_hotel,'standard',jsonb_build_object('pl','Standard','en','Standard','he','סטנדרטי'),'{}'::jsonb,
      jsonb_build_object('type','requires_review','reason','legacy_cancellation_terms_unconfirmed',
        'summary_i18n',jsonb_build_object('pl','Warunki anulowania wymagają potwierdzenia','en','Cancellation terms require confirmation','he','תנאי הביטול דורשים אישור')),
      false,100)
    returning to_jsonb(hotel_rate_plans.*) into v_after;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'rate_plan',c_plan,'create',null,v_after,
      'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;

  for v_room_json in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('id',c_upper_rate,'room_id',c_upper),jsonb_build_object('id',c_ground_rate,'room_id',c_ground)
  )) loop
    select to_jsonb(room_rate) into v_before from public.hotel_room_rates room_rate where id=(v_room_json->>'id')::uuid;
    if v_before is null then
      insert into public.hotel_room_rates(
        id,hotel_id,room_type_id,rate_plan_id,base_nightly_rate,currency,is_active,sort_order,pricing_schedule_id
      ) values((v_room_json->>'id')::uuid,c_hotel,(v_room_json->>'room_id')::uuid,c_plan,0,'EUR',false,100,c_schedule)
      returning to_jsonb(hotel_room_rates.*) into v_after;
      insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
      values(c_hotel,'room_rate',(v_room_json->>'id')::uuid,'create',null,
        v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
    end if;
  end loop;

  -- Money is copied only from the freshly locked legacy source. Validate the
  -- complete values, not merely the expected 27/63 counts, before returning.
  if exists(
      (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule where (rule->>'persons')::integer between 2 and 4
       except
       select tier.guest_count,tier.threshold_nights,tier.nightly_rate
       from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_schedule and tier.is_active)
      union all
      (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
       from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_schedule and tier.is_active
       except
       select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule where (rule->>'persons')::integer between 2 and 4)
    ) or exists(
      (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule
       except
       select tier.guest_count,tier.threshold_nights,tier.nightly_rate
       from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_party_preview and tier.is_active)
      union all
      (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
       from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_party_preview and tier.is_active
       except
       select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule)
    ) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_shadow_tier_value_mismatch';
  end if;

  return jsonb_build_object(
    'correlation_id',p_correlation_id,'hotel_id',c_hotel,
    'room_type_ids',jsonb_build_array(c_upper,c_ground),'rate_plan_id',c_plan,
    'room_rate_ids',jsonb_build_array(c_upper_rate,c_ground_rate),'pricing_schedule_id',c_schedule,
    'pricing_schedule_tier_count',27,'property_party_preview_id',c_party_preview,
    'property_party_preview_tier_count',63,'public_change',false,
    'workspace',public.hotel_v2_admin_get_property_workspace(c_hotel),
    'activity',(select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at,activity.id),'[]'::jsonb)
      from public.hotel_activity_log activity where activity.correlation_id=p_correlation_id)
  );
end
$function$;

comment on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) is
  'Admin-only exact 7 Arches shadow preparation. Requires an explicit locked guest-policy snapshot; reviewed policy changes, rooms, dormant pricing and activity are one atomic transaction.';

revoke all on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) to authenticated;

do $h2b1_reviewed_policy_fix_postconditions$
declare
  v_snapshot hotels_v2_h2b1_reviewed_policy_fix_snapshot%rowtype;
  v_count bigint; v_fingerprint text; v_definition text;
begin
  for v_snapshot in select * from hotels_v2_h2b1_reviewed_policy_fix_snapshot loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',
      v_snapshot.relation_name
    ) into v_count,v_fingerprint;
    if v_count<>v_snapshot.row_count or v_fingerprint is distinct from v_snapshot.fingerprint then
      raise exception using errcode='55000',message='hotels_v2_h2b1_reviewed_policy_fix_data_changed';
    end if;
  end loop;
  select pg_get_functiondef('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
    into v_definition;
  if v_definition not like '%expected_property_policy%'
     or v_definition not like '%hotels_v2_h2b1_stale_property_policy%'
     or v_definition like '%hotels_v2_h2b1_guest_policy_already_reviewed%'
     or v_definition not like '%hotels_v2_h2b1_unexpected_existing_room_type%'
     or v_definition not like '%perform public.hotel_v2_h2a_require_admin()%'
     or not (select prosecdef from pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
     or not coalesce((select proconfig @> array['search_path=pg_catalog, public, auth']
       from pg_proc where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure),false)
     or has_function_privilege('anon','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h2b1_reviewed_policy_fix_postcondition_failed';
  end if;
end
$h2b1_reviewed_policy_fix_postconditions$;

commit;
