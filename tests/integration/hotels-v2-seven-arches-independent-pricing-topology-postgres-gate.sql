\set ON_ERROR_STOP on
\set seven_arches_run_task2_accept true
\if :{?seven_arches_pricing_activation_exact_six_fixture}
\if :seven_arches_pricing_activation_exact_six_fixture
\set seven_arches_run_task2_accept false
\else
\unset seven_arches_owner_live_drift_fixture
\endif
\else
\unset seven_arches_owner_live_drift_fixture
\endif
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql

-- Production order: the accepted Task2 property proposal precedes 114400.
-- The legacy fixture variable above is retained only as a cross-file harness
-- alias.  Its production-shaped branch now preserves the already-installed
-- 114370 foundation while exercising the scope-aware live-activity boundary;
-- it is not a historical/current drift-key allowlist.
\if :seven_arches_run_task2_accept
begin;
do $task2_accept_before_independent_pricing$
declare
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_workspace jsonb; v_preview jsonb; v_control jsonb; v_proposal jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+2);
  v_preview:=public.hotel_v2_partner_preview_content_plan(jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','7 Łuków — topologia','en','7 Arches topology','he','טופולוגיית 7 קשתות')),
      'reason','Task2 acceptance before independent pricing topology')));
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38900000-0000-4000-8000-000000000001','38900000-0000-4000-8000-000000000002');
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal->'id',
    'proposal_version',v_proposal->'version','action','accept',
    'reason','Accept Task2 proposal before independent pricing topology'));
  perform public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_preview->'reviewed_plan','38900000-0000-4000-8000-000000000003');
  reset role;
  if public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() is not true then
    raise exception 'independent_pricing_task2_accept_failed';
  end if;
end
$task2_accept_before_independent_pricing$;
commit;
\endif

\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql
\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_recursion_compatibility_preflight.sql
\ir ../../supabase/migrations/20260811440500_hotels_v2_seven_arches_pricing_activation_recursion_compatibility.sql

-- Activate the exact reviewed shared graph that 114410 evolves.
begin;
do $activate_before_independent_pricing$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_snapshot jsonb; v_preview jsonb; v_result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_snapshot:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
  v_preview:=public.hotel_v2_admin_preview_seven_arches_pricing_activation(
    jsonb_build_object(
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
      'reason','Reviewed topology gate activation'));
  v_result:=public.hotel_v2_admin_apply_seven_arches_pricing_activation(
    v_preview->'reviewed_plan','38900000-0000-4000-8000-000000000004',
    'seven-arches-independent-topology-activation');
  reset role;
  if v_result->>'changed' is distinct from 'true'
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'independent_pricing_activation_failed:%',v_result;
  end if;
end
$activate_before_independent_pricing$;
commit;

\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_verify.sql
\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_recursion_compatibility_verify.sql

create temporary table independent_pricing_topology_gate_before as
select
  current_setting('TimeZone') incoming_timezone,
  (select count(*)::integer from public.hotel_seven_arches_pricing_activation_evolution_receipts)
    activation_receipt_count,
  public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() activation_receipt_exact,
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe() activation_current_safe,
  public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() task2_compatibility_exact,
  public.hotel_v2_seven_arches_pricing_scoped_lineage() scoped_lineage,
  public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
    transaction_preservation_exact,
  (select count(*)::integer from pg_attribute where attrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and attnum>0 and not attisdropped) task2_receipt_column_count,
  (select count(*)::integer from pg_constraint where conrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)
    task2_receipt_constraint_count,
  (select receipt.scoped_lineage_source_hash is not distinct from
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
    from public.hotel_seven_arches_task2_stage2_compatibility_receipts receipt
    where receipt.id=1) task2_receipt_scoped_source_exact,
  public.hotel_v2_h3_1p_parity_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) parity_snapshot,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(receipt) order by receipt.id)
    from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt),'[]'::jsonb))
    activation_receipt_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
    to_jsonb(schedule)-array['created_at','updated_at'] order by schedule.id)
    from public.hotel_pricing_schedules schedule where schedule.id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb))
    legacy_schedule_fingerprint,
  public.hotel_v2_h3_2b_hash((select
    to_jsonb(schedule)-array['created_at','updated_at']
    from public.hotel_pricing_schedules schedule
    where schedule.id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid))
    shared_schedule_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
    to_jsonb(tier)-array['created_at','updated_at'] order by tier.id)
    from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb))
    legacy_tier_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(rate)-array['pricing_schedule_id','version','created_at','updated_at']
      order by rate.id)
    from public.hotel_room_rates rate where rate.id in(
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid)),'[]'::jsonb))
    room_rate_nonlink_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
    to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
    from public.hotel_commission_policies policy
    where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb))
    commission_fingerprint,
  public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'policies',coalesce((select jsonb_agg(
      to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'terms',coalesce((select jsonb_agg(
      to_jsonb(term)-array['created_at','updated_at'] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
      where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)))
    payment_fingerprint,
  public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'rate_plans',coalesce((select jsonb_agg(
      to_jsonb(plan)-array['created_at','updated_at'] order by plan.id)
      from public.hotel_rate_plans plan
      where plan.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'rate_rules',coalesce((select jsonb_agg(
      to_jsonb(rule)-array['created_at','updated_at'] order by rule.id)
      from public.hotel_rate_rules rule
      join public.hotel_room_rates rate on rate.id=rule.room_rate_id
      where rate.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'allocation_rules',coalesce((select jsonb_agg(
      to_jsonb(rule)-array['created_at','updated_at'] order by rule.id)
      from public.hotel_room_allocation_rules rule
      where rule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'allocation_items',coalesce((select jsonb_agg(
      to_jsonb(item)-array['created_at','updated_at'] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
      where rule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)))
    commercial_fingerprint,
  public.hotel_v2_admin_d_protected_fingerprints() admin_d_protected_fingerprints,
  public.hotel_v2_admin_d_current_foundation_snapshot() admin_d_foundation_snapshot,
  (select version from public.hotel_room_rates
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid) upper_rate_version,
  (select updated_at from public.hotel_room_rates
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid) upper_rate_updated_at,
  (select version from public.hotel_room_rates
    where id='3320590d-632d-423f-80d0-fd021cba7293'::uuid) ground_rate_version,
  (select updated_at from public.hotel_room_rates
    where id='3320590d-632d-423f-80d0-fd021cba7293'::uuid) ground_rate_updated_at,
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() protected_fingerprints,
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints() stage2_fingerprints;

do $independent_pricing_pre_topology_exact$
begin
  if not exists(select 1 from independent_pricing_topology_gate_before before_row
      where before_row.incoming_timezone=current_setting('TimeZone')
        and before_row.activation_receipt_count=1
        and before_row.activation_receipt_exact is true
        and before_row.activation_current_safe is true
        and before_row.task2_compatibility_exact is true
        and jsonb_typeof(before_row.scoped_lineage)='object'
        and before_row.scoped_lineage->>'contract_version'=
          'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
        and before_row.scoped_lineage->>'hotel_id'=
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
        and before_row.scoped_lineage->>'allocation_contract_exact'='true'
        and before_row.scoped_lineage->>'parity_case_count'='70'
        and before_row.scoped_lineage->>'parity_mismatch_count'='0'
        and before_row.transaction_preservation_exact is true
        and before_row.task2_receipt_column_count=10
        and before_row.task2_receipt_constraint_count=10
        and before_row.task2_receipt_scoped_source_exact is true
        and jsonb_typeof(before_row.admin_d_protected_fingerprints)='object'
        and jsonb_typeof(before_row.admin_d_foundation_snapshot)='object'
        and before_row.upper_rate_version is not null
        and before_row.upper_rate_updated_at is not null
        and before_row.ground_rate_version is not null
        and before_row.ground_rate_updated_at is not null
        and pg_input_is_valid(before_row.parity_snapshot->>'total_case_count','integer')
        and (before_row.parity_snapshot->>'total_case_count')::integer=70
        and pg_input_is_valid(before_row.parity_snapshot->>'total_mismatch_count','integer')
        and (before_row.parity_snapshot->>'total_mismatch_count')::integer=0) then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_pre_topology_state_invalid';
  end if;
end
$independent_pricing_pre_topology_exact$;

select 'HOTELS_V2_7A_INDEPENDENT_PRICING_TIMEZONE_BOUNDARY_OK' sentinel,
  incoming_timezone,
  current_setting('TimeZone') current_timezone,
  activation_receipt_count,
  activation_receipt_exact,
  activation_current_safe,
  task2_compatibility_exact,
  scoped_lineage->>'contract_version' scoped_lineage_contract,
  transaction_preservation_exact,
  task2_receipt_column_count,
  task2_receipt_constraint_count,
  task2_receipt_scoped_source_exact,
  (parity_snapshot->>'total_case_count')::integer parity_cases,
  (parity_snapshot->>'total_mismatch_count')::integer parity_mismatches
from independent_pricing_topology_gate_before;

\ir ../../supabase/migrations/20260811441000_hotels_v2_seven_arches_independent_pricing_evolution.sql

do $independent_pricing_timezone_boundary_preserved$
begin
  if current_setting('TimeZone') is distinct from
       (select incoming_timezone from independent_pricing_topology_gate_before) then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_timezone_boundary_changed',
      detail=jsonb_build_object(
        'incoming',(select incoming_timezone from independent_pricing_topology_gate_before),
        'current',current_setting('TimeZone'))::text;
  end if;
end
$independent_pricing_timezone_boundary_preserved$;

-- This helper deliberately reads only 114410-owned canonical evidence.  It
-- never calls the frozen upstream projector/current-safe/receipt validators.
create function pg_temp.independent_pricing_owned_timezone_fingerprints()
returns jsonb language sql stable set search_path=pg_catalog,public
as $function$
select jsonb_build_object(
  'upper_pricing_fingerprint',public.hotel_v2_h3_2b_hash(coalesce((
    select jsonb_agg(jsonb_build_object(
      'guest_count',target.guest_count,
      'threshold_nights',target.threshold_nights,
      'nightly_rate',target.nightly_rate,
      'currency',btrim(schedule.currency::text),
      'is_active',target.is_active,
      'version',target.version)
      order by target.guest_count,target.threshold_nights)
    from public.hotel_pricing_schedule_occupancy_tiers target
    join public.hotel_pricing_schedules schedule on schedule.id=target.schedule_id
    where target.schedule_id='aec20731-7a56-35f0-334e-92b363351f02'::uuid
  ),'[]'::jsonb)),
  'ground_pricing_fingerprint',public.hotel_v2_h3_2b_hash(coalesce((
    select jsonb_agg(jsonb_build_object(
      'guest_count',target.guest_count,
      'threshold_nights',target.threshold_nights,
      'nightly_rate',target.nightly_rate,
      'currency',btrim(schedule.currency::text),
      'is_active',target.is_active,
      'version',target.version)
      order by target.guest_count,target.threshold_nights)
    from public.hotel_pricing_schedule_occupancy_tiers target
    join public.hotel_pricing_schedules schedule on schedule.id=target.schedule_id
    where target.schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid
  ),'[]'::jsonb)),
  'authority_fingerprint',public.hotel_v2_h3_2b_hash(coalesce((
    select jsonb_agg(jsonb_set(to_jsonb(authority),'{created_at}',
      to_jsonb((extract(epoch from authority.created_at)*1000000)::bigint),false)
      order by authority.target_tier_id)
    from public.hotel_seven_arches_independent_pricing_authority authority
  ),'[]'::jsonb)),
  'successor_parity_fingerprint',
    public.hotel_v2_seven_arches_independent_pricing_oracle()->>'fingerprint',
  'stored_receipt_fingerprint',(select receipt.receipt_fingerprint
    from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
    where receipt.id=1),
  'calculated_receipt_fingerprint',(select public.hotel_v2_h3_2b_hash(
    jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
      to_jsonb(receipt)-'receipt_fingerprint',
      '{created_at}',to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false),
      '{upper_rate_updated_at_before}',
        to_jsonb((extract(epoch from receipt.upper_rate_updated_at_before)*1000000)::bigint),false),
      '{upper_rate_updated_at_after}',
        to_jsonb((extract(epoch from receipt.upper_rate_updated_at_after)*1000000)::bigint),false),
      '{ground_rate_updated_at_before}',
        to_jsonb((extract(epoch from receipt.ground_rate_updated_at_before)*1000000)::bigint),false),
      '{ground_rate_updated_at_after}',
        to_jsonb((extract(epoch from receipt.ground_rate_updated_at_after)*1000000)::bigint),false))
    from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
    where receipt.id=1),
  'receipt_self_hash_valid',(select receipt.receipt_fingerprint is not distinct from
    public.hotel_v2_h3_2b_hash(
      jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
        to_jsonb(receipt)-'receipt_fingerprint',
        '{created_at}',to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false),
        '{upper_rate_updated_at_before}',
          to_jsonb((extract(epoch from receipt.upper_rate_updated_at_before)*1000000)::bigint),false),
        '{upper_rate_updated_at_after}',
          to_jsonb((extract(epoch from receipt.upper_rate_updated_at_after)*1000000)::bigint),false),
        '{ground_rate_updated_at_before}',
          to_jsonb((extract(epoch from receipt.ground_rate_updated_at_before)*1000000)::bigint),false),
        '{ground_rate_updated_at_after}',
          to_jsonb((extract(epoch from receipt.ground_rate_updated_at_after)*1000000)::bigint),false))
    from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
    where receipt.id=1)
)
$function$;

create temporary table independent_pricing_owned_timezone_results(
  timezone_name text primary key,
  fingerprints jsonb not null
);

begin;
set local timezone='Asia/Nicosia';
insert into independent_pricing_owned_timezone_results
select current_setting('TimeZone'),
  pg_temp.independent_pricing_owned_timezone_fingerprints();
set local timezone='UTC';
insert into independent_pricing_owned_timezone_results
select current_setting('TimeZone'),
  pg_temp.independent_pricing_owned_timezone_fingerprints();
commit;

do $independent_pricing_owned_timezone_stability$
declare
  v_nicosia jsonb;
  v_utc jsonb;
begin
  select fingerprints into strict v_nicosia
  from independent_pricing_owned_timezone_results where timezone_name='Asia/Nicosia';
  select fingerprints into strict v_utc
  from independent_pricing_owned_timezone_results where timezone_name='UTC';
  if (select count(*) from independent_pricing_owned_timezone_results)<>2
     or v_nicosia is distinct from v_utc
     or v_nicosia->>'receipt_self_hash_valid' is distinct from 'true'
     or v_nicosia->>'upper_pricing_fingerprint' is distinct from
       (select target_initial_tier_fingerprint
        from public.hotel_seven_arches_independent_pricing_topology_receipts
        where room_key='upper')
     or v_nicosia->>'ground_pricing_fingerprint' is distinct from
       (select target_initial_tier_fingerprint
        from public.hotel_seven_arches_independent_pricing_topology_receipts
        where room_key='ground')
     or v_nicosia->>'authority_fingerprint' is distinct from
       (select authority_fingerprint
        from public.hotel_seven_arches_independent_pricing_evolution_receipts where id=1)
     or v_nicosia->>'successor_parity_fingerprint' is distinct from
       (select oracle_fingerprint
        from public.hotel_seven_arches_independent_pricing_evolution_receipts where id=1)
     or v_nicosia->>'stored_receipt_fingerprint' is distinct from
       v_nicosia->>'calculated_receipt_fingerprint'
     or current_setting('TimeZone') is distinct from
       (select incoming_timezone from independent_pricing_topology_gate_before) then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_owned_timezone_fingerprint_drift',
      detail=jsonb_build_object('nicosia',v_nicosia,'utc',v_utc,
        'incoming',(select incoming_timezone from independent_pricing_topology_gate_before),
        'current',current_setting('TimeZone'))::text;
  end if;
end
$independent_pricing_owned_timezone_stability$;

select 'HOTELS_V2_7A_INDEPENDENT_PRICING_OWNED_TIMEZONE_STABILITY_OK' sentinel,
  nicosia.fingerprints asia_nicosia,
  utc.fingerprints utc,
  current_setting('TimeZone') restored_timezone
from independent_pricing_owned_timezone_results nicosia
cross join independent_pricing_owned_timezone_results utc
where nicosia.timezone_name='Asia/Nicosia' and utc.timezone_name='UTC';

do $independent_pricing_frozen_contract_gate$
declare
  v_expected record;
  v_oid oid;
  v_actual_hash text;
begin
  if (select count(*) from pg_attribute where attrelid=
        'public.hotel_seven_arches_independent_pricing_authority'::regclass
        and attnum>0 and not attisdropped)<>19
     or (select count(*) from pg_constraint where conrelid=
        'public.hotel_seven_arches_independent_pricing_authority'::regclass)<>25
     or (select count(*) from pg_attribute where attrelid=
        'public.hotel_seven_arches_independent_pricing_topology_receipts'::regclass
        and attnum>0 and not attisdropped)<>15
     or (select count(*) from pg_constraint where conrelid=
        'public.hotel_seven_arches_independent_pricing_topology_receipts'::regclass)<>15
     or (select count(*) from pg_attribute where attrelid=
        'public.hotel_seven_arches_independent_pricing_evolution_receipts'::regclass
        and attnum>0 and not attisdropped)<>89
     or (select count(*) from pg_constraint where conrelid=
        'public.hotel_seven_arches_independent_pricing_evolution_receipts'::regclass)<>98 then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_frozen_catalog_drift';
  end if;
  if (select count(*) from pg_attribute where attrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and attnum>0 and not attisdropped)<>10
     or (select count(*) from pg_constraint where conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)<>10
     or (select count(*) from pg_trigger where tgrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and not tgisinternal)<>1
     or not exists(select 1
       from public.hotel_seven_arches_task2_stage2_compatibility_receipts receipt
       where receipt.id=1
         and receipt.scoped_lineage_source_hash is not distinct from
           public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
             'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))) then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_task2_receipt_scope_drift';
  end if;
  for v_expected in select * from (values
    ('public.hotel_v2_seven_arches_independent_pricing_activation_lineage()',
      'aadbec204b2869a66a5c51d99c5c2feb70098e82f9849d1cca57cc2f29590c4b'),
    ('public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()',
      '3fa267946795c33b5c23d987d03926c1e36c0e69e10129bd4d31430c4d3139f5'),
    ('public.hotel_v2_h3_1p_allocation_preview(uuid)',
      '4964aa46351c50156f544dcaba03afae344cf5ef74164164eee5e930b2534e3f'),
    ('public.hotel_v2_seven_arches_independent_pricing_oracle()',
      'a80c25ec1a2d82cd96ff5c30b48ae7402039a90b548504866a12dc67e6cf6d77'),
    ('public.hotel_v2_seven_arches_independent_pricing_legacy_projection()',
      '1d7a7fe016be8d615660a92e5ef911754bc858154e1b909592e4266476a7a57a'),
    ('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
      '38f36103754f4756792fda73f223fccde4b46176c0d031782190a5b567ae11ab'),
    ('public.hotel_v2_external_calendar_protected_fingerprints()',
      'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'),
    ('public.hotel_v2_admin_c_validate_pricing_graph(uuid)',
      '03f787a5e00fbbe65bdcaf1a96529512f60775074a1fdf4dcdd04104c7c7d335'),
    ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
      'f7e76413da69d8e7c36ae82a36ddea8224b8609c994752541383ccd3ee49513f'),
    ('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
      '04462d1fc2ade7d2c4574e7caef96f323cbb98a31d869c6f02e8f09dffe1dda4'),
    ('public.hotel_v2_seven_arches_pricing_activation_snapshot()',
      'c50dd2dbe095bbbbe6bdf5b0e2fe6dd6eeaf405ee371354a263f210b0b81aca9')
  ) expected(signature,source_hash)
  loop
    v_oid:=to_regprocedure(v_expected.signature);
    select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
      into v_actual_hash from pg_proc where oid=v_oid;
    if v_oid is null or v_actual_hash is distinct from v_expected.source_hash then
      raise exception using errcode='55000',
        message='hotels_v2_independent_pricing_frozen_source_drift',
        detail=jsonb_build_object('signature',v_expected.signature,
          'expected',v_expected.source_hash,'actual',v_actual_hash)::text;
    end if;
  end loop;
end
$independent_pricing_frozen_contract_gate$;

do $independent_pricing_evolved_function_metadata_gate$
declare
  v_bad text;
begin
  select expected.signature into v_bad
  from (values
    ('public.hotel_v2_h3_1p_allocation_preview(uuid)',
      'sql','s'::"char",false,array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_admin_c_validate_pricing_graph(uuid)',
      'plpgsql','v'::"char",true,array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
      'plpgsql','s'::"char",true,array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
      'plpgsql','s'::"char",true,array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_pricing_activation_snapshot()',
      'plpgsql','s'::"char",true,array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',
      'plpgsql','s'::"char",true,array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_7a_pricing_activation_transaction_is_preserved()',
      'plpgsql','s'::"char",true,array['search_path=pg_catalog, public']::text[])
  ) expected(signature,language_name,volatility,security_definer,search_path)
  left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
  left join pg_language language_row on language_row.oid=procedure_row.prolang
  where procedure_row.oid is null
    or procedure_row.proowner<>'postgres'::regrole
    or language_row.lanname is distinct from expected.language_name
    or procedure_row.provolatile is distinct from expected.volatility
    or procedure_row.prosecdef is distinct from expected.security_definer
    or procedure_row.proconfig is distinct from expected.search_path
    or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
    or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
    or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
    or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
  limit 1;
  if v_bad is not null then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_evolved_function_metadata_drift',
      detail=v_bad;
  end if;
end
$independent_pricing_evolved_function_metadata_gate$;

create temporary table independent_pricing_topology_positive_results(
  activation_receipt_count integer not null,
  activation_receipt_exact boolean not null,
  activation_current_safe boolean not null,
  pre_topology_task2_compatibility_exact boolean not null,
  scoped_hotels_lineage_exact boolean not null,
  transaction_preservation_exact boolean not null,
  task2_receipt_shape_exact boolean not null,
  task2_receipt_scoped_source_exact boolean not null,
  activation_context_empty boolean not null,
  activation_lineage_exact boolean not null,
  lower_workspace_lineage_exact boolean not null,
  lower_property_attribution_exact boolean not null,
  lower_provider_attribution_exact boolean not null,
  lower_catalog_rows integer not null,
  lower_function_security_rows integer not null,
  admin_d_bridge_exact boolean not null,
  admin_d_foundation_preserved boolean not null,
  admin_d_before_hash text not null,
  admin_d_after_hash text not null,
  admin_d_live_after boolean not null,
  topology_exact boolean not null,
  core_oracle_cases integer not null,
  core_oracle_mismatches integer not null,
  guest_one_oracle_cases integer not null,
  guest_one_oracle_mismatches integer not null,
  total_oracle_cases integer not null,
  parity_cases integer not null,
  parity_mismatches integer not null,
  authority_rows integer not null,
  upper_authority_rows integer not null,
  ground_authority_rows integer not null,
  topology_receipts integer not null,
  evolution_receipts integer not null,
  evolution_receipt_self_hash_valid boolean not null,
  upper_schedule_id uuid not null,
  ground_schedule_id uuid not null,
  independent_schedule_ids_distinct boolean not null,
  upper_schedule_independent boolean not null,
  ground_schedule_independent boolean not null,
  upper_rate_link_exact boolean not null,
  ground_rate_link_exact boolean not null,
  upper_rate_version_before bigint not null,
  upper_rate_version_after bigint not null,
  upper_rate_version_advanced boolean not null,
  upper_rate_updated_at_before timestamptz not null,
  upper_rate_updated_at_after timestamptz not null,
  upper_rate_updated_at_advanced boolean not null,
  ground_rate_version_before bigint not null,
  ground_rate_version_after bigint not null,
  ground_rate_version_advanced boolean not null,
  ground_rate_updated_at_before timestamptz not null,
  ground_rate_updated_at_after timestamptz not null,
  ground_rate_updated_at_advanced boolean not null,
  upper_source_tier_fingerprint text not null,
  upper_target_initial_tier_fingerprint text not null,
  ground_source_tier_fingerprint text not null,
  ground_target_initial_tier_fingerprint text not null,
  initial_fingerprints_equal boolean not null,
  source_target_rates_equal boolean not null,
  commission_preserved boolean not null,
  payment_preserved boolean not null,
  commercial_preserved boolean not null,
  shared_schedule_preserved boolean not null,
  legacy_schedules_preserved boolean not null,
  legacy_tiers_preserved boolean not null,
  room_rate_nonlink_preserved boolean not null,
  protected_projection_preserved boolean not null,
  stage2_projection_exact boolean not null
);

begin;
do $independent_pricing_topology_positive_gate$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_source constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_upper constant uuid:='aec20731-7a56-35f0-334e-92b363351f02';
  c_ground constant uuid:='9d109336-64f3-3c57-4684-968b59c94c3b';
  v_oracle jsonb;
  v_parity jsonb;
  v_snapshot jsonb;
  v_preview jsonb;
  v_commission_fingerprint text;
  v_payment_fingerprint text;
  v_commercial_fingerprint text;
  v_legacy_schedule_fingerprint text;
  v_shared_schedule_fingerprint text;
  v_legacy_tier_fingerprint text;
  v_room_rate_nonlink_fingerprint text;
  v_source_target_equal boolean;
  v_guard_rejected boolean;
  v_guard_message text;
  v_target_tier uuid;
  v_task2 public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_evolution public.hotel_seven_arches_independent_pricing_evolution_receipts%rowtype;
  v_evolution_self_hash_valid boolean;
  v_lineage jsonb;
  v_lineage_exact boolean;
  v_lower_catalog_rows integer;
  v_lower_function_security_rows integer;
  v_admin_d_bridge_exact boolean;
  v_admin_d_foundation_preserved boolean;
  v_admin_d_current jsonb;
  v_scoped_lineage jsonb;
begin
  if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_topology_not_safe';
  end if;
  perform public.hotel_v2_admin_c_validate_pricing_graph(c_hotel);

  v_oracle:=public.hotel_v2_seven_arches_independent_pricing_oracle();
  v_parity:=public.hotel_v2_h3_1p_parity_snapshot(c_hotel);
  select * into strict v_task2
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  select * into strict v_evolution
  from public.hotel_seven_arches_independent_pricing_evolution_receipts where id=1;
  v_admin_d_current:=public.hotel_v2_admin_d_current_foundation_snapshot();
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_lineage:=public.hotel_v2_seven_arches_independent_pricing_activation_lineage();
  v_lower_catalog_rows:=case when jsonb_typeof(v_lineage->'lower_catalog')='array'
    then jsonb_array_length(v_lineage->'lower_catalog') else -1 end;
  v_lower_function_security_rows:=case
    when jsonb_typeof(v_lineage->'lower_function_security')='array'
    then jsonb_array_length(v_lineage->'lower_function_security') else -1 end;
  v_lineage_exact:=case
    when jsonb_typeof(v_lineage) is distinct from 'object'
      or jsonb_typeof(v_lineage->'lower_catalog') is distinct from 'array'
      or jsonb_typeof(v_lineage->'lower_schema_security') is distinct from 'object'
      or jsonb_typeof(v_lineage->'lower_function_security') is distinct from 'array'
      or jsonb_typeof(v_lineage->'lower_function_sources') is distinct from 'object'
    then false
    else v_lineage is not distinct from v_evolution.historical_activation_lineage
      and v_evolution.historical_activation_lineage_fingerprint is not distinct from
        public.hotel_v2_h3_2b_hash(v_lineage)
      and v_evolution.historical_activation_lineage_source_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'::regprocedure)))
      and v_lineage->>'contract_version' is not distinct from
        'hotels_v2_seven_arches_independent_pricing_activation_lineage_v1'
      and v_lineage->>'workspace_lineage_exact' is not distinct from 'true'
      and v_lineage->>'property_attribution_exact' is not distinct from 'true'
      and v_lineage->>'scoped_hotels_lineage_exact' is not distinct from 'true'
      and v_lineage->>'scoped_hotels_lineage_source_hash' is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
      and v_lineage->>'transaction_preservation_exact' is not distinct from 'true'
      and v_lineage->>'transaction_preservation_source_hash' is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)))
      and v_lineage->>'provider_attribution_exact' is not distinct from 'true'
      and v_lineage->>'activation_context_empty' is not distinct from 'true'
      and v_lower_catalog_rows=17
      and v_lower_function_security_rows=22
    end;
  v_admin_d_bridge_exact:=coalesce(
    jsonb_typeof(v_evolution.admin_d_protected_fingerprints_before)='object'
    and jsonb_typeof(v_evolution.admin_d_protected_fingerprints_after)='object'
    and v_evolution.admin_d_protected_fingerprint_before is not distinct from
      public.hotel_v2_h3_2b_hash(v_evolution.admin_d_protected_fingerprints_before)
    and v_evolution.admin_d_protected_fingerprint_after is not distinct from
      public.hotel_v2_h3_2b_hash(v_evolution.admin_d_protected_fingerprints_after)
    and v_evolution.admin_d_allowed_protected_keys is not distinct from array[
      'hotel_room_rates','hotel_pricing_schedules',
      'hotel_pricing_schedule_occupancy_tiers']::text[]
    and v_evolution.admin_d_protected_fingerprints_before is not distinct from
      (select admin_d_protected_fingerprints from independent_pricing_topology_gate_before)
    and (v_evolution.admin_d_protected_fingerprints_after-
      v_evolution.admin_d_allowed_protected_keys) is not distinct from
      (v_evolution.admin_d_protected_fingerprints_before-
      v_evolution.admin_d_allowed_protected_keys)
    and not exists(select 1
      from unnest(v_evolution.admin_d_allowed_protected_keys) changed(key)
      where v_evolution.admin_d_protected_fingerprints_before->changed.key is null
        or v_evolution.admin_d_protected_fingerprints_after->changed.key is null
        or v_evolution.admin_d_protected_fingerprints_before->changed.key
          is not distinct from v_evolution.admin_d_protected_fingerprints_after->changed.key)
    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
      is true
    and jsonb_typeof(v_scoped_lineage)='object',false);
  v_admin_d_foundation_preserved:=coalesce(
    v_admin_d_current->>'contract_version'=
      'hotels_v2_admin_d_current_foundation_v1'
    and (v_admin_d_current-array[
      'stage2_current_protected_fingerprint','stage2_current_protected_fingerprints',
      'current_matches_latest','stage2_current_matches_latest',
      'seven_arches_target_foundation_exact','safe']::text[])
      is not distinct from
      ((select admin_d_foundation_snapshot
        from independent_pricing_topology_gate_before)-array[
          'stage2_current_protected_fingerprint','stage2_current_protected_fingerprints',
          'current_matches_latest','stage2_current_matches_latest',
          'seven_arches_target_foundation_exact','safe']::text[]),false);
  v_evolution_self_hash_valid:=v_evolution.receipt_fingerprint is not distinct from
    public.hotel_v2_h3_2b_hash(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
      to_jsonb(v_evolution)-'receipt_fingerprint',
      '{created_at}',to_jsonb((extract(epoch from v_evolution.created_at)*1000000)::bigint),false),
      '{upper_rate_updated_at_before}',
        to_jsonb((extract(epoch from v_evolution.upper_rate_updated_at_before)*1000000)::bigint),false),
      '{upper_rate_updated_at_after}',
        to_jsonb((extract(epoch from v_evolution.upper_rate_updated_at_after)*1000000)::bigint),false),
      '{ground_rate_updated_at_before}',
        to_jsonb((extract(epoch from v_evolution.ground_rate_updated_at_before)*1000000)::bigint),false),
      '{ground_rate_updated_at_after}',
        to_jsonb((extract(epoch from v_evolution.ground_rate_updated_at_after)*1000000)::bigint),false));
  if jsonb_typeof(v_oracle) is distinct from 'object'
     or (v_oracle->>'contract_version') is distinct from
       'hotels_v2_seven_arches_independent_pricing_oracle_v1'
     or not (v_oracle ?& array['core_case_count','core_mismatch_count',
       'guest_one_case_count','guest_one_mismatch_count','total_case_count','fingerprint'])
     or not (pg_input_is_valid(v_oracle->>'core_case_count','integer')
       and pg_input_is_valid(v_oracle->>'core_mismatch_count','integer')
       and pg_input_is_valid(v_oracle->>'guest_one_case_count','integer')
       and pg_input_is_valid(v_oracle->>'guest_one_mismatch_count','integer')
       and pg_input_is_valid(v_oracle->>'total_case_count','integer'))
     or (v_oracle->>'core_case_count')::integer is distinct from 100
     or (v_oracle->>'core_mismatch_count')::integer is distinct from 0
     or (v_oracle->>'guest_one_case_count')::integer is distinct from 20
     or (v_oracle->>'guest_one_mismatch_count')::integer is distinct from 0
     or (v_oracle->>'total_case_count')::integer is distinct from 120
     or not (pg_input_is_valid(v_parity->>'total_case_count','integer')
       and pg_input_is_valid(v_parity->>'total_mismatch_count','integer'))
     or (v_parity->>'total_case_count')::integer is distinct from 70
     or (v_parity->>'total_mismatch_count')::integer is distinct from 0 then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_oracle_or_parity_invalid',
      detail=jsonb_build_object('oracle',v_oracle,'parity',v_parity)::text;
  end if;

  if (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_independent_pricing_authority)<>54
     or (select count(*) from public.hotel_seven_arches_independent_pricing_topology_receipts)<>2
     or (select count(*) from public.hotel_seven_arches_independent_pricing_evolution_receipts)<>1
     or (select count(*)
       from public.hotel_seven_arches_pricing_activation_transaction_context)<>0
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
       where schedule_id in(c_upper,c_ground))<>54
     or (select count(distinct (room_key,guest_count,threshold_nights))
       from public.hotel_seven_arches_independent_pricing_authority)<>54
     or (select count(*) from public.hotel_seven_arches_independent_pricing_authority
       where room_key='upper')<>27
     or (select count(*) from public.hotel_seven_arches_independent_pricing_authority
       where room_key='ground')<>27
     or (select count(*) from public.hotel_seven_arches_independent_pricing_authority
       where guest_count between 2 and 4 and threshold_nights between 2 and 10)<>54
     or exists(select 1 from public.hotel_seven_arches_independent_pricing_authority authority
       join public.hotel_pricing_schedule_occupancy_tiers source
         on source.id=authority.source_tier_id
       join public.hotel_pricing_schedule_occupancy_tiers target
         on target.id=authority.target_tier_id
       where source.schedule_id is distinct from c_source
         or target.schedule_id is distinct from authority.independent_schedule_id
         or source.nightly_rate is distinct from target.nightly_rate
         or target.nightly_rate is distinct from authority.initial_nightly_rate)
     or not exists(select 1 from public.hotel_room_rates where
       id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
       and pricing_schedule_id=c_upper)
     or not exists(select 1 from public.hotel_room_rates where
       id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
       and pricing_schedule_id=c_ground)
     or not exists(select 1 from public.hotel_seven_arches_independent_pricing_topology_receipts
       where room_key='upper' and independent_schedule_id=c_upper
         and source_tier_fingerprint=target_initial_tier_fingerprint)
     or not exists(select 1 from public.hotel_seven_arches_independent_pricing_topology_receipts
       where room_key='ground' and independent_schedule_id=c_ground
         and source_tier_fingerprint=target_initial_tier_fingerprint)
     or not exists(select 1 from public.hotel_pricing_schedules
       where id=c_upper and sharing_mode='independent')
     or not exists(select 1 from public.hotel_pricing_schedules
       where id=c_ground and sharing_mode='independent')
     or v_lineage_exact is not true
     or jsonb_typeof(v_scoped_lineage) is distinct from 'object'
     or v_scoped_lineage->>'contract_version' is distinct from
       'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
     or (select count(*) from jsonb_object_keys(v_scoped_lineage))<>21
     or v_scoped_lineage->>'hotel_id' is distinct from
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
     or v_scoped_lineage->>'allocation_contract_exact' is distinct from 'true'
     or v_scoped_lineage->>'parity_case_count' is distinct from '70'
     or v_scoped_lineage->>'parity_mismatch_count' is distinct from '0'
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true
     or (select count(*) from pg_attribute where attrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and attnum>0 and not attisdropped)<>10
     or v_task2.scoped_lineage_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
     or public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true
     or public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
       is not true
     or public.hotel_v2_external_calendar_provider_sources_are_attributable()
       is not true
     or v_admin_d_bridge_exact is not true
     or v_admin_d_foundation_preserved is not true
     or v_evolution.upper_rate_version_before is distinct from
       (select upper_rate_version from independent_pricing_topology_gate_before)
     or v_evolution.upper_rate_version_after is distinct from
       v_evolution.upper_rate_version_before+1
     or v_evolution.upper_rate_updated_at_before is distinct from
       (select upper_rate_updated_at from independent_pricing_topology_gate_before)
     or v_evolution.upper_rate_updated_at_after<=v_evolution.upper_rate_updated_at_before
     or v_evolution.ground_rate_version_before is distinct from
       (select ground_rate_version from independent_pricing_topology_gate_before)
     or v_evolution.ground_rate_version_after is distinct from
       v_evolution.ground_rate_version_before+1
     or v_evolution.ground_rate_updated_at_before is distinct from
       (select ground_rate_updated_at from independent_pricing_topology_gate_before)
     or v_evolution.ground_rate_updated_at_after<=v_evolution.ground_rate_updated_at_before
     or not exists(select 1 from public.hotel_room_rates rate
       where rate.id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
         and rate.version=v_evolution.upper_rate_version_after
         and rate.updated_at=v_evolution.upper_rate_updated_at_after)
     or not exists(select 1 from public.hotel_room_rates rate
       where rate.id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
         and rate.version=v_evolution.ground_rate_version_after
         and rate.updated_at=v_evolution.ground_rate_updated_at_after)
     or v_evolution_self_hash_valid is not true then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_topology_shape_invalid';
  end if;

  select not exists(select 1
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers source on source.id=authority.source_tier_id
    join public.hotel_pricing_schedule_occupancy_tiers target on target.id=authority.target_tier_id
    where source.nightly_rate is distinct from target.nightly_rate
      or target.nightly_rate is distinct from authority.initial_nightly_rate)
  into v_source_target_equal;

  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(policy)-array['created_at','updated_at'] order by policy.id),
    '[]'::jsonb)) into v_commission_fingerprint
  from public.hotel_commission_policies policy where policy.hotel_id=c_hotel;
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'policies',coalesce((select jsonb_agg(
      to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
      from public.hotel_payment_policies policy where policy.hotel_id=c_hotel),'[]'::jsonb),
    'terms',coalesce((select jsonb_agg(
      to_jsonb(term)-array['created_at','updated_at'] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
      where policy.hotel_id=c_hotel),'[]'::jsonb))) into v_payment_fingerprint;
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'rate_plans',coalesce((select jsonb_agg(
      to_jsonb(plan)-array['created_at','updated_at'] order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=c_hotel),'[]'::jsonb),
    'rate_rules',coalesce((select jsonb_agg(
      to_jsonb(rule)-array['created_at','updated_at'] order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate
        on rate.id=rule.room_rate_id where rate.hotel_id=c_hotel),'[]'::jsonb),
    'allocation_rules',coalesce((select jsonb_agg(
      to_jsonb(rule)-array['created_at','updated_at'] order by rule.id)
      from public.hotel_room_allocation_rules rule where rule.hotel_id=c_hotel),'[]'::jsonb),
    'allocation_items',coalesce((select jsonb_agg(
      to_jsonb(item)-array['created_at','updated_at'] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
      where rule.hotel_id=c_hotel),'[]'::jsonb))) into v_commercial_fingerprint;
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(schedule)-array['created_at','updated_at'] order by schedule.id),
    '[]'::jsonb)) into v_legacy_schedule_fingerprint
  from public.hotel_pricing_schedules schedule where schedule.id in(c_source,
    '443065c0-984a-5de3-a22a-d03042c41107'::uuid);
  select public.hotel_v2_h3_2b_hash(
    to_jsonb(schedule)-array['created_at','updated_at'])
  into v_shared_schedule_fingerprint
  from public.hotel_pricing_schedules schedule where schedule.id=c_source;
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(tier)-array['created_at','updated_at'] order by tier.id),
    '[]'::jsonb)) into v_legacy_tier_fingerprint
  from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id in(c_source,
    '443065c0-984a-5de3-a22a-d03042c41107'::uuid);
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(rate)-array['pricing_schedule_id','version','created_at','updated_at']
    order by rate.id),
    '[]'::jsonb)) into v_room_rate_nonlink_fingerprint
  from public.hotel_room_rates rate where rate.id in(
    '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
    '3320590d-632d-423f-80d0-fd021cba7293'::uuid);

  if v_commission_fingerprint is distinct from
       (select commission_fingerprint from independent_pricing_topology_gate_before)
     or v_payment_fingerprint is distinct from
       (select payment_fingerprint from independent_pricing_topology_gate_before)
     or v_commercial_fingerprint is distinct from
       (select commercial_fingerprint from independent_pricing_topology_gate_before)
     or v_legacy_schedule_fingerprint is distinct from
       (select legacy_schedule_fingerprint from independent_pricing_topology_gate_before)
     or v_shared_schedule_fingerprint is distinct from
       (select shared_schedule_fingerprint from independent_pricing_topology_gate_before)
     or v_legacy_tier_fingerprint is distinct from
       (select legacy_tier_fingerprint from independent_pricing_topology_gate_before)
     or v_room_rate_nonlink_fingerprint is distinct from
       (select room_rate_nonlink_fingerprint from independent_pricing_topology_gate_before)
     or public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(receipt) order by receipt.id)
       from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt),'[]'::jsonb))
       is distinct from (select activation_receipt_fingerprint
         from independent_pricing_topology_gate_before)
     or public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
       is distinct from (select protected_fingerprints
         from independent_pricing_topology_gate_before)
     or v_evolution.before_stage2_fingerprints is distinct from
       (select stage2_fingerprints from independent_pricing_topology_gate_before)
     or public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
       is distinct from v_evolution.after_stage2_fingerprints
     or v_admin_d_foundation_preserved is not true
     or not exists(select 1 from public.hotel_commission_policies where hotel_id=c_hotel
       and commission_mode='per_allocated_room_per_night' and amount=10.00
       and btrim(currency::text)='EUR' and is_active and review_status='reviewed') then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_preservation_invalid';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_snapshot:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
  if v_snapshot->>'status' is distinct from 'active'
     or v_snapshot->>'pricing_authority' is distinct from 'independent_room_schedules' then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_admin_snapshot_invalid',detail=v_snapshot::text;
  end if;
  v_preview:=public.hotel_v2_admin_preview_seven_arches_pricing_activation(
    jsonb_build_object(
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
      'reason','Topology-aware activation no-op'));
  reset role;
  if v_preview->>'changed' is distinct from 'false'
     or v_preview->'reviewed_plan' is distinct from 'null'::jsonb then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_activation_preview_not_noop',
      detail=v_preview::text;
  end if;

  select target_tier_id into strict v_target_tier
  from public.hotel_seven_arches_independent_pricing_authority
  order by target_tier_id limit 1;
  v_guard_rejected:=false;
  begin
    update public.hotel_pricing_schedule_occupancy_tiers
      set nightly_rate=nightly_rate+1 where id=v_target_tier;
  exception when sqlstate '55000' then
    get stacked diagnostics v_guard_message=message_text;
    v_guard_rejected:=v_guard_message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end;
  if v_guard_rejected is not true then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_direct_tier_write_allowed';
  end if;
  v_guard_rejected:=false;
  begin
    update public.hotel_seven_arches_independent_pricing_evolution_receipts
      set contract_version=contract_version where id=1;
  exception when sqlstate '55000' then
    get stacked diagnostics v_guard_message=message_text;
    v_guard_rejected:=v_guard_message='hotels_v2_seven_arches_pricing_activation_immutable';
  end;
  if v_guard_rejected is not true then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_receipt_write_allowed';
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_guard_rejected:=false;
  begin
    perform * from public.hotel_seven_arches_independent_pricing_authority;
  exception when sqlstate '42501' then
    get stacked diagnostics v_guard_message=message_text;
    v_guard_rejected:=position('permission denied' in lower(v_guard_message))>0;
  end;
  reset role;
  if v_guard_rejected is not true then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_raw_authority_read_allowed';
  end if;

  insert into independent_pricing_topology_positive_results
  select
    (select count(*)::integer from public.hotel_seven_arches_pricing_activation_evolution_receipts),
    public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact(),
    public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
    (select task2_compatibility_exact from independent_pricing_topology_gate_before),
    jsonb_typeof(v_scoped_lineage)='object'
      and v_scoped_lineage->>'contract_version'=
        'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
      and v_scoped_lineage->>'hotel_id'=
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      and v_scoped_lineage->>'allocation_contract_exact'='true'
      and v_scoped_lineage->>'parity_case_count'='70'
      and v_scoped_lineage->>'parity_mismatch_count'='0',
    public.hotel_v2_7a_pricing_activation_transaction_is_preserved(),
    (select count(*) from pg_attribute where attrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and attnum>0 and not attisdropped)=10
      and (select count(*) from pg_constraint where conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)=10,
    v_task2.scoped_lineage_source_hash is not distinct from
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure))),
    not exists(select 1
      from public.hotel_seven_arches_pricing_activation_transaction_context),
    v_lineage_exact,
    public.hotel_v2_partner_workspace_function_lineage_is_exact(),
    public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable(),
    public.hotel_v2_external_calendar_provider_sources_are_attributable(),
    v_lower_catalog_rows,v_lower_function_security_rows,
    v_admin_d_bridge_exact,
    v_admin_d_foundation_preserved,
    v_evolution.admin_d_protected_fingerprint_before,
    v_evolution.admin_d_protected_fingerprint_after,
    public.hotel_v2_admin_d_protected_fingerprints() is not distinct from
      v_evolution.admin_d_protected_fingerprints_after,
    public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
    (v_oracle->>'core_case_count')::integer,(v_oracle->>'core_mismatch_count')::integer,
    (v_oracle->>'guest_one_case_count')::integer,
    (v_oracle->>'guest_one_mismatch_count')::integer,
    (v_oracle->>'total_case_count')::integer,
    (v_parity->>'total_case_count')::integer,(v_parity->>'total_mismatch_count')::integer,
    (select count(*)::integer from public.hotel_seven_arches_independent_pricing_authority),
    (select count(*)::integer from public.hotel_seven_arches_independent_pricing_authority
      where room_key='upper'),
    (select count(*)::integer from public.hotel_seven_arches_independent_pricing_authority
      where room_key='ground'),
    (select count(*)::integer from public.hotel_seven_arches_independent_pricing_topology_receipts),
    (select count(*)::integer from public.hotel_seven_arches_independent_pricing_evolution_receipts),
    v_evolution_self_hash_valid,
    c_upper,c_ground,c_upper is distinct from c_ground,
    (select sharing_mode='independent' from public.hotel_pricing_schedules where id=c_upper),
    (select sharing_mode='independent' from public.hotel_pricing_schedules where id=c_ground),
    exists(select 1 from public.hotel_room_rates where
      id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid and pricing_schedule_id=c_upper),
    exists(select 1 from public.hotel_room_rates where
      id='3320590d-632d-423f-80d0-fd021cba7293'::uuid and pricing_schedule_id=c_ground),
    v_evolution.upper_rate_version_before,v_evolution.upper_rate_version_after,
    v_evolution.upper_rate_version_after=v_evolution.upper_rate_version_before+1,
    v_evolution.upper_rate_updated_at_before,v_evolution.upper_rate_updated_at_after,
    v_evolution.upper_rate_updated_at_after>v_evolution.upper_rate_updated_at_before,
    v_evolution.ground_rate_version_before,v_evolution.ground_rate_version_after,
    v_evolution.ground_rate_version_after=v_evolution.ground_rate_version_before+1,
    v_evolution.ground_rate_updated_at_before,v_evolution.ground_rate_updated_at_after,
    v_evolution.ground_rate_updated_at_after>v_evolution.ground_rate_updated_at_before,
    (select source_tier_fingerprint
      from public.hotel_seven_arches_independent_pricing_topology_receipts where room_key='upper'),
    (select target_initial_tier_fingerprint
      from public.hotel_seven_arches_independent_pricing_topology_receipts where room_key='upper'),
    (select source_tier_fingerprint
      from public.hotel_seven_arches_independent_pricing_topology_receipts where room_key='ground'),
    (select target_initial_tier_fingerprint
      from public.hotel_seven_arches_independent_pricing_topology_receipts where room_key='ground'),
    not exists(select 1 from public.hotel_seven_arches_independent_pricing_topology_receipts
      where source_tier_fingerprint is distinct from target_initial_tier_fingerprint),
    v_source_target_equal,
    v_commission_fingerprint is not distinct from
      (select commission_fingerprint from independent_pricing_topology_gate_before),
    v_payment_fingerprint is not distinct from
      (select payment_fingerprint from independent_pricing_topology_gate_before),
    v_commercial_fingerprint is not distinct from
      (select commercial_fingerprint from independent_pricing_topology_gate_before),
    v_shared_schedule_fingerprint is not distinct from
      (select shared_schedule_fingerprint from independent_pricing_topology_gate_before),
    v_legacy_schedule_fingerprint is not distinct from
      (select legacy_schedule_fingerprint from independent_pricing_topology_gate_before),
    v_legacy_tier_fingerprint is not distinct from
      (select legacy_tier_fingerprint from independent_pricing_topology_gate_before),
    v_room_rate_nonlink_fingerprint is not distinct from
      (select room_rate_nonlink_fingerprint from independent_pricing_topology_gate_before),
    public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
      is not distinct from (select protected_fingerprints
        from independent_pricing_topology_gate_before),
    v_evolution.before_stage2_fingerprints is not distinct from
      (select stage2_fingerprints from independent_pricing_topology_gate_before)
      and public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
        is not distinct from v_evolution.after_stage2_fingerprints;
end
$independent_pricing_topology_positive_gate$;
commit;

create function pg_temp.independent_pricing_gate_state()
returns jsonb language sql stable security invoker
set search_path=pg_catalog,public,pg_temp
as $function$
select jsonb_build_object(
  'authority',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.target_tier_id)
    from public.hotel_seven_arches_independent_pricing_authority row_value),'[]'::jsonb)),
  'topology_receipts',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.room_key)
    from public.hotel_seven_arches_independent_pricing_topology_receipts row_value),'[]'::jsonb)),
  'evolution_receipts',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id)
    from public.hotel_seven_arches_independent_pricing_evolution_receipts row_value),'[]'::jsonb)),
  'activation_receipts',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id)
    from public.hotel_seven_arches_pricing_activation_evolution_receipts row_value),'[]'::jsonb)),
  'activation_reviews',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id)
    from public.hotel_seven_arches_pricing_activation_reviews row_value),'[]'::jsonb)),
  'activation_context',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.backend_pid)
    from public.hotel_seven_arches_pricing_activation_transaction_context row_value),'[]'::jsonb)),
  'admin_pricing_receipts',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id)
    from public.hotel_admin_pricing_action_receipts row_value),'[]'::jsonb)),
  'activity',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id) from public.hotel_activity_log row_value),'[]'::jsonb)),
  'schedules',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id) from public.hotel_pricing_schedules row_value
    where row_value.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)),
  'tiers',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(tier)
    order by tier.id) from public.hotel_pricing_schedule_occupancy_tiers tier
    join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
    where schedule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)),
  'room_rates',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id) from public.hotel_room_rates row_value
    where row_value.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)),
  'rate_plans',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id) from public.hotel_rate_plans row_value
    where row_value.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)),
  'commission',public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(to_jsonb(row_value)
    order by row_value.id) from public.hotel_commission_policies row_value
    where row_value.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)),
  'payment',public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'policies',coalesce((select jsonb_agg(to_jsonb(policy) order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'terms',coalesce((select jsonb_agg(to_jsonb(term) order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
      where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb))),
  'admin_d',public.hotel_v2_admin_d_protected_fingerprints(),
  'activation_lineage',public.hotel_v2_seven_arches_independent_pricing_activation_lineage(),
  'scoped_hotels_lineage',public.hotel_v2_seven_arches_pricing_scoped_lineage(),
  'transaction_preservation_exact',
    public.hotel_v2_7a_pricing_activation_transaction_is_preserved(),
  'protected',public.hotel_v2_seven_arches_property_proposal_protected_fingerprints(),
  'stage2',public.hotel_v2_external_calendar_stage2_compatible_fingerprints(),
  'oracle',public.hotel_v2_seven_arches_independent_pricing_oracle(),
  'catalog',public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint());
$function$;

create temporary table independent_pricing_topology_gate_baseline as
select public.hotel_v2_h3_2b_hash(pg_temp.independent_pricing_gate_state()) state_fingerprint;

create temporary table independent_pricing_site_settings_tolerance_results(
  label text primary key,
  raw_fingerprint_changed boolean not null,
  canonical_fingerprint_exact boolean not null,
  accepted boolean not null,
  restored boolean not null
);

create function pg_temp.run_independent_pricing_site_settings_tolerance(p_label text)
returns void language plpgsql volatile security invoker
set search_path=pg_catalog,public,pg_temp
as $function$
declare
  c_canonical constant text:=
    '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5';
  v_expected_message text:='independent_pricing_site_settings_rollback:'||p_label;
  v_message text;
  v_before_state text:=public.hotel_v2_h3_2b_hash(
    pg_temp.independent_pricing_gate_state());
  v_before_raw text;
  v_after_raw text;
  v_before_property jsonb:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_before_stage2 jsonb:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_property jsonb;
  v_stage2 jsonb;
  v_projection jsonb;
  v_canonical jsonb;
  v_successor jsonb;
begin
  v_before_raw:=md5(pg_catalog.query_to_xml($query$
    select to_jsonb(row_value)::text
    from public.site_settings row_value
    order by to_jsonb(row_value)::text$query$,true,true,'')::text);
  begin
    perform set_config('session_replication_role','replica',true);
    case p_label
      when 'force_refresh_version' then
        if not exists(select 1 from pg_attribute where
          attrelid='public.site_settings'::regclass and attname='force_refresh_version'
          and attnum>0 and not attisdropped) then
          execute 'alter table public.site_settings add column '
            'force_refresh_version bigint not null default 0';
        end if;
        execute 'update public.site_settings '
          'set force_refresh_version=force_refresh_version+1 where id=1';
      when 'updated_at_updated_by' then
        if not exists(select 1 from pg_attribute where
          attrelid='public.site_settings'::regclass and attname='updated_at'
          and attnum>0 and not attisdropped) then
          execute 'alter table public.site_settings add column updated_at '
            'timestamptz not null default to_timestamp(0)';
        end if;
        if not exists(select 1 from pg_attribute where
          attrelid='public.site_settings'::regclass and attname='updated_by'
          and attnum>0 and not attisdropped) then
          execute 'alter table public.site_settings add column updated_by uuid';
        end if;
        execute 'update public.site_settings set updated_at=clock_timestamp(),'
          'updated_by=''10000000-0000-4000-8000-000000000099''::uuid where id=1';
      when 'unrelated_car_flags' then
        if not exists(select 1 from pg_attribute where
          attrelid='public.site_settings'::regclass
          and attname='car_multi_city_mapped_enabled'
          and attnum>0 and not attisdropped) then
          execute 'alter table public.site_settings add column '
            'car_multi_city_mapped_enabled boolean not null default false';
        end if;
        if not exists(select 1 from pg_attribute where
          attrelid='public.site_settings'::regclass
          and attname='car_threshold_daily_rates_enabled'
          and attnum>0 and not attisdropped) then
          execute 'alter table public.site_settings add column '
            'car_threshold_daily_rates_enabled boolean not null default false';
        end if;
        -- Toggle the unrelated flags so this probe changes the raw row both
        -- from the legacy all-false fixture and from the production-shaped
        -- owner-drift fixture where they are already true.
        execute 'update public.site_settings set '
          'car_multi_city_mapped_enabled=not car_multi_city_mapped_enabled,'
          'car_threshold_daily_rates_enabled=not car_threshold_daily_rates_enabled '
          'where id=1';
      else
        raise exception using errcode='22023',
          message='independent_pricing_site_settings_case_invalid';
    end case;
    v_after_raw:=md5(pg_catalog.query_to_xml($query$
      select to_jsonb(row_value)::text
      from public.site_settings row_value
      order by to_jsonb(row_value)::text$query$,true,true,'')::text);
    v_property:=public.hotel_v2_h3_2b_protected_fingerprints();
    v_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
    v_projection:=public.hotel_v2_seven_arches_property_proposal_protected_fingerprints();
    v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
    v_successor:=public.hotel_v2_seven_arches_independent_pricing_legacy_projection();
    if v_after_raw is not distinct from v_before_raw
       or v_property->'site_settings' is distinct from to_jsonb(v_after_raw)
       or v_stage2->'site_settings' is distinct from to_jsonb(v_after_raw)
       or v_projection->'site_settings' is distinct from to_jsonb(v_after_raw)
       or (v_property-'site_settings') is distinct from
         (v_before_property-'site_settings')
       or (v_stage2-'site_settings') is distinct from
         (v_before_stage2-'site_settings')
       or jsonb_typeof(v_canonical) is distinct from 'object'
       or v_canonical->>'site_settings_lifecycle_fingerprint' is distinct from c_canonical
       or v_canonical#>'{task2_protected_fingerprints,site_settings}'
         is distinct from to_jsonb(c_canonical)
       or v_canonical#>'{stage2_protected_fingerprints,site_settings}'
         is distinct from to_jsonb(c_canonical)
       or jsonb_typeof(v_successor) is distinct from 'object'
       or v_successor->>'site_settings_raw_fingerprint' is distinct from v_after_raw
       or v_successor->>'site_settings_lifecycle_fingerprint' is distinct from c_canonical
       or jsonb_typeof(public.hotel_v2_seven_arches_pricing_scoped_lineage())
         is distinct from 'object'
       or public.hotel_v2_seven_arches_pricing_scoped_lineage()->>
         'site_settings_lifecycle_fingerprint' is distinct from c_canonical
       or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
         is not true
       or public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
         is not true
       or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
       or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
       or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true then
      raise exception using errcode='P0002',
        message='independent_pricing_site_settings_not_accepted:'||p_label;
    end if;
    raise exception using errcode='P0001',message=v_expected_message;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_message=message_text;
    if v_message is distinct from v_expected_message then
      raise;
    end if;
  end;
  perform set_config('session_replication_role','origin',true);
  if public.hotel_v2_h3_2b_hash(pg_temp.independent_pricing_gate_state())
       is distinct from v_before_state
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true then
    raise exception using errcode='55000',
      message='independent_pricing_site_settings_not_restored:'||p_label;
  end if;
  insert into independent_pricing_site_settings_tolerance_results
  values(p_label,true,true,true,true);
end
$function$;

select pg_temp.run_independent_pricing_site_settings_tolerance('force_refresh_version');
select pg_temp.run_independent_pricing_site_settings_tolerance('updated_at_updated_by');
select pg_temp.run_independent_pricing_site_settings_tolerance('unrelated_car_flags');

create temporary table independent_pricing_topology_negative_results(
  label text primary key,
  rejected boolean not null,
  restored boolean not null
);

create function pg_temp.run_independent_pricing_negative(
  p_label text,
  p_mutation_sql text,
  p_drop_specs jsonb default '[]'::jsonb)
returns void language plpgsql volatile security invoker
set search_path=pg_catalog,public,pg_temp
as $function$
declare
  v_spec jsonb;
  v_relation regclass;
  v_contype "char";
  v_conkey smallint[];
  v_names text[];
  v_message text;
  v_expected_message text:='independent_pricing_negative_rollback:'||p_label;
begin
  if p_label is null or btrim(p_label)=''
     or p_mutation_sql is null or btrim(p_mutation_sql)='' then
    raise exception using errcode='22023',
      message='independent_pricing_negative_argument_invalid';
  end if;
  begin
    perform set_config('session_replication_role','replica',true);
    for v_spec in select value from jsonb_array_elements(coalesce(p_drop_specs,'[]'::jsonb))
    loop
      if jsonb_typeof(v_spec) is distinct from 'object'
         or not (v_spec ?& array['relation','contype','conkey'])
         or jsonb_typeof(v_spec->'conkey') is distinct from 'array' then
        raise exception using errcode='22023',
          message='independent_pricing_negative_drop_spec_invalid',detail=v_spec::text;
      end if;
      v_relation:=(v_spec->>'relation')::regclass;
      v_contype:=(v_spec->>'contype')::"char";
      select array_agg(value::smallint order by ordinality) into v_conkey
      from jsonb_array_elements_text(v_spec->'conkey') with ordinality item(value,ordinality);
      select array_agg(constraint_row.conname order by constraint_row.conname) into v_names
      from pg_constraint constraint_row
      where constraint_row.conrelid=v_relation
        and constraint_row.contype=v_contype
        and constraint_row.conkey=v_conkey;
      if cardinality(v_names) is distinct from 1 then
        raise exception using errcode='55000',
          message='independent_pricing_negative_constraint_scope_invalid',
          detail=jsonb_build_object('label',p_label,'relation',v_relation::text,
            'contype',v_contype::text,'conkey',v_conkey,'matches',v_names)::text;
      end if;
      execute format('alter table %s drop constraint %I',v_relation,v_names[1]);
    end loop;
    execute p_mutation_sql;
    if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
         is distinct from false
       or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
         is distinct from false
       or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
         is distinct from false then
      raise exception using errcode='P0002',
        message='independent_pricing_negative_not_rejected:'||p_label;
    end if;
    raise exception using errcode='P0001',message=v_expected_message;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_message=message_text;
    if v_message is distinct from v_expected_message then
      raise;
    end if;
  end;
  if public.hotel_v2_h3_2b_hash(pg_temp.independent_pricing_gate_state())
       is distinct from (select state_fingerprint
         from independent_pricing_topology_gate_baseline)
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true
     or jsonb_typeof(public.hotel_v2_seven_arches_pricing_scoped_lineage())
       is distinct from 'object' then
    raise exception using errcode='55000',
      message='independent_pricing_negative_not_restored:'||p_label;
  end if;
  insert into independent_pricing_topology_negative_results values(p_label,true,true);
end
$function$;

select pg_temp.run_independent_pricing_negative(
  'wrong_hotel',
  $sql$update public.hotel_seven_arches_independent_pricing_authority
    set hotel_id='c1000000-0000-4000-8000-000000000001'::uuid
    where target_tier_id=(select target_tier_id
      from public.hotel_seven_arches_independent_pricing_authority
      order by target_tier_id limit 1)$sql$,
  '[{"relation":"public.hotel_seven_arches_independent_pricing_authority",
     "contype":"c","conkey":[4]}]'::jsonb);

select pg_temp.run_independent_pricing_negative(
  'wrong_room_identity',
  $sql$update public.hotel_seven_arches_independent_pricing_authority
    set room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
    where room_key='upper' and guest_count=2 and threshold_nights=2$sql$,
  '[{"relation":"public.hotel_seven_arches_independent_pricing_authority",
     "contype":"c","conkey":[3,5,6,11]}]'::jsonb);

select pg_temp.run_independent_pricing_negative(
  'wrong_room_rate',
  $sql$update public.hotel_seven_arches_independent_pricing_authority
    set room_rate_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
    where room_key='upper' and guest_count=2 and threshold_nights=2$sql$,
  '[{"relation":"public.hotel_seven_arches_independent_pricing_authority",
     "contype":"c","conkey":[3,5,6,11]}]'::jsonb);

select pg_temp.run_independent_pricing_negative(
  'shared_schedule_missing',
  $sql$delete from public.hotel_pricing_schedules
    where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid$sql$);

select pg_temp.run_independent_pricing_negative(
  'shared_schedule_mutated',
  $sql$update public.hotel_pricing_schedules
    set name_i18n=name_i18n||'{"en":"unexpected shared mutation"}'::jsonb
    where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid$sql$);

select pg_temp.run_independent_pricing_negative(
  'independent_schedule_ids_equal',
  $sql$update public.hotel_seven_arches_independent_pricing_evolution_receipts
    set ground_schedule_id=upper_schedule_id where id=1$sql$,
  '[{"relation":"public.hotel_seven_arches_independent_pricing_evolution_receipts",
     "contype":"c","conkey":[7]}]'::jsonb);

select pg_temp.run_independent_pricing_negative(
  'schedule_not_independent',
  $sql$update public.hotel_pricing_schedules set sharing_mode='shared'
    where id='aec20731-7a56-35f0-334e-92b363351f02'::uuid$sql$);

select pg_temp.run_independent_pricing_negative(
  'room_rate_wrong_schedule',
  $sql$update public.hotel_room_rates
    set pricing_schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid$sql$);

select pg_temp.run_independent_pricing_negative(
  'initial_fingerprints_unequal',
  $sql$update public.hotel_seven_arches_independent_pricing_topology_receipts
    set target_initial_tier_fingerprint=repeat('0',64) where room_key='upper'$sql$,
  '[{"relation":"public.hotel_seven_arches_independent_pricing_topology_receipts",
     "contype":"c","conkey":[10,11]}]'::jsonb);

select pg_temp.run_independent_pricing_negative(
  'authority_count_not_54',
  $sql$delete from public.hotel_seven_arches_independent_pricing_authority
    where target_tier_id=(select target_tier_id
      from public.hotel_seven_arches_independent_pricing_authority
      order by target_tier_id limit 1)$sql$);

select pg_temp.run_independent_pricing_negative(
  'duplicate_authority_tuple',
  $sql$update public.hotel_seven_arches_independent_pricing_authority
    set guest_count=2,threshold_nights=3
    where room_key='upper' and guest_count=2 and threshold_nights=2$sql$,
  '[{"relation":"public.hotel_seven_arches_independent_pricing_authority",
     "contype":"u","conkey":[3,12,13]},
    {"relation":"public.hotel_seven_arches_independent_pricing_authority",
     "contype":"u","conkey":[11,12,13]}]'::jsonb);

select pg_temp.run_independent_pricing_negative(
  'missing_guest_threshold_row',
  $sql$update public.hotel_seven_arches_independent_pricing_authority
    set threshold_nights=11
    where room_key='upper' and guest_count=2 and threshold_nights=2$sql$,
  '[{"relation":"public.hotel_seven_arches_independent_pricing_authority",
     "contype":"c","conkey":[13]}]'::jsonb);

select pg_temp.run_independent_pricing_negative(
  'foreign_tier',
  $sql$update public.hotel_seven_arches_independent_pricing_authority
    set source_tier_id=(select id
      from public.hotel_pricing_schedule_occupancy_tiers
      where schedule_id='443065c0-984a-5de3-a22a-d03042c41107'::uuid
      order by id limit 1)
    where target_tier_id=(select target_tier_id
      from public.hotel_seven_arches_independent_pricing_authority
      order by target_tier_id limit 1)$sql$);

select pg_temp.run_independent_pricing_negative(
  'bootstrap_pricing_value_drift',
  $sql$update public.hotel_pricing_schedule_occupancy_tiers
    set nightly_rate=nightly_rate+1
    where id=(select target_tier_id
      from public.hotel_seven_arches_independent_pricing_authority
      order by target_tier_id limit 1)$sql$);

select pg_temp.run_independent_pricing_negative(
  'commission_drift',
  $sql$update public.hotel_commission_policies set amount=amount+1
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid$sql$);

select pg_temp.run_independent_pricing_negative(
  'historical_activation_receipt_mutation',
  $sql$update public.hotel_seven_arches_pricing_activation_evolution_receipts
    set parity_fingerprint=repeat('0',32) where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'topology_receipt_self_hash_corruption',
  $sql$update public.hotel_seven_arches_independent_pricing_evolution_receipts
    set receipt_fingerprint=repeat('0',64) where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'raw_acl_exposure',
  $sql$grant select on public.hotel_seven_arches_independent_pricing_authority
    to authenticated$sql$);

select pg_temp.run_independent_pricing_negative(
  'task2_scoped_lineage_source_pin_corrupt',
  $sql$update public.hotel_seven_arches_task2_stage2_compatibility_receipts
    set scoped_lineage_source_hash=repeat('0',64) where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'scoped_hotels_lineage_acl_drift',
  $sql$grant execute on function
    public.hotel_v2_seven_arches_pricing_scoped_lineage()
    to authenticated$sql$);

select pg_temp.run_independent_pricing_negative(
  'transaction_preservation_acl_drift',
  $sql$grant execute on function
    public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
    to authenticated$sql$);

select pg_temp.run_independent_pricing_negative(
  'unrelated_protected_pricing_drift',
  $sql$update public.hotel_rate_plans set sort_order=sort_order+1
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid$sql$);

select pg_temp.run_independent_pricing_negative(
  'workspace_lineage_acl_drift',
  $sql$do $workspace_lineage_source_and_acl_drift$
  begin
    execute $definition$create or replace function
      public.hotel_v2_partner_workspace_function_lineage_is_exact()
      returns boolean language plpgsql stable security definer
      set search_path=pg_catalog,public
      as $source$begin return false; end$source$$definition$;
    execute 'grant execute on function '
      'public.hotel_v2_partner_workspace_function_lineage_is_exact() '
      'to authenticated';
  end
  $workspace_lineage_source_and_acl_drift$$sql$);

select pg_temp.run_independent_pricing_negative(
  'provider_attribution_acl_drift',
  $sql$grant execute on function
    public.hotel_v2_external_calendar_provider_sources_are_attributable()
    to authenticated$sql$);

select pg_temp.run_independent_pricing_negative(
  'stage2f_function_lineage_acl_drift',
  $sql$grant execute on function
    public.hotel_v2_external_calendar_activation_function_fingerprints()
    to authenticated$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_row_missing',
  $sql$delete from public.site_settings where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_row_extra',
  $sql$insert into public.site_settings(
    id,hotel_rooms_v2_enabled,hotel_external_sync_enabled,
    hotel_instant_booking_enabled,hotel_stripe_connect_enabled)
    values(2,false,false,false,false)$sql$,
  '[{"relation":"public.site_settings","contype":"p","conkey":[1]},
    {"relation":"public.site_settings","contype":"c","conkey":[1]}]'::jsonb);

select pg_temp.run_independent_pricing_negative(
  'site_settings_rooms_true',
  $sql$update public.site_settings set hotel_rooms_v2_enabled=true where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_instant_true',
  $sql$update public.site_settings set hotel_instant_booking_enabled=true where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_stripe_true',
  $sql$update public.site_settings set hotel_stripe_connect_enabled=true where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_external_null',
  $sql$do $site_settings_external_null$
  begin
    alter table public.site_settings
      alter column hotel_external_sync_enabled drop not null;
    update public.site_settings set hotel_external_sync_enabled=null where id=1;
  end
  $site_settings_external_null$$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_canonical_lifecycle_corrupt',
  $sql$update public.hotel_seven_arches_independent_pricing_evolution_receipts
    set historical_activation_lineage=jsonb_set(historical_activation_lineage,
      '{site_settings_lifecycle_fingerprint}',to_jsonb(repeat('0',64)),false)
    where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_raw_map_source_drift',
  $sql$do $site_settings_raw_map_source_drift$
  begin
    execute $definition$create or replace function
      public.hotel_v2_h3_2b_protected_fingerprints()
      returns jsonb language plpgsql stable security definer
      set search_path=pg_catalog,public
      as $source$
      begin
        return jsonb_build_object('site_settings',repeat('0',32));
      end
      $source$$definition$;
  end
  $site_settings_raw_map_source_drift$$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_canonical_maps_disagree',
  $sql$update public.hotel_seven_arches_pricing_activation_evolution_receipts
    set after_stage2_protected_fingerprints=jsonb_set(
      after_stage2_protected_fingerprints,'{site_settings}',
      to_jsonb(repeat('0',64)),false)
    where id=1$sql$);

select pg_temp.run_independent_pricing_negative(
  'site_settings_raw_helper_security_drift',
  $sql$grant execute on function
    public.hotel_v2_h3_2b_protected_fingerprints() to authenticated$sql$);

do $independent_pricing_negative_set_exact$
declare
  v_required constant text[]:=array[
    'wrong_hotel','wrong_room_identity','wrong_room_rate','shared_schedule_missing',
    'shared_schedule_mutated','independent_schedule_ids_equal','schedule_not_independent',
    'room_rate_wrong_schedule','initial_fingerprints_unequal','authority_count_not_54',
    'duplicate_authority_tuple','missing_guest_threshold_row','foreign_tier',
    'bootstrap_pricing_value_drift','commission_drift',
    'historical_activation_receipt_mutation','topology_receipt_self_hash_corruption',
    'raw_acl_exposure','unrelated_protected_pricing_drift']::text[];
  v_bridge constant text[]:=array[
    'site_settings_row_missing','site_settings_row_extra',
    'site_settings_rooms_true','site_settings_instant_true',
    'site_settings_stripe_true','site_settings_external_null',
    'site_settings_canonical_lifecycle_corrupt',
    'site_settings_raw_map_source_drift',
    'site_settings_canonical_maps_disagree',
    'site_settings_raw_helper_security_drift']::text[];
  v_scope constant text[]:=array[
    'task2_scoped_lineage_source_pin_corrupt',
    'scoped_hotels_lineage_acl_drift',
    'transaction_preservation_acl_drift']::text[];
  v_expected constant text[]:=array[
    'wrong_hotel','wrong_room_identity','wrong_room_rate','shared_schedule_missing',
    'shared_schedule_mutated','independent_schedule_ids_equal','schedule_not_independent',
    'room_rate_wrong_schedule','initial_fingerprints_unequal','authority_count_not_54',
    'duplicate_authority_tuple','missing_guest_threshold_row','foreign_tier',
    'bootstrap_pricing_value_drift','commission_drift',
    'historical_activation_receipt_mutation','topology_receipt_self_hash_corruption',
    'raw_acl_exposure','task2_scoped_lineage_source_pin_corrupt',
    'scoped_hotels_lineage_acl_drift','transaction_preservation_acl_drift',
    'unrelated_protected_pricing_drift',
    'workspace_lineage_acl_drift','provider_attribution_acl_drift',
    'stage2f_function_lineage_acl_drift',
    'site_settings_row_missing','site_settings_row_extra',
    'site_settings_rooms_true','site_settings_instant_true',
    'site_settings_stripe_true','site_settings_external_null',
    'site_settings_canonical_lifecycle_corrupt',
    'site_settings_raw_map_source_drift',
    'site_settings_canonical_maps_disagree',
    'site_settings_raw_helper_security_drift']::text[];
begin
  if cardinality(v_required) is distinct from 19
     or cardinality(v_bridge) is distinct from 10
     or cardinality(v_scope) is distinct from 3
     or cardinality(v_expected) is distinct from 35
     or (select count(*) from independent_pricing_topology_negative_results)<>35
     or (select bool_and(rejected and restored)
       from independent_pricing_topology_negative_results) is not true
     or exists((select unnest(v_required)) except
       (select label from independent_pricing_topology_negative_results))
     or exists((select unnest(v_bridge)) except
       (select label from independent_pricing_topology_negative_results))
     or exists((select unnest(v_scope)) except
       (select label from independent_pricing_topology_negative_results))
     or exists((select unnest(v_expected)) except
       (select label from independent_pricing_topology_negative_results))
     or exists((select label from independent_pricing_topology_negative_results) except
       (select unnest(v_expected)))
     or public.hotel_v2_h3_2b_hash(pg_temp.independent_pricing_gate_state())
       is distinct from (select state_fingerprint
         from independent_pricing_topology_gate_baseline)
     or (select count(*)
       from public.hotel_seven_arches_pricing_activation_transaction_context)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_independent_pricing_negative_set_invalid';
  end if;
end
$independent_pricing_negative_set_exact$;

select 'HOTELS_V2_7A_INDEPENDENT_PRICING_TOPOLOGY_POSITIVE' sentinel,
  * from independent_pricing_topology_positive_results;
select 'HOTELS_V2_7A_INDEPENDENT_PRICING_SITE_SETTINGS_TOLERANCE' sentinel,
  count(*)::integer case_count,
  count(*) filter(where raw_fingerprint_changed and canonical_fingerprint_exact
    and accepted and restored)::integer passed_count,
  array_agg(label order by label) labels
from independent_pricing_site_settings_tolerance_results;
select 'HOTELS_V2_7A_INDEPENDENT_PRICING_TOPOLOGY_NEGATIVES' sentinel,
  count(*)::integer negative_count,count(*) filter(where rejected and restored)::integer passed_count,
  array_agg(label order by label) labels
from independent_pricing_topology_negative_results;
select 'HOTELS_V2_7A_INDEPENDENT_PRICING_TOPOLOGY_POSTGRES_GATE_OK' sentinel,
  public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() topology_exact,
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe() current_safe,
  public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() receipt_exact,
  public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
    transaction_preservation_exact,
  public.hotel_v2_seven_arches_pricing_scoped_lineage()->>'contract_version'
    scoped_lineage_contract,
  encode(extensions.digest(convert_to((select procedure_row.prosrc
    from pg_proc procedure_row where procedure_row.oid=
      'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure),
    'UTF8'),'sha256'),'hex') topology_prosrc_sha256,
  public.hotel_v2_seven_arches_independent_pricing_oracle() oracle;
