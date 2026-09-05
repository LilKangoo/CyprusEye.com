begin;
set transaction isolation level read committed;
set local lock_timeout='15s';
set local statement_timeout='180s';

-- Preserve the caller's accepted upstream evaluation boundary.  The frozen
-- 114400/114405 lineage contains inherited fingerprints whose rendering is
-- session-TimeZone-sensitive; 114410 must neither change that setting nor
-- copy the dependency into its own canonical fingerprints.
create temporary table seven_arches_independent_pricing_timezone_boundary(
  incoming_timezone text not null
) on commit drop;
insert into seven_arches_independent_pricing_timezone_boundary(incoming_timezone)
values(current_setting('TimeZone'));

-- Freeze every relation consumed by the protected Task2/Stage2 projections,
-- activation lineage, commercial oracle, or the topology DML before taking a
-- prerequisite snapshot.  Every listed relation is proven held before the
-- dependency and before-snapshot reads begin.
do $seven_arches_independent_pricing_locks$
declare
  v_relation regclass;
begin
  foreach v_relation in array array[
    'public.hotels'::regclass,
    'public.hotel_units'::regclass,
    'public.hotel_rate_plans'::regclass,
    'public.hotel_pricing_schedules'::regclass,
    'public.hotel_property_pricing_defaults'::regclass,
    'public.hotel_rate_rules'::regclass,
    'public.hotel_room_allocation_rules'::regclass,
    'public.hotel_room_allocation_rule_items'::regclass,
    'public.hotel_unit_calendar_blocks'::regclass,
    'public.hotel_inventory_holds'::regclass,
    'public.hotel_booking_room_allocations'::regclass,
    'public.hotel_inventory_commitments'::regclass,
    'public.hotel_calendar_source_configs'::regclass,
    'public.hotel_payment_policies'::regclass,
    'public.hotel_payment_policy_terms'::regclass,
    'public.hotel_commission_policies'::regclass,
    'public.hotel_daily_rates'::regclass,
    'public.hotel_pricing_promotion_reviews'::regclass,
    'public.hotel_admin_pricing_action_receipts'::regclass,
    'public.hotel_admin_availability_action_receipts'::regclass,
    'public.hotel_admin_availability_plan_reviews'::regclass,
    'public.hotel_admin_availability_foundation_receipts'::regclass,
    'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,
    'public.hotel_bookings'::regclass,
    'public.partner_service_fulfillments'::regclass,
    'public.partner_service_fulfillment_form_snapshots'::regclass,
    'public.service_deposit_requests'::regclass,
    'public.service_deposit_rules'::regclass,
    'public.service_deposit_overrides'::regclass,
    'public.service_coupons'::regclass,
    'public.service_coupon_redemptions'::regclass,
    'public.referrals'::regclass,
    'public.affiliate_commission_events'::regclass,
    'public.affiliate_payouts'::regclass,
    'public.affiliate_adjustments'::regclass,
    'public.affiliate_program_settings'::regclass,
    'public.affiliate_referrer_overrides'::regclass,
    'public.affiliate_cashout_requests'::regclass,
    'public.profile_referral_code_aliases'::regclass,
    'public.partners'::regclass,
    'public.partner_users'::regclass,
    'public.partner_resources'::regclass,
    'public.partner_user_resources'::regclass,
    'public.hotel_partner_hotel_permissions'::regclass,
    'public.site_settings'::regclass,
    'public.hotel_room_types'::regclass,
    'public.hotel_room_rates'::regclass,
    'public.hotel_pricing_schedule_occupancy_tiers'::regclass,
    'public.hotel_room_rate_occupancy_tiers'::regclass,
    'public.hotel_calendar_overrides'::regclass,
    'public.hotel_daily_inventory'::regclass,
    'public.hotel_partner_action_receipts'::regclass,
    'public.hotel_partner_event_outbox'::regclass,
    'public.hotel_activity_log'::regclass,
    'public.hotel_property_operational_profiles'::regclass,
    'public.hotel_partner_workspace_foundation_receipts'::regclass,
    'public.hotel_partner_property_proposal_foundation_receipts'::regclass,
    'public.hotel_partner_property_proposal_admin_reviews'::regclass,
    'public.hotel_partner_property_drafts'::regclass,
    'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
    'public.hotel_seven_arches_pricing_activation_reviews'::regclass,
    'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass,
    'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
    'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass,
    'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
    'hotels_v2_private.hotel_external_calendar_plan_reviews'::regclass,
    'hotels_v2_private.hotel_external_calendar_correlations'::regclass,
    'hotels_v2_private.hotel_external_calendar_admin_receipts'::regclass
  ] loop
    execute format('lock table %s in share row exclusive mode',v_relation);
    if not exists(select 1 from pg_locks held
      where held.locktype='relation' and held.relation=v_relation
        and held.pid=pg_backend_pid() and held.granted
        and held.mode in('ShareRowExclusiveLock','AccessExclusiveLock')) then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_independent_pricing_lock_not_held',
        detail=v_relation::text;
    end if;
  end loop;
end
$seven_arches_independent_pricing_locks$;

-- 7 Arches keeps the reviewed legacy matrix as historical evidence while each
-- apartment receives its own authoritative schedule.  This migration is the
-- one-time topology evolution only; reviewed Partner/Admin price changes are
-- installed by the workflow section after this topology checkpoint is frozen.
do $seven_arches_independent_pricing_dependencies$
declare
  v_bad_function text;
begin
  if to_regprocedure('public.hotel_v2_h3_2b_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_h3_2b_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_admin_d_immutable_row()') is null
     or to_regprocedure('public.hotel_v2_h3_2b_immutable_row()') is null
     or to_regprocedure(
       'public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_context_guard()') is null
     or to_regprocedure('public.hotel_v2_h3_1p_allocation_preview(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_1p_parity_snapshot(uuid)') is null
     or to_regprocedure(
       'public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_c_validate_pricing_graph(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_c_pricing_graph_constraint_trigger()') is null
     or to_regprocedure('public.hotel_v2_admin_c_h3_1p_freeze_trigger()') is null
     or to_regprocedure('public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()') is null
     or to_regprocedure(
       'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_scoped_lineage()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()') is null
     or to_regprocedure('public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_provider_sources_are_attributable()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()') is null
     or to_regprocedure(
       'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)') is null
     or to_regprocedure(
       'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_state_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()') is null
     or to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') is null
     or to_regclass('public.hotel_commission_policies') is null
     or to_regclass('public.hotel_pricing_schedules') is null
     or to_regclass('public.hotel_pricing_schedule_occupancy_tiers') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_dependency_missing';
  end if;
  if to_regclass('public.hotel_seven_arches_independent_pricing_authority') is not null
     or to_regclass('public.hotel_seven_arches_independent_pricing_topology_receipts') is not null
     or to_regclass('public.hotel_seven_arches_independent_pricing_evolution_receipts') is not null
     or to_regprocedure('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()') is not null then
    raise exception using errcode='23514',
      message='hotels_v2_seven_arches_independent_pricing_already_present';
  end if;
  if to_regprocedure('public.hotel_v2_external_calendar_site_settings_fingerprint()') is not null
     or to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts')
       is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_migration_order_mismatch';
  end if;
  if (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true
     or jsonb_typeof(public.hotel_v2_seven_arches_pricing_scoped_lineage())
       is distinct from 'object'
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() is not true
     or not exists(select 1 from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt
       where receipt.id=1
         and receipt.contract_version='hotels_v2_seven_arches_pricing_activation_evolution_v1'
         and receipt.pricing_authority='shared_schedule') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_activation_drift';
  end if;
  select expected.signature into v_bad_function
  from (values
    ('public.hotel_v2_h3_1p_allocation_preview(uuid)',
      'c8800e9665a2d096d8e25e37b121100d8f2987a2a3c3ae90e0e4c0151044a34b',
      's'::"char",false,'sql',array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
      '2e4d7016306b94bd7b2b95060e494edb0ee028d3c9885e13899a13d3185a1a7e',
      's'::"char",true,'plpgsql',array['search_path=pg_catalog, public']::text[])
  ) expected(signature,source_hash,volatility,security_definer,language_name,search_path)
  left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
  left join pg_language language_row on language_row.oid=procedure_row.prolang
  where procedure_row.oid is null
    or procedure_row.proowner<>'postgres'::regrole
    or procedure_row.prorettype<>'jsonb'::regtype
    or procedure_row.prosecdef is distinct from expected.security_definer
    or procedure_row.provolatile<>expected.volatility
    or language_row.lanname is distinct from expected.language_name
    or procedure_row.proconfig is distinct from expected.search_path
    or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
      is distinct from expected.source_hash
    or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
    or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
    or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
    or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
  limit 1;
  if v_bad_function is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_dependency_source_drift',
      detail=v_bad_function;
  end if;
  if not exists(select 1 from pg_proc procedure_row
    join pg_language language_row on language_row.oid=procedure_row.prolang
    where procedure_row.oid=
        'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure
      and procedure_row.proowner='postgres'::regrole
      and language_row.lanname='plpgsql'
      and procedure_row.provolatile='s' and procedure_row.prosecdef
      and procedure_row.proconfig=
        array['search_path=pg_catalog, public']::text[]
      and not procedure_row.proleakproof and not procedure_row.proretset
      and encode(extensions.digest(convert_to(
        procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
        '6df11e8680d35ca8caf3a4f4492276105f2b150422f3b086b64ad82d5f6e164d'
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_dependency_source_drift',
      detail='public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()';
  end if;
  select expected.signature into v_bad_function
  from (values
    ('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
      'c8a3885461c04dcd2c814b188803d69a1b3bf64c2cb1cd3a61023f35cbfd62ec',
      's'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_admin_d_current_foundation_snapshot()',
      '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a',
      's'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
      'e42b5b7cabecd6e7ec7a847796983e497572f9f8fc0802f642fdc6b995d84ac3',
      's'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
      '0a6255e457f0912452949966e47e29a0ce0f6cda3e85c53b999343f9b68c3a95',
      's'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',
      '57cabf1992e9f03f5411715b59c29aea51501aa3a91b403d36e61264c394e420',
      's'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_seven_arches_pricing_activation_snapshot()',
      '41e70f0b9dec52daae35d1320319016d1ab211e3de1d0d5894d36c2ea10b7638',
      's'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_admin_c_validate_pricing_graph(uuid)',
      'f3be020f35a990bc012ffd1adff2f8a7b4b1d3e8ba2f6f5e51c41f4917a6195d',
      'v'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_external_calendar_protected_fingerprints()',
      'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5',
      's'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_admin_c_h3_1p_freeze_trigger()',
      'd864f254c257be00491d0c2e508c4b6585e16bf3e35992fa174050d2205a6bf6',
      'v'::"char",array['search_path=pg_catalog, public']::text[]),
    ('public.hotel_v2_admin_c_pricing_graph_constraint_trigger()',
      'ddd7d1995810b1006d5fdbaca64560703ad98f5b4cfae1174b0595b8f41d7ad0',
      'v'::"char",array['search_path=pg_catalog, public']::text[])
  ) expected(signature,source_hash,volatility,search_path)
  left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
  where procedure_row.oid is null
    or procedure_row.proowner<>'postgres'::regrole
    or not procedure_row.prosecdef
    or procedure_row.provolatile<>expected.volatility
    or procedure_row.proconfig is distinct from expected.search_path
    or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
      is distinct from expected.source_hash
    or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
    or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
    or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
    or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
  limit 1;
  if v_bad_function is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_dependency_source_drift',
      detail=v_bad_function;
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)',
        'b85e47c8e5a61832dbbc909fb120d38d965d0077914f2d8009249ca9a8ffb3f6',
        'v'::"char"),
      ('public.hotel_v2_admin_get_seven_arches_pricing_activation()',
        'ad55a2b1a29fb2e81f2e3f42b445f280a47f5b497590ca92c1cf110dd6b23b0d',
        's'::"char")
    ) expected(signature,source_hash,volatility)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or not procedure_row.prosecdef
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.proconfig is distinct from
        array['search_path=pg_catalog, public, auth']::text[]
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        is distinct from expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      or not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_dependency_dispatcher_drift';
  end if;
  if (select count(*) from public.hotel_pricing_schedules
      where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)<>2
     or (select count(*) from public.hotel_room_rates
      where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)<>2
     or not exists(select 1 from public.hotel_room_rates where
       id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
       and room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
       and pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
       and is_active and review_status='reviewed')
     or not exists(select 1 from public.hotel_room_rates where
       id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
       and room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
       and pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
       and is_active and review_status='reviewed')
     or not exists(select 1 from public.hotel_pricing_schedules schedule where
       schedule.id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
       and schedule.code='shared-apartment-occupancy-los'
       and schedule.application_scope='room_occupancy'
       and schedule.minimum_billable_occupancy=2
       and schedule.maximum_party_size=4 and schedule.is_active
       and schedule.review_status='reviewed' and schedule.sharing_mode='shared')
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid)<>27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
         and tier.is_active)<>27 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_topology_drift';
  end if;
  if exists(select 1 from (values
       ('public.hotel_room_rates'::regclass,
        'hotel_room_rates_admin_c_h3_1p_freeze',
        'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,31::smallint,false,false),
       ('public.hotel_pricing_schedules'::regclass,
        'hotel_pricing_schedules_admin_c_h3_1p_freeze',
        'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,31::smallint,false,false),
       ('public.hotel_pricing_schedule_occupancy_tiers'::regclass,
        'hotel_pricing_schedule_tiers_admin_c_h3_1p_freeze',
        'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,31::smallint,false,false),
       ('public.hotel_room_rates'::regclass,
        'hotel_room_rates_admin_c_graph_guard',
        'public.hotel_v2_admin_c_pricing_graph_constraint_trigger()'::regprocedure,
        29::smallint,true,true),
       ('public.hotel_pricing_schedules'::regclass,
        'hotel_pricing_schedules_admin_c_graph_guard',
        'public.hotel_v2_admin_c_pricing_graph_constraint_trigger()'::regprocedure,
        29::smallint,true,true),
       ('public.hotel_pricing_schedule_occupancy_tiers'::regclass,
        'hotel_pricing_schedule_tiers_admin_c_graph_guard',
        'public.hotel_v2_admin_c_pricing_graph_constraint_trigger()'::regprocedure,
        29::smallint,true,true)
     ) expected(relation_id,trigger_name,function_id,trigger_type,is_deferrable,is_initially_deferred)
     left join pg_trigger trigger_row on trigger_row.tgrelid=expected.relation_id
       and trigger_row.tgname=expected.trigger_name and not trigger_row.tgisinternal
     where trigger_row.oid is null or trigger_row.tgenabled<>'O'
       or trigger_row.tgfoid<>expected.function_id
       or trigger_row.tgtype<>expected.trigger_type
       or trigger_row.tgdeferrable is distinct from expected.is_deferrable
       or trigger_row.tginitdeferred is distinct from expected.is_initially_deferred) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_freeze_topology_drift';
  end if;
end
$seven_arches_independent_pricing_dependencies$;

-- Bind the accepted 114405 validator result to the immutable rows and
-- lower-layer source lineage that made it true.  Topology changes intentionally
-- alter three pricing fingerprints, so successor validation replays this row
-- snapshot rather than weakening the detailed Task3 evidence to a boolean.
create function public.hotel_v2_seven_arches_independent_pricing_activation_lineage()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_activation public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_site_settings_lifecycle jsonb:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false);
  v_site_settings_lifecycle_fingerprint text;
  v_scoped_lineage jsonb;
begin
  v_site_settings_lifecycle_fingerprint:=
    public.hotel_v2_external_calendar_worker_hash(v_site_settings_lifecycle);
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or (select count(*)
      from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<>1
     or (select count(*)
      from public.hotel_admin_availability_foundation_receipts)<>1
     or (select count(*)
      from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*)
      from public.hotel_partner_workspace_foundation_receipts)<>1
     or (select count(*)
      from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*)
      from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or (select count(*)
      from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or (select count(*)<>1 or bool_or(setting.id<>1
          or setting.hotel_rooms_v2_enabled is distinct from false
          or setting.hotel_external_sync_enabled is null
          or setting.hotel_instant_booking_enabled is distinct from false
          or setting.hotel_stripe_connect_enabled is distinct from false)
       from public.site_settings setting)
     or v_site_settings_lifecycle_fingerprint is distinct from
       '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'
     or exists(select 1
      from public.hotel_seven_arches_pricing_activation_transaction_context) then
    return null;
  end if;
  select * into strict v_activation
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  if jsonb_typeof(v_scoped_lineage) is distinct from 'object'
     or v_scoped_lineage->>'contract_version' is distinct from
       'hotels_v2_seven_arches_pricing_scoped_lineage_v1' then
    return null;
  end if;
  if (select count(*) from public.hotel_seven_arches_pricing_activation_reviews
        where id=v_activation.review_id)<>1
     or (select count(*) from public.hotel_admin_pricing_action_receipts
        where id=v_activation.admin_receipt_id)<>1
     or cardinality(v_activation.activity_ids)<>4
     or (select count(*) from public.hotel_activity_log
        where id=any(v_activation.activity_ids))<>4 then
    return null;
  end if;
  if public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true then
    return null;
  end if;
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_independent_pricing_activation_lineage_v1',
    'activation_receipt',to_jsonb(v_activation)-array['created_at'],
    'activation_review',(select to_jsonb(review_row)-array[
        'reviewed_at','expires_at','consumed_at','created_at']
      from public.hotel_seven_arches_pricing_activation_reviews review_row
      where review_row.id=v_activation.review_id),
    'admin_receipt',(select to_jsonb(receipt_row)-array['created_at']
      from public.hotel_admin_pricing_action_receipts receipt_row
      where receipt_row.id=v_activation.admin_receipt_id),
    'activity_rows',(select jsonb_agg(
        to_jsonb(activity)-array['created_at'] order by activity.id)
      from public.hotel_activity_log activity where activity.id=any(v_activation.activity_ids)),
    'task2_stage2_receipt',(select to_jsonb(receipt_row)-array['created_at']
      from public.hotel_seven_arches_task2_stage2_compatibility_receipts receipt_row where id=1),
    'availability_foundation_receipt',(select to_jsonb(receipt_row)-array['created_at']
      from public.hotel_admin_availability_foundation_receipts receipt_row where id=1),
    'availability_evolution_receipt',(select to_jsonb(receipt_row)-array['created_at']
      from public.hotel_admin_availability_foundation_evolution_receipts receipt_row where id=1),
    'workspace_foundation_receipt',(select to_jsonb(receipt_row)-array['created_at']
      from public.hotel_partner_workspace_foundation_receipts receipt_row where id=1),
    'proposal_foundation_receipt',(select to_jsonb(receipt_row)-array['created_at']
      from public.hotel_partner_property_proposal_foundation_receipts receipt_row where id=1),
    'external_foundation_receipt',(select to_jsonb(receipt_row)-array['created_at']
      from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt_row where id=1),
    'external_activation_receipt',(select to_jsonb(receipt_row)-array['created_at']
      from hotels_v2_private.hotel_external_calendar_activation_receipts receipt_row where id=1),
    'site_settings_lifecycle',v_site_settings_lifecycle,
    'site_settings_lifecycle_fingerprint',v_site_settings_lifecycle_fingerprint,
    'workspace_lineage_exact',
      public.hotel_v2_partner_workspace_function_lineage_is_exact(),
    'property_attribution_exact',
      jsonb_typeof(v_scoped_lineage)='object',
    'scoped_hotels_lineage_exact',
      jsonb_typeof(v_scoped_lineage)='object',
    'scoped_hotels_lineage_source_hash',public.hotel_v2_h3_2b_hash(to_jsonb(
      pg_get_functiondef(
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure))),
    'transaction_preservation_exact',
      public.hotel_v2_7a_pricing_activation_transaction_is_preserved(),
    'transaction_preservation_source_hash',public.hotel_v2_h3_2b_hash(to_jsonb(
      pg_get_functiondef(
        'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure))),
    'provider_attribution_exact',
      public.hotel_v2_external_calendar_provider_sources_are_attributable(),
    'activation_context_empty',not exists(select 1
      from public.hotel_seven_arches_pricing_activation_transaction_context),
    'lower_catalog',(with relations(relation_id,relation_name) as (values
      ('public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
        'pricing_activation_evolution_receipts'),
      ('public.hotel_seven_arches_pricing_activation_reviews'::regclass,
        'pricing_activation_reviews'),
      ('public.hotel_seven_arches_pricing_activation_transaction_context'::regclass,
        'pricing_activation_transaction_context'),
      ('public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        'task2_stage2_compatibility_receipts'),
      ('public.hotel_admin_pricing_action_receipts'::regclass,
        'admin_pricing_action_receipts'),
      ('public.hotel_activity_log'::regclass,'hotel_activity_log'),
      ('public.hotel_admin_availability_foundation_receipts'::regclass,
        'availability_foundation_receipts'),
      ('public.hotel_admin_availability_foundation_evolution_receipts'::regclass,
        'availability_foundation_evolution_receipts'),
      ('public.hotel_partner_workspace_foundation_receipts'::regclass,
        'workspace_foundation_receipts'),
      ('public.hotel_partner_property_proposal_foundation_receipts'::regclass,
        'property_proposal_foundation_receipts'),
      ('public.hotel_calendar_source_configs'::regclass,'hotel_calendar_source_configs'),
      ('public.hotel_partner_action_receipts'::regclass,'hotel_partner_action_receipts'),
      ('hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass,
        'external_calendar_foundation_receipts'),
      ('hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
        'external_calendar_activation_receipts'),
      ('hotels_v2_private.hotel_external_calendar_plan_reviews'::regclass,
        'external_calendar_plan_reviews'),
      ('hotels_v2_private.hotel_external_calendar_correlations'::regclass,
        'external_calendar_correlations'),
      ('hotels_v2_private.hotel_external_calendar_admin_receipts'::regclass,
        'external_calendar_admin_receipts')
    ) select jsonb_agg(jsonb_build_object(
      'relation',relation_row.relation_name,'owner',relation.relowner::regrole::text,
      'rls',relation.relrowsecurity,'force_rls',relation.relforcerowsecurity,
      'acl',to_jsonb(relation.relacl),
      'policies',coalesce((select jsonb_agg(jsonb_build_object(
        'name',policy.polname,'command',policy.polcmd,'permissive',policy.polpermissive,
        'roles',policy.polroles,'qual',pg_get_expr(policy.polqual,policy.polrelid),
        'with_check',pg_get_expr(policy.polwithcheck,policy.polrelid)) order by policy.polname)
        from pg_policy policy where policy.polrelid=relation_row.relation_id),'[]'::jsonb),
      'columns',coalesce((select jsonb_agg(jsonb_build_object(
        'attnum',attribute.attnum,'name',attribute.attname,
        'type',format_type(attribute.atttypid,attribute.atttypmod),
        'not_null',attribute.attnotnull,'identity',attribute.attidentity,
        'generated',attribute.attgenerated,
        'default',pg_get_expr(default_row.adbin,default_row.adrelid)) order by attribute.attnum)
        from pg_attribute attribute
        left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
          and default_row.adnum=attribute.attnum
        where attribute.attrelid=relation_row.relation_id and attribute.attnum>0
          and not attribute.attisdropped),'[]'::jsonb),
      'constraints',coalesce((select jsonb_agg(jsonb_build_object(
        'name',constraint_row.conname,'type',constraint_row.contype,
        'key',constraint_row.conkey,'foreign_relation',case
          when constraint_row.confrelid=0 then null
          else constraint_row.confrelid::regclass::text end,
        'foreign_key',constraint_row.confkey,
        'deferrable',constraint_row.condeferrable,
        'initially_deferred',constraint_row.condeferred,
        'validated',constraint_row.convalidated,'no_inherit',constraint_row.connoinherit,
        'expression',pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
        'definition',pg_get_constraintdef(constraint_row.oid)) order by constraint_row.conname)
        from pg_constraint constraint_row
        where constraint_row.conrelid=relation_row.relation_id),'[]'::jsonb),
      'triggers',coalesce((select jsonb_agg(jsonb_build_object(
        'name',trigger_row.tgname,'function',trigger_row.tgfoid::regprocedure::text,
        'type',trigger_row.tgtype,'enabled',trigger_row.tgenabled,
        'internal',trigger_row.tgisinternal,'deferrable',trigger_row.tgdeferrable,
        'initially_deferred',trigger_row.tginitdeferred) order by trigger_row.tgname)
        from pg_trigger trigger_row where trigger_row.tgrelid=relation_row.relation_id
          and not trigger_row.tgisinternal),'[]'::jsonb)) order by relation_row.relation_name)
      from relations relation_row join pg_class relation on relation.oid=relation_row.relation_id),
    'lower_schema_security',(select jsonb_build_object(
      'owner',namespace_row.nspowner::regrole::text,'acl',to_jsonb(namespace_row.nspacl),
      'public_usage',has_schema_privilege(0::oid,'hotels_v2_private','USAGE'),
      'anon_usage',has_schema_privilege('anon','hotels_v2_private','USAGE'),
      'authenticated_usage',has_schema_privilege('authenticated','hotels_v2_private','USAGE'),
      'service_usage',has_schema_privilege('service_role','hotels_v2_private','USAGE'),
      'public_create',has_schema_privilege(0::oid,'hotels_v2_private','CREATE'),
      'anon_create',has_schema_privilege('anon','hotels_v2_private','CREATE'),
      'authenticated_create',has_schema_privilege('authenticated','hotels_v2_private','CREATE'),
      'service_create',has_schema_privilege('service_role','hotels_v2_private','CREATE'))
      from pg_namespace namespace_row
      where namespace_row.oid='hotels_v2_private'::regnamespace),
    'lower_function_security',(with expected(signature) as (values
      ('public.hotel_v2_h3_2b_hash(jsonb)'),
      ('public.hotel_v2_h3_2b_protected_fingerprints()'),
      ('public.hotel_v2_admin_d_protected_fingerprints()'),
      ('public.hotel_v2_admin_d_immutable_row()'),
      ('public.hotel_v2_h3_2b_immutable_row()'),
      ('public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()'),
      ('public.hotel_v2_seven_arches_pricing_activation_context_guard()'),
      ('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'),
      ('public.hotel_v2_external_calendar_provider_sources_are_attributable()'),
      ('public.hotel_v2_partner_workspace_function_lineage_is_exact()'),
      ('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()'),
      ('public.hotel_v2_seven_arches_pricing_scoped_lineage()'),
      ('public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'),
      ('public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()'),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)'),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'),
      ('public.hotel_v2_seven_arches_pricing_activation_state_is_exact()'),
      ('public.hotel_v2_h3_1p_parity_snapshot(uuid)'),
      ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()')
    ) select jsonb_agg(jsonb_build_object(
      'signature',expected.signature,'owner',procedure_row.proowner::regrole::text,
      'security_definer',procedure_row.prosecdef,'volatility',procedure_row.provolatile,
      'config',to_jsonb(procedure_row.proconfig),'acl',to_jsonb(procedure_row.proacl),
      'source_hash',encode(extensions.digest(
        convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex'),
      'public_execute',has_function_privilege(0::oid,procedure_row.oid,'EXECUTE'),
      'anon_execute',has_function_privilege('anon',procedure_row.oid,'EXECUTE'),
      'authenticated_execute',has_function_privilege(
        'authenticated',procedure_row.oid,'EXECUTE'),
      'service_execute',has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
      order by expected.signature)
      from expected left join pg_proc procedure_row
        on procedure_row.oid=to_regprocedure(expected.signature)),
    'lower_function_sources',jsonb_build_object(
      'accepted_activation_receipt_validator',
        'c8a3885461c04dcd2c814b188803d69a1b3bf64c2cb1cd3a61023f35cbfd62ec',
      'admin_d',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_admin_d_current_foundation_snapshot()'::regprocedure),'UTF8'),'sha256'),'hex'),
      'canonical_projector',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'task2_validator',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'activation_apply',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'immutable_guard',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_pricing_activation_immutable()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'activation_insert_guard',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'review_guard',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_pricing_activation_review_guard()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'activation_context_guard',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_pricing_activation_context_guard()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'h3_2b_hash',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_h3_2b_hash(jsonb)'::regprocedure),'UTF8'),'sha256'),'hex'),
      'h3_2b_protected',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_h3_2b_protected_fingerprints()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'admin_d_protected',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_admin_d_protected_fingerprints()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'admin_d_immutable',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_admin_d_immutable_row()'::regprocedure),'UTF8'),'sha256'),'hex'),
      'h3_2b_immutable',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_h3_2b_immutable_row()'::regprocedure),'UTF8'),'sha256'),'hex'),
      'admin_c_pricing_receipt_immutable',encode(extensions.digest(convert_to((select prosrc
        from pg_proc where oid=
        'public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'stage2_compatible',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'workspace_lineage',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_partner_workspace_function_lineage_is_exact()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'provider_attribution',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'property_attribution',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'scoped_hotels_lineage',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'payment_policy_lineage',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'transaction_preservation',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'promotion_inert_core',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'promotion_snapshot',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'activation_state_validator',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_seven_arches_pricing_activation_state_is_exact()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'parity_snapshot',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_h3_1p_parity_snapshot(uuid)'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'allocation_contract',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
        'public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()'::regprocedure),
        'UTF8'),'sha256'),'hex')));
exception when no_data_found or too_many_rows then
  return null;
end
$function$;
alter function public.hotel_v2_seven_arches_independent_pricing_activation_lineage()
  owner to postgres;
revoke all on function public.hotel_v2_seven_arches_independent_pricing_activation_lineage()
  from public,anon,authenticated,service_role;

-- The protected maps below remain opaque inherited upstream evidence captured
-- under the unchanged incoming TimeZone.  Every new 114410-owned commercial
-- whole-row hash explicitly excludes non-business timestamps.
create temporary table seven_arches_independent_pricing_before on commit drop as
select
  (select count(*)::integer from public.hotel_pricing_schedules
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) schedule_count,
  (select count(*)::integer from public.hotel_pricing_schedule_occupancy_tiers tier
    join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
    where schedule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) tier_count,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(schedule)-array['created_at','updated_at'] order by schedule.id)
    from public.hotel_pricing_schedules schedule where schedule.id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb)) legacy_schedule_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(tier)-array['created_at','updated_at'] order by tier.id)
    from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb)) legacy_tier_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(rate)-array['pricing_schedule_id','version','created_at','updated_at'] order by rate.id)
    from public.hotel_room_rates rate where rate.id in(
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid)),'[]'::jsonb)) rate_nonlink_fingerprint,
  (select version from public.hotel_room_rates
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid) upper_rate_version,
  (select updated_at from public.hotel_room_rates
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid) upper_rate_updated_at,
  (select version from public.hotel_room_rates
    where id='3320590d-632d-423f-80d0-fd021cba7293'::uuid) ground_rate_version,
  (select updated_at from public.hotel_room_rates
    where id='3320590d-632d-423f-80d0-fd021cba7293'::uuid) ground_rate_updated_at,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
    from public.hotel_commission_policies policy
    where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)) commission_fingerprint,
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
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() protected_fingerprints,
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints() stage2_fingerprints,
  public.hotel_v2_seven_arches_independent_pricing_activation_lineage()
    historical_activation_lineage,
  public.hotel_v2_h3_2b_hash(
    public.hotel_v2_seven_arches_independent_pricing_activation_lineage())
    historical_activation_lineage_fingerprint,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'::regprocedure)))
    historical_activation_lineage_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)'::regprocedure))) generic_apply_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure))) freeze_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_h3_1p_allocation_preview(uuid)'::regprocedure))) allocation_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure))) graph_validator_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure))) activation_receipt_validator_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_get_seven_arches_pricing_activation()'::regprocedure))) admin_activation_get_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_pricing_activation_snapshot()'::regprocedure))) activation_snapshot_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure))) property_fingerprint_source_hash,
  encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=
    'public.hotel_v2_external_calendar_protected_fingerprints()'::regprocedure),
    'UTF8'),'sha256'),'hex') external_fingerprint_source_hash;

do $seven_arches_independent_pricing_before_exact$
begin
  if not exists(select 1 from seven_arches_independent_pricing_before before_row
    where jsonb_typeof(before_row.admin_d_protected_fingerprints)='object'
      and jsonb_typeof(before_row.historical_activation_lineage)='object'
      and before_row.historical_activation_lineage->>'workspace_lineage_exact'='true'
      and before_row.historical_activation_lineage->>'property_attribution_exact'='true'
      and before_row.historical_activation_lineage->>'provider_attribution_exact'='true'
      and before_row.historical_activation_lineage_fingerprint=
        public.hotel_v2_h3_2b_hash(before_row.historical_activation_lineage)
      and before_row.historical_activation_lineage_source_hash=
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'::regprocedure)))
      and before_row.activation_receipt_validator_source_hash=
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure)))) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_before_lineage_invalid';
  end if;
end
$seven_arches_independent_pricing_before_exact$;

create table public.hotel_seven_arches_independent_pricing_authority(
  target_tier_id uuid primary key
    references public.hotel_pricing_schedule_occupancy_tiers(id) on delete restrict,
  contract_version text not null check(
    contract_version='hotels_v2_seven_arches_independent_pricing_authority_v1'),
  room_key text not null check(room_key in('upper','ground')),
  hotel_id uuid not null check(hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
    references public.hotels(id) on delete restrict,
  room_type_id uuid not null references public.hotel_room_types(id) on delete restrict,
  room_rate_id uuid not null references public.hotel_room_rates(id) on delete restrict,
  rate_plan_id uuid not null references public.hotel_rate_plans(id) on delete restrict,
  currency text not null check(currency='EUR'),
  source_schedule_id uuid not null
    check(source_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid)
    references public.hotel_pricing_schedules(id) on delete restrict,
  source_tier_id uuid not null
    references public.hotel_pricing_schedule_occupancy_tiers(id) on delete restrict,
  independent_schedule_id uuid not null
    references public.hotel_pricing_schedules(id) on delete restrict,
  guest_count smallint not null check(guest_count between 2 and 4),
  threshold_nights integer not null check(threshold_nights between 2 and 10),
  initial_nightly_rate numeric(12,2) not null check(initial_nightly_rate>=0),
  source_tier_version bigint not null check(source_tier_version=1),
  target_initial_version bigint not null check(target_initial_version=1),
  source_is_active boolean not null check(source_is_active),
  target_initial_is_active boolean not null check(target_initial_is_active),
  created_at timestamptz not null default clock_timestamp(),
  unique(room_key,guest_count,threshold_nights),
  unique(room_key,source_tier_id),
  unique(independent_schedule_id,guest_count,threshold_nights),
  check((room_key='upper'
      and room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
      and room_rate_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
      and independent_schedule_id='aec20731-7a56-35f0-334e-92b363351f02'::uuid)
    or (room_key='ground'
      and room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
      and room_rate_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
      and independent_schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid))
);

create table public.hotel_seven_arches_independent_pricing_topology_receipts(
  room_key text primary key check(room_key in('upper','ground')),
  contract_version text not null check(
    contract_version='hotels_v2_seven_arches_independent_pricing_topology_v1'),
  room_type_id uuid not null,
  room_rate_id uuid not null,
  source_schedule_id uuid not null
    check(source_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),
  independent_schedule_id uuid not null unique,
  independent_schedule_code text not null unique,
  source_tier_count integer not null check(source_tier_count=27),
  target_tier_count integer not null check(target_tier_count=27),
  source_tier_fingerprint text not null check(source_tier_fingerprint~'^[0-9a-f]{64}$'),
  target_initial_tier_fingerprint text not null
    check(target_initial_tier_fingerprint~'^[0-9a-f]{64}$'),
  check(source_tier_fingerprint=target_initial_tier_fingerprint),
  source_schedule_fingerprint text not null
    check(source_schedule_fingerprint~'^[0-9a-f]{64}$'),
  target_schedule_fingerprint text not null
    check(target_schedule_fingerprint~'^[0-9a-f]{64}$'),
  authority_fingerprint text not null check(authority_fingerprint~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  check((room_key='upper'
      and room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
      and room_rate_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
      and independent_schedule_id='aec20731-7a56-35f0-334e-92b363351f02'::uuid
      and independent_schedule_code='upper-apartment-independent')
    or (room_key='ground'
      and room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
      and room_rate_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
      and independent_schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid
      and independent_schedule_code='ground-apartment-independent'))
);

create table public.hotel_seven_arches_independent_pricing_evolution_receipts(
  id smallint primary key check(id=1),
  contract_version text not null check(
    contract_version='hotels_v2_seven_arches_independent_pricing_evolution_v1'),
  hotel_id uuid not null check(hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  activation_receipt_id smallint not null check(activation_receipt_id=1)
    references public.hotel_seven_arches_pricing_activation_evolution_receipts(id) on delete restrict,
  source_schedule_id uuid not null
    check(source_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),
  upper_schedule_id uuid not null
    check(upper_schedule_id='aec20731-7a56-35f0-334e-92b363351f02'::uuid),
  ground_schedule_id uuid not null
    check(ground_schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid),
  before_schedule_count integer not null,
  after_schedule_count integer not null check(after_schedule_count=before_schedule_count+2),
  before_tier_count integer not null,
  after_tier_count integer not null check(after_tier_count=before_tier_count+54),
  authority_row_count integer not null check(authority_row_count=54),
  topology_receipt_count integer not null check(topology_receipt_count=2),
  upper_rate_schedule_before uuid not null
    check(upper_rate_schedule_before='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),
  upper_rate_schedule_after uuid not null
    check(upper_rate_schedule_after='aec20731-7a56-35f0-334e-92b363351f02'::uuid),
  ground_rate_schedule_before uuid not null
    check(ground_rate_schedule_before='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),
  ground_rate_schedule_after uuid not null
    check(ground_rate_schedule_after='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid),
  upper_rate_version_before bigint not null,
  upper_rate_version_after bigint not null
    check(upper_rate_version_after=upper_rate_version_before+1),
  upper_rate_updated_at_before timestamptz not null,
  upper_rate_updated_at_after timestamptz not null
    check(upper_rate_updated_at_after>upper_rate_updated_at_before),
  ground_rate_version_before bigint not null,
  ground_rate_version_after bigint not null
    check(ground_rate_version_after=ground_rate_version_before+1),
  ground_rate_updated_at_before timestamptz not null,
  ground_rate_updated_at_after timestamptz not null
    check(ground_rate_updated_at_after>ground_rate_updated_at_before),
  legacy_schedule_fingerprint_before text not null check(legacy_schedule_fingerprint_before~'^[0-9a-f]{64}$'),
  legacy_schedule_fingerprint_after text not null check(legacy_schedule_fingerprint_after~'^[0-9a-f]{64}$'),
  legacy_tier_fingerprint_before text not null check(legacy_tier_fingerprint_before~'^[0-9a-f]{64}$'),
  legacy_tier_fingerprint_after text not null check(legacy_tier_fingerprint_after~'^[0-9a-f]{64}$'),
  rate_nonlink_fingerprint_before text not null check(rate_nonlink_fingerprint_before~'^[0-9a-f]{64}$'),
  rate_nonlink_fingerprint_after text not null check(rate_nonlink_fingerprint_after~'^[0-9a-f]{64}$'),
  commission_fingerprint_before text not null check(commission_fingerprint_before~'^[0-9a-f]{64}$'),
  commission_fingerprint_after text not null check(commission_fingerprint_after~'^[0-9a-f]{64}$'),
  payment_fingerprint_before text not null check(payment_fingerprint_before~'^[0-9a-f]{64}$'),
  payment_fingerprint_after text not null check(payment_fingerprint_after~'^[0-9a-f]{64}$'),
  commercial_fingerprint_before text not null check(commercial_fingerprint_before~'^[0-9a-f]{64}$'),
  commercial_fingerprint_after text not null check(commercial_fingerprint_after~'^[0-9a-f]{64}$'),
  admin_d_protected_fingerprints_before jsonb not null
    check(jsonb_typeof(admin_d_protected_fingerprints_before)='object'),
  admin_d_protected_fingerprint_before text not null
    check(admin_d_protected_fingerprint_before~'^[0-9a-f]{64}$'),
  admin_d_protected_fingerprints_after jsonb not null
    check(jsonb_typeof(admin_d_protected_fingerprints_after)='object'),
  admin_d_protected_fingerprint_after text not null
    check(admin_d_protected_fingerprint_after~'^[0-9a-f]{64}$'),
  admin_d_allowed_protected_keys text[] not null check(
    admin_d_allowed_protected_keys=array[
      'hotel_room_rates','hotel_pricing_schedules',
      'hotel_pricing_schedule_occupancy_tiers']::text[]),
  before_protected_fingerprints jsonb not null check(jsonb_typeof(before_protected_fingerprints)='object'),
  before_protected_fingerprint text not null check(before_protected_fingerprint~'^[0-9a-f]{64}$'),
  after_protected_fingerprints jsonb not null check(jsonb_typeof(after_protected_fingerprints)='object'),
  after_protected_fingerprint text not null check(after_protected_fingerprint~'^[0-9a-f]{64}$'),
  allowed_protected_keys text[] not null check(allowed_protected_keys=array[
    'hotel_room_rates_protected','hotel_pricing_schedules',
    'hotel_schedule_tiers_protected']::text[]),
  before_stage2_fingerprints jsonb not null check(jsonb_typeof(before_stage2_fingerprints)='object'),
  before_stage2_fingerprint text not null check(before_stage2_fingerprint~'^[0-9a-f]{64}$'),
  after_stage2_fingerprints jsonb not null check(jsonb_typeof(after_stage2_fingerprints)='object'),
  after_stage2_fingerprint text not null check(after_stage2_fingerprint~'^[0-9a-f]{64}$'),
  allowed_stage2_keys text[] not null check(allowed_stage2_keys=array[
    'hotel_room_rates_protected','hotel_pricing_schedules',
    'hotel_schedule_tiers_protected']::text[]),
  core_oracle_case_count integer not null check(core_oracle_case_count=100),
  core_oracle_mismatch_count integer not null check(core_oracle_mismatch_count=0),
  guest_one_oracle_case_count integer not null check(guest_one_oracle_case_count=20),
  guest_one_oracle_mismatch_count integer not null check(guest_one_oracle_mismatch_count=0),
  total_oracle_case_count integer not null check(total_oracle_case_count=120),
  oracle_fingerprint text not null check(oracle_fingerprint~'^[0-9a-f]{32}$'),
  oracle_source_hash text not null check(oracle_source_hash~'^[0-9a-f]{64}$'),
  historical_activation_lineage jsonb not null
    check(jsonb_typeof(historical_activation_lineage)='object'),
  historical_activation_lineage_fingerprint text not null
    check(historical_activation_lineage_fingerprint~'^[0-9a-f]{64}$'),
  historical_activation_lineage_source_hash text not null
    check(historical_activation_lineage_source_hash~'^[0-9a-f]{64}$'),
  authority_fingerprint text not null check(authority_fingerprint~'^[0-9a-f]{64}$'),
  topology_fingerprint text not null check(topology_fingerprint~'^[0-9a-f]{64}$'),
  catalog_fingerprint text not null check(catalog_fingerprint~'^[0-9a-f]{64}$'),
  catalog_source_hash text not null check(catalog_source_hash~'^[0-9a-f]{64}$'),
  generic_apply_source_before_hash text not null check(generic_apply_source_before_hash~'^[0-9a-f]{64}$'),
  generic_apply_source_after_hash text not null check(generic_apply_source_after_hash~'^[0-9a-f]{64}$'),
  freeze_source_before_hash text not null check(freeze_source_before_hash~'^[0-9a-f]{64}$'),
  freeze_source_after_hash text not null check(freeze_source_after_hash~'^[0-9a-f]{64}$'),
  allocation_source_before_hash text not null check(allocation_source_before_hash~'^[0-9a-f]{64}$'),
  allocation_source_after_hash text not null check(allocation_source_after_hash~'^[0-9a-f]{64}$'),
  graph_validator_source_before_hash text not null check(graph_validator_source_before_hash~'^[0-9a-f]{64}$'),
  graph_validator_source_after_hash text not null check(graph_validator_source_after_hash~'^[0-9a-f]{64}$'),
  activation_receipt_validator_source_before_hash text not null
    check(activation_receipt_validator_source_before_hash~'^[0-9a-f]{64}$'),
  activation_receipt_validator_source_after_hash text
    check(activation_receipt_validator_source_after_hash is null
      or activation_receipt_validator_source_after_hash~'^[0-9a-f]{64}$'),
  admin_activation_get_source_before_hash text not null
    check(admin_activation_get_source_before_hash~'^[0-9a-f]{64}$'),
  admin_activation_get_source_after_hash text not null
    check(admin_activation_get_source_after_hash~'^[0-9a-f]{64}$'),
  activation_snapshot_source_before_hash text not null
    check(activation_snapshot_source_before_hash~'^[0-9a-f]{64}$'),
  activation_snapshot_source_after_hash text
    check(activation_snapshot_source_after_hash is null
      or activation_snapshot_source_after_hash~'^[0-9a-f]{64}$'),
  activation_snapshot_core_source_hash text
    check(activation_snapshot_core_source_hash is null
      or activation_snapshot_core_source_hash~'^[0-9a-f]{64}$'),
  property_fingerprint_source_before_hash text not null check(property_fingerprint_source_before_hash~'^[0-9a-f]{64}$'),
  property_fingerprint_source_after_hash text not null check(property_fingerprint_source_after_hash~'^[0-9a-f]{64}$'),
  external_fingerprint_source_hash text not null check(
    external_fingerprint_source_hash=
      'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'),
  legacy_projection_source_hash text not null check(legacy_projection_source_hash~'^[0-9a-f]{64}$'),
  topology_validator_source_hash text check(topology_validator_source_hash is null
    or topology_validator_source_hash~'^[0-9a-f]{64}$'),
  current_safe_source_hash text check(current_safe_source_hash is null
    or current_safe_source_hash~'^[0-9a-f]{64}$'),
  receipt_fingerprint text check(receipt_fingerprint is null
    or receipt_fingerprint~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  check(legacy_schedule_fingerprint_before=legacy_schedule_fingerprint_after),
  check(legacy_tier_fingerprint_before=legacy_tier_fingerprint_after),
  check(rate_nonlink_fingerprint_before=rate_nonlink_fingerprint_after),
  check(commission_fingerprint_before=commission_fingerprint_after),
  check(payment_fingerprint_before=payment_fingerprint_after),
  check(commercial_fingerprint_before=commercial_fingerprint_after),
  check(generic_apply_source_before_hash=generic_apply_source_after_hash),
  check(freeze_source_before_hash=freeze_source_after_hash),
  check(allocation_source_before_hash<>allocation_source_after_hash),
  check(graph_validator_source_before_hash<>graph_validator_source_after_hash),
  check(activation_receipt_validator_source_after_hash is null
    or activation_receipt_validator_source_before_hash<>
      activation_receipt_validator_source_after_hash),
  check(admin_activation_get_source_before_hash=admin_activation_get_source_after_hash),
  check(activation_snapshot_source_after_hash is null
    or activation_snapshot_source_before_hash<>activation_snapshot_source_after_hash),
  check(property_fingerprint_source_before_hash<>property_fingerprint_source_after_hash)
);

alter table public.hotel_seven_arches_independent_pricing_authority enable row level security;
alter table public.hotel_seven_arches_independent_pricing_topology_receipts enable row level security;
alter table public.hotel_seven_arches_independent_pricing_evolution_receipts enable row level security;
revoke all on table public.hotel_seven_arches_independent_pricing_authority,
  public.hotel_seven_arches_independent_pricing_topology_receipts,
  public.hotel_seven_arches_independent_pricing_evolution_receipts
  from public,anon,authenticated,service_role;
alter table public.hotel_seven_arches_independent_pricing_authority owner to postgres;
alter table public.hotel_seven_arches_independent_pricing_topology_receipts owner to postgres;
alter table public.hotel_seven_arches_independent_pricing_evolution_receipts owner to postgres;

-- Pin the exact relation security, raw ACL, policy, column/default, and
-- constraint envelope of all three new receipt relations.  Immutable triggers
-- are checked independently because they are installed after the bootstrap row.
create function public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()
returns text language sql stable security definer
set search_path=pg_catalog,public
as $function$
with relations(relation_id,relation_name) as (values
  ('public.hotel_seven_arches_independent_pricing_authority'::regclass,
    'hotel_seven_arches_independent_pricing_authority'),
  ('public.hotel_seven_arches_independent_pricing_topology_receipts'::regclass,
    'hotel_seven_arches_independent_pricing_topology_receipts'),
  ('public.hotel_seven_arches_independent_pricing_evolution_receipts'::regclass,
    'hotel_seven_arches_independent_pricing_evolution_receipts')
), columns(value) as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'relation',relation_row.relation_name,'attnum',attribute.attnum,
    'name',attribute.attname,'type',format_type(attribute.atttypid,attribute.atttypmod),
    'not_null',attribute.attnotnull,'identity',attribute.attidentity,
    'generated',attribute.attgenerated,
    'default',pg_get_expr(default_row.adbin,default_row.adrelid))
    order by relation_row.relation_name,attribute.attnum),'[]'::jsonb)
  from relations relation_row
  join pg_attribute attribute on attribute.attrelid=relation_row.relation_id
    and attribute.attnum>0 and not attribute.attisdropped
  left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
    and default_row.adnum=attribute.attnum
), relation_security(value) as (
  select jsonb_agg(jsonb_build_object(
    'relation',relation_row.relation_name,'owner',relation.relowner::regrole::text,
    'rls',relation.relrowsecurity,'force_rls',relation.relforcerowsecurity,
    'acl',to_jsonb(relation.relacl),
    'policies',coalesce((select jsonb_agg(jsonb_build_object(
      'name',policy.polname,'command',policy.polcmd,'permissive',policy.polpermissive,
      'roles',policy.polroles,'qual',pg_get_expr(policy.polqual,policy.polrelid),
      'with_check',pg_get_expr(policy.polwithcheck,policy.polrelid)) order by policy.polname)
      from pg_policy policy where policy.polrelid=relation_row.relation_id),'[]'::jsonb))
    order by relation_row.relation_name)
  from relations relation_row join pg_class relation on relation.oid=relation_row.relation_id
), constraints(value) as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'relation',relation_row.relation_name,'name',constraint_row.conname,
    'type',constraint_row.contype,'key',constraint_row.conkey,
    'foreign_relation',case when constraint_row.confrelid=0 then null
      else constraint_row.confrelid::regclass::text end,
    'foreign_key',constraint_row.confkey,'update_action',constraint_row.confupdtype,
    'delete_action',constraint_row.confdeltype,'match_type',constraint_row.confmatchtype,
    'deferrable',constraint_row.condeferrable,
    'initially_deferred',constraint_row.condeferred,
    'validated',constraint_row.convalidated,'no_inherit',constraint_row.connoinherit,
    'expression',pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
    'definition',pg_get_constraintdef(constraint_row.oid))
    order by relation_row.relation_name,constraint_row.conname),'[]'::jsonb)
  from relations relation_row
  join pg_constraint constraint_row on constraint_row.conrelid=relation_row.relation_id
)
select public.hotel_v2_h3_2b_hash(jsonb_build_object(
  'contract_version','hotels_v2_seven_arches_independent_pricing_catalog_v1',
  'relations',relation_security.value,'columns',columns.value,
  'constraints',constraints.value))
from relation_security cross join columns cross join constraints;
$function$;
alter function public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()
  owner to postgres;
revoke all on function public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()
  from public,anon,authenticated,service_role;

-- The reviewed H3.1P freeze remains the permanent write boundary.  Disable the
-- exact freeze triggers and their deferred graph companions before DML so no
-- pending trigger event can block the later ALTER TABLE restoration.  The
-- evolved graph validator is called explicitly after all six are restored.
alter table public.hotel_pricing_schedules
  disable trigger hotel_pricing_schedules_admin_c_graph_guard;
alter table public.hotel_pricing_schedule_occupancy_tiers
  disable trigger hotel_pricing_schedule_tiers_admin_c_graph_guard;
alter table public.hotel_room_rates
  disable trigger hotel_room_rates_admin_c_graph_guard;
alter table public.hotel_pricing_schedules
  disable trigger hotel_pricing_schedules_admin_c_h3_1p_freeze;
alter table public.hotel_pricing_schedule_occupancy_tiers
  disable trigger hotel_pricing_schedule_tiers_admin_c_h3_1p_freeze;
alter table public.hotel_room_rates
  disable trigger hotel_room_rates_admin_c_h3_1p_freeze;

insert into public.hotel_pricing_schedules(
  id,hotel_id,code,name_i18n,application_scope,currency,maximum_party_size,
  minimum_billable_occupancy,is_active,review_status,source,source_reference,sharing_mode)
select target.id,source.hotel_id,target.code,source.name_i18n,
  source.application_scope,source.currency,source.maximum_party_size,
  source.minimum_billable_occupancy,true,'reviewed','system',jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_independent_pricing_topology_v1',
    'cloned_from_schedule_id',source.id,'room_key',target.room_key,
    'room_type_id',target.room_type_id,'room_rate_id',target.room_rate_id),
  'independent'
from public.hotel_pricing_schedules source
cross join (values
  ('upper','aec20731-7a56-35f0-334e-92b363351f02'::uuid,
    'upper-apartment-independent','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
    '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid),
  ('ground','9d109336-64f3-3c57-4684-968b59c94c3b'::uuid,
    'ground-apartment-independent','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,
    '3320590d-632d-423f-80d0-fd021cba7293'::uuid)
) target(room_key,id,code,room_type_id,room_rate_id)
where source.id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid;

insert into public.hotel_pricing_schedule_occupancy_tiers(
  id,schedule_id,guest_count,threshold_nights,nightly_rate,is_active)
select md5('hotels_v2_7a_independent_tier_v1:'||target.room_key||':'||
    source.guest_count::text||':'||source.threshold_nights::text)::uuid,
  target.schedule_id,source.guest_count,source.threshold_nights,
  source.nightly_rate,source.is_active
from public.hotel_pricing_schedule_occupancy_tiers source
cross join (values
  ('upper','aec20731-7a56-35f0-334e-92b363351f02'::uuid),
  ('ground','9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)
) target(room_key,schedule_id)
where source.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
  and source.is_active;

insert into public.hotel_seven_arches_independent_pricing_authority(
  target_tier_id,contract_version,room_key,hotel_id,room_type_id,room_rate_id,
  rate_plan_id,currency,source_schedule_id,source_tier_id,independent_schedule_id,
  guest_count,threshold_nights,initial_nightly_rate,source_tier_version,
  target_initial_version,source_is_active,target_initial_is_active)
select target.id,'hotels_v2_seven_arches_independent_pricing_authority_v1',
  mapping.room_key,'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
  mapping.room_type_id,mapping.room_rate_id,rate.rate_plan_id,btrim(rate.currency::text),
  source.schedule_id,source.id,target.schedule_id,target.guest_count,
  target.threshold_nights,target.nightly_rate,source.version,target.version,
  source.is_active,target.is_active
from public.hotel_pricing_schedule_occupancy_tiers target
join (values
  ('upper','aec20731-7a56-35f0-334e-92b363351f02'::uuid,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
    '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid),
  ('ground','9d109336-64f3-3c57-4684-968b59c94c3b'::uuid,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,
    '3320590d-632d-423f-80d0-fd021cba7293'::uuid)
) mapping(room_key,schedule_id,room_type_id,room_rate_id)
  on mapping.schedule_id=target.schedule_id
join public.hotel_room_rates rate on rate.id=mapping.room_rate_id
join public.hotel_pricing_schedule_occupancy_tiers source
  on source.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
 and source.guest_count=target.guest_count
 and source.threshold_nights=target.threshold_nights;

update public.hotel_room_rates set pricing_schedule_id=case id
  when '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
    then 'aec20731-7a56-35f0-334e-92b363351f02'::uuid
  when '3320590d-632d-423f-80d0-fd021cba7293'::uuid
    then '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid end
where id in('7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
  '3320590d-632d-423f-80d0-fd021cba7293'::uuid);

alter table public.hotel_room_rates
  enable trigger hotel_room_rates_admin_c_h3_1p_freeze;
alter table public.hotel_room_rates
  enable trigger hotel_room_rates_admin_c_graph_guard;
alter table public.hotel_pricing_schedule_occupancy_tiers
  enable trigger hotel_pricing_schedule_tiers_admin_c_h3_1p_freeze;
alter table public.hotel_pricing_schedule_occupancy_tiers
  enable trigger hotel_pricing_schedule_tiers_admin_c_graph_guard;
alter table public.hotel_pricing_schedules
  enable trigger hotel_pricing_schedules_admin_c_h3_1p_freeze;
alter table public.hotel_pricing_schedules
  enable trigger hotel_pricing_schedules_admin_c_graph_guard;

insert into public.hotel_seven_arches_independent_pricing_topology_receipts(
  room_key,contract_version,room_type_id,room_rate_id,source_schedule_id,
  independent_schedule_id,independent_schedule_code,source_tier_count,
  target_tier_count,source_tier_fingerprint,target_initial_tier_fingerprint,
  source_schedule_fingerprint,target_schedule_fingerprint,authority_fingerprint)
select mapping.room_key,'hotels_v2_seven_arches_independent_pricing_topology_v1',
  mapping.room_type_id,mapping.room_rate_id,
  'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,mapping.schedule_id,mapping.code,
  (select count(*) from public.hotel_pricing_schedule_occupancy_tiers source
    where source.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid and source.is_active),
  (select count(*) from public.hotel_pricing_schedule_occupancy_tiers target
    where target.schedule_id=mapping.schedule_id and target.is_active),
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(jsonb_build_object(
      'guest_count',source.guest_count,'threshold_nights',source.threshold_nights,
      'nightly_rate',source.nightly_rate,'currency',btrim(schedule.currency::text),
      'is_active',source.is_active,'version',source.version)
      order by source.guest_count,source.threshold_nights)
    from public.hotel_pricing_schedule_occupancy_tiers source
    join public.hotel_pricing_schedules schedule on schedule.id=source.schedule_id
    where source.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),'[]'::jsonb)),
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(jsonb_build_object(
      'guest_count',target.guest_count,'threshold_nights',target.threshold_nights,
      'nightly_rate',target.nightly_rate,'currency',btrim(schedule.currency::text),
      'is_active',target.is_active,'version',target.version)
      order by target.guest_count,target.threshold_nights)
    from public.hotel_pricing_schedule_occupancy_tiers target
    join public.hotel_pricing_schedules schedule on schedule.id=target.schedule_id
    where target.schedule_id=mapping.schedule_id),'[]'::jsonb)),
  public.hotel_v2_h3_2b_hash((select jsonb_build_object(
      'name_i18n',schedule.name_i18n,'application_scope',schedule.application_scope,
      'currency',btrim(schedule.currency::text),
      'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
      'maximum_party_size',schedule.maximum_party_size,'is_active',schedule.is_active,
      'review_status',schedule.review_status,'source',schedule.source,
      'sharing_mode',schedule.sharing_mode,'version',schedule.version)
    from public.hotel_pricing_schedules schedule
    where schedule.id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid)),
  public.hotel_v2_h3_2b_hash((select jsonb_build_object(
      'name_i18n',schedule.name_i18n,'application_scope',schedule.application_scope,
      'currency',btrim(schedule.currency::text),
      'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
      'maximum_party_size',schedule.maximum_party_size,'is_active',schedule.is_active,
      'review_status',schedule.review_status,'source',schedule.source,
      'sharing_mode',schedule.sharing_mode,'version',schedule.version)
    from public.hotel_pricing_schedules schedule where schedule.id=mapping.schedule_id)),
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(authority)-'created_at' order by authority.target_tier_id)
    from public.hotel_seven_arches_independent_pricing_authority authority
    where authority.room_key=mapping.room_key),'[]'::jsonb))
from (values
  ('upper','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
    '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
    'aec20731-7a56-35f0-334e-92b363351f02'::uuid,'upper-apartment-independent'),
  ('ground','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,
    '3320590d-632d-423f-80d0-fd021cba7293'::uuid,
    '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid,'ground-apartment-independent')
) mapping(room_key,room_type_id,room_rate_id,schedule_id,code);

-- Preserve the public H3.1P preview signature and output shape, but resolve
-- each allocation item through the exact schedule currently linked to that
-- room rate.  The legacy matrix remains the comparison oracle only.
create or replace function public.hotel_v2_h3_1p_allocation_preview(p_hotel_id uuid)
returns jsonb
language sql
stable
set search_path=pg_catalog,public
as $function$
with
durations(nights) as (
  values (2),(3),(4),(5),(6),(7),(8),(9),(10),(14)
),
requested(guest_count) as (
  select generate_series(1,8)
),
matched_rules as (
  select requested.guest_count,rule.id rule_id,rule.allocation_mode
  from requested
  join public.hotel_room_allocation_rules rule
    on rule.hotel_id=p_hotel_id
   and rule.is_active and rule.review_status='reviewed'
   and requested.guest_count between rule.min_guest_count and rule.max_guest_count
),
numbered_items as (
  select matched.guest_count,matched.rule_id,matched.allocation_mode,
    case when matched.allocation_mode='customer_choice'
      then row_number() over(partition by matched.guest_count order by item.sort_order,item.id)
      else 1 end option_number,
    item.id item_id,item.room_type_id,item.units_required,item.allocated_guest_count,
    case when matched.allocation_mode='customer_choice' then null::smallint
      else public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id)
    end pricing_guest_count,
    case when matched.allocation_mode='customer_choice'
      then greatest(matched.guest_count,schedule.minimum_billable_occupancy)::smallint
      else public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id)
    end resolved_pricing_guest_count,
    room_type.name_i18n room_name,
    room_rate.id room_rate_id,room_rate.rate_plan_id,room_rate.pricing_schedule_id,
    btrim(schedule.currency::text) currency,
    item.sort_order
  from matched_rules matched
  join public.hotel_room_allocation_rules rule on rule.id=matched.rule_id
  join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
  join public.hotel_room_types room_type
    on room_type.id=item.room_type_id and room_type.hotel_id=rule.hotel_id
  join public.hotel_room_rates room_rate
    on room_rate.room_type_id=item.room_type_id and room_rate.hotel_id=rule.hotel_id
   and room_rate.rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
   and room_rate.id=case item.room_type_id
     when 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
       then '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
     when '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
       then '3320590d-632d-423f-80d0-fd021cba7293'::uuid
     else null::uuid end
   and room_rate.pricing_schedule_id=case item.room_type_id
     when 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
       then 'aec20731-7a56-35f0-334e-92b363351f02'::uuid
     when '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
       then '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid
     else null::uuid end
  join public.hotel_pricing_schedules schedule on schedule.id=room_rate.pricing_schedule_id
),
priced_rows as (
  select item.guest_count,item.allocation_mode,item.option_number,item.item_id,
    item.room_type_id,item.room_rate_id,item.rate_plan_id,item.pricing_schedule_id,
    item.currency,item.units_required,item.allocated_guest_count,
    item.pricing_guest_count,item.resolved_pricing_guest_count,item.room_name,item.sort_order,
    duration.nights,
    room_tier.threshold_nights,room_tier.nightly_rate,
    legacy_tier.nightly_rate legacy_nightly_rate
  from numbered_items item
  cross join durations duration
  left join lateral (
    select tier.threshold_nights,tier.nightly_rate
    from public.hotel_pricing_schedule_occupancy_tiers tier
    where tier.schedule_id=item.pricing_schedule_id
      and tier.is_active
      and tier.guest_count=item.resolved_pricing_guest_count
      and tier.threshold_nights<=duration.nights
    order by tier.threshold_nights desc,tier.id
    limit 1
  ) room_tier on true
  left join lateral (
    select (legacy.value->>'price_per_night')::numeric nightly_rate
    from public.hotels hotel
    cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') legacy(value)
    where hotel.id=p_hotel_id
      and (legacy.value->>'persons')::integer=greatest(item.guest_count,2)
      and (legacy.value->>'min_nights')::integer<=duration.nights
    order by (legacy.value->>'min_nights')::integer desc
    limit 1
  ) legacy_tier on true
),
comparisons as (
  select priced.guest_count,priced.allocation_mode,priced.option_number,priced.nights,
    max(priced.threshold_nights)::integer threshold_nights,
    case when count(*)=1 then max(priced.resolved_pricing_guest_count)::integer else null end priced_occupancy,
    jsonb_agg(jsonb_build_object(
      'room_type_id',priced.room_type_id,
      'room_rate_id',priced.room_rate_id,
      'pricing_guest_count',priced.resolved_pricing_guest_count,
      'nightly_rate',priced.nightly_rate
    ) order by priced.sort_order,priced.item_id) room_nightly_rates,
    max(priced.legacy_nightly_rate) legacy_nightly_rate,
    sum(priced.nightly_rate) room_rate_sum
  from priced_rows priced
  group by priced.guest_count,priced.allocation_mode,priced.option_number,priced.nights
),
option_rows as (
  select distinct item.guest_count,item.allocation_mode,item.option_number
  from numbered_items item
),
options as (
  select option_row.guest_count,option_row.allocation_mode,option_row.option_number,
    (select jsonb_agg(jsonb_build_object(
      'room_type_id',item.room_type_id,
      'room_rate_id',item.room_rate_id,
      'room_name',item.room_name,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count,
      'units_required',item.units_required
    ) order by item.sort_order,item.item_id)
      from numbered_items item
      where item.guest_count=option_row.guest_count
        and item.option_number=option_row.option_number
    ) allocation,
    (select jsonb_agg(jsonb_build_object(
      'nights',comparison.nights,
      'threshold_nights',comparison.threshold_nights,
      'requested_guest_count',comparison.guest_count,
      'priced_occupancy',comparison.priced_occupancy,
      'room_nightly_rates',comparison.room_nightly_rates,
      'legacy_nightly_rate',comparison.legacy_nightly_rate,
      'room_rate_sum',comparison.room_rate_sum,
      'stay_total',comparison.room_rate_sum*comparison.nights,
      'currency','EUR'
    ) order by comparison.nights)
      from comparisons comparison
      where comparison.guest_count=option_row.guest_count
        and comparison.option_number=option_row.option_number
    ) nightly_comparisons
  from option_rows option_row
),
preview_rows as (
  select requested.guest_count,matched.allocation_mode,
    coalesce(jsonb_agg(jsonb_build_object(
      'allocation',options.allocation,
      'nightly_comparisons',options.nightly_comparisons
    ) order by options.option_number) filter(where options.option_number is not null),'[]'::jsonb) options
  from requested
  left join matched_rules matched on matched.guest_count=requested.guest_count
  left join options on options.guest_count=requested.guest_count
  group by requested.guest_count,matched.allocation_mode
)
select coalesce(jsonb_agg(jsonb_build_object(
  'guest_count',preview.guest_count,
  'allocation_mode',preview.allocation_mode,
  'options',preview.options
) order by preview.guest_count),'[]'::jsonb)
from preview_rows preview;
$function$;

create function public.hotel_v2_seven_arches_independent_pricing_oracle()
returns jsonb language sql stable security definer
set search_path=pg_catalog,public
as $function$
with preview as (
  select public.hotel_v2_h3_1p_allocation_preview(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) value
), cases as (
  select (entry.value->>'guest_count')::integer requested_guest_count,
    option.ordinality::integer option_number,
    (comparison.value->>'nights')::integer nights,
    option.value->'allocation' allocation,comparison.value comparison
  from preview
  cross join lateral jsonb_array_elements(preview.value) entry(value)
  cross join lateral jsonb_array_elements(entry.value->'options')
    with ordinality option(value,ordinality)
  cross join lateral jsonb_array_elements(option.value->'nightly_comparisons') comparison(value)
), normalized as (
  select requested_guest_count,option_number,nights,
    (comparison->>'legacy_nightly_rate')::numeric legacy_nightly_rate,
    (comparison->>'room_rate_sum')::numeric room_rate_sum,
    (comparison->>'stay_total')::numeric stay_total,
    comparison->>'currency' currency,
    comparison->'room_nightly_rates' room_nightly_rates,
    (select jsonb_agg(jsonb_build_object(
      'room_type_id',room.value->>'room_type_id',
      'room_rate_id',rate.id,'rate_plan_id',rate.rate_plan_id,
      'pricing_schedule_id',rate.pricing_schedule_id,
      'currency',btrim(rate.currency::text),
      'pricing_guest_count',(room.value->>'pricing_guest_count')::integer,
      'nightly_rate',(room.value->>'nightly_rate')::numeric)
      order by room.ordinality)
      from jsonb_array_elements(comparison->'room_nightly_rates')
        with ordinality room(value,ordinality)
      join public.hotel_room_rates rate
        on rate.id=(room.value->>'room_rate_id')::uuid) commercial_room_evidence,
    allocation,
    (select sum((item.value->>'units_required')::integer)
      from jsonb_array_elements(allocation) item(value)) allocated_room_count,
    not exists(select 1 from jsonb_array_elements(comparison->'room_nightly_rates') room(value)
      where (room.value->>'pricing_guest_count')::integer<>
        case when requested_guest_count=1 then 2
          else (room.value->>'pricing_guest_count')::integer end) pricing_floor_exact
  from cases
), summary as (
  select
    count(*) filter(where requested_guest_count between 2 and 8)::integer core_case_count,
    count(*) filter(where requested_guest_count between 2 and 8 and (
      room_rate_sum is distinct from legacy_nightly_rate
      or stay_total is distinct from legacy_nightly_rate*nights))::integer core_mismatch_count,
    count(*) filter(where requested_guest_count=1)::integer guest_one_case_count,
    count(*) filter(where requested_guest_count=1 and (
      not pricing_floor_exact or room_rate_sum is distinct from legacy_nightly_rate
      or stay_total is distinct from legacy_nightly_rate*nights))::integer guest_one_mismatch_count,
    count(*)::integer total_case_count,
    md5(coalesce(string_agg(jsonb_build_object(
      'requested_guest_count',requested_guest_count,'option_number',option_number,
      'nights',nights,'legacy_nightly_rate',legacy_nightly_rate,
      'room_rate_sum',room_rate_sum,'stay_total',stay_total,
      'currency',currency,'allocation',allocation,
      'room_nightly_rates',room_nightly_rates,
      'commercial_room_evidence',commercial_room_evidence,
      'commission_total',allocated_room_count*10*nights,
      'partner_net',stay_total-allocated_room_count*10*nights,
      'pricing_floor_exact',pricing_floor_exact
    )::text,'|' order by requested_guest_count,option_number,nights),'')) fingerprint
  from normalized
)
select jsonb_build_object(
  'contract_version','hotels_v2_seven_arches_independent_pricing_oracle_v1',
  'core_case_count',core_case_count,'core_mismatch_count',core_mismatch_count,
  'guest_one_case_count',guest_one_case_count,
  'guest_one_mismatch_count',guest_one_mismatch_count,
  'total_case_count',total_case_count,'fingerprint',fingerprint)
from summary;
$function$;

-- Keep the generic validator OID and every general invariant.  Evolve only
-- the two exact 7 Arches activation clauses: the installed reviewed topology
-- is proven by current-safe, and the two receipt-bound schedule IDs are no
-- longer classified as unknown future pricing.
do $seven_arches_independent_pricing_validator_patch$
declare v_source text; v_old text; v_new text; v_count integer; v_oid oid;
begin
  v_oid:='public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure;
  select pg_get_functiondef(v_oid) into v_source;
  if (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
      from pg_proc where oid=v_oid) is distinct from
       'f3be020f35a990bc012ffd1adff2f8a7b4b1d3e8ba2f6f5e51c41f4917a6195d'
     or not exists(select 1 from pg_proc where oid=v_oid
       and proowner='postgres'::regrole and prosecdef and provolatile='v'
       and proconfig=array['search_path=pg_catalog, public']::text[])
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_validator_prior_source_drift';
  end if;
  v_old:='and public.hotel_v2_seven_arches_pricing_activation_state_is_exact() is not true';
  v_new:='and public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true';
  v_count:=(length(v_source)-length(replace(v_source,v_old,'')))/length(v_old);
  if v_count<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_validator_activation_source_drift';
  end if;
  v_source:=replace(v_source,v_old,v_new);
  v_old:=$needle$and id not in('b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
        '443065c0-984a-5de3-a22a-d03042c41107'::uuid)$needle$;
  v_new:=$replacement$and id not in('b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
        '443065c0-984a-5de3-a22a-d03042c41107'::uuid,
        'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
        '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)$replacement$;
  v_count:=(length(v_source)-length(replace(v_source,v_old,'')))/length(v_old);
  if v_count<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_validator_schedule_source_drift',
      detail=jsonb_build_object('actual_count',v_count)::text;
  end if;
  execute replace(v_source,v_old,v_new);
  if (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
      from pg_proc where oid=v_oid) is distinct from
       '03f787a5e00fbbe65bdcaf1a96529512f60775074a1fdf4dcdd04104c7c7d335'
     or not exists(select 1 from pg_proc where oid=v_oid
       and proowner='postgres'::regrole and prosecdef and provolatile='v'
       and proconfig=array['search_path=pg_catalog, public']::text[])
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_validator_evolved_source_drift';
  end if;
end
$seven_arches_independent_pricing_validator_patch$;

create temporary table seven_arches_independent_pricing_after on commit drop as
select
  (select count(*)::integer from public.hotel_pricing_schedules
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) schedule_count,
  (select count(*)::integer from public.hotel_pricing_schedule_occupancy_tiers tier
    join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
    where schedule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) tier_count,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(schedule)-array['created_at','updated_at'] order by schedule.id)
    from public.hotel_pricing_schedules schedule where schedule.id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb)) legacy_schedule_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(tier)-array['created_at','updated_at'] order by tier.id)
    from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb)) legacy_tier_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(rate)-array['pricing_schedule_id','version','created_at','updated_at'] order by rate.id)
    from public.hotel_room_rates rate where rate.id in(
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid)),'[]'::jsonb)) rate_nonlink_fingerprint,
  (select version from public.hotel_room_rates
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid) upper_rate_version,
  (select updated_at from public.hotel_room_rates
    where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid) upper_rate_updated_at,
  (select version from public.hotel_room_rates
    where id='3320590d-632d-423f-80d0-fd021cba7293'::uuid) ground_rate_version,
  (select updated_at from public.hotel_room_rates
    where id='3320590d-632d-423f-80d0-fd021cba7293'::uuid) ground_rate_updated_at,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
      to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
    from public.hotel_commission_policies policy
    where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)) commission_fingerprint,
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
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() protected_fingerprints,
  jsonb_set(jsonb_set(jsonb_set(before_row.stage2_fingerprints,
    '{hotel_room_rates_protected}',raw_stage2.value->'hotel_room_rates_protected',false),
    '{hotel_pricing_schedules}',raw_stage2.value->'hotel_pricing_schedules',false),
    '{hotel_schedule_tiers_protected}',raw_stage2.value->'hotel_schedule_tiers_protected',false)
    stage2_fingerprints,
  public.hotel_v2_seven_arches_independent_pricing_oracle() oracle,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)'::regprocedure))) generic_apply_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure))) freeze_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_h3_1p_allocation_preview(uuid)'::regprocedure))) allocation_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure))) graph_validator_source_hash
from seven_arches_independent_pricing_before before_row
cross join lateral (select public.hotel_v2_external_calendar_protected_fingerprints() value)
  raw_stage2;

-- A source-pinned successor normalization exposes the exact pre-114410 values
-- of the three topology keys to historical wrappers while proving the live raw
-- property map equals the immutable 114410 AFTER map.  Provider evolution is a
-- later successor boundary and must explicitly evolve this Phase-1 proof.
create function public.hotel_v2_seven_arches_independent_pricing_legacy_projection()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_receipt public.hotel_seven_arches_independent_pricing_evolution_receipts%rowtype;
  v_activation public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_task2 public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_task2_foundation public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_current jsonb:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_current_normalized jsonb;
  v_lineage jsonb;
  v_scoped_lineage jsonb;
  v_site_settings_lifecycle jsonb:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false);
  v_canonical_site_settings_fingerprint text;
  v_raw_site_settings_fingerprint text;
begin
  if (select count(*) from public.hotel_seven_arches_independent_pricing_evolution_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<>1
     or (select count(*)
       from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*) from public.site_settings)<>1
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context) then
    return null;
  end if;
  select * into strict v_receipt
  from public.hotel_seven_arches_independent_pricing_evolution_receipts where id=1;
  select * into strict v_activation
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  select * into strict v_task2
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  select * into strict v_task2_foundation
  from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  v_lineage:=public.hotel_v2_seven_arches_independent_pricing_activation_lineage();
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_current:=v_current||jsonb_build_object(
    'hotels',md5(pg_catalog.query_to_xml($query$
      select case when hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
        (to_jsonb(hotel)-array['title','title_i18n','description','description_i18n','city',
          'address_line','district','postal_code','country','latitude','longitude',
          'google_maps_url','amenities','check_in_from','check_out_until',
          'cover_image_url','photos','updated_at'])::text
        else to_jsonb(hotel)::text end
      from public.hotels hotel order by hotel.id$query$,true,true,'')::text),
    'non_h3_2b_activity',md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from 'hotels_v2_h3_2b_partner_workspace'
        and activity.source is distinct from 'hotels_v2_h3_2b_property_proposal_admin_review'
        and not (activity.source='hotels_v2_admin_b_property_control' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action='accept' and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'')::text));
  v_canonical_site_settings_fingerprint:=
    public.hotel_v2_external_calendar_worker_hash(v_site_settings_lifecycle);
  v_raw_site_settings_fingerprint:=md5(pg_catalog.query_to_xml($query$
    select to_jsonb(row_value)::text
    from public.site_settings row_value
    order by to_jsonb(row_value)::text$query$,true,true,'')::text);
  v_current_normalized:=jsonb_set(v_current,'{site_settings}',
    to_jsonb(v_canonical_site_settings_fingerprint),false);
  if v_receipt.contract_version is distinct from
       'hotels_v2_seven_arches_independent_pricing_evolution_v1'
     or jsonb_typeof(v_lineage) is distinct from 'object'
     or jsonb_typeof(v_lineage->'lower_catalog') is distinct from 'array'
     or jsonb_typeof(v_lineage->'lower_schema_security') is distinct from 'object'
     or jsonb_typeof(v_lineage->'lower_function_security') is distinct from 'array'
     or v_lineage->>'workspace_lineage_exact' is distinct from 'true'
     or v_lineage->>'property_attribution_exact' is distinct from 'true'
     or v_lineage->>'scoped_hotels_lineage_exact' is distinct from 'true'
     or v_lineage->>'scoped_hotels_lineage_source_hash' is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
     or v_lineage->>'transaction_preservation_exact' is distinct from 'true'
     or v_lineage->>'transaction_preservation_source_hash' is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)))
     or jsonb_typeof(v_scoped_lineage) is distinct from 'object'
     or v_scoped_lineage->>'contract_version' is distinct from
       'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
     or (select count(*) from jsonb_object_keys(v_scoped_lineage))<>21
     or (v_scoped_lineage ?& array[
       'contract_version','hotel_id','partner_id','assignment_id','owner_user_ids',
       'owner_membership_fingerprint','permission_preset_fingerprint',
       'property_business_fingerprint','room_identity_fingerprint',
       'pricing_identity_fingerprint','allocation_contract_exact','parity_case_count',
       'parity_mismatch_count','parity_fingerprint','commission_policy_fingerprint',
       'payment_policy_fingerprint','site_settings_lifecycle',
       'site_settings_lifecycle_fingerprint','owner_capability_receipt_fingerprint',
       'property_foundation_receipt_fingerprint','lower_function_security_fingerprint'
     ]::text[]) is not true
     or v_scoped_lineage->>'hotel_id' is distinct from
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
     or v_scoped_lineage->>'allocation_contract_exact' is distinct from 'true'
     or (v_scoped_lineage->>'parity_case_count')::integer<>70
     or (v_scoped_lineage->>'parity_mismatch_count')::integer<>0
     or v_scoped_lineage->'site_settings_lifecycle' is distinct from
       v_site_settings_lifecycle
     or v_scoped_lineage->>'site_settings_lifecycle_fingerprint' is distinct from
       v_canonical_site_settings_fingerprint
     or exists(select 1 from jsonb_each_text(v_scoped_lineage) entry
       where entry.key in('owner_membership_fingerprint',
         'permission_preset_fingerprint','property_business_fingerprint',
         'room_identity_fingerprint','pricing_identity_fingerprint',
         'commission_policy_fingerprint','payment_policy_fingerprint',
         'owner_capability_receipt_fingerprint','property_foundation_receipt_fingerprint',
         'lower_function_security_fingerprint')
         and (entry.value~'^[0-9a-f]{64}$') is distinct from true)
     or (v_scoped_lineage->>'parity_fingerprint'~'^[0-9a-f]{32}$')
       is distinct from true
     or v_lineage->>'provider_attribution_exact' is distinct from 'true'
     or v_lineage->>'activation_context_empty' is distinct from 'true'
     or v_lineage->'site_settings_lifecycle' is distinct from
       v_site_settings_lifecycle
     or v_lineage->>'site_settings_lifecycle_fingerprint' is distinct from
       v_canonical_site_settings_fingerprint
     or v_receipt.historical_activation_lineage_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.historical_activation_lineage)
     or v_receipt.historical_activation_lineage_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'::regprocedure)))
     or not exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_rooms_v2_enabled is not distinct from false
       and setting.hotel_external_sync_enabled is not null
       and setting.hotel_instant_booking_enabled is not distinct from false
       and setting.hotel_stripe_connect_enabled is not distinct from false)
     or v_canonical_site_settings_fingerprint is distinct from
       '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'
     or v_raw_site_settings_fingerprint is null
     or (v_raw_site_settings_fingerprint~'^[0-9a-f]{32}$') is distinct from true
     or v_current->'site_settings' is distinct from
       to_jsonb(v_raw_site_settings_fingerprint)
     or public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true
     or public.hotel_v2_external_calendar_provider_sources_are_attributable()
       is not true
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or v_task2_foundation.stage2_compatibility_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure)))
     or v_task2_foundation.partner_workspace_lineage_validator_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_partner_workspace_function_lineage_is_exact()'::regprocedure)))
     or v_task2_foundation.provider_source_attribution_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure)))
     or v_activation.inert_snapshot_source_hash is distinct from
       encode(extensions.digest(convert_to(pg_get_functiondef(
         'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)'::regprocedure),
         'UTF8'),'sha256'),'hex')
     or v_activation.canonical_snapshot_source_hash is distinct from
       encode(extensions.digest(convert_to(pg_get_functiondef(
         'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'::regprocedure),
         'UTF8'),'sha256'),'hex')
     or v_activation.state_validator_source_hash is distinct from
       encode(extensions.digest(convert_to(pg_get_functiondef(
         'public.hotel_v2_seven_arches_pricing_activation_state_is_exact()'::regprocedure),
         'UTF8'),'sha256'),'hex')
     or exists(select 1 from (values
       ('public.hotel_v2_admin_d_protected_fingerprints()',
         'a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4'),
       ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',
         'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),
       ('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()',
         '860f2f7b4249a8b572780384628f9654f087eb73850d0a8fe37a1e2c7c5781e8')
       ) expected(signature,source_hash)
       left join pg_proc procedure_row on procedure_row.oid=
         to_regprocedure(expected.signature)
       where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
         or procedure_row.prosecdef is not true or procedure_row.provolatile<>'s'
         or procedure_row.proconfig is distinct from
           array['search_path=pg_catalog, public']::text[]
         or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
           is distinct from expected.source_hash
         or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or exists(select 1 from (values
       ('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'),
       ('public.hotel_v2_external_calendar_provider_sources_are_attributable()')
       ) expected(signature)
       left join pg_proc procedure_row on procedure_row.oid=
         to_regprocedure(expected.signature)
       where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
         or procedure_row.prosecdef is not true or procedure_row.provolatile<>'s'
         or procedure_row.proconfig is distinct from
           array['search_path=pg_catalog, public']::text[]
         or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or exists(select 1 from (values
       ('public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)',false),
       ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',false),
       ('public.hotel_v2_seven_arches_pricing_activation_state_is_exact()',true)
       ) expected(signature,security_definer)
       left join pg_proc procedure_row on procedure_row.oid=
         to_regprocedure(expected.signature)
       where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
         or procedure_row.prosecdef is distinct from expected.security_definer
         or procedure_row.provolatile<>'s'
         or procedure_row.proconfig is distinct from
           array['search_path=pg_catalog, public']::text[]
         or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or exists(select 1 from (values
       ('public.hotel_v2_h3_1p_parity_snapshot(uuid)',
         'f4811812d61e75a7ba5634cdd555b0c608f6a12bf65b4aae745bd1dd007d0b9e'),
       ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',
         '3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35')
       ) expected(signature,source_hash)
       left join pg_proc procedure_row on procedure_row.oid=
         to_regprocedure(expected.signature)
       where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
         or procedure_row.prosecdef is not false or procedure_row.provolatile<>'s'
         or procedure_row.proconfig is distinct from
           array['search_path=pg_catalog, public']::text[]
         or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
           is distinct from expected.source_hash
         or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or exists(select 1 from (values
       ('public.hotel_v2_h3_2b_hash(jsonb)',false,'i'::"char",
         array['search_path=pg_catalog']::text[],
         'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
       ('public.hotel_v2_h3_2b_protected_fingerprints()',true,'s'::"char",
         array['search_path=pg_catalog, public']::text[],
         '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'),
       ('public.hotel_v2_admin_d_immutable_row()',false,'v'::"char",
         array['search_path=pg_catalog']::text[],
         'bf10c8d2393ef28580dc1079c3b07f0985c6676cce1e5792460aedc6c1453bfa'),
       ('public.hotel_v2_h3_2b_immutable_row()',false,'v'::"char",
         array['search_path=pg_catalog']::text[],
         'b461f8218dc31b9d5cce8ea6893593c9ce058a04dd38e5a2271c7aec2654cc3e'),
       ('public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()',true,'v'::"char",
         array['search_path=pg_catalog, public']::text[],
         '352e7e040c99044f0fb01b03656a9f3193694039afd0079567c25fb3967bbbd0'),
       ('public.hotel_v2_seven_arches_pricing_activation_context_guard()',true,'v'::"char",
         array['search_path=pg_catalog, public, auth']::text[],
         '6e9893cd347504be63ab5699e02a592f6e81355c5b31da31ccaca2dd6ee9c5f0'),
       ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,'i'::"char",
         array['search_path=pg_catalog']::text[],
         'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
       ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
         's'::"char",array['search_path=pg_catalog, public']::text[],
         'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'),
       ('public.hotel_v2_h3_2a_reject_immutable_change()',false,'v'::"char",
         array['search_path=pg_catalog, public']::text[],
         '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c')
       ) expected(signature,security_definer,volatility,path,source_hash)
       left join pg_proc procedure_row on procedure_row.oid=
         to_regprocedure(expected.signature)
       where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
         or procedure_row.prosecdef is distinct from expected.security_definer
         or procedure_row.provolatile is distinct from expected.volatility
         or procedure_row.proconfig is distinct from expected.path
         or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
           is distinct from expected.source_hash
         or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_namespace namespace_row where namespace_row.oid=
       'hotels_v2_private'::regnamespace
       and namespace_row.nspowner='postgres'::regrole)
     or has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
     or has_schema_privilege('anon','hotels_v2_private','USAGE')
     or has_schema_privilege('service_role','hotels_v2_private','USAGE')
     or has_schema_privilege(0::oid,'hotels_v2_private','CREATE')
     or has_schema_privilege('anon','hotels_v2_private','CREATE')
     or has_schema_privilege('authenticated','hotels_v2_private','CREATE')
     or has_schema_privilege('service_role','hotels_v2_private','CREATE')
     or v_receipt.admin_d_protected_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.admin_d_protected_fingerprints_before)
     or v_receipt.admin_d_protected_fingerprint_after is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.admin_d_protected_fingerprints_after)
     or v_receipt.admin_d_allowed_protected_keys is distinct from array[
       'hotel_room_rates','hotel_pricing_schedules',
       'hotel_pricing_schedule_occupancy_tiers']::text[]
     or (v_receipt.admin_d_protected_fingerprints_after-
       v_receipt.admin_d_allowed_protected_keys) is distinct from
       (v_receipt.admin_d_protected_fingerprints_before-
       v_receipt.admin_d_allowed_protected_keys)
     or exists(select 1 from unnest(
       v_receipt.admin_d_allowed_protected_keys) changed(key)
       where v_receipt.admin_d_protected_fingerprints_before->changed.key is null
         or v_receipt.admin_d_protected_fingerprints_after->changed.key is null
         or v_receipt.admin_d_protected_fingerprints_before->changed.key is not distinct from
           v_receipt.admin_d_protected_fingerprints_after->changed.key)
     or v_receipt.before_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.before_protected_fingerprints)
     or v_receipt.after_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.after_protected_fingerprints)
     or v_receipt.before_stage2_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.before_stage2_fingerprints)
     or v_receipt.after_stage2_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.after_stage2_fingerprints)
     or v_receipt.allowed_protected_keys is distinct from array[
       'hotel_room_rates_protected','hotel_pricing_schedules',
       'hotel_schedule_tiers_protected']::text[]
     or v_receipt.allowed_stage2_keys is distinct from array[
       'hotel_room_rates_protected','hotel_pricing_schedules',
       'hotel_schedule_tiers_protected']::text[]
     or (v_receipt.after_protected_fingerprints-v_receipt.allowed_protected_keys)
       is distinct from
       (v_receipt.before_protected_fingerprints-v_receipt.allowed_protected_keys)
     or (v_receipt.after_stage2_fingerprints-v_receipt.allowed_stage2_keys)
       is distinct from
       (v_receipt.before_stage2_fingerprints-v_receipt.allowed_stage2_keys)
     or exists(select 1 from unnest(v_receipt.allowed_protected_keys) changed(key)
       where v_receipt.after_protected_fingerprints->changed.key is null
         or v_receipt.before_protected_fingerprints->changed.key is null
         or v_receipt.after_protected_fingerprints->changed.key
           is not distinct from v_receipt.before_protected_fingerprints->changed.key)
     or exists(select 1 from unnest(v_receipt.allowed_stage2_keys) changed(key)
       where v_receipt.after_stage2_fingerprints->changed.key is null
         or v_receipt.before_stage2_fingerprints->changed.key is null
         or v_receipt.after_stage2_fingerprints->changed.key
           is not distinct from v_receipt.before_stage2_fingerprints->changed.key)
     or v_receipt.before_protected_fingerprints->'site_settings' is null
     or v_receipt.after_protected_fingerprints->'site_settings' is distinct from
       v_receipt.before_protected_fingerprints->'site_settings'
     or v_receipt.before_stage2_fingerprints->'site_settings' is distinct from
       v_receipt.before_protected_fingerprints->'site_settings'
     or v_receipt.after_stage2_fingerprints->'site_settings' is distinct from
       v_receipt.before_protected_fingerprints->'site_settings'
     -- The activation receipt owns its full lock-first BEFORE/AFTER evidence.
     -- Link it by the exact preservation contract; do not equate its broad
     -- live map with the later topology transaction's independently locked map.
     or v_activation.transaction_preservation_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)))
     or v_task2.contract_version is distinct from
       'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
     or v_task2.created_at is null or not isfinite(v_task2.created_at)
     or v_task2.canonical_task2_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_task2.canonical_task2_protected_fingerprints)
     or v_task2.canonical_stage2_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_task2.canonical_stage2_protected_fingerprints)
     -- Task2 is immutable historical representation evidence.  Its scoped
     -- helper source links it to the current finite Hotels projection without
     -- freezing unrelated operational rows between Task2 and activation.
     or v_task2.scoped_lineage_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
     or v_task2.canonical_task2_protected_fingerprints->'site_settings'
       is distinct from to_jsonb(v_canonical_site_settings_fingerprint)
     or v_task2.canonical_stage2_protected_fingerprints->'site_settings'
       is distinct from to_jsonb(v_canonical_site_settings_fingerprint)
     -- The lock-first 114400 receipt stores the exact raw whole-row value in
     -- both broad representations.  Prove that immutable raw evidence on its
     -- own terms; Task2/current lifecycle evidence above proves the canonical
     -- Hotels representation independently.
     or (v_activation.before_protected_fingerprints->>'site_settings'
       ~'^[0-9a-f]{32}$') is distinct from true
     or v_activation.before_stage2_protected_fingerprints->'site_settings'
       is distinct from v_activation.before_protected_fingerprints->'site_settings'
     or v_activation.after_protected_fingerprints->'site_settings'
       is distinct from v_activation.before_protected_fingerprints->'site_settings'
     or v_activation.after_stage2_protected_fingerprints->'site_settings'
       is distinct from v_activation.before_protected_fingerprints->'site_settings'
     or v_task2.canonical_snapshot_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure)))
     or v_task2.validator_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'::regprocedure)))
     or v_current_normalized->'site_settings' is distinct from
       to_jsonb(v_canonical_site_settings_fingerprint) then
    return null;
  end if;
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_independent_pricing_successor_v1',
    'site_settings_lifecycle',v_site_settings_lifecycle,
    'site_settings_lifecycle_fingerprint',v_canonical_site_settings_fingerprint,
    'site_settings_raw_fingerprint',v_raw_site_settings_fingerprint,
    'property',jsonb_set(v_receipt.before_protected_fingerprints,'{site_settings}',
      to_jsonb(v_canonical_site_settings_fingerprint),false),
    'stage2',jsonb_set(v_receipt.before_stage2_fingerprints,'{site_settings}',
      to_jsonb(v_canonical_site_settings_fingerprint),false),
    'current_property_raw',v_current,
    'current_property',v_current_normalized,
    'current_property_fingerprint',public.hotel_v2_h3_2b_hash(v_current_normalized));
exception when no_data_found or too_many_rows then
  return null;
end
$function$;

create or replace function public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare v_result jsonb:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_legacy jsonb; v_key text;
begin
  v_result:=v_result||jsonb_build_object(
    'hotels',md5(pg_catalog.query_to_xml($query$
      select case when hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
        (to_jsonb(hotel)-array['title','title_i18n','description','description_i18n','city',
          'address_line','district','postal_code','country','latitude','longitude',
          'google_maps_url','amenities','check_in_from','check_out_until',
          'cover_image_url','photos','updated_at'])::text
        else to_jsonb(hotel)::text end
      from public.hotels hotel order by hotel.id$query$,true,true,'')::text),
    'non_h3_2b_activity',md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from 'hotels_v2_h3_2b_partner_workspace'
        and activity.source is distinct from 'hotels_v2_h3_2b_property_proposal_admin_review'
        and not (activity.source='hotels_v2_admin_b_property_control' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action='accept' and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'')::text));
  v_legacy:=public.hotel_v2_seven_arches_independent_pricing_legacy_projection();
  if v_legacy is not null then
    foreach v_key in array array['hotel_room_rates_protected',
      'hotel_pricing_schedules','hotel_schedule_tiers_protected'] loop
      v_result:=jsonb_set(v_result,array[v_key],v_legacy#>array['property',v_key],false);
    end loop;
  end if;
  return v_result;
end
$function$;

insert into public.hotel_seven_arches_independent_pricing_evolution_receipts(
  id,contract_version,hotel_id,activation_receipt_id,source_schedule_id,
  upper_schedule_id,ground_schedule_id,before_schedule_count,after_schedule_count,
  before_tier_count,after_tier_count,authority_row_count,topology_receipt_count,
  upper_rate_schedule_before,upper_rate_schedule_after,
  ground_rate_schedule_before,ground_rate_schedule_after,
  upper_rate_version_before,upper_rate_version_after,
  upper_rate_updated_at_before,upper_rate_updated_at_after,
  ground_rate_version_before,ground_rate_version_after,
  ground_rate_updated_at_before,ground_rate_updated_at_after,
  legacy_schedule_fingerprint_before,legacy_schedule_fingerprint_after,
  legacy_tier_fingerprint_before,legacy_tier_fingerprint_after,
  rate_nonlink_fingerprint_before,rate_nonlink_fingerprint_after,
  commission_fingerprint_before,commission_fingerprint_after,
  payment_fingerprint_before,payment_fingerprint_after,
  commercial_fingerprint_before,commercial_fingerprint_after,
  admin_d_protected_fingerprints_before,admin_d_protected_fingerprint_before,
  admin_d_protected_fingerprints_after,admin_d_protected_fingerprint_after,
  admin_d_allowed_protected_keys,
  before_protected_fingerprints,before_protected_fingerprint,
  after_protected_fingerprints,after_protected_fingerprint,allowed_protected_keys,
  before_stage2_fingerprints,before_stage2_fingerprint,
  after_stage2_fingerprints,after_stage2_fingerprint,allowed_stage2_keys,
  core_oracle_case_count,core_oracle_mismatch_count,
  guest_one_oracle_case_count,guest_one_oracle_mismatch_count,total_oracle_case_count,
  oracle_fingerprint,oracle_source_hash,
  historical_activation_lineage,historical_activation_lineage_fingerprint,
  historical_activation_lineage_source_hash,authority_fingerprint,topology_fingerprint,
  catalog_fingerprint,catalog_source_hash,
  generic_apply_source_before_hash,generic_apply_source_after_hash,
  freeze_source_before_hash,freeze_source_after_hash,
  allocation_source_before_hash,allocation_source_after_hash,
  graph_validator_source_before_hash,graph_validator_source_after_hash,
  activation_receipt_validator_source_before_hash,
  admin_activation_get_source_before_hash,admin_activation_get_source_after_hash,
  activation_snapshot_source_before_hash,
  property_fingerprint_source_before_hash,property_fingerprint_source_after_hash,
  external_fingerprint_source_hash,
  legacy_projection_source_hash)
select 1,'hotels_v2_seven_arches_independent_pricing_evolution_v1',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,1,
  'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
  'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
  '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid,
  before_row.schedule_count,after_row.schedule_count,
  before_row.tier_count,after_row.tier_count,
  (select count(*) from public.hotel_seven_arches_independent_pricing_authority),
  (select count(*) from public.hotel_seven_arches_independent_pricing_topology_receipts),
  'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
  'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
  'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
  '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid,
  before_row.upper_rate_version,after_row.upper_rate_version,
  before_row.upper_rate_updated_at,after_row.upper_rate_updated_at,
  before_row.ground_rate_version,after_row.ground_rate_version,
  before_row.ground_rate_updated_at,after_row.ground_rate_updated_at,
  before_row.legacy_schedule_fingerprint,after_row.legacy_schedule_fingerprint,
  before_row.legacy_tier_fingerprint,after_row.legacy_tier_fingerprint,
  before_row.rate_nonlink_fingerprint,after_row.rate_nonlink_fingerprint,
  before_row.commission_fingerprint,after_row.commission_fingerprint,
  before_row.payment_fingerprint,after_row.payment_fingerprint,
  before_row.commercial_fingerprint,after_row.commercial_fingerprint,
  before_row.admin_d_protected_fingerprints,
    public.hotel_v2_h3_2b_hash(before_row.admin_d_protected_fingerprints),
  after_row.admin_d_protected_fingerprints,
    public.hotel_v2_h3_2b_hash(after_row.admin_d_protected_fingerprints),
  array['hotel_room_rates','hotel_pricing_schedules',
    'hotel_pricing_schedule_occupancy_tiers']::text[],
  before_row.protected_fingerprints,public.hotel_v2_h3_2b_hash(before_row.protected_fingerprints),
  after_row.protected_fingerprints,public.hotel_v2_h3_2b_hash(after_row.protected_fingerprints),
  array['hotel_room_rates_protected','hotel_pricing_schedules',
    'hotel_schedule_tiers_protected']::text[],
  before_row.stage2_fingerprints,public.hotel_v2_h3_2b_hash(before_row.stage2_fingerprints),
  after_row.stage2_fingerprints,public.hotel_v2_h3_2b_hash(after_row.stage2_fingerprints),
  array['hotel_room_rates_protected','hotel_pricing_schedules',
    'hotel_schedule_tiers_protected']::text[],
  (after_row.oracle->>'core_case_count')::integer,
  (after_row.oracle->>'core_mismatch_count')::integer,
  (after_row.oracle->>'guest_one_case_count')::integer,
  (after_row.oracle->>'guest_one_mismatch_count')::integer,
  (after_row.oracle->>'total_case_count')::integer,
  after_row.oracle->>'fingerprint',
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_independent_pricing_oracle()'::regprocedure))),
  before_row.historical_activation_lineage,
  before_row.historical_activation_lineage_fingerprint,
  before_row.historical_activation_lineage_source_hash,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
    jsonb_set(to_jsonb(authority),'{created_at}',
      to_jsonb((extract(epoch from authority.created_at)*1000000)::bigint),false)
      order by authority.target_tier_id)
    from public.hotel_seven_arches_independent_pricing_authority authority),'[]'::jsonb)),
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
    jsonb_set(to_jsonb(topology),'{created_at}',
      to_jsonb((extract(epoch from topology.created_at)*1000000)::bigint),false)
      order by topology.room_key)
    from public.hotel_seven_arches_independent_pricing_topology_receipts topology),'[]'::jsonb)),
  repeat('0',64),
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()'::regprocedure))),
  before_row.generic_apply_source_hash,after_row.generic_apply_source_hash,
  before_row.freeze_source_hash,after_row.freeze_source_hash,
  before_row.allocation_source_hash,after_row.allocation_source_hash,
  before_row.graph_validator_source_hash,after_row.graph_validator_source_hash,
  before_row.activation_receipt_validator_source_hash,
  before_row.admin_activation_get_source_hash,before_row.admin_activation_get_source_hash,
  before_row.activation_snapshot_source_hash,
  before_row.property_fingerprint_source_hash,public.hotel_v2_h3_2b_hash(to_jsonb(
    pg_get_functiondef('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure))),
  before_row.external_fingerprint_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_independent_pricing_legacy_projection()'::regprocedure)))
from seven_arches_independent_pricing_before before_row
cross join seven_arches_independent_pricing_after after_row;

create function public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_source constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  v_receipt public.hotel_seven_arches_independent_pricing_evolution_receipts%rowtype;
  v_oracle jsonb;
  v_successor jsonb;
  v_raw_property jsonb;
  v_raw_stage2 jsonb;
  v_property_projection jsonb;
  v_scoped_lineage jsonb;
  v_live_external_source_hash text;
  v_site_settings_lifecycle jsonb:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false);
  v_canonical_site_settings_fingerprint text;
  v_raw_site_settings_fingerprint text;
begin
  if (select count(*) from public.hotel_seven_arches_independent_pricing_evolution_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_independent_pricing_topology_receipts)<>2
     or (select count(*) from public.hotel_seven_arches_independent_pricing_authority)<>54
     or (select count(*)<>1 or bool_or(setting.id<>1
          or setting.hotel_rooms_v2_enabled is distinct from false
          or setting.hotel_external_sync_enabled is null
          or setting.hotel_instant_booking_enabled is distinct from false
          or setting.hotel_stripe_connect_enabled is distinct from false)
       from public.site_settings setting)
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    return false;
  end if;
  select * into strict v_receipt
  from public.hotel_seven_arches_independent_pricing_evolution_receipts where id=1;
  if v_receipt.created_at is null or not isfinite(v_receipt.created_at)
     or not isfinite(v_receipt.upper_rate_updated_at_before)
     or not isfinite(v_receipt.upper_rate_updated_at_after)
     or not isfinite(v_receipt.ground_rate_updated_at_before)
     or not isfinite(v_receipt.ground_rate_updated_at_after)
     or jsonb_typeof(v_receipt.historical_activation_lineage) is distinct from 'object'
     or jsonb_typeof(v_receipt.historical_activation_lineage->'lower_catalog')
       is distinct from 'array'
     or jsonb_typeof(v_receipt.historical_activation_lineage->'lower_schema_security')
       is distinct from 'object'
     or jsonb_typeof(v_receipt.historical_activation_lineage->'lower_function_security')
       is distinct from 'array'
     or v_receipt.historical_activation_lineage->>'workspace_lineage_exact'
       is distinct from 'true'
     or v_receipt.historical_activation_lineage->>'property_attribution_exact'
       is distinct from 'true'
     or v_receipt.historical_activation_lineage->>'scoped_hotels_lineage_exact'
       is distinct from 'true'
     or v_receipt.historical_activation_lineage->>'scoped_hotels_lineage_source_hash'
       is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
     or v_receipt.historical_activation_lineage->>'transaction_preservation_exact'
       is distinct from 'true'
     or v_receipt.historical_activation_lineage->>'transaction_preservation_source_hash'
       is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)))
     or v_receipt.historical_activation_lineage->>'provider_attribution_exact'
       is distinct from 'true'
     or v_receipt.historical_activation_lineage->>'activation_context_empty'
       is distinct from 'true'
     or v_receipt.historical_activation_lineage->'site_settings_lifecycle'
       is distinct from v_site_settings_lifecycle
     or v_receipt.historical_activation_lineage->>'site_settings_lifecycle_fingerprint'
       is distinct from public.hotel_v2_external_calendar_worker_hash(
         v_site_settings_lifecycle)
     or v_receipt.historical_activation_lineage#>>
       '{lower_function_sources,accepted_activation_receipt_validator}' is distinct from
       'c8a3885461c04dcd2c814b188803d69a1b3bf64c2cb1cd3a61023f35cbfd62ec'
     or v_receipt.historical_activation_lineage_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.historical_activation_lineage)
     or v_receipt.historical_activation_lineage_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'::regprocedure)))
     or v_receipt.authority_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         jsonb_set(to_jsonb(authority),'{created_at}',
           to_jsonb((extract(epoch from authority.created_at)*1000000)::bigint),false)
           order by authority.target_tier_id)
         from public.hotel_seven_arches_independent_pricing_authority authority),'[]'::jsonb))
     or v_receipt.topology_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         jsonb_set(to_jsonb(topology),'{created_at}',
           to_jsonb((extract(epoch from topology.created_at)*1000000)::bigint),false)
           order by topology.room_key)
         from public.hotel_seven_arches_independent_pricing_topology_receipts topology),'[]'::jsonb))
     or v_receipt.catalog_fingerprint is distinct from
       public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()
     or v_receipt.catalog_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()'::regprocedure)))
     or v_receipt.admin_d_protected_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.admin_d_protected_fingerprints_before)
     or v_receipt.admin_d_protected_fingerprint_after is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.admin_d_protected_fingerprints_after)
     or v_receipt.admin_d_allowed_protected_keys is distinct from array[
       'hotel_room_rates','hotel_pricing_schedules',
       'hotel_pricing_schedule_occupancy_tiers']::text[]
     or (v_receipt.admin_d_protected_fingerprints_after-
       v_receipt.admin_d_allowed_protected_keys) is distinct from
       (v_receipt.admin_d_protected_fingerprints_before-
       v_receipt.admin_d_allowed_protected_keys)
     or exists(select 1 from unnest(
       v_receipt.admin_d_allowed_protected_keys) changed(key)
       where v_receipt.admin_d_protected_fingerprints_before->changed.key is null
         or v_receipt.admin_d_protected_fingerprints_after->changed.key is null
         or v_receipt.admin_d_protected_fingerprints_before->changed.key is not distinct from
           v_receipt.admin_d_protected_fingerprints_after->changed.key)
     or v_receipt.receipt_fingerprint is distinct from public.hotel_v2_h3_2b_hash(
       jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
         to_jsonb(v_receipt)-'receipt_fingerprint',
         '{created_at}',to_jsonb((extract(epoch from v_receipt.created_at)*1000000)::bigint),false),
         '{upper_rate_updated_at_before}',to_jsonb((extract(epoch from v_receipt.upper_rate_updated_at_before)*1000000)::bigint),false),
         '{upper_rate_updated_at_after}',to_jsonb((extract(epoch from v_receipt.upper_rate_updated_at_after)*1000000)::bigint),false),
         '{ground_rate_updated_at_before}',to_jsonb((extract(epoch from v_receipt.ground_rate_updated_at_before)*1000000)::bigint),false),
         '{ground_rate_updated_at_after}',to_jsonb((extract(epoch from v_receipt.ground_rate_updated_at_after)*1000000)::bigint),false)) then
    return false;
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_admin_d_current_foundation_snapshot()',
        '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a',
        's'::"char",array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
        'e42b5b7cabecd6e7ec7a847796983e497572f9f8fc0802f642fdc6b995d84ac3',
        's'::"char",array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
        '0a6255e457f0912452949966e47e29a0ce0f6cda3e85c53b999343f9b68c3a95',
        's'::"char",array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',
        '57cabf1992e9f03f5411715b59c29aea51501aa3a91b403d36e61264c394e420',
        's'::"char",array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_admin_get_seven_arches_pricing_activation()',
        'ad55a2b1a29fb2e81f2e3f42b445f280a47f5b497590ca92c1cf110dd6b23b0d',
        's'::"char",array['search_path=pg_catalog, public, auth']::text[],true),
      ('public.hotel_v2_admin_c_validate_pricing_graph(uuid)',
        '03f787a5e00fbbe65bdcaf1a96529512f60775074a1fdf4dcdd04104c7c7d335',
        'v'::"char",array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_admin_c_h3_1p_freeze_trigger()',
        'd864f254c257be00491d0c2e508c4b6585e16bf3e35992fa174050d2205a6bf6',
        'v'::"char",array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_admin_c_pricing_graph_constraint_trigger()',
        'ddd7d1995810b1006d5fdbaca64560703ad98f5b4cfae1174b0595b8f41d7ad0',
        'v'::"char",array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)',
        'b85e47c8e5a61832dbbc909fb120d38d965d0077914f2d8009249ca9a8ffb3f6',
        'v'::"char",array['search_path=pg_catalog, public, auth']::text[],true),
      ('public.hotel_v2_seven_arches_pricing_activation_immutable()',
        '4b3e5ff853a0b8f2e21dd4d18359f8a92614f298d33e7cb9223e9b6aca31fc87',
        'v'::"char",array['search_path=pg_catalog']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()',
        '220afcdf846be8b91b554acb5054364126bc7adb1aa085d1bd86ac149985bdb7',
        'v'::"char",array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_review_guard()',
        '23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758',
        'v'::"char",array['search_path=pg_catalog, public, auth']::text[],false)
    ) expected(signature,source_hash,volatility,path,authenticated_execute)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or not procedure_row.prosecdef
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        is distinct from expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        is distinct from expected.authenticated_execute) then
    return false;
  end if;
  if not exists(select 1 from pg_proc procedure_row
    join pg_language language_row on language_row.oid=procedure_row.prolang
    where procedure_row.oid=
        'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure
      and procedure_row.proowner='postgres'::regrole
      and language_row.lanname='plpgsql'
      and procedure_row.provolatile='s' and procedure_row.prosecdef
      and procedure_row.proconfig=
        array['search_path=pg_catalog, public']::text[]
      and not procedure_row.proleakproof and not procedure_row.proretset
      and encode(extensions.digest(convert_to(
        procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
        '6df11e8680d35ca8caf3a4f4492276105f2b150422f3b086b64ad82d5f6e164d'
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return false;
  end if;
  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='s'
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return false;
  end if;
  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='s'
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return false;
  end if;
  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_independent_pricing_oracle()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='s'
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(procedure_row.oid)))
         is not distinct from v_receipt.oracle_source_hash
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return false;
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_seven_arches_independent_pricing_legacy_projection()',
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_snapshot()',
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_snapshot_shared_core()',
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_admin_get_seven_arches_pricing_activation()',
        array['search_path=pg_catalog, public, auth']::text[],true)
    ) expected(signature,path,authenticated_execute)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is not true or procedure_row.provolatile is distinct from 's'
      or procedure_row.proconfig is distinct from expected.path
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        is distinct from expected.authenticated_execute) then
    return false;
  end if;
  v_oracle:=public.hotel_v2_seven_arches_independent_pricing_oracle();
  v_successor:=public.hotel_v2_seven_arches_independent_pricing_legacy_projection();
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_raw_property:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_raw_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_property_projection:=
    public.hotel_v2_seven_arches_property_proposal_protected_fingerprints();
  v_canonical_site_settings_fingerprint:=
    public.hotel_v2_external_calendar_worker_hash(v_site_settings_lifecycle);
  v_raw_site_settings_fingerprint:=md5(pg_catalog.query_to_xml($query$
    select to_jsonb(row_value)::text
    from public.site_settings row_value
    order by to_jsonb(row_value)::text$query$,true,true,'')::text);
  if jsonb_typeof(v_successor) is distinct from 'object'
     or jsonb_typeof(v_successor->'current_property') is distinct from 'object'
     or jsonb_typeof(v_successor->'current_property_raw') is distinct from 'object'
     or jsonb_typeof(v_scoped_lineage) is distinct from 'object'
     or jsonb_typeof(v_raw_property) is distinct from 'object'
     or jsonb_typeof(v_raw_stage2) is distinct from 'object'
     or jsonb_typeof(v_property_projection) is distinct from 'object' then
    return false;
  end if;
  select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
    into v_live_external_source_hash
  from pg_proc
  where oid='public.hotel_v2_external_calendar_protected_fingerprints()'::regprocedure;
  if v_receipt.contract_version is distinct from
       'hotels_v2_seven_arches_independent_pricing_evolution_v1'
     or v_receipt.hotel_id is distinct from c_hotel
     or v_receipt.activation_receipt_id is distinct from 1
     or v_receipt.after_schedule_count is distinct from v_receipt.before_schedule_count+2
     or v_receipt.after_tier_count is distinct from v_receipt.before_tier_count+54
     or v_receipt.authority_row_count is distinct from 54
     or v_receipt.topology_receipt_count is distinct from 2
     or v_receipt.before_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.before_protected_fingerprints)
     or v_receipt.after_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.after_protected_fingerprints)
     or v_receipt.before_stage2_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.before_stage2_fingerprints)
     or v_receipt.after_stage2_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_receipt.after_stage2_fingerprints)
     or v_receipt.allowed_protected_keys is distinct from array[
       'hotel_room_rates_protected','hotel_pricing_schedules',
       'hotel_schedule_tiers_protected']::text[]
     or v_receipt.allowed_stage2_keys is distinct from array[
       'hotel_room_rates_protected','hotel_pricing_schedules',
       'hotel_schedule_tiers_protected']::text[]
     or (v_receipt.after_protected_fingerprints-v_receipt.allowed_protected_keys)
       is distinct from
       (v_receipt.before_protected_fingerprints-v_receipt.allowed_protected_keys)
     or (v_receipt.after_stage2_fingerprints-v_receipt.allowed_stage2_keys)
       is distinct from
       (v_receipt.before_stage2_fingerprints-v_receipt.allowed_stage2_keys)
     or exists(select 1 from unnest(v_receipt.allowed_protected_keys) changed(key)
       where v_receipt.before_protected_fingerprints->changed.key is null
         or v_receipt.after_protected_fingerprints->changed.key is null
         or v_receipt.before_protected_fingerprints->changed.key
           is not distinct from v_receipt.after_protected_fingerprints->changed.key)
     or exists(select 1 from unnest(v_receipt.allowed_stage2_keys) changed(key)
       where v_receipt.before_stage2_fingerprints->changed.key is null
         or v_receipt.after_stage2_fingerprints->changed.key is null
         or v_receipt.before_stage2_fingerprints->changed.key
           is not distinct from v_receipt.after_stage2_fingerprints->changed.key)
     or v_canonical_site_settings_fingerprint is distinct from
       '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'
     or v_raw_site_settings_fingerprint is null
     or (v_raw_site_settings_fingerprint~'^[0-9a-f]{32}$') is distinct from true
     or v_successor->'site_settings_lifecycle' is distinct from
       v_site_settings_lifecycle
     or v_successor->>'site_settings_lifecycle_fingerprint' is distinct from
       v_canonical_site_settings_fingerprint
     or v_successor->>'site_settings_raw_fingerprint' is distinct from
       v_raw_site_settings_fingerprint
     or v_raw_property->'site_settings' is distinct from
       to_jsonb(v_raw_site_settings_fingerprint)
     or v_raw_stage2->'site_settings' is distinct from
       to_jsonb(v_raw_site_settings_fingerprint)
     or v_property_projection->'site_settings' is distinct from
       to_jsonb(v_raw_site_settings_fingerprint)
     or v_successor#>'{current_property_raw,site_settings}' is distinct from
       to_jsonb(v_raw_site_settings_fingerprint)
     or v_receipt.before_protected_fingerprints->'site_settings' is null
     or v_receipt.after_protected_fingerprints->'site_settings' is distinct from
       v_receipt.before_protected_fingerprints->'site_settings'
     or v_receipt.before_stage2_fingerprints->'site_settings' is distinct from
       v_receipt.before_protected_fingerprints->'site_settings'
     or v_receipt.after_stage2_fingerprints->'site_settings' is distinct from
       v_receipt.before_protected_fingerprints->'site_settings'
     or jsonb_typeof(v_scoped_lineage) is distinct from 'object'
     or v_scoped_lineage->>'contract_version' is distinct from
       'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
     or (select count(*) from jsonb_object_keys(v_scoped_lineage))<>21
     or (v_scoped_lineage ?& array[
       'contract_version','hotel_id','partner_id','assignment_id','owner_user_ids',
       'owner_membership_fingerprint','permission_preset_fingerprint',
       'property_business_fingerprint','room_identity_fingerprint',
       'pricing_identity_fingerprint','allocation_contract_exact','parity_case_count',
       'parity_mismatch_count','parity_fingerprint','commission_policy_fingerprint',
       'payment_policy_fingerprint','site_settings_lifecycle',
       'site_settings_lifecycle_fingerprint','owner_capability_receipt_fingerprint',
       'property_foundation_receipt_fingerprint','lower_function_security_fingerprint'
     ]::text[]) is not true
     or v_scoped_lineage->>'hotel_id' is distinct from c_hotel::text
     or v_scoped_lineage->>'allocation_contract_exact' is distinct from 'true'
     or (v_scoped_lineage->>'parity_case_count')::integer<>70
     or (v_scoped_lineage->>'parity_mismatch_count')::integer<>0
     or v_scoped_lineage->'site_settings_lifecycle' is distinct from
       v_site_settings_lifecycle
     or v_scoped_lineage->>'site_settings_lifecycle_fingerprint' is distinct from
       v_canonical_site_settings_fingerprint
     or exists(select 1 from jsonb_each_text(v_scoped_lineage) entry
       where entry.key in('owner_membership_fingerprint',
         'permission_preset_fingerprint','property_business_fingerprint',
         'room_identity_fingerprint','pricing_identity_fingerprint',
         'commission_policy_fingerprint','payment_policy_fingerprint',
         'owner_capability_receipt_fingerprint','property_foundation_receipt_fingerprint',
         'lower_function_security_fingerprint')
         and (entry.value~'^[0-9a-f]{64}$') is distinct from true)
     or (v_scoped_lineage->>'parity_fingerprint'~'^[0-9a-f]{32}$')
       is distinct from true
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true
     or not exists(select 1
       from public.hotel_seven_arches_pricing_activation_evolution_receipts activation
         where activation.id=v_receipt.activation_receipt_id
           and activation.transaction_preservation_source_hash is not distinct from
           public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
             'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)))
           and public.hotel_v2_7a_pricing_activation_transaction_is_preserved())
     or v_successor->>'contract_version' is distinct from
       'hotels_v2_seven_arches_independent_pricing_successor_v1'
     or v_successor->'property' is distinct from jsonb_set(
       v_receipt.before_protected_fingerprints,'{site_settings}',
       to_jsonb(v_canonical_site_settings_fingerprint),false)
     or v_successor->'stage2' is distinct from jsonb_set(
       v_receipt.before_stage2_fingerprints,'{site_settings}',
       to_jsonb(v_canonical_site_settings_fingerprint),false)
     or v_successor->>'current_property_fingerprint' is distinct from
       public.hotel_v2_h3_2b_hash(v_successor->'current_property')
     or v_successor#>'{current_property,site_settings}' is distinct from
       to_jsonb(v_canonical_site_settings_fingerprint) then
    return false;
  end if;

  if (select count(*) from public.hotel_pricing_schedules where hotel_id=c_hotel)
       <>v_receipt.after_schedule_count
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
       where schedule.hotel_id=c_hotel)<>v_receipt.after_tier_count
     or not exists(select 1 from public.hotel_pricing_schedules target
       join public.hotel_pricing_schedules source on source.id=c_source
       where target.id='aec20731-7a56-35f0-334e-92b363351f02'::uuid
         and target.hotel_id=c_hotel and target.code='upper-apartment-independent'
         and target.name_i18n is not distinct from source.name_i18n
         and target.application_scope='room_occupancy'
         and btrim(target.currency::text)='EUR' and target.maximum_party_size=4
         and target.minimum_billable_occupancy=2 and target.is_active
         and target.review_status='reviewed' and target.source='system'
         and target.sharing_mode='independent' and target.version=1
         and target.currency is not distinct from source.currency
         and target.source_reference=jsonb_build_object(
           'contract_version','hotels_v2_seven_arches_independent_pricing_topology_v1',
           'cloned_from_schedule_id',source.id,'room_key','upper',
           'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
           'room_rate_id','7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid))
     or not exists(select 1 from public.hotel_pricing_schedules target
       join public.hotel_pricing_schedules source on source.id=c_source
       where target.id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid
         and target.hotel_id=c_hotel and target.code='ground-apartment-independent'
         and target.name_i18n is not distinct from source.name_i18n
         and target.application_scope='room_occupancy'
         and btrim(target.currency::text)='EUR' and target.maximum_party_size=4
         and target.minimum_billable_occupancy=2 and target.is_active
         and target.review_status='reviewed' and target.source='system'
         and target.sharing_mode='independent' and target.version=1
         and target.currency is not distinct from source.currency
         and target.source_reference=jsonb_build_object(
           'contract_version','hotels_v2_seven_arches_independent_pricing_topology_v1',
           'cloned_from_schedule_id',source.id,'room_key','ground',
           'room_type_id','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,
           'room_rate_id','3320590d-632d-423f-80d0-fd021cba7293'::uuid))
     or not exists(select 1 from public.hotel_room_rates where
       id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
       and pricing_schedule_id='aec20731-7a56-35f0-334e-92b363351f02'::uuid
       and rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
       and btrim(currency::text)='EUR'
       and version=v_receipt.upper_rate_version_after
       and updated_at is not distinct from v_receipt.upper_rate_updated_at_after)
     or not exists(select 1 from public.hotel_room_rates where
       id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
       and pricing_schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid
       and rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
       and btrim(currency::text)='EUR'
       and version=v_receipt.ground_rate_version_after
       and updated_at is not distinct from v_receipt.ground_rate_updated_at_after)
     or v_receipt.upper_rate_version_after is distinct from
       v_receipt.upper_rate_version_before+1
     or v_receipt.ground_rate_version_after is distinct from
       v_receipt.ground_rate_version_before+1
     or v_receipt.upper_rate_updated_at_after<=v_receipt.upper_rate_updated_at_before
     or v_receipt.ground_rate_updated_at_after<=v_receipt.ground_rate_updated_at_before
     or exists(select 1 from public.hotel_room_rates rate
       where rate.pricing_schedule_id in(
         'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
         '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)
       group by rate.pricing_schedule_id having count(*)<>1) then
    return false;
  end if;

  if exists(select 1
      from public.hotel_seven_arches_independent_pricing_authority authority
      left join public.hotel_pricing_schedule_occupancy_tiers source
        on source.id=authority.source_tier_id
      left join public.hotel_pricing_schedule_occupancy_tiers target
        on target.id=authority.target_tier_id
      left join public.hotel_room_rates rate on rate.id=authority.room_rate_id
      left join public.hotel_pricing_schedules source_schedule
        on source_schedule.id=authority.source_schedule_id
      left join public.hotel_pricing_schedules target_schedule
        on target_schedule.id=authority.independent_schedule_id
      where authority.contract_version is distinct from
          'hotels_v2_seven_arches_independent_pricing_authority_v1'
        or authority.hotel_id is distinct from c_hotel
        or authority.source_schedule_id is distinct from c_source
        or source.id is null or target.id is null or rate.id is null
        or source_schedule.id is null or target_schedule.id is null
        or source.schedule_id is distinct from c_source
        or target.schedule_id is distinct from authority.independent_schedule_id
        or source.guest_count is distinct from authority.guest_count
        or target.guest_count is distinct from authority.guest_count
        or source.threshold_nights is distinct from authority.threshold_nights
        or target.threshold_nights is distinct from authority.threshold_nights
        or source.nightly_rate is distinct from authority.initial_nightly_rate
        or target.nightly_rate is distinct from authority.initial_nightly_rate
        or source.version is distinct from authority.source_tier_version
        or target.version is distinct from authority.target_initial_version
        or source.is_active is distinct from authority.source_is_active
        or target.is_active is distinct from authority.target_initial_is_active
        or authority.source_is_active is not true
        or authority.target_initial_is_active is not true
        or rate.hotel_id is distinct from authority.hotel_id
        or rate.room_type_id is distinct from authority.room_type_id
        or rate.rate_plan_id is distinct from authority.rate_plan_id
        or rate.pricing_schedule_id is distinct from authority.independent_schedule_id
        or btrim(rate.currency::text) is distinct from authority.currency
        or btrim(source_schedule.currency::text) is distinct from authority.currency
        or btrim(target_schedule.currency::text) is distinct from authority.currency
        or authority.currency is distinct from 'EUR'
        or authority.created_at is null or not isfinite(authority.created_at)
        or target.id is distinct from md5('hotels_v2_7a_independent_tier_v1:'||authority.room_key||':'||
          authority.guest_count::text||':'||authority.threshold_nights::text)::uuid)
     or exists(
       (select room.room_key,source.guest_count,source.threshold_nights
        from public.hotel_pricing_schedule_occupancy_tiers source
        cross join (values('upper'),('ground')) room(room_key)
        where source.schedule_id=c_source and source.is_active
        except
        select authority.room_key,authority.guest_count,authority.threshold_nights
        from public.hotel_seven_arches_independent_pricing_authority authority)
       union all
       (select authority.room_key,authority.guest_count,authority.threshold_nights
        from public.hotel_seven_arches_independent_pricing_authority authority
        except
        select room.room_key,source.guest_count,source.threshold_nights
        from public.hotel_pricing_schedule_occupancy_tiers source
        cross join (values('upper'),('ground')) room(room_key)
        where source.schedule_id=c_source and source.is_active)) then
    return false;
  end if;

  if v_receipt.legacy_schedule_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         to_jsonb(schedule)-array['created_at','updated_at'] order by schedule.id)
         from public.hotel_pricing_schedules schedule where schedule.id in(c_source,
           '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb))
     or v_receipt.legacy_tier_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         to_jsonb(tier)-array['created_at','updated_at'] order by tier.id)
         from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id in(c_source,
           '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb))
     or v_receipt.rate_nonlink_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         to_jsonb(rate)-array['pricing_schedule_id','version','created_at','updated_at'] order by rate.id)
         from public.hotel_room_rates rate where rate.id in(
           '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
           '3320590d-632d-423f-80d0-fd021cba7293'::uuid)),'[]'::jsonb))
     or v_receipt.commission_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
         from public.hotel_commission_policies policy where policy.hotel_id=c_hotel),'[]'::jsonb))
     or public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       is not true
     or v_receipt.commercial_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(jsonb_build_object(
         'rate_plans',coalesce((select jsonb_agg(
           to_jsonb(plan)-array['created_at','updated_at'] order by plan.id)
           from public.hotel_rate_plans plan where plan.hotel_id=c_hotel),'[]'::jsonb),
         'rate_rules',coalesce((select jsonb_agg(
           to_jsonb(rule)-array['created_at','updated_at'] order by rule.id)
           from public.hotel_rate_rules rule
           join public.hotel_room_rates rate on rate.id=rule.room_rate_id
           where rate.hotel_id=c_hotel),'[]'::jsonb),
         'allocation_rules',coalesce((select jsonb_agg(
           to_jsonb(rule)-array['created_at','updated_at'] order by rule.id)
           from public.hotel_room_allocation_rules rule where rule.hotel_id=c_hotel),'[]'::jsonb),
         'allocation_items',coalesce((select jsonb_agg(
           to_jsonb(item)-array['created_at','updated_at'] order by item.id)
           from public.hotel_room_allocation_rule_items item
           join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
           where rule.hotel_id=c_hotel),'[]'::jsonb)))
     or v_receipt.generic_apply_source_after_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)'::regprocedure)))
     or v_receipt.freeze_source_after_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure)))
     or v_receipt.allocation_source_after_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_h3_1p_allocation_preview(uuid)'::regprocedure)))
     or v_receipt.graph_validator_source_after_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure)))
     or v_receipt.activation_receipt_validator_source_after_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure)))
     or v_receipt.admin_activation_get_source_before_hash is distinct from
       v_receipt.admin_activation_get_source_after_hash
     or v_receipt.admin_activation_get_source_after_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_admin_get_seven_arches_pricing_activation()'::regprocedure)))
     or v_receipt.activation_snapshot_source_after_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_snapshot()'::regprocedure)))
     or v_receipt.activation_snapshot_core_source_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_snapshot_shared_core()'::regprocedure)))
     or v_receipt.property_fingerprint_source_after_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure)))
     or v_receipt.external_fingerprint_source_hash is distinct from
       'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'
     or v_receipt.external_fingerprint_source_hash is distinct from
       v_live_external_source_hash
     or v_receipt.legacy_projection_source_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_seven_arches_independent_pricing_legacy_projection()'::regprocedure)))
     or v_receipt.topology_validator_source_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure)))
     or v_receipt.current_safe_source_hash is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
       pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'::regprocedure)))
     or jsonb_typeof(v_oracle) is distinct from 'object'
     or (case when jsonb_typeof(v_oracle)='object' then
       (select count(*) from jsonb_object_keys(v_oracle)) is distinct from 7
       else true end)
     or not (v_oracle ?& array['contract_version','core_case_count',
       'core_mismatch_count','guest_one_case_count','guest_one_mismatch_count',
       'total_case_count','fingerprint'])
     or jsonb_typeof(v_oracle->'contract_version') is distinct from 'string'
     or jsonb_typeof(v_oracle->'core_case_count') is distinct from 'number'
     or jsonb_typeof(v_oracle->'core_mismatch_count') is distinct from 'number'
     or jsonb_typeof(v_oracle->'guest_one_case_count') is distinct from 'number'
     or jsonb_typeof(v_oracle->'guest_one_mismatch_count') is distinct from 'number'
     or jsonb_typeof(v_oracle->'total_case_count') is distinct from 'number'
     or jsonb_typeof(v_oracle->'fingerprint') is distinct from 'string'
     or (case when pg_input_is_valid(v_oracle->>'core_case_count','integer')
         and pg_input_is_valid(v_oracle->>'core_mismatch_count','integer')
         and pg_input_is_valid(v_oracle->>'guest_one_case_count','integer')
         and pg_input_is_valid(v_oracle->>'guest_one_mismatch_count','integer')
         and pg_input_is_valid(v_oracle->>'total_case_count','integer') then
       v_oracle->>'contract_version' is distinct from
         'hotels_v2_seven_arches_independent_pricing_oracle_v1'
       or (v_oracle->>'core_case_count')::integer is distinct from
         v_receipt.core_oracle_case_count
       or (v_oracle->>'core_mismatch_count')::integer is distinct from
         v_receipt.core_oracle_mismatch_count
       or (v_oracle->>'guest_one_case_count')::integer is distinct from
         v_receipt.guest_one_oracle_case_count
       or (v_oracle->>'guest_one_mismatch_count')::integer is distinct from
         v_receipt.guest_one_oracle_mismatch_count
       or (v_oracle->>'total_case_count')::integer is distinct from
         v_receipt.total_oracle_case_count
       or v_receipt.total_oracle_case_count is distinct from 120
       or v_oracle->>'fingerprint' is distinct from v_receipt.oracle_fingerprint
       or (v_oracle->>'fingerprint'~'^[0-9a-f]{32}$') is distinct from true
       else true end)
     or (case when pg_input_is_valid(
          public.hotel_v2_h3_1p_parity_snapshot(c_hotel)->>'total_case_count','integer')
         and pg_input_is_valid(
          public.hotel_v2_h3_1p_parity_snapshot(c_hotel)->>'total_mismatch_count','integer') then
       (public.hotel_v2_h3_1p_parity_snapshot(c_hotel)->>'total_case_count')::integer
         is distinct from 70
       or (public.hotel_v2_h3_1p_parity_snapshot(c_hotel)->>'total_mismatch_count')::integer
         is distinct from 0 else true end)
     or public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() is not true
     or public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() is not true then
    return false;
  end if;

  if exists(select 1
      from public.hotel_seven_arches_independent_pricing_topology_receipts topology
      where topology.contract_version is distinct from
          'hotels_v2_seven_arches_independent_pricing_topology_v1'
        or topology.created_at is null or not isfinite(topology.created_at)
        or topology.source_schedule_id is distinct from c_source
        or topology.source_tier_count is distinct from 27
        or topology.target_tier_count is distinct from 27
        or topology.source_tier_fingerprint is distinct from
          topology.target_initial_tier_fingerprint
        or topology.source_tier_fingerprint is distinct from
          public.hotel_v2_h3_2b_hash(coalesce((
          select jsonb_agg(jsonb_build_object(
            'guest_count',source.guest_count,'threshold_nights',source.threshold_nights,
            'nightly_rate',source.nightly_rate,'currency',btrim(schedule.currency::text),
            'is_active',source.is_active,'version',source.version)
            order by source.guest_count,source.threshold_nights)
          from public.hotel_pricing_schedule_occupancy_tiers source
          join public.hotel_pricing_schedules schedule on schedule.id=source.schedule_id
          where source.schedule_id=c_source),'[]'::jsonb))
        or topology.target_initial_tier_fingerprint is distinct from
          public.hotel_v2_h3_2b_hash(coalesce((
          select jsonb_agg(jsonb_build_object(
            'guest_count',target.guest_count,'threshold_nights',target.threshold_nights,
            'nightly_rate',target.nightly_rate,'currency',btrim(schedule.currency::text),
            'is_active',target.is_active,'version',target.version)
            order by target.guest_count,target.threshold_nights)
          from public.hotel_pricing_schedule_occupancy_tiers target
          join public.hotel_pricing_schedules schedule on schedule.id=target.schedule_id
          where target.schedule_id=topology.independent_schedule_id),'[]'::jsonb))
        or topology.source_schedule_fingerprint is distinct from
          public.hotel_v2_h3_2b_hash((select jsonb_build_object(
            'name_i18n',schedule.name_i18n,
            'application_scope',schedule.application_scope,
            'currency',btrim(schedule.currency::text),
            'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
            'maximum_party_size',schedule.maximum_party_size,
            'is_active',schedule.is_active,'review_status',schedule.review_status,
            'source',schedule.source,'sharing_mode',schedule.sharing_mode,
            'version',schedule.version)
          from public.hotel_pricing_schedules schedule where schedule.id=c_source))
        or topology.target_schedule_fingerprint is distinct from
          public.hotel_v2_h3_2b_hash((select jsonb_build_object(
            'name_i18n',schedule.name_i18n,
            'application_scope',schedule.application_scope,
            'currency',btrim(schedule.currency::text),
            'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
            'maximum_party_size',schedule.maximum_party_size,
            'is_active',schedule.is_active,'review_status',schedule.review_status,
            'source',schedule.source,'sharing_mode',schedule.sharing_mode,
            'version',schedule.version)
          from public.hotel_pricing_schedules schedule
          where schedule.id=topology.independent_schedule_id))
        or topology.authority_fingerprint is distinct from
          public.hotel_v2_h3_2b_hash(coalesce((
          select jsonb_agg(to_jsonb(authority)-'created_at' order by authority.target_tier_id)
          from public.hotel_seven_arches_independent_pricing_authority authority
          where authority.room_key=topology.room_key),'[]'::jsonb))) then
    return false;
  end if;

  if exists(select 1 from (values
      ('public.hotel_seven_arches_independent_pricing_authority'::regclass,
        19::integer,25::integer,13::integer,8::integer,3::integer,
        'hotel_seven_arches_independent_pricing_authority_immutable'),
      ('public.hotel_seven_arches_independent_pricing_topology_receipts'::regclass,
        15::integer,15::integer,12::integer,0::integer,2::integer,
        'hotel_7a_independent_pricing_topology_receipt_immutable'),
      ('public.hotel_seven_arches_independent_pricing_evolution_receipts'::regclass,
        89::integer,98::integer,96::integer,1::integer,0::integer,
        'hotel_7a_independent_pricing_evolution_receipt_immutable')
    ) expected(relation_id,column_count,constraint_count,check_count,fk_count,
      unique_count,trigger_name)
    left join pg_class relation on relation.oid=expected.relation_id
    where relation.oid is null or relation.relkind<>'r' or relation.relpersistence<>'p'
      or relation.relowner is distinct from 'postgres'::regrole
      or relation.relrowsecurity is not true
      or (select count(*) from pg_attribute attribute
        where attribute.attrelid=expected.relation_id and attribute.attnum>0
          and not attribute.attisdropped)<>expected.column_count
      or (select count(*) from pg_constraint constraint_row
        where constraint_row.conrelid=expected.relation_id)<>expected.constraint_count
      or (select count(*) from pg_constraint constraint_row
        where constraint_row.conrelid=expected.relation_id
          and constraint_row.contype='p' and constraint_row.convalidated)<>1
      or (select count(*) from pg_constraint constraint_row
        where constraint_row.conrelid=expected.relation_id
          and constraint_row.contype='c' and constraint_row.convalidated
          and not constraint_row.connoinherit)<>expected.check_count
      or (select count(*) from pg_constraint constraint_row
        where constraint_row.conrelid=expected.relation_id
          and constraint_row.contype='f' and constraint_row.convalidated
          and not constraint_row.condeferrable)<>expected.fk_count
      or (select count(*) from pg_constraint constraint_row
        where constraint_row.conrelid=expected.relation_id
          and constraint_row.contype='u' and constraint_row.convalidated)<>expected.unique_count
      or exists(select 1 from pg_policy policy where policy.polrelid=expected.relation_id)
      or (select count(*) from pg_trigger trigger_row
        where trigger_row.tgrelid=expected.relation_id
          and not trigger_row.tgisinternal)<>1
      or not exists(select 1 from pg_trigger trigger_row
        where trigger_row.tgrelid=expected.relation_id
          and trigger_row.tgname=expected.trigger_name
          and trigger_row.tgfoid=
            'public.hotel_v2_seven_arches_pricing_activation_immutable()'::regprocedure
          and trigger_row.tgtype=31 and trigger_row.tgenabled='O'
          and not trigger_row.tgisinternal)
      or exists(select 1 from unnest(array[
        'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
      ]) privilege(name) where has_table_privilege(0::oid,expected.relation_id,privilege.name)
        or has_table_privilege('anon',expected.relation_id,privilege.name)
        or has_table_privilege('authenticated',expected.relation_id,privilege.name)
        or has_table_privilege('service_role',expected.relation_id,privilege.name))) then
    return false;
  end if;
  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_pricing_activation_immutable()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='v'
       and procedure_row.proconfig=array['search_path=pg_catalog']::text[]
       and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         '4b3e5ff853a0b8f2e21dd4d18359f8a92614f298d33e7cb9223e9b6aca31fc87'
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return false;
  end if;

  if exists(select 1 from (values
      ('public.hotel_room_rates'::regclass,'hotel_room_rates_admin_c_h3_1p_freeze',
        'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,
        31::smallint,false,false),
      ('public.hotel_pricing_schedules'::regclass,'hotel_pricing_schedules_admin_c_h3_1p_freeze',
        'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,
        31::smallint,false,false),
      ('public.hotel_pricing_schedule_occupancy_tiers'::regclass,
        'hotel_pricing_schedule_tiers_admin_c_h3_1p_freeze',
        'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,
        31::smallint,false,false),
      ('public.hotel_room_rates'::regclass,'hotel_room_rates_admin_c_graph_guard',
        'public.hotel_v2_admin_c_pricing_graph_constraint_trigger()'::regprocedure,
        29::smallint,true,true),
      ('public.hotel_pricing_schedules'::regclass,
        'hotel_pricing_schedules_admin_c_graph_guard',
        'public.hotel_v2_admin_c_pricing_graph_constraint_trigger()'::regprocedure,
        29::smallint,true,true),
      ('public.hotel_pricing_schedule_occupancy_tiers'::regclass,
        'hotel_pricing_schedule_tiers_admin_c_graph_guard',
        'public.hotel_v2_admin_c_pricing_graph_constraint_trigger()'::regprocedure,
        29::smallint,true,true)
    ) expected(relation_id,trigger_name,function_id,trigger_type,
      is_deferrable,is_initially_deferred)
    left join pg_trigger trigger_row on trigger_row.tgrelid=expected.relation_id
      and trigger_row.tgname=expected.trigger_name and not trigger_row.tgisinternal
    where trigger_row.oid is null or trigger_row.tgenabled is distinct from 'O'
      or trigger_row.tgfoid is distinct from expected.function_id
      or trigger_row.tgtype is distinct from expected.trigger_type
      or trigger_row.tgdeferrable is distinct from expected.is_deferrable
      or trigger_row.tginitdeferred is distinct from expected.is_initially_deferred) then
    return false;
  end if;
  return true;
exception when no_data_found or too_many_rows then
  return false;
end;
$function$;

-- Historical callers keep their OIDs.  The accepted current-safe function is
-- left byte-exact and already delegates its count-one branch to this receipt
-- validator.  The successor validator combines the topology proof with the
-- replayed immutable 114405 activation lineage inside topology_is_exact().
create or replace function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
returns boolean language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
begin
  if (select count(*)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts)<>1 then
    return false;
  end if;
  return coalesce(
    public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),false);
end
$function$;

do $seven_arches_independent_pricing_activation_snapshot_clone$
declare v_definition text; v_count integer; v_oid oid;
begin
  v_oid:='public.hotel_v2_seven_arches_pricing_activation_snapshot()'::regprocedure;
  select pg_get_functiondef(v_oid) into v_definition;
  if (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
      from pg_proc where oid=v_oid) is distinct from
       '41e70f0b9dec52daae35d1320319016d1ab211e3de1d0d5894d36c2ea10b7638'
     or not exists(select 1 from pg_proc where oid=v_oid
       and proowner='postgres'::regrole and prosecdef and provolatile='s'
       and proconfig=array['search_path=pg_catalog, public']::text[])
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_activation_snapshot_prior_drift';
  end if;
  v_count:=(length(v_definition)-length(replace(v_definition,
    'hotel_v2_seven_arches_pricing_activation_snapshot','')))
    /length('hotel_v2_seven_arches_pricing_activation_snapshot');
  if v_count<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_activation_snapshot_source_drift';
  end if;
  execute replace(v_definition,'hotel_v2_seven_arches_pricing_activation_snapshot',
    'hotel_v2_seven_arches_pricing_activation_snapshot_shared_core');
end
$seven_arches_independent_pricing_activation_snapshot_clone$;

create or replace function public.hotel_v2_seven_arches_pricing_activation_snapshot()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare v_snapshot jsonb;
begin
  v_snapshot:=public.hotel_v2_seven_arches_pricing_activation_snapshot_shared_core();
  if public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is true then
    return v_snapshot||jsonb_build_object(
      'status','active','blocking_reasons','[]'::jsonb,
      'legacy_authoritative',false,
      'pricing_authority','independent_room_schedules',
      'independent_topology',jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_independent_pricing_topology_v1',
        'upper_schedule_id','aec20731-7a56-35f0-334e-92b363351f02'::uuid,
        'ground_schedule_id','9d109336-64f3-3c57-4684-968b59c94c3b'::uuid,
        'authority_row_count',54));
  end if;
  return v_snapshot;
end
$function$;

update public.hotel_seven_arches_independent_pricing_evolution_receipts set
  topology_validator_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure))),
  current_safe_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'::regprocedure))),
  activation_receipt_validator_source_after_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
    pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure))),
  admin_activation_get_source_after_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
    pg_get_functiondef('public.hotel_v2_admin_get_seven_arches_pricing_activation()'::regprocedure))),
  activation_snapshot_source_after_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
    pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_snapshot()'::regprocedure))),
  activation_snapshot_core_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
    pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_snapshot_shared_core()'::regprocedure)))
where id=1;
alter table public.hotel_seven_arches_independent_pricing_evolution_receipts
  alter column topology_validator_source_hash set not null,
  alter column current_safe_source_hash set not null,
  alter column activation_receipt_validator_source_after_hash set not null,
  alter column admin_activation_get_source_after_hash set not null,
  alter column activation_snapshot_source_after_hash set not null,
  alter column activation_snapshot_core_source_hash set not null;

-- Finalize the last nullable bootstrap column before capturing the exact
-- catalog envelope.  The temporary value is replaced before immutability is
-- installed and is covered by the final receipt self-fingerprint.
update public.hotel_seven_arches_independent_pricing_evolution_receipts receipt set
  receipt_fingerprint=repeat('0',64)
where receipt.id=1;
alter table public.hotel_seven_arches_independent_pricing_evolution_receipts
  alter column receipt_fingerprint set not null;
update public.hotel_seven_arches_independent_pricing_evolution_receipts receipt set
  catalog_fingerprint=
    public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()
where receipt.id=1;

-- The self-fingerprint excludes only its own value and canonicalizes every
-- receipt timestamp as integer Unix microseconds, independent of session
-- TimeZone and with PostgreSQL's exact timestamp precision preserved.
update public.hotel_seven_arches_independent_pricing_evolution_receipts receipt set
  receipt_fingerprint=public.hotel_v2_h3_2b_hash(
    jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
      to_jsonb(receipt)-'receipt_fingerprint',
      '{created_at}',to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false),
      '{upper_rate_updated_at_before}',to_jsonb((extract(epoch from receipt.upper_rate_updated_at_before)*1000000)::bigint),false),
      '{upper_rate_updated_at_after}',to_jsonb((extract(epoch from receipt.upper_rate_updated_at_after)*1000000)::bigint),false),
      '{ground_rate_updated_at_before}',to_jsonb((extract(epoch from receipt.ground_rate_updated_at_before)*1000000)::bigint),false),
      '{ground_rate_updated_at_after}',to_jsonb((extract(epoch from receipt.ground_rate_updated_at_after)*1000000)::bigint),false))
where receipt.id=1;

create trigger hotel_seven_arches_independent_pricing_authority_immutable
before insert or update or delete on public.hotel_seven_arches_independent_pricing_authority
for each row execute function public.hotel_v2_seven_arches_pricing_activation_immutable();
create trigger hotel_7a_independent_pricing_topology_receipt_immutable
before insert or update or delete on public.hotel_seven_arches_independent_pricing_topology_receipts
for each row execute function public.hotel_v2_seven_arches_pricing_activation_immutable();
create trigger hotel_7a_independent_pricing_evolution_receipt_immutable
before insert or update or delete on public.hotel_seven_arches_independent_pricing_evolution_receipts
for each row execute function public.hotel_v2_seven_arches_pricing_activation_immutable();

alter table public.hotel_seven_arches_independent_pricing_authority owner to postgres;
alter table public.hotel_seven_arches_independent_pricing_topology_receipts owner to postgres;
alter table public.hotel_seven_arches_independent_pricing_evolution_receipts owner to postgres;
alter function public.hotel_v2_h3_1p_allocation_preview(uuid) owner to postgres;
alter function public.hotel_v2_seven_arches_independent_pricing_oracle() owner to postgres;
alter function public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()
  owner to postgres;
alter function public.hotel_v2_seven_arches_independent_pricing_legacy_projection() owner to postgres;
alter function public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() owner to postgres;
alter function public.hotel_v2_admin_c_validate_pricing_graph(uuid) owner to postgres;
alter function public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_current_is_safe() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_snapshot_shared_core() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_snapshot() owner to postgres;
alter function public.hotel_v2_admin_get_seven_arches_pricing_activation() owner to postgres;

revoke all on function public.hotel_v2_h3_1p_allocation_preview(uuid),
  public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint(),
  public.hotel_v2_seven_arches_independent_pricing_oracle(),
  public.hotel_v2_seven_arches_independent_pricing_legacy_projection(),
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints(),
  public.hotel_v2_admin_c_validate_pricing_graph(uuid),
  public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
  public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact(),
  public.hotel_v2_seven_arches_pricing_activation_snapshot_shared_core(),
  public.hotel_v2_seven_arches_pricing_activation_snapshot(),
  public.hotel_v2_admin_get_seven_arches_pricing_activation()
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_get_seven_arches_pricing_activation()
  to authenticated;

-- Fail-closed local/runtime classification for the coordinated successor
-- predicates.  A false child aborts before the generic graph validator, so a
-- failed installation names the exact lineage layer without bypassing it.
do $seven_arches_independent_pricing_lineage_postcondition$
begin
  if public.hotel_v2_seven_arches_independent_pricing_legacy_projection() is null
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_lineage_postcondition_failed',
      detail=jsonb_build_object(
        'legacy_projection',
          public.hotel_v2_seven_arches_independent_pricing_legacy_projection() is not null,
        'topology_exact',
          public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
        'activation_current_safe',
          public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
        'activation_receipt_exact',
          public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact())::text;
  end if;
end
$seven_arches_independent_pricing_lineage_postcondition$;

do $seven_arches_independent_pricing_postconditions$
declare v_signature text; v_oid oid; v_relation text; v_role text; v_privilege text;
begin
  perform public.hotel_v2_admin_c_validate_pricing_graph(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid);
  set constraints all immediate;
  if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)->>'supported'
       is distinct from 'true'
     or public.hotel_v2_seven_arches_pricing_activation_snapshot()->>'status'
       is distinct from 'active'
     or public.hotel_v2_seven_arches_pricing_activation_snapshot()->>'pricing_authority'
       is distinct from 'independent_room_schedules' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_installation_failed';
  end if;
  foreach v_relation in array array[
    'hotel_seven_arches_independent_pricing_authority',
    'hotel_seven_arches_independent_pricing_topology_receipts',
    'hotel_seven_arches_independent_pricing_evolution_receipts'
  ] loop
    if not exists(select 1 from pg_class relation
      where relation.oid=('public.'||v_relation)::regclass
        and relation.relowner='postgres'::regrole and relation.relrowsecurity) then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_independent_pricing_relation_security_failed',
        detail=v_relation;
    end if;
    foreach v_role in array array['anon','authenticated','service_role'] loop
      foreach v_privilege in array array[
        'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(0::oid,('public.'||v_relation)::regclass,v_privilege)
           or has_table_privilege(v_role,('public.'||v_relation)::regclass,v_privilege) then
          raise exception using errcode='55000',
            message='hotels_v2_seven_arches_independent_pricing_raw_acl_failed',
            detail=v_relation||':'||v_role||':'||v_privilege;
        end if;
      end loop;
    end loop;
  end loop;
  foreach v_signature in array array[
    'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()',
    'public.hotel_v2_seven_arches_independent_pricing_catalog_fingerprint()',
    'public.hotel_v2_seven_arches_independent_pricing_oracle()',
    'public.hotel_v2_seven_arches_independent_pricing_legacy_projection()',
    'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
    'public.hotel_v2_external_calendar_protected_fingerprints()',
    'public.hotel_v2_admin_c_validate_pricing_graph(uuid)',
    'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
    'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
    'public.hotel_v2_seven_arches_pricing_activation_snapshot_shared_core()',
    'public.hotel_v2_seven_arches_pricing_activation_snapshot()',
    'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'
  ] loop
    v_oid:=to_regprocedure(v_signature);
    if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
       or not (select prosecdef from pg_proc where oid=v_oid)
       or (select proconfig from pg_proc where oid=v_oid) is distinct from
         array['search_path=pg_catalog, public']::text[]
       or has_function_privilege(0::oid,v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_independent_pricing_internal_security_failed',
        detail=v_signature;
    end if;
  end loop;
  v_oid:=to_regprocedure('public.hotel_v2_h3_1p_allocation_preview(uuid)');
  if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
     or (select prosecdef from pg_proc where oid=v_oid)
     or (select proconfig from pg_proc where oid=v_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_allocation_security_failed';
  end if;
  v_oid:=to_regprocedure('public.hotel_v2_admin_get_seven_arches_pricing_activation()');
  if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_oid)
     or (select proconfig from pg_proc where oid=v_oid)
       is distinct from array['search_path=pg_catalog, public, auth']::text[]
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE')
     or not has_function_privilege('authenticated',v_oid,'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_admin_rpc_security_failed';
  end if;
  if exists(select 1 from (values
      ('public.hotel_seven_arches_independent_pricing_authority'::regclass,
        'hotel_seven_arches_independent_pricing_authority_immutable'),
      ('public.hotel_seven_arches_independent_pricing_topology_receipts'::regclass,
        'hotel_7a_independent_pricing_topology_receipt_immutable'),
      ('public.hotel_seven_arches_independent_pricing_evolution_receipts'::regclass,
        'hotel_7a_independent_pricing_evolution_receipt_immutable')
    ) expected(relation_id,trigger_name)
    left join pg_trigger trigger_row on trigger_row.tgrelid=expected.relation_id
      and trigger_row.tgname=expected.trigger_name and not trigger_row.tgisinternal
    where trigger_row.oid is null or trigger_row.tgenabled<>'O'
      or trigger_row.tgtype<>31 or trigger_row.tgfoid<>
        'public.hotel_v2_seven_arches_pricing_activation_immutable()'::regprocedure) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_immutability_failed';
  end if;
end
$seven_arches_independent_pricing_postconditions$;

do $seven_arches_independent_pricing_timezone_unchanged$
begin
  if (select count(*)
      from seven_arches_independent_pricing_timezone_boundary)<>1
     or current_setting('TimeZone') is distinct from
       (select incoming_timezone
        from seven_arches_independent_pricing_timezone_boundary) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_independent_pricing_timezone_changed';
  end if;
end
$seven_arches_independent_pricing_timezone_unchanged$;

notify pgrst,'reload schema';
commit;
