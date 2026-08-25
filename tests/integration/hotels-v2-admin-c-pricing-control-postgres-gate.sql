\set ON_ERROR_STOP on
\ir hotels-v2-admin-c-pricing-control-postgrest-base.sql

-- ADMIN-C executable PostgreSQL gate. All reviewed mutations are rolled back;
-- the accepted 7 Kamares receipt/oracle and every public feature flag remain
-- byte-stable in the disposable fixture.
create function pg_temp.admin_c_operation(
  p_entity text,p_action text,p_id uuid,p_expected_version bigint,
  p_expected_children text,p_expected_link text,p_expected_links jsonb,
  p_shared_ack boolean,p_activation_ack boolean,p_original jsonb,p_payload jsonb
) returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select jsonb_build_object(
    'entity',p_entity,'action',p_action,'id',p_id,
    'expected_version',p_expected_version,
    'expected_children_fingerprint',p_expected_children,
    'expected_link_fingerprint',p_expected_link,
    'expected_linked_room_rate_ids',p_expected_links,
    'shared_impact_acknowledged',p_shared_ack,
    'activation_acknowledged',p_activation_ack,
    'expected_original',p_original,'payload',p_payload)
$function$;

create function pg_temp.admin_c_plan(
  p_hotel_id uuid,p_snapshot text,p_operations jsonb,p_reviewed_at text default null
) returns jsonb language sql stable set search_path=pg_catalog as $function$
  select jsonb_build_object(
    'contract_version','hotels_v2_admin_c_pricing_plan_v1',
    'hotel_id',p_hotel_id,'snapshot_token',p_snapshot,
    'reviewed_at',coalesce(p_reviewed_at,to_char(clock_timestamp() at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
    'operations',p_operations)
$function$;

create function pg_temp.admin_c_preview(
  p_hotel_id uuid,p_snapshot text,p_plan_id uuid,p_rule_id uuid,
  p_room_id uuid,p_check_in date,p_nights integer,p_adults integer,
  p_child_ages jsonb default '[]'::jsonb
) returns jsonb language sql stable set search_path=pg_catalog,public as $function$
  select public.hotel_v2_admin_preview_pricing_quote(jsonb_build_object(
    'contract_version','hotels_v2_admin_c_pricing_preview_v1',
    'hotel_id',p_hotel_id,'snapshot_token',p_snapshot,
    'rate_plan_id',p_plan_id,'allocation_rule_id',p_rule_id,
    'selected_room_type_id',p_room_id,'check_in',p_check_in,
    'check_out',p_check_in+p_nights,'adults',p_adults,'child_ages',p_child_ages))
$function$;

create function pg_temp.admin_c_calendar_plan(
  p_hotel_id uuid,p_from date,p_to date,p_snapshot text,p_operations jsonb
) returns jsonb language sql stable set search_path=pg_catalog as $function$
  select jsonb_build_object(
    'hotel_id',p_hotel_id,'from',p_from,'to',p_to,
    'reviewed_at',to_char(clock_timestamp() at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'snapshot_token',p_snapshot,'operations',p_operations)
$function$;

create function pg_temp.admin_c_exact_price_state(p_row jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select jsonb_build_object(
    'nightly_rate_mode',p_row->'nightly_rate_mode',
    'nightly_rate',p_row->'nightly_rate',
    'minimum_stay_mode',p_row->'minimum_stay_mode',
    'minimum_stay',p_row->'minimum_stay',
    'maximum_stay_mode',p_row->'maximum_stay_mode',
    'maximum_stay',p_row->'maximum_stay',
    'reason',p_row->'pricing_reason',
    'expires_at',p_row->'pricing_expires_at')
$function$;

create function pg_temp.admin_c_direct_tier_state(p_rate jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select jsonb_build_object('tiers',coalesce(jsonb_agg(jsonb_build_object(
    'id',tier.value->>'id','hotel_id',tier.value->>'hotel_id',
    'room_rate_id',tier.value->>'room_rate_id',
    'guest_count',(tier.value->>'guest_count')::integer,
    'threshold_nights',(tier.value->>'threshold_nights')::integer,
    'nightly_rate',(tier.value->>'nightly_rate')::numeric,
    'is_active',(tier.value->>'is_active')::boolean,
    'version',(tier.value->>'version')::bigint)
    order by (tier.value->>'guest_count')::integer,
      (tier.value->>'threshold_nights')::integer,tier.value->>'id'),'[]'::jsonb))
  from jsonb_array_elements(coalesce(p_rate->'independent_tiers','[]'::jsonb)) tier(value)
$function$;

create function pg_temp.admin_c_schedule_tier_state(p_schedule jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',tier.value->>'id','schedule_id',tier.value->>'schedule_id',
    'guest_count',(tier.value->>'guest_count')::integer,
    'threshold_nights',(tier.value->>'threshold_nights')::integer,
    'nightly_rate',(tier.value->>'nightly_rate')::numeric,
    'is_active',(tier.value->>'is_active')::boolean,
    'version',(tier.value->>'version')::bigint)
    order by (tier.value->>'guest_count')::integer,
      (tier.value->>'threshold_nights')::integer,tier.value->>'id'),'[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_schedule->'tiers')='array'
    then p_schedule->'tiers' else '[]'::jsonb end) tier(value)
$function$;

create function pg_temp.admin_c_rate_plan_state(p_row jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select jsonb_build_object('code',p_row->>'code','name_i18n',p_row->'name_i18n',
    'description_i18n',p_row->'description_i18n','meal_plan_code',p_row->'meal_plan_code',
    'cancellation_policy',p_row->'cancellation_policy',
    'booking_mode_override',p_row->'booking_mode_override',
    'price_inclusions',p_row->'price_inclusions','lifecycle_status',p_row->>'lifecycle_status',
    'sort_order',(p_row->>'sort_order')::integer)
$function$;

create function pg_temp.admin_c_room_rate_state(p_row jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select jsonb_build_object('room_type_id',p_row->>'room_type_id',
    'rate_plan_id',p_row->>'rate_plan_id','pricing_schedule_id',p_row->'pricing_schedule_id',
    'base_nightly_rate',(p_row->>'base_nightly_rate')::numeric,
    'currency',p_row->>'currency','external_redirect_url',p_row->'external_redirect_url',
    'lifecycle_status',p_row->>'lifecycle_status','sort_order',(p_row->>'sort_order')::integer)
$function$;

create function pg_temp.admin_c_rate_rule_state(p_row jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select jsonb_build_object('room_rate_id',p_row->>'room_rate_id',
    'valid_from',p_row->>'valid_from','valid_to',p_row->>'valid_to',
    'weekdays',p_row->'weekdays','nightly_rate',(p_row->>'nightly_rate')::numeric,
    'minimum_stay',p_row->'minimum_stay','maximum_stay',p_row->'maximum_stay',
    'closed_to_arrival',(p_row->>'closed_to_arrival')::boolean,
    'closed_to_departure',(p_row->>'closed_to_departure')::boolean,
    'priority',(p_row->>'priority')::integer,'is_active',(p_row->>'is_active')::boolean)
$function$;

create function pg_temp.admin_c_property_default_state(p_row jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select jsonb_build_object('nightly_rate',(p_row->>'nightly_rate')::numeric,
    'currency',p_row->>'currency','lifecycle_status',p_row->>'lifecycle_status')
$function$;

create function pg_temp.admin_c_allocation_state(p_row jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
  select jsonb_build_object('code',p_row->>'code',
    'allocation_mode',p_row->>'allocation_mode',
    'min_guest_count',(p_row->>'min_guest_count')::integer,
    'max_guest_count',(p_row->>'max_guest_count')::integer,
    'lifecycle_status',p_row->>'lifecycle_status',
    'sort_order',(p_row->>'sort_order')::integer,
    'items',coalesce((select jsonb_agg(item.value-'version' order by item.ordinal)
      from jsonb_array_elements(p_row->'items') with ordinality item(value,ordinal)),
      '[]'::jsonb))
$function$;

-- Authentication and raw normalized pricing boundary.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $security$
declare v_denied boolean; v_relation text;
begin
  v_denied:=false;
  begin perform public.hotel_v2_admin_get_pricing_control(
    'c1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'admin_c_non_admin_read_allowed'; end if;

  foreach v_relation in array array[
    'hotel_property_pricing_defaults','hotel_admin_pricing_action_receipts',
    'hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules',
    'hotel_pricing_schedule_occupancy_tiers','hotel_room_rate_occupancy_tiers',
    'hotel_rate_rules','hotel_calendar_overrides','hotel_room_allocation_rules',
    'hotel_room_allocation_rule_items','hotel_daily_rates','hotel_activity_log',
    'hotel_pricing_promotion_reviews'
  ] loop
    v_denied:=false;
    begin execute format('select 1 from public.%I limit 1',v_relation);
    exception when insufficient_privilege then v_denied:=true; end;
    if not v_denied then raise exception 'admin_c_raw_select_allowed: %',v_relation; end if;
  end loop;
end
$security$;
rollback;

-- Generic one-Room future Hotel: atomically create and activate a reviewed
-- Plan, base-priced Room Rate, and one-choice allocation. Flags remain OFF.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $generic$
declare
  c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_room constant uuid:='c1100000-0000-4000-8000-000000000001';
  c_plan constant uuid:='c1200000-0000-4000-8000-000000000001';
  c_rate constant uuid:='c1300000-0000-4000-8000-000000000001';
  c_rule constant uuid:='c1400000-0000-4000-8000-000000000001';
  c_item constant uuid:='c1500000-0000-4000-8000-000000000001';
  v_control jsonb; v_ops jsonb; v_plan jsonb; v_result jsonb; v_quote jsonb;
  v_plan_row jsonb; v_original jsonb; v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  if v_control->>'contract_version'<>'hotels_v2_admin_c_pricing_control_v1'
     or v_control#>>'{property,architecture_version}'<>'rooms_v2'
     or v_control#>>'{property,booking_mode}'<>'request_confirmation'
     or v_control#>>'{feature_flags,hotel_rooms_v2_enabled}'<>'false'
     or jsonb_array_length(v_control->'room_types')<>1
     or v_control#>>'{room_types,0,inventory_mode}'<>'pooled'
     or v_control#>>'{room_types,0,base_inventory_count}'<>'1'
     or v_control#>>'{room_types,0,active_unit_count}'<>'0' then
    raise exception 'admin_c_generic_read_shape_invalid';
  end if;

  v_ops:=jsonb_build_array(
    pg_temp.admin_c_operation('rate_plan','create',c_plan,0,null,null,'[]',false,true,'{}',
      jsonb_build_object('code','standard','name_i18n',jsonb_build_object(
        'pl','Standard','en','Standard','he','סטנדרט'),
        'description_i18n',jsonb_build_object('pl','Plan standardowy',
          'en','Standard plan','he','תכנית סטנדרטית'),
        'meal_plan_code',null,'cancellation_policy',jsonb_build_object('type','flexible'),
        'booking_mode_override',null,'price_inclusions','[]'::jsonb,
        'lifecycle_status','active','sort_order',10)),
    pg_temp.admin_c_operation('room_rate','create',c_rate,0,null,null,'[]',false,true,'{}',
      jsonb_build_object('room_type_id',c_room,'rate_plan_id',c_plan,
        'pricing_schedule_id',null,'base_nightly_rate',80,'currency','EUR',
        'external_redirect_url',null,'lifecycle_status','active','sort_order',10)),
    pg_temp.admin_c_operation('allocation_rule','create',c_rule,0,null,null,'[]',false,true,'{}',
      jsonb_build_object('code','choice-1-3','allocation_mode','customer_choice',
        'min_guest_count',1,'max_guest_count',3,'lifecycle_status','active','sort_order',10,
        'items',jsonb_build_array(jsonb_build_object('id',c_item,'hotel_id',c_hotel,
          'allocation_rule_id',c_rule,'room_type_id',c_room,'units_required',1,
          'allocated_guest_count',null,'pricing_guest_count',null,
          'allocated_guest_counts',null,'pricing_guest_counts',null,'sort_order',10))))
  );
  v_plan:=pg_temp.admin_c_plan(c_hotel,v_control->>'snapshot_token',v_ops);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(
    v_plan,'c2000000-0000-4000-8000-000000000001','admin-c-generic-create-001');
  if v_result->>'changed'<>'true' or v_result->>'replayed'<>'false'
     or jsonb_array_length(v_result->'activity')<>3
     or v_result#>>'{pricing_control,rate_plans,0,lifecycle_status}'<>'active'
     or v_result#>>'{pricing_control,room_rates,0,lifecycle_status}'<>'active'
     or v_result#>>'{pricing_control,allocation_rules,0,lifecycle_status}'<>'active' then
    raise exception 'admin_c_generic_atomic_activation_failed';
  end if;

  v_quote:=pg_temp.admin_c_preview(c_hotel,
    v_result#>>'{pricing_control,snapshot_token}',c_plan,c_rule,c_room,
    '2026-09-01',1,2);
  if v_quote->>'ok'<>'true' or v_quote->>'requestable'<>'false'
     or (v_quote->>'customer_total')::numeric<>80
     or v_quote#>>'{products,0,base_pricing_source}'<>'base_nightly_rate'
     or v_quote->'pricing_precedence'<>jsonb_build_array('exact_date_price',
       'seasonal_range_rule','weekday_rule','pricing_schedule_tier',
       'independent_occupancy_tier','room_rate_base_nightly_rate','property_default') then
    raise exception 'admin_c_future_one_night_preview_failed: %',v_quote;
  end if;

  -- One exact age per child is preserved and evaluated against both the
  -- inherited minimum-age policy and the Room's explicit adult/child slots.
  v_quote:=pg_temp.admin_c_preview(c_hotel,
    v_result#>>'{pricing_control,snapshot_token}',c_plan,c_rule,c_room,
    '2026-09-01',1,2,'[12]'::jsonb);
  if v_quote->>'ok'<>'true' or v_quote->'child_ages'<>'[12]'::jsonb
     or (v_quote->>'customer_total')::numeric<>80 then
    raise exception 'admin_c_child_age_capacity_acceptance_failed: %',v_quote;
  end if;
  v_quote:=pg_temp.admin_c_preview(c_hotel,
    v_result#>>'{pricing_control,snapshot_token}',c_plan,c_rule,c_room,
    '2026-09-01',1,2,'[11]'::jsonb);
  if v_quote->>'ok'<>'false' or v_quote->'customer_total'<>'null'::jsonb
     or not exists(select 1 from jsonb_array_elements(v_quote->'blocking_reasons') blocker
       where blocker->>'code'='child_policy_not_satisfied') then
    raise exception 'admin_c_underage_child_not_blocked: %',v_quote;
  end if;
  v_quote:=pg_temp.admin_c_preview(c_hotel,
    v_result#>>'{pricing_control,snapshot_token}',c_plan,c_rule,c_room,
    '2026-09-01',1,3,'[]'::jsonb);
  if v_quote->>'ok'<>'false' or v_quote->'customer_total'<>'null'::jsonb
     or not exists(select 1 from jsonb_array_elements(v_quote->'blocking_reasons') blocker
       where blocker->>'code'='room_demographic_capacity_exceeded') then
    raise exception 'admin_c_all_adult_capacity_overflow_not_blocked: %',v_quote;
  end if;

  -- Exact same request is one mutation plus immutable replay.
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(
    v_plan,'c2000000-0000-4000-8000-000000000001','admin-c-generic-create-001');
  if v_result->>'replayed'<>'true' or jsonb_array_length(v_result->'activity')<>3 then
    raise exception 'admin_c_exact_replay_failed';
  end if;

  -- Empty inclusions remain a typed empty array through a semantic no-op.
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  select value into v_plan_row from jsonb_array_elements(v_control->'rate_plans')
    where value->>'id'=c_plan::text;
  v_original:=jsonb_build_object('code',v_plan_row->>'code',
    'name_i18n',v_plan_row->'name_i18n','description_i18n',v_plan_row->'description_i18n',
    'meal_plan_code',v_plan_row->'meal_plan_code','cancellation_policy',v_plan_row->'cancellation_policy',
    'booking_mode_override',v_plan_row->'booking_mode_override',
    'price_inclusions',v_plan_row->'price_inclusions',
    'lifecycle_status',v_plan_row->>'lifecycle_status',
    'sort_order',(v_plan_row->>'sort_order')::integer);
  v_plan:=pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'rate_plan','update',c_plan,(v_plan_row->>'version')::bigint,null,null,'[]',
      false,true,v_original,v_original)));
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(v_plan,
    'c2000000-0000-4000-8000-000000000002','admin-c-plan-noop-002');
  if v_result->>'changed'<>'false' or jsonb_array_length(v_result->'activity')<>0
     or v_result#>'{pricing_control,rate_plans,0,price_inclusions}'<>'[]'::jsonb then
    raise exception 'admin_c_empty_inclusions_noop_failed';
  end if;
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(v_plan,
    'c2000000-0000-4000-8000-000000000002','admin-c-plan-noop-002');
  if v_result->>'replayed'<>'true' or v_result->>'changed'<>'false'
     or jsonb_array_length(v_result->'activity')<>0 then
    raise exception 'admin_c_noop_exact_replay_failed';
  end if;

  -- Strict plan/token/type and foreign-Hotel smuggling are controlled.
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(
    jsonb_set(pg_temp.admin_c_plan(c_hotel,repeat('A',64),v_ops),'{reviewed_at}',
      '"today"'::jsonb),gen_random_uuid(),'admin-c-invalid-shape-003');
  exception when sqlstate '22023' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_c_plan_smuggling_allowed'; end if;

  foreach v_plan in array array[
    jsonb_set(pg_temp.admin_c_plan(c_hotel,repeat('0',64),v_ops),'{hotel_id}',
      to_jsonb(replace(c_hotel::text,'-',''))),
    jsonb_set(pg_temp.admin_c_plan(c_hotel,repeat('0',64),v_ops),'{reviewed_at}',
      '"2026-02-30T12:00:00Z"'::jsonb),
    jsonb_set(pg_temp.admin_c_plan(c_hotel,repeat('0',64),v_ops),'{reviewed_at}',
      '"2026-08-21T24:00:00Z"'::jsonb),
    jsonb_set(pg_temp.admin_c_plan(c_hotel,repeat('0',64),v_ops),
      '{operations,2,payload,items,0,room_type_id}',to_jsonb(upper(c_room::text))),
    jsonb_set(pg_temp.admin_c_plan(c_hotel,repeat('0',64),v_ops),
      '{operations,0,id}',to_jsonb('c1200000-0000-0000-8000-000000000199'::text)),
    jsonb_set(pg_temp.admin_c_plan(c_hotel,repeat('0',64),v_ops),
      '{operations,0,id}',to_jsonb('c1200000-0000-4000-7000-000000000199'::text))
  ] loop
    v_failed:=false;
    begin perform public.hotel_v2_admin_apply_pricing_control_plan(
      v_plan,gen_random_uuid(),'admin-c-canonical-smuggling-'||substr(md5(v_plan::text),1,16));
    exception when sqlstate '22023' then
      v_failed:=sqlerrm='hotels_v2_admin_c_invalid_pricing_plan';
    end;
    if not v_failed then raise exception 'admin_c_noncanonical_transport_allowed: %',v_plan; end if;
  end loop;

  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(
    pg_temp.admin_c_plan(c_hotel,repeat('0',64),v_ops),
    'c2000000-0000-0000-8000-000000000099','admin-c-bad-correlation-version-099');
  exception when sqlstate '22023' then
    v_failed:=sqlerrm='hotels_v2_admin_c_invalid_pricing_plan';
  end;
  if not v_failed then raise exception 'admin_c_non_rfc_correlation_allowed'; end if;
end
$generic$;

-- The changed=false save owns one durable receipt; its exact replay creates no
-- second row. The initial create behaves the same way.
reset role;
do $receipt_count$
declare v_count integer;
begin
  select count(*) into v_count from public.hotel_admin_pricing_action_receipts
  where hotel_id='c1000000-0000-4000-8000-000000000001'
    and idempotency_key in('admin-c-generic-create-001','admin-c-plan-noop-002');
  if v_count<>2 then raise exception 'admin_c_noop_or_replay_receipt_count_failed: %',v_count; end if;
end
$receipt_count$;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $lifecycle$
declare
  c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_plan constant uuid:='c1200000-0000-4000-8000-000000000001';
  c_rate constant uuid:='c1300000-0000-4000-8000-000000000001';
  v_control jsonb; v_plan_row jsonb; v_rate_row jsonb;
  v_plan_state jsonb; v_rate_state jsonb; v_result jsonb; v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  select value into v_plan_row from jsonb_array_elements(v_control->'rate_plans')
    where value->>'id'=c_plan::text;
  select value into v_rate_row from jsonb_array_elements(v_control->'room_rates')
    where value->>'id'=c_rate::text;
  v_plan_state:=jsonb_build_object('code',v_plan_row->>'code',
    'name_i18n',v_plan_row->'name_i18n','description_i18n',v_plan_row->'description_i18n',
    'meal_plan_code',v_plan_row->'meal_plan_code','cancellation_policy',v_plan_row->'cancellation_policy',
    'booking_mode_override',v_plan_row->'booking_mode_override',
    'price_inclusions',v_plan_row->'price_inclusions',
    'lifecycle_status',v_plan_row->>'lifecycle_status',
    'sort_order',(v_plan_row->>'sort_order')::integer);
  v_rate_state:=jsonb_build_object('room_type_id',v_rate_row->>'room_type_id',
    'rate_plan_id',v_rate_row->>'rate_plan_id',
    'pricing_schedule_id',v_rate_row->'pricing_schedule_id',
    'base_nightly_rate',(v_rate_row->>'base_nightly_rate')::numeric,
    'currency',v_rate_row->>'currency','external_redirect_url',v_rate_row->'external_redirect_url',
    'lifecycle_status',v_rate_row->>'lifecycle_status',
    'sort_order',(v_rate_row->>'sort_order')::integer);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(
      pg_temp.admin_c_operation('room_rate','disable',c_rate,
        (v_rate_row->>'version')::bigint,null,null,'[]',false,false,v_rate_state,'{}'),
      pg_temp.admin_c_operation('rate_plan','disable',c_plan,
        (v_plan_row->>'version')::bigint,null,null,'[]',false,false,v_plan_state,'{}'))),
    'c2000000-0000-4000-8000-000000000010','admin-c-disable-pair-010');
  if v_result#>>'{pricing_control,room_rates,0,lifecycle_status}'<>'disabled'
     or v_result#>>'{pricing_control,rate_plans,0,lifecycle_status}'<>'disabled'
     or jsonb_array_length(v_result->'activity')<>2 then
    raise exception 'admin_c_disable_pair_failed';
  end if;

  v_control:=v_result->'pricing_control';
  select value into v_plan_row from jsonb_array_elements(v_control->'rate_plans')
    where value->>'id'=c_plan::text;
  select value into v_rate_row from jsonb_array_elements(v_control->'room_rates')
    where value->>'id'=c_rate::text;
  v_plan_state:=jsonb_build_object('code',v_plan_row->>'code',
    'name_i18n',v_plan_row->'name_i18n','description_i18n',v_plan_row->'description_i18n',
    'meal_plan_code',v_plan_row->'meal_plan_code','cancellation_policy',v_plan_row->'cancellation_policy',
    'booking_mode_override',v_plan_row->'booking_mode_override',
    'price_inclusions',v_plan_row->'price_inclusions',
    'lifecycle_status',v_plan_row->>'lifecycle_status',
    'sort_order',(v_plan_row->>'sort_order')::integer);
  v_rate_state:=jsonb_build_object('room_type_id',v_rate_row->>'room_type_id',
    'rate_plan_id',v_rate_row->>'rate_plan_id','pricing_schedule_id',v_rate_row->'pricing_schedule_id',
    'base_nightly_rate',(v_rate_row->>'base_nightly_rate')::numeric,
    'currency',v_rate_row->>'currency','external_redirect_url',v_rate_row->'external_redirect_url',
    'lifecycle_status',v_rate_row->>'lifecycle_status',
    'sort_order',(v_rate_row->>'sort_order')::integer);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(
      pg_temp.admin_c_operation('rate_plan','update',c_plan,
        (v_plan_row->>'version')::bigint,null,null,'[]',false,true,v_plan_state,
        v_plan_state||jsonb_build_object('lifecycle_status','active')),
      pg_temp.admin_c_operation('room_rate','update',c_rate,
        (v_rate_row->>'version')::bigint,null,null,'[]',false,true,v_rate_state,
        v_rate_state||jsonb_build_object('lifecycle_status','active')))),
    'c2000000-0000-4000-8000-000000000011','admin-c-reactivate-pair-011');
  if v_result#>>'{pricing_control,room_rates,0,lifecycle_status}'<>'active'
     or v_result#>>'{pricing_control,rate_plans,0,lifecycle_status}'<>'active'
     or v_result#>'{pricing_control,rate_plans,0,price_inclusions}'<>'[]'::jsonb then
    raise exception 'admin_c_reactivate_pair_failed';
  end if;

  v_control:=v_result->'pricing_control';
  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
      c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
        'room_rate','create','c1300000-0000-4000-8000-000000000099',0,null,null,'[]',
        false,false,'{}',jsonb_build_object('room_type_id',
          'c1100000-0000-4000-8000-000000000001','rate_plan_id',c_plan,
          'pricing_schedule_id',null,'base_nightly_rate',80,'currency','EUR',
          'external_redirect_url',null,'lifecycle_status','draft','sort_order',99)))),
      'c2000000-0000-4000-8000-000000000012','admin-c-duplicate-rate-012');
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_admin_c_room_rate_pair_conflict';
  end;
  if not v_failed then raise exception 'admin_c_duplicate_rate_pair_allowed'; end if;
end
$lifecycle$;

do $schedule_and_tiers$
declare
  c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_room constant uuid:='c1100000-0000-4000-8000-000000000001';
  c_plan constant uuid:='c1200000-0000-4000-8000-000000000001';
  c_rate constant uuid:='c1300000-0000-4000-8000-000000000001';
  c_rule constant uuid:='c1400000-0000-4000-8000-000000000001';
  c_schedule constant uuid:='c1a00000-0000-4000-8000-000000000001';
  c_clone constant uuid:='c1a00000-0000-4000-8000-000000000002';
  c_product_clone constant uuid:='c1a00000-0000-4000-8000-000000000003';
  v_control jsonb; v_rate jsonb; v_schedule jsonb; v_rate_state jsonb;
  v_schedule_state jsonb; v_tiers jsonb; v_clone_tiers jsonb; v_result jsonb;
  v_quote jsonb;
  v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  select value into v_rate from jsonb_array_elements(v_control->'room_rates')
    where value->>'id'=c_rate::text;
  v_tiers:=jsonb_build_array(
    jsonb_build_object('id','c1b00000-0000-4000-8000-000000000001',
      'hotel_id',c_hotel,'room_rate_id',c_rate,'guest_count',1,
      'threshold_nights',1,'nightly_rate',75,'is_active',true,'version',0),
    jsonb_build_object('id','c1b00000-0000-4000-8000-000000000002',
      'hotel_id',c_hotel,'room_rate_id',c_rate,'guest_count',2,
      'threshold_nights',1,'nightly_rate',80,'is_active',true,'version',0),
    jsonb_build_object('id','c1b00000-0000-4000-8000-000000000003',
      'hotel_id',c_hotel,'room_rate_id',c_rate,'guest_count',3,
      'threshold_nights',1,'nightly_rate',90,'is_active',true,'version',0));
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'room_rate_tier_set','update',c_rate,(v_rate->>'version')::bigint,
      v_rate->>'independent_tiers_fingerprint',null,'[]',false,false,
      pg_temp.admin_c_direct_tier_state(v_rate),jsonb_build_object('tiers',v_tiers)))),
    'c2000000-0000-4000-8000-000000000020','admin-c-direct-tiers-020');
  if jsonb_array_length(v_result#>'{pricing_control,room_rates,0,independent_tiers}')<>3
     or jsonb_array_length(v_result->'activity')<>1 then
    raise exception 'admin_c_direct_tier_set_failed';
  end if;

  -- A genuinely configured one-person product resolves occupancy one. This is
  -- deliberately distinct from the accepted 7K one-person -> two-person floor.
  v_quote:=pg_temp.admin_c_preview(c_hotel,
    v_result#>>'{pricing_control,snapshot_token}',c_plan,c_rule,c_room,
    '2026-09-01',1,1);
  if v_quote->>'ok'<>'true' or (v_quote->>'customer_total')::numeric<>75
     or v_quote#>>'{products,0,requested_pricing_guest_count}'<>'1'
     or v_quote#>>'{products,0,resolved_pricing_guest_count}'<>'1'
     or v_quote#>>'{products,0,base_pricing_source}'<>'independent_occupancy_tier' then
    raise exception 'admin_c_true_one_person_tier_preview_failed: %',v_quote;
  end if;

  v_control:=v_result->'pricing_control';
  select value into v_rate from jsonb_array_elements(v_control->'room_rates')
    where value->>'id'=c_rate::text;
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'room_rate_tier_set','update',c_rate,(v_rate->>'version')::bigint,
      v_rate->>'independent_tiers_fingerprint',null,'[]',false,false,
      pg_temp.admin_c_direct_tier_state(v_rate),jsonb_build_object('tiers','[]'::jsonb)))),
    'c2000000-0000-4000-8000-000000000021','admin-c-direct-tier-clear-021');
  if jsonb_array_length(v_result#>'{pricing_control,room_rates,0,independent_tiers}')<>0 then
    raise exception 'admin_c_direct_tier_clear_failed';
  end if;

  v_control:=v_result->'pricing_control';
  select value into v_rate from jsonb_array_elements(v_control->'room_rates')
    where value->>'id'=c_rate::text;
  v_rate_state:=jsonb_build_object('room_type_id',v_rate->>'room_type_id',
    'rate_plan_id',v_rate->>'rate_plan_id','pricing_schedule_id',v_rate->'pricing_schedule_id',
    'base_nightly_rate',(v_rate->>'base_nightly_rate')::numeric,'currency',v_rate->>'currency',
    'external_redirect_url',v_rate->'external_redirect_url',
    'lifecycle_status',v_rate->>'lifecycle_status','sort_order',(v_rate->>'sort_order')::integer);
  v_tiers:=jsonb_build_array(
    jsonb_build_object('id','c1c00000-0000-4000-8000-000000000001',
      'schedule_id',c_schedule,'guest_count',1,'threshold_nights',1,
      'nightly_rate',70,'is_active',true,'version',0),
    jsonb_build_object('id','c1c00000-0000-4000-8000-000000000002',
      'schedule_id',c_schedule,'guest_count',2,'threshold_nights',1,
      'nightly_rate',80,'is_active',true,'version',0),
    jsonb_build_object('id','c1c00000-0000-4000-8000-000000000003',
      'schedule_id',c_schedule,'guest_count',3,'threshold_nights',1,
      'nightly_rate',90,'is_active',true,'version',0));
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(
      pg_temp.admin_c_operation('pricing_schedule','create',c_schedule,0,null,null,
        '[]',false,true,'{}',jsonb_build_object('code','shared-main',
          'name_i18n',jsonb_build_object('pl','Wspólny','en','Shared','he','משותף'),
          'application_scope','room_occupancy','currency','EUR','maximum_party_size',3,
          'minimum_billable_occupancy',1,'sharing_mode','shared',
          'lifecycle_status','active','tiers',v_tiers)),
      pg_temp.admin_c_operation('room_rate','update',c_rate,
        (v_rate->>'version')::bigint,null,'d41d8cd98f00b204e9800998ecf8427e','[]',
        true,true,v_rate_state,
        v_rate_state||jsonb_build_object('pricing_schedule_id',c_schedule)))),
    'c2000000-0000-4000-8000-000000000022','admin-c-schedule-attach-022');
  if v_result#>>'{pricing_control,room_rates,0,pricing_schedule_id}'<>c_schedule::text
     or v_result#>>'{pricing_control,pricing_schedules,0,linked_room_rate_ids,0}'<>c_rate::text then
    raise exception 'admin_c_schedule_attach_failed';
  end if;

  v_control:=v_result->'pricing_control';
  select value into v_schedule from jsonb_array_elements(v_control->'pricing_schedules')
    where value->>'id'=c_schedule::text;
  v_schedule_state:=jsonb_build_object('code',v_schedule->>'code',
    'name_i18n',v_schedule->'name_i18n','application_scope',v_schedule->>'application_scope',
    'currency',v_schedule->>'currency','maximum_party_size',
    (v_schedule->>'maximum_party_size')::integer,'minimum_billable_occupancy',
    (v_schedule->>'minimum_billable_occupancy')::integer,
    'sharing_mode',v_schedule->>'sharing_mode',
    'lifecycle_status',v_schedule->>'lifecycle_status',
    'tiers',pg_temp.admin_c_schedule_tier_state(v_schedule));
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'pricing_schedule','update',c_schedule,(v_schedule->>'version')::bigint,
      v_schedule->>'tiers_fingerprint',repeat('0',32),v_schedule->'linked_room_rate_ids',
      true,true,v_schedule_state,v_schedule_state||jsonb_build_object(
        'name_i18n',jsonb_build_object('pl','Wspólny','en','Changed','he','משותף'))))),
    'c2000000-0000-4000-8000-000000000023','admin-c-schedule-stale-023');
  exception when sqlstate 'PT409' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_c_stale_schedule_link_set_allowed'; end if;

  -- A reviewed shared edit binds every current consumer and tier. The same
  -- semantic target then becomes a true no-op with no version/activity churn.
  v_schedule_state:=v_schedule_state||jsonb_build_object(
    'name_i18n',jsonb_build_object('pl','Wspólny','en','Shared revised','he','משותף'));
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'pricing_schedule','update',c_schedule,(v_schedule->>'version')::bigint,
      v_schedule->>'tiers_fingerprint',v_schedule->>'link_fingerprint',
      v_schedule->'linked_room_rate_ids',true,true,
      jsonb_build_object('code',v_schedule->>'code','name_i18n',v_schedule->'name_i18n',
        'application_scope',v_schedule->>'application_scope','currency',v_schedule->>'currency',
        'maximum_party_size',(v_schedule->>'maximum_party_size')::integer,
        'minimum_billable_occupancy',(v_schedule->>'minimum_billable_occupancy')::integer,
        'sharing_mode',v_schedule->>'sharing_mode',
        'lifecycle_status',v_schedule->>'lifecycle_status',
        'tiers',pg_temp.admin_c_schedule_tier_state(v_schedule)),
      v_schedule_state))),
    'c2000000-0000-4000-8000-000000000027','admin-c-shared-edit-027');
  if v_result->>'changed'<>'true' or jsonb_array_length(v_result->'activity')<>1
     or not exists(select 1 from jsonb_array_elements(
       v_result#>'{pricing_control,pricing_schedules}') schedule_row
       where schedule_row->>'id'=c_schedule::text
         and schedule_row#>>'{name_i18n,en}'='Shared revised'
         and schedule_row->'linked_room_rate_ids'=jsonb_build_array(c_rate)) then
    raise exception 'admin_c_reviewed_shared_schedule_edit_failed';
  end if;
  v_control:=v_result->'pricing_control';
  select value into v_schedule from jsonb_array_elements(v_control->'pricing_schedules')
    where value->>'id'=c_schedule::text;
  v_schedule_state:=jsonb_build_object('code',v_schedule->>'code',
    'name_i18n',v_schedule->'name_i18n','application_scope',v_schedule->>'application_scope',
    'currency',v_schedule->>'currency','maximum_party_size',
    (v_schedule->>'maximum_party_size')::integer,'minimum_billable_occupancy',
    (v_schedule->>'minimum_billable_occupancy')::integer,
    'sharing_mode',v_schedule->>'sharing_mode',
    'lifecycle_status',v_schedule->>'lifecycle_status',
    'tiers',pg_temp.admin_c_schedule_tier_state(v_schedule));
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'pricing_schedule','update',c_schedule,(v_schedule->>'version')::bigint,
      v_schedule->>'tiers_fingerprint',v_schedule->>'link_fingerprint',
      v_schedule->'linked_room_rate_ids',true,true,v_schedule_state,v_schedule_state))),
    'c2000000-0000-4000-8000-000000000028','admin-c-shared-noop-028');
  if v_result->>'changed'<>'false' or jsonb_array_length(v_result->'activity')<>0 then
    raise exception 'admin_c_shared_schedule_noop_failed';
  end if;

  -- One-op reusable clone is draft and can choose shared ownership.
  v_control:=v_result->'pricing_control';
  select value into v_schedule from jsonb_array_elements(v_control->'pricing_schedules')
    where value->>'id'=c_schedule::text;
  v_clone_tiers:=coalesce((select jsonb_agg(jsonb_build_object(
    'id',('c1d00000-0000-4000-8000-'||lpad(ordinal::text,12,'0'))::uuid,
    'schedule_id',c_clone,'guest_count',(tier.value->>'guest_count')::integer,
    'threshold_nights',(tier.value->>'threshold_nights')::integer,
    'nightly_rate',(tier.value->>'nightly_rate')::numeric,
    'is_active',(tier.value->>'is_active')::boolean,'version',0) order by ordinal)
    from jsonb_array_elements(v_schedule->'tiers') with ordinality tier(value,ordinal)),
    '[]'::jsonb);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'pricing_schedule','clone',c_clone,0,v_schedule->>'tiers_fingerprint',
      v_schedule->>'link_fingerprint',v_schedule->'linked_room_rate_ids',true,false,'{}',
      jsonb_build_object('source_schedule_id',c_schedule,
        'expected_source_version',(v_schedule->>'version')::bigint,'code','shared-copy',
        'name_i18n',jsonb_build_object('pl','Kopia','en','Copy','he','עותק'),
        'sharing_mode','shared','tiers',v_clone_tiers)))),
    'c2000000-0000-4000-8000-000000000024','admin-c-standalone-clone-024');
  if v_result#>>'{pricing_control,pricing_schedules,1,lifecycle_status}' is distinct from 'draft'
     and not exists(select 1 from jsonb_array_elements(v_result#>'{pricing_control,pricing_schedules}') s
       where s->>'id'=c_clone::text and s->>'sharing_mode'='shared'
         and s->>'lifecycle_status'='draft') then
    raise exception 'admin_c_standalone_clone_failed';
  end if;

  -- Exact two-op clone-for-product is target independent + draft/inactive
  -- Rate; source sibling link set is reviewed atomically.
  v_control:=v_result->'pricing_control';
  select value into v_schedule from jsonb_array_elements(v_control->'pricing_schedules')
    where value->>'id'=c_schedule::text;
  select value into v_rate from jsonb_array_elements(v_control->'room_rates')
    where value->>'id'=c_rate::text;
  v_rate_state:=jsonb_build_object('room_type_id',v_rate->>'room_type_id',
    'rate_plan_id',v_rate->>'rate_plan_id','pricing_schedule_id',v_rate->'pricing_schedule_id',
    'base_nightly_rate',(v_rate->>'base_nightly_rate')::numeric,'currency',v_rate->>'currency',
    'external_redirect_url',v_rate->'external_redirect_url',
    'lifecycle_status',v_rate->>'lifecycle_status','sort_order',(v_rate->>'sort_order')::integer);
  v_clone_tiers:=coalesce((select jsonb_agg(jsonb_build_object(
    'id',('c1e00000-0000-4000-8000-'||lpad(ordinal::text,12,'0'))::uuid,
    'schedule_id',c_product_clone,'guest_count',(tier.value->>'guest_count')::integer,
    'threshold_nights',(tier.value->>'threshold_nights')::integer,
    'nightly_rate',(tier.value->>'nightly_rate')::numeric,
    'is_active',(tier.value->>'is_active')::boolean,'version',0) order by ordinal)
    from jsonb_array_elements(v_schedule->'tiers') with ordinality tier(value,ordinal)),
    '[]'::jsonb);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(
      pg_temp.admin_c_operation('pricing_schedule','clone',c_product_clone,0,
        v_schedule->>'tiers_fingerprint',v_schedule->>'link_fingerprint',
        v_schedule->'linked_room_rate_ids',true,false,'{}',jsonb_build_object(
          'source_schedule_id',c_schedule,
          'expected_source_version',(v_schedule->>'version')::bigint,
          'code','product-copy','name_i18n',jsonb_build_object(
            'pl','Kopia produktu','en','Product copy','he','עותק מוצר'),
          'sharing_mode','independent','tiers',v_clone_tiers)),
      pg_temp.admin_c_operation('room_rate','update',c_rate,
        (v_rate->>'version')::bigint,null,v_schedule->>'link_fingerprint',
        v_schedule->'linked_room_rate_ids',true,false,v_rate_state,
        v_rate_state||jsonb_build_object('pricing_schedule_id',c_product_clone,
          'lifecycle_status','inactive')))),
    'c2000000-0000-4000-8000-000000000025','admin-c-clone-relink-025');
  if v_result#>>'{pricing_control,room_rates,0,pricing_schedule_id}'<>c_product_clone::text
     or v_result#>>'{pricing_control,room_rates,0,lifecycle_status}'<>'inactive'
     or not exists(select 1 from jsonb_array_elements(v_result#>'{pricing_control,pricing_schedules}') s
       where s->>'id'=c_product_clone::text and s->>'sharing_mode'='independent'
         and s#>>'{linked_room_rate_ids,0}'=c_rate::text) then
    raise exception 'admin_c_atomic_clone_relink_failed';
  end if;

  v_control:=v_result->'pricing_control';
  select value into v_rate from jsonb_array_elements(v_control->'room_rates')
    where value->>'id'=c_rate::text;
  select value into v_schedule from jsonb_array_elements(v_control->'pricing_schedules')
    where value->>'id'=c_product_clone::text;
  v_rate_state:=jsonb_build_object('room_type_id',v_rate->>'room_type_id',
    'rate_plan_id',v_rate->>'rate_plan_id','pricing_schedule_id',v_rate->'pricing_schedule_id',
    'base_nightly_rate',(v_rate->>'base_nightly_rate')::numeric,'currency',v_rate->>'currency',
    'external_redirect_url',v_rate->'external_redirect_url',
    'lifecycle_status',v_rate->>'lifecycle_status','sort_order',(v_rate->>'sort_order')::integer);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'room_rate','update',c_rate,(v_rate->>'version')::bigint,null,
      v_schedule->>'link_fingerprint',v_schedule->'linked_room_rate_ids',true,true,
      v_rate_state,v_rate_state||jsonb_build_object('pricing_schedule_id',null,
        'lifecycle_status','active')))),
    'c2000000-0000-4000-8000-000000000026','admin-c-schedule-detach-026');
  if v_result#>'{pricing_control,room_rates,0,pricing_schedule_id}'<>'null'::jsonb
     or v_result#>>'{pricing_control,room_rates,0,lifecycle_status}'<>'active' then
    raise exception 'admin_c_schedule_detach_failed';
  end if;
end
$schedule_and_tiers$;

-- Remaining entity lifecycle, strict DTO/original binding, rule-layer
-- ambiguity, controlled uniqueness/foreign identifiers, and correlation
-- identity all execute through the same public reviewed RPC.
do $entity_semantics$
declare
  c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_room constant uuid:='c1100000-0000-4000-8000-000000000001';
  c_plan constant uuid:='c1200000-0000-4000-8000-000000000001';
  c_rate constant uuid:='c1300000-0000-4000-8000-000000000001';
  c_allocation constant uuid:='c1400000-0000-4000-8000-000000000001';
  c_plan_two constant uuid:='c2200000-0000-4000-8000-000000000001';
  c_rate_two constant uuid:='c2300000-0000-4000-8000-000000000001';
  c_rule constant uuid:='c2400000-0000-4000-8000-000000000001';
  c_overlap constant uuid:='c2400000-0000-4000-8000-000000000002';
  c_default constant uuid:='c2600000-0000-4000-8000-000000000001';
  v_control jsonb; v_result jsonb; v_row jsonb; v_state jsonb;
  v_allocation jsonb; v_payload jsonb; v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(
      pg_temp.admin_c_operation('rate_plan','create',c_plan_two,0,null,null,'[]',
        false,false,'{}',jsonb_build_object('code','secondary',
          'name_i18n',jsonb_build_object('pl','Drugi','en',repeat('x',240),'he','שני'),
          'description_i18n',jsonb_build_object('pl','Opis',
            'en',E'Line one\r\nLine two','he','תיאור'),
          'meal_plan_code',null,'cancellation_policy',jsonb_build_object('type','flexible'),
          'booking_mode_override',null,'price_inclusions','[]'::jsonb,
          'lifecycle_status','inactive','sort_order',20)),
      pg_temp.admin_c_operation('room_rate','create',c_rate_two,0,null,null,'[]',
        false,false,'{}',jsonb_build_object('room_type_id',c_room,
          'rate_plan_id',c_plan_two,'pricing_schedule_id',null,'base_nightly_rate',85,
          'currency','EUR','external_redirect_url',null,
          'lifecycle_status','inactive','sort_order',20)),
      pg_temp.admin_c_operation('property_pricing_default','create',c_default,0,
        null,null,'[]',false,true,'{}',jsonb_build_object('hotel_id',c_hotel,
          'nightly_rate',70,'currency','EUR','lifecycle_status','active')))),
    'c2000000-0000-4000-8000-000000000030','admin-c-entity-create-030');
  if v_result->>'changed'<>'true' or jsonb_array_length(v_result->'activity')<>3
     or not exists(select 1 from jsonb_array_elements(
       v_result#>'{pricing_control,rate_plans}') row_value
       where row_value->>'id'=c_plan_two::text
         and length(row_value#>>'{name_i18n,en}')=240
         and row_value#>>'{description_i18n,en}'=E'Line one\nLine two')
     or v_result#>>'{pricing_control,property_pricing_default,lifecycle_status}'<>'active' then
    raise exception 'admin_c_entity_create_or_multiline_canonicalization_failed';
  end if;

  -- 241-character names and non-LF controls are never normalized into valid data.
  v_control:=v_result->'pricing_control';
  select value into v_row from jsonb_array_elements(v_control->'rate_plans')
    where value->>'id'=c_plan_two::text;
  v_state:=pg_temp.admin_c_rate_plan_state(v_row);
  foreach v_payload in array array[
    v_state||jsonb_build_object('name_i18n',
      jsonb_set(v_row->'name_i18n','{en}',to_jsonb(repeat('x',241)))),
    v_state||jsonb_build_object('description_i18n',
      jsonb_set(v_row->'description_i18n','{en}',to_jsonb(E'Bad\ttext'::text)))
  ] loop
    v_failed:=false;
    begin perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
      c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
        'rate_plan','update',c_plan_two,(v_row->>'version')::bigint,null,null,'[]',
        false,false,v_state,v_payload))),gen_random_uuid(),
      'admin-c-invalid-i18n-'||substr(md5(v_payload::text),1,16));
    exception when sqlstate '22023' then v_failed:=true; end;
    if not v_failed then raise exception 'admin_c_invalid_i18n_allowed: %',v_payload; end if;
  end loop;

  -- Property fallback disable/no-op/reactivation is explicit and versioned.
  v_row:=v_control->'property_pricing_default';
  v_state:=pg_temp.admin_c_property_default_state(v_row);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'property_pricing_default','disable',c_default,(v_row->>'version')::bigint,
      null,null,'[]',false,false,v_state,'{}'))),
    'c2000000-0000-4000-8000-000000000031','admin-c-default-disable-031');
  if v_result#>>'{pricing_control,property_pricing_default,lifecycle_status}'<>'disabled'
     or jsonb_array_length(v_result->'activity')<>1 then
    raise exception 'admin_c_property_default_disable_failed';
  end if;
  v_control:=v_result->'pricing_control'; v_row:=v_control->'property_pricing_default';
  v_state:=pg_temp.admin_c_property_default_state(v_row);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'property_pricing_default','disable',c_default,(v_row->>'version')::bigint,
      null,null,'[]',false,false,v_state,'{}'))),
    'c2000000-0000-4000-8000-000000000032','admin-c-default-noop-032');
  if v_result->>'changed'<>'false' or jsonb_array_length(v_result->'activity')<>0 then
    raise exception 'admin_c_property_default_disable_noop_failed';
  end if;
  v_control:=v_result->'pricing_control'; v_row:=v_control->'property_pricing_default';
  v_state:=pg_temp.admin_c_property_default_state(v_row);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'property_pricing_default','update',c_default,(v_row->>'version')::bigint,
      null,null,'[]',false,true,v_state,
      v_state||jsonb_build_object('lifecycle_status','active')))),
    'c2000000-0000-4000-8000-000000000033','admin-c-default-reactivate-033');
  if v_result#>>'{pricing_control,property_pricing_default,lifecycle_status}'<>'active' then
    raise exception 'admin_c_property_default_reactivation_failed';
  end if;

  -- Allocation disable/reactivation binds the complete exact item set.
  v_control:=v_result->'pricing_control';
  select value into v_allocation from jsonb_array_elements(v_control->'allocation_rules')
    where value->>'id'=c_allocation::text;
  v_state:=pg_temp.admin_c_allocation_state(v_allocation);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'allocation_rule','disable',c_allocation,(v_allocation->>'version')::bigint,
      v_allocation->>'items_fingerprint',null,'[]',false,false,v_state,'{}'))),
    'c2000000-0000-4000-8000-000000000034','admin-c-allocation-disable-034');
  if not exists(select 1 from jsonb_array_elements(v_result#>'{pricing_control,allocation_rules}') row_value
      where row_value->>'id'=c_allocation::text and row_value->>'lifecycle_status'='disabled') then
    raise exception 'admin_c_allocation_disable_failed';
  end if;
  v_control:=v_result->'pricing_control';
  select value into v_allocation from jsonb_array_elements(v_control->'allocation_rules')
    where value->>'id'=c_allocation::text;
  v_state:=pg_temp.admin_c_allocation_state(v_allocation);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'allocation_rule','update',c_allocation,(v_allocation->>'version')::bigint,
      v_allocation->>'items_fingerprint',null,'[]',false,true,v_state,
      v_state||jsonb_build_object('lifecycle_status','active')))),
    'c2000000-0000-4000-8000-000000000035','admin-c-allocation-reactivate-035');
  if not exists(select 1 from jsonb_array_elements(v_result#>'{pricing_control,allocation_rules}') row_value
      where row_value->>'id'=c_allocation::text and row_value->>'lifecycle_status'='active') then
    raise exception 'admin_c_allocation_reactivation_failed';
  end if;

  -- Whole-rule ownership: parent identity cannot move, same-layer equal-priority
  -- overlap fails, then disable/no-op/reactivation stays fully audited.
  v_control:=v_result->'pricing_control';
  v_payload:=jsonb_build_object('room_rate_id',c_rate,
    'valid_from','2026-12-01','valid_to','2026-12-31',
    'weekdays',jsonb_build_array(1,2,3,4,5,6,7),'nightly_rate',95,
    'minimum_stay',null,'maximum_stay',null,'closed_to_arrival',false,
    'closed_to_departure',false,'priority',20,'is_active',true);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'rate_rule','create',c_rule,0,null,null,'[]',false,false,'{}',v_payload))),
    'c2000000-0000-4000-8000-000000000036','admin-c-rule-create-036');
  v_control:=v_result->'pricing_control';
  select value into v_row from jsonb_array_elements(v_control->'rate_rules')
    where value->>'id'=c_rule::text;
  v_state:=pg_temp.admin_c_rate_rule_state(v_row);
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'rate_rule','update',c_rule,(v_row->>'version')::bigint,null,null,'[]',
      false,false,v_state,v_state||jsonb_build_object('room_rate_id',c_rate_two)))),
    'c2000000-0000-4000-8000-000000000037','admin-c-rule-reparent-037');
  exception when sqlstate '22023' then
    v_failed:=sqlerrm='hotels_v2_admin_c_rate_rule_identity_is_immutable';
  end;
  if not v_failed then raise exception 'admin_c_rate_rule_reparent_allowed'; end if;

  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'rate_rule','create',c_overlap,0,null,null,'[]',false,false,'{}',
      v_state||jsonb_build_object('nightly_rate',96)))),
    'c2000000-0000-4000-8000-000000000038','admin-c-rule-overlap-038');
  exception when sqlstate '23514' then
    v_failed:=sqlerrm='hotels_v2_admin_c_equal_priority_rate_rule_overlap';
  end;
  if not v_failed then raise exception 'admin_c_same_layer_rule_overlap_allowed'; end if;

  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'rate_rule','disable',c_rule,(v_row->>'version')::bigint,null,null,'[]',
      false,false,v_state,'{}'))),
    'c2000000-0000-4000-8000-000000000039','admin-c-rule-disable-039');
  v_control:=v_result->'pricing_control';
  select value into v_row from jsonb_array_elements(v_control->'rate_rules')
    where value->>'id'=c_rule::text;
  v_state:=pg_temp.admin_c_rate_rule_state(v_row);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'rate_rule','disable',c_rule,(v_row->>'version')::bigint,null,null,'[]',
      false,false,v_state,'{}'))),
    'c2000000-0000-4000-8000-000000000040','admin-c-rule-disable-noop-040');
  if v_result->>'changed'<>'false' or jsonb_array_length(v_result->'activity')<>0 then
    raise exception 'admin_c_rate_rule_disable_noop_failed';
  end if;
  v_control:=v_result->'pricing_control';
  select value into v_row from jsonb_array_elements(v_control->'rate_rules')
    where value->>'id'=c_rule::text;
  v_state:=pg_temp.admin_c_rate_rule_state(v_row);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'rate_rule','update',c_rule,(v_row->>'version')::bigint,null,null,'[]',
      false,false,v_state,v_state||jsonb_build_object('is_active',true)))),
    'c2000000-0000-4000-8000-000000000041','admin-c-rule-reactivate-041');
  if not exists(select 1 from jsonb_array_elements(v_result#>'{pricing_control,rate_rules}') row_value
      where row_value->>'id'=c_rule::text and row_value->>'is_active'='true') then
    raise exception 'admin_c_rate_rule_reactivation_failed';
  end if;

  -- Foreign nested Room identity is rejected before any insert, and a reused
  -- correlation under a different key cannot create a second reviewed action.
  v_control:=v_result->'pricing_control';
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'room_rate','create','c2300000-0000-4000-8000-000000000099',0,null,null,'[]',
      false,false,'{}',jsonb_build_object('room_type_id',
        'b4ef504f-cdeb-4e3c-a54d-932146ef4e94','rate_plan_id',c_plan_two,
        'pricing_schedule_id',null,'base_nightly_rate',85,'currency','EUR',
        'external_redirect_url',null,'lifecycle_status','draft','sort_order',99)))),
    'c2000000-0000-4000-8000-000000000042','admin-c-foreign-room-042');
  exception when sqlstate '22023' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_c_foreign_room_rate_relationship_allowed'; end if;

  select value into v_row from jsonb_array_elements(v_control->'rate_plans')
    where value->>'id'=c_plan::text;
  v_state:=pg_temp.admin_c_rate_plan_state(v_row);
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'rate_plan','update',c_plan,(v_row->>'version')::bigint,null,null,'[]',
      false,true,v_state,v_state))),
    'c2000000-0000-4000-8000-000000000030','admin-c-correlation-conflict-043');
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_admin_c_correlation_conflict';
  end;
  if not v_failed then raise exception 'admin_c_correlation_reuse_allowed'; end if;

  -- The per-operation child ceiling is distinct from business stay limits.
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'allocation_rule','create','c1400000-0000-4000-8000-000000000099',0,
      null,null,'[]',false,false,'{}',jsonb_build_object('code','too-many-items',
        'allocation_mode','customer_choice','min_guest_count',1,'max_guest_count',3,
        'lifecycle_status','draft','sort_order',99,'items',(
          select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'hotel_id',c_hotel,
            'allocation_rule_id','c1400000-0000-4000-8000-000000000099',
            'room_type_id',c_room,'units_required',1,'allocated_guest_count',null,
            'pricing_guest_count',null,'allocated_guest_counts',null,
            'pricing_guest_counts',null,'sort_order',ordinal))
          from generate_series(1,101) ordinal))))),
    'c2000000-0000-4000-8000-000000000044','admin-c-child-cap-044');
  exception when sqlstate '22023' then
    v_failed:=sqlerrm='hotels_v2_admin_c_invalid_allocation_values';
  end;
  if not v_failed then raise exception 'admin_c_allocation_child_technical_cap_missing'; end if;
end
$entity_semantics$;

-- A max-occupancy-only Room deliberately has no adult/child split. A reviewed
-- multi-unit bundle remains valid when its exact physical allocation fits that
-- total capacity and every child satisfies the reviewed policy.
reset role;
set constraints hotel_room_allocation_rules_contract_guard,
  hotel_room_allocation_rule_items_contract_guard,
  hotel_room_allocation_rules_admin_c_extension_guard,
  hotel_room_allocation_items_admin_c_extension_guard deferred;
update public.hotel_room_types set max_occupancy=3,capacity_adults=null,
  capacity_children=null,
  base_inventory_count=2
where id='c1100000-0000-4000-8000-000000000001';
insert into public.hotel_room_allocation_rules(id,hotel_id,code,allocation_mode,
  min_guest_count,max_guest_count,is_active,review_status,sort_order)
values('c1400000-0000-4000-8000-000000000200',
  'c1000000-0000-4000-8000-000000000001','mixed-demographic-incomplete',
  'required_bundle',3,3,true,'reviewed',200);
insert into public.hotel_room_allocation_rule_items(id,hotel_id,allocation_rule_id,
  room_type_id,units_required,allocated_guest_count,pricing_guest_count,
  allocated_guest_counts,pricing_guest_counts,sort_order)
values('c1500000-0000-4000-8000-000000000200',
  'c1000000-0000-4000-8000-000000000001',
  'c1400000-0000-4000-8000-000000000200',
  'c1100000-0000-4000-8000-000000000001',2,3,3,
  array[2,1]::smallint[],array[2,1]::smallint[],200);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $max_occupancy_bundle_preview$
declare v_control jsonb; v_quote jsonb;
begin
  v_control:=public.hotel_v2_admin_get_pricing_control(
    'c1000000-0000-4000-8000-000000000001');
  v_quote:=pg_temp.admin_c_preview(
    'c1000000-0000-4000-8000-000000000001',v_control->>'snapshot_token',
    'c1200000-0000-4000-8000-000000000001',
    'c1400000-0000-4000-8000-000000000200',null,
    '2026-09-01',1,2,'[12]'::jsonb);
  if v_quote->>'ok'<>'true'
     or (v_quote->>'customer_total')::numeric<>160.00
     or v_quote#>'{allocation,0,allocated_guest_counts}'<>'[2,1]'::jsonb
     or v_quote->>'requestable'<>'false'
     or jsonb_array_length(v_quote->'blocking_reasons')<>1
     or v_quote#>>'{blocking_reasons,0,code}'<>'public_hotels_v2_off'
     or exists(select 1 from jsonb_array_elements(v_quote->'blocking_reasons') blocker
       where blocker->>'code' in('bundle_demographic_capacity_incomplete',
         'bundle_demographic_capacity_exceeded','room_demographic_capacity_exceeded')) then
    raise exception 'admin_c_max_occupancy_bundle_preview_failed: %',v_quote;
  end if;
end
$max_occupancy_bundle_preview$;
reset role;
delete from public.hotel_room_allocation_rule_items
where id='c1500000-0000-4000-8000-000000000200';
delete from public.hotel_room_allocation_rules
where id='c1400000-0000-4000-8000-000000000200';
update public.hotel_room_types set max_occupancy=null,capacity_adults=2,
  capacity_children=1,
  base_inventory_count=1
where id='c1100000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- Calendar and ADMIN-C share one exact Room/date row without sharing pricing
-- authority. Closure-only rows do not stale the pricing graph; ADMIN-C can add
-- and later clear only its six price/stay fields, while operational changes
-- preserve the exact pricing tuple and same-row version conflicts remain exact.
do $calendar_pricing_seam$
declare
  c_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_plan constant uuid:='c1200000-0000-4000-8000-000000000001';
  c_rate constant uuid:='c1300000-0000-4000-8000-000000000001';
  c_room constant uuid:='c1100000-0000-4000-8000-000000000001';
  c_allocation constant uuid:='c1400000-0000-4000-8000-000000000001';
  c_override constant uuid:='c1800000-0000-4000-8000-000000000201';
  c_collision constant uuid:='c1800000-0000-4000-8000-000000000202';
  c_stay constant date:='2027-02-10';
  v_control jsonb; v_calendar jsonb; v_result jsonb; v_row jsonb;
  v_original jsonb; v_payload jsonb; v_quote jsonb; v_raw_before jsonb;
  v_raw_after jsonb; v_token_closure text; v_token_priced text;
  v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  v_token_closure:=v_control->>'snapshot_token';
  v_calendar:=public.hotel_v2_admin_get_calendar(c_hotel,c_stay,c_stay);
  perform public.hotel_v2_admin_apply_calendar_plan(pg_temp.admin_c_calendar_plan(
    c_hotel,c_stay,c_stay,v_calendar->>'snapshot_token',jsonb_build_array(
      jsonb_build_object('entity','calendar_override','type','create',
        'id',c_override,'expected_version',0,'payload',jsonb_build_object(
          'room_rate_id',c_rate,'stay_date',c_stay,'closed',true,
          'closed_mode','set','reason','Operational closure fixture',
          'expires_at',null,'is_active',true,'source','sync',
          'source_timestamp','not-a-reviewed-timestamp',
          'provenance',jsonb_build_object('provider_id','opaque-provider-key',
            'expires_at','opaque-provider-expiry'))))),
    'c2000000-0000-4000-8000-000000000050');

  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  select value into v_row from jsonb_array_elements(v_control->'exact_date_prices')
    where value->>'id'=c_override::text;
  if v_control->>'snapshot_token'<>v_token_closure
     or v_row is null or v_row->>'pricing_configured'<>'false'
     or v_row->>'shared_with_calendar'<>'true' then
    raise exception 'admin_c_closure_only_row_staled_pricing: %',v_control;
  end if;

  -- A second Calendar create for the exact tuple is rejected before the old
  -- core can surface a raw unique error or invent a parallel row.
  v_calendar:=public.hotel_v2_admin_get_calendar(c_hotel,c_stay,c_stay);
  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_calendar_plan(pg_temp.admin_c_calendar_plan(
      c_hotel,c_stay,c_stay,v_calendar->>'snapshot_token',jsonb_build_array(
        jsonb_build_object('entity','calendar_override','type','create',
          'id',c_collision,'expected_version',0,'payload',jsonb_build_object(
            'room_rate_id',c_rate,'stay_date',c_stay,'closed',false,
            'closed_mode','set','reason','Colliding operational create')))),
      'c2000000-0000-4000-8000-000000000051');
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm=
      'hotels_v2_admin_c_calendar_override_key_exists_use_existing_id';
  end;
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  if not v_failed or exists(select 1
      from jsonb_array_elements(v_control->'exact_date_prices') exact_row
      where exact_row->>'id'=c_collision::text) then
    raise exception 'admin_c_calendar_tuple_collision_not_controlled';
  end if;

  -- Add an exact nightly SET to the existing closure row using its exact ID,
  -- version, and all-null eight-field pricing original.
  v_original:=pg_temp.admin_c_exact_price_state(v_row);
  v_payload:=jsonb_build_object('nightly_rate_mode','set','nightly_rate',111,
    'minimum_stay_mode',null,'minimum_stay',null,
    'maximum_stay_mode',null,'maximum_stay',null,
    'reason','Reviewed price on shared row','expires_at',null);
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'exact_date_price','update',c_override,(v_row->>'version')::bigint,
      null,null,'[]',false,false,v_original,v_payload))),
    'c2000000-0000-4000-8000-000000000052','admin-c-shared-exact-set-052');
  v_control:=v_result->'pricing_control';
  v_token_priced:=v_control->>'snapshot_token';
  select value into v_row from jsonb_array_elements(v_control->'exact_date_prices')
    where value->>'id'=c_override::text;
  if v_token_priced=v_token_closure or v_row->>'pricing_source'<>'manual'
     or v_row->>'pricing_configured'<>'true'
     or (v_row->>'nightly_rate')::numeric<>111 then
    raise exception 'admin_c_shared_exact_price_not_token_bound: %',v_row;
  end if;
  v_quote:=pg_temp.admin_c_preview(c_hotel,v_token_priced,c_plan,c_allocation,
    c_room,c_stay,1,2);
  if v_quote->>'ok'<>'true' or (v_quote->>'customer_total')::numeric<>111
     or v_quote#>>'{nightly_breakdown,0,final_pricing_source}'<>'exact_date_price' then
    raise exception 'admin_c_shared_exact_price_preview_failed: %',v_quote;
  end if;

  -- Save the exact pricing tuple, then update only Calendar-owned state. New
  -- ADMIN-C provenance makes row-wide is_active/expires_at operational-only.
  v_calendar:=public.hotel_v2_admin_get_calendar(c_hotel,c_stay,c_stay);
  select value into v_raw_before from jsonb_array_elements(v_calendar->'calendar_overrides')
    where value->>'id'=c_override::text;
  perform public.hotel_v2_admin_apply_calendar_plan(pg_temp.admin_c_calendar_plan(
    c_hotel,c_stay,c_stay,v_calendar->>'snapshot_token',jsonb_build_array(
      jsonb_build_object('entity','calendar_override','type','update',
        'id',c_override,'expected_version',(v_raw_before->>'version')::bigint,
        'payload',jsonb_build_object('closed',false,'closed_mode','set',
          'reason','Operational state changed only','expires_at','2099-01-01T00:00:00Z',
          'is_active',false)))),
    'c2000000-0000-4000-8000-000000000053');
  v_calendar:=public.hotel_v2_admin_get_calendar(c_hotel,c_stay,c_stay);
  select value into v_raw_after from jsonb_array_elements(v_calendar->'calendar_overrides')
    where value->>'id'=c_override::text;
  if (v_raw_after-'closed'-'closed_mode'-'reason'-'expires_at'-'is_active'
        -'actor_id'-'actor_type'-'source'-'source_timestamp'-'provenance'
        -'version'-'updated_at'-'created_at')
       is distinct from
     (v_raw_before-'closed'-'closed_mode'-'reason'-'expires_at'-'is_active'
        -'actor_id'-'actor_type'-'source'-'source_timestamp'-'provenance'
        -'version'-'updated_at'-'created_at')
     or v_raw_after->>'closed'<>'false' or v_raw_after->>'is_active'<>'false'
     or v_raw_after->>'expires_at' is null then
    raise exception 'admin_c_calendar_update_changed_pricing_tuple: %, %',
      v_raw_before,v_raw_after;
  end if;
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  if v_control->>'snapshot_token'<>v_token_priced then
    raise exception 'admin_c_operational_shared_row_update_staled_pricing';
  end if;
  v_quote:=pg_temp.admin_c_preview(c_hotel,v_token_priced,c_plan,c_allocation,
    c_room,c_stay,1,2);
  if v_quote->>'ok'<>'true' or (v_quote->>'customer_total')::numeric<>111 then
    raise exception 'admin_c_operational_row_state_changed_price_preview: %',v_quote;
  end if;

  -- The global token intentionally merges this operational edit, while the
  -- exact row version still catches a reviewed same-row write.
  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
      c_hotel,v_token_priced,jsonb_build_array(pg_temp.admin_c_operation(
        'exact_date_price','update',c_override,(v_row->>'version')::bigint,
        null,null,'[]',false,false,pg_temp.admin_c_exact_price_state(v_row),
        v_payload||jsonb_build_object('nightly_rate',112)))),
      'c2000000-0000-4000-8000-000000000054','admin-c-shared-exact-stale-054');
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_admin_c_stale_exact_price';
  end;
  if not v_failed then raise exception 'admin_c_same_row_calendar_race_not_stale'; end if;

  -- Refresh and clear only the ADMIN-C pricing tuple. The operational row and
  -- closure state remain, and the closure-only row again leaves the token out.
  select value into v_row from jsonb_array_elements(v_control->'exact_date_prices')
    where value->>'id'=c_override::text;
  v_result:=public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'exact_date_price','disable',c_override,(v_row->>'version')::bigint,
      null,null,'[]',false,false,pg_temp.admin_c_exact_price_state(v_row),'{}'))),
    'c2000000-0000-4000-8000-000000000055','admin-c-shared-exact-disable-055');
  v_control:=v_result->'pricing_control';
  select value into v_row from jsonb_array_elements(v_control->'exact_date_prices')
    where value->>'id'=c_override::text;
  if v_control->>'snapshot_token'<>v_token_closure or v_row is null
     or v_row->>'pricing_configured'<>'false' or v_row->'pricing_source'<>'null'::jsonb
     or v_row->'pricing_reason'<>'null'::jsonb then
    raise exception 'admin_c_shared_exact_disable_damaged_operational_row: %',v_row;
  end if;
end
$calendar_pricing_seam$;

-- Retired writer entry points fail before their preserved internal cores can
-- mutate ADMIN-C-owned pricing fields.
do $legacy_writer_retirement$
declare v_failed boolean;
begin
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_workspace_plan(jsonb_build_object(
    'operations',jsonb_build_array(jsonb_build_object('entity','rate_plan'))),
    'c2000000-0000-4000-8000-000000000056');
  exception when sqlstate '42501' then
    v_failed:=sqlerrm='hotels_v2_admin_c_use_pricing_control_rpc';
  end;
  if not v_failed then raise exception 'admin_c_workspace_pricing_writer_open'; end if;

  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
    'hotel_id','c1000000-0000-4000-8000-000000000001',
    'from','2027-03-01','to','2027-03-01',
    'reviewed_at',to_char(clock_timestamp() at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'snapshot_token',repeat('0',32),
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','rate_rule','type','update','payload','{}'::jsonb))),
    'c2000000-0000-4000-8000-000000000057');
  exception when sqlstate '42501' then
    v_failed:=sqlerrm='hotels_v2_admin_c_pricing_owned_by_pricing_control';
  end;
  if not v_failed then raise exception 'admin_c_calendar_pricing_writer_open'; end if;

  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_h3_1_configuration(jsonb_build_object(
    'operations',jsonb_build_array(jsonb_build_object('entity','pricing_schedule'))),
    'c2000000-0000-4000-8000-000000000058');
  exception when sqlstate '42501' then
    v_failed:=sqlerrm='hotels_v2_admin_c_use_pricing_control_rpc';
  end;
  if not v_failed then raise exception 'admin_c_h3_pricing_writer_open'; end if;
end
$legacy_writer_retirement$;

-- A positive base price cannot make an active graph ready when the Hotel has
-- no explicit business minimum-stay rule. Validate in a subtransaction so the
-- rejected cross-domain edit is proven to roll back atomically.
reset role;
do $missing_minimum_stay$
declare v_failed boolean:=false; v_minimum integer;
begin
  begin
    update public.hotels set minimum_stay_nights=null
    where id='c1000000-0000-4000-8000-000000000001';
    perform public.hotel_v2_admin_c_validate_pricing_graph(
      'c1000000-0000-4000-8000-000000000001');
  exception when sqlstate '23514' then
    v_failed:=sqlerrm='hotels_v2_admin_c_active_graph_minimum_stay_required';
  end;
  select minimum_stay_nights into v_minimum from public.hotels
    where id='c1000000-0000-4000-8000-000000000001';
  if not v_failed or v_minimum<>1 then
    raise exception 'admin_c_missing_minimum_stay_activation_not_atomic: %, %',
      v_failed,v_minimum;
  end if;
end
$missing_minimum_stay$;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- Global token binds pricing-semantic dependencies only. Presentation/private
-- profile edits and ADMIN-D-owned CTA/CTD/version fields do not stale pricing;
-- booking mode and child-policy inputs do.
select set_config('hotels_v2.admin_c_token_before_nonpricing',
  public.hotel_v2_admin_get_pricing_control(
    'c1000000-0000-4000-8000-000000000001')->>'snapshot_token',true);
reset role;
update public.hotel_room_types set name_i18n=jsonb_build_object(
  'pl','Studio testowe','en','Test Studio','he','סטודיו בדיקה')
where id='c1100000-0000-4000-8000-000000000001';
update public.hotel_property_operational_profiles
set guest_instructions_i18n=jsonb_build_object('en','Private instruction only')
where hotel_id='c1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('hotels_v2.admin_c_token_after_nonpricing',
  public.hotel_v2_admin_get_pricing_control(
    'c1000000-0000-4000-8000-000000000001')->>'snapshot_token',true);
do $nonpricing_token$
begin
  if current_setting('hotels_v2.admin_c_token_before_nonpricing') is distinct from
     current_setting('hotels_v2.admin_c_token_after_nonpricing') then
    raise exception 'admin_c_nonpricing_metadata_staled_snapshot';
  end if;
end
$nonpricing_token$;
reset role;
insert into public.hotel_rate_rules(id,room_rate_id,valid_from,valid_to,weekdays,
  nightly_rate,minimum_stay,maximum_stay,closed_to_arrival,closed_to_departure,
  priority,is_active,source,provenance)
values('c1f00000-0000-4000-8000-000000000001',
  'c1300000-0000-4000-8000-000000000001','2026-11-01','2026-11-30',
  array[1,2,3,4,5,6,7]::smallint[],88,null,null,false,false,5,true,'manual','{}');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('hotels_v2.admin_c_token_before_cta',
  public.hotel_v2_admin_get_pricing_control(
    'c1000000-0000-4000-8000-000000000001')->>'snapshot_token',true);
do $pricing_rule_token$
begin
  if current_setting('hotels_v2.admin_c_token_after_nonpricing')=
     current_setting('hotels_v2.admin_c_token_before_cta') then
    raise exception 'admin_c_pricing_rule_not_token_bound';
  end if;
end
$pricing_rule_token$;
reset role;
update public.hotel_rate_rules set closed_to_arrival=true
where id='c1f00000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $cta_token$
declare v_after text;
begin
  v_after:=public.hotel_v2_admin_get_pricing_control(
    'c1000000-0000-4000-8000-000000000001')->>'snapshot_token';
  if v_after is distinct from current_setting('hotels_v2.admin_c_token_before_cta') then
    raise exception 'admin_c_calendar_cta_staled_pricing_snapshot';
  end if;
end
$cta_token$;
reset role;
update public.hotels set booking_mode='instant_booking'
where id='c1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $semantic_token$
declare v_after text; v_failed boolean:=false; v_old text;
begin
  v_old:=current_setting('hotels_v2.admin_c_token_before_cta');
  v_after:=public.hotel_v2_admin_get_pricing_control(
    'c1000000-0000-4000-8000-000000000001')->>'snapshot_token';
  if v_after=v_old then raise exception 'admin_c_booking_mode_not_token_bound'; end if;
  begin perform public.hotel_v2_admin_preview_pricing_quote(jsonb_build_object(
    'contract_version','hotels_v2_admin_c_pricing_preview_v1',
    'hotel_id','c1000000-0000-4000-8000-000000000001',
    'snapshot_token',v_old,'rate_plan_id','c1200000-0000-4000-8000-000000000001',
    'allocation_rule_id','c1400000-0000-4000-8000-000000000001',
    'selected_room_type_id','c1100000-0000-4000-8000-000000000001',
    'check_in','2026-10-01','check_out','2026-10-02','adults',2,
    'child_ages','[]'::jsonb));
  exception when sqlstate 'PT409' then v_failed:=true; end;
  if not v_failed then raise exception 'admin_c_stale_semantic_preview_allowed'; end if;
end
$semantic_token$;
reset role;
update public.hotels set booking_mode='request_confirmation'
where id='c1000000-0000-4000-8000-000000000001';
update public.hotel_rate_rules set closed_to_arrival=false
where id='c1f00000-0000-4000-8000-000000000001';
delete from public.hotel_rate_rules where id='c1f00000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- Force deferred graph/cross-domain checks while the generic graph exists.
set constraints all immediate;
set constraints all deferred;
rollback;

-- Read-only accepted 7K graph: 70/0 remains exact, all C mutation is frozen,
-- one guest uses the two-person floor, and one night fails explicit stay rules.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $legacy$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_plan constant uuid:='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  v_control jsonb; v_quote jsonb; v_rule uuid; v_guest integer;
  v_nights integer; v_expected_threshold integer; v_sum integer; v_failed boolean;
  v_expected_physical jsonb; v_expected_pricing jsonb;
  v_actual_physical jsonb; v_actual_pricing jsonb;
begin
  v_control:=public.hotel_v2_admin_get_pricing_control(c_hotel);
  if v_control#>>'{legacy_safety,architecture_version}'<>'legacy'
     or v_control#>>'{legacy_safety,public_change}'<>'false'
     or v_control->'property_pricing_default'<>'null'::jsonb then
    raise exception 'admin_c_7k_contract_drift';
  end if;

  for v_guest in 1..8 loop
    v_rule:=case when v_guest<=4 then '31000000-0000-4000-8000-000000000014'::uuid
      else ('31000000-0000-4000-8000-0000000000'||(10+v_guest)::text)::uuid end;
    v_quote:=pg_temp.admin_c_preview(c_hotel,v_control->>'snapshot_token',c_plan,v_rule,
      case when v_guest<=4 then c_upper else null end,'2026-09-01',2,v_guest);
    select coalesce(sum((item->>'allocated_guest_count')::integer),0) into v_sum
      from jsonb_array_elements(v_quote->'allocation') item;
    v_expected_physical:=case v_guest
      when 5 then '[3,2]'::jsonb when 6 then '[3,3]'::jsonb
      when 7 then '[4,3]'::jsonb when 8 then '[4,4]'::jsonb
      else jsonb_build_array(v_guest) end;
    v_expected_pricing:=case v_guest
      when 5 then '[2,2]'::jsonb when 6 then '[3,3]'::jsonb
      when 7 then '[4,4]'::jsonb when 8 then '[4,4]'::jsonb
      else jsonb_build_array(v_guest) end;
    select coalesce(jsonb_agg((item.value->>'allocated_guest_count')::integer
        order by item.ordinal),'[]'::jsonb)
      into v_actual_physical
      from jsonb_array_elements(v_quote->'allocation') with ordinality item(value,ordinal);
    select coalesce(jsonb_agg((product.value->>'requested_pricing_guest_count')::integer
        order by product.ordinal),'[]'::jsonb)
      into v_actual_pricing
      from jsonb_array_elements(v_quote->'products') with ordinality product(value,ordinal);
    if v_quote->>'ok'<>'true' or v_sum<>v_guest
       or v_actual_physical<>v_expected_physical
       or v_actual_pricing<>v_expected_pricing then
      raise exception 'admin_c_7k_guest_mapping_failed: %, %',v_guest,v_quote;
    end if;
    if v_guest=1 and v_quote#>>'{products,0,resolved_pricing_guest_count}'<>'2' then
      raise exception 'admin_c_7k_one_guest_floor_failed';
    end if;
  end loop;
  foreach v_nights in array array[2,3,7,14,15] loop
    v_expected_threshold:=least(v_nights,10);
    v_quote:=pg_temp.admin_c_preview(c_hotel,v_control->>'snapshot_token',c_plan,
      '31000000-0000-4000-8000-000000000014',c_upper,'2026-09-01',v_nights,2);
    if v_quote->>'ok'<>'true'
       or (v_quote#>>'{products,0,los_threshold_nights}')::integer<>v_expected_threshold then
      raise exception 'admin_c_7k_los_continuation_failed: %, %',v_nights,v_quote;
    end if;
  end loop;

  v_quote:=pg_temp.admin_c_preview(c_hotel,v_control->>'snapshot_token',c_plan,
    '31000000-0000-4000-8000-000000000014',c_upper,'2026-09-01',1,2);
  if v_quote->>'ok'<>'false' or v_quote->'customer_total'<>'null'::jsonb
     or not exists(select 1 from jsonb_array_elements(v_quote->'blocking_reasons') blocker
       where blocker->>'code'='below_minimum_stay') then
    raise exception 'admin_c_7k_one_night_fail_closed_failed: %',v_quote;
  end if;

  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_pricing_control_plan(pg_temp.admin_c_plan(
    c_hotel,v_control->>'snapshot_token',jsonb_build_array(pg_temp.admin_c_operation(
      'property_pricing_default','create','c1900000-0000-4000-8000-000000000001',
      0,null,null,'[]',false,false,'{}',jsonb_build_object('hotel_id',c_hotel,
        'nightly_rate',100,'currency','EUR','lifecycle_status','draft')))),
    'c2000000-0000-4000-8000-000000000090','admin-c-7k-freeze-090');
  exception when sqlstate '55000' then
    v_failed:=sqlerrm='hotels_v2_admin_c_h3_1p_graph_immutable';
  end;
  if not v_failed then raise exception 'admin_c_7k_mutation_not_frozen'; end if;
end
$legacy$;
rollback;

-- Exact ACL/search-path/cap definitions are part of the executable package.
reset role;
do $static_runtime_contract$
declare v_signature text; v_snapshot jsonb;
begin
  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if v_snapshot#>>'{parity,total_case_count}'<>'70'
     or v_snapshot#>>'{parity,total_mismatch_count}'<>'0' then
    raise exception 'admin_c_legacy_oracle_drift';
  end if;
  if not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() then
    raise exception 'admin_c_7k_persisted_allocation_contract_drift';
  end if;
  if not public.hotel_v2_admin_c_uuid_is_canonical(
       'c2000000-0000-5000-8000-000000000001')
     or public.hotel_v2_admin_c_uuid_is_canonical(
       'c2000000-0000-7000-8000-000000000001')
     or public.hotel_v2_admin_c_uuid_is_canonical(
       'c2000000-0000-0000-8000-000000000001')
     or public.hotel_v2_admin_c_uuid_is_canonical(
       'c2000000-0000-4000-7000-000000000001')
     or public.hotel_v2_admin_c_uuid_is_canonical(
       'C2000000-0000-4000-8000-000000000001') then
    raise exception 'admin_c_uuid_version_variant_contract_drift';
  end if;
  if not public.hotel_v2_admin_c_date_is_canonical('2028-02-29')
     or public.hotel_v2_admin_c_date_is_canonical('2027-02-29')
     or public.hotel_v2_admin_c_date_is_canonical('2027-2-09')
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(
       '2027-02-28T23:59:59.123456+14:00')
     or public.hotel_v2_admin_c_timestamptz_is_canonical(
       '2027-02-28T24:00:00Z')
     or public.hotel_v2_admin_c_timestamptz_is_canonical(
       '2027-02-29T12:00:00Z') then
    raise exception 'admin_c_exact_date_timestamp_contract_drift';
  end if;
  foreach v_signature in array array[
    'public.hotel_v2_admin_get_pricing_control(uuid)',
    'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
    'public.hotel_v2_admin_preview_pricing_quote(jsonb)'
  ] loop
    if (select proconfig from pg_proc where oid=to_regprocedure(v_signature))
       is distinct from array['search_path=pg_catalog, public, auth']::text[] then
      raise exception 'admin_c_public_search_path_not_exact: %',v_signature;
    end if;
  end loop;
  if exists(select 1 from pg_proc procedure_row
      join pg_namespace namespace_row on namespace_row.oid=procedure_row.pronamespace
      where namespace_row.nspname='public'
        and (left(procedure_row.proname,length('hotel_v2_admin_c_'))=
            'hotel_v2_admin_c_'
          or right(procedure_row.proname,length('_admin_c_core'))=
            '_admin_c_core')
        and procedure_row.proname<>'hotel_v2_admin_c_guest_array_matches_total'
        and (procedure_row.proowner<>'postgres'::regrole
          or (procedure_row.proconfig is distinct from
                array['search_path=pg_catalog']::text[]
            and procedure_row.proconfig is distinct from
                array['search_path=pg_catalog, public']::text[])
          or (procedure_row.prosecdef and procedure_row.proconfig is distinct from
            array['search_path=pg_catalog, public']::text[])
          or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
          or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
          or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))) then
    raise exception 'admin_c_internal_helper_acl_or_search_path_drift';
  end if;
  if left('hotel_v2_admin_create_property_draft',length('hotel_v2_admin_c_'))=
       'hotel_v2_admin_c_'
     or right('hotel_v2_admin_create_property_draft_admin_b_core',
       length('_admin_c_core'))='_admin_c_core'
     or left('hotel_v2_admin_c_uuid_is_canonical',length('hotel_v2_admin_c_'))<>
       'hotel_v2_admin_c_'
     or right('hotel_v2_admin_apply_workspace_plan_admin_c_core',
       length('_admin_c_core'))<>'_admin_c_core' then
    raise exception 'admin_c_internal_helper_classifier_drift';
  end if;
  if position('hotel_v2_admin_c_enforce_graph_limits' in pg_get_functiondef(
       'public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure))=0
     or position('octet_length(convert_to(v_result::text' in
       pg_get_functiondef('public.hotel_v2_admin_c_pricing_control_snapshot(uuid)'::regprocedure))=0 then
    raise exception 'admin_c_technical_limit_enforcement_missing';
  end if;
end
$static_runtime_contract$;

select true as hotels_v2_admin_c_pricing_control_postgres_safe,
  1 as generic_one_room_hotels,8 as legacy_guest_mappings,
  true as legacy_physical_pricing_mapping_exact,
  true as canonical_uuid_date_time_transport_safe,
  true as calendar_provenance_transport_isolated,
  true as noop_receipt_replay_safe,
  true as child_age_capacity_preview_safe,
  true as max_occupancy_bundle_preview_safe,
  5 as los_threshold_cases,70 as legacy_oracle_cases,0 as legacy_oracle_mismatches;
