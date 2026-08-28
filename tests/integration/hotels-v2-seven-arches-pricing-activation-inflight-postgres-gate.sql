\set ON_ERROR_STOP on
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql

-- Establish the exact reviewed Task2 state required by 114400 without running
-- any later migration.
begin;
do $accept_task2_before_inflight_gate$
declare
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_workspace jsonb; v_draft jsonb; v_preview jsonb; v_control jsonb;
  v_proposal jsonb; v_apply jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+2);
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',
    jsonb_build_object('entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','7 Łuków — aktywacja','en','7 Arches activation',
        'he','הפעלת 7 קשתות')),
      'reason','Task2 acceptance before pricing in-flight gate'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38900000-0000-4000-8000-000000000001',
    '38900000-0000-4000-8000-000000000002');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(
    jsonb_build_object(
      'contract_version',
        'hotels_v2_seven_arches_property_proposal_review_request_v1',
      'hotel_id',c_hotel,'proposal_id',v_proposal->'id',
      'proposal_version',v_proposal->'version','action','accept',
      'reason','Accept Task2 proposal before pricing in-flight gate'));
  v_apply:=public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_preview->'reviewed_plan','38900000-0000-4000-8000-000000000003');
  reset role;
  if v_apply->>'status'<>'accepted'
     or public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
       is not true then
    raise exception 'pricing_activation_inflight_task2_setup_failed:%',v_apply;
  end if;
end
$accept_task2_before_inflight_gate$;
commit;

\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql

begin;
set local statement_timeout='180s';

-- This test-only statement hook injects a sixth protected-key delta while the
-- four reviewed activity rows are inserted and before the in-flight projector
-- runs. The projector does not use activity-log trigger topology as authority,
-- so the hook itself cannot be the reason the negative is rejected.
create function pg_temp.hotel_v2_114400_inject_extra_delta()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
begin
  update public.hotel_partner_hotel_permissions
  set request_booking_changes=not request_booking_changes
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid;
  return null;
end
$function$;
create trigger hotel_v2_114400_inject_extra_delta
after insert on public.hotel_activity_log
for each statement
execute function pg_temp.hotel_v2_114400_inject_extra_delta();

-- This test-only AFTER INSERT hook proves that Apply passed both canonical
-- five-key allowlists, inserted the immutable receipt, and that count-one
-- projector semantics see exactly the inserted after maps. It then raises a
-- sentinel so the whole Apply subtransaction rolls back before the known
-- post-cleanup 114405 recursion seam.
create function pg_temp.hotel_v2_114400_stop_after_receipt()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_canonical jsonb;
begin
  v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or v_canonical is null
     or v_canonical->'task2_protected_fingerprints'
       is distinct from new.after_protected_fingerprints
     or v_canonical->>'task2_protected_fingerprint'
       is distinct from new.after_protected_fingerprint
     or v_canonical->'stage2_protected_fingerprints'
       is distinct from new.after_stage2_protected_fingerprints
     or v_canonical->>'stage2_protected_fingerprint'
       is distinct from new.after_stage2_protected_fingerprint
     or new.before_protected_fingerprints is distinct from
       (select canonical_task2_protected_fingerprints
        from public.hotel_seven_arches_task2_stage2_compatibility_receipts
        where id=1)
     or new.before_stage2_protected_fingerprints is distinct from
       (select canonical_stage2_protected_fingerprints
        from public.hotel_seven_arches_task2_stage2_compatibility_receipts
        where id=1) then
    raise exception using errcode='P0001',
      message='HOTELS_V2_114400_INFLIGHT_RECEIPT_INVALID';
  end if;
  raise exception using errcode='P0001',
    message='HOTELS_V2_114400_INFLIGHT_RECEIPT_REACHED';
end
$function$;
create trigger hotel_v2_114400_stop_after_receipt
after insert on public.hotel_seven_arches_pricing_activation_evolution_receipts
for each row execute function pg_temp.hotel_v2_114400_stop_after_receipt();

-- Clone the exact installed Apply under pg_temp and inject one test-only
-- transaction-id mutation after all typed review/Admin/activity evidence has
-- been written but immediately before the projector call. The production Apply
-- remains byte-exact and source-pinned; the context guard is re-enabled before
-- the projector evaluates its catalog and persisted authority predicates.
do $install_foreign_transaction_apply_probe$
declare
  v_definition text;
  v_function_name constant text:=
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation';
  v_needle constant text:=$needle$  v_after_canonical:=
    public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();$needle$;
  v_replacement constant text:=$replacement$  execute
    'alter table public.hotel_seven_arches_pricing_activation_transaction_context '||
    'disable trigger hotel_seven_arches_pricing_activation_context_guard';
  update public.hotel_seven_arches_pricing_activation_transaction_context
  set transaction_id=txid_current()+1
  where transaction_id=txid_current();
  execute
    'alter table public.hotel_seven_arches_pricing_activation_transaction_context '||
    'enable trigger hotel_seven_arches_pricing_activation_context_guard';
  v_after_canonical:=
    public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();$replacement$;
begin
  select pg_get_functiondef(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'
      ::regprocedure)
  into strict v_definition;
  if (length(v_definition)-length(replace(v_definition,v_function_name,'')))
       /length(v_function_name)<>1
     or (length(v_definition)-length(replace(v_definition,v_needle,'')))
       /length(v_needle)<>1 then
    raise exception 'pricing_activation_inflight_apply_clone_source_mismatch';
  end if;
  v_definition:=replace(v_definition,v_function_name,
    'pg_temp.hotel_v2_114400_apply_foreign_transaction_probe');
  execute replace(v_definition,v_needle,v_replacement);
end
$install_foreign_transaction_apply_probe$;

do $pricing_activation_inflight_gate$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_snapshot jsonb; v_draft jsonb; v_preview jsonb;
  v_failed boolean:=false; v_reached boolean:=false; v_message text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_snapshot:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
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
    'reason','Reviewed in-flight projector gate');
  v_preview:=public.hotel_v2_admin_preview_seven_arches_pricing_activation(v_draft);

  begin
    perform public.hotel_v2_admin_apply_seven_arches_pricing_activation(
      v_preview->'reviewed_plan','38900000-0000-4000-8000-000000000011',
      'seven-arches-inflight-extra-delta-0001');
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message=
      'hotels_v2_seven_arches_pricing_activation_delta_scope_mismatch';
  end;
  reset role;
  if v_failed is not true then
    raise exception 'pricing_activation_inflight_extra_delta_negative_failed:%',
      v_message;
  end if;
  if exists(select 1 from public.hotel_partner_hotel_permissions
      where hotel_id=c_hotel and request_booking_changes)
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_evolution_receipts)
     or exists(select 1 from public.hotel_admin_pricing_action_receipts
       where correlation_id='38900000-0000-4000-8000-000000000011'::uuid)
     or exists(select 1 from public.hotel_activity_log
       where correlation_id='38900000-0000-4000-8000-000000000011'::uuid)
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context) then
    raise exception 'pricing_activation_inflight_extra_delta_not_rolled_back';
  end if;

  execute 'drop trigger hotel_v2_114400_inject_extra_delta on '||
    'public.hotel_activity_log';
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_failed:=false;
  v_message:=null;
  begin
    perform pg_temp.hotel_v2_114400_apply_foreign_transaction_probe(
      v_preview->'reviewed_plan','38900000-0000-4000-8000-000000000013',
      'seven-arches-inflight-foreign-tx-0001');
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message=
      'hotels_v2_seven_arches_pricing_activation_delta_scope_mismatch';
  end;
  reset role;
  if v_failed is not true then
    raise exception 'pricing_activation_inflight_foreign_transaction_negative_failed:%',
      v_message;
  end if;
  if exists(select 1
       from public.hotel_seven_arches_pricing_activation_evolution_receipts)
     or exists(select 1 from public.hotel_admin_pricing_action_receipts
       where correlation_id='38900000-0000-4000-8000-000000000013'::uuid)
     or exists(select 1 from public.hotel_activity_log
       where correlation_id='38900000-0000-4000-8000-000000000013'::uuid)
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or exists(select 1 from public.hotel_seven_arches_pricing_activation_reviews
       where id=(v_preview#>>'{reviewed_plan,review_id}')::uuid
         and consumed_at is not null)
     or public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() is null then
    raise exception 'pricing_activation_inflight_foreign_transaction_not_rolled_back';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  begin
    perform public.hotel_v2_admin_apply_seven_arches_pricing_activation(
      v_preview->'reviewed_plan','38900000-0000-4000-8000-000000000012',
      'seven-arches-inflight-receipt-0001');
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_reached:=v_message='HOTELS_V2_114400_INFLIGHT_RECEIPT_REACHED';
  end;
  reset role;
  if v_reached is not true then
    raise exception 'pricing_activation_inflight_receipt_sentinel_failed:%',v_message;
  end if;
  if exists(select 1
       from public.hotel_seven_arches_pricing_activation_evolution_receipts)
     or exists(select 1 from public.hotel_admin_pricing_action_receipts
       where correlation_id='38900000-0000-4000-8000-000000000012'::uuid)
     or exists(select 1 from public.hotel_activity_log
       where correlation_id='38900000-0000-4000-8000-000000000012'::uuid)
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or exists(select 1 from public.hotel_seven_arches_pricing_activation_reviews
       where id=(v_preview#>>'{reviewed_plan,review_id}')::uuid
         and consumed_at is not null)
     or public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() is null then
    raise exception 'pricing_activation_inflight_receipt_probe_not_rolled_back';
  end if;
end
$pricing_activation_inflight_gate$;

drop trigger hotel_v2_114400_stop_after_receipt
  on public.hotel_seven_arches_pricing_activation_evolution_receipts;
drop function pg_temp.hotel_v2_114400_stop_after_receipt();
drop function pg_temp.hotel_v2_114400_inject_extra_delta();
drop function pg_temp.hotel_v2_114400_apply_foreign_transaction_probe(
  jsonb,uuid,text);

select 'HOTELS_V2_114400_PRICING_ACTIVATION_INFLIGHT_GATE_OK' as sentinel,
  (select count(*)
    from public.hotel_seven_arches_pricing_activation_evolution_receipts)=0
      as activation_receipt_rolled_back,
  public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() is not null
      as baseline_projector_restored;
rollback;
