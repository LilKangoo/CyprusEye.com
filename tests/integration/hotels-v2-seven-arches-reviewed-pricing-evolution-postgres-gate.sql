\set ON_ERROR_STOP on
\ir hotels-v2-seven-arches-independent-pricing-topology-postgres-gate.sql
\ir ../../supabase/migrations/20260811441500_hotels_v2_seven_arches_reviewed_pricing_evolution.sql

-- Focused PostgreSQL contract gate for the reviewed 7 Arches pricing workflow.
-- Positive transitions are committed so receipt-chain continuity is exercised.
-- Every negative mutation executes in a PL/pgSQL subtransaction and rolls back.

create temporary table reviewed_pricing_gate_baseline as
select public.hotel_v2_seven_arches_reviewed_pricing_current_state() state;

create function pg_temp.reviewed_pricing_item(
  p_room_key text,p_guest_count integer,p_minimum_nights integer,p_delta numeric
) returns jsonb language sql stable security definer
set search_path=pg_catalog,public as $function$
select jsonb_build_object(
  'hotel_id',authority.hotel_id,
  'room_type_id',authority.room_type_id,
  'room_rate_id',authority.room_rate_id,
  'pricing_schedule_id',authority.independent_schedule_id,
  'schedule_tier_id',authority.target_tier_id,
  'guest_count',authority.guest_count,
  'minimum_nights',authority.threshold_nights,
  'currency',authority.currency,
  'before_price',authority.current_nightly_rate,
  'requested_price',authority.current_nightly_rate+p_delta)
from public.hotel_seven_arches_independent_pricing_authority authority
where authority.room_key=p_room_key
  and authority.guest_count=p_guest_count
  and authority.threshold_nights=p_minimum_nights;
$function$;

create function pg_temp.reviewed_pricing_expect_plan_failure(
  p_items jsonb,p_reason text,p_sqlstate text,p_message text
) returns boolean language plpgsql volatile security definer
set search_path=pg_catalog,public as $function$
begin
  perform public.hotel_v2_seven_arches_reviewed_pricing_build_plan(p_items,p_reason);
  return false;
exception when others then
  return sqlstate=p_sqlstate and sqlerrm=p_message;
end;
$function$;

create function pg_temp.reviewed_pricing_assert_state(
  p_expected_receipts integer,p_tier_id uuid,p_expected_price numeric,
  p_untouched_room text,p_untouched_fingerprint text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public as $function$
declare v_state jsonb:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  v_oracle jsonb:=public.hotel_v2_seven_arches_reviewed_pricing_oracle();
  v_initial jsonb:=(select state from pg_temp.reviewed_pricing_gate_baseline);
begin
  if public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() is not true
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or (v_oracle->>'core_case_count')::integer<>100
     or (v_oracle->>'core_mismatch_count')::integer<>0
     or (v_oracle->>'guest_one_case_count')::integer<>20
     or (v_oracle->>'guest_one_mismatch_count')::integer<>0
     or (v_state->>'receipt_count')::integer<>p_expected_receipts
     or v_state->>'commission_fingerprint'<>
       v_initial->>'commission_fingerprint'
     or v_state->>'payment_fingerprint'<>
       v_initial->>'payment_fingerprint'
     or v_state->>'unrelated_fingerprint'<>
       v_initial->>'unrelated_fingerprint'
     or exists(select 1
       from public.hotel_seven_arches_reviewed_pricing_transaction_context) then
    raise exception using errcode='55000',
      message='reviewed_pricing_gate_state_invalid',detail=v_state::text;
  end if;
  if p_tier_id is not null and not exists(select 1
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_seven_arches_independent_pricing_authority authority
        on authority.target_tier_id=tier.id
      where tier.id=p_tier_id and tier.nightly_rate=p_expected_price
        and authority.current_nightly_rate=p_expected_price
        and authority.current_target_version=tier.version
        and authority.current_receipt_sequence=p_expected_receipts) then
    raise exception using errcode='55000',
      message='reviewed_pricing_gate_selected_tier_invalid';
  end if;
  if p_untouched_room is not null and
       v_state#>>array['room_fingerprints',p_untouched_room]
         is distinct from p_untouched_fingerprint then
    raise exception using errcode='55000',
      message='reviewed_pricing_gate_untouched_room_changed';
  end if;
end;
$function$;

do $reviewed_pricing_install_contract$
declare v_oracle jsonb:=public.hotel_v2_seven_arches_reviewed_pricing_oracle();
begin
  if (select count(*) from public.hotel_seven_arches_independent_pricing_authority)<>54
     or (select count(*) from public.hotel_seven_arches_reviewed_pricing_foundation_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)<>0
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() is not true
     or (v_oracle->>'core_case_count')::integer<>100
     or (v_oracle->>'core_mismatch_count')::integer<>0
     or (v_oracle->>'guest_one_case_count')::integer<>20
     or (v_oracle->>'guest_one_mismatch_count')::integer<>0
     or exists(select 1 from (values
       ('public.hotel_seven_arches_reviewed_pricing_proposals'::regclass),
       ('public.hotel_seven_arches_reviewed_pricing_proposal_items'::regclass),
       ('public.hotel_seven_arches_reviewed_pricing_admin_reviews'::regclass),
       ('public.hotel_seven_arches_reviewed_pricing_transaction_context'::regclass),
       ('public.hotel_seven_arches_reviewed_pricing_foundation_receipts'::regclass),
       ('public.hotel_seven_arches_reviewed_pricing_evolution_receipts'::regclass)
     ) relation(oid) where has_table_privilege('authenticated',oid,'SELECT')
       or has_table_privilege('authenticated',oid,'INSERT')
       or has_table_privilege('service_role',oid,'SELECT')) then
    raise exception using errcode='55000',
      message='reviewed_pricing_gate_install_contract_invalid';
  end if;
end;
$reviewed_pricing_install_contract$;

-- Partner Upper-only proposal, Admin acceptance, submit/apply replay, and exact
-- proof that Ground remains byte-identical.
begin;
do $reviewed_pricing_upper_only$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_workspace jsonb; v_item jsonb; v_draft jsonb; v_preview jsonb;
  v_submit jsonb; v_replay jsonb; v_control jsonb; v_admin jsonb; v_result jsonb;
  v_before jsonb:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  v_tier uuid; v_price numeric;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+30);
  v_item:=pg_temp.reviewed_pricing_item('upper',2,2,5.00);
  v_tier:=(v_item->>'schedule_tier_id')::uuid;
  v_price:=(v_item->>'requested_price')::numeric;
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
    'partner_id',c_partner,'hotel_id',c_hotel,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}',
    'items',jsonb_build_array(v_item),
    'reason','Partner Upper-only reviewed pricing change');
  v_preview:=public.hotel_v2_partner_preview_seven_arches_pricing_proposal(v_draft);
  if v_preview->>'changed'<>'true' or not exists(select 1
      from jsonb_array_elements(v_preview->'commercial_impacts') impact(value)
      where impact.value->>'scope'='single_room'
        and impact.value->>'room_key'='upper'
        and (impact.value->>'customer_after')::numeric=v_price
        and (impact.value->>'cypruseye_commission')::numeric=10
        and (impact.value->>'partner_net_after')::numeric=v_price-10) then
    raise exception 'reviewed_pricing_upper_partner_preview_invalid:%',v_preview;
  end if;
  v_submit:=public.hotel_v2_partner_submit_seven_arches_pricing_proposal(
    v_preview->'reviewed_plan','41500000-0000-4000-8000-000000000001',
    '41500000-0000-4000-8000-000000000002');
  v_replay:=public.hotel_v2_partner_submit_seven_arches_pricing_proposal(
    v_preview->'reviewed_plan','41500000-0000-4000-8000-000000000001',
    '41500000-0000-4000-8000-000000000002');
  if v_replay->>'replayed'<>'true'
     or v_replay->>'proposal_id'<>v_submit->>'proposal_id' then
    raise exception 'reviewed_pricing_partner_submit_replay_invalid';
  end if;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_seven_arches_reviewed_pricing();
  if not exists(select 1 from jsonb_array_elements(v_control->'proposals') proposal(value)
      where proposal.value->>'id'=v_submit->>'proposal_id'
        and proposal.value->>'fresh'='true'
        and proposal.value->>'initiator_type'='partner'
        and (proposal.value->>'item_count')::integer=1) then
    raise exception 'reviewed_pricing_admin_control_invalid:%',v_control;
  end if;
  v_admin:=public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      'hotel_id',c_hotel,'proposal_id',(v_submit->>'proposal_id')::uuid,
      'proposal_version',1,'action','accept',
      'reason','Admin accepts Upper-only reviewed pricing change'));
  if v_admin->>'changed'<>'true' or v_admin->'commercial_impacts'
       is distinct from v_preview->'commercial_impacts' then
    raise exception 'reviewed_pricing_upper_admin_preview_invalid:%',v_admin;
  end if;
  v_result:=public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
    v_admin->'reviewed_plan','41500000-0000-4000-8000-000000000003',
    '41500000-0000-4000-8000-000000000004');
  v_replay:=public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
    v_admin->'reviewed_plan','41500000-0000-4000-8000-000000000003',
    '41500000-0000-4000-8000-000000000004');
  reset role;
  if v_result->>'status'<>'accepted' or v_result->>'changed'<>'true'
     or v_result->>'receipt_sequence'<>'1' or v_replay->>'replayed'<>'true' then
    raise exception 'reviewed_pricing_upper_apply_invalid:%/%',v_result,v_replay;
  end if;
  perform pg_temp.reviewed_pricing_assert_state(1,v_tier,v_price,'ground',
    v_before#>>'{room_fingerprints,ground}');
end;
$reviewed_pricing_upper_only$;
commit;

-- Partner Ground-only proposal; Upper must remain byte-identical.
begin;
do $reviewed_pricing_ground_only$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_workspace jsonb; v_item jsonb; v_preview jsonb; v_submit jsonb;
  v_admin jsonb; v_result jsonb;
  v_before jsonb:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+30);
  v_item:=pg_temp.reviewed_pricing_item('ground',3,3,6.00);
  v_preview:=public.hotel_v2_partner_preview_seven_arches_pricing_proposal(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
      'partner_id',c_partner,'hotel_id',c_hotel,
      'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
      'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}',
      'items',jsonb_build_array(v_item),
      'reason','Partner Ground-only reviewed pricing change'));
  v_submit:=public.hotel_v2_partner_submit_seven_arches_pricing_proposal(
    v_preview->'reviewed_plan','41500000-0000-4000-8000-000000000005',
    '41500000-0000-4000-8000-000000000006');
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_admin:=public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      'hotel_id',c_hotel,'proposal_id',(v_submit->>'proposal_id')::uuid,
      'proposal_version',1,'action','accept',
      'reason','Admin accepts Ground-only reviewed pricing change'));
  v_result:=public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
    v_admin->'reviewed_plan','41500000-0000-4000-8000-000000000007',
    '41500000-0000-4000-8000-000000000008');
  reset role;
  if v_result->>'status'<>'accepted' then
    raise exception 'reviewed_pricing_ground_apply_invalid:%',v_result;
  end if;
  perform pg_temp.reviewed_pricing_assert_state(2,
    (v_item->>'schedule_tier_id')::uuid,(v_item->>'requested_price')::numeric,
    'upper',v_before#>>'{room_fingerprints,upper}');
end;
$reviewed_pricing_ground_only$;
commit;

-- Both Rooms change only because both exact tiers are explicitly selected.
begin;
do $reviewed_pricing_both_rooms$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_workspace jsonb; v_upper jsonb; v_ground jsonb; v_preview jsonb;
  v_submit jsonb; v_admin jsonb; v_result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+30);
  v_upper:=pg_temp.reviewed_pricing_item('upper',4,10,7.00);
  v_ground:=pg_temp.reviewed_pricing_item('ground',4,10,9.00);
  v_preview:=public.hotel_v2_partner_preview_seven_arches_pricing_proposal(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
      'partner_id',c_partner,'hotel_id',c_hotel,
      'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
      'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}',
      'items',jsonb_build_array(v_upper,v_ground),
      'reason','Partner explicitly changes both independent Rooms'));
  v_submit:=public.hotel_v2_partner_submit_seven_arches_pricing_proposal(
    v_preview->'reviewed_plan','41500000-0000-4000-8000-000000000009',
    '41500000-0000-4000-8000-000000000010');
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_admin:=public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      'hotel_id',c_hotel,'proposal_id',(v_submit->>'proposal_id')::uuid,
      'proposal_version',1,'action','accept',
      'reason','Admin accepts both explicitly selected Rooms'));
  v_result:=public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
    v_admin->'reviewed_plan','41500000-0000-4000-8000-000000000011',
    '41500000-0000-4000-8000-000000000012');
  reset role;
  if v_result->>'status'<>'accepted'
     or jsonb_array_length(v_result->'changed_items')<>2 then
    raise exception 'reviewed_pricing_both_apply_invalid:%',v_result;
  end if;
  perform pg_temp.reviewed_pricing_assert_state(3,
    (v_upper->>'schedule_tier_id')::uuid,(v_upper->>'requested_price')::numeric,
    null,null);
  perform pg_temp.reviewed_pricing_assert_state(3,
    (v_ground->>'schedule_tier_id')::uuid,(v_ground->>'requested_price')::numeric,
    null,null);
end;
$reviewed_pricing_both_rooms$;
commit;

-- Rejection consumes the reviewed proposal without pricing or receipt mutation.
begin;
do $reviewed_pricing_reject$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_workspace jsonb; v_preview jsonb; v_submit jsonb; v_admin jsonb;
  v_result jsonb; v_before jsonb:=
    public.hotel_v2_seven_arches_reviewed_pricing_current_state();
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+30);
  v_preview:=public.hotel_v2_partner_preview_seven_arches_pricing_proposal(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
      'partner_id',c_partner,'hotel_id',c_hotel,
      'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
      'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}',
      'items',jsonb_build_array(
        pg_temp.reviewed_pricing_item('upper',3,5,4.00)),
      'reason','Partner proposal intentionally rejected by Admin'));
  v_submit:=public.hotel_v2_partner_submit_seven_arches_pricing_proposal(
    v_preview->'reviewed_plan','41500000-0000-4000-8000-000000000013',
    '41500000-0000-4000-8000-000000000014');
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_admin:=public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      'hotel_id',c_hotel,'proposal_id',(v_submit->>'proposal_id')::uuid,
      'proposal_version',1,'action','reject',
      'reason','Admin rejects without a pricing mutation'));
  v_result:=public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
    v_admin->'reviewed_plan','41500000-0000-4000-8000-000000000015',
    '41500000-0000-4000-8000-000000000016');
  reset role;
  if v_result->>'status'<>'rejected' or v_result->>'changed'<>'false'
     or v_result->'receipt_id'<>'null'::jsonb
     or public.hotel_v2_seven_arches_reviewed_pricing_current_state()
       is distinct from v_before then
    raise exception 'reviewed_pricing_reject_invalid:%',v_result;
  end if;
  perform pg_temp.reviewed_pricing_assert_state(3,null,null,null,null);
end;
$reviewed_pricing_reject$;
commit;

-- Admin-initiated pricing uses the same typed planner, Apply function, receipt,
-- commercial preview, and atomic postconditions as Partner-originated work.
begin;
do $reviewed_pricing_admin_direct$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_item jsonb:=pg_temp.reviewed_pricing_item('ground',2,7,3.00);
  v_before jsonb:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  v_admin jsonb; v_result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_admin:=public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      'hotel_id',c_hotel,'action','accept',
      'reason','Admin initiates exact reviewed pricing planner',
      'items',jsonb_build_array(v_item)));
  v_result:=public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
    v_admin->'reviewed_plan','41500000-0000-4000-8000-000000000017',
    '41500000-0000-4000-8000-000000000018');
  reset role;
  if v_result->>'status'<>'accepted'
     or v_result->>'receipt_sequence'<>'4'
     or v_result->>'changed'<>'true' then
    raise exception 'reviewed_pricing_admin_direct_invalid:%',v_result;
  end if;
  perform pg_temp.reviewed_pricing_assert_state(4,
    (v_item->>'schedule_tier_id')::uuid,(v_item->>'requested_price')::numeric,
    'upper',v_before#>>'{room_fingerprints,upper}');
end;
$reviewed_pricing_admin_direct$;
commit;

-- Typed-contract, bypass, raw-ACL, and atomic-guard negatives.
do $reviewed_pricing_negatives$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_base jsonb:=pg_temp.reviewed_pricing_item('upper',2,3,2.00);
  v_count integer:=0; v_before jsonb;
begin
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{hotel_id}',
        '"00000000-0000-4000-8000-000000000001"'::jsonb)),
      'Wrong Hotel','PT409','hotels_v2_seven_arches_reviewed_pricing_item_stale')
    then v_count:=v_count+1; else raise exception 'negative_wrong_hotel_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{room_type_id}',
        '"00000000-0000-4000-8000-000000000002"'::jsonb)),
      'Wrong Room','PT409','hotels_v2_seven_arches_reviewed_pricing_item_stale')
    then v_count:=v_count+1; else raise exception 'negative_wrong_room_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{room_rate_id}',
        '"00000000-0000-4000-8000-000000000003"'::jsonb)),
      'Wrong Rate','PT409','hotels_v2_seven_arches_reviewed_pricing_item_stale')
    then v_count:=v_count+1; else raise exception 'negative_wrong_rate_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{pricing_schedule_id}',
        '"00000000-0000-4000-8000-000000000004"'::jsonb)),
      'Wrong Schedule','22023','hotels_v2_seven_arches_reviewed_pricing_item_invalid')
    then v_count:=v_count+1; else raise exception 'negative_wrong_schedule_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{schedule_tier_id}',
        '"00000000-0000-4000-8000-000000000005"'::jsonb)),
      'Foreign Tier','PT404','hotels_v2_seven_arches_reviewed_pricing_tier_not_found')
    then v_count:=v_count+1; else raise exception 'negative_foreign_tier_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{schedule_tier_id}',
        to_jsonb(upper(v_base->>'schedule_tier_id')))),
      'Uppercase Tier','22023','hotels_v2_seven_arches_reviewed_pricing_item_invalid')
    then v_count:=v_count+1; else raise exception 'negative_uppercase_tier_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{schedule_tier_id}','"bad"'::jsonb)),
      'Malformed Tier','22023','hotels_v2_seven_arches_reviewed_pricing_item_invalid')
    then v_count:=v_count+1; else raise exception 'negative_malformed_tier_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{guest_count}','5'::jsonb)),
      'Unsupported Guest','22023','hotels_v2_seven_arches_reviewed_pricing_item_invalid')
    then v_count:=v_count+1; else raise exception 'negative_guest_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{minimum_nights}','11'::jsonb)),
      'Unsupported Threshold','22023','hotels_v2_seven_arches_reviewed_pricing_item_invalid')
    then v_count:=v_count+1; else raise exception 'negative_threshold_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(v_base||jsonb_build_object('season','summer')),
      'Unsupported Dimension','22023','hotels_v2_seven_arches_reviewed_pricing_item_invalid')
    then v_count:=v_count+1; else raise exception 'negative_dimension_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(v_base||jsonb_build_object('commission',11)),
      'Commission Field','22023','hotels_v2_seven_arches_reviewed_pricing_item_invalid')
    then v_count:=v_count+1; else raise exception 'negative_commission_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(v_base,v_base),
      'Duplicate Tier','23505','hotels_v2_seven_arches_reviewed_pricing_duplicate_item')
    then v_count:=v_count+1; else raise exception 'negative_duplicate_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{requested_price}',v_base->'before_price')),
      'Unchanged Tier','23514','hotels_v2_seven_arches_reviewed_pricing_unchanged_item')
    then v_count:=v_count+1; else raise exception 'negative_unchanged_failed'; end if;
  if pg_temp.reviewed_pricing_expect_plan_failure(
      jsonb_build_array(jsonb_set(v_base,'{requested_price}','9'::jsonb)),
      'Price Too Low','23514','hotels_v2_seven_arches_reviewed_pricing_price_out_of_range')
    then v_count:=v_count+1; else raise exception 'negative_price_failed'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  begin
    perform public.hotel_v2_partner_preview_pricing_plan(
      jsonb_build_object('hotel_id',c_hotel));
    raise exception 'negative_legacy_preview_bypass_not_rejected';
  exception when sqlstate 'PT409' then
    if sqlerrm<>'hotels_v2_seven_arches_reviewed_pricing_required' then raise; end if;
    v_count:=v_count+1;
  end;
  begin
    perform public.hotel_v2_partner_apply_pricing_plan(
      jsonb_build_object('hotel_id',c_hotel),
      '41500000-0000-4000-8000-000000000019',
      '41500000-0000-4000-8000-000000000020');
    raise exception 'negative_legacy_apply_bypass_not_rejected';
  exception when sqlstate 'PT409' then
    if sqlerrm<>'hotels_v2_seven_arches_reviewed_pricing_required' then raise; end if;
    v_count:=v_count+1;
  end;
  reset role;
  if not exists(select 1 from (values
      ('public.hotel_seven_arches_reviewed_pricing_proposals'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_proposal_items'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_admin_reviews'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_transaction_context'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_foundation_receipts'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_evolution_receipts'::regclass)
    ) relation(oid)
    where has_table_privilege('authenticated',oid,'SELECT')
       or has_table_privilege('authenticated',oid,'INSERT')
       or has_table_privilege('authenticated',oid,'UPDATE')
       or has_table_privilege('authenticated',oid,'DELETE')) then
    v_count:=v_count+1;
  else raise exception 'negative_raw_acl_failed'; end if;

  v_before:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  begin
    update public.hotel_pricing_schedule_occupancy_tiers
      set nightly_rate=nightly_rate+1
    where id=(v_base->>'schedule_tier_id')::uuid;
    raise exception 'negative_normalized_only_not_rejected';
  exception when sqlstate '55000' then v_count:=v_count+1; end;
  if public.hotel_v2_seven_arches_reviewed_pricing_current_state()
       is distinct from v_before then
    raise exception 'negative_normalized_only_not_rolled_back';
  end if;
  begin
    update public.hotel_seven_arches_independent_pricing_authority
      set current_nightly_rate=current_nightly_rate+1
    where target_tier_id=(v_base->>'schedule_tier_id')::uuid;
    raise exception 'negative_authority_only_not_rejected';
  exception when sqlstate '55000' then v_count:=v_count+1; end;
  begin
    update public.hotels set pricing_tiers=jsonb_set(
      pricing_tiers,'{rules,0,price_per_night}','999'::jsonb,false)
    where id=c_hotel;
    raise exception 'negative_legacy_only_not_rejected';
  exception when sqlstate '55000' then v_count:=v_count+1; end;
  begin
    update public.hotel_seven_arches_reviewed_pricing_evolution_receipts
      set receipt_hash=repeat('0',64) where sequence_no=1;
    raise exception 'negative_receipt_corruption_not_rejected';
  exception when sqlstate '55000' then v_count:=v_count+1; end;
  begin
    delete from public.hotel_seven_arches_reviewed_pricing_evolution_receipts
      where sequence_no=1;
    raise exception 'negative_receipt_delete_not_rejected';
  exception when sqlstate '55000' then v_count:=v_count+1; end;

  if v_count<>22 then
    raise exception 'reviewed_pricing_negative_count_mismatch:%',v_count;
  end if;
  if public.hotel_v2_seven_arches_reviewed_pricing_current_state()
       is distinct from v_before
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
       is not true then
    raise exception 'reviewed_pricing_negative_rollback_containment_failed';
  end if;
end;
$reviewed_pricing_negatives$;

create function pg_temp.reviewed_pricing_admin_plan(
  p_delta numeric,p_reason text
) returns jsonb language plpgsql volatile
set search_path=pg_catalog,public as $function$
begin
  return public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
      'action','accept','reason',p_reason,
      'items',jsonb_build_array(
        pg_temp.reviewed_pricing_item('upper',4,10,p_delta))))->'reviewed_plan';
end;
$function$;

-- Identity, lifecycle, chain, and unrelated-drift probes.  Each probe that
-- creates a proposal/review deliberately raises a private success sentinel so
-- its complete subtransaction is rolled back before the next probe.
do $reviewed_pricing_lineage_negatives$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_count integer:=0; v_workspace jsonb; v_preview jsonb; v_plan jsonb;
  v_before jsonb:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  v_expired timestamptz;
begin
  -- Foreign Partner.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  begin
    perform public.hotel_v2_partner_preview_seven_arches_pricing_proposal(
      jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
        'partner_id','00000000-0000-4000-8000-000000000021'::uuid,
        'hotel_id',c_hotel,'access_snapshot_token',repeat('0',64),
        'pricing_snapshot_token',repeat('0',64),
        'items',jsonb_build_array(pg_temp.reviewed_pricing_item('upper',4,10,2)),
        'reason','Foreign Partner must fail closed'));
    raise exception 'negative_foreign_partner_not_rejected';
  exception when insufficient_privilege then
    if sqlerrm<>'hotels_v2_h3_2a_partner_access_denied' then raise; end if;
    v_count:=v_count+1;
  end;

  -- Foreign assignment remains bound by the transport-stable plan hash.
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+30);
  v_preview:=public.hotel_v2_partner_preview_seven_arches_pricing_proposal(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
      'partner_id',c_partner,'hotel_id',c_hotel,
      'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
      'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}',
      'items',jsonb_build_array(pg_temp.reviewed_pricing_item('upper',4,10,2)),
      'reason','Foreign assignment must fail closed'));
  begin
    perform public.hotel_v2_partner_submit_seven_arches_pricing_proposal(
      jsonb_set(v_preview->'reviewed_plan','{assignment_id}',
        '"00000000-0000-4000-8000-000000000022"'::jsonb,false),
      '41500000-0000-4000-8000-000000000021',
      '41500000-0000-4000-8000-000000000022');
    raise exception 'negative_foreign_assignment_not_rejected';
  exception when sqlstate '22023' then
    if sqlerrm<>'hotels_v2_seven_arches_reviewed_pricing_partner_plan_hash_invalid'
      then raise; end if;
    v_count:=v_count+1;
  end;
  reset role;

  -- Proposal/review mismatch.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    v_plan:=pg_temp.reviewed_pricing_admin_plan(2,
      'Proposal and review identity mismatch probe');
    begin
      perform public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
        jsonb_set(v_plan,'{proposal_id}',
          '"00000000-0000-4000-8000-000000000023"'::jsonb,false),
        '41500000-0000-4000-8000-000000000023',
        '41500000-0000-4000-8000-000000000024');
      raise exception 'negative_proposal_review_mismatch_not_rejected';
    exception when sqlstate '22023' then
      if sqlerrm<>'hotels_v2_seven_arches_reviewed_pricing_admin_plan_invalid'
        then raise; end if;
      raise exception using errcode='P0001',message='expected_proposal_review_mismatch';
    end;
  exception when raise_exception then
    if sqlerrm<>'expected_proposal_review_mismatch' then raise; end if;
    v_count:=v_count+1;
  end;

  -- Expired review.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    v_plan:=pg_temp.reviewed_pricing_admin_plan(2,'Expired Admin review probe');
    reset role;
    v_expired:=clock_timestamp()-interval '31 minutes';
    set local session_replication_role='replica';
    update public.hotel_seven_arches_reviewed_pricing_admin_reviews review set
      reviewed_at=v_expired,expires_at=v_expired+interval '30 minutes'
    where review.id=(v_plan->>'review_id')::uuid;
    set local session_replication_role='origin';
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    begin
      perform public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(v_plan,
        '41500000-0000-4000-8000-000000000025',
        '41500000-0000-4000-8000-000000000026');
      raise exception 'negative_expired_review_not_rejected';
    exception when sqlstate 'PT409' then
      if sqlerrm<>'hotels_v2_seven_arches_reviewed_pricing_review_expired'
        then raise; end if;
      raise exception using errcode='P0001',message='expected_expired_review';
    end;
  exception when raise_exception then
    if sqlerrm<>'expected_expired_review' then raise; end if;
    v_count:=v_count+1;
  end;

  -- Stale proposal.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    v_plan:=pg_temp.reviewed_pricing_admin_plan(2,'Expired proposal probe');
    reset role;
    v_expired:=clock_timestamp()-interval '31 minutes';
    set local session_replication_role='replica';
    update public.hotel_seven_arches_reviewed_pricing_proposals proposal set
      created_at=v_expired,expires_at=v_expired+interval '30 minutes'
    where proposal.id=(v_plan->>'proposal_id')::uuid;
    set local session_replication_role='origin';
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    begin
      perform public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(v_plan,
        '41500000-0000-4000-8000-000000000027',
        '41500000-0000-4000-8000-000000000028');
      raise exception 'negative_stale_proposal_not_rejected';
    exception when sqlstate 'PT409' then
      if sqlerrm<>'hotels_v2_seven_arches_reviewed_pricing_proposal_stale'
        then raise; end if;
      raise exception using errcode='P0001',message='expected_stale_proposal';
    end;
  exception when raise_exception then
    if sqlerrm<>'expected_stale_proposal' then raise; end if;
    v_count:=v_count+1;
  end;

  -- Consumed review with a different identity.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    v_plan:=pg_temp.reviewed_pricing_admin_plan(2,'Consumed review probe');
    reset role;
    set local session_replication_role='replica';
    update public.hotel_seven_arches_reviewed_pricing_admin_reviews review set
      consumed_at=clock_timestamp(),
      consumed_correlation_id='41500000-0000-4000-8000-000000000029',
      consumed_idempotency_key='41500000-0000-4000-8000-000000000030',
      result='{}'::jsonb
    where review.id=(v_plan->>'review_id')::uuid;
    set local session_replication_role='origin';
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    begin
      perform public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(v_plan,
        '41500000-0000-4000-8000-000000000031',
        '41500000-0000-4000-8000-000000000032');
      raise exception 'negative_consumed_review_not_rejected';
    exception when sqlstate 'PT409' then
      if sqlerrm<>'hotels_v2_seven_arches_reviewed_pricing_review_consumed'
        then raise; end if;
      raise exception using errcode='P0001',message='expected_consumed_review';
    end;
  exception when raise_exception then
    if sqlerrm<>'expected_consumed_review' then raise; end if;
    v_count:=v_count+1;
  end;

  -- Receipt-chain fork and unrelated protected pricing drift.
  begin
    update public.hotel_seven_arches_reviewed_pricing_evolution_receipts
      set previous_receipt_hash=repeat('0',64) where sequence_no=2;
    raise exception 'negative_receipt_chain_fork_not_rejected';
  exception when sqlstate '55000' then
    if sqlerrm<>'hotels_v2_seven_arches_reviewed_pricing_receipt_immutable'
      then raise; end if;
    v_count:=v_count+1;
  end;
  begin
    update public.hotel_pricing_schedules schedule set
      name_i18n=jsonb_set(schedule.name_i18n,'{en}',
        '"Unauthorized drift"'::jsonb,false)
    where schedule.id='aec20731-7a56-35f0-334e-92b363351f02'::uuid;
    raise exception 'negative_unrelated_pricing_drift_not_rejected';
  exception when sqlstate '55000' then
    if sqlerrm<>'hotels_v2_admin_c_h3_1p_graph_immutable' then raise; end if;
    v_count:=v_count+1;
  end;

  if v_count<>8 then
    raise exception 'reviewed_pricing_lineage_negative_count_mismatch:%',v_count;
  end if;
  if public.hotel_v2_seven_arches_reviewed_pricing_current_state()
       is distinct from v_before
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
       is not true
     or exists(select 1 from public.hotel_seven_arches_reviewed_pricing_proposals
       where status='pending_admin_review') then
    raise exception 'reviewed_pricing_lineage_negative_rollback_failed';
  end if;
end;
$reviewed_pricing_lineage_negatives$;

select 'HOTELS_V2_7A_REVIEWED_PRICING_EVOLUTION_POSTGRES_GATE_OK' sentinel,
  (select count(*) from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)
    accepted_receipts,
  (public.hotel_v2_seven_arches_reviewed_pricing_oracle()->>'core_case_count')::integer
    parity_cases,
  (public.hotel_v2_seven_arches_reviewed_pricing_oracle()->>'core_mismatch_count')::integer
    parity_mismatches,
  (public.hotel_v2_seven_arches_reviewed_pricing_oracle()->>'guest_one_case_count')::integer
    guest_one_cases,
  (public.hotel_v2_seven_arches_reviewed_pricing_oracle()->>'guest_one_mismatch_count')::integer
    guest_one_mismatches,
  public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
    receipt_chain_exact,
  30 negative_probes;
