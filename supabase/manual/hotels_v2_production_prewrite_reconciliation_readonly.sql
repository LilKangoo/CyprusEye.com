BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '120s';

DO $production_prewrite_gate$
DECLARE
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid := 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid := '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_upper_rate constant uuid := '7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_rate constant uuid := '3320590d-632d-423f-80d0-fd021cba7293';
  c_shared_schedule constant uuid := 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_legacy_schedule constant uuid := '443065c0-984a-5de3-a22a-d03042c41107';
  c_owner_action constant uuid := '37500000-0000-4000-8000-000000000001';
  c_owner_correlation constant uuid := '37500000-0000-4000-8000-000000000002';
  c_owner_idempotency constant uuid := '37500000-0000-4000-8000-000000000003';
  c_owner_activity constant uuid := '37500000-0000-4000-8000-000000000004';
  c_owner_outbox constant uuid := '37500000-0000-4000-8000-000000000005';
  c_system_actor constant uuid := '00000000-0000-0000-0000-000000000000';
  c_capabilities constant jsonb := jsonb_build_object(
    'edit_property_content',true,
    'edit_property_photos',true,
    'edit_room_content',true,
    'edit_room_photos',true,
    'create_rooms',true,
    'edit_room_structure',true,
    'manage_prices',true,
    'manage_availability',true,
    'process_bookings',true,
    'request_booking_changes',false,
    'view_payment_status',true,
    'initiate_stripe_onboarding',false
  );
  c_before_permission constant jsonb := jsonb_build_object(
    'exists',false,
    'version',0,
    'updated_at',null,
    'has_mutation_capability',false,
    'capabilities',jsonb_build_object(
      'edit_property_content',false,
      'edit_property_photos',false,
      'edit_room_content',false,
      'edit_room_photos',false,
      'create_rooms',false,
      'edit_room_structure',false,
      'manage_prices',false,
      'manage_availability',false,
      'process_bookings',false,
      'request_booking_changes',false,
      'view_payment_status',false,
      'initiate_stripe_onboarding',false
    )
  );
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_property_receipt public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_history jsonb := '[]'::jsonb;
  v_history_boundary text;
  v_version text;
  v_recorded boolean;
  v_objects_114360 boolean := false;
  v_objects_114370 boolean := false;
  v_later_absent boolean := false;
  v_installed_boundary text := 'UNKNOWN';
  v_owner_receipt_exact boolean := false;
  v_owner_relation_security_exact boolean := false;
  v_owner_function_security_exact boolean := false;
  v_owner_audit_exact boolean := false;
  v_reconciliation_114360_safe boolean := false;
  v_property_receipt_exact boolean := false;
  v_property_relation_security_exact boolean := false;
  v_property_function_security_exact boolean := false;
  v_property_trigger_index_exact boolean := false;
  v_property_attribution_exact boolean := false;
  v_reconciliation_114370_safe boolean := false;
  v_expected_property jsonb;
  v_authorized_property jsonb;
  v_actual_property jsonb;
  v_parity jsonb;
  v_payment_policy_identity_exact boolean := false;
  v_payment_activity_chain_exact boolean := false;
  v_payment_writer_security_exact boolean := false;
  v_payment_relation_security_exact boolean := false;
  v_payment_consumer_inventory_exact boolean := false;
  v_payment_policy_lineage_safe boolean := false;
  v_payment_activity_count bigint := 0;
  v_payment_constraint_fingerprint text;
  v_payment_trigger_fingerprint text;
  v_payment_security_fingerprint text;
  v_scoped_hotels_lineage_safe boolean := false;
  v_pending_property bigint := 0;
  v_pending_pricing bigint := 0;
  v_pending_provider bigint := 0;
  v_unconsumed_reviews bigint := 0;
  v_transaction_contexts bigint := 0;
  v_open_jobs bigint := 0;
  v_active_leases bigint := 0;
  v_stale_leases bigint := 0;
  v_hotel_locks bigint := 0;
  v_protected_locks bigint := 0;
  v_long_transactions bigint := 0;
  v_unprocessed_outbox bigint := 0;
  v_exact_known_outbox bigint := 0;
  v_known_outbox_nonblocking boolean := false;
  v_maintenance_window_clear boolean := false;
  v_operation_rows jsonb := '[]'::jsonb;
  v_vault_extension boolean := false;
  v_worker_url_secret boolean := false;
  v_worker_shared_secret boolean := false;
  v_worker_rpcs boolean := false;
  v_scheduler_functions boolean := false;
  v_scheduler_job boolean := false;
  v_vault_worker_readiness_safe boolean := false;
  v_payload jsonb;
  v_count bigint;
  v_name text;
  v_relation regclass;
  v_protected_names constant text[] := array[
    'public.hotels',
    'public.hotel_units',
    'public.hotel_rate_plans',
    'public.hotel_pricing_schedules',
    'public.hotel_property_pricing_defaults',
    'public.hotel_rate_rules',
    'public.hotel_room_allocation_rules',
    'public.hotel_room_allocation_rule_items',
    'public.hotel_unit_calendar_blocks',
    'public.hotel_inventory_holds',
    'public.hotel_booking_room_allocations',
    'public.hotel_inventory_commitments',
    'public.hotel_calendar_source_configs',
    'public.hotel_payment_policies',
    'public.hotel_payment_policy_terms',
    'public.hotel_commission_policies',
    'public.hotel_daily_rates',
    'public.hotel_pricing_promotion_reviews',
    'public.hotel_admin_pricing_action_receipts',
    'public.hotel_admin_availability_action_receipts',
    'public.hotel_admin_availability_plan_reviews',
    'public.hotel_admin_availability_foundation_receipts',
    'public.hotel_admin_availability_foundation_evolution_receipts',
    'public.hotel_bookings',
    'public.partner_service_fulfillments',
    'public.partner_service_fulfillment_form_snapshots',
    'public.service_deposit_requests',
    'public.service_deposit_rules',
    'public.service_deposit_overrides',
    'public.service_coupons',
    'public.service_coupon_redemptions',
    'public.referrals',
    'public.affiliate_commission_events',
    'public.affiliate_payouts',
    'public.affiliate_adjustments',
    'public.affiliate_program_settings',
    'public.affiliate_referrer_overrides',
    'public.affiliate_cashout_requests',
    'public.profile_referral_code_aliases',
    'public.partners',
    'public.partner_users',
    'public.partner_resources',
    'public.partner_user_resources',
    'public.hotel_partner_hotel_permissions',
    'public.site_settings',
    'public.hotel_room_types',
    'public.hotel_room_rates',
    'public.hotel_pricing_schedule_occupancy_tiers',
    'public.hotel_room_rate_occupancy_tiers',
    'public.hotel_calendar_overrides',
    'public.hotel_daily_inventory',
    'public.hotel_partner_action_receipts',
    'public.hotel_partner_event_outbox',
    'public.hotel_activity_log',
    'public.hotel_property_operational_profiles',
    'public.hotel_partner_workspace_foundation_receipts',
    'public.hotel_partner_property_proposal_foundation_receipts',
    'public.hotel_partner_property_proposal_admin_reviews',
    'public.hotel_partner_property_drafts',
    'hotels_v2_private.hotel_external_calendar_foundation_receipts',
    'hotels_v2_private.hotel_external_calendar_activation_receipts',
    'hotels_v2_private.hotel_external_calendar_plan_reviews',
    'hotels_v2_private.hotel_external_calendar_correlations',
    'hotels_v2_private.hotel_external_calendar_admin_receipts'
  ];
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION USING errcode='25006',
      message='hotels_v2_production_prewrite_gate_requires_read_only_transaction';
  END IF;

  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'select coalesce(max(version::text),'''') from supabase_migrations.schema_migrations'
      INTO v_version;
    v_history_boundary := CASE
      WHEN v_version = '20260811435000' THEN '114350'
      ELSE 'UNEXPECTED:' || nullif(v_version,'')
    END;
    FOREACH v_version IN ARRAY array[
      '20260811435000','20260811436000','20260811437000',
      '20260811440000','20260811440500','20260811441000',
      '20260811441500','20260811442000','20260811442500','20260811445000'
    ] LOOP
      EXECUTE 'select exists(select 1 from supabase_migrations.schema_migrations where version::text=$1)'
        INTO v_recorded USING v_version;
      v_history := v_history || jsonb_build_array(jsonb_build_object(
        'migration',v_version,
        'recorded',v_recorded,
        'expected_recorded',v_version='20260811435000',
        'exact',v_recorded=(v_version='20260811435000')
      ));
    END LOOP;
  ELSE
    v_history_boundary := 'MIGRATION_HISTORY_TABLE_ABSENT';
  END IF;

  v_objects_114360 :=
    to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') IS NOT NULL
    AND to_regprocedure('public.hotel_v2_seven_arches_owner_capabilities()') IS NOT NULL
    AND to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') IS NOT NULL;
  v_objects_114370 :=
    to_regclass('public.hotel_partner_property_proposal_admin_reviews') IS NOT NULL
    AND to_regclass('public.hotel_partner_property_proposal_admin_transaction_context') IS NOT NULL
    AND to_regclass('public.hotel_partner_property_proposal_foundation_receipts') IS NOT NULL
    AND to_regprocedure('public.hotel_v2_admin_get_partner_property_proposals(uuid)') IS NOT NULL
    AND to_regprocedure('public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb)') IS NOT NULL
    AND to_regprocedure('public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)') IS NOT NULL
    AND to_regprocedure('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()') IS NOT NULL
    AND to_regprocedure('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') IS NOT NULL;
  v_later_absent :=
    to_regprocedure('public.hotel_v2_seven_arches_pricing_scoped_lineage()') IS NULL
    AND to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') IS NULL
    AND to_regclass('public.hotel_seven_arches_independent_pricing_evolution_receipts') IS NULL
    AND to_regclass('public.hotel_seven_arches_reviewed_pricing_foundation_receipts') IS NULL
    AND to_regclass('public.hotel_seven_arches_public_booking_receipts') IS NULL
    AND to_regprocedure('public.hotel_v2_external_calendar_site_settings_fingerprint()') IS NULL
    AND to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') IS NULL;
  IF v_objects_114360 AND v_objects_114370 AND v_later_absent THEN
    v_installed_boundary := '114370';
  ELSIF NOT v_objects_114360 THEN
    v_installed_boundary := 'BEFORE_114360_OR_PARTIAL';
  ELSIF NOT v_objects_114370 THEN
    v_installed_boundary := '114360_OR_PARTIAL_114370';
  ELSE
    v_installed_boundary := 'AFTER_114370_OR_PARTIAL_LATER_STAGE';
  END IF;

  IF v_objects_114360 AND v_objects_114370 THEN
    SELECT * INTO STRICT v_owner
    FROM public.hotel_admin_availability_foundation_evolution_receipts
    WHERE id=1;
    SELECT * INTO STRICT v_property_receipt
    FROM public.hotel_partner_property_proposal_foundation_receipts
    WHERE id=1;

    v_owner_receipt_exact :=
      (SELECT count(*)=1 FROM public.hotel_admin_availability_foundation_evolution_receipts)
      AND v_owner.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
      AND v_owner.original_foundation_receipt_id=1
      AND (SELECT count(*) FROM public.hotel_admin_availability_foundation_receipts)=1
      AND EXISTS(SELECT 1 FROM public.hotel_admin_availability_foundation_receipts original
        WHERE original.id=v_owner.original_foundation_receipt_id
          AND original.protected_fingerprint=encode(extensions.digest(convert_to(
            original.protected_fingerprints::text,'UTF8'),'sha256'),'hex')
          AND original.protected_fingerprint=v_owner.original_protected_fingerprint)
      AND v_owner.hotel_id=c_hotel
      AND v_owner.permission_version=1
      AND v_owner.action_receipt_id=c_owner_action
      AND v_owner.correlation_id=c_owner_correlation
      AND v_owner.idempotency_key=c_owner_idempotency
      AND v_owner.activity_id=c_owner_activity
      AND v_owner.outbox_id=c_owner_outbox
      AND v_owner.created_at IS NOT NULL AND isfinite(v_owner.created_at)
      AND v_owner.before_current_protected_fingerprint=
        encode(extensions.digest(convert_to(
          v_owner.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
      AND v_owner.current_protected_fingerprint=
        encode(extensions.digest(convert_to(
          v_owner.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
      AND v_owner.stage2_before_current_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          v_owner.stage2_before_current_protected_fingerprints)
      AND v_owner.stage2_current_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          v_owner.stage2_current_protected_fingerprints)
      AND v_owner.allowed_fingerprint_keys=array[
        'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
        'hotel_partner_event_outbox','non_admin_d_activity']::text[]
      AND (v_owner.current_protected_fingerprints-v_owner.allowed_fingerprint_keys)
        IS NOT DISTINCT FROM
        (v_owner.before_current_protected_fingerprints-v_owner.allowed_fingerprint_keys)
      AND NOT EXISTS(SELECT 1 FROM unnest(v_owner.allowed_fingerprint_keys) changed(key_name)
        WHERE v_owner.before_current_protected_fingerprints->changed.key_name IS NULL
           OR v_owner.current_protected_fingerprints->changed.key_name IS NULL
           OR v_owner.before_current_protected_fingerprints->changed.key_name
              IS NOT DISTINCT FROM v_owner.current_protected_fingerprints->changed.key_name)
      AND v_owner.stage2_allowed_fingerprint_keys=array[
        'hotel_partner_hotel_permissions','non_external_calendar_activity',
        'non_external_calendar_partner_receipts']::text[]
      AND (v_owner.stage2_current_protected_fingerprints-v_owner.stage2_allowed_fingerprint_keys)
        IS NOT DISTINCT FROM
        (v_owner.stage2_before_current_protected_fingerprints-v_owner.stage2_allowed_fingerprint_keys)
      AND NOT EXISTS(SELECT 1 FROM unnest(v_owner.stage2_allowed_fingerprint_keys) changed(key_name)
        WHERE v_owner.stage2_before_current_protected_fingerprints->changed.key_name IS NULL
           OR v_owner.stage2_current_protected_fingerprints->changed.key_name IS NULL
           OR v_owner.stage2_before_current_protected_fingerprints->changed.key_name
              IS NOT DISTINCT FROM v_owner.stage2_current_protected_fingerprints->changed.key_name)
      AND v_owner.before_foreign_permissions_fingerprint=
          v_owner.current_foreign_permissions_fingerprint
      AND cardinality(v_owner.owner_user_ids)=3
      AND array_position(v_owner.owner_user_ids,null) IS NULL
      AND v_owner.owner_user_ids IS NOT DISTINCT FROM (SELECT array_agg(member.user_id ORDER BY member.user_id)
        FROM public.partner_users member
        WHERE member.partner_id=v_owner.partner_id AND member.role='owner')
      AND (SELECT count(*) FROM public.partner_users member
        WHERE member.partner_id=v_owner.partner_id AND member.role='owner')=3
      AND v_owner.owner_membership_fingerprint=encode(extensions.digest(convert_to(
        jsonb_build_object(
          'contract_version','hotels_v2_seven_arches_owner_membership_v1',
          'hotel_id',v_owner.hotel_id,'partner_id',v_owner.partner_id,
          'assignment_id',v_owner.assignment_id,'role','owner',
          'owner_user_ids',to_jsonb(v_owner.owner_user_ids))::text,'UTF8'),'sha256'),'hex')
      AND v_owner.before_permission IS NOT DISTINCT FROM c_before_permission
      AND v_owner.capabilities IS NOT DISTINCT FROM c_capabilities
      AND v_owner.after_permission IS NOT DISTINCT FROM
        public.hotel_v2_h3_2a_permissions_snapshot(v_owner.assignment_id)
      AND (SELECT count(*) FROM public.partner_resources assignment
        WHERE assignment.resource_type='hotels' AND assignment.resource_id=c_hotel)=1
      AND EXISTS(SELECT 1 FROM public.partner_resources assignment
        WHERE assignment.id=v_owner.assignment_id AND assignment.partner_id=v_owner.partner_id
          AND assignment.resource_type='hotels' AND assignment.resource_id=c_hotel)
      AND EXISTS(SELECT 1 FROM public.hotels hotel JOIN public.partners partner
        ON partner.id=hotel.owner_partner_id
        WHERE hotel.id=c_hotel AND partner.id=v_owner.partner_id
          AND partner.status='active' AND partner.can_manage_hotels)
      AND (SELECT count(*) FROM public.hotel_partner_hotel_permissions permission
        WHERE permission.hotel_id=c_hotel)=1
      AND EXISTS(SELECT 1 FROM public.hotel_partner_hotel_permissions permission
        WHERE permission.hotel_id=c_hotel AND permission.assignment_id=v_owner.assignment_id
          AND permission.partner_id=v_owner.partner_id AND permission.version=1
          AND permission.created_by IS NULL AND permission.updated_by IS NULL
          AND permission.has_mutation_capability
          AND public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
            IS NOT DISTINCT FROM v_owner.after_permission);

    -- The final condition above deliberately references no live whole-map equality.
    -- The 114370 cross-anchor below binds the complete immutable 114360 receipt.
    v_owner_receipt_exact := v_owner_receipt_exact
      AND v_property_receipt.owner_evolution_receipt_id=v_owner.id
      AND v_property_receipt.owner_evolution_receipt_fingerprint=
        public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),'{created_at}',
          to_jsonb(extract(epoch FROM v_owner.created_at)),false));

    SELECT NOT EXISTS(SELECT 1 FROM pg_class relation
      WHERE relation.oid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass
        AND NOT (relation.relowner='postgres'::regrole AND relation.relkind='r'
          AND relation.relpersistence='p' AND relation.relrowsecurity
          AND NOT relation.relforcerowsecurity))
      AND NOT EXISTS(SELECT 1 FROM pg_policy policy
        WHERE policy.polrelid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass)
      AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT relacl FROM pg_class
        WHERE oid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass),
          acldefault('r','postgres'::regrole))) acl
        WHERE acl.grantee<>'postgres'::regrole OR acl.is_grantable)
      AND (SELECT count(*) FROM aclexplode(coalesce((SELECT relacl FROM pg_class
        WHERE oid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass),
          acldefault('r','postgres'::regrole))))=7
      AND EXISTS(SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass
          AND trigger_row.tgname='hotel_admin_availability_foundation_evolution_immutable'
          AND trigger_row.tgfoid=to_regprocedure('public.hotel_v2_admin_d_immutable_row()')
          AND trigger_row.tgtype=27 AND trigger_row.tgenabled='O'
          AND NOT trigger_row.tgisinternal)
      INTO v_owner_relation_security_exact;

    SELECT NOT EXISTS(SELECT 1 FROM (VALUES
      ('public.hotel_v2_seven_arches_owner_capabilities()','sql','i'::"char",false,
        array['search_path=pg_catalog']::text[],
        'cd66ff70012c3c3e155eb62ae8f398278ad162878f976cc620caa86a2dab3fd6'),
      ('public.hotel_v2_admin_d_current_foundation_snapshot()','plpgsql','s'::"char",true,
        array['search_path=pg_catalog, public']::text[],
        '686ef8d305ba401d52c2e2f5ed9f41036a6418beb785144da52a857c4640c32a'),
      ('public.hotel_v2_admin_d_immutable_row()','plpgsql','v'::"char",false,
        array['search_path=pg_catalog']::text[],
        'bf10c8d2393ef28580dc1079c3b07f0985c6676cce1e5792460aedc6c1453bfa')
    ) expected(signature,language_name,volatility,security_definer,configuration,source_hash)
    LEFT JOIN pg_proc procedure_row ON procedure_row.oid=to_regprocedure(expected.signature)
    LEFT JOIN pg_language language_row ON language_row.oid=procedure_row.prolang
    WHERE procedure_row.oid IS NULL OR procedure_row.proowner<>'postgres'::regrole
      OR language_row.lanname<>expected.language_name
      OR procedure_row.provolatile<>expected.volatility
      OR procedure_row.prosecdef IS DISTINCT FROM expected.security_definer
      OR procedure_row.proconfig IS DISTINCT FROM expected.configuration
      OR procedure_row.proleakproof OR procedure_row.proisstrict OR procedure_row.proretset
      OR encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
         <>expected.source_hash
      OR has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      OR has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      OR has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      OR has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
      INTO v_owner_function_security_exact;

    v_owner_audit_exact :=
      (SELECT count(*) FROM public.hotel_activity_log activity
        WHERE activity.id=c_owner_activity AND activity.correlation_id=c_owner_correlation)=1
      AND EXISTS(SELECT 1 FROM public.hotel_activity_log activity
        WHERE activity.id=c_owner_activity AND activity.hotel_id=c_hotel
          AND activity.entity_type='property' AND activity.entity_id=c_hotel
          AND activity.action='update' AND activity.actor_type='system' AND activity.actor_id IS NULL
          AND activity.source='hotels_v2_seven_arches_owner_capability_bootstrap'
          AND activity.correlation_id=c_owner_correlation
          AND activity.before_state=jsonb_build_object('partner_permissions',v_owner.before_permission,
            'assignment_id',v_owner.assignment_id,'partner_id',v_owner.partner_id)
          AND activity.after_state=jsonb_build_object('partner_permissions',v_owner.after_permission,
            'assignment_id',v_owner.assignment_id,'partner_id',v_owner.partner_id))
      AND (SELECT count(*) FROM public.hotel_partner_action_receipts receipt
        WHERE receipt.id=c_owner_action OR receipt.correlation_id=c_owner_correlation
          OR receipt.idempotency_key=c_owner_idempotency)=1
      AND EXISTS(SELECT 1 FROM public.hotel_partner_action_receipts receipt
        WHERE receipt.id=c_owner_action AND receipt.partner_id=v_owner.partner_id
          AND receipt.hotel_id=c_hotel AND receipt.actor_user_id=c_system_actor
          AND receipt.action='bootstrap_7_arches_owner_capabilities'
          AND receipt.idempotency_key=c_owner_idempotency
          AND receipt.correlation_id=c_owner_correlation
          AND receipt.request_hash=v_owner.request_hash
          AND receipt.request_hash=encode(extensions.digest(convert_to(jsonb_build_object(
            'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
            'actor_type','system','hotel_id',c_hotel,'partner_id',v_owner.partner_id,
            'assignment_id',v_owner.assignment_id,
            'owner_user_ids',to_jsonb(v_owner.owner_user_ids),
            'owner_membership_fingerprint',v_owner.owner_membership_fingerprint,
            'capabilities',v_owner.capabilities)::text,'UTF8'),'sha256'),'hex')
          AND receipt.result IS NOT DISTINCT FROM jsonb_build_object(
            'ok',true,'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
            'source','hotels_v2_seven_arches_owner_capability_bootstrap',
            'hotel_id',c_hotel,'partner_id',v_owner.partner_id,
            'assignment_id',v_owner.assignment_id,'changed',true,
            'permission',v_owner.after_permission,'correlation_id',c_owner_correlation,
            'idempotency_key',c_owner_idempotency))
      AND (SELECT count(*) FROM public.hotel_partner_event_outbox event
        WHERE event.id=c_owner_outbox
          OR event.dedupe_key='h3_2a:permission:'||c_owner_action::text)=1
      AND EXISTS(SELECT 1 FROM public.hotel_partner_event_outbox event
        WHERE event.id=c_owner_outbox AND event.partner_id=v_owner.partner_id
          AND event.hotel_id=c_hotel AND event.aggregate_type='hotel_partner_permissions'
          AND event.aggregate_id=v_owner.assignment_id
          AND event.event_type='hotel.partner_permissions.updated'
          AND event.dedupe_key='h3_2a:permission:'||c_owner_action::text
          AND event.payload IS NOT DISTINCT FROM jsonb_build_object(
            'hotel_id',c_hotel,'assignment_id',v_owner.assignment_id,
            'partner_id',v_owner.partner_id,'permission_version',1,
            'has_mutation_capability',true,'correlation_id',c_owner_correlation));

    v_reconciliation_114360_safe := v_owner_receipt_exact
      AND v_owner_relation_security_exact
      AND v_owner_function_security_exact
      AND v_owner_audit_exact;

    v_property_receipt_exact :=
      (SELECT count(*)=1 FROM public.hotel_partner_property_proposal_foundation_receipts)
      AND (SELECT count(*)=1 FROM public.hotel_partner_workspace_foundation_receipts)
      AND v_property_receipt.id=1
      AND v_property_receipt.original_h3_2b_foundation_fingerprint=(SELECT protected_fingerprint
        FROM public.hotel_partner_workspace_foundation_receipts WHERE id=1)
      AND EXISTS(SELECT 1 FROM public.hotel_partner_workspace_foundation_receipts receipt
        WHERE receipt.id=1 AND receipt.protected_fingerprint=
          public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
      AND v_property_receipt.owner_evolution_receipt_id=v_owner.id
      AND v_property_receipt.owner_evolution_receipt_fingerprint=
        public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),'{created_at}',
          to_jsonb(extract(epoch FROM v_owner.created_at)),false))
      AND jsonb_typeof(v_property_receipt.proposal_fields_baseline)='object'
      AND (SELECT count(*) FROM jsonb_object_keys(v_property_receipt.proposal_fields_baseline))=18
      AND v_property_receipt.proposal_fields_baseline ?& array[
        'title','title_i18n','description','description_i18n','city','address_line',
        'district','postal_code','country','latitude','longitude','google_maps_url',
        'amenities','check_in_from','check_out_until','cover_image_url','photos','updated_at']::text[]
      AND v_property_receipt.protected_fingerprint=
        public.hotel_v2_h3_2b_hash(v_property_receipt.protected_fingerprints)
      AND v_property_receipt.stage2_compatibility_source_hash=
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure)))
      AND v_property_receipt.partner_workspace_source_after_hash=
        public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure)))
      AND v_property_receipt.partner_workspace_source_before_hash<>
          v_property_receipt.partner_workspace_source_after_hash
      AND v_property_receipt.partner_workspace_lineage_validator_source_hash=
        public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_partner_workspace_function_lineage_is_exact()'::regprocedure)))
      AND v_property_receipt.provider_source_attribution_source_hash=
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure)))
      AND v_property_receipt.created_at IS NOT NULL AND isfinite(v_property_receipt.created_at);

    SELECT NOT EXISTS(SELECT 1 FROM (VALUES
      ('public.hotel_partner_property_drafts'),
      ('public.hotel_partner_property_proposal_admin_reviews'),
      ('public.hotel_partner_property_proposal_admin_transaction_context'),
      ('public.hotel_partner_property_proposal_foundation_receipts')
    ) expected(relation_name)
    LEFT JOIN pg_class relation ON relation.oid=to_regclass(expected.relation_name)
    WHERE relation.oid IS NULL OR relation.relowner<>'postgres'::regrole
      OR relation.relkind<>'r' OR relation.relpersistence<>'p'
      OR NOT relation.relrowsecurity OR relation.relforcerowsecurity
      OR EXISTS(SELECT 1 FROM pg_policy policy WHERE policy.polrelid=relation.oid)
      OR EXISTS(SELECT 1 FROM aclexplode(coalesce(relation.relacl,
        acldefault('r',relation.relowner))) acl
        WHERE acl.grantee<>relation.relowner OR acl.is_grantable)
      OR (SELECT count(*) FROM aclexplode(coalesce(relation.relacl,
        acldefault('r',relation.relowner))))<>7)
      INTO v_property_relation_security_exact;

    SELECT NOT EXISTS(SELECT 1 FROM (VALUES
      ('public.hotel_v2_seven_arches_property_proposal_review_guard()','plpgsql','v'::"char",false,
        array['search_path=pg_catalog']::text[],false,
        '4c9fd78056aca97b24cd35a9dfd8c4cd801c6bc7fbeb123b1771e1e7f6ffca7c'),
      ('public.hotel_v2_h3_2b_guard_property_draft()','plpgsql','v'::"char",false,
        array['search_path=pg_catalog, public']::text[],false,
        '2c6f92004976e3a73870a16dffde915fdb69d5e8fd2b1f20714b9d9462655fe3'),
      ('public.hotel_v2_h3_2b_property_draft_projection(uuid)','sql','s'::"char",true,
        array['search_path=pg_catalog, public']::text[],false,
        '50e1eabba8b03d20fac7f0c9d4fc8ccf0ce05a8d72971d1a136fb42455bced36'),
      ('public.hotel_v2_admin_get_partner_property_proposals(uuid)','plpgsql','s'::"char",true,
        array['search_path=pg_catalog, public, auth']::text[],true,
        '45972ad3e08c26c1b079501bad322453e9e38aa5c0fe04a47ef8f6b5f25ade77'),
      ('public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb)','plpgsql','v'::"char",true,
        array['search_path=pg_catalog, public, auth']::text[],true,
        '9ceed03c9c7bfc192fecf504b3eb943b53039b71a08b926340a2ab0a1a64ecc4'),
      ('public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)','plpgsql','v'::"char",true,
        array['search_path=pg_catalog, public, auth']::text[],true,
        'd1d166b0662601f466c517014f641c4555c563f9fb71e0c0dd2b2de43fbb869b'),
      ('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()','plpgsql','s'::"char",true,
        array['search_path=pg_catalog, public']::text[],false,
        '2e4d7016306b94bd7b2b95060e494edb0ee028d3c9885e13899a13d3185a1a7e'),
      ('public.hotel_v2_external_calendar_provider_sources_are_attributable()','plpgsql','s'::"char",true,
        array['search_path=pg_catalog, public']::text[],false,
        '6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f'),
      ('public.hotel_v2_partner_workspace_function_lineage_is_exact()','plpgsql','s'::"char",true,
        array['search_path=pg_catalog, public']::text[],false,
        'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),
      ('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()','plpgsql','s'::"char",true,
        array['search_path=pg_catalog, public']::text[],false,
        '3cc1148945a35dd044203e88f5153374adf112188b84e83ce47f03d5a3193eca'),
      ('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()','plpgsql','s'::"char",true,
        array['search_path=pg_catalog, public']::text[],false,
        '860f2f7b4249a8b572780384628f9654f087eb73850d0a8fe37a1e2c7c5781e8')
    ) expected(signature,language_name,volatility,security_definer,configuration,authenticated_execute,source_hash)
    LEFT JOIN pg_proc procedure_row ON procedure_row.oid=to_regprocedure(expected.signature)
    LEFT JOIN pg_language language_row ON language_row.oid=procedure_row.prolang
    WHERE procedure_row.oid IS NULL OR procedure_row.proowner<>'postgres'::regrole
      OR language_row.lanname<>expected.language_name
      OR procedure_row.provolatile<>expected.volatility
      OR procedure_row.prosecdef IS DISTINCT FROM expected.security_definer
      OR procedure_row.proconfig IS DISTINCT FROM expected.configuration
      OR procedure_row.proleakproof OR procedure_row.proisstrict OR procedure_row.proretset
      OR encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
         <>expected.source_hash
      OR has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      OR has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      OR has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      OR has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         IS DISTINCT FROM expected.authenticated_execute)
      INTO v_property_function_security_exact;

    v_property_trigger_index_exact :=
      EXISTS(SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid='public.hotel_partner_property_drafts'::regclass
          AND trigger_row.tgname='hotel_partner_property_drafts_guard'
          AND trigger_row.tgfoid=to_regprocedure('public.hotel_v2_h3_2b_guard_property_draft()')
          AND trigger_row.tgtype=31 AND trigger_row.tgenabled='O'
          AND NOT trigger_row.tgisinternal)
      AND EXISTS(SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid='public.hotel_partner_property_proposal_admin_reviews'::regclass
          AND trigger_row.tgname='hotel_partner_property_proposal_admin_reviews_guard'
          AND trigger_row.tgfoid=to_regprocedure('public.hotel_v2_seven_arches_property_proposal_review_guard()')
          AND trigger_row.tgtype=31 AND trigger_row.tgenabled='O'
          AND NOT trigger_row.tgisinternal)
      AND EXISTS(SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid='public.hotel_partner_property_proposal_foundation_receipts'::regclass
          AND trigger_row.tgname='hotel_partner_property_proposal_foundation_receipts_immutable'
          AND trigger_row.tgfoid=to_regprocedure('public.hotel_v2_h3_2b_immutable_row()')
          AND trigger_row.tgtype=27 AND trigger_row.tgenabled='O'
          AND NOT trigger_row.tgisinternal)
      AND EXISTS(SELECT 1 FROM pg_index index_row
        JOIN pg_class index_relation ON index_relation.oid=index_row.indexrelid
        WHERE index_relation.relname='hotel_partner_property_drafts_one_pending_assignment_uidx'
          AND index_row.indrelid='public.hotel_partner_property_drafts'::regclass
          AND index_row.indisunique AND index_row.indisvalid AND index_row.indisready
          AND index_row.indnkeyatts=1
          AND pg_get_expr(index_row.indpred,index_row.indrelid)
            ='(status = ''pending_admin_review''::text)')
      AND NOT EXISTS(SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid='public.hotel_partner_property_drafts'::regclass
          AND constraint_row.conname IN(
            'hotel_partner_property_drafts_assignment_id_key',
            'hotel_partner_property_drafts_assignment_tuple_key'));

    v_property_attribution_exact :=
      public.hotel_v2_partner_workspace_function_lineage_is_exact()
      AND public.hotel_v2_external_calendar_provider_sources_are_attributable()
      AND public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
      AND NOT EXISTS(SELECT 1 FROM public.hotel_partner_property_drafts draft
        LEFT JOIN public.partner_resources assignment ON assignment.id=draft.assignment_id
          AND assignment.partner_id=draft.partner_id
          AND assignment.resource_type='hotels' AND assignment.resource_id=draft.hotel_id
        WHERE assignment.id IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.hotel_partner_property_drafts draft
        LEFT JOIN public.hotel_partner_property_proposal_admin_reviews review
          ON review.proposal_id=draft.id AND review.proposal_version+1=draft.version
          AND review.consumed_at IS NOT NULL
        WHERE draft.hotel_id=c_hotel AND draft.status IN('accepted','rejected') AND (
          review.id IS NULL
          OR review.action IS DISTINCT FROM CASE WHEN draft.status='accepted'
            THEN 'accept' ELSE 'reject' END
          OR NOT EXISTS(SELECT 1 FROM public.hotel_activity_log activity
            WHERE activity.correlation_id=review.consumed_correlation_id
              AND activity.source='hotels_v2_h3_2b_property_proposal_admin_review'
              AND activity.entity_type='property' AND activity.entity_id=draft.hotel_id)
          OR review.result->>'proposal_id' IS DISTINCT FROM draft.id::text
          OR review.result->>'status' IS DISTINCT FROM draft.status
          OR review.result->>'correlation_id'
             IS DISTINCT FROM review.consumed_correlation_id::text
          OR (draft.status='accepted' AND (
            review.result#>>'{admin_b_result,contract_version}'
              IS DISTINCT FROM 'hotels_v2_admin_b_property_control_v1'
            OR jsonb_typeof(review.result#>'{admin_b_result,changed}')<>'boolean'
            OR ((review.result#>>'{admin_b_result,changed}')::boolean
              AND NOT EXISTS(SELECT 1 FROM public.hotel_activity_log activity
                WHERE activity.correlation_id=review.consumed_correlation_id
                  AND activity.source='hotels_v2_admin_b_property_control'
                  AND activity.entity_type='property' AND activity.entity_id=draft.hotel_id
                  AND NOT EXISTS(SELECT 1 FROM jsonb_each(draft.content||draft.photos) proposed(key,value)
                    WHERE activity.after_state#>array['property',proposed.key]
                      IS DISTINCT FROM CASE
                        WHEN proposed.key IN('check_in_from','check_out_until')
                          AND proposed.value<>'null'::jsonb
                        THEN to_jsonb((proposed.value#>>'{}')::time)
                        ELSE proposed.value END)))
            OR (NOT (review.result#>>'{admin_b_result,changed}')::boolean AND (
              EXISTS(SELECT 1 FROM public.hotel_activity_log activity
                WHERE activity.correlation_id=review.consumed_correlation_id
                  AND activity.source='hotels_v2_admin_b_property_control')
              OR EXISTS(SELECT 1 FROM jsonb_each(draft.content||draft.photos) proposed(key,value)
                WHERE review.result#>'{admin_b_result,workspace,property}'->proposed.key
                  IS DISTINCT FROM CASE
                    WHEN proposed.key IN('check_in_from','check_out_until')
                      AND proposed.value<>'null'::jsonb
                    THEN to_jsonb((proposed.value#>>'{}')::time)
                    ELSE proposed.value END)))))
          OR (draft.status='rejected' AND EXISTS(SELECT 1 FROM public.hotel_activity_log activity
            WHERE activity.correlation_id=review.consumed_correlation_id
              AND activity.source='hotels_v2_admin_b_property_control'))))
      AND NOT EXISTS(SELECT 1 FROM public.hotel_partner_property_proposal_admin_transaction_context);

    v_reconciliation_114370_safe := v_property_receipt_exact
      AND v_property_relation_security_exact
      AND v_property_function_security_exact
      AND v_property_trigger_index_exact
      AND v_property_attribution_exact;

    v_expected_property := v_property_receipt.proposal_fields_baseline-'updated_at';
    SELECT activity.after_state->'property' INTO v_authorized_property
    FROM public.hotel_activity_log activity
    WHERE activity.hotel_id=c_hotel AND activity.entity_type='property'
      AND activity.source='hotels_v2_admin_b_property_control'
      AND activity.created_at>=v_property_receipt.created_at
    ORDER BY activity.created_at DESC,activity.id DESC LIMIT 1;
    IF v_authorized_property IS NOT NULL THEN
      v_expected_property := jsonb_build_object(
        'title',v_authorized_property->'title','title_i18n',v_authorized_property->'title_i18n',
        'description',v_authorized_property->'description',
        'description_i18n',v_authorized_property->'description_i18n',
        'city',v_authorized_property->'city','address_line',v_authorized_property->'address_line',
        'district',v_authorized_property->'district','postal_code',v_authorized_property->'postal_code',
        'country',v_authorized_property->'country','latitude',v_authorized_property->'latitude',
        'longitude',v_authorized_property->'longitude',
        'google_maps_url',v_authorized_property->'google_maps_url',
        'amenities',v_authorized_property->'amenities',
        'check_in_from',v_authorized_property->'check_in_from',
        'check_out_until',v_authorized_property->'check_out_until',
        'cover_image_url',v_authorized_property->'cover_image_url',
        'photos',v_authorized_property->'photos');
    END IF;
    SELECT jsonb_build_object(
      'title',hotel.title,'title_i18n',hotel.title_i18n,
      'description',hotel.description,'description_i18n',hotel.description_i18n,
      'city',hotel.city,'address_line',hotel.address_line,'district',hotel.district,
      'postal_code',hotel.postal_code,'country',hotel.country,
      'latitude',hotel.latitude,'longitude',hotel.longitude,
      'google_maps_url',hotel.google_maps_url,'amenities',hotel.amenities,
      'check_in_from',hotel.check_in_from,'check_out_until',hotel.check_out_until,
      'cover_image_url',hotel.cover_image_url,'photos',hotel.photos)
      INTO v_actual_property FROM public.hotels hotel WHERE hotel.id=c_hotel;
    v_parity := public.hotel_v2_h3_1p_parity_snapshot(c_hotel);

    -- Payment methods are inert configuration metadata, but they remain
    -- business-semantic values.  Trust the exact current arrays only when the
    -- complete policy state is the terminal state of the accepted Admin H3.1
    -- activity chain.  The count and arrays are deliberately not audit-date
    -- constants: a later reviewed Admin update extends the same exact chain.
    WITH payment_policy AS MATERIALIZED (
      SELECT policy.*,policy.xmin::text AS row_xmin
      FROM public.hotel_payment_policies policy
      WHERE policy.hotel_id=c_hotel
    ), target_policy AS MATERIALIZED (
      SELECT policy.*
      FROM payment_policy policy
      WHERE policy.code='seven-kamares-request-confirmation'
    ), current_payment_state AS MATERIALIZED (
      SELECT policy.id,policy.version,policy.row_xmin,
        (to_jsonb(policy)-'row_xmin')||jsonb_build_object(
          'terms',coalesce((SELECT jsonb_agg(to_jsonb(term)
              ORDER BY term.sequence,term.id)
            FROM public.hotel_payment_policy_terms term
            WHERE term.payment_policy_id=policy.id),'[]'::jsonb)) AS full_state
      FROM target_policy policy
    ), ordered_payment_activity AS MATERIALIZED (
      SELECT activity.*,activity.xmin::text AS row_xmin,
        row_number() OVER (ORDER BY activity.created_at,activity.id) AS ordinal,
        lag(activity.after_state) OVER (
          ORDER BY activity.created_at,activity.id) AS previous_after_state
      FROM public.hotel_activity_log activity
      WHERE activity.hotel_id=c_hotel
        AND activity.entity_type='payment_policy'
    ), activity_after_terms AS MATERIALIZED (
      SELECT activity.id AS activity_id,activity.ordinal,term.value AS term
      FROM ordered_payment_activity activity
      CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN jsonb_typeof(activity.after_state->'terms')='array'
          THEN activity.after_state->'terms'
        ELSE '[]'::jsonb END) term(value)
    ), activity_summary AS (
      SELECT count(*)::bigint AS activity_count,
        count(*) FILTER (WHERE activity.action='create')::bigint AS create_count,
        count(*) FILTER (WHERE activity.action='update')::bigint AS update_count,
        count(DISTINCT activity.correlation_id)::bigint AS correlation_count,
        coalesce(bool_and(
          activity.source='hotels_v2_h3_1_admin_configuration'
          AND activity.actor_type='admin'
          AND activity.actor_id IS NOT NULL
          AND activity.correlation_id IS NOT NULL
          AND CASE WHEN activity.ordinal=1 THEN
            activity.action='create' AND activity.before_state IS NULL
          ELSE activity.action='update'
            AND activity.before_state IS NOT DISTINCT FROM
              activity.previous_after_state
          END
        ),false) AS ordered_chain_exact
      FROM ordered_payment_activity activity
    )
    SELECT
      (SELECT count(*)=1 FROM payment_policy)
      AND (SELECT count(*)=1 FROM target_policy)
      AND coalesce((SELECT policy.currency='EUR'
          AND policy.is_active AND policy.review_status='reviewed'
          AND policy.version>0
        FROM target_policy policy),false)
      AND (SELECT count(*) FROM public.hotel_payment_policy_terms term
        JOIN target_policy policy ON policy.id=term.payment_policy_id
        WHERE term.hotel_id=c_hotel)=2
      AND EXISTS(SELECT 1 FROM public.hotel_payment_policy_terms term
        JOIN target_policy policy ON policy.id=term.payment_policy_id
        WHERE term.hotel_id=c_hotel AND term.sequence=1
          AND term.due_event='after_partner_acceptance'
          AND term.amount_mode='percent_total' AND term.amount_value=50
          AND term.recipient='partner')
      AND EXISTS(SELECT 1 FROM public.hotel_payment_policy_terms term
        JOIN target_policy policy ON policy.id=term.payment_policy_id
        WHERE term.hotel_id=c_hotel AND term.sequence=2
          AND term.due_event='on_arrival'
          AND term.amount_mode='remaining_balance' AND term.amount_value IS NULL
          AND term.recipient='partner')
      AND NOT EXISTS(SELECT 1 FROM public.hotel_payment_policy_terms term
        JOIN target_policy policy ON policy.id=term.payment_policy_id
        WHERE cardinality(term.payment_methods)<1
          OR NOT public.hotel_v2_h3_1_codes_valid(term.payment_methods)
          OR NOT term.payment_methods<@
            array['bank_transfer','cash','card','online']::text[]
          OR term.payment_methods IS DISTINCT FROM ARRAY(
            SELECT method FROM unnest(term.payment_methods) method ORDER BY method)
          OR term.version<>1),
      summary.activity_count>=1
      AND summary.create_count=1
      AND summary.update_count=summary.activity_count-1
      AND summary.correlation_count=summary.activity_count
      AND summary.ordered_chain_exact
      AND NOT EXISTS(SELECT 1 FROM ordered_payment_activity activity
        WHERE activity.entity_id IS DISTINCT FROM
            (SELECT policy.id FROM target_policy policy)
          OR jsonb_typeof(activity.after_state) IS DISTINCT FROM 'object'
          OR activity.after_state->>'id' IS DISTINCT FROM
            (SELECT policy.id::text FROM target_policy policy)
          OR activity.after_state->>'hotel_id' IS DISTINCT FROM c_hotel::text
          OR activity.after_state->>'code' IS DISTINCT FROM
            'seven-kamares-request-confirmation'
          OR activity.after_state->>'currency' IS DISTINCT FROM 'EUR'
          OR activity.after_state->>'is_active' IS DISTINCT FROM 'true'
          OR activity.after_state->>'review_status' IS DISTINCT FROM 'reviewed'
          OR CASE WHEN activity.after_state->>'version'~'^[1-9][0-9]*$'
            THEN (activity.after_state->>'version')::bigint<>activity.ordinal
            ELSE true END
          OR jsonb_typeof(activity.after_state->'terms') IS DISTINCT FROM 'array'
          OR (SELECT count(*) FROM activity_after_terms term
            WHERE term.activity_id=activity.id)<>2
          OR NOT EXISTS(SELECT 1 FROM activity_after_terms term
            WHERE term.activity_id=activity.id AND term.term->>'sequence'='1'
              AND term.term->>'due_event'='after_partner_acceptance'
              AND term.term->>'amount_mode'='percent_total'
              AND CASE WHEN term.term->>'amount_value'~'^[-+]?[0-9]+(\.[0-9]+)?$'
                THEN (term.term->>'amount_value')::numeric=50 ELSE false END
              AND term.term->>'recipient'='partner')
          OR NOT EXISTS(SELECT 1 FROM activity_after_terms term
            WHERE term.activity_id=activity.id AND term.term->>'sequence'='2'
              AND term.term->>'due_event'='on_arrival'
              AND term.term->>'amount_mode'='remaining_balance'
              AND term.term->'amount_value'='null'::jsonb
              AND term.term->>'recipient'='partner')
          OR EXISTS(SELECT 1 FROM activity_after_terms term
            WHERE term.activity_id=activity.id AND (
              term.term->>'hotel_id' IS DISTINCT FROM c_hotel::text
              OR term.term->>'payment_policy_id' IS DISTINCT FROM
                (SELECT policy.id::text FROM target_policy policy)
              OR term.term->>'sequence' NOT IN('1','2')
              OR term.term->>'version' IS DISTINCT FROM '1'
              OR jsonb_typeof(term.term->'payment_methods') IS DISTINCT FROM 'array'
              OR jsonb_array_length(CASE
                WHEN jsonb_typeof(term.term->'payment_methods')='array'
                  THEN term.term->'payment_methods' ELSE '[]'::jsonb END)<1
              OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(CASE
                  WHEN jsonb_typeof(term.term->'payment_methods')='array'
                    THEN term.term->'payment_methods' ELSE '[]'::jsonb END) method(value)
                WHERE method.value NOT IN('bank_transfer','cash','card','online'))
              OR jsonb_array_length(CASE
                  WHEN jsonb_typeof(term.term->'payment_methods')='array'
                    THEN term.term->'payment_methods' ELSE '[]'::jsonb END)<>
                (SELECT count(DISTINCT method.value)
                 FROM jsonb_array_elements_text(CASE
                   WHEN jsonb_typeof(term.term->'payment_methods')='array'
                     THEN term.term->'payment_methods' ELSE '[]'::jsonb END) method(value))
              OR term.term->'payment_methods' IS DISTINCT FROM
                (SELECT coalesce(jsonb_agg(to_jsonb(method.value)
                    ORDER BY method.value),'[]'::jsonb)
                 FROM jsonb_array_elements_text(CASE
                   WHEN jsonb_typeof(term.term->'payment_methods')='array'
                     THEN term.term->'payment_methods' ELSE '[]'::jsonb END) method(value))
            )))
      AND coalesce((SELECT activity.after_state IS NOT DISTINCT FROM state.full_state
          FROM ordered_payment_activity activity
          CROSS JOIN current_payment_state state
          ORDER BY activity.created_at DESC,activity.id DESC LIMIT 1),false)
      AND coalesce((SELECT activity.row_xmin=state.row_xmin
          AND NOT EXISTS(SELECT 1 FROM public.hotel_payment_policy_terms term
            WHERE term.payment_policy_id=state.id
              AND term.xmin::text<>activity.row_xmin)
          FROM ordered_payment_activity activity
          CROSS JOIN current_payment_state state
          ORDER BY activity.created_at DESC,activity.id DESC LIMIT 1),false)
      AND coalesce((SELECT state.version=summary.activity_count
          FROM current_payment_state state),false),
      summary.activity_count
    INTO v_payment_policy_identity_exact,
      v_payment_activity_chain_exact,v_payment_activity_count
    FROM activity_summary summary;

    SELECT NOT EXISTS(SELECT 1 FROM (VALUES
      ('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)',
        'plpgsql','v'::"char",true,array['search_path=pg_catalog, public, auth']::text[],true,false,
        '2e5c577dc7999322adef814a1658156ccf9e22958b58939033f0baf4af9d6fc7'),
      ('public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
        'plpgsql','v'::"char",true,array['search_path=pg_catalog, public']::text[],false,false,
        'da58fde24cde49476306b3c16340091989f66200f05d9fe1617dc4efaaf82048'),
      ('public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
        'plpgsql','v'::"char",true,array['search_path=pg_catalog, public, auth']::text[],false,false,
        'edcf0db5c9b3bcac0736893b5970c21ddce9876eed01327cc001123265ee111d'),
      ('public.hotel_v2_h3_1_payment_policy_constraint_trigger()',
        'plpgsql','v'::"char",false,array['search_path=pg_catalog, public']::text[],false,false,
        '02bb3e7a4deb3a122558fc999757b9b16b5536ff049027b2efc9d51e16d5be1e'),
      ('public.hotel_v2_h3_1_payment_terms_fingerprint(uuid)',
        'sql','s'::"char",false,array['search_path=pg_catalog, public']::text[],false,false,
        '8a998637085ce0ef5986c44fa3314ee3a864377d3dd5d277235800b26ba369b2'),
      ('public.hotel_v2_h3_1_validate_payment_policy(uuid)',
        'plpgsql','v'::"char",false,array['search_path=pg_catalog, public']::text[],false,false,
        '8cab255d64c241f17c39c37af0a1700cae3cb5749a3ef23abf2a37eff99df3b6'),
      ('public.hotel_v2_admin_get_h3_1_configuration(uuid)',
        'plpgsql','s'::"char",true,array['search_path=pg_catalog, public, auth']::text[],true,false,
        'f1e81cf98f4cba46f6bf8901a9de06acf568eda1a8e698c2a0d3c95ad2c69adb'),
      ('public.hotel_v2_h3_1_codes_valid(text[])',
        'sql','i'::"char",false,array['search_path=pg_catalog']::text[],true,true,
        'b42b2345900af0c711871b1baff071931edd28e7135baa3f4511e789b049d3af'),
      ('public.hotel_v2_set_updated_at_and_version()',
        'plpgsql','v'::"char",false,array['search_path=pg_catalog, public']::text[],false,true,
        '93256e7ee38459abf13272de79bd49c11bfe4dbe936c38f8630bedca7c76a3ca')
    ) expected(signature,language_name,volatility,security_definer,configuration,
        authenticated_execute,service_execute,source_hash)
    LEFT JOIN pg_proc procedure_row
      ON procedure_row.oid=to_regprocedure(expected.signature)
    LEFT JOIN pg_language language_row ON language_row.oid=procedure_row.prolang
    WHERE procedure_row.oid IS NULL
      OR procedure_row.proowner<>'postgres'::regrole
      OR procedure_row.prokind<>'f'
      OR language_row.lanname<>expected.language_name
      OR procedure_row.provolatile<>expected.volatility
      OR procedure_row.prosecdef IS DISTINCT FROM expected.security_definer
      OR procedure_row.proconfig IS DISTINCT FROM expected.configuration
      OR procedure_row.proleakproof OR procedure_row.proisstrict OR procedure_row.proretset
      OR encode(extensions.digest(convert_to(
        procedure_row.prosrc,'UTF8'),'sha256'),'hex')<>expected.source_hash
      OR has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      OR has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      OR has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        IS DISTINCT FROM expected.authenticated_execute
      OR has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
        IS DISTINCT FROM expected.service_execute)
    INTO v_payment_writer_security_exact;

    SELECT
      (SELECT count(*)=2 AND coalesce(bool_and(
        relation.relowner='postgres'::regrole AND relation.relkind='r'
        AND relation.relpersistence='p' AND relation.relrowsecurity
        AND NOT relation.relforcerowsecurity
        AND NOT has_table_privilege(0::oid,relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
        AND NOT has_table_privilege('anon',relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
        AND NOT has_table_privilege('authenticated',relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
        AND NOT has_table_privilege('service_role',relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
        AND NOT has_table_privilege(0::oid,relation.oid,'SELECT')
        AND NOT has_table_privilege('anon',relation.oid,'SELECT')
        AND NOT has_table_privilege('authenticated',relation.oid,'SELECT')
        AND has_table_privilege('service_role',relation.oid,'SELECT')),false)
       FROM pg_class relation WHERE relation.oid IN(
         'public.hotel_payment_policies'::regclass,
         'public.hotel_payment_policy_terms'::regclass))
      AND (SELECT count(*)=2 AND coalesce(bool_and(
        policy.polcmd='r' AND policy.polroles=array['authenticated'::regrole::oid]
        AND pg_get_expr(policy.polqual,policy.polrelid) LIKE '%is_current_user_admin()%'
        AND policy.polwithcheck IS NULL),false)
       FROM pg_policy policy WHERE policy.polrelid IN(
         'public.hotel_payment_policies'::regclass,
         'public.hotel_payment_policy_terms'::regclass))
      AND (SELECT count(*) FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid IN(
          'public.hotel_payment_policies'::regclass,
          'public.hotel_payment_policy_terms'::regclass)
          AND NOT trigger_row.tgisinternal)=4
      AND EXISTS(SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid='public.hotel_payment_policies'::regclass
          AND trigger_row.tgname='hotel_payment_policies_set_updated_at_and_version'
          AND trigger_row.tgfoid=to_regprocedure('public.hotel_v2_set_updated_at_and_version()')
          AND trigger_row.tgenabled='O' AND NOT trigger_row.tgisinternal)
      AND EXISTS(SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid='public.hotel_payment_policy_terms'::regclass
          AND trigger_row.tgname='hotel_payment_policy_terms_set_updated_at_and_version'
          AND trigger_row.tgfoid=to_regprocedure('public.hotel_v2_set_updated_at_and_version()')
          AND trigger_row.tgenabled='O' AND NOT trigger_row.tgisinternal)
      AND EXISTS(SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid='public.hotel_payment_policies'::regclass
          AND trigger_row.tgname='hotel_payment_policies_contract_guard'
          AND trigger_row.tgfoid=to_regprocedure(
            'public.hotel_v2_h3_1_payment_policy_constraint_trigger()')
          AND trigger_row.tgenabled='O' AND NOT trigger_row.tgisinternal)
      AND EXISTS(SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid='public.hotel_payment_policy_terms'::regclass
          AND trigger_row.tgname='hotel_payment_policy_terms_contract_guard'
          AND trigger_row.tgfoid=to_regprocedure(
            'public.hotel_v2_h3_1_payment_policy_constraint_trigger()')
          AND trigger_row.tgenabled='O' AND NOT trigger_row.tgisinternal)
      AND EXISTS(SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid='public.hotel_payment_policy_terms'::regclass
          AND constraint_row.conname='hotel_payment_policy_terms_methods_check'
          AND constraint_row.convalidated)
      AND EXISTS(SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid='public.hotel_payment_policy_terms'::regclass
          AND constraint_row.conname='hotel_payment_policy_terms_policy_sequence_key'
          AND constraint_row.contype='u' AND constraint_row.convalidated)
      AND EXISTS(SELECT 1 FROM pg_index index_row
        JOIN pg_class index_relation ON index_relation.oid=index_row.indexrelid
        WHERE index_row.indrelid='public.hotel_payment_policies'::regclass
          AND index_relation.relname='hotel_payment_policies_one_active_per_hotel_uidx'
          AND index_row.indisunique AND index_row.indisvalid AND index_row.indisready)
      AND EXISTS(SELECT 1 FROM pg_class relation
        WHERE relation.oid='public.hotel_activity_log'::regclass
          AND relation.relowner='postgres'::regrole AND relation.relrowsecurity
          AND NOT relation.relforcerowsecurity
          AND NOT has_table_privilege(0::oid,relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
          AND NOT has_table_privilege('anon',relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
          AND NOT has_table_privilege('authenticated',relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
          AND NOT has_table_privilege(0::oid,relation.oid,'SELECT')
          AND NOT has_table_privilege('anon',relation.oid,'SELECT')
          AND NOT has_table_privilege('authenticated',relation.oid,'SELECT')
          AND has_table_privilege('service_role',relation.oid,'SELECT,INSERT')
          AND NOT has_table_privilege('service_role',relation.oid,'UPDATE,DELETE,TRUNCATE'))
      AND (SELECT count(*) FROM pg_policy policy
        WHERE policy.polrelid='public.hotel_activity_log'::regclass)=1
      AND EXISTS(SELECT 1 FROM pg_policy policy
        WHERE policy.polrelid='public.hotel_activity_log'::regclass
          AND policy.polname='hotel_activity_log_admin_select'
          AND policy.polcmd='r'
          AND policy.polroles=array['authenticated'::regrole::oid]
          AND pg_get_expr(policy.polqual,policy.polrelid) LIKE '%is_current_user_admin()%'
          AND policy.polwithcheck IS NULL)
    INTO v_payment_relation_security_exact;

    SELECT public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(jsonb_build_object(
      'relation',constraint_row.conrelid::regclass::text,
      'name',constraint_row.conname,'type',constraint_row.contype,
      'validated',constraint_row.convalidated,
      'definition',pg_get_constraintdef(constraint_row.oid,false))
      ORDER BY constraint_row.conrelid::regclass::text,constraint_row.conname),
      '[]'::jsonb)) INTO v_payment_constraint_fingerprint
    FROM pg_constraint constraint_row WHERE constraint_row.conrelid IN(
      'public.hotel_payment_policies'::regclass,
      'public.hotel_payment_policy_terms'::regclass);
    SELECT public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(jsonb_build_object(
      'relation',trigger_row.tgrelid::regclass::text,
      'name',trigger_row.tgname,'type',trigger_row.tgtype,
      'enabled',trigger_row.tgenabled,
      'function',trigger_row.tgfoid::regprocedure::text,
      'definition',pg_get_triggerdef(trigger_row.oid,false))
      ORDER BY trigger_row.tgrelid::regclass::text,trigger_row.tgname),
      '[]'::jsonb)) INTO v_payment_trigger_fingerprint
    FROM pg_trigger trigger_row WHERE trigger_row.tgrelid IN(
      'public.hotel_payment_policies'::regclass,
      'public.hotel_payment_policy_terms'::regclass) AND NOT trigger_row.tgisinternal;
    SELECT public.hotel_v2_h3_2b_hash(jsonb_build_object(
      'relations',(SELECT jsonb_agg(jsonb_build_object(
        'relation',relation_row.oid::regclass::text,
        'owner',pg_get_userbyid(relation_row.relowner),
        'rls',relation_row.relrowsecurity,
        'force_rls',relation_row.relforcerowsecurity,
        'acl',(SELECT jsonb_agg(jsonb_build_object(
          'grantor',acl.grantor::regrole::text,
          'grantee',acl.grantee::regrole::text,
          'privilege',acl.privilege_type,'grantable',acl.is_grantable)
          ORDER BY acl.grantor::regrole::text,acl.grantee::regrole::text,
            acl.privilege_type) FROM aclexplode(relation_row.relacl) acl))
        ORDER BY relation_row.oid::regclass::text)
        FROM pg_class relation_row WHERE relation_row.oid IN(
          'public.hotel_activity_log'::regclass,
          'public.hotel_payment_policies'::regclass,
          'public.hotel_payment_policy_terms'::regclass)),
      'policies',(SELECT jsonb_agg(jsonb_build_object(
        'relation',policy_row.polrelid::regclass::text,
        'name',policy_row.polname,'command',policy_row.polcmd,
        'roles',(SELECT jsonb_agg(role_id::regrole::text
          ORDER BY role_id::regrole::text)
          FROM unnest(policy_row.polroles) role_id),
        'using',pg_get_expr(policy_row.polqual,policy_row.polrelid),
        'check',pg_get_expr(policy_row.polwithcheck,policy_row.polrelid))
        ORDER BY policy_row.polrelid::regclass::text,policy_row.polname)
        FROM pg_policy policy_row WHERE policy_row.polrelid IN(
          'public.hotel_activity_log'::regclass,
          'public.hotel_payment_policies'::regclass,
          'public.hotel_payment_policy_terms'::regclass))))
      INTO v_payment_security_fingerprint;

    v_payment_relation_security_exact := v_payment_relation_security_exact
      AND v_payment_constraint_fingerprint=
        '853f7af619c23d2428a55489e45426cfdc9e3625c58cae1c0f40de457158a24d'
      AND v_payment_trigger_fingerprint=
        '12324aa32db604c150aebd2e8d145d3ba4910c7b7e4628cbd882506f1dd85a1e'
      AND v_payment_security_fingerprint=
        'd179f634c0f079788cc05c51689c38aad00e0804793960a82a49de34983a621e';

    WITH expected(signature) AS (VALUES
      ('public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)'),
      ('public.hotel_v2_h3_1_payment_terms_fingerprint(uuid)')
    ), actual AS MATERIALIZED (
      SELECT procedure_row.oid
      FROM pg_proc procedure_row
      JOIN pg_namespace namespace_row ON namespace_row.oid=procedure_row.pronamespace
      WHERE namespace_row.nspname='public'
        AND procedure_row.prosrc~'\mpayment_methods\M'
    )
    SELECT (SELECT count(*) FROM actual)=2
      AND NOT EXISTS(SELECT 1 FROM actual procedure_actual
        WHERE NOT EXISTS(SELECT 1 FROM expected
          WHERE to_regprocedure(expected.signature)=procedure_actual.oid))
      AND NOT EXISTS(SELECT 1 FROM expected
        WHERE NOT EXISTS(SELECT 1 FROM actual
          WHERE actual.oid=to_regprocedure(expected.signature)))
      AND NOT EXISTS(SELECT 1 FROM pg_views view_row
        WHERE view_row.schemaname NOT IN('pg_catalog','information_schema')
          AND view_row.definition~'\mpayment_methods\M')
      AND NOT EXISTS(SELECT 1 FROM pg_matviews view_row
        WHERE view_row.schemaname NOT IN('pg_catalog','information_schema')
          AND view_row.definition~'\mpayment_methods\M')
    INTO v_payment_consumer_inventory_exact;

    v_payment_policy_lineage_safe := v_payment_policy_identity_exact
      AND v_payment_activity_chain_exact
      AND v_payment_writer_security_exact
      AND v_payment_relation_security_exact
      AND v_payment_consumer_inventory_exact;

    v_scoped_hotels_lineage_safe :=
      v_reconciliation_114360_safe
      AND v_reconciliation_114370_safe
      AND v_payment_policy_lineage_safe
      AND v_actual_property IS NOT NULL
      AND v_actual_property IS NOT DISTINCT FROM v_expected_property
      AND (SELECT count(*) FROM public.hotels WHERE id=c_hotel)=1
      AND (SELECT count(*) FROM public.partner_resources assignment
        WHERE assignment.resource_type='hotels' AND assignment.resource_id=c_hotel)=1
      AND (SELECT count(*) FROM public.partner_users member
        WHERE member.partner_id=v_owner.partner_id AND member.role='owner')=3
      AND (SELECT count(*) FROM public.hotel_room_types room WHERE room.hotel_id=c_hotel)=2
      AND (SELECT count(*) FROM public.hotel_room_types room
        WHERE room.hotel_id=c_hotel AND room.id IN(c_upper,c_ground) AND room.status='active')=2
      AND (SELECT count(*) FROM public.hotel_room_rates rate WHERE rate.hotel_id=c_hotel)=2
      AND (SELECT count(*) FROM public.hotel_room_rates rate
        WHERE rate.hotel_id=c_hotel AND rate.id IN(c_upper_rate,c_ground_rate)
          AND rate.room_type_id IN(c_upper,c_ground)
          AND rate.pricing_schedule_id=c_shared_schedule
          AND rate.review_status='reviewed' AND NOT rate.is_active
          AND rate.base_nightly_rate=0 AND rate.currency='EUR')=2
      AND (SELECT count(*) FROM public.hotel_pricing_schedules schedule
        WHERE schedule.hotel_id=c_hotel)=2
      AND EXISTS(SELECT 1 FROM public.hotel_pricing_schedules schedule
        WHERE schedule.id=c_shared_schedule AND schedule.hotel_id=c_hotel
          AND schedule.review_status='reviewed' AND NOT schedule.is_active
          AND schedule.application_scope='room_occupancy'
          AND schedule.minimum_billable_occupancy=2 AND schedule.maximum_party_size=4)
      AND EXISTS(SELECT 1 FROM public.hotel_pricing_schedules schedule
        WHERE schedule.id=c_legacy_schedule AND schedule.hotel_id=c_hotel
          AND schedule.review_status='requires_review' AND NOT schedule.is_active
          AND schedule.application_scope='property_booking_party')
      AND (SELECT count(*) FROM public.hotel_pricing_schedule_occupancy_tiers tier
        WHERE tier.schedule_id=c_shared_schedule AND tier.is_active)=27
      AND public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
      AND (v_parity->>'total_case_count')::integer=70
      AND (v_parity->>'total_mismatch_count')::integer=0
      AND EXISTS(SELECT 1 FROM public.hotels hotel WHERE hotel.id=c_hotel
        AND hotel.architecture_version='legacy'
        AND md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
        AND hotel.currency='EUR' AND hotel.minimum_stay_nights=2
        AND hotel.booking_mode='request_confirmation')
      AND (SELECT count(*) FROM public.hotel_commission_policies policy
        WHERE policy.hotel_id=c_hotel AND policy.is_active
          AND policy.review_status='reviewed')=1
      AND EXISTS(SELECT 1 FROM public.hotel_commission_policies policy
        WHERE policy.hotel_id=c_hotel AND policy.is_active AND policy.review_status='reviewed'
          AND policy.commission_mode='per_allocated_room_per_night'
          AND policy.amount=10 AND policy.currency='EUR')
      AND (SELECT count(*)=1 AND bool_and(setting.id=1
        AND NOT setting.hotel_rooms_v2_enabled
        AND setting.hotel_external_sync_enabled
        AND NOT setting.hotel_instant_booking_enabled
        AND NOT setting.hotel_stripe_connect_enabled) FROM public.site_settings setting)
      AND v_later_absent;
  END IF;

  SELECT count(*) INTO v_pending_property FROM public.hotel_partner_property_drafts
  WHERE hotel_id=c_hotel AND status='pending_admin_review';
  IF to_regclass('public.hotel_seven_arches_reviewed_pricing_proposals') IS NOT NULL THEN
    EXECUTE 'select count(*) from public.hotel_seven_arches_reviewed_pricing_proposals where hotel_id=$1 and status=''pending_admin_review'''
      INTO v_pending_pricing USING c_hotel;
  END IF;
  IF to_regclass('hotels_v2_private.hotel_external_calendar_partner_proposals') IS NOT NULL THEN
    EXECUTE 'select count(*) from hotels_v2_private.hotel_external_calendar_partner_proposals where hotel_id=$1 and status=''pending_admin_review'''
      INTO v_pending_provider USING c_hotel;
  END IF;

  SELECT count(*) INTO v_unconsumed_reviews FROM public.hotel_admin_availability_plan_reviews
  WHERE hotel_id=c_hotel AND consumed_at IS NULL;
  SELECT v_unconsumed_reviews+count(*) INTO v_unconsumed_reviews
  FROM public.hotel_partner_property_proposal_admin_reviews
  WHERE hotel_id=c_hotel AND consumed_at IS NULL;
  SELECT v_unconsumed_reviews+count(*) INTO v_unconsumed_reviews
  FROM hotels_v2_private.hotel_external_calendar_plan_reviews
  WHERE hotel_id=c_hotel AND actor_type='admin' AND consumed_at IS NULL;
  IF to_regclass('public.hotel_seven_arches_pricing_activation_reviews') IS NOT NULL THEN
    EXECUTE 'select $1+count(*) from public.hotel_seven_arches_pricing_activation_reviews where hotel_id=$2 and consumed_at is null'
      INTO v_unconsumed_reviews USING v_unconsumed_reviews,c_hotel;
  END IF;
  IF to_regclass('public.hotel_seven_arches_reviewed_pricing_admin_reviews') IS NOT NULL THEN
    EXECUTE 'select $1+count(*) from public.hotel_seven_arches_reviewed_pricing_admin_reviews where hotel_id=$2 and consumed_at is null'
      INTO v_unconsumed_reviews USING v_unconsumed_reviews,c_hotel;
  END IF;

  SELECT count(*) INTO v_transaction_contexts FROM public.hotel_admin_assignment_transaction_context;
  SELECT v_transaction_contexts+count(*) INTO v_transaction_contexts
    FROM public.hotel_partner_property_proposal_admin_transaction_context;
  FOREACH v_name IN ARRAY array[
    'public.hotel_seven_arches_pricing_activation_transaction_context',
    'public.hotel_seven_arches_reviewed_pricing_transaction_context',
    'public.hotel_seven_arches_public_booking_transaction_context'
  ] LOOP
    IF to_regclass(v_name) IS NOT NULL THEN
      EXECUTE format('select $1+count(*) from %s',to_regclass(v_name))
        INTO v_transaction_contexts USING v_transaction_contexts;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_open_jobs
  FROM hotels_v2_private.hotel_external_calendar_sync_jobs
  WHERE hotel_id=c_hotel AND status IN('queued','leased','running');
  SELECT count(*) INTO v_active_leases
  FROM hotels_v2_private.hotel_external_calendar_sync_jobs
  WHERE hotel_id=c_hotel AND status IN('leased','running')
    AND leased_until>statement_timestamp();
  SELECT count(*) INTO v_stale_leases
  FROM hotels_v2_private.hotel_external_calendar_sync_jobs
  WHERE hotel_id=c_hotel AND status IN('leased','running')
    AND (leased_until IS NULL OR leased_until<=statement_timestamp());

  SELECT count(*) INTO v_hotel_locks
  FROM pg_locks lock_row JOIN pg_class relation ON relation.oid=lock_row.relation
  JOIN pg_namespace namespace_row ON namespace_row.oid=relation.relnamespace
  WHERE lock_row.pid<>pg_backend_pid() AND relation.relkind IN('r','p')
    AND ((namespace_row.nspname='public'
          AND (relation.relname='hotels' OR relation.relname LIKE 'hotel\_%' ESCAPE '\'))
      OR (namespace_row.nspname='hotels_v2_private'
          AND relation.relname LIKE 'hotel\_%' ESCAPE '\'))
    AND (NOT lock_row.granted OR lock_row.mode IN(
      'RowExclusiveLock','ShareUpdateExclusiveLock','ShareLock','ShareRowExclusiveLock',
      'ExclusiveLock','AccessExclusiveLock'));
  FOREACH v_name IN ARRAY v_protected_names LOOP
    v_relation := to_regclass(v_name);
    IF v_relation IS NOT NULL THEN
      SELECT v_protected_locks+count(*) INTO v_protected_locks
      FROM pg_locks lock_row
      WHERE lock_row.pid<>pg_backend_pid() AND lock_row.relation=v_relation
        AND (NOT lock_row.granted OR lock_row.mode IN(
          'RowExclusiveLock','ShareUpdateExclusiveLock','ShareLock','ShareRowExclusiveLock',
          'ExclusiveLock','AccessExclusiveLock'));
    END IF;
  END LOOP;
  SELECT count(*) INTO v_long_transactions FROM pg_stat_activity activity
  WHERE activity.pid<>pg_backend_pid() AND activity.backend_type='client backend'
    AND activity.xact_start IS NOT NULL
    AND statement_timestamp()-activity.xact_start>interval '5 minutes';

  SELECT count(*) INTO v_unprocessed_outbox FROM public.hotel_partner_event_outbox event
  WHERE event.hotel_id=c_hotel AND (event.status<>'delivered' OR event.processed_at IS NULL);
  SELECT count(*) INTO v_exact_known_outbox
  FROM public.hotel_partner_event_outbox event
  JOIN public.hotel_admin_availability_foundation_evolution_receipts owner
    ON owner.id=1 AND owner.outbox_id=event.id
  WHERE event.id=c_owner_outbox AND event.hotel_id=c_hotel
    AND event.partner_id=owner.partner_id AND event.aggregate_type='hotel_partner_permissions'
    AND event.aggregate_id=owner.assignment_id
    AND event.event_type='hotel.partner_permissions.updated'
    AND event.dedupe_key='h3_2a:permission:'||owner.action_receipt_id::text
    AND event.status='pending' AND event.attempts=0
    AND event.locked_at IS NULL AND event.locked_by IS NULL
    AND event.processed_at IS NULL AND event.last_error IS NULL
    AND event.payload IS NOT DISTINCT FROM jsonb_build_object(
      'hotel_id',c_hotel,'assignment_id',owner.assignment_id,
      'partner_id',owner.partner_id,'permission_version',1,
      'has_mutation_capability',true,'correlation_id',owner.correlation_id)
    AND EXISTS(SELECT 1 FROM public.hotel_activity_log activity
      WHERE activity.id=owner.activity_id AND activity.hotel_id=c_hotel
        AND activity.entity_type='property' AND activity.entity_id=c_hotel
        AND activity.action='update'
        AND activity.source='hotels_v2_seven_arches_owner_capability_bootstrap'
        AND activity.correlation_id=owner.correlation_id)
    AND EXISTS(SELECT 1 FROM public.hotel_partner_action_receipts receipt
      WHERE receipt.id=owner.action_receipt_id AND receipt.hotel_id=c_hotel
        AND receipt.partner_id=owner.partner_id
        AND receipt.action='bootstrap_7_arches_owner_capabilities'
        AND receipt.correlation_id=owner.correlation_id
        AND receipt.result->>'source'='hotels_v2_seven_arches_owner_capability_bootstrap');
  v_known_outbox_nonblocking := v_unprocessed_outbox=0
    OR (v_unprocessed_outbox=1 AND v_exact_known_outbox=1);

  v_operation_rows := jsonb_build_array(
    jsonb_build_object('operation','pending_property_proposals','count',v_pending_property,
      'classification',CASE WHEN v_pending_property=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','pending_pricing_proposals','count',v_pending_pricing,
      'classification',CASE WHEN v_pending_pricing=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','pending_provider_proposals','count',v_pending_provider,
      'classification',CASE WHEN v_pending_provider=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','unconsumed_admin_reviews','count',v_unconsumed_reviews,
      'classification',CASE WHEN v_unconsumed_reviews=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','transaction_context_rows','count',v_transaction_contexts,
      'classification',CASE WHEN v_transaction_contexts=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','open_calendar_jobs','count',v_open_jobs,
      'classification',CASE WHEN v_open_jobs=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','active_calendar_leases','count',v_active_leases,
      'classification',CASE WHEN v_active_leases=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','stale_calendar_leases','count',v_stale_leases,
      'classification',CASE WHEN v_stale_leases=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','hotel_related_locks','count',v_hotel_locks,
      'classification',CASE WHEN v_hotel_locks=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','protected_relation_locks','count',v_protected_locks,
      'classification',CASE WHEN v_protected_locks=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','transactions_older_than_five_minutes','count',v_long_transactions,
      'classification',CASE WHEN v_long_transactions=0 THEN 'NON_BLOCKING' ELSE 'BLOCKING' END),
    jsonb_build_object('operation','unprocessed_hotel_outbox_rows','count',v_unprocessed_outbox,
      'classification',CASE WHEN v_known_outbox_nonblocking THEN 'NON_BLOCKING' ELSE 'BLOCKING' END)
  );
  v_maintenance_window_clear := v_pending_property=0 AND v_pending_pricing=0
    AND v_pending_provider=0 AND v_unconsumed_reviews=0 AND v_transaction_contexts=0
    AND v_open_jobs=0 AND v_active_leases=0 AND v_stale_leases=0
    AND v_hotel_locks=0 AND v_protected_locks=0 AND v_long_transactions=0
    AND v_known_outbox_nonblocking;

  v_vault_extension := EXISTS(SELECT 1 FROM pg_extension WHERE extname='supabase_vault')
    AND to_regclass('vault.secrets') IS NOT NULL;
  IF v_vault_extension THEN
    EXECUTE 'select count(*)=1 from vault.secrets where name=$1'
      INTO v_worker_url_secret USING 'hotels-v2-external-calendar-worker-url';
    EXECUTE 'select count(*)=1 from vault.secrets where name=$1'
      INTO v_worker_shared_secret USING 'hotels-v2-external-calendar-worker-shared-secret';
  END IF;
  SELECT NOT EXISTS(SELECT 1 FROM (VALUES
    ('public.hotel_v2_external_calendar_worker_get_source(uuid)'),
    ('public.hotel_v2_external_calendar_worker_list_sources(integer)'),
    ('public.hotel_v2_external_calendar_worker_begin_sync(jsonb)'),
    ('public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)'),
    ('public.hotel_v2_external_calendar_worker_fail_sync(jsonb)')
  ) expected(signature)
  LEFT JOIN pg_proc procedure_row ON procedure_row.oid=to_regprocedure(expected.signature)
  WHERE procedure_row.oid IS NULL OR procedure_row.proowner<>'postgres'::regrole
    OR NOT procedure_row.prosecdef
    OR procedure_row.proconfig IS DISTINCT FROM array['search_path=pg_catalog, public']::text[]
    OR has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
    OR has_function_privilege('anon',procedure_row.oid,'EXECUTE')
    OR has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    INTO v_worker_rpcs;
  SELECT NOT EXISTS(SELECT 1 FROM (VALUES
    ('public.hotel_v2_external_calendar_scheduler_enqueue(integer)',true),
    ('public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',true),
    ('public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',false),
    ('public.hotel_v2_external_calendar_scheduler_dispatch()',false)
  ) expected(signature,service_execute)
  LEFT JOIN pg_proc procedure_row ON procedure_row.oid=to_regprocedure(expected.signature)
  WHERE procedure_row.oid IS NULL OR procedure_row.proowner<>'postgres'::regrole
    OR NOT procedure_row.prosecdef
    OR procedure_row.proconfig IS DISTINCT FROM array['search_path=pg_catalog, public']::text[]
    OR has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
    OR has_function_privilege('anon',procedure_row.oid,'EXECUTE')
    OR has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
    OR has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
       IS DISTINCT FROM expected.service_execute)
    INTO v_scheduler_functions;
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'select count(*)=1 from cron.job where jobname=$1 and schedule=$2 and active and command=$3'
      INTO v_scheduler_job USING
        'hotels-v2-external-calendar-15m','*/15 * * * *',
        'select public.hotel_v2_external_calendar_scheduler_dispatch()';
  END IF;
  v_vault_worker_readiness_safe := v_vault_extension AND v_worker_url_secret
    AND v_worker_shared_secret AND v_worker_rpcs AND v_scheduler_functions AND v_scheduler_job;

  v_payload := jsonb_build_object(
    'transaction_safety',jsonb_build_object(
      'current_user',current_user,
      'transaction_read_only',current_setting('transaction_read_only'),
      'transaction_isolation',current_setting('transaction_isolation'),
      'current_timestamp',current_timestamp),
    'migration_history',v_history,
    'object_boundary',jsonb_build_object(
      'objects_114360_complete',v_objects_114360,
      'objects_114370_complete',v_objects_114370,
      'objects_114400_through_114450_absent',v_later_absent,
      'installed_object_boundary',v_installed_boundary),
    'reconciliation_114360',jsonb_build_object(
      'receipt_and_components_exact',v_owner_receipt_exact,
      'relation_trigger_rls_acl_exact',v_owner_relation_security_exact,
      'function_source_security_exact',v_owner_function_security_exact,
      'assignment_three_owners_permission_preset_exact',v_owner_receipt_exact,
      'activity_receipt_outbox_attribution_exact',v_owner_audit_exact,
      'reconciliation_114360_safe',v_reconciliation_114360_safe),
    'reconciliation_114370',jsonb_build_object(
      'foundation_receipt_exact',v_property_receipt_exact,
      'relation_rls_acl_exact',v_property_relation_security_exact,
      'function_source_security_exact',v_property_function_security_exact,
      'trigger_index_topology_exact',v_property_trigger_index_exact,
      'reviewed_property_workspace_attribution_exact',v_property_attribution_exact,
      'reconciliation_114370_safe',v_reconciliation_114370_safe),
    'scoped_hotels_lineage',jsonb_build_object(
      'hotel_id',c_hotel,
      'room_type_ids',jsonb_build_array(c_upper,c_ground),
      'parity_case_count',coalesce((v_parity->>'total_case_count')::integer,0),
      'parity_mismatch_count',coalesce((v_parity->>'total_mismatch_count')::integer,0),
      'commission_policy','per_allocated_room_per_night EUR 10',
      'payment_policy_activity_count',v_payment_activity_count,
      'payment_policy_identity_exact',v_payment_policy_identity_exact,
      'payment_activity_chain_exact',v_payment_activity_chain_exact,
      'payment_writer_security_exact',v_payment_writer_security_exact,
      'payment_relation_security_exact',v_payment_relation_security_exact,
      'payment_consumer_inventory_exact',v_payment_consumer_inventory_exact,
      'payment_policy_lineage_safe',v_payment_policy_lineage_safe,
      'payment_methods_execution_status',
        'SUPPORTED_INERT_CONFIGURATION_METADATA_NOT_AN_EXECUTABLE_PAYMENT_RAIL',
      'trusted_superuser_limitation',
        'privileged_postgres_direct_sql_not_cryptographically_excluded',
      'canonical_hotels_flags',jsonb_build_object(
        'rooms',false,'external',true,'instant',false,'stripe',false),
      'scoped_hotels_lineage_safe',v_scoped_hotels_lineage_safe),
    'open_operations',v_operation_rows,
    'outbox',jsonb_build_object(
      'unprocessed_hotel_rows',v_unprocessed_outbox,
      'exact_known_owner_capability_rows',v_exact_known_outbox,
      'known_outbox_nonblocking',v_known_outbox_nonblocking),
    'vault_worker_readiness',jsonb_build_array(
      jsonb_build_object('item','supabase_vault','status',CASE WHEN v_vault_extension THEN 'PRESENT' ELSE 'ABSENT' END,
        'evidence_source','database_catalog'),
      jsonb_build_object('item','HOTELS_V2_ICAL_SYNC_SECRET','status','PRESENT',
        'evidence_source','prior_read_only_edge_inventory; not SQL-visible'),
      jsonb_build_object('item','hotels-v2-external-calendar-worker-url','status',
        CASE WHEN v_worker_url_secret THEN 'PRESENT' ELSE 'ABSENT' END,'evidence_source','vault.secrets metadata only'),
      jsonb_build_object('item','hotels-v2-external-calendar-worker-shared-secret','status',
        CASE WHEN v_worker_shared_secret THEN 'PRESENT' ELSE 'ABSENT' END,'evidence_source','vault.secrets metadata only'),
      jsonb_build_object('item','worker_service_role_rpcs','status',
        CASE WHEN v_worker_rpcs THEN 'PRESENT' ELSE 'ABSENT' END,'evidence_source','database_catalog'),
      jsonb_build_object('item','scheduler_functions_and_job','status',
        CASE WHEN v_scheduler_functions AND v_scheduler_job THEN 'PRESENT' ELSE 'ABSENT' END,
        'evidence_source','database_catalog')),
    'summary',jsonb_build_object(
      'contract_version','hotels_v2_production_prewrite_reconciliation_readonly_v2',
      'transaction_read_only',current_setting('transaction_read_only'),
      'migration_history_boundary',v_history_boundary,
      'installed_object_boundary',v_installed_boundary,
      'reconciliation_114360_safe',v_reconciliation_114360_safe,
      'reconciliation_114370_safe',v_reconciliation_114370_safe,
      'payment_policy_lineage_safe',v_payment_policy_lineage_safe,
      'scoped_hotels_lineage_safe',v_scoped_hotels_lineage_safe,
      'maintenance_window_clear',v_maintenance_window_clear,
      'known_outbox_nonblocking',v_known_outbox_nonblocking,
      'vault_worker_readiness_safe',v_vault_worker_readiness_safe,
      'production_prewrite_supplementary_gate',
        current_setting('transaction_read_only')='on'
        AND v_history_boundary='114350'
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_history) item
          WHERE NOT (item->>'exact')::boolean)
        AND v_installed_boundary='114370'
        AND v_reconciliation_114360_safe
        AND v_reconciliation_114370_safe
        AND v_payment_policy_lineage_safe
        AND v_scoped_hotels_lineage_safe
        AND v_maintenance_window_clear
        AND v_known_outbox_nonblocking
        AND v_vault_worker_readiness_safe));
  PERFORM set_config('hotels_v2_prewrite.result',v_payload::text,true);
END
$production_prewrite_gate$;

SELECT
  diagnostic->>'current_user' AS current_user,
  diagnostic->>'transaction_read_only' AS transaction_read_only,
  diagnostic->>'transaction_isolation' AS transaction_isolation,
  diagnostic->>'current_timestamp' AS current_timestamp
FROM (SELECT current_setting('hotels_v2_prewrite.result')::jsonb->'transaction_safety' diagnostic) source;

SELECT
  item->>'migration' AS migration,
  (item->>'recorded')::boolean AS recorded,
  (item->>'expected_recorded')::boolean AS expected_recorded,
  (item->>'exact')::boolean AS exact
FROM jsonb_array_elements(
  current_setting('hotels_v2_prewrite.result')::jsonb->'migration_history') item;

SELECT * FROM jsonb_to_record(
  current_setting('hotels_v2_prewrite.result')::jsonb->'object_boundary') AS result(
    objects_114360_complete boolean,
    objects_114370_complete boolean,
    objects_114400_through_114450_absent boolean,
    installed_object_boundary text);

SELECT * FROM jsonb_to_record(
  current_setting('hotels_v2_prewrite.result')::jsonb->'reconciliation_114360') AS result(
    receipt_and_components_exact boolean,
    relation_trigger_rls_acl_exact boolean,
    function_source_security_exact boolean,
    assignment_three_owners_permission_preset_exact boolean,
    activity_receipt_outbox_attribution_exact boolean,
    reconciliation_114360_safe boolean);

SELECT * FROM jsonb_to_record(
  current_setting('hotels_v2_prewrite.result')::jsonb->'reconciliation_114370') AS result(
    foundation_receipt_exact boolean,
    relation_rls_acl_exact boolean,
    function_source_security_exact boolean,
    trigger_index_topology_exact boolean,
    reviewed_property_workspace_attribution_exact boolean,
    reconciliation_114370_safe boolean);

SELECT * FROM jsonb_to_record(
  current_setting('hotels_v2_prewrite.result')::jsonb->'scoped_hotels_lineage') AS result(
    hotel_id uuid,
    room_type_ids jsonb,
    parity_case_count integer,
    parity_mismatch_count integer,
    commission_policy text,
    payment_policy_activity_count bigint,
    payment_policy_identity_exact boolean,
    payment_activity_chain_exact boolean,
    payment_writer_security_exact boolean,
    payment_relation_security_exact boolean,
    payment_consumer_inventory_exact boolean,
    payment_policy_lineage_safe boolean,
    payment_methods_execution_status text,
    trusted_superuser_limitation text,
    canonical_hotels_flags jsonb,
    scoped_hotels_lineage_safe boolean);

SELECT
  item->>'operation' AS operation,
  (item->>'count')::bigint AS count,
  item->>'classification' AS classification
FROM jsonb_array_elements(
  current_setting('hotels_v2_prewrite.result')::jsonb->'open_operations') item;

SELECT * FROM jsonb_to_record(
  current_setting('hotels_v2_prewrite.result')::jsonb->'outbox') AS result(
    unprocessed_hotel_rows bigint,
    exact_known_owner_capability_rows bigint,
    known_outbox_nonblocking boolean);

SELECT
  item->>'item' AS item,
  item->>'status' AS status,
  item->>'evidence_source' AS evidence_source
FROM jsonb_array_elements(
  current_setting('hotels_v2_prewrite.result')::jsonb->'vault_worker_readiness') item;

SELECT * FROM jsonb_to_record(
  current_setting('hotels_v2_prewrite.result')::jsonb->'summary') AS result(
    contract_version text,
    transaction_read_only text,
    migration_history_boundary text,
    installed_object_boundary text,
    reconciliation_114360_safe boolean,
    reconciliation_114370_safe boolean,
    payment_policy_lineage_safe boolean,
    scoped_hotels_lineage_safe boolean,
    maintenance_window_clear boolean,
    known_outbox_nonblocking boolean,
    vault_worker_readiness_safe boolean,
    production_prewrite_supplementary_gate boolean);

ROLLBACK;
