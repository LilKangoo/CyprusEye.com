\set ON_ERROR_STOP on

\ir hotels-v2-h2a-base.sql
\ir ../../supabase/migrations/20260811170000_hotels_v2_h1a_core.sql
\ir ../../supabase/migrations/20260811200000_hotels_v2_h2a_admin_workspace_foundation.sql
\ir ../../supabase/migrations/20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql
\ir ../../supabase/migrations/20260811220000_hotels_v2_h2a_legacy_price_visibility.sql
\ir ../../supabase/migrations/20260811230000_hotels_v2_h2b_calendar_rates_foundation.sql

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);

-- Create one shadow-only Room Type × Rate Plan product through the established
-- exact/versioned H2A transaction. The legacy property remains the public path.
select public.hotel_v2_admin_apply_workspace_plan(
  jsonb_build_object(
    'hotel_id','30000000-0000-4000-8000-000000000001',
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(
      jsonb_build_object(
        'entity','room_type','type','create','id','61000000-0000-4000-8000-000000000001',
        'payload',jsonb_build_object(
          'code','shadow-room-one','name_i18n',jsonb_build_object('en','Shadow Room One'),
          'capacity_adults',2,'capacity_children',0,'inventory_mode','pooled',
          'base_inventory_count',3,'bed_configuration','[]'::jsonb,'status','active'
        )
      ),
      jsonb_build_object(
        'entity','rate_plan','type','create','id','62000000-0000-4000-8000-000000000001',
        'payload',jsonb_build_object(
          'code','standard','name_i18n',jsonb_build_object('en','Standard'),
          'cancellation_policy',jsonb_build_object('type','flexible'),'is_active',true
        )
      ),
      jsonb_build_object(
        'entity','room_rate','type','create','id','63000000-0000-4000-8000-000000000001',
        'payload',jsonb_build_object(
          'room_type_id','61000000-0000-4000-8000-000000000001',
          'rate_plan_id','62000000-0000-4000-8000-000000000001',
          'base_nightly_rate',100,'currency','EUR','is_active',true
        )
      )
    )
  ),
  '60000000-0000-4000-8000-000000000001'
);

do $h2b_apply_and_resolve$
declare
  v_calendar jsonb;
  v_result jsonb;
  v_quote jsonb;
begin
  v_calendar:=public.hotel_v2_admin_get_calendar(
    '30000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03'
  );
  if v_calendar->>'hotel_id'<>'30000000-0000-4000-8000-000000000001'
     or v_calendar->>'start_date'<>'2030-01-01' or v_calendar->>'end_date'<>'2030-01-03'
     or jsonb_array_length(v_calendar->'room_rates')<>1
     or jsonb_array_length(v_calendar->'effective_cells')<>3
     or nullif(v_calendar->>'snapshot_token','') is null then
    raise exception 'hotels_v2_h2b_gate_calendar_shape_failed';
  end if;

  v_result:=public.hotel_v2_admin_apply_calendar_plan(
    jsonb_build_object(
      'hotel_id','30000000-0000-4000-8000-000000000001',
      'from','2030-01-01','to','2030-01-03','reviewed_at',clock_timestamp(),
      'snapshot_token',v_calendar->>'snapshot_token',
      'operations',jsonb_build_array(
        jsonb_build_object(
          'entity','occupancy_tier','type','create','id','64000000-0000-4000-8000-000000000001','expected_version',0,
          'payload',jsonb_build_object('room_rate_id','63000000-0000-4000-8000-000000000001','guest_count',2,'threshold_nights',1,'nightly_rate',90,'is_active',true)
        ),
        jsonb_build_object(
          'entity','rate_rule','type','create','id','65000000-0000-4000-8000-000000000001','expected_version',0,
          'payload',jsonb_build_object(
            'room_rate_id','63000000-0000-4000-8000-000000000001','valid_from','2030-01-01','valid_to','2030-01-31',
            'weekdays',jsonb_build_array(1,2,3,4,5,6),'nightly_rate',110,'minimum_stay',2,
            'closed_to_arrival',false,'closed_to_departure',false,'priority',10,'is_active',true
          )
        ),
        jsonb_build_object(
          'entity','rate_rule','type','create','id','65000000-0000-4000-8000-000000000002','expected_version',0,
          'payload',jsonb_build_object(
            'room_rate_id','63000000-0000-4000-8000-000000000001','valid_from','2030-01-01','valid_to','2030-01-31',
            'weekdays',jsonb_build_array(1,2,3,4,5,6,7),'nightly_rate',120,
            'closed_to_arrival',false,'closed_to_departure',false,'priority',10,'is_active',true
          )
        ),
        jsonb_build_object(
          'entity','calendar_override','type','create','id','66000000-0000-4000-8000-000000000001','expected_version',0,
          'payload',jsonb_build_object(
            'room_rate_id','63000000-0000-4000-8000-000000000001','stay_date','2030-01-01',
            'nightly_rate',130,'nightly_rate_mode','set','minimum_stay',null,'minimum_stay_mode','clear',
            'reason','Synthetic exact-date test','expires_at','2099-01-01T00:00:00Z','source','manual',
            'is_active',true,'provenance',jsonb_build_object('fixture','h2b')
          )
        ),
        jsonb_build_object(
          'entity','daily_inventory','type','upsert','expected_version',0,
          'payload',jsonb_build_object(
            'room_type_id','61000000-0000-4000-8000-000000000001','stay_date','2030-01-01',
            'sellable_units',2,'sellable_units_mode','set','closed',false,'closed_mode','set',
            'reason','Synthetic inventory test','expires_at','2099-01-01T00:00:00Z',
            'provenance',jsonb_build_object('fixture','h2b','reason','Synthetic inventory test','expires_at','2099-01-01T00:00:00Z')
          )
        )
      )
    ),
    '60000000-0000-4000-8000-000000000002'
  );

  if v_result->>'correlation_id'<>'60000000-0000-4000-8000-000000000002'
     or (select count(*) from public.hotel_activity_log where correlation_id='60000000-0000-4000-8000-000000000002')<>5 then
    raise exception 'hotels_v2_h2b_gate_atomic_activity_failed';
  end if;

  v_quote:=public.hotel_v2_admin_resolve_rate(
    '63000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03',2
  );
  if not (v_quote->>'ok')::boolean or not (v_quote->>'requestable')::boolean
     or (v_quote->>'total')::numeric<>250
     or v_quote->'selected_occupancy_tier'->>'id'<>'64000000-0000-4000-8000-000000000001'
     or (v_quote->'nightly_breakdown'->0->>'nightly_rate')::numeric<>130
     or (v_quote->'nightly_breakdown'->1->>'nightly_rate')::numeric<>120
     or (v_quote->'nightly_breakdown'->0->>'minimum_stay')::integer<>2
     or (v_quote->'nightly_breakdown'->0->>'sellable_units')::integer<>2
     or v_quote->'nightly_breakdown'->0->>'source'<>'exact_date_override'
     or v_quote->'nightly_breakdown'->1->>'source'<>'range_rule' then
    raise exception 'hotels_v2_h2b_gate_precedence_or_quote_failed: %',v_quote;
  end if;

  v_quote:=public.hotel_v2_admin_resolve_rate(
    '63000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03',1
  );
  if (v_quote->>'ok')::boolean or v_quote->>'reason'<>'missing_occupancy_los_tier' then
    raise exception 'hotels_v2_h2b_gate_occupancy_fail_closed_failed: %',v_quote;
  end if;
end
$h2b_apply_and_resolve$;

do $h2b_nullable_expiry_modes$
declare
  v_calendar jsonb;
begin
  -- Omitting expiry is NO CHANGE for both exact-rate and inventory rows.
  v_calendar:=public.hotel_v2_admin_get_calendar(
    '30000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03'
  );
  perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
    'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
    'reviewed_at',clock_timestamp(),'snapshot_token',v_calendar->>'snapshot_token',
    'operations',jsonb_build_array(
      jsonb_build_object(
        'entity','calendar_override','type','update','id','66000000-0000-4000-8000-000000000001','expected_version',1,
        'payload',jsonb_build_object('reason','Expiry remains unchanged','source','manual')
      ),
      jsonb_build_object(
        'entity','daily_inventory','type','upsert','expected_version',1,
        'payload',jsonb_build_object(
          'room_type_id','61000000-0000-4000-8000-000000000001','stay_date','2030-01-01',
          'reason','Inventory expiry remains unchanged'
        )
      )
    )
  ),'60000000-0000-4000-8000-000000000011');

  if (select expires_at from public.hotel_calendar_overrides
      where id='66000000-0000-4000-8000-000000000001') <> '2099-01-01T00:00:00Z'::timestamptz
     or (select expires_at from public.hotel_daily_inventory
         where room_type_id='61000000-0000-4000-8000-000000000001' and stay_date='2030-01-01')
        <> '2099-01-01T00:00:00Z'::timestamptz then
    raise exception 'hotels_v2_h2b_gate_expiry_no_change_failed';
  end if;
end
$h2b_nullable_expiry_modes$;

do $h2b_stale_snapshot$
declare
  v_failed boolean:=false;
begin
  begin
    perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
      'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
      'reviewed_at',clock_timestamp(),'snapshot_token','stale-token',
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','occupancy_tier','type','update','id','64000000-0000-4000-8000-000000000001','expected_version',1,
        'payload',jsonb_build_object('nightly_rate',91)
      ))
    ),'60000000-0000-4000-8000-000000000003');
  exception when serialization_failure then v_failed:=true;
  end;
  if not v_failed or (select nightly_rate from public.hotel_room_rate_occupancy_tiers where id='64000000-0000-4000-8000-000000000001')<>90 then
    raise exception 'hotels_v2_h2b_gate_stale_snapshot_failed';
  end if;
end
$h2b_stale_snapshot$;

do $h2b_review_age_and_shape_guards$
declare
  v_calendar jsonb;
  v_failed boolean;
begin
  v_calendar:=public.hotel_v2_admin_get_calendar('30000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03');

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
      'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
      'reviewed_at',clock_timestamp()-interval '31 minutes','snapshot_token',v_calendar->>'snapshot_token',
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','occupancy_tier','type','update','id','64000000-0000-4000-8000-000000000001','expected_version',1,
        'payload',jsonb_build_object('nightly_rate',91)
      ))
    ),'60000000-0000-4000-8000-000000000007');
  exception when invalid_parameter_value then v_failed:=true;
  end;
  if not v_failed then raise exception 'hotels_v2_h2b_gate_old_review_failed'; end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
      'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
      'reviewed_at',clock_timestamp(),'snapshot_token',v_calendar->>'snapshot_token',
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','rate_rule','type','create','id','65000000-0000-4000-8000-000000000099','expected_version',0,
        'payload',jsonb_build_object(
          'room_rate_id','63000000-0000-4000-8000-000000000001','valid_from','2031-01-01','valid_to','2031-01-03',
          'weekdays',jsonb_build_array(1,1,1,1,1,1,1),'nightly_rate',999,'priority',90,'is_active',true
        )
      ))
    ),'60000000-0000-4000-8000-000000000008');
  exception when invalid_parameter_value then v_failed:=true;
  end;
  if not v_failed or exists(select 1 from public.hotel_rate_rules where id='65000000-0000-4000-8000-000000000099') then
    raise exception 'hotels_v2_h2b_gate_duplicate_weekdays_failed';
  end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
      'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
      'reviewed_at',clock_timestamp(),'snapshot_token',v_calendar->>'snapshot_token',
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','occupancy_tier','type','create','id','64000000-0000-4000-8000-000000000099','expected_version',0,
        'payload',jsonb_build_object(
          'room_rate_id','63000000-0000-4000-8000-000000000001','guest_count',4,
          'threshold_nights',1,'nightly_rate',999,'is_active',true
        )
      ))
    ),'60000000-0000-4000-8000-000000000009');
  exception when check_violation then v_failed:=true;
  end;
  if not v_failed or exists(select 1 from public.hotel_room_rate_occupancy_tiers where id='64000000-0000-4000-8000-000000000099') then
    raise exception 'hotels_v2_h2b_gate_occupancy_capacity_failed';
  end if;
end
$h2b_review_age_and_shape_guards$;

do $h2b_equal_priority_overlap$
declare
  v_calendar jsonb;
  v_failed boolean:=false;
  v_activity_before integer;
begin
  v_calendar:=public.hotel_v2_admin_get_calendar('30000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03');
  select count(*) into v_activity_before from public.hotel_activity_log;
  begin
    perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
      'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
      'reviewed_at',clock_timestamp(),'snapshot_token',v_calendar->>'snapshot_token',
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','rate_rule','type','create','id','65000000-0000-4000-8000-000000000003','expected_version',0,
        'payload',jsonb_build_object(
          'room_rate_id','63000000-0000-4000-8000-000000000001','valid_from','2030-01-02','valid_to','2030-01-10',
          'weekdays',jsonb_build_array(1,2,3,4,5,6,7),'nightly_rate',125,'priority',10,'is_active',true
        )
      ))
    ),'60000000-0000-4000-8000-000000000004');
  exception when check_violation then v_failed:=true;
  end;
  if not v_failed or exists(select 1 from public.hotel_rate_rules where id='65000000-0000-4000-8000-000000000003')
     or (select count(*) from public.hotel_activity_log)<>v_activity_before then
    raise exception 'hotels_v2_h2b_gate_overlap_atomic_abort_failed';
  end if;
end
$h2b_equal_priority_overlap$;

do $h2b_clear_and_inventory_mode$
declare
  v_calendar jsonb;
  v_quote jsonb;
begin
  v_calendar:=public.hotel_v2_admin_get_calendar('30000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03');
  perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
    'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
    'reviewed_at',clock_timestamp(),'snapshot_token',v_calendar->>'snapshot_token',
    'operations',jsonb_build_array(
      jsonb_build_object(
        'entity','calendar_override','type','update','id','66000000-0000-4000-8000-000000000001','expected_version',2,
        'payload',jsonb_build_object('nightly_rate',null,'nightly_rate_mode','clear','reason','Review fall-through','expires_at',null,'source','manual')
      ),
      jsonb_build_object(
        'entity','daily_inventory','type','upsert','expected_version',2,
        'payload',jsonb_build_object(
          'room_type_id','61000000-0000-4000-8000-000000000001','stay_date','2030-01-01',
          'sellable_units',null,'sellable_units_mode','clear','closed',true,'closed_mode','set',
          'reason','Close while inheriting inventory','expires_at',null,
          'provenance',jsonb_build_object('reason','Close while inheriting inventory')
        )
      )
    )
  ),'60000000-0000-4000-8000-000000000005');

  v_quote:=public.hotel_v2_admin_resolve_rate('63000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03',2);
  if (select expires_at is not null from public.hotel_calendar_overrides
      where id='66000000-0000-4000-8000-000000000001')
     or (select expires_at is not null from public.hotel_daily_inventory
         where room_type_id='61000000-0000-4000-8000-000000000001' and stay_date='2030-01-01')
     or (v_quote->>'total')::numeric<>240
     or (v_quote->'nightly_breakdown'->0->>'sellable_units')::integer<>3
     or (v_quote->'nightly_breakdown'->0->>'closed')::boolean is not true
     or v_quote->'nightly_breakdown'->0->>'source'<>'range_rule'
     or v_quote->'nightly_breakdown'->0->'provenance'->'nightly_rate'->>'layer'<>'range_rule' then
    raise exception 'hotels_v2_h2b_gate_clear_fallthrough_failed: %',v_quote;
  end if;
end
$h2b_clear_and_inventory_mode$;

do $h2b_prepare_expiry$
declare
  v_calendar jsonb;
begin
  v_calendar:=public.hotel_v2_admin_get_calendar('30000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03');
  perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
    'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
    'reviewed_at',clock_timestamp(),'snapshot_token',v_calendar->>'snapshot_token',
    'operations',jsonb_build_array(
      jsonb_build_object(
        'entity','calendar_override','type','update','id','66000000-0000-4000-8000-000000000001','expected_version',3,
        'payload',jsonb_build_object(
          'nightly_rate',999,'nightly_rate_mode','set','reason','Temporary override expiry test',
          'expires_at','2099-01-01T00:00:00Z','source','manual'
        )
      ),
      jsonb_build_object(
        'entity','daily_inventory','type','upsert','expected_version',3,
        'payload',jsonb_build_object(
          'room_type_id','61000000-0000-4000-8000-000000000001','stay_date','2030-01-01',
          'sellable_units',1,'sellable_units_mode','set','closed',true,'closed_mode','set',
          'reason','Temporary inventory expiry test','expires_at','2099-01-01T00:00:00Z',
          'provenance',jsonb_build_object('fixture','h2b-expiry')
        )
      )
    )
  ),'60000000-0000-4000-8000-000000000006');
  perform set_config(
    'hotels_v2_h2b.pre_expiry_snapshot',
    public.hotel_v2_admin_get_calendar(
      '30000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03'
    )->>'snapshot_token',
    true
  );
end
$h2b_prepare_expiry$;

reset role;

-- Isolation-only time simulation: expire reviewed rows without sleeping. This is
-- never a production write path; production/Admin changes remain RPC-only.
do $h2b_capacity_reduction_guard$
declare
  v_failed boolean:=false;
begin
  begin
    update public.hotel_room_types set capacity_adults=1,capacity_children=0
    where id='61000000-0000-4000-8000-000000000001';
  exception when check_violation then v_failed:=true;
  end;
  if not v_failed or (select capacity_adults from public.hotel_room_types where id='61000000-0000-4000-8000-000000000001')<>2 then
    raise exception 'hotels_v2_h2b_gate_capacity_reduction_failed';
  end if;
end
$h2b_capacity_reduction_guard$;

update public.hotel_calendar_overrides
set expires_at=clock_timestamp()-interval '1 second'
where id='66000000-0000-4000-8000-000000000001';
update public.hotel_daily_inventory
set expires_at=clock_timestamp()-interval '1 second'
where room_type_id='61000000-0000-4000-8000-000000000001'
  and stay_date='2030-01-01';

set local role authenticated;

do $h2b_expiry$
declare
  v_quote jsonb;
  v_stale_failed boolean:=false;
begin
  begin
    perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
      'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
      'reviewed_at',clock_timestamp(),
      'snapshot_token',current_setting('hotels_v2_h2b.pre_expiry_snapshot'),
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','occupancy_tier','type','update','id','64000000-0000-4000-8000-000000000001','expected_version',1,
        'payload',jsonb_build_object('nightly_rate',91)
      ))
    ),'60000000-0000-4000-8000-000000000010');
  exception when serialization_failure then v_stale_failed:=true;
  end;
  if not v_stale_failed or (select nightly_rate from public.hotel_room_rate_occupancy_tiers where id='64000000-0000-4000-8000-000000000001')<>90 then
    raise exception 'hotels_v2_h2b_gate_expiry_snapshot_stale_failed';
  end if;

  v_quote:=public.hotel_v2_admin_resolve_rate('63000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03',2);
  if (v_quote->>'total')::numeric<>240
     or (v_quote->'nightly_breakdown'->0->>'nightly_rate')::numeric<>120
     or (v_quote->'nightly_breakdown'->0->>'sellable_units')::integer<>3
     or (v_quote->'nightly_breakdown'->0->>'closed')::boolean
     or v_quote->'nightly_breakdown'->0->>'source'<>'range_rule' then
    raise exception 'hotels_v2_h2b_gate_expiry_failed: %',v_quote;
  end if;
end
$h2b_expiry$;

reset role;

-- The last visible cell resolves a one-night stay that checks departure
-- restrictions on p_end + 1. That non-charged boundary date must therefore be
-- part of the reviewed snapshot even though it is not returned as an editable
-- calendar row.
insert into public.hotel_calendar_overrides(
  id,hotel_id,room_rate_id,stay_date,
  closed_to_departure,closed_to_departure_mode,
  reason,expires_at,actor_id,actor_type,source,is_active,provenance
) values(
  '66000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  '2030-01-04',true,'set','Checkout boundary dependency',
  '2099-01-01T00:00:00Z','10000000-0000-4000-8000-000000000001',
  'admin','manual',true,jsonb_build_object('fixture','checkout-boundary')
);

set local role authenticated;

do $h2b_checkout_boundary_snapshot_prepare$
declare
  v_calendar jsonb;
  v_last_cell jsonb;
begin
  v_calendar:=public.hotel_v2_admin_get_calendar(
    '30000000-0000-4000-8000-000000000001','2030-01-01','2030-01-03'
  );
  select cell into v_last_cell
  from jsonb_array_elements(v_calendar->'effective_cells') cell
  where cell->>'stay_date'='2030-01-03';
  if coalesce((v_last_cell->>'requestable')::boolean,true)
     or not (v_last_cell->'blocking_reasons' @> jsonb_build_array(jsonb_build_object(
       'code','closed_to_departure','stay_date','2030-01-04'
     ))) then
    raise exception 'hotels_v2_h2b_gate_checkout_boundary_ctd_failed: %',v_last_cell;
  end if;
  perform set_config('hotels_v2_h2b.checkout_boundary_snapshot',v_calendar->>'snapshot_token',true);
end
$h2b_checkout_boundary_snapshot_prepare$;

reset role;
update public.hotel_calendar_overrides
set closed_to_departure=false
where id='66000000-0000-4000-8000-000000000099';
set local role authenticated;

do $h2b_checkout_boundary_snapshot_stale$
declare
  v_failed boolean:=false;
begin
  begin
    perform public.hotel_v2_admin_apply_calendar_plan(jsonb_build_object(
      'hotel_id','30000000-0000-4000-8000-000000000001','from','2030-01-01','to','2030-01-03',
      'reviewed_at',clock_timestamp(),
      'snapshot_token',current_setting('hotels_v2_h2b.checkout_boundary_snapshot'),
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','occupancy_tier','type','update','id','64000000-0000-4000-8000-000000000001','expected_version',1,
        'payload',jsonb_build_object('nightly_rate',91)
      ))
    ),'60000000-0000-4000-8000-000000000012');
  exception when serialization_failure then v_failed:=true;
  end;
  if not v_failed
     or (select nightly_rate from public.hotel_room_rate_occupancy_tiers
         where id='64000000-0000-4000-8000-000000000001')<>90 then
    raise exception 'hotels_v2_h2b_gate_checkout_boundary_snapshot_stale_failed';
  end if;
end
$h2b_checkout_boundary_snapshot_stale$;

reset role;

do $h2b_inactive_reactivation_guard$
declare
  v_failed boolean:=false;
begin
  update public.hotel_room_rate_occupancy_tiers set is_active=false
  where id='64000000-0000-4000-8000-000000000001';
  update public.hotel_room_types set capacity_adults=1,capacity_children=0
  where id='61000000-0000-4000-8000-000000000001';
  begin
    update public.hotel_room_rate_occupancy_tiers set is_active=true
    where id='64000000-0000-4000-8000-000000000001';
  exception when check_violation then v_failed:=true;
  end;
  if not v_failed or (select is_active from public.hotel_room_rate_occupancy_tiers where id='64000000-0000-4000-8000-000000000001') then
    raise exception 'hotels_v2_h2b_gate_inactive_reactivation_failed';
  end if;
  update public.hotel_room_types set capacity_adults=2,capacity_children=0
  where id='61000000-0000-4000-8000-000000000001';
  update public.hotel_room_rate_occupancy_tiers set is_active=true
  where id='64000000-0000-4000-8000-000000000001';
end
$h2b_inactive_reactivation_guard$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","email":"partner@example.test","role":"authenticated"}',
  true
);

do $h2b_non_admin_rpc_denial$
declare
  v_resolve_denied boolean:=false;
  v_calendar_denied boolean:=false;
  v_apply_denied boolean:=false;
begin
  begin perform public.hotel_v2_admin_resolve_rate(null,null,null,null); exception when insufficient_privilege then v_resolve_denied:=true; end;
  begin perform public.hotel_v2_admin_get_calendar(null,null,null); exception when insufficient_privilege then v_calendar_denied:=true; end;
  begin perform public.hotel_v2_admin_apply_calendar_plan(null,null); exception when insufficient_privilege then v_apply_denied:=true; end;
  if not v_resolve_denied or not v_calendar_denied or not v_apply_denied then
    raise exception 'hotels_v2_h2b_gate_non_admin_rpc_denial_failed';
  end if;
end
$h2b_non_admin_rpc_denial$;

reset role;
set local role anon;

do $h2b_anon_rpc_denial$
declare
  v_denied boolean:=false;
begin
  begin perform public.hotel_v2_admin_get_calendar(null,null,null); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'hotels_v2_h2b_gate_anon_rpc_denial_failed'; end if;
end
$h2b_anon_rpc_denial$;

reset role;

do $h2b_security_contract$
begin
  if has_table_privilege('anon','public.hotel_calendar_overrides','SELECT')
     or has_table_privilege('anon','public.hotel_room_rate_occupancy_tiers','SELECT')
     or has_table_privilege('authenticated','public.hotel_calendar_overrides','INSERT')
     or has_table_privilege('authenticated','public.hotel_room_rate_occupancy_tiers','UPDATE')
     or has_function_privilege('anon','public.hotel_v2_admin_get_calendar(uuid,date,date)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE') then
    raise exception 'hotels_v2_h2b_gate_security_failed';
  end if;
  if exists(select 1 from public.site_settings setting where setting.hotel_rooms_v2_enabled
    or setting.hotel_external_sync_enabled or setting.hotel_instant_booking_enabled or setting.hotel_stripe_connect_enabled) then
    raise exception 'hotels_v2_h2b_gate_flags_changed';
  end if;
  if (select architecture_version from public.hotels where id='30000000-0000-4000-8000-000000000001')<>'legacy' then
    raise exception 'hotels_v2_h2b_gate_legacy_property_changed';
  end if;
end
$h2b_security_contract$;

rollback;

select 'HOTELS_V2_H2B_POSTGRES_GATE_PASS' as result;
