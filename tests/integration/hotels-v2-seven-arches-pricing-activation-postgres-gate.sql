\set ON_ERROR_STOP on
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql

-- Prove the production order: a legitimate Partner proposal is accepted by
-- Admin before Task3 installs. The legacy ADMIN-D aggregate is expected to be
-- stale, while the receipt-bound Task2 compatibility projection stays exact.
begin;
do $task2_accept_before_task3$
declare
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_workspace jsonb; v_draft jsonb; v_preview jsonb; v_control jsonb;
  v_proposal jsonb; v_apply jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+2);
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','7 Łuków — aktywacja','en','7 Arches activation','he','הפעלת 7 קשתות')),
      'reason','Task2 acceptance before pricing activation'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38400000-0000-4000-8000-000000000001','38400000-0000-4000-8000-000000000002');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal->'id','proposal_version',v_proposal->'version',
    'action','accept','reason','Accept Task2 proposal before Task3 install'));
  v_apply:=public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_preview->'reviewed_plan','38400000-0000-4000-8000-000000000003');
  reset role;
  if v_apply->>'status'<>'accepted'
     or not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
     or coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'safe')::boolean,false)
     or public.hotel_v2_external_calendar_stage2_compatible_fingerprints() is distinct from
       (select stage2_current_protected_fingerprints
        from public.hotel_admin_availability_foundation_evolution_receipts where id=1) then
    raise exception 'task2_accept_before_task3_compatibility_failed:%',v_apply;
  end if;
end
$task2_accept_before_task3$;
commit;

\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql

begin;
set local statement_timeout='180s';

do $seven_arches_pricing_activation_gate$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_snapshot jsonb; v_preview jsonb; v_apply jsonb; v_replay jsonb;
  v_draft jsonb; v_failed boolean; v_message text;
  v_diagnostic record;
  v_expired_plan jsonb; v_expired_id uuid:='38800000-0000-4000-8000-000000000010';
  v_expired_reviewed_at timestamptz:=clock_timestamp()-interval '40 minutes';
  v_expired_at timestamptz:=clock_timestamp()-interval '20 minutes';
begin
  -- Public RPC access is authenticated-only and logical Admin enforcement is
  -- independent of raw table ACLs.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_failed:=false;
  begin perform public.hotel_v2_admin_get_seven_arches_pricing_activation();
  exception when sqlstate '42501' then v_failed:=true; end;
  if not v_failed then raise exception 'seven_arches_activation_non_admin_get_allowed'; end if;
  v_failed:=false;
  begin perform * from public.hotel_seven_arches_pricing_activation_reviews;
  exception when sqlstate '42501' then v_failed:=true; end;
  if not v_failed then raise exception 'seven_arches_activation_raw_review_read_allowed'; end if;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_snapshot:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
  if v_snapshot->>'contract_version'<>'hotels_v2_seven_arches_pricing_activation_snapshot_v1'
     or v_snapshot->>'status'<>'ready'
     or v_snapshot#>>'{h3_1p,parity,total_case_count}'<>'70'
     or v_snapshot#>>'{h3_1p,parity,total_mismatch_count}'<>'0'
     or v_snapshot#>>'{h3_1p,allocation_exact}'<>'true'
     or v_snapshot#>>'{commission_policy,commission_mode}'<>'per_allocated_room_per_night'
     or (v_snapshot#>>'{commission_policy,amount}')::numeric<>10
     or v_snapshot#>>'{commission_policy,read_only}'<>'true'
     or v_snapshot#>>'{payment_policy,review_status}'<>'reviewed' then
    raise exception 'seven_arches_activation_initial_snapshot_invalid:%',v_snapshot;
  end if;

  -- These values are explicit test operator inputs; production must supply its
  -- own reviewed positive EUR rates and full PL/EN/HE copy.
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_pricing_activation_draft_v1',
    'hotel_id',c_hotel,'snapshot_token',v_snapshot->>'snapshot_token',
    'upper_base_nightly_rate',135.00,'ground_base_nightly_rate',115.00,
    'rate_plan_name_i18n',jsonb_build_object(
      'pl','Standardowa','en','Standard','he','סטנדרטי'),
    'rate_plan_description_i18n',jsonb_build_object(
      'pl','Bezzwrotna taryfa dla obu apartamentów.',
      'en','Non-refundable rate for both apartments.',
      'he','תעריף ללא החזר לשתי הדירות.'),
    'schedule_name_i18n',jsonb_build_object(
      'pl','Obłożenie i długość pobytu','en','Occupancy and length of stay',
      'he','תפוסה ואורך שהייה'),
    'reason','Reviewed test activation of the accepted 7 Arches graph');
  v_failed:=false;
  begin perform public.hotel_v2_admin_preview_seven_arches_pricing_activation(
    jsonb_set(v_draft,'{snapshot_token}',to_jsonb(repeat('0',64)),false));
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_seven_arches_pricing_activation_stale_snapshot';
  end;
  if not v_failed then raise exception 'seven_arches_activation_stale_snapshot_allowed'; end if;
  v_preview:=public.hotel_v2_admin_preview_seven_arches_pricing_activation(v_draft);
  if v_preview->>'contract_version'<>'hotels_v2_seven_arches_pricing_activation_preview_v1'
     or not (v_preview->>'changed')::boolean
     or jsonb_array_length(v_preview->'blocking_reasons')<>0
     or v_preview#>>'{reviewed_plan,operation,entity}'<>'pricing_activation'
     or v_preview#>>'{reviewed_plan,operation,action}'<>'activate'
     or v_preview#>>'{impact,after,preview_schedule,is_active}'<>'false'
     or (v_preview#>>'{reviewed_plan,operation,payload,upper_base_nightly_rate}')::numeric<>135
     or (v_preview#>>'{reviewed_plan,operation,payload,ground_base_nightly_rate}')::numeric<>115 then
    raise exception 'seven_arches_activation_preview_invalid:%',v_preview;
  end if;

  -- Compact diagnostic emitted after the real Task3 Preview and before any
  -- Apply call. Values are per-key fingerprints/scalars, never full snapshots.
  reset role;
  for v_diagnostic in
    with compared as(
      select
        public.hotel_v2_external_calendar_stage2_compatible_fingerprints() a_json,
        evolution.stage2_current_protected_fingerprints b_json,
        public.hotel_v2_admin_d_current_foundation_snapshot() c_snapshot,
        public.hotel_v2_external_calendar_stage2_compatible_fingerprints() d_json
      from public.hotel_admin_availability_foundation_evolution_receipts evolution
      where evolution.id=1
    ), differences as(
      select key,compared.b_json->key expected_value,compared.d_json->key current_value
      from compared cross join lateral (select jsonb_object_keys(
        compared.b_json||compared.d_json) key) keys
      where compared.b_json->key is distinct from compared.d_json->key
    ), rows as(
      select 0 ordinal,jsonb_build_object(
        'row_type','summary',
        'a_compatible_hash',public.hotel_v2_external_calendar_worker_hash(a_json),
        'b_owner_stored_hash',public.hotel_v2_external_calendar_worker_hash(b_json),
        'c_snapshot_stage2_hash',c_snapshot->>'stage2_current_protected_fingerprint',
        'd_apply_used_hash',public.hotel_v2_external_calendar_worker_hash(d_json),
        'mismatch_count',(select count(*) from differences)) diagnostic
      from compared
      union all
      select row_number() over(order by key)::integer,jsonb_build_object(
        'row_type','difference','key',key,
        'expected',expected_value,'current',current_value) diagnostic
      from differences
    )
    select diagnostic from rows order by ordinal
  loop
    raise notice 'TASK3_STAGE2_COMPAT_DIAGNOSTIC %',v_diagnostic.diagnostic::text;
  end loop;

  -- An unrelated trusted permission drift must invalidate the shared
  -- compatibility proof. The exception subtransaction rolls the probe back.
  v_failed:=false;
  begin
    update public.hotel_partner_hotel_permissions
    set request_booking_changes=true where hotel_id=c_hotel;
    if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
      raise exception 'task2_stage2_unrelated_drift_was_accepted';
    end if;
    raise exception 'task2_stage2_unrelated_drift_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='task2_stage2_unrelated_drift_probe_rollback';
  end;
  if not v_failed then
    raise exception 'task2_stage2_unrelated_drift_negative_failed:%',v_message;
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_seven_arches_pricing_activation(
    (v_preview->'reviewed_plan')||jsonb_build_object('smuggled',true),
    '38800000-0000-4000-8000-000000000099','seven-arches-smuggle-0001');
  exception when sqlstate '22023' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_seven_arches_pricing_activation_invalid_plan';
  end;
  if not v_failed then raise exception 'seven_arches_activation_plan_smuggling_allowed'; end if;
  reset role;

  -- Even with a genuine pending review, the context permits no extra field
  -- and cannot be reused for a repeated activation transition.
  insert into public.hotel_seven_arches_pricing_activation_transaction_context(
    backend_pid,transaction_id,review_id,actor_id,correlation_id)
  values(pg_backend_pid(),txid_current(),(v_preview#>>'{reviewed_plan,review_id}')::uuid,
    '10000000-0000-4000-8000-000000000001','38800000-0000-4000-8000-000000000098');
  v_failed:=false;
  begin update public.hotel_rate_plans set code='smuggled-code'
    where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end;
  if not v_failed then raise exception 'seven_arches_activation_context_field_smuggling_allowed'; end if;
  v_failed:=false;
  begin
    update public.hotel_rate_plans set
      name_i18n=v_preview#>'{reviewed_plan,operation,payload,rate_plan_name_i18n}',
      description_i18n=v_preview#>'{reviewed_plan,operation,payload,rate_plan_description_i18n}',
      is_active=true where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
    update public.hotel_rate_plans set
      name_i18n=v_preview#>'{reviewed_plan,operation,payload,rate_plan_name_i18n}',
      description_i18n=v_preview#>'{reviewed_plan,operation,payload,rate_plan_description_i18n}',
      is_active=true where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end;
  if not v_failed then raise exception 'seven_arches_activation_repeated_context_transition_allowed'; end if;
  delete from public.hotel_seven_arches_pricing_activation_transaction_context
  where backend_pid=pg_backend_pid() and transaction_id=txid_current();

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_apply:=public.hotel_v2_admin_apply_seven_arches_pricing_activation(
    v_preview->'reviewed_plan','38800000-0000-4000-8000-000000000001',
    'seven-arches-activation-0001');
  if v_apply->>'contract_version'<>'hotels_v2_seven_arches_pricing_activation_apply_result_v1'
     or not (v_apply->>'changed')::boolean or (v_apply->>'replayed')::boolean
     or jsonb_array_length(v_apply->'activity_ids')<>4
     or v_apply->>'public_change'<>'false' or v_apply->>'legacy_authoritative'<>'true' then
    raise exception 'seven_arches_activation_apply_invalid:%',v_apply;
  end if;
  v_replay:=public.hotel_v2_admin_apply_seven_arches_pricing_activation(
    v_preview->'reviewed_plan','38800000-0000-4000-8000-000000000001',
    'seven-arches-activation-0001');
  if not (v_replay->>'replayed')::boolean
     or (v_replay-'replayed') is distinct from (v_apply-'replayed') then
    raise exception 'seven_arches_activation_replay_invalid:%',v_replay; end if;
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_seven_arches_pricing_activation(
    v_preview->'reviewed_plan','38800000-0000-4000-8000-000000000002',
    'seven-arches-activation-0001');
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_seven_arches_pricing_activation_idempotency_conflict';
  end;
  if not v_failed then raise exception 'seven_arches_activation_key_conflict_missing'; end if;
  reset role;

  -- Expiry is checked from the immutable stored Review, not from client time.
  v_expired_plan:=(v_preview->'reviewed_plan')||jsonb_build_object(
    'review_id',v_expired_id,
    'reviewed_at',to_char(v_expired_reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'expires_at',to_char(v_expired_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  v_expired_plan:=v_expired_plan-'plan_fingerprint';
  v_expired_plan:=v_expired_plan||jsonb_build_object('plan_fingerprint',
    encode(extensions.digest(convert_to(v_expired_plan::text,'UTF8'),'sha256'),'hex'));
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  insert into public.hotel_seven_arches_pricing_activation_reviews(
    id,contract_version,hotel_id,actor_id,snapshot_token,plan_fingerprint,
    reviewed_plan,reviewed_at,expires_at)
  values(v_expired_id,'hotels_v2_seven_arches_pricing_activation_plan_v1',c_hotel,
    '10000000-0000-4000-8000-000000000001',v_expired_plan->>'snapshot_token',
    v_expired_plan->>'plan_fingerprint',v_expired_plan,v_expired_reviewed_at,v_expired_at);
  set local role authenticated;
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_seven_arches_pricing_activation(
    v_expired_plan,'38800000-0000-4000-8000-000000000011','seven-arches-expired-0001');
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_seven_arches_pricing_activation_review_expired';
  end;
  reset role;
  if not v_failed then raise exception 'seven_arches_activation_expired_review_allowed'; end if;

  if not public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
     or public.hotel_v2_seven_arches_pricing_activation_snapshot()->>'status'<>'active'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel)#>>'{supported}'<>'true'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel)#>>'{activation,status}'<>'active'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel)#>>'{safety,reviewed_activation_exact}'<>'true'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel)#>>'{parity,total_mismatch_count}'<>'0'
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or exists(select 1 from public.site_settings where hotel_rooms_v2_enabled
       or hotel_instant_booking_enabled
       or hotel_stripe_connect_enabled) then
    raise exception 'seven_arches_activation_post_state_invalid'; end if;

  -- Once the one-shot evolution is active, an exact refreshed draft is a
  -- semantic no-op and cannot mint another Review.
  v_snapshot:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
  v_preview:=public.hotel_v2_admin_preview_seven_arches_pricing_activation(
    jsonb_set(v_draft,'{snapshot_token}',to_jsonb(v_snapshot->>'snapshot_token'),false));
  if (v_preview->>'changed')::boolean
     or v_preview->'impact' is distinct from 'null'::jsonb
     or v_preview->'reviewed_plan' is distinct from 'null'::jsonb
     or jsonb_array_length(v_preview->'blocking_reasons')<>0 then
    raise exception 'seven_arches_activation_noop_invalid:%',v_preview;
  end if;

  -- No direct write can reuse the one-shot exemption or introduce a parity
  -- mismatch after the context row has been removed.
  v_failed:=false;
  begin update public.hotel_room_rates set base_nightly_rate=136
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f';
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end;
  if not v_failed then raise exception 'seven_arches_activation_direct_rate_mutation_allowed'; end if;
  v_failed:=false;
  begin update public.hotel_seven_arches_pricing_activation_evolution_receipts
    set pricing_authority='shared_schedule' where id=1;
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_seven_arches_pricing_activation_immutable';
  end;
  if not v_failed then raise exception 'seven_arches_activation_receipt_update_allowed'; end if;
end
$seven_arches_pricing_activation_gate$;

do $seven_arches_pricing_activation_parity_freeze_gate$
declare v_tier uuid; v_failed boolean:=false; v_message text;
begin
  select id into strict v_tier from public.hotel_pricing_schedule_occupancy_tiers
  where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'
  order by id limit 1;
  begin update public.hotel_pricing_schedule_occupancy_tiers
    set nightly_rate=nightly_rate+1 where id=v_tier;
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end;
  if not v_failed then raise exception 'seven_arches_activation_parity_mutation_allowed'; end if;
end
$seven_arches_pricing_activation_parity_freeze_gate$;

\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_verify.sql

select 'HOTELS_V2_7A_PRICING_ACTIVATION_POSTGRES_GATE_OK' as sentinel,
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe() as safe;
rollback;
