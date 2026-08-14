\set ON_ERROR_STOP on

-- Disposable PostgreSQL-only H3.1 gate. It reconstructs the accepted H2B.2
-- shadow graph, never connects to production, and exercises Admin, non-admin,
-- partner and anon boundaries plus stale/atomic reviewed writes.
\ir hotels-v2-h2b2-policy-preservation-postgres-gate.sql
\ir ../../supabase/migrations/20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql

-- The accepted production shadow Room Types are active normalized
-- configuration while architecture_version=legacy and all flags remain OFF.
-- The older H2B.2 fixture intentionally used draft; align this disposable row
-- state before exercising active allocation readiness.
update public.hotel_room_types set status='active'
where id in (
  'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
  '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'
);

create function pg_temp.h3_1_full_plan()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id',hotel.id,
    'expected_property_updated_at',hotel.updated_at,
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(
      jsonb_build_object(
        'entity','property_configuration','type','update','id',hotel.id,
        'expected_version',0,'payload',jsonb_build_object('minimum_stay_nights',2)
      ),
      jsonb_build_object(
        'entity','pricing_schedule','type','update','id',room_schedule.id,
        'expected_version',room_schedule.version,
        'payload',jsonb_build_object('minimum_billable_occupancy',2)
      ),
      jsonb_build_object(
        'entity','rate_plan','type','update','id',rate_plan.id,
        'expected_version',rate_plan.version,
        'payload',jsonb_build_object('price_inclusions',jsonb_build_array('cleaning','taxes'))
      ),
      jsonb_build_object(
        'entity','allocation_rule','type','create','id','31000000-0000-4000-8000-000000000014',
        'expected_version',0,'payload',jsonb_build_object(
          'code','guests-1-4-choice','allocation_mode','customer_choice',
          'min_guest_count',1,'max_guest_count',4,'is_active',true,
          'review_status','reviewed','sort_order',100,'items',jsonb_build_array(
            jsonb_build_object('id','31100000-0000-4000-8000-000000000001',
              'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
              'units_required',1,'allocated_guest_count',null,'sort_order',100),
            jsonb_build_object('id','31100000-0000-4000-8000-000000000002',
              'room_type_id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
              'units_required',1,'allocated_guest_count',null,'sort_order',200)
          )
        )
      ),
      jsonb_build_object(
        'entity','allocation_rule','type','create','id','31000000-0000-4000-8000-000000000015',
        'expected_version',0,'payload',jsonb_build_object(
          'code','guests-5-bundle','allocation_mode','required_bundle',
          'min_guest_count',5,'max_guest_count',5,'is_active',true,
          'review_status','reviewed','sort_order',500,'items',jsonb_build_array(
            jsonb_build_object('id','31500000-0000-4000-8000-000000000001',
              'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
              'units_required',1,'allocated_guest_count',3,'sort_order',100),
            jsonb_build_object('id','31500000-0000-4000-8000-000000000002',
              'room_type_id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
              'units_required',1,'allocated_guest_count',2,'sort_order',200)
          )
        )
      ),
      jsonb_build_object(
        'entity','allocation_rule','type','create','id','31000000-0000-4000-8000-000000000016',
        'expected_version',0,'payload',jsonb_build_object(
          'code','guests-6-bundle','allocation_mode','required_bundle',
          'min_guest_count',6,'max_guest_count',6,'is_active',true,
          'review_status','reviewed','sort_order',600,'items',jsonb_build_array(
            jsonb_build_object('id','31600000-0000-4000-8000-000000000001',
              'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
              'units_required',1,'allocated_guest_count',3,'sort_order',100),
            jsonb_build_object('id','31600000-0000-4000-8000-000000000002',
              'room_type_id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
              'units_required',1,'allocated_guest_count',3,'sort_order',200)
          )
        )
      ),
      jsonb_build_object(
        'entity','allocation_rule','type','create','id','31000000-0000-4000-8000-000000000017',
        'expected_version',0,'payload',jsonb_build_object(
          'code','guests-7-bundle','allocation_mode','required_bundle',
          'min_guest_count',7,'max_guest_count',7,'is_active',true,
          'review_status','reviewed','sort_order',700,'items',jsonb_build_array(
            jsonb_build_object('id','31700000-0000-4000-8000-000000000001',
              'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
              'units_required',1,'allocated_guest_count',4,'sort_order',100),
            jsonb_build_object('id','31700000-0000-4000-8000-000000000002',
              'room_type_id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
              'units_required',1,'allocated_guest_count',3,'sort_order',200)
          )
        )
      ),
      jsonb_build_object(
        'entity','allocation_rule','type','create','id','31000000-0000-4000-8000-000000000018',
        'expected_version',0,'payload',jsonb_build_object(
          'code','guests-8-bundle','allocation_mode','required_bundle',
          'min_guest_count',8,'max_guest_count',8,'is_active',true,
          'review_status','reviewed','sort_order',800,'items',jsonb_build_array(
            jsonb_build_object('id','31800000-0000-4000-8000-000000000001',
              'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
              'units_required',1,'allocated_guest_count',4,'sort_order',100),
            jsonb_build_object('id','31800000-0000-4000-8000-000000000002',
              'room_type_id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
              'units_required',1,'allocated_guest_count',4,'sort_order',200)
          )
        )
      ),
      jsonb_build_object(
        'entity','payment_policy','type','create','id','32000000-0000-4000-8000-000000000001',
        'expected_version',0,'payload',jsonb_build_object(
          'code','seven-kamares-request-confirmation','name_i18n',jsonb_build_object('en','Partner 50/50'),
          'currency','EUR','is_active',true,'review_status','reviewed','terms',jsonb_build_array(
            jsonb_build_object('id','32100000-0000-4000-8000-000000000001',
              'sequence',1,'due_event','after_partner_acceptance','amount_mode','percent_total',
              'amount_value',50,'recipient','partner','payment_methods',jsonb_build_array('bank_transfer'),
              'instructions_i18n',jsonb_build_object()),
            jsonb_build_object('id','32100000-0000-4000-8000-000000000002',
              'sequence',2,'due_event','on_arrival','amount_mode','remaining_balance',
              'amount_value',null,'recipient','partner','payment_methods',jsonb_build_array('cash','card'),
              'instructions_i18n',jsonb_build_object())
          )
        )
      ),
      jsonb_build_object(
        'entity','commission_policy','type','create','id','33000000-0000-4000-8000-000000000001',
        'expected_version',0,'payload',jsonb_build_object(
          'code','seven-kamares-platform-commission','commission_mode','per_allocated_room_per_night',
          'amount',10,'currency','EUR','is_active',true,'review_status','reviewed'
        )
      ),
      jsonb_build_object(
        'entity','calendar_source','type','create','id','34000000-0000-4000-8000-000000000001',
        'expected_version',0,'payload',jsonb_build_object(
          'code','manual-primary','source_type','manual','room_type_id',null,
          'external_reference',null,'configuration',jsonb_build_object(),
          'is_enabled',true,'review_status','reviewed','priority',100
        )
      )
    )
  )
  from public.hotels hotel
  join public.hotel_pricing_schedules room_schedule
    on room_schedule.hotel_id=hotel.id and room_schedule.code='shared-apartment-occupancy-los'
  join public.hotel_rate_plans rate_plan
    on rate_plan.hotel_id=hotel.id and rate_plan.code='standard'
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
$function$;

-- Anon, an ordinary non-admin authenticated user and a partner are denied the
-- Admin RPC. No raw-table fallback is available to any of them.
do $h3_1_authz_gate$
declare v_denied boolean;
begin
  v_denied:=false;
  begin
    perform set_config('request.jwt.claims','{"role":"anon"}',true);
    set local role anon;
    perform public.hotel_v2_admin_get_h3_1_configuration(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  exception when insufficient_privilege then v_denied:=true;
  end;
  reset role;
  if not v_denied then raise exception 'hotels_v2_h3_1_anon_rpc_not_denied'; end if;

  v_denied:=false;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000099","email":"non-admin@example.test","role":"authenticated"}',true);
    set local role authenticated;
    perform public.hotel_v2_admin_get_h3_1_configuration(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  exception when insufficient_privilege then v_denied:=true;
  end;
  reset role;
  if not v_denied then raise exception 'hotels_v2_h3_1_non_admin_rpc_not_denied'; end if;

  v_denied:=false;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"20000000-0000-4000-8000-000000000001","email":"partner@example.test","role":"authenticated"}',true);
    set local role authenticated;
    perform public.hotel_v2_admin_get_h3_1_configuration(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  exception when insufficient_privilege then v_denied:=true;
  end;
  reset role;
  if not v_denied then raise exception 'hotels_v2_h3_1_partner_rpc_not_denied'; end if;
end
$h3_1_authz_gate$;

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
do $h3_1_apply$ begin
  perform public.hotel_v2_admin_apply_h3_1_configuration(
    pg_temp.h3_1_full_plan(),'35000000-0000-4000-8000-000000000001');
end $h3_1_apply$;
commit;

do $h3_1_graph_gate$
declare v_config jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
  v_config:=public.hotel_v2_admin_get_h3_1_configuration(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if v_config#>>'{property,minimum_stay_nights}'<>'2'
     or (select minimum_billable_occupancy from public.hotel_pricing_schedules
       where code='shared-apartment-occupancy-los')<>2
     or (select price_inclusions from public.hotel_rate_plans where code='standard')
       is distinct from array['cleaning','taxes']::text[]
     or (select count(*) from public.hotel_room_allocation_rules where is_active)<>5
     or (select count(*) from public.hotel_room_allocation_rule_items)<>10
     or (select count(*) from public.hotel_room_allocation_rules
       where allocation_mode='customer_choice' and min_guest_count=1 and max_guest_count=4)<>1
     or (select count(*) from public.hotel_room_allocation_rules
       where allocation_mode='required_bundle' and min_guest_count=max_guest_count
         and min_guest_count between 5 and 8)<>4
     or (select sum(allocated_guest_count) from public.hotel_room_allocation_rule_items
       where allocation_rule_id='31000000-0000-4000-8000-000000000015')<>5
     or (select sum(allocated_guest_count) from public.hotel_room_allocation_rule_items
       where allocation_rule_id='31000000-0000-4000-8000-000000000018')<>8
     or (select count(*) from public.hotel_payment_policy_terms
       where amount_mode='percent_total' and amount_value=50
         and due_event='after_partner_acceptance' and payment_methods=array['bank_transfer'])<>1
     or (select count(*) from public.hotel_payment_policy_terms
       where amount_mode='remaining_balance' and amount_value is null
         and due_event='on_arrival' and payment_methods=array['card','cash'])<>1
     or (select count(*) from public.hotel_commission_policies
       where commission_mode='per_allocated_room_per_night' and amount=10 and currency='EUR')<>1
     or (select count(*) from public.hotel_calendar_source_configs
       where source_type='manual' and is_enabled)<>1
     or jsonb_array_length(v_config->'allocation_rules')<>5
     or jsonb_array_length(v_config->'payment_policies')<>1
     or v_config#>>'{feature_flags,hotel_rooms_v2_enabled}'<>'false'
     or (select architecture_version from public.hotels
       where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>'legacy' then
    raise exception 'hotels_v2_h3_1_reviewed_graph_failed';
  end if;
end
$h3_1_graph_gate$;

-- A stale exact row version aborts before all writes.
do $h3_1_stale_atomic_gate$
declare v_plan jsonb; v_failed boolean:=false; v_activity integer; v_minimum integer;
begin
  select count(*) into v_activity from public.hotel_activity_log;
  select minimum_stay_nights into v_minimum from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_plan:=jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(select updated_at from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
    'reviewed_at',clock_timestamp(),'operations',jsonb_build_array(
      jsonb_build_object('entity','property_configuration','type','update',
        'id','9b6d99a0-923a-4fbc-be54-c066e856e6ca','expected_version',0,
        'payload',jsonb_build_object('minimum_stay_nights',3)),
      jsonb_build_object('entity','pricing_schedule','type','update',
        'id','b0a3104f-7b31-5265-a59f-c2d166f11a23','expected_version',1,
        'payload',jsonb_build_object('minimum_billable_occupancy',1))
    )
  );
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      v_plan,'35000000-0000-4000-8000-000000000002');
  exception when sqlstate 'PT409' then
    if sqlerrm='hotels_v2_h3_1_stale_pricing_schedule' then v_failed:=true; else raise; end if;
  end;
  if not v_failed
     or (select minimum_stay_nights from public.hotels
       where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>v_minimum
     or (select count(*) from public.hotel_activity_log)<>v_activity then
    raise exception 'hotels_v2_h3_1_stale_atomic_abort_failed';
  end if;
end
$h3_1_stale_atomic_gate$;

-- A valid-looking operation followed by an overlapping active range must roll
-- back atomically when the deferred final allocation contract is checked.
do $h3_1_overlap_atomic_gate$
declare v_plan jsonb; v_failed boolean:=false; v_activity integer;
begin
  select count(*) into v_activity from public.hotel_activity_log;
  v_plan:=jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(select updated_at from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
    'reviewed_at',clock_timestamp(),'operations',jsonb_build_array(
      jsonb_build_object('entity','property_configuration','type','update',
        'id','9b6d99a0-923a-4fbc-be54-c066e856e6ca','expected_version',0,
        'payload',jsonb_build_object('minimum_stay_nights',3)),
      jsonb_build_object('entity','allocation_rule','type','create',
        'id','31900000-0000-4000-8000-000000000004','expected_version',0,
        'payload',jsonb_build_object(
          'code','overlap-4','allocation_mode','customer_choice','min_guest_count',4,
          'max_guest_count',4,'is_active',true,'review_status','reviewed','sort_order',50,
          'items',jsonb_build_array(
            jsonb_build_object('id','31900000-0000-4000-8000-000000000041',
              'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94','units_required',1,
              'allocated_guest_count',null,'sort_order',100),
            jsonb_build_object('id','31900000-0000-4000-8000-000000000042',
              'room_type_id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3','units_required',1,
              'allocated_guest_count',null,'sort_order',200)
          )
        )
      )
    )
  );
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      v_plan,'35000000-0000-4000-8000-000000000003');
  exception when check_violation then
    if sqlerrm='hotels_v2_h3_1_active_allocation_range_overlap' then v_failed:=true; else raise; end if;
  end;
  if not v_failed
     or (select minimum_stay_nights from public.hotels
       where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>2
     or exists(select 1 from public.hotel_room_allocation_rules
       where id='31900000-0000-4000-8000-000000000004')
     or (select count(*) from public.hotel_activity_log)<>v_activity then
    raise exception 'hotels_v2_h3_1_overlap_atomic_abort_failed';
  end if;
end
$h3_1_overlap_atomic_gate$;

-- Child graph fingerprints are stale-sensitive. The concurrent item edit is
-- deliberate fixture setup; the reviewed aggregate update itself must abort.
do $h3_1_child_fingerprint_gate$
declare v_plan jsonb; v_failed boolean:=false; v_rule_version bigint; v_fingerprint text;
begin
  select version,public.hotel_v2_h3_1_allocation_items_fingerprint(id)
  into v_rule_version,v_fingerprint from public.hotel_room_allocation_rules
  where id='31000000-0000-4000-8000-000000000014';
  update public.hotel_room_allocation_rule_items set sort_order=sort_order+1
  where id='31100000-0000-4000-8000-000000000001';
  v_plan:=jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(select updated_at from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
    'reviewed_at',clock_timestamp(),'operations',jsonb_build_array(
      jsonb_build_object('entity','allocation_rule','type','disable',
        'id','31000000-0000-4000-8000-000000000014','expected_version',v_rule_version,
        'expected_children_fingerprint',v_fingerprint,'payload',jsonb_build_object())
    )
  );
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      v_plan,'35000000-0000-4000-8000-000000000004');
  exception when sqlstate 'PT409' then
    if sqlerrm='hotels_v2_h3_1_stale_allocation_rule' then v_failed:=true; else raise; end if;
  end;
  if not v_failed or not (select is_active from public.hotel_room_allocation_rules
    where id='31000000-0000-4000-8000-000000000014') then
    raise exception 'hotels_v2_h3_1_child_fingerprint_stale_gate_failed';
  end if;
end
$h3_1_child_fingerprint_gate$;

-- Incremental Admin drafts may be structurally incomplete while inactive and
-- requires_review. Completeness becomes mandatory before reviewed/active use.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
select public.hotel_v2_admin_apply_h3_1_configuration(
  jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(
      public.hotel_v2_admin_get_h3_1_configuration(
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      )#>>'{property,updated_at}'
    ),
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','allocation_rule','type','create',
      'id','31900000-0000-4000-8000-000000000099','expected_version',0,
      'payload',jsonb_build_object(
        'code','future-incomplete-draft','allocation_mode','required_bundle',
        'min_guest_count',9,'max_guest_count',9,'is_active',false,
        'review_status','requires_review','sort_order',900,'items','[]'::jsonb
      )
    ))
  ),
  '35000000-0000-4000-8000-000000000099'
);
do $h3_1_draft_gate$
begin
  if not exists(select 1 from public.hotel_room_allocation_rules
    where id='31900000-0000-4000-8000-000000000099'
      and not is_active and review_status='requires_review') then
    raise exception 'hotels_v2_h3_1_incremental_draft_failed';
  end if;
end
$h3_1_draft_gate$;

-- Generic bundles may allocate multiple physical units of one Room Type. The
-- 7 Kamares reviewed package remains the stricter two-distinct-room graph.
select public.hotel_v2_admin_apply_h3_1_configuration(
  jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(
      public.hotel_v2_admin_get_h3_1_configuration(
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      )#>>'{property,updated_at}'
    ),
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','allocation_rule','type','create',
      'id','31900000-0000-4000-8000-000000000098','expected_version',0,
      'payload',jsonb_build_object(
        'code','future-same-room-two-units','allocation_mode','required_bundle',
        'min_guest_count',8,'max_guest_count',8,'is_active',false,
        'review_status','reviewed','sort_order',901,
        'items',jsonb_build_array(jsonb_build_object(
          'id','31910000-0000-4000-8000-000000000098',
          'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
          'units_required',2,'allocated_guest_count',8,'sort_order',100
        ))
      )
    ))
  ),
  '35000000-0000-4000-8000-000000000098'
);

-- Another property may later configure CyprusEye to collect full payment at
-- booking. H3.1 stores this reviewed term but performs no quote or charge.
select public.hotel_v2_admin_apply_h3_1_configuration(
  jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(
      public.hotel_v2_admin_get_h3_1_configuration(
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      )#>>'{property,updated_at}'
    ),
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','payment_policy','type','create',
      'id','32900000-0000-4000-8000-000000000001','expected_version',0,
      'payload',jsonb_build_object(
        'code','future-platform-full-at-booking',
        'name_i18n',jsonb_build_object('en','Full payment at booking'),
        'currency','EUR','is_active',false,'review_status','reviewed',
        'terms',jsonb_build_array(jsonb_build_object(
          'id','32910000-0000-4000-8000-000000000001','sequence',1,
          'due_event','at_booking','amount_mode','percent_total','amount_value',100,
          'recipient','platform','payment_methods',jsonb_build_array('online'),
          'instructions_i18n',jsonb_build_object()
        ))
      )
    ))
  ),
  '35000000-0000-4000-8000-000000000097'
);

-- Future Sunny Blue-style commercial terms can use a percentage of the
-- authoritative booking total without changing the H3.1 schema.
select public.hotel_v2_admin_apply_h3_1_configuration(
  jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(
      public.hotel_v2_admin_get_h3_1_configuration(
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      )#>>'{property,updated_at}'
    ),
    'reviewed_at',clock_timestamp(),
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','commission_policy','type','create',
      'id','33900000-0000-4000-8000-000000000001','expected_version',0,
      'payload',jsonb_build_object(
        'code','future-percent-booking-total',
        'commission_mode','percent_booking_total','amount',10,'currency','EUR',
        'is_active',false,'review_status','reviewed'
      )
    ))
  ),
  '35000000-0000-4000-8000-000000000096'
);

do $h3_1_generic_foundation_gate$
begin
  if not exists(select 1 from public.hotel_room_allocation_rules rule
      join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
      where rule.id='31900000-0000-4000-8000-000000000098'
        and item.units_required=2 and item.allocated_guest_count=8)
     or not exists(select 1 from public.hotel_payment_policy_terms
      where id='32910000-0000-4000-8000-000000000001'
        and due_event='at_booking' and amount_mode='percent_total'
        and amount_value=100 and recipient='platform')
     or not exists(select 1 from public.hotel_commission_policies
      where id='33900000-0000-4000-8000-000000000001'
        and commission_mode='percent_booking_total' and amount=10) then
    raise exception 'hotels_v2_h3_1_generic_foundation_failed';
  end if;
end
$h3_1_generic_foundation_gate$;
rollback;

-- Payment schedules fail closed in RPC preflight when 100 percent is paired
-- with a remainder or when the remainder is not the final sequence. The
-- fixtures name that latter case nonfinal_remaining (remainder_not_final).
do $h3_1_payment_completeness_rpc_gate$
declare
  v_case text;
  v_terms jsonb;
  v_plan jsonb;
  v_failed boolean;
begin
  for v_case in select unnest(array['full_plus_remaining','nonfinal_remaining']) loop
    if v_case='full_plus_remaining' then
      v_terms:=jsonb_build_array(
        jsonb_build_object(
          'id','32920000-0000-4000-8000-000000000001','sequence',1,
          'due_event','at_booking','amount_mode','percent_total','amount_value',100,
          'recipient','platform','payment_methods',jsonb_build_array('online'),
          'instructions_i18n',jsonb_build_object()
        ),
        jsonb_build_object(
          'id','32920000-0000-4000-8000-000000000002','sequence',2,
          'due_event','on_arrival','amount_mode','remaining_balance','amount_value',null,
          'recipient','partner','payment_methods',jsonb_build_array('cash'),
          'instructions_i18n',jsonb_build_object()
        )
      );
    else
      v_terms:=jsonb_build_array(
        jsonb_build_object(
          'id','32920000-0000-4000-8000-000000000001','sequence',1,
          'due_event','after_partner_acceptance','amount_mode','percent_total','amount_value',50,
          'recipient','partner','payment_methods',jsonb_build_array('bank_transfer'),
          'instructions_i18n',jsonb_build_object()
        ),
        jsonb_build_object(
          'id','32920000-0000-4000-8000-000000000002','sequence',2,
          'due_event','on_arrival','amount_mode','remaining_balance','amount_value',null,
          'recipient','partner','payment_methods',jsonb_build_array('cash'),
          'instructions_i18n',jsonb_build_object()
        ),
        jsonb_build_object(
          'id','32920000-0000-4000-8000-000000000003','sequence',3,
          'due_event','on_arrival','amount_mode','flat','amount_value',0,
          'recipient','partner','payment_methods',jsonb_build_array('card'),
          'instructions_i18n',jsonb_build_object()
        )
      );
    end if;

    v_plan:=jsonb_build_object(
      'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      'expected_property_updated_at',(select updated_at from public.hotels
        where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
      'reviewed_at',clock_timestamp(),
      'operations',jsonb_build_array(jsonb_build_object(
        'entity','payment_policy','type','create',
        'id','32920000-0000-4000-8000-000000000000','expected_version',0,
        'payload',jsonb_build_object(
          'code','invalid-'||v_case,'name_i18n',jsonb_build_object('en','Invalid fixture'),
          'currency','EUR','is_active',false,'review_status','reviewed','terms',v_terms
        )
      ))
    );
    v_failed:=false;
    begin
      perform set_config('request.jwt.claims',
        '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
      perform public.hotel_v2_admin_apply_h3_1_configuration(
        v_plan,case when v_case='full_plus_remaining'
          then '35900000-0000-4000-8000-000000000001'::uuid
          else '35900000-0000-4000-8000-000000000002'::uuid end
      );
    exception when check_violation then
      if sqlerrm='hotels_v2_h3_1_invalid_payment_schedule_total' then
        v_failed:=true;
      else
        raise;
      end if;
    end;
    if not v_failed or exists(select 1 from public.hotel_payment_policies
      where id='32920000-0000-4000-8000-000000000000') then
      raise exception 'hotels_v2_h3_1_payment_rpc_completeness_failed: %',v_case;
    end if;
  end loop;
end
$h3_1_payment_completeness_rpc_gate$;

-- The deferred aggregate trigger independently enforces the same contract for
-- owner-level SQL; this is not solely browser/RPC validation.
do $h3_1_payment_completeness_trigger_gate$
declare v_failed boolean:=false;
begin
  begin
    set constraints hotel_payment_policies_contract_guard,
      hotel_payment_policy_terms_contract_guard deferred;
    insert into public.hotel_payment_policies(
      id,hotel_id,code,name_i18n,currency,is_active,review_status
    ) values(
      '32930000-0000-4000-8000-000000000000',
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca','invalid-direct-full-plus-remaining',
      '{"en":"Invalid fixture"}'::jsonb,'EUR',false,'reviewed'
    );
    insert into public.hotel_payment_policy_terms(
      id,hotel_id,payment_policy_id,sequence,due_event,amount_mode,amount_value,
      recipient,payment_methods,instructions_i18n
    ) values
      ('32930000-0000-4000-8000-000000000001',
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
       '32930000-0000-4000-8000-000000000000',1,'at_booking','percent_total',100,
       'platform',array['online'],'{}'::jsonb),
      ('32930000-0000-4000-8000-000000000002',
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
       '32930000-0000-4000-8000-000000000000',2,'on_arrival','remaining_balance',null,
       'partner',array['cash'],'{}'::jsonb);
    set constraints hotel_payment_policies_contract_guard,
      hotel_payment_policy_terms_contract_guard immediate;
  exception when check_violation then
    if sqlerrm='hotels_v2_h3_1_invalid_reviewed_payment_policy' then
      v_failed:=true;
    else
      raise;
    end if;
  end;
  if not v_failed or exists(select 1 from public.hotel_payment_policies
    where id='32930000-0000-4000-8000-000000000000') then
    raise exception 'hotels_v2_h3_1_payment_trigger_completeness_failed';
  end if;
end
$h3_1_payment_completeness_trigger_gate$;

-- H3.1 contains an adapter seam only: an external Booking.com/Airbnb/iCal
-- source cannot be enabled and no integration credentials exist.
do $h3_1_external_source_inert_gate$
declare v_failed boolean:=false; v_plan jsonb;
begin
  v_plan:=jsonb_build_object(
    'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'expected_property_updated_at',(select updated_at from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
    'reviewed_at',clock_timestamp(),'operations',jsonb_build_array(
      jsonb_build_object('entity','calendar_source','type','create',
        'id','34000000-0000-4000-8000-000000000002','expected_version',0,
        'payload',jsonb_build_object(
          'code','future-booking-com','source_type','booking_com','room_type_id',null,
          'external_reference','future-only','configuration',jsonb_build_object(),
          'is_enabled',true,'review_status','reviewed','priority',10))));
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
    perform public.hotel_v2_admin_apply_h3_1_configuration(
      v_plan,'35000000-0000-4000-8000-000000000005');
  exception when invalid_parameter_value then
    if sqlerrm='hotels_v2_h3_1_invalid_calendar_source_payload' then v_failed:=true; else raise; end if;
  end;
  if not v_failed or exists(select 1 from public.hotel_calendar_source_configs
    where id='34000000-0000-4000-8000-000000000002') then
    raise exception 'hotels_v2_h3_1_external_source_not_inert';
  end if;
end
$h3_1_external_source_inert_gate$;

-- Raw RLS/grant matrix: only Admin SELECT is possible from authenticated;
-- public/anon, non-admin and partner users cannot inspect or mutate H3.1 rows.
-- service_role may read for approved backend diagnostics, but H3.1 mutations
-- remain exclusively behind the reviewed Admin RPC.
do $h3_1_raw_security_gate$
declare v_table text;
begin
  foreach v_table in array array[
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms',
    'hotel_commission_policies','hotel_calendar_source_configs'
  ] loop
    if has_table_privilege('anon','public.'||v_table,'SELECT')
       or has_table_privilege('authenticated','public.'||v_table,'INSERT')
       or has_table_privilege('authenticated','public.'||v_table,'UPDATE')
       or has_table_privilege('authenticated','public.'||v_table,'DELETE')
       or not has_table_privilege('service_role','public.'||v_table,'SELECT')
       or has_table_privilege('service_role','public.'||v_table,'INSERT')
       or has_table_privilege('service_role','public.'||v_table,'UPDATE')
       or has_table_privilege('service_role','public.'||v_table,'DELETE') then
      raise exception 'hotels_v2_h3_1_raw_security_failed: %',v_table;
    end if;
  end loop;

  if not has_function_privilege('service_role',
       'public.hotel_v2_h3_1_codes_valid(text[])','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_h3_1_codes_valid(text[])','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_h3_1_validate_allocation_rule(uuid)','EXECUTE') then
    raise exception 'hotels_v2_h3_1_helper_grants_failed';
  end if;
end
$h3_1_raw_security_gate$;

-- The additive price-inclusions CHECK must not break approved service-role
-- maintenance of the pre-existing rate-plan table. Keep this transaction
-- rollback-only; no fixture state is changed.
begin;
set local role service_role;
update public.hotel_rate_plans
set price_inclusions=price_inclusions
where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
rollback;

-- Exercise the CHECK as authenticated Admin. H2A normally routes mutations
-- through its definer RPC and revokes raw UPDATE, so this disposable
-- transaction grants only UPDATE and rolls the grant and row write back.
begin;
grant update on public.hotel_rate_plans to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',true);
update public.hotel_rate_plans
set price_inclusions=price_inclusions
where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
rollback;

-- Legacy/property safety and required mismatch counters remain zero. No H3.1
-- booking, payment, public quote, architecture_version or feature_flags write
-- exists in this gate or migration.
select
  0 as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  0 as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  'HOTELS_V2_H3_1_INERT_ADMIN_CONFIGURATION_POSTGRES_GATE_PASS' result
where (select architecture_version from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')='legacy'
  and not exists(select 1 from public.site_settings where id=1 and (
    hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
  ))
  and not exists(select 1 from public.hotel_daily_inventory inventory
    join public.hotel_room_types room on room.id=inventory.room_type_id
    where room.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')
  and not exists(select 1 from public.hotel_daily_rates daily_rate
    join public.hotel_room_rates room_rate on room_rate.id=daily_rate.room_rate_id
    where room_rate.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')
  and not exists(select 1 from public.hotel_rate_rules rule_row
    join public.hotel_room_rates room_rate on room_rate.id=rule_row.room_rate_id
    where room_rate.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')
  and not exists(select 1 from public.hotel_calendar_overrides
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca');
