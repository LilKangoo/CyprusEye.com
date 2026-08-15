\set ON_ERROR_STOP on
\ir hotels-v2-h3-2a-partner-access-postgrest-base.sql
\ir ../../supabase/migrations/20260811300000_hotels_v2_h3_1_deferred_room_inventory_trigger_auth_fix.sql

create function pg_temp.admin_a_room_original(p_room_id uuid)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id',room.hotel_id,'source_key',room.legacy_source_key,'code',room.code,
    'name_i18n',room.name_i18n,'description_i18n',room.description_i18n,
    'gallery',room.gallery,
    'amenities',to_jsonb(array(select amenity from unnest(room.amenities) amenity order by amenity)),
    'max_occupancy',room.max_occupancy,'capacity_adults',room.capacity_adults,
    'capacity_children',room.capacity_children,'inventory_mode',room.inventory_mode,
    'base_inventory_count',room.base_inventory_count,'sort_order',room.sort_order
  ) from public.hotel_room_types room where room.id=p_room_id;
$function$;

create function pg_temp.admin_a_shadow_plan(
  p_upper_gallery jsonb,
  p_ground_gallery jsonb
)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,'expected_property_updated_at',hotel.updated_at,
    'reviewed_at',clock_timestamp(),'source_contract','seven_arches_two_apartments_v1',
    'expected_legacy_pricing_fingerprint',md5(hotel.pricing_tiers::text),
    'expected_property_policy',jsonb_build_object(
      'children_policy',hotel.children_policy,'minimum_child_age',hotel.minimum_child_age
    ),
    'expected_versions',jsonb_build_object(
      'upper_room',upper_room.version,'ground_room',ground_room.version,
      'pricing_schedule',(select version from public.hotel_pricing_schedules
        where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'),
      'property_party_preview',(select version from public.hotel_pricing_schedules
        where id='443065c0-984a-5de3-a22a-d03042c41107'),
      'rate_plan',(select version from public.hotel_rate_plans
        where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'),
      'upper_room_rate',(select version from public.hotel_room_rates
        where id='7e420964-9cbf-4f1b-abd3-09840af5240f'),
      'ground_room_rate',(select version from public.hotel_room_rates
        where id='3320590d-632d-423f-80d0-fd021cba7293')
    ),
    'property_policy',jsonb_build_object(
      'children_policy',hotel.children_policy,'minimum_child_age',hotel.minimum_child_age
    ),
    'rooms',jsonb_build_array(
      jsonb_build_object(
        'id',upper_room.id,'expected_version',upper_room.version,
        'expected_original',pg_temp.admin_a_room_original(upper_room.id),
        'source_key','upper_floor_apartment','code','upper-floor-apartment',
        'name_i18n',upper_room.name_i18n,'description_i18n',upper_room.description_i18n,
        'gallery',p_upper_gallery,'amenities',to_jsonb(upper_room.amenities),
        'max_occupancy',4,'sort_order',upper_room.sort_order
      ),
      jsonb_build_object(
        'id',ground_room.id,'expected_version',ground_room.version,
        'expected_original',pg_temp.admin_a_room_original(ground_room.id),
        'source_key','ground_floor_apartment','code','ground-floor-apartment',
        'name_i18n',ground_room.name_i18n,'description_i18n',ground_room.description_i18n,
        'gallery',p_ground_gallery,'amenities',to_jsonb(ground_room.amenities),
        'max_occupancy',4,'sort_order',ground_room.sort_order
      )
    ),
    'prepare_pricing_preview',true
  )
  from public.hotels hotel
  join public.hotel_room_types upper_room on upper_room.id=
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'
  join public.hotel_room_types ground_room on ground_room.id=
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
$function$;

create function pg_temp.admin_a_room_update_plan(p_room_id uuid,p_payload jsonb)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,'expected_property_updated_at',hotel.updated_at,
    'reviewed_at',clock_timestamp(),
    'operation',jsonb_build_object(
      'type','update','id',room.id,'expected_version',room.version,'payload',p_payload
    )
  )
  from public.hotels hotel join public.hotel_room_types room on room.id=p_room_id
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
$function$;

-- Reproduce production: a generic Admin room edit removed Upper photos after
-- H3.1P promotion.  Ground remains the reviewed five-photo sibling.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_apply_room_type_plan(
  pg_temp.admin_a_room_update_plan(
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94','{"gallery":[]}'::jsonb
  ),'a3300000-0000-4000-8000-000000000001');
commit;

create temporary table admin_a_protected_before(
  relation_name text primary key,
  fingerprint text not null
) on commit preserve rows;

do $capture_protected$
declare v_relation text;
begin
      foreach v_relation in array array[
        'hotels','hotel_bookings','partner_service_fulfillments','site_settings',
        'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
        'service_coupons','service_coupon_redemptions',
        'hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules',
        'hotel_pricing_schedule_occupancy_tiers','hotel_room_allocation_rules',
        'hotel_room_allocation_rule_items','hotel_pricing_promotion_reviews',
        'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
        'hotel_partner_event_outbox','referrals','affiliate_commission_events',
        'affiliate_payouts','affiliate_adjustments','affiliate_program_settings',
        'affiliate_referrer_overrides','affiliate_cashout_requests',
        'profile_referral_code_aliases'
      ] loop
        if to_regclass('public.'||v_relation) is not null then
          execute format(
            'insert into admin_a_protected_before select %L,md5(coalesce(string_agg('
            ||'to_jsonb(row_value)::text,''|'' order by to_jsonb(row_value)::text),'''')) '
            ||'from public.%I row_value',v_relation,v_relation
          );
        end if;
      end loop;
end
$capture_protected$;

-- RED: before the repair, even a fresh Review fails deterministically because
-- the promoted schedule is reviewed rather than requires_review. Capture all
-- PostgreSQL diagnostics before applying the additive repair.
create temporary table admin_a_red_diagnostics(
  returned_sqlstate text,message_text text,exception_detail text,
  exception_hint text,exception_context text
) on commit preserve rows;

do $red_post_promotion_failure$
declare
  v_state text; v_message text; v_detail text; v_hint text; v_context text;
  v_upper_gallery jsonb; v_ground_gallery jsonb;
begin
  select jsonb_agg(photo.value order by photo.ordinal)
  into v_upper_gallery
  from public.hotels hotel
  cross join lateral jsonb_array_elements(hotel.photos) with ordinality photo(value,ordinal)
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and photo.ordinal<=6;
  select gallery into v_ground_gallery from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      pg_temp.admin_a_shadow_plan(v_upper_gallery,v_ground_gallery),
      'a3300000-0000-4000-8000-000000000002');
  exception when others then
    get stacked diagnostics
      v_state=returned_sqlstate,v_message=message_text,
      v_detail=pg_exception_detail,v_hint=pg_exception_hint,
      v_context=pg_exception_context;
  end;
  reset role;
  insert into admin_a_red_diagnostics values(
    v_state,v_message,v_detail,v_hint,v_context
  );
  if v_state<>'PT409'
     or v_message<>'hotels_v2_h2b1_stale_pricing_schedule'
     or nullif(v_detail,'') is not null or nullif(v_hint,'') is not null
     or v_context not like '%hotel_v2_admin_prepare_legacy_shadow_rooms%' then
    raise exception 'admin_a_red_diagnostic_mismatch: %/%/%/%/%',
      v_state,v_message,v_detail,v_hint,v_context;
  end if;
  if exists(select 1 from public.hotel_activity_log
       where correlation_id='a3300000-0000-4000-8000-000000000002') then
    raise exception 'admin_a_red_failure_wrote_activity';
  end if;
end
$red_post_promotion_failure$;

-- Override production defaults with this disposable fixture's exact baseline.
select set_config('hotels_v2.admin_a_expected_property_updated_at',
  (select updated_at::text from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),false);
select set_config('hotels_v2.admin_a_expected_property_gallery_fingerprint',
  (select md5(photos::text) from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),false);
select set_config('hotels_v2.admin_a_expected_upper_version',
  (select version::text from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),false);
select set_config('hotels_v2.admin_a_expected_upper_gallery_fingerprint',
  (select md5(gallery::text) from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),false);
select set_config('hotels_v2.admin_a_expected_ground_version',
  (select version::text from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),false);
select set_config('hotels_v2.admin_a_expected_ground_gallery_fingerprint',
  (select md5(gallery::text) from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),false);
select set_config('hotels_v2.admin_a_expected_schedule_version',
  (select version::text from public.hotel_pricing_schedules
    where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'),false);
select set_config('hotels_v2.admin_a_expected_party_schedule_version',
  (select version::text from public.hotel_pricing_schedules
    where id='443065c0-984a-5de3-a22a-d03042c41107'),false);
select set_config('hotels_v2.admin_a_expected_rate_plan_version',
  (select version::text from public.hotel_rate_plans
    where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'),false);
select set_config('hotels_v2.admin_a_expected_upper_rate_version',
  (select version::text from public.hotel_room_rates
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'),false);
select set_config('hotels_v2.admin_a_expected_ground_rate_version',
  (select version::text from public.hotel_room_rates
    where id='3320590d-632d-423f-80d0-fd021cba7293'),false);
select set_config('hotels_v2.admin_a_expected_target_fingerprint',
  (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{target,target_fingerprint}'),false);
select set_config('hotels_v2.admin_a_expected_booking_count',
  (select count(*)::text from public.hotel_bookings),false);
select set_config('hotels_v2.admin_a_expected_booking_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.hotel_bookings row_value),false);
select set_config('hotels_v2.admin_a_expected_fulfillment_count',
  (select count(*)::text from public.partner_service_fulfillments
    where resource_type='hotels'),false);
select set_config('hotels_v2.admin_a_expected_fulfillment_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.partner_service_fulfillments row_value where resource_type='hotels'),false);
select set_config('hotels_v2.admin_a_expected_deposit_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.service_deposit_requests row_value where resource_type='hotels'),false);
select set_config('hotels_v2.admin_a_expected_coupon_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
    from public.service_coupon_redemptions row_value where service_type='hotels'),false);

\ir ../../supabase/manual/hotels_v2_admin_a_room_gallery_post_promotion_preflight.sql
\ir ../../supabase/migrations/20260811330000_hotels_v2_admin_a_room_gallery_post_promotion_repair.sql
\ir ../../supabase/manual/hotels_v2_admin_a_room_gallery_post_promotion_verify.sql

-- Authenticated-only and Admin authorization remain authoritative.
do $authorization$
declare v_denied boolean:=false;
begin
  begin
    set local role anon;
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      '{}'::jsonb,'a3300000-0000-4000-8000-000000000003');
  exception when insufficient_privilege then v_denied:=true; end;
  reset role;
  if not v_denied then raise exception 'admin_a_anon_was_allowed'; end if;

  v_denied:=false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      '{}'::jsonb,'a3300000-0000-4000-8000-000000000004');
  exception when insufficient_privilege then v_denied:=true; end;
  reset role;
  if not v_denied then raise exception 'admin_a_non_admin_was_allowed'; end if;
end
$authorization$;

-- GREEN 1: one explicit fresh Review restores Upper only; Ground is an exact
-- no-op and therefore keeps its version and emits no sibling activity.
do $restore_gallery$
declare
  v_upper_gallery jsonb; v_ground_gallery jsonb; v_result jsonb;
  v_upper_before bigint; v_ground_before bigint;
begin
  select jsonb_agg(photo.value order by photo.ordinal) into v_upper_gallery
  from public.hotels hotel
  cross join lateral jsonb_array_elements(hotel.photos) with ordinality photo(value,ordinal)
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and photo.ordinal<=6;
  select gallery,version into v_ground_gallery,v_ground_before
  from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  select version into v_upper_before from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_result:=public.hotel_v2_admin_prepare_legacy_shadow_rooms(
    pg_temp.admin_a_shadow_plan(v_upper_gallery,v_ground_gallery),
    'a3300000-0000-4000-8000-000000000005');
  reset role;
  if jsonb_array_length(v_result->'activity')<>1
     or (select version from public.hotel_room_types
       where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')<>v_upper_before+1
     or (select gallery from public.hotel_room_types
       where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94') is distinct from v_upper_gallery
     or (select version from public.hotel_room_types
       where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')<>v_ground_before
     or (select count(*) from public.hotel_activity_log
       where correlation_id='a3300000-0000-4000-8000-000000000005')<>1
     or exists(select 1 from public.hotel_activity_log
       where correlation_id='a3300000-0000-4000-8000-000000000005'
         and entity_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3') then
    raise exception 'admin_a_restore_gallery_failed:%',v_result;
  end if;
end
$restore_gallery$;

-- GREEN 2: exact repeated Save returns success with no version or activity.
do $exact_noop$
declare
  v_result jsonb; v_upper jsonb; v_ground jsonb;
  v_upper_version bigint; v_ground_version bigint;
begin
  select gallery,version into v_upper,v_upper_version from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  select gallery,version into v_ground,v_ground_version from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_result:=public.hotel_v2_admin_prepare_legacy_shadow_rooms(
    pg_temp.admin_a_shadow_plan(v_upper,v_ground),
    'a3300000-0000-4000-8000-000000000006');
  reset role;
  if jsonb_array_length(v_result->'activity')<>0
     or (select version from public.hotel_room_types
       where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')<>v_upper_version
     or (select version from public.hotel_room_types
       where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')<>v_ground_version
     or exists(select 1 from public.hotel_activity_log
       where correlation_id='a3300000-0000-4000-8000-000000000006') then
    raise exception 'admin_a_exact_noop_failed:%',v_result;
  end if;
end
$exact_noop$;

-- GREEN 3: a second legitimate Upper gallery edit succeeds, persists exactly,
-- and still does not change the Ground sibling.
do $second_edit$
declare
  v_target jsonb; v_ground jsonb; v_result jsonb;
  v_upper_version bigint; v_ground_version bigint;
begin
  select jsonb_agg(photo.value order by photo.ordinal) into v_target
  from public.hotels hotel
  cross join lateral jsonb_array_elements(hotel.photos) with ordinality photo(value,ordinal)
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and photo.ordinal<=5;
  select version into v_upper_version from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  select gallery,version into v_ground,v_ground_version from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_result:=public.hotel_v2_admin_prepare_legacy_shadow_rooms(
    pg_temp.admin_a_shadow_plan(v_target,v_ground),
    'a3300000-0000-4000-8000-000000000007');
  reset role;
  if jsonb_array_length(v_result->'activity')<>1
     or (select gallery from public.hotel_room_types
       where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94') is distinct from v_target
     or (select version from public.hotel_room_types
       where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94')<>v_upper_version+1
     or (select version from public.hotel_room_types
       where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')<>v_ground_version then
    raise exception 'admin_a_second_edit_failed:%',v_result;
  end if;
end
$second_edit$;

-- TRUE CONFLICT: current gallery differs from both reviewed ORIGINAL and
-- TARGET. The detailed gallery PT409 must win over the final version guard.
do $true_gallery_conflict$
declare
  v_plan jsonb; v_target jsonb; v_concurrent jsonb; v_ground jsonb;
  v_state text; v_message text; v_detail text; v_ground_version bigint;
begin
  select jsonb_agg(photo.value order by photo.ordinal) into v_target
  from public.hotels hotel
  cross join lateral jsonb_array_elements(hotel.photos) with ordinality photo(value,ordinal)
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and photo.ordinal<=6;
  select jsonb_agg(photo.value order by photo.ordinal) into v_concurrent
  from public.hotels hotel
  cross join lateral jsonb_array_elements(hotel.photos) with ordinality photo(value,ordinal)
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
    and photo.ordinal between 3 and 6;
  select gallery,version into v_ground,v_ground_version from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_plan:=pg_temp.admin_a_shadow_plan(v_target,v_ground);

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  perform public.hotel_v2_admin_apply_room_type_plan(
    pg_temp.admin_a_room_update_plan(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',jsonb_build_object('gallery',v_concurrent)
    ),'a3300000-0000-4000-8000-000000000008');
  begin
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      v_plan,'a3300000-0000-4000-8000-000000000009');
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text,
      v_detail=pg_exception_detail;
  end;
  reset role;
  if v_state<>'PT409'
     or v_message<>'hotels_v2_h2b1_shadow_room_three_way_conflict'
     or (v_detail::jsonb->>'room_id')::uuid<>
       'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'
     or v_detail::jsonb->>'field'<>'gallery'
     or (select gallery from public.hotel_room_types
       where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94') is distinct from v_concurrent
     or (select version from public.hotel_room_types
       where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')<>v_ground_version
     or exists(select 1 from public.hotel_activity_log
       where correlation_id='a3300000-0000-4000-8000-000000000009') then
    raise exception 'admin_a_true_gallery_conflict_failed:%/%/%',v_state,v_message,v_detail;
  end if;
end
$true_gallery_conflict$;

-- A version change caused only by an unowned field cannot be merged blindly.
do $unowned_version_conflict$
declare
  v_plan jsonb; v_upper jsonb; v_ground jsonb;
  v_state text; v_message text;
begin
  select gallery into v_upper from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  select gallery into v_ground from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_plan:=pg_temp.admin_a_shadow_plan(v_upper,v_ground);
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  perform public.hotel_v2_admin_apply_room_type_plan(
    pg_temp.admin_a_room_update_plan(
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94','{"bathrooms":1}'::jsonb
    ),'a3300000-0000-4000-8000-000000000010');
  begin
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      v_plan,'a3300000-0000-4000-8000-000000000011');
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
  end;
  reset role;
  if v_state<>'PT409' or v_message<>'hotels_v2_h2b1_stale_shadow_room'
     or exists(select 1 from public.hotel_activity_log
       where correlation_id='a3300000-0000-4000-8000-000000000011') then
    raise exception 'admin_a_unowned_version_conflict_failed:%/%',v_state,v_message;
  end if;
end
$unowned_version_conflict$;

-- A later, freshly reviewed unrelated property edit and a semantic no-op Rate
-- Plan version bump must not revive the permanent pricing-schedule conflict.
begin;
update public.hotels set minimum_stay_nights=3
where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  pg_temp.admin_a_shadow_plan(
    (select gallery from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),
    (select gallery from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
  ),'a3300000-0000-4000-8000-000000000012');
rollback;

begin;
update public.hotel_rate_plans set name_i18n=name_i18n
where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  pg_temp.admin_a_shadow_plan(
    (select gallery from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),
    (select gallery from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
  ),'a3300000-0000-4000-8000-000000000013');
rollback;

-- The decoupling is narrow: corrupt stored pricing occupancy still fails the
-- reviewed schedule gate even though expected-value mapping/parity helpers can
-- otherwise remain equal.
begin;
set constraints hotel_room_allocation_rules_contract_guard,
  hotel_room_allocation_rule_items_contract_guard deferred;
update public.hotel_room_allocation_rule_items item set pricing_guest_count=null
from public.hotel_room_allocation_rules rule
where rule.id=item.allocation_rule_id
  and rule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
  and rule.code='guests-5-bundle'
  and item.room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
do $stored_mapping_guard$
declare v_state text; v_message text;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_prepare_legacy_shadow_rooms(
      pg_temp.admin_a_shadow_plan(
        (select gallery from public.hotel_room_types where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),
        (select gallery from public.hotel_room_types where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
      ),'a3300000-0000-4000-8000-000000000014');
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
  end;
  reset role;
  if v_state<>'PT409' or v_message<>'hotels_v2_h2b1_stale_pricing_schedule' then
    raise exception 'admin_a_stored_mapping_guard_failed:%/%',v_state,v_message;
  end if;
end
$stored_mapping_guard$;
rollback;

-- No legacy/public/history/commercial graph mutation escaped the deliberate
-- isolated Room Type edits above.
do $protected_after$
declare v_row admin_a_protected_before%rowtype; v_fingerprint text;
begin
  for v_row in select * from admin_a_protected_before loop
    execute format(
      'select md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' '
      ||'order by to_jsonb(row_value)::text),'''')) from public.%I row_value',
      v_row.relation_name
    ) into v_fingerprint;
    if v_fingerprint is distinct from v_row.fingerprint then
      raise exception 'admin_a_protected_relation_changed:%',v_row.relation_name;
    end if;
  end loop;
  if not exists(select 1 from public.hotels
       where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
         and architecture_version='legacy'
         and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03')
     or exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)) then
    raise exception 'admin_a_legacy_or_flags_changed';
  end if;
end
$protected_after$;

select * from admin_a_red_diagnostics;
select 'HOTELS_V2_ADMIN_A_ROOM_GALLERY_POST_PROMOTION_POSTGRES_GATE_PASS' result;
