begin;
set transaction isolation level read committed;
set local lock_timeout='15s';
set local statement_timeout='180s';

-- Install only the narrow Admin Apply timeout exemption. The accepted 114406
-- Apply body is not replaced: ALTER FUNCTION changes only pg_proc.proconfig.
-- The two installed topology validators are evolved at their exact Apply
-- proconfig leaves so the complete receipt/transaction contract remains exact.
do $seven_arches_activation_timeout_dependencies$
declare
  v_signature text;
begin
  if to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)')
       is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)')
       is null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_evolution_receipts') is null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_reviews') is null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_transaction_context') is null
     or to_regclass(
       'public.hotel_seven_arches_independent_pricing_evolution_receipts') is not null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()')
       is not null
     or to_regclass(
       'public.hotel_seven_arches_reviewed_pricing_evolution_receipts') is not null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts')
       is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_boundary_mismatch';
  end if;
  foreach v_signature in array array[
    'public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)',
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)',
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()',
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
    'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()',
    'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',
    'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_timeout_dependency_missing',
        detail=v_signature;
    end if;
  end loop;
end
$seven_arches_activation_timeout_dependencies$;

-- This is the complete protected relation universe held by the accepted Apply.
-- Holding it through the metadata-only change makes the before/after business
-- assertions immune to a concurrent writer; lock_timeout remains 15 seconds.
do $seven_arches_activation_timeout_locks$
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
    if not exists(select 1 from pg_locks lock_row
      where lock_row.pid=pg_backend_pid()
        and lock_row.locktype='relation'
        and lock_row.relation=v_relation::oid
        and lock_row.granted
        and lock_row.mode in('ShareRowExclusiveLock','AccessExclusiveLock')) then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_timeout_lock_failed',
        detail=v_relation::text;
    end if;
  end loop;
end
$seven_arches_activation_timeout_locks$;

do $seven_arches_activation_timeout_evolution$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_plan constant uuid:='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  c_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_preview_schedule constant uuid:='443065c0-984a-5de3-a22a-d03042c41107';
  v_apply_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)');
  v_receipt_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()');
  v_transaction_oid oid:=to_regprocedure(
    'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()');
  v_definition text;
  v_source text;
  v_expected_source text;
  v_old text;
  v_new text;
  v_review_fingerprint_before text;
  v_pricing_fingerprint_before text;
  v_tier_fingerprint_before text;
  v_payment_fingerprint_before text;
  v_commission_fingerprint_before text;
  v_activity_fingerprint_before text;
  v_admin_receipt_fingerprint_before text;
  v_flags_before jsonb;
begin
  -- Exact accepted 114406 sources, metadata, and semantic ACLs.
  if not exists(select 1 from pg_proc procedure_row
    join pg_language language_row on language_row.oid=procedure_row.prolang
    where procedure_row.oid=v_apply_oid
      and procedure_row.proowner='postgres'::regrole
      and language_row.lanname='plpgsql'
      and procedure_row.prokind='f'
      and procedure_row.prosecdef
      and procedure_row.provolatile='v'
      and not procedure_row.proleakproof
      and not procedure_row.proretset
      and procedure_row.proconfig=
        array['search_path=pg_catalog, public, auth']::text[]
      and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
        'sha256'),'hex')=
        '786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef'
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      and (select count(*) from aclexplode(coalesce(procedure_row.proacl,
        acldefault('f',procedure_row.proowner))) acl
        where acl.grantee<>procedure_row.proowner)=1
      and (select count(*) from aclexplode(coalesce(procedure_row.proacl,
        acldefault('f',procedure_row.proowner))) acl
        where acl.grantee='authenticated'::regrole
          and acl.privilege_type='EXECUTE' and not acl.is_grantable)=1) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_apply_boundary_drift';
  end if;
  if not exists(select 1 from pg_proc procedure_row
    join pg_language language_row on language_row.oid=procedure_row.prolang
    where procedure_row.oid=v_receipt_oid
      and procedure_row.proowner='postgres'::regrole
      and language_row.lanname='plpgsql'
      and procedure_row.prokind='f'
      and procedure_row.prosecdef and procedure_row.provolatile='s'
      and not procedure_row.proleakproof and not procedure_row.proretset
      and procedure_row.proconfig=
        array['search_path=pg_catalog, public']::text[]
      and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
        'sha256'),'hex')=
        '2829ec9059a4e035344ed35d26c7cac1d12c7296fd91ab498c7df78aa8f13dee'
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(procedure_row.proacl,
        acldefault('f',procedure_row.proowner))) acl
        where acl.grantee<>procedure_row.proowner)) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_receipt_boundary_drift';
  end if;
  if not exists(select 1 from pg_proc procedure_row
    join pg_language language_row on language_row.oid=procedure_row.prolang
    where procedure_row.oid=v_transaction_oid
      and procedure_row.proowner='postgres'::regrole
      and language_row.lanname='plpgsql'
      and procedure_row.prokind='f'
      and procedure_row.prosecdef and procedure_row.provolatile='s'
      and not procedure_row.proleakproof and not procedure_row.proretset
      and procedure_row.proconfig=
        array['search_path=pg_catalog, public']::text[]
      and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
        'sha256'),'hex')=
        '54b3d6baea7b5b99330b2cb6cdb212314d80e41da75a9ab8f800bc7dab215fdb'
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(procedure_row.proacl,
        acldefault('f',procedure_row.proowner))) acl
        where acl.grantee<>procedure_row.proowner)) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_transaction_boundary_drift';
  end if;
  if not exists(select 1 from pg_proc procedure_row
    where procedure_row.oid=to_regprocedure(
      'public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)')
      and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
        'sha256'),'hex')=
        '17f80cd334cfd5aeeef64b620dcf4785a5a662e1a1a0e64696516f86c778ffe0')
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=to_regprocedure(
         'public.hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)')
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')=
           '34a597ce33e7340b4c3779ecf60286abc51aa67661954a9b616a9f2af2eb0e06') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_transport_boundary_drift';
  end if;

  -- Exact pre-activation state; an unconsumed pre-114407 Review may remain,
  -- but this metadata-only install neither consumes nor rewrites it.
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or exists(select 1 from public.hotel_seven_arches_pricing_activation_reviews
       where consumed_at is not null)
     or not exists(select 1 from public.hotel_rate_plans
       where id=c_plan and hotel_id=c_hotel and not is_active)
     or (select count(*) from public.hotel_room_rates
       where hotel_id=c_hotel and id in(c_upper_rate,c_ground_rate)
         and not is_active and base_nightly_rate=0
         and btrim(currency::text)='EUR')<>2
     or not exists(select 1 from public.hotel_pricing_schedules
       where id=c_schedule and hotel_id=c_hotel and not is_active
         and review_status='reviewed' and btrim(currency::text)='EUR')
     or not exists(select 1 from public.hotel_pricing_schedules
       where id=c_preview_schedule and hotel_id=c_hotel and not is_active
         and review_status='requires_review' and btrim(currency::text)='EUR')
     or (select count(*)
       from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id=c_schedule and tier.is_active)<>27
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
       is not true
     or public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       is not true
     or (select count(*) from public.hotel_commission_policies policy
       where policy.hotel_id=c_hotel and policy.is_active
         and policy.review_status='reviewed'
         and policy.commission_mode='per_allocated_room_per_night'
         and policy.amount=10 and btrim(policy.currency::text)='EUR')<>1
     or not exists(select 1 from public.hotels hotel
       where hotel.id=c_hotel and hotel.architecture_version='legacy')
     or not exists(select 1 from public.site_settings setting
       where setting.id=1
         and setting.hotel_rooms_v2_enabled is not distinct from false
         and setting.hotel_external_sync_enabled is not null
         and setting.hotel_instant_booking_enabled is not distinct from false
         and setting.hotel_stripe_connect_enabled is not distinct from false)
     or exists(select 1 from public.hotel_activity_log activity
       where activity.hotel_id=c_hotel
         and activity.source='hotels_v2_seven_arches_pricing_activation')
     or exists(select 1 from public.hotel_admin_pricing_action_receipts receipt
       where receipt.hotel_id=c_hotel and receipt.result->>'contract_version'=
         'hotels_v2_seven_arches_pricing_activation_apply_result_v1') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_business_boundary_drift';
  end if;

  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(review)
      order by review.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
    into v_review_fingerprint_before
  from public.hotel_seven_arches_pricing_activation_reviews review;
  select encode(extensions.digest(convert_to(jsonb_build_object(
      'plan',(select to_jsonb(plan) from public.hotel_rate_plans plan
        where plan.id=c_plan),
      'rates',(select jsonb_agg(to_jsonb(rate) order by rate.id)
        from public.hotel_room_rates rate
        where rate.id in(c_upper_rate,c_ground_rate)),
      'schedule',(select to_jsonb(schedule)
        from public.hotel_pricing_schedules schedule where schedule.id=c_schedule),
      'preview_schedule',(select to_jsonb(schedule)
        from public.hotel_pricing_schedules schedule
        where schedule.id=c_preview_schedule))::text,
      'UTF8'),'sha256'),'hex')
    into v_pricing_fingerprint_before;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(tier)
      order by tier.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
    into v_tier_fingerprint_before
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id=c_schedule;
  select encode(extensions.digest(convert_to(jsonb_build_object(
      'policies',(select jsonb_agg(to_jsonb(policy) order by policy.id)
        from public.hotel_payment_policies policy where policy.hotel_id=c_hotel),
      'terms',(select jsonb_agg(to_jsonb(term) order by term.payment_policy_id,term.sequence)
        from public.hotel_payment_policy_terms term
        join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
        where policy.hotel_id=c_hotel))::text,'UTF8'),'sha256'),'hex')
    into v_payment_fingerprint_before;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(policy)
      order by policy.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
    into v_commission_fingerprint_before
  from public.hotel_commission_policies policy where policy.hotel_id=c_hotel;
  select to_jsonb(setting) into strict v_flags_before
  from public.site_settings setting where setting.id=1;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(activity)
      order by activity.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
    into v_activity_fingerprint_before
  from public.hotel_activity_log activity;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(receipt)
      order by receipt.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
    into v_admin_receipt_fingerprint_before
  from public.hotel_admin_pricing_action_receipts receipt;

  -- Exact leaf-only evolution of the transaction-preservation validator.
  select pg_get_functiondef(v_transaction_oid),procedure_row.prosrc
    into strict v_definition,v_source
  from pg_proc procedure_row where procedure_row.oid=v_transaction_oid;
  v_old:=$old$      and procedure_row.proconfig=
        array['search_path=pg_catalog, public, auth']::text[]$old$;
  v_new:=$new$      and procedure_row.proconfig=
        array['search_path=pg_catalog, public, auth','statement_timeout=60s']::text[]$new$;
  if (length(v_source)-length(replace(v_source,v_old,'')))/length(v_old)<>1
     or position(v_new in v_source)<>0
     or (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_transaction_patch_drift';
  end if;
  v_expected_source:=replace(v_source,v_old,v_new);
  execute replace(v_definition,v_old,v_new);
  if (select prosrc from pg_proc where oid=v_transaction_oid)
       is distinct from v_expected_source then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_transaction_patch_failed';
  end if;

  -- Exact leaf-only evolution of the immutable receipt validator.
  select pg_get_functiondef(v_receipt_oid),procedure_row.prosrc
    into strict v_definition,v_source
  from pg_proc procedure_row where procedure_row.oid=v_receipt_oid;
  v_old:=$old$     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=v_apply_oid
         and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
         and procedure_row.provolatile='v'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public, auth']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
           'hex')='786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef'$old$;
  v_new:=$new$     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=v_apply_oid
         and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
         and procedure_row.provolatile='v'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public, auth','statement_timeout=60s']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
           'hex')='786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef'$new$;
  if (length(v_source)-length(replace(v_source,v_old,'')))/length(v_old)<>1
     or position(v_new in v_source)<>0
     or (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_receipt_patch_drift';
  end if;
  v_expected_source:=replace(v_source,v_old,v_new);
  execute replace(v_definition,v_old,v_new);
  if (select prosrc from pg_proc where oid=v_receipt_oid)
       is distinct from v_expected_source then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_receipt_patch_failed';
  end if;

  -- This is the only runtime function change.  The body and its accepted
  -- source hash remain byte-identical; no lock_timeout override is introduced.
  execute $ddl$alter function
    public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)
    set statement_timeout='60s'$ddl$;

  -- Postconditions pin the exact runtime metadata and ensure both validators
  -- evolved only at the intended Apply proconfig leaf.
  if not exists(select 1 from pg_proc procedure_row
    join pg_language language_row on language_row.oid=procedure_row.prolang
    where procedure_row.oid=v_apply_oid
      and procedure_row.proowner='postgres'::regrole
      and language_row.lanname='plpgsql'
      and procedure_row.prokind='f'
      and procedure_row.prosecdef and procedure_row.provolatile='v'
      and not procedure_row.proleakproof and not procedure_row.proretset
      and procedure_row.proconfig=array[
        'search_path=pg_catalog, public, auth','statement_timeout=60s']::text[]
      and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
        'sha256'),'hex')=
        '786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef'
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      and not exists(select 1 from unnest(procedure_row.proconfig) setting(value)
        where setting.value like 'lock_timeout=%')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_apply_postcondition_failed';
  end if;
  if not exists(select 1 from pg_proc procedure_row
    where procedure_row.oid=v_receipt_oid
      and procedure_row.proowner='postgres'::regrole
      and procedure_row.prosecdef and procedure_row.provolatile='s'
      and procedure_row.proconfig=
        array['search_path=pg_catalog, public']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=v_transaction_oid
         and procedure_row.proowner='postgres'::regrole
         and procedure_row.prosecdef and procedure_row.provolatile='s'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_validator_security_drift';
  end if;

  -- No Review, pricing, tier, payment, commission, or flag row may change.
  if v_review_fingerprint_before is distinct from (select encode(
       extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(review)
         order by review.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
       from public.hotel_seven_arches_pricing_activation_reviews review)
     or v_pricing_fingerprint_before is distinct from (select encode(
       extensions.digest(convert_to(jsonb_build_object(
         'plan',(select to_jsonb(plan) from public.hotel_rate_plans plan
           where plan.id=c_plan),
         'rates',(select jsonb_agg(to_jsonb(rate) order by rate.id)
           from public.hotel_room_rates rate
           where rate.id in(c_upper_rate,c_ground_rate)),
         'schedule',(select to_jsonb(schedule)
           from public.hotel_pricing_schedules schedule where schedule.id=c_schedule),
         'preview_schedule',(select to_jsonb(schedule)
           from public.hotel_pricing_schedules schedule
           where schedule.id=c_preview_schedule))::text,
         'UTF8'),'sha256'),'hex'))
     or v_tier_fingerprint_before is distinct from (select encode(
       extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(tier)
         order by tier.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
       from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id=c_schedule)
     or v_payment_fingerprint_before is distinct from (select encode(
       extensions.digest(convert_to(jsonb_build_object(
         'policies',(select jsonb_agg(to_jsonb(policy) order by policy.id)
           from public.hotel_payment_policies policy where policy.hotel_id=c_hotel),
         'terms',(select jsonb_agg(to_jsonb(term) order by term.payment_policy_id,term.sequence)
           from public.hotel_payment_policy_terms term
           join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
           where policy.hotel_id=c_hotel))::text,'UTF8'),'sha256'),'hex'))
     or v_commission_fingerprint_before is distinct from (select encode(
       extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(policy)
         order by policy.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
       from public.hotel_commission_policies policy where policy.hotel_id=c_hotel)
     or v_flags_before is distinct from (select to_jsonb(setting)
       from public.site_settings setting where setting.id=1)
     or v_activity_fingerprint_before is distinct from (select encode(
       extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(activity)
         order by activity.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
       from public.hotel_activity_log activity)
     or v_admin_receipt_fingerprint_before is distinct from (select encode(
       extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(receipt)
         order by receipt.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
       from public.hotel_admin_pricing_action_receipts receipt)
     or (select count(*)
       from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or exists(select 1 from public.hotel_seven_arches_pricing_activation_reviews
       where consumed_at is not null)
     or exists(select 1 from public.hotel_activity_log activity
       where activity.hotel_id=c_hotel
         and activity.source='hotels_v2_seven_arches_pricing_activation')
     or exists(select 1 from public.hotel_admin_pricing_action_receipts receipt
       where receipt.hotel_id=c_hotel and receipt.result->>'contract_version'=
         'hotels_v2_seven_arches_pricing_activation_apply_result_v1')
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
       is not true
     or public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_timeout_business_postcondition_failed';
  end if;
end
$seven_arches_activation_timeout_evolution$;

notify pgrst,'reload schema';
commit;
