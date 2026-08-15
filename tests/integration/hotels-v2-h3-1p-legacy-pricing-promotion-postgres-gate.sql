\set ON_ERROR_STOP on
\ir hotels-v2-h3-1p-postgrest-base.sql
\ir ../../supabase/manual/hotels_v2_h3_1_legacy_pricing_promotion_verify.sql

create function pg_temp.h31p_promotion_plan(p_ack boolean default true)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id',preview.value->>'hotel_id',
    'reviewed_at',clock_timestamp(),
    'snapshot_token',preview.value->>'snapshot_token',
    'expected',preview.value->'expected',
    'decision','promote_room_schedule_to_reviewed',
    'acknowledge_pricing_occupancy_mapping',p_ack
  )
  from (select public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca') value) preview;
$function$;

create function pg_temp.h31p_rule_five_fingerprint()
returns text language sql stable security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select public.hotel_v2_h3_1_allocation_items_fingerprint(rule.id)
  from public.hotel_room_allocation_rules rule
  where rule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
    and rule.code='guests-5-bundle';
$function$;

create function pg_temp.h31p_rule_five_plan(
  p_upper_alloc integer,
  p_ground_alloc integer,
  p_upper_pricing integer,
  p_ground_pricing integer,
  p_action text default 'update'
)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,
    'expected_property_updated_at',hotel.updated_at,
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','allocation_rule','type',p_action,'id',rule.id,
      'expected_version',rule.version,
      'expected_children_fingerprint',
        public.hotel_v2_h3_1_allocation_items_fingerprint(rule.id),
      'payload',case when p_action='disable' then '{}'::jsonb else jsonb_build_object(
        'code',rule.code,'allocation_mode',rule.allocation_mode,
        'min_guest_count',rule.min_guest_count,'max_guest_count',rule.max_guest_count,
        'is_active',rule.is_active,'review_status',rule.review_status,
        'sort_order',rule.sort_order,
        'items',(select jsonb_agg(jsonb_build_object(
          'id',item.id,'room_type_id',item.room_type_id,
          'units_required',item.units_required,
          'allocated_guest_count',case item.room_type_id
            when 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid then p_upper_alloc
            else p_ground_alloc end,
          'pricing_guest_count',case item.room_type_id
            when 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid then p_upper_pricing
            else p_ground_pricing end,
          'sort_order',item.sort_order
        ) order by item.sort_order,item.id)
        from public.hotel_room_allocation_rule_items item
        where item.allocation_rule_id=rule.id)
      ) end
    ))
  )
  from public.hotels hotel
  join public.hotel_room_allocation_rules rule
    on rule.hotel_id=hotel.id and rule.code='guests-5-bundle'
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
$function$;

do $foundation$
declare v_preview jsonb;
begin
  v_preview:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if not (v_preview->>'supported')::boolean
     or v_preview#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or (v_preview#>>'{source,rule_count}')::integer<>63
     or (v_preview#>>'{target,room_schedule,tier_count}')::integer<>27
     or (v_preview#>>'{parity,total_case_count}')::integer<>70
     or (v_preview#>>'{parity,total_mismatch_count}')::integer<>0
     or v_preview#>>'{promotion,status}'<>'not_reviewed'
     or exists(select 1 from public.hotel_room_allocation_rule_items
       where pricing_guest_count is not null) then
    raise exception 'h31p_foundation_verify_failed: %',v_preview->'blockers';
  end if;
end
$foundation$;

-- Raw/API authorization: only an authenticated Admin may reach either RPC.
do $anon_denied$
begin
  set local role anon;
  perform public.hotel_v2_admin_get_legacy_pricing_promotion_preview(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  raise exception 'h31p_anon_preview_was_allowed';
exception when insufficient_privilege then null;
end
$anon_denied$;

do $non_admin_denied$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  perform public.hotel_v2_admin_get_legacy_pricing_promotion_preview(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  raise exception 'h31p_non_admin_preview_was_allowed';
exception when insufficient_privilege then null;
end
$non_admin_denied$;

do $partner_denied$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  perform public.hotel_v2_admin_apply_legacy_pricing_promotion(
    pg_temp.h31p_promotion_plan(),gen_random_uuid());
  raise exception 'h31p_partner_apply_was_allowed';
exception when insufficient_privilege then null;
end
$partner_denied$;

-- Generic H3.1 remains a NULL-preserving editor before the dedicated review.
do $generic_sole_writer$
declare v_failed boolean:=false; v_result jsonb;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      pg_temp.h31p_rule_five_plan(3,2,2,2),
      '73100000-0000-4000-8000-000000000001');
  exception when sqlstate '55000' then
    if sqlerrm='hotels_v2_h3_1p_dedicated_pricing_promotion_required' then
      v_failed:=true;
    else raise;
    end if;
  end;
  if not v_failed or exists(select 1 from public.hotel_activity_log
      where correlation_id='73100000-0000-4000-8000-000000000001')
     or exists(select 1 from public.hotel_room_allocation_rule_items
      where pricing_guest_count is not null) then
    raise exception 'h31p_generic_pre_receipt_nonnull_guard_failed';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_result:=public.hotel_v2_admin_apply_h3_1_configuration(
    pg_temp.h31p_rule_five_plan(3,2,null,null),
    '73100000-0000-4000-8000-000000000002');
  if v_result#>>'{configuration,allocation_rules,1,items,0,pricing_guest_count}' is not null
     or exists(select 1 from public.hotel_room_allocation_rule_items
       where pricing_guest_count is not null) then
    raise exception 'h31p_generic_pre_receipt_null_roundtrip_failed';
  end if;
end
$generic_sole_writer$;

do $review_guards$
declare v_failed boolean:=false; v_plan jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  begin
    v_plan:=jsonb_set(jsonb_set(pg_temp.h31p_promotion_plan(),
      '{hotel_id}','null'::jsonb),'{decision}','null'::jsonb);
    perform public.hotel_v2_admin_apply_legacy_pricing_promotion(
      v_plan,'73100000-0000-4000-8000-000000000013');
  exception when sqlstate '22023' then
    if sqlerrm='hotels_v2_h3_pricing_promotion_unsupported_contract' then
      v_failed:=true;
    else raise;
    end if;
  end;
  if not v_failed or exists(select 1 from public.hotel_pricing_promotion_reviews)
     or exists(select 1 from public.hotel_room_allocation_rule_items
       where pricing_guest_count is not null) then
    raise exception 'h31p_null_identity_contract_guard_failed';
  end if;

  v_failed:=false;
  begin
    v_plan:=jsonb_set(pg_temp.h31p_promotion_plan(),'{reviewed_at}','null'::jsonb);
    perform public.hotel_v2_admin_apply_legacy_pricing_promotion(
      v_plan,'73100000-0000-4000-8000-000000000014');
  exception when sqlstate '22023' then
    if sqlerrm='hotels_v2_h3_pricing_promotion_invalid_plan' then
      v_failed:=true;
    else raise;
    end if;
  end;
  if not v_failed or exists(select 1 from public.hotel_pricing_promotion_reviews)
     or exists(select 1 from public.hotel_room_allocation_rule_items
       where pricing_guest_count is not null) then
    raise exception 'h31p_null_reviewed_at_guard_failed';
  end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_legacy_pricing_promotion(
      pg_temp.h31p_promotion_plan(false),'73100000-0000-4000-8000-000000000003');
  exception when sqlstate '22023' then
    if sqlerrm='hotels_v2_h3_pricing_promotion_pricing_occupancy_ack_required' then
      v_failed:=true;
    else raise;
    end if;
  end;
  if not v_failed then raise exception 'h31p_ack_guard_failed'; end if;

  v_failed:=false;
  v_plan:=jsonb_set(pg_temp.h31p_promotion_plan(),'{snapshot_token}','"stale"'::jsonb);
  begin
    perform public.hotel_v2_admin_apply_legacy_pricing_promotion(
      v_plan,'73100000-0000-4000-8000-000000000004');
  exception when sqlstate 'PT409' then
    if sqlerrm='hotels_v2_h3_pricing_promotion_stale_review' then v_failed:=true; else raise; end if;
  end;
  if not v_failed or exists(select 1 from public.hotel_pricing_promotion_reviews)
     or exists(select 1 from public.hotel_room_allocation_rule_items
       where pricing_guest_count is not null) then
    raise exception 'h31p_stale_atomic_guard_failed';
  end if;
end
$review_guards$;

-- Idempotent already-at-target state: zero item updates remains promotable.
begin;
update public.hotel_room_allocation_rule_items item
set pricing_guest_count=public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id)
from public.hotel_room_allocation_rules rule
where rule.id=item.allocation_rule_id and rule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
  and rule.allocation_mode='required_bundle';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.hotel_v2_admin_apply_legacy_pricing_promotion(
  pg_temp.h31p_promotion_plan(),'73100000-0000-4000-8000-000000000005');
rollback;

create temporary table h31p_protected_before(relation_name text primary key,fingerprint text not null);
insert into h31p_protected_before values
  ('hotels',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotels row_value)),
  ('hotel_bookings',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_bookings row_value)),
  ('partner_service_fulfillments',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.partner_service_fulfillments row_value)),
  ('service_deposit_requests',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.service_deposit_requests row_value)),
  ('service_coupon_redemptions',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.service_coupon_redemptions row_value)),
  ('hotel_room_types',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_room_types row_value)),
  ('hotel_rate_plans',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_rate_plans row_value)),
  ('hotel_room_rates',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_room_rates row_value)),
  ('tiers',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_pricing_schedule_occupancy_tiers row_value)),
  ('site_settings',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.site_settings row_value));

do $apply_and_replay$
declare v_result jsonb; v_plan jsonb; v_activity_count integer; v_failed boolean:=false;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_plan:=pg_temp.h31p_promotion_plan();
  v_result:=public.hotel_v2_admin_apply_legacy_pricing_promotion(
    v_plan,'73100000-0000-4000-8000-000000000006');
  if not (v_result->>'ok')::boolean or (v_result->>'replayed')::boolean
     or (v_result#>>'{parity,total_mismatch_count}')::integer<>0 then
    raise exception 'h31p_apply_result_failed';
  end if;
  select count(*) into v_activity_count from public.hotel_activity_log
    where correlation_id='73100000-0000-4000-8000-000000000006';
  v_result:=public.hotel_v2_admin_apply_legacy_pricing_promotion(
    v_plan,'73100000-0000-4000-8000-000000000006');
  if not (v_result->>'replayed')::boolean
     or (select count(*) from public.hotel_activity_log
       where correlation_id='73100000-0000-4000-8000-000000000006')<>v_activity_count
     or (select count(*) from public.hotel_pricing_promotion_reviews)<>1 then
    raise exception 'h31p_idempotent_replay_failed';
  end if;

  begin
    perform public.hotel_v2_admin_apply_legacy_pricing_promotion(
      pg_temp.h31p_promotion_plan(),'73100000-0000-4000-8000-000000000007');
  exception when sqlstate 'PT409' then
    if sqlerrm='hotels_v2_h3_pricing_promotion_already_reviewed' then v_failed:=true; else raise; end if;
  end;
  if not v_failed then raise exception 'h31p_second_review_guard_failed'; end if;
end
$apply_and_replay$;

do $post_receipt_generic_guards$
declare v_failed boolean; v_before text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  perform public.hotel_v2_admin_apply_h3_1_configuration(
    pg_temp.h31p_rule_five_plan(3,2,2,2),
    '73100000-0000-4000-8000-000000000008');

  v_before:=pg_temp.h31p_rule_five_fingerprint();
  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      pg_temp.h31p_rule_five_plan(3,2,null,2),
      '73100000-0000-4000-8000-000000000009');
  exception when check_violation then v_failed:=true;
  end;
  if not v_failed or pg_temp.h31p_rule_five_fingerprint()<>v_before then
    raise exception 'h31p_post_receipt_null_guard_failed';
  end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      pg_temp.h31p_rule_five_plan(3,2,3,2),
      '73100000-0000-4000-8000-000000000010');
  exception when check_violation then v_failed:=true;
  end;
  if not v_failed or pg_temp.h31p_rule_five_fingerprint()<>v_before then
    raise exception 'h31p_post_receipt_altered_guard_failed';
  end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      pg_temp.h31p_rule_five_plan(2,3,2,2),
      '73100000-0000-4000-8000-000000000011');
  exception when check_violation then v_failed:=true;
  end;
  if not v_failed or pg_temp.h31p_rule_five_fingerprint()<>v_before then
    raise exception 'h31p_post_receipt_physical_swap_guard_failed';
  end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      pg_temp.h31p_rule_five_plan(3,2,2,2,'disable'),
      '73100000-0000-4000-8000-000000000012');
  exception when check_violation then v_failed:=true;
  end;
  if not v_failed or pg_temp.h31p_rule_five_fingerprint()<>v_before then
    raise exception 'h31p_post_receipt_disable_guard_failed';
  end if;
end
$post_receipt_generic_guards$;

do $final_contract$
declare v_preview jsonb; v_snapshot record; v_current text;
begin
  v_preview:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if not (v_preview->>'supported')::boolean
     or v_preview#>>'{promotion,status}'<>'reviewed'
     or v_preview#>>'{target,room_schedule,review_status}'<>'reviewed'
     or (v_preview#>>'{target,room_schedule,is_active}')::boolean
     or (v_preview#>>'{parity,total_case_count}')::integer<>70
     or (v_preview#>>'{parity,total_mismatch_count}')::integer<>0
     or (select count(*) from public.hotel_room_allocation_rule_items
       where pricing_guest_count is not null)<>8
     or (select architecture_version from public.hotels
       where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>'legacy'
     or exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)) then
    raise exception 'h31p_final_contract_failed: %',v_preview->'blockers';
  end if;

  for v_snapshot in select * from h31p_protected_before loop
    execute case v_snapshot.relation_name
      when 'tiers' then 'select md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.hotel_pricing_schedule_occupancy_tiers row_value'
      else format('select md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',v_snapshot.relation_name)
    end into v_current;
    if v_current is distinct from v_snapshot.fingerprint then
      raise exception 'h31p_protected_state_changed: %',v_snapshot.relation_name;
    end if;
  end loop;
end
$final_contract$;

\ir ../../supabase/manual/hotels_v2_h3_1_legacy_pricing_promotion_post_admin_verify.sql

select
  0 as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  0 as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true hotels_v2_h3_1p_legacy_pricing_promotion_postgres_gate_pass;
